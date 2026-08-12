/**
 * Parler à ses joueurs — V0.48.
 *
 * Le jeu porte un système humain considérable : moral à sept sources, trente
 * traits, quatre cent trente-cinq paires de relations, un détecteur
 * d'événements. Tout cela **arrivait** au manager sous forme de modales. La
 * fiche d'un joueur ne contenait que des boutons de navigation : impossible
 * d'aller voir quelqu'un et de lui dire quoi que ce soit.
 *
 * Le dernier grand système où l'on était spectateur.
 *
 * ## Ce qui rend une conversation risquée
 *
 * Rien, si elle ne fait que donner du moral — ce serait un bouton à cliquer
 * chaque semaine. Deux mécanismes l'en empêchent :
 *
 *  - **le tempérament** : un rancunier n'encaisse pas un recadrage comme un
 *    professionnel, un satisfait ne s'enflamme pas d'une promesse ;
 *  - **la promesse**, surtout. Promettre du temps de jeu engage sur des
 *    journées à venir. Tenue, elle vaut bien plus qu'un compliment ; trahie,
 *    elle coûte bien plus que le silence.
 *
 * C'est cette asymétrie qui fait qu'on hésite avant de promettre — et c'est
 * tout l'intérêt.
 */

import type { Rng } from '../rng.js';
import type { Player } from '../types.js';

// =============================================================================
// Les sujets
// =============================================================================

export type TalkTopic =
  | 'FELICITER'
  | 'RECADRER'
  | 'RASSURER_ROLE'
  | 'PROMETTRE_TEMPS_DE_JEU'
  | 'DEMANDER_EFFORT';

export const TOPIC_LABEL: Readonly<Record<TalkTopic, string>> = {
  FELICITER: 'Le féliciter',
  RECADRER: 'Le recadrer',
  RASSURER_ROLE: 'Le rassurer sur son rôle',
  PROMETTRE_TEMPS_DE_JEU: 'Lui promettre du temps de jeu',
  DEMANDER_EFFORT: 'Lui demander un effort',
};

export const TOPIC_DESCRIPTION: Readonly<Record<TalkTopic, string>> = {
  FELICITER: 'Reconnaître ce qu\'il fait. Sans effet s\'il ne le mérite pas.',
  RECADRER: 'Nommer ce qui ne va pas. Dur à entendre, utile quand c\'est juste.',
  RASSURER_ROLE: 'Lui dire où il se situe dans la hiérarchie.',
  PROMETTRE_TEMPS_DE_JEU: 'Un engagement sur les prochaines journées. Tenu ou trahi.',
  DEMANDER_EFFORT: 'Exiger davantage à l\'entraînement, sans hausser le ton.',
};

// =============================================================================
// Le contexte du joueur
// =============================================================================

export interface TalkContext {
  /** Part des matchs disputés, 0-1. */
  readonly playRatio: number;
  /** Forme actuelle, 0-100. */
  readonly forme: number;
  /** Moral actuel, 0-100. */
  readonly mood: number;
  /** Journée courante, pour dater la promesse. */
  readonly currentRound: number;
}

/**
 * Justesse d'un sujet, de -2 à +2.
 *
 * Une table plutôt qu'une formule : chaque case se raisonne. Féliciter un
 * joueur qui ne joue pas et qui est en méforme, c'est du vent ; le recadrer
 * alors qu'il est excellent, c'est une injustice.
 */
export function topicFit(topic: TalkTopic, ctx: TalkContext): number {
  const performing = ctx.forme >= 62;
  const playing = ctx.playRatio >= 0.5;
  const lowMood = ctx.mood < 45;

  switch (topic) {
    case 'FELICITER':
      // Ne vaut que si le compliment correspond à quelque chose.
      return performing && playing ? 2 : performing ? 1 : -1;
    case 'RECADRER':
      // Juste quand il déçoit tout en jouant ; injuste sinon.
      return !performing && playing ? 2 : !performing ? 0 : -2;
    case 'RASSURER_ROLE':
      // Le sujet d'un joueur qui doute : peu de temps de jeu ou moral bas.
      return !playing || lowMood ? 2 : 0;
    case 'PROMETTRE_TEMPS_DE_JEU':
      // On ne promet du temps de jeu qu'à celui qui n'en a pas.
      return !playing ? 1 : -1;
    case 'DEMANDER_EFFORT':
      return !performing ? 1 : 0;
  }
}

