/**
 * Le retrait de points ne détruit plus le classement : v0.60.
 *
 * L'intersaison ne transmet à la session suivante que les clubs frappés d'une
 * sanction, sous la forme d'une ligne de classement à points négatifs. C'est une
 * entrée légitime : « voici les ajustements ». La session la prenait pour la
 * table entière et remplaçait tout le reste.
 *
 * Les conséquences étaient silencieuses puis fatales. `applyMatchToStandings`
 * renonce quand l'un des deux clubs manque au classement : tous les matchs de la
 * saison suivante étaient ignorés sans le moindre message, le classement restait
 * à zéro, et la J27 plantait sur un « top 6 incomplet » au moment de composer
 * les barrages.
 *
 * Déclenchable dès qu'un club écope d'un retrait de points, ce qui arrive vite
 * puisque la récidive DNCG est armée par n'importe quel verdict.
 */

import { describe, expect, it } from 'vitest';
import { createSeasonSession, type SeasonSession } from '@/engine/game/season-session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import type { ClubStanding } from '@/engine/season/standings.js';
import type { MatchInput } from '@/engine/match/types.js';
import type { ClubId, MatchId, Player, PlayerId, Position } from '@/engine/types.js';

const POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

/** Quatorze clubs : assez pour que les phases finales aient un sens. */
const CLUBS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g',
  'h', 'i', 'j', 'k', 'l', 'm', 'n',
].map(id => id as ClubId);

function player(clubId: ClubId, position: Position, i: number): Player {
  const n = 70;
  return {
    id: `${clubId}_${i}` as PlayerId,
    clubId, firstName: 'T', lastName: `P${i}`, birthDate: '1996-01-01',
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

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  const side = (clubId: ClubId) => POSITIONS.map((pos, i) => {
    const p = player(clubId, pos, i);
    playersById.set(p.id, p);
    return { playerId: p.id, position: pos, captainArmband: false };
  });
  const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
  return {
    matchId: `${homeClubId}_${awayClubId}` as MatchId,
    home: { squad: { clubId: homeClubId, starters: side(homeClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    away: { squad: { clubId: awayClubId, starters: side(awayClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    playersById, weather: 'SEC', fieldCondition: 'BON', homeAdvantageBonus: 1, homeFans: 'MOYEN',
  };
}

/** La ligne que l'intersaison transmet pour un club sanctionné. */
const penalite = (clubId: ClubId, points: number): ClubStanding => ({
  clubId,
  played: 0, wins: 0, draws: 0, losses: 0,
  pointsFor: 0, pointsAgainst: 0, tryBonus: 0, losingBonus: 0,
  leaguePoints: -points,
});

function sessionAvecSanction(sanctionnes: readonly ClubStanding[]): SeasonSession {
  return createSeasonSession({
    clubIds: CLUBS,
    playerClubId: 'a' as ClubId,
    seed: 'penalite',
    buildMatchInput: buildInput,
    playerClubRoster: POSITIONS.map((pos, i) => player('a' as ClubId, pos, i)),
    currentSeason: 2026,
    restoreFrom: { currentRound: 1, history: [], standings: sanctionnes },
  });
}

describe('une sanction ne fait pas disparaître les autres clubs', () => {
  it('les quatorze clubs restent au classement', () => {
    const state = sessionAvecSanction([penalite('c' as ClubId, 6)]).getState();
    expect(state.standings.size).toBe(CLUBS.length);
  });

  it('le club sanctionné démarre avec ses points en moins', () => {
    const state = sessionAvecSanction([penalite('c' as ClubId, 6)]).getState();
    expect(state.standings.get('c' as ClubId)?.leaguePoints).toBe(-6);
  });

  it('et les autres démarrent à zéro, pas absents', () => {
    const state = sessionAvecSanction([penalite('c' as ClubId, 6)]).getState();
    for (const clubId of CLUBS) {
      expect(state.standings.get(clubId), clubId as string).toBeDefined();
      if (clubId !== 'c') expect(state.standings.get(clubId)?.leaguePoints).toBe(0);
    }
  });

  it('ignore une sanction visant un club qui n\'est plus dans la division', () => {
    // Une sanction suit un club relégué, elle ne le ramène pas en Top 14.
    const state = sessionAvecSanction([penalite('inconnu' as ClubId, 6)]).getState();
    expect(state.standings.size).toBe(CLUBS.length);
    expect(state.standings.has('inconnu' as ClubId)).toBe(false);
  });
});

describe('la saison suivante se joue vraiment', () => {
  it('les matchs alimentent le classement au lieu d\'être ignorés', () => {
    // Le cœur du défaut : avec un classement amputé, `applyMatchToStandings`
    // renonçait en silence et le championnat restait figé à zéro.
    const session = sessionAvecSanction([penalite('c' as ClubId, 6)]);
    session.simulateOtherMatchesOfRound('test');

    const joues = [...session.getState().standings.values()]
      .reduce((sum, s) => sum + s.played, 0);
    expect(joues).toBeGreaterThan(0);
  });

  it('une saison complète va jusqu\'aux barrages sans planter', () => {
    // Le symptôme final : « top 6 incomplet » à la J27, faute de six clubs
    // classés au moment de composer les phases finales.
    const session = sessionAvecSanction([penalite('c' as ClubId, 6)]);
    let garde = 0;
    while (session.getState().status !== 'finished' && garde++ < 60) {
      const state = session.getState();
      const next = state.playerNextMatch;
      if (!next) { session.skipRound('auto'); continue; }
      const input = buildInput(next.homeClubId, next.awayClubId);
      const result = simulateMatch(input, `r${state.currentRound}`);
      session.simulateOtherMatchesOfRound('test');
      session.commitPlayerMatch(result.homeScore, result.awayScore, result);
    }

    const state = session.getState();
    expect(state.status).toBe('finished');
    expect(state.champion).toBeDefined();
    for (const clubId of CLUBS) {
      expect(state.standings.get(clubId)?.played, clubId as string).toBe(26);
    }
  });
});
