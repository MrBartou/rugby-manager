/**
 * Les discussions de contrat : V0.64.
 *
 * Jusqu'ici, un contrat ne se discutait qu'à sa dernière année, et toujours dans
 * le même sens : le club proposait une prolongation, le joueur disait oui ou
 * non. Trois situations très ordinaires du rugby professionnel n'avaient aucune
 * traduction dans le jeu.
 *
 *  - **La revalorisation.** Un joueur qui explose au milieu d'un contrat de cinq
 *    ans reste payé au tarif de ses vingt ans. Dans la réalité, son agent
 *    rappelle. Ici, personne ne rappelait, et le moral encaissait sans qu'on
 *    puisse rien faire.
 *  - **Le pré-contrat.** À six mois de la fin, un joueur est libre de s'engager
 *    ailleurs pour la saison suivante. C'est la mécanique qui rend une fin de
 *    contrat dangereuse, et jusqu'ici l'expiration était sans risque : personne
 *    ne venait servir avant l'été.
 *  - **La résiliation à l'amiable.** Un contrat qu'on ne veut plus se rachète.
 *    Sans elle, une erreur de recrutement s'expiait jusqu'au bout, quatre ans
 *    durant, sans autre issue que le prêt.
 *
 * Les trois partagent une même règle : **le levier appartient à celui qui peut
 * partir**. Un joueur en fin de contrat exige, un joueur qui en a quatre devant
 * lui négocie, un joueur qu'on écarte se fait payer pour s'en aller.
 */

import { createRng } from '../rng.js';
import { averageSalary, salaryForSeason } from './contract-clauses.js';
import { expectedMarketSalary } from './contracts.js';
import { salaryExpectation, type SquadStatus } from './squad-status.js';
import type { ClubId, Contract, Player, PlayerId } from '../types.js';

// =============================================================================
// La revalorisation en cours de contrat
// =============================================================================

export interface RenegotiationRequest {
  /** Salaire annuel demandé pour la suite. */
  readonly annualSalary: number;
  /** Années ajoutées à la durée courante, 0 à 3. */
  readonly extraYears: number;
  readonly reason: string;
}

/**
 * Ce que le joueur estime mériter aujourd'hui, sous contrat ou non.
 *
 * On compare au salaire **moyen** du contrat et non à celui de l'année : un
 * contrat progressif a déjà répondu par avance à la question, et le rouvrir
 * chaque année reviendrait à payer deux fois la même augmentation.
 */
export function salaryGap(input: {
  readonly player: Player;
  readonly currentSeason: number;
  readonly squadStatus?: SquadStatus;
}): number {
  const expected = expectedMarketSalary(input.player, input.currentSeason)
    * (input.squadStatus !== undefined ? salaryExpectation(input.squadStatus) : 1);
  return expected - averageSalary(input.player.contract);
}

/**
 * Le joueur demande-t-il à revoir son contrat ?
 *
 * Trois conditions cumulées, et la troisième compte autant que les deux autres :
 * il faut qu'il soit sous-payé, qu'il ait des années devant lui (sinon c'est une
 * prolongation, pas une revalorisation), et qu'il ait quelque chose à faire
 * valoir. Un remplaçant mécontent n'a pas de levier, et lui en donner un aurait
 * transformé le vestiaire en file d'attente.
 */
export function wantsRenegotiation(input: {
  readonly player: Player;
  readonly currentSeason: number;
  /** Part des matchs disputés cette saison, 0 à 1. */
  readonly playRatio: number;
  readonly squadStatus?: SquadStatus;
}): boolean {
  const { player, currentSeason } = input;
  if (player.retired || player.freeAgent) return false;
  const yearsLeft = player.contract.endSeason - currentSeason;
  if (yearsLeft < 1) return false;
  if (input.playRatio < 0.4) return false;
  return salaryGap(input) > averageSalary(player.contract) * 0.18;
}

/** Ce qu'il vient demander, et pourquoi. */
export function renegotiationRequest(input: {
  readonly player: Player;
  readonly currentSeason: number;
  readonly playRatio: number;
  readonly squadStatus?: SquadStatus;
}): RenegotiationRequest {
  const gap = salaryGap(input);
  const asked = Math.round((averageSalary(input.player.contract) + gap * 0.9) / 1000) * 1000;
  return {
    annualSalary: asked,
    extraYears: input.playRatio > 0.7 ? 1 : 0,
    reason: input.playRatio > 0.7
      ? 'Il joue tous les week-ends et le fait remarquer.'
      : 'Il estime que son salaire ne correspond plus à ce qu\'il vaut.',
  };
}

