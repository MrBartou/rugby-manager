/**
 * Finances club — V0.6 phase 2.
 *
 * Modèle simple : un compte courant par club, alimenté par
 *  - une enveloppe annuelle (sponsors + TV, prise sur club.annualBudget)
 *  - des recettes de billetterie à chaque match à domicile, calculées par
 *    `club-management.ts` pour tous les clubs sans exception
 * et débité par
 *  - la masse salariale (payroll), répartie sur les journées de saison régulière
 *
 * Pas de banqueroute en V0.6 — le solde peut devenir négatif, c'est juste un warning.
 */

import { salaryForSeason } from './contract-clauses.js';
import type { Club, ClubId, Player } from '../types.js';

/**
 * Nombre de journées de saison régulière sur lesquelles répartir le payroll.
 *
 * C'est le calendrier du Top 14. La Pro D2 en joue trente : lui appliquer ce
 * chiffre laissait quatre journées de salaires jamais facturées, soit un cadeau
 * de 15 % de masse salariale à chaque club de la division.
 */
export const REGULAR_ROUNDS = 26;

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
  /**
   * `BONUS` est distinct de `PAYROLL` depuis la V0.64 : une prime se déclenche
   * ou non, alors qu'un salaire tombe. Les confondre aurait rendu illisible la
   * seule question qui compte au bilan, celle de savoir si les clauses signées
   * l'été ont coûté ce qu'on avait prévu.
   */
  readonly kind: 'PAYROLL' | 'BONUS' | 'MATCH_REVENUE' | 'SPONSOR' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  readonly amount: number;        // signé : revenu = positif, dépense = négatif
  readonly round?: number;
  readonly note?: string;
}

// =============================================================================
// Calculs
// =============================================================================

/**
 * Payroll annuel = somme des salaires **en vigueur** des joueurs actifs.
 *
 * La saison est un paramètre obligatoire depuis la V0.64, et non une valeur par
 * défaut : un contrat progressif ne coûte pas la même chose la première et la
 * quatrième année, et une valeur par défaut aurait laissé la moitié des appels
 * facturer le salaire de la signature pendant cinq ans sans que rien ne casse.
 * C'est le défaut favori de ce projet, on le ferme à la compilation.
 */
export function computeAnnualPayroll(playersOfClub: readonly Player[], season: number): number {
  let total = 0;
  for (const p of playersOfClub) {
    if (p.retired) continue;
    total += salaryForSeason(p.contract, season);
  }
  return total;
}

/**
 * Charge salariale d'une journée de saison régulière : annuel divisé par le
 * nombre de journées de la division, et non par un 26 valable pour le seul
 * Top 14.
 */
export function computeRoundPayroll(
  playersOfClub: readonly Player[],
  season: number,
  regularRounds: number = REGULAR_ROUNDS,
): number {
  const rounds = regularRounds > 0 ? regularRounds : REGULAR_ROUNDS;
  return Math.round(computeAnnualPayroll(playersOfClub, season) / rounds);
}

/** Recette annuelle "sponsor + TV" — V0.6 : prise sur annualBudget du club. */
export function computeAnnualSponsorRevenue(club: Club): number {
  return club.annualBudget;
}

/*
 * V0.60 : `computeMatchRevenue` a disparu.
 *
 * Elle vendait le billet trente euros en dur et ignorait le stade, la politique
 * tarifaire et les derbys, alors que `club-management.ts` savait tout cela
 * depuis la V0.45 mais ne servait qu'au club dirigé. Deux billetteries pour un
 * même championnat produisaient des recettes que rien ne rendait comparables.
 * Tout passe désormais par `matchdayRevenue`.
 */

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

// =============================================================================
// La clôture d'exercice, pour tout le championnat
// =============================================================================

/**
 * Ce que chaque club encaisse en passant à la saison suivante : V0.62.
 *
 * Le bloc vivait dans `App.tsx`. Il porte une règle et non du câblage : **le
 * club dirigé encaisse selon sa politique commerciale**, sponsors majorés par
 * la campagne, recettes de boutique, et coût de cette même campagne ; les clubs
 * gérés par la machine gardent l'enveloppe sèche de leur budget annuel.
 *
 * Sans cette asymétrie, la direction du club (V0.45) serait un écran de
 * réglages sans conséquence : investir en marketing ne rapporterait rien, et le
 * choix se ferait tout seul.
 */
export interface SeasonCloseInput {
  readonly previous: ReadonlyMap<ClubId, ClubFinances>;
  readonly clubs: readonly Club[];
  readonly playerClubId: ClubId;
  readonly newSeason: number;
  /** Recettes commerciales du club dirigé, déjà calculées par sa direction. */
  readonly playerClubCommercial: {
    readonly sponsors: number;
    readonly merchandising: number;
    /** Coût de la campagne, en positif : il sera débité. */
    readonly campaignCost: number;
  };
}

export function closeSeasonForAllClubs(input: SeasonCloseInput): Map<ClubId, ClubFinances> {
  const out = new Map<ClubId, ClubFinances>();

  for (const [clubId, previous] of input.previous) {
    const club = input.clubs.find(c => c.id === clubId);
    if (!club) continue;

    let next = closeSeason(previous, input.newSeason);

    if (clubId === input.playerClubId) {
      next = applyMovement(next, {
        kind: 'SPONSOR',
        amount: input.playerClubCommercial.sponsors,
        note: 'Sponsors + TV (saison)',
      });
      next = applyMovement(next, {
        kind: 'SPONSOR',
        amount: input.playerClubCommercial.merchandising,
        note: 'Boutique et merchandising',
      });
      if (input.playerClubCommercial.campaignCost > 0) {
        next = applyMovement(next, {
          kind: 'TRANSFER_OUT',
          amount: -input.playerClubCommercial.campaignCost,
          note: 'Campagne marketing',
        });
      }
    } else {
      next = applyMovement(next, {
        kind: 'SPONSOR',
        amount: club.annualBudget,
        note: 'Sponsors + TV (saison)',
      });
    }

    out.set(clubId, next);
  }

  return out;
}
