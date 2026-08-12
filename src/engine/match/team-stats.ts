/**
 * Statistiques d'équipe d'un match — V0.36.
 *
 * Le bilan d'après-match rapportait les ballons portés à 5 m, les pénalités et
 * les remplacements. Pas la possession, pas le territoire, pas la conquête —
 * c'est-à-dire précisément les indicateurs que le plan de match déplace.
 *
 * Le manager pouvait donc choisir une occupation haute, une défense montante et
 * un travail de mêlée, puis n'avoir **aucun moyen de savoir si ça avait marché**.
 * Un réglage sans retour n'est pas une décision, c'est une préférence.
 *
 * Tout est dérivé des phases déjà enregistrées : ce module ne fait que lire le
 * déroulé du match, il n'ajoute rien au moteur.
 */

import type { MatchResult, PhaseRecord, Possession } from './types.js';

// =============================================================================
// Modèle
// =============================================================================

export interface SetPieceRecord {
  readonly won: number;
  readonly total: number;
}

export interface TeamMatchStats {
  /** Part des phases jouées en possession, en pourcentage. */
  readonly possession: number;
  /**
   * Part de **ses propres** possessions jouées dans le camp adverse, en
   * pourcentage. Les deux équipes peuvent donc dépasser 50 % ensemble : ce
   * n'est pas un partage du terrain mais la hauteur de jeu de chacune.
   *
   * C'est la lecture du territoire la plus honnête ici : le moteur suit une
   * position de balle signée, pas des mètres parcourus.
   */
  readonly territory: number;
  readonly scrums: SetPieceRecord;
  readonly lineouts: SetPieceRecord;
  /** Coups de pied tactiques tentés. */
  readonly kicks: number;
  /** Pénalités concédées à l'adversaire. */
  readonly penaltiesConceded: number;
  readonly tries: number;
  /** Ballons perdus sur faute de main ou turnover. */
  readonly turnoversLost: number;
  /** Séquences à cinq mètres de la ligne adverse. */
  readonly goalLineSequences: number;
}

export interface MatchTeamStats {
  readonly home: TeamMatchStats;
  readonly away: TeamMatchStats;
}

// =============================================================================
// Calcul
// =============================================================================

function other(side: Possession): Possession {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function computeSide(phases: readonly PhaseRecord[], side: Possession): TeamMatchStats {
  const opponent = other(side);

  let inPossession = 0;
  let inOpponentHalf = 0;
  let scrumWon = 0, scrumTotal = 0;
  let lineoutWon = 0, lineoutTotal = 0;
  let kicks = 0;
  let penaltiesConceded = 0;
  let tries = 0;
  let turnoversLost = 0;
  let goalLineSequences = 0;

  let previousType: PhaseRecord['type'] | undefined;

  for (const phase of phases) {
    const hasBall = phase.state.possession === side;

    if (hasBall) {
      inPossession += 1;
      // `fieldPosition` est signé du point de vue du porteur : positif = on
      // joue chez l'adversaire. Ne compter que les phases en possession évite
      // de compter deux fois le même bout de terrain.
      if (phase.state.fieldPosition > 0) inOpponentHalf += 1;
    }

    switch (phase.type) {
      case 'SCRUM':
        if (hasBall) {
          scrumTotal += 1;
          if (phase.outcome.possessionAfter === side) scrumWon += 1;
        }
        break;
      case 'LINEOUT':
        if (hasBall) {
          lineoutTotal += 1;
          if (phase.outcome.possessionAfter === side) lineoutWon += 1;
        }
        break;
      case 'KICK':
        if (hasBall) kicks += 1;
        break;
      case 'GOAL_LINE':
        // Une séquence, pas une phase : on ne compte que l'entrée dans la zone.
        if (hasBall && previousType !== 'GOAL_LINE') goalLineSequences += 1;
        break;
      default:
        break;
    }

    if (phase.outcome.penaltyAwarded === opponent) penaltiesConceded += 1;
    if (phase.outcome.tryScored === side) tries += 1;
    // Perte de balle hors sanction : faute de main, ballon gratté, mêlée perdue.
    if (hasBall
      && phase.outcome.possessionAfter === opponent
      && phase.outcome.penaltyAwarded === undefined
      && phase.outcome.tryScored === undefined) {
      turnoversLost += 1;
    }

    previousType = phase.type;
  }

  const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 100));

  return {
    possession: pct(inPossession, phases.length),
    territory: pct(inOpponentHalf, inPossession),
    scrums: { won: scrumWon, total: scrumTotal },
    lineouts: { won: lineoutWon, total: lineoutTotal },
    kicks,
    penaltiesConceded,
    tries,
    turnoversLost,
    goalLineSequences,
  };
}