export type TalkResponse =
  | { readonly kind: 'ACCEPT' }
  | { readonly kind: 'REFUSE'; readonly reason: string }
  | { readonly kind: 'COUNTER'; readonly annualSalary: number; readonly reason: string };

/**
 * La réponse du joueur à ce que le club propose en retour.
 *
 * Le club peut aussi proposer **moins** que demandé, et c'est là que la
 * discussion existe : un joueur loyal accepte une revalorisation partielle, un
 * ambitieux la prend pour un refus déguisé.
 */
export function answerRenegotiation(input: {
  readonly player: Player;
  readonly request: RenegotiationRequest;
  readonly offeredSalary: number;
  /** Coefficient imposé par l'agent, 1 quand il ne s'en mêle pas. */
  readonly agentFactor?: number;
  readonly seed: string;
}): TalkResponse {
  const { player, request, offeredSalary } = input;
  const demanded = Math.round(request.annualSalary * (input.agentFactor ?? 1));
  const loyalty = player.hidden.loyaute / 100;
  const ambition = player.hidden.ambition / 100;
  // Un loyal descend jusqu'à 88 % de sa demande, un ambitieux exige 99 %.
  const floor = demanded * (0.99 - loyalty * 0.11 + (0.5 - ambition) * 0.04);

  if (offeredSalary >= floor) return { kind: 'ACCEPT' };
  if (offeredSalary < demanded * 0.6) {
    return {
      kind: 'REFUSE',
      reason: 'Il prend cette réponse pour une fin de non-recevoir.',
    };
  }
  const rng = createRng(`${input.seed}_reneg_${player.id}`);
  const counter = Math.round(((floor + demanded) / 2) * (1 + rng.next() * 0.03) / 1000) * 1000;
  return {
    kind: 'COUNTER',
    annualSalary: counter,
    reason: `Il descendrait à ${formatK(counter)} par an.`,
  };
}

/**
 * Applique la revalorisation.
 *
 * La progression éventuelle est **remise à zéro** : le nouveau salaire est un
 * nouveau point de départ, et conserver l'ancienne pente aurait fait grimper
 * deux fois le même contrat. Le moral remonte, ce qui est tout l'intérêt de
 * l'opération pour le club.
 */
export function applyRenegotiation(
  player: Player,
  annualSalary: number,
  extraYears: number,
  currentSeason: number,
): Player {
  const contract: Contract = {
    ...player.contract,
    startSeason: currentSeason,
    endSeason: player.contract.endSeason + Math.max(0, extraYears),
    annualSalary,
  };
  delete contract.salaryProgression;
  return {
    ...player,
    contract,
    dynamic: { ...player.dynamic, mood: Math.min(100, player.dynamic.mood + 10) },
  };
}

// =============================================================================
// Le pré-contrat
// =============================================================================

export interface PreContract {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly fromClubId: ClubId;
  readonly toClubId: ClubId;
  readonly toClubName: string;
  /** Saison en cours au moment de la signature ; le joueur part à la suivante. */
  readonly signedSeason: number;
  readonly annualSalary: number;
  readonly years: number;
}

/**
 * À partir de quelle journée un joueur peut s'engager ailleurs.
 *
 * Six mois avant l'échéance, donc grosso modo à mi-saison. On le calcule sur le
 * calendrier réel de la division plutôt qu'en dur : la Pro D2 joue trente
 * journées, et une constante aurait ouvert la fenêtre trop tôt pour elle.
 */
export function preContractWindowOpens(totalRounds: number): number {
  return Math.ceil(totalRounds / 2);
}

export function preContractEligible(input: {
  readonly player: Player;
  readonly currentSeason: number;
  readonly round: number;
  readonly totalRounds: number;
}): boolean {
  const { player } = input;
  if (player.retired || player.freeAgent) return false;
  if (player.contract.endSeason !== input.currentSeason) return false;
  return input.round >= preContractWindowOpens(input.totalRounds);
}

/**
 * Ce que le joueur pense d'un pré-contrat.
 *
 * Il n'a rien à perdre : il finit sa saison ici quoi qu'il arrive. Le club
 * courtisé n'a donc à convaincre que sur le salaire et sur le rang, et le
 * garde-fou est ailleurs : c'est le club actuel qui peut encore le retenir en
 * lui proposant mieux, tant qu'il n'a pas signé.
 */
