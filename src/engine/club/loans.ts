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

    offers.push({
      clubId: club.id,
      clubName: club.name,
      playingTime,
      wageShare,
      pitch: playingTime >= 0.75
        ? `${club.name} en fera un titulaire et prend ${Math.round(wageShare * 100)} % du salaire.`
        : `${club.name} lui promet du temps de jeu régulier et prend ${Math.round(wageShare * 100)} % du salaire.`,
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
