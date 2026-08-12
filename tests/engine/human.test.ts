/**
 * Tests V0.4 phase 1 — traits + mood.
 */

import { describe, it, expect } from 'vitest';
import {
  TRAITS,
  areTraitsCompatible,
  getTraitDef,
  traitsByCategory,
} from '@/engine/human/traits.js';
import { generateTraitsForPlayer } from '@/engine/human/trait-generator.js';
import { computeMood, pruneMoodEvents, pushMoodEvent } from '@/engine/human/mood.js';
import { createRng } from '@/engine/rng.js';
import type { Player, PlayerId, ClubId, TraitId } from '@/engine/types.js';

function makePlayer(overrides: Partial<Player> = {}): Player {
  const base: Player = {
    id: 'p_test' as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'Test',
    lastName: 'Player',
    birthDate: '1995-01-01',
    position: 'OUVREUR',
    secondaryPositions: [],
    isJiff: true,
    technical: { passe: 70, plaquage: 60, jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70, visionDeJeu: 70, conservation: 60, prisedeballeHaute: 50, deblayage: 50 },
    physical: { vitesse: 65, puissance: 60, endurance: 65, detente: 50, robustesse: 65 },
    mental: { decision: 70, leadership: 70, sangFroid: 70, agressivite: 60, professionnalisme: 70, discipline: 70 },
    positionSpecific: {},
    traits: [] as readonly TraitId[],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 30, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 200_000 },
  };
  return { ...base, ...overrides } as Player;
}

