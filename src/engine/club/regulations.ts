/**
 * Le règlement opposable — V0.45.
 *
 * Deux règles façonnent un effectif de Top 14 dans la vraie vie : le **salary
 * cap** et le **quota JIFF**. Les deux existaient dans le code, et aucune ne
 * s'opposait à quoi que ce soit.
 *
 *  - `Club.salaryCapUsage` était un champ mis à `0` partout où l'on construit
 *    un club, jamais calculé, jamais lu ;
 *  - `computeClubJiffStats()` n'était appelé que par l'écran Effectif, pour
 *    afficher un badge.
 *
 * Conséquence : avec de la trésorerie, rien n'empêchait d'empiler trente
 * joueurs à 85. Recruter revenait à comparer des niveaux, jamais à faire tenir
 * un effectif dans une enveloppe.
 *
 * ## Ce que ça change
 *
 * On ne choisit plus le meilleur joueur disponible, mais celui qui **tient sous
 * le plafond** sans aggraver le quota. Vendre cesse d'être un simple encaissement
 * : c'est ce qui libère de la place. Et un effectif trop cher se paie toute la
 * saison, pas au moment de la signature.
 *
 * ## Pourquoi des sanctions plutôt qu'un blocage
 *
 * Interdire purement et simplement le dépassement transformerait la règle en
 * validation de formulaire. La sanction — retrait de points, interdiction de
 * recruter — laisse le choix de forcer, et fait de l'infraction une décision
 * plutôt qu'un mur.
 */

import type { Club, ClubId, Player } from '../types.js';
import { computeJiffStats, JIFF_MIN_COUNT_FEUILLE_23, JIFF_MIN_RATIO } from './jiff.js';

// =============================================================================
// Le plafond
// =============================================================================

/**
 * Plafond de masse salariale du Top 14, en euros.
 *
 * Calibré sur les effectifs réels du jeu, pas sur le chiffre du règlement. Les
 * masses mesurées vont de 6,3 M€ (Vannes) à 14,0 M€ (Toulouse), médiane 7,5 M€.
 * À 10 M€ — le chiffre officiel — Toulouse démarrait à 140 % du plafond et
 * perdait douze points avant la première journée : ce n'est pas de la tension,
 * c'est un jeu cassé.
 *
 * À 12 M€, la majorité des clubs a de la marge, Bordeaux est tendu, et Toulouse
 * est en dépassement modéré — il doit vendre ou payer une amende, jamais perdre
 * sa saison d'entrée.
 */
export const SALARY_CAP_TOP14 = 12_000_000;

/**
 * Plafond de Pro D2, très inférieur.
 *
 * Un club qui descend garde ses contrats de Top 14 et se retrouve mécaniquement
 * hors des clous : la relégation impose de dégraisser, ce qui est précisément ce
 * qui se passe en vrai.
 */
export const SALARY_CAP_PRO_D2 = 5_000_000;

export function salaryCapFor(division: 'TOP14' | 'PRO_D2'): number {
  return division === 'TOP14' ? SALARY_CAP_TOP14 : SALARY_CAP_PRO_D2;
}

/**
 * Tolérance avant sanction.
 *
 * Un dépassement de quelques milliers d'euros — une prime, un joker médical en
 * cours de saison — ne doit pas déclencher la commission. Sans marge, la règle
 * serait invivable dès qu'un club signe un remplaçant.
 */
export const CAP_TOLERANCE = 0.03;

export type CapStatus = 'CONFORME' | 'TENDU' | 'DEPASSEMENT';

export interface CapReport {
  readonly payroll: number;
  readonly cap: number;
  /** Marge restante, négative en cas de dépassement. */
  readonly headroom: number;
  /** Part du plafond consommée, en pourcentage entier. */
  readonly usage: number;
  readonly status: CapStatus;
}

/**
 * Masse salariale opposable.
 *
 * Les retraités et les agents libres ne comptent pas : ils ne sont plus payés
 * par le club. Les blessés, si — c'est tout l'intérêt d'une contrainte de masse
 * salariale, on paie même ceux qui ne jouent pas.
 */
export function computePayroll(roster: readonly Player[]): number {
  return roster
    .filter(p => !p.retired && !p.freeAgent)
    .reduce((sum, p) => sum + p.contract.annualSalary, 0);
}

