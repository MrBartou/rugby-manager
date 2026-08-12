/**
 * Statistiques d'équipe — V0.36.
 *
 * Ce module ne fait que relire le déroulé du match. Ce qu'on protège, c'est
 * donc la **fidélité** de cette lecture : les deux camps doivent se répondre,
 * et chaque compteur doit mesurer ce que son nom annonce.
 */

import { describe, expect, it } from 'vitest';
import { computeTeamStats, readPlanOutcome } from '../../src/engine/match/team-stats.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput } from './fixtures.js';
import type { MatchResult } from '../../src/engine/match/types.js';

function play(seed: string, homeNiveau = 70, awayNiveau = 70): MatchResult {
  return simulateMatch(
    makeMatchInput({ homeNiveau, awayNiveau, matchId: `m_${seed}` }),
    seed,
  );
}

describe('lecture d\'un match', () => {
  const result = play('base');
  const stats = computeTeamStats(result);

  it('la possession des deux camps couvre tout le match', () => {
    expect(stats.home.possession + stats.away.possession).toBe(100);
  });

  it('les pourcentages restent dans les bornes', () => {
    for (const side of [stats.home, stats.away]) {
      expect(side.possession).toBeGreaterThanOrEqual(0);
      expect(side.possession).toBeLessThanOrEqual(100);
      expect(side.territory).toBeGreaterThanOrEqual(0);
      expect(side.territory).toBeLessThanOrEqual(100);
    }
  });

  it('on ne gagne jamais plus de phases arrêtées qu\'on n\'en dispute', () => {
    for (const side of [stats.home, stats.away]) {
      expect(side.scrums.won).toBeLessThanOrEqual(side.scrums.total);
      expect(side.lineouts.won).toBeLessThanOrEqual(side.lineouts.total);
    }
  });

  it('les essais comptés correspondent au déroulé', () => {
    const home = result.phases.filter(p => p.outcome.tryScored === 'HOME').length;
    const away = result.phases.filter(p => p.outcome.tryScored === 'AWAY').length;
    expect(stats.home.tries).toBe(home);
    expect(stats.away.tries).toBe(away);
  });

  it('une pénalité concédée par l\'un est obtenue par l\'autre', () => {
    const obtenuesParHome = result.phases.filter(p => p.outcome.penaltyAwarded === 'HOME').length;
    expect(stats.away.penaltiesConceded).toBe(obtenuesParHome);
  });

  it('ne compte qu\'une séquence par incursion à cinq mètres', () => {
    const phasesGoalLine = result.phases.filter(p => p.type === 'GOAL_LINE').length;
    const sequences = stats.home.goalLineSequences + stats.away.goalLineSequences;
    // Une séquence dure plusieurs phases : il y en a donc au plus autant que de
    // phases, et en général bien moins.
    expect(sequences).toBeLessThanOrEqual(phasesGoalLine);
  });

  it('est stable : deux lectures du même match donnent le même résultat', () => {
    expect(computeTeamStats(result)).toEqual(stats);
  });

  it('l\'équipe dominante garde davantage le ballon', () => {
    // On compare des moyennes et non des matchs gagnés : le moteur découple
    // volontairement possession et niveau (cf. calibration V0.13), si bien que
    // le fort ne domine « que » deux matchs sur trois. La moyenne, elle, sépare
    // nettement les deux camps sans dépendre du bruit d'une rencontre.
    let fort = 0, faible = 0;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const s = computeTeamStats(play(`dom_${i}`, 85, 55));
      fort += s.home.possession;
      faible += s.away.possession;
    }
    expect(fort / n).toBeGreaterThan(faible / n + 3);
  });
});

describe('lecture du plan de match', () => {
  const stats = computeTeamStats(play('plan'));

  it('commente les trois curseurs', () => {
    const verdicts = readPlanOutcome(stats.home, stats.away, {
      occupation: 'HAUTE', defensiveLine: 'MONTANTE', setPiecesFocus: ['MELEE'],
    });
    expect(verdicts.map(v => v.dial)).toEqual(['Occupation', 'Défense', 'Conquête']);
    for (const v of verdicts) expect(v.reading.length).toBeGreaterThan(20);
  });

  it('adapte sa lecture au réglage choisi', () => {
    const haute = readPlanOutcome(stats.home, stats.away, {
      occupation: 'HAUTE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'],
    })[0]!.reading;
    const basse = readPlanOutcome(stats.home, stats.away, {
      occupation: 'BASSE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'],
    })[0]!.reading;
    expect(haute).not.toBe(basse);
  });

  it('signale le travail de conquête quand il y en a eu', () => {
    const avec = readPlanOutcome(stats.home, stats.away, {
      occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['MELEE', 'TOUCHE'],
    })[2]!.reading;
    const sans = readPlanOutcome(stats.home, stats.away, {
      occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'],
    })[2]!.reading;
    expect(avec).toMatch(/travaillés/);
    expect(sans).toMatch(/sans préparation/);
  });
});
