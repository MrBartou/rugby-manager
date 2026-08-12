/**
 * Fixtures de test — feuilles de match plausibles à partir d'attributs paramétrables.
 *
 * Volontairement simple : pas de génération procédurale, juste assez de "vrais"
 * Player pour faire tourner simulateMatch.
 */

import type {
  ClubId,
  MatchId,
  Player,
  PlayerId,
  Position,
} from '@/engine/types.js';
import type {
  MatchInput,
  MatchSquad,
  RosterEntry,
} from '@/engine/match/types.js';

const STARTER_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

const FORWARDS: ReadonlySet<Position> = new Set(STARTER_POSITIONS.slice(0, 8));

function clamp(x: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Construit un joueur "moyen" calibré sur un niveau global donné (0-100).
 * Les sub-stats sont réalistes pour le poste (talonneur a un bon lancer, ouvreur a un bon pied, etc.)
 */
function makePlayer(
  clubId: ClubId,
  position: Position,
  niveau: number,
  index: number,
): Player {
  const id = (`p_${clubId}_${index}`) as PlayerId;
  const isFwd = FORWARDS.has(position);
  const N = clamp(niveau);

  // Bruit déterministe (lié à l'index pour reproductibilité)
  const noise = (offset: number): number => ((index * 13 + offset) % 11) - 5;   // -5..+5

  const base = {
    passe: clamp(N + noise(1) - (isFwd ? 15 : 0)),
    plaquage: clamp(N + noise(2)),
    jeuAuPiedPlace: position === 'OUVREUR' ? clamp(N + 15) : position === 'ARRIERE' ? clamp(N + 5) : clamp(N - 25),
    jeuAuPiedDynamique: position === 'OUVREUR' || position === 'DEMI_DE_MELEE' || position === 'ARRIERE' ? clamp(N + 10) : clamp(N - 15),
    visionDeJeu: position === 'OUVREUR' || position === 'DEMI_DE_MELEE' || position === 'ARRIERE' ? clamp(N + 8) : clamp(N),
    conservation: clamp(N + (isFwd ? 5 : 0)),
    prisedeballeHaute: position === 'AILIER_GAUCHE' || position === 'AILIER_DROIT' || position === 'ARRIERE' ? clamp(N + 10) : clamp(N - 5),
    deblayage: isFwd ? clamp(N + 5) : clamp(N - 10),
  };

  const physical = {
    vitesse: isFwd ? clamp(N - 15) : clamp(N + 5),
    puissance: isFwd ? clamp(N + 10) : clamp(N - 5),
    endurance: clamp(N + noise(3)),
    detente: position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE' ? clamp(N + 10) : clamp(N - 5),
    robustesse: clamp(N + noise(4)),
  };

  const mental = {
    decision: clamp(N + (position === 'OUVREUR' ? 10 : 0)),
    leadership: clamp(N + noise(5)),
    sangFroid: clamp(N + noise(6)),
    agressivite: clamp(N + (isFwd ? 5 : 0)),
    professionnalisme: clamp(N + noise(7)),
    discipline: clamp(N + noise(8)),
  };

  const positionSpecific: Player['positionSpecific'] = {};
  if (position === 'PILIER_GAUCHE' || position === 'PILIER_DROIT') {
    positionSpecific.pousseeMelee = clamp(N + 10);
    positionSpecific.liftEnTouche = clamp(N + 5);
  }
  if (position === 'TALONNEUR') {
    positionSpecific.pousseeMelee = clamp(N + 5);
    positionSpecific.qualiteLancer = clamp(N + 12);
  }
  if (position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE') {
    positionSpecific.pousseeMelee = clamp(N + 8);
    positionSpecific.sautEnTouche = clamp(N + 12);
  }
  if (position === 'TROISIEME_LIGNE_AILE_GAUCHE' || position === 'TROISIEME_LIGNE_AILE_DROITE' || position === 'NUMERO_8') {
    positionSpecific.liftEnTouche = clamp(N + 8);
    positionSpecific.grattage = clamp(N + 10);
  }
  if (position === 'DEMI_DE_MELEE') {
    positionSpecific.passeRapide = clamp(N + 10);
  }
  if (position === 'AILIER_GAUCHE' || position === 'AILIER_DROIT' || position === 'ARRIERE') {
    positionSpecific.finition = clamp(N + 5);
    positionSpecific.jeuAerien = clamp(N + 8);
  }

  return {
    id,
    clubId,
    firstName: `Joueur${index}`,
    lastName: clubId,
    birthDate: '1995-01-01',
    position,
    secondaryPositions: [],
    isJiff: true,
    technical: base,
    physical,
    mental,
    positionSpecific,
    traits: [],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

/**
 * Banc réglementaire Top 14 : 8 remplaçants, couverture 5 avants / 3 arrières.
 * Les trois premières lignes sont obligatoires (sinon mêlées simulées).
 */
const BENCH_POSITIONS: readonly Position[] = [
  'TALONNEUR',
  'PILIER_GAUCHE',
  'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE',
  'NUMERO_8',
  'DEMI_DE_MELEE',
  'OUVREUR',
  'CENTRE_INTERIEUR',
];

/**
 * Construit une équipe complète (15 titulaires + 8 remplaçants, niveau global donné).
 *
 * Les remplaçants sont légèrement en dessous des titulaires (−4), ce qui correspond
 * à un banc de Top 14 : assez bons pour apporter de la fraîcheur, pas assez pour
 * qu'un changement soit gratuit.
 */
export function makeSquad(
  clubId: ClubId,
  niveau: number,
): { squad: MatchSquad; players: Player[] } {
  const players: Player[] = [];
  const starters: RosterEntry[] = [];

  for (let i = 0; i < STARTER_POSITIONS.length; i++) {
    const position = STARTER_POSITIONS[i];
    if (!position) continue;
    const player = makePlayer(clubId, position, niveau, i);
    players.push(player);
    starters.push({
      playerId: player.id,
      position,
      captainArmband: position === 'OUVREUR',
    });
  }

  const substitutes: RosterEntry[] = [];
  for (let i = 0; i < BENCH_POSITIONS.length; i++) {
    const position = BENCH_POSITIONS[i];
    if (!position) continue;
    const player = makePlayer(clubId, position, niveau - 4, STARTER_POSITIONS.length + i);
    players.push(player);
    substitutes.push({ playerId: player.id, position, captainArmband: false });
  }

  return {
    players,
    squad: { clubId, starters, substitutes },
  };
}

/** Construit un MatchInput jouable, ne fait que définir les feuilles + conditions. */
export function makeMatchInput(opts: {
  homeNiveau: number;
  awayNiveau: number;
  matchId?: string;
  weather?: MatchInput['weather'];
  fieldCondition?: MatchInput['fieldCondition'];
}): MatchInput {
  const home = makeSquad('club_home' as ClubId, opts.homeNiveau);
  const away = makeSquad('club_away' as ClubId, opts.awayNiveau);

  const playersById = new Map<PlayerId, Player>();
  for (const p of home.players) playersById.set(p.id, p);
  for (const p of away.players) playersById.set(p.id, p);

  return {
    matchId: (opts.matchId ?? 'm_test') as MatchId,
    home: {
      squad: home.squad,
      tacticalPlan: { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] },
      liveMoments: [],
    },
    away: {
      squad: away.squad,
      tacticalPlan: { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] },
      liveMoments: [],
    },
    playersById,
    weather: opts.weather ?? 'SEC',
    fieldCondition: opts.fieldCondition ?? 'BON',
    homeAdvantageBonus: 1.0,                              // avantage maison (Top 14 : ~55-60% V à domicile)
    homeFans: 'MOYEN',
  };
}
