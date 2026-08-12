/**
 * La Pro D2 à seize clubs — V0.56.
 *
 * La deuxième division se jouait depuis la V0.44, mais avec quatorze clubs et
 * vingt-six journées, c'est-à-dire au format du Top 14. La vraie en compte
 * seize et en joue trente.
 *
 * Ce n'est pas qu'une question d'exactitude : les numéros de phases finales
 * étaient figés à 27, 28 et 29 — les trois journées qui suivent un Top 14. Sur
 * un championnat de trente journées, ils tombaient **au milieu** de la saison
 * régulière, et une Pro D2 se serait terminée sans barrages ni champion.
 */

import { describe, expect, it } from 'vitest';
import {
  PRO_D2_CLUBS,
  TOP14_CLUBS,
  buildProD2Clubs,
} from '../../src/engine/season/divisions.js';
import {
  PLAYOFF_ROUNDS,
  generateRoundRobinCalendar,
  isPlayoffRound,
  playoffRoundsAfter,
} from '../../src/engine/season/calendar.js';
import { createSeasonSession } from '../../src/engine/game/season-session.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import type { MatchInput } from '../../src/engine/match/types.js';
import type { ClubId, MatchId, Player, PlayerId, Position } from '../../src/engine/types.js';

const POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

const PROD2 = buildProD2Clubs();

function makePlayer(clubId: ClubId, position: Position, idx: number): Player {
  const n = 60;
  return {
    id: `${clubId}_${position}_${idx}` as PlayerId,
    clubId, firstName: 'Test', lastName: `${position}${idx}`, birthDate: '1996-01-01',
    position, secondaryPositions: [], isJiff: true,
    technical: {
      passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n,
      visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n,
    },
    physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
    mental: {
      decision: n, leadership: n, sangFroid: n, agressivite: n,
      professionnalisme: n, discipline: n,
    },
    positionSpecific: { pousseeMelee: n },
    traits: [],
    hidden: { potentiel: n, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 60_000 },
  };
}

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  const side = (clubId: ClubId) => POSITIONS.map((pos, i) => {
    const p = makePlayer(clubId, pos, i);
    playersById.set(p.id, p);
    return { playerId: p.id, position: pos, captainArmband: pos === 'OUVREUR' };
  });
  const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
  return {
    matchId: `${homeClubId}_${awayClubId}` as MatchId,
    home: { squad: { clubId: homeClubId, starters: side(homeClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    away: { squad: { clubId: awayClubId, starters: side(awayClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    playersById,
    weather: 'SEC',
    fieldCondition: 'BON',
    homeAdvantageBonus: 1.0,
    homeFans: 'BEAUCOUP',
  };
}

describe('le calendrier suit le nombre de clubs', () => {
  it('seize clubs font trente journées', () => {
    const cal = generateRoundRobinCalendar(PROD2.map(c => c.id));
    expect(PROD2).toHaveLength(PRO_D2_CLUBS);
    expect(cal.totalRounds).toBe(30);
  });

  it('quatorze en font toujours vingt-six', () => {
    const top14 = Array.from({ length: TOP14_CLUBS }, (_, i) => `t${i}` as ClubId);
    expect(generateRoundRobinCalendar(top14).totalRounds).toBe(26);
  });

  it('chaque club joue bien tout le monde deux fois', () => {
    const cal = generateRoundRobinCalendar(PROD2.map(c => c.id));
    expect(cal.matches).toHaveLength((PRO_D2_CLUBS / 2) * 30);
    const un = PROD2[0]!.id;
    const siens = cal.matches.filter(m => m.homeClubId === un || m.awayClubId === un);
    expect(siens).toHaveLength(30);
  });
});

describe('les phases finales suivent le championnat', () => {
  it('arrivent juste après la saison régulière, quelle qu\'en soit la longueur', () => {
    expect(playoffRoundsAfter(26)).toEqual({ PLAYOFFS: 27, SEMIFINALS: 28, FINAL: 29 });
    expect(playoffRoundsAfter(30)).toEqual({ PLAYOFFS: 31, SEMIFINALS: 32, FINAL: 33 });
  });

  it('la constante Top 14 reste ce qu\'elle était', () => {
    // Les sauvegardes antérieures et tout le reste du moteur s'y réfèrent.
    expect(PLAYOFF_ROUNDS).toEqual({ PLAYOFFS: 27, SEMIFINALS: 28, FINAL: 29 });
  });

  it('la 27e journée d\'une Pro D2 est une journée de championnat, pas un barrage', () => {
    // C'est exactement le bug : elle était traitée comme un barrage.
    expect(isPlayoffRound(27, 30)).toBe(false);
    expect(isPlayoffRound(31, 30)).toBe(true);
  });
});

describe('une saison de Pro D2 va jusqu\'au bout', () => {
  it('se joue en trente journées et désigne un champion', () => {
    const session = createSeasonSession({
      clubIds: PROD2.map(c => c.id),
      playerClubId: PROD2[0]!.id,
      seed: 'prod2_saison',
      buildMatchInput: (h, a) => buildInput(h, a),
      playerClubRoster: [],
      currentSeason: 2025,
    });

    let safety = 0;
    while (session.getState().status !== 'finished' && safety++ < 60) {
      const state = session.getState();
      const next = state.playerNextMatch;
      if (!next) {
        session.skipRound('auto');
        continue;
      }
      const input = buildInput(next.homeClubId, next.awayClubId);
      const result = simulateMatch(input, `r${state.currentRound}`);
      session.simulateOtherMatchesOfRound('test');
      session.commitPlayerMatch(result.homeScore, result.awayScore, result);
    }

    const state = session.getState();
    // Trente journées jouées par chacun des seize clubs.
    for (const club of PROD2) {
      expect(state.standings.get(club.id)?.played).toBe(30);
    }
    // Et une phase finale au bout, ce qui n'arrivait jamais.
    expect(state.history.some(h => h.playoffLabel?.includes('Finale'))).toBe(true);
    expect(state.champion).toBeDefined();
  });
});
