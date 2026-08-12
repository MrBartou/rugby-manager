/**
 * Transferts sortants — V0.28.
 *
 * Le marché n'exposait que `offerToFreeAgent` : on pouvait parcourir les 245
 * joueurs du championnat, les scouter, affiner leur estimation… et **ne jamais
 * en signer un seul**. Les agents libres n'apparaissant qu'après un changement
 * de saison, l'onglet Transferts était une impasse pendant toute la saison.
 *
 * Ce module ferme la boucle : proposer une offre pour un joueur sous contrat,
 * obtenir l'accord du club vendeur, puis celui du joueur.
 *
 * ## Deux décisions distinctes
 *
 * Un transfert échoue de deux façons très différentes, et le manager doit
 * comprendre laquelle :
 *
 *  - **le club refuse** — l'indemnité ne couvre pas la valeur, ou il ne peut pas
 *    se permettre de perdre son seul joueur à ce poste
 *  - **le joueur refuse** — le salaire, le projet sportif ou son temps de jeu
 *    probable ne le convainquent pas
 *
 * C'est aussi ici que `hidden.ambition` et `hidden.loyaute` servent enfin : ils
 * existaient depuis le début sans jamais influencer quoi que ce soit.
 */

import type { Rng } from '../rng.js';
import type { Club, ClubId, Player, PlayerId } from '../types.js';
import { approximateOverall } from './development.js';
import { canCover } from '../match/bench.js';
import { expectedMarketSalary } from './contracts.js';

// =============================================================================
// Valorisation
// =============================================================================

function ageOf(player: Player, season: number): number {
  return season - Number(player.birthDate.slice(0, 4));
}

/**
 * Coefficient d'âge appliqué à la valeur marchande.
 *
 * Un joueur de 21 ans vaut plus cher que son niveau actuel ne le justifie : on
 * achète ses saisons à venir. À 33 ans, l'inverse.
 */
function ageValueFactor(age: number): number {
  if (age <= 20) return 1.55;
  if (age <= 23) return 1.40;
  if (age <= 26) return 1.15;
  if (age <= 28) return 1.00;
  if (age <= 30) return 0.78;
  if (age <= 32) return 0.52;
  if (age <= 34) return 0.30;
  return 0.15;
}

/**
 * Valeur marchande estimée d'un joueur, en euros.
 *
 * Progression fortement non linéaire : l'écart de prix entre un joueur à 70 et
 * un joueur à 85 est bien plus grand que celui entre 55 et 70, comme sur le vrai
 * marché où les internationaux confirmés sont rares.
 *
 * L'échelle est calée sur la trésorerie du jeu (~40 M€ pour un club de milieu de
 * tableau) : un titulaire solide coûte 2-3 M€, un international 9-12 M€. Une
 * courbe plus douce mettait les meilleurs joueurs du championnat sous le million
 * — le manager achetait la moitié du Top 14 dès la première journée, et
 * l'indemnité cessait d'être une décision.
 */
export function estimateMarketValue(player: Player, currentSeason: number): number {
  const overall = approximateOverall(player);
  const age = ageOf(player, currentSeason);

  // Base cubique sur le niveau au-dessus du seuil professionnel.
  const level = Math.max(0, overall - 45);
  const base = 30_000 + level ** 3 * 220;

  let value = base * ageValueFactor(age);

  // Un contrat qui s'achève fait chuter l'indemnité : le club risque de le
  // perdre gratuitement l'année suivante.
  const yearsLeft = Math.max(0, player.contract.endSeason - currentSeason);
  if (yearsLeft <= 0) value *= 0.25;
  else if (yearsLeft === 1) value *= 0.55;
  else if (yearsLeft === 2) value *= 0.85;

  // Un blessé perd de la valeur le temps de son indisponibilité.
  if (player.dynamic.injury) value *= 0.75;

  return Math.max(20_000, Math.round(value / 10_000) * 10_000);
}

// =============================================================================
// L'offre
// =============================================================================

export interface TransferOffer {
  readonly playerId: PlayerId;
  readonly fromClubId: ClubId;
  readonly toClubId: ClubId;
  /** Indemnité de transfert proposée au club vendeur. */
  readonly fee: number;
  /** Salaire annuel proposé au joueur. */
  readonly annualSalary: number;
  readonly years: number;
}

export type RefusalSource = 'CLUB' | 'JOUEUR';

export interface OfferResponse {
  readonly accepted: boolean;
  readonly reason: string;
  /** Renseigné en cas de refus du club : ce qu'il accepterait. */
  readonly counterFee?: number;
}

// =============================================================================
// Décision du club vendeur
// =============================================================================

