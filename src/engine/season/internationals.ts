/**
 * Trêves internationales — V0.8 phase 3.
 *
 * Calendrier Top 14 : tournée d'automne (3 week-ends) + Tournoi des 6 Nations
 * (5 week-ends sur février-mars). Les internationaux français (JIFF cadres)
 * sont sélectionnés en équipe de France et donc absents.
 *
 * V0.8 simple : 4 journées sur les 26 sont des "trêves internationales". Pour
 * chacune, les top N JIFF par overall de chaque club sont appelés en sélection.
 * Pendant ces trêves, le club joue quand même (Top 14 ne s'arrête pas — la
 * réalité du calendrier français), mais privé de ses cadres.
 */

import type { ClubId, Player, PlayerId } from '../types.js';

/** Journées de trêve internationale (1-indexed sur le calendrier Top 14). */
export const INTERNATIONAL_BREAK_ROUNDS: readonly number[] = [9, 10, 16, 17];

/** Nombre de joueurs sélectionnés par club pendant chaque trêve. */
const CALL_UPS_PER_CLUB = 3;

function approximateOverall(p: Player): number {
  const t = p.technical, ph = p.physical, m = p.mental;
  const techAvg = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const physAvg = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const mentAvg = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (techAvg + physAvg + mentAvg) / 3;
}

/**
 * Identifie les top N JIFF d'un club par overall.
 * Critères : JIFF, non retraité, non blessé.
 */
function topJiffCadres(players: readonly Player[], n: number): readonly PlayerId[] {
  return [...players]
    .filter(p => p.isJiff && !p.retired && !p.freeAgent)
    .sort((a, b) => approximateOverall(b) - approximateOverall(a))
    .slice(0, n)
    .map(p => p.id);
}

export interface CallUpSchedule {
  /** Pour chaque round de trêve, set des PlayerId appelés. */
  readonly byRound: ReadonlyMap<number, ReadonlySet<PlayerId>>;
}

/**
 * Construit le calendrier de sélections pour TOUTE la saison.
 * Calcule la liste à partir des effectifs au début de saison.
 */
export function buildCallUpSchedule(
  allPlayersByClub: ReadonlyMap<ClubId, readonly Player[]>,
): CallUpSchedule {
  const byRound = new Map<number, Set<PlayerId>>();
  for (const round of INTERNATIONAL_BREAK_ROUNDS) {
    const callees = new Set<PlayerId>();
    for (const players of allPlayersByClub.values()) {
      for (const id of topJiffCadres(players, CALL_UPS_PER_CLUB)) callees.add(id);
    }
    byRound.set(round, callees);
  }
  return { byRound };
}

export function isCalledUp(schedule: CallUpSchedule, playerId: PlayerId, round: number): boolean {
  return schedule.byRound.get(round)?.has(playerId) ?? false;
}

export function isInternationalBreak(round: number): boolean {
  return INTERNATIONAL_BREAK_ROUNDS.includes(round);
}

/**
 * V0.58 — à quelle fenêtre internationale appartient une journée de trêve.
 *
 * Les quatre trêves ne se valent pas : novembre est une tournée de tests,
 * février-mars est le Tournoi. Le calendrier le savait implicitement depuis la
 * V0.8 — la constante est commentée en ce sens — sans que rien ne l'exprime.
 */
export function windowOf(round: number): 'AUTOMNE' | 'TOURNOI' | undefined {
  if (round === 9 || round === 10) return 'AUTOMNE';
  if (round === 16 || round === 17) return 'TOURNOI';
  return undefined;
}

/** Dernière journée de chaque fenêtre : c'est là qu'on solde les comptes. */
export function isWindowClosing(round: number): boolean {
  return round === 10 || round === 17;
}
