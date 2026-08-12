/**
 * Compteur JIFF — V0.8 phase 1.
 *
 * Référence : 04-modele-equipe-club.md, doc 12-juridique sur quotas LNR.
 *
 * Règle Top 14 (simplifiée pour V0.8) : la feuille de match (XV + 8 = 23 joueurs)
 * doit comporter au moins 50 % de JIFF, soit au moins 12 sur 23. Sinon un
 * malus moral (relation président + mood vestiaire) est appliqué et un avertissement
 * affiché.
 *
 * V0.8 : warning + malus mood léger ; pas de pénalité financière (V0.9+).
 */

import type { Player } from '../types.js';

export const JIFF_MIN_RATIO = 0.5;
export const JIFF_MIN_COUNT_FEUILLE_23 = 12;

export interface JiffStats {
  /** Total joueurs sur la feuille (typiquement 23). */
  readonly total: number;
  /** Nombre de JIFF sur la feuille. */
  readonly jiffCount: number;
  /** Ratio JIFF (0..1). */
  readonly ratio: number;
  /** True si le ratio est en-dessous du seuil. */
  readonly belowThreshold: boolean;
  /** Joueurs manquants pour atteindre le seuil. */
  readonly shortfall: number;
}

export function computeJiffStats(players: readonly Player[]): JiffStats {
  const total = players.length;
  const jiffCount = players.filter(p => p.isJiff).length;
  const ratio = total > 0 ? jiffCount / total : 0;
  const minRequired = Math.ceil(total * JIFF_MIN_RATIO);
  return {
    total,
    jiffCount,
    ratio,
    belowThreshold: jiffCount < minRequired,
    shortfall: Math.max(0, minRequired - jiffCount),
  };
}

/**
 * Stats du club entier (effectif sous contrat). Utilisé pour le tableau de bord :
 * un club sans réservoir JIFF aura du mal à composer une feuille conforme.
 */
export function computeClubJiffStats(roster: readonly Player[]): JiffStats {
  const active = roster.filter(p => !p.retired && !p.freeAgent);
  return computeJiffStats(active);
}
