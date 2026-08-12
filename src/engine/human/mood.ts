/**
 * Calcul du mood — V0.4 (sources sans relations).
 *
 * Référence : 03-modele-joueur.md, section C "Mood (M8 — RimWorld)".
 *
 * Sources V0.4 phase 1 (6 sur 8) :
 *   1. FORME_PHYSIQUE         — état actuel (top forme / méforme)
 *   2. RESULTATS_RECENTS      — 3-5 derniers matchs collectifs et individuels
 *   3. STATUT_EQUIPE          — titulaire indiscutable / rotation / réserve
 *   4. RELATIONS              — V0.4 phase 2
 *   5. CONTRAT                — proche fin / récemment signé / sous-payé
 *   6. FATIGUE                — charge hebdomadaire + matchs joués
 *   7. RECONNAISSANCE         — titre week-end, sélection nationale, critique
 *   8. VIE_PRIVEE             — V0.5+
 *
 * Mood = base 50 ± Σ modifiers, clampé [0, 100].
 *
 * Les traits influent : `statusSensitivity` amplifie la source 3, `resilienceUnderPressure`
 * atténue la source 2 quand négative.
 */

import type { Player } from '../types.js';
import type { MoodModifier, StatValue } from '../types.js';
import { getTraitDef } from './traits.js';
import type { RelationsMoodFactors } from './relationships.js';
import { judgeStatus, type SquadStatus } from '../club/squad-status.js';

export interface MoodInputs {
  readonly player: Player;
  /** Résultats récents (3-5) du club, du POV du joueur. -1 = défaite, 0 = nul, +1 = victoire. */
  readonly recentResults: readonly (-1 | 0 | 1)[];
  /** Performance récente du joueur (note synthétique 0-100, calculée par caller). */
  readonly recentPerformance?: number;
  /** Statut dans l'équipe : matchs joués cette saison / matchs joués par le club. */
  readonly playRatio: number;                    // 0..1
  /** Année actuelle (pour calculer si contrat proche fin). */
  readonly currentSeason: number;
  /** Reconnaissance : nombre d'apparitions médiatiques (homme du match, sélection). */
  readonly recognitionCount?: number;
  /** Facteurs de relations vestiaire (V0.4 phase 2). */
  readonly relationsFactors?: RelationsMoodFactors;
  /**
   * V0.50 — porte-t-il le brassard ?
   *
   * Le capitanat était un champ de feuille de match que personne ne lisait. Il
   * compte d'abord pour celui à qui on le confie : c'est une reconnaissance, et
   * la reconnaissance est déjà une source de moral.
   */
  readonly isCaptain?: boolean;
  /**
   * V0.50 — rôle annoncé par le manager.
   *
   * Absent, le statut reste **déduit** du temps de jeu, comme depuis la V0.4 :
   * une sauvegarde antérieure n'a rien déclaré, et son effectif ne doit pas
   * changer d'humeur au chargement.
   */
  readonly squadStatus?: SquadStatus;
  /**
   * V0.54 — journée courante, pour écarter les événements périmés.
   *
   * Absente, on retient tous les modificateurs mémorisés : c'est le
   * comportement voulu hors saison, où il n'y a pas de journée.
   */
  readonly currentRound?: number;
}

const BASE_MOOD = 50;

export interface MoodResult {
  readonly mood: StatValue;
  readonly modifiers: readonly MoodModifier[];
}

function computeFormeModifier(forme: number): MoodModifier {
  // forme > 75 : +5 ; forme < 30 : -10 ; sinon proportionnel
  let delta: number;
  let reason: string;
  if (forme >= 75) { delta = 5; reason = 'En grande forme'; }
  else if (forme <= 30) { delta = -10; reason = 'Méforme persistante'; }
  else if (forme <= 50) { delta = -3; reason = 'Forme moyenne'; }
  else { delta = 2; reason = 'Bonne forme'; }
  return { source: 'FORME_PHYSIQUE', delta, reason };
}

function computeResultsModifier(results: readonly (-1 | 0 | 1)[], traitIds: readonly string[]): MoodModifier {
  if (results.length === 0) {
    return { source: 'RESULTATS_RECENTS', delta: 0, reason: 'Pas encore de matchs' };
  }
  const wins = results.filter(r => r === 1).length;
  const losses = results.filter(r => r === -1).length;
  const balance = wins - losses;
  let delta = balance * 2;       // +2 par victoire, -2 par défaite
  // Trait fragile_mental amplifie les défaites
  if (traitIds.includes('fragile_mental') && balance < 0) {
    delta = balance * 3;
  }
  // Trait sang_froid / professionnel atténue les revers
  if ((traitIds.includes('sang_froid') || traitIds.includes('professionnel')) && balance < 0) {
    delta = Math.round(balance * 1.2);
  }
  let reason: string;
  if (balance >= 3) reason = 'Série victorieuse';
  else if (balance >= 1) reason = 'Bons résultats récents';
  else if (balance === 0) reason = 'Résultats mitigés';
  else if (balance >= -2) reason = 'Mauvais résultats';
  else reason = 'Crise sportive';
  return { source: 'RESULTATS_RECENTS', delta, reason };
}

