/**
 * Live moments — décisions interactives pendant le match.
 *
 * Référence : 06-moteur-match.md, section "Live decision moments : 5-15 par match".
 *
 * V0.2 : 5 moments hardcodés, déclenchés par des conditions sur l'état du match.
 *   - HALF_TIME            : à la mi-temps (40')
 *   - PENALTY_DECISION     : pénalité dans une zone où le choix tir/touche est ambigu
 *   - FATIGUED_STAR        : un cadre titulaire est à fatigue > 75 après l'heure de jeu
 *   - DEFENSIVE_PRESSURE   : 2+ essais concédés en peu de temps → causerie défensive
 *   - CRUNCH_TIME          : minute ≥ 70 et écart ≤ 7 points → gestion de fin
 *
 * V0.3+ : moments générés à partir d'événements humains (mood, presse, blessure cadre…).
 */

import type { Player } from '../types.js';
import {
  SITUATION_LABEL,
  TONE_DESCRIPTION,
  TONE_LABEL,
  situationFor,
  toneHint,
  type DressingRoom,
  type TalkTone,
} from './team-talk.js';

// =============================================================================
// Types
// =============================================================================

export type LiveMomentType =
  | 'HALF_TIME'
  | 'PENALTY_DECISION'
  | 'FATIGUED_STAR'
  | 'DEFENSIVE_PRESSURE'
  | 'CRUNCH_TIME'
  | 'BENCH_CALL'
  | 'GOAL_LINE_STAND';

/** Effet d'un choix : modifications appliquées au moteur pour la suite du match. */
export interface MomentEffect {
  /** Bonus tactique sur l'attaque de l'équipe joueur (+/- 0..10), durée illimitée si pas de phasesRemaining. */
  readonly tacticalBonus?: number;
  /** Si défini, l'effet ne dure que N phases. */
  readonly phasesRemaining?: number;
  /** Modifie la fatigue immédiate (boost de motivation ou récupération). */
  readonly fatigueDelta?: number;
  /** Force un outcome immédiat (pour PENALTY_DECISION : choix tir au but vs pen-touche). */
  readonly forcePenaltyChoice?: 'POSTS' | 'TOUCH' | 'TAP';
  /** Force le remplacement d'un titulaire. */
  readonly substitutePlayerId?: string;
  /** V0.13 — enchaîne jusqu'à N remplacements automatiques (option "vider le banc"). */
  readonly emptyBenchCount?: number;
}

export interface LiveMomentOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly effect: MomentEffect;
  /** Rôle du staff qui pousse cette option (UI : voix qui parle). */
  readonly voiceStaffRole?: 'ENTRAINEUR_CHEF' | 'ADJOINT_AVANTS' | 'ADJOINT_TROIS_QUARTS' | 'MEDECIN' | 'PREPARATEUR_MENTAL' | 'ENTRAINEUR_SKILLS' | 'PRESIDENT';
}

export interface LiveMoment {
  readonly id: string;
  readonly type: LiveMomentType;
  /** Indice de la phase qui a déclenché le moment. */
  readonly atPhaseIndex: number;
  /** Minute simulée du déclenchement. */
  readonly minute: number;
  /** Texte affiché à l'utilisateur. */
  readonly prompt: string;
  /** Détail contextuel (ex : nom du joueur fatigué). */
  readonly context: string;
  /** Options disponibles (2-3). */
  readonly options: readonly LiveMomentOption[];
  /** Option choisie par défaut si pas d'interaction (calibration, batch). */
  readonly defaultOptionId: string;
}

// =============================================================================
// Constructeurs typés (factories)
// =============================================================================

/**
 * Causerie de mi-temps — V0.45.
 *
 * Remplace la bascule tactique d'origine (pousser / conserver / verrouiller),
 * qui proposait les mêmes trois options qu'on mène de trente points ou qu'on se
 * fasse démolir, sans un mot adressé au groupe.
 *
 * Les options sont désormais des **tons**, et chacun annonce comment il devrait
 * être reçu — sans chiffrer, car une causerie est un pari sur des hommes, pas
 * un calcul.
 */
export function makeTeamTalkMoment(
  phaseIndex: number,
  myScore: number,
  theirScore: number,
  room: DressingRoom,
): LiveMoment {
  const situation = situationFor(myScore - theirScore);
  const tones: readonly TalkTone[] = ['CALME', 'CONFIANCE', 'EXIGEANT', 'COUP_DE_GUEULE'];

  return {
    id: `team_talk_${phaseIndex}`,
    type: 'HALF_TIME',
    atPhaseIndex: phaseIndex,
    minute: 40,
    prompt: 'Causerie de mi-temps — que dites-vous au groupe ?',
    context: `${SITUATION_LABEL[situation]} : ${myScore}-${theirScore}. `
      + `Vestiaire à ${room.mood}/100 de moral.`,
    defaultOptionId: 'CALME',
    options: tones.map(tone => ({
      id: tone,
      label: TONE_LABEL[tone],
      description: `${TONE_DESCRIPTION[tone]} ${toneHint(tone, situation)}`,
      // L'effet réel est calculé à la résolution : il dépend du vestiaire et
      // d'un tirage. Le déclarer ici en ferait une valeur connue d'avance.
      effect: { phasesRemaining: 25 },
      voiceStaffRole: tone === 'COUP_DE_GUEULE' ? 'ADJOINT_AVANTS' : 'ENTRAINEUR_CHEF',
    })),
  };
}

