/**
 * Le bilan d'une saison : V0.61.
 *
 * Ces règles vivaient dans `App.tsx`, au milieu de l'intersaison, mêlées à la
 * publication des actualités et à la mise à jour d'une trentaine de références
 * React. Elles décident pourtant du sort du manager, et rien n'en était testable
 * tant qu'elles vivaient dans un composant.
 *
 * Ce qui est vérifié ici : l'ordre des étapes, le sort du manager selon ce que
 * le président constate, et ce qui n'entre pas au parcours.
 */

import { describe, expect, it } from 'vitest';
import { buildSeasonVerdict, topScorerOf } from '@/engine/season/season-verdict.js';
import type { ClubId, PlayerId } from '@/engine/types.js';

const TOULOUSE = 'toulouse' as ClubId;

const base = {
  season: 2026,
  playerClubId: TOULOUSE,
  clubName: 'Stade Toulousain',
  playerClubFinalRank: 6,
  playerClubReachedFinal: false,
  objective: { kind: 'TOP_6' as const, targetRank: 6, label: 'Top 6' },
  reputation: { score: 50, titlesWon: 0, seasonsManaged: 3 },
  confidence: { score: 60, consecutiveFailures: 0, fired: false },
  career: { kind: 'EN_POSTE' as const, clubId: TOULOUSE },
  contractPatience: 2,
};

describe('ce que la saison laisse aux archives', () => {
  it('consigne le rang, la finale et le titre', () => {
    const out = buildSeasonVerdict({
      ...base,
      champion: TOULOUSE,
      playerClubFinalRank: 1,
      playerClubReachedFinal: true,
      runnerUp: 'ubb' as ClubId,
    });

    expect(out.seasonRecord.playerClubChampion).toBe(true);
    expect(out.seasonRecord.runnerUp).toBe('ubb');
    expect(out.seasonRecord.playerClubFinalRank).toBe(1);
  });

  it('archive une saison close sans titre décerné', () => {
    // V0.60 : tout le bilan vivait sous un `if (champion)`. Une saison sans
    // titre ne laissait ni ligne, ni verdict, ni réputation mise à jour.
    const out = buildSeasonVerdict(base);
    expect(out.seasonRecord.champion).toBeUndefined();
    expect(out.managerSeason).toBeDefined();
  });

  it('n\'invente pas un rang pour un club introuvable au classement', () => {
    const out = buildSeasonVerdict({ ...base, playerClubFinalRank: 0 });
    expect(out.seasonRecord.playerClubFinalRank).toBe(0);
  });
});

describe('le président tranche en dernier', () => {
  it('reconduit qui a rempli sa mission', () => {
    const out = buildSeasonVerdict({ ...base, playerClubFinalRank: 4 });
    expect(out.objectiveMet).toBe(true);
    expect(out.verdict).toBe('RECONDUIT');
    expect(out.career.kind).toBe('EN_POSTE');
  });

  it('avertit qui l\'a manquée sans que la confiance ne cède', () => {
    const out = buildSeasonVerdict({ ...base, playerClubFinalRank: 11 });
    expect(out.objectiveMet).toBe(false);
    expect(out.verdict).toBe('AVERTI');
    expect(out.career.kind).toBe('EN_POSTE');
  });

  it('limoge quand la confiance a cédé, et rend libre plutôt que de clore la carrière', () => {
    const out = buildSeasonVerdict({
      ...base,
      playerClubFinalRank: 14,
      confidence: { score: 12, consecutiveFailures: 2, fired: false },
      contractPatience: 0,
    });

    expect(out.verdict).toBe('LIMOGE');
    expect(out.career.kind).toBe('LIBRE');
    expect(out.notice).toBeDefined();
  });

  it('juge sur la réputation d\'avant, et rend celle d\'après', () => {
    // Inverser les deux ferait juger un manager sur une réputation déjà
    // corrigée par sa propre saison.
    const out = buildSeasonVerdict({ ...base, champion: TOULOUSE, playerClubFinalRank: 1 });
    expect(out.reputation.score).toBeGreaterThan(base.reputation.score);
    expect(out.reputationDelta).toBe(out.reputation.score - base.reputation.score);
    expect(out.managerSeason?.reputationDelta).toBe(out.reputationDelta);
  });
});

describe('ce qui n\'entre pas au parcours', () => {
  it('une saison passée sans club', () => {
    // On ne l'a pas dirigée : l'y consigner créditerait le manager d'un
    // résultat qui ne lui appartient pas.
    const out = buildSeasonVerdict({
      ...base,
      career: { kind: 'LIBRE' as const, since: 2026, reason: 'LIMOGE' as const },
    });
    expect(out.managerSeason).toBeUndefined();
    // Les archives du championnat, elles, gardent la saison.
    expect(out.seasonRecord.seasonStart).toBe(2026);
  });
});

describe('le meilleur marqueur du club', () => {
  const nomDe = (id: PlayerId) => ({ name: `Joueur ${id as string}`, clubId: TOULOUSE });

  it('est celui qui a le plus marqué', () => {
    const top = topScorerOf(new Map([
      ['a' as PlayerId, { tries: 4 }],
      ['b' as PlayerId, { tries: 9 }],
    ]), nomDe);
    expect(top?.playerId).toBe('b');
    expect(top?.tries).toBe(9);
  });

  it('n\'existe pas quand personne n\'a marqué', () => {
    expect(topScorerOf(new Map([['a' as PlayerId, { tries: 0 }]]), nomDe)).toBeUndefined();
    expect(topScorerOf(new Map(), nomDe)).toBeUndefined();
  });

  it('ni quand le joueur a quitté l\'effectif', () => {
    expect(topScorerOf(new Map([['parti' as PlayerId, { tries: 7 }]]), () => undefined))
      .toBeUndefined();
  });
});
