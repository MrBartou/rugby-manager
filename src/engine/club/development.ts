/**
 * Développement des joueurs — V0.14.
 *
 * Avant ce module, `season/aging.ts` était **le seul endroit du code où les
 * attributs d'un joueur bougeaient** : une courbe d'âge appliquée au rollover,
 * plafonnée par le potentiel. Rien de ce que faisait le manager n'y changeait
 * quoi que ce soit — l'entraînement ne produisait qu'un bonus tactique valable
 * un match, et le staff n'avait aucun effet mécanique.
 *
 * Le jeu récompensait donc de *bien sélectionner*, jamais de *construire*. C'est
 * précisément l'inverse de la boucle qui fait tenir un jeu de management sur dix
 * saisons : repérer un joueur, le faire jouer, le former, et le voir devenir autre
 * chose trois ans plus tard.
 *
 * ## Modèle
 *
 * Chaque intersaison, un joueur reçoit un **budget de progression** (en points
 * d'attributs), puis ce budget est **réparti** selon son focus d'entraînement.
 *
 * Le budget dépend de cinq facteurs, dont le premier est de loin le plus important :
 *
 *  1. **le temps de jeu** — un jeune qui ne joue pas ne progresse pas
 *  2. l'âge (courbe de progression puis de déclin)
 *  3. la marge restante jusqu'au potentiel
 *  4. le professionnalisme du joueur (attribut jusque-là inexploité)
 *  5. la qualité du staff d'entraînement du club
 *
 * Chaque progression produit un `DevelopmentReport` qui explique *pourquoi* elle a
 * eu lieu : sans cette lisibilité, le joueur ne peut pas apprendre à jouer avec le
 * système.
 */

import { createRng, type Rng } from '../rng.js';
import type {
  MentalAttributes,
  PhysicalAttributes,
  Player,
  PlayerId,
  Position,
  TechnicalAttributes,
} from '../types.js';

// =============================================================================
// Focus d'entraînement
// =============================================================================

export type TrainingFocus =
  | 'PHYSIQUE'
  | 'TECHNIQUE'
  | 'POSTE'
  | 'MENTAL'
  | 'EQUILIBRE'
  | 'RECUPERATION';

export const TRAINING_FOCUS_LABEL: Readonly<Record<TrainingFocus, string>> = {
  PHYSIQUE: 'Physique',
  TECHNIQUE: 'Technique',
  POSTE: 'Spécifique au poste',
  MENTAL: 'Mental',
  EQUILIBRE: 'Équilibré',
  RECUPERATION: 'Récupération',
};

export const TRAINING_FOCUS_DESCRIPTION: Readonly<Record<TrainingFocus, string>> = {
  PHYSIQUE: 'Vitesse, puissance, endurance. Ralentit le déclin après 30 ans.',
  TECHNIQUE: 'Passe, plaquage, jeu au pied, conservation.',
  POSTE: 'Compétences propres au poste (poussée, lancer, grattage, finition…).',
  MENTAL: 'Décision, sang-froid, leadership, discipline. Progresse à tout âge.',
  EQUILIBRE: 'Réparti sur tous les domaines. Sûr, mais sans spécialisation.',
  RECUPERATION: 'Aucune progression, mais préserve un organisme fragile.',
};

/** Focus par défaut, appliqué tant que le manager n'a rien décidé. */
export const DEFAULT_TRAINING_FOCUS: TrainingFocus = 'EQUILIBRE';

// =============================================================================
// Qualité du staff
// =============================================================================

/**
 * Qualité de l'encadrement du club, par domaine (0-100).
 * Alimentée par le staff recruté — voir `club/staff.ts`.
 */
export interface CoachingQuality {
  readonly physique: number;
  readonly technique: number;
  readonly mental: number;
  /** Formation des jeunes : amplifie la progression avant 23 ans. */
  readonly formation: number;
}

export const AVERAGE_COACHING: CoachingQuality = {
  physique: 55,
  technique: 55,
  mental: 55,
  formation: 55,
};

