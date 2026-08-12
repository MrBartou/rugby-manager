/**
 * La direction du club — V0.45.
 *
 * L'argent n'avait aucune destination. Les mouvements financiers se limitaient
 * à cinq natures — salaires, recettes de match, sponsors, transferts entrant et
 * sortant — et il n'existait **rien à construire**. Conséquence observée en
 * jeu : le Stade Français accumulait 116 M€ de trésorerie dormante, sans qu'un
 * seul euro puisse servir à autre chose qu'à surpayer un joueur de plus.
 *
 * Un club de rugby n'est pourtant pas qu'un effectif. C'est un stade à remplir,
 * un prix de place à fixer, une marque à faire vivre, des installations qui
 * font progresser ou qui cassent les corps.
 *
 * ## Deux temporalités, à dessein
 *
 *  - les **chantiers** engagent sur plusieurs saisons et coûtent cher : ils ne
 *    se décident qu'une fois, et se paient longtemps avant de rapporter ;
 *  - les **réglages** — prix des places, budget marketing — se rejouent chaque
 *    saison et produisent leur effet tout de suite.
 *
 * Sans les premiers, la trésorerie n'a pas de sens ; sans les seconds, la
 * direction du club serait un menu qu'on ouvre une fois puis qu'on oublie.
 *
 * ## Le prix des places, ou l'arbitrage central
 *
 * Monter les tarifs rapporte plus par spectateur et en fait fuir. Les baisser
 * remplit l'enceinte, nourrit l'ambiance — donc l'avantage du terrain — et
 * rapporte moins. Il n'y a pas de réglage optimal, seulement un club qu'on
 * choisit d'être.
 */

import type { Club } from '../types.js';

// =============================================================================
// Les chantiers
// =============================================================================

export type ProjectKind =
  | 'STADE'
  | 'CENTRE_ENTRAINEMENT'
  | 'CENTRE_MEDICAL'
  | 'BOUTIQUE';

export const PROJECT_LABEL: Readonly<Record<ProjectKind, string>> = {
  STADE: 'Agrandissement du stade',
  CENTRE_ENTRAINEMENT: 'Centre d\'entraînement',
  CENTRE_MEDICAL: 'Centre médical',
  BOUTIQUE: 'Boutique et marque',
};

export const PROJECT_EFFECT: Readonly<Record<ProjectKind, string>> = {
  STADE: '+3 000 places par niveau — recettes de match et ambiance.',
  CENTRE_ENTRAINEMENT: 'Progression des joueurs accélérée.',
  CENTRE_MEDICAL: 'Moins de blessures à l\'entraînement, retours plus rapides.',
  BOUTIQUE: 'Recettes de merchandising et de sponsors.',
};

/** Niveau maximum d'une installation. */
export const MAX_LEVEL = 5;

export interface ClubFacilities {
  /** Niveau 0-5 par installation. Le stade est traité à part, en places. */
  readonly stade: number;
  readonly entrainement: number;
  readonly medical: number;
  readonly boutique: number;
}

export const INITIAL_FACILITIES: ClubFacilities = {
  stade: 0, entrainement: 1, medical: 1, boutique: 1,
};

/**
 * Chantier en cours.
 *
 * Un seul à la fois : un club ne refait pas son stade, son centre médical et sa
 * boutique la même année, et l'exclusivité est ce qui rend la priorisation
 * intéressante.
 */
export interface OngoingProject {
  readonly kind: ProjectKind;
  readonly targetLevel: number;
  /** Saison à laquelle le chantier est livré. */
  readonly readyAtSeason: number;
  readonly totalCost: number;
}

/**
 * Coût d'un palier.
 *
 * Croissant : chaque niveau coûte davantage que le précédent, sinon on
 * monterait tout au maximum dès que la trésorerie le permet.
 */
export function projectCost(kind: ProjectKind, targetLevel: number): number {
  const base: Readonly<Record<ProjectKind, number>> = {
    STADE: 8_000_000,
    CENTRE_ENTRAINEMENT: 4_000_000,
    CENTRE_MEDICAL: 3_000_000,
    BOUTIQUE: 2_500_000,
  };
  return Math.round(base[kind] * (1 + (targetLevel - 1) * 0.6));
}

/** Durée d'un chantier, en saisons. Le stade se construit plus lentement. */
export function projectDuration(kind: ProjectKind): number {
  return kind === 'STADE' ? 2 : 1;
}

export function levelOf(facilities: ClubFacilities, kind: ProjectKind): number {
  switch (kind) {
    case 'STADE': return facilities.stade;
    case 'CENTRE_ENTRAINEMENT': return facilities.entrainement;
    case 'CENTRE_MEDICAL': return facilities.medical;
    case 'BOUTIQUE': return facilities.boutique;
  }
}

