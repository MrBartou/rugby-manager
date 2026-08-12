/**
 * Relégation et promotion — V0.13.
 *
 * Sans descente, l'objectif « maintien » du président n'avait aucune conséquence :
 * finir quatorzième revenait à finir dixième. Ce module donne des dents au bas du
 * classement, en reproduisant le format du Top 14 :
 *
 *  - le **14e** est relégué directement en Pro D2
 *  - le **13e** dispute un barrage d'accession contre le 2e de Pro D2
 *  - le champion de Pro D2 monte directement
 *
 * Le championnat de Pro D2 n'est pas simulé match par match : il est représenté par
 * un petit ensemble de clubs générés, ce qui suffit à alimenter les montées et les
 * descentes sans doubler le coût de simulation d'une saison.
 */

import { createRng, type Rng } from '../rng.js';
import type { Club, ClubId, ClubTier, TacticalIdentity } from '../types.js';
import type { ClubStanding } from './standings.js';

// =============================================================================
// Positions concernées
// =============================================================================

/** Rang relégué directement (1-indexé). */
export const DIRECT_RELEGATION_RANK = 14;
/** Rang qui dispute le barrage d'accession. */
export const PLAYOFF_RELEGATION_RANK = 13;

export type RelegationStatus = 'SAFE' | 'BARRAGE' | 'RELEGATED';

/** Situation d'un club vis-à-vis de la descente, à un rang donné. */
export function relegationStatusForRank(rank: number, totalClubs = 14): RelegationStatus {
  if (rank >= totalClubs) return 'RELEGATED';
  if (rank >= totalClubs - 1) return 'BARRAGE';
  return 'SAFE';
}

/**
 * À partir de combien de journées restantes la menace de descente devient-elle
 * concrète ? Sert à déclencher la pression du président et de la presse.
 */
export function isRelegationThreatened(rank: number, roundsRemaining: number, totalClubs = 14): boolean {
  if (roundsRemaining > 8) return false;
  return rank >= totalClubs - 3;
}

// =============================================================================
// Clubs de Pro D2
// =============================================================================

const PRO_D2_CITIES: readonly string[] = [
  'Mont-de-Marsan', 'Oyonnax', 'Grenoble', 'Colomiers', 'Béziers', 'Aurillac',
  'Montauban', 'Nevers', 'Agen', 'Dax', 'Carcassonne', 'Soyaux-Angoulême',
  'Provence Rugby', 'Valence Romans', 'Brive', 'Biarritz',
];

const IDENTITIES: readonly TacticalIdentity[] = ['JEU_AVANTS', 'GRAND_ECART', 'MIXTE', 'DEFENSE_DE_FER'];

export interface ProD2Club {
  readonly id: ClubId;
  readonly name: string;
  readonly city: string;
  /** Force globale de l'effectif, 42-60 : sous le niveau du Top 14. */
  readonly strength: number;
  readonly identity: TacticalIdentity;
}

/** Génère le haut de tableau de Pro D2 pour une saison donnée. */
export function generateProD2Contenders(season: number, count = 4): readonly ProD2Club[] {
  const rng = createRng(`prod2_${season}`);
  const pool = [...PRO_D2_CITIES];
  const out: ProD2Club[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.nextInt(0, pool.length - 1);
    const city = pool.splice(idx, 1)[0]!;
    out.push({
      id: `prod2_${season}_${i}` as ClubId,
      name: city,
      city,
      // Le champion de Pro D2 est plus fort que le deuxième, et ainsi de suite.
      strength: Math.max(42, 58 - i * 3 + rng.nextInt(-3, 3)),
      identity: IDENTITIES[rng.nextInt(0, IDENTITIES.length - 1)]!,
    });
  }
  return out;
}

/**
 * Convertit un club de Pro D2 en club de Top 14 promu.
 * Le nouveau promu arrive avec un budget de petit club et une réputation faible.
 */
export function promoteToTop14(club: ProD2Club): Club {
  const tier: ClubTier = 'PETIT_BUDGET';
  return {
    id: club.id,
    name: club.name,
    shortName: club.city.slice(0, 3).toUpperCase(),
    city: club.city,
    tier,
    tacticalIdentity: club.identity,
    stadiumCapacity: 12_000,
    annualBudget: 14_000_000,
    salaryCapUsage: 0,
    jiffCount: 0,
    reputation: 40,
  };
}

