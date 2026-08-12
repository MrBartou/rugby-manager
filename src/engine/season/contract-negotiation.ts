/**
 * Négociation de contrat avec le président — V0.43.
 *
 * Signer dans un club était un clic. Le board fixait un objectif, décidait de
 * la durée de patience — deux saisons, en dur dans le code — et le manager
 * n'avait rien à dire. La messagerie de V0.42 a rendu cette asymétrie visible :
 * le président écrit, on ne répond jamais.
 *
 * ## Ce qui se négocie, et pourquoi
 *
 * Trois termes seulement, mais chacun échange une contrepartie réelle :
 *
 *  - **la durée** achète du temps. Un long contrat rend le board plus patient ;
 *    c'est la seule manière de bâtir sur trois ans dans un club qui licencie ;
 *  - **le salaire** est un aveu d'ambition. Se payer cher durcit la mission —
 *    un président qui casse sa tirelire n'accepte pas une saison de transition ;
 *  - **le budget de transfert** est arraché au détriment des deux autres : ce
 *    qui part au mercato ne va pas dans la poche de l'entraîneur.
 *
 * Il n'y a donc pas de bonne réponse, seulement un arbitrage. C'est ce qui
 * distingue une négociation d'un menu d'options.
 *
 * ## Ce que le président accepte
 *
 * Sa souplesse vient de l'écart entre la réputation du manager et la stature du
 * club. Une gloire qui descend d'un cran obtient ce qu'elle veut ; un inconnu
 * qui monte n'obtient rien. Sans cet écart, négocier serait un distributeur : on
 * demanderait toujours le maximum.
 */

import type { Club } from '../types.js';
import { clubStature } from './manager-career.js';
import type { ManagerReputation } from './manager-reputation.js';
import type { ObjectiveKind, SeasonObjective } from './board-objective.js';

// =============================================================================
// Le contrat
// =============================================================================

export interface ManagerContract {
  /** Saison de signature. */
  readonly fromSeason: number;
  /** Durée en saisons. */
  readonly seasons: number;
  /** Salaire annuel, en euros. */
  readonly salary: number;
  /** Enveloppe de transfert promise pour la première intersaison, en euros. */
  readonly transferBudget: number;
  /**
   * Saisons d'échec que le board tolère avant de remercier.
   *
   * Remplace le `consecutiveFailures >= 2` codé en dur : c'est précisément ce
   * qu'on vient acheter en signant long.
   */
  readonly patience: number;
}

/** Contrat par défaut, pour une carrière commencée avant que cela n'existe. */
export function defaultContract(fromSeason: number): ManagerContract {
  return { fromSeason, seasons: 3, salary: 300_000, transferBudget: 0, patience: 2 };
}

// =============================================================================
// La marge de manœuvre
// =============================================================================

export const DURATION_OPTIONS: readonly number[] = [1, 2, 3, 5];

export type SalaryTier = 'MODESTE' | 'STANDARD' | 'ELEVE';
export type BudgetDemand = 'AUCUNE' | 'RAISONNABLE' | 'AMBITIEUSE';

export const SALARY_TIER_LABEL: Readonly<Record<SalaryTier, string>> = {
  MODESTE: 'Sous le marché',
  STANDARD: 'Au tarif du poste',
  ELEVE: 'Au-dessus du marché',
};

export const BUDGET_DEMAND_LABEL: Readonly<Record<BudgetDemand, string>> = {
  AUCUNE: 'Aucune exigence',
  RAISONNABLE: 'Une enveloppe de renfort',
  AMBITIEUSE: 'Les moyens de viser haut',
};

export interface Demands {
  readonly seasons: number;
  readonly salary: SalaryTier;
  readonly budget: BudgetDemand;
}

export const MODEST_DEMANDS: Demands = { seasons: 2, salary: 'STANDARD', budget: 'AUCUNE' };

/**
 * Coût de chaque demande, en « points de crédit » auprès du président.
 *
 * Deux saisons au tarif du poste sans rien réclamer coûte zéro : c'est le
 * contrat que n'importe qui obtient. Tout le reste se paie.
 */