export function makeHalfTimeMoment(phaseIndex: number, scoreHome: number, scoreAway: number): LiveMoment {
  const diff = scoreHome - scoreAway;
  const context =
    diff > 7 ? `Vous menez ${scoreHome}-${scoreAway} à la pause.` :
    diff < -7 ? `Vous êtes menés ${scoreHome}-${scoreAway} à la pause.` :
    `Score serré à la pause : ${scoreHome}-${scoreAway}.`;
  return {
    id: `half_time_${phaseIndex}`,
    type: 'HALF_TIME',
    atPhaseIndex: phaseIndex,
    minute: 40,
    prompt: 'Causerie de mi-temps — quelle orientation pour la 2e période ?',
    context,
    defaultOptionId: 'continuity',
    options: [
      {
        id: 'offensive',
        label: 'Pousser offensif',
        description: 'Mettre la pression dès la reprise. Bonus attaque mais fatigue accélérée.',
        effect: { tacticalBonus: 4, fatigueDelta: 5, phasesRemaining: 25 },
        voiceStaffRole: 'ADJOINT_TROIS_QUARTS',
      },
      {
        id: 'continuity',
        label: 'Conserver le plan',
        description: 'Continuer ce qui a marché en 1re période. Pas de bonus, pas de coût.',
        effect: {},
        voiceStaffRole: 'ENTRAINEUR_CHEF',
      },
      {
        id: 'defensive',
        label: 'Verrouiller',
        description: 'Solidifier la défense, jouer les phases. Bonus défense, attaque ralentie.',
        effect: { tacticalBonus: -2, fatigueDelta: -3, phasesRemaining: 25 },
        voiceStaffRole: 'ADJOINT_AVANTS',
      },
    ],
  };
}

export function makePenaltyDecisionMoment(
  phaseIndex: number,
  minute: number,
  fieldPosition: number,
  scoreDiff: number,
): LiveMoment {
  const distance = Math.max(15, 55 - fieldPosition);
  const tightScore = Math.abs(scoreDiff) <= 7;
  return {
    id: `pen_dec_${phaseIndex}`,
    type: 'PENALTY_DECISION',
    atPhaseIndex: phaseIndex,
    minute,
    prompt: `Pénalité à ${Math.round(distance)}m. Quelle décision ?`,
    context: tightScore
      ? 'Score serré — chaque point compte.'
      : 'La distance est limite pour un tir au but.',
    defaultOptionId: 'posts',
    options: [
      {
        id: 'posts',
        label: 'Tenter les poteaux',
        description: `Tir au but à ${Math.round(distance)}m. 3 points si réussi.`,
        effect: { forcePenaltyChoice: 'POSTS' },
        voiceStaffRole: 'PRESIDENT',
      },
      {
        id: 'touch',
        label: 'Pénal-touche',
        description: 'Touche dans les 22 adverses, jouer la conquête.',
        effect: { forcePenaltyChoice: 'TOUCH' },
        voiceStaffRole: 'ADJOINT_AVANTS',
      },
      {
        id: 'tap',
        label: 'Jouée vite',
        description: 'Surprendre la défense, jeu à la main immédiat.',
        effect: { forcePenaltyChoice: 'TAP' },
        voiceStaffRole: 'ADJOINT_TROIS_QUARTS',
      },
    ],
  };
}

export function makeFatiguedStarMoment(
  phaseIndex: number,
  minute: number,
  star: Player,
  fatigue: number,
  /** V0.13 — doublure qui entrerait effectivement (le banc est actif). */
  replacement?: Player,
): LiveMoment {
  const replacementName = replacement
    ? `${replacement.firstName} ${replacement.lastName}`
    : 'le banc';
  return {
    id: `fatigued_${star.id}_${phaseIndex}`,
    type: 'FATIGUED_STAR',
    atPhaseIndex: phaseIndex,
    minute,
    prompt: `${star.firstName} ${star.lastName} accuse le coup (fatigue ${Math.round(fatigue)}/100).`,
    context: `Décision : on sort le cadre pour ${replacementName}, ou on s'appuie encore sur son expérience ?`,
    defaultOptionId: 'keep',
    options: [
      {
        id: 'sub',
        label: replacement ? `Faire entrer ${replacement.lastName}` : 'Faire sortir',
        description: 'Le banc apporte de la fraîcheur, mais on perd un cadre.',
        effect: { substitutePlayerId: star.id },
        voiceStaffRole: 'MEDECIN',
      },
      {
        id: 'keep',
        label: 'Garder sur le terrain',
        description: 'Son expérience peut faire la différence, au risque d\'un trou défensif.',
        effect: { tacticalBonus: 1 },
        voiceStaffRole: 'ENTRAINEUR_CHEF',
      },
    ],
  };
}

