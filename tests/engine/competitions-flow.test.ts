/**
 * Tests d'intégration des compétitions — V0.13.
 *
 * Ce qui est vérifié ici n'est pas la coupe d'Europe en elle-même (couverte par
 * `european-cup.test.ts`) mais **l'effet qu'elle produit sur la gestion d'effectif** :
 * une semaine double doit réellement coûter, sinon la seconde compétition n'apporte
 * aucune décision au joueur.
 */

import { describe, expect, it } from 'vitest';
import { createSeasonSession, type SeasonSession } from '@/engine/game/season-session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import { EUROPEAN_ROUNDS } from '@/engine/season/european-cup.js';
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

function makePlayer(clubId: ClubId, position: Position, idx: number, niveau: number): Player {
  return {
    id: `${clubId}_${position}_${idx}` as PlayerId,
    clubId,
    firstName: 'Test',
    lastName: `${position}${idx}`,
    birthDate: '1995-01-01',
    position,
    secondaryPositions: [],
    isJiff: true,
    technical: { passe: niveau, plaquage: niveau, jeuAuPiedPlace: niveau, jeuAuPiedDynamique: niveau, visionDeJeu: niveau, conservation: niveau, prisedeballeHaute: niveau, deblayage: niveau },
    physical: { vitesse: niveau, puissance: niveau, endurance: niveau, detente: niveau, robustesse: niveau },
    mental: { decision: niveau, leadership: niveau, sangFroid: niveau, agressivite: niveau, professionnalisme: niveau, discipline: niveau },
    positionSpecific: { pousseeMelee: niveau },
    traits: [],
    hidden: { potentiel: niveau, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

function rosterFor(clubId: ClubId, niveau: number): Player[] {
  // 15 titulaires + 8 doublures, pour permettre une vraie rotation.
  const out: Player[] = [];
  for (let i = 0; i < POSITIONS.length; i++) out.push(makePlayer(clubId, POSITIONS[i]!, i, niveau));
  for (let i = 0; i < 8; i++) out.push(makePlayer(clubId, POSITIONS[i]!, 100 + i, niveau - 5));
  return out;
}

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  const starters = (clubId: ClubId) =>
    POSITIONS.map((pos, i) => {
      const p = makePlayer(clubId, pos, i, 60);
      playersById.set(p.id, p);
      return { playerId: p.id, position: pos, captainArmband: pos === 'OUVREUR' };
    });
  const homeStarters = starters(homeClubId);
  const awayStarters = starters(awayClubId);
  const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
  return {
    matchId: `${homeClubId}_${awayClubId}` as MatchId,
    home: { squad: { clubId: homeClubId, starters: homeStarters, substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    away: { squad: { clubId: awayClubId, starters: awayStarters, substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    playersById,
    weather: 'SEC',
    fieldCondition: 'BON',
    homeAdvantageBonus: 1.0,
    homeFans: 'BEAUCOUP',
  };
}

const CLUBS = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => id as ClubId);
const PLAYER_CLUB = 'a' as ClubId;

function makeSession(previousSeasonRank?: number): SeasonSession {
  return createSeasonSession({
    clubIds: CLUBS,
    playerClubId: PLAYER_CLUB,
    seed: 'comp_test',
    buildMatchInput: buildInput,
    playerClubRoster: rosterFor(PLAYER_CLUB, 60),
    currentSeason: 2026,
    ...(previousSeasonRank !== undefined ? { previousSeasonRank } : {}),
  });
}

/** Avance d'une journée de championnat. */
function playLeagueRound(session: SeasonSession): void {
  const state = session.getState();
  if (state.status !== 'in-progress') return;
  const next = state.playerNextMatch;
  if (!next) {
    session.skipRound('auto');
    return;
  }
  const input = buildInput(next.homeClubId, next.awayClubId);
  const result = simulateMatch(input, `r${state.currentRound}`);
  session.simulateOtherMatchesOfRound('test');
  session.commitPlayerMatch(result.homeScore, result.awayScore, result);
}

// =============================================================================

describe('qualification européenne dans la session', () => {
  it('un club sans classement précédent ne dispute pas de coupe', () => {
    expect(makeSession().getState().europeanCampaign).toBeUndefined();
  });

  it('un club bien classé hérite d\'une campagne de coupe majeure', () => {
    const campaign = makeSession(2).getState().europeanCampaign;
    expect(campaign?.competition).toBe('CHAMPIONS_CUP');
    expect(campaign?.fixtures).toHaveLength(4);
  });

  it('un club de milieu de tableau hérite du Challenge', () => {
    expect(makeSession(8).getState().europeanCampaign?.competition).toBe('CHALLENGE_CUP');
  });

  it('un club de bas de tableau n\'a pas de campagne', () => {
    expect(makeSession(13).getState().europeanCampaign).toBeUndefined();
  });
});

describe('semaines doubles', () => {
  it('un match européen apparaît sur les journées prévues', () => {
    const session = makeSession(2);
    const seen: number[] = [];
    for (let i = 0; i < EUROPEAN_ROUNDS[EUROPEAN_ROUNDS.length - 1]!; i++) {
      const state = session.getState();
      if (state.europeanFixture) seen.push(state.currentRound);
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const round of seen) expect(EUROPEAN_ROUNDS).toContain(round);
  });

  it('le match européen ne fait pas avancer la journée de championnat', () => {
    const session = makeSession(2);
    while (session.getState().currentRound < EUROPEAN_ROUNDS[0]!) {
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }
    const before = session.getState().currentRound;
    session.commitEuropeanMatch(28, 15);
    expect(session.getState().currentRound).toBe(before);
  });

  it('un match européen non disputé est résolu d\'office, jamais perdu', () => {
    // Régression : le joueur qui simule sa journée sans jouer sa coupe voyait le
    // match disparaître du calendrier. Un club ne peut pas déclarer forfait.
    const session = makeSession(2);
    for (let i = 0; i < 12; i++) {
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }
    const campaign = session.getState().europeanCampaign!;
    const playedRounds = campaign.results.filter(r => r.stage === 'POOL').map(r => r.round);
    const dueRounds = EUROPEAN_ROUNDS.filter(r => r < session.getState().currentRound);

    expect(dueRounds.length).toBeGreaterThan(0);
    for (const round of dueRounds) expect(playedRounds).toContain(round);
  });

  it('un match européen résolu d\'office fatigue quand même l\'effectif', () => {
    const session = makeSession(2);
    while (session.getState().currentRound < EUROPEAN_ROUNDS[0]!) {
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }
    const before = session.getState().playerClubRoster
      .reduce((a, p) => a + p.dynamic.fatigue, 0);

    playLeagueRound(session);   // passe la journée sans jouer la coupe

    const after = session.getState().playerClubRoster
      .reduce((a, p) => a + p.dynamic.fatigue, 0);
    expect(after).toBeGreaterThan(before);
  });

  it('un même match européen n\'est pas jouable deux fois', () => {
    const session = makeSession(2);
    while (session.getState().currentRound < EUROPEAN_ROUNDS[0]!) {
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }
    session.commitEuropeanMatch(28, 15);
    expect(session.getState().europeanFixture).toBeUndefined();
    expect(session.getState().europeanCampaign?.results).toHaveLength(1);
  });
});

describe('coût de la rotation', () => {
  it('aligner ses cadres en coupe les fatigue pour le championnat', () => {
    const session = makeSession(2);
    while (session.getState().currentRound < EUROPEAN_ROUNDS[0]!) {
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }

    const roster = session.getState().playerClubRoster;
    const cadres = roster.slice(0, 15).map(p => p.id);
    const fatigueBefore = new Map(roster.map(p => [p.id, p.dynamic.fatigue]));

    session.commitEuropeanMatch(28, 15, cadres, []);

    const after = session.getState().playerClubRoster;
    // Les joueurs alignés sont plus fatigués…
    for (const id of cadres) {
      const p = after.find(x => x.id === id)!;
      if (p.dynamic.injury) continue;
      expect(p.dynamic.fatigue).toBeGreaterThan(fatigueBefore.get(id)!);
    }
    // …et ceux laissés au repos récupèrent.
    const reposes = after.filter(p => !cadres.includes(p.id) && !p.dynamic.injury);
    expect(reposes.length).toBeGreaterThan(0);
    for (const p of reposes) {
      expect(p.dynamic.fatigue).toBeLessThanOrEqual(fatigueBefore.get(p.id)!);
    }
  });

  it('faire tourner épargne les cadres', () => {
    const build = () => {
      const session = makeSession(2);
      while (session.getState().currentRound < EUROPEAN_ROUNDS[0]!) {
        playLeagueRound(session);
        if (session.getState().status !== 'in-progress') break;
      }
      return session;
    };

    const roster = build().getState().playerClubRoster;
    const cadreId = roster[0]!.id;

    const avecCadres = build();
    avecCadres.commitEuropeanMatch(28, 15, roster.slice(0, 15).map(p => p.id), []);

    const avecRotation = build();
    avecRotation.commitEuropeanMatch(20, 22, roster.slice(8, 23).map(p => p.id), []);

    const fatigueTitulaire = avecCacheFatigue(avecCadres, cadreId);
    const fatigueRepos = avecCacheFatigue(avecRotation, cadreId);
    expect(fatigueRepos).toBeLessThan(fatigueTitulaire);
  });
});

function avecCacheFatigue(session: SeasonSession, playerId: PlayerId): number {
  return session.getState().playerClubRoster.find(p => p.id === playerId)!.dynamic.fatigue;
}

describe('bilan européen et relégation', () => {
  it('expose un résumé de campagne lisible', () => {
    const session = makeSession(2);
    expect(session.getEuropeanSummary()).toContain('Coupe d\'Europe');
  });

  it('ne renvoie pas de bilan pour un club non qualifié', () => {
    expect(makeSession(13).getEuropeanSummary()).toBeUndefined();
    expect(makeSession(13).getPoolOutcome()).toBeUndefined();
  });

  it('expose le statut de relégation du club joueur', () => {
    const status = makeSession(2).getState().relegationStatus;
    expect(['SAFE', 'BARRAGE', 'RELEGATED']).toContain(status);
  });

  it('résout descentes et montées en fin de saison', () => {
    const session = makeSession(2);
    const res = session.resolveSeasonRelegation(() => 55);
    expect(res.promoted.length).toBe(res.relegated.length);
  });
});
