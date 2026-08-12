/**
 * Modèle de jeu courant — V0.1 simplifié.
 *
 * Référence : 06-moteur-match.md, plan de travail "tous simplifiés".
 *
 * V0.1 : score équipe attaque vs équipe défense → meters / break / handling / try (en zone rouge).
 * V0.2+ : passes/courses/offloads granulaires, lignes défensives, percées qualifiées.
 *
 * C'est la phase la plus "feeder" du moteur — elle alimente la majorité des ~75 phases d'un match.
 */

import type { Player } from '../types.js';
import type { Rng } from '../rng.js';
import type { PhaseOutcome, Possession } from './types.js';
import { indisciplineMultiplier, pickOffender, rollCard } from './discipline.js';
import { resolveCarrySequence } from './carry.js';

/**
 * Sélection pondérée d'un marqueur d'essai.
 * Ailiers et arrière inscrivent la majorité des essais ; les avants ont leur part
 * (mauls pénétrants, pick-and-go) — V0.2 simplifié à 12% côté pack.
 */
function pickTryScorer(backs: readonly Player[], pack: readonly Player[], rng: Rng): Player {
  if (rng.next() < 0.12 && pack.length > 0) {
    // Essai côté pack : 3e ligne et talonneur préférés
    const packWeights = pack.map(p => {
      const positionBonus =
        p.position === 'NUMERO_8' || p.position === 'TROISIEME_LIGNE_AILE_GAUCHE' || p.position === 'TROISIEME_LIGNE_AILE_DROITE' ? 30 :
        p.position === 'TALONNEUR' ? 20 : 10;
      return p.physical.puissance * 0.5 + p.technical.conservation * 0.3 + positionBonus;
    });
    return weightedPick(pack, packWeights, rng);
  }

  if (backs.length === 0) return pack[0] ?? backs[0]!;

  const weights = backs.map(p => {
    const finition = p.positionSpecific.finition ?? 50;
    const base = p.physical.vitesse * 0.4 + finition * 0.4;
    const positionBonus =
      p.position === 'AILIER_GAUCHE' || p.position === 'AILIER_DROIT' ? 35 :
      p.position === 'ARRIERE' ? 25 :
      p.position === 'CENTRE_INTERIEUR' || p.position === 'CENTRE_EXTERIEUR' ? 18 :
      p.position === 'OUVREUR' ? 12 :
      p.position === 'DEMI_DE_MELEE' ? 8 : 0;
    return base + positionBonus;
  });
  return weightedPick(backs, weights, rng);
}

function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || items.length === 0) return items[0]!;
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return items[i] ?? items[0]!;
  }
  return items[items.length - 1] ?? items[0]!;
}

export interface OpenPlayInput {
  readonly attackBacks: readonly Player[];
  readonly defenseBacks: readonly Player[];
  readonly attackPack: readonly Player[];
  readonly defensePack: readonly Player[];
  readonly attackPossession: 'HOME' | 'AWAY';
  /** -50 (en-but propre) à +50 (en-but adverse), du point de vue de l'attaquant. */
  readonly fieldPosition: number;
  readonly fatigueAttack: number;
  readonly fatigueDefense: number;
  /** Compteur de phases consécutives en possession (la défense fatigue plus vite). */
  readonly phaseInPossession: number;
  /** Bonus tactique (avantage maison + plan pré-match), exprimé sur l'échelle 0-100. */
  readonly attackTacticalBonus: number;
  readonly defenseTacticalBonus: number;
  /**
   * V0.32 — coefficients issus des plans de match. Tous à 1 par défaut : le
   * moteur reste calibré sur un jeu sans parti pris.
   */
  readonly kickTendency?: number;
  readonly attackErrorRisk?: number;
  readonly defensePressure?: number;
  readonly defensePenaltyRisk?: number;
  readonly defenseTryRisk?: number;
  /**
   * Multiplicateur d'indiscipline apporté par ce qui n'est pas dans les
   * attributs : le capitaine (V0.50) et l'état du vestiaire (V0.51). Absent =
   * ni capitaine sur le terrain, ni écart au moral neutre.
   */
  readonly attackDisciplineFactor?: number;
  readonly defenseDisciplineFactor?: number;
  /** V0.52 — main plus ou moins leste de l'arbitre, par camp. */
  readonly attackCardRate?: number;
  readonly defenseCardRate?: number;
}

/** Narration d'une pénalité, carton compris. */
function cardSummary(
  offender: Player | undefined,
  card: 'YELLOW' | 'RED' | undefined,
  kind: 'obtenue' | 'concédée',
): string {
  if (!offender) return `pénalité ${kind}`;
  if (card === 'RED') return `CARTON ROUGE pour ${offender.lastName} !`;
  if (card === 'YELLOW') return `carton jaune pour ${offender.lastName}`;
  return kind === 'obtenue'
    ? `pénalité obtenue — faute de ${offender.lastName}`
    : `pénalité concédée par ${offender.lastName}`;
}

