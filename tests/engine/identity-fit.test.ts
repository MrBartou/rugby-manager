/**
 * Tests V0.8 phase 4 — identité club ↔ recrutement.
 */

import { describe, it, expect } from 'vitest';
import { applyBadFitMoodPenalty, evaluateIdentityFit } from '@/engine/club/identity-fit.js';
import type { Club, ClubId, Player, PlayerId, Position, TacticalIdentity } from '@/engine/types.js';

function makeClub(identity: TacticalIdentity): Club {
  return {
    id: 'c' as ClubId,
    name: 'Test', shortName: 'TST', city: 'Test',
    tier: 'BUDGET_MOYEN',
    tacticalIdentity: identity,
    stadiumCapacity: 20_000, annualBudget: 12_000_000, salaryCapUsage: 0,
    jiffCount: 0, reputation: 60,
  };
}

function makePlayer(opts: { position: Position; power?: number; speed?: number; discipline?: number; tackle?: number; mood?: number }): Player {
  return {
    id: 'p' as PlayerId, clubId: 'c' as ClubId,
    firstName: 'P', lastName: 'T', birthDate: '2000-01-01',
    position: opts.position, secondaryPositions: [], isJiff: true,
    technical: {
      passe: 70, plaquage: opts.tackle ?? 70,
      jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70,
      visionDeJeu: 70, conservation: 70, prisedeballeHaute: 70, deblayage: 70,
    },
    physical: {
      vitesse: opts.speed ?? 70,
      puissance: opts.power ?? 70,
      endurance: 70, detente: 70, robustesse: 70,
    },
    mental: {
      decision: 70, leadership: 70, sangFroid: 70, agressivite: 70,
      professionnalisme: 70,
      discipline: opts.discipline ?? 70,
    },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: opts.mood ?? 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('evaluateIdentityFit', () => {
  it('JEU_AVANTS : avant puissant = GOOD', () => {
    const club = makeClub('JEU_AVANTS');
    const player = makePlayer({ position: 'PILIER_GAUCHE', power: 80 });
    expect(evaluateIdentityFit(club, player).fit).toBe('GOOD');
  });

  it('JEU_AVANTS : ailier vif et léger = BAD', () => {
    const club = makeClub('JEU_AVANTS');
    const player = makePlayer({ position: 'AILIER_GAUCHE', speed: 85, power: 50 });
    expect(evaluateIdentityFit(club, player).fit).toBe('BAD');
  });

  it('GRAND_ECART : trois-quart rapide = GOOD', () => {
    const club = makeClub('GRAND_ECART');
    const player = makePlayer({ position: 'AILIER_GAUCHE', speed: 80 });
    expect(evaluateIdentityFit(club, player).fit).toBe('GOOD');
  });

  it('GRAND_ECART : avant statique = BAD', () => {
    const club = makeClub('GRAND_ECART');
    const player = makePlayer({ position: 'PILIER_GAUCHE', speed: 35, power: 80 });
    expect(evaluateIdentityFit(club, player).fit).toBe('BAD');
  });

  it('DEFENSE_DE_FER : plaqueur discipliné = GOOD', () => {
    const club = makeClub('DEFENSE_DE_FER');
    const player = makePlayer({ position: 'CENTRE_INTERIEUR', tackle: 80, discipline: 75 });
    expect(evaluateIdentityFit(club, player).fit).toBe('GOOD');
  });

  it('DEFENSE_DE_FER : indiscipliné = BAD', () => {
    const club = makeClub('DEFENSE_DE_FER');
    const player = makePlayer({ position: 'OUVREUR', discipline: 30 });
    expect(evaluateIdentityFit(club, player).fit).toBe('BAD');
  });

  it('MIXTE : toujours NEUTRAL', () => {
    const club = makeClub('MIXTE');
    expect(evaluateIdentityFit(club, makePlayer({ position: 'OUVREUR' })).fit).toBe('NEUTRAL');
  });
});

describe('applyBadFitMoodPenalty', () => {
  it('réduit le mood de tous les joueurs', () => {
    const roster = [
      makePlayer({ position: 'PILIER_GAUCHE', mood: 70 }),
      makePlayer({ position: 'AILIER_GAUCHE', mood: 20 }),
    ];
    const after = applyBadFitMoodPenalty(roster, 5);
    expect(after[0]!.dynamic.mood).toBe(65);
    expect(after[1]!.dynamic.mood).toBe(15);
  });

  it('borne le mood à 0', () => {
    const roster = [makePlayer({ position: 'OUVREUR', mood: 2 })];
    const after = applyBadFitMoodPenalty(roster, 10);
    expect(after[0]!.dynamic.mood).toBe(0);
  });
});