describe('Traits — catalogue cohérent', () => {
  it('chaque catégorie a au moins 3 traits', () => {
    for (const cat of ['LEADERSHIP', 'MENTAL', 'AMBITION', 'RELATIONNEL', 'STYLE'] as const) {
      expect(traitsByCategory(cat).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('toutes les références exclusiveWith sont valides', () => {
    for (const t of TRAITS) {
      if (!t.exclusiveWith) continue;
      for (const id of t.exclusiveWith) {
        expect(getTraitDef(id), `Trait ${id} référencé par ${t.id} introuvable`).toBeDefined();
      }
    }
  });

  it('areTraitsCompatible détecte les conflits', () => {
    expect(areTraitsCompatible(['leader_naturel', 'suiveur'])).toBe(false);
    expect(areTraitsCompatible(['leader_naturel', 'sang_froid'])).toBe(true);
  });
});

describe('Trait generator', () => {
  it('génère 5-6 traits cohérents', () => {
    const player = makePlayer();
    const rng = createRng(42);
    const traits = generateTraitsForPlayer(player, rng);
    expect(traits.length).toBeGreaterThanOrEqual(5);
    expect(traits.length).toBeLessThanOrEqual(6);
    expect(areTraitsCompatible(traits)).toBe(true);
  });

  it('un joueur avec leadership élevé tire plus souvent leader_naturel', () => {
    let count = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
      const player = makePlayer({ mental: { decision: 70, leadership: 95, sangFroid: 70, agressivite: 60, professionnalisme: 70, discipline: 70 } });
      const traits = generateTraitsForPlayer(player, createRng(`leader_${i}`));
      if (traits.includes('leader_naturel')) count++;
    }
    expect(count).toBeGreaterThan(N * 0.4);     // au moins 40% des cas
  });

  it('un joueur avec leadership faible tire plus souvent suiveur', () => {
    let count = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
      const player = makePlayer({ mental: { decision: 50, leadership: 25, sangFroid: 50, agressivite: 50, professionnalisme: 50, discipline: 50 } });
      const traits = generateTraitsForPlayer(player, createRng(`weak_${i}`));
      if (traits.includes('suiveur')) count++;
    }
    expect(count).toBeGreaterThan(N * 0.3);
  });

  it('génération déterministe avec même seed', () => {
    const player = makePlayer();
    const t1 = generateTraitsForPlayer(player, createRng('fixed'));
    const t2 = generateTraitsForPlayer(player, createRng('fixed'));
    expect(t1).toEqual(t2);
  });
});

describe('Mood — calcul', () => {
  it('mood est dans [0, 100]', () => {
    const player = makePlayer();
    const { mood } = computeMood({
      player,
      recentResults: [1, 1, -1],
      playRatio: 0.8,
      currentSeason: 2025,
    });
    expect(mood).toBeGreaterThanOrEqual(0);
    expect(mood).toBeLessThanOrEqual(100);
  });

  it('résultats positifs → mood plus haut', () => {
    const player = makePlayer();
    const winning = computeMood({ player, recentResults: [1, 1, 1, 1, 1], playRatio: 0.8, currentSeason: 2025 });
    const losing = computeMood({ player, recentResults: [-1, -1, -1, -1, -1], playRatio: 0.8, currentSeason: 2025 });
    expect(winning.mood).toBeGreaterThan(losing.mood);
  });

  it('contrat en fin → modificateur négatif', () => {
    const player = makePlayer({ contract: { startSeason: 2024, endSeason: 2025, annualSalary: 200000 } });
    const { modifiers } = computeMood({
      player,
      recentResults: [],
      playRatio: 0.8,
      currentSeason: 2025,
    });
    const contractMod = modifiers.find(m => m.source === 'CONTRAT');
    expect(contractMod).toBeDefined();
    expect(contractMod!.delta).toBeLessThan(0);
  });

  it('joueur peu utilisé (statut faible) → mood pénalisé', () => {
    const player = makePlayer();
    const titulaire = computeMood({ player, recentResults: [0, 0, 0], playRatio: 0.9, currentSeason: 2025 });
    const banc = computeMood({ player, recentResults: [0, 0, 0], playRatio: 0.1, currentSeason: 2025 });
    expect(titulaire.mood).toBeGreaterThan(banc.mood);
  });

  it('trait fragile_mental amplifie l\'effet des défaites', () => {
    const fragile = makePlayer({ traits: ['fragile_mental' as TraitId] });
    const sangFroid = makePlayer({ traits: ['sang_froid' as TraitId] });
    const fragileResult = computeMood({ player: fragile, recentResults: [-1, -1, -1], playRatio: 0.8, currentSeason: 2025 });
    const sangFroidResult = computeMood({ player: sangFroid, recentResults: [-1, -1, -1], playRatio: 0.8, currentSeason: 2025 });
    expect(fragileResult.mood).toBeLessThan(sangFroidResult.mood);
  });

  it('exactement 7 modificateurs (V0.4 phase 2, avec relations)', () => {
    const { modifiers } = computeMood({
      player: makePlayer(),
      recentResults: [],
      playRatio: 0.5,
      currentSeason: 2025,
    });
    expect(modifiers.length).toBe(7);
  });
});

// =============================================================================
// V0.54 — les deux morals n'en font plus qu'un
// =============================================================================

describe('le moral stocké est le résultat, plus un compteur à part', () => {
  const base = makePlayer();
  const inputs = {
    recentResults: [] as readonly (-1 | 0 | 1)[],
    playRatio: 0.5,
    currentSeason: 2025,
    currentRound: 10,
  };

  it('un événement pèse en plus des sept sources', () => {
    const sans = computeMood({ player: base, ...inputs }).mood;
    const avec = computeMood({
      player: {
        ...base,
        dynamic: {
          ...base.dynamic,
          moodModifiers: pushMoodEvent([], {
            source: 'STATUT_EQUIPE', delta: -20, reason: 'Promesse trahie', expiresAt: 20,
          }),
        },
      },
      ...inputs,
    }).mood;
    expect(avec).toBe(sans - 20);
  });

  it('et il apparaît dans les raisons, avec son libellé', () => {
    const { modifiers } = computeMood({
      player: {
        ...base,
        dynamic: {
          ...base.dynamic,
          moodModifiers: pushMoodEvent([], {
            source: 'RELATIONS', delta: -6, reason: 'Dupont a été vendu', expiresAt: 20,
          }),
        },
      },
      ...inputs,
    });
    expect(modifiers.some(m => m.reason === 'Dupont a été vendu')).toBe(true);
  });

  it('un événement périmé ne compte plus', () => {
    const périmé = {
      ...base,
      dynamic: {
        ...base.dynamic,
        moodModifiers: pushMoodEvent([], {
          source: 'VIE_PRIVEE', delta: -30, reason: 'Vieille affaire', expiresAt: 5,
        }),
      },
    };
    expect(computeMood({ player: périmé, ...inputs }).mood)
      .toBe(computeMood({ player: base, ...inputs }).mood);
  });

  it('deux événements de même raison se remplacent au lieu de s\'empiler', () => {
    // Sans cela, retrahir la même promesse punirait deux fois.
    let mods = pushMoodEvent([], { source: 'STATUT_EQUIPE', delta: -10, reason: 'Promesse trahie' });
    mods = pushMoodEvent(mods, { source: 'STATUT_EQUIPE', delta: -10, reason: 'Promesse trahie' });
    expect(mods).toHaveLength(1);
  });

  it('la purge oublie le périmé et garde le reste', () => {
    const mods = [
      { source: 'VIE_PRIVEE' as const, delta: -5, reason: 'ancien', expiresAt: 3 },
      { source: 'VIE_PRIVEE' as const, delta: -5, reason: 'récent', expiresAt: 30 },
      { source: 'VIE_PRIVEE' as const, delta: -5, reason: 'permanent' },
    ];
    const kept = pruneMoodEvents(mods, 10);
    expect(kept.map(m => m.reason)).toEqual(['récent', 'permanent']);
  });

  it('sans journée courante, rien n\'est écarté', () => {
    // C'est le comportement voulu hors saison, où il n'y a pas de journée.
    const p = {
      ...base,
      dynamic: {
        ...base.dynamic,
        moodModifiers: pushMoodEvent([], {
          source: 'VIE_PRIVEE', delta: -12, reason: 'vieux', expiresAt: 1,
        }),
      },
    };
    const { mood } = computeMood({
      player: p, recentResults: [], playRatio: 0.5, currentSeason: 2025,
    });
    expect(mood).toBe(computeMood({ player: base, recentResults: [], playRatio: 0.5, currentSeason: 2025 }).mood - 12);
  });
});