export function capReport(
  roster: readonly Player[],
  division: 'TOP14' | 'PRO_D2',
): CapReport {
  const cap = salaryCapFor(division);
  const payroll = computePayroll(roster);
  const headroom = cap - payroll;
  const usage = Math.round((payroll / cap) * 100);

  const status: CapStatus = payroll > cap * (1 + CAP_TOLERANCE)
    ? 'DEPASSEMENT'
    : payroll > cap * 0.92
      ? 'TENDU'
      : 'CONFORME';

  return { payroll, cap, headroom, usage, status };
}

/**
 * Ce qu'il resterait après une signature.
 *
 * C'est la question que se pose réellement un manager devant une offre, et elle
 * doit trouver sa réponse **avant** de signer, pas au bilan de fin de saison.
 */
export function headroomAfterSigning(
  roster: readonly Player[],
  division: 'TOP14' | 'PRO_D2',
  annualSalary: number,
): number {
  return salaryCapFor(division) - computePayroll(roster) - annualSalary;
}

// =============================================================================
// Le quota JIFF
// =============================================================================

/**
 * Le quota s'apprécie sur l'effectif, pas seulement sur la feuille de match.
 *
 * Un club peut composer une feuille conforme un dimanche et ne pas avoir le
 * réservoir pour tenir la saison. C'est l'effectif qui se recrute, donc c'est
 * lui qu'on contrôle.
 *
 * En **proportion**, pas en nombre absolu : une exigence de seize JIFF mettait
 * douze clubs sur quatorze en infraction dès le coup d'envoi, les effectifs du
 * jeu comptant dix-sept joueurs. Le ratio réutilise le seuil déjà défini par le
 * module JIFF, et il a la bonne propriété — il ne se dégrade que si l'on recrute
 * hors formation française, ce qui est exactement la pression recherchée.
 */
export interface JiffReport {
  readonly count: number;
  readonly total: number;
  readonly required: number;
  readonly shortfall: number;
  readonly compliant: boolean;
  /** Recrues non-JIFF possibles avant de passer sous le seuil. */
  readonly foreignHeadroom: number;
}

export function jiffReport(roster: readonly Player[]): JiffReport {
  const active = roster.filter(p => !p.retired && !p.freeAgent);
  const stats = computeJiffStats(active);
  const required = Math.ceil(active.length * JIFF_MIN_RATIO);

  // Combien de non-JIFF on peut encore enregistrer : chaque signature augmente
  // le total sans augmenter le compte, donc resserre le ratio.
  let headroom = 0;
  while (stats.jiffCount >= Math.ceil((active.length + headroom + 1) * JIFF_MIN_RATIO)) {
    headroom++;
    if (headroom > 40) break;
  }

  return {
    count: stats.jiffCount,
    total: active.length,
    required,
    shortfall: Math.max(0, required - stats.jiffCount),
    compliant: stats.jiffCount >= required,
    foreignHeadroom: headroom,
  };
}

/** Conformité de la feuille de match, sur la règle des 23. */
export function matchSheetCompliant(sheet: readonly Player[]): boolean {
  return computeJiffStats(sheet).jiffCount >= Math.min(
    JIFF_MIN_COUNT_FEUILLE_23,
    Math.ceil(sheet.length * 0.5),
  );
}

// =============================================================================
// La commission
// =============================================================================

export type SanctionKind = 'AVERTISSEMENT' | 'AMENDE' | 'RETRAIT_POINTS' | 'INTERDICTION_RECRUTER';

export interface Sanction {
  readonly kind: SanctionKind;
  /** Points retirés au classement, le cas échéant. */
  readonly pointsDeducted: number;
  /** Amende en euros, le cas échéant. */
  readonly fine: number;
  /** Vrai tant que le club ne peut plus enregistrer de recrue. */
  readonly transferBan: boolean;
  readonly reason: string;
}

/**
 * Verdict de fin de saison.
 *
 * Le contrôle est annuel : sanctionner à chaque journée rendrait la moindre
 * signature d'un joker médical catastrophique, et transformerait la règle en
 * harcèlement plutôt qu'en contrainte de construction.
 *
 * L'échelle est graduée sur l'ampleur du dépassement. Un club à peine au-dessus
 * est averti ; un club à 30 % au-dessus perd des points, ce qui touche là où ça
 * se voit.
 */
