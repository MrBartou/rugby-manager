/**
 * Tests V0.3 — calendrier saison + classement.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRoundRobinCalendar,
  matchesForRound,
  nextMatchForClub,
} from '@/engine/season/calendar.js';
import {
  applyMatchToStandings,
  emptyStandings,
  rankedStandings,
} from '@/engine/season/standings.js';
import type { ClubId, MatchId } from '@/engine/types.js';
import type { MatchResult, PhaseRecord } from '@/engine/match/types.js';

const CLUBS = ['toulouse', 'ubb', 'larochelle', 'toulon'].map(id => id as ClubId);
const TOP14 = [
  'toulouse', 'ubb', 'larochelle', 'toulon', 'racing', 'stade', 'clermont',
  'lyon', 'montpellier', 'castres', 'pau', 'bayonne', 'usap', 'vannes',
].map(id => id as ClubId);

describe('Calendar — round-robin', () => {
  it('génère 6 matchs pour 4 clubs (3 journées × 2 matchs × 2 légères = 12 ; ici aller-retour donc 6×2=12)', () => {
    const cal = generateRoundRobinCalendar(CLUBS);
    // 4 clubs : 3 journées aller × 2 matchs = 6, retour = 6 → total 12 matchs, 6 journées
    expect(cal.totalRounds).toBe(6);
    expect(cal.matches.length).toBe(12);
  });

  it('Top 14 : 26 journées, 14×13 = 182 matchs', () => {
    const cal = generateRoundRobinCalendar(TOP14);
    expect(cal.totalRounds).toBe(26);
    expect(cal.matches.length).toBe(14 * 13);
  });

  it('chaque équipe joue 2× chaque adversaire (1 home + 1 away)', () => {
    const cal = generateRoundRobinCalendar(CLUBS);
    for (const a of CLUBS) {
      for (const b of CLUBS) {
        if (a === b) continue;
        const aHomeVsB = cal.matches.filter(m => m.homeClubId === a && m.awayClubId === b);
        const bHomeVsA = cal.matches.filter(m => m.homeClubId === b && m.awayClubId === a);
        expect(aHomeVsB.length).toBe(1);
        expect(bHomeVsA.length).toBe(1);
      }
    }
  });

  it('chaque journée a N/2 matchs', () => {
    const cal = generateRoundRobinCalendar(TOP14);
    for (let r = 1; r <= cal.totalRounds; r++) {
      expect(matchesForRound(cal, r).length).toBe(7);
    }
  });

  it('un club joue exactement une fois par journée', () => {
    const cal = generateRoundRobinCalendar(TOP14);
    for (let r = 1; r <= cal.totalRounds; r++) {
      const matches = matchesForRound(cal, r);
      const playing = new Set<ClubId>();
      for (const m of matches) {
        expect(playing.has(m.homeClubId)).toBe(false);
        expect(playing.has(m.awayClubId)).toBe(false);
        playing.add(m.homeClubId);
        playing.add(m.awayClubId);
      }
      expect(playing.size).toBe(14);
    }
  });

  it('nextMatchForClub trouve le match suivant', () => {
    const cal = generateRoundRobinCalendar(TOP14);
    const next = nextMatchForClub(cal, 'toulouse' as ClubId, 1);
    expect(next).toBeDefined();
    expect(next?.round).toBe(1);
    expect([next?.homeClubId, next?.awayClubId]).toContain('toulouse');
  });

  it('seeds différents → calendriers différents', () => {
    const c1 = generateRoundRobinCalendar(TOP14, 42);
    const c2 = generateRoundRobinCalendar(TOP14, 7);
    // Au moins 50% des matchs doivent avoir un round différent ou home/away inversés
    let differences = 0;
    for (let i = 0; i < c1.matches.length; i++) {
      const m1 = c1.matches[i]!;
      const m2 = c2.matches[i]!;
      if (m1.round !== m2.round || m1.homeClubId !== m2.homeClubId || m1.awayClubId !== m2.awayClubId) {
        differences++;
      }
    }
    expect(differences).toBeGreaterThan(c1.matches.length * 0.5);
  });

  it('chaque équipe joue 13 fois à domicile et 13 fois à l\'extérieur', () => {
    const cal = generateRoundRobinCalendar(TOP14, 12345);
    for (const club of TOP14) {
      const home = cal.matches.filter(m => m.homeClubId === club).length;
      const away = cal.matches.filter(m => m.awayClubId === club).length;
      expect(home).toBe(13);
      expect(away).toBe(13);
    }
  });

  it('aucune équipe ne joue plus de 3 matchs consécutifs à domicile', () => {
    const cal = generateRoundRobinCalendar(TOP14, 99);
    for (const club of TOP14) {
      const seq = cal.matches
        .filter(m => m.homeClubId === club || m.awayClubId === club)
        .sort((a, b) => a.round - b.round)
        .map(m => m.homeClubId === club ? 'H' : 'A');
      // Streaks max
      let maxStreak = 1;
      let current = 1;
      for (let i = 1; i < seq.length; i++) {
        if (seq[i] === seq[i - 1]) { current++; if (current > maxStreak) maxStreak = current; }
        else current = 1;
      }
      expect(maxStreak, `Streak trop long pour ${club} : ${seq.join('')}`).toBeLessThanOrEqual(3);
    }
  });
});

// =============================================================================

function makeFakeResult(homeScore: number, awayScore: number, homeTries: number, awayTries: number): MatchResult {
  const phases: PhaseRecord[] = [];
  for (let i = 0; i < homeTries; i++) {
    phases.push({
      index: phases.length,
      state: { minute: 10 + i * 10, homeScore: 0, awayScore: 0, possession: 'HOME', fieldPosition: 40, phaseInPossession: 0, homeFatigue: 0, awayFatigue: 0, homeMomentum: 0 },
      type: 'OPEN_PLAY',
      outcome: { possessionAfter: 'HOME', metersGained: 5, nextPhase: 'TRY', tryScored: 'HOME', summary: 'essai' },
    });
  }
  for (let i = 0; i < awayTries; i++) {
    phases.push({
      index: phases.length,
      state: { minute: 15 + i * 10, homeScore: 0, awayScore: 0, possession: 'AWAY', fieldPosition: 40, phaseInPossession: 0, homeFatigue: 0, awayFatigue: 0, homeMomentum: 0 },
      type: 'OPEN_PLAY',
      outcome: { possessionAfter: 'AWAY', metersGained: 5, nextPhase: 'TRY', tryScored: 'AWAY', summary: 'essai' },
    });
  }
  return {
    matchId: 'm_test' as MatchId,
    homeScore,
    awayScore,
    phases,
    individualStats: new Map(),
    narrativeSummary: 'test',
    homeSubstitutions: [],
    awaySubstitutions: [],
    uncontestedScrums: false,
    cardsIssued: [],
  };
}

describe('Standings — points et bonus', () => {
  const clubs: readonly ClubId[] = ['a' as ClubId, 'b' as ClubId];
  const match = { round: 1, homeClubId: 'a' as ClubId, awayClubId: 'b' as ClubId };

  it('victoire à domicile : HOME +4, AWAY +0', () => {
    const s = applyMatchToStandings(emptyStandings(clubs), match, makeFakeResult(20, 10, 2, 1));
    expect(s.get('a' as ClubId)?.leaguePoints).toBe(4);
    expect(s.get('b' as ClubId)?.leaguePoints).toBe(0);
  });

  it('match nul : 2-2', () => {
    const s = applyMatchToStandings(emptyStandings(clubs), match, makeFakeResult(15, 15, 2, 2));
    expect(s.get('a' as ClubId)?.leaguePoints).toBe(2);
    expect(s.get('b' as ClubId)?.leaguePoints).toBe(2);
  });

  it('bonus offensif : 4 essais → +1', () => {
    const s = applyMatchToStandings(emptyStandings(clubs), match, makeFakeResult(28, 14, 4, 2));
    expect(s.get('a' as ClubId)?.leaguePoints).toBe(5);   // 4 V + 1 bonus
    expect(s.get('a' as ClubId)?.tryBonus).toBe(1);
  });

  it('bonus défensif : défaite ≤7 pts → +1 pour le perdant', () => {
    const s = applyMatchToStandings(emptyStandings(clubs), match, makeFakeResult(20, 14, 2, 2));
    expect(s.get('a' as ClubId)?.leaguePoints).toBe(4);
    expect(s.get('b' as ClubId)?.leaguePoints).toBe(1);   // bonus défensif
    expect(s.get('b' as ClubId)?.losingBonus).toBe(1);
  });

  it('rankedStandings : tri par points décroissants', () => {
    let s = emptyStandings(['a', 'b', 'c'].map(id => id as ClubId));
    s = applyMatchToStandings(s, { round: 1, homeClubId: 'a' as ClubId, awayClubId: 'b' as ClubId }, makeFakeResult(30, 5, 4, 0));
    s = applyMatchToStandings(s, { round: 2, homeClubId: 'a' as ClubId, awayClubId: 'c' as ClubId }, makeFakeResult(20, 10, 2, 1));
    const ranked = rankedStandings(s);
    expect(ranked[0]?.clubId).toBe('a');
  });
});
