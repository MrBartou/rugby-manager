/**
 * Tests V0.6 phase 1 — migration des saves 0.3.0 → 0.4.0.
 *
 * On teste uniquement la fonction pure migrateSave (pas le repository
 * localStorage, qui demande un environnement DOM).
 */

import { describe, it, expect } from 'vitest';
import { migrateSave, SEASON_SCHEMA_VERSION } from '@/data/season-save-repository.js';

describe('migrateSave', () => {
  it('migre un save 0.3.0 vers 0.4.0 avec defaults', () => {
    const v030 = {
      saveId: 'season_old',
      displayName: 'Toulouse — J12',
      savedAt: '2025-01-01T00:00:00.000Z',
      schemaVersion: '0.3.0',
      playerClubId: 'toulouse',
      seed: 'abc',
      currentRound: 12,
      playerRank: 3,
      playerLeaguePoints: 38,
      history: [],
      standings: [],
      clubIds: ['toulouse', 'ubb'],
    };
    const migrated = migrateSave(v030);
    expect(migrated.schemaVersion).toBe(SEASON_SCHEMA_VERSION);
    expect(migrated.currentSeason).toBe(2025);
    expect(migrated.playerOverrides).toEqual([]);
    // Champs préservés
    expect(migrated.saveId).toBe('season_old');
    expect(migrated.currentRound).toBe(12);
    expect(migrated.playerRank).toBe(3);
  });

  it('un save 0.4.0 antérieur à V0.9 reçoit les champs manquants (careerHistory, reputation, etc.)', () => {
    const v040 = {
      saveId: 'season_new',
      displayName: 'UBB — J5',
      savedAt: '2025-02-01T00:00:00.000Z',
      schemaVersion: SEASON_SCHEMA_VERSION,
      playerClubId: 'ubb',
      seed: 'xyz',
      currentRound: 5,
      currentSeason: 2026,
      playerRank: 1,
      playerLeaguePoints: 18,
      history: [],
      standings: [],
      clubIds: ['ubb'],
      playerOverrides: [],
      financesByClub: [],
    };
    const migrated = migrateSave(v040);
    expect(migrated.currentSeason).toBe(2026);
    // V0.59 — l'historique ne porte plus les cumuls joueurs : ils vivent dans
    // le registre de carrière, repris séparément au chargement.
    expect(migrated.careerHistory).toEqual({ seasons: [] });
    expect(migrated.managerReputation).toEqual({ score: 30, titlesWon: 0, seasonsManaged: 0 });
    expect(migrated.objective).toBeDefined();
    expect(migrated.boardConfidence).toBeDefined();
  });

  it('migre un save sans schemaVersion (très anciens)', () => {
    const legacy = {
      saveId: 'legacy',
      playerClubId: 'toulouse',
      seed: 'old',
      currentRound: 1,
      history: [],
      standings: [],
      clubIds: [],
    };
    const migrated = migrateSave(legacy);
    expect(migrated.schemaVersion).toBe(SEASON_SCHEMA_VERSION);
    expect(migrated.currentSeason).toBe(2025);
    expect(migrated.playerOverrides).toEqual([]);
  });
});
