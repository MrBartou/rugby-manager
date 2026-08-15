/**
 * Les consignes individuelles : V0.65.
 *
 * Ce que les tests protègent : chaque consigne se paie, aucune n'est bonne dans
 * l'absolu, et le marquage n'efface jamais un homme. Sans ces trois garde-fous,
 * on activerait tout et on n'y reviendrait plus.
 */

import { describe, expect, it } from 'vitest';
import {
  NO_INSTRUCTIONS,
  instructionsSummary,
  kickingEffect,
  markingEffect,
} from '../../src/engine/match/instructions.js';
import { makeSquad } from './fixtures.js';
import type { ClubId } from '../../src/engine/types.js';
import type { PreMatchTacticalPlan } from '../../src/engine/match/types.js';

const NOUS = makeSquad('a' as ClubId, 70).players;
const EUX = makeSquad('b' as ClubId, 70).players;
const marqueur = NOUS[12]!;
const cible = EUX[13]!;

const plan = (defensiveLine: PreMatchTacticalPlan['defensiveLine']): PreMatchTacticalPlan => ({
  occupation: 'MEDIANE', defensiveLine, setPiecesFocus: ['NONE'],
});

describe('le point neutre', () => {
  it('sans consigne, rien ne bouge', () => {
    expect(NO_INSTRUCTIONS.kicking).toBe('AUCUNE');
    expect(kickingEffect(undefined, plan('MONTANTE'))).toEqual(
      kickingEffect('AUCUNE', plan('MONTANTE')),
    );
    expect(kickingEffect('AUCUNE', plan('MONTANTE')).kickTendencyMul).toBe(1);
  });

  it('et un marquage sans homme désigné ne coûte rien', () => {
    expect(markingEffect({
      marker: undefined, target: cible, markerDefence: 80, targetAttack: 80,
    }).targetPenalty).toBe(0);
  });
});

describe('le marquage', () => {
  it('gêne la cible, et distrait le marqueur', () => {
    const effet = markingEffect({
      marker: marqueur, target: cible, markerDefence: 75, targetAttack: 85,
    });
    expect(effet.targetPenalty).toBeGreaterThan(0);
    expect(effet.markerPenalty).toBeGreaterThan(0);
    expect(effet.summary).toContain(cible.lastName);
  });

  it('n\'efface jamais un homme', () => {
    // La règle de sûreté : même le meilleur défenseur du monde sur le pire
    // attaquant ne doit pas annuler celui-ci.
    const effet = markingEffect({
      marker: marqueur, target: cible, markerDefence: 100, targetAttack: 40,
    });
    expect(effet.targetPenalty).toBeLessThan(40 * 0.25);
  });

  it('rend davantage quand on envoie un bon défenseur sur une vedette', () => {
    const bon = markingEffect({ marker: marqueur, target: cible, markerDefence: 85, targetAttack: 90 });
    const faible = markingEffect({ marker: marqueur, target: cible, markerDefence: 45, targetAttack: 90 });
    expect(bon.targetPenalty).toBeGreaterThan(faible.targetPenalty);
  });

  it('et le prix payé par le marqueur ne dépend pas de la cible', () => {
    const a = markingEffect({ marker: marqueur, target: cible, markerDefence: 70, targetAttack: 90 });
    const b = markingEffect({ marker: marqueur, target: cible, markerDefence: 70, targetAttack: 50 });
    expect(a.markerPenalty).toBe(b.markerPenalty);
  });
});

describe('la consigne au pied', () => {
  it('taper derrière l\'ailier paie contre une défense montante', () => {
    const effet = kickingEffect('DERRIERE_AILIER', plan('MONTANTE'));
    expect(effet.kickGainDelta).toBeGreaterThan(0);
    expect(effet.kickTendencyMul).toBeGreaterThan(1);
  });

  it('et se retourne contre nous face à une défense reculée', () => {
    const effet = kickingEffect('DERRIERE_AILIER', plan('STAND_OFF'));
    expect(effet.kickGainDelta).toBeLessThan(0);
  });

  it('la chandelle est plus tiède, dans les deux sens', () => {
    const contreMontante = kickingEffect('CHANDELLE', plan('MONTANTE'));
    const contreReculee = kickingEffect('CHANDELLE', plan('STAND_OFF'));
    expect(contreMontante.kickGainDelta).toBeGreaterThan(contreReculee.kickGainDelta);
    expect(contreReculee.kickGainDelta).toBeGreaterThanOrEqual(0);
  });

  it('sans dossier sur leur défense, on tape sans certitude', () => {
    const effet = kickingEffect('DERRIERE_AILIER', undefined);
    expect(effet.kickGainDelta).toBe(0);
    expect(effet.kickTendencyMul).toBeGreaterThan(1);
  });
});

describe('ce que le bord de touche annonce', () => {
  it('reprend les consignes données, et rien d\'autre', () => {
    const texte = instructionsSummary(
      markingEffect({ marker: marqueur, target: cible, markerDefence: 70, targetAttack: 80 }),
      kickingEffect('DERRIERE_AILIER', plan('MONTANTE')),
    );
    expect(texte).toContain(marqueur.lastName);
    expect(texte).toContain('ailier');
    expect(instructionsSummary(
      markingEffect({ marker: undefined, target: undefined, markerDefence: 0, targetAttack: 0 }),
      kickingEffect('AUCUNE', undefined),
    )).toBe('');
  });
});