// =============================================================================
// Le tempérament
// =============================================================================

/**
 * Sensibilité d'un joueur au sujet abordé, en multiplicateur.
 *
 * C'est là que les trente traits cessent d'être décoratifs : ils décident de
 * qui encaisse un recadrage et de qui s'en souvient.
 */
export function temperament(player: Player, topic: TalkTopic): {
  readonly amplitude: number;
  readonly backfireBias: number;
} {
  const has = (id: string): boolean => player.traits.some(t => t === id);

  let amplitude = 1;
  let backfireBias = 0;

  if (has('fragile_mental')) amplitude += 0.5;
  if (has('sang_froid')) amplitude -= 0.3;
  if (has('professionnel')) backfireBias -= 0.06;
  if (has('satisfait')) amplitude -= 0.35;
  if (has('ambitieux')) amplitude += 0.25;

  if (topic === 'RECADRER') {
    if (has('rancunier')) backfireBias += 0.22;
    if (has('hothead')) backfireBias += 0.18;
    if (has('professionnel')) backfireBias -= 0.10;
  }
  if (topic === 'FELICITER' && has('solitaire')) amplitude -= 0.3;
  if (topic === 'PROMETTRE_TEMPS_DE_JEU' && has('mercenaire')) backfireBias += 0.10;
  if (topic === 'RASSURER_ROLE' && has('attache_club')) amplitude += 0.2;

  return {
    amplitude: Math.max(0.3, amplitude),
    backfireBias: Math.max(-0.2, backfireBias),
  };
}

// =============================================================================
// Les promesses
// =============================================================================

/**
 * Engagement pris devant un joueur.
 *
 * C'est la seule chose de ce module qui **survit** à la conversation, et c'est
 * ce qui fait qu'on hésite avant de parler.
 */
export interface PlayerPromise {
  readonly playerId: Player['id'];
  readonly playerName: string;
  readonly kind: 'TEMPS_DE_JEU';
  readonly madeAtRound: number;
  /** Journée à laquelle on fait les comptes. */
  readonly dueAtRound: number;
  /** Part de matchs à disputer d'ici l'échéance pour que la promesse tienne. */
  readonly targetRatio: number;
}

/** Délai laissé pour tenir une promesse de temps de jeu. */
export const PROMISE_HORIZON = 6;
export const PROMISE_TARGET_RATIO = 0.5;

export function makePromise(player: Player, ctx: TalkContext): PlayerPromise {
  return {
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    kind: 'TEMPS_DE_JEU',
    madeAtRound: ctx.currentRound,
    dueAtRound: ctx.currentRound + PROMISE_HORIZON,
    targetRatio: PROMISE_TARGET_RATIO,
  };
}

export type PromiseVerdict = 'EN_COURS' | 'TENUE' | 'TRAHIE';

export function judgePromise(
  promise: PlayerPromise,
  matchesPlayedSince: number,
  currentRound: number,
): PromiseVerdict {
  const elapsed = currentRound - promise.madeAtRound;
  const ratio = elapsed > 0 ? matchesPlayedSince / elapsed : 0;
  if (ratio >= promise.targetRatio) return 'TENUE';
  if (currentRound < promise.dueAtRound) return 'EN_COURS';
  return 'TRAHIE';
}

/**
 * Ce que vaut une promesse à son échéance.
 *
 * Volontairement asymétrique : trahir coûte plus du double de ce que tenir
 * rapporte. Sans cela, promettre à tout le monde serait un pari gagnant.
 *
 * V0.49 — une trahison peut désormais aller plus loin que le moral : le joueur
 * demande à partir, et le vestiaire en parle. Sans cette suite, la promesse
 * restait une variation de jauge qu'on encaissait en haussant les épaules.
 */
