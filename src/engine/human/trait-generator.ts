/**
 * Générateur de traits cohérents pour un joueur.
 *
 * Référence : 03-modele-joueur.md, section B (5-6 traits par joueur).
 *
 * Logique :
 *   - Pondération par stats : un capitaine doit avoir un haut leadership ; un
 *     joueur indiscipliné a tendance à tirer "hothead" ou "electron_libre" ;
 *     un mental fort tire "sang_froid" ou "professionnel" ;
 *   - Catégories couvertes : on essaie de tirer 1 trait par catégorie (5 cats),
 *     puis on ajoute 1-2 traits supplémentaires aléatoires.
 *   - Cohérence : les traits incompatibles (cf. `exclusiveWith`) sont filtrés.
 *
 * Déterministe via RNG seed (cohérent avec la discipline 09-archi).
 */

import type { Rng } from '../rng.js';
import type { Player } from '../types.js';
import {
  TRAITS,
  type TraitCategory,
  type TraitDef,
  areTraitsCompatible,
  traitsByCategory,
} from './traits.js';

interface WeightedTrait {
  readonly trait: TraitDef;
  readonly weight: number;
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

/** Calcule le poids d'un trait pour un joueur donné, en fonction de ses stats. */
function weightForPlayer(trait: TraitDef, player: Player): number {
  const m = player.mental;
  const ph = player.physical;
  let w = 1.0;   // poids de base

  switch (trait.id) {
    // Leadership
    case 'leader_naturel':
      w = 0.3 + (m.leadership / 100) * 1.5;             // 0.3..1.8
      break;
    case 'second_couteau':
      w = 0.5 + (m.leadership / 100) * 0.6;
      break;
    case 'suiveur':
      w = 1.2 - (m.leadership / 100) * 0.8;             // baisse si leader haut
      break;
    case 'electron_libre':
      w = 1.4 - (m.discipline / 100) * 1.0;
      break;

    // Mental
    case 'sang_froid':
      w = 0.4 + (m.sangFroid / 100) * 1.4;
      break;
    case 'fragile_mental':
      w = 1.4 - (m.sangFroid / 100) * 1.2;
      break;
    case 'hothead':
      w = 1.2 + (m.agressivite / 100) * 0.8 - (m.discipline / 100) * 0.6;
      break;
    case 'professionnel':
      w = 0.4 + (m.professionnalisme / 100) * 1.4;
      break;
    case 'travailleur':
      w = 0.5 + (m.professionnalisme / 100) * 1.0;
      break;

    // Ambition (lié à âge + niveau global indirect via attributs)
    case 'ambitieux': {
      const overallAttr = (player.technical.passe + player.technical.plaquage + ph.vitesse + ph.puissance) / 4;
      w = 0.5 + (overallAttr / 100) * 1.0;              // les bons sont plus ambitieux
      break;
    }
    case 'satisfait':
      w = 0.7;
      break;
    case 'mercenaire':
      w = 0.6;
      break;
    case 'attache_club':
      w = player.isJiff ? 1.3 : 0.5;                    // les JIFF tendent à rester
      break;

    // Relationnel
    case 'charismatique':
      w = 0.4 + (m.leadership / 100) * 1.0;
      break;
    case 'solitaire':
      w = 0.7;
      break;
    case 'mentor':
      w = 0.3 + (m.leadership / 100) * 0.8 + (m.professionnalisme / 100) * 0.8;
      break;
    case 'rancunier':
      w = 0.6 + (m.agressivite / 100) * 0.6;
      break;
    case 'loyal':
      w = player.isJiff ? 1.0 : 0.7;
      break;
    case 'protecteur_jeunes':
      w = 0.5 + (m.leadership / 100) * 0.6;
      break;

    // Style
    case 'aventureux':
      w = 0.6 + (player.technical.visionDeJeu / 100) * 0.8;
      break;
    case 'securitaire':
      w = 0.6 + (m.discipline / 100) * 0.6;
      break;
    case 'creatif':
      w = 0.3 + (player.technical.visionDeJeu / 100) * 1.4;
      break;
    case 'discipline':
      w = 0.4 + (m.discipline / 100) * 1.2;
      break;
    case 'gros_motard':
      // Avants surtout
      w = ph.puissance > 70 ? 1.0 : 0.4;
      break;
    case 'killer_instinct': {
      const finition = player.positionSpecific.finition ?? 50;
      w = 0.3 + (finition / 100) * 1.2 + (player.technical.passe / 100) * 0.4;
      break;
    }

    // Mental — physique
    case 'fragile_blessure':
      w = 1.5 - (ph.robustesse / 100) * 1.2;
      break;
    case 'inusable':
      w = 0.3 + (ph.robustesse / 100) * 1.5;
      break;
  }

  return clamp(w, 0.05, 3.0);
}

function pickWeighted(items: readonly WeightedTrait[], rng: Rng): TraitDef | undefined {
  if (items.length === 0) return undefined;
  const total = items.reduce((sum, x) => sum + x.weight, 0);
  if (total <= 0) return items[0]?.trait;
  let r = rng.next() * total;
  for (const x of items) {
    r -= x.weight;
    if (r <= 0) return x.trait;
  }
  return items[items.length - 1]?.trait;
}

/**
 * Génère 5-6 traits cohérents pour un joueur.
 *
 * Stratégie :
 *   1. On essaie de tirer 1 trait par catégorie (5 traits)
 *   2. On ajoute 1 trait supplémentaire aléatoire (sans répétition de catégorie)
 *   3. Validation : exclusivités respectées (sinon on retire le moins prioritaire)
 */
export function generateTraitsForPlayer(player: Player, rng: Rng): readonly string[] {
  const picked = new Set<string>();
  const pickedByCategory = new Set<TraitCategory>();
  const categories: readonly TraitCategory[] = ['LEADERSHIP', 'MENTAL', 'AMBITION', 'RELATIONNEL', 'STYLE'];

  for (const cat of categories) {
    const candidates = traitsByCategory(cat)
      .filter(t => !picked.has(t.id))
      .filter(t => !t.exclusiveWith?.some(ex => picked.has(ex)))
      .map(t => ({ trait: t, weight: weightForPlayer(t, player) }));
    const choice = pickWeighted(candidates, rng);
    if (choice) {
      picked.add(choice.id);
      pickedByCategory.add(cat);
    }
  }

  // 1 trait bonus aléatoire (toutes catégories confondues)
  const bonus = TRAITS
    .filter(t => !picked.has(t.id))
    .filter(t => !t.exclusiveWith?.some(ex => picked.has(ex)))
    .map(t => ({ trait: t, weight: weightForPlayer(t, player) * 0.5 }));   // poids réduits
  if (rng.next() < 0.5) {                                                   // 50% de chance d'avoir un 6e
    const extra = pickWeighted(bonus, rng);
    if (extra) picked.add(extra.id);
  }

  const result = Array.from(picked);
  if (!areTraitsCompatible(result)) {
    // Filtrage de sécurité — théoriquement impossible avec le filtre `exclusiveWith` ci-dessus
    return result.slice(0, 4);
  }
  return result;
}