export function reviewSeason(input: {
  readonly cap: CapReport;
  readonly jiff: JiffReport;
  /** Vrai si le club était déjà sanctionné la saison précédente. */
  readonly repeatOffender: boolean;
}): readonly Sanction[] {
  const sanctions: Sanction[] = [];
  const { cap, jiff } = input;

  if (cap.status === 'DEPASSEMENT') {
    const overrun = cap.payroll - cap.cap;
    const ratio = overrun / cap.cap;

    if (ratio >= 0.20 || input.repeatOffender) {
      sanctions.push({
        kind: 'RETRAIT_POINTS',
        // Trois points par tranche de 10 % au-dessus, plafonnés : au-delà, la
        // sanction condamnerait la saison suivante avant qu'elle ne commence.
        pointsDeducted: Math.min(12, 3 + Math.floor(ratio * 30)),
        fine: Math.round(overrun * 0.5),
        transferBan: true,
        reason: `Masse salariale dépassée de ${(ratio * 100).toFixed(0)} %`,
      });
    } else {
      sanctions.push({
        kind: 'AMENDE',
        pointsDeducted: 0,
        fine: Math.round(overrun * 0.35),
        transferBan: false,
        reason: `Masse salariale dépassée de ${(ratio * 100).toFixed(0)} %`,
      });
    }
  }

  if (!jiff.compliant) {
    sanctions.push({
      kind: jiff.shortfall >= 4 ? 'INTERDICTION_RECRUTER' : 'AVERTISSEMENT',
      pointsDeducted: 0,
      fine: jiff.shortfall >= 4 ? 250_000 : 0,
      transferBan: jiff.shortfall >= 4,
      reason: `${jiff.shortfall} JIFF manquant${jiff.shortfall > 1 ? 's' : ''} dans l'effectif`,
    });
  }

  return sanctions;
}

/**
 * Cette sanction compte-t-elle comme un antécédent ? V0.60.
 *
 * La récidive était armée par **n'importe quel verdict**, y compris un simple
 * avertissement JIFF sans point retiré ni amende. Un club prévenu une fois se
 * retrouvait récidiviste l'année suivante, avec les sanctions aggravées qui vont
 * avec, et le retrait de points qui en découlait déclenchait le défaut de
 * classement corrigé par ailleurs dans cette version.
 *
 * Un avertissement avertit. Il ne condamne pas.
 */
export function countsAsOffence(sanction: Sanction): boolean {
  return sanction.pointsDeducted > 0 || sanction.fine > 0 || sanction.transferBan;
}

/** Résumé lisible d'une sanction, pour le courrier et le fil d'actualité. */
export function sanctionSummary(sanction: Sanction): string {
  const parts: string[] = [];
  if (sanction.pointsDeducted > 0) parts.push(`${sanction.pointsDeducted} points retirés`);
  if (sanction.fine > 0) parts.push(`${Math.round(sanction.fine / 1000)} k€ d'amende`);
  if (sanction.transferBan) parts.push('interdiction de recruter');
  return parts.length > 0 ? parts.join(', ') : 'avertissement sans suite';
}

/**
 * Un club peut-il enregistrer cette recrue ?
 *
 * Le refus ne porte pas sur le dépassement lui-même — forcer reste un choix —
 * mais sur l'interdiction de recruter, qui est une sanction déjà tombée.
 */
export interface SigningCheck {
  readonly allowed: boolean;
  readonly warning?: string;
  readonly reason?: string;
}

export function canRegister(input: {
  readonly roster: readonly Player[];
  readonly division: 'TOP14' | 'PRO_D2';
  readonly annualSalary: number;
  readonly transferBan: boolean;
}): SigningCheck {
  if (input.transferBan) {
    return {
      allowed: false,
      reason: 'Le club est sous interdiction de recrutement.',
    };
  }

  const after = headroomAfterSigning(input.roster, input.division, input.annualSalary);
  if (after < 0) {
    return {
      allowed: true,
      warning: `Dépassement de ${Math.round(-after / 1000)} k€ sur le plafond — sanction en fin de saison.`,
    };
  }

  return { allowed: true };
}