export function computeTeamStats(result: MatchResult): MatchTeamStats {
  return {
    home: computeSide(result.phases, 'HOME'),
    away: computeSide(result.phases, 'AWAY'),
  };
}

// =============================================================================
// Lecture du plan
// =============================================================================

export interface PlanVerdict {
  /** Le curseur concerné, pour que le manager sache quoi ajuster. */
  readonly dial: 'Occupation' | 'Défense' | 'Conquête';
  readonly reading: string;
}

/**
 * Ce que le plan a produit, formulé en français.
 *
 * On ne dit pas « bon » ou « mauvais » : un plan n'est ni l'un ni l'autre dans
 * l'absolu. On rapporte ce qu'il a effectivement provoqué, et le manager en
 * tire ses conclusions — c'est la seule lecture honnête d'un système dont
 * aucun réglage n'est censé dominer.
 */
export function readPlanOutcome(
  mine: TeamMatchStats,
  theirs: TeamMatchStats,
  plan: { occupation: string; defensiveLine: string; setPiecesFocus: readonly string[] },
): readonly PlanVerdict[] {
  const verdicts: PlanVerdict[] = [];

  // ---- Occupation ----------------------------------------------------------
  if (plan.occupation === 'HAUTE') {
    verdicts.push({
      dial: 'Occupation',
      reading: `${mine.kicks} coup${mine.kicks > 1 ? 's' : ''} de pied tactique${mine.kicks > 1 ? 's' : ''} pour ${mine.territory} % du jeu dans leur camp — au prix de ${mine.possession} % de possession.`,
    });
  } else if (plan.occupation === 'BASSE') {
    verdicts.push({
      dial: 'Occupation',
      reading: `${mine.possession} % de possession gardée, mais ${mine.turnoversLost} ballon${mine.turnoversLost > 1 ? 's' : ''} perdu${mine.turnoversLost > 1 ? 's' : ''} en jouant de loin.`,
    });
  } else {
    verdicts.push({
      dial: 'Occupation',
      reading: `${mine.possession} % de possession, ${mine.territory} % du jeu chez eux — sans parti pris territorial.`,
    });
  }

  // ---- Défense -------------------------------------------------------------
  const diff = mine.penaltiesConceded - theirs.penaltiesConceded;
  if (plan.defensiveLine === 'MONTANTE') {
    verdicts.push({
      dial: 'Défense',
      reading: `${theirs.turnoversLost} ballon${theirs.turnoversLost > 1 ? 's' : ''} arraché${theirs.turnoversLost > 1 ? 's' : ''} à l'adversaire, pour ${mine.penaltiesConceded} pénalité${mine.penaltiesConceded > 1 ? 's' : ''} concédée${mine.penaltiesConceded > 1 ? 's' : ''}${diff > 0 ? ` (${diff} de plus qu'eux)` : ''}.`,
    });
  } else if (plan.defensiveLine === 'STAND_OFF') {
    verdicts.push({
      dial: 'Défense',
      reading: `${mine.penaltiesConceded} pénalité${mine.penaltiesConceded > 1 ? 's' : ''} concédée${mine.penaltiesConceded > 1 ? 's' : ''}, mais ${theirs.possession} % de possession laissée et ${theirs.goalLineSequences} incursion${theirs.goalLineSequences > 1 ? 's' : ''} à cinq mètres.`,
    });
  } else {
    verdicts.push({
      dial: 'Défense',
      reading: `${mine.penaltiesConceded} pénalité${mine.penaltiesConceded > 1 ? 's' : ''} concédée${mine.penaltiesConceded > 1 ? 's' : ''}, ${theirs.turnoversLost} ballon${theirs.turnoversLost > 1 ? 's' : ''} récupéré${theirs.turnoversLost > 1 ? 's' : ''}.`,
    });
  }

  // ---- Conquête ------------------------------------------------------------
  const focus = plan.setPiecesFocus.filter(f => f !== 'NONE');
  const rate = (r: SetPieceRecord): string =>
    r.total === 0 ? '—' : `${Math.round((r.won / r.total) * 100)} % (${r.won}/${r.total})`;

  verdicts.push({
    dial: 'Conquête',
    reading: focus.length > 0
      ? `Mêlée ${rate(mine.scrums)}, touche ${rate(mine.lineouts)} — après ${focus.length} axe${focus.length > 1 ? 's' : ''} travaillé${focus.length > 1 ? 's' : ''}.`
      : `Mêlée ${rate(mine.scrums)}, touche ${rate(mine.lineouts)} — sans préparation spécifique.`,
  });

  return verdicts;
}
