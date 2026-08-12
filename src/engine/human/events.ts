/**
 * Events humains — V0.4 Phase 2.
 *
 * Référence : 02-gdd.md (au moins un événement humain par semaine, 5-10 types).
 * Inspirations :
 *   - M11 Frostpunk : décisions sans bonne réponse + conséquences long-terme
 *   - M9 RimWorld : compatibilités/incompatibilités
 *
 * V0.4 Phase 2 : 5 types hardcodés. V0.5+ : moteur narratif plus riche.
 *
 * Types implémentés :
 *   1. CONFLIT_VESTIAIRE   — deux joueurs avec relation très négative, conflit ouvert
 *   2. DEMANDE_INDIVIDUELLE — un cadre demande quelque chose (temps de jeu, contrat)
 *   3. MENTOR_PROPOSE       — un cadre veut prendre un jeune sous son aile
 *   4. STAR_FATIGUEE        — fatigue élevée d'un cadre, demande à se reposer
 *   5. PRESSE_NEGATIVE      — après 3 défaites, la presse attaque
 */

import type { Player, PlayerId } from '../types.js';

// =============================================================================
// Types
// =============================================================================

export type HumanEventType =
  | 'CONFLIT_VESTIAIRE'
  | 'DEMANDE_INDIVIDUELLE'
  | 'MENTOR_PROPOSE'
  | 'STAR_FATIGUEE'
  | 'PRESSE_NEGATIVE'
  | 'VULNERABILITE_MENTALE'
  | 'EVENT_POSITIF'
  | 'INCIDENT_PRESSE_JOUEUR'
  | 'AMBITION_TRANSFERT'
  | 'CONFLIT_POSTE';

export interface HumanEventEffect {
  /** Modifie le mood d'un joueur cible. */
  readonly moodDelta?: { readonly playerId: PlayerId; readonly delta: number };
  /** Modifie une relation entre deux joueurs. */
  readonly relationDelta?: { readonly p1: PlayerId; readonly p2: PlayerId; readonly delta: number };
  /** Bonus / malus tactique pour le prochain match. */
  readonly tacticalBonusNextMatch?: number;
  /** Étiquette narrative pour l'historique. */
  readonly narrative?: string;
}

export interface HumanEventOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly effects: readonly HumanEventEffect[];
}

export interface HumanEvent {
  readonly id: string;
  readonly type: HumanEventType;
  readonly atRound: number;
  readonly title: string;
  readonly context: string;
  /** Joueurs concernés (pour affichage UI). */
  readonly involvedPlayerIds: readonly PlayerId[];
  readonly options: readonly HumanEventOption[];
  readonly defaultOptionId: string;
}

// =============================================================================
// Constructeurs
// =============================================================================

export function makeConflictEvent(round: number, a: Player, b: Player): HumanEvent {
  return {
    id: `conflict_${round}_${a.id}_${b.id}`,
    type: 'CONFLIT_VESTIAIRE',
    atRound: round,
    title: 'Conflit ouvert au vestiaire',
    context: `${a.firstName} ${a.lastName} et ${b.firstName} ${b.lastName} se sont accrochés sévèrement.`,
    involvedPlayerIds: [a.id, b.id],
    defaultOptionId: 'mediate',
    options: [
      {
        id: 'mediate',
        label: 'Médiation, parler en privé',
        description: 'Vous jouez l\'apaisement. Effet modeste mais durable.',
        effects: [
          { relationDelta: { p1: a.id, p2: b.id, delta: 8 } },
          { moodDelta: { playerId: a.id, delta: 2 } },
          { moodDelta: { playerId: b.id, delta: 2 } },
          { narrative: 'Médiation' },
        ],
      },
      {
        id: 'sanction',
        label: `Sanctionner ${a.lastName}`,
        description: 'Décision claire. L\'autre apprécie, mais le sanctionné se braque.',
        effects: [
          { moodDelta: { playerId: a.id, delta: -10 } },
          { moodDelta: { playerId: b.id, delta: 5 } },
          { relationDelta: { p1: a.id, p2: b.id, delta: -5 } },
          { narrative: `Sanction infligée à ${a.lastName}` },
        ],
      },
      {
        id: 'ignore',
        label: 'Ne rien faire, laisser le vestiaire gérer',
        description: 'Vous ne tranchez pas. Le conflit s\'envenime.',
        effects: [
          { relationDelta: { p1: a.id, p2: b.id, delta: -10 } },
          { moodDelta: { playerId: a.id, delta: -3 } },
          { moodDelta: { playerId: b.id, delta: -3 } },
          { narrative: 'Conflit ignoré' },
        ],
      },
    ],
  };
}