// =============================================================================
// Entrées / sorties
// =============================================================================

export interface DevelopmentInput {
  readonly player: Player;
  /** Saison qui commence (sert à calculer l'âge). */
  readonly newSeason: number;
  /** Minutes jouées sur la saison écoulée, toutes compétitions confondues. */
  readonly minutesPlayed: number;
  readonly focus: TrainingFocus;
  readonly coaching: CoachingQuality;
}

/** Un attribut modifié, avec sa valeur avant/après. */
export interface AttributeChange {
  readonly group: 'technical' | 'physical' | 'mental' | 'positionSpecific';
  readonly key: string;
  readonly label: string;
  readonly before: number;
  readonly after: number;
}

export interface DevelopmentReport {
  readonly playerId: PlayerId;
  readonly age: number;
  readonly minutesPlayed: number;
  readonly focus: TrainingFocus;
  /** Somme algébrique des points gagnés (positive) ou perdus (négative). */
  readonly netChange: number;
  readonly changes: readonly AttributeChange[];
  /** Explication lisible des facteurs déterminants. */
  readonly reasons: readonly string[];
}

export interface DevelopmentResult {
  readonly player: Player;
  readonly report: DevelopmentReport;
}

// =============================================================================
// Facteurs
// =============================================================================

function ageFromBirthDate(birthDate: string, season: number): number {
  return season - Number(birthDate.slice(0, 4));
}

/**
 * Progression brute selon l'âge, exprimée **en points par attribut travaillé**
 * et par saison. Négatif après 30 ans : c'est le déclin.
 *
 * L'unité compte : une première version raisonnait en points *totaux* à répartir
 * sur la vingtaine d'attributs d'un joueur, ce qui faisait bouger son niveau
 * global de 0,4 point par saison — un espoir à potentiel 88 plafonnait à 57 au
 * bout de huit ans. Raisonner par attribut donne la courbe attendue : forte
 * progression jusqu'à 23 ans, puis convergence vers le potentiel.
 */
function ageBudget(age: number): number {
  if (age <= 19) return 4.0;
  if (age <= 21) return 3.4;
  if (age <= 23) return 2.6;
  if (age <= 25) return 1.7;
  if (age <= 27) return 0.9;
  if (age <= 29) return 0.4;
  if (age <= 31) return -0.9;
  if (age <= 33) return -1.9;
  if (age <= 35) return -2.8;
  return -3.6;
}

/**
 * Multiplicateur de temps de jeu — **le levier central**.
 *
 * Une saison de Top 14 pleine représente ~2000 minutes pour un titulaire.
 * Un joueur qui ne joue pas stagne, quel que soit son potentiel : c'est ce qui
 * donne du poids à la décision de le faire jouer plutôt que de le garder au chaud.
 */
export function playingTimeFactor(minutesPlayed: number): number {
  if (minutesPlayed <= 0) return 0.15;
  if (minutesPlayed < 300) return 0.32;
  if (minutesPlayed < 700) return 0.52;
  if (minutesPlayed < 1200) return 0.80;
  if (minutesPlayed < 1800) return 1.10;
  return 1.25;
}

/**
 * Marge restante jusqu'au potentiel. Un joueur proche de son plafond progresse
 * de moins en moins, même en jouant beaucoup.
 */
function headroomFactor(currentOverall: number, potentiel: number): number {
  const gap = potentiel - currentOverall;
  if (gap <= 0) return 0.05;
  if (gap <= 4) return 0.35;
  if (gap <= 9) return 0.70;
  if (gap <= 16) return 1.0;
  return 1.15;
}

/** Le professionnalisme conditionne ce que le joueur tire de son entraînement. */
function professionalismFactor(professionnalisme: number): number {
  return 0.78 + (professionnalisme / 100) * 0.44;      // 0.78 → 1.22
}

