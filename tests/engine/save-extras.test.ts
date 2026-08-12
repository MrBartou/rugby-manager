/**
 * Les extras de sauvegarde ne se perdent pas en route — V0.59.
 *
 * `buildSeasonSaveFromState` recopie ses `extras` **champ par champ**, avec une
 * ligne par entrée. Ajouter un champ au type sans ajouter sa ligne compile
 * parfaitement et produit une sauvegarde silencieusement incomplète : c'est
 * exactement ce qui est arrivé au registre de carrière, découvert seulement en
 * jouant une intersaison entière puis en inspectant le stockage.
 *
 * Ce test remplace cette inspection : on remplit chaque extra d'une valeur
 * reconnaissable et on vérifie qu'elle ressort. Le jour où quelqu'un ajoute un
 * champ sans sa ligne de recopie, c'est ici que ça casse.
 */

import { describe, expect, it } from 'vitest';
import { buildSeasonSaveFromState } from '@/data/season-save-repository.js';
import { createSeasonSession } from '@/engine/game/season-session.js';
import type { ClubId, MatchId, Player, PlayerId, Position } from '@/engine/types.js';
import type { MatchInput } from '@/engine/match/types.js';

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

describe('tout ce qu\'on confie à la sauvegarde en ressort', () => {
  const session = createSeasonSession({
    clubIds: CLUBS,
    playerClubId: 'a' as ClubId,
    seed: 'extras',
    buildMatchInput: buildInput,
    playerClubRoster: POSITIONS.map((pos, i) => player('a' as ClubId, pos, i)),
    currentSeason: 2025,
  });

  /**
   * Chaque extra, rempli d'une valeur non vide et reconnaissable.
   *
   * Le contenu n'a pas d'importance : on vérifie le transport, pas la forme.
   */
  const extras = {
    aiMarket: [],
    winterMarketSeason: 2025,
    news: [],
    academy: { level: 5, investment: 'MOYEN', focus: 'AVANTS' },
    career: { kind: 'EN_POSTE', clubId: 'a' as ClubId },
    managerSeasons: [],
    mailbox: [],
    managerContract: { startSeason: 2025, endSeason: 2028, annualSalary: 300_000 },
    prospects: [],
    divisions: { top14: CLUBS, proD2: [] },
    regulation: { sanctionedLastSeason: true, transferBan: false },
    direction: {
      facilities: { stadiumTier: 1, academyTier: 1, medicalTier: 1 },
      plan: { ticket: 'NORMAL', marketing: 'STANDARD' },
    },
    promises: [],
    transferRequests: [],
    captainPlayerId: 'a_8' as PlayerId,
    squadStatuses: [{ playerId: 'a_0' as PlayerId, status: 'CADRE' as const }],
    rivals: { managers: [], byClub: [] },
    honours: [],
    loans: [],
    expectations: [],
    headToHead: [],
    nationalPicks: { added: ['a_9' as PlayerId], removed: ['a_1' as PlayerId] },
    vacancies: ['b' as ClubId],
    retiredSeedPlayerIds: ['a_0' as PlayerId],
    pendingEvents: [{
      id: 'evt_1', type: 'CONFLIT_VESTIAIRE', atRound: 12,
      title: 'Conflit', context: 'Deux joueurs se sont accrochés.',
      involvedPlayerIds: ['a_0' as PlayerId], options: [], defaultOptionId: 'x',
    }],
    careerBook: [{
      playerId: 'a_0' as PlayerId,
      career: {
        playerId: 'a_0' as PlayerId,
        playerName: 'T P0',
        lines: [{
          season: 2025, clubId: 'a' as ClubId,
          matches: 20, minutes: 1500, tries: 4, caps: 7, honours: [],
        }],
      },
    }],
  } as unknown as Parameters<typeof buildSeasonSaveFromState>[10];

  const save = buildSeasonSaveFromState(
    'sid', session.getState(), 'extras', CLUBS, 'Test', [],
    undefined, undefined, undefined, undefined,
    extras,
  ) as unknown as Record<string, unknown>;

  it('aucun extra fourni ne disparaît de la sauvegarde', () => {
    const manquants = Object.keys(extras as unknown as Record<string, unknown>)
      .filter(key => save[key] === undefined);
    expect(manquants).toEqual([]);
  });

  it('et le registre de carrière ressort intact', () => {
    // Le défaut d'origine : le champ était déclaré, la ligne de recopie
    // manquait, et huit saisons de carrière disparaissaient au rechargement.
    const book = save.careerBook as readonly { career: { lines: readonly unknown[] } }[];
    expect(book).toHaveLength(1);
    expect(book[0]!.career.lines).toHaveLength(1);
  });
});

describe('une décision en attente survit au rechargement', () => {
  const conflit = {
    id: 'evt_1', type: 'CONFLIT_VESTIAIRE' as const, atRound: 12,
    title: 'Conflit ouvert au vestiaire',
    context: 'Deux joueurs se sont accrochés.',
    involvedPlayerIds: ['a_0' as PlayerId, 'a_1' as PlayerId],
    options: [{ id: 'mediate', label: 'Arbitrer', description: '...', effects: [] }],
    defaultOptionId: 'mediate',
  };

  it('la session la retrouve telle quelle', () => {
    // V0.60 : elle était perdue. La question se refermait toute seule, sans
    // réponse et sans conséquence.
    const session = createSeasonSession({
      clubIds: CLUBS,
      playerClubId: 'a' as ClubId,
      seed: 'events',
      buildMatchInput: buildInput,
      playerClubRoster: POSITIONS.map((pos, i) => player('a' as ClubId, pos, i)),
      currentSeason: 2025,
      restoreFrom: {
        currentRound: 12,
        history: [],
        standings: [],
        pendingEvents: [conflit],
      },
    });

    expect(session.getState().pendingEvents.map(e => e.id)).toContain('evt_1');
  });
});
