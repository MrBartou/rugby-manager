/**
 * Le prêt — V0.55.
 *
 * Le jeu sait former des joueurs depuis la V0.39, annoncer à l'un d'eux qu'il
 * est un espoir depuis la V0.50, et faire progresser un jeune **à proportion de
 * ses minutes** depuis la V0.14. Une Pro D2 se joue vraiment depuis la V0.44.
 *
 * Et pourtant un jeune n'avait que deux issues :
 *
 *  - prendre des minutes à l'équipe première, ce qu'une course au titre
 *    interdit ;
 *  - rester sur le banc et **stagner**, puisque la progression se paie en
 *    minutes.
 *
 * La troisième voie manquait, alors qu'elle est la plus banale du rugby
 * professionnel : l'envoyer jouer ailleurs. C'est la pièce entre « je l'ai
 * formé » et « il est devenu bon ».
 *
 * ## Ce que le module simule, et ce qu'il ne simule pas
 *
 * Il ne fait pas jouer un championnat de Pro D2 à la phase près pour un joueur
 * prêté : le moteur n'en a pas besoin, et ce serait cher pour une information
 * qu'on peut estimer. Ce qu'il calcule, c'est **ce que le prêt rapporte** —
 * des minutes, donc de la progression — et **ce qu'il coûte** : un joueur en
 * moins pour la saison, et une part de salaire qu'on continue de payer.
 */

import type { Club, ClubId, Player, PlayerId } from '../types.js';
import type { Rng } from '../rng.js';

// =============================================================================
// Qui peut partir
// =============================================================================

/** Âge au-delà duquel un prêt formateur n'a plus de sens. */
export const LOAN_MAX_AGE = 23;
/** Part de matchs au-dessus de laquelle il joue déjà assez ici. */
export const LOAN_MAX_PLAY_RATIO = 0.35;

/**
 * Ce joueur gagnerait-il à partir jouer ailleurs ?
 *
 * Trois conditions, et la troisième est la plus importante : **il ne joue pas
 * assez ici**. Prêter un titulaire n'aurait aucun sens formateur, et prêter un
 * joueur de trente ans non plus — à cet âge, ce qu'il lui faut n'est plus du
 * temps de jeu, c'est un autre club.
 */
export function isLoanable(input: {
  readonly player: Player;
  readonly playRatio: number;
  readonly currentSeason: number;
}): boolean {
  const { player } = input;
  if (player.retired || player.freeAgent || player.dynamic.injury) return false;
  const age = input.currentSeason - Number(player.birthDate.slice(0, 4));
  if (age > LOAN_MAX_AGE) return false;
  if (input.playRatio > LOAN_MAX_PLAY_RATIO) return false;
  // Un contrat qui s'achève : le prêter reviendrait à le perdre pour rien.
  return player.contract.endSeason > input.currentSeason;
}

// =============================================================================
// Les offres
// =============================================================================

export interface LoanOffer {
  readonly clubId: ClubId;
  readonly clubName: string;
  /** Part de matchs que le club s'engage à lui donner, 0-1. */
  readonly playingTime: number;
  /** Part du salaire prise en charge par le club accueillant, 0-1. */
  readonly wageShare: number;
  /** Ce que le club promet, en clair. */
  readonly pitch: string;
  /** V0.64 — ce que le club d'accueil met sur la table pour le garder. */
  readonly optionToBuy?: LoanOption;
}

/**
 * L'option d'achat, V0.64.
 *
 * Elle change la nature du prêt. Un prêt sec est un investissement dans un
 * joueur qu'on récupérera ; un prêt avec option obligatoire est une vente
 * différée, et le club d'accueil paie l'attente. Entre les deux, l'option
 * facultative laisse au club d'accueil le droit de juger sur pièces, et c'est
 * pour cela qu'il en paie moins cher le principe.
 */
export interface LoanOption {
  readonly fee: number;
  /** Obligatoire : le joueur est vendu quoi qu'il arrive à la fin du prêt. */
  readonly mandatory: boolean;
}

/**
 * Ce qu'on propose pour un joueur donné.
 *
 * Le principe est un **arbitrage**, et c'est ce qui en fait une décision : plus
 * le club est modeste, plus il fait jouer et moins il paie. Envoyer un espoir
 * dans un gros club de Pro D2 le fera moins jouer qu'à Vannes, mais coûtera
 * moins cher et l'exposera à un meilleur niveau.
 */