/**
 * Détermination — V0.55.
 *
 * `hidden.determinisme` était généré sur chaque joueur depuis la V0.4 et lu
 * nulle part. Deux joueurs au même potentiel progressaient donc exactement
 * pareil, ce qui vide de son sens l'idée même de potentiel : dans un centre de
 * formation, la différence entre celui qui perce et celui qui reste espoir
 * n'est presque jamais le talent brut.
 *
 * Amplitude proche de celle du professionnalisme, avec lequel elle ne fait pas
 * doublon : le professionnalisme dit comment on s'entretient, la détermination
 * dit si l'on s'accroche quand ça ne vient pas.
 */
function determinationFactor(determinisme: number): number {
  return 0.80 + (determinisme / 100) * 0.40;            // 0.80 → 1.20
}

/** Qualité de l'encadrement dans le domaine travaillé. */
function coachingFactor(quality: number): number {
  return 0.84 + (quality / 100) * 0.40;                 // 0.84 → 1.24
}

/** Domaine d'encadrement mobilisé par un focus d'entraînement donné. */
function coachingForFocus(coaching: CoachingQuality, focus: TrainingFocus): number {
  switch (focus) {
    case 'PHYSIQUE': return coaching.physique;
    case 'TECHNIQUE':
    case 'POSTE': return coaching.technique;
    case 'MENTAL': return coaching.mental;
    case 'RECUPERATION': return coaching.physique;
    case 'EQUILIBRE':
    default: return (coaching.physique + coaching.technique + coaching.mental) / 3;
  }
}

/** Le centre de formation compte surtout pour les moins de 23 ans. */
function academyFactor(age: number, formation: number): number {
  if (age > 23) return 1;
  return 0.88 + (formation / 100) * 0.30;
}

/** Overall approximatif — sert de référence pour la marge de progression. */
export function approximateOverall(p: Player): number {
  const t = p.technical;
  const ph = p.physical;
  const m = p.mental;
  const tech = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const phys = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const ment = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (tech + phys + ment) / 3;
}

// =============================================================================
// Répartition du budget
// =============================================================================

/** Attributs propres à chaque poste, travaillés par le focus POSTE. */
const POSITION_KEYS: Readonly<Record<Position, readonly string[]>> = {
  PILIER_GAUCHE: ['pousseeMelee', 'liftEnTouche'],
  TALONNEUR: ['pousseeMelee', 'qualiteLancer'],
  PILIER_DROIT: ['pousseeMelee', 'liftEnTouche'],
  DEUXIEME_LIGNE_GAUCHE: ['pousseeMelee', 'sautEnTouche'],
  DEUXIEME_LIGNE_DROITE: ['pousseeMelee', 'sautEnTouche'],
  TROISIEME_LIGNE_AILE_GAUCHE: ['grattage', 'liftEnTouche'],
  TROISIEME_LIGNE_AILE_DROITE: ['grattage', 'liftEnTouche'],
  NUMERO_8: ['grattage', 'liftEnTouche'],
  DEMI_DE_MELEE: ['passeRapide'],
  OUVREUR: [],
  CENTRE_INTERIEUR: [],
  CENTRE_EXTERIEUR: [],
  AILIER_GAUCHE: ['finition', 'jeuAerien'],
  AILIER_DROIT: ['finition', 'jeuAerien'],
  ARRIERE: ['finition', 'jeuAerien'],
};

/** Attributs techniques les plus utiles à chaque poste (focus POSTE, repli). */
const POSITION_TECHNICAL: Readonly<Record<Position, readonly (keyof TechnicalAttributes)[]>> = {
  PILIER_GAUCHE: ['conservation', 'deblayage'],
  TALONNEUR: ['conservation', 'deblayage'],
  PILIER_DROIT: ['conservation', 'deblayage'],
  DEUXIEME_LIGNE_GAUCHE: ['deblayage', 'prisedeballeHaute'],
  DEUXIEME_LIGNE_DROITE: ['deblayage', 'prisedeballeHaute'],
  TROISIEME_LIGNE_AILE_GAUCHE: ['plaquage', 'deblayage'],
  TROISIEME_LIGNE_AILE_DROITE: ['plaquage', 'deblayage'],
  NUMERO_8: ['conservation', 'plaquage'],
  DEMI_DE_MELEE: ['passe', 'jeuAuPiedDynamique'],
  OUVREUR: ['jeuAuPiedPlace', 'visionDeJeu'],
  CENTRE_INTERIEUR: ['conservation', 'plaquage'],
  CENTRE_EXTERIEUR: ['passe', 'visionDeJeu'],
  AILIER_GAUCHE: ['prisedeballeHaute', 'plaquage'],
  AILIER_DROIT: ['prisedeballeHaute', 'plaquage'],
  ARRIERE: ['jeuAuPiedDynamique', 'prisedeballeHaute'],
};

