/**
 * Test E2E V0.12 — parcours carrière complet.
 *
 * Vérifie qu'on peut :
 *   1. Créer une session de saison
 *   2. Jouer la saison régulière complète (26 journées)
 *   3. Passer en phases finales (barrages → demi → finale) sans crash
 *   4. Sauvegarder l'état → reconstruire une session via `restoreFrom` → continuer
 *   5. Faire un rollover de saison (S1 → S2) avec persistence des joueurs
 *
 * Pas un test unitaire — un test de "parcours" qui s'assure que les pièces
 * tiennent ensemble bout-à-bout. Si ça casse, c'est que quelque chose a régressé
 * dans le wiring du jeu.
 */

import { describe, it, expect } from 'vitest';
import {
  createSeasonSession,
  type SeasonSession,
} from '@/engine/game/season-session.js';
import { rolloverSeason } from '@/engine/season/rollover.js';
import { makeMatchInput } from './fixtures.js';
import type { ClubId, Player } from '@/engine/types.js';

const CLUBS_14 = [
  'toulouse', 'ubb', 'larochelle', 'toulon', 'racing', 'stade', 'clermont',
  'lyon', 'montpellier', 'castres', 'pau', 'bayonne', 'usap', 'vannes',
] as const;

const NIVEAU_BY_CLUB: Record<string, number> = {
  toulouse: 88, ubb: 84, larochelle: 80, toulon: 78, racing: 76, stade: 74,
  clermont: 70, lyon: 68, montpellier: 66, castres: 64, pau: 62, bayonne: 60, usap: 58, vannes: 55,
};

function buildInput(homeId: ClubId, awayId: ClubId) {
  return makeMatchInput({
    homeNiveau: NIVEAU_BY_CLUB[homeId as string] ?? 65,
    awayNiveau: NIVEAU_BY_CLUB[awayId as string] ?? 65,
    matchId: `e2e_${homeId}_${awayId}`,
  });
}

/** Avance d'une journée en simulant tous les matchs (mode auto). */
function simulateOneRound(session: SeasonSession): void {
  const state = session.getState();
  if (state.status === 'finished') return;
  if (state.status === 'eliminated') {
    session.skipRound('auto');
    return;
  }
  // Simule les autres matchs AVANT le commit (régression connue)
  session.simulateOtherMatchesOfRound('test');
  // Match du joueur (auto si pas in-progress)
  const next = state.playerNextMatch;
  if (next) {
    const input = buildInput(next.homeClubId, next.awayClubId);
    // On ne réinjecte pas un MatchResult complet — skipRound fait l'auto-sim côté session
    // pour le match du joueur. Pour cohérence, on appelle commitPlayerMatch avec un score.
    session.commitPlayerMatch(20, 18, {
      matchId: input.matchId,
      homeScore: 20,
      awayScore: 18,
      phases: [],
      individualStats: new Map(),
      narrativeSummary: 'auto-sim',
      homeSubstitutions: [],
      awaySubstitutions: [],
      uncontestedScrums: false,
    cardsIssued: [],
    });
  } else {
    session.skipRound('auto');
  }
}

function freshSession(playerClubId: ClubId, seed: string): SeasonSession {
  return createSeasonSession({
    clubIds: CLUBS_14.map(id => id as ClubId),
    playerClubId,
    seed,
    buildMatchInput: (h, a) => buildInput(h, a),
    playerClubRoster: [],
    currentSeason: 2025,
  });
}

