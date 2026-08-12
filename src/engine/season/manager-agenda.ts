/**
 * La semaine du manager — V0.49.
 *
 * Le jeu compte désormais une quinzaine de systèmes, chacun avec son état :
 * plafond salarial, quota JIFF, feuille de route du président, promesses faites
 * à des joueurs, chantier en cours, interdiction de recruter, courrier,
 * infirmerie, contrats qui expirent. **Aucun ne remontait nulle part.**
 *
 * Le tableau de bord affichait l'objectif, le calendrier et le classement — la
 * même chose qu'en V0.10, quand il n'y avait rien d'autre. Le manager devait
 * donc faire le tour de dix onglets pour savoir ce qui réclamait son attention,
 * et ne le faisait pas.
 *
 * C'est le même défaut que « écrit mais jamais appelé », d'un cran au-dessus :
 * **construit mais jamais remonté**. Un système qu'on ne voit pas n'existe pas
 * davantage qu'un système qu'on ne peut pas toucher.
 *
 * ## Ce que ce module est, et n'est pas
 *
 * Il ne calcule rien : chaque système sait déjà où il en est. Il **regarde**,
 * trie par urgence, et se tait quand tout va bien — un digest qui parle tout le
 * temps ne se lit plus au bout de trois journées.
 */

import type { Player } from '../types.js';

// =============================================================================
// Modèle
// =============================================================================

export type AgendaSeverity = 'URGENT' | 'ATTENTION' | 'INFO';

/** Onglet vers lequel l'entrée renvoie, quand il y en a un. */
export type AgendaDestination =
  | 'squad' | 'transfers' | 'training' | 'career' | 'direction' | 'news';

export interface AgendaItem {
  readonly id: string;
  readonly severity: AgendaSeverity;
  readonly headline: string;
  readonly detail: string;
  readonly destination?: AgendaDestination;
}

const RANK: Readonly<Record<AgendaSeverity, number>> = {
  URGENT: 0, ATTENTION: 1, INFO: 2,
};

// =============================================================================
// Ce qu'on regarde
// =============================================================================

export interface AgendaInput {
  readonly currentRound: number;
  readonly roster: readonly Player[];
  readonly currentSeason: number;

  /** Plafond salarial : consommation en pourcentage et statut. */
  readonly capUsage: number;
  readonly capOver: boolean;
  /** Recrues hors formation française encore possibles. */
  readonly jiffHeadroom: number;
  readonly jiffCompliant: boolean;
  readonly transferBan: boolean;

  /** Promesses en cours, avec leur échéance. */
  readonly promises: readonly {
    readonly playerName: string;
    readonly dueAtRound: number;
    readonly onTrack: boolean;
  }[];

  /**
   * V0.49 — demandes de départ ouvertes, suite à une promesse trahie.
   *
   * Optionnel : une sauvegarde antérieure n'en connaît aucune, et l'absence
   * doit se lire comme « aucune », pas comme une erreur.
   */
  readonly transferRequests?: readonly {
    readonly playerName: string;
    readonly status: 'EN_ATTENTE' | 'SUR_LA_LISTE';
  }[];

  /**
   * V0.50 — hiérarchie annoncée qui ne tient pas.
   *
   * Deux façons de manquer à sa parole : promettre plus de temps de jeu qu'une
   * saison n'en contient, ou laisser sur le banc quelqu'un à qui l'on a annoncé
   * un rôle de cadre.
   */
  readonly squadHierarchy?: {
    readonly overcommitted: boolean;
    readonly summary: string;
    /** Joueurs qui jouent nettement moins que leur rôle ne le promettait. */
    readonly underused: readonly string[];
  };

  /** Exigences du président et leur état actuel. */
  readonly expectations: readonly {
    readonly wording: string;
    readonly met: boolean;
  }[];

  /** Chantier en cours, s'il y en a un. */
  readonly project?: { readonly label: string; readonly readyAtSeason: number };