function attackStrength(backs: readonly Player[], pack: readonly Player[], fatigue: number): number {
  const fatigueMul = 1 - (fatigue / 100) * 0.30;
  let backsScore = 0;
  if (backs.length > 0) {
    for (const b of backs) {
      backsScore += b.technical.passe * 0.30 + b.physical.vitesse * 0.30 + b.technical.visionDeJeu * 0.20 + b.physical.puissance * 0.20;
    }
    backsScore /= backs.length;
  }
  let packBonus = 0;
  if (pack.length > 0) {
    for (const p of pack) {
      packBonus += p.physical.puissance * 0.50 + p.technical.conservation * 0.50;
    }
    packBonus = (packBonus / pack.length) * 0.30;
  }
  return (backsScore + packBonus) * fatigueMul;
}

function defenseStrength(backs: readonly Player[], pack: readonly Player[], fatigue: number): number {
  const fatigueMul = 1 - (fatigue / 100) * 0.30;
  let backsScore = 0;
  if (backs.length > 0) {
    for (const b of backs) {
      backsScore += b.technical.plaquage * 0.50 + b.physical.vitesse * 0.20 + b.mental.agressivite * 0.30;
    }
    backsScore /= backs.length;
  }
  let packBonus = 0;
  if (pack.length > 0) {
    for (const p of pack) {
      packBonus += p.technical.plaquage * 0.60 + p.physical.puissance * 0.40;
    }
    packBonus = (packBonus / pack.length) * 0.30;
  }
  return (backsScore + packBonus) * fatigueMul;
}

