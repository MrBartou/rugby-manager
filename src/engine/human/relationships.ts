/**
 * Graphe de relations entre joueurs — V0.4 Phase 2.
 *
 * Référence : 03-modele-joueur.md, section C-bis "Relations entre joueurs (M6)".
 *
 * Modèle :
 *   - Score numérique [-100, +100] par paire de joueurs
 *   - Type optionnel : MENTOR, RIVAL, AMI, NEUTRE, CONFLIT (dérivé du score + contexte)
 *   - Relations symétriques en V0.4 (mêmes 2 joueurs partagent un score)
 *   - 30 joueurs par club = 435 paires possibles ; on stocke toutes les paires non-neutres
 *
 * Génération initiale (au début d'une saison) :
 *   - Couples même poste : -10 à -20 (rivalité naturelle)
 *   - Couples vieux/jeune même poste : +15 (mentor potentiel)
 *   - JIFF entre eux : +5 à +15 (anciens du club)
 *   - Traits compatibles / incompatibles : ±5
 *
 * Évolution :
 *   - Titulaires ensemble dans un match : +1
 *   - Défaite cinglante (>15 pts) : -2 entre titulaires
 *   - Victoire en match clé : +3 entre titulaires
 *
 * Mood (source 4 RELATIONS) :
 *   - 2+ relations à ≤ -50 → -10 mood ("conflits vestiaire")
 *   - 2+ relations à ≥ +50 → +5 mood ("vestiaire soudé")
 *
 * Référence Frostpunk M11 : les rancœurs persistent (les relations ne reviennent pas
 * naturellement à 0 sans événements positifs).
 */

import type { Player, PlayerId } from '../types.js';
import { getTraitDef } from './traits.js';

// =============================================================================
// Types
// =============================================================================

export type RelationType = 'MENTOR' | 'RIVAL' | 'AMI' | 'NEUTRE' | 'CONFLIT';

export interface Relation {
  readonly fromId: PlayerId;
  readonly toId: PlayerId;
  readonly score: number;           // -100..+100
  readonly type: RelationType;
  readonly lastReason?: string;
}

export interface RelationsState {
  /** Map keyée par "minId|maxId" pour symétrie. */
  readonly byPair: ReadonlyMap<string, Relation>;
}

// =============================================================================
// Helpers
// =============================================================================

function pairKey(a: PlayerId, b: PlayerId): string {
  const sa = a as string;
  const sb = b as string;
  return sa < sb ? `${sa}|${sb}` : `${sb}|${sa}`;
}

function clamp(x: number, lo = -100, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function ageFromBirthDate(birthDate: string, currentYear: number): number {
  return currentYear - parseInt(birthDate.slice(0, 4), 10);
}

function deriveType(score: number): RelationType {
  if (score >= 50) return 'AMI';
  if (score >= 20) return 'NEUTRE';
  if (score >= -20) return 'NEUTRE';
  if (score >= -50) return 'RIVAL';
  return 'CONFLIT';
}

// =============================================================================
// Génération initiale
// =============================================================================

function pairBaseScore(a: Player, b: Player, currentYear: number, rng: () => number): number {
  let score = 0;

  // Même poste = rivalité (sauf transmission inter-générationnelle)
  if (a.position === b.position) {
    const ageA = ageFromBirthDate(a.birthDate, currentYear);
    const ageB = ageFromBirthDate(b.birthDate, currentYear);
    const ageGap = Math.abs(ageA - ageB);

    if (ageGap >= 8) {
      // Vieux/jeune même poste = mentor potentiel
      score += 15 + (rng() * 10 - 5);
    } else {
      // Concurrents directs
      score -= 12 + (rng() * 8);
    }
  }

  // JIFF + même club d'origine = anciens
  if (a.isJiff && b.isJiff) {
    score += 5 + rng() * 8;
  }

  // Traits combinés
  const aTraits = a.traits as readonly string[];
  const bTraits = b.traits as readonly string[];

  // "Mentor" boost les relations avec les jeunes
  const ageA = ageFromBirthDate(a.birthDate, currentYear);
  const ageB = ageFromBirthDate(b.birthDate, currentYear);
  if (aTraits.includes('mentor') && ageB <= 24) score += 10;
  if (bTraits.includes('mentor') && ageA <= 24) score += 10;

  // "Charismatique" attire le vestiaire
  if (aTraits.includes('charismatique')) score += 5;
  if (bTraits.includes('charismatique')) score += 5;

  // "Solitaire" tient à distance
  if (aTraits.includes('solitaire')) score -= 8;
  if (bTraits.includes('solitaire')) score -= 8;

  // "Loyal" + "Loyal" : entente naturelle
  if (aTraits.includes('loyal') && bTraits.includes('loyal')) score += 6;

  // "Rancunier" vs "Hothead" : risque de conflit
  if ((aTraits.includes('rancunier') && bTraits.includes('hothead'))
      || (aTraits.includes('hothead') && bTraits.includes('rancunier'))) {
    score -= 12;
  }

  // "Protège les jeunes" + jeune
  if (aTraits.includes('protecteur_jeunes') && ageB <= 22) score += 8;
  if (bTraits.includes('protecteur_jeunes') && ageA <= 22) score += 8;

  // Bruit déterministe
  score += (rng() * 10 - 5);

  // Cumul des modifiers de traits (relationshipBuilder)
  let modBuild = 0;
  for (const t of [...aTraits, ...bTraits]) {
    const def = getTraitDef(t);
    if (def?.modifiers?.relationshipBuilder) modBuild += def.modifiers.relationshipBuilder;
  }
  score += modBuild * 0.3;

  return clamp(score);
}

/** Génère le graphe initial de relations pour un effectif. */
export function generateInitialRelations(
  players: readonly Player[],
  currentYear: number,
  seed: string,
): RelationsState {
  const byPair = new Map<string, Relation>();

  // RNG déterministe par paire (basé sur seed + ids)
  function rngFor(a: PlayerId, b: PlayerId): () => number {
    const key = `${seed}|${pairKey(a, b)}`;
    let state = 0;
    for (let i = 0; i < key.length; i++) state = (state * 31 + key.charCodeAt(i)) | 0;
    state = state >>> 0 || 1;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      const rng = rngFor(a.id, b.id);
      const score = pairBaseScore(a, b, currentYear, rng);

      // On ne stocke que les relations notables (|score| >= 5) pour économiser
      if (Math.abs(score) >= 5) {
        const key = pairKey(a.id, b.id);
        byPair.set(key, {
          fromId: a.id,
          toId: b.id,
          score,
          type: deriveType(score),
        });
      }
    }
  }

  return { byPair };
}

