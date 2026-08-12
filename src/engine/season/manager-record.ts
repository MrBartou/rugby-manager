/**
 * Mémoire de carrière du manager — V0.42.
 *
 * `records.ts` archivait déjà une saison par an, mais **du point de vue du
 * club** : rang final du club de l'utilisateur, champion, finaliste. Cela
 * suffisait tant qu'une carrière tenait dans un seul club.
 *
 * V0.41 a cassé cette hypothèse. Un manager limogé rebondit ailleurs, et
 * `clubPalmares()` compte alors les Brennus **du club** — pas les siens. Un
 * entraîneur passé par Toulouse puis Vannes se voyait crédité du palmarès
 * toulousain à vie, ou dépossédé de son propre titre en changeant de banc.
 *
 * ## Ce que ce module retient
 *
 * Une ligne par saison **effectivement dirigée**, avec le club, la mission
 * confiée, ce qui en a été fait et le verdict du board. C'est le minimum pour
 * qu'un parcours se raconte : sans l'objectif, une 7e place ne veut rien dire —
 * elle est brillante à Vannes et fautive au Stade Français.
 *
 * Le module ne calcule rien pendant la saison : il enregistre à la clôture, et
 * tout le reste — totaux, meilleure saison, passages par club — se dérive de la
 * liste. Aucun compteur à maintenir, donc aucun compteur à désynchroniser.
 */

import type { ClubId } from '../types.js';
import type { ObjectiveKind } from './board-objective.js';

// =============================================================================
// Modèle
// =============================================================================

/** Ce que le board a retenu de la saison. */
export type SeasonVerdict =
  /** Objectif atteint, poste conservé. */
  | 'RECONDUIT'
  /** Objectif manqué, mais le board maintient sa confiance. */
  | 'AVERTI'
  /** Remercié à l'issue de la saison. */
  | 'LIMOGE'
  /** Parti de son plein gré pour un autre club. */
  | 'PARTI';

export const VERDICT_LABEL: Readonly<Record<SeasonVerdict, string>> = {
  RECONDUIT: 'Reconduit',
  AVERTI: 'Averti',
  LIMOGE: 'Limogé',
  PARTI: 'Parti',
};

export interface ManagerSeasonRecord {
  /** Année de départ de la saison (2025 = saison 2025-26). */
  readonly season: number;
  readonly clubId: ClubId;
  readonly clubName: string;
  /** Mission confiée par le board en début de saison. */
  readonly objectiveKind: ObjectiveKind;
  readonly objectiveTargetRank: number;
  readonly objectiveLabel: string;
  /** Rang en saison régulière (1-14). 0 si la saison n'a pas été menée à terme. */
  readonly finalRank: number;
  readonly objectiveMet: boolean;
  readonly reachedFinal: boolean;
  readonly wonTitle: boolean;
  /** Réputation au soir de la saison, après mise à jour. */
  readonly reputationAfter: number;
  /** Variation de réputation sur la saison — la courbe d'une carrière. */
  readonly reputationDelta: number;
  /** Confiance du board au soir de la saison. */
  readonly boardConfidence: number;
  readonly verdict: SeasonVerdict;
}

export interface ManagerCareer {
  /** Du plus ancien au plus récent : une carrière se lit dans le sens de la vie. */
  readonly seasons: readonly ManagerSeasonRecord[];
}

export const EMPTY_MANAGER_CAREER: ManagerCareer = { seasons: [] };

/**
 * Ajoute une saison au parcours.
 *
 * Idempotent sur le couple (saison, club) : rejouer une intersaison après un
 * rechargement de sauvegarde est le cas normal, et dupliquer la ligne
 * fausserait tous les totaux dérivés.
 */
export function appendManagerSeason(
  career: ManagerCareer,
  record: ManagerSeasonRecord,
): ManagerCareer {
  const already = career.seasons.some(
    s => s.season === record.season && s.clubId === record.clubId,
  );
  if (already) return career;
  return {
    seasons: [...career.seasons, record].sort((a, b) => a.season - b.season),
  };
}

/**
 * Requalifie la dernière saison en départ volontaire.
 *
 * Le verdict est écrit à la clôture, avant que le manager ne sache s'il
 * signera ailleurs. Accepter une offre transforme après coup un « reconduit »
 * en « parti » — sans quoi le parcours donnerait à croire qu'on est resté.
 */
export function markDeparture(career: ManagerCareer, clubId: ClubId): ManagerCareer {
  const last = career.seasons[career.seasons.length - 1];
  if (!last || last.clubId !== clubId || last.verdict === 'LIMOGE') return career;
  return {
    seasons: [...career.seasons.slice(0, -1), { ...last, verdict: 'PARTI' }],
  };
}

