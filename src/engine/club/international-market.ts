/**
 * Le marché international (V0.63).
 *
 * Jusqu'ici, le recrutement se faisait dans un pays fermé : trente clubs
 * français, un vivier d'agents libres français, et rien au-delà. Un quota qui
 * exige la moitié de joueurs formés en France n'a alors aucune force
 * contraignante : puisque tout le monde l'est, personne ne peut le violer. Le
 * pilier 4 du GDD (« le quota JIFF comme contrainte structurante ») restait une
 * ligne de règlement sans décision derrière.
 *
 * Ce module ouvre les deux sens de la frontière :
 *
 *  - **on achète à l'étranger** : un pool anglo-celte et hémisphère sud, des
 *    joueurs meilleurs que ce qu'on trouve à prix égal en France, mais **non
 *    JIFF**, si bien que chaque recrue rapproche la feuille de match du seuil ;
 *  - **on vend à l'étranger** : les clubs européens viennent chercher les
 *    meilleurs, avec des offres au-dessus du marché français, et un joueur
 *    parti hors de France perd la sélection (voir `Player.abroad`).
 *
 * ## Pourquoi c'est un arbitrage et pas un catalogue
 *
 * Un étranger coûte plus cher qu'un Français de niveau égal, arrive sans
 * repères (`adaptation.ts`) et consomme une place de non-JIFF. En face, il est
 * meilleur. Le manager qui remplit son effectif d'étrangers gagne des matchs et
 * finit par ne plus pouvoir composer une feuille conforme ; celui qui n'en
 * prend aucun se prive du seul marché où l'on trouve un ouvreur de vingt-six
 * ans en janvier.
 */

import { createRng } from '../rng.js';
import type { Club, ClubId, Player, Position } from '../types.js';
import { makeForeignPlayer, type ForeignCountry } from '../season/foreign-players.js';
import type { EuropeanWorld } from '../season/european-world.js';
import type { IncomingOffer } from './transfer-market.js';

// =============================================================================
// Le vivier
// =============================================================================

/**
 * D'où viennent les joueurs à vendre.
 *
 * Les nations du Nord fournissent l'essentiel, c'est le marché réel du Top 14,
 * et l'hémisphère sud les profils les plus chers, qui ne se déplacent pas
 * pour n'importe quel club.
 */
const SOURCE_COUNTRIES: readonly { readonly country: ForeignCountry; readonly weight: number }[] = [
  { country: 'ANGLETERRE', weight: 5 },
  { country: 'IRLANDE', weight: 3 },
  { country: 'ECOSSE', weight: 3 },
  { country: 'PAYS_DE_GALLES', weight: 4 },
  { country: 'ITALIE', weight: 2 },
  { country: 'AFRIQUE_DU_SUD', weight: 4 },
  { country: 'NOUVELLE_ZELANDE', weight: 3 },
  { country: 'AUSTRALIE', weight: 3 },
  { country: 'ARGENTINE', weight: 2 },
];

const POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT', 'ARRIERE',
];

export interface InternationalTarget {
  readonly player: Player;
  /** Club qu'il quitte : un vrai club du monde européen quand il en vient un. */
  readonly fromClubName: string;
  readonly country: ForeignCountry;
  /** Indemnité réclamée par le club vendeur. */
  readonly askingPrice: number;
  /** Salaire annuel attendu par le joueur. */
  readonly salaryDemand: number;
  /**
   * Réputation minimale du club acheteur.
   *
   * Un ouvreur international ne signe pas dans un club de bas de tableau parce
   * qu'on a mis l'argent : c'est ce qui empêche le marché de devenir un
   * catalogue où seul le budget décide.
   */
  readonly minimumReputation: number;
}

export interface InternationalMarketInput {
  readonly world: EuropeanWorld;
  readonly currentSeason: number;
  readonly seed: string;
  /** Fenêtre de mercato : l'été offre davantage de monde que l'hiver. */
  readonly window: 'ETE' | 'HIVER';
  readonly count?: number;
}

/**
 * Les joueurs étrangers disponibles cette fenêtre.
 *
 * Déterministe : la liste ne change pas d'un rendu à l'autre, et deux
 * chargements de la même partie proposent les mêmes hommes.
 */