export function promiseOutcome(verdict: PromiseVerdict): {
  readonly moodDelta: number;
  readonly narrative: string;
} {
  if (verdict === 'TENUE') {
    return {
      moodDelta: 12,
      narrative: 'Vous aviez promis du temps de jeu, il l\'a eu. Il ne l\'oubliera pas.',
    };
  }
  return {
    moodDelta: -28,
    narrative: 'Vous aviez promis du temps de jeu. Il ne l\'a pas vu venir, et il le sait.',
  };
}

// =============================================================================
// Ce qu'une trahison déclenche
// =============================================================================

export interface BetrayalFallout {
  /** Le joueur demande officiellement à quitter le club. */
  readonly transferRequest: boolean;
  /** Effet sur le moral des coéquipiers qui ont vu la scène. */
  readonly dressingRoomDelta: number;
  readonly narrative: string;
}

/**
 * Suites d'une promesse trahie.
 *
 * Tout le monde ne claque pas la porte : un joueur loyal ou attaché au club
 * encaisse, un ambitieux ou un mercenaire s'en va. C'est le tempérament qui
 * décide, comme pour la conversation elle-même.
 *
 * Le vestiaire, lui, prend toujours un peu : une parole non tenue se sait, et
 * c'est ce qui empêche de multiplier les promesses en pariant sur le fait
 * qu'aucune ne se retournera vraiment.
 */
export function betrayalFallout(input: {
  readonly player: Player;
  readonly rng: Rng;
}): BetrayalFallout {
  const { player, rng } = input;
  const has = (id: string): boolean => player.traits.some(t => t === id);

  let risk = 0.30;
  if (has('ambitieux')) risk += 0.20;
  if (has('mercenaire')) risk += 0.25;
  if (has('rancunier')) risk += 0.15;
  if (has('attache_club')) risk -= 0.22;
  if (has('loyal')) risk -= 0.25;
  if (has('professionnel')) risk -= 0.10;

  const transferRequest = rng.nextBool(Math.max(0.02, Math.min(0.9, risk)));

  return {
    transferRequest,
    // Une parole non tenue se sait, qu'elle fasse partir ou non.
    dressingRoomDelta: transferRequest ? -4 : -2,
    narrative: transferRequest
      ? `${player.firstName} ${player.lastName} demande à quitter le club. Le vestiaire a suivi l'affaire.`
      : `${player.firstName} ${player.lastName} encaisse sans rien dire. Le vestiaire, lui, a remarqué.`,
  };
}

// =============================================================================
// La demande de transfert
// =============================================================================

/**
 * Demande de départ posée sur la table du manager.
 *
 * Elle survit à la journée où elle a été faite : tant qu'on n'a pas tranché,
 * elle reste ouverte. C'est ce qui la distingue d'une simple notification.
 */
export interface TransferRequest {
  readonly playerId: Player['id'];
  readonly playerName: string;
  readonly madeAtRound: number;
  readonly season: number;
  /** `SUR_LA_LISTE` une fois la demande acceptée : les clubs peuvent venir. */
  readonly status: 'EN_ATTENTE' | 'SUR_LA_LISTE';
}

export type RequestDecision = 'ACCEPTER' | 'RETENIR';

export interface RequestResolution {
  readonly playerMoodDelta: number;
  readonly dressingRoomDelta: number;
  /** Le joueur passe sur la liste des transferts. */
  readonly listed: boolean;
  readonly narrative: string;
}

/**
 * Ce que coûte la réponse du manager.
 *
 * Les deux options doivent être défendables, sinon le choix n'en est pas un :
 * accepter apaise le joueur mais ouvre la porte à des offres sur un cadre ;
 * le retenir garde l'effectif intact mais laisse un homme aigri dans un
 * vestiaire qui a tout suivi.
 */
export function resolveTransferRequest(decision: RequestDecision): RequestResolution {
  if (decision === 'ACCEPTER') {
    return {
      playerMoodDelta: 10,
      dressingRoomDelta: 0,
      listed: true,
      narrative: 'Il est sur la liste des transferts. Les clubs intéressés peuvent se manifester.',
    };
  }
  return {
    playerMoodDelta: -12,
    dressingRoomDelta: -3,
    listed: false,
    narrative: 'Vous le retenez contre son gré. Il reste, et tout le monde le sait.',
  };
}

