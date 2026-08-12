/**
 * Duel porteur / défenseur — V0.13.
 *
 * Avant ce module, `openplay.ts` moyennait les sept trois-quarts en un seul nombre :
 * un ouvreur de classe mondiale entouré de quatre joueurs médiocres produisait
 * exactement le même jeu qu'une ligne homogène de même moyenne. Aucun joueur
 * n'existait individuellement, sauf au moment d'attribuer un essai — et le narratif
 * ne pouvait donc raconter que des gabarits.
 *
 * Ici, chaque temps de jeu désigne un **porteur** et le **défenseur** qui lui fait
 * face dans son canal, puis résout leur duel. On en tire :
 *
 *  - des mètres gagnés qui dépendent de *qui* porte contre *qui*
 *  - des statistiques individuelles réelles (courses, mètres, plaquages, plaquages
 *    manqués, défenseurs battus, ballons grattés, en-avants)
 *  - des faits de match nommés, dont le narratif peut se servir
 *
 * ## Échelle des statistiques
 *
 * Le moteur simule ~75 phases par match (contrainte de design, cf.
 * 14-tests-validation.md), là où un vrai match compte 250 à 300 contacts. Les
 * volumes produits ici sont donc à l'échelle du moteur — de l'ordre de 25 courses
 * et 25 plaquages par équipe, contre 110-130 dans les statistiques officielles.
 *
 * Ils sont pleinement exploitables pour **comparer les joueurs entre eux** (c'est
 * leur rôle dans le jeu), mais ne doivent pas être présentés comme comparables à
 * une feuille de statistiques réelle. Les rapprocher supposerait d'augmenter la
 * granularité du moteur, ce qui casserait la cible de 70-80 phases par match.
 */

import type { Player, PlayerId, Position } from '../types.js';
import type { Rng } from '../rng.js';

// =============================================================================
// Contributions individuelles à une phase
// =============================================================================

/** Ce qu'un joueur a fait pendant une phase. Agrégé en fin de match. */
export interface PhaseContribution {
  readonly playerId: PlayerId;
  readonly carries?: number;
  readonly metersWithBall?: number;
  readonly tackles?: number;
  readonly tacklesMissed?: number;
  readonly turnoversWon?: number;
  readonly handlingErrors?: number;
  readonly defendersBeaten?: number;
  readonly lineBreaks?: number;
  readonly offloads?: number;
}

// =============================================================================
// Sélection du porteur
// =============================================================================

/** Appétence d'un poste à porter le ballon dans le jeu courant. */
const CARRY_APPETITE: Readonly<Record<Position, number>> = {
  PILIER_GAUCHE: 26,
  TALONNEUR: 24,
  PILIER_DROIT: 26,
  DEUXIEME_LIGNE_GAUCHE: 30,
  DEUXIEME_LIGNE_DROITE: 30,
  TROISIEME_LIGNE_AILE_GAUCHE: 46,
  TROISIEME_LIGNE_AILE_DROITE: 46,
  NUMERO_8: 54,
  DEMI_DE_MELEE: 22,
  OUVREUR: 26,
  CENTRE_INTERIEUR: 52,
  CENTRE_EXTERIEUR: 48,
  AILIER_GAUCHE: 44,
  AILIER_DROIT: 44,
  ARRIERE: 34,
};

function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return items[i] ?? items[0];
  }
  return items[items.length - 1] ?? items[0];
}

export interface CarrierContext {
  readonly pack: readonly Player[];
  readonly backs: readonly Player[];
  /** Temps consécutifs dans la même possession : plus il monte, plus les avants portent. */
  readonly phaseInPossession: number;
  /** -50..+50 du point de vue de l'attaque. */
  readonly fieldPosition: number;
}

/**
 * Qui prend le ballon ?
 *
 * Juste après une phase de fixation (premiers temps), les trois-quarts ont la main.
 * Au fil des temps, le jeu se resserre et les avants portent au ras. Près de sa
 * propre ligne, on ne fait pas jouer les ailiers.
 */
