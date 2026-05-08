/**
 * Reducer du game state — fonction PURE.
 *
 * applyEvent(state, event) → state'
 *
 * Tous les changements d'état du jeu passent par cette fonction.
 * Voir 09-architecture-logicielle.md, section A.3.
 *
 * STATUT : V0.1 squelette. Les handlers seront ajoutés au fur et à mesure
 * que les events sont consommés par le reste du système.
 */

import type { GameState } from './types.js';
import type { GameEvent } from './events.js';

/**
 * Applique un événement à l'état du jeu et renvoie le nouvel état.
 * L'état d'entrée n'est PAS muté.
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'SeasonStarted':
      // À implémenter : initialisation du SeasonState dans l'état.
      return state;

    case 'MatchScheduled':
      // À implémenter : ajout du match au calendrier.
      return state;

    case 'MatchStarted':
    case 'MatchPhasePlayed':
    case 'MatchEnded':
      // À implémenter : mise à jour des stats / classement / mood post-match.
      return state;

    case 'TraitRevealed':
    case 'TraitChanged':
      // À implémenter : édition des traits du joueur ciblé.
      return state;

    case 'MoodChanged':
      // À implémenter : édition du mood du joueur ciblé.
      return state;

    case 'RelationshipChanged':
      // À implémenter : édition de la relation orientée.
      return state;

    case 'PlayerInjured':
    case 'PlayerRecovered':
      // À implémenter : édition du PlayerDynamicState.injury.
      return state;

    case 'PlayerPositionChanged':
      // À implémenter : édition du Player.position.
      return state;

    case 'ManagerDecisionTaken':
    case 'StaffAdvised':
      // À implémenter : log + dérivation d'autres events si pertinent.
      return state;

    default: {
      // Si on ajoute un nouveau type d'event sans le gérer ici, la compile échoue.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

/**
 * Applique une séquence d'événements à un état initial.
 * Utile pour : (1) reconstruire un état depuis une save, (2) tests.
 */
export function applyEvents(state: GameState, events: readonly GameEvent[]): GameState {
  let s = state;
  for (const e of events) {
    s = applyEvent(s, e);
  }
  return s;
}
