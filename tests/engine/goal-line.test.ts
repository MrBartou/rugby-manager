/**
 * Tests de la défense de ligne — V0.13.
 *
 * Le point central : arriver près de l'en-but ne doit plus valoir un essai
 * quasi automatique (c'était 92 % en une phase avant ce module), mais ouvrir
 * une séquence dont l'issue est incertaine.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import { simulateGoalLine, type GoalLineInput } from '../../src/engine/match/goal-line.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import type { ClubId, Player } from '../../src/engine/types.js';

function squadOf(niveau: number): { pack: Player[]; backs: Player[] } {
  const { squad, players } = makeSquad('club_home' as ClubId, niveau);
  const byId = new Map(players.map(p => [p.id, p]));
  const pack: Player[] = [];
  const backs: Player[] = [];
  const FWD = new Set([
    'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
    'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
    'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  ]);
  for (const entry of squad.starters) {
    const p = byId.get(entry.playerId)!;
    if (FWD.has(entry.position)) pack.push(p);
    else backs.push(p);
  }
  return { pack, backs };
}

function makeInput(overrides: Partial<GoalLineInput> = {}): GoalLineInput {
  const attack = squadOf(60);
  const defense = squadOf(60);
  return {
    attackPack: attack.pack,
    attackBacks: attack.backs,
    defensePack: defense.pack,
    defenseBacks: defense.backs,
    attackPossession: 'HOME',
    fieldPosition: 42,
    fatigueAttack: 40,
    fatigueDefense: 40,
    phasesAtLine: 0,
    attackTacticalBonus: 0,
    defenseTacticalBonus: 0,
    ...overrides,
  };
}

/** Distribution des issues sur N tirages, pour une entrée donnée. */
function outcomeDistribution(input: GoalLineInput, n = 4000) {
  const counts = { try: 0, penaltyAttack: 0, penaltyDefense: 0, turnover: 0, error: 0, held: 0, continue: 0 };
  for (let i = 0; i < n; i++) {
    const o = simulateGoalLine(input, createRng(`gl_${i}`));
    if (o.tryScored) counts.try++;
    else if (o.nextPhase === 'GOAL_LINE') counts.continue++;
    else if (o.penaltyAwarded === input.attackPossession) counts.penaltyAttack++;
    else if (o.penaltyAwarded) counts.penaltyDefense++;
    else if (o.summary.includes('grattage')) counts.turnover++;
    else if (o.summary.includes('en-avant')) counts.error++;
    else counts.held++;
  }
  return { counts, n };
}

describe('phase GOAL_LINE — issues possibles', () => {
  it('produit toutes les issues du répertoire (essai, pénalité, grattage, en-avant, continuation)', () => {
    const { counts } = outcomeDistribution(makeInput());
    expect(counts.try).toBeGreaterThan(0);
    expect(counts.penaltyAttack).toBeGreaterThan(0);
    expect(counts.turnover).toBeGreaterThan(0);
    expect(counts.error).toBeGreaterThan(0);
    expect(counts.continue).toBeGreaterThan(0);
  });

  it('un seul temps de jeu ne suffit jamais à garantir l\'essai', () => {
    const { counts, n } = outcomeDistribution(makeInput());
    // Avant V0.13 cette probabilité valait 0.92 : la défense de ligne n'existait pas.
    expect(counts.try / n).toBeLessThan(0.55);
    expect(counts.try / n).toBeGreaterThan(0.15);
  });

  it('est déterministe pour une même graine', () => {
    const input = makeInput();
    const a = simulateGoalLine(input, createRng('même_graine'));
    const b = simulateGoalLine(input, createRng('même_graine'));
    expect(a).toEqual(b);
  });
});

describe('attrition du pilonnage', () => {
  it('la probabilité d\'essai monte avec le nombre de temps joués', () => {
    const early = outcomeDistribution(makeInput({ phasesAtLine: 0 }));
    const late = outcomeDistribution(makeInput({ phasesAtLine: 5 }));
    expect(late.counts.try / late.n).toBeGreaterThan(early.counts.try / early.n);
  });

  it('une défense qui tient longtemps finit par obtenir une pénalité', () => {
    const early = outcomeDistribution(makeInput({ phasesAtLine: 0 }));
    const late = outcomeDistribution(makeInput({ phasesAtLine: 5 }));
    expect(late.counts.penaltyDefense).toBeGreaterThan(early.counts.penaltyDefense);
  });

  it('l\'attaque commet plus d\'erreurs quand la séquence s\'éternise', () => {
    const early = outcomeDistribution(makeInput({ phasesAtLine: 0 }));
    const late = outcomeDistribution(makeInput({ phasesAtLine: 5 }));
    expect(late.counts.error).toBeGreaterThan(early.counts.error);
  });
});