export function pickCarrier(ctx: CarrierContext, rng: Rng): Player | undefined {
  const all = [...ctx.pack, ...ctx.backs];
  if (all.length === 0) return undefined;

  // Part des avants : 30 % au premier temps, jusqu'à ~65 % après plusieurs temps.
  const packShare = Math.min(0.65, 0.30 + ctx.phaseInPossession * 0.055);
  // Dans ses 22 mètres, on joue serré.
  const deepInOwnHalf = ctx.fieldPosition < -25;
  const effectiveShare = deepInOwnHalf ? Math.min(0.80, packShare + 0.15) : packShare;

  const fromPack = ctx.pack.length > 0 && rng.next() < effectiveShare;
  const pool = fromPack ? ctx.pack : (ctx.backs.length > 0 ? ctx.backs : ctx.pack);

  const weights = pool.map(p => {
    const appetite = CARRY_APPETITE[p.position];
    // Un joueur puissant et rapide est plus souvent servi.
    return appetite + p.physical.puissance * 0.22 + p.physical.vitesse * 0.16;
  });
  return weightedPick(pool, weights, rng);
}

/**
 * Qui plaque ?
 *
 * Le défenseur est cherché dans le canal du porteur : un avant tombe surtout sur
 * un avant, un trois-quarts sur un trois-quarts. Le tirage reste pondéré par
 * l'activité défensive, pour que les gros plaqueurs sortent plus souvent.
 */
export function pickDefender(
  carrier: Player,
  defensePack: readonly Player[],
  defenseBacks: readonly Player[],
  rng: Rng,
): Player | undefined {
  const carrierIsForward = CARRY_APPETITE[carrier.position] <= 30 ||
    ['TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8'].includes(carrier.position);

  // 78 % du temps le duel reste dans le même secteur, 22 % de brassage.
  const sameChannel = rng.next() < 0.78;
  const preferPack = carrierIsForward === sameChannel ? carrierIsForward : !carrierIsForward;
  const primary = preferPack ? defensePack : defenseBacks;
  const pool = primary.length > 0 ? primary : [...defensePack, ...defenseBacks];
  if (pool.length === 0) return undefined;

  const weights = pool.map(p => p.technical.plaquage * 0.6 + p.mental.agressivite * 0.4);
  return weightedPick(pool, weights, rng);
}

// =============================================================================
// Résolution du duel
// =============================================================================

export type CarryOutcome =
  | 'LINE_BREAK'        // le porteur perce le rideau
  | 'BEATEN'            // défenseur battu, gain franc
  | 'GAIN'              // avancée normale
  | 'HELD'              // stoppé net
  | 'DOMINANT_TACKLE'   // plaquage dominant, l'attaque recule
  | 'HANDLING_ERROR'    // en-avant du porteur
  | 'TURNOVER';         // ballon arraché dans le contact

export interface CarryResolution {
  readonly carrier: Player;
  readonly defender: Player;
  readonly outcome: CarryOutcome;
  readonly metersGained: number;
  readonly contributions: readonly PhaseContribution[];
  /** Narration courte, nominative. */
  readonly summary: string;
}

/** Capacité du porteur à avancer dans le contact. */
function carrierPower(p: Player, fatigue: number): number {
  const fatigueMul = 1 - (fatigue / 100) * 0.28;
  return (
    p.physical.puissance * 0.32 +
    p.physical.vitesse * 0.26 +
    p.technical.conservation * 0.24 +
    p.mental.agressivite * 0.18
  ) * fatigueMul;
}

/** Capacité du défenseur à stopper, voire à dominer le contact. */
function defenderPower(p: Player, fatigue: number): number {
  const fatigueMul = 1 - (fatigue / 100) * 0.28;
  return (
    p.technical.plaquage * 0.48 +
    p.physical.puissance * 0.24 +
    p.mental.agressivite * 0.16 +
    p.physical.vitesse * 0.12
  ) * fatigueMul;
}

export interface ResolveCarryInput {
  readonly carrier: Player;
  readonly defender: Player;
  readonly fatigueAttack: number;
  readonly fatigueDefense: number;
  readonly attackTacticalBonus: number;
  readonly defenseTacticalBonus: number;
}

/**
 * Résout **un contact**.
 *
 * Les valeurs sont à l'échelle d'une course individuelle (3 à 4 mètres en moyenne,
 * comme dans le rugby réel), pas d'une phase entière. Une phase de jeu courant en
 * enchaîne plusieurs — voir `resolveCarrySequence`.
 */
