/**
 * La forme d'un transfert : V0.64.
 *
 * Une offre n'avait qu'un chiffre, l'indemnité, et il fallait l'avoir en caisse
 * le jour même. Un club pauvre ne pouvait donc jamais acheter, et un club riche
 * n'avait rien à négocier : il payait, ou il passait son tour.
 *
 * Deux instruments changent cela, et ce sont ceux que le rugby professionnel
 * utilise vraiment :
 *
 *  - le **paiement échelonné**, qui déplace la dépense dans le temps ;
 *  - le **pourcentage à la revente**, qui laisse au vendeur une part du prochain
 *    transfert.
 *
 * ## Le vendeur ne compte pas en euros, il compte en euros d'aujourd'hui
 *
 * C'est la seule idée du module. Trois millions étalés sur trois ans valent
 * moins que trois millions comptant, et un club au bord du gouffre les escompte
 * bien plus durement qu'un club prospère : il a besoin de la trésorerie
 * maintenant, pas d'une créance. Le pourcentage à la revente, lui, vaut
 * l'inverse : c'est un pari sur l'avenir du joueur, que seul un vendeur qui n'a
 * pas le couteau sous la gorge accepte de prendre.
 *
 * De là vient la texture du mercato : un club en difficulté brade au comptant,
 * un club solide se laisse convaincre par un montage.
 */

import type { ClubId, PlayerId } from '../types.js';
import { MAX_SELL_ON } from './contract-clauses.js';

// =============================================================================
// Les termes d'un accord entre clubs
// =============================================================================

export interface DealTerms {
  /** Indemnité nominale, toutes échéances confondues. */
  readonly fee: number;
  /** Nombre d'annuités, 1 = comptant. Plafonné à quatre. */
  readonly instalments: number;
  /** Part de la revente laissée au vendeur, 0 à 0,30. */
  readonly sellOn: number;
}

/** Au-delà de quatre ans, aucun club n'accepte de porter la créance. */
export const MAX_INSTALMENTS = 4;

export function normaliseTerms(terms: DealTerms): DealTerms {
  return {
    fee: Math.max(0, Math.round(terms.fee)),
    instalments: Math.max(1, Math.min(MAX_INSTALMENTS, Math.round(terms.instalments))),
    sellOn: Math.max(0, Math.min(MAX_SELL_ON, terms.sellOn)),
  };
}

// =============================================================================
// Ce que l'accord vaut pour le vendeur
// =============================================================================

/**
 * Taux d'escompte annuel du vendeur.
 *
 * Un club à flot compare l'échelonnement à un placement, et le taux reste
 * modeste. Un club dans le rouge compare à ses fins de mois : il escompte à un
 * quart par an, ce qui revient à refuser tout montage sérieux. C'est voulu, et
 * c'est ce qui rend une vente à un club en détresse différente d'une autre.
 */
export function discountRate(sellerBalance: number): number {
  if (sellerBalance < 0) return 0.25;
  if (sellerBalance < 3_000_000) return 0.14;
  return 0.08;
}

/**
 * Ce que le vendeur touche vraiment, ramené à aujourd'hui.
 *
 * La première annuité tombe le jour de la signature : elle n'est pas escomptée.
 * Ce sont les suivantes qui coûtent au vendeur.
 */
export function presentValueOfFee(
  fee: number,
  instalments: number,
  rate: number,
): number {
  const n = Math.max(1, Math.min(MAX_INSTALMENTS, Math.round(instalments)));
  const annuity = fee / n;
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += annuity / (1 + rate) ** i;
  }
  return Math.round(total);
}

/**
 * Ce que le vendeur met derrière une part de revente.
 *
 * La moitié de la part consentie, appliquée à l'indemnité du jour : le joueur
 * ne sera peut-être jamais revendu, et s'il l'est, ce sera à un prix inconnu.
 *
 * Le coefficient a d'abord été posé à 1,1, en raisonnant sur un joueur revendu
 * plus cher qu'acheté. Le test de sûreté du module a montré ce que cela ouvrait :
 * quatre annuités et trente pour cent de revente valaient au vendeur 22 % de
 * plus que le comptant, c'est-à-dire qu'on achetait au rabais avec des
 * promesses. À 0,5, la part de revente reste un levier réel sans remplacer
 * l'argent.
 */
export function sellOnWorth(fee: number, sellOn: number, sellerBalance: number): number {
  if (sellOn <= 0) return 0;
  // Un club qui a besoin de liquide ne mange pas de promesses.
  const appetite = sellerBalance < 0 ? 0.35 : sellerBalance < 3_000_000 ? 0.7 : 1;
  return Math.round(fee * Math.min(MAX_SELL_ON, sellOn) * 0.5 * appetite);
}

/**
 * L'offre telle que le vendeur la lit : un seul chiffre, comparable à sa
 * demande.
 *
 * C'est ce chiffre, et non `fee`, que la décision du club compare au prix
 * demandé. Tout le reste du moteur de transfert peut donc ignorer l'existence
 * des montages.
 */
