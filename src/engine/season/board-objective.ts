/**
 * Objectifs board + pression dirigeants — V0.9 phase 3.
 *
 * Au début de chaque saison, le board fixe un objectif au manager.
 * Si l'objectif n'est pas atteint, la confiance baisse. Deux échecs consécutifs
 * → menace de licenciement.
 *
 * V0.9 : décision automatique basée sur le tier club + réputation manager.
 *        Pas de négociation joueur/board (V1.0+).
 */

import type { Club } from '../types.js';

export type ObjectiveKind =
  | 'CHAMPION' | 'TOP_4' | 'TOP_6' | 'TOP_10' | 'MAINTIEN'
  /** V0.44 — objectifs de Pro D2 : on n'y joue pas le titre, on joue la sortie. */
  | 'MONTEE' | 'ACCESSION' | 'HAUT_DE_TABLEAU';

export interface SeasonObjective {
  readonly kind: ObjectiveKind;
  /** Rang minimum à atteindre en saison régulière (1-14). */
  readonly targetRank: number;
  /** Texte UI court. */
  readonly label: string;
}

export interface BoardConfidence {
  /** [0, 100]. <30 = avertissement officiel ; <15 = licenciement imminent. */
  readonly score: number;
  /** Saisons consécutives sans atteindre l'objectif. */
  readonly consecutiveFailures: number;
  /** True si licencié (le manager doit chercher un autre club). */
  readonly fired: boolean;
}

export const INITIAL_BOARD_CONFIDENCE: BoardConfidence = {
  score: 60,
  consecutiveFailures: 0,
  fired: false,
};

/**
 * Calcule l'objectif pour la saison à venir.
 * Logique : tier club → baseline ; reputation manager → ajustement (+1 cran si haute).
 */
export function computeObjective(
  club: Club,
  reputationScore: number,
  /**
   * V0.44 — un board de Pro D2 ne demande pas un « top 6 », il demande de
   * remonter. Absent, on reste sur le Top 14 : les carrières antérieures à la
   * seconde division n'ont pas de division à déclarer.
   */
  division: 'TOP14' | 'PRO_D2' = 'TOP14',
): SeasonObjective {
  if (division === 'PRO_D2') return proD2Objective(club, reputationScore);

  // Baseline par tier
  let kind: ObjectiveKind;
  switch (club.tier) {
    case 'GROS_BUDGET':
      kind = reputationScore >= 70 ? 'CHAMPION' : 'TOP_4';
      break;
    case 'BUDGET_MOYEN':
      kind = reputationScore >= 60 ? 'TOP_6' : 'TOP_10';
      break;
    case 'PETIT_BUDGET':
      kind = reputationScore >= 60 ? 'TOP_10' : 'MAINTIEN';
      break;
  }
  return { kind, targetRank: targetRankOf(kind), label: labelOf(kind) };
}

/**
 * Ce qu'un président de Pro D2 attend.
 *
 * Un club fraîchement descendu du Top 14 doit remonter tout de suite — c'est
 * l'exigence la plus dure du jeu, et elle est juste : le budget et l'effectif
 * viennent de l'étage du dessus. Un club installé en seconde division se
 * contente de jouer les premiers rôles.
 */
function proD2Objective(club: Club, reputationScore: number): SeasonObjective {
  const kind: ObjectiveKind = club.reputation >= 55 || reputationScore >= 70
    ? 'MONTEE'
    : club.reputation >= 42
      ? 'ACCESSION'
      : 'HAUT_DE_TABLEAU';
  return { kind, targetRank: targetRankOf(kind), label: labelOf(kind) };
}

function targetRankOf(kind: ObjectiveKind): number {
  switch (kind) {
    case 'CHAMPION': return 1;
    case 'TOP_4': return 4;
    case 'TOP_6': return 6;
    case 'TOP_10': return 10;
    case 'MAINTIEN': return 13;
    // Le champion de Pro D2 monte directement, le deuxième passe par le barrage.
    case 'MONTEE': return 1;
    case 'ACCESSION': return 2;
    case 'HAUT_DE_TABLEAU': return 6;
  }
}

function labelOf(kind: ObjectiveKind): string {
  switch (kind) {
    case 'CHAMPION': return 'Bouclier de Brennus';
    case 'TOP_4': return 'Top 4 (qualif. directe demi-finales)';
    case 'TOP_6': return 'Top 6 (qualification phases finales)';
    case 'TOP_10': return 'Top 10';
    case 'MAINTIEN': return 'Maintien (éviter les 3 dernières places)';
    case 'MONTEE': return 'Remontée immédiate (titre de Pro D2)';
    case 'ACCESSION': return 'Accession (top 2, barrage compris)';
    case 'HAUT_DE_TABLEAU': return 'Haut de tableau (top 6)';
  }
}

export interface ObjectiveCheckInput {
  readonly objective: SeasonObjective;
  readonly playerClubFinalRank: number;
  readonly playerClubChampion: boolean;
}

export interface ObjectiveCheckResult {
  readonly met: boolean;
  readonly summary: string;
}

export function checkObjectiveMet(input: ObjectiveCheckInput): ObjectiveCheckResult {
  const { objective, playerClubFinalRank, playerClubChampion } = input;
  if (objective.kind === 'CHAMPION' || objective.kind === 'MONTEE') {
    return playerClubChampion
      ? { met: true, summary: objective.kind === 'MONTEE' ? 'Titre de Pro D2 : on remonte.' : 'Bouclier remporté.' }
      : { met: false, summary: objective.kind === 'MONTEE' ? 'Pas de remontée directe.' : 'Pas de Brennus cette saison.' };
  }
  const met = playerClubFinalRank > 0 && playerClubFinalRank <= objective.targetRank;
  return {
    met,
    summary: met
      ? `Objectif atteint (${playerClubFinalRank}e).`
      : `Objectif raté (${playerClubFinalRank}e — visé ≤ ${objective.targetRank}).`,
  };
}

export function updateBoardConfidence(
  current: BoardConfidence,
  objectiveMet: boolean,
  championBonus: boolean,
): BoardConfidence {
  let scoreDelta: number;
  if (championBonus) scoreDelta = 25;
  else if (objectiveMet) scoreDelta = 8;
  else scoreDelta = -20;

  const score = Math.max(0, Math.min(100, current.score + scoreDelta));
  const consecutiveFailures = objectiveMet ? 0 : current.consecutiveFailures + 1;
  const fired = consecutiveFailures >= 2 && score < 15;
  return { score, consecutiveFailures, fired };
}

export function boardConfidenceLabel(score: number): string {
  if (score >= 75) return 'Confiance totale';
  if (score >= 50) return 'Confiance affirmée';
  if (score >= 30) return 'Confiance fragilisée';
  if (score >= 15) return 'Avertissement officiel';
  return 'Licenciement imminent';
}
