/**
 * Défense de ligne — V0.13.
 *
 * Jusqu'ici, arriver à 15 mètres de l'en-but valait 92 % d'essai sur la phase
 * suivante (`openplay.ts`, branche `inRedZone`). Autrement dit : franchir les 22
 * mètres revenait à marquer, et le moment le plus dramatique du rugby — le
 * pilonnage à cinq mètres, la défense qui tient huit temps, le grattage héroïque,
 * l'en-avant sur la ligne — n'existait tout simplement pas dans le moteur.
 *
 * Ce module introduit une phase dédiée `GOAL_LINE`, résolue par attrition :
 *
 *  - chaque temps de jeu près de la ligne use la défense (la proba d'essai monte)
 *  - mais il use aussi l'attaque, et multiplie les occasions de la perdre
 *    (en-avant, grattage, tenu, pénalité pour tenue de balle au sol)
 *  - la défense qui tient plusieurs temps gagne un ascendant : c'est le
 *    "goal line stand", et il finit par produire une pénalité *pour* elle
 *
 * Le résultat est qu'une entrée dans les 22 vaut désormais une séquence, avec un
 * dénouement incertain — pas un essai automatique.
 */

import type { Player } from '../types.js';
import type { Rng } from '../rng.js';
import type { PhaseOutcome, Possession } from './types.js';

export interface GoalLineInput {
  readonly attackPack: readonly Player[];
  readonly attackBacks: readonly Player[];
  readonly defensePack: readonly Player[];
  readonly defenseBacks: readonly Player[];
  readonly attackPossession: 'HOME' | 'AWAY';
  /** -50..+50, du point de vue de l'attaquant. On n'entre ici qu'au-delà de 35. */
  readonly fieldPosition: number;
  readonly fatigueAttack: number;
  readonly fatigueDefense: number;
  /** Nombre de temps déjà joués dans cette séquence à la ligne. */
  readonly phasesAtLine: number;
  readonly attackTacticalBonus: number;
  readonly defenseTacticalBonus: number;
}

/**
 * Puissance de pénétration près de la ligne : c'est du combat, pas de la vitesse.
 * Le pack pèse l'essentiel ; les trois-quarts n'apportent qu'un appoint.
 */
function pickAndGoPower(pack: readonly Player[], backs: readonly Player[], fatigue: number): number {
  const fatigueMul = 1 - (fatigue / 100) * 0.32;
  let packScore = 0;
  if (pack.length > 0) {
    for (const p of pack) {
      packScore +=
        p.physical.puissance * 0.40 +
        p.technical.conservation * 0.35 +
        p.technical.deblayage * 0.25;
    }
    packScore /= pack.length;
  }
  let backsScore = 0;
  if (backs.length > 0) {
    for (const b of backs) {
      backsScore += b.physical.puissance * 0.50 + b.technical.conservation * 0.50;
    }
    backsScore = (backsScore / backs.length) * 0.25;
  }
  return (packScore + backsScore) * fatigueMul;
}

/**
 * Résistance du rideau sur sa ligne : plaquage, agressivité, et le grattage des
 * troisièmes lignes qui est *la* compétence décisive dans cette zone.
 */
function goalLineResistance(pack: readonly Player[], backs: readonly Player[], fatigue: number): number {
  const fatigueMul = 1 - (fatigue / 100) * 0.32;
  let packScore = 0;
  if (pack.length > 0) {
    for (const p of pack) {
      const grattage = p.positionSpecific.grattage ?? p.technical.deblayage * 0.7;
      packScore +=
        p.technical.plaquage * 0.42 +
        p.mental.agressivite * 0.23 +
        grattage * 0.20 +
        p.physical.endurance * 0.15;
    }
    packScore /= pack.length;
  }
  let backsScore = 0;
  if (backs.length > 0) {
    for (const b of backs) {
      backsScore += b.technical.plaquage * 0.65 + b.mental.agressivite * 0.35;
    }
    backsScore = (backsScore / backs.length) * 0.25;
  }
  return (packScore + backsScore) * fatigueMul;
}

