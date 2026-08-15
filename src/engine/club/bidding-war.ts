/**
 * La surenchère : V0.64.
 *
 * Depuis la V0.6, le manager négociait seul au monde. Il repérait un joueur, il
 * mettait le prix, il l'obtenait : la seule question était financière, et une
 * fois le club vendeur convaincu, plus rien ne pouvait mal tourner. Les quinze
 * autres clubs du championnat, qui ont pourtant les mêmes besoins et les mêmes
 * listes, ne se manifestaient jamais.
 *
 * ## La concurrence se joue sur le joueur, pas sur le chèque
 *
 * On aurait pu modéliser une enchère : chacun renchérit jusqu'à ce qu'un seul
 * reste. C'est faux pour le rugby, et c'est surtout injouable, parce que cela
 * transforme un mercato en salle des ventes où le plus riche gagne toujours.
 *
 * Ici, le concurrent s'aligne sur l'indemnité (le club vendeur est déjà
 * d'accord, le prix est connu) et se bat sur ce qui décide vraiment un joueur :
 * le salaire qu'il offre et le rang auquel il joue. Un manager de club modeste
 * peut donc perdre une cible malgré une offre supérieure, et la conclusion est
 * juste : il n'aurait jamais dû viser ce joueur-là sans un argument sportif.
 *
 * ## Ce qu'on montre avant de perdre
 *
 * Le concurrent n'apparaît pas par surprise à la signature. `interestLevel`
 * donne au manager, dès le chiffrage de sa cible, le nombre de clubs qui la
 * suivent. Perdre un joueur qu'on savait convoité est une décision ratée ;
 * perdre un joueur dont personne n'avait parlé est un tirage au sort.
 */

import type { Rng } from '../rng.js';
import type { Club, ClubId, Player } from '../types.js';
import { approximateOverall } from './development.js';
import { expectedMarketSalary } from './contracts.js';
import { perceivedRank } from './transfer-offers.js';

// =============================================================================
// Qui suit ce joueur
// =============================================================================

export interface RivalInterestInput {
  readonly player: Player;
  /** Clubs du championnat, celui du joueur et le nôtre compris. */
  readonly clubs: readonly Club[];
  readonly ownClubId: ClubId;
  readonly currentSeason: number;
  /** Effectif de chaque club, pour juger de son besoin au poste. */
  readonly rosterOf: (clubId: ClubId) => readonly Player[];
}

/**
 * Les clubs qui pourraient se positionner.
 *
 * Trois conditions, dans cet ordre : le joueur doit valoir le déplacement pour
 * eux (meilleur que ce qu'ils ont au poste), ils doivent pouvoir porter son
 * salaire, et ils ne doivent pas être le club qui le vend. La première est la
 * plus importante : sans elle, un promu de Pro D2 se serait positionné sur un
 * international, ce qui n'aurait convaincu personne.
 */
export function interestedClubs(input: RivalInterestInput): readonly Club[] {
  const target = approximateOverall(input.player);
  const salary = expectedMarketSalary(input.player, input.currentSeason);

  return input.clubs.filter(club => {
    if (club.id === input.ownClubId) return false;
    if (club.id === input.player.clubId) return false;

    const roster = input.rosterOf(club.id);
    const bestAtPosition = roster
      .filter(p => p.position === input.player.position && !p.retired && !p.freeAgent)
      .reduce((best, p) => Math.max(best, approximateOverall(p)), 0);
    if (bestAtPosition >= target - 1) return false;

    const payroll = roster.reduce((sum, p) => sum + (p.retired ? 0 : p.contract.annualSalary), 0);
    return club.annualBudget - payroll >= salary;
  });
}

/** Ce que le manager voit dans son chiffrage : combien de clubs suivent la cible. */
export function interestLevel(input: RivalInterestInput): number {
  return interestedClubs(input).length;
}

// =============================================================================
// Le concurrent qui s'aligne
// =============================================================================

export interface RivalChallenge {
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly annualSalary: number;
  readonly years: number;
  readonly rank: number;
}

/**
 * Un club se positionne-t-il sur l'offre qu'on vient de faire aboutir ?
 *
 * La probabilité monte avec le niveau du joueur, parce que c'est ainsi que le
 * marché fonctionne : personne ne se bat pour un remplaçant de trente-trois ans,
 * et tout le monde se bat pour un international de vingt-cinq.
 */
export function findChallenger(input: {
  readonly player: Player;
  readonly candidates: readonly Club[];
  readonly currentSeason: number;
  readonly rankOf: (clubId: ClubId) => number;
  readonly reputationRankOf: (clubId: ClubId) => number;
  readonly rng: Rng;
}): RivalChallenge | undefined {
  if (input.candidates.length === 0) return undefined;

  const overall = approximateOverall(input.player);
  // 78 est le seuil au-dessus duquel un joueur est un titulaire de Top 14
  // confirmé. En dessous de 65, plus personne ne se déplace.
  const heat = Math.max(0, Math.min(0.55, (overall - 65) / 40));
  if (!input.rng.nextBool(heat)) return undefined;

  const club = input.rng.pick(input.candidates);
  const expected = expectedMarketSalary(input.player, input.currentSeason);

  return {
    clubId: club.id,
    clubName: club.name,
    // Il ne fait pas une offre de prestige : il fait une offre sérieuse, entre
    // le tarif du marché et un cinquième au-dessus.
    annualSalary: Math.round(expected * (1.0 + input.rng.next() * 0.2)),
    years: input.rng.nextInt(2, 4),
    rank: perceivedRank(input.rankOf(club.id), input.reputationRankOf(club.id)),
  };
}

export interface ChallengeVerdict {
  readonly lost: boolean;
  readonly reason: string;
}

/**
 * Le joueur choisit entre les deux clubs.
 *
 * Deux critères, ceux-là mêmes qui le décidaient déjà à partir : ce qu'il
 * touchera, et où il jouera. On compare des rapports plutôt que des sommes pour
 * que l'écart de salaire et l'écart de rang se pèsent l'un l'autre, et on laisse
 * une marge à celui qui a mené la négociation : à conditions égales, le joueur
 * reste avec le club qui l'a courtisé, ce qui récompense d'avoir agi tôt.
 */
export function resolveChallenge(input: {
  readonly challenge: RivalChallenge;
  readonly ourSalary: number;
  readonly ourRank: number;
  readonly player: Player;
  readonly totalClubs: number;
  readonly rng: Rng;
}): ChallengeVerdict {
  const salaryEdge = (input.challenge.annualSalary - input.ourSalary)
    / Math.max(1, input.ourSalary);
  const rankEdge = (input.ourRank - input.challenge.rank) / Math.max(2, input.totalClubs);

  // L'ambition pondère le rang, comme dans la décision de transfert : un joueur
  // sans ambition suit l'argent, un ambitieux regarde le classement.
  const ambition = input.player.hidden.ambition / 100;
  let score = salaryEdge * 100 * (1 - ambition * 0.4) + rankEdge * 120 * ambition;

  // La prime au courtisan : huit points, soit à peu près huit pour cent de
  // salaire. Assez pour départager deux offres jumelles, trop peu pour sauver
  // une offre médiocre.
  score -= 8;
  score += input.rng.nextGaussian(0, 6);

  if (score <= 0) {
    return { lost: false, reason: `${input.challenge.clubName} s'est positionné, mais il vous préfère.` };
  }
  return {
    lost: true,
    reason: salaryEdge > 0.05
      ? `${input.challenge.clubName} s'est aligné et propose davantage : il signe là-bas.`
      : `${input.challenge.clubName} joue plus haut que vous, et cela a suffi.`,
  };
}
