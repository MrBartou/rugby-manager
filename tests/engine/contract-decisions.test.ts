/**
 * Tests V0.6 phase 3 — décisions de renouvellement.
 */

import { describe, it, expect } from 'vitest';
import {
  buildContractDecision,
  resolveContractDecision,
} from '@/engine/club/contract-decisions.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function makePlayer(opts: { id?: string; salary?: number; endSeason?: number; mood?: number; birthYear?: number; overall?: number } = {}): Player {
  const N = opts.overall ?? 70;
  return {
    id: (opts.id ?? 'p_test') as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'Antoine', lastName: 'Test',
    birthDate: `${opts.birthYear ?? 2000}-01-01`,
    position: 'OUVREUR', secondaryPositions: [], isJiff: true,
    technical: {
      passe: N, plaquage: N, jeuAuPiedPlace: N, jeuAuPiedDynamique: N,
      visionDeJeu: N, conservation: N, prisedeballeHaute: N, deblayage: N,
    },
    physical: { vitesse: N, puissance: N, endurance: N, detente: N, robustesse: N },
    mental: { decision: N, leadership: N, sangFroid: N, agressivite: N, professionnalisme: N, discipline: N },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: opts.mood ?? 60, moodModifiers: [] },
    contract: {
      startSeason: 2024,
      endSeason: opts.endSeason ?? 2025,
      annualSalary: opts.salary ?? 200_000,
    },
  };
}

describe('buildContractDecision', () => {
  it('produit 3 options avec id stable', () => {
    const p = makePlayer({ salary: 200_000 });
    const d = buildContractDecision(p, 2025);
    expect(d.options.map(o => o.id)).toEqual(['renew_current', 'renew_plus', 'release']);
    expect(d.options[1]!.offer!.annualSalary).toBe(240_000);  // +20%
    expect(d.age).toBe(25);
  });
});

describe('resolveContractDecision', () => {
  it('release renvoie RELEASED sans player update', () => {
    const p = makePlayer({ salary: 200_000 });
    const d = buildContractDecision(p, 2025);
    const r = resolveContractDecision(d, 'release', p, 2025, 'seed');
    expect(r.outcome.kind).toBe('RELEASED');
    expect(r.playerUpdate).toBeUndefined();
  });

  it('renew_plus accepté pour un cadre normal', () => {
    const p = makePlayer({ salary: 200_000, overall: 70, mood: 70, birthYear: 1995 });
    const d = buildContractDecision(p, 2025);
    const r = resolveContractDecision(d, 'renew_plus', p, 2025, 'seed');
    expect(r.outcome.kind).toBe('RENEWED');
    if (r.outcome.kind === 'RENEWED') {
      expect(r.outcome.newContract.endSeason).toBe(2028);
      expect(r.outcome.newContract.annualSalary).toBe(240_000);
    }
    expect(r.playerUpdate).toBeDefined();
  });

  it('renew_current refusé si salaire < marché', () => {
    // Joueur sous-payé qui veut son juste prix
    const p = makePlayer({ salary: 60_000, overall: 80, mood: 50, birthYear: 1996 });
    const d = buildContractDecision(p, 2025);
    const r = resolveContractDecision(d, 'renew_current', p, 2025, 'seed');
    expect(r.outcome.kind).toBe('REFUSED');
  });
});
