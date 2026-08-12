/**
 * Conversion WeekPlan (UI) → HomeWeeklyModifiers (moteur).
 *
 * V0.3 : règles linéaires simples. V0.4+ raffinera (fatigue par joueur, soins blessés).
 */

import type { HomeWeeklyModifiers, LineoutPhilosophy } from './types.js';

export type TrainingLoad = 'LIGHT' | 'MEDIUM' | 'HARD';
export type TacticalFocus = 'PACK' | 'BACKS' | 'MIXED';

export interface WeekPlan {
  readonly load: TrainingLoad;
  readonly focus: TacticalFocus;
  /** V0.8 — philosophie de touche pour ce match. */
  readonly lineoutPhilosophy?: LineoutPhilosophy;
}

export function applyWeekPlan(plan: WeekPlan): HomeWeeklyModifiers {
  // Charge → fatigue de départ + petit bonus tactique pour HARD
  const initialFatigueDelta =
    plan.load === 'LIGHT' ? -3 :       // mieux récupéré
    plan.load === 'HARD' ? +6 :         // cadres essorés
    0;
  const loadTacticalBonus =
    plan.load === 'HARD' ? +1.5 :       // travail intensif → discipline tactique
    plan.load === 'LIGHT' ? -0.5 :
    0;

  // Focus → où va le bonus tactique
  let tacticalBonus = loadTacticalBonus;
  let packBonus: number | undefined;
  let backsBonus: number | undefined;
  if (plan.focus === 'PACK') {
    tacticalBonus += 1;
    packBonus = 2.5;
  } else if (plan.focus === 'BACKS') {
    tacticalBonus += 1;
    backsBonus = 2.5;
  } else {
    tacticalBonus += 1.5;
  }

  return {
    tacticalBonus: Math.max(-10, Math.min(10, tacticalBonus)),
    initialFatigueDelta,
    ...(packBonus !== undefined ? { packBonus } : {}),
    ...(backsBonus !== undefined ? { backsBonus } : {}),
    ...(plan.lineoutPhilosophy ? { lineoutPhilosophy: plan.lineoutPhilosophy } : {}),
  };
}