const TECHNICAL_LABELS: Readonly<Record<keyof TechnicalAttributes, string>> = {
  passe: 'Passe',
  plaquage: 'Plaquage',
  jeuAuPiedPlace: 'Jeu au pied placé',
  jeuAuPiedDynamique: 'Jeu au pied dynamique',
  visionDeJeu: 'Vision de jeu',
  conservation: 'Conservation',
  prisedeballeHaute: 'Prise de balle haute',
  deblayage: 'Déblayage',
};

const PHYSICAL_LABELS: Readonly<Record<keyof PhysicalAttributes, string>> = {
  vitesse: 'Vitesse',
  puissance: 'Puissance',
  endurance: 'Endurance',
  detente: 'Détente',
  robustesse: 'Robustesse',
};

const MENTAL_LABELS: Readonly<Record<keyof MentalAttributes, string>> = {
  decision: 'Décision',
  leadership: 'Leadership',
  sangFroid: 'Sang-froid',
  agressivite: 'Agressivité',
  professionnalisme: 'Professionnalisme',
  discipline: 'Discipline',
};

const POSITION_LABELS: Readonly<Record<string, string>> = {
  pousseeMelee: 'Poussée en mêlée',
  qualiteLancer: 'Qualité de lancer',
  sautEnTouche: 'Saut en touche',
  liftEnTouche: 'Lift en touche',
  grattage: 'Grattage',
  passeRapide: 'Passe rapide',
  finition: 'Finition',
  jeuAerien: 'Jeu aérien',
};

/**
 * Répartition du **déclin** entre domaines.
 *
 * Attention : en déclin, le focus ne désigne pas ce qu'on développe mais ce qu'on
 * **protège**. Travailler le physique doit donc réduire la part de perte qui tombe
 * sur le physique — l'inverse de la logique de progression. Utiliser la même
 * répartition dans les deux sens faisait perdre *davantage* de vitesse au vétéran
 * qui travaillait sa vitesse.
 *
 * Le physique encaisse l'essentiel dans tous les cas : c'est lui qui part en premier.
 */
function declineAllocation(focus: TrainingFocus): { technical: number; physical: number; position: number } {
  switch (focus) {
    case 'PHYSIQUE': return { physical: 0.50, technical: 0.28, position: 0.22 };
    case 'RECUPERATION': return { physical: 0.58, technical: 0.24, position: 0.18 };
    case 'POSTE': return { physical: 0.76, technical: 0.16, position: 0.08 };
    case 'TECHNIQUE': return { physical: 0.78, technical: 0.08, position: 0.14 };
    case 'MENTAL': return { physical: 0.76, technical: 0.24, position: 0.00 };
    case 'EQUILIBRE':
    default: return { physical: 0.70, technical: 0.20, position: 0.10 };
  }
}

/**
 * Emphase par domaine selon le focus — ce sont des **multiplicateurs**, pas des
 * parts d'un total : un joueur qui travaille le physique progresse plus vite en
 * physique qu'un joueur équilibré, sans progresser moins ailleurs qu'au prorata.
 */
