/**
 * Classement Top 14 — V0.3.
 *
 * Référence : règle Top 14 actuelle :
 *   - Victoire : 4 points
 *   - Match nul : 2 points
 *   - Défaite : 0 point
 *   - Bonus offensif : +1 si 4+ essais marqués
 *   - Bonus défensif : +1 si défaite de 7 points ou moins
 */

import type { ClubId } from '../types.js';
import type { ScheduledMatch } from './calendar.js';
import type { MatchResult } from '../match/types.js';

export interface ClubStanding {
  readonly clubId: ClubId;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly tryBonus: number;          // matchs avec bonus offensif
  readonly losingBonus: number;       // matchs avec bonus défensif
  readonly leaguePoints: number;
}

export type Standings = ReadonlyMap<ClubId, ClubStanding>;

export function emptyStandings(clubIds: readonly ClubId[]): Standings {
  const m = new Map<ClubId, ClubStanding>();
  for (const id of clubIds) {
    m.set(id, {
      clubId: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      tryBonus: 0,
      losingBonus: 0,
      leaguePoints: 0,
    });
  }
  return m;
}

/**
 * Met à jour le classement après un match.
 *
 * Convention :
 *   - `match.homeClubId` reçoit
 *   - `result.homeScore` / `result.awayScore` sont du POV du moteur (HOME / AWAY = receveur / visiteur)
 */
export function applyMatchToStandings(
  current: Standings,
  match: ScheduledMatch,
  result: MatchResult,
): Standings {
  const homeTries = result.phases.filter(p => p.outcome.tryScored === 'HOME').length;
  const awayTries = result.phases.filter(p => p.outcome.tryScored === 'AWAY').length;

  const homeWon = result.homeScore > result.awayScore;
  const awayWon = result.awayScore > result.homeScore;
  const draw = result.homeScore === result.awayScore;

  const margin = Math.abs(result.homeScore - result.awayScore);

  // Points de base
  let homePoints = homeWon ? 4 : draw ? 2 : 0;
  let awayPoints = awayWon ? 4 : draw ? 2 : 0;

  // Bonus offensif (4+ essais marqués)
  let homeTryBonusGained = 0;
  let awayTryBonusGained = 0;
  if (homeTries >= 4) { homePoints += 1; homeTryBonusGained = 1; }
  if (awayTries >= 4) { awayPoints += 1; awayTryBonusGained = 1; }

  // Bonus défensif (perdre de 7 ou moins)
  let homeLosingBonusGained = 0;
  let awayLosingBonusGained = 0;
  if (!draw && margin <= 7) {
    if (homeWon) { awayPoints += 1; awayLosingBonusGained = 1; }
    else { homePoints += 1; homeLosingBonusGained = 1; }
  }

  const out = new Map(current);
  const home = current.get(match.homeClubId);
  const away = current.get(match.awayClubId);
  if (!home || !away) return current;

  out.set(match.homeClubId, {
    ...home,
    played: home.played + 1,
    wins: home.wins + (homeWon ? 1 : 0),
    draws: home.draws + (draw ? 1 : 0),
    losses: home.losses + (awayWon ? 1 : 0),
    pointsFor: home.pointsFor + result.homeScore,
    pointsAgainst: home.pointsAgainst + result.awayScore,
    tryBonus: home.tryBonus + homeTryBonusGained,
    losingBonus: home.losingBonus + homeLosingBonusGained,
    leaguePoints: home.leaguePoints + homePoints,
  });
  out.set(match.awayClubId, {
    ...away,
    played: away.played + 1,
    wins: away.wins + (awayWon ? 1 : 0),
    draws: away.draws + (draw ? 1 : 0),
    losses: away.losses + (homeWon ? 1 : 0),
    pointsFor: away.pointsFor + result.awayScore,
    pointsAgainst: away.pointsAgainst + result.homeScore,
    tryBonus: away.tryBonus + awayTryBonusGained,
    losingBonus: away.losingBonus + awayLosingBonusGained,
    leaguePoints: away.leaguePoints + awayPoints,
  });

  return out;
}

/** Trie les clubs par leaguePoints décroissant, tie-break par différence de points. */
export function rankedStandings(standings: Standings): readonly ClubStanding[] {
  return [...standings.values()].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.pointsFor - a.pointsFor;
  });
}
