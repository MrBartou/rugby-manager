/**
 * Vieillissement des stats — V0.7 phase 1.
 *
 * À chaque rollover, les stats évoluent selon une courbe d'âge :
 *  - 18-22 ans : croissance lente, plafonnée par hidden.potentiel
 *  - 23-27 ans : pic, stables ou +1 ciblé
 *  - 28-31 ans : stables, +1 mental occasionnel
 *  - 32-34 ans : -1/-2 vitesse/explosivité, +1 mental
 *  - 35+ ans : déclin physique marqué
 *
 * Fonction pure, déterministe par seed.
 */

import { createRng, type Rng } from '../rng.js';
import type { MentalAttributes, PhysicalAttributes, Player, TechnicalAttributes } from '../types.js';

function clampStat(v: number): number {
  return Math.max(1, Math.min(99, v));
}

function ageFromBirthDate(birthDate: string, season: number): number {
  return season - Number(birthDate.slice(0, 4));
}

interface AgeCurve {
  /** Variation moyenne sur les attributs physiques (vitesse, puissance, endurance, détente). */
  readonly physicalDelta: number;
  /** Variation moyenne sur les attributs techniques. */
  readonly technicalDelta: number;
  /** Variation moyenne sur les attributs mentaux (sang-froid, decision, professionnalisme). */
  readonly mentalDelta: number;
  /** Probabilité qu'un attribut quelconque s'écarte d'un cran (variance). */
  readonly varianceProb: number;
}

function curveByAge(age: number): AgeCurve {
  if (age <= 21) return { physicalDelta: 1, technicalDelta: 1, mentalDelta: 0, varianceProb: 0.3 };
  if (age <= 26) return { physicalDelta: 1, technicalDelta: 1, mentalDelta: 1, varianceProb: 0.25 };
  if (age <= 30) return { physicalDelta: 0, technicalDelta: 0, mentalDelta: 1, varianceProb: 0.2 };
  if (age <= 33) return { physicalDelta: -1, technicalDelta: 0, mentalDelta: 1, varianceProb: 0.25 };
  if (age <= 36) return { physicalDelta: -2, technicalDelta: -1, mentalDelta: 0, varianceProb: 0.3 };
  return { physicalDelta: -3, technicalDelta: -1, mentalDelta: -1, varianceProb: 0.4 };
}

function applyDeltaWithCap(value: number, delta: number, cap: number, rng: Rng, varianceProb: number): number {
  let next = value + delta;
  // Variance : ±1 avec proba varianceProb
  if (rng.nextBool(varianceProb)) {
    next += rng.nextBool(0.5) ? 1 : -1;
  }
  // Plafonnement par potentiel pour les croissances
  if (delta > 0 && next > cap) next = cap;
  return clampStat(next);
}

export function applyAgingToPlayer(player: Player, newSeason: number, rng: Rng): Player {
  if (player.retired) return player;
  const age = ageFromBirthDate(player.birthDate, newSeason);
  const curve = curveByAge(age);
  const cap = player.hidden.potentiel;

  const technical: TechnicalAttributes = {
    passe: applyDeltaWithCap(player.technical.passe, curve.technicalDelta, cap, rng, curve.varianceProb),
    plaquage: applyDeltaWithCap(player.technical.plaquage, curve.technicalDelta, cap, rng, curve.varianceProb),
    jeuAuPiedPlace: applyDeltaWithCap(player.technical.jeuAuPiedPlace, curve.technicalDelta, cap, rng, curve.varianceProb),
    jeuAuPiedDynamique: applyDeltaWithCap(player.technical.jeuAuPiedDynamique, curve.technicalDelta, cap, rng, curve.varianceProb),
    visionDeJeu: applyDeltaWithCap(player.technical.visionDeJeu, curve.technicalDelta, cap, rng, curve.varianceProb),
    conservation: applyDeltaWithCap(player.technical.conservation, curve.technicalDelta, cap, rng, curve.varianceProb),
    prisedeballeHaute: applyDeltaWithCap(player.technical.prisedeballeHaute, curve.technicalDelta, cap, rng, curve.varianceProb),
    deblayage: applyDeltaWithCap(player.technical.deblayage, curve.technicalDelta, cap, rng, curve.varianceProb),
  };

  const physical: PhysicalAttributes = {
    vitesse: applyDeltaWithCap(player.physical.vitesse, curve.physicalDelta, cap, rng, curve.varianceProb),
    puissance: applyDeltaWithCap(player.physical.puissance, curve.physicalDelta, cap, rng, curve.varianceProb),
    endurance: applyDeltaWithCap(player.physical.endurance, curve.physicalDelta, cap, rng, curve.varianceProb),
    detente: applyDeltaWithCap(player.physical.detente, curve.physicalDelta, cap, rng, curve.varianceProb),
    robustesse: applyDeltaWithCap(player.physical.robustesse, curve.physicalDelta, cap, rng, curve.varianceProb),
  };

  const mental: MentalAttributes = {
    decision: applyDeltaWithCap(player.mental.decision, curve.mentalDelta, cap, rng, curve.varianceProb),
    leadership: applyDeltaWithCap(player.mental.leadership, curve.mentalDelta, cap, rng, curve.varianceProb),
    sangFroid: applyDeltaWithCap(player.mental.sangFroid, curve.mentalDelta, cap, rng, curve.varianceProb),
    agressivite: applyDeltaWithCap(player.mental.agressivite, 0, cap, rng, curve.varianceProb),
    professionnalisme: applyDeltaWithCap(player.mental.professionnalisme, curve.mentalDelta, cap, rng, curve.varianceProb),
    discipline: applyDeltaWithCap(player.mental.discipline, curve.mentalDelta, cap, rng, curve.varianceProb),
  };

  return { ...player, technical, physical, mental };
}

/**
 * Applique le vieillissement à tous les joueurs d'un set.
 * Déterministe par seed — utilise le même rng dérivé pour toute la cohorte.
 */
export function applyAgingToAll(
  players: readonly Player[],
  newSeason: number,
  seed: string,
): readonly Player[] {
  const rng = createRng(`${seed}_aging_${newSeason}`);
  return players.map(p => applyAgingToPlayer(p, newSeason, rng));
}