export function loanOffersFor(input: {
  readonly player: Player;
  /** Clubs susceptibles d'accueillir : Pro D2, et les petits Top 14. */
  readonly clubs: readonly Club[];
  readonly ownClubId: ClubId;
  readonly rng: Rng;
  /** V0.64 — valeur marchande du joueur, base de l'option d'achat éventuelle. */
  readonly optionValue?: number;
}): readonly LoanOffer[] {
  const candidates = input.clubs
    .filter(c => c.id !== input.ownClubId)
    .filter(c => c.reputation <= 62)
    .sort((a, b) => a.reputation - b.reputation);

  if (candidates.length === 0) return [];

  const offers: LoanOffer[] = [];
  // Trois propositions au plus : au-delà, le choix devient une liste à lire.
  const picked = new Set<string>();
  for (let i = 0; i < 3 && picked.size < candidates.length; i++) {
    const club = candidates[input.rng.nextInt(0, candidates.length - 1)]!;
    if (picked.has(club.id as string)) continue;
    picked.add(club.id as string);

    // Plus le club est modeste, plus il fait jouer et moins il participe.
    const modesty = Math.max(0, Math.min(1, (62 - club.reputation) / 32));
    const playingTime = Math.round((0.45 + modesty * 0.4) * 100) / 100;
    const wageShare = Math.round((0.65 - modesty * 0.35) * 100) / 100;

    // Un club sur trois veut se garder la main sur la suite, et il le dit tout
    // de suite : une option surgie en fin de saison serait une surprise, pas une
    // décision. Le montant se cale sur la valeur du joueur, transmise par
    // l'appelant pour que ce module reste sans dépendance vers la valorisation.
    const wantsOption = input.optionValue !== undefined && input.rng.nextBool(0.34);
    const mandatory = wantsOption && input.rng.nextBool(0.3);
    const optionToBuy: LoanOption | undefined = wantsOption
      ? {
        fee: Math.round((input.optionValue! * (mandatory ? 0.85 : 1.15)) / 10_000) * 10_000,
        mandatory,
      }
      : undefined;

    offers.push({
      clubId: club.id,
      clubName: club.name,
      playingTime,
      wageShare,
      pitch: playingTime >= 0.75
        ? `${club.name} en fera un titulaire et prend ${Math.round(wageShare * 100)} % du salaire.`
        : `${club.name} lui promet du temps de jeu régulier et prend ${Math.round(wageShare * 100)} % du salaire.`,
      ...(optionToBuy ? { optionToBuy } : {}),
    });
  }
  return offers.sort((a, b) => b.playingTime - a.playingTime);
}

// =============================================================================
// Le prêt en cours
// =============================================================================

export interface ActiveLoan {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly season: number;
  readonly playingTime: number;
  readonly wageShare: number;
  /** V0.64 — option d'achat consentie au club d'accueil. */
  readonly optionToBuy?: LoanOption;
  /** V0.64 — journée du rappel anticipé, quand il a eu lieu. */
  readonly recalledAtRound?: number;
}

/**
 * Minutes accumulées ailleurs sur une saison.
 *
 * Estimées, pas simulées : le club accueillant tient sa promesse à peu près,
 * et un joueur prêté finit sa saison avec le temps de jeu qu'on lui avait
 * annoncé, à la blessure près. C'est ce nombre qui alimente le développement,
 * exactement comme les minutes disputées ici.
 */
export function loanMinutes(loan: ActiveLoan, roundsPlayed: number): number {
  return Math.round(roundsPlayed * loan.playingTime * 72);
}

/** Ce que le prêt continue de coûter au club prêteur, sur la saison. */
export function loanCost(loan: ActiveLoan, annualSalary: number): number {
  return Math.round(annualSalary * (1 - loan.wageShare));
}

/**
 * Ce que les clubs d'accueil paient à notre place, pour une journée.
 *
 * V0.60 : `wageShare` n'était qu'un chiffre d'affichage. Le club prêteur
 * continuait de verser cent pour cent des salaires, ce qui retirait au prêt sa
 * seule contrepartie immédiate et le rendait toujours perdant.
 */
export function loanWageReliefPerRound(
  loans: readonly ActiveLoan[],
  annualSalaryOf: (playerId: PlayerId) => number | undefined,
  regularRounds: number,
): number {
  if (regularRounds <= 0) return 0;
  let total = 0;
  for (const loan of loans) {
    const salary = annualSalaryOf(loan.playerId);
    if (salary === undefined) continue;
    total += salary * loan.wageShare;
  }
  return Math.round(total / regularRounds);
}

/**
 * Le bilan qu'on lit à son retour.
 *
 * On dit ce qu'il a fait, pas ce qu'il vaut : c'est le développement qui
 * tranchera, et l'annoncer ici doublonnerait avec le rapport de progression.
 */
export function loanReport(loan: ActiveLoan, minutes: number): string {
  const matchs = Math.round(minutes / 72);
  if (matchs >= 18) {
    return `${loan.playerName} revient de ${loan.clubName} avec une saison pleine — ${matchs} matchs.`;
  }
  if (matchs >= 8) {
    return `${loan.playerName} revient de ${loan.clubName} après ${matchs} matchs disputés.`;
  }
  return `${loan.playerName} n'a joué que ${matchs} match${matchs > 1 ? 's' : ''} à ${loan.clubName}. Le prêt n'a pas tenu ses promesses.`;
}

