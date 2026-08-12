/**
 * Les deux attributs cachés qui dormaient — V0.55.
 *
 * `hidden.adaptabilite` et `hidden.determinisme` étaient générés sur chaque
 * joueur depuis la V0.4 et lus nulle part. Une recrue jouait à cent pour cent
 * dès son premier match, et deux joueurs au même potentiel progressaient
 * exactement pareil.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_ADAPTATION_ROUNDS,
  adaptationHint,
  adaptationProgress,
  adaptationRounds,
  applyAdaptation,
} from '../../src/engine/club/adaptation.js';
import { developPlayer } from '../../src/engine/club/development.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE = SQUAD.players[0]!;

const recrue = (over: { adaptabilite?: number; joinedAtRound?: number } = {}): Player => ({
  ...BASE,
  hidden: { ...BASE.hidden, adaptabilite: over.adaptabilite ?? 50 },
  dynamic: {
    ...BASE.dynamic,
    ...(over.joinedAtRound !== undefined ? { joinedAtRound: over.joinedAtRound } : {}),
  },
});

describe('une recrue met du temps à trouver ses marques', () => {
  it('un joueur adaptable s\'installe plus vite qu\'un joueur rigide', () => {
    expect(adaptationRounds({ player: recrue({ adaptabilite: 90 }) }))
      .toBeLessThan(adaptationRounds({ player: recrue({ adaptabilite: 20 }) }));
  });

  it('un club à contre-emploi allonge le délai', () => {
    const p = recrue({ adaptabilite: 50 });
    expect(adaptationRounds({ player: p, styleGap: 1 }))
      .toBeGreaterThan(adaptationRounds({ player: p, styleGap: 0 }));
  });

  it('ne dépasse jamais une demi-saison', () => {
    expect(adaptationRounds({ player: recrue({ adaptabilite: 0 }), styleGap: 1 }))
      .toBeLessThanOrEqual(MAX_ADAPTATION_ROUNDS);
  });

  it('l\'effectif d\'origine est installé depuis toujours', () => {
    // Pas de date d'arrivée : c'est le cas de tous les joueurs d'origine, et de
    // toute sauvegarde antérieure à la V0.55.
    const ancien = recrue();
    expect(adaptationProgress({ player: ancien, currentRound: 5 })).toBe(1);
    // Renvoyé tel quel, sans copie : rien à corriger, rien à recalculer.
    expect(applyAdaptation({ player: ancien, currentRound: 5 })).toBe(ancien);
  });

  it('progresse avec les journées, puis se termine', () => {
    const p = recrue({ adaptabilite: 50, joinedAtRound: 10 });
    const début = adaptationProgress({ player: p, currentRound: 10 });
    const milieu = adaptationProgress({ player: p, currentRound: 12 });
    expect(début).toBe(0);
    expect(milieu).toBeGreaterThan(début);
    expect(adaptationProgress({ player: p, currentRound: 30 })).toBe(1);
  });
});

describe('ce que ça change sur le terrain', () => {
  const nouveau = recrue({ adaptabilite: 30, joinedAtRound: 10 });

  it('la technique et la décision baissent, jamais le physique', () => {
    const vue = applyAdaptation({ player: nouveau, currentRound: 10 });
    expect(vue.technical.passe).toBeLessThan(nouveau.technical.passe);
    expect(vue.mental.decision).toBeLessThan(nouveau.mental.decision);
    // Un joueur qui change de club ne perd pas ses jambes.
    expect(vue.physical).toEqual(nouveau.physical);
  });

  it('reste une gêne, pas une transformation', () => {
    const vue = applyAdaptation({ player: nouveau, currentRound: 10 });
    expect(nouveau.technical.passe - vue.technical.passe).toBeLessThanOrEqual(8);
  });

  it('s\'efface complètement une fois installé', () => {
    expect(applyAdaptation({ player: nouveau, currentRound: 40 })).toBe(nouveau);
  });

  it('ne touche ni au potentiel ni au contrat', () => {
    const vue = applyAdaptation({ player: nouveau, currentRound: 10 });
    expect(vue.hidden).toEqual(nouveau.hidden);
    expect(vue.contract).toEqual(nouveau.contract);
  });

  it('le staff le dit sans chiffrer, et se tait quand c\'est fini', () => {
    const tôt = adaptationHint({ player: nouveau, currentRound: 10 });
    expect(tôt).toBeDefined();
    expect(tôt).not.toMatch(/\d/);
    expect(adaptationHint({ player: nouveau, currentRound: 40 })).toBeUndefined();
  });
});

describe('la détermination décide qui perce', () => {
  const espoir = (determinisme: number): Player => ({
    ...BASE,
    birthDate: '2005-01-01',
    hidden: { ...BASE.hidden, determinisme, potentiel: 90 },
  });

  const progression = (determinisme: number): number => {
    const r = developPlayer({
      player: espoir(determinisme),
      focus: 'TECHNIQUE',
      minutesPlayed: 1600,
      newSeason: 2026,
      coaching: { physique: 70, technique: 70, mental: 70, formation: 70 },
    }, createRng('dev'));
    return r.report.netChange;
  };

  it('deux joueurs au même potentiel ne progressent plus pareil', () => {
    // C'était le cas jusqu'ici, ce qui vidait le potentiel de son sens : dans un
    // centre de formation, la différence n'est presque jamais le talent brut.
    expect(progression(95)).toBeGreaterThan(progression(20));
  });

  it('sans jamais remplacer le potentiel ni le temps de jeu', () => {
    // L'écart reste un facteur parmi d'autres : un acharné sans minutes ne
    // dépasse pas un talent qui joue.
    const acharnéSansJouer = developPlayer({
      player: espoir(95), focus: 'TECHNIQUE', minutesPlayed: 0, newSeason: 2026,
      coaching: { physique: 70, technique: 70, mental: 70, formation: 70 },
    }, createRng('dev')).report.netChange;
    expect(acharnéSansJouer).toBeLessThan(progression(20));
  });
});
