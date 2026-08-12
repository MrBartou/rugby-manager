/**
 * Les règles de recrutement s'appliquent à toutes les portes : v0.60.
 *
 * Deux défauts au même endroit, tous deux invisibles à la lecture du code de
 * chaque fonction prise isolément.
 *
 * Le joker médical cherchait ses candidats dans les effectifs des clubs, c'est
 * à dire là où un joueur libre ne peut par définition pas se trouver. La liste
 * était donc toujours vide, et la fonctionnalité morte depuis sa livraison sans
 * qu'aucun test ne s'en aperçoive : ils portaient tous sur les règles
 * d'admissibilité, jamais sur la provenance du vivier.
 *
 * L'interdiction de recrutement, elle, n'était testée que dans l'écran des
 * agents libres. Une offre payante ou un joker médical passait à côté. Un club
 * sanctionné par la DNCG pouvait donc recruter, à condition de payer.
 */

import { describe, expect, it } from 'vitest';
import { createSeasonSession } from '@/engine/game/season-session.js';
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

function player(clubId: ClubId, position: Position, i: number, niveau = 70): Player {
  const n = niveau;
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

/** Un titulaire absent longtemps : c'est ce qui ouvre le droit au joker. */
const blessé = (): Player => {
  const p = player('a' as ClubId, 'TALONNEUR', 1);
  return {
    ...p,
    dynamic: {
      ...p.dynamic,
      injury: { type: 'FRACTURE', startedAt: 1, estimatedReturnAt: 30, hasSequela: false },
    },
  };
};

/** Un joueur sans club, de niveau inférieur au blessé comme la règle l'exige. */
const libre = (): Player => ({
  ...player('' as ClubId, 'TALONNEUR', 99, 60),
  id: 'libre_1' as PlayerId,
  lastName: 'Sansclub',
  freeAgent: true,
});

/** Un club doté d'un vrai budget : sans lui, aucune signature n'est finançable. */
const club = (id: ClubId): Club => ({
  id,
  name: `Club ${id}`,
  shortName: (id as string).toUpperCase(),
  city: 'Ville',
  tier: 'BUDGET_MOYEN',
  tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000,
  annualBudget: 10_000_000,
  salaryCapUsage: 0,
  jiffCount: 15,
  reputation: 60,
});

function session(opts: { transferBan: boolean; freeAgents?: readonly Player[] }) {
  const roster = POSITIONS.map((pos, i) => (
    pos === 'TALONNEUR' ? blessé() : player('a' as ClubId, pos, i)
  ));
  return createSeasonSession({
    clubIds: CLUBS,
    playerClubId: 'a' as ClubId,
    seed: 'recrutement',
    buildMatchInput: buildInput,
    playerClubRoster: roster,
    currentSeason: 2025,
    allClubs: CLUBS.map(club),
    rosterByClub: (cid) => (cid === ('a' as ClubId) ? roster : POSITIONS.map((pos, i) => player(cid, pos, i))),
    freeAgentPool: () => opts.freeAgents ?? [libre()],
    recruitment: () => ({ division: 'TOP14', transferBan: opts.transferBan }),
  });
}

describe('le joker médical trouve enfin des candidats', () => {
  it('propose un joueur libre pour un blessé de longue durée', () => {
    const options = session({ transferBan: false }).getJokerOptions();
    const pourLeTalonneur = options.find(o => o.injured.position === 'TALONNEUR');

    expect(pourLeTalonneur).toBeDefined();
    expect(pourLeTalonneur!.candidates.map(c => c.id as string)).toContain('libre_1');
  });

  it('et n\'en propose aucun quand le vivier est vide', () => {
    const options = session({ transferBan: false, freeAgents: [] }).getJokerOptions();
    expect(options.every(o => o.candidates.length === 0)).toBe(true);
  });
});

describe('l\'interdiction de recruter ferme toutes les portes', () => {
  it('refuse le joker médical', () => {
    const s = session({ transferBan: true });
    const injuredId = s.getJokerOptions()[0]!.injured.id;

    const outcome = s.signMedicalJoker(injuredId, libre(), 90_000);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false ? outcome.reason : '').toMatch(/interdiction/i);
  });

  it('refuse une offre payante pour un joueur sous contrat', () => {
    const s = session({ transferBan: true });
    const cible = player('b' as ClubId, 'OUVREUR', 9);

    const outcome = s.submitBid(cible, { fee: 500_000, annualSalary: 200_000, years: 3 });
    expect(outcome.kind).toBe('BLOCKED');
    expect(outcome.kind === 'BLOCKED' ? outcome.reason : '').toMatch(/interdiction/i);
  });

  it('mais laisse passer le même joker sans interdiction', () => {
    const s = session({ transferBan: false });
    const injuredId = s.getJokerOptions()[0]!.injured.id;

    expect(s.signMedicalJoker(injuredId, libre(), 90_000).ok).toBe(true);
  });
});
