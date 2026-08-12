/**
 * Tests V0.9 phase 1 — records & palmarès.
 */

import { describe, it, expect } from 'vitest';
import {
  appendSeason,
  clubPalmares,
  EMPTY_HISTORY,
} from '@/engine/season/records.js';
import type { ClubId } from '@/engine/types.js';

describe('clubPalmares', () => {
  it('compte championships et finals lost', () => {
    let h = EMPTY_HISTORY;
    h = appendSeason(h, {
      seasonStart: 2025, champion: 'A' as ClubId, runnerUp: 'B' as ClubId,
      playerClubFinalRank: 1, playerClubReachedFinal: true, playerClubChampion: true,
    });
    h = appendSeason(h, {
      seasonStart: 2026, champion: 'C' as ClubId, runnerUp: 'A' as ClubId,
      playerClubFinalRank: 2, playerClubReachedFinal: true, playerClubChampion: false,
    });
    h = appendSeason(h, {
      seasonStart: 2027, champion: 'A' as ClubId, runnerUp: 'D' as ClubId,
      playerClubFinalRank: 1, playerClubReachedFinal: true, playerClubChampion: true,
    });
    const palm = clubPalmares(h, 'A' as ClubId);
    expect(palm.championships).toBe(2);
    expect(palm.finalsLost).toBe(1);
    expect(palm.seasonsPlayed).toBe(3);
  });
});

/* V0.59 — les cumuls joueurs et `topScorersForClub` ont quitté ce module :
   ils vivaient à côté du registre de carrière, qui garde désormais le détail
   saison par saison. Voir `player-career.test.ts`. */