export function makeDefensivePressureMoment(phaseIndex: number, minute: number, recentTriesAgainst: number): LiveMoment {
  return {
    id: `def_pressure_${phaseIndex}`,
    type: 'DEFENSIVE_PRESSURE',
    atPhaseIndex: phaseIndex,
    minute,
    prompt: `${recentTriesAgainst} essais encaissés en peu de temps. Time-out tactique ?`,
    context: 'L\'adversaire a trouvé la faille. Réajustement nécessaire.',
    defaultOptionId: 'tighten',
    options: [
      {
        id: 'tighten',
        label: 'Causerie défensive',
        description: 'Resserrer le rideau défensif. Bonus défense pendant 15 phases.',
        effect: { tacticalBonus: 3, phasesRemaining: 15 },
        voiceStaffRole: 'PREPARATEUR_MENTAL',
      },
      {
        id: 'aggressive',
        label: 'Monter en pression',
        description: 'Plaquage agressif, prise de risque sur le grattage. Risque de pénalité.',
        effect: { tacticalBonus: 5, fatigueDelta: 6, phasesRemaining: 12 },
        voiceStaffRole: 'ADJOINT_AVANTS',
      },
      {
        id: 'continue',
        label: 'Continuer comme ça',
        description: 'Faire confiance au plan, pas de réaction.',
        effect: {},
        voiceStaffRole: 'ENTRAINEUR_CHEF',
      },
    ],
  };
}

export function makeCrunchTimeMoment(
  phaseIndex: number,
  minute: number,
  scoreDiff: number,
): LiveMoment {
  const losing = scoreDiff < 0;
  const winning = scoreDiff > 0;
  return {
    id: `crunch_${phaseIndex}`,
    type: 'CRUNCH_TIME',
    atPhaseIndex: phaseIndex,
    minute,
    prompt: `${minute}' — ${winning ? `vous menez de ${scoreDiff} pts` : losing ? `${-scoreDiff} pts à remonter` : 'match nul'}. Plan de fin.`,
    context: 'Les dernières minutes vont décider du match.',
    defaultOptionId: 'continuity',
    options: [
      {
        id: 'allout',
        label: 'Pousser pour gagner',
        description: 'Tout en attaque, prendre des risques. Gros bonus offensif sur 10 phases.',
        effect: { tacticalBonus: 6, fatigueDelta: 8, phasesRemaining: 10 },
        voiceStaffRole: 'PRESIDENT',
      },
      {
        id: 'continuity',
        label: 'Continuer normalement',
        description: 'Pas de changement, on garde la dynamique.',
        effect: {},
        voiceStaffRole: 'ENTRAINEUR_CHEF',
      },
      {
        id: 'lockdown',
        label: 'Sécuriser',
        description: 'Conservation, jeu au pied, calmer la fin de match.',
        effect: { tacticalBonus: -1, phasesRemaining: 10 },
        voiceStaffRole: 'PREPARATEUR_MENTAL',
      },
    ],
  };
}

/**
 * V0.13 — l'heure de jeu : comment utiliser les finishers ?
 *
 * C'est la décision de banc structurante du rugby moderne : on lâche les avants
 * frais d'un coup (le "bomb squad"), on renouvelle la ligne de trois-quarts, ou
 * on garde ses cartouches pour le money time.
 */