export interface ClubDecisionInput {
  readonly offer: TransferOffer;
  readonly player: Player;
  readonly sellingClub: Club;
  /** Effectif du club vendeur, pour juger de sa profondeur au poste. */
  readonly sellingRoster: readonly Player[];
  readonly currentSeason: number;
  /** Trésorerie du vendeur : un club en difficulté vend plus facilement. */
  readonly sellingBalance: number;
}

/**
 * Le club vendeur accepte-t-il l'indemnité ?
 *
 * Trois facteurs : le rapport offre / valeur, sa profondeur au poste, et sa
 * situation financière.
 */
/**
 * Nombre de joueurs capables de tenir le poste si celui-ci part.
 *
 * On raisonne par **groupe de postes**, pas par poste exact : un troisième ligne
 * couvre l'autre aile, un centre dépanne à l'ouverture. À poste exact, 61 % des
 * joueurs du championnat étaient les seuls détenteurs du leur — ils devenaient
 * tous intransférables, et la mécanique de transfert ne servait à rien.
 *
 * La première ligne reste l'exception que `canCover` connaît déjà : on ne
 * bricole pas un pilier, et un club qui n'en a qu'un ne le vend pas.
 */
function coverAtPosition(player: Player, roster: readonly Player[]): number {
  return roster.filter(
    p => p.id !== player.id && !p.retired && !p.freeAgent && canCover(p, player.position),
  ).length;
}

/**
 * Prix auquel le club vendeur accepte de céder le joueur.
 *
 * Sa valeur marchande, corrigée par ce que le départ coûterait au club : la
 * profondeur au poste, le statut du joueur dans la hiérarchie, et l'urgence
 * financière — c'est cette dernière qui crée les bonnes affaires du marché.
 */
export function askingPriceFor(input: ClubDecisionInput): number {
  const { player, sellingRoster, currentSeason, sellingBalance } = input;
  const value = estimateMarketValue(player, currentSeason);

  // Calé sur la profondeur réelle des effectifs (médiane ~4 couvertures) :
  // seuls les postes véritablement dégarnis déclenchent une prime.
  const cover = coverAtPosition(player, sellingRoster);
  const depthPremium = cover <= 1 ? 1.85 : cover === 2 ? 1.35 : cover === 3 ? 1.12 : 1.0;

  const ranked = [...sellingRoster]
    .filter(p => !p.retired && !p.freeAgent)
    .sort((a, b) => approximateOverall(b) - approximateOverall(a));
  const rank = ranked.findIndex(p => p.id === player.id);
  const starPremium = rank >= 0 && rank < 5 ? 1.25 : rank < 12 ? 1.05 : 0.92;

  const distress = sellingBalance < 0 ? 0.75 : sellingBalance < 3_000_000 ? 0.9 : 1.0;

  // Un club qui vient de sécuriser un joueur sur la durée n'a aucune raison de
  // s'en séparer au prix du marché. Sans cette prime, les mêmes joueurs
  // rebondissaient de club en club chaque intersaison.
  const yearsLeft = player.contract.endSeason - currentSeason;
  const freshContract = yearsLeft >= 3 ? 1.25 : 1.0;

  return Math.round(
    (value * depthPremium * starPremium * distress * freshContract) / 10_000,
  ) * 10_000;
}

export function evaluateClubOffer(input: ClubDecisionInput): OfferResponse {
  const { offer, player, sellingRoster } = input;
  const cover = coverAtPosition(player, sellingRoster);

  // Aucune couverture : le club ne peut pas aligner une équipe sans lui, quel
  // que soit le chèque. Ce refus passe **avant** l'examen du prix — sinon une
  // offre assez grosse emportait un joueur déclaré non vendable.
  if (cover === 0) {
    return {
      accepted: false,
      reason: `Personne au club ne peut tenir le poste de ${player.lastName} : il n'est pas à vendre.`,
    };
  }

  const askingPrice = askingPriceFor(input);

  if (offer.fee >= askingPrice) {
    return { accepted: true, reason: `Indemnité jugée suffisante (valeur estimée ${formatM(askingPrice)}).` };
  }

  // Le vendeur ne chiffre sa demande que face à une offre sérieuse. Sinon un
  // euro symbolique suffirait à connaître le tarif de tout le championnat, et
  // le scouting perdrait sa raison d'être dans la valorisation.
  const engaged = offer.fee >= askingPrice * ENGAGEMENT_THRESHOLD;

  if (!engaged) {
    return { accepted: false, reason: 'Offre très en dessous de la valeur du joueur.' };
  }

  return {
    accepted: false,
    reason: `Offre insuffisante. ${formatM(askingPrice)} et le joueur est à vous.`,
    counterFee: askingPrice,
  };
}

