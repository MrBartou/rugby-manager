/**
 * Finances club — V0.6 phase 2.
 *
 * Modèle simple : un compte courant par club, alimenté par
 *  - une enveloppe annuelle (sponsors + TV, prise sur club.annualBudget)
 *  - des recettes de billetterie à chaque match à domicile
 * et débité par
 *  - la masse salariale (payroll), répartie sur les 26 journées de saison régulière
 *
 * Pas de banqueroute en V0.6 — le solde peut devenir négatif, c'est juste un warning.
 */

import type { Club, ClubId, ClubTier, Player } from '../types.js';

/** Nombre de journées de saison régulière sur lesquelles répartir le payroll. */
export const REGULAR_ROUNDS = 26;

/** Prix moyen du billet (euros). Constante V0.6, évoluera plus tard. */
const AVERAGE_TICKET_PRICE = 30;

/** Taux de remplissage minimum (perdants en série) et maximum (champions en forme). */
const FILL_RATE_FLOOR = 0.55;
const FILL_RATE_CEIL = 0.98;

export interface ClubFinances {
  /** Solde de trésorerie courante (euros). Peut être négatif. */
  readonly balance: number;
  /** Année de la saison en cours (ex: 2025 = 2025-26). */
  readonly seasonStart: number;
  /** Cumul des recettes de la saison en cours. */
  readonly seasonRevenue: number;
  /** Cumul des dépenses de la saison en cours. */
  readonly seasonExpenses: number;
  /** Bilans clôturés des saisons antérieures. */
  readonly pastSeasons: readonly PastSeasonFinances[];
}

export interface PastSeasonFinances {
  readonly seasonStart: number;
  readonly revenue: number;
  readonly expenses: number;
  /** Solde de fin de saison après clôture. */
  readonly closingBalance: number;
}

export interface FinancialMovement {
  readonly kind: 'PAYROLL' | 'MATCH_REVENUE' | 'SPONSOR' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  readonly amount: number;        // signé : revenu = positif, dépense = négatif
  readonly round?: number;
  readonly note?: string;
}

// =============================================================================
// Calculs
// =============================================================================

/** Payroll annuel = somme des salaires des joueurs actifs du club. */
export function computeAnnualPayroll(playersOfClub: readonly Player[]): number {
  let total = 0;
  for (const p of playersOfClub) {
    if (p.retired) continue;
    total += p.contract.annualSalary;
  }
  return total;
}

/** Charge salariale pour une journée de saison régulière (annuel / 26). */
export function computeRoundPayroll(playersOfClub: readonly Player[]): number {
  return Math.round(computeAnnualPayroll(playersOfClub) / REGULAR_ROUNDS);
}

/** Recette annuelle "sponsor + TV" — V0.6 : prise sur annualBudget du club. */
export function computeAnnualSponsorRevenue(club: Club): number {
  return club.annualBudget;
}

/**
 * Recette de billetterie d'un match à domicile.
 * fillRate dépend du tier (baseline) et du ratio victoires de la saison.
 */
export function computeMatchRevenue(
  club: Club,
  winsRatioThisSeason: number,
): number {
  const baseFill = baselineFillByTier(club.tier);
  const formBonus = (winsRatioThisSeason - 0.5) * 0.3;            // -0.15 .. +0.15
  const fill = Math.max(FILL_RATE_FLOOR, Math.min(FILL_RATE_CEIL, baseFill + formBonus));
  return Math.round(club.stadiumCapacity * fill * AVERAGE_TICKET_PRICE);
}

function baselineFillByTier(tier: ClubTier): number {
  switch (tier) {
    case 'GROS_BUDGET': return 0.92;
    case 'BUDGET_MOYEN': return 0.78;
    case 'PETIT_BUDGET': return 0.68;
  }
}

// =============================================================================
// Mutations (renvoient un nouveau ClubFinances, immutable)
// =============================================================================

export function emptyFinances(seasonStart: number, openingBalance: number): ClubFinances {
  return {
    balance: openingBalance,
    seasonStart,
    seasonRevenue: 0,
    seasonExpenses: 0,
    pastSeasons: [],
  };
}

export function applyMovement(f: ClubFinances, m: FinancialMovement): ClubFinances {
  const isRevenue = m.amount > 0;
  return {
    ...f,
    balance: f.balance + m.amount,
    seasonRevenue: f.seasonRevenue + (isRevenue ? m.amount : 0),
    seasonExpenses: f.seasonExpenses + (isRevenue ? 0 : -m.amount),
  };
}

/** Clôture la saison : pousse le bilan dans pastSeasons et reset les compteurs. */
export function closeSeason(f: ClubFinances, newSeasonStart: number): ClubFinances {
  const closing: PastSeasonFinances = {
    seasonStart: f.seasonStart,
    revenue: f.seasonRevenue,
    expenses: f.seasonExpenses,
    closingBalance: f.balance,
  };
  return {
    balance: f.balance,
    seasonStart: newSeasonStart,
    seasonRevenue: 0,
    seasonExpenses: 0,
    pastSeasons: [...f.pastSeasons, closing],
  };
}

// =============================================================================
// Initialisation : map clubId → ClubFinances
// =============================================================================

export function initFinancesForAllClubs(
  clubs: readonly Club[],
  seasonStart: number,
): Map<ClubId, ClubFinances> {
  const out = new Map<ClubId, ClubFinances>();
  for (const c of clubs) {
    // Solde d'ouverture = 30% du budget annuel (réserve de trésorerie réaliste)
    const opening = Math.round(c.annualBudget * 0.3);
    let f = emptyFinances(seasonStart, opening);
    // Encaissement immédiat de la sponsor/TV de la saison
    f = applyMovement(f, {
      kind: 'SPONSOR',
      amount: computeAnnualSponsorRevenue(c),
      note: 'Sponsors + TV (saison)',
    });
    out.set(c.id, f);
  }
  return out;
}
