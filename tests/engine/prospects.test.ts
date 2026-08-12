/**
 * Suivi des espoirs — V0.43.
 *
 * Ce que le module doit garantir : le **niveau de départ ne bouge jamais**.
 * C'est la seule référence qui permette de mesurer une progression, et rejouer
 * une intersaison après un rechargement de sauvegarde — le cas normal —
 * l'écraserait si le suivi n'était pas idempotent.
 */

import { describe, expect, it } from 'vitest';
import {
  BREAKTHROUGH_MATCHES,
  EMPTY_PROSPECTS,
  academyRecord,
  prospectStatus,
  trackProspects,
  type ProspectRecord,
} from '../../src/engine/club/academy.js';
import type { PlayerId } from '../../src/engine/types.js';

const pid = (s: string) => s as PlayerId;

function record(over: Partial<ProspectRecord> = {}): ProspectRecord {
  return { playerId: pid('a'), intakeSeason: 2026, intakeOverall: 50, academyLevel: 3, ...over };
}

describe('suivi des promotions', () => {
  it('enregistre une promotion avec son niveau de sortie', () => {
    const tracked = trackProspects(EMPTY_PROSPECTS,
      [{ playerId: pid('a'), overall: 52.4 }], 2026, 4);
    expect(tracked).toHaveLength(1);
    expect(tracked[0]!.intakeOverall).toBe(52);
    expect(tracked[0]!.academyLevel).toBe(4);
  });

  it('n\'écrase pas le niveau de départ quand l\'intersaison est rejouée', () => {
    // Sans cela, un rechargement de sauvegarde remettrait le niveau de départ au
    // niveau courant et effacerait toute la progression mesurée.
    let tracked = trackProspects(EMPTY_PROSPECTS, [{ playerId: pid('a'), overall: 50 }], 2026, 3);
    tracked = trackProspects(tracked, [{ playerId: pid('a'), overall: 61 }], 2026, 3);
    expect(tracked).toHaveLength(1);
    expect(tracked[0]!.intakeOverall).toBe(50);
  });

  it('ne recrée pas de tableau quand rien n\'est nouveau', () => {
    const tracked = trackProspects(EMPTY_PROSPECTS, [{ playerId: pid('a'), overall: 50 }], 2026, 3);
    expect(trackProspects(tracked, [{ playerId: pid('a'), overall: 50 }], 2026, 3)).toBe(tracked);
  });

  it('accumule les promotions successives', () => {
    let tracked = trackProspects(EMPTY_PROSPECTS, [{ playerId: pid('a'), overall: 50 }], 2026, 3);
    tracked = trackProspects(tracked, [{ playerId: pid('b'), overall: 48 }], 2027, 4);
    expect(tracked.map(p => p.intakeSeason)).toEqual([2026, 2027]);
  });
});

describe('jugement porté sur un espoir', () => {
  it('ne juge pas un jeune sur sa première saison', () => {
    // Le déclarer en échec dès sa sortie punirait ce qu'on veut encourager.
    const s = prospectStatus(record(), { overall: 50, age: 19 }, 0, 2026);
    expect(s.verdict).toBe('TROP_TOT');
  });

  it('reconnaît une percée au temps de jeu, pas au niveau', () => {
    const s = prospectStatus(record(), { overall: 51, age: 20 }, BREAKTHROUGH_MATCHES, 2028);
    expect(s.verdict).toBe('PERCEE');
  });

  it('mesure la progression depuis la sortie du centre, pas le niveau brut', () => {
    // +6 est une réussite à 55 comme à 70 : c'est l'écart qui compte.
    const modeste = prospectStatus(record({ intakeOverall: 49 }), { overall: 55, age: 21 }, 2, 2028);
    const solide = prospectStatus(record({ intakeOverall: 64 }), { overall: 70, age: 21 }, 2, 2028);
    expect(modeste.verdict).toBe('PROGRESSE');
    expect(solide.verdict).toBe('PROGRESSE');
    expect(modeste.progression).toBe(solide.progression);
  });

  it('constate la stagnation', () => {
    expect(prospectStatus(record(), { overall: 50, age: 22 }, 1, 2029).verdict).toBe('STAGNE');
  });

  it('suit un joueur qui a quitté le club', () => {
    const s = prospectStatus(record(), undefined, 0, 2029);
    expect(s.verdict).toBe('PARTI');
    expect(s.stillHere).toBe(false);
  });
});

describe('bilan du centre', () => {
  const statuses = [
    prospectStatus(record({ playerId: pid('a') }), { overall: 62, age: 22 }, 18, 2029),
    prospectStatus(record({ playerId: pid('b') }), { overall: 54, age: 21 }, 3, 2029),
    prospectStatus(record({ playerId: pid('c') }), { overall: 50, age: 20 }, 0, 2029),
    prospectStatus(record({ playerId: pid('d') }), undefined, 0, 2029),
  ];

  it('répond à la question que pose l\'investissement', () => {
    const bilan = academyRecord(statuses);
    expect(bilan.tracked).toBe(4);
    expect(bilan.breakthroughs).toBe(1);
    expect(bilan.stillAtClub).toBe(3);
    // (+12, +4, 0) sur les trois encore au club et jugeables.
    expect(bilan.averageProgression).toBeCloseTo(5.3, 1);
  });

  it('ne divise pas par zéro sur un centre qui n\'a encore rien sorti', () => {
    expect(academyRecord([]).averageProgression).toBe(0);
    expect(academyRecord([]).tracked).toBe(0);
  });

  it('exclut du calcul les jeunes qu\'il est trop tôt pour juger', () => {
    // Les compter à zéro tirerait la moyenne vers le bas et donnerait
    // l'impression d'un centre inefficace à chaque promotion fraîche.
    const frais = prospectStatus(record({ playerId: pid('e') }), { overall: 50, age: 19 }, 0, 2026);
    expect(academyRecord([...statuses, frais]).averageProgression)
      .toBe(academyRecord(statuses).averageProgression);
  });
});