export function makeRequestEvent(round: number, leader: Player): HumanEvent {
  return {
    id: `request_${round}_${leader.id}`,
    type: 'DEMANDE_INDIVIDUELLE',
    atRound: round,
    title: 'Demande individuelle',
    context: `${leader.firstName} ${leader.lastName} demande à vous parler en privé. Il sent qu'il mérite plus.`,
    involvedPlayerIds: [leader.id],
    defaultOptionId: 'listen',
    options: [
      {
        id: 'agree',
        label: 'Accéder à sa demande',
        description: 'Boost mood et confiance pour ce match. Crée un précédent.',
        effects: [
          { moodDelta: { playerId: leader.id, delta: 10 } },
          { tacticalBonusNextMatch: 1 },
          { narrative: 'Accord avec un cadre' },
        ],
      },
      {
        id: 'listen',
        label: 'Écouter, sans rien promettre',
        description: 'Voie diplomatique. Pas de gain mais pas de perte.',
        effects: [
          { moodDelta: { playerId: leader.id, delta: 0 } },
          { narrative: 'Discussion sans engagement' },
        ],
      },
      {
        id: 'refuse',
        label: 'Refuser fermement',
        description: 'Votre autorité s\'affirme. Le cadre encaisse mal.',
        effects: [
          { moodDelta: { playerId: leader.id, delta: -8 } },
          { narrative: 'Demande refusée' },
        ],
      },
    ],
  };
}

export function makeMentorEvent(round: number, mentor: Player, young: Player): HumanEvent {
  return {
    id: `mentor_${round}_${mentor.id}_${young.id}`,
    type: 'MENTOR_PROPOSE',
    atRound: round,
    title: 'Proposition de tutorat',
    context: `${mentor.firstName} ${mentor.lastName} (cadre) souhaite prendre ${young.firstName} ${young.lastName} sous son aile.`,
    involvedPlayerIds: [mentor.id, young.id],
    defaultOptionId: 'accept',
    options: [
      {
        id: 'accept',
        label: 'Officialiser le binôme',
        description: 'Lien fort entre les deux, progression accélérée du jeune.',
        effects: [
          { relationDelta: { p1: mentor.id, p2: young.id, delta: 25 } },
          { moodDelta: { playerId: young.id, delta: 6 } },
          { moodDelta: { playerId: mentor.id, delta: 3 } },
          { narrative: 'Binôme mentor/élève' },
        ],
      },
      {
        id: 'decline',
        label: 'Décliner, le jeune doit faire ses preuves seul',
        description: 'Position dure. Le cadre apprécie peu, le jeune souffre.',
        effects: [
          { moodDelta: { playerId: mentor.id, delta: -5 } },
          { moodDelta: { playerId: young.id, delta: -3 } },
          { narrative: 'Tutorat refusé' },
        ],
      },
    ],
  };
}

export function makeStarFatigueEvent(round: number, star: Player): HumanEvent {
  return {
    id: `star_fatigue_${round}_${star.id}`,
    type: 'STAR_FATIGUEE',
    atRound: round,
    title: 'Cadre épuisé',
    context: `${star.firstName} ${star.lastName} demande à souffler. Il enchaîne depuis le début de saison.`,
    involvedPlayerIds: [star.id],
    defaultOptionId: 'rest',
    options: [
      {
        id: 'rest',
        label: 'Le mettre au repos',
        description: 'Récupération bien méritée. Mood remonte, fatigue baisse.',
        effects: [
          { moodDelta: { playerId: star.id, delta: 8 } },
          { narrative: 'Cadre reposé' },
        ],
      },
      {
        id: 'play',
        label: 'L\'aligner quand même',
        description: 'On a besoin de lui. Mood plombé, risque de blessure majoré (V0.5).',
        effects: [
          { moodDelta: { playerId: star.id, delta: -8 } },
          { tacticalBonusNextMatch: -1 },
          { narrative: 'Cadre aligné fatigué' },
        ],
      },
    ],
  };
}