/**
 * Part de la demande à atteindre pour que le club daigne annoncer son prix.
 * Assez haut pour qu'il faille une estimation correcte, assez bas pour qu'une
 * bonne approche débloque la négociation en un aller-retour.
 */
const ENGAGEMENT_THRESHOLD = 0.6;

// =============================================================================
// Décision du joueur
// =============================================================================

/**
 * Rang tel qu'un joueur perçoit un club — V0.30.
 *
 * Ni le classement du moment, ni la seule réputation : la moyenne des deux. Un
 * grand club qui traverse une mauvaise saison continue d'attirer, et un promu
 * en tête après douze journées ne devient pas instantanément une destination
 * de rêve.
 *
 * Sans ce lissage, le mercato d'hiver était impossible : ceux qui ont besoin de
 * se renforcer sont par définition mal classés, donc personne n'acceptait de
 * les rejoindre. Formule partagée entre l'IA et le manager — les deux doivent
 * séduire un joueur avec les mêmes arguments.
 */
export function perceivedRank(currentRank: number, reputationRank: number): number {
  return (currentRank + reputationRank) / 2;
}

export interface PlayerDecisionInput {
  readonly offer: TransferOffer;
  readonly player: Player;
  readonly currentSeason: number;
  /** Rang du club acheteur au classement (1 = leader). */
  readonly buyerRank: number;
  /** Rang du club actuel du joueur. */
  readonly currentRank: number;
  /** Effectif de l'acheteur : sert à estimer le temps de jeu promis. */
  readonly buyerRoster: readonly Player[];
  readonly totalClubs: number;
}

/**
 * Le joueur accepte-t-il de signer ?
 *
 * Quatre leviers : le salaire, l'ambition sportive (progresser au classement),
 * le temps de jeu probable, et la loyauté envers son club actuel.
 */
export function evaluatePlayerOffer(input: PlayerDecisionInput, rng: Rng): OfferResponse {
  const { offer, player, currentSeason, buyerRank, currentRank, buyerRoster, totalClubs } = input;

  const expected = expectedMarketSalary(player, currentSeason);
  const current = player.contract.annualSalary;

  // Un joueur sous contrat ne part pas par défaut : il faut une vraie raison.
  // Sans cette inertie, une offre tiède suffirait à débaucher n'importe qui.
  let score = -16;

  // 1. Salaire — comparé à ce qu'il touche et à ce qu'il vaut sur le marché.
  //    Le terme **sature** : sinon tripler le salaire rapportait +200 points et
  //    l'argent écrasait le projet sportif, le temps de jeu et la loyauté. Au-delà
  //    d'un certain niveau, un joueur bien payé l'est déjà assez.
  const salaryRatio = offer.annualSalary / Math.max(expected, current);
  const salaryAppeal = Math.tanh((salaryRatio - 1) * 1.5) * 42;
  score += salaryAppeal;

  // 2. Ambition sportive — monter au classement séduit, descendre rebute.
  //    Pondéré par `hidden.ambition`, jusque-là totalement inexploité.
  //    Le gain est rapporté à la taille du championnat : gagner trois places
  //    dans un Top 14 pèse plus que dans une ligue de trente clubs.
  const rankGain = currentRank - buyerRank;      // positif = le club acheteur est mieux classé
  const normalisedGain = (rankGain / Math.max(2, totalClubs)) * 14;
  score += normalisedGain * (player.hidden.ambition / 100) * 3.2;

  // 3. Temps de jeu probable — combien de joueurs meilleurs à son poste chez l'acheteur ?
  const betterAtPosition = buyerRoster.filter(
    p => p.position === player.position
      && !p.retired && !p.freeAgent
      && approximateOverall(p) > approximateOverall(player),
  ).length;
  const playingTimePenalty = betterAtPosition === 0 ? 12 : betterAtPosition === 1 ? 0 : -14 * betterAtPosition;
  score += playingTimePenalty;

  // 4. Loyauté — un joueur attaché à son club exige davantage pour bouger.
  score -= (player.hidden.loyaute / 100) * 22;

  // Un joueur en fin de contrat est plus enclin à partir.
  const yearsLeft = Math.max(0, player.contract.endSeason - currentSeason);
  if (yearsLeft <= 1) score += 14;

  // Part d'aléa : deux joueurs identiques ne répondent pas toujours pareil.
  score += rng.nextGaussian(0, 7);

  if (score >= 0) {
    return {
      accepted: true,
      reason: salaryRatio >= 1.2
        ? 'Le salaire proposé emporte la décision.'
        : normalisedGain > 3
          ? 'Le projet sportif le convainc.'
          : 'Il accepte de relever le défi.',
    };
  }

  // Motif de refus le plus déterminant, pour que le manager sache quoi corriger.
  const reasons: { weight: number; text: string }[] = [
    { weight: -salaryAppeal, text: `Salaire jugé insuffisant (il attend au moins ${formatK(Math.round(expected * 1.05))}).` },
    { weight: -normalisedGain * 3, text: 'Il ne voit pas l\'intérêt sportif de rejoindre un club moins bien classé.' },
    { weight: -playingTimePenalty, text: 'Il craint de ne pas être titulaire à son poste.' },
    { weight: (player.hidden.loyaute / 100) * 22, text: 'Il est très attaché à son club actuel.' },
  ];
  reasons.sort((a, b) => b.weight - a.weight);

  return { accepted: false, reason: reasons[0]!.text };
}