export function resolveCarry(input: ResolveCarryInput, rng: Rng): CarryResolution {
  const att = carrierPower(input.carrier, input.fatigueAttack) + input.attackTacticalBonus;
  const def = defenderPower(input.defender, input.fatigueDefense) + input.defenseTacticalBonus;
  const delta = att - def;
  const edge = Math.tanh(delta / 58);          // -1..+1

  const lineBreakProb = Math.max(0.005, 0.035 + edge * 0.030);
  const beatenProb = Math.max(0.02, 0.105 + edge * 0.055);
  const dominantTackleProb = Math.max(0.02, 0.085 - edge * 0.050);
  const handlingErrorProb = Math.max(0.0015, 0.0050 - edge * 0.0025);
  const turnoverProb = Math.max(0.003, 0.0130 - edge * 0.0075);
  const heldProb = Math.max(0.05, 0.175 - edge * 0.060);
  // reliquat : gain normal

  const carrierName = `${input.carrier.firstName} ${input.carrier.lastName}`;
  const defenderName = `${input.defender.firstName} ${input.defender.lastName}`;

  const r = rng.next();
  let acc = 0;

  if (r < (acc += lineBreakProb)) {
    const meters = 14 + rng.nextGaussian(0, 5);
    return build('LINE_BREAK', Math.max(9, meters), {
      summary: `${carrierName} perce le rideau !`,
      beaten: 1, lineBreak: 1, missed: true,
    });
  }
  if (r < (acc += beatenProb)) {
    const meters = 4.2 + rng.nextGaussian(0, 1.7);
    return build('BEATEN', Math.max(1.8, meters), {
      summary: `${carrierName} élimine ${defenderName}`,
      beaten: 1, missed: true,
    });
  }
  if (r < (acc += dominantTackleProb)) {
    const meters = -1.0 + rng.nextGaussian(0, 0.7);
    return build('DOMINANT_TACKLE', Math.min(-0.2, meters), {
      summary: `plaquage dominant de ${defenderName} sur ${carrierName}`,
      tackle: 1,
    });
  }
  if (r < (acc += handlingErrorProb)) {
    return build('HANDLING_ERROR', 0, {
      summary: `en-avant de ${carrierName}`,
      handlingError: 1,
    });
  }
  if (r < (acc += turnoverProb)) {
    return build('TURNOVER', 0, {
      summary: `${defenderName} arrache le ballon à ${carrierName} !`,
      tackle: 1, turnover: 1,
    });
  }
  if (r < (acc += heldProb)) {
    const meters = 0.4 + rng.nextGaussian(0, 0.35);
    return build('HELD', Math.max(0, meters), {
      summary: `${carrierName} stoppé par ${defenderName}`,
      tackle: 1,
    });
  }

  const meters = 2.35 + edge * 0.75 + rng.nextGaussian(0, 0.9);
  return build('GAIN', Math.max(0.5, meters), {
    summary: meters > 3.5 ? `belle avancée de ${carrierName}` : `${carrierName} gagne quelques mètres`,
    tackle: 1,
  });

  // ---------------------------------------------------------------------------

  function build(
    outcome: CarryOutcome,
    meters: number,
    opts: {
      summary: string;
      tackle?: number;
      missed?: boolean;
      beaten?: number;
      lineBreak?: number;
      turnover?: number;
      handlingError?: number;
    },
  ): CarryResolution {
    const carrierContribution: PhaseContribution = {
      playerId: input.carrier.id,
      carries: 1,
      metersWithBall: Math.max(0, meters),
      ...(opts.beaten ? { defendersBeaten: opts.beaten } : {}),
      ...(opts.lineBreak ? { lineBreaks: opts.lineBreak } : {}),
      ...(opts.handlingError ? { handlingErrors: opts.handlingError } : {}),
    };
    const defenderContribution: PhaseContribution = {
      playerId: input.defender.id,
      ...(opts.tackle ? { tackles: opts.tackle } : {}),
      ...(opts.missed ? { tacklesMissed: 1 } : {}),
      ...(opts.turnover ? { turnoversWon: opts.turnover } : {}),
    };
    return {
      carrier: input.carrier,
      defender: input.defender,
      outcome,
      metersGained: meters,
      contributions: [carrierContribution, defenderContribution],
      summary: opts.summary,
    };
  }
}