export function makePressEvent(round: number, defeats: number): HumanEvent {
  return {
    id: `press_${round}`,
    type: 'PRESSE_NEGATIVE',
    atRound: round,
    title: 'Presse attaque le club',
    context: `${defeats} défaites de suite. La presse demande des comptes.`,
    involvedPlayerIds: [],
    defaultOptionId: 'calm',
    options: [
      {
        id: 'calm',
        label: 'Conf de presse posée, défendre les joueurs',
        description: 'Vous protégez le groupe. Le moral remonte un peu, rien de plus.',
        effects: [
          { tacticalBonusNextMatch: 1 },
          { narrative: 'Presse apaisée' },
        ],
      },
      {
        id: 'attack',
        label: 'Attaquer la presse',
        description: 'Geste fort qui galvanise les troupes mais peut se retourner.',
        effects: [
          { tacticalBonusNextMatch: 2 },
          { narrative: 'Présse contre-attaquée' },
        ],
      },
      {
        id: 'self_critical',
        label: 'Faire son mea culpa',
        description: 'Geste humble. La presse s\'apaise mais le vestiaire vacille.',
        effects: [
          { tacticalBonusNextMatch: -1 },
          { narrative: 'Mea culpa public' },
        ],
      },
    ],
  };
}

// =============================================================================
// V0.9 Phase 4 — 5 nouveaux events
// =============================================================================

export function makeVulnerabilityEvent(round: number, player: Player): HumanEvent {
  return {
    id: `vulnerability_${round}_${player.id}`,
    type: 'VULNERABILITE_MENTALE',
    atRound: round,
    title: 'Coup de blues',
    context: `${player.firstName} ${player.lastName} traverse une mauvaise passe mentale. Il en parle en privé.`,
    involvedPlayerIds: [player.id],
    defaultOptionId: 'support',
    options: [
      {
        id: 'support',
        label: 'L\'écouter et l\'orienter vers le préparateur mental',
        description: 'Approche bienveillante. Le joueur récupère sur la durée.',
        effects: [
          { moodDelta: { playerId: player.id, delta: 12 } },
          { narrative: 'Soutien individuel' },
        ],
      },
      {
        id: 'rest',
        label: 'Le mettre au repos une journée',
        description: 'Match suivant sans lui mais reset moral plus rapide.',
        effects: [
          { moodDelta: { playerId: player.id, delta: 8 } },
          { tacticalBonusNextMatch: -1 },
          { narrative: 'Repos accordé' },
        ],
      },
      {
        id: 'firm',
        label: 'Lui demander de serrer les dents',
        description: 'Position froide. Risque de fragiliser durablement.',
        effects: [
          { moodDelta: { playerId: player.id, delta: -10 } },
          { narrative: 'Réponse sèche' },
        ],
      },
    ],
  };
}

export function makePositiveEvent(round: number, player: Player, occasion: string): HumanEvent {
  return {
    id: `positive_${round}_${player.id}`,
    type: 'EVENT_POSITIF',
    atRound: round,
    title: occasion,
    context: `${player.firstName} ${player.lastName} vit ${occasion.toLowerCase()}. Le vestiaire le remarque.`,
    involvedPlayerIds: [player.id],
    defaultOptionId: 'celebrate',
    options: [
      {
        id: 'celebrate',
        label: 'Marquer le coup avec le groupe',
        description: 'Geste collectif. Cohésion + moral du joueur.',
        effects: [
          { moodDelta: { playerId: player.id, delta: 10 } },
          { tacticalBonusNextMatch: 1 },
          { narrative: 'Moment partagé' },
        ],
      },
      {
        id: 'private',
        label: 'Mot personnel',
        description: 'Discret. Le joueur apprécie.',
        effects: [
          { moodDelta: { playerId: player.id, delta: 5 } },
          { narrative: 'Mot personnel' },
        ],
      },
    ],
  };
}

