/**
 * Records et palmarès historique — V0.9 phase 1.
 *
 * Conservé entre saisons via le save (carrière). Permet d'afficher
 * "Toulouse — 5 Brennus, 2 finales perdues, top scorer all-time : Penaud (47 essais)"
 *
 * V0.9 simple :
 *   - Liste des saisons clôturées (champion, perdants finale, position joueur)
 *   - Top scorer all-time côté club joueur (cumul des essais sur l'historique)
 */

import type { ClubId, PlayerId } from '../types.js';

export interface SeasonRecord {
  /** Année de la saison (ex: 2025 = saison 2025-26). */
  readonly seasonStart: number;
  /**
   * Champion du Brennus.
   *
   * V0.60 : facultatif. Une saison peut se clore sans titre décerné, et tout
   * le bilan de fin d'année en dépendait : sans champion, ni archive, ni
   * verdict du président, ni mise à jour de la réputation.
   */
  readonly champion?: ClubId;
  /** Finaliste battu (clubId). */
  readonly runnerUp?: ClubId;
  /** Position finale du club joueur (saison régulière, 1-indexée). */
  readonly playerClubFinalRank: number;
  /** Le club joueur a-t-il atteint la finale ? */
  readonly playerClubReachedFinal: boolean;
  /** Le club joueur a-t-il gagné le Brennus ? */
  readonly playerClubChampion: boolean;
  /** Top buteur (joueur, club, essais cumulés sur la saison) — V0.9 : approximé. */
  readonly topScorerOfSeason?: {
    readonly playerId: PlayerId;
    readonly playerName: string;
    readonly clubId: ClubId;
    readonly tries: number;
  };
}

export interface ClubPalmares {
  readonly clubId: ClubId;
  readonly championships: number;          // Brennus gagnés
  readonly finalsLost: number;             // finales perdues
  readonly seasonsPlayed: number;
}

/**
 * @deprecated V0.59 — remplacé par le registre de carrière
 * (`player-career.ts`), qui garde le détail saison par saison au lieu d'un
 * cumul. Conservé pour lire les sauvegardes antérieures, et pour rien d'autre.
 */
export interface PlayerCareerStats {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly clubId: ClubId;
  readonly tries: number;
  readonly matches: number;
}

export interface CareerHistory {
  /** Saisons clôturées (chronologique, plus récente en dernier). */
  readonly seasons: readonly SeasonRecord[];
}

export const EMPTY_HISTORY: CareerHistory = {
  seasons: [],
};

// =============================================================================
// Calculs
// =============================================================================

/**
 * Construit le palmarès d'un club à partir de l'historique.
 */
export function clubPalmares(history: CareerHistory, clubId: ClubId): ClubPalmares {
  let championships = 0;
  let finalsLost = 0;
  for (const s of history.seasons) {
    if (s.champion === clubId) championships++;
    else if (s.runnerUp === clubId) finalsLost++;
  }
  return {
    clubId,
    championships,
    finalsLost,
    seasonsPlayed: history.seasons.length,
  };
}

/* V0.59 — `topScorersForClub` a disparu avec `playerCareerStats` : les records
   du club se dérivent désormais des lignes de saison du registre de carrière.
   Voir `clubLeaders` dans `player-career.ts`. */

/**
 * Ajoute une saison à l'historique.
 *
 * Ne consigne plus les statistiques joueurs : elles vivent dans le registre de
 * carrière, qui en garde le détail saison par saison. Deux endroits pour la
 * même donnée, c'est la faute que ce projet a déjà payée trois fois.
 */
export function appendSeason(
  history: CareerHistory,
  record: SeasonRecord,
): CareerHistory {
  return { seasons: [...history.seasons, record] };
}