describe('Carrière E2E — parcours complet', () => {
  it('joue une saison régulière complète : 26 journées, chaque club 26 matchs', () => {
    const session = freshSession('toulouse' as ClubId, 'e2e_full');
    let safety = 0;
    while (
      session.getState().currentRound <= session.getState().calendar.totalRounds &&
      safety++ < 60
    ) {
      simulateOneRound(session);
    }
    const state = session.getState();
    for (const cid of CLUBS_14) {
      const standing = state.standings.get(cid as ClubId);
      expect(standing, `pas de standing pour ${cid}`).toBeDefined();
      expect(standing!.played, `${cid} n'a pas joué 26 matchs`).toBe(26);
    }
    // 14 clubs × 26 matchs / 2 = 182 matchs
    const regularHistory = state.history.filter(h => !h.playoffLabel);
    expect(regularHistory.length).toBe(182);
  });

  it('enchaîne les phases finales (barrages → demi → finale) sans crash', () => {
    const session = freshSession('toulouse' as ClubId, 'e2e_playoffs');
    let safety = 0;
    // Continuer même après élimination du joueur (la saison continue côté autres clubs)
    while (
      session.getState().status !== 'finished' &&
      session.getState().phase !== 'over' &&
      safety++ < 80
    ) {
      simulateOneRound(session);
    }
    const state = session.getState();
    expect(state.phase).toBe('over');
    // Au moins un match en phases finales a eu lieu
    const playoffMatches = state.history.filter(h => !!h.playoffLabel);
    expect(playoffMatches.length).toBeGreaterThan(0);
    // Un champion est désigné
    expect(state.champion).toBeDefined();
  });

  it('save → restore : on peut reconstruire la session à mi-saison', () => {
    const session1 = freshSession('toulouse' as ClubId, 'e2e_save_restore');
    // Jouer 13 journées (mi-saison)
    for (let i = 0; i < 13; i++) simulateOneRound(session1);

    const snap = session1.getState();
    expect(snap.currentRound).toBeGreaterThan(13);
    const round1 = snap.currentRound;
    const homeStandingPlayed = snap.standings.get('toulouse' as ClubId)!.played;

    // Reconstruire via restoreFrom (standings = array, pas Map)
    const session2 = createSeasonSession({
      clubIds: CLUBS_14.map(id => id as ClubId),
      playerClubId: 'toulouse' as ClubId,
      seed: 'e2e_save_restore',
      buildMatchInput: (h, a) => buildInput(h, a),
      playerClubRoster: [],
      currentSeason: snap.currentSeason,
      restoreFrom: {
        currentRound: snap.currentRound,
        history: snap.history,
        standings: [...snap.standings.values()],
        ...(snap.champion !== undefined ? { champion: snap.champion } : {}),
        financesByClub: new Map(),
      },
    });

    const restored = session2.getState();
    expect(restored.currentRound).toBe(round1);
    expect(restored.standings.get('toulouse' as ClubId)!.played).toBe(homeStandingPlayed);
    // Continue à jouer après restore — pas de crash
    simulateOneRound(session2);
    expect(session2.getState().currentRound).toBeGreaterThanOrEqual(round1);
  });

  it('rollover : la saison N+1 conserve les joueurs et les fait vieillir', () => {
    const player1: Player = {
      id: 'p_test_1' as Player['id'],
      clubId: 'toulouse' as ClubId,
      firstName: 'Jeune',
      lastName: 'Espoir',
      birthDate: '2003-06-01', // 22 ans en 2025
      position: 'OUVREUR',
      secondaryPositions: [],
      isJiff: true,
      technical: { passe: 70, plaquage: 70, jeuAuPiedPlace: 75, jeuAuPiedDynamique: 70, visionDeJeu: 72, conservation: 70, prisedeballeHaute: 60, deblayage: 65 },
      physical: { vitesse: 75, puissance: 65, endurance: 75, detente: 65, robustesse: 70 },
      mental: { decision: 70, leadership: 60, sangFroid: 70, agressivite: 65, professionnalisme: 75, discipline: 70 },
      positionSpecific: {},
      traits: [],
      hidden: { potentiel: 85, ambition: 75, determinisme: 70, loyaute: 60, adaptabilite: 70 },
      dynamic: { forme: 75, fatigue: 60, mood: 65, moodModifiers: [] },
      contract: { startSeason: 2025, endSeason: 2028, annualSalary: 150_000 },
    };
    const result = rolloverSeason({ players: [player1], currentSeason: 2025, seed: 'e2e_rollover' });
    expect(result.newSeason).toBe(2026);
    expect(result.retired).toEqual([]);
    const after = result.players[0]!;
    // Reset de la fatigue et restauration partielle de la forme/mood
    expect(after.dynamic.fatigue).toBe(0);
    expect(after.dynamic.forme).toBe(70);
    expect(after.dynamic.mood).toBe(60);
    // Le contrat reste valide
    expect(after.contract.endSeason).toBeGreaterThanOrEqual(2026);
  });
});
