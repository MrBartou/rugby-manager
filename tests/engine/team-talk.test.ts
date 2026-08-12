/**
 * La causerie — V0.45.
 *
 * La propriété qui distingue une causerie d'un bonus qu'on choisit : elle peut
 * **se retourner**. Sans ce risque, hausser le ton serait toujours gratuit et
 * le vestiaire ne serait qu'un menu de plus.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveTalk,
  situationFor,
  toneFit,
  toneHint,
  type DressingRoom,
  type MatchSituation,
  type TalkTone,
} from '../../src/engine/match/team-talk.js';
import { createRng } from '../../src/engine/rng.js';

const SOLIDE: DressingRoom = { mood: 70, leadership: 70, composure: 75 };
const FRAGILE: DressingRoom = { mood: 30, leadership: 30, composure: 25 };

const run = (tone: TalkTone, situation: MatchSituation, room: DressingRoom, seed: string) =>
  resolveTalk({ tone, situation, room, rng: createRng(seed) });

const rate = (tone: TalkTone, situation: MatchSituation, room: DressingRoom): number => {
  let backfires = 0;
  for (let i = 0; i < 200; i++) if (run(tone, situation, room, `s${i}`).backfired) backfires++;
  return backfires / 200;
};

describe('lecture de la situation', () => {
  it('distingue les cinq états d\'un match', () => {
    expect(situationFor(20)).toBe('LARGE_AVANCE');
    expect(situationFor(6)).toBe('PETITE_AVANCE');
    expect(situationFor(0)).toBe('SERRE');
    expect(situationFor(-6)).toBe('PETIT_RETARD');
    expect(situationFor(-20)).toBe('LARGE_RETARD');
  });
});

describe('justesse du ton', () => {
  it('condamne le coup de gueule quand on mène largement', () => {
    // Les joueurs menaient : ils ne comprendraient pas.
    expect(toneFit('COUP_DE_GUEULE', 'LARGE_AVANCE')).toBeLessThan(0);
  });

  it('le récompense quand l\'équipe sombre', () => {
    expect(toneFit('COUP_DE_GUEULE', 'LARGE_RETARD')).toBeGreaterThan(0);
  });

  it('prête toujours au moins un ton juste à chaque situation', () => {
    // Sans cela, certaines mi-temps n'auraient aucune bonne réponse.
    const tones: readonly TalkTone[] = ['CALME', 'CONFIANCE', 'EXIGEANT', 'COUP_DE_GUEULE'];
    const situations: readonly MatchSituation[] = [
      'LARGE_AVANCE', 'PETITE_AVANCE', 'SERRE', 'PETIT_RETARD', 'LARGE_RETARD',
    ];
    for (const s of situations) {
      expect(Math.max(...tones.map(t => toneFit(t, s)))).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('résolution', () => {
  it('récompense le ton juste', () => {
    const out = run('COUP_DE_GUEULE', 'LARGE_RETARD', SOLIDE, 'a');
    expect(out.backfired).toBe(false);
    expect(out.moodDelta).toBeGreaterThan(0);
    expect(out.tacticalBonus).toBeGreaterThan(0);
  });

  it('se retourne parfois, et rarement quand le ton est juste', () => {
    expect(rate('COUP_DE_GUEULE', 'LARGE_RETARD', SOLIDE)).toBeLessThan(0.10);
    expect(rate('COUP_DE_GUEULE', 'LARGE_AVANCE', FRAGILE)).toBeGreaterThan(0.30);
  });

  it('laisse un groupe solide encaisser un ton mal choisi', () => {
    expect(rate('COUP_DE_GUEULE', 'LARGE_AVANCE', SOLIDE))
      .toBeLessThan(rate('COUP_DE_GUEULE', 'LARGE_AVANCE', FRAGILE));
  });

  it('fait payer plus cher un coup de gueule raté qu\'une causerie plate', () => {
    let dur = 0, doux = 0;
    for (let i = 0; i < 300; i++) {
      const a = run('COUP_DE_GUEULE', 'LARGE_AVANCE', FRAGILE, `d${i}`);
      if (a.backfired) dur = Math.min(dur, a.moodDelta);
      const b = run('CALME', 'LARGE_RETARD', FRAGILE, `c${i}`);
      if (b.backfired) doux = Math.min(doux, b.moodDelta);
    }
    expect(dur).toBeLessThan(doux);
  });

  it('amplifie la causerie quand le groupe a des relais', () => {
    const avecCadres = run('EXIGEANT', 'SERRE', SOLIDE, 'x');
    const sansCadres = run('EXIGEANT', 'SERRE', { ...SOLIDE, leadership: 10 }, 'x');
    expect(avecCadres.moodDelta).toBeGreaterThan(sansCadres.moodDelta);
  });

  it('raconte toujours quelque chose', () => {
    for (const tone of ['CALME', 'CONFIANCE', 'EXIGEANT', 'COUP_DE_GUEULE'] as TalkTone[]) {
      expect(run(tone, 'SERRE', SOLIDE, 'n').narrative.length).toBeGreaterThan(10);
    }
  });

  it('est déterministe pour une même graine', () => {
    expect(run('EXIGEANT', 'SERRE', SOLIDE, 'same'))
      .toEqual(run('EXIGEANT', 'SERRE', SOLIDE, 'same'));
  });
});

describe('ce qu\'on annonce avant de parler', () => {
  it('qualifie le risque sans le chiffrer', () => {
    // Donner la probabilité ferait de la causerie un calcul.
    const hint = toneHint('COUP_DE_GUEULE', 'LARGE_AVANCE');
    expect(hint).toMatch(/comprendrait pas/);
    expect(hint).not.toMatch(/\d/);
  });

  it('signale le moment parfait', () => {
    expect(toneHint('COUP_DE_GUEULE', 'LARGE_RETARD')).toMatch(/parfaitement/);
  });
});
