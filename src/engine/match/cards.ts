/**
 * Cartons jaunes et rouges — V0.8, refondu en V0.52.
 *
 * La V0.8 tirait un carton après coup, pour chaque titulaire, sur une
 * probabilité plate modulée par la discipline et la fatigue. Ce tirage n'avait
 * **aucun lien avec le match qui venait d'être joué** : un joueur pouvait
 * écoper d'un rouge dans une rencontre où il n'avait pas commis une faute, et
 * un match haché ne produisait pas plus de cartons qu'un autre.
 *
 * Depuis la V0.52, les cartons sont sifflés pendant la rencontre, à l'instant
 * de la faute, par l'arbitre du jour — voir [discipline](./discipline.ts) et
 * [referee](./referee.ts). Ce module ne garde que les **suites** : la
 * suspension, et le moral de celui qui a laissé son équipe à quatorze.
 */

import type { Player, PlayerId } from '../types.js';


export type CardType = 'YELLOW' | 'RED';

export interface RolledCard {
  readonly playerId: PlayerId;
  readonly playerLastName: string;
  readonly type: CardType;
}

/**
 * Suites disciplinaires des cartons réellement pris — V0.52.
 *
 * Jusqu'ici, `rollPostMatchCards` tirait une probabilité plate par titulaire,
 * **sans le moindre lien avec ce qui s'était passé sur le terrain** : un joueur
 * pouvait écoper d'un rouge dans un match où il n'avait concédé aucune
 * pénalité, et un match haché n'entraînait aucune sanction.
 *
 * Les cartons sont désormais distribués pendant la rencontre, au moment de la
 * faute. Ce qui reste ici, c'est ce qui s'ensuit : le rouge coûte deux journées
 * de suspension, le jaune ne coûte que le moral.
 */
export function applyMatchCards(input: {
  readonly players: readonly Player[];
  readonly cards: readonly { readonly playerId: PlayerId; readonly color: CardType }[];
  readonly currentRound: number;
}): {
  readonly players: readonly Player[];
  readonly cards: readonly RolledCard[];
} {
  if (input.cards.length === 0) return { players: input.players, cards: [] };

  const byPlayer = new Map<PlayerId, CardType>();
  for (const c of input.cards) {
    // Un rouge écrase un jaune pris plus tôt par le même homme.
    if (c.color === 'RED' || !byPlayer.has(c.playerId)) byPlayer.set(c.playerId, c.color);
  }

  const rolled: RolledCard[] = [];
  const players = input.players.map<Player>(p => {
    const color = byPlayer.get(p.id);
    if (color === undefined) return p;
    rolled.push({ playerId: p.id, playerLastName: p.lastName, type: color });

    if (color === 'RED') {
      return {
        ...p,
        dynamic: {
          ...p.dynamic,
          mood: Math.max(0, p.dynamic.mood - 10),
          suspendedUntilRound: input.currentRound + 2,
        },
      };
    }
    return {
      ...p,
      dynamic: { ...p.dynamic, mood: Math.max(0, p.dynamic.mood - 4) },
    };
  });

  return { players, cards: rolled };
}

/** Lève les suspensions échues — à appeler à chaque incrément de round. */
export function clearExpiredSuspensions(players: readonly Player[], currentRound: number): readonly Player[] {
  return players.map<Player>(p => {
    if (p.dynamic.suspendedUntilRound === undefined) return p;
    if (currentRound < p.dynamic.suspendedUntilRound) return p;
    const { suspendedUntilRound: _drop, ...rest } = p.dynamic;
    return { ...p, dynamic: rest };
  });
}

export function isAvailable(p: Player, currentRound: number): boolean {
  if (p.retired || p.freeAgent || p.dynamic.injury) return false;
  if (p.dynamic.suspendedUntilRound !== undefined && currentRound < p.dynamic.suspendedUntilRound) return false;
  return true;
}