export function evaluatePreContract(input: {
  readonly player: Player;
  readonly currentSeason: number;
  readonly annualSalary: number;
  readonly buyerRank: number;
  readonly currentRank: number;
  readonly totalClubs: number;
}): TalkResponse {
  const expected = expectedMarketSalary(input.player, input.currentSeason);
  const current = salaryForSeason(input.player.contract, input.currentSeason);
  const reference = Math.max(expected, current);

  if (input.annualSalary >= reference * 1.02) return { kind: 'ACCEPT' };

  // Un club mieux classé compense une partie de l'écart : c'est le seul argument
  // non financier qui reste à un club qui ne peut pas s'aligner.
  const rankGain = (input.currentRank - input.buyerRank) / Math.max(2, input.totalClubs);
  const tolerated = reference * (1.02 - Math.max(0, rankGain) * 0.25);
  if (input.annualSalary >= tolerated) return { kind: 'ACCEPT' };

  return {
    kind: 'REFUSE',
    reason: `Il attend au moins ${formatK(Math.round(tolerated))} par an pour s'engager dès maintenant.`,
  };
}

/**
 * Fait partir, au rollover, ceux qui ont signé ailleurs.
 *
 * Un pré-contrat prime sur tout le reste : le joueur n'est pas remis dans le
 * vivier des agents libres, il est déjà chez quelqu'un. C'est exactement ce qui
 * rend l'expiration coûteuse pour le club qui a laissé traîner.
 */
export function applyPreContracts(input: {
  readonly players: readonly Player[];
  readonly preContracts: readonly PreContract[];
  readonly newSeason: number;
}): readonly Player[] {
  if (input.preContracts.length === 0) return input.players;
  const byPlayer = new Map(input.preContracts.map(pc => [pc.playerId, pc]));
  return input.players.map<Player>(p => {
    const pc = byPlayer.get(p.id);
    if (!pc || p.retired) return p;
    const contract: Contract = {
      startSeason: input.newSeason,
      endSeason: input.newSeason + pc.years - 1,
      annualSalary: pc.annualSalary,
    };
    return { ...p, clubId: pc.toClubId, contract, freeAgent: false };
  });
}

// =============================================================================
// La résiliation à l'amiable
// =============================================================================

/**
 * Ce qu'il en coûte de rendre sa liberté à un joueur.
 *
 * On ne rachète pas la totalité du contrat restant : le joueur retrouvera un
 * club, et il le sait. La part exigée dépend de son envie de rester, et c'est
 * ce qui rend l'opération intéressante quand elle porte sur un joueur malheureux
 * plutôt que sur un cadre installé.
 */
export function terminationCost(input: {
  readonly player: Player;
  readonly currentSeason: number;
}): number {
  const { player, currentSeason } = input;
  const yearsLeft = Math.max(0, player.contract.endSeason - currentSeason);
  if (yearsLeft <= 0) return 0;

  let remaining = 0;
  for (let s = currentSeason; s < player.contract.endSeason; s++) {
    remaining += salaryForSeason(player.contract, s + 1);
  }

  // Moral au plancher : il veut partir, il lâchera la moitié. Moral au plafond :
  // il faudra racheter presque tout.
  const mood = Math.max(0, Math.min(100, player.dynamic.mood));
  const share = 0.35 + (mood / 100) * 0.45;
  const loyaltyPull = (player.hidden.loyaute / 100) * 0.1;

  return Math.round((remaining * (share + loyaltyPull)) / 10_000) * 10_000;
}

export function evaluateTermination(input: {
  readonly player: Player;
  readonly currentSeason: number;
  readonly offered: number;
}): TalkResponse {
  const asked = terminationCost(input);
  if (input.offered >= asked) return { kind: 'ACCEPT' };
  if (input.offered >= asked * 0.75) {
    return {
      kind: 'COUNTER',
      annualSalary: asked,
      reason: `Il partira contre ${formatK(asked)}, pas moins.`,
    };
  }
  return { kind: 'REFUSE', reason: 'Il préfère rester et honorer son contrat.' };
}

/** Le joueur résilié devient agent libre le jour même. */
export function applyTermination(player: Player): Player {
  return { ...player, freeAgent: true, clubId: 'libre' as ClubId };
}

// =============================================================================
// Formatage
// =============================================================================

function formatK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M€` : `${Math.round(n / 1_000)} k€`;
}