// =============================================================================
// Résolution
// =============================================================================

export interface PlayerTalkOutcome {
  readonly topic: TalkTopic;
  readonly moodDelta: number;
  readonly backfired: boolean;
  readonly narrative: string;
  /** Engagement pris, à suivre jusqu'à son échéance. */
  readonly promise?: PlayerPromise;
}

export function resolvePlayerTalk(input: {
  readonly player: Player;
  readonly topic: TalkTopic;
  readonly context: TalkContext;
  readonly rng: Rng;
}): PlayerTalkOutcome {
  const { player, topic, context, rng } = input;
  const fit = topicFit(topic, context);
  const temper = temperament(player, topic);

  // Un joueur au moral bas prend mal ce qui est mal amené : c'est précisément
  // quand on a le plus besoin de lui parler qu'on risque le plus.
  const fragility = 1 + Math.max(0, (50 - context.mood) / 100);
  const backfireRisk = fit >= 1
    ? Math.max(0, 0.04 + temper.backfireBias)
    : Math.min(0.7, (1 - fit) * 0.16 * fragility + temper.backfireBias);

  if (rng.nextBool(backfireRisk)) {
    const severity = topic === 'RECADRER' ? 2 : 1;
    return {
      topic,
      moodDelta: Math.round(-6 * severity * temper.amplitude),
      backfired: true,
      narrative: backfireNarrative(topic),
    };
  }

  const moodDelta = Math.round((2 + fit * 3) * temper.amplitude);
  const promise = topic === 'PROMETTRE_TEMPS_DE_JEU'
    ? makePromise(player, context)
    : undefined;

  return {
    topic,
    moodDelta,
    backfired: false,
    narrative: successNarrative(topic, fit),
    ...(promise ? { promise } : {}),
  };
}

function successNarrative(topic: TalkTopic, fit: number): string {
  if (topic === 'PROMETTRE_TEMPS_DE_JEU') {
    return 'Il vous prend au mot. À vous de tenir parole dans les prochaines journées.';
  }
  if (fit >= 2) {
    return topic === 'RECADRER'
      ? 'Il encaisse sans broncher. Le message était mérité, il le sait.'
      : 'Le message tombe juste. Il repart avec autre chose dans le regard.';
  }
  if (fit >= 1) return 'Il écoute, hoche la tête. Ça ne fera pas de mal.';
  return 'Il vous écoute poliment. Rien ne semble bouger.';
}

function backfireNarrative(topic: TalkTopic): string {
  switch (topic) {
    case 'RECADRER': return 'Il se braque. Ce n\'était pas le moment, et il ne s\'en cache pas.';
    case 'FELICITER': return 'Il prend le compliment pour de la condescendance.';
    case 'RASSURER_ROLE': return 'Il n\'y croit pas une seconde.';
    case 'PROMETTRE_TEMPS_DE_JEU': return 'Il a déjà entendu ça. Il attend de voir.';
    case 'DEMANDER_EFFORT': return 'Il estime en faire déjà assez, et le fait savoir.';
  }
}

/**
 * Ce qu'on annonce avant de parler.
 *
 * On qualifie sans chiffrer, comme pour la causerie : une conversation est un
 * pari sur quelqu'un, pas un calcul de rendement.
 */
export function topicHint(topic: TalkTopic, ctx: TalkContext): string {
  const fit = topicFit(topic, ctx);
  if (topic === 'PROMETTRE_TEMPS_DE_JEU' && fit >= 1) {
    return 'Il en a besoin — mais vous vous engagez sur six journées.';
  }
  if (fit >= 2) return 'Le moment s\'y prête.';
  if (fit === 1) return 'Devrait bien passer.';
  if (fit === 0) return 'Réaction incertaine.';
  if (fit === -1) return 'Mal choisi dans sa situation.';
  return 'Il le prendrait très mal.';
}