// =============================================================================
// Barrage d'accession
// =============================================================================

export interface BarrageInput {
  /** Club de Top 14 classé 13e. */
  readonly top14ClubId: ClubId;
  readonly top14Strength: number;
  /** Deuxième de Pro D2. */
  readonly challenger: ProD2Club;
}

export interface BarrageResult {
  readonly top14Survives: boolean;
  readonly top14Score: number;
  readonly challengerScore: number;
  readonly summary: string;
}

/**
 * Résout le barrage d'accession.
 *
 * Le club de Top 14 reçoit : il part favori, mais la marche n'est pas si haute —
 * un treizième en fin de course est rarement supérieur à un deuxième de Pro D2
 * lancé. On veut que ce match fasse peur.
 */
export function resolveBarrage(input: BarrageInput, rng: Rng): BarrageResult {
  const homeEdge = 4;
  const delta = (input.top14Strength + homeEdge) - input.challenger.strength;

  // Score de base autour de 22 points, modulé par l'écart de niveau.
  const top14Score = Math.max(0, Math.round(21 + delta * 0.42 + rng.nextGaussian(0, 7)));
  const challengerScore = Math.max(0, Math.round(21 - delta * 0.30 + rng.nextGaussian(0, 7)));

  if (top14Score === challengerScore) {
    // Pas de match nul en barrage : l'équipe qui reçoit passe.
    return {
      top14Survives: true,
      top14Score: top14Score + 3,
      challengerScore,
      summary: `Maintien arraché après prolongation face à ${input.challenger.name}.`,
    };
  }

  const survives = top14Score > challengerScore;
  return {
    top14Survives: survives,
    top14Score,
    challengerScore,
    summary: survives
      ? `Maintien assuré en barrage face à ${input.challenger.name} (${top14Score}-${challengerScore}).`
      : `Relégation en Pro D2 : défaite en barrage contre ${input.challenger.name} (${top14Score}-${challengerScore}).`,
  };
}

// =============================================================================
// Résolution de fin de saison
// =============================================================================

export interface SeasonRelegationInput {
  readonly rankedStandings: readonly ClubStanding[];
  readonly season: number;
  /** Force estimée de chaque club (pour le barrage). */
  readonly strengthByClub: (clubId: ClubId) => number;
}

export interface SeasonRelegationResult {
  /** Clubs qui quittent le Top 14. */
  readonly relegated: readonly ClubId[];
  /** Clubs de Pro D2 qui montent. */
  readonly promoted: readonly ProD2Club[];
  /** Détail du barrage, si joué. */
  readonly barrage?: BarrageResult & { readonly top14ClubId: ClubId; readonly challengerName: string };
}

/**
 * Applique les règles de descente à la fin d'une saison.
 * Renvoie toujours autant de promus que de relégués, pour garder 14 clubs.
 */
export function resolveRelegation(
  input: SeasonRelegationInput,
  rng: Rng,
): SeasonRelegationResult {
  const standings = input.rankedStandings;
  if (standings.length < PLAYOFF_RELEGATION_RANK) {
    return { relegated: [], promoted: [] };
  }

  const contenders = generateProD2Contenders(input.season);
  const champion = contenders[0];
  const runnerUp = contenders[1];

  const lastPlace = standings[DIRECT_RELEGATION_RANK - 1];
  const secondToLast = standings[PLAYOFF_RELEGATION_RANK - 1];

  const relegated: ClubId[] = [];
  const promoted: ProD2Club[] = [];

  // 1. Descente directe du dernier, remplacé par le champion de Pro D2.
  if (lastPlace && champion) {
    relegated.push(lastPlace.clubId);
    promoted.push(champion);
  }

  // 2. Barrage du 13e contre le 2e de Pro D2.
  if (!secondToLast || !runnerUp) {
    return { relegated, promoted };
  }

  const barrage = resolveBarrage(
    {
      top14ClubId: secondToLast.clubId,
      top14Strength: input.strengthByClub(secondToLast.clubId),
      challenger: runnerUp,
    },
    rng,
  );

  if (!barrage.top14Survives) {
    relegated.push(secondToLast.clubId);
    promoted.push(runnerUp);
  }

  return {
    relegated,
    promoted,
    barrage: { ...barrage, top14ClubId: secondToLast.clubId, challengerName: runnerUp.name },
  };
}