function allocation(focus: TrainingFocus): { technical: number; physical: number; mental: number; position: number } {
  switch (focus) {
    case 'PHYSIQUE': return { technical: 0.35, physical: 1.90, mental: 0.20, position: 0.40 };
    case 'TECHNIQUE': return { technical: 1.80, physical: 0.30, mental: 0.30, position: 0.50 };
    case 'POSTE': return { technical: 1.00, physical: 0.70, mental: 0.25, position: 2.20 };
    case 'MENTAL': return { technical: 0.40, physical: 0.25, mental: 1.90, position: 0.30 };
    case 'RECUPERATION': return { technical: 0.35, physical: 0.35, mental: 0.35, position: 0.35 };
    case 'EQUILIBRE':
    default: return { technical: 1.00, physical: 1.00, mental: 0.70, position: 0.80 };
  }
}

function clampStat(v: number): number {
  return Math.max(1, Math.min(99, v));
}

/**
 * Convertit un budget fractionnaire en nombre entier de points, en traitant la
 * partie décimale comme une probabilité. Sans ça, un budget de 0,6 point ne
 * produirait jamais rien et les joueurs proches de leur plafond seraient figés.
 */
function budgetToPoints(budget: number, rng: Rng): number {
  const whole = Math.trunc(budget);
  const frac = Math.abs(budget - whole);
  const extra = rng.nextBool(frac) ? (budget >= 0 ? 1 : -1) : 0;
  return whole + extra;
}

// =============================================================================
// Calcul principal
// =============================================================================

/**
 * Fait évoluer un joueur sur une intersaison.
 *
 * Fonction pure et déterministe pour un rng donné.
 */
