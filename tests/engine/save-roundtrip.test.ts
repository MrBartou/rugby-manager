/**
 * Aller-retour de sauvegarde — V0.31.
 *
 * Trois chantiers livrés vivaient uniquement en mémoire : les focus
 * d'entraînement (V0.14), la connaissance du scouting (V0.15) et les délais
 * après refus d'offre (V0.28). Recharger une partie les effaçait — au point
 * qu'il suffisait de sauvegarder puis recharger pour reproposer une offre qu'un
 * joueur venait de décliner.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSeasonSaveFromState,
  migrateSave,
  SEASON_SCHEMA_VERSION,
} from '@/data/season-save-repository.js';
import { createSeasonSession, type SeasonSession } from '@/engine/game/season-session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import type { MatchInput } from '@/engine/match/types.js';
import type { Club, ClubId, MatchId, Player, PlayerId, Position } from '@/engine/types.js';

const POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

const CLUBS = ['a', 'b', 'c', 'd'].map(id => id as ClubId);

function makePlayer(clubId: ClubId, position: Position, idx: number): Player {
  const n = 70;
  return {
    id: `${clubId}_${position}_${idx}` as PlayerId,
    clubId, firstName: 'Test', lastName: `P${idx}`, birthDate: '1996-01-01',
    position, secondaryPositions: [], isJiff: true,
    technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
    physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
    mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
    positionSpecific: { pousseeMelee: n },
    traits: [],
    hidden: { potentiel: n, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2028, annualSalary: 100_000 },
  };
}

function rosterFor(clubId: ClubId): readonly Player[] {
  return POSITIONS.flatMap((pos, i) => [makePlayer(clubId, pos, i), makePlayer(clubId, pos, i + 100)]);
}

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  const starters = (clubId: ClubId) => POSITIONS.map((pos, i) => {
    const p = makePlayer(clubId, pos, i);
    playersById.set(p.id, p);
    return { playerId: p.id, position: pos, captainArmband: pos === 'OUVREUR' };
  });
  return {
    matchId: `${homeClubId}_${awayClubId}` as MatchId,
    home: { squad: { clubId: homeClubId, starters: starters(homeClubId), substitutes: [] }, tacticalPlan: { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] }, liveMoments: [] },
    away: { squad: { clubId: awayClubId, starters: starters(awayClubId), substitutes: [] }, tacticalPlan: { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] }, liveMoments: [] },
    playersById, weather: 'SEC', fieldCondition: 'BON', homeAdvantageBonus: 1, homeFans: 'BEAUCOUP',
  };
}

function club(id: ClubId): Club {
  return {
    id, name: `Club ${id}`, shortName: (id as string).toUpperCase(), city: 'Ville',
    tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: 30_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 60,
  };
}

function makeSession(restore?: Parameters<typeof createSeasonSession>[0]['restoreFrom']): SeasonSession {
  return createSeasonSession({
    clubIds: CLUBS,
    playerClubId: 'a' as ClubId,
    seed: 'roundtrip',
    buildMatchInput: buildInput,
    playerClubRoster: rosterFor('a' as ClubId),
    currentSeason: 2025,
    allClubs: CLUBS.map(club),
    rosterByClub: rosterFor,
    ...(restore ? { restoreFrom: restore } : {}),
  });
}

/** Rejoue le trajet complet : session → sauvegarde → JSON → session. */
function roundTrip(session: SeasonSession): SeasonSession {
  const save = buildSeasonSaveFromState(
    'sid', session.getState(), 'roundtrip', CLUBS, 'Test', [],
  );
  // Le passage par JSON compte : une Map non sérialisée survivrait en mémoire
  // mais serait perdue dans le vrai stockage.
  const reloaded = migrateSave(JSON.parse(JSON.stringify(save)));

  return makeSession({
    currentRound: reloaded.currentRound,
    history: reloaded.history,
    standings: reloaded.standings,
    ...(reloaded.trainingByPlayer
      ? { trainingByPlayer: new Map(reloaded.trainingByPlayer.map(e => [e.playerId, e.focus])) }
      : {}),
    ...(reloaded.scouting
      ? {
        scouting: {
          knowledge: new Map(reloaded.scouting.knowledge.map(e => [e.playerId, e.knowledge])),
          assignments: reloaded.scouting.assignments,
        },
      }
      : {}),
    ...(reloaded.bidCooldowns
      ? { bidCooldowns: new Map(reloaded.bidCooldowns.map(e => [e.playerId, e.untilRound])) }
      : {}),
    ...(reloaded.playerStats
      ? { playerStats: new Map(reloaded.playerStats.map(e => [e.playerId, e.stat])) }
      : {}),
    ...(reloaded.statsMatchCount !== undefined
      ? { statsMatchCount: reloaded.statsMatchCount }
      : {}),
  });
}