function demandCost(d: Demands): number {
  const duration = d.seasons <= 2 ? 0 : d.seasons === 3 ? 3 : 8;
  const salary = d.salary === 'MODESTE' ? -3 : d.salary === 'STANDARD' ? 0 : 5;
  const budget = d.budget === 'AUCUNE' ? 0 : d.budget === 'RAISONNABLE' ? 4 : 9;
  return duration + salary + budget;
}

/**
 * Crédit dont dispose le manager auprès de ce président.
 *
 * Un titre pèse lourd : c'est la seule ligne d'un CV qu'un board ne discute
 * pas. L'expérience compte moins mais compte — un habitué du métier n'est pas
 * traité comme un débutant à réputation égale.
 */
export function negotiationCredit(
  club: Club,
  reputation: ManagerReputation,
): number {
  const gap = reputation.score - clubStature(club);
  const raw = gap * 0.55 + reputation.titlesWon * 6 + Math.min(6, reputation.seasonsManaged);
  // Jamais négatif : le club vient de proposer le poste, il ne va pas refuser
  // le contrat de base à celui qu'il a lui-même appelé. Un crédit nul veut dire
  // « rien de plus que le minimum », pas « même le minimum se discute ».
  return Math.max(0, Math.round(raw));
}

export interface NegotiationOutcome {
  readonly accepted: boolean;
  /** Contre-proposition du président quand il refuse. */
  readonly counter?: Demands;
  /** Ce qu'il répond, en une phrase. */
  readonly reaction: string;
}

/**
 * Réponse du président aux exigences du manager.
 *
 * Un refus n'est jamais une porte fermée : il revient avec ce qu'il est prêt à
 * consentir. Faire échouer la signature laisserait le manager sans club sur un
 * mauvais clic, ce qui n'a rien d'un choix intéressant.
 */
export function negotiate(
  club: Club,
  reputation: ManagerReputation,
  demands: Demands,
): NegotiationOutcome {
  const credit = negotiationCredit(club, reputation);
  const cost = demandCost(demands);

  if (cost <= credit) {
    return {
      accepted: true,
      reaction: cost <= 0
        ? `${club.name} valide ces conditions sans discuter.`
        : `${club.name} accepte vos conditions — le bureau vous attend.`,
    };
  }

  return {
    accepted: false,
    counter: concede(demands, credit),
    reaction: credit < 0
      ? `${club.name} vous rappelle que c'est le club qui vous fait une faveur.`
      : `${club.name} ne peut pas aller jusque-là, mais fait un pas vers vous.`,
  };
}

/**
 * Ce que le président consent, en rognant d'abord ce qui lui coûte le plus.
 *
 * L'ordre n'est pas neutre : le budget de transfert sort du même portefeuille
 * que les joueurs, il tombe donc en premier. La durée, qui ne coûte rien
 * immédiatement, résiste le mieux.
 */
function concede(demands: Demands, credit: number): Demands {
  let d = demands;
  if (demandCost(d) <= credit) return d;

  if (d.budget === 'AMBITIEUSE') d = { ...d, budget: 'RAISONNABLE' };
  if (demandCost(d) <= credit) return d;

  if (d.salary === 'ELEVE') d = { ...d, salary: 'STANDARD' };
  if (demandCost(d) <= credit) return d;

  if (d.budget === 'RAISONNABLE') d = { ...d, budget: 'AUCUNE' };
  if (demandCost(d) <= credit) return d;

  for (const seasons of [3, 2, 1]) {
    d = { ...d, seasons };
    if (demandCost(d) <= credit) return d;
  }
  return { seasons: 1, salary: 'MODESTE', budget: 'AUCUNE' };
}

// =============================================================================
// Du contrat signé à ses conséquences
// =============================================================================

/** Salaire annuel correspondant à un palier, pour un club de cette stature. */
export function salaryFor(club: Club, tier: SalaryTier): number {
  const base = 120_000 + clubStature(club) * 6_000;
  const factor = tier === 'MODESTE' ? 0.7 : tier === 'STANDARD' ? 1 : 1.45;
  return Math.round((base * factor) / 10_000) * 10_000;
}

