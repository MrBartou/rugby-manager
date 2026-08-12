/**
 * La rivalité de vestiaire, jouée pour de vrai — V0.56.
 *
 * Le module `squad-rivalry` est testé isolément à côté. Ce fichier-ci vérifie
 * l'autre moitié, celle qui a manqué à trois fonctionnalités de suite : que le
 * calcul est **réellement branché** sur une saison qui se joue.
 *
 * Un doublure qui ne joue jamais derrière un titulaire indiscutable doit finir
 * la saison en conflit ouvert avec lui, et le manager doit en être averti — une
 * fois, au moment où ça casse.
 */

import { describe, expect, it } from 'vitest';
import { createSeasonSession } from '@/engine/game/season-session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import { getRelation } from '@/engine/human/relationships.js';
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

// Quatorze clubs, c'est-à-dire vingt-six journées : une rivalité se construit
// sur une saison, une mini-saison de six matchs ne prouverait rien.
const CLUBS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g',
  'h', 'i', 'j', 'k', 'l', 'm', 'n',
].map(id => id as ClubId);
const MON_CLUB = 'a' as ClubId;

function makePlayer(clubId: ClubId, position: Position, idx: number): Player {
  const niveau = 70;
  return {
    id: `${clubId}_${position}_${idx}` as PlayerId,
    clubId,
    firstName: 'Test',
    lastName: `${position}${idx}`,
    birthDate: '1995-01-01',
    position,
    secondaryPositions: [],
    isJiff: true,
    technical: {
      passe: niveau, plaquage: niveau, jeuAuPiedPlace: niveau, jeuAuPiedDynamique: niveau,
      visionDeJeu: niveau, conservation: niveau, prisedeballeHaute: niveau, deblayage: niveau,
    },
    physical: { vitesse: niveau, puissance: niveau, endurance: niveau, detente: niveau, robustesse: niveau },
    mental: {
      decision: niveau, leadership: niveau, sangFroid: niveau, agressivite: niveau,
      professionnalisme: niveau, discipline: niveau,
    },
    positionSpecific: { pousseeMelee: niveau },
    traits: [],
    hidden: { potentiel: niveau, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

/** Le XV titulaire du club dirigé, plus une doublure à l'ouverture. */
const TITULAIRES: readonly Player[] = POSITIONS.map((pos, i) => makePlayer(MON_CLUB, pos, i));
const DOUBLURE: Player = makePlayer(MON_CLUB, 'OUVREUR', 99);
const MON_EFFECTIF: readonly Player[] = [...TITULAIRES, DOUBLURE];
const OUVREUR_TITULAIRE = TITULAIRES.find(p => p.position === 'OUVREUR')!;

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();

  const side = (clubId: ClubId) => {
    const roster = clubId === MON_CLUB
      ? TITULAIRES
      : POSITIONS.map((pos, i) => makePlayer(clubId, pos, i));
    for (const p of roster) playersById.set(p.id, p);
    return roster.map(p => ({
      playerId: p.id,
      position: p.position,
      captainArmband: p.position === 'OUVREUR',
    }));
  };

  const homeStarters = side(homeClubId);
  const awayStarters = side(awayClubId);
  // La doublure existe à l'effectif, elle n'est jamais sur la feuille.
  playersById.set(DOUBLURE.id, DOUBLURE);

  const plan = {
    occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'],
  } as const;

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

describe('une doublure laissée sur le banc toute la saison', () => {
  function playSeason() {
    const session = createSeasonSession({
      clubIds: CLUBS,
      playerClubId: MON_CLUB,
      seed: 'rivalite_flow',
      buildMatchInput: (h, a) => buildInput(h, a),
      playerClubRoster: MON_EFFECTIF,
      currentSeason: 2025,
    });

    const flares: string[] = [];
    let safety = 0;
    while (
      session.getState().status === 'in-progress'
      && session.getState().currentRound <= session.getState().calendar.totalRounds
      && safety++ < 60
    ) {
      const state = session.getState();
      const next = state.playerNextMatch;
      if (!next) break;
      const input = buildInput(next.homeClubId, next.awayClubId);
      const result = simulateMatch(input, `r${state.currentRound}`);
      const starters = next.homeClubId === MON_CLUB ? input.home.squad.starters : input.away.squad.starters;
      session.simulateOtherMatchesOfRound('test');
      session.commitPlayerMatch(
        result.homeScore, result.awayScore, result, starters.map(s => s.playerId),
      );
      for (const f of session.getState().latestRivalries) {
        flares.push(`${String(f.frustrated)}>${String(f.ahead)}`);
      }
    }
    return { session, flares };
  }

  it('finit en conflit ouvert avec celui qui lui passe devant', () => {
    const { session } = playSeason();
    const rel = getRelation(session.getState().relations, DOUBLURE.id, OUVREUR_TITULAIRE.id);
    expect(rel.type).toBe('CONFLIT');
    expect(rel.lastReason).toContain('Concurrence au poste');
  });

  it('et le manager en est averti, une seule fois', () => {
    const { flares } = playSeason();
    const mien = flares.filter(f => f === `${String(DOUBLURE.id)}>${String(OUVREUR_TITULAIRE.id)}`);
    expect(mien).toHaveLength(1);
  });

  it('même sur une partie rechargée en cours de saison', () => {
    // Régression : le dénominateur du temps de jeu venait de `history`, qui est
    // restauré, tandis que le numérateur vient des statistiques individuelles,
    // qui ne le sont pas. Un effectif rechargé à la vingtième journée affichait
    // donc tout le monde à un ratio proche de zéro — plus aucun écart, plus
    // aucune tension. Le système entier était sans effet sur une partie
    // reprise, c'est-à-dire dans le cas le plus courant.
    const history = Array.from({ length: 19 }, (_, i) => ({
      round: i + 1,
      homeClubId: MON_CLUB,
      awayClubId: CLUBS[1]!,
      homeScore: 20,
      awayScore: 15,
      playerPlayed: true,
    }));

    const session = createSeasonSession({
      clubIds: CLUBS,
      playerClubId: MON_CLUB,
      seed: 'rivalite_reprise',
      buildMatchInput: (h, a) => buildInput(h, a),
      playerClubRoster: MON_EFFECTIF,
      currentSeason: 2025,
      restoreFrom: { currentRound: 20, history, standings: [] },
    });

    for (let i = 0; i < 4; i++) {
      const state = session.getState();
      const next = state.playerNextMatch;
      if (!next) break;
      const input = buildInput(next.homeClubId, next.awayClubId);
      const result = simulateMatch(input, `reprise${state.currentRound}`);
      const starters = next.homeClubId === MON_CLUB ? input.home.squad.starters : input.away.squad.starters;
      session.simulateOtherMatchesOfRound('test');
      session.commitPlayerMatch(
        result.homeScore, result.awayScore, result, starters.map(s => s.playerId),
      );
    }

    const rel = getRelation(session.getState().relations, DOUBLURE.id, OUVREUR_TITULAIRE.id);
    expect(rel.lastReason).toContain('Concurrence au poste');
  });

  it('sans brouiller ceux qui jouent ensemble', () => {
    // La concurrence ne touche que le poste concerné : le reste du XV se
    // rapproche en jouant, comme depuis la V0.4.
    const { session } = playSeason();
    const relations = session.getState().relations;
    const pilier = TITULAIRES.find(p => p.position === 'PILIER_GAUCHE')!;
    const centre = TITULAIRES.find(p => p.position === 'CENTRE_INTERIEUR')!;
    expect(getRelation(relations, pilier.id, centre.id).score).toBeGreaterThan(0);
  });
});
