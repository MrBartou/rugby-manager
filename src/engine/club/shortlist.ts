/**
 * La liste de suivi : V0.61.
 *
 * Repérer un joueur et le retrouver trois journées plus tard tenait de la
 * mémoire du manager. Le scouting, lui, coûte des créneaux et se consomme : il
 * répond à « que vaut-il », pas à « je le garde à l'œil ». Ce sont deux gestes
 * différents, et un seul existait.
 *
 * ## Ce que la liste sait faire, et ce qu'elle ne fait pas
 *
 * Elle **n'apprend rien** : un joueur suivi mais jamais observé reste aussi flou
 * qu'avant. Confondre les deux viderait le scouting de son intérêt. Ce qu'elle
 * apporte est une veille : la fin de contrat qui approche, l'entrée dans la
 * dernière année, le joueur devenu libre, celui qui se blesse longuement.
 *
 * Le signal le plus utile est la dernière année de contrat : c'est le moment où
 * un joueur se négocie à bas prix, et l'information passait jusqu'ici totalement
 * inaperçue à moins d'ouvrir chaque fiche une par une.
 */

import type { Player, PlayerId } from '../types.js';

export type ShortlistAlertKind =
  | 'LIBRE'
  | 'FIN_DE_CONTRAT'
  | 'DERNIERE_ANNEE'
  | 'BLESSE_LONGUE_DUREE'
  | 'A_CHANGE_DE_CLUB';

export interface ShortlistAlert {
  readonly playerId: PlayerId;
  readonly kind: ShortlistAlertKind;
  /** Phrase prête à afficher, écrite du point de vue du manager qui suit. */
  readonly message: string;
  /** Les alertes urgentes remontent en tête de liste. */
  readonly urgent: boolean;
}

/**
 * Durée d'absence à partir de laquelle une blessure vaut d'être signalée.
 *
 * En deçà, ce n'est pas une nouvelle : tout le monde manque deux journées dans
 * une saison, et une alerte qui se déclenche tout le temps ne se lit plus.
 */
const BLESSURE_LONGUE = 6;

export interface ShortlistContext {
  readonly currentSeason: number;
  readonly currentRound: number;
  /** Club de chaque joueur au moment où on l'a mis en liste. */
  readonly clubWhenAdded: ReadonlyMap<PlayerId, string>;
}

/**
 * Ce qu'il faut savoir sur un joueur suivi, aujourd'hui.
 *
 * Rend au plus une alerte par joueur : la plus parlante. Empiler « dernière
 * année » et « blessé » sur la même ligne noierait celle qui compte.
 */
export function alertFor(player: Player, ctx: ShortlistContext): ShortlistAlert | undefined {
  const base = { playerId: player.id } as const;

  if (player.freeAgent) {
    return {
      ...base,
      kind: 'LIBRE',
      message: 'Sans club : signable immédiatement, sans indemnité.',
      urgent: true,
    };
  }

  const clubDepart = ctx.clubWhenAdded.get(player.id);
  if (clubDepart !== undefined && clubDepart !== (player.clubId as string)) {
    return {
      ...base,
      kind: 'A_CHANGE_DE_CLUB',
      message: 'A changé de club depuis que vous le suivez.',
      urgent: false,
    };
  }

  const injury = player.dynamic.injury;
  if (injury && injury.estimatedReturnAt - ctx.currentRound >= BLESSURE_LONGUE) {
    return {
      ...base,
      kind: 'BLESSE_LONGUE_DUREE',
      message: `Absent jusqu'à la J${injury.estimatedReturnAt}.`,
      urgent: false,
    };
  }

  const restant = player.contract.endSeason - ctx.currentSeason;
  if (restant <= 0) {
    return {
      ...base,
      kind: 'FIN_DE_CONTRAT',
      message: 'En fin de contrat : libre à l\'intersaison.',
      urgent: true,
    };
  }
  if (restant === 1) {
    return {
      ...base,
      kind: 'DERNIERE_ANNEE',
      message: 'Dernière année de contrat : c\'est maintenant qu\'il se négocie.',
      urgent: false,
    };
  }

  return undefined;
}

export interface ShortlistEntry {
  readonly player: Player;
  readonly alert: ShortlistAlert | undefined;
}

/**
 * La liste, prête à afficher.
 *
 * Les alertes urgentes d'abord, puis les autres alertes, puis les joueurs dont
 * il n'y a rien à dire : une veille se lit de haut en bas et doit livrer le
 * plus utile en premier.
 */
export function buildShortlist(
  watched: readonly PlayerId[],
  playersById: ReadonlyMap<PlayerId, Player>,
  ctx: ShortlistContext,
): readonly ShortlistEntry[] {
  const entries: ShortlistEntry[] = [];
  for (const id of watched) {
    const player = playersById.get(id);
    // Un joueur retraité sort de la liste tout seul : le suivre n'a plus d'objet.
    if (!player || player.retired) continue;
    entries.push({ player, alert: alertFor(player, ctx) });
  }

  const rang = (e: ShortlistEntry): number =>
    e.alert === undefined ? 2 : e.alert.urgent ? 0 : 1;

  return entries.sort((a, b) =>
    rang(a) - rang(b) || a.player.lastName.localeCompare(b.player.lastName));
}

/** Ajoute ou retire un joueur, sans doublon. */
export function toggleWatched(
  watched: readonly PlayerId[],
  playerId: PlayerId,
): readonly PlayerId[] {
  return watched.includes(playerId)
    ? watched.filter(id => id !== playerId)
    : [...watched, playerId];
}
