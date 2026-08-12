/**
 * Mise à jour de l'état dynamique des joueurs après un match — V0.7 phase 2.
 *
 * Modèle simple :
 *  - Titulaire qui joue le match  → fatigue +25, forme tend vers 80 si V / 65 si N / 50 si D
 *  - Remplaçant entré              → fatigue +12, forme tend vers la moitié des deltas titulaires
 *  - Hors feuille de match         → fatigue −15 (récupération), forme stable
 *
 * Les bornes sont [0, 100]. Forme est une moyenne pondérée (rolling, 4/5 ancien + 1/5 nouveau).
 */

import type { Player, PlayerId } from '../types.js';

const FATIGUE_STARTER = 25;
const FATIGUE_SUB = 12;
const FATIGUE_REST = 15;

function targetFormeFromResult(result: 'WIN' | 'DRAW' | 'LOSS'): number {
  if (result === 'WIN') return 80;
  if (result === 'DRAW') return 65;
  return 50;
}

function blendForme(current: number, target: number, weight: number): number {
  return Math.round(current * (1 - weight) + target * weight);
}

function clamp01_100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export interface ApplyMatchToPlayersInput {
  readonly players: readonly Player[];
  readonly starterIds: readonly PlayerId[];
  readonly subIds: readonly PlayerId[];
  readonly result: 'WIN' | 'DRAW' | 'LOSS';
}

export function applyMatchToPlayerStates(input: ApplyMatchToPlayersInput): readonly Player[] {
  const starterSet = new Set<PlayerId>(input.starterIds);
  const subSet = new Set<PlayerId>(input.subIds);
  const target = targetFormeFromResult(input.result);

  return input.players.map<Player>(p => {
    if (p.retired || p.freeAgent) return p;
    if (p.dynamic.injury) return p;        // ne touche pas un blessé

    const isStarter = starterSet.has(p.id);
    const isSub = !isStarter && subSet.has(p.id);

    let fatigueDelta: number;
    let formeWeight: number;
    if (isStarter) {
      fatigueDelta = FATIGUE_STARTER;
      formeWeight = 0.25;
    } else if (isSub) {
      fatigueDelta = FATIGUE_SUB;
      formeWeight = 0.15;
    } else {
      fatigueDelta = -FATIGUE_REST;
      formeWeight = 0;       // forme stable hors compo
    }

    const fatigue = clamp01_100(p.dynamic.fatigue + fatigueDelta);
    const forme = formeWeight > 0
      ? clamp01_100(blendForme(p.dynamic.forme, target, formeWeight))
      : p.dynamic.forme;

    return { ...p, dynamic: { ...p.dynamic, fatigue, forme } };
  });
}
