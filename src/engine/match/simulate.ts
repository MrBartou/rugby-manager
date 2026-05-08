/**
 * Point d'entrée du moteur de match — fonction PURE.
 *
 * Signature contractuelle :
 *   simulateMatch(state, decisions, seed) → MatchResult
 *
 * - Aucun side-effect
 * - Aucune dépendance vers data/, ui/, store/, intents/, sqlite, tauri
 * - Déterministe (même entrée + même seed = même résultat)
 *
 * Voir 09-architecture-logicielle.md, section A.1.
 *
 * STATUT : V0.1 squelette. La boucle complète phase-par-phase sera implémentée
 * au fur et à mesure que les modules de phases (scrum, lineout, ruck, openplay,
 * kicking) sont calibrés en Excel et portés.
 */

import { createRng } from '../rng.js';
import type { MatchInput, MatchResult, PhaseRecord } from './types.js';

/**
 * Simule un match complet.
 *
 * @param input — feuilles de match + tactiques + conditions
 * @param seed — chaîne sérialisée du Rng (cf. rng.ts)
 * @returns le résultat complet du match (score + phases + stats individuelles + narration)
 */
export function simulateMatch(input: MatchInput, seed: string): MatchResult {
  const rng = createRng(seed);

  // V0.1 placeholder — boucle vide qui produit un score plausible aléatoire
  // (le but à ce stade est de valider le pipeline, pas le réalisme).
  const homeScore = rng.nextInt(10, 35);
  const awayScore = rng.nextInt(10, 35);

  const phases: readonly PhaseRecord[] = [];

  return {
    matchId: input.matchId,
    homeScore,
    awayScore,
    phases,
    individualStats: new Map(),
    narrativeSummary: `Match terminé ${homeScore}-${awayScore} (V0.1 placeholder).`,
  };

  // TODO V0.1+ :
  // 1. Initialiser MatchStateSnapshot (minute 0, kickoff)
  // 2. Boucle while minute < 80 :
  //    - Choisir le type de phase (scrum / lineout / ruck / openplay / kick)
  //    - Appeler le module simulate{Phase}(input, rng)
  //    - Mettre à jour MatchStateSnapshot
  //    - Pousser un PhaseRecord
  // 3. Calculer les stats individuelles à partir des phases
  // 4. Générer le narrativeSummary (top performances, faits marquants)
}