export function developPlayer(input: DevelopmentInput, rng: Rng): DevelopmentResult {
  const { player, focus, coaching } = input;
  const age = ageFromBirthDate(player.birthDate, input.newSeason);
  const reasons: string[] = [];

  if (player.retired) {
    return {
      player,
      report: {
        playerId: player.id, age, minutesPlayed: input.minutesPlayed, focus,
        netChange: 0, changes: [], reasons: ['Joueur retraité.'],
      },
    };
  }

  const base = ageBudget(age);
  const growing = base > 0;

  const playTime = playingTimeFactor(input.minutesPlayed);
  const overall = approximateOverall(player);
  const headroom = headroomFactor(overall, player.hidden.potentiel);
  const pro = professionalismFactor(player.mental.professionnalisme);
  const academy = academyFactor(age, coaching.formation);

  // En progression, tous les facteurs comptent. En déclin, le temps de jeu et la
  // marge de potentiel n'ont plus de sens : seuls l'hygiène de vie et le staff
  // physique freinent la chute.
  let budget: number;
  if (growing) {
    // Le staff qui compte est celui du domaine réellement travaillé : recruter un
    // bon préparateur physique ne sert à rien si l'effectif travaille la technique.
    budget = base * playTime * headroom * pro * academy
      * determinationFactor(player.hidden.determinisme)
      * coachingFactor(coachingForFocus(coaching, focus));
  } else {
    const slowdown = 0.72 + (coaching.physique / 100) * 0.22 + (player.mental.professionnalisme / 100) * 0.16;
    budget = base / Math.max(0.75, slowdown);
    // Travailler le physique atténue le déclin ; le négliger l'accélère.
    if (focus === 'PHYSIQUE') budget *= 0.68;
    if (focus === 'RECUPERATION') budget *= 0.80;
    if (focus === 'MENTAL' || focus === 'TECHNIQUE') budget *= 1.10;
  }

  // La récupération sacrifie la progression au profit de la fraîcheur.
  if (focus === 'RECUPERATION' && growing) budget *= 0.35;

  // --- Explications lisibles -----------------------------------------------
  if (growing) {
    if (input.minutesPlayed <= 0) {
      reasons.push('N\'a pas joué de la saison : progression quasi nulle.');
    } else if (playTime >= 1.15) {
      reasons.push(`Temps de jeu important (${Math.round(input.minutesPlayed)} min) : progression accélérée.`);
    } else if (playTime <= 0.70) {
      reasons.push(`Temps de jeu limité (${Math.round(input.minutesPlayed)} min) : progression freinée.`);
    }
    if (headroom <= 0.35) reasons.push('Proche de son plafond : la marge se réduit.');
    if (pro >= 1.12) reasons.push('Professionnalisme exemplaire à l\'entraînement.');
    else if (pro <= 0.88) reasons.push('Hygiène de vie perfectible : tire peu de l\'entraînement.');
    if (age <= 23 && coaching.formation >= 70) reasons.push('Encadrement de formation de haut niveau.');
    const domainQuality = coachingForFocus(coaching, focus);
    if (domainQuality >= 72) reasons.push('Staff d\'entraînement de premier plan sur ce domaine.');
    else if (domainQuality <= 42) reasons.push('Encadrement faible sur ce domaine : le travail porte peu.');
  } else {
    reasons.push(`${age} ans : le physique décline.`);
    if (focus === 'PHYSIQUE') reasons.push('Travail physique ciblé : déclin ralenti.');
    if (focus === 'MENTAL') reasons.push('Le mental continue de progresser avec l\'expérience.');
  }

  // --- Répartition ----------------------------------------------------------
  const growthSplit = allocation(focus);
  const lossSplit = declineAllocation(focus);
  const changes: AttributeChange[] = [];

  const technical = { ...player.technical };
  const physical = { ...player.physical };
  const mental = { ...player.mental };
  const positionSpecific = { ...player.positionSpecific };

  const cap = player.hidden.potentiel;

  // Physique : c'est lui qui porte l'essentiel du déclin.
  applyToGroup(
    physical as unknown as Record<string, number>,
    physicalKeysFor(focus),
    budget * (growing ? growthSplit.physical : lossSplit.physical * 1.6),
    growing ? cap : 99,
    'physical',
    PHYSICAL_LABELS as unknown as Record<string, string>,
  );

  // Technique : un joueur ne « désapprend » pas ses gestes aussi vite qu'il perd
  // sa vitesse — la part de déclin qui l'atteint reste faible.
  applyToGroup(
    technical as unknown as Record<string, number>,
    technicalKeysFor(focus, player.position),
    budget * (growing ? growthSplit.technical : lossSplit.technical * 1.6),
    growing ? cap : 99,
    'technical',
    TECHNICAL_LABELS as unknown as Record<string, string>,
  );

  // Mental : progresse à tout âge, l'expérience compense l'usure.
  const mentalBudget = growing
    ? budget * growthSplit.mental
    : Math.abs(budget) * allocation(focus).mental * 0.55;      // toujours positif
  applyToGroup(
    mental as unknown as Record<string, number>,
    mentalKeysFor(focus),
    mentalBudget,
    99,
    'mental',
    MENTAL_LABELS as unknown as Record<string, string>,
  );

  // Spécifique au poste.
  const posKeys = POSITION_KEYS[player.position].filter(k => positionSpecific[k as keyof typeof positionSpecific] !== undefined);
  if (posKeys.length > 0) {
    applyToGroup(
      positionSpecific as unknown as Record<string, number>,
      posKeys,
      budget * (growing ? growthSplit.position : lossSplit.position * 1.6),
      growing ? cap : 99,
      'positionSpecific',
      POSITION_LABELS,
    );
  }

  const netChange = changes.reduce((a, c) => a + (c.after - c.before), 0);
  if (changes.length === 0) reasons.push('Aucune évolution notable cette saison.');

  return {
    player: { ...player, technical, physical, mental, positionSpecific },
    report: {
      playerId: player.id,
      age,
      minutesPlayed: input.minutesPlayed,
      focus,
      netChange,
      changes,
      reasons,
    },
  };

  // ---------------------------------------------------------------------------

  /** Distribue un budget sur un ensemble d'attributs, un point à la fois. */
  /**
   * `perAttribute` est le budget destiné à *chaque* attribut du groupe : on le
   * convertit en enveloppe totale avant de la distribuer point par point.
   */
  function applyToGroup(
    target: Record<string, number>,
    keys: readonly string[],
    perAttribute: number,
    ceiling: number,
    group: AttributeChange['group'],
    labels: Record<string, string>,
  ): void {
    if (keys.length === 0) return;
    const points = budgetToPoints(perAttribute * keys.length, rng);
    if (points === 0) return;

    const before = new Map<string, number>();
    for (const k of keys) before.set(k, target[k] ?? 0);

    const step = points > 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(points); i++) {
      // On répartit en tournant sur les attributs du groupe, en démarrant à un
      // index tiré au sort pour éviter que le premier soit systématiquement servi.
      const key = keys[(rng.nextInt(0, keys.length - 1) + i) % keys.length]!;
      const current = target[key] ?? 0;
      if (step > 0 && current >= Math.min(99, ceiling)) continue;
      target[key] = clampStat(current + step);
    }

    for (const k of keys) {
      const b = before.get(k) ?? 0;
      const a = target[k] ?? 0;
      if (a !== b) {
        changes.push({ group, key: k, label: labels[k] ?? k, before: b, after: a });
      }
    }
  }
}

