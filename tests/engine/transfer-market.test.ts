/**
 * Tests V0.6 phase 4 — marché des transferts.
 */

import { describe, it, expect } from 'vitest';
import {
  generateIncomingOffers,
  listFreeAgents,
  offerToFreeAgent,
  resolveIncomingOffer,
} from '@/engine/club/transfer-market.js';
import type { Club, ClubId, Player, PlayerId } from '@/engine/types.js';

function makePlayer(opts: { id?: string; clubId?: string; salary?: number; endSeason?: number; mood?: number; birthYear?: number; overall?: number; freeAgent?: boolean } = {}): Player {
  const N = opts.overall ?? 70;
  return {
    id: (opts.id ?? 'p_test') as PlayerId,
    clubId: (opts.clubId ?? 'c_test') as ClubId,
    firstName: 'Antoine', lastName: 'Test',
    birthDate: `${opts.birthYear ?? 1998}-01-01`,
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
    ...(opts.freeAgent ? { freeAgent: true } : {}),
  };
}

function makeClub(id: string, overrides: Partial<Club> = {}): Club {
  return {
    id: id as ClubId,
    name: id.toUpperCase(),
    shortName: id.slice(0, 3).toUpperCase(),
    city: 'Test', tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
    stadiumCapacity: 20_000, annualBudget: 12_000_000, salaryCapUsage: 0,
    jiffCount: 0, reputation: 60,
    ...overrides,
  };
}

describe('listFreeAgents', () => {
  it('renvoie les freeAgents non retraités', () => {
    const players = [
      makePlayer({ id: 'a', freeAgent: true }),
      makePlayer({ id: 'b' }),
    ];
    expect(listFreeAgents(players).map(p => p.id)).toEqual(['a']);
  });
});

describe('offerToFreeAgent', () => {
  it('refuse si joueur pas free agent', () => {
    const p = makePlayer();
    const r = offerToFreeAgent(p, 'new_club' as ClubId, { years: 2, annualSalary: 200_000 }, 2025, 'seed');
    expect(r.kind).toBe('REFUSE');
  });

  it('accepte une offre alignée sur le marché', () => {
    const p = makePlayer({ overall: 70, salary: 100_000, freeAgent: true, mood: 80 });
    const r = offerToFreeAgent(p, 'new_club' as ClubId, { years: 2, annualSalary: 280_000 }, 2025, 'seed');
    expect(r.kind).toBe('ACCEPT');
    if (r.kind === 'ACCEPT') {
      expect(r.updatedPlayer.clubId).toBe('new_club');
      expect(r.updatedPlayer.freeAgent).toBe(false);
      expect(r.updatedPlayer.contract.annualSalary).toBe(280_000);
    }
  });
});

describe('generateIncomingOffers', () => {
  it('ne génère rien si aucun joueur ne dépasse 75 d\'overall', () => {
    const offers = generateIncomingOffers({
      playerClubId: 'me' as ClubId,
      playerClubRoster: [makePlayer({ overall: 60 })],
      otherClubs: [makeClub('rival', { tier: 'GROS_BUDGET' })],
      round: 5,
      currentSeason: 2025,
      seed: 'fixed',
    });
    expect(offers).toEqual([]);
  });

  it('peut générer une offre sur une star (proba 8%, déterministe par seed)', () => {
    const star = makePlayer({ id: 'star', overall: 85, salary: 500_000, endSeason: 2026 });
    const others = [makeClub('rich', { tier: 'GROS_BUDGET' })];
    // Sur 50 seeds, on attend ~4 offres (8%)
    let count = 0;
    for (let i = 0; i < 50; i++) {
      const offers = generateIncomingOffers({
        playerClubId: 'me' as ClubId,
        playerClubRoster: [star],
        otherClubs: others,
        round: i,
        currentSeason: 2025,
        seed: 'fixed',
      });
      if (offers.length > 0) count++;
    }
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(15);
  });
});

describe('resolveIncomingOffer', () => {
  it('refuser → REJECTED', () => {
    const p = makePlayer({ id: 'star' });
    const offer = {
      id: 'o1',
      fromClubId: 'rich' as ClubId,
      fromClubName: 'Rich',
      playerId: p.id,
      playerLastName: p.lastName,
      transferAmount: 1_000_000,
      proposedAnnualSalary: 400_000,
      proposedYears: 3,
      atRound: 5,
    };
    expect(resolveIncomingOffer(offer, p, false, 2025).kind).toBe('REJECTED');
  });

  it('accepter → updatedPlayer avec nouveau clubId + nouveau contrat', () => {
    const p = makePlayer({ id: 'star', clubId: 'me', salary: 200_000 });
    const offer = {
      id: 'o1',
      fromClubId: 'rich' as ClubId,
      fromClubName: 'Rich',
      playerId: p.id,
      playerLastName: p.lastName,
      transferAmount: 1_000_000,
      proposedAnnualSalary: 400_000,
      proposedYears: 3,
      atRound: 5,
    };
    const r = resolveIncomingOffer(offer, p, true, 2025);
    expect(r.kind).toBe('ACCEPTED');
    if (r.kind === 'ACCEPTED') {
      expect(r.updatedPlayer.clubId).toBe('rich');
      expect(r.updatedPlayer.contract.annualSalary).toBe(400_000);
      expect(r.updatedPlayer.contract.endSeason).toBe(2028);
      expect(r.transferAmount).toBe(1_000_000);
    }
  });
});