function computeStatusModifier(
  playRatio: number,
  traitIds: readonly string[],
  squadStatus: SquadStatus | undefined,
): MoodModifier {
  // V0.50 — quand le manager a annoncé un rôle, c'est **l'écart** entre ce qui
  // a été dit et ce qui est vécu qui décide, plus le temps de jeu brut. Un
  // espoir à 15 % est en paix ; le même, annoncé cadre, est amer avec
  // exactement les mêmes minutes.
  if (squadStatus !== undefined) {
    const judged = judgeStatus(squadStatus, playRatio, traitIds);
    return { source: 'STATUT_EQUIPE', delta: judged.moodDelta, reason: judged.reason };
  }

  // Calcul de base : titulaire indiscutable (0.85+) → +6, titulaire (0.6-0.85) → +2,
  // rotation (0.3-0.6) → 0, banc (<0.3) → -10
  let base: number;
  let reason: string;
  if (playRatio >= 0.85) { base = 6; reason = 'Titulaire indiscutable'; }
  else if (playRatio >= 0.6) { base = 2; reason = 'Titulaire régulier'; }
  else if (playRatio >= 0.3) { base = -2; reason = 'Joueur de rotation'; }
  else if (playRatio > 0) { base = -10; reason = 'Peu utilisé'; }
  else { base = -15; reason = 'Pas joué une seconde'; }

  // Trait statusSensitivity amplifie l'effet
  let sensitivity = 0;
  for (const id of traitIds) {
    const def = getTraitDef(id);
    if (def?.modifiers?.statusSensitivity) {
      sensitivity += def.modifiers.statusSensitivity;
    }
  }
  const multiplier = 1 + sensitivity / 10;                  // -10 → ×0, +10 → ×2
  const delta = Math.round(base * Math.max(0.2, Math.min(2, multiplier)));
  return { source: 'STATUT_EQUIPE', delta, reason };
}

function computeContractModifier(player: Player, currentSeason: number): MoodModifier {
  const yearsLeft = player.contract.endSeason - currentSeason;
  let delta = 0;
  let reason = 'Contrat stable';
  if (yearsLeft <= 0) { delta = -8; reason = 'Fin de contrat sans prolongation'; }
  else if (yearsLeft === 1) { delta = -3; reason = 'Dernière année de contrat'; }
  return { source: 'CONTRAT', delta, reason };
}

function computeFatigueModifier(fatigue: number): MoodModifier {
  let delta: number;
  let reason: string;
  if (fatigue >= 80) { delta = -8; reason = 'Cuit physiquement'; }
  else if (fatigue >= 60) { delta = -3; reason = 'Fatigué'; }
  else if (fatigue <= 20) { delta = 2; reason = 'Frais et reposé'; }
  else { delta = 0; reason = 'Charge gérée'; }
  return { source: 'FATIGUE', delta, reason };
}

/**
 * Reconnaissance — performances remarquées, et depuis la V0.50 le brassard.
 *
 * Le capitanat entre **dans** cette source plutôt qu'à côté : le moral tient à
 * sept sources depuis la V0.4, c'est un invariant que le reste du code et la
 * documentation tiennent pour acquis, et être nommé capitaine relève très
 * exactement de la reconnaissance.
 */
function computeRecognitionModifier(
  count: number | undefined,
  isCaptain: boolean | undefined,
): MoodModifier {
  const n = count ?? 0;
  const captaincy = isCaptain === true ? 5 : 0;
  const performances = Math.min(8, n * 2);
  const delta = Math.min(11, performances + captaincy);

  if (delta === 0) return { source: 'RECONNAISSANCE', delta: 0, reason: 'Sous les radars' };

  const parts: string[] = [];
  if (captaincy > 0) parts.push('Capitaine');
  if (n > 0) parts.push(`${n} performance${n > 1 ? 's' : ''} marquante${n > 1 ? 's' : ''}`);
  return { source: 'RECONNAISSANCE', delta, reason: parts.join(' · ') };
}

