/**
 * Modèle de ruck — V0.1 simplifié.
 *
 * Référence : 06-moteur-match.md, plan de travail "tous simplifiés".
 *
 * V0.1 : ratio attaque/défense → quick ball / slow ball / turnover / pénalité.
 * V0.2+ : vitesse de libération en ms simulés, contests multiples, mauls pénétrants.
 */

import type { Player } from '../types.js';
import type { Rng } from '../rng.js';
import type { PhaseOutcome, Possession } from './types.js';
import { indisciplineMultiplier, pickOffender, rollCard } from './discipline.js';

export interface RuckInput {
  readonly attackForwardsClose: readonly Player[];      // 2-4 supporters au point de fixation
  readonly defenseForwardsClose: readonly Player[];
  readonly attackPossession: 'HOME' | 'AWAY';
  readonly fatigueAttack: number;
  readonly fatigueDefense: number;
  readonly attackTacticalBonus: number;
  readonly defenseTacticalBonus: number;
  /**
   * Multiplicateur d'indiscipline hors attributs : capitaine (V0.50) et état du
   * vestiaire (V0.51). Absent = rien de plus ni de moins.
   */
  readonly attackDisciplineFactor?: number;
  readonly defenseDisciplineFactor?: number;
  /** V0.52 — main plus ou moins leste de l'arbitre, par camp. */
  readonly attackCardRate?: number;
  readonly defenseCardRate?: number;
  /**
   * V0.52 — consigne de contest au sol.
   *
   * C'est l'arbitrage que l'arbitre impose au manager : contester rapporte des
   * ballons et coûte des pénalités. Les deux facteurs vont donc toujours dans
   * le même sens.
   */
  readonly attackTurnoverFactor?: number;
  readonly defenseTurnoverFactor?: number;
}

function ruckStrength(forwards: readonly Player[], fatigue: number): number {
  if (forwards.length === 0) return 0;
  const fatigueMul = 1 - (fatigue / 100) * 0.30;
  let total = 0;
  for (const p of forwards) {
    total += p.technical.deblayage * 0.5 + p.physical.puissance * 0.3 + p.physical.endurance * 0.2;
  }
  return (total / forwards.length) * fatigueMul;
}

export function simulateRuck(input: RuckInput, rng: Rng): PhaseOutcome {
  const att = ruckStrength(input.attackForwardsClose, input.fatigueAttack);
  const def = ruckStrength(input.defenseForwardsClose, input.fatigueDefense);
  const delta = (att + input.attackTacticalBonus) - (def + input.defenseTacticalBonus);

  // Quick ball domine quand l'attaque est meilleure ; turnover augmente quand la défense domine
  const quickBallProb = 0.70 + Math.tanh(delta / 35) * 0.08;            // 0.62 - 0.78 (skill-gap atténué)
  const slowBallProb = 0.18;
  // Le turnover est gagné par la défense : c'est donc sa consigne qui pèse.
  const turnoverProb = Math.max(0.025, 0.07 - Math.tanh(delta / 40) * 0.055)
    * (input.defenseTurnoverFactor ?? 1);

  // V0.13 : le regroupement est la première source de sanctions du rugby réel
  // (ne pas relâcher, hors-jeu, mains dans le ruck, déblayage dangereux). Le taux
  // était figé à 3 % et ignorait la discipline des joueurs — désormais il en dépend.
  const attackIndiscipline = indisciplineMultiplier(input.attackForwardsClose, input.fatigueAttack)
    * (input.attackDisciplineFactor ?? 1);
  const defenseIndiscipline = indisciplineMultiplier(input.defenseForwardsClose, input.fatigueDefense)
    * (input.defenseDisciplineFactor ?? 1);
  // Même logique qu'en jeu courant : le pack qui avance force la faute adverse.
  const pressure = 1 + Math.tanh(delta / 38) * 0.07;
  const defensePenaltyProb = 0.232 * defenseIndiscipline * pressure;
  const attackPenaltyProb = (0.120 * attackIndiscipline) / pressure;
  const penaltyProb = defensePenaltyProb + attackPenaltyProb;

  const r = rng.next();
  let acc = 0;

  if (r < (acc += quickBallProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      summary: 'ballon ressorti rapidement',
    };
  }
  if (r < (acc += slowBallProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      summary: 'ballon ressorti lentement',
    };
  }
  if (r < (acc += turnoverProb)) {
    const other: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      summary: 'turnover sur le ruck',
    };
  }
  if (r < (acc += penaltyProb)) {
    // Qui est sanctionné dépend du rapport d'indiscipline des deux packs.
    const sanctionedDefender = rng.next() < defensePenaltyProb / penaltyProb;
    const beneficiary: 'HOME' | 'AWAY' = sanctionedDefender
      ? input.attackPossession
      : (input.attackPossession === 'HOME' ? 'AWAY' : 'HOME');
    const offender = pickOffender(
      sanctionedDefender ? input.defenseForwardsClose : input.attackForwardsClose,
      rng,
    );
    // Le ruck est la première source de cartons du rugby moderne : c'est là
    // qu'on plaque haut, qu'on ne se relève pas et qu'on répète la faute.
    const card = rollCard(
      offender, rng,
      (sanctionedDefender ? input.defenseCardRate : input.attackCardRate) ?? 1,
    );
    return {
      possessionAfter: beneficiary,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: beneficiary,
      ...(offender ? { keyPlayerId: offender.id } : {}),
      ...(card && offender ? { cardIssued: { color: card, playerId: offender.id } } : {}),
      summary: card === 'RED' ? `CARTON ROUGE pour ${offender?.lastName ?? 'un joueur'} !`
        : card === 'YELLOW' ? `carton jaune pour ${offender?.lastName ?? 'un joueur'}`
        : sanctionedDefender
          ? `pénalité — hors-jeu${offender ? ` de ${offender.lastName}` : ''}`
          : `pénalité — ballon tenu au sol${offender ? ` par ${offender.lastName}` : ''}`,
    };
  }

  // reliquat : pile-up, mêlée
  const other: 'HOME' | 'AWAY' = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
  return {
    possessionAfter: other,
    metersGained: 0,
    nextPhase: 'SCRUM',
    summary: 'pile-up, mêlée pour la défense',
  };
}
