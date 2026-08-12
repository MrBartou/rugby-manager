/**
 * Mémoire de carrière — V0.42.
 *
 * La propriété centrale : le parcours suit **le manager**, pas le club. Depuis
 * V0.41 il change de banc, et tout agrégat qui repartirait du club courant
 * réattribuerait le palmarès au mauvais propriétaire.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_MANAGER_CAREER,
  appendManagerSeason,
  bestSeason,
  careerTotals,
  clubSpells,
  markDeparture,
  reputationCurve,
  worstSeason,
  type ManagerSeasonRecord,
} from '../../src/engine/season/manager-record.js';
import type { ClubId } from '../../src/engine/types.js';

function rec(over: Partial<ManagerSeasonRecord> = {}): ManagerSeasonRecord {
  return {
    season: 2025,
    clubId: 'toulouse' as ClubId,
    clubName: 'Toulouse',
    objectiveKind: 'TOP_4',
    objectiveTargetRank: 4,
    objectiveLabel: 'Top 4',
    finalRank: 3,
    objectiveMet: true,
    reachedFinal: false,
    wonTitle: false,
    reputationAfter: 45,
    reputationDelta: 5,
    boardConfidence: 68,
    verdict: 'RECONDUIT',
    ...over,
  };
}

function careerOf(...records: readonly ManagerSeasonRecord[]) {
  return records.reduce(appendManagerSeason, EMPTY_MANAGER_CAREER);
}

describe('archivage', () => {
  it('classe les saisons dans le sens de la vie', () => {
    const c = careerOf(rec({ season: 2027 }), rec({ season: 2025 }), rec({ season: 2026 }));
    expect(c.seasons.map(s => s.season)).toEqual([2025, 2026, 2027]);
  });

  it('ne consigne pas deux fois la même saison au même club', () => {
    // Rejouer une intersaison arrive à chaque rechargement de sauvegarde ; un
    // doublon fausserait tous les totaux dérivés.
    const c = careerOf(rec(), rec());
    expect(c.seasons).toHaveLength(1);
  });

  it('distingue deux clubs la même année', () => {
    // Cas réel : limogé à l'intersaison, on reprend un banc pour la saison qui
    // démarre — deux lignes portent alors la même année.
    const c = careerOf(rec(), rec({ clubId: 'vannes' as ClubId, clubName: 'Vannes' }));
    expect(c.seasons).toHaveLength(2);
  });
});

describe('départ volontaire', () => {
  it('requalifie après coup la dernière saison', () => {
    // Le verdict est écrit à la clôture, avant qu'on sache si l'on signera
    // ailleurs : sans requalification, le parcours dirait qu'on est resté.
    const c = markDeparture(careerOf(rec()), 'toulouse' as ClubId);
    expect(c.seasons[0]!.verdict).toBe('PARTI');
  });

  it('ne réécrit pas un limogeage en départ choisi', () => {
    const c = careerOf(rec({ verdict: 'LIMOGE' }));
    expect(markDeparture(c, 'toulouse' as ClubId)).toBe(c);
  });

  it('ne touche pas une saison d\'un autre club', () => {
    const c = careerOf(rec());
    expect(markDeparture(c, 'vannes' as ClubId)).toBe(c);
  });
});

describe('totaux de carrière', () => {
  const career = careerOf(
    rec({ season: 2025, wonTitle: true, finalRank: 1, reachedFinal: true }),
    rec({ season: 2026, finalRank: 8, objectiveMet: false, verdict: 'LIMOGE' }),
    rec({ season: 2027, clubId: 'vannes' as ClubId, clubName: 'Vannes', finalRank: 11,
      objectiveKind: 'MAINTIEN', objectiveTargetRank: 13, objectiveMet: true }),
  );

  it('compte les titres du manager, pas ceux du club', () => {
    expect(careerTotals(career).titles).toBe(1);
    expect(careerTotals(career).clubsManaged).toBe(2);
  });

  it('ne compte pas un titre comme une finale perdue', () => {
    expect(careerTotals(career).finalsLost).toBe(0);
  });

  it('mesure la réussite sur les missions confiées', () => {
    expect(careerTotals(career).successRate).toBe(67);
    expect(careerTotals(career).sackings).toBe(1);
  });

  it('retient le meilleur classement obtenu', () => {
    expect(careerTotals(career).bestRank).toBe(1);
  });

  it('ne divise pas par zéro sur une carrière vierge', () => {
    expect(careerTotals(EMPTY_MANAGER_CAREER).successRate).toBe(0);
    expect(careerTotals(EMPTY_MANAGER_CAREER).bestRank).toBe(0);
  });
});

describe('passages par club', () => {
  it('regroupe les saisons consécutives au même club', () => {
    const spells = clubSpells(careerOf(
      rec({ season: 2025 }), rec({ season: 2026 }), rec({ season: 2027, verdict: 'LIMOGE' }),
    ));
    expect(spells).toHaveLength(1);
    expect(spells[0]!.seasons).toBe(3);
    expect(spells[0]!.endedBy).toBe('LIMOGE');
  });

  it('laisse ouvert le passage en cours', () => {
    expect(clubSpells(careerOf(rec())) [0]!.endedBy).toBeUndefined();
  });

  it('compte un retour comme un second passage', () => {
    // Agréger les deux effacerait précisément ce qui fait le sel d'un retour.
    const spells = clubSpells(careerOf(
      rec({ season: 2025, verdict: 'PARTI' }),
      rec({ season: 2026, clubId: 'vannes' as ClubId, clubName: 'Vannes', verdict: 'PARTI' }),
      rec({ season: 2027 }),
    ));
    expect(spells).toHaveLength(3);
    expect(spells[2]!.clubName).toBe('Toulouse');
  });
});

describe('saisons marquantes', () => {
  it('juge à l\'écart à la mission, pas au classement brut', () => {
    // 4e en visant le titre est un échec ; 8e en visant le maintien est un exploit.
    const career = careerOf(
      rec({ season: 2025, objectiveKind: 'CHAMPION', objectiveTargetRank: 1, finalRank: 4,
        objectiveMet: false }),
      rec({ season: 2026, clubId: 'vannes' as ClubId, clubName: 'Vannes',
        objectiveKind: 'MAINTIEN', objectiveTargetRank: 13, finalRank: 8 }),
    );
    expect(bestSeason(career)!.season).toBe(2026);
    expect(worstSeason(career)!.season).toBe(2025);
  });

  it('place un titre au-dessus de tout', () => {
    const career = careerOf(
      rec({ season: 2025, wonTitle: true, finalRank: 2, objectiveTargetRank: 1 }),
      rec({ season: 2026, objectiveTargetRank: 13, finalRank: 6 }),
    );
    expect(bestSeason(career)!.wonTitle).toBe(true);
  });

  it('ne renvoie rien sur une carrière vierge', () => {
    expect(bestSeason(EMPTY_MANAGER_CAREER)).toBeUndefined();
    expect(worstSeason(EMPTY_MANAGER_CAREER)).toBeUndefined();
  });
});

describe('courbe de réputation', () => {
  it('reconstitue le point de départ, jamais enregistré', () => {
    const curve = reputationCurve(careerOf(
      rec({ season: 2025, reputationAfter: 35, reputationDelta: 5 }),
      rec({ season: 2026, reputationAfter: 48, reputationDelta: 13 }),
    ));
    expect(curve[0]).toEqual({ season: 2024, score: 30 });
    expect(curve[curve.length - 1]).toEqual({ season: 2026, score: 48 });
  });

  it('est vide tant qu\'aucune saison n\'est close', () => {
    expect(reputationCurve(EMPTY_MANAGER_CAREER)).toEqual([]);
  });
});