export function generateInternationalTargets(
  input: InternationalMarketInput,
): readonly InternationalTarget[] {
  const rng = createRng(`intl_market_${input.seed}_${input.currentSeason}_${input.window}`);
  const count = input.count ?? (input.window === 'ETE' ? 14 : 6);
  const clubs = input.world.clubs;

  const weighted: ForeignCountry[] = [];
  for (const s of SOURCE_COUNTRIES) {
    for (let i = 0; i < s.weight; i++) weighted.push(s.country);
  }

  const targets: InternationalTarget[] = [];
  for (let i = 0; i < count; i++) {
    const country = weighted[rng.nextInt(0, weighted.length - 1)]!;
    const position = POSITIONS[rng.nextInt(0, POSITIONS.length - 1)]!;
    // Le marché n'est pas peuplé de cracks : la moitié des profils sont des
    // renforts honnêtes, et c'est ce qui rend les autres intéressants.
    const level = 58 + Math.round(Math.abs(rng.nextGaussian(0, 9)));
    const age = rng.nextInt(22, 32);

    // Le club d'origine : un club du monde européen quand le pays correspond,
    // sinon une franchise du Sud, qui n'existe pas dans les coupes d'Europe.
    const sameCountry = clubs.filter(c => c.country === country);
    const fromClub = sameCountry.length > 0
      ? sameCountry[rng.nextInt(0, sameCountry.length - 1)]!
      : undefined;

    const player = makeForeignPlayer({
      clubId: (fromClub?.id ?? `intl_${country.toLowerCase()}`) as ClubId,
      country,
      position,
      index: i,
      strength: Math.min(90, level),
      birthYear: input.currentSeason - age,
      identity: `intl_${input.seed}_${input.currentSeason}_${input.window}_${i}`,
      currentSeason: input.currentSeason,
    });

    targets.push({
      player,
      fromClubName: fromClub?.name ?? southernFranchiseName(country, rng.nextInt(0, 3)),
      country,
      askingPrice: askingPriceFor(level, age),
      salaryDemand: salaryDemandFor(level, age),
      minimumReputation: Math.max(30, Math.round(level - 22)),
    });
  }
  return targets;
}

/**
 * Franchises de l'hémisphère sud.
 *
 * Elles ne jouent aucune compétition du jeu : ce sont des provenances, pas des
 * adversaires. Les nommer évite qu'un joueur arrive « de nulle part ».
 */
function southernFranchiseName(country: ForeignCountry, index: number): string {
  const byCountry: Partial<Record<ForeignCountry, readonly string[]>> = {
    NOUVELLE_ZELANDE: ['Tasman Coast', 'Waiora', 'Southern Cross', 'Kauri Bay'],
    AUSTRALIE: ['Gold Reef', 'Barwon', 'Sunline', 'Port Aurora'],
    ARGENTINE: ['Río Verde', 'Pampas Sur', 'Los Andes', 'Costa Azul'],
    AFRIQUE_DU_SUD: ['Highveld', 'Karoo Bay', 'Stellenkloof', 'Drakensrand'],
  };
  const pool = byCountry[country];
  if (!pool) return 'Club étranger';
  return pool[index % pool.length]!;
}

/**
 * Le prix d'un joueur étranger.
 *
 * Volontairement au-dessus du marché français à niveau égal : on paie le
 * transfert **et** l'acclimatation. Le pic est à vingt-six ans, comme partout
 * ailleurs dans ce jeu.
 */
export function askingPriceFor(level: number, age: number): number {
  const base = Math.pow(Math.max(0, level - 50) / 10, 2.1) * 420_000;
  const agePenalty = age <= 26 ? 1 : Math.max(0.35, 1 - (age - 26) * 0.12);
  return Math.round((base * agePenalty) / 10_000) * 10_000;
}

export function salaryDemandFor(level: number, age: number): number {
  const base = 90_000 + Math.pow(Math.max(0, level - 50) / 10, 1.8) * 210_000;
  const experience = age >= 28 ? 1.08 : 1;
  return Math.round((base * experience) / 5_000) * 5_000;
}

// =============================================================================
// Acheter
// =============================================================================

export interface InternationalBid {
  readonly transferFee: number;
  readonly annualSalary: number;
  readonly years: number;
}

export type InternationalBidResponse =
  | { readonly kind: 'ACCEPT'; readonly updatedPlayer: Player }
  | { readonly kind: 'REFUSE'; readonly reason: string };

/**
 * La réponse à une offre pour un joueur étranger.
 *
 * Trois portes, et il faut passer les trois : le club vendeur veut son
 * indemnité, le joueur veut son salaire, et il veut un club à sa hauteur. La
 * dernière est celle qu'on oublie en écrivant un marché : sans elle, un promu
 * signerait un All Black dès qu'il en a les moyens.
 */