/** Enveloppe de transfert promise, indexée sur le budget du club. */
export function transferBudgetFor(club: Club, demand: BudgetDemand): number {
  const factor = demand === 'AUCUNE' ? 0 : demand === 'RAISONNABLE' ? 0.12 : 0.25;
  return Math.round((club.annualBudget * factor) / 100_000) * 100_000;
}

/**
 * Patience du board, en saisons d'échec tolérées.
 *
 * Un contrat d'un an ne protège de rien : la première saison ratée suffit. Un
 * bail long achète une saison de plus, jamais davantage — au-delà, on ne
 * pourrait plus jamais être limogé et la carrière perdrait tout enjeu.
 */
export function patienceFor(seasons: number, salary: SalaryTier): number {
  const base = seasons <= 1 ? 1 : seasons <= 3 ? 2 : 3;
  // Se payer cher, c'est accepter d'être jugé plus vite.
  return salary === 'ELEVE' ? Math.max(1, base - 1) : base;
}

export function signContract(
  club: Club,
  demands: Demands,
  fromSeason: number,
): ManagerContract {
  return {
    fromSeason,
    seasons: demands.seasons,
    salary: salaryFor(club, demands.salary),
    transferBudget: transferBudgetFor(club, demands.budget),
    patience: patienceFor(demands.seasons, demands.salary),
  };
}

/**
 * Objectif durci par un salaire au-dessus du marché.
 *
 * Sans cela, réclamer le plus gros salaire serait gratuit — un choix sans
 * contrepartie n'est pas un choix.
 */
export function objectiveWithSalary(
  objective: SeasonObjective,
  tier: SalaryTier,
): SeasonObjective {
  if (tier !== 'ELEVE') return objective;
  const harder: Partial<Record<ObjectiveKind, ObjectiveKind>> = {
    MAINTIEN: 'TOP_10',
    TOP_10: 'TOP_6',
    TOP_6: 'TOP_4',
    TOP_4: 'CHAMPION',
    // En Pro D2, la marche du dessus n'est pas le titre du championnat : c'est
    // la remontée, qui est déjà le sommet de ce qu'on peut y demander.
    HAUT_DE_TABLEAU: 'ACCESSION',
    ACCESSION: 'MONTEE',
  };
  const next = harder[objective.kind];
  if (!next) return objective;
  return {
    kind: next,
    targetRank: TARGET_RANK[next],
    label: OBJECTIVE_LABEL[next],
  };
}

const TARGET_RANK: Readonly<Record<ObjectiveKind, number>> = {
  CHAMPION: 1, TOP_4: 4, TOP_6: 6, TOP_10: 10, MAINTIEN: 13,
  MONTEE: 1, ACCESSION: 2, HAUT_DE_TABLEAU: 6,
};

const OBJECTIVE_LABEL: Readonly<Record<ObjectiveKind, string>> = {
  CHAMPION: 'Bouclier de Brennus',
  TOP_4: 'Top 4 (qualif. directe demi-finales)',
  TOP_6: 'Top 6 (qualification phases finales)',
  TOP_10: 'Top 10',
  MAINTIEN: 'Maintien (éviter les 3 dernières places)',
  MONTEE: 'Remontée immédiate (titre de Pro D2)',
  ACCESSION: 'Accession (top 2, barrage compris)',
  HAUT_DE_TABLEAU: 'Haut de tableau (top 6)',
};

/** Le contrat court-il encore à l'issue de cette saison ? */
export function contractExpired(contract: ManagerContract, season: number): boolean {
  return season >= contract.fromSeason + contract.seasons - 1;
}

/** Résumé lisible, pour la fiche de carrière. */
export function contractSummary(contract: ManagerContract): string {
  const until = contract.fromSeason + contract.seasons;
  const budget = contract.transferBudget > 0
    ? ` · ${(contract.transferBudget / 1_000_000).toFixed(1)} M€ de renfort promis`
    : '';
  return `${contract.seasons} saison${contract.seasons > 1 ? 's' : ''} (jusqu'en ${until}) · ${Math.round(contract.salary / 1000)} k€/an${budget}`;
}