// =============================================================================
// Séquence de contacts (une phase de jeu courant)
// =============================================================================

export interface CarrySequenceResult {
  readonly outcome: CarryOutcome;
  readonly metersGained: number;
  readonly contributions: readonly PhaseContribution[];
  /** Le fait marquant de la séquence, à afficher. */
  readonly summary: string;
  /** Dernier porteur (pour l'attribution de la phase). */
  readonly carrier: Player;
  readonly defender: Player;
}

export interface CarrySequenceInput {
  readonly attackPack: readonly Player[];
  readonly attackBacks: readonly Player[];
  readonly defensePack: readonly Player[];
  readonly defenseBacks: readonly Player[];
  readonly phaseInPossession: number;
  readonly fieldPosition: number;
  readonly fatigueAttack: number;
  readonly fatigueDefense: number;
  readonly attackTacticalBonus: number;
  readonly defenseTacticalBonus: number;
}

/**
 * Enchaîne 2 à 4 contacts pour une phase de jeu courant.
 *
 * Une phase du moteur couvre environ 80 secondes de jeu : elle contient plusieurs
 * portées de balle, pas une seule. Les résoudre individuellement donne des
 * volumes statistiques réalistes (courses, plaquages) et fait ressortir la qualité
 * d'un joueur sur la durée plutôt que sur un tirage unique.
 *
 * La séquence s'arrête net sur une perte de balle ou un franchissement.
 */
export function resolveCarrySequence(
  input: CarrySequenceInput,
  rng: Rng,
): CarrySequenceResult | undefined {
  const contacts = 3 + (rng.next() < 0.55 ? 1 : 0) + (rng.next() < 0.30 ? 1 : 0);

  const contributions: PhaseContribution[] = [];
  let meters = 0;
  let lastCarrier: Player | undefined;
  let lastDefender: Player | undefined;
  let finalOutcome: CarryOutcome = 'GAIN';
  let notableSummary: string | undefined;
  let notableRank = -1;

  // Hiérarchie de ce qui « fait » le récit d'une phase.
  const rankOf = (o: CarryOutcome): number =>
    o === 'LINE_BREAK' ? 6 :
    o === 'TURNOVER' ? 5 :
    o === 'HANDLING_ERROR' ? 4 :
    o === 'BEATEN' ? 3 :
    o === 'DOMINANT_TACKLE' ? 2 :
    o === 'GAIN' ? 1 : 0;

  for (let i = 0; i < contacts; i++) {
    const carrier = pickCarrier(
      {
        pack: input.attackPack,
        backs: input.attackBacks,
        // Chaque contact enfonce un peu plus le jeu au ras.
        phaseInPossession: input.phaseInPossession + i,
        fieldPosition: input.fieldPosition,
      },
      rng,
    );
    if (!carrier) break;
    const defender = pickDefender(carrier, input.defensePack, input.defenseBacks, rng);
    if (!defender) break;

    const carry = resolveCarry(
      {
        carrier,
        defender,
        fatigueAttack: input.fatigueAttack,
        fatigueDefense: input.fatigueDefense,
        attackTacticalBonus: input.attackTacticalBonus,
        defenseTacticalBonus: input.defenseTacticalBonus,
      },
      rng,
    );

    contributions.push(...carry.contributions);
    meters += carry.metersGained;
    lastCarrier = carrier;
    lastDefender = defender;
    finalOutcome = carry.outcome;

    const rank = rankOf(carry.outcome);
    if (rank > notableRank) {
      notableRank = rank;
      notableSummary = carry.summary;
    }

    // Perte de balle ou franchissement : la phase s'arrête là.
    if (
      carry.outcome === 'HANDLING_ERROR' ||
      carry.outcome === 'TURNOVER' ||
      carry.outcome === 'LINE_BREAK'
    ) {
      break;
    }
  }

  if (!lastCarrier || !lastDefender) return undefined;

  return {
    outcome: finalOutcome,
    metersGained: meters,
    contributions,
    summary: notableSummary ?? 'avancée',
    carrier: lastCarrier,
    defender: lastDefender,
  };
}
