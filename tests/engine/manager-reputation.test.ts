/**
 * Tests V0.9 phase 2 — réputation manager.
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_REPUTATION,
  reputationLabel,
  updateReputation,
} from '@/engine/season/manager-reputation.js';
import type { ClubId } from '@/engine/types.js';

const ME = 'me' as ClubId;
const OTHER = 'other' as ClubId;

describe('updateReputation', () => {
  it('Brennus gagné : +25 + objectif atteint si fixé', () => {
    const r = updateReputation(INITIAL_REPUTATION, {
      playerClubId: ME, champion: ME,
      playerClubReachedFinal: true, playerClubFinalRank: 1,
      objectiveMet: true,
    });
    expect(r.titlesWon).toBe(1);
    // +25 (titre) + 5 (top4) + 5 (objectif) = +35 → score = 65
    expect(r.score).toBe(65);
  });

  it('finale perdue : +10', () => {
    const r = updateReputation(INITIAL_REPUTATION, {
      playerClubId: ME, champion: OTHER,
      playerClubReachedFinal: true, playerClubFinalRank: 2,
      objectiveMet: true,
    });
    // +10 (finale) + 5 (top4) + 5 (obj) = +20 → score = 50
    expect(r.score).toBe(50);
  });

  it('bottom 3 + objectif raté : malus', () => {
    const r = updateReputation({ ...INITIAL_REPUTATION, score: 50 }, {
      playerClubId: ME, champion: OTHER,
      playerClubReachedFinal: false, playerClubFinalRank: 13,
      objectiveMet: false,
    });
    // -8 (bottom3) - 3 (obj raté) = -11 → 50 - 11 = 39
    expect(r.score).toBe(39);
  });

  it('borné à [0, 100]', () => {
    const high = updateReputation({ ...INITIAL_REPUTATION, score: 95 }, {
      playerClubId: ME, champion: ME,
      playerClubReachedFinal: true, playerClubFinalRank: 1,
      objectiveMet: true,
    });
    expect(high.score).toBe(100);
    const low = updateReputation({ ...INITIAL_REPUTATION, score: 5 }, {
      playerClubId: ME, champion: OTHER,
      playerClubReachedFinal: false, playerClubFinalRank: 14,
      objectiveMet: false,
    });
    expect(low.score).toBe(0);
  });

  it('incrémente seasonsManaged', () => {
    const r = updateReputation(INITIAL_REPUTATION, {
      playerClubId: ME, champion: OTHER,
      playerClubReachedFinal: false, playerClubFinalRank: 7,
      objectiveMet: true,
    });
    expect(r.seasonsManaged).toBe(1);
  });
});

describe('reputationLabel', () => {
  it('mappe score → label', () => {
    expect(reputationLabel(10)).toContain('débutant');
    expect(reputationLabel(30)).toContain('prometteur');
    expect(reputationLabel(50)).toContain('confirmé');
    expect(reputationLabel(70)).toContain('reconnu');
    expect(reputationLabel(90)).toContain('Icône');
  });
});

describe('réputation relative à la mission — V0.41', () => {
  const base = {
    playerClubId: 'moi' as ClubId,
    champion: 'autre' as ClubId,
    playerClubReachedFinal: false,
  };

  it('un maintien obtenu à la 12e place ne coûte rien', () => {
    // C'est le cas qui bloquait toute carrière depuis le bas du tableau : le
    // manager faisait exactement son travail et perdait de la réputation.
    const après = updateReputation(INITIAL_REPUTATION, {
      ...base, playerClubFinalRank: 12, objectiveMet: true, objectiveTargetRank: 13,
    });
    expect(après.score).toBeGreaterThan(INITIAL_REPUTATION.score);
  });

  it('sanctionne toujours un bas de tableau qui trahit la mission', () => {
    const après = updateReputation(INITIAL_REPUTATION, {
      ...base, playerClubFinalRank: 13, objectiveMet: false, objectiveTargetRank: 6,
    });
    expect(après.score).toBeLessThan(INITIAL_REPUTATION.score - 8);
  });

  it('récompense une saison nettement au-dessus de la commande', () => {
    const juste = updateReputation(INITIAL_REPUTATION, {
      ...base, playerClubFinalRank: 12, objectiveMet: true, objectiveTargetRank: 13,
    });
    const exploit = updateReputation(INITIAL_REPUTATION, {
      ...base, playerClubFinalRank: 5, objectiveMet: true, objectiveTargetRank: 13,
    });
    // Faire remarquer un entraîneur de club modeste, c'est faire mieux que demandé.
    expect(exploit.score).toBeGreaterThan(juste.score + 5);
  });

  it('reste compatible avec un appel sans objectif fourni', () => {
    expect(() => updateReputation(INITIAL_REPUTATION, {
      ...base, playerClubFinalRank: 8, objectiveMet: true,
    })).not.toThrow();
  });
});
