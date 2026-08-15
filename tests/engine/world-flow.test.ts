/**
 * Le monde élargi, dans la session (V0.63).
 *
 * `european-world.test.ts` et `international-matches.test.ts` couvrent les
 * règles. Ce qui est vérifié ici, c'est **ce que la saison en fait** : les
 * adversaires de coupe viennent-ils vraiment du monde persistant, et une
 * fenêtre internationale produit-elle des capes méritées plutôt qu'une cape
 * pour chacun des trente-trois convoqués.
 */

import { describe, expect, it } from 'vitest';
import { createSeasonSession, type SeasonSession } from '@/engine/game/season-session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import { createEuropeanWorld } from '@/engine/season/european-world.js';
import { INTERNATIONAL_BREAK_ROUNDS } from '@/engine/season/internationals.js';
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

const SEASON = 2026;
const WORLD = createEuropeanWorld('monde', SEASON);

function makePlayer(clubId: ClubId, position: Position, idx: number, niveau: number): Player {
  return {
    id: `${clubId}_${position}_${idx}` as PlayerId,
    clubId,
    firstName: 'Test',
    lastName: `${position}${idx}`,
    birthDate: '1998-01-01',
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
    contract: { startSeason: SEASON, endSeason: SEASON + 2, annualSalary: 100_000 },
  };
}

function rosterFor(clubId: ClubId, niveau: number): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < POSITIONS.length; i++) out.push(makePlayer(clubId, POSITIONS[i]!, i, niveau));
  for (let i = 0; i < 8; i++) out.push(makePlayer(clubId, POSITIONS[i]!, 100 + i, niveau - 5));
  return out;
}

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  const starters = (clubId: ClubId): { playerId: PlayerId; position: Position; captainArmband: boolean }[] =>
    POSITIONS.map((pos, i) => {
      const p = makePlayer(clubId, pos, i, 60);
      playersById.set(p.id, p);
      return { playerId: p.id, position: pos, captainArmband: pos === 'OUVREUR' };
    });
  const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
  return {
    matchId: `${homeClubId}_${awayClubId}` as MatchId,
    home: { squad: { clubId: homeClubId, starters: starters(homeClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    away: { squad: { clubId: awayClubId, starters: starters(awayClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    playersById,
    weather: 'SEC',
    fieldCondition: 'BON',
    homeAdvantageBonus: 1.0,
    homeFans: 'BEAUCOUP',
  };
}

const CLUBS = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => id as ClubId);
const PLAYER_CLUB = 'a' as ClubId;

/**
 * Un vivier national assez large pour qu'un groupe de trente-trois existe.
 *
 * Le club dirigé est nettement au-dessus du reste : c'est ce qui garantit que
 * plusieurs de ses joueurs partent en sélection, et donc qu'on puisse observer
 * ce que la fenêtre lui coûte.
 */
function nationalPool(): readonly Player[] {
  return CLUBS.flatMap(c => rosterFor(c, c === PLAYER_CLUB ? 86 : 70));
}

function makeSession(opts: { rank?: number } = {}): SeasonSession {
  return createSeasonSession({
    clubIds: CLUBS,
    playerClubId: PLAYER_CLUB,
    seed: 'monde_test',
    buildMatchInput: buildInput,
    playerClubRoster: rosterFor(PLAYER_CLUB, 86),
    currentSeason: SEASON,
    careerStartSeason: SEASON,
    europeanWorld: WORLD,
    nationalPool,
    ...(opts.rank !== undefined ? { previousSeasonRank: opts.rank } : {}),
  });
}

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

describe('la coupe se joue contre des clubs qui existent', () => {
  it('les quatre adversaires de poule viennent du monde persistant', () => {
    const campaign = makeSession({ rank: 2 }).getState().europeanCampaign!;
    expect(campaign.fixtures).toHaveLength(4);
    for (const f of campaign.fixtures) {
      expect(WORLD.clubs.some(c => c.id === f.opponent.id)).toBe(true);
      // Et ils portent leur graine d'effectif : c'est elle qui les fait durer.
      expect(f.opponent.squadSeed).toBeDefined();
    }
  });

  it('deux saisons de suite, le tirage change sans sortir du monde', () => {
    const premiere = makeSession({ rank: 2 }).getState().europeanCampaign!;
    const seconde = createSeasonSession({
      clubIds: CLUBS,
      playerClubId: PLAYER_CLUB,
      seed: 'monde_test',
      buildMatchInput: buildInput,
      playerClubRoster: rosterFor(PLAYER_CLUB, 86),
      currentSeason: SEASON + 1,
      careerStartSeason: SEASON,
      europeanWorld: WORLD,
      previousSeasonRank: 2,
    }).getState().europeanCampaign!;

    expect(seconde.fixtures.map(f => f.opponent.id))
      .not.toEqual(premiere.fixtures.map(f => f.opponent.id));
    for (const f of seconde.fixtures) {
      expect(WORLD.clubs.some(c => c.id === f.opponent.id)).toBe(true);
    }
  });
});

describe('la fenêtre internationale se joue vraiment', () => {
  /** Avance jusqu'à la fin de la première fenêtre d'automne. */
  function throughAutumn(session: SeasonSession): void {
    const last = INTERNATIONAL_BREAK_ROUNDS[1]!;
    for (let i = 0; i < 40; i++) {
      if (session.getState().currentRound > last) break;
      playLeagueRound(session);
      if (session.getState().status !== 'in-progress') break;
    }
  }

  it('produit deux tests joués, avec des scores', () => {
    const session = makeSession();
    throughAutumn(session);
    const report = session.getState().latestWindowReport;
    expect(report).toBeDefined();
    expect(report!.window).toBe('AUTOMNE');
    expect(report!.results).toHaveLength(2);
    expect(report!.won + report!.lost + report!.drawn).toBe(2);
  });

  it('ne cape que ceux qui ont joué, pas les trente-trois convoqués', () => {
    const session = makeSession();
    throughAutumn(session);
    const state = session.getState();
    const gagnees = [...state.capsThisSeason.values()].filter(n => n > 0);
    expect(gagnees.length).toBeGreaterThan(0);
    // Deux tests, vingt-trois par feuille : personne ne peut dépasser deux
    // capes, et le groupe entier ne peut pas en avoir.
    expect(Math.max(...gagnees)).toBeLessThanOrEqual(2);
    expect(state.capsThisSeason.size).toBeLessThanOrEqual(46);
  });

  it('un international revient avec des statistiques, et de la fatigue', () => {
    const session = makeSession();
    throughAutumn(session);
    const state = session.getState();
    expect(state.internationalStats.size).toBeGreaterThan(0);
    const totalMinutes = [...state.internationalStats.values()]
      .reduce((sum, s) => sum + s.minutes, 0);
    expect(totalMinutes).toBeGreaterThan(0);

    // Le club dirigé récupère ses internationaux, et il le sent : la fatigue
    // rapportée de sélection suit les minutes réellement disputées.
    const mine = state.playerClubRoster.filter(p => (state.internationalStats.get(p.id)?.minutes ?? 0) > 0);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every(p => p.dynamic.fatigue > 0)).toBe(true);
  });
});
