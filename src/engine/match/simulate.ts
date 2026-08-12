/**
 * Point d'entrée du moteur de match — fonction PURE (mode batch).
 *
 * Signature contractuelle :
 *   simulateMatch(input, seed) → MatchResult
 *
 * - Aucun side-effect, aucune dépendance vers data/, ui/, store/, intents/, sqlite, tauri
 * - Déterministe (même entrée + même seed = même résultat)
 *
 * Voir 09-architecture-logicielle.md, section A.1.
 *
 * Implémentation : crée une `MatchSession` et l'avance en consommant chaque
 * live moment avec son option par défaut. Pour le mode interactif (UI),
 * utiliser directement `createMatchSession`.
 */

import { createMatchSession } from './session.js';
import type { MatchInput, MatchResult } from './types.js';

export function simulateMatch(input: MatchInput, seed: string): MatchResult {
  const session = createMatchSession(input, seed);
  let safety = 0;
  while (safety++ < 1000) {
    const state = session.getState();
    if (state.status === 'finished') break;
    if (state.status === 'awaiting-decision' && state.pendingMoment) {
      session.applyDecision(state.pendingMoment.defaultOptionId);
    } else {
      session.advance();
    }
  }
  return session.getResult();
}
