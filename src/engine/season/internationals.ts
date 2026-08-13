/**
 * Le calendrier des trêves internationales.
 *
 * Quatre journées sur les vingt-six : la tournée d'automne, puis le Tournoi des
 * Six Nations. Le championnat ne s'arrête pas pour autant, c'est la réalité du
 * calendrier français : les clubs jouent, privés de leurs cadres.
 *
 * V0.60 : ce fichier ne contient plus que ce calendrier. Il portait aussi, sous
 * le même nom et depuis la V0.8, une sélection nationale maison qui appelait les
 * trois meilleurs JIFF de chaque club, soit quarante-deux joueurs pour une
 * équipe de quinze. La V0.58 lui a substitué un vrai XV de France
 * (`national-team.ts`), sans retirer l'ancienne : deux définitions de « qui part
 * en sélection » coexistaient, dont une que plus rien n'appelait.
 */

import type { PlayerId } from '../types.js';

/** Journées de trêve internationale (1-indexed sur le calendrier Top 14). */
export const INTERNATIONAL_BREAK_ROUNDS: readonly number[] = [9, 10, 16, 17];

/**
 * Qui est appelé, et à quelle journée.
 *
 * Dérivé du groupe France réellement sélectionné : voir `national-team.ts`.
 */
export interface CallUpSchedule {
  readonly byRound: ReadonlyMap<number, ReadonlySet<PlayerId>>;
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
