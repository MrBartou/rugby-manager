/**
 * Les agents : V0.64.
 *
 * Le mot existait depuis la V0.6, mais il ne désignait rien : un « agent » était
 * l'expéditeur d'un mail annonçant une offre, un nom au-dessus d'un texte. La
 * négociation se faisait toujours avec le club et avec le joueur, jamais avec
 * l'homme qui les tient tous les deux.
 *
 * ## Un agent pour dix joueurs, et non un par joueur
 *
 * C'est la décision qui donne sa valeur au module. Un agent attaché à un seul
 * joueur n'aurait pas de mémoire utile : on le froisse, on ne le revoit jamais.
 * Un vivier de dix-huit agents qui se partagent tout le championnat rend chaque
 * négociation conséquente, parce que celui qu'on a humilié en juin tient
 * l'ouvreur qu'on voudra en janvier.
 *
 * ## Ce que l'agent fait payer, et ce qu'il fait gagner
 *
 * Il prend une commission sur ce que son joueur signe, et cette commission est
 * une vraie dépense du club, pas une décoration. En échange, un agent avec qui
 * l'on travaille bien ouvre des portes : il propose des joueurs qu'on n'aurait
 * pas vus, il assouplit ses exigences salariales. Un agent qu'on a maltraité
 * fait l'inverse, et à la fin il refuse de traiter.
 */

import { createRng } from '../rng.js';
import type { Player, PlayerId } from '../types.js';

// =============================================================================
// Le vivier
// =============================================================================

export type AgentId = string;

/**
 * Le tempérament de l'agent.
 *
 * Il ne change pas le squelette de la négociation, il en déplace les curseurs :
 * ce que l'agent réclame, ce qu'il pardonne, et ce qu'il apporte de lui-même.
 */
export type AgentStyle = 'REQUIN' | 'CARRIERISTE' | 'FAMILIAL';

export interface Agent {
  readonly id: AgentId;
  readonly name: string;
  readonly style: AgentStyle;
  /** Part du contrat qu'il prélève, 0,03 à 0,10. */
  readonly commission: number;
}

/**
 * Dix-huit agents pour trente clubs.
 *
 * Assez pour qu'on ne traite pas toujours avec le même, assez peu pour qu'on
 * finisse par tous les connaître. En dessous de dix, le championnat entier
 * dépendait de trois hommes ; au-dessus de trente, aucune relation n'avait le
 * temps de se construire sur une carrière.
 */
export const AGENT_POOL_SIZE = 18;

/*
 * Un troisième registre de noms, après les jeunes (`youth-generation`) et les
 * techniciens (`staff-market`). Ce n'est pas une recopie par paresse : un agent
 * n'a ni l'âge des uns ni le parcours des autres, et lui donner leurs noms
 * l'aurait fait passer pour un entraîneur dans une liste.
 */
const FIRST_NAMES = [
  'Marc', 'Philippe', 'Éric', 'Stéphane', 'Franck', 'Gilles', 'Pascal', 'Denis',
  'Xavier', 'Régis', 'Bertrand', 'Sylvain', 'Emmanuel', 'Fabrice', 'Ludovic',
  'Nicolas', 'Arnaud', 'Grégoire',
];

const LAST_NAMES = [
  'Abadie', 'Beaumont', 'Castagnet', 'Delmas', 'Escande', 'Ferrand', 'Guichard',
  'Hostens', 'Imbert', 'Lasserre', 'Marchand', 'Naudin', 'Oberti', 'Prunier',
  'Rey', 'Salvador', 'Taillefer', 'Vidal',
];

/**
 * Le vivier ne dépend d'aucune graine, et c'est délibéré.
 *
 * La graine de partie change à chaque saison (`seed_s2027`, `seed_s2028`) :
 * tirer les agents dessus aurait fait dériver leur commission d'une saison à
 * l'autre, pour des hommes que le manager est censé apprendre à connaître sur
 * vingt ans. Les identifiants, eux, auraient survécu, si bien que la relation
 * serait restée collée à un agent qui aurait changé de tarif tous les étés.
 *
 * Un casting fixe, donc, comme les quinze entraîneurs rivaux nommés de la V0.53.
 * Ce qui varie d'une carrière à l'autre n'est pas qui ils sont, c'est ce qu'on
 * en fait.
 */
export function buildAgentPool(): readonly Agent[] {
  const pool: Agent[] = [];
  for (let i = 0; i < AGENT_POOL_SIZE; i++) {
    const style: AgentStyle = i % 3 === 0 ? 'REQUIN' : i % 3 === 1 ? 'CARRIERISTE' : 'FAMILIAL';
    const base = style === 'REQUIN' ? 0.075 : style === 'CARRIERISTE' ? 0.055 : 0.04;
    // Un pas irrégulier plutôt qu'un tirage : deux agents du même tempérament ne
    // se confondent pas, et personne ne bouge d'une saison à l'autre.
    pool.push({
      id: `ag${i}`,
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
      style,
      commission: Math.round((base + ((i * 7) % 11) * 0.002) * 1000) / 1000,
    });
  }
  return pool;
}

