/**
 * Les classements individuels du championnat : V0.61.
 *
 * Le jeu tenait les statistiques de tous les joueurs des deux divisions depuis
 * la V0.53, et ne les montrait qu'une fois l'an, sous forme de trophées. Pendant
 * la saison, la question la plus banale d'un championnat, « qui est en tête des
 * marqueurs », n'avait aucune réponse.
 *
 * ## Ce qui est classé, et ce qui ne l'est pas
 *
 * Les essais et les mètres se classent bruts : ce sont des compteurs, et le
 * meilleur marqueur est celui qui a marqué le plus, pas celui qui marque le
 * plus souvent. La note, elle, se classe en moyenne, avec une présence minimale
 * exigée : sans ce seuil, un joueur revenu de blessure pour un match énorme
 * trônerait devant celui qui a tenu la saison.
 *
 * C'est la même règle que pour les honneurs de fin de saison
 * ([honours.ts](./honours.ts)), et elle a la même raison d'être. Le seuil est
 * plus bas ici, parce qu'un classement de mi-saison doit dire quelque chose dès
 * le mois d'octobre.
 */

import type { ClubId, Player, PlayerId } from '../types.js';

/** Ce dont un classement a besoin, sans dépendre de la forme du cumul. */
export interface LeaderStat {
  readonly matches: number;
  readonly minutes: number;
  readonly tries: number;
  readonly meters: number;
  readonly tackles: number;
  readonly turnovers: number;
  readonly ratingSum?: number;
  readonly ratedMatches?: number;
}

export type LeaderboardKind = 'ESSAIS' | 'METRES' | 'PLAQUAGES' | 'GRATTAGES' | 'NOTE';

export const LEADERBOARD_LABEL: Readonly<Record<LeaderboardKind, string>> = {
  ESSAIS: 'Meilleurs marqueurs',
  METRES: 'Mètres gagnés',
  PLAQUAGES: 'Plaquages',
  GRATTAGES: 'Ballons grattés',
  NOTE: 'Meilleures notes',
};

/** Ce qu'affiche la colonne de droite, pour chaque classement. */
export const LEADERBOARD_UNIT: Readonly<Record<LeaderboardKind, string>> = {
  ESSAIS: 'essais',
  METRES: 'm',
  PLAQUAGES: 'plaquages',
  GRATTAGES: 'grattages',
  NOTE: 'de moyenne',
};

export interface LeaderRow {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly value: number;
  /** Contexte de la ligne : matchs joués, pour situer le total. */
  readonly matches: number;
}

/**
 * Part des journées à avoir disputée pour figurer au classement des notes.
 *
 * Un tiers, contre la moitié pour les trophées de fin d'année : un classement
 * qui reste vide jusqu'en janvier ne sert à personne, et se tromper de leader
 * en octobre ne coûte rien.
 */
export const MIN_PRESENCE_NOTE = 1 / 3;

export interface LeaderboardInput {
  readonly players: readonly Player[];
  readonly stats: ReadonlyMap<PlayerId, LeaderStat>;
  /** Journées déjà disputées, dénominateur de la présence. */
  readonly roundsPlayed: number;
  readonly clubNameOf: (player: Player) => string;
  /** Restreint le classement à une division, ou à un club. */
  readonly clubIds?: ReadonlySet<ClubId>;
}

function valueOf(kind: LeaderboardKind, stat: LeaderStat): number | undefined {
  switch (kind) {
    case 'ESSAIS': return stat.tries;
    case 'METRES': return Math.round(stat.meters);
    case 'PLAQUAGES': return stat.tackles;
    case 'GRATTAGES': return stat.turnovers;
    case 'NOTE': {
      if (!stat.ratedMatches) return undefined;
      return Math.round(((stat.ratingSum ?? 0) / stat.ratedMatches) * 10) / 10;
    }
  }
}

/**
 * Le classement d'une catégorie, du meilleur au moins bon.
 *
 * Rend une liste vide plutôt qu'un classement bancal quand personne n'a encore
 * rien produit : une colonne de zéros donne l'illusion d'une information.
 */
export function leaderboard(
  kind: LeaderboardKind,
  input: LeaderboardInput,
  limit = 10,
): readonly LeaderRow[] {
  const seuil = kind === 'NOTE'
    ? Math.max(1, Math.ceil(input.roundsPlayed * MIN_PRESENCE_NOTE))
    : 1;

  const rows: LeaderRow[] = [];
  for (const player of input.players) {
    if (player.retired || player.freeAgent) continue;
    if (input.clubIds && !input.clubIds.has(player.clubId)) continue;

    const stat = input.stats.get(player.id);
    if (!stat) continue;
    // Le seuil porte sur ce qui **fait** la moyenne, pas sur les matchs joués.
    // Vu en jeu sur une sauvegarde reprise : les notes n'existaient que depuis
    // une journée, le compteur de matchs en affichait treize, et une moyenne
    // tirée d'une seule rencontre trônait en tête du classement.
    const disputes = kind === 'NOTE' ? (stat.ratedMatches ?? 0) : stat.matches;
    if (disputes < seuil) continue;

    const value = valueOf(kind, stat);
    if (value === undefined || value <= 0) continue;

    rows.push({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      clubId: player.clubId,
      clubName: input.clubNameOf(player),
      value,
      matches: stat.matches,
    });
  }

  // À égalité, celui qui a joué le moins de matchs passe devant : il a produit
  // autant en moins d'occasions, et c'est le seul départage qui dise quelque
  // chose plutôt que de suivre l'ordre alphabétique du hasard.
  rows.sort((a, b) => b.value - a.value || a.matches - b.matches);
  return rows.slice(0, limit);
}

/** Tous les classements d'un coup, dans l'ordre où on les affiche. */
export function allLeaderboards(
  input: LeaderboardInput,
  limit = 10,
): readonly { readonly kind: LeaderboardKind; readonly rows: readonly LeaderRow[] }[] {
  const kinds: readonly LeaderboardKind[] = ['ESSAIS', 'NOTE', 'METRES', 'PLAQUAGES', 'GRATTAGES'];
  return kinds.map(kind => ({ kind, rows: leaderboard(kind, input, limit) }));
}
