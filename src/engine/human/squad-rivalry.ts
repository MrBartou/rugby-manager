/**
 * Les rivalités de vestiaire — V0.56.
 *
 * `RelationType` connaît `RIVAL` depuis la V0.4, mais le jeu ne l'a **jamais
 * produit** : le type se déduit d'un score déjà bas, et rien n'a jamais fait
 * baisser un score pour cette raison-là. Deux joueurs qui se disputent le même
 * maillot pendant six mois restaient parfaitement cordiaux.
 *
 * Or tout est en place depuis peu pour que cette tension existe :
 *
 *  - la **hiérarchie déclarée** (V0.50) dit ce que chacun croit avoir obtenu ;
 *  - le **temps de jeu** dit qui prend réellement la place de qui ;
 *  - et la **cohésion** pèse sur le terrain depuis la V0.51 — un vestiaire
 *    divisé lâche des ballons.
 *
 * Il ne manquait que ce qui relie les trois.
 *
 * ## Ce qui crée une rivalité, et ce qui n'en crée pas
 *
 * Pas la concurrence en elle-même : deux ouvreurs qui se partagent la saison
 * moitié-moitié n'ont aucune raison de se détester. Ce qui tend une relation,
 * c'est **le déséquilibre** — l'un joue, l'autre regarde, et ils occupent le
 * même poste.
 *
 * Et surtout : ce qu'on lui avait **dit**. Un espoir laissé sur le banc derrière
 * un international ne s'estime pas volé, c'est exactement ce qu'on lui a annoncé.
 * Un cadre à qui on a promis le maillot et qui regarde un autre le porter, si.
 * La hiérarchie déclarée devient donc un vrai outil de vestiaire : nommer un
 * jeune « espoir » désamorce d'avance la rivalité que sa mise à l'écart aurait
 * créée — au prix d'avoir à le lui dire en face.
 *
 * Le tempérament fait le reste : un ambitieux vit mal d'être derrière, un
 * satisfait s'en accommode, un mentor prend le jeune sous son aile au lieu de le
 * voir comme une menace.
 */

import type { Player, PlayerId, Position } from '../types.js';
import { DEFAULT_STATUS, type SquadStatus } from '../club/squad-status.js';
import { getRelation, updateRelationScore, type RelationsState } from './relationships.js';

// =============================================================================
// Qui se dispute quoi
// =============================================================================

/**
 * Postes qui se disputent réellement le même maillot.
 *
 * Un pilier gauche et un talonneur ne se concurrencent pas ; deux deuxièmes
 * lignes, si. On regroupe donc par poste interchangeable, sans quoi une équipe
 * entière serait en rivalité avec elle-même — et sans quoi, à l'inverse, deux
 * ailiers numérotés 11 et 14 ne se disputeraient jamais rien.
 */
function shirtOf(position: Position): string {
  switch (position) {
    case 'PILIER_GAUCHE': case 'PILIER_DROIT': return 'PILIER';
    case 'DEUXIEME_LIGNE_GAUCHE': case 'DEUXIEME_LIGNE_DROITE': return 'DEUXIEME_LIGNE';
    case 'TROISIEME_LIGNE_AILE_GAUCHE': case 'TROISIEME_LIGNE_AILE_DROITE':
      return 'TROISIEME_LIGNE_AILE';
    case 'CENTRE_INTERIEUR': case 'CENTRE_EXTERIEUR': return 'CENTRE';
    case 'AILIER_GAUCHE': case 'AILIER_DROIT': return 'AILIER';
    default: return position;
  }
}

export interface RivalryInput {
  readonly roster: readonly Player[];
  /** Part de matchs disputés depuis le début de la saison, par joueur. */
  readonly playRatio: ReadonlyMap<PlayerId, number>;
  /** Hiérarchie annoncée par le manager (V0.50). */
  readonly statuses?: ReadonlyMap<PlayerId, SquadStatus>;
}

export interface RivalryTension {
  /** Celui qui subit — c'est lui qui rumine. */
  readonly frustrated: PlayerId;
  /** Celui qui lui passe devant. */
  readonly ahead: PlayerId;
  /** Variation de relation à appliquer, toujours strictement négative. */
  readonly delta: number;
  readonly reason: string;
}

/**
 * Écart de temps de jeu en dessous duquel personne ne s'offusque.
 *
 * Deux joueurs qui se partagent le poste moitié-moitié n'ont aucune raison de
 * se détester : c'est une rotation, pas une injustice.
 */
export const TOLERANCE = 0.25;

/**
 * Tension maximale par journée, avant tempérament.
 *
 * Trois points paraissent peu, et c'est voulu : une rivalité se construit sur
 * une saison, pas sur un match. Mesuré en jeu, l'éventail va de un point par
 * journée pour un remplaçant qui gratte des bouts de match, à quatre pour un
 * cadre déclaré qui ne joue jamais — celui-là passe en conflit ouvert en une
 * poignée de journées, et c'est mérité : on lui avait promis le maillot.
 *
 * C'est le rythme qu'on veut dans les deux cas : assez lent pour que le manager
 * puisse corriger le tir, assez sûr pour qu'ignorer le problème se paie.
 */
const MAX_PER_ROUND = 3;

/**
 * À quel point le joueur s'estime lésé, selon ce qu'on lui a annoncé.
 *
 * C'est la pièce qui rend la hiérarchie de la V0.50 utile au-delà du moral
 * individuel : elle décide aussi de la paix du vestiaire.
 */