export function makePlayerPressIncidentEvent(round: number, player: Player): HumanEvent {
  return {
    id: `press_inc_${round}_${player.id}`,
    type: 'INCIDENT_PRESSE_JOUEUR',
    atRound: round,
    title: 'Polémique presse autour d\'un joueur',
    context: `Une rumeur sort dans la presse concernant ${player.firstName} ${player.lastName}. Le club doit réagir.`,
    involvedPlayerIds: [player.id],
    defaultOptionId: 'protect',
    options: [
      {
        id: 'protect',
        label: 'Défendre publiquement le joueur',
        description: 'Vous faites bloc. Le joueur l\'apprécie, mais la presse insiste.',
        effects: [
          { moodDelta: { playerId: player.id, delta: 8 } },
          { tacticalBonusNextMatch: -1 },
          { narrative: 'Bouclier vestiaire' },
        ],
      },
      {
        id: 'discipline',
        label: 'Sanctionner publiquement',
        description: 'Discipline ferme. Presse satisfaite, joueur blessé.',
        effects: [
          { moodDelta: { playerId: player.id, delta: -12 } },
          { tacticalBonusNextMatch: 1 },
          { narrative: 'Sanction publique' },
        ],
      },
      {
        id: 'silence',
        label: 'No comment',
        description: 'Vous laissez courir. Tout le monde reste suspendu.',
        effects: [
          { moodDelta: { playerId: player.id, delta: -4 } },
          { narrative: 'Silence officiel' },
        ],
      },
    ],
  };
}

export function makeAmbitionTransferEvent(round: number, player: Player): HumanEvent {
  return {
    id: `ambition_${round}_${player.id}`,
    type: 'AMBITION_TRANSFERT',
    atRound: round,
    title: 'Tentation extérieure',
    context: `${player.firstName} ${player.lastName} a été approché par un grand club. Il veut savoir ce que vous en pensez.`,
    involvedPlayerIds: [player.id],
    defaultOptionId: 'reassure',
    options: [
      {
        id: 'reassure',
        label: 'Lui promettre un rôle central',
        description: 'Engagement fort. Le joueur reste motivé.',
        effects: [
          { moodDelta: { playerId: player.id, delta: 8 } },
          { tacticalBonusNextMatch: 1 },
          { narrative: 'Promesse de rôle' },
        ],
      },
      {
        id: 'neutral',
        label: 'Lui dire de réfléchir calmement',
        description: 'Position neutre. Risque de le voir partir mais pas d\'engagement.',
        effects: [
          { moodDelta: { playerId: player.id, delta: -3 } },
          { narrative: 'Position attentiste' },
        ],
      },
      {
        id: 'block',
        label: 'Refuser net',
        description: 'Vous le bloquez. Le joueur le vit mal.',
        effects: [
          { moodDelta: { playerId: player.id, delta: -10 } },
          { narrative: 'Veto autoritaire' },
        ],
      },
    ],
  };
}

export function makePositionConflictEvent(round: number, threatened: Player, rival: Player): HumanEvent {
  return {
    id: `pos_conflict_${round}_${threatened.id}_${rival.id}`,
    type: 'CONFLIT_POSTE',
    atRound: round,
    title: 'Concurrence sur un poste',
    context: `${threatened.firstName} ${threatened.lastName} sent que ${rival.firstName} ${rival.lastName} le menace sur sa place de titulaire. Il cherche à clarifier.`,
    involvedPlayerIds: [threatened.id, rival.id],
    defaultOptionId: 'fair',
    options: [
      {
        id: 'fair',
        label: 'Position transparente : la place se mérite',
        description: 'Vous les mettez en concurrence. Tendu mais sain.',
        effects: [
          { moodDelta: { playerId: threatened.id, delta: -3 } },
          { moodDelta: { playerId: rival.id, delta: 5 } },
          { narrative: 'Compétition assumée' },
        ],
      },
      {
        id: 'reassure_titular',
        label: `Rassurer ${threatened.lastName}`,
        description: 'Vous confirmez la hiérarchie. Le titulaire respire, l\'autre s\'aigrit.',
        effects: [
          { moodDelta: { playerId: threatened.id, delta: 8 } },
          { moodDelta: { playerId: rival.id, delta: -10 } },
          { relationDelta: { p1: threatened.id, p2: rival.id, delta: -8 } },
          { narrative: 'Titulaire confirmé' },
        ],
      },
      {
        id: 'promote_rival',
        label: `Promouvoir ${rival.lastName}`,
        description: 'Vous choisissez le challenger. Coup de fouet pour lui, choc pour l\'autre.',
        effects: [
          { moodDelta: { playerId: threatened.id, delta: -12 } },
          { moodDelta: { playerId: rival.id, delta: 12 } },
          { tacticalBonusNextMatch: 1 },
          { narrative: 'Changement de hiérarchie' },
        ],
      },
    ],
  };
}
