/**
 * Tests V0.5 — fils humains.
 */

import { describe, it, expect } from 'vitest';
import { detectHumanThreads } from '@/engine/human/threads.js';
import { generateInitialRelations, updateRelationScore } from '@/engine/human/relationships.js';
import type { Player, PlayerId, ClubId, TraitId } from '@/engine/types.js';

function makePlayer(opts: {
  id: string;
  position?: Player['position'];
  birthYear?: number;
  isJiff?: boolean;
  traits?: readonly string[];
  leadership?: number;
}): Player {
  return {
    id: opts.id as PlayerId,
    clubId: 'test_club' as ClubId,
    firstName: 'F',
    lastName: opts.id.toUpperCase(),
    birthDate: `${opts.birthYear ?? 1995}-01-01`,
    position: opts.position ?? 'OUVREUR',
    secondaryPositions: [],
    isJiff: opts.isJiff ?? true,
    technical: { passe: 60, plaquage: 60, jeuAuPiedPlace: 50, jeuAuPiedDynamique: 50, visionDeJeu: 60, conservation: 60, prisedeballeHaute: 50, deblayage: 50 },
    physical: { vitesse: 60, puissance: 60, endurance: 60, detente: 50, robustesse: 60 },
    mental: { decision: 60, leadership: opts.leadership ?? 60, sangFroid: 60, agressivite: 60, professionnalisme: 60, discipline: 60 },
    positionSpecific: {},
    traits: (opts.traits ?? []) as readonly TraitId[],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('detectHumanThreads', () => {
  const p1 = makePlayer({ id: 'p1' });
  const p2 = makePlayer({ id: 'p2', position: 'PILIER_GAUCHE' });
  const p3 = makePlayer({ id: 'p3', position: 'CENTRE_INTERIEUR' });
  const players = [p1, p2, p3];
  const playRatio = new Map<string, number>();
  for (const p of players) playRatio.set(p.id as string, 0.85);

  it('renvoie au plus 5 fils', () => {
    const state = generateInitialRelations(players, 2025, 'seed');
    const threads = detectHumanThreads({
      clubPlayers: players,
      relations: state,
      recentResults: [1, 1, 0],
      currentSeason: 2025,
      playRatioByPlayer: playRatio,
      pendingEvents: [],
      moodDeltasByPlayer: new Map(),
    });
    expect(threads.length).toBeLessThanOrEqual(5);
  });

  it('détecte un conflit (relation ≤ -50)', () => {
    let state = generateInitialRelations(players, 2025, 'seed');
    state = updateRelationScore(state, p1.id, p2.id, -80, 'gros conflit');
    const threads = detectHumanThreads({
      clubPlayers: players,
      relations: state,
      recentResults: [],
      currentSeason: 2025,
      playRatioByPlayer: playRatio,
      pendingEvents: [],
      moodDeltasByPlayer: new Map(),
    });
    const conflict = threads.find(t => t.kind === 'CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict!.tone).toBe('conflict');
  });

  it('détecte un mood bas (mood < 35)', () => {
    const state = generateInitialRelations(players, 2025, 'seed');
    const moodDeltas = new Map<PlayerId, number>();
    moodDeltas.set(p1.id, -50);     // force mood très bas
    const threads = detectHumanThreads({
      clubPlayers: players,
      relations: state,
      recentResults: [-1, -1, -1, -1, -1],
      currentSeason: 2025,
      playRatioByPlayer: playRatio,
      pendingEvents: [],
      moodDeltasByPlayer: moodDeltas,
    });
    const lowMood = threads.find(t => t.kind === 'LOW_MOOD');
    expect(lowMood).toBeDefined();
  });

  it('priorité haute pour les events en attente', () => {
    const state = generateInitialRelations(players, 2025, 'seed');
    const fakeEvent = {
      id: 'evt1',
      type: 'CONFLIT_VESTIAIRE' as const,
      atRound: 5,
      title: 'Test event',
      context: 'ctx',
      involvedPlayerIds: [p1.id, p2.id] as readonly PlayerId[],
      options: [{ id: 'a', label: 'A', description: '', effects: [] }],
      defaultOptionId: 'a',
    };
    const threads = detectHumanThreads({
      clubPlayers: players,
      relations: state,
      recentResults: [],
      currentSeason: 2025,
      playRatioByPlayer: playRatio,
      pendingEvents: [fakeEvent],
      moodDeltasByPlayer: new Map(),
    });
    expect(threads[0]?.kind).toBe('PENDING_EVENT');
  });
});
