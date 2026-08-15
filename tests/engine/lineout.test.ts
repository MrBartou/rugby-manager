/**
 * La touche, une fois le carnet branché : V0.65.
 *
 * Le module de touche existe depuis la V0.1 et n'avait jamais eu de test à lui :
 * il était couvert de biais par la calibration, qui mesure des taux sur huit
 * mille matchs mais ne dit rien d'un mécanisme précis.
 *
 * Ce fichier vérifie ce que la V0.65 y ajoute, et une propriété qui commande
 * tout le reste : **sans combinaison, la touche se joue exactement comme
 * avant**. C'est ce qui autorise à ne pas rejouer la calibration pour un
 * mécanisme qui ne s'applique qu'à un manager qui a dessiné son carnet.
 */

import { describe, expect, it } from 'vitest';
import { simulateLineout, type LineoutInput } from '../../src/engine/match/lineout.js';
import { DEFAULT_PLAYBOOK, type LineoutCall } from '../../src/engine/match/playbook.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, PlayerId } from '../../src/engine/types.js';

const ATTAQUE = makeSquad('a' as ClubId, 72).players.slice(0, 8);
const DEFENSE = makeSquad('b' as ClubId, 72).players.slice(0, 8);

const base: LineoutInput = {
  attackPack: ATTAQUE,
  defensePack: DEFENSE,
  attackPossession: 'HOME',
  fatigueAttack: 20,
  fatigueDefense: 20,
};

/** Part de touches conservées sur un grand nombre de tirages. */
function tauxDeConquete(input: LineoutInput, n = 3000): number {
  let gardees = 0;
  for (let i = 0; i < n; i++) {
    const out = simulateLineout(input, createRng(`touche_${i}`));
    if (out.possessionAfter === 'HOME') gardees++;
  }
  return gardees / n;
}

describe('le point neutre tient', () => {
  it('sans combinaison ni philosophie, rien n\'a bougé depuis la V0.64', () => {
    // 0,7603 : valeur mesurée sur le module d'avant la V0.65, sur les mêmes
    // trois mille graines, en faisant tourner les deux versions côte à côte.
    // Les deux ont rendu le même chiffre au dix-millième, ce qui est le seul
    // sens acceptable de « point neutre ».
    expect(tauxDeConquete(base)).toBeCloseTo(0.7603, 3);
  });

  it('et une touche sans combinaison ignore complètement la lecture adverse', () => {
    expect(tauxDeConquete({ ...base, read: 1 })).toBeCloseTo(tauxDeConquete(base), 2);
  });
});

describe('la combinaison change la touche', () => {
  const avec = (call: LineoutCall, read = 0): LineoutInput => ({ ...base, call, read });

  it('une réduite devant se conserve mieux qu\'un fond de touche', () => {
    const reduite = tauxDeConquete(avec({
      id: 'r', name: 'Réduite', alignment: 'REDUITE', jumper: 'DEVANT', option: 'OUVREUR',
    }));
    const fond = tauxDeConquete(avec({
      id: 'f', name: 'Fond', alignment: 'SEPT', jumper: 'FOND', option: 'MAUL',
    }));
    // Deux points d'écart type sur 3000 tirages valent moins de 2 points de
    // pourcentage : l'écart mesuré ici doit rester nettement au-dessus.
    expect(reduite - fond).toBeGreaterThan(0.08);
  });

  it('le maul à sept avance vraiment le ballon', () => {
    let metres = 0;
    const call: LineoutCall = { id: 'm', name: 'Maul', alignment: 'SEPT', jumper: 'MILIEU', option: 'MAUL' };
    for (let i = 0; i < 2000; i++) {
      metres += simulateLineout(avec(call), createRng(`maul_${i}`)).metersGained;
    }
    expect(metres / 2000).toBeGreaterThan(3);
  });

  it('le ballon vers l\'ouvreur sort vite plutôt que loin', () => {
    const call: LineoutCall = { id: 'o', name: 'Ouvreur', alignment: 'CINQ', jumper: 'DEVANT', option: 'OUVREUR' };
    const out = simulateLineout(avec(call), createRng('ouvreur_1'));
    if (out.possessionAfter === 'HOME' && out.nextPhase === 'OPEN_PLAY') {
      expect(out.metersGained).toBeGreaterThan(0);
      expect(out.summary).toContain('Ouvreur');
    }
  });
});

describe('se faire lire coûte le ballon', () => {
  const call: LineoutCall = { id: 'm', name: 'Rouleau', alignment: 'SEPT', jumper: 'MILIEU', option: 'MAUL' };

  it('la même combinaison rapporte moins quand la défense l\'attend', () => {
    const libre = tauxDeConquete({ ...base, call });
    const lue = tauxDeConquete({ ...base, call, read: 1 });
    expect(libre - lue).toBeGreaterThan(0.1);
  });

  it('et le compte rendu le dit, pour que le manager comprenne sans tableau', () => {
    const perdues: string[] = [];
    for (let i = 0; i < 200; i++) {
      const out = simulateLineout({ ...base, call, read: 1 }, createRng(`lue_${i}`));
      if (out.possessionAfter === 'AWAY') perdues.push(out.summary);
    }
    expect(perdues.some(s => s.includes('lue par la défense'))).toBe(true);
  });
});

describe('le sauteur désigné', () => {
  it('tire la touche vers le haut quand il est sur le terrain', () => {
    // On désigne le meilleur sauteur du paquet : la moyenne cesse de le diluer.
    const meilleur = [...ATTAQUE].sort(
      (a, b) => (b.positionSpecific.sautEnTouche ?? 0) - (a.positionSpecific.sautEnTouche ?? 0),
    )[0]!;
    const call: LineoutCall = {
      id: 'd', name: 'Désignée', alignment: 'CINQ', jumper: 'MILIEU', option: 'PEEL',
      jumperId: meilleur.id,
    };
    const sans: LineoutCall = { ...call, jumperId: undefined as unknown as PlayerId };
    expect(tauxDeConquete({ ...base, call }))
      .toBeGreaterThanOrEqual(tauxDeConquete({ ...base, call: sans }));
  });

  it('et la combinaison perd de sa valeur quand il est sorti', () => {
    const call: LineoutCall = {
      id: 'd', name: 'Désignée', alignment: 'CINQ', jumper: 'MILIEU', option: 'PEEL',
      jumperId: 'absent' as PlayerId,
    };
    const sans: LineoutCall = { ...call, jumperId: undefined as unknown as PlayerId };
    expect(tauxDeConquete({ ...base, call })).toBeLessThan(tauxDeConquete({ ...base, call: sans }));
  });
});

describe('le carnet par défaut', () => {
  it('conserve le ballon dans des proportions crédibles, quelle que soit la combinaison', () => {
    // Aucune ligne du carnet livré ne doit être une catastrophe : le manager
    // débutant ne doit pas perdre ses touches parce qu'on lui a donné un carnet
    // mal fichu.
    for (const call of DEFAULT_PLAYBOOK.calls) {
      const taux = tauxDeConquete({ ...base, call }, 1500);
      expect(taux).toBeGreaterThan(0.7);
      expect(taux).toBeLessThan(0.95);
    }
  });
});