// =============================================================================
// Résolution complète
// =============================================================================

export interface TransferResolution {
  readonly accepted: boolean;
  /** Où l'offre a échoué, le cas échéant. */
  readonly refusedBy?: RefusalSource;
  readonly clubResponse: OfferResponse;
  readonly playerResponse?: OfferResponse;
  /** Joueur mis à jour (nouveau club, nouveau contrat) si le transfert aboutit. */
  readonly player?: Player;
}

export interface ResolveTransferInput extends ClubDecisionInput {
  readonly buyerRank: number;
  readonly currentRank: number;
  readonly buyerRoster: readonly Player[];
  readonly totalClubs: number;
}

/**
 * Résout une offre de bout en bout : d'abord le club, puis le joueur.
 *
 * L'ordre compte — un club qui refuse l'indemnité clôt la discussion sans même
 * que le joueur soit consulté, comme dans la réalité.
 */
export function resolveTransferOffer(input: ResolveTransferInput, rng: Rng): TransferResolution {
  const clubResponse = evaluateClubOffer(input);
  if (!clubResponse.accepted) {
    return { accepted: false, refusedBy: 'CLUB', clubResponse };
  }

  const playerResponse = evaluatePlayerOffer(
    {
      offer: input.offer,
      player: input.player,
      currentSeason: input.currentSeason,
      buyerRank: input.buyerRank,
      currentRank: input.currentRank,
      buyerRoster: input.buyerRoster,
      totalClubs: input.totalClubs,
    },
    rng,
  );

  if (!playerResponse.accepted) {
    return { accepted: false, refusedBy: 'JOUEUR', clubResponse, playerResponse };
  }

  const player: Player = {
    ...input.player,
    clubId: input.offer.toClubId,
    contract: {
      ...input.player.contract,
      startSeason: input.currentSeason,
      endSeason: input.currentSeason + input.offer.years,
      annualSalary: input.offer.annualSalary,
    },
    // Un joueur qui vient d'obtenir son transfert arrive gonflé à bloc.
    dynamic: { ...input.player.dynamic, mood: Math.min(100, input.player.dynamic.mood + 12) },
  };

  return { accepted: true, clubResponse, playerResponse, player };
}

// =============================================================================
// Garde-fous côté acheteur
// =============================================================================

export interface AffordabilityCheck {
  readonly canAfford: boolean;
  readonly reason?: string;
}

/**
 * L'acheteur peut-il assumer ce transfert ?
 *
 * On vérifie la trésorerie **et** la masse salariale : un club peut avoir les
 * liquidités pour l'indemnité sans pouvoir porter le salaire sur la durée.
 */
export function canAffordTransfer(input: {
  readonly fee: number;
  readonly annualSalary: number;
  readonly balance: number;
  readonly currentPayroll: number;
  readonly annualBudget: number;
}): AffordabilityCheck {
  if (input.fee > input.balance) {
    return { canAfford: false, reason: `Trésorerie insuffisante : il manque ${formatM(input.fee - input.balance)}.` };
  }
  const newPayroll = input.currentPayroll + input.annualSalary;
  if (newPayroll > input.annualBudget) {
    return {
      canAfford: false,
      reason: `Ce salaire ferait dépasser le budget annuel de ${formatM(newPayroll - input.annualBudget)}.`,
    };
  }
  return { canAfford: true };
}

// =============================================================================
// Formatage
// =============================================================================

function formatM(n: number): string {
  return Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)} M€`
    : `${Math.round(n / 1_000)} k€`;
}

function formatK(n: number): string {
  return `${Math.round(n / 1_000)} k€`;
}