/** Choisit le marqueur d'un essai de pilonnage : les avants s'imposent largement. */
function pickCloseRangeScorer(
  pack: readonly Player[],
  backs: readonly Player[],
  rng: Rng,
): Player | undefined {
  // 72 % des essais à cinq mètres sont inscrits par un avant (pick-and-go, maul).
  const fromPack = rng.next() < 0.72 && pack.length > 0;
  const pool = fromPack ? pack : (backs.length > 0 ? backs : pack);
  if (pool.length === 0) return undefined;

  const weights = pool.map(p => {
    const positionBonus =
      p.position === 'NUMERO_8' ? 28 :
      p.position === 'TALONNEUR' ? 24 :
      p.position === 'TROISIEME_LIGNE_AILE_GAUCHE' || p.position === 'TROISIEME_LIGNE_AILE_DROITE' ? 20 :
      p.position === 'PILIER_GAUCHE' || p.position === 'PILIER_DROIT' ? 14 :
      p.position === 'DEMI_DE_MELEE' ? 22 : 8;
    return p.physical.puissance * 0.45 + p.technical.conservation * 0.30 + positionBonus;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[0];
  let r = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return pool[i] ?? pool[0];
  }
  return pool[pool.length - 1] ?? pool[0];
}

/**
 * Un temps de jeu à cinq mètres.
 *
 * Les coefficients sont calibrés (cf. `tools/calibrate.ts`) pour qu'une séquence
 * complète dure 2 à 5 temps et se conclue par un essai environ deux fois sur trois —
 * le reste se partageant entre pénalité, grattage, en-avant et tenu.
 */
export function simulateGoalLine(input: GoalLineInput, rng: Rng): PhaseOutcome {
  const att = pickAndGoPower(input.attackPack, input.attackBacks, input.fatigueAttack);
  const def = goalLineResistance(input.defensePack, input.defenseBacks, input.fatigueDefense);
  const delta = (att + input.attackTacticalBonus) - (def + input.defenseTacticalBonus);

  const other: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
  const phases = input.phasesAtLine;

  // Attrition : chaque temps supplémentaire fissure un peu le rideau…
  const attrition = Math.min(0.22, phases * 0.045);
  // …mais l'attaque s'épuise aussi et finit par commettre la faute.
  const attackErrorDrift = Math.min(0.10, phases * 0.018);

  // Les probabilités de sortie sont volontairement basses : c'est ce qui allonge
  // les séquences (3-4 temps en moyenne) et crée la tension du pilonnage. Ce sont
  // leurs *ratios* qui déterminent le dénouement, pas leurs valeurs absolues.
  const tryProb = Math.max(0.05, 0.335 + Math.tanh(delta / 26) * 0.045 + attrition);
  // Pénalité concédée par une défense sous pression (hors-jeu, plaquage haut, écroulement).
  const penaltyForAttackProb = 0.050 + Math.min(0.05, phases * 0.013);
  // Grattage : la spécialité des troisièmes lignes, favorisée par une défense dominante.
  const turnoverProb = Math.max(0.02, 0.048 - Math.tanh(delta / 30) * 0.028);
  // En-avant / passe forcée dans un espace saturé.
  const handlingErrorProb = 0.028 + attackErrorDrift * 0.6;
  // Tenu, ballon injouable : mêlée à cinq mètres pour l'attaque (elle garde l'élan).
  const heldUpProb = 0.032;
  // Pénalité *pour* la défense : l'attaquant ne lâche pas le ballon au sol.
  const penaltyForDefenseProb = 0.020 + Math.min(0.035, phases * 0.010);

  const r = rng.next();
  let acc = 0;

  if (r < (acc += tryProb)) {
    const scorer = pickCloseRangeScorer(input.attackPack, input.attackBacks, rng);
    const summary = phases >= 4
      ? `essai au bout de ${phases + 1} temps${scorer ? ` — ${scorer.firstName} ${scorer.lastName}` : ''} !`
      : `essai${scorer ? ` de ${scorer.firstName} ${scorer.lastName}` : ''} !`;
    return {
      possessionAfter: input.attackPossession,
      metersGained: Math.max(2, 50 - input.fieldPosition),
      nextPhase: 'TRY',
      tryScored: input.attackPossession,
      ...(scorer ? { keyPlayerId: scorer.id } : {}),
      summary,
    };
  }

  if (r < (acc += penaltyForAttackProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: input.attackPossession,
      summary: phases >= 3
        ? 'la défense craque sous le pilonnage — pénalité'
        : 'pénalité obtenue à cinq mètres',
    };
  }

  if (r < (acc += turnoverProb)) {
    const stealer = pickTurnoverWinner(input.defensePack, rng);
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      ...(stealer ? { keyPlayerId: stealer.id } : {}),
      summary: stealer
        ? `grattage décisif de ${stealer.firstName} ${stealer.lastName} sur sa ligne !`
        : 'grattage décisif sur la ligne !',
    };
  }

  if (r < (acc += handlingErrorProb)) {
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'SCRUM',
      summary: 'en-avant à cinq mètres — l\'occasion s\'envole',
    };
  }

  if (r < (acc += heldUpProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'SCRUM',
      summary: 'ballon tenu — mêlée à cinq mètres',
    };
  }

  if (r < (acc += penaltyForDefenseProb)) {
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: other,
      summary: 'ballon gardé au sol — pénalité pour la défense',
    };
  }

  // Reliquat : le pilonnage continue. C'est là que se construit la tension.
  const held = phases >= 3;
  return {
    possessionAfter: input.attackPossession,
    metersGained: 0,
    nextPhase: 'GOAL_LINE',
    summary: held
      ? `la défense tient toujours (${phases + 1}e temps)`
      : 'pick and go stoppé sur la ligne',
  };
}

/** Le gratteur : troisième ligne en priorité, pondéré par la stat `grattage`. */
function pickTurnoverWinner(defensePack: readonly Player[], rng: Rng): Player | undefined {
  if (defensePack.length === 0) return undefined;
  const weights = defensePack.map(p => {
    const grattage = p.positionSpecific.grattage ?? p.technical.deblayage * 0.6;
    const positionBonus =
      p.position === 'TROISIEME_LIGNE_AILE_GAUCHE' || p.position === 'TROISIEME_LIGNE_AILE_DROITE' ? 30 :
      p.position === 'NUMERO_8' ? 18 : 4;
    return grattage * 0.7 + positionBonus;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return defensePack[0];
  let r = rng.next() * total;
  for (let i = 0; i < defensePack.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return defensePack[i] ?? defensePack[0];
  }
  return defensePack[defensePack.length - 1] ?? defensePack[0];
}
