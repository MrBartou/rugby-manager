/**
 * Fils humains — V0.5.
 *
 * Référence : 02-gdd.md (3-5 fils humains actifs en permanence) + 10-ui-ux.md
 * (Dashboard montre des cartes cliquables : "Dupont demande à parler", etc.).
 *
 * Un fil humain est une accroche narrative cliquable affichée sur le Dashboard.
 * Catégories :
 *   - PENDING_EVENT  : un event humain est en attente de décision
 *   - CONFLICT       : deux joueurs en conflit ouvert (relation ≤ -50)
 *   - LOW_MOOD       : un cadre a un mood < 35
 *   - MENTOR         : binôme mentor/élève actif (relation ≥ 50, types MENTOR)
 *   - HOT_FORM       : un joueur est en pleine forme (mood ≥ 80)
 */

import type { Player, PlayerId } from '../types.js';
import type { RelationsState } from './relationships.js';
import { computeMood } from './mood.js';
import { computeRelationsForMood } from './relationships.js';
import type { HumanEvent } from './events.js';

export type ThreadKind = 'PENDING_EVENT' | 'CONFLICT' | 'LOW_MOOD' | 'MENTOR' | 'HOT_FORM' | 'CONTRACT_EXPIRING' | 'INJURY_LIST';

export interface HumanThread {
  readonly id: string;
  readonly kind: ThreadKind;
  /** Titre court à afficher en gras sur la carte. */
  readonly title: string;
  /** Phrase contextuelle. */
  readonly context: string;
  /** Joueurs concernés (utile pour navigation vers fiche). */
  readonly playerIds: readonly PlayerId[];
  /** Event en attente (si kind === PENDING_EVENT). */
  readonly relatedEvent?: HumanEvent;
  /** Tone visuel : positive (vert), tension (jaune), conflict (rouge), neutral (bleu). */
  readonly tone: 'positive' | 'tension' | 'conflict' | 'neutral';
  /** Score de priorité pour l'ordre d'affichage. */
  readonly priority: number;
}

export interface ThreadDetectionInputs {
  readonly clubPlayers: readonly Player[];
  readonly relations: RelationsState;
  readonly recentResults: readonly (-1 | 0 | 1)[];
  readonly currentSeason: number;
  readonly playRatioByPlayer: ReadonlyMap<string, number>;
  readonly pendingEvents: readonly HumanEvent[];
  readonly moodDeltasByPlayer: ReadonlyMap<PlayerId, number>;
}

function moodOfPlayer(p: Player, inputs: ThreadDetectionInputs): number {
  const playRatio = inputs.playRatioByPlayer.get(p.id as string) ?? 0.5;
  const relationsFactors = computeRelationsForMood(inputs.relations, p.id);
  const { mood } = computeMood({
    player: p,
    recentResults: inputs.recentResults,
    playRatio,
    currentSeason: inputs.currentSeason,
    relationsFactors,
  });
  // Ajout du delta d'event résolu (positif ou négatif)
  const eventDelta = inputs.moodDeltasByPlayer.get(p.id) ?? 0;
  return Math.max(0, Math.min(100, mood + eventDelta));
}

function ageFromBirthDate(birthDate: string, currentSeason: number): number {
  return currentSeason - parseInt(birthDate.slice(0, 4), 10);
}