  readonly unreadMails: number;
  readonly pendingAnswers: number;
  readonly boardConfidence: number;
  /** Fenêtre de mercato ouverte ? */
  readonly transferWindowOpen: boolean;
}

// =============================================================================
// Construction
// =============================================================================

/** Blessés indisponibles pour au moins trois journées encore. */
function longTermInjuries(roster: readonly Player[], currentRound: number): number {
  return roster.filter(p => {
    const returnAt = p.dynamic.injury?.estimatedReturnAt;
    return returnAt !== undefined && returnAt - currentRound >= 3;
  }).length;
}

/** Contrats qui expirent à la fin de la saison en cours. */
function expiringContracts(roster: readonly Player[], season: number): number {
  return roster.filter(p =>
    !p.retired && !p.freeAgent && p.contract.endSeason <= season).length;
}

/**
 * Ce qui réclame l'attention du manager, du plus urgent au moins.
 *
 * On ne remonte que ce sur quoi il peut **agir** : dire qu'un chantier avance
 * bien ou que le plafond est respecté n'appelle aucune décision et noierait le
 * reste.
 */
export function buildAgenda(input: AgendaInput): readonly AgendaItem[] {
  const items: AgendaItem[] = [];

  // ---- Règlement -----------------------------------------------------------
  if (input.transferBan) {
    items.push({
      id: 'ban',
      severity: 'URGENT',
      headline: 'Interdiction de recruter',
      detail: 'La commission vous prive de mercato cette saison.',
      destination: 'transfers',
    });
  }

  if (input.capOver) {
    items.push({
      id: 'cap',
      severity: 'URGENT',
      headline: `Masse salariale à ${Math.round(input.capUsage)} % du plafond`,
      detail: 'Sanction en fin de saison si vous ne dégraissez pas.',
      destination: 'transfers',
    });
  } else if (input.capUsage > 92) {
    items.push({
      id: 'cap',
      severity: 'ATTENTION',
      headline: `Plafond salarial tendu (${Math.round(input.capUsage)} %)`,
      detail: 'Peu de marge pour une signature.',
      destination: 'transfers',
    });
  }

  if (!input.jiffCompliant) {
    items.push({
      id: 'jiff',
      severity: 'URGENT',
      headline: 'Quota JIFF non rempli',
      detail: 'Interdiction de recruter à la clé si rien ne change.',
      destination: 'transfers',
    });
  } else if (input.jiffHeadroom <= 1 && input.transferWindowOpen) {
    items.push({
      id: 'jiff',
      severity: 'ATTENTION',
      headline: 'Plus de marge JIFF',
      detail: 'Une recrue hors formation française vous mettrait hors des clous.',
      destination: 'transfers',
    });
  }

  // ---- Promesses -----------------------------------------------------------
  for (const promise of input.promises) {
    const remaining = promise.dueAtRound - input.currentRound;
    if (promise.onTrack) continue;
    items.push({
      id: `promise_${promise.playerName}`,
      severity: remaining <= 2 ? 'URGENT' : 'ATTENTION',
      headline: `Promesse à tenir — ${promise.playerName}`,
      detail: remaining <= 0
        ? 'L\'échéance est passée.'
        : `Il doit jouer d'ici ${remaining} journée${remaining > 1 ? 's' : ''}.`,
      destination: 'squad',
    });
  }

  // ---- Demandes de départ --------------------------------------------------
  for (const request of input.transferRequests ?? []) {
    if (request.status === 'EN_ATTENTE') {
      items.push({
        id: `request_${request.playerName}`,
        severity: 'URGENT',
        headline: `${request.playerName} demande à partir`,
        detail: 'Son agent attend votre réponse.',
        destination: 'career',
      });
    } else {
      items.push({
        id: `listed_${request.playerName}`,
        severity: 'INFO',
        headline: `${request.playerName} est sur la liste des transferts`,
        detail: 'Une offre peut tomber à tout moment.',
        destination: 'transfers',
      });
    }
  }

  // ---- Hiérarchie ----------------------------------------------------------
  const hierarchy = input.squadHierarchy;
  if (hierarchy?.overcommitted === true) {
    items.push({
      id: 'hierarchy',
      severity: 'ATTENTION',
      headline: 'Vous avez promis plus de temps de jeu qu\'il n\'y en a',
      detail: hierarchy.summary,
      destination: 'squad',
    });
  }
  if (hierarchy !== undefined && hierarchy.underused.length > 0) {
    items.push({
      id: 'underused',
      severity: hierarchy.underused.length >= 3 ? 'ATTENTION' : 'INFO',
      headline: `${hierarchy.underused.length} joueur${hierarchy.underused.length > 1 ? 's' : ''} ne ${hierarchy.underused.length > 1 ? 'tiennent' : 'tient'} pas le rôle annoncé`,
      detail: hierarchy.underused.slice(0, 3).join(', ')
        + (hierarchy.underused.length > 3 ? '…' : ''),
      destination: 'squad',
    });
  }

  // ---- Le président --------------------------------------------------------
  for (const expectation of input.expectations) {
    if (expectation.met) continue;
    items.push({
      id: `exp_${expectation.wording}`,
      severity: 'ATTENTION',
      headline: 'Exigence du président non tenue',
      detail: expectation.wording,
      destination: 'career',
    });
  }

  if (input.boardConfidence < 30) {
    items.push({
      id: 'confidence',
      severity: 'URGENT',
      headline: `Confiance du board à ${input.boardConfidence}/100`,
      detail: 'Votre poste est menacé.',
      destination: 'career',
    });
  }

  // ---- Courrier ------------------------------------------------------------
  if (input.pendingAnswers > 0) {
    items.push({
      id: 'answers',
      severity: 'ATTENTION',
      headline: `${input.pendingAnswers} message${input.pendingAnswers > 1 ? 's' : ''} attend${input.pendingAnswers > 1 ? 'ent' : ''} une réponse`,
      detail: 'Une décision est demandée.',
      destination: 'career',
    });
  } else if (input.unreadMails > 0) {
    items.push({
      id: 'mails',
      severity: 'INFO',
      headline: `${input.unreadMails} message${input.unreadMails > 1 ? 's' : ''} non lu${input.unreadMails > 1 ? 's' : ''}`,
      detail: 'Courrier en attente.',
      destination: 'career',
    });
  }

  // ---- Effectif ------------------------------------------------------------
  const injured = longTermInjuries(input.roster, input.currentRound);
  if (injured >= 3) {
    items.push({
      id: 'infirmary',
      severity: 'ATTENTION',
      headline: `${injured} joueurs à l'infirmerie pour un moment`,
      detail: 'Vérifiez la profondeur aux postes touchés.',
      destination: 'squad',
    });
  }

  const expiring = expiringContracts(input.roster, input.currentSeason);
  if (expiring >= 3) {
    items.push({
      id: 'contracts',
      severity: 'INFO',
      headline: `${expiring} contrats expirent en fin de saison`,
      detail: 'À prolonger ou à remplacer.',
      destination: 'squad',
    });
  }

  // ---- Direction -----------------------------------------------------------
  if (input.project) {
    items.push({
      id: 'project',
      severity: 'INFO',
      headline: `Chantier en cours — ${input.project.label}`,
      detail: `Livraison à l'intersaison ${input.project.readyAtSeason}.`,
      destination: 'direction',
    });
  }

  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/**
 * Ce qu'on affiche quand il n'y a rien à signaler.
 *
 * Un digest vide vaut mieux qu'un digest bavard : c'est l'information « rien ne
 * brûle », et elle a de la valeur.
 */
export const NOTHING_TO_REPORT = 'Rien ne réclame votre attention cette semaine.';