describe('influence des joueurs', () => {
  it('un pack attaquant supérieur marque plus souvent', () => {
    const weak = squadOf(40);
    const strong = squadOf(85);
    const base = makeInput();

    const vsWeakDefense = outcomeDistribution({ ...base, defensePack: weak.pack, defenseBacks: weak.backs });
    const vsStrongDefense = outcomeDistribution({ ...base, defensePack: strong.pack, defenseBacks: strong.backs });

    expect(vsWeakDefense.counts.try).toBeGreaterThan(vsStrongDefense.counts.try);
  });

  it('une défense supérieure gratte davantage de ballons', () => {
    const weak = squadOf(40);
    const strong = squadOf(85);
    const base = makeInput();

    const weakDef = outcomeDistribution({ ...base, defensePack: weak.pack, defenseBacks: weak.backs });
    const strongDef = outcomeDistribution({ ...base, defensePack: strong.pack, defenseBacks: strong.backs });

    expect(strongDef.counts.turnover).toBeGreaterThan(weakDef.counts.turnover);
  });

  it('une défense épuisée encaisse davantage', () => {
    const fresh = outcomeDistribution(makeInput({ fatigueDefense: 5 }));
    const spent = outcomeDistribution(makeInput({ fatigueDefense: 90 }));
    expect(spent.counts.try).toBeGreaterThan(fresh.counts.try);
  });

  it('attribue le marqueur et le gratteur à un joueur identifié', () => {
    const input = makeInput();
    const ids = new Set([...input.attackPack, ...input.attackBacks, ...input.defensePack].map(p => p.id));
    for (let i = 0; i < 400; i++) {
      const o = simulateGoalLine(input, createRng(`key_${i}`));
      if (o.keyPlayerId) expect(ids.has(o.keyPlayerId)).toBe(true);
    }
  });

  it('les avants inscrivent la majorité des essais de pilonnage', () => {
    const input = makeInput();
    const packIds = new Set(input.attackPack.map(p => p.id));
    let fromPack = 0;
    let total = 0;
    for (let i = 0; i < 3000; i++) {
      const o = simulateGoalLine(input, createRng(`scorer_${i}`));
      if (!o.tryScored || !o.keyPlayerId) continue;
      total++;
      if (packIds.has(o.keyPlayerId)) fromPack++;
    }
    expect(total).toBeGreaterThan(100);
    expect(fromPack / total).toBeGreaterThan(0.55);
  });
});

describe('intégration au match', () => {
  it('des séquences GOAL_LINE apparaissent régulièrement en match', () => {
    // Sur un seul match la présence dépend de la graine ; on mesure une fréquence.
    let matchesWithGoalLine = 0;
    const matches = 40;
    for (let i = 0; i < matches; i++) {
      const r = simulateMatch(makeMatchInput({ homeNiveau: 60, awayNiveau: 60 }), `gl_match_${i}`);
      if (r.phases.some(p => p.type === 'GOAL_LINE')) matchesWithGoalLine++;
    }
    expect(matchesWithGoalLine / matches).toBeGreaterThan(0.5);
  });

  it('la phase GOAL_LINE ne se déclenche qu\'à moins de 15 mètres', () => {
    for (let i = 0; i < 30; i++) {
      const result = simulateMatch(makeMatchInput({ homeNiveau: 60, awayNiveau: 60 }), `gl_zone_${i}`);
      for (const phase of result.phases) {
        if (phase.type === 'GOAL_LINE') {
          expect(phase.state.fieldPosition).toBeGreaterThanOrEqual(35);
        }
      }
    }
  });

  it('sur un échantillon de matchs, toutes les défenses de ligne ne cèdent pas', () => {
    let sequences = 0;
    let heldOut = 0;
    for (let i = 0; i < 120; i++) {
      const r = simulateMatch(makeMatchInput({ homeNiveau: 60, awayNiveau: 60 }), `gl_stand_${i}`);
      for (const phase of r.phases) {
        if (phase.type !== 'GOAL_LINE') continue;
        if (phase.outcome.nextPhase === 'GOAL_LINE') continue;   // séquence en cours
        sequences++;
        if (!phase.outcome.tryScored) heldOut++;
      }
    }
    expect(sequences).toBeGreaterThan(50);
    // La défense doit tenir dans une proportion significative des cas.
    expect(heldOut / sequences).toBeGreaterThan(0.20);
  });
});
