/**
 * Les attentes du board, au-delà du rang — V0.48.
 *
 * `SeasonObjective` était un classement, et rien d'autre. Le président ne
 * demandait qu'une place, alors que le jeu mesure désormais la masse salariale
 * (V0.45), le quota JIFF (V0.45), les espoirs sortis du centre (V0.43) et les
 * comptes du club (V0.6). Quatre systèmes construits, aucun exigé.
 *
 * Un employeur ne juge pas seulement un résultat sportif. Il regarde aussi
 * comment on tient la maison — et c'est ce qui distingue un board d'un tableau
 * d'affichage.
 *
 * ## Une exigence choisie, pas cumulée
 *
 * Le board ne réclame qu'une ou deux choses par saison, et il les choisit
 * d'après la **situation réelle du club** : on demande de dégraisser à celui
 * qui dépasse, de former à celui qui n'a pas de jeunes, d'équilibrer à celui
 * qui perd de l'argent. Empiler quatre exigences reviendrait à n'en formuler
 * aucune.
 */

import type { Club } from '../types.js';

// =============================================================================
// Modèle
// =============================================================================

export type ExpectationKind =
  | 'MASSE_SALARIALE'
  | 'QUOTA_JIFF'
  | 'JEUNES_AU_JEU'
  | 'COMPTES_EQUILIBRES';

export const EXPECTATION_LABEL: Readonly<Record<ExpectationKind, string>> = {
  MASSE_SALARIALE: 'Tenir la masse salariale',
  QUOTA_JIFF: 'Renforcer le contingent JIFF',
  JEUNES_AU_JEU: 'Donner du temps de jeu aux jeunes',
  COMPTES_EQUILIBRES: 'Terminer la saison dans le vert',
};

export interface BoardExpectation {
  readonly kind: ExpectationKind;
  /** Seuil à atteindre, dans l'unité du critère. */
  readonly target: number;
  /** Formulation destinée au manager. */
  readonly wording: string;
}

/**
 * État du club au moment où le board formule ses attentes.
 *
 * On prend la photo à l'intersaison : c'est ce que le président a sous les yeux
 * quand il fixe la feuille de route.
 */
export interface ClubSituation {
  /** Consommation du plafond, en pourcentage. */
  readonly capUsage: number;
  /** Recrues hors formation française encore possibles. */
  readonly jiffHeadroom: number;
  /** Part des minutes jouées par les moins de 23 ans, 0-1. */
  readonly youthMinutesRatio: number;
  /** Résultat de la saison écoulée, en euros. */
  readonly seasonBalance: number;
}

// =============================================================================
// Ce que le board réclame
// =============================================================================

/** Part de minutes attendue des jeunes quand le board en fait une exigence. */
export const YOUTH_MINUTES_TARGET = 0.12;

/**
 * Attentes formulées pour la saison qui s'ouvre.
 *
 * L'ordre de priorité n'est pas neutre : une masse salariale hors des clous
 * menace l'existence du club, un quota JIFF menace ses résultats, le reste est
 * du confort. On sert les deux plus urgentes.
 */
export function computeExpectations(
  club: Club,
  situation: ClubSituation,
): readonly BoardExpectation[] {
  const candidates: { readonly priority: number; readonly expectation: BoardExpectation }[] = [];

  if (situation.capUsage > 92) {
    candidates.push({
      priority: 3,
      expectation: {
        kind: 'MASSE_SALARIALE',
        target: 92,
        wording: 'Ramener la masse salariale sous 92 % du plafond.',
      },
    });
  }

  if (situation.jiffHeadroom <= 2) {
    candidates.push({
      priority: 2,
      expectation: {
        kind: 'QUOTA_JIFF',
        target: 4,
        wording: 'Reconstituer une marge d\'au moins quatre recrues hors formation française.',
      },
    });
  }

  if (situation.seasonBalance < 0) {
    candidates.push({
      priority: 2,
      expectation: {
        kind: 'COMPTES_EQUILIBRES',
        target: 0,
        wording: 'Terminer l\'exercice à l\'équilibre.',
      },
    });
  }

  // Un petit club forme parce qu'il n'a pas les moyens d'acheter : l'exigence
  // est d'autant plus légitime que le club est modeste.
  if (situation.youthMinutesRatio < YOUTH_MINUTES_TARGET && club.tier !== 'GROS_BUDGET') {
    candidates.push({
      priority: 1,
      expectation: {
        kind: 'JEUNES_AU_JEU',
        target: YOUTH_MINUTES_TARGET,
        wording: 'Confier au moins 12 % des minutes aux moins de 23 ans.',
      },
    });
  }

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map(c => c.expectation);
}

// =============================================================================
// Le verdict
// =============================================================================

export interface ExpectationResult {
  readonly expectation: BoardExpectation;
  readonly met: boolean;
  /** Ce qui a été réalisé, formulé pour le manager. */
  readonly summary: string;
}

export function judgeExpectations(
  expectations: readonly BoardExpectation[],
  situation: ClubSituation,
): readonly ExpectationResult[] {
  return expectations.map(expectation => {
    switch (expectation.kind) {
      case 'MASSE_SALARIALE': {
        const met = situation.capUsage <= expectation.target;
        return {
          expectation,
          met,
          summary: `Masse salariale à ${Math.round(situation.capUsage)} % du plafond`,
        };
      }
      case 'QUOTA_JIFF': {
        const met = situation.jiffHeadroom >= expectation.target;
        return {
          expectation,
          met,
          summary: `Marge de ${situation.jiffHeadroom} recrue${situation.jiffHeadroom > 1 ? 's' : ''} hors formation française`,
        };
      }
      case 'JEUNES_AU_JEU': {
        const met = situation.youthMinutesRatio >= expectation.target;
        return {
          expectation,
          met,
          summary: `${Math.round(situation.youthMinutesRatio * 100)} % des minutes aux moins de 23 ans`,
        };
      }
      case 'COMPTES_EQUILIBRES': {
        const met = situation.seasonBalance >= expectation.target;
        return {
          expectation,
          met,
          summary: situation.seasonBalance >= 0
            ? `Exercice bénéficiaire de ${fmt(situation.seasonBalance)}`
            : `Déficit de ${fmt(-situation.seasonBalance)}`,
        };
      }
    }
  });
}

/**
 * Effet sur la confiance du board.
 *
 * Volontairement plus faible que le classement : ce sont des exigences de
 * gestion, pas la mission principale. Les faire peser autant que le sportif
 * transformerait le jeu en tableur.
 */
export function confidenceDelta(results: readonly ExpectationResult[]): number {
  return results.reduce((sum, r) => sum + (r.met ? 4 : -6), 0);
}

function fmt(euros: number): string {
  return Math.abs(euros) >= 1_000_000
    ? `${(euros / 1_000_000).toFixed(1)} M€`
    : `${Math.round(euros / 1000)} k€`;
}
