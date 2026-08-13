/**
 * Réputation du manager — V0.9 phase 2.
 *
 * Score 0-100, évolue à chaque saison clôturée selon le résultat.
 *
 * Échelle de référence :
 *   0-19  : inconnu / débutant
 *  20-39  : prometteur
 *  40-59  : confirmé
 *  60-79  : reconnu
 *  80-100 : icône / sélectionneur potentiel
 */

import type { ClubId } from '../types.js';

export interface ManagerReputation {
  /** Score [0, 100]. */
  readonly score: number;
  /** Nombre de Brennus gagnés. */
  readonly titlesWon: number;
  /** Saisons effectivement managées. */
  readonly seasonsManaged: number;
}

export const INITIAL_REPUTATION: ManagerReputation = {
  score: 30,
  titlesWon: 0,
  seasonsManaged: 0,
};

export interface SeasonOutcomeForReputation {
  readonly playerClubId: ClubId;
  /** Vainqueur du titre, absent si la saison s'est close sans en décerner. */
  readonly champion?: ClubId;
  readonly playerClubReachedFinal: boolean;
  readonly playerClubFinalRank: number;     // 1-14
  readonly objectiveMet: boolean;
  /**
   * V0.41 — rang que le board avait fixé. Sans lui, la réputation se jugeait au
   * classement absolu : un manager qui finissait 12e avec un promu **perdait**
   * de la réputation alors qu'il avait fait exactement ce qu'on lui demandait,
   * et ne pouvait donc jamais bâtir une carrière depuis le bas du tableau.
   */
  readonly objectiveTargetRank?: number;
}

/**
 * Met à jour la réputation après une saison clôturée.
 * Bonus :
 *   +25 si Brennus gagné
 *   +10 si finale jouée (perdue)
 *   +5 si top 4 saison régulière
 *   +3 si qualifié (top 6)
 *   +5 si objectif atteint
 * Malus :
 *   -8 si bottom 3 (≥ 12e)
 *   -3 si objectif raté
 * Plafonné à [0, 100].
 */
export function updateReputation(
  current: ManagerReputation,
  outcome: SeasonOutcomeForReputation,
): ManagerReputation {
  let delta = 0;
  if (outcome.champion === outcome.playerClubId) delta += 25;
  else if (outcome.playerClubReachedFinal) delta += 10;
  if (outcome.playerClubFinalRank > 0 && outcome.playerClubFinalRank <= 4) delta += 5;
  else if (outcome.playerClubFinalRank > 0 && outcome.playerClubFinalRank <= 6) delta += 3;
  // Le bas de tableau n'est une faute que s'il trahit la mission confiée : un
  // maintien obtenu à la 12e place est une réussite, pas un échec.
  if (outcome.playerClubFinalRank >= 12 && !outcome.objectiveMet) delta -= 8;

  if (outcome.objectiveMet) {
    delta += 5;
    // Faire nettement mieux que demandé, c'est ce qui fait remarquer un
    // entraîneur de club modeste.
    const target = outcome.objectiveTargetRank;
    if (target !== undefined && outcome.playerClubFinalRank > 0) {
      const overshoot = target - outcome.playerClubFinalRank;
      if (overshoot >= 3) delta += Math.min(10, overshoot);
    }
  } else {
    delta -= 3;
  }

  const score = Math.max(0, Math.min(100, current.score + delta));
  return {
    score,
    titlesWon: current.titlesWon + (outcome.champion === outcome.playerClubId ? 1 : 0),
    seasonsManaged: current.seasonsManaged + 1,
  };
}

export function reputationLabel(score: number): string {
  if (score >= 80) return 'Icône du rugby français';
  if (score >= 60) return 'Manager reconnu';
  if (score >= 40) return 'Manager confirmé';
  if (score >= 20) return 'Manager prometteur';
  return 'Manager débutant';
}