export function effectiveFee(terms: DealTerms, sellerBalance: number): number {
  const t = normaliseTerms(terms);
  return presentValueOfFee(t.fee, t.instalments, discountRate(sellerBalance))
    + sellOnWorth(t.fee, t.sellOn, sellerBalance);
}

/** Ce que l'acheteur sort de sa trésorerie le jour de la signature. */
export function upfrontCost(terms: DealTerms): number {
  const t = normaliseTerms(terms);
  return Math.round(t.fee / t.instalments);
}

// =============================================================================
// Les échéances à venir
// =============================================================================

export type InstalmentReason = 'ECHEANCE' | 'REVENTE';

export interface TransferInstalment {
  readonly id: string;
  readonly payerClubId: ClubId;
  readonly payeeClubId: ClubId;
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly amount: number;
  /** Saison au cours de laquelle l'échéance tombe. */
  readonly season: number;
  readonly reason: InstalmentReason;
}

/**
 * Les annuités restant dues après la signature.
 *
 * La première est déjà payée : elle ne figure pas au registre. Un registre qui
 * contiendrait l'échéance du jour la ferait payer deux fois, une fois au
 * comptant et une fois au rollover.
 */
export function scheduleInstalments(input: {
  readonly terms: DealTerms;
  readonly payerClubId: ClubId;
  readonly payeeClubId: ClubId;
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly season: number;
}): readonly TransferInstalment[] {
  const t = normaliseTerms(input.terms);
  if (t.instalments <= 1 || t.fee <= 0) return [];
  const annuity = Math.round(t.fee / t.instalments);
  const out: TransferInstalment[] = [];
  for (let i = 1; i < t.instalments; i++) {
    out.push({
      id: `ech_${input.playerId}_${input.season}_${i}`,
      payerClubId: input.payerClubId,
      payeeClubId: input.payeeClubId,
      playerId: input.playerId,
      playerName: input.playerName,
      amount: annuity,
      season: input.season + i,
      reason: 'ECHEANCE',
    });
  }
  return out;
}

/** Une créance née d'une revente, due immédiatement. */
export function sellOnInstalment(input: {
  readonly payerClubId: ClubId;
  readonly payeeClubId: ClubId;
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly amount: number;
  readonly season: number;
}): TransferInstalment {
  return {
    id: `revente_${input.playerId}_${input.season}`,
    payerClubId: input.payerClubId,
    payeeClubId: input.payeeClubId,
    playerId: input.playerId,
    playerName: input.playerName,
    amount: Math.max(0, Math.round(input.amount)),
    season: input.season,
    reason: 'REVENTE',
  };
}

export interface LedgerSettlement {
  /** Ce qui a été soldé cette saison. */
  readonly settled: readonly TransferInstalment[];
  /** Ce qu'il reste à devoir. */
  readonly remaining: readonly TransferInstalment[];
  /** Solde net pour un club donné, dépenses en négatif. */
  readonly netFor: (clubId: ClubId) => number;
}

/**
 * Solde les échéances arrivées à terme.
 *
 * Appelée au passage de saison, une fois, pour tout le monde. Les échéances des
 * clubs gérés par la machine sont soldées aussi : sans cela, une créance due au
 * club dirigé ne lui serait jamais versée, et l'échelonnement ne serait
 * avantageux que dans un sens.
 */
export function settleDueInstalments(
  ledger: readonly TransferInstalment[],
  season: number,
): LedgerSettlement {
  const settled = ledger.filter(i => i.season <= season);
  const remaining = ledger.filter(i => i.season > season);
  return {
    settled,
    remaining,
    netFor: (clubId: ClubId) => settled.reduce(
      (sum, i) => sum
        + (i.payeeClubId === clubId ? i.amount : 0)
        - (i.payerClubId === clubId ? i.amount : 0),
      0,
    ),
  };
}

/** Ce qu'un club doit encore, toutes échéances confondues. */
export function outstandingDebt(
  ledger: readonly TransferInstalment[],
  clubId: ClubId,
): number {
  return ledger
    .filter(i => i.payerClubId === clubId)
    .reduce((sum, i) => sum + i.amount, 0);
}

/**
 * Une créance survit-elle au départ du joueur ?
 *
 * Oui, et c'est important : le club qui a vendu à crédit continue d'être payé
 * même si le joueur repart ailleurs l'été suivant. Ce qui disparaît, en
 * revanche, c'est la dette d'un club qui n'existe plus dans le championnat.
 */
export function pruneLedger(
  ledger: readonly TransferInstalment[],
  knownClubIds: ReadonlySet<ClubId>,
): readonly TransferInstalment[] {
  return ledger.filter(
    i => knownClubIds.has(i.payerClubId) && knownClubIds.has(i.payeeClubId),
  );
}