const ENTITLEMENT: Readonly<Record<SquadStatus, number>> = {
  CADRE: 1.3,
  ROTATION: 1,
  // On lui a dit qu'il apprenait. Être derrière est le programme, pas un affront.
  ESPOIR: 0.35,
  // Il sait qu'il ne compte pas : sa rancune vise le club, pas son concurrent.
  HORS_PROJET: 0.5,
};

/**
 * Sensibilité personnelle au fait d'être derrière un autre.
 *
 * Les mêmes traits que partout ailleurs, et la même logique : le tempérament
 * décide de qui le vit mal.
 */
function jealousy(player: Player): number {
  const has = (id: string): boolean => (player.traits as readonly string[]).includes(id);
  let f = 1;
  if (has('ambitieux')) f += 0.4;
  if (has('rancunier')) f += 0.35;
  if (has('mercenaire')) f += 0.25;
  if (has('professionnel')) f -= 0.2;
  if (has('loyal')) f -= 0.2;
  // Un mentor voit un jeune à former, pas un concurrent à écarter.
  if (has('mentor')) f -= 0.6;
  if (has('protecteur_jeunes')) f -= 0.4;
  return Math.max(0, f);
}

/**
 * Tensions nées de la concurrence au poste, pour une journée.
 *
 * Ne renvoie que les paires où quelque chose se passe : la grande majorité d'un
 * effectif ne produit rien, et écrire un delta nul sur trois cents paires
 * remplirait le graphe de relations de bruit.
 */
export function rivalryTensions(input: RivalryInput): readonly RivalryTension[] {
  const actifs = input.roster.filter(p => !p.retired && !p.freeAgent);

  const byShirt = new Map<string, Player[]>();
  for (const p of actifs) {
    const shirt = shirtOf(p.position);
    const list = byShirt.get(shirt);
    if (list) list.push(p);
    else byShirt.set(shirt, [p]);
  }

  const out: RivalryTension[] = [];
  for (const group of byShirt.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const ra = input.playRatio.get(a.id) ?? 0;
        const rb = input.playRatio.get(b.id) ?? 0;
        const gap = Math.abs(ra - rb);
        if (gap <= TOLERANCE) continue;

        const frustrated = ra < rb ? a : b;
        const ahead = ra < rb ? b : a;
        const status = input.statuses?.get(frustrated.id) ?? DEFAULT_STATUS;

        const intensity = (gap - TOLERANCE) / (1 - TOLERANCE);
        const raw = intensity * MAX_PER_ROUND * ENTITLEMENT[status] * jealousy(frustrated);
        const delta = -Math.round(raw);
        if (delta === 0) continue;

        out.push({
          frustrated: frustrated.id,
          ahead: ahead.id,
          delta,
          reason: `Concurrence au poste avec ${ahead.lastName}`,
        });
      }
    }
  }
  return out;
}

// =============================================================================
// Application au graphe
// =============================================================================

/**
 * Score en dessous duquel `relationships.ts` parle de conflit ouvert.
 *
 * Recopié plutôt qu'importé parce que ce module n'a pas à connaître la table de
 * dérivation des types — il a seulement besoin de savoir **quand alerter**.
 */
export const CONFLICT_THRESHOLD = -50;

export interface RivalryOutcome {
  readonly relations: RelationsState;
  readonly tensions: readonly RivalryTension[];
  /**
   * Celles qui viennent de basculer en conflit ouvert.
   *
   * C'est le seul moment qui mérite d'être signalé au manager : une tension qui
   * monte doucement n'est pas une nouvelle, une brouille déclarée si. Sans ce
   * filtre, le staff enverrait le même avertissement toutes les journées
   * pendant six mois.
   */
  readonly flares: readonly RivalryTension[];
}

/**
 * Applique une journée de concurrence au graphe de relations.
 *
 * Fait les deux choses d'un coup parce qu'elles sont indissociables : savoir
 * qu'une relation vient de franchir le seuil demande de connaître le score
 * d'avant, qui n'existe plus une fois le delta écrit.
 */
export function applyRivalryTensions(
  state: RelationsState,
  input: RivalryInput,
): RivalryOutcome {
  const tensions = rivalryTensions(input);
  let relations = state;
  const flares: RivalryTension[] = [];

  for (const t of tensions) {
    const before = getRelation(relations, t.frustrated, t.ahead).score;
    relations = updateRelationScore(relations, t.frustrated, t.ahead, t.delta, t.reason);
    const after = getRelation(relations, t.frustrated, t.ahead).score;
    if (before > CONFLICT_THRESHOLD && after <= CONFLICT_THRESHOLD) flares.push(t);
  }

  return { relations, tensions, flares };
}

/**
 * Ce que le staff signale au manager.
 *
 * On ne liste pas dix tensions : on nomme celle qui compte, parce qu'une
 * rivalité de vestiaire ne se règle qu'une à la fois. Et on ne dit rien tant
 * qu'il ne s'agit que d'une contrariété — le staff n'alerte pas sur un
 * remplaçant qui fait la moue.
 */
export function rivalrySummary(
  tensions: readonly RivalryTension[],
  nameOf: (id: PlayerId) => string,
): string | undefined {
  if (tensions.length === 0) return undefined;
  const pire = [...tensions].sort((x, y) => x.delta - y.delta)[0]!;
  if (pire.delta > -2) return undefined;
  return `${nameOf(pire.frustrated)} supporte de plus en plus mal d'être derrière ${nameOf(pire.ahead)}.`;
}
