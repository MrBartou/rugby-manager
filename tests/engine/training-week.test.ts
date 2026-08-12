/**
 * La semaine d'entraînement — V0.44.
 *
 * Ce que le module doit garantir : **charger n'est jamais gratuit**. Le plan de
 * semaine existait depuis V0.3 mais ne coûtait que quelques points de fatigue
 * au coup d'envoi ; le choix se faisait donc tout seul, et il n'y avait aucune
 * raison de lever le pied.
 */

import { describe, expect, it } from 'vitest';
import {
  WEEK_EFFECTS,
  resolveTrainingWeek,
  weekForecast,
} from '../../src/engine/club/training-week.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId } from '../../src/engine/types.js';

const SQUAD: readonly Player[] = makeSquad('brive' as ClubId, 68).players;

function runWeek(load: 'LIGHT' | 'MEDIUM' | 'HARD', seed: string, medical = 60, players = SQUAD) {
  return resolveTrainingWeek({
    players,
    load,
    medicalQuality: medical,
    currentRound: 5,
    currentSeason: 2026,
    rng: createRng(seed),
  });
}

describe('effet sur les corps', () => {
  it('rend de la fraîcheur quand on lève le pied, en émoussant', () => {
    const out = runWeek('LIGHT', 'a');
    const before = SQUAD[0]!;
    const after = out.players.find(p => p.id === before.id)!;
    expect(after.dynamic.fatigue).toBeLessThan(before.dynamic.fatigue + 1);
    expect(out.averageFormeDelta).toBeLessThan(0);
  });

  it('affûte quand on charge, au prix de la récupération', () => {
    const out = runWeek('HARD', 'b');
    expect(out.averageFormeDelta).toBeGreaterThan(0);
    expect(WEEK_EFFECTS.HARD.fatigue).toBeGreaterThan(WEEK_EFFECTS.LIGHT.fatigue);
  });

  it('ne sort jamais des bornes 0-100', () => {
    const cassés: readonly Player[] = SQUAD.map(p => ({
      ...p, dynamic: { ...p.dynamic, forme: 2, fatigue: 97 },
    }));
    for (const p of runWeek('HARD', 'c', 60, cassés).players) {
      expect(p.dynamic.forme).toBeGreaterThanOrEqual(0);
      expect(p.dynamic.fatigue).toBeLessThanOrEqual(100);
    }
  });
});

describe('le risque, qui est le vrai prix', () => {
  const count = (load: 'LIGHT' | 'MEDIUM' | 'HARD', medical = 60): number => {
    let total = 0;
    for (let i = 0; i < 40; i++) total += runWeek(load, `r${i}`, medical).injuries.length;
    return total;
  };

  it('fait payer la charge forte bien plus cher que la légère', () => {
    expect(count('HARD')).toBeGreaterThan(count('LIGHT') * 3);
  });

  it('laisse un bon staff médical protéger l\'effectif', () => {
    // C'est le lien qui rend le recrutement d'un médecin comparable à celui
    // d'une recrue : moins spectaculaire, mais il protège toute l'année.
    expect(count('HARD', 90)).toBeLessThan(count('HARD', 25));
  });

  it('ne blesse jamais personne à coup sûr', () => {
    // Une semaine qui coûterait systématiquement un joueur rendrait la charge
    // forte injouable plutôt que risquée.
    const out = runWeek('HARD', 'z');
    expect(out.injuries.length).toBeLessThan(SQUAD.length);
  });

  it('épargne ceux qui ne s\'entraînent pas avec le groupe', () => {
    const blessés: readonly Player[] = SQUAD.map(p => ({
      ...p,
      dynamic: {
        ...p.dynamic,
        injury: { type: 'MUSCULAIRE' as const, startedAt: 1, estimatedReturnAt: 20, hasSequela: false },
      },
    }));
    const out = runWeek('HARD', 'inj', 60, blessés);
    expect(out.injuries).toHaveLength(0);
    expect(out.averageFormeDelta).toBe(0);
  });

  it('date correctement le retour', () => {
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      const out = runWeek('HARD', `d${i}`);
      for (const inj of out.injuries) {
        const player = out.players.find(p => p.id === inj.playerId)!;
        expect(player.dynamic.injury!.estimatedReturnAt).toBe(5 + inj.weeks);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('est déterministe pour une même graine', () => {
    expect(runWeek('HARD', 'same').injuries).toEqual(runWeek('HARD', 'same').injuries);
  });
});

describe('ce qu\'on annonce au manager', () => {
  it('chiffre la contrepartie avant le choix', () => {
    // Charger reste gratuit tant que le risque est invisible.
    const forte = weekForecast('HARD', 27, 60);
    expect(forte).toMatch(/Forme \+4/);
    expect(forte).toMatch(/blessé/);
  });

  it('dit franchement quand le risque est négligeable', () => {
    expect(weekForecast('LIGHT', 27, 90)).toMatch(/négligeable/);
  });

  it('annonce plus de casse avec un mauvais encadrement', () => {
    const bon = weekForecast('HARD', 27, 95);
    const mauvais = weekForecast('HARD', 27, 20);
    expect(bon).not.toBe(mauvais);
  });
});

// =============================================================================
// V0.55 — le repos individuel
// =============================================================================

describe('ménager un joueur sans ménager tout le monde', () => {
  const groupe = () => makeSquad('c1' as ClubId, 70).players.slice(0, 10).map(p => ({
    ...p,
    dynamic: { ...p.dynamic, fatigue: 70, forme: 60 },
  }));

  const semaine = (rested?: ReadonlySet<PlayerId>) => resolveTrainingWeek({
    players: groupe(),
    load: 'HARD',
    medicalQuality: 70,
    currentRound: 10,
    currentSeason: 2025,
    ...(rested ? { rested } : {}),
    rng: createRng('repos'),
  });

  it('celui qu\'on ménage récupère nettement plus que les autres', () => {
    const players = groupe();
    const ménagé = players[0]!.id;
    const r = semaine(new Set([ménagé]));
    const lui = r.players.find(p => p.id === ménagé)!;
    const autre = r.players.find(p => p.id !== ménagé && !p.dynamic.injury)!;
    expect(lui.dynamic.fatigue).toBeLessThan(autre.dynamic.fatigue);
  });

  it('mais il perd du rythme — le repos n\'est pas gratuit', () => {
    const players = groupe();
    const ménagé = players[0]!.id;
    const r = semaine(new Set([ménagé]));
    const lui = r.players.find(p => p.id === ménagé)!;
    expect(lui.dynamic.forme).toBeLessThan(60);
  });

  it('et il ne peut pas se blesser à l\'entraînement', () => {
    const players = groupe();
    const tous = new Set(players.map(p => p.id));
    expect(semaine(tous).injuries).toEqual([]);
  });

  it('sans liste de repos, rien ne change par rapport à avant', () => {
    // Compatibilité : une sauvegarde antérieure n'en a pas.
    const sans = semaine();
    const vide = semaine(new Set());
    expect(sans.players.map(p => p.dynamic.fatigue))
      .toEqual(vide.players.map(p => p.dynamic.fatigue));
  });
});