// =============================================================================
// Le rappel anticipé — V0.64
// =============================================================================

/** Nombre de valides à un poste en dessous duquel le club est en crise. */
export const RECALL_CRISIS_THRESHOLD = 2;

export type RecallVerdict =
  | { readonly allowed: true; readonly reason: string }
  | { readonly allowed: false; readonly reason: string };

/**
 * Peut-on faire revenir un joueur prêté avant la fin de la saison ?
 *
 * Pas librement, et c'est le point. Un rappel libre viderait le prêt de son
 * arbitrage : on prêterait tout le monde en août pour rapatrier qui l'on veut à
 * la première blessure, sans jamais payer le prix du prêt, qui est de se priver
 * d'un joueur pour une saison. Le rappel n'existe donc que dans le cas qui l'a
 * fait entrer dans les usages : la crise de blessures à un poste.
 *
 * Le club d'accueil, lui, perd un joueur en cours d'exercice : il garde sa part
 * de salaire déjà versée et l'option d'achat tombe.
 */
export function canRecall(input: {
  readonly loan: ActiveLoan;
  /** Joueurs valides du club prêteur capables de tenir le poste concerné. */
  readonly healthyCoverAtPosition: number;
  readonly round: number;
  readonly totalRounds: number;
}): RecallVerdict {
  if (input.loan.recalledAtRound !== undefined) {
    return { allowed: false, reason: 'Ce joueur est déjà revenu.' };
  }
  if (input.round >= input.totalRounds) {
    return { allowed: false, reason: 'La saison est trop avancée : il rentrera à son terme.' };
  }
  if (input.healthyCoverAtPosition >= RECALL_CRISIS_THRESHOLD) {
    return {
      allowed: false,
      reason: 'Le poste est encore couvert : le club d\'accueil refusera de le libérer.',
    };
  }
  return {
    allowed: true,
    reason: `Crise de blessures au poste : ${input.loan.clubName} accepte de le rendre.`,
  };
}

export function recallLoan(loan: ActiveLoan, round: number): ActiveLoan {
  const { optionToBuy: _dropped, ...rest } = loan;
  return { ...rest, recalledAtRound: round };
}

// =============================================================================
// L'option d'achat au retour — V0.64
// =============================================================================

export type LoanOptionOutcome =
  | { readonly kind: 'AUCUNE' }
  | { readonly kind: 'LEVEE'; readonly fee: number; readonly reason: string }
  | { readonly kind: 'ABANDONNEE'; readonly reason: string };

/**
 * Le club d'accueil lève-t-il son option ?
 *
 * Obligatoire, la question ne se pose pas. Facultative, il juge sur ce qu'il a
 * vu : un joueur qui a joué la saison entière est acheté, un joueur qui a passé
 * l'année à l'infirmerie ne l'est pas. On lit les minutes réelles et non la
 * promesse initiale, sinon l'option serait décidée avant le prêt, ce qui lui
 * retirerait tout son sens.
 */
export function resolveLoanOption(input: {
  readonly loan: ActiveLoan;
  readonly minutesPlayed: number;
  readonly roundsPlayed: number;
}): LoanOptionOutcome {
  const option = input.loan.optionToBuy;
  if (!option || input.loan.recalledAtRound !== undefined) return { kind: 'AUCUNE' };

  if (option.mandatory) {
    return {
      kind: 'LEVEE',
      fee: option.fee,
      reason: `${input.loan.clubName} était engagé : l'option était obligatoire.`,
    };
  }

  const expected = Math.max(1, input.roundsPlayed * input.loan.playingTime * 72);
  const ratio = input.minutesPlayed / expected;
  if (ratio >= 0.7) {
    return {
      kind: 'LEVEE',
      fee: option.fee,
      reason: `${input.loan.clubName} a vu ce qu'il voulait voir et lève son option.`,
    };
  }
  return {
    kind: 'ABANDONNEE',
    reason: `${input.loan.clubName} ne lève pas son option : il ne l'a pas assez vu jouer.`,
  };
}

/**
 * Ce que le manager doit peser avant de dire oui.
 *
 * Formulé comme un arbitrage, parce que c'en est un : on gagne un joueur formé
 * dans un an, on perd un élément d'effectif tout de suite.
 */
export function loanTradeoff(offer: LoanOffer, player: Player): string {
  const part = Math.round(offer.playingTime * 26);
  return `Environ ${part} matchs à ${offer.clubName}, contre ${player.lastName} indisponible toute la saison.`;
}
