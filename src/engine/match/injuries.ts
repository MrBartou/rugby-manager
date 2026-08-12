/**
 * Blessures dynamiques — V0.7 phase 3.
 *
 * Modèle V0.7 : roll de blessures post-match pour chaque titulaire du club joueur,
 * pondéré par robustesse + fatigue. Les types de la doc 03 sont implémentés
 * avec leur distribution de durée.
 *
 * Récupération : à chaque round, on compare currentRound à estimatedReturnAt.
 * Quand le délai est atteint, la blessure est levée.
 */

import { createRng, type Rng } from '../rng.js';
import type { Injury, InjuryType, Player, PlayerId } from '../types.js';

/** Probabilité de base de blessure pour un titulaire qui a fini le match. */
const BASE_INJURY_PROB = 0.06;

interface InjuryProfile {
  readonly type: InjuryType;
  readonly weight: number;        // poids dans la distribution
  readonly minRounds: number;
  readonly maxRounds: number;
}

const PROFILES: readonly InjuryProfile[] = [
  { type: 'COUP',         weight: 35, minRounds: 1, maxRounds: 2 },
  { type: 'MUSCULAIRE',   weight: 25, minRounds: 2, maxRounds: 4 },
  { type: 'COMMOTION',    weight: 12, minRounds: 3, maxRounds: 6 },
  { type: 'LIGAMENTAIRE', weight: 15, minRounds: 8, maxRounds: 16 },
  { type: 'CHRONIQUE',    weight:  8, minRounds: 4, maxRounds: 8 },
  { type: 'FRACTURE',     weight:  5, minRounds: 12, maxRounds: 24 },
];

function pickInjuryType(rng: Rng): InjuryProfile {
  const total = PROFILES.reduce((s, p) => s + p.weight, 0);
  let r = rng.next() * total;
  for (const p of PROFILES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PROFILES[0]!;
}

/**
 * Calcule la probabilité de blessure d'un joueur sur un match.
 * Robustesse [0,99] : 99 → ×0.4 ; 50 → ×1.0 ; 1 → ×1.6
 * Fatigue [0,100] : 100 → ×1.5 ; 50 → ×1.0 ; 0 → ×0.7
 */
function injuryProbability(player: Player): number {
  const robustesse = player.physical.robustesse;
  const fatigue = player.dynamic.fatigue;
  const robFactor = 1 + (50 - robustesse) / 80;
  const fatFactor = 1 + (fatigue - 50) / 100;
  return BASE_INJURY_PROB * robFactor * fatFactor;
}

export interface RollInjuriesInput {
  readonly players: readonly Player[];        // roster du club joueur
  readonly starterIds: readonly PlayerId[];
  readonly currentRound: number;
  readonly seed: string;
}

export interface RolledInjury {
  readonly playerId: PlayerId;
  readonly playerLastName: string;
  readonly injury: Injury;
}

/**
 * Roule les blessures pour chaque titulaire. Renvoie joueurs mis à jour + liste
 * des blessures fraîches (pour notification UI).
 * Saute les joueurs déjà blessés.
 */
export function rollPostMatchInjuries(input: RollInjuriesInput): {
  readonly players: readonly Player[];
  readonly newInjuries: readonly RolledInjury[];
} {
  const rng = createRng(`${input.seed}_injuries_r${input.currentRound}`);
  const starterSet = new Set<PlayerId>(input.starterIds);
  const newInjuries: RolledInjury[] = [];

  const players = input.players.map<Player>(p => {
    if (p.retired || p.freeAgent || p.dynamic.injury) return p;
    if (!starterSet.has(p.id)) return p;
    const prob = injuryProbability(p);
    if (!rng.nextBool(prob)) return p;

    const profile = pickInjuryType(rng);
    const duration = rng.nextInt(profile.minRounds, profile.maxRounds);
    const injury: Injury = {
      type: profile.type,
      startedAt: input.currentRound,
      estimatedReturnAt: input.currentRound + duration,
      hasSequela: profile.type === 'FRACTURE' || profile.type === 'CHRONIQUE',
    };
    newInjuries.push({ playerId: p.id, playerLastName: p.lastName, injury });
    return { ...p, dynamic: { ...p.dynamic, injury } };
  });

  return { players, newInjuries };
}

/**
 * À chaque incrément de round : lève la blessure des joueurs dont le délai est atteint.
 * La forme repart à 50 (rouille post-blessure).
 */
export function progressInjuryRecovery(
  players: readonly Player[],
  currentRound: number,
): readonly Player[] {
  return players.map<Player>(p => {
    const inj = p.dynamic.injury;
    if (!inj) return p;
    if (currentRound < inj.estimatedReturnAt) return p;
    return {
      ...p,
      dynamic: {
        forme: 50,
        fatigue: 0,
        mood: p.dynamic.mood,
        moodModifiers: p.dynamic.moodModifiers,
      },
    };
  });
}

/** Joueurs disponibles (non retraités, non free agent, non blessés). */
export function isAvailable(p: Player): boolean {
  return !p.retired && !p.freeAgent && !p.dynamic.injury;
}