// --- Sélection des attributs travaillés selon le focus ------------------------

function physicalKeysFor(focus: TrainingFocus): readonly string[] {
  if (focus === 'PHYSIQUE') return ['vitesse', 'puissance', 'endurance', 'detente'];
  return ['vitesse', 'puissance', 'endurance', 'detente', 'robustesse'];
}

function technicalKeysFor(focus: TrainingFocus, position: Position): readonly string[] {
  const all = Object.keys(TECHNICAL_LABELS);
  if (focus !== 'POSTE') return all;
  // Le travail spécifique *accentue* les gestes du poste sans geler le reste :
  // les attributs clés apparaissent deux fois, donc reçoivent environ le double
  // de points. N'entraîner qu'eux figeait le plaquage d'un talonneur à vie.
  return [...all, ...POSITION_TECHNICAL[position]];
}

function mentalKeysFor(focus: TrainingFocus): readonly string[] {
  // L'agressivité n'est pas « meilleure » quand elle monte : on ne l'entraîne pas.
  if (focus === 'MENTAL') return ['decision', 'sangFroid', 'leadership', 'discipline'];
  return ['decision', 'sangFroid', 'professionnalisme', 'discipline'];
}

// =============================================================================
// Application à un effectif
// =============================================================================

export interface SquadDevelopmentInput {
  readonly players: readonly Player[];
  readonly newSeason: number;
  readonly seed: string;
  /** Minutes jouées sur la saison, par joueur. Absent = n'a pas joué. */
  readonly minutesByPlayer: ReadonlyMap<PlayerId, number>;
  /** Focus d'entraînement choisi par le manager, par joueur. */
  readonly focusByPlayer: ReadonlyMap<PlayerId, TrainingFocus>;
  /**
   * Qualité d'encadrement par club. Les clubs absents utilisent `AVERAGE_COACHING` :
   * l'IA n'a pas besoin d'un staff détaillé pour que le monde reste cohérent.
   */
  readonly coachingByClub: ReadonlyMap<string, CoachingQuality>;
}

export interface SquadDevelopmentResult {
  readonly players: readonly Player[];
  /** Rapports, uniquement pour les joueurs ayant réellement évolué. */
  readonly reports: readonly DevelopmentReport[];
}

/**
 * Applique le développement à un effectif complet.
 * Déterministe par seed, pour rester rejouable.
 */
export function developSquad(input: SquadDevelopmentInput): SquadDevelopmentResult {
  const rng = createRng(`${input.seed}_development_${input.newSeason}`);
  const players: Player[] = [];
  const reports: DevelopmentReport[] = [];

  for (const player of input.players) {
    const coaching = input.coachingByClub.get(player.clubId as string) ?? AVERAGE_COACHING;
    const result = developPlayer(
      {
        player,
        newSeason: input.newSeason,
        minutesPlayed: input.minutesByPlayer.get(player.id) ?? 0,
        focus: input.focusByPlayer.get(player.id) ?? DEFAULT_TRAINING_FOCUS,
        coaching,
      },
      rng,
    );
    players.push(result.player);
    if (result.report.changes.length > 0) reports.push(result.report);
  }

  return { players, reports };
}
