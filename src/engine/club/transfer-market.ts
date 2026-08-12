/**
 * Marché des transferts — V0.6 phase 4.
 *
 * Modèle minimal :
 *  - Pool de free agents : tous les Player avec freeAgent=true
 *  - Le club joueur peut signer un free agent (offre directe)
 *  - L'IA peut proposer d'acheter un joueur du club joueur (offres entrantes)
 *  - Pas de réponses concurrentielles (pas de surenchères) en V0.6
 */

import { createRng } from '../rng.js';
import type { Club, ClubId, Player, PlayerId } from '../types.js';
import { applyRenewal, expectedMarketSalary, proposeRenewal } from './contracts.js';
import type { RenewalOffer } from './contracts.js';

// =============================================================================
// Free agents
// =============================================================================

export function listFreeAgents(allPlayers: readonly Player[]): readonly Player[] {
  return allPlayers.filter(p => p.freeAgent && !p.retired);
}

export interface SigningOffer {
  readonly years: number;
  readonly annualSalary: number;
  readonly signingBonus?: number;
}

export type SigningResponse =
  | { readonly kind: 'ACCEPT'; readonly updatedPlayer: Player }
  | { readonly kind: 'REFUSE'; readonly reason: string };

/**
 * Le free agent évalue l'offre selon les mêmes règles qu'un renouvellement.
 * En cas d'acceptation, son contrat est mis à jour ET son clubId change.
 */
export function offerToFreeAgent(
  player: Player,
  newClubId: ClubId,
  offer: SigningOffer,
  currentSeason: number,
  seed: string,
): SigningResponse {
  if (!player.freeAgent || player.retired) {
    return { kind: 'REFUSE', reason: 'Joueur indisponible.' };
  }
  const renewalOffer: RenewalOffer = { years: offer.years, annualSalary: offer.annualSalary };
  const response = proposeRenewal(player, renewalOffer, currentSeason, seed);
  if (response.kind !== 'ACCEPT') {
    return {
      kind: 'REFUSE',
      reason: response.kind === 'REFUSE' ? response.reason : `Souhaite ${formatEuros(expectedMarketSalary(player, currentSeason))}/an.`,
    };
  }
  const renewed = applyRenewal(player, renewalOffer, currentSeason);
  const updatedPlayer: Player = {
    ...renewed,
    clubId: newClubId,
    freeAgent: false,
    ...(offer.signingBonus !== undefined ? {
      contract: { ...renewed.contract, signingBonus: offer.signingBonus },
    } : {}),
  };
  return { kind: 'ACCEPT', updatedPlayer };
}

// =============================================================================
// Offres entrantes IA
// =============================================================================

export interface IncomingOffer {
  readonly id: string;
  readonly fromClubId: ClubId;
  readonly fromClubName: string;
  readonly playerId: PlayerId;
  readonly playerLastName: string;
  readonly transferAmount: number;          // somme proposée au club vendeur
  readonly proposedAnnualSalary: number;    // salaire que l'acheteur compte donner au joueur
  readonly proposedYears: number;
  readonly atRound: number;
}

export interface GenerateIncomingOffersInput {
  readonly playerClubId: ClubId;
  readonly playerClubRoster: readonly Player[];
  readonly otherClubs: readonly Club[];
  readonly round: number;
  readonly currentSeason: number;
  readonly seed: string;
  /**
   * V0.49 — joueurs placés sur la liste des transferts après une demande de
   * départ acceptée.
   *
   * Sans cela, « accepter la demande » n'était qu'une phrase : rien ne venait
   * jamais, et le joueur restait au club de toute façon. Ceux-là échappent aux
   * critères habituels — un club se déplace pour un joueur qui veut partir,
   * même s'il n'est pas international et qu'il lui reste trois ans de contrat.
   */
  readonly wantAwayIds?: readonly PlayerId[];
}

/**
 * Génère 0-1 offre entrante par round sur un joueur du club joueur.
 * Conditions : joueur d'overall ≥ 75, en milieu/fin de contrat, club acheteur de tier ≥ moyen.
 */
export function generateIncomingOffers(input: GenerateIncomingOffersInput): readonly IncomingOffer[] {
  const rng = createRng(`${input.seed}_offers_${input.round}`);
  const wantAway = new Set(input.wantAwayIds ?? []);

  // Filtre des joueurs "intéressants"
  const candidates = input.playerClubRoster.filter(p =>
    !p.retired && !p.freeAgent && (
      wantAway.has(p.id) || (
        approximateOverall(p) >= 75 &&
        p.contract.endSeason - input.currentSeason <= 2
      )
    ),
  );
  if (candidates.length === 0) return [];

  // Probabilité d'une offre ce round : 8%, le double quand quelqu'un est
  // ouvertement sur le marché — son agent travaille pour lui.
  const listed = candidates.filter(p => wantAway.has(p.id));
  if (!rng.nextBool(listed.length > 0 ? 0.16 : 0.08)) return [];

  // Une liste des transferts qui ne sort jamais le joueur listé ne servirait à
  // rien : il passe devant deux fois sur trois.
  const pool = listed.length > 0 && rng.nextBool(0.65) ? listed : candidates;
  const target = rng.pick(pool);
  const buyers = input.otherClubs.filter(c =>
    c.id !== input.playerClubId &&
    (c.tier === 'GROS_BUDGET' || c.tier === 'BUDGET_MOYEN'),
  );
  if (buyers.length === 0) return [];
  const buyer = rng.pick(buyers);

  const expectedSal = expectedMarketSalary(target, input.currentSeason);
  const proposedSalary = Math.round(expectedSal * (1.05 + rng.next() * 0.15));   // +5..+20%
  const yearsLeft = Math.max(1, target.contract.endSeason - input.currentSeason);
  // Indemnité de transfert : ~2x salaire annuel × années restantes, avec variance
  const transferAmount = Math.round(target.contract.annualSalary * yearsLeft * (1.5 + rng.next()));

  return [{
    id: `offer_r${input.round}_${target.id}`,
    fromClubId: buyer.id,
    fromClubName: buyer.name,
    playerId: target.id,
    playerLastName: target.lastName,
    transferAmount,
    proposedAnnualSalary: proposedSalary,
    proposedYears: rng.nextInt(2, 4),
    atRound: input.round,
  }];
}

// =============================================================================
// Résolution d'une offre entrante
// =============================================================================

export interface AcceptedOfferResult {
  readonly kind: 'ACCEPTED';
  readonly transferAmount: number;
  readonly updatedPlayer: Player;            // clubId pointe vers fromClubId
}

export interface RejectedOfferResult {
  readonly kind: 'REJECTED';
}

export type IncomingOfferResolution = AcceptedOfferResult | RejectedOfferResult;

export function resolveIncomingOffer(
  offer: IncomingOffer,
  player: Player,
  accept: boolean,
  currentSeason: number,
): IncomingOfferResolution {
  if (!accept) return { kind: 'REJECTED' };
  // Le joueur signe automatiquement avec l'acheteur (V0.6 simplification)
  const updatedPlayer: Player = {
    ...player,
    clubId: offer.fromClubId,
    contract: {
      startSeason: currentSeason,
      endSeason: currentSeason + offer.proposedYears,
      annualSalary: offer.proposedAnnualSalary,
    },
  };
  return { kind: 'ACCEPTED', transferAmount: offer.transferAmount, updatedPlayer };
}

// =============================================================================
// Helpers
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