export function bidForInternationalTarget(input: {
  readonly target: InternationalTarget;
  readonly bid: InternationalBid;
  readonly buyingClub: Club;
  readonly currentSeason: number;
  readonly round: number;
  readonly seed: string;
}): InternationalBidResponse {
  const { target, bid } = input;

  if (bid.transferFee < target.askingPrice) {
    return {
      kind: 'REFUSE',
      reason: `${target.fromClubName} en réclame ${formatEuros(target.askingPrice)}.`,
    };
  }
  if (bid.annualSalary < target.salaryDemand) {
    return {
      kind: 'REFUSE',
      reason: `Le joueur attend ${formatEuros(target.salaryDemand)} par an.`,
    };
  }
  if (input.buyingClub.reputation < target.minimumReputation) {
    return {
      kind: 'REFUSE',
      reason: 'Il ne voit pas ce club comme une étape de sa carrière.',
    };
  }
  if (bid.years < 1) {
    return { kind: 'REFUSE', reason: 'Un contrat d\'un an minimum, pour traverser une frontière.' };
  }

  // Ce qui reste tient à l'homme : un joueur peu adaptable hésite à changer de
  // pays même quand tout le reste est réglé.
  const rng = createRng(`intl_bid_${input.seed}_${target.player.id as string}_${input.round}`);
  const willingness =
    0.55
    + (target.player.hidden.adaptabilite - 50) / 220
    + (target.player.hidden.ambition - 50) / 260
    + Math.min(0.2, (bid.annualSalary / Math.max(1, target.salaryDemand) - 1) * 0.5);
  if (!rng.nextBool(Math.max(0.2, Math.min(0.95, willingness)))) {
    return { kind: 'REFUSE', reason: 'Il préfère rester où il est cette saison.' };
  }

  return {
    kind: 'ACCEPT',
    updatedPlayer: {
      ...target.player,
      clubId: input.buyingClub.id,
      isJiff: false,
      freeAgent: false,
      contract: {
        startSeason: input.currentSeason,
        endSeason: input.currentSeason + bid.years,
        annualSalary: bid.annualSalary,
      },
      dynamic: { ...target.player.dynamic, joinedAtRound: input.round },
    },
  };
}

// =============================================================================
// Vendre
// =============================================================================

/**
 * L'intérêt étranger pour les joueurs du club dirigé.
 *
 * Il vise haut et paie mieux que le marché français, et c'est ce qui rend la
 * question difficile. Le revers est dans `Player.abroad` : le joueur vendu ne
 * portera plus le maillot bleu, et le manager le sait en signant.
 */
export function generateForeignInterest(input: {
  readonly playerClubId: ClubId;
  readonly roster: readonly Player[];
  readonly world: EuropeanWorld;
  readonly round: number;
  readonly currentSeason: number;
  readonly seed: string;
}): readonly IncomingOffer[] {
  if (input.world.clubs.length === 0) return [];
  const rng = createRng(`intl_interest_${input.seed}_${input.currentSeason}_${input.round}`);

  const candidates = input.roster.filter(p =>
    !p.retired && !p.freeAgent && !p.abroad && approximateOverall(p) >= 76,
  );
  if (candidates.length === 0) return [];
  // Rare : une offre étrangère n'arrive pas toutes les journées, sinon elle
  // cesserait d'être un événement.
  if (!rng.nextBool(0.06)) return [];

  const target = candidates[rng.nextInt(0, candidates.length - 1)]!;
  // Les clubs qui recrutent en France sont les plus riches du continent.
  const buyers = [...input.world.clubs].sort((a, b) => b.strength - a.strength).slice(0, 10);
  const buyer = buyers[rng.nextInt(0, buyers.length - 1)]!;

  const yearsLeft = Math.max(1, target.contract.endSeason - input.currentSeason);
  // La prime de l'étranger : environ un tiers au-dessus d'une offre française
  // comparable, parce qu'il faut convaincre un club de perdre un international.
  const transferAmount = Math.round(
    target.contract.annualSalary * yearsLeft * (2.0 + rng.next()) / 10_000,
  ) * 10_000;

  return [{
    id: `intl_offer_r${input.round}_${target.id as string}`,
    fromClubId: buyer.id,
    fromClubName: buyer.name,
    playerId: target.id,
    playerLastName: target.lastName,
    transferAmount,
    proposedAnnualSalary: Math.round(target.contract.annualSalary * (1.25 + rng.next() * 0.35)),
    proposedYears: rng.nextInt(2, 4),
    atRound: input.round,
  }];
}

/** Le joueur part à l'étranger : il quitte le championnat et la sélection. */
export function sendAbroad(player: Player, clubId: ClubId, currentSeason: number, years: number, salary: number): Player {
  return {
    ...player,
    clubId,
    abroad: true,
    freeAgent: false,
    contract: {
      startSeason: currentSeason,
      endSeason: currentSeason + years,
      annualSalary: salary,
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

function approximateOverall(p: Player): number {
  const t = p.technical;
  const ph = p.physical;
  const m = p.mental;
  const techAvg = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const physAvg = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const mentAvg = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (techAvg + physAvg + mentAvg) / 3;
}

function formatEuros(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}

/** Les cibles qu'un club peut réellement viser, sa réputation en main. */
export function reachableTargets(
  targets: readonly InternationalTarget[],
  club: Club,
): readonly InternationalTarget[] {
  return targets.filter(t => club.reputation >= t.minimumReputation);
}

/** Ce que coûterait la recrue sur la feuille de match, en places non-JIFF. */
export function jiffImpact(roster: readonly Player[], incoming: number): {
  readonly currentRatio: number;
  readonly afterRatio: number;
} {
  const active = roster.filter(p => !p.retired && !p.freeAgent && !p.abroad);
  const jiff = active.filter(p => p.isJiff).length;
  const total = active.length;
  return {
    currentRatio: total > 0 ? jiff / total : 0,
    afterRatio: total + incoming > 0 ? jiff / (total + incoming) : 0,
  };
}