export function simulateOpenPlay(input: OpenPlayInput, rng: Rng): PhaseOutcome {
  const att = attackStrength(input.attackBacks, input.attackPack, input.fatigueAttack);
  const def = defenseStrength(input.defenseBacks, input.defensePack, input.fatigueDefense);
  const delta = (att + input.attackTacticalBonus) - (def + input.defenseTacticalBonus);

  const inRedZone = input.fieldPosition >= 35;
  // Calibration V0.12 : amplification du delta en jeu courant (auparavant flat 0.11)
  // pour que les écarts de niveau se traduisent en plus d'essais (cf. tools/calibrate.ts).
  //
  // V0.13 : la zone rouge ne produit plus d'essai directement (elle valait 92 %,
  // ce qui rendait toute défense de ligne impossible). Elle bascule désormais vers
  // une séquence GOAL_LINE résolue par attrition — voir goal-line.ts. Le routage
  // est fait en amont par la session ; ici on garde une petite proba d'essai au
  // large (débordement direct) pour ne pas tout ramener au pilonnage.
  // V0.13 : sensibilité au delta réduite hors zone rouge. Possession et taux de
  // victoire sont fortement couplés ; c'est ici qu'on les découple, en laissant
  // le fort garder son avantage territorial sans le convertir mécaniquement.
  const defenseTryRisk = input.defenseTryRisk ?? 1;
  const tryProb = (inRedZone
    ? 0.16 + Math.tanh(delta / 40) * 0.05
    : 0.136 + Math.tanh(delta / 50) * 0.014) * defenseTryRisk;
  // Calibration V0.12 : la pression défensive cause plus d'erreurs de manipulation
  // (auparavant insensible au delta — équipe faible gardait trop la balle).
  // V0.13 : sensibilité au delta relevée. C'est le levier de possession le plus
  // « propre » — une équipe surclassée rend le ballon sans que cela se traduise
  // mécaniquement par des points adverses, contrairement aux pénalités.
  // V0.32 : la faute de main dépend aussi des deux plans — ce que l'attaque
  // accepte de risquer en gardant le ballon, et ce que la défense va chercher.
  const handlingErrorProb =
    (0.012 + (input.fatigueAttack / 100) * 0.012 + Math.max(0, -delta / 1050))
    * (input.attackErrorRisk ?? 1)
    * (input.defensePressure ?? 1);
  // jeu au pied tactique : plus probable depuis sa moitié, presque jamais en zone rouge
  const tacticalKickProb =
    (inRedZone ? 0.005 : input.fieldPosition < 0 ? 0.06 : 0.020) * (input.kickTendency ?? 1);
  // V0.13 : sanctions du jeu courant (plaquage haut, hors-jeu du rideau défensif,
  // obstruction), désormais pondérées par la discipline des deux camps.
  // V0.50 — le capitaine tient son groupe : le facteur vaut 1 quand il n'y en
  // a pas, ou qu'il a quitté le terrain.
  const defenseIndiscipline = indisciplineMultiplier(
    [...input.defenseBacks, ...input.defensePack], input.fatigueDefense,
  ) * (input.defenseDisciplineFactor ?? 1);
  const attackIndiscipline = indisciplineMultiplier(
    [...input.attackBacks, ...input.attackPack], input.fatigueAttack,
  ) * (input.attackDisciplineFactor ?? 1);
  // Une attaque dominante met le rideau adverse en retard et lui arrache des fautes :
  // sans ce terme, les pénalités profitaient autant au faible qu'au fort et
  // remontaient artificiellement la possession des petites équipes.
  const pressure = 1 + Math.tanh(delta / 38) * 0.07;
  const penaltyAttackProb =
    0.162 * defenseIndiscipline * pressure * (input.defensePenaltyRisk ?? 1);   // faute de la défense
  const penaltyDefenseProb = (0.068 * attackIndiscipline) / pressure; // faute de l'attaque
  // reliquat → ruck (continuité)

  const r = rng.next();
  let acc = 0;

  if (r < (acc += tryProb)) {
    const meters = Math.max(5, 50 - input.fieldPosition);
    const scorer = pickTryScorer(input.attackBacks, input.attackPack, rng);
    return {
      possessionAfter: input.attackPossession,
      metersGained: meters,
      nextPhase: 'TRY',
      tryScored: input.attackPossession,
      keyPlayerId: scorer.id,
      summary: `essai marqué par ${scorer.firstName} ${scorer.lastName} !`,
    };
  }
  if (r < (acc += handlingErrorProb)) {
    const other: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'SCRUM',
      summary: 'en-avant — mêlée pour la défense',
    };
  }
  if (r < (acc += tacticalKickProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'KICK',
      summary: 'jeu au pied tactique',
    };
  }
  if (r < (acc += penaltyAttackProb)) {
    const offender = pickOffender([...input.defenseBacks, ...input.defensePack], rng);
    const card = rollCard(offender, rng, input.defenseCardRate ?? 1);
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: input.attackPossession,
      ...(offender ? { keyPlayerId: offender.id } : {}),
      ...(card && offender ? { cardIssued: { color: card, playerId: offender.id } } : {}),
      summary: cardSummary(offender, card, 'obtenue'),
    };
  }
  if (r < (acc += penaltyDefenseProb)) {
    const other: 'HOME' | 'AWAY' = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    const offender = pickOffender([...input.attackBacks, ...input.attackPack], rng);
    const card = rollCard(offender, rng, input.attackCardRate ?? 1);
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: other,
      ...(offender ? { keyPlayerId: offender.id } : {}),
      ...(card && offender ? { cardIssued: { color: card, playerId: offender.id } } : {}),
      summary: cardSummary(offender, card, 'concédée'),
    };
  }

  // -------------------------------------------------------------------------
  // Reliquat : continuité. V0.13 — c'est ici que le jeu devient individuel.
  //
  // Au lieu d'un gain calculé sur la moyenne des deux équipes, on désigne un
  // porteur et le défenseur qui lui fait face, et on résout leur duel. Les mètres,
  // les plaquages manqués, les défenseurs battus et les ballons grattés sont
  // désormais attribués à des joueurs nommés.
  // -------------------------------------------------------------------------
  const sequence = resolveCarrySequence(
    {
      attackPack: input.attackPack,
      attackBacks: input.attackBacks,
      defensePack: input.defensePack,
      defenseBacks: input.defenseBacks,
      phaseInPossession: input.phaseInPossession,
      fieldPosition: input.fieldPosition,
      fatigueAttack: input.fatigueAttack,
      fatigueDefense: input.fatigueDefense,
      attackTacticalBonus: input.attackTacticalBonus,
      defenseTacticalBonus: input.defenseTacticalBonus,
    },
    rng,
  );

  if (!sequence) {
    // Feuille de match dégénérée (tests unitaires) : on retombe sur l'ancien modèle.
    const meters = Math.max(0, 8.5 + delta / 35 + rng.nextGaussian(0, 1.5));
    return {
      possessionAfter: input.attackPossession,
      metersGained: meters,
      nextPhase: 'RUCK',
      summary: meters > 8 ? 'percée dans la défense' : meters > 3 ? 'avancée' : 'plaquage rapide',
    };
  }

  const other: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';

  if (sequence.outcome === 'HANDLING_ERROR') {
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'SCRUM',
      keyPlayerId: sequence.carrier.id,
      contributions: sequence.contributions,
      summary: `${sequence.summary} — mêlée pour la défense`,
    };
  }
  if (sequence.outcome === 'TURNOVER') {
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      keyPlayerId: sequence.defender.id,
      contributions: sequence.contributions,
      summary: sequence.summary,
    };
  }

  return {
    possessionAfter: input.attackPossession,
    metersGained: sequence.metersGained,
    nextPhase: 'RUCK',
    keyPlayerId: sequence.carrier.id,
    contributions: sequence.contributions,
    summary: sequence.summary,
  };
}
