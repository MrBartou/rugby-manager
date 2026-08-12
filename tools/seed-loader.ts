/**
 * Entrée seed côté Node — lit les CSV sur disque et délègue le parsing à `src/data/seed.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSeedData,
  listClubsFromSeed,
  makeMatchInputFromSeed,
  type MatchSeedOptions,
  type SeedData,
} from '../src/data/seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

let cached: SeedData | undefined;

export function loadSeed(): SeedData {
  if (cached) return cached;
  const clubsCsv = readFileSync(resolve(DATA_DIR, 'clubs.csv'), 'utf8');
  const playersCsv = readFileSync(resolve(DATA_DIR, 'players.csv'), 'utf8');
  cached = buildSeedData(clubsCsv, playersCsv);
  return cached;
}

export function listClubs(): ReturnType<typeof listClubsFromSeed> {
  return listClubsFromSeed(loadSeed());
}

export function makeMatchInputFromSeedNode(opts: MatchSeedOptions): ReturnType<typeof makeMatchInputFromSeed> {
  return makeMatchInputFromSeed(loadSeed(), opts);
}

// Alias pour compat avec play-match.ts
export { makeMatchInputFromSeedNode as makeMatchInputFromSeed };
