/**
 * Tests de la coupe d'Europe — V0.13.
 *
 * L'enjeu de la fonctionnalité : créer des semaines doubles qui forcent la rotation
 * d'effectif. Sans seconde compétition, aligner ses quinze meilleurs joueurs
 * vingt-six journées d'affilée ne coûtait rien.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import {
  CHALLENGE_CUP_QUALIFIED,
  CHAMPIONS_CUP_QUALIFIED,
  EUROPEAN_ROUNDS,
  campaignSummaryLabel,
  competitionForRank,
  generateEuropeanOpponent,
  generatePoolCampaign,
  hasWonCompetition,
  nextKnockoutFixture,
  summarisePool,
  type EuropeanCampaign,
  type EuropeanResult,
  type EuropeanStage,
} from '../../src/engine/season/european-cup.js';

function withResults(
  campaign: EuropeanCampaign,
  entries: readonly { stage: EuropeanStage; clubScore: number; opponentScore: number; round?: number }[],
): EuropeanCampaign {
  const results: EuropeanResult[] = entries.map((e, i) => ({
    round: e.round ?? EUROPEAN_ROUNDS[i] ?? 20 + i,
    stage: e.stage,
    opponentName: `Adversaire ${i}`,
    clubScore: e.clubScore,
    opponentScore: e.opponentScore,
    atHome: i % 2 === 0,
  }));
  return { ...campaign, results };
}

function poolCampaign(): EuropeanCampaign {
  return generatePoolCampaign('CHAMPIONS_CUP', 'test');
}

describe('qualification européenne', () => {
  it('les six premiers vont en coupe majeure', () => {
    for (let rank = 1; rank <= CHAMPIONS_CUP_QUALIFIED; rank++) {
      expect(competitionForRank(rank)).toBe('CHAMPIONS_CUP');
    }
  });

  it('les suivants basculent en Challenge', () => {
    expect(competitionForRank(CHAMPIONS_CUP_QUALIFIED + 1)).toBe('CHALLENGE_CUP');
    expect(competitionForRank(CHAMPIONS_CUP_QUALIFIED + CHALLENGE_CUP_QUALIFIED)).toBe('CHALLENGE_CUP');
  });

  it('le bas de tableau ne dispute aucune coupe', () => {
    expect(competitionForRank(CHAMPIONS_CUP_QUALIFIED + CHALLENGE_CUP_QUALIFIED + 1)).toBeUndefined();
    expect(competitionForRank(14)).toBeUndefined();
  });
});

describe('adversaires européens générés', () => {
  it('sont déterministes pour une même graine', () => {
    const a = generateEuropeanOpponent('x', createRng('seed'));
    const b = generateEuropeanOpponent('x', createRng('seed'));
    expect(a).toEqual(b);
  });

  it('ont une force plausible', () => {
    for (let i = 0; i < 200; i++) {
      const o = generateEuropeanOpponent(`o_${i}`, createRng(`s_${i}`));
      expect(o.strength).toBeGreaterThanOrEqual(40);
      expect(o.strength).toBeLessThanOrEqual(85);
      expect(o.name.length).toBeGreaterThan(3);
    }
  });

  it('le Challenge oppose des adversaires plus faibles que la coupe majeure', () => {
    const major = generatePoolCampaign('CHAMPIONS_CUP', 'cmp');
    const minor = generatePoolCampaign('CHALLENGE_CUP', 'cmp');
    const mean = (c: EuropeanCampaign) =>
      c.fixtures.reduce((a, f) => a + f.opponent.strength, 0) / c.fixtures.length;
    expect(mean(minor)).toBeLessThan(mean(major));
  });
});

describe('phase de poule', () => {
  it('compte quatre matchs, deux à domicile et deux à l\'extérieur', () => {
    const c = poolCampaign();
    expect(c.fixtures).toHaveLength(4);
    expect(c.fixtures.filter(f => f.atHome)).toHaveLength(2);
  });

  it('se greffe sur des journées de championnat, créant des semaines doubles', () => {
    const c = poolCampaign();
    for (const f of c.fixtures) {
      expect(EUROPEAN_ROUNDS).toContain(f.round);
    }
  });

  it('oppose quatre adversaires distincts, de quatre villes différentes', () => {
    // Deux clubs d'une même ville dans une poule trahiraient la génération.
    for (const seed of ['distinct', 'a', 'b', 'c', 'd', 'e']) {
      const c = generatePoolCampaign('CHAMPIONS_CUP', seed);
      expect(new Set(c.fixtures.map(f => f.opponent.id)).size).toBe(4);
      expect(new Set(c.fixtures.map(f => f.opponent.city)).size).toBe(4);
    }
  });

  it('deux victoires suffisent à se qualifier', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 30, opponentScore: 10 },
      { stage: 'POOL', clubScore: 12, opponentScore: 25 },
      { stage: 'POOL', clubScore: 22, opponentScore: 18 },
      { stage: 'POOL', clubScore: 5, opponentScore: 40 },
    ]);
    expect(summarisePool(c).qualified).toBe(true);
  });

  it('une seule victoire avec différence négative élimine', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 20, opponentScore: 18 },
      { stage: 'POOL', clubScore: 5, opponentScore: 40 },
      { stage: 'POOL', clubScore: 8, opponentScore: 30 },
      { stage: 'POOL', clubScore: 10, opponentScore: 22 },
    ]);
    const outcome = summarisePool(c);
    expect(outcome.won).toBe(1);
    expect(outcome.qualified).toBe(false);
  });

  it('une poule incomplète ne qualifie pas', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 30, opponentScore: 10 },
      { stage: 'POOL', clubScore: 28, opponentScore: 12 },
    ]);
    expect(summarisePool(c).qualified).toBe(false);
  });
});

describe('phases finales', () => {
  const qualifying = [
    { stage: 'POOL' as const, clubScore: 30, opponentScore: 10 },
    { stage: 'POOL' as const, clubScore: 28, opponentScore: 12 },
    { stage: 'POOL' as const, clubScore: 22, opponentScore: 18 },
    { stage: 'POOL' as const, clubScore: 15, opponentScore: 20 },
  ];

  it('un club non qualifié n\'a pas de match à élimination directe', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 5, opponentScore: 40 },
      { stage: 'POOL', clubScore: 8, opponentScore: 30 },
      { stage: 'POOL', clubScore: 10, opponentScore: 22 },
      { stage: 'POOL', clubScore: 12, opponentScore: 25 },
    ]);
    expect(nextKnockoutFixture(c, 'x')).toBeUndefined();
  });

  it('un club qualifié dispute d\'abord les huitièmes', () => {
    const c = withResults(poolCampaign(), qualifying);
    expect(nextKnockoutFixture(c, 'x')?.stage).toBe('ROUND_OF_16');
  });

  it('la campagne s\'arrête à la première défaite en phase finale', () => {
    const c = withResults(poolCampaign(), [
      ...qualifying,
      { stage: 'ROUND_OF_16', clubScore: 14, opponentScore: 27 },
    ]);
    expect(nextKnockoutFixture(c, 'x')).toBeUndefined();
  });

  it('enchaîne les tours tant que le club gagne', () => {
    let c = withResults(poolCampaign(), qualifying);
    const stages: EuropeanStage[] = [];
    for (let i = 0; i < 5; i++) {
      const next = nextKnockoutFixture(c, 'x');
      if (!next) break;
      stages.push(next.stage);
      c = {
        ...c,
        results: [...c.results, {
          round: next.round, stage: next.stage, opponentName: next.opponent.name,
          clubScore: 25, opponentScore: 15, atHome: next.atHome,
        }],
      };
    }
    expect(stages).toEqual(['ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL']);
    expect(hasWonCompetition(c)).toBe(true);
  });

  it('la finale se joue sur terrain neutre', () => {
    let c = withResults(poolCampaign(), qualifying);
    let finalFixture;
    for (let i = 0; i < 5; i++) {
      const next = nextKnockoutFixture(c, 'x');
      if (!next) break;
      if (next.stage === 'FINAL') { finalFixture = next; break; }
      c = {
        ...c,
        results: [...c.results, {
          round: next.round, stage: next.stage, opponentName: next.opponent.name,
          clubScore: 25, opponentScore: 15, atHome: next.atHome,
        }],
      };
    }
    expect(finalFixture?.atHome).toBe(false);
  });

  it('ne considère pas une poule ratée comme un trophée', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 5, opponentScore: 40 },
      { stage: 'POOL', clubScore: 8, opponentScore: 30 },
      { stage: 'POOL', clubScore: 10, opponentScore: 22 },
      { stage: 'POOL', clubScore: 12, opponentScore: 25 },
    ]);
    expect(hasWonCompetition(c)).toBe(false);
  });
});

describe('bilan de campagne', () => {
  it('annonce le trophée quand la finale est gagnée', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 30, opponentScore: 10 },
      { stage: 'POOL', clubScore: 28, opponentScore: 12 },
      { stage: 'POOL', clubScore: 22, opponentScore: 18 },
      { stage: 'POOL', clubScore: 20, opponentScore: 15 },
      { stage: 'ROUND_OF_16', clubScore: 25, opponentScore: 15 },
      { stage: 'QUARTERFINAL', clubScore: 25, opponentScore: 15 },
      { stage: 'SEMIFINAL', clubScore: 25, opponentScore: 15 },
      { stage: 'FINAL', clubScore: 25, opponentScore: 15 },
    ]);
    expect(campaignSummaryLabel(c)).toContain('remportée');
  });

  it('nomme le tour de l\'élimination', () => {
    const c = withResults(poolCampaign(), [
      { stage: 'POOL', clubScore: 30, opponentScore: 10 },
      { stage: 'POOL', clubScore: 28, opponentScore: 12 },
      { stage: 'POOL', clubScore: 22, opponentScore: 18 },
      { stage: 'POOL', clubScore: 20, opponentScore: 15 },
      { stage: 'ROUND_OF_16', clubScore: 14, opponentScore: 27 },
    ]);
    expect(campaignSummaryLabel(c)).toContain('huitièmes');
  });

  it('indique une campagne encore en cours', () => {
    const c = withResults(poolCampaign(), [{ stage: 'POOL', clubScore: 30, opponentScore: 10 }]);
    expect(campaignSummaryLabel(c)).toContain('en cours');
  });
});
