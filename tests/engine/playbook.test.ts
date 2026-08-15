/**
 * Le playbook de touche : V0.65.
 *
 * Ce que ces tests protègent, dans l'ordre d'importance :
 *
 *  1. **Le point neutre.** Sans combinaison, le module s'efface exactement.
 *     C'est ce qui garde la calibration valide sans la rejouer.
 *  2. **Aucune combinaison ne domine.** Chacune a un domaine où elle est la
 *     meilleure réponse ; une ligne toujours correcte ferait du carnet un
 *     réglage optimal qu'on recopie une fois pour toutes.
 *  3. **La lecture est le produit d'une répétition et d'un travail.** Ni la
 *     répétition seule, ni la préparation seule ne doivent suffire.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYBOOK,
  MAX_CALLS,
  NEUTRAL_LINEOUT_MODIFIERS,
  READ_MIN_SAMPLE,
  callForSituation,
  favouriteCall,
  lineoutModifiers,
  readLevel,
  recordCall,
  usageShare,
  validatePlaybook,
  type CallUsage,
  type LineoutCall,
  type Playbook,
} from '../../src/engine/match/playbook.js';

const call = (over: Partial<LineoutCall> = {}): LineoutCall => ({
  id: 'c1', name: 'Combinaison', alignment: 'CINQ', jumper: 'MILIEU', option: 'OUVREUR', ...over,
});

describe('le point neutre', () => {
  it('sans combinaison, la touche se joue exactement comme avant', () => {
    expect(lineoutModifiers(undefined)).toEqual(NEUTRAL_LINEOUT_MODIFIERS);
  });

  it('et une combinaison non lue ne subit aucune décote', () => {
    expect(lineoutModifiers(call(), 0)).toEqual(lineoutModifiers(call()));
  });
});

describe('les trois décisions d\'une combinaison', () => {
  it('la touche réduite se conteste beaucoup moins que la touche à sept', () => {
    const reduite = lineoutModifiers(call({ alignment: 'REDUITE' }));
    const sept = lineoutModifiers(call({ alignment: 'SEPT' }));
    expect(reduite.cleanWinDelta).toBeGreaterThan(sept.cleanWinDelta);
    expect(reduite.stealDelta).toBeLessThan(sept.stealDelta);
  });

  it('lancer au fond gagne du terrain et perd des ballons', () => {
    const fond = lineoutModifiers(call({ jumper: 'FOND' }));
    const devant = lineoutModifiers(call({ jumper: 'DEVANT' }));
    expect(fond.cleanWinDelta).toBeLessThan(devant.cleanWinDelta);
    expect(fond.stealDelta).toBeGreaterThan(devant.stealDelta);
  });

  it('un maul à sept pèse plus qu\'un maul à cinq', () => {
    const sept = lineoutModifiers(call({ alignment: 'SEPT', option: 'MAUL' }));
    const cinq = lineoutModifiers(call({ alignment: 'CINQ', option: 'MAUL' }));
    expect(sept.maulProb).toBeGreaterThan(cinq.maulProb);
    expect(sept.maulTryProb).toBeGreaterThan(cinq.maulTryProb);
  });

  it('et trois hommes ne poussent pas un maul', () => {
    // Le manager doit pouvoir se tromper, et le lire dans le résultat.
    const absurde = lineoutModifiers(call({ alignment: 'REDUITE', option: 'MAUL' }));
    const correct = lineoutModifiers(call({ alignment: 'SEPT', option: 'MAUL' }));
    expect(absurde.maulProb).toBeLessThan(correct.maulProb / 4);
  });

  it('le ballon vers l\'ouvreur donne de l\'avance plutôt que des mètres au sol', () => {
    const ouvreur = lineoutModifiers(call({ option: 'OUVREUR' }));
    expect(ouvreur.quickBallMeters).toBeGreaterThan(0);
    expect(ouvreur.maulProb).toBeLessThan(0.05);
  });

  it('le peel ne rapporte presque rien et ne perd presque jamais', () => {
    const peel = lineoutModifiers(call({ alignment: 'CINQ', jumper: 'DEVANT', option: 'PEEL' }));
    const maul = lineoutModifiers(call({ alignment: 'SEPT', jumper: 'FOND', option: 'MAUL' }));
    expect(peel.cleanWinDelta).toBeGreaterThan(maul.cleanWinDelta);
    expect(peel.maulMeters[1]).toBeLessThan(maul.maulMeters[1]);
  });

  it('aucune combinaison n\'est la meilleure partout', () => {
    // La règle qui fait du carnet un carnet. Pour chaque combinaison du jeu par
    // défaut, il en existe une autre qui la bat sur au moins un critère.
    const carnet = DEFAULT_PLAYBOOK.calls;
    for (const c of carnet) {
      const mine = lineoutModifiers(c);
      const battuSurConquete = carnet.some(o => lineoutModifiers(o).cleanWinDelta > mine.cleanWinDelta);
      const battuSurGain = carnet.some(o => lineoutModifiers(o).maulMeters[1] > mine.maulMeters[1]);
      expect(battuSurConquete || battuSurGain).toBe(true);
    }
  });
});

describe('la lecture par l\'adversaire', () => {
  const repetee = (n: number, autres = 0): CallUsage => ({ c1: n, c2: autres });

  it('ne conclut rien sur un échantillon trop court', () => {
    expect(readLevel({
      usage: { c1: READ_MIN_SAMPLE - 1 }, callId: 'c1', opponentPreparation: 1,
    })).toBe(0);
  });

  it('une équipe qui ne prépare rien ne lit rien, même une combinaison rabâchée', () => {
    expect(readLevel({ usage: repetee(30), callId: 'c1', opponentPreparation: 0 })).toBe(0);
  });

  it('une équipe très préparée ne lit rien non plus si l\'on varie', () => {
    // Trois combinaisons également jouées : chacune à 33 %, sous le seuil.
    const varie: CallUsage = { c1: 10, c2: 10, c3: 10 };
    expect(readLevel({ usage: varie, callId: 'c1', opponentPreparation: 1 })).toBe(0);
  });

  it('mais la répétition face à une équipe préparée finit par se payer', () => {
    const lu = readLevel({ usage: repetee(27, 3), callId: 'c1', opponentPreparation: 1 });
    expect(lu).toBeGreaterThan(0.6);
  });

  it('et la lecture coûte d\'abord la conquête, ensuite le maul', () => {
    const libre = lineoutModifiers(call({ alignment: 'SEPT', option: 'MAUL' }), 0);
    const lue = lineoutModifiers(call({ alignment: 'SEPT', option: 'MAUL' }), 1);
    expect(lue.cleanWinDelta).toBeLessThan(libre.cleanWinDelta);
    expect(lue.stealDelta).toBeGreaterThan(libre.stealDelta);
    expect(lue.maulProb).toBeLessThan(libre.maulProb);
  });
});

describe('le compteur d\'appels', () => {
  it('compte, et rapporte des parts', () => {
    let usage: CallUsage = {};
    usage = recordCall(usage, 'c1');
    usage = recordCall(usage, 'c1');
    usage = recordCall(usage, 'c2');
    expect(usageShare(usage, 'c1')).toBeCloseTo(2 / 3);
    expect(favouriteCall(usage)).toEqual({ callId: 'c1', share: 2 / 3 });
  });

  it('ne divise pas par zéro sur un carnet jamais joué', () => {
    expect(usageShare({}, 'c1')).toBe(0);
    expect(favouriteCall({})).toBeUndefined();
  });
});

describe('quelle combinaison le moteur appelle', () => {
  it('dans ses vingt-deux mètres, on sort', () => {
    const c = callForSituation({ playbook: DEFAULT_PLAYBOOK, fieldPosition: 10 });
    expect(c?.alignment).toBe('REDUITE');
  });

  it('dans les vingt-deux adverses, on va chercher l\'essai', () => {
    const c = callForSituation({ playbook: DEFAULT_PLAYBOOK, fieldPosition: 90 });
    expect(c?.option).toBe('MAUL');
  });

  it('entre les deux, celle que le manager a désignée', () => {
    const c = callForSituation({ playbook: DEFAULT_PLAYBOOK, fieldPosition: 50 });
    expect(c?.id).toBe(DEFAULT_PLAYBOOK.defaultCallId);
  });

  it('et rien du tout avec un carnet vide', () => {
    expect(callForSituation({ playbook: { calls: [] }, fieldPosition: 50 })).toBeUndefined();
  });
});

describe('un carnet valide', () => {
  const carnet = (n: number): Playbook => ({
    calls: Array.from({ length: n }, (_, i) => call({ id: `c${i}`, name: `Combi ${i}` })),
  });

  it('le carnet par défaut en est un', () => {
    expect(validatePlaybook(DEFAULT_PLAYBOOK).ok).toBe(true);
  });

  it('refuse un carnet trop maigre : on serait lu quoi qu\'on fasse', () => {
    expect(validatePlaybook(carnet(2)).ok).toBe(false);
  });

  it('refuse un carnet trop chargé : le groupe ne le répète plus', () => {
    expect(validatePlaybook(carnet(MAX_CALLS + 1)).ok).toBe(false);
  });

  it('refuse deux fois le même identifiant, et un nom vide', () => {
    expect(validatePlaybook({ calls: [call(), call(), call()] }).ok).toBe(false);
    expect(validatePlaybook({
      calls: [call({ id: 'a', name: ' ' }), call({ id: 'b' }), call({ id: 'c' })],
    }).ok).toBe(false);
  });
});
