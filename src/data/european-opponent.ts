/**
 * Construction d'un adversaire européen jouable (V0.13, réécrit en V0.63).
 *
 * Ce module fabrique la feuille de match d'un club européen pour que le moteur
 * puisse jouer la rencontre comme n'importe quelle autre.
 *
 * ## Ce qui a changé en V0.63
 *
 * Les joueurs eux-mêmes ne sont plus fabriqués ici : ils viennent de
 * `engine/season/foreign-players.ts`, qui sert aussi les nations du XV de
 * France et le marché international. Ce fichier n'assemble plus qu'un
 * `MatchInput`, et c'est bien à ce titre qu'il vit dans `data/`.
 *
 * Surtout, l'effectif est désormais **stable d'une saison à l'autre** quand
 * l'adversaire vient du monde européen persistant : sa graine d'effectif ne
 * dépend plus de la saison, seulement de lui. On retrouve les mêmes hommes,
 * un an de plus, avec un ou deux nouveaux visages.
 */

import { suggestCaptain } from '../engine/match/captain.js';
import { buildForeignSheet } from '../engine/season/foreign-players.js';
import type { EuropeanOpponent } from '../engine/season/european-cup.js';
import type { HomeWeeklyModifiers, MatchInput, MatchSquad, RosterEntry } from '../engine/match/types.js';
import type { Club, ClubId, MatchId, Player, PlayerId } from '../engine/types.js';

export interface EuropeanSquad {
  readonly squad: MatchSquad;
  readonly players: readonly Player[];
}

/**
 * Construit la feuille de match complète (15 + 8) d'un adversaire européen.
 *
 * Déterministe. Pour un club du monde persistant, le résultat ne dépend que du
 * club et de la saison : même adversaire, même effectif, vieilli d'un an.
 */
export function buildEuropeanSquad(
  opponent: EuropeanOpponent,
  seed: string,
  currentSeason: number,
): EuropeanSquad {
  const sheet = buildForeignSheet({
    clubId: opponent.id,
    country: opponent.country,
    strength: opponent.strength,
    // Sans graine d'effectif (sauvegarde antérieure à la V0.63), on retombe
    // sur l'ancien comportement : un effectif lié à la saison en cours.
    squadSeed: opponent.squadSeed ?? `${opponent.id as string}_${seed}`,
    currentSeason,
    foundedSeason: opponent.foundedSeason ?? currentSeason,
  });

  const starters: RosterEntry[] = sheet.starters.map(p => ({
    playerId: p.id,
    position: p.position,
    captainArmband: false,
  }));

  // V0.50 : le brassard va au meneur d'hommes du XV, pas à l'ouvreur d'office.
  const euCaptain = suggestCaptain(sheet.starters);
  if (euCaptain) {
    const idx = starters.findIndex(e => e.playerId === euCaptain.id);
    if (idx >= 0) starters[idx] = { ...starters[idx]!, captainArmband: true };
  }

  const substitutes: RosterEntry[] = sheet.substitutes.map(p => ({
    playerId: p.id,
    position: p.position,
    captainArmband: false,
  }));

  return {
    squad: { clubId: opponent.id as ClubId, starters, substitutes },
    players: sheet.players,
  };
}

// =============================================================================
// Construction du MatchInput européen
// =============================================================================

/**
 * Assemble un `MatchInput` complet pour un match de coupe d'Europe.
 *
 * Le club du joueur fournit ses vrais joueurs et sa compo ; l'adversaire est
 * reconstruit depuis sa graine. Le moteur ne voit aucune différence avec un
 * match de Top 14.
 */
export function buildEuropeanMatchInput(opts: {
  readonly opponent: EuropeanOpponent;
  readonly playerClub: Club;
  readonly playerSquad: MatchSquad;
  readonly playerPlayers: readonly Player[];
  readonly atHome: boolean;
  readonly matchId: string;
  readonly seed: string;
  readonly currentSeason: number;
  readonly weeklyModifiers?: HomeWeeklyModifiers;
}): MatchInput & { readonly homeClub: Club; readonly awayClub: Club } {
  const opponentSquad = buildEuropeanSquad(opts.opponent, opts.seed, opts.currentSeason);

  const playersById = new Map<PlayerId, Player>();
  for (const p of opts.playerPlayers) playersById.set(p.id, p);
  for (const p of opponentSquad.players) playersById.set(p.id, p);

  const opponentClub: Club = {
    id: opts.opponent.id,
    name: opts.opponent.name,
    shortName: opts.opponent.name.slice(0, 3).toUpperCase(),
    city: opts.opponent.city,
    tier: opts.opponent.strength >= 70 ? 'GROS_BUDGET' : opts.opponent.strength >= 58 ? 'BUDGET_MOYEN' : 'PETIT_BUDGET',
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 20_000,
    annualBudget: 20_000_000,
    salaryCapUsage: 0,
    jiffCount: 0,
    reputation: opts.opponent.strength,
  };

  const plan = {
    occupation: 'MEDIANE',
    defensiveLine: 'RIDEAU',
    setPiecesFocus: ['NONE'],
  } as const;

  const playerSide = { squad: opts.playerSquad, tacticalPlan: plan, liveMoments: [] };
  const opponentSide = { squad: opponentSquad.squad, tacticalPlan: plan, liveMoments: [] };

  return {
    matchId: opts.matchId as MatchId,
    home: opts.atHome ? playerSide : opponentSide,
    away: opts.atHome ? opponentSide : playerSide,
    playersById,
    weather: 'SEC',
    fieldCondition: 'BON',
    // La finale se joue sur terrain neutre : pas d'avantage du terrain.
    homeAdvantageBonus: opts.atHome ? 1.0 : 0.6,
    homeFans: opts.atHome ? 'BEAUCOUP' : 'MOYEN',
    homeClub: opts.atHome ? opts.playerClub : opponentClub,
    awayClub: opts.atHome ? opponentClub : opts.playerClub,
    playerSide: opts.atHome ? 'HOME' : 'AWAY',
    ...(opts.weeklyModifiers
      ? opts.atHome
        ? { homeWeeklyModifiers: opts.weeklyModifiers }
        : { awayWeeklyModifiers: opts.weeklyModifiers }
      : {}),
  };
}