// =============================================================================
// Agrégats
// =============================================================================

export interface CareerTotals {
  readonly seasons: number;
  readonly titles: number;
  readonly finalsLost: number;
  readonly objectivesMet: number;
  readonly sackings: number;
  readonly clubsManaged: number;
  /** Taux de réussite sur les missions confiées, en pourcentage entier. */
  readonly successRate: number;
  /** Meilleur classement obtenu, toutes saisons confondues. 0 si aucune. */
  readonly bestRank: number;
}

export function careerTotals(career: ManagerCareer): CareerTotals {
  const s = career.seasons;
  const ranked = s.filter(r => r.finalRank > 0);
  const met = s.filter(r => r.objectiveMet).length;
  return {
    seasons: s.length,
    titles: s.filter(r => r.wonTitle).length,
    finalsLost: s.filter(r => r.reachedFinal && !r.wonTitle).length,
    objectivesMet: met,
    sackings: s.filter(r => r.verdict === 'LIMOGE').length,
    clubsManaged: new Set(s.map(r => r.clubId as string)).size,
    successRate: s.length > 0 ? Math.round((met / s.length) * 100) : 0,
    bestRank: ranked.length > 0 ? Math.min(...ranked.map(r => r.finalRank)) : 0,
  };
}

/**
 * Passage continu à un club.
 *
 * Deux passages distincts au même club — ce qui arrive quand on y revient des
 * années plus tard — comptent pour deux : les agréger effacerait précisément ce
 * qui fait le sel d'un retour.
 */
export interface ClubSpell {
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly fromSeason: number;
  readonly toSeason: number;
  readonly seasons: number;
  readonly titles: number;
  /** Meilleur classement du passage. */
  readonly bestRank: number;
  /** Comment le passage s'est terminé ; absent tant qu'il est en cours. */
  readonly endedBy?: SeasonVerdict;
}

export function clubSpells(career: ManagerCareer): readonly ClubSpell[] {
  const spells: ClubSpell[] = [];

  for (const r of career.seasons) {
    const last = spells[spells.length - 1];
    if (last && last.clubId === r.clubId && last.endedBy === undefined) {
      spells[spells.length - 1] = {
        ...last,
        toSeason: r.season,
        seasons: last.seasons + 1,
        titles: last.titles + (r.wonTitle ? 1 : 0),
        bestRank: r.finalRank > 0 && (last.bestRank === 0 || r.finalRank < last.bestRank)
          ? r.finalRank
          : last.bestRank,
        ...(r.verdict === 'LIMOGE' || r.verdict === 'PARTI' ? { endedBy: r.verdict } : {}),
      };
      continue;
    }
    spells.push({
      clubId: r.clubId,
      clubName: r.clubName,
      fromSeason: r.season,
      toSeason: r.season,
      seasons: 1,
      titles: r.wonTitle ? 1 : 0,
      bestRank: r.finalRank,
      ...(r.verdict === 'LIMOGE' || r.verdict === 'PARTI' ? { endedBy: r.verdict } : {}),
    });
  }

  return spells;
}

/**
 * La saison dont on parle encore.
 *
 * On ne prend pas le meilleur classement brut : finir 4e avec Toulouse quand on
 * visait le titre est un échec, alors que la même place à Vannes est un exploit.
 * C'est l'écart à la mission qui départage, le titre passant devant tout.
 */
export function bestSeason(career: ManagerCareer): ManagerSeasonRecord | undefined {
  return [...career.seasons].sort((a, b) => score(b) - score(a))[0];
}

/** La saison qu'on préférerait oublier. */
export function worstSeason(career: ManagerCareer): ManagerSeasonRecord | undefined {
  if (career.seasons.length === 0) return undefined;
  return [...career.seasons].sort((a, b) => score(a) - score(b))[0];
}

function score(r: ManagerSeasonRecord): number {
  const overshoot = r.finalRank > 0 ? r.objectiveTargetRank - r.finalRank : -20;
  return overshoot + (r.wonTitle ? 40 : 0) + (r.reachedFinal ? 10 : 0)
    - (r.verdict === 'LIMOGE' ? 15 : 0);
}

/**
 * Courbe de réputation, du début de carrière à aujourd'hui.
 *
 * Le point de départ manque dans les enregistrements — on ne consigne que
 * l'après — donc on le reconstitue par soustraction du premier delta.
 */
export function reputationCurve(career: ManagerCareer): readonly { season: number; score: number }[] {
  if (career.seasons.length === 0) return [];
  const first = career.seasons[0]!;
  const points = [{ season: first.season - 1, score: first.reputationAfter - first.reputationDelta }];
  for (const r of career.seasons) {
    points.push({ season: r.season, score: r.reputationAfter });
  }
  return points;
}