export function makeBenchCallMoment(
  phaseIndex: number,
  minute: number,
  packFatigue: number,
  backsFatigue: number,
  benchSize: number,
): LiveMoment {
  const packWorse = packFatigue >= backsFatigue;
  const context =
    `Pack à ${Math.round(packFatigue)}/100, ligne arrière à ${Math.round(backsFatigue)}/100. ` +
    `${benchSize} joueurs disponibles sur le banc.`;
  return {
    id: `bench_call_${phaseIndex}`,
    type: 'BENCH_CALL',
    atPhaseIndex: phaseIndex,
    minute,
    prompt: `${minute}e minute — c'est le moment de lâcher les finishers.`,
    context,
    defaultOptionId: 'wait',
    options: [
      {
        id: 'empty_now',
        label: 'Vider le banc maintenant',
        description: 'Trois entrées d\'un coup. Fraîcheur immédiate, mais plus de cartouches ensuite.',
        effect: { emptyBenchCount: 3, tacticalBonus: 1, phasesRemaining: 20 },
        voiceStaffRole: packWorse ? 'ADJOINT_AVANTS' : 'ADJOINT_TROIS_QUARTS',
      },
      {
        id: 'one_change',
        label: 'Une entrée ciblée',
        description: 'On soulage le poste le plus émoussé sans casser les automatismes.',
        effect: { emptyBenchCount: 1 },
        voiceStaffRole: 'ENTRAINEUR_CHEF',
      },
      {
        id: 'wait',
        label: 'Garder les cartouches',
        description: 'On attend le money time. Les titulaires serrent les dents.',
        effect: { tacticalBonus: 2, phasesRemaining: 10 },
        voiceStaffRole: 'PREPARATEUR_MENTAL',
      },
    ],
  };
}

/**
 * V0.13 — le pilonnage à cinq mètres, vu des deux côtés.
 *
 * C'est le moment le plus tendu d'un match de rugby, et il n'existait pas dans le
 * moteur avant que `goal-line.ts` ne remplace l'essai automatique en zone rouge.
 * Le manager choisit ici entre serrer les dents et prendre un risque.
 */
export function makeGoalLineStandMoment(
  phaseIndex: number,
  minute: number,
  /** true si c'est le camp du joueur qui défend sa ligne. */
  defending: boolean,
  phasesAtLine: number,
  scoreDiff: number,
): LiveMoment {
  const temps = phasesAtLine + 1;

  if (defending) {
    const context = scoreDiff > 0
      ? `Vous menez de ${scoreDiff} points. Cet essai changerait le match.`
      : scoreDiff < 0
        ? `Vous êtes menés de ${Math.abs(scoreDiff)} points. Il faut absolument tenir.`
        : 'Score de parité. Tout se joue sur ce ballon.';
    return {
      id: `goal_line_stand_${phaseIndex}`,
      type: 'GOAL_LINE_STAND',
      atPhaseIndex: phaseIndex,
      minute,
      prompt: `${temps} temps de pilonnage sur votre ligne. Le rideau tient encore.`,
      context,
      defaultOptionId: 'hold',
      options: [
        {
          id: 'blitz',
          label: 'Monter en blitz',
          description: 'Étouffer le porteur avant qu\'il ne lance. Décisif si ça passe, fatal si on rate le plaquage.',
          effect: { tacticalBonus: 5, phasesRemaining: 5, fatigueDelta: 4 },
          voiceStaffRole: 'ADJOINT_TROIS_QUARTS',
        },
        {
          id: 'hold',
          label: 'Tenir le rideau',
          description: 'Plaquer bas, ne pas concéder de pénalité. On les laisse s\'épuiser.',
          effect: { tacticalBonus: 3, phasesRemaining: 9 },
          voiceStaffRole: 'ADJOINT_AVANTS',
        },
        {
          id: 'compete',
          label: 'Aller gratter',
          description: 'Envoyer les troisièmes lignes sur le ballon. Le grattage libère, la pénalité tue.',
          effect: { tacticalBonus: 4, phasesRemaining: 4, fatigueDelta: 2 },
          voiceStaffRole: 'ENTRAINEUR_CHEF',
        },
      ],
    };
  }

  return {
    id: `goal_line_siege_${phaseIndex}`,
    type: 'GOAL_LINE_STAND',
    atPhaseIndex: phaseIndex,
    minute,
    prompt: `${temps} temps à cinq mètres et la ligne ne cède pas.`,
    context: scoreDiff < 0
      ? `Menés de ${Math.abs(scoreDiff)} points : il faut cet essai.`
      : 'La défense adverse commence à reculer. Insister ou varier ?',
    defaultOptionId: 'pound',
    options: [
      {
        id: 'pound',
        label: 'Continuer à pilonner',
        description: 'Les avants au ras, temps après temps. Le rideau finira par craquer.',
        effect: { tacticalBonus: 4, phasesRemaining: 6, fatigueDelta: 3 },
        voiceStaffRole: 'ADJOINT_AVANTS',
      },
      {
        id: 'width',
        label: 'Écarter au large',
        description: 'Changer d\'aile pendant qu\'ils sont regroupés. Plus risqué, plus payant.',
        effect: { tacticalBonus: 2, phasesRemaining: 8 },
        voiceStaffRole: 'ADJOINT_TROIS_QUARTS',
      },
      {
        id: 'take_points',
        label: 'Prendre les points',
        description: 'À la prochaine pénalité, on tape entre les perches. Trois points valent mieux que rien.',
        effect: { forcePenaltyChoice: 'POSTS' },
        voiceStaffRole: 'PRESIDENT',
      },
    ],
  };
}
