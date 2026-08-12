/**
 * Entrée seed côté browser — les CSV sont bundlés au build via Vite (`?raw`).
 *
 * Le fichier ne s'exécute jamais en Node (les `?raw` imports ne marchent qu'avec Vite).
 * Pour Node, voir `tools/seed-loader.ts`.
 */

import clubsCsv from '../../data/clubs.csv?raw';
import playersCsv from '../../data/players.csv?raw';
import type { ClubId, Player, PlayerId } from '../engine/types.js';
import { buildProD2Clubs } from '../engine/season/divisions.js';
import {
  autoLineupForClub,
  buildSeedData,
  listClubsFromSeed,
  makeMatchInputFromSeed,
  rosterForClub,
  type ManualLineup,
  type MatchSeedOptions,
} from './seed.js';

export const SEED = buildSeedData(clubsCsv, playersCsv);

/**
 * Couche d'overrides V0.6 — permet à App.tsx d'appliquer les modifications
 * persistées dans le save (retraites, etc.) par-dessus les données CSV de base.
 * Vidée au démarrage de chaque session, repeuplée depuis le save.
 */
const playerOverridesById = new Map<PlayerId, Player>();

export function setPlayerOverrides(overrides: readonly Player[]): void {
  playerOverridesById.clear();
  for (const p of overrides) playerOverridesById.set(p.id, p);
}

export function clearPlayerOverrides(): void {
  playerOverridesById.clear();
}

export const listClubs = (): ReturnType<typeof listClubsFromSeed> => listClubsFromSeed(SEED);

/**
 * Compo et match toujours construits sur l'effectif **réel** : transferts,
 * blessures, suspensions et retraites compris. C'est le seul point qui relie le
 * mercato et l'infirmerie à ce qui se passe sur le terrain.
 */
export function makeMatchInput(opts: MatchSeedOptions): ReturnType<typeof makeMatchInputFromSeed> {
  return makeMatchInputFromSeed(SEED, {
    rosterProvider: listRoster,
    // V0.44 — les clubs de Pro D2 ne sont pas dans le CSV : sans ce
    // fournisseur, tout match les impliquant échouait sur « Club inconnu ».
    clubProvider: (clubId) => PRO_D2_BY_ID.get(clubId),
    ...opts,
  });
}

const PRO_D2_BY_ID = new Map(buildProD2Clubs().map(c => [c.id as string, c]));

/** Liste les ids de clubs disponibles (ordre du CSV). */
export function listClubIds(): readonly string[] {
  return [...SEED.clubs.keys()] as readonly string[];
}

/**
 * Roster actif d'un club.
 *  - applique les overrides (transferts, blessures, contrats)
 *  - filtre les retraités, free agents, et joueurs partis ailleurs (clubId override ≠ clubId demandé)
 *  - inclut les joueurs entrés dans ce club via override (signing free agent, achats)
 */
export function listRoster(clubId: string): readonly Player[] {
  const targetId = clubId as ClubId;
  const result: Player[] = [];
  const seenIds = new Set<string>();

  // Joueurs du SEED de ce club, modifiés par overrides
  for (const seedPlayer of rosterForClub(SEED, clubId)) {
    const overridden = playerOverridesById.get(seedPlayer.id) ?? seedPlayer;
    seenIds.add(seedPlayer.id as string);
    if (overridden.retired) continue;
    if (overridden.freeAgent) continue;
    if (overridden.clubId !== targetId) continue;   // joueur transféré ailleurs
    result.push(overridden);
  }

  // Plus les overrides qui ne sont pas dans le SEED de ce club mais y appartiennent
  // (jeunes générés, free agents signés, joueurs achetés à un autre club)
  for (const [id, p] of playerOverridesById.entries()) {
    if (seenIds.has(id as string)) continue;
    if (p.retired || p.freeAgent) continue;
    if (p.clubId !== targetId) continue;
    result.push(p);
  }

  return result;
}

/**
 * Tous les joueurs de tous les clubs (avec overrides, retraités/free agents inclus).
 * Utilisé pour le rollover et les vues globales (free agents pool, etc.).
 */
export function listAllPlayersWithOverrides(): readonly Player[] {
  const seenIds = new Set<string>();
  const all: Player[] = [];
  for (const clubId of SEED.clubs.keys()) {
    for (const seedPlayer of rosterForClub(SEED, clubId)) {
      const overridden = playerOverridesById.get(seedPlayer.id) ?? seedPlayer;
      seenIds.add(seedPlayer.id as string);
      all.push(overridden);
    }
  }
  // Plus les joueurs entièrement nouveaux (jeunes générés)
  for (const [id, p] of playerOverridesById.entries()) {
    if (seenIds.has(id as string)) continue;
    all.push(p);
  }
  return all;
}

export function autoLineup(clubId: string, unavailable: ReadonlySet<PlayerId> = new Set()): ManualLineup {
  return autoLineupForClub(SEED, clubId, unavailable, listRoster);
}

export type { ManualLineup };
