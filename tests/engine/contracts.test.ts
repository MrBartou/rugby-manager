/**
 * Tests V0.6 phase 3 — contrats.
 */

import { describe, it, expect } from 'vitest';
import {
  applyRenewal,
  detectExpiringContracts,
  expectedMarketSalary,
  expireContracts,
  proposeRenewal,
} from '@/engine/club/contracts.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function makePlayer(opts: { id?: string; salary?: number; endSeason?: number; mood?: number; birthYear?: number; overall?: number; retired?: boolean; freeAgent?: boolean } = {}): Player {
  const N = opts.overall ?? 70;
  return {
    id: (opts.id ?? 'p_test') as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'P', lastName: 'T',
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
      endSeason: opts.endSeason ?? 2026,
      annualSalary: opts.salary ?? 200_000,
    },
    ...(opts.retired !== undefined ? { retired: opts.retired } : {}),
    ...(opts.freeAgent !== undefined ? { freeAgent: opts.freeAgent } : {}),
  };
}

describe('detectExpiringContracts', () => {
  it('renvoie les joueurs en dernière année', () => {
    const players = [
      makePlayer({ id: 'a', endSeason: 2025 }),
      makePlayer({ id: 'b', endSeason: 2026 }),
      makePlayer({ id: 'c', endSeason: 2027 }),
    ];
    const expiring = detectExpiringContracts(players, 2025);
    expect(expiring.map(p => p.id)).toEqual(['a']);
  });

  it('exclut retraités et free agents', () => {
    const players = [
      makePlayer({ id: 'a', endSeason: 2025, retired: true }),
      makePlayer({ id: 'b', endSeason: 2025, freeAgent: true }),
      makePlayer({ id: 'c', endSeason: 2025 }),
    ];
    const expiring = detectExpiringContracts(players, 2025);
    expect(expiring.map(p => p.id)).toEqual(['c']);
  });
});

describe('expectedMarketSalary', () => {
  it('augmente avec l\'overall', () => {
    const low = makePlayer({ overall: 50, birthYear: 2000 });
    const high = makePlayer({ overall: 85, birthYear: 2000 });
    expect(expectedMarketSalary(high, 2025)).toBeGreaterThan(expectedMarketSalary(low, 2025));
  });

  it('décroît à partir de 32 ans', () => {
    const young = makePlayer({ overall: 75, birthYear: 1995 });   // 30 ans en 2025
    const old = makePlayer({ overall: 75, birthYear: 1990 });     // 35 ans en 2025
    expect(expectedMarketSalary(young, 2025)).toBeGreaterThan(expectedMarketSalary(old, 2025));
  });
});

describe('proposeRenewal', () => {
  it('accepte une offre au-dessus de l\'attendu', () => {
    const p = makePlayer({ overall: 70, birthYear: 1998 });
    const expected = expectedMarketSalary(p, 2025);
    const response = proposeRenewal(p, { years: 2, annualSalary: expected }, 2025, 'seed');
    expect(response.kind).toBe('ACCEPT');
  });

  it('refuse une offre dérisoire', () => {
    const p = makePlayer({ overall: 80, birthYear: 1998 });
    const expected = expectedMarketSalary(p, 2025);
    const response = proposeRenewal(p, { years: 2, annualSalary: Math.round(expected * 0.3) }, 2025, 'seed');
    expect(response.kind).toBe('REFUSE');
  });

  it('contre-propose pour une offre intermédiaire', () => {
    const p = makePlayer({ overall: 75, birthYear: 1998, mood: 60 });
    const expected = expectedMarketSalary(p, 2025);
    const response = proposeRenewal(p, { years: 2, annualSalary: Math.round(expected * 0.7) }, 2025, 'seed');
    expect(response.kind).toBe('COUNTER');
    if (response.kind === 'COUNTER') {
      expect(response.counterOffer.annualSalary).toBeGreaterThan(Math.round(expected * 0.7));
    }
  });

  it('mood élevé rend le joueur plus accommodant', () => {
    const happy = makePlayer({ overall: 75, birthYear: 1998, mood: 90 });
    const sad = makePlayer({ overall: 75, birthYear: 1998, mood: 30 });
    const offer = { years: 2, annualSalary: expectedMarketSalary(happy, 2025) };
    const happyResp = proposeRenewal(happy, offer, 2025, 'seed');
    const sadResp = proposeRenewal(sad, offer, 2025, 'seed');
    // Happy accepte, sad pas forcément
    expect(happyResp.kind).toBe('ACCEPT');
    expect(['REFUSE', 'COUNTER']).toContain(sadResp.kind);
  });
});

describe('applyRenewal', () => {
  it('produit un nouveau contrat aux bonnes dates', () => {
    const p = makePlayer({ endSeason: 2025, salary: 100_000 });
    const updated = applyRenewal(p, { years: 3, annualSalary: 250_000 }, 2025);
    expect(updated.contract.startSeason).toBe(2025);
    expect(updated.contract.endSeason).toBe(2028);
    expect(updated.contract.annualSalary).toBe(250_000);
  });
});

describe('expireContracts', () => {
  it('flag freeAgent les contrats expirés', () => {
    const players = [
      makePlayer({ id: 'a', endSeason: 2025 }),  // expiré pour saison 2026
      makePlayer({ id: 'b', endSeason: 2027 }),  // toujours valide
    ];
    const result = expireContracts(players, 2026);
    expect(result.freeAgents).toEqual(['a']);
    expect(result.players.find(p => p.id === 'a' as PlayerId)!.freeAgent).toBe(true);
    expect(result.players.find(p => p.id === 'b' as PlayerId)!.freeAgent).toBeUndefined();
  });

  it('ne re-flag pas les freeAgents existants', () => {
    const players = [makePlayer({ id: 'a', endSeason: 2024, freeAgent: true })];
    const result = expireContracts(players, 2026);
    expect(result.freeAgents).toEqual([]);
  });
});