// =============================================================================
// API
// =============================================================================

export function getRelation(state: RelationsState, a: PlayerId, b: PlayerId): Relation {
  const key = pairKey(a, b);
  const r = state.byPair.get(key);
  if (r) return r;
  // Relation neutre par défaut
  const sa = a as string;
  const sb = b as string;
  return {
    fromId: (sa < sb ? a : b),
    toId: (sa < sb ? b : a),
    score: 0,
    type: 'NEUTRE',
  };
}

export function updateRelationScore(
  state: RelationsState,
  a: PlayerId,
  b: PlayerId,
  delta: number,
  reason?: string,
): RelationsState {
  const key = pairKey(a, b);
  const current = state.byPair.get(key);
  const newScore = clamp((current?.score ?? 0) + delta);
  const next = new Map(state.byPair);

  // Si exactement 0 et pas de raison, on retire (rare)
  if (newScore === 0 && !reason) {
    next.delete(key);
    return { byPair: next };
  }

  const sa = a as string;
  const sb = b as string;
  next.set(key, {
    fromId: (sa < sb ? a : b),
    toId: (sa < sb ? b : a),
    score: newScore,
    type: deriveType(newScore),
    ...(reason ? { lastReason: reason } : {}),
  });
  return { byPair: next };
}

/** Top N relations d'un joueur (par |score| décroissant). */
export function topRelationsForPlayer(
  state: RelationsState,
  playerId: PlayerId,
  limit = 5,
): readonly Relation[] {
  const out: Relation[] = [];
  for (const r of state.byPair.values()) {
    if (r.fromId === playerId || r.toId === playerId) {
      out.push(r);
    }
  }
  out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return out.slice(0, limit);
}

// =============================================================================
// Évolution lors d'un match
// =============================================================================

export interface MatchRelationContext {
  /** IDs des titulaires du club joueur. */
  readonly starterIds: readonly PlayerId[];
  /** Score : positif = victoire du club, négatif = défaite. */
  readonly resultDelta: number;
}

/** Évolue le graphe après un match joué par le club. */
export function applyMatchToRelations(
  state: RelationsState,
  ctx: MatchRelationContext,
): RelationsState {
  let next = state;
  const starters = ctx.starterIds;

  for (let i = 0; i < starters.length; i++) {
    for (let j = i + 1; j < starters.length; j++) {
      const a = starters[i]!;
      const b = starters[j]!;
      let delta = 1;     // base : avoir joué ensemble
      if (ctx.resultDelta > 14) delta = 3;       // grosse victoire
      else if (ctx.resultDelta > 0) delta = 2;   // victoire serrée
      else if (ctx.resultDelta < -14) delta = -2; // défaite cinglante
      next = updateRelationScore(next, a, b, delta);
    }
  }
  return next;
}

// =============================================================================
// Intégration mood
// =============================================================================

export interface RelationsMoodFactors {
  /** Nombre de relations notablement négatives (≤ -50). */
  readonly conflictCount: number;
  /** Nombre de relations notablement positives (≥ +50). */
  readonly positiveCount: number;
}

export function computeRelationsForMood(
  state: RelationsState,
  playerId: PlayerId,
): RelationsMoodFactors {
  let conflict = 0;
  let positive = 0;
  for (const r of state.byPair.values()) {
    if (r.fromId !== playerId && r.toId !== playerId) continue;
    if (r.score <= -50) conflict++;
    else if (r.score >= 50) positive++;
  }
  return { conflictCount: conflict, positiveCount: positive };
}
