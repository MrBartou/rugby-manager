/**
 * Les réactions du vestiaire — V0.53.
 *
 * Le jeu tient un graphe de quatre cent trente-cinq paires de relations depuis
 * la V0.4, et il pèse enfin sur le terrain depuis la V0.51. Mais il ne servait
 * **jamais** à faire réagir un groupe à ce qu'on fait à l'un des siens.
 *
 * `applySquadMoodDelta` n'était appelé qu'à deux endroits, tous deux liés à une
 * promesse trahie, et il appliquait le **même** delta à tout le monde. Vendre un
 * joueur apprécié, mettre un cadre hors projet, destituer le capitaine : personne
 * ne bronchait. L'effectif était trente individus isolés, jamais un groupe.
 *
 * ## Ce qui distingue ce module d'un malus collectif
 *
 * La réaction est **individuelle**. Celui qui perd un ami le vit mal ; celui qui
 * était en conflit avec le partant ne s'en émeut pas, et peut même y trouver son
 * compte. C'est exactement ce que le graphe de relations sait dire, et c'est la
 * première fois qu'on le lui demande.
 *
 * Un delta uniforme aurait été plus simple — et aurait rendu le graphe inutile
 * une fois de plus.
 */

import type { Player, PlayerId } from '../types.js';
import type { RelationsState } from './relationships.js';

// =============================================================================
// Ce qui secoue un vestiaire
// =============================================================================

export type RoomEvent =
  | 'VENDU'
  | 'MIS_A_L_ECART'
  | 'CAPITAINE_DESTITUE'
  | 'PROMESSE_TRAHIE';

/**
 * Gravité de base de chaque décision, avant relations.
 *
 * C'est ce que **tout le groupe** encaisse, indépendamment des affinités : une
 * décision brutale se sait, même de ceux qui ne fréquentaient pas l'intéressé.
 */
const BASE_DELTA: Readonly<Record<RoomEvent, number>> = {
  VENDU: -2,
  MIS_A_L_ECART: -2,
  CAPITAINE_DESTITUE: -3,
  PROMESSE_TRAHIE: -2,
};

export const EVENT_LABEL: Readonly<Record<RoomEvent, string>> = {
  VENDU: 'a été vendu',
  MIS_A_L_ECART: 'a été mis hors projet',
  CAPITAINE_DESTITUE: 'a perdu le brassard',
  PROMESSE_TRAHIE: 'n\'a pas eu ce qu\'on lui avait promis',
};

export interface RoomReaction {
  readonly playerId: PlayerId;
  readonly delta: number;
  readonly reason: string;
}

/** Seuils d'une vraie affinité et d'un vrai conflit — ceux du module de relations. */
const AFFINITY = 50;
const CONFLICT = -50;

/**
 * Ce que le groupe pense de ce qu'on vient de faire à l'un des siens.
 *
 * Trois cas, et c'est le graphe qui décide lequel s'applique :
 *
 *  - **un ami** prend la décision pour lui : il encaisse le double ;
 *  - **un rival** ne s'en émeut pas, et voit même une place se libérer : un
 *    petit gain, jamais une fête ;
 *  - **les autres** encaissent la gravité de base.
 *
 * Le poids d'un homme compte aussi : perdre un joueur que tout le monde suivait
 * n'a rien à voir avec le départ d'un remplaçant. On le mesure au nombre
 * d'affinités qu'il laisse derrière lui.
 */
export function roomReaction(input: {
  readonly subject: Player;
  /** Les coéquipiers restants. Le sujet lui-même n'y figure pas. */
  readonly squad: readonly Player[];
  readonly event: RoomEvent;
  readonly relations?: RelationsState;
}): readonly RoomReaction[] {
  const others = input.squad.filter(p => p.id !== input.subject.id);
  if (others.length === 0) return [];

  const base = BASE_DELTA[input.event];
  const links = linksOf(input.subject.id, input.relations);

  // Un homme entouré pèse plus lourd que le même homme isolé : jusqu'à moitié
  // plus, pas davantage — un vestiaire encaisse, il ne s'effondre pas.
  const standing = 1 + Math.min(0.5, links.friends.size * 0.08);

  const out: RoomReaction[] = [];
  for (const p of others) {
    if (links.friends.has(p.id)) {
      out.push({
        playerId: p.id,
        delta: Math.round(base * 2 * standing),
        reason: `${input.subject.lastName} ${EVENT_LABEL[input.event]} — il en était proche`,
      });
      continue;
    }
    if (links.rivals.has(p.id)) {
      // Il ne s'en réjouit pas ouvertement, mais une place se libère.
      out.push({
        playerId: p.id,
        delta: 1,
        reason: `${input.subject.lastName} ${EVENT_LABEL[input.event]} — il ne s'en plaindra pas`,
      });
      continue;
    }
    out.push({
      playerId: p.id,
      delta: Math.round(base * standing),
      reason: `${input.subject.lastName} ${EVENT_LABEL[input.event]}`,
    });
  }
  return out;
}

/** Amis et rivaux d'un joueur, au sens du graphe. */
function linksOf(
  playerId: PlayerId,
  relations: RelationsState | undefined,
): { readonly friends: Set<PlayerId>; readonly rivals: Set<PlayerId> } {
  const friends = new Set<PlayerId>();
  const rivals = new Set<PlayerId>();
  if (relations === undefined) return { friends, rivals };

  for (const r of relations.byPair.values()) {
    const other = r.fromId === playerId ? r.toId : r.toId === playerId ? r.fromId : undefined;
    if (other === undefined) continue;
    if (r.score >= AFFINITY) friends.add(other);
    else if (r.score <= CONFLICT) rivals.add(other);
  }
  return { friends, rivals };
}

/**
 * ## Ce que ce module a fait découvrir
 *
 * En le vérifiant en jeu, on s'est aperçu que ses réactions étaient
 * **invisibles** : elles déplaçaient `player.dynamic.mood`, que le moteur lit,
 * alors que l'écran d'effectif affichait un tout autre nombre, recalculé à la
 * volée par `computeMood()`. Le jeu portait deux morals qui ne communiquaient
 * pas.
 *
 * La V0.54 les a réunifiés : `dynamic.mood` est désormais le **résultat** des
 * sept sources plus les événements datés, et les réactions ci-dessus passent par
 * `pushMoodEvent`. Le manager voit donc exactement ce que le moteur lit.
 */

/**
 * Ce que le staff rapporte au manager.
 *
 * On ne liste pas trente réactions : on dit ce qui compte, c'est-à-dire s'il y
 * a des hommes que la décision a vraiment touchés.
 */
export function reactionSummary(
  subject: Player,
  reactions: readonly RoomReaction[],
): string {
  const touchés = reactions.filter(r => r.delta <= -4).length;
  if (touchés === 0) {
    return `Le vestiaire encaisse le départ de ${subject.lastName} sans broncher.`;
  }
  if (touchés === 1) {
    return `Un joueur vit très mal le sort de ${subject.lastName}.`;
  }
  return `${touchés} joueurs vivent très mal le sort de ${subject.lastName}.`;
}