/**
 * Qui représente ce joueur.
 *
 * Tiré de son identifiant et de rien d'autre : la même partie rechargée deux
 * fois doit retrouver les mêmes interlocuteurs, sans que le lien ait à être
 * sauvegardé joueur par joueur.
 */
export function agentOf(pool: readonly Agent[], playerId: PlayerId): Agent {
  const rng = createRng(`agent_of_${playerId}`);
  return pool[rng.nextInt(0, pool.length - 1)]!;
}

/** Les joueurs d'un même agent, pour lui parler de son écurie. */
export function clientsOf(
  pool: readonly Agent[],
  agentId: AgentId,
  players: readonly Player[],
): readonly Player[] {
  return players.filter(p => agentOf(pool, p.id).id === agentId);
}

// =============================================================================
// La relation avec le manager
// =============================================================================

/**
 * Elle vaut de -100 à +100, et elle part de zéro : un agent qu'on n'a jamais vu
 * n'est ni un ami ni un ennemi.
 */
export type AgentStandings = Readonly<Record<AgentId, number>>;

export const BLOCK_THRESHOLD = -60;
export const FRICTION_THRESHOLD = -25;
export const FAVOUR_THRESHOLD = 40;

export function standingOf(standings: AgentStandings, agentId: AgentId): number {
  return standings[agentId] ?? 0;
}

/** Ce qui vient de se passer à la table de négociation. */
export type AgentEvent =
  | 'SIGNATURE'
  | 'PROLONGATION'
  | 'COMMISSION_ACCEPTEE'
  | 'COMMISSION_REFUSEE'
  | 'OFFRE_INSULTANTE'
  | 'NEGOCIATION_ABANDONNEE'
  | 'JOUEUR_ECARTE';

const EVENT_WEIGHT: Readonly<Record<AgentEvent, number>> = {
  SIGNATURE: 14,
  PROLONGATION: 9,
  COMMISSION_ACCEPTEE: 7,
  COMMISSION_REFUSEE: -18,
  OFFRE_INSULTANTE: -16,
  NEGOCIATION_ABANDONNEE: -6,
  JOUEUR_ECARTE: -11,
};

/**
 * Un requin encaisse les mauvaises manières et n'oublie jamais l'argent ; un
 * agent familial le prend personnellement mais pardonne le reste. C'est là que
 * le tempérament se voit vraiment, plutôt que dans un libellé.
 */
function sensitivity(style: AgentStyle, event: AgentEvent): number {
  const monetary = event === 'COMMISSION_REFUSEE' || event === 'COMMISSION_ACCEPTEE';
  if (style === 'REQUIN') return monetary ? 1.4 : 0.7;
  if (style === 'FAMILIAL') return monetary ? 0.7 : 1.3;
  return 1;
}

export function applyAgentEvent(
  standings: AgentStandings,
  agentId: AgentId,
  event: AgentEvent,
): AgentStandings {
  const delta = EVENT_WEIGHT[event] * sensitivity(styleOfId(agentId), event);
  const next = Math.max(-100, Math.min(100, standingOf(standings, agentId) + delta));
  return { ...standings, [agentId]: Math.round(next) };
}

/**
 * Le tempérament se relit depuis l'identifiant.
 *
 * `buildAgentPool` l'attribue par le rang dans le vivier, et l'identifiant porte
 * ce rang : on évite ainsi de faire circuler le vivier entier jusqu'ici, et
 * surtout d'avoir deux façons de répondre à la question « quel genre d'homme
 * est-ce ».
 */
function styleOfId(agentId: AgentId): AgentStyle {
  const index = Number(agentId.replace(/^ag/, ''));
  if (!Number.isFinite(index)) return 'CARRIERISTE';
  return index % 3 === 0 ? 'REQUIN' : index % 3 === 1 ? 'CARRIERISTE' : 'FAMILIAL';
}

/**
 * L'oubli, saison par saison.
 *
 * Sans lui, une carrière de vingt saisons finissait avec dix-huit agents à -100
 * et un mercato fermé pour de bon. Une rancune tenace reste tenace : elle se
 * dissipe d'un dixième par an, pas davantage.
 */
export function decayStandings(standings: AgentStandings): AgentStandings {
  const next: Record<AgentId, number> = {};
  for (const [id, value] of Object.entries(standings)) {
    next[id] = Math.round(value * 0.9);
  }
  return next;
}

// =============================================================================
// La commission
// =============================================================================

/**
 * Ce que l'agent réclame pour ce contrat.
 *
 * Assise sur le salaire total, pas sur l'indemnité : c'est le joueur qu'il
 * représente, pas le club vendeur. Une bonne relation vaut une remise, une
 * mauvaise un supplément, et l'écart est assez large pour qu'entretenir ses
 * agents se voie au bilan.
 */