export function withLevel(
  facilities: ClubFacilities,
  kind: ProjectKind,
  level: number,
): ClubFacilities {
  switch (kind) {
    case 'STADE': return { ...facilities, stade: level };
    case 'CENTRE_ENTRAINEMENT': return { ...facilities, entrainement: level };
    case 'CENTRE_MEDICAL': return { ...facilities, medical: level };
    case 'BOUTIQUE': return { ...facilities, boutique: level };
  }
}

export interface LaunchCheck {
  readonly allowed: boolean;
  readonly cost: number;
  readonly reason?: string;
}

export function canLaunch(input: {
  readonly facilities: ClubFacilities;
  readonly ongoing: OngoingProject | undefined;
  readonly kind: ProjectKind;
  readonly balance: number;
}): LaunchCheck {
  const target = levelOf(input.facilities, input.kind) + 1;
  const cost = projectCost(input.kind, target);

  if (input.ongoing) {
    return { allowed: false, cost, reason: `Un chantier est déjà en cours : ${PROJECT_LABEL[input.ongoing.kind]}.` };
  }
  if (target > MAX_LEVEL) {
    return { allowed: false, cost, reason: 'Installation déjà au niveau maximum.' };
  }
  if (input.balance < cost) {
    return { allowed: false, cost, reason: `Il manque ${Math.round((cost - input.balance) / 1_000_000 * 10) / 10} M€.` };
  }
  return { allowed: true, cost };
}

/** Places gagnées par niveau de stade. */
export const SEATS_PER_LEVEL = 3_000;

export function stadiumCapacityFor(club: Club, facilities: ClubFacilities): number {
  return club.stadiumCapacity + facilities.stade * SEATS_PER_LEVEL;
}

// =============================================================================
// Les réglages de la saison
// =============================================================================

export type TicketPolicy = 'POPULAIRE' | 'STANDARD' | 'PREMIUM';

export const TICKET_LABEL: Readonly<Record<TicketPolicy, string>> = {
  POPULAIRE: 'Tarif populaire',
  STANDARD: 'Tarif standard',
  PREMIUM: 'Tarif premium',
};

/**
 * Prix moyen du billet et effet sur le remplissage.
 *
 * L'élasticité est volontairement forte : sans elle, monter les prix serait un
 * gain net et le choix se ferait tout seul.
 */
export const TICKET_POLICY: Readonly<Record<TicketPolicy, { price: number; fillDelta: number }>> = {
  POPULAIRE: { price: 22, fillDelta: +0.10 },
  STANDARD: { price: 30, fillDelta: 0 },
  PREMIUM: { price: 44, fillDelta: -0.14 },
};

export type MarketingLevel = 'AUCUN' | 'MODERE' | 'SOUTENU' | 'OFFENSIF';

export const MARKETING_LABEL: Readonly<Record<MarketingLevel, string>> = {
  AUCUN: 'Aucune campagne',
  MODERE: 'Campagne modérée',
  SOUTENU: 'Campagne soutenue',
  OFFENSIF: 'Campagne offensive',
};

/** Coût annuel d'une campagne et ce qu'elle rapporte. */
export const MARKETING_PLAN: Readonly<Record<MarketingLevel, {
  cost: number;
  fillDelta: number;
  sponsorBonus: number;
  merchBonus: number;
}>> = {
  AUCUN: { cost: 0, fillDelta: -0.03, sponsorBonus: 0, merchBonus: 0 },
  MODERE: { cost: 600_000, fillDelta: +0.02, sponsorBonus: 0.04, merchBonus: 0.10 },
  SOUTENU: { cost: 1_800_000, fillDelta: +0.05, sponsorBonus: 0.10, merchBonus: 0.25 },
  OFFENSIF: { cost: 4_000_000, fillDelta: +0.08, sponsorBonus: 0.18, merchBonus: 0.45 },
};

export interface ClubPlan {
  readonly ticket: TicketPolicy;
  readonly marketing: MarketingLevel;
}

export const DEFAULT_PLAN: ClubPlan = { ticket: 'STANDARD', marketing: 'MODERE' };

// =============================================================================
// Les recettes
// =============================================================================

const FILL_FLOOR = 0.42;
const FILL_CEIL = 1.0;

export interface MatchdayInput {
  readonly club: Club;
  readonly facilities: ClubFacilities;
  readonly plan: ClubPlan;
  /** Ratio de victoires de la saison en cours, 0-1. */
  readonly winsRatio: number;
  /**
   * V0.48 — supplément de remplissage un jour de rivalité.
   *
   * Un derby se joue à guichets fermés même quand les deux équipes sont
   * médiocres : c'est ce qui le distingue d'une journée ordinaire.
   */
  readonly rivalryBonus?: number;
}

