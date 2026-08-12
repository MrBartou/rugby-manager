/**
 * Parler à ses joueurs — V0.48.
 *
 * La propriété qui empêche la conversation d'être un bouton à cliquer chaque
 * semaine : **promettre engage**. Tenir une promesse rapporte, la trahir coûte
 * plus du double — sans cette asymétrie, promettre à tout le monde serait un
 * pari gagnant.
 */

import { describe, expect, it } from 'vitest';
import {
  PROMISE_HORIZON,
  judgePromise,
  makePromise,
  promiseOutcome,
  resolvePlayerTalk,
  temperament,
  topicFit,
  topicHint,
  type TalkContext,
  type TalkTopic,
} from '../../src/engine/human/player-talk.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, TraitId } from '../../src/engine/types.js';

const BASE: Player = makeSquad('c' as ClubId, 70).players[0]!;

const withTraits = (ids: readonly string[]): Player =>
  ({ ...BASE, traits: ids as readonly TraitId[] });

const ctx = (over: Partial<TalkContext> = {}): TalkContext =>
  ({ playRatio: 0.7, forme: 70, mood: 60, currentRound: 10, ...over });

const talk = (topic: TalkTopic, player: Player, c: TalkContext, seed: string) =>
  resolvePlayerTalk({ player, topic, context: c, rng: createRng(seed) });

const backfireRate = (topic: TalkTopic, player: Player, c: TalkContext): number => {
  let n = 0;
  for (let i = 0; i < 200; i++) if (talk(topic, player, c, `s${i}`).backfired) n++;
  return n / 200;
};

describe('justesse du sujet', () => {
  it('ne récompense un compliment que s\'il correspond à quelque chose', () => {
    expect(topicFit('FELICITER', ctx({ forme: 80, playRatio: 0.8 }))).toBe(2);
    expect(topicFit('FELICITER', ctx({ forme: 40, playRatio: 0.2 }))).toBeLessThan(0);
  });

  it('juge le recadrage injuste quand le joueur est excellent', () => {
    expect(topicFit('RECADRER', ctx({ forme: 85 }))).toBe(-2);
    expect(topicFit('RECADRER', ctx({ forme: 40, playRatio: 0.8 }))).toBe(2);
  });

  it('réserve la promesse à qui ne joue pas', () => {
    // Promettre du temps de jeu à un titulaire n'a aucun sens.
    expect(topicFit('PROMETTRE_TEMPS_DE_JEU', ctx({ playRatio: 0.1 }))).toBeGreaterThan(0);
    expect(topicFit('PROMETTRE_TEMPS_DE_JEU', ctx({ playRatio: 0.9 }))).toBeLessThan(0);
  });

  it('propose de rassurer celui qui doute', () => {
    expect(topicFit('RASSURER_ROLE', ctx({ playRatio: 0.1 }))).toBe(2);
    expect(topicFit('RASSURER_ROLE', ctx({ mood: 30 }))).toBe(2);
  });
});

describe('tempérament', () => {
  it('fait qu\'un rancunier encaisse mal un recadrage', () => {
    // C'est là que les trente traits cessent d'être décoratifs.
    const rancunier = withTraits(['rancunier']);
    const pro = withTraits(['professionnel']);
    const situation = ctx({ forme: 85 });      // recadrage injuste
    expect(backfireRate('RECADRER', rancunier, situation))
      .toBeGreaterThan(backfireRate('RECADRER', pro, situation));
  });

  it('amplifie chez un fragile, amortit chez un joueur de sang-froid', () => {
    expect(temperament(withTraits(['fragile_mental']), 'FELICITER').amplitude)
      .toBeGreaterThan(temperament(withTraits(['sang_froid']), 'FELICITER').amplitude);
  });

  it('rend un satisfait difficile à enflammer', () => {
    const satisfait = talk('FELICITER', withTraits(['satisfait']), ctx({ forme: 85, playRatio: 0.9 }), 'a');
    const ambitieux = talk('FELICITER', withTraits(['ambitieux']), ctx({ forme: 85, playRatio: 0.9 }), 'a');
    expect(satisfait.moodDelta).toBeLessThan(ambitieux.moodDelta);
  });
});

