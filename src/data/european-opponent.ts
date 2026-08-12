/**
 * Construction d'un adversaire européen jouable — V0.13.
 *
 * Les clubs européens sont générés procéduralement (voir
 * `engine/season/european-cup.ts`, qui explique pourquoi : éviter une dépendance
 * de licence sur des clubs étrangers). Ils n'ont donc pas de roster en base.
 *
 * Ce module fabrique à la volée une feuille de match de 23 joueurs cohérente avec
 * la force de l'adversaire, afin de pouvoir jouer le match avec le moteur normal.
 * Il vit dans `data/` et non dans `engine/` : le moteur reste pur et ignore d'où
 * viennent les joueurs qu'on lui passe.
 */

import { createRng } from '../engine/rng.js';
import { suggestCaptain } from '../engine/match/captain.js';
import type { EuropeanOpponent } from '../engine/season/european-cup.js';
import type { HomeWeeklyModifiers, MatchInput, MatchSquad, RosterEntry } from '../engine/match/types.js';
import type { Club, ClubId, MatchId, Player, PlayerId, Position } from '../engine/types.js';

const STARTER_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

/** Banc réglementaire : 5 avants, 3 arrières. */
const BENCH_POSITIONS: readonly Position[] = [
  'TALONNEUR', 'PILIER_GAUCHE', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR', 'CENTRE_INTERIEUR',
];

const FORWARDS: ReadonlySet<Position> = new Set(STARTER_POSITIONS.slice(0, 8));

/**
 * Patronymes neutres par pays. Volontairement génériques : ce sont des joueurs
 * fictifs, pas des sportifs réels.
 */
const SURNAMES: Readonly<Record<EuropeanOpponent['country'], readonly string[]>> = {
  ANGLETERRE: ['Hartley', 'Radwan', 'Sinckler', 'Ewels', 'Cokanasiga', 'Ludlam', 'Whiteley', 'Barrow'],
  IRLANDE: ['O\'Mahony', 'Kilcoyne', 'Doris', 'Gibson', 'Hanrahan', 'Treacy', 'McCloskey', 'Baird'],
  ECOSSE: ['Ritchie', 'Gray', 'Bhatti', 'Horne', 'Kinghorn', 'Fagerson', 'Turner', 'Steele'],
  PAYS_DE_GALLES: ['Llewellyn', 'Prydderch', 'Meredith', 'Gethin', 'Rhys-Owen', 'Tovey', 'Cadwallader', 'Vaughan'],
  ITALIE: ['Bellini', 'Ferrari', 'Zanon', 'Lucchesi', 'Riccioni', 'Vintcent', 'Trulla', 'Odogwu'],
  AFRIQUE_DU_SUD: ['Mostert', 'Nkosi', 'Dyantyi', 'Venter', 'Kriel', 'Roos', 'Steenekamp', 'Mbonambi'],
};

const FIRST_NAMES: readonly string[] = [
  'Liam', 'Owen', 'Ruan', 'Callum', 'Fionn', 'Marco', 'Tomas', 'Ewan',
  'Kyle', 'Josh', 'Dylan', 'Sean', 'Bryn', 'Andries', 'Niall', 'Rhodri',
];