export interface MatchdayRevenue {
  readonly attendance: number;
  readonly capacity: number;
  readonly fillRate: number;
  readonly revenue: number;
}

/**
 * Recette d'un match à domicile.
 *
 * On expose l'affluence et le taux de remplissage, pas seulement l'euro final :
 * c'est ce qui permet au manager de comprendre **pourquoi** sa recette baisse
 * quand il monte les tarifs.
 */
export function matchdayRevenue(input: MatchdayInput): MatchdayRevenue {
  const capacity = stadiumCapacityFor(input.club, input.facilities);
  const base = baselineFill(input.club);
  const form = (input.winsRatio - 0.5) * 0.3;
  const ticket = TICKET_POLICY[input.plan.ticket];
  const marketing = MARKETING_PLAN[input.plan.marketing];

  const fillRate = Math.max(FILL_FLOOR, Math.min(
    FILL_CEIL,
    base + form + ticket.fillDelta + marketing.fillDelta + (input.rivalryBonus ?? 0),
  ));
  const attendance = Math.round(capacity * fillRate);

  return {
    attendance,
    capacity,
    fillRate,
    revenue: Math.round(attendance * ticket.price),
  };
}

function baselineFill(club: Club): number {
  switch (club.tier) {
    case 'GROS_BUDGET': return 0.88;
    case 'BUDGET_MOYEN': return 0.76;
    case 'PETIT_BUDGET': return 0.66;
  }
}

/**
 * Recette annuelle de merchandising.
 *
 * Elle dépend de trois choses qu'un manager pilote réellement : la boutique
 * qu'il a construite, la campagne qu'il finance, et les résultats de l'équipe.
 * Gagner rapporte donc au-delà des points — ce qui n'était pas le cas jusqu'ici.
 */
export function merchandisingRevenue(input: {
  readonly club: Club;
  readonly facilities: ClubFacilities;
  readonly plan: ClubPlan;
  readonly winsRatio: number;
}): number {
  const base = 300_000 + input.club.reputation * 22_000;
  const shop = 1 + input.facilities.boutique * 0.28;
  const marketing = 1 + MARKETING_PLAN[input.plan.marketing].merchBonus;
  const results = 0.7 + input.winsRatio * 0.7;
  return Math.round(base * shop * marketing * results);
}

/** Enveloppe sponsors, majorée par la campagne marketing. */
export function sponsorRevenue(club: Club, plan: ClubPlan): number {
  return Math.round(club.annualBudget * (1 + MARKETING_PLAN[plan.marketing].sponsorBonus));
}

/** Coût annuel des réglages commerciaux. */
export function commercialCost(plan: ClubPlan): number {
  return MARKETING_PLAN[plan.marketing].cost;
}

// =============================================================================
// Effets sportifs des installations
// =============================================================================

/**
 * Bonus de progression apporté par le centre d'entraînement, en points de
 * qualité d'encadrement.
 *
 * Il s'ajoute au staff : de bonnes installations ne remplacent pas un bon
 * entraîneur, elles le rendent plus efficace.
 */
export function trainingBonus(facilities: ClubFacilities): number {
  return facilities.entrainement * 4;
}

/** Protection apportée par le centre médical, en points de qualité médicale. */
export function medicalBonus(facilities: ClubFacilities): number {
  return facilities.medical * 5;
}

/**
 * Avantage du terrain apporté par une enceinte pleine.
 *
 * Un stade rempli à 95 % ne pèse pas comme un stade à moitié vide, et c'est la
 * seule récompense sportive d'une politique tarifaire populaire.
 */
export function homeAdvantageBonus(fillRate: number): number {
  return Math.round((fillRate - 0.75) * 8 * 10) / 10;
}

// =============================================================================
// Avancement des chantiers
// =============================================================================

export interface ProjectProgress {
  readonly facilities: ClubFacilities;
  readonly ongoing: OngoingProject | undefined;
  /** Chantier livré cette intersaison, le cas échéant. */
  readonly delivered?: OngoingProject;
}

/** Fait avancer le chantier d'une saison, et le livre s'il est arrivé à terme. */
export function advanceProjects(
  facilities: ClubFacilities,
  ongoing: OngoingProject | undefined,
  newSeason: number,
): ProjectProgress {
  if (!ongoing) return { facilities, ongoing: undefined };
  if (newSeason < ongoing.readyAtSeason) return { facilities, ongoing };

  return {
    facilities: withLevel(facilities, ongoing.kind, ongoing.targetLevel),
    ongoing: undefined,
    delivered: ongoing,
  };
}