describe('résolution', () => {
  it('récompense le sujet bien choisi', () => {
    const out = talk('FELICITER', BASE, ctx({ forme: 85, playRatio: 0.9 }), 'ok');
    expect(out.backfired).toBe(false);
    expect(out.moodDelta).toBeGreaterThan(0);
  });

  it('se retourne d\'autant plus que le joueur va mal', () => {
    // C'est quand on a le plus besoin de lui parler qu'on risque le plus.
    const bas = backfireRate('RECADRER', BASE, ctx({ forme: 85, mood: 20 }));
    const haut = backfireRate('RECADRER', BASE, ctx({ forme: 85, mood: 90 }));
    expect(bas).toBeGreaterThan(haut);
  });

  it('fait payer un recadrage raté plus cher qu\'un compliment raté', () => {
    let dur = 0, doux = 0;
    for (let i = 0; i < 200; i++) {
      const a = talk('RECADRER', BASE, ctx({ forme: 85, mood: 25 }), `d${i}`);
      if (a.backfired) dur = Math.min(dur, a.moodDelta);
      const b = talk('FELICITER', BASE, ctx({ forme: 30, playRatio: 0.1, mood: 25 }), `c${i}`);
      if (b.backfired) doux = Math.min(doux, b.moodDelta);
    }
    expect(dur).toBeLessThan(doux);
  });

  it('est déterministe pour une même graine', () => {
    expect(talk('RECADRER', BASE, ctx(), 'same')).toEqual(talk('RECADRER', BASE, ctx(), 'same'));
  });

  it('raconte toujours quelque chose', () => {
    const topics: readonly TalkTopic[] = [
      'FELICITER', 'RECADRER', 'RASSURER_ROLE', 'PROMETTRE_TEMPS_DE_JEU', 'DEMANDER_EFFORT',
    ];
    for (const t of topics) expect(talk(t, BASE, ctx(), 'n').narrative.length).toBeGreaterThan(10);
  });
});

describe('les promesses', () => {
  const p = makePromise(BASE, ctx({ currentRound: 10 }));

  it('n\'est prise que sur le sujet qui engage', () => {
    expect(talk('PROMETTRE_TEMPS_DE_JEU', BASE, ctx({ playRatio: 0.1 }), 'p').promise).toBeDefined();
    expect(talk('FELICITER', BASE, ctx({ forme: 85, playRatio: 0.9 }), 'p').promise).toBeUndefined();
  });

  it('court sur un horizon borné', () => {
    expect(p.dueAtRound).toBe(10 + PROMISE_HORIZON);
  });

  it('reste en cours tant que l\'échéance n\'est pas là', () => {
    expect(judgePromise(p, 0, 12)).toBe('EN_COURS');
  });

  it('se juge tenue dès que le temps de jeu suit', () => {
    expect(judgePromise(p, 2, 13)).toBe('TENUE');
  });

  it('se juge trahie à l\'échéance si le joueur n\'a pas joué', () => {
    expect(judgePromise(p, 0, 16)).toBe('TRAHIE');
  });

  it('coûte plus du double de ce qu\'elle rapporte', () => {
    // Sans cette asymétrie, promettre à tout le monde serait un pari gagnant.
    const tenue = promiseOutcome('TENUE').moodDelta;
    const trahie = promiseOutcome('TRAHIE').moodDelta;
    expect(tenue).toBeGreaterThan(0);
    expect(Math.abs(trahie)).toBeGreaterThan(tenue * 2);
  });
});

describe('ce qu\'on annonce avant de parler', () => {
  it('prévient qu\'une promesse engage', () => {
    expect(topicHint('PROMETTRE_TEMPS_DE_JEU', ctx({ playRatio: 0.1 }))).toMatch(/engagez/);
  });

  it('qualifie sans chiffrer', () => {
    const hint = topicHint('RECADRER', ctx({ forme: 85 }));
    expect(hint).toMatch(/très mal/);
    expect(hint).not.toMatch(/\d/);
  });
});