function clamp(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

/**
 * Fabrique un joueur cohérent avec la force du club et son poste.
 * Le profil suit les mêmes conventions que les effectifs du Top 14 (les avants
 * sont plus puissants et moins rapides, l'ouvreur bute, etc.).
 */
function makeOpponentPlayer(
  opponent: EuropeanOpponent,
  position: Position,
  index: number,
  strength: number,
  rng: { nextInt(min: number, max: number): number },
): Player {
  const N = strength;
  const isForward = FORWARDS.has(position);
  const noise = () => rng.nextInt(-5, 5);
  const surnames = SURNAMES[opponent.country];

  return {
    id: `${opponent.id}_p${index}` as PlayerId,
    clubId: opponent.id,
    firstName: FIRST_NAMES[index % FIRST_NAMES.length]!,
    lastName: surnames[index % surnames.length]!,
    birthDate: `${2000 - rng.nextInt(0, 8)}-01-01`,
    position,
    secondaryPositions: [],
    isJiff: false,
    technical: {
      passe: clamp(N + noise() - (isForward ? 15 : 0)),
      plaquage: clamp(N + noise()),
      jeuAuPiedPlace: position === 'OUVREUR' ? clamp(N + 15) : position === 'ARRIERE' ? clamp(N + 5) : clamp(N - 25),
      jeuAuPiedDynamique: position === 'OUVREUR' || position === 'DEMI_DE_MELEE' || position === 'ARRIERE' ? clamp(N + 10) : clamp(N - 15),
      visionDeJeu: position === 'OUVREUR' || position === 'DEMI_DE_MELEE' ? clamp(N + 8) : clamp(N),
      conservation: clamp(N + (isForward ? 5 : 0)),
      prisedeballeHaute: position === 'AILIER_GAUCHE' || position === 'AILIER_DROIT' || position === 'ARRIERE' ? clamp(N + 10) : clamp(N - 5),
      deblayage: isForward ? clamp(N + 5) : clamp(N - 10),
    },
    physical: {
      vitesse: isForward ? clamp(N - 15) : clamp(N + 5),
      puissance: isForward ? clamp(N + 10) : clamp(N - 5),
      endurance: clamp(N + noise()),
      detente: position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE' ? clamp(N + 10) : clamp(N - 5),
      robustesse: clamp(N + noise()),
    },
    mental: {
      decision: clamp(N + (position === 'OUVREUR' ? 10 : 0)),
      leadership: clamp(N + noise()),
      sangFroid: clamp(N + noise()),
      agressivite: clamp(N + (isForward ? 5 : 0)),
      professionnalisme: clamp(N + noise()),
      discipline: clamp(N + noise()),
    },
    positionSpecific: buildPositionSpecific(position, N),
    traits: [],
    hidden: { potentiel: clamp(N + 5), ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 150_000 },
  };
}

function buildPositionSpecific(position: Position, N: number): Player['positionSpecific'] {
  const out: Player['positionSpecific'] = {};
  if (position === 'PILIER_GAUCHE' || position === 'PILIER_DROIT') {
    out.pousseeMelee = clamp(N + 10);
    out.liftEnTouche = clamp(N + 5);
  }
  if (position === 'TALONNEUR') {
    out.pousseeMelee = clamp(N + 5);
    out.qualiteLancer = clamp(N + 12);
  }
  if (position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE') {
    out.pousseeMelee = clamp(N + 8);
    out.sautEnTouche = clamp(N + 12);
  }
  if (position === 'TROISIEME_LIGNE_AILE_GAUCHE' || position === 'TROISIEME_LIGNE_AILE_DROITE' || position === 'NUMERO_8') {
    out.liftEnTouche = clamp(N + 8);
    out.grattage = clamp(N + 10);
  }
  if (position === 'DEMI_DE_MELEE') out.passeRapide = clamp(N + 10);
  if (position === 'AILIER_GAUCHE' || position === 'AILIER_DROIT' || position === 'ARRIERE') {
    out.finition = clamp(N + 5);
    out.jeuAerien = clamp(N + 8);
  }
  return out;
}

export interface EuropeanSquad {
  readonly squad: MatchSquad;
  readonly players: readonly Player[];
}

/**
 * Construit la feuille de match complète (15 + 8) d'un adversaire européen.
 * Déterministe : même adversaire + même graine = même effectif.
 */
export function buildEuropeanSquad(opponent: EuropeanOpponent, seed: string): EuropeanSquad {
  const rng = createRng(`eu_squad_${opponent.id}_${seed}`);
  const players: Player[] = [];
  const starters: RosterEntry[] = [];
  const substitutes: RosterEntry[] = [];

  for (let i = 0; i < STARTER_POSITIONS.length; i++) {
    const position = STARTER_POSITIONS[i]!;
    const player = makeOpponentPlayer(opponent, position, i, opponent.strength, rng);
    players.push(player);
    starters.push({ playerId: player.id, position, captainArmband: false });
  }

  // V0.50 — le brassard va au meneur d'hommes du XV, pas à l'ouvreur d'office.
  const euCaptain = suggestCaptain(players);
  if (euCaptain) {
    const idx = starters.findIndex(e => e.playerId === euCaptain.id);
    if (idx >= 0) starters[idx] = { ...starters[idx]!, captainArmband: true };
  }

  // Le banc est légèrement en dessous, comme pour les clubs du Top 14.
  for (let i = 0; i < BENCH_POSITIONS.length; i++) {
    const position = BENCH_POSITIONS[i]!;
    const player = makeOpponentPlayer(
      opponent, position, STARTER_POSITIONS.length + i, opponent.strength - 4, rng,
    );
    players.push(player);
    substitutes.push({ playerId: player.id, position, captainArmband: false });
  }

  return {
    squad: { clubId: opponent.id as ClubId, starters, substitutes },
    players,
  };
}

// =============================================================================
// Construction du MatchInput européen
// =============================================================================

/**
 * Assemble un `MatchInput` complet pour un match de coupe d'Europe.
 *
 * Le club du joueur fournit ses vrais joueurs et sa compo ; l'adversaire est
 * généré à la volée. Le moteur ne voit aucune différence avec un match de Top 14.
 */
export function buildEuropeanMatchInput(opts: {
  readonly opponent: EuropeanOpponent;
  readonly playerClub: Club;
  readonly playerSquad: MatchSquad;
  readonly playerPlayers: readonly Player[];
  readonly atHome: boolean;
  readonly matchId: string;
  readonly seed: string;
  readonly weeklyModifiers?: HomeWeeklyModifiers;
}): MatchInput & { readonly homeClub: Club; readonly awayClub: Club } {
  const opponentSquad = buildEuropeanSquad(opts.opponent, opts.seed);

  const playersById = new Map<PlayerId, Player>();
  for (const p of opts.playerPlayers) playersById.set(p.id, p);
  for (const p of opponentSquad.players) playersById.set(p.id, p);

  const opponentClub: Club = {
    id: opts.opponent.id,
    name: opts.opponent.name,
    shortName: opts.opponent.name.slice(0, 3).toUpperCase(),
    city: opts.opponent.name,
    tier: opts.opponent.strength >= 70 ? 'GROS_BUDGET' : opts.opponent.strength >= 58 ? 'BUDGET_MOYEN' : 'PETIT_BUDGET',
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 20_000,
    annualBudget: 20_000_000,
    salaryCapUsage: 0,
    jiffCount: 0,
    reputation: opts.opponent.strength,
  };

  const plan = {
    occupation: 'MEDIANE',
    defensiveLine: 'RIDEAU',
    setPiecesFocus: ['NONE'],
  } as const;

  const playerSide = { squad: opts.playerSquad, tacticalPlan: plan, liveMoments: [] };
  const opponentSide = { squad: opponentSquad.squad, tacticalPlan: plan, liveMoments: [] };

  return {
    matchId: opts.matchId as MatchId,
    home: opts.atHome ? playerSide : opponentSide,
    away: opts.atHome ? opponentSide : playerSide,
    playersById,
    weather: 'SEC',
    fieldCondition: 'BON',
    // La finale se joue sur terrain neutre : pas d'avantage du terrain.
    homeAdvantageBonus: opts.atHome ? 1.0 : 0.6,
    homeFans: opts.atHome ? 'BEAUCOUP' : 'MOYEN',
    homeClub: opts.atHome ? opts.playerClub : opponentClub,
    awayClub: opts.atHome ? opponentClub : opts.playerClub,
    playerSide: opts.atHome ? 'HOME' : 'AWAY',
    ...(opts.weeklyModifiers
      ? opts.atHome
        ? { homeWeeklyModifiers: opts.weeklyModifiers }
        : { awayWeeklyModifiers: opts.weeklyModifiers }
      : {}),
  };
}