function computeRelationsModifier(factors: RelationsMoodFactors | undefined): MoodModifier {
  if (!factors) return { source: 'RELATIONS', delta: 0, reason: 'Vestiaire neutre' };
  const { conflictCount, positiveCount } = factors;

  let delta = 0;
  let reason = 'Vestiaire neutre';

  if (conflictCount >= 3) { delta = -15; reason = 'Conflits ouverts au vestiaire'; }
  else if (conflictCount >= 2) { delta = -10; reason = 'Tensions avec plusieurs coéquipiers'; }
  else if (conflictCount === 1) { delta = -3; reason = 'Une rivalité tendue'; }

  if (positiveCount >= 3) { delta += 8; reason = 'Vestiaire soudé autour de lui'; }
  else if (positiveCount >= 2) { delta += 4; reason = reason === 'Vestiaire neutre' ? 'Bonnes relations vestiaire' : reason; }

  return { source: 'RELATIONS', delta, reason };
}

// =============================================================================
// Les événements — V0.54
// =============================================================================

/**
 * Ce que la vie du club a fait au moral d'un joueur.
 *
 * ## Pourquoi ce détour, et pas un simple nombre
 *
 * Le jeu portait **deux morals qui ne communiquaient pas** : celui que l'écran
 * calculait à la volée à partir des sept sources, et celui que les événements
 * déplaçaient dans `dynamic.mood` — le seul que le moteur de match lisait
 * depuis la V0.51. Une promesse trahie changeait le second sans jamais toucher
 * au premier ; le manager ne voyait donc rien de ce qu'il venait de provoquer.
 *
 * `moodModifiers` existait sur chaque joueur depuis la V0.4, avec `source`,
 * `delta`, `reason` et même `expiresAt` — et n'a **jamais été rempli ni lu**.
 * C'était l'architecture prévue ; elle n'était pas branchée.
 *
 * Un événement pousse désormais un modificateur daté au lieu de muter un
 * nombre. Le moral vaut alors : sept sources + événements encore actifs, et
 * c'est ce total qu'on affiche **et** que le moteur lit.
 */
export interface MoodEvent {
  readonly source: MoodModifier['source'];
  readonly delta: number;
  readonly reason: string;
  /** Journée à partir de laquelle il ne compte plus. Absent = permanent. */
  readonly expiresAt?: number;
}

/**
 * Ajoute un événement à la mémoire d'un joueur.
 *
 * Deux événements de même raison ne s'empilent pas : promettre puis retrahir
 * doit remplacer, pas cumuler — sans quoi une même faute punirait deux fois.
 */
export function pushMoodEvent(
  current: readonly MoodModifier[],
  event: MoodEvent,
): readonly MoodModifier[] {
  const modifier: MoodModifier = {
    source: event.source,
    delta: event.delta,
    reason: event.reason,
    ...(event.expiresAt !== undefined ? { expiresAt: event.expiresAt } : {}),
  };
  return [...current.filter(m => m.reason !== event.reason), modifier];
}

/** Oublie ce qui a expiré. Un vestiaire ne rumine pas éternellement. */
export function pruneMoodEvents(
  current: readonly MoodModifier[],
  currentRound: number,
): readonly MoodModifier[] {
  return current.filter(m => m.expiresAt === undefined || m.expiresAt > currentRound);
}

/**
 * Durées usuelles, en journées.
 *
 * Rien n'est permanent par défaut : une décision doit peser sur les semaines
 * qui suivent, pas sur toute une carrière. Seuls les faits vraiment marquants
 * s'inscrivent sans échéance, et ils passent alors `expiresAt: undefined`.
 */
export const MOOD_SHORT = 4;
export const MOOD_MEDIUM = 8;
export const MOOD_LONG = 15;

// =============================================================================
// Entrée publique
// =============================================================================

export function computeMood(inputs: MoodInputs): MoodResult {
  const traitIds = inputs.player.traits as readonly string[];
  const modifiers: MoodModifier[] = [
    computeFormeModifier(inputs.player.dynamic.forme),
    computeResultsModifier(inputs.recentResults, traitIds),
    computeStatusModifier(inputs.playRatio, traitIds, inputs.squadStatus),
    computeRelationsModifier(inputs.relationsFactors),
    computeContractModifier(inputs.player, inputs.currentSeason),
    computeFatigueModifier(inputs.player.dynamic.fatigue),
    computeRecognitionModifier(inputs.recognitionCount, inputs.isCaptain),
  ];

  // V0.54 — les événements encore actifs s'ajoutent aux sept sources. C'est
  // ce total qui est affiché **et** lu par le moteur de match : il n'y a plus
  // qu'un seul moral.
  const events = inputs.currentRound !== undefined
    ? pruneMoodEvents(inputs.player.dynamic.moodModifiers, inputs.currentRound)
    : inputs.player.dynamic.moodModifiers;

  const all = [...modifiers, ...events];

  let mood = BASE_MOOD;
  for (const m of all) mood += m.delta;
  mood = Math.max(0, Math.min(100, Math.round(mood)));

  return { mood, modifiers: all };
}
