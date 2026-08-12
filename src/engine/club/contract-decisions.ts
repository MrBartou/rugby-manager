/**
 * Décisions de renouvellement — V0.6 phase 3.
 *
 * Modèle distinct des HumanEvents : une décision touche le contrat (et donc le Player),
 * pas seulement le mood/relations.
 */

import type { Player, PlayerId } from '../types.js';
import { applyRenewal, expectedMarketSalary, proposeRenewal } from './contracts.js';
import type { SquadStatus } from './squad-status.js';
import type { RenewalOffer } from './contracts.js';

export type ContractDecisionOptionId = 'renew_current' | 'renew_plus' | 'release';

export interface ContractDecisionOption {
  readonly id: ContractDecisionOptionId;
  readonly label: string;
  readonly description: string;
  readonly offer?: RenewalOffer;          // pour renew_*, sinon undefined
}

export interface ContractDecision {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly playerLastName: string;
  readonly playerFirstName: string;
  readonly currentAnnualSalary: number;
  readonly age: number;
  readonly options: readonly ContractDecisionOption[];
}

export interface ContractDecisionResolution {
  readonly decisionId: string;
  readonly chosenOptionId: ContractDecisionOptionId;
  readonly outcome:
    | { readonly kind: 'RENEWED'; readonly newContract: Player['contract'] }
    | { readonly kind: 'RELEASED' }
    | { readonly kind: 'REFUSED'; readonly reason: string };
  /** Joueur mis à jour à appliquer dans les overrides. */
  readonly playerUpdate?: Player;
}

/**
 * Construit la décision pour un joueur en fin de contrat.
 * Le coach a 3 options : renouveler au tarif actuel, +20%, ou libérer.
 */
export function buildContractDecision(player: Player, currentSeason: number): ContractDecision {
  const age = currentSeason - Number(player.birthDate.slice(0, 4));
  const currentSalary = player.contract.annualSalary;
  return {
    id: `renew_${currentSeason}_${player.id}`,
    playerId: player.id,
    playerLastName: player.lastName,
    playerFirstName: player.firstName,
    currentAnnualSalary: currentSalary,
    age,
    options: [
      {
        id: 'renew_current',
        label: 'Prolonger au tarif actuel',
        description: `${formatEuros(currentSalary)}/an sur 2 ans. Risque de refus si le joueur s'est valorisé.`,
        offer: { years: 2, annualSalary: currentSalary },
      },
      {
        id: 'renew_plus',
        label: 'Prolonger avec +20%',
        description: `${formatEuros(Math.round(currentSalary * 1.2))}/an sur 3 ans.`,
        offer: { years: 3, annualSalary: Math.round(currentSalary * 1.2) },
      },
      {
        id: 'release',
        label: 'Le laisser partir libre',
        description: 'Le joueur quitte le club à la fin de la saison.',
      },
    ],
  };
}

/**
 * Résout une décision : confronte l'offre du coach à la demande du joueur via proposeRenewal.
 */
export function resolveContractDecision(
  decision: ContractDecision,
  optionId: ContractDecisionOptionId,
  player: Player,
  currentSeason: number,
  seed: string,
  /** V0.50 — rôle annoncé, qui pèse sur ce que le joueur réclame. */
  squadStatus?: SquadStatus,
): ContractDecisionResolution {
  if (optionId === 'release') {
    return {
      decisionId: decision.id,
      chosenOptionId: optionId,
      outcome: { kind: 'RELEASED' },
    };
  }

  const opt = decision.options.find(o => o.id === optionId);
  if (!opt || !opt.offer) {
    return {
      decisionId: decision.id,
      chosenOptionId: optionId,
      outcome: { kind: 'REFUSED', reason: 'Option invalide' },
    };
  }

  const response = proposeRenewal(player, opt.offer, currentSeason, seed, squadStatus);
  if (response.kind === 'ACCEPT') {
    const updated = applyRenewal(player, opt.offer, currentSeason);
    return {
      decisionId: decision.id,
      chosenOptionId: optionId,
      outcome: { kind: 'RENEWED', newContract: updated.contract },
      playerUpdate: updated,
    };
  }
  if (response.kind === 'REFUSE') {
    return {
      decisionId: decision.id,
      chosenOptionId: optionId,
      outcome: { kind: 'REFUSED', reason: response.reason },
    };
  }
  // COUNTER : le joueur veut plus → V0.6 simple : refus interprété (option +20% ne suffit pas)
  return {
    decisionId: decision.id,
    chosenOptionId: optionId,
    outcome: {
      kind: 'REFUSED',
      reason: `Le joueur attend ~${formatEuros(expectedMarketSalary(player, currentSeason))}/an.`,
    },
  };
}

function formatEuros(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}
