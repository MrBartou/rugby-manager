/**
 * Le public — V0.58.
 *
 * `homeFans` était le huitième champ mort du projet : déclaré sur chaque
 * feuille de match depuis la V0.1, lu nulle part. L'affluence se calculait
 * pourtant depuis la V0.45, mais son effet était replié dans un bonus tactique
 * bricolé côté interface — le moteur ignorait le public, et l'interface
 * calculait un effet de jeu.
 *
 * Ce qui est vérifié ici : le niveau neutre l'est **exactement** (c'est ce qui
 * garde la calibration valide sans la rejouer), un stade plein pèse, un stade
 * vide retire à « recevoir » son sens, et le moteur le lit vraiment.
 */

import { describe, expect, it } from 'vitest';
import {
  CROWD_LABEL,
  crowdFactor,
  crowdFromFillRate,
  crowdHint,
} from '../../src/engine/match/crowd.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, MatchId, Player, PlayerId } from '../../src/engine/types.js';
import type { CrowdLevel } from '../../src/engine/match/crowd.js';
import type { MatchInput } from '../../src/engine/match/types.js';

describe('le point neutre est exact', () => {
  it('une affluence moyenne ne change rien du tout', () => {
    // Ce n'est pas une approximation : la fixture du harnais de calibration
    // porte `MOYEN`, et c'est ce qui rend la calibration valide par
    // construction plutôt que par vérification.
    expect(crowdFactor('MOYEN')).toBe(1);
  });

  it('un stade plein porte, un stade vide retire', () => {
    expect(crowdFactor('BEAUCOUP')).toBeGreaterThan(1);
    expect(crowdFactor('PEU')).toBeLessThan(1);
  });

  it('sans transformer l\'équipe : recevoir reste recevoir', () => {
    expect(crowdFactor('BEAUCOUP')).toBeLessThan(1.6);
  });
});

describe('le remplissage donne le niveau', () => {
  it('en dessous des deux tiers, ça sonne creux', () => {
    expect(crowdFromFillRate(0.4)).toBe('PEU');
    expect(crowdFromFillRate(0.65)).toBe('PEU');
  });

  it('au-delà de neuf sur dix, c\'est plein', () => {
    expect(crowdFromFillRate(0.9)).toBe('BEAUCOUP');
    expect(crowdFromFillRate(1)).toBe('BEAUCOUP');
  });

  it('entre les deux, une affluence ordinaire', () => {
    expect(crowdFromFillRate(0.75)).toBe('MOYEN');
  });

  it('annonce les chiffres et ce qu\'ils impliquent', () => {
    const texte = crowdHint('PEU', 6000, 19_000);
    expect(texte).toContain('32 %');
    expect(texte).toContain('clairsemées');
    expect(CROWD_LABEL.BEAUCOUP).toBeTruthy();
  });
});

describe('le moteur le lit vraiment', () => {
  function input(homeFans: CrowdLevel): MatchInput {
    const h = makeSquad('h' as ClubId, 70);
    const a = makeSquad('a' as ClubId, 70);
    const byId = new Map<PlayerId, Player>();
    for (const p of [...h.players, ...a.players]) byId.set(p.id, p);
    const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
    return {
      matchId: 'crowd' as MatchId,
      home: { squad: h.squad, tacticalPlan: plan, liveMoments: [] },
      away: { squad: a.squad, tacticalPlan: plan, liveMoments: [] },
      playersById: byId,
      weather: 'SEC',
      fieldCondition: 'BON',
      homeAdvantageBonus: 1,
      homeFans,
    };
  }

  /**
   * Part de victoires à domicile.
   *
   * Le nombre de matchs n'est pas décoratif : à mille cinq cents rencontres,
   * l'erreur type sur une proportion voisine de 0,47 vaut environ 1,3 point.
   * On ne compare donc que les deux extrêmes — stade plein contre stade vide,
   * soit quatre points et demi d'avantage du terrain d'écart. Comparer deux
   * niveaux voisins reviendrait à affirmer une différence plus petite que le
   * bruit de l'échantillon, ce qui a déjà coûté une fausse alerte en V0.51.
   */
  function homeWinRate(homeFans: CrowdLevel, n = 1500): number {
    let wins = 0;
    for (let i = 0; i < n; i++) {
      const r = simulateMatch(input(homeFans), `crowd_${homeFans}_${i}`);
      if (r.homeScore > r.awayScore) wins++;
    }
    return wins / n;
  }

  it('on gagne plus souvent devant un stade plein que devant des tribunes vides', () => {
    // À effectifs strictement identiques, seul le public change.
    const plein = homeWinRate('BEAUCOUP');
    const vide = homeWinRate('PEU');
    expect(plein).toBeGreaterThan(vide);
  });

  it('l\'écart est net sans être décisif : le public pèse, il ne joue pas', () => {
    const ecart = homeWinRate('BEAUCOUP') - homeWinRate('PEU');
    expect(ecart).toBeGreaterThan(0.02);
    expect(ecart).toBeLessThan(0.20);
  });
});
