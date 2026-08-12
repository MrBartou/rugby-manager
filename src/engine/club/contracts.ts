/**
 * Contrats — V0.6 phase 3.
 *
 * Trois fonctions pures :
 *  - detectExpiringContracts : joueurs en dernière année (endSeason === currentSeason)
 *  - proposeRenewal : décide accept / refuse / counter selon mood, age, niveau
 *  - applyRenewal : produit un Player avec contrat mis à jour
 *
 * Et expireContracts : à appeler au rollover, marque freeAgent ceux dont le contrat
 * a pris fin sans renouvellement.
 */

import { createRng } from '../rng.js';
import { salaryExpectation, type SquadStatus } from './squad-status.js';
import type { Contract, Player } from '../types.js';

export interface RenewalOffer {
  readonly years: number;                 // durée proposée (1-5)
  readonly annualSalary: number;          // salaire proposé
}

export type RenewalResponse =
  | { readonly kind: 'ACCEPT' }
  | { readonly kind: 'REFUSE'; readonly reason: string }
  | { readonly kind: 'COUNTER'; readonly counterOffer: RenewalOffer; readonly reason: string };

/** Joueurs dont le contrat se termine à la fin de la saison courante. */
export function detectExpiringContracts(
  players: readonly Player[],
  currentSeason: number,
): readonly Player[] {
  return players.filter(p =>
    !p.retired &&
    !p.freeAgent &&
    p.contract.endSeason === currentSeason,
  );
}

/** Salaire "marché" attendu par le joueur, basé sur niveau approximatif et âge. */
export function expectedMarketSalary(player: Player, currentSeason: number): number {
  const overall = approximateOverall(player);
  const age = currentSeason - Number(player.birthDate.slice(0, 4));
  // Base : 50k à overall 50, +10k par point au-dessus
  let base = 50_000 + Math.max(0, overall - 50) * 10_000;
  // Pénalité âge à partir de 32
  if (age >= 32) base *= Math.max(0.5, 1 - (age - 31) * 0.08);
  return Math.round(base / 1000) * 1000; // arrondi au millier
}

/**
 * Réponse du joueur à une proposition de renouvellement.
 * Logique : compare au salaire attendu, ajuste selon mood (insatisfait → exigeant)
 * et âge (vétéran → plus accommodant).
 */
export function proposeRenewal(
  player: Player,
  offer: RenewalOffer,
  currentSeason: number,
  seed: string,
  /**
   * V0.50 — rôle annoncé dans la hiérarchie de l'effectif.
   *
   * Sans lui, le statut ne pesait que sur le moral : on pouvait promettre à
   * tout le monde d'être cadre sans que cela coûte un centime. Un cadre se
   * sait cadre et le fait payer ; un joueur qu'on écarte sait qu'il n'a pas de
   * levier.
   */
  squadStatus?: SquadStatus,
): RenewalResponse {
  const expected = expectedMarketSalary(player, currentSeason)
    * (squadStatus !== undefined ? salaryExpectation(squadStatus) : 1);
  const moodFactor = (player.dynamic.mood - 60) / 100;          // -0.6 .. +0.4
  const desired = Math.round(expected * (1 - moodFactor * 0.3));
  const age = currentSeason - Number(player.birthDate.slice(0, 4));
  const tolerance = age >= 33 ? 0.85 : 0.95;                    // vétéran accepte plus bas

  if (offer.annualSalary >= desired * tolerance) {
    return { kind: 'ACCEPT' };
  }
  // Si l'offre est très basse, refus net
  if (offer.annualSalary < desired * 0.6) {
    return {
      kind: 'REFUSE',
      reason: `Offre jugée insultante (attendait ~${formatEuros(desired)}).`,
    };
  }
  // Sinon contre-proposition
  const rng = createRng(`${seed}_renew_${player.id}`);
  const counterSalary = Math.round(desired * (1 + rng.next() * 0.05) / 1000) * 1000;
  return {
    kind: 'COUNTER',
    counterOffer: { years: offer.years, annualSalary: counterSalary },
    reason: `Souhaite ${formatEuros(counterSalary)}/an.`,
  };
}

/** Applique un nouveau contrat au joueur. */
export function applyRenewal(
  player: Player,
  offer: RenewalOffer,
  currentSeason: number,
): Player {
  const newContract: Contract = {
    startSeason: currentSeason,
    endSeason: currentSeason + offer.years,
    annualSalary: offer.annualSalary,
  };
  return { ...player, contract: newContract };
}

/**
 * À appeler au rollover : flag freeAgent les joueurs dont le contrat a expiré.
 * Conditions : !retired, !freeAgent, endSeason < currentSeason (saison qui commence).
 */
export function expireContracts(
  players: readonly Player[],
  newSeason: number,
): { readonly players: readonly Player[]; readonly freeAgents: readonly Player['id'][] } {
  const freeAgents: Player['id'][] = [];
  const updated = players.map<Player>(p => {
    if (p.retired || p.freeAgent) return p;
    if (p.contract.endSeason < newSeason) {
      freeAgents.push(p.id);
      return { ...p, freeAgent: true };
    }
    return p;
  });
  return { players: updated, freeAgents };
}

// =============================================================================
// Helpers internes
// =============================================================================

function approximateOverall(p: Player): number {
  const t = p.technical;
  const ph = p.physical;
  const m = p.mental;
  const techAvg = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const physAvg = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const mentAvg = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (techAvg + physAvg + mentAvg) / 3;
}

function formatEuros(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}