export function commissionFor(input: {
  readonly agent: Agent;
  readonly annualSalary: number;
  readonly years: number;
  readonly standing: number;
}): number {
  const total = Math.max(0, input.annualSalary) * Math.max(1, input.years);
  const relationFactor = 1 - (input.standing / 100) * 0.25;
  return Math.round(total * input.agent.commission * relationFactor);
}

// =============================================================================
// La position de l'agent dans une négociation
// =============================================================================

export type AgentStanceKind = 'FACILITE' | 'NEUTRE' | 'FREINE' | 'BLOQUE';

export interface AgentStance {
  readonly kind: AgentStanceKind;
  readonly reason: string;
  /**
   * Coefficient à appliquer au salaire exigé par le joueur. Au-dessus de 1,
   * l'agent renchérit ; en dessous, il aplanit.
   */
  readonly salaryFactor: number;
  readonly commission: number;
}

export function agentStance(input: {
  readonly agent: Agent;
  readonly standing: number;
  readonly annualSalary: number;
  readonly years: number;
  /** Rang du club acheteur, pour l'agent qui pense à la carrière de son joueur. */
  readonly buyerRank?: number;
  readonly totalClubs?: number;
}): AgentStance {
  const { agent, standing } = input;
  const commission = commissionFor(input);

  if (standing <= BLOCK_THRESHOLD) {
    return {
      kind: 'BLOQUE',
      reason: `${agent.name} refuse de travailler avec vous. Son joueur ne signera pas ici.`,
      salaryFactor: 1,
      commission,
    };
  }

  // Le carriériste regarde où il envoie son joueur, et le fait payer quand
  // c'est un club de bas de tableau. C'est sa seule différence de fond, mais
  // elle transforme le recrutement d'un promu.
  if (
    agent.style === 'CARRIERISTE'
    && input.buyerRank !== undefined
    && input.totalClubs !== undefined
    && input.buyerRank > input.totalClubs * 0.6
  ) {
    return {
      kind: 'FREINE',
      reason: `${agent.name} ne voit pas son joueur descendre d'un cran : il faudra y mettre le prix.`,
      salaryFactor: 1.12,
      commission,
    };
  }

  if (standing <= FRICTION_THRESHOLD) {
    return {
      kind: 'FREINE',
      reason: `${agent.name} garde un mauvais souvenir de vos dernières discussions.`,
      salaryFactor: 1.10,
      commission,
    };
  }

  if (standing >= FAVOUR_THRESHOLD) {
    return {
      kind: 'FACILITE',
      reason: `${agent.name} vous fait confiance et pousse son joueur à accepter.`,
      salaryFactor: 0.94,
      commission,
    };
  }

  return { kind: 'NEUTRE', reason: `${agent.name} écoute votre proposition.`, salaryFactor: 1, commission };
}

// =============================================================================
// Ce que l'agent apporte
// =============================================================================

export interface AgentProposal {
  readonly agentId: AgentId;
  readonly agentName: string;
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly pitch: string;
}

/**
 * Les joueurs qu'un agent bien disposé vient vous proposer.
 *
 * C'est le reliquat de la V0.43, « sollicitations d'agents », resté non fait
 * pendant vingt versions. Il fallait d'abord que l'agent existe : proposer un
 * joueur au hasard aurait été une notification de plus, alors que la
 * proposition ne vaut que par celui qui la porte et par ce qu'on lui doit.
 */
export function agentProposals(input: {
  readonly pool: readonly Agent[];
  readonly standings: AgentStandings;
  /** Joueurs susceptibles d'être proposés : libres, ou ouvertement sur le marché. */
  readonly candidates: readonly Player[];
  readonly round: number;
  readonly seed: string;
}): readonly AgentProposal[] {
  const rng = createRng(`agent_props_${input.seed}_${input.round}`);
  const out: AgentProposal[] = [];

  for (const agent of input.pool) {
    const standing = standingOf(input.standings, agent.id);
    if (standing < FAVOUR_THRESHOLD) continue;
    // Une proposition par agent et par fenêtre au plus : au-delà, la boîte de
    // réception remplace le scouting.
    if (!rng.nextBool(0.35)) continue;

    const clients = input.candidates.filter(p => agentOf(input.pool, p.id).id === agent.id);
    if (clients.length === 0) continue;
    const player = rng.pick(clients);

    out.push({
      agentId: agent.id,
      agentName: agent.name,
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      pitch: agent.style === 'REQUIN'
        ? `${agent.name} vous met sur le coup avant les autres : ${player.lastName} est disponible.`
        : `${agent.name} pense que ${player.lastName} vous conviendrait, et il vous le dit avant tout le monde.`,
    });
  }

  return out;
}