/** Le club, mis à jour avec sa consommation réelle du plafond. */
export function withCapUsage(club: Club, roster: readonly Player[]): Club {
  return { ...club, salaryCapUsage: computePayroll(roster) };
}

// =============================================================================
// Le contrôle annuel, pour tout le championnat
// =============================================================================

/**
 * La revue de la commission, club par club : V0.62.
 *
 * Ces règles vivaient dans `App.tsx`, en pleine intersaison, mêlées à la
 * publication des actualités et à l'écriture d'une demi-douzaine de références
 * React. Elles décident pourtant des points retirés, des interdictions de
 * recruter et des amendes de toute une division : c'est du règlement, et le
 * règlement appartient au moteur.
 *
 * Deux points d'ordre sont conservés, et ils comptent :
 *
 * - le contrôle porte sur l'effectif **d'avant-mercato**, donc sur la saison
 *   réellement jouée. Le faire après le marché ne verrait plus aucune
 *   infraction, puisque les clubs y dégraissent ;
 * - il précède le mercato, pour qu'une interdiction de recruter s'applique à la
 *   fenêtre qui s'ouvre et non à celle de l'année suivante.
 */
export interface ClubReview {
  readonly clubId: ClubId;
  readonly verdicts: readonly Sanction[];
  readonly pointsDeducted: number;
  readonly fine: number;
  readonly transferBan: boolean;
  /** Vrai si ce verdict fait de ce club un récidiviste l'an prochain. */
  readonly countsAsOffence: boolean;
}

export interface LeagueReview {
  /** Un par club sanctionné. Les clubs irréprochables n'y figurent pas. */
  readonly reviews: readonly ClubReview[];
  readonly penaltiesByClub: ReadonlyMap<ClubId, number>;
  readonly bannedClubs: ReadonlySet<ClubId>;
  /** Antécédents à retenir pour la saison suivante. */
  readonly repeatOffenders: ReadonlySet<ClubId>;
}

export function reviewLeague(input: {
  readonly clubs: readonly Club[];
  readonly division: 'TOP14' | 'PRO_D2';
  /** Effectif de fin de saison, avant mercato. */
  readonly rosterOf: (clubId: ClubId) => readonly Player[];
  /** Clubs déjà sanctionnés la saison passée : la récidive aggrave. */
  readonly repeatOffenders: ReadonlySet<ClubId>;
}): LeagueReview {
  const reviews: ClubReview[] = [];
  const penaltiesByClub = new Map<ClubId, number>();
  const bannedClubs = new Set<ClubId>();
  const repeatOffenders = new Set<ClubId>();

  for (const club of input.clubs) {
    const roster = input.rosterOf(club.id);
    // Un club sans effectif n'est pas un club conforme, c'est un club qu'on ne
    // sait pas juger : le sanctionner sur une liste vide n'aurait aucun sens.
    if (roster.length === 0) continue;

    const verdicts = reviewSeason({
      cap: capReport(roster, input.division),
      jiff: jiffReport(roster),
      repeatOffender: input.repeatOffenders.has(club.id),
    });
    if (verdicts.length === 0) continue;

    const pointsDeducted = verdicts.reduce((n, v) => n + v.pointsDeducted, 0);
    const fine = verdicts.reduce((n, v) => n + v.fine, 0);
    const transferBan = verdicts.some(v => v.transferBan);
    // V0.60 : seul un verdict qui sanctionne vraiment fait un antécédent. Un
    // simple avertissement armait la récidive, ce qui accélérait les retraits
    // de points de tout le championnat.
    const offence = verdicts.some(countsAsOffence);

    if (pointsDeducted > 0) penaltiesByClub.set(club.id, pointsDeducted);
    if (transferBan) bannedClubs.add(club.id);
    if (offence) repeatOffenders.add(club.id);

    reviews.push({
      clubId: club.id,
      verdicts,
      pointsDeducted,
      fine,
      transferBan,
      countsAsOffence: offence,
    });
  }

  return { reviews, penaltiesByClub, bannedClubs, repeatOffenders };
}