/** Détecte 3-5 fils humains pertinents à afficher sur le Dashboard. */
export function detectHumanThreads(inputs: ThreadDetectionInputs): readonly HumanThread[] {
  const threads: HumanThread[] = [];
  const playersById = new Map(inputs.clubPlayers.map(p => [p.id, p] as const));

  // 1. PENDING_EVENT — top priorité
  for (const event of inputs.pendingEvents.slice(0, 3)) {
    const involved = event.involvedPlayerIds
      .map(id => playersById.get(id)?.lastName ?? '')
      .filter(Boolean)
      .join(', ');
    threads.push({
      id: `thread_event_${event.id}`,
      kind: 'PENDING_EVENT',
      title: event.title,
      context: involved ? `${event.context} — ${involved}` : event.context,
      playerIds: event.involvedPlayerIds,
      relatedEvent: event,
      tone: event.type === 'CONFLIT_VESTIAIRE' ? 'conflict' :
            event.type === 'PRESSE_NEGATIVE' ? 'tension' :
            event.type === 'MENTOR_PROPOSE' ? 'positive' : 'neutral',
      priority: 100,
    });
  }

  // 2. CONFLICT — relations ≤ -50
  const sortedConflicts = [...inputs.relations.byPair.values()]
    .filter(r => r.score <= -50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);
  for (const r of sortedConflicts) {
    const a = playersById.get(r.fromId);
    const b = playersById.get(r.toId);
    if (!a || !b) continue;
    threads.push({
      id: `thread_conflict_${r.fromId}_${r.toId}`,
      kind: 'CONFLICT',
      title: `Tension ${a.lastName} / ${b.lastName}`,
      context: `Leur relation est à ${r.score}. À surveiller.`,
      playerIds: [r.fromId, r.toId],
      tone: 'conflict',
      priority: 80 + Math.min(20, Math.abs(r.score + 50)),
    });
  }

  // 3. LOW_MOOD — cadre avec mood < 35
  const moodEntries = inputs.clubPlayers.map(p => ({ player: p, mood: moodOfPlayer(p, inputs) }));
  const lowMood = moodEntries
    .filter(e => e.mood < 35)
    .sort((a, b) => a.mood - b.mood)
    .slice(0, 2);
  for (const { player, mood } of lowMood) {
    threads.push({
      id: `thread_lowmood_${player.id}`,
      kind: 'LOW_MOOD',
      title: `${player.firstName} ${player.lastName} en difficulté`,
      context: `Mood ${mood}/100. Mérite une discussion.`,
      playerIds: [player.id],
      tone: 'tension',
      priority: 70 - mood,
    });
  }

  // 4. MENTOR — binôme actif (cadre + jeune avec relation ≥ 50 et différence d'âge)
  const mentorBonds = [...inputs.relations.byPair.values()]
    .filter(r => r.score >= 50)
    .map(r => {
      const a = playersById.get(r.fromId);
      const b = playersById.get(r.toId);
      if (!a || !b) return undefined;
      const ageA = ageFromBirthDate(a.birthDate, inputs.currentSeason);
      const ageB = ageFromBirthDate(b.birthDate, inputs.currentSeason);
      const ageGap = Math.abs(ageA - ageB);
      if (ageGap < 6) return undefined;
      const mentor = ageA > ageB ? a : b;
      const young = ageA > ageB ? b : a;
      return { mentor, young, score: r.score };
    })
    .filter((x): x is { mentor: Player; young: Player; score: number } => x !== undefined)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
  for (const { mentor, young } of mentorBonds) {
    threads.push({
      id: `thread_mentor_${mentor.id}_${young.id}`,
      kind: 'MENTOR',
      title: `${mentor.lastName} encadre ${young.lastName}`,
      context: `Le binôme fonctionne : transmission active.`,
      playerIds: [mentor.id, young.id],
      tone: 'positive',
      priority: 50,
    });
  }

  // 5. HOT_FORM — joueur en pleine bourre (mood ≥ 80)
  const hotForm = moodEntries
    .filter(e => e.mood >= 80)
    .sort((a, b) => b.mood - a.mood)
    .slice(0, 1);
  for (const { player, mood } of hotForm) {
    threads.push({
      id: `thread_hot_${player.id}`,
      kind: 'HOT_FORM',
      title: `${player.firstName} ${player.lastName} au top`,
      context: `Mood ${mood}/100, à exploiter ce week-end.`,
      playerIds: [player.id],
      tone: 'positive',
      priority: 40 + (mood - 80),
    });
  }

  // V0.7 : INJURY_LIST — affiche un fil si ≥ 2 blessés actifs dans le club
  const injured = inputs.clubPlayers.filter(p => p.dynamic.injury);
  if (injured.length >= 2) {
    threads.push({
      id: `thread_injuries`,
      kind: 'INJURY_LIST',
      title: `${injured.length} blessés à l'infirmerie`,
      context: `${injured.slice(0, 3).map(p => p.lastName).join(', ')}${injured.length > 3 ? '…' : ''}`,
      playerIds: injured.map(p => p.id),
      tone: 'tension',
      priority: 70,
    });
  }

  // 6. CONTRACT_EXPIRING — V0.6 : cadre en dernière année de contrat (priorité au plus haut niveau)
  const expiringSoon = inputs.clubPlayers
    .filter(p => !p.retired && !p.freeAgent && p.contract.endSeason === inputs.currentSeason)
    .sort((a, b) => approximateOverall(b) - approximateOverall(a))
    .slice(0, 1);
  for (const p of expiringSoon) {
    threads.push({
      id: `thread_expiring_${p.id}`,
      kind: 'CONTRACT_EXPIRING',
      title: `${p.firstName} ${p.lastName} en fin de contrat`,
      context: 'Décision attendue avant la fin de saison.',
      playerIds: [p.id],
      tone: 'tension',
      priority: 65,
    });
  }

  // Tri par priorité décroissante, max 5
  threads.sort((a, b) => b.priority - a.priority);
  return threads.slice(0, 5);
}

function approximateOverall(p: Player): number {
  const t = p.technical, ph = p.physical, m = p.mental;
  const techAvg = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const physAvg = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const mentAvg = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (techAvg + physAvg + mentAvg) / 3;
}