describe('sauvegarde — ce qui doit survivre au rechargement', () => {
  it('conserve les focus d\'entraînement', () => {
    const session = makeSession();
    const cible = session.getState().playerClubRoster[0]!.id;
    session.setTrainingFocusForAll('PHYSIQUE');
    session.setTrainingFocus(cible, 'RECUPERATION');

    const after = roundTrip(session).getState().trainingByPlayer;
    expect(after.get(cible)).toBe('RECUPERATION');
    const autre = session.getState().playerClubRoster[1]!.id;
    expect(after.get(autre)).toBe('PHYSIQUE');
  });

  it('conserve la connaissance du scouting et les missions en cours', () => {
    const session = makeSession();
    const cible = rosterFor('b' as ClubId)[0]!.id;
    session.assignScout(cible);

    const avant = session.getState().scouting;
    const après = roundTrip(session).getState().scouting;

    expect(après.assignments).toContain(cible);
    expect(après.knowledge.size).toBe(avant.knowledge.size);
    for (const [id, k] of avant.knowledge) {
      expect(après.knowledge.get(id)?.familiarity).toBe(k.familiarity);
    }
  });

  it('conserve les délais après refus d\'offre', () => {
    const session = makeSession();
    const cible = rosterFor('b' as ClubId)[0]!;

    // Offre dérisoire : refus du club et pose d'un délai.
    const outcome = session.submitBid(cible, { fee: 1000, annualSalary: 150_000, years: 3 });
    expect(outcome.kind).toBe('REFUSED');
    expect(session.previewBid(cible).cooldownRounds).toBeGreaterThan(0);

    // Sans persistance, recharger suffisait à reproposer immédiatement.
    const rechargée = roundTrip(session);
    expect(rechargée.previewBid(cible).cooldownRounds).toBeGreaterThan(0);
    expect(rechargée.submitBid(cible, { fee: 1000, annualSalary: 150_000, years: 3 }).kind).toBe('BLOCKED');
  });

  it('conserve les statistiques de la saison en cours', () => {
    // V0.58 — elles repartaient de zéro à chaque chargement. Le classement des
    // marqueurs se vidait, le développement des jeunes perdait les minutes qui
    // le pilotent, et les honneurs jugeaient sur une demi-saison.
    const session = makeSession();
    const next = session.getState().playerNextMatch!;
    const input = buildInput(next.homeClubId, next.awayClubId);
    const result = simulateMatch(input, 'stats');
    const starters = (next.homeClubId === 'a' ? input.home : input.away).squad.starters;
    session.simulateOtherMatchesOfRound('test');
    session.commitPlayerMatch(
      result.homeScore, result.awayScore, result, starters.map(s => s.playerId),
    );

    const avant = session.getState().seasonPlayerStats;
    const unTitulaire = starters[0]!.playerId;
    expect(avant.get(unTitulaire)?.matches).toBe(1);

    const après = roundTrip(session).getState();
    expect(après.seasonPlayerStats.get(unTitulaire)?.matches).toBe(1);
    expect(après.seasonPlayerStats.get(unTitulaire)?.minutes)
      .toBe(avant.get(unTitulaire)?.minutes);
    // Le dénominateur suit le numérateur : restaurer l'un sans l'autre ferait
    // passer tout l'effectif pour remplaçant.
    expect(après.statsMatchCount).toBe(1);
  });

  it('accepte une sauvegarde antérieure sans ces champs', () => {
    const save = buildSeasonSaveFromState(
      'sid', makeSession().getState(), 'roundtrip', CLUBS, 'Test', [],
    );
    const ancien = { ...save, schemaVersion: '0.4.0' } as Record<string, unknown>;
    delete ancien.trainingByPlayer;
    delete ancien.scouting;
    delete ancien.bidCooldowns;
    delete ancien.playerStats;
    delete ancien.statsMatchCount;

    const migré = migrateSave(ancien);
    expect(migré.schemaVersion).toBe(SEASON_SCHEMA_VERSION);
    expect(migré.trainingByPlayer).toBeUndefined();
    // Et la session repart proprement de ses valeurs par défaut.
    expect(() => makeSession({
      currentRound: migré.currentRound,
      history: migré.history,
      standings: migré.standings,
    })).not.toThrow();
  });
});
