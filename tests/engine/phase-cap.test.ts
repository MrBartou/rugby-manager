/**
 * Le plafond de phases reste un garde-fou : v0.60.
 *
 * `MAX_PHASES` existe pour qu'un enchaînement qui cesserait de faire avancer le
 * chronomètre ne bloque pas le jeu. Il ne doit jamais couper un match ordinaire :
 * le jour où il le ferait, une rencontre s'arrêterait avant la fin sans que rien
 * ne le signale, et le score serait faux sans être aberrant.
 *
 * Mesure de référence : 75 phases en médiane, 80 au maximum sur 500 matchs.
 */

import { describe, expect, it } from 'vitest';
import { MAX_PHASES } from '@/engine/match/session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import { makeMatchInput } from './fixtures.js';

describe('un match ordinaire n\'atteint jamais le plafond', () => {
  it('reste très en deçà, y compris au pire cas', () => {
    let max = 0;
    for (let i = 0; i < 200; i++) {
      const result = simulateMatch(
        makeMatchInput({ homeNiveau: 70, awayNiveau: 70, matchId: `cap_${i}` }),
        `cap_${i}`,
      );
      max = Math.max(max, result.phases.length);
    }
    expect(max).toBeLessThan(MAX_PHASES / 2);
  });

  it('et le match se termine par le chronomètre, pas par le compteur', () => {
    const result = simulateMatch(
      makeMatchInput({ homeNiveau: 70, awayNiveau: 70, matchId: 'cap_horloge' }),
      'cap_horloge',
    );
    expect(result.phases.length).toBeLessThan(MAX_PHASES);
  });
});
