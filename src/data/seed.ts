/**
 * Chargement des données seed (clubs + joueurs) — logique pure réutilisable browser/Node.
 *
 * Les fonctions de ce module ne dépendent PAS du système de fichiers.
 * - Pour Node : `tools/seed-loader.ts` lit les CSV sur disque et appelle `buildSeedData`
 * - Pour le browser : `src/data/seed-browser.ts` importe les CSV via Vite (`?raw`) et appelle `buildSeedData`
 *
 * Les profils joueurs CSV sont compacts (clubId, nom, position, niveau) et expansés
 * en `Player` complets ici, avec stats cohérentes par poste.
 */

import type {
  Club,
  ClubId,
  ClubTier,
  MatchId,
  Player,
  PlayerId,
  Position,
  TacticalIdentity,
  TraitId,
} from '../engine/types.js';
import type {
  MatchInput,
  MatchSquad,
  PreMatchTacticalPlan,
  RosterEntry,
} from '../engine/match/types.js';
import { planForIdentity } from '../engine/match/tactics.js';
import { applyRole, bestRoleFor, type RoleId } from '../engine/match/roles.js';
import { suggestCaptain } from '../engine/match/captain.js';
import { createRng } from '../engine/rng.js';
import { generateTraitsForPlayer } from '../engine/human/trait-generator.js';

// =============================================================================
// CSV minimaliste (pas de gestion de quotes, suffisant pour notre format)
// =============================================================================

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = headerLine.split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split(',').map(c => c.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const val = cells[j];
      if (key !== undefined) row[key] = val ?? '';
    }
    rows.push(row);
  }
  return rows;
}

// =============================================================================
// Expansion d'un profil joueur compact en Player complet
// =============================================================================

const FORWARDS: ReadonlySet<Position> = new Set<Position>([
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
]);

function clamp(x: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function nameNoise(name: string, salt: number): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  }
  return ((Math.abs(h + salt) % 11) - 5);
}

export interface PlayerCompactRow {
  readonly clubId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly position: Position;
  readonly birthYear: number;
  readonly niveau: number;
  readonly isJiff: boolean;
}

/** Première saison du jeu. Tous les contrats du seed démarrent ici. */
const SEED_SEASON = 2025;

/** Âge au-delà duquel personne ne signe : aucun club n'engage jusqu'à 40 ans. */
const RETIREMENT_HORIZON = 37;

/**
 * Fin de contrat, échelonnée sur quatre saisons.
 *
 * Tous les contrats s'achevaient en 2027. À l'intersaison suivante,
 * `expireContracts` versait près de deux cents joueurs à la rue d'un coup :
 * les clubs IA s'en sortaient grâce à leur prolongation automatique, mais
 * l'effectif de l'utilisateur — qui renouvelle à la main — s'effondrait de 76
 * à 50 de moyenne en une seule intersaison, et ne s'en relevait jamais.
 *
 * Répartition déterministe sur 2026-2029, ce qui ramène la charge à deux ou six
 * dossiers de renouvellement par saison au lieu de la totalité de l'effectif.
 */
function contractEndSeason(row: PlayerCompactRow): number {
  const age = SEED_SEASON - row.birthYear;

  // Hash dédié plutôt que `nameNoise` : celui-ci renvoie -5..5, et un modulo 4
  // sur sa valeur absolue aurait produit deux fois plus de contrats courts.
  const key = `${row.clubId}_${row.firstName}_${row.lastName}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const spread = (h >>> 0) % 4;

  // Répartition uniforme sur 2026-2029, puis correction des seuls cas absurdes.
  //
  // Raccourcir la plage des vétérans paraissait plus fin, mais toutes les
  // tranches d'âge alimentaient alors les premières saisons pendant que seuls
  // les jeunes atteignaient la dernière : la falaise se déplaçait sans
  // disparaître. Ici, seul un joueur qui finirait son contrat après 37 ans est
  // ramené en arrière, ce qui ne concerne qu'une poignée de trentenaires.
  const uniform = SEED_SEASON + 1 + spread;
  const latestReasonable = SEED_SEASON + Math.max(1, RETIREMENT_HORIZON - age);
  return Math.min(uniform, latestReasonable);
}

export function expandPlayer(row: PlayerCompactRow): Player {
  const isFwd = FORWARDS.has(row.position);
  const N = row.niveau;
  const noise = (salt: number): number => nameNoise(row.lastName, salt);

  const technical = {
    passe: clamp(N + noise(1) - (isFwd ? 12 : 0)),
    plaquage: clamp(N + noise(2) + (isFwd ? 5 : 0)),
    jeuAuPiedPlace:
      row.position === 'OUVREUR' ? clamp(N + 12) :
      row.position === 'ARRIERE' ? clamp(N + 5) :
      clamp(N - 25),
    jeuAuPiedDynamique:
      row.position === 'OUVREUR' || row.position === 'DEMI_DE_MELEE' || row.position === 'ARRIERE'
        ? clamp(N + 8) : clamp(N - 12),
    visionDeJeu:
      row.position === 'OUVREUR' || row.position === 'DEMI_DE_MELEE' || row.position === 'ARRIERE'
        ? clamp(N + 6) : clamp(N + noise(3)),
    conservation: clamp(N + (isFwd ? 5 : 0) + noise(4)),
    prisedeballeHaute:
      row.position === 'AILIER_GAUCHE' || row.position === 'AILIER_DROIT' || row.position === 'ARRIERE'
        ? clamp(N + 8) : clamp(N - 5),
    deblayage: isFwd ? clamp(N + 5) : clamp(N - 8),
  };

  const physical = {
    vitesse: isFwd ? clamp(N - 12) : clamp(N + 5),
    puissance: isFwd ? clamp(N + 8) : clamp(N - 3),
    endurance: clamp(N + noise(5)),
    detente:
      row.position === 'DEUXIEME_LIGNE_GAUCHE' || row.position === 'DEUXIEME_LIGNE_DROITE'
        ? clamp(N + 10) : clamp(N - 3),
    robustesse: clamp(N + noise(6)),
  };

  const mental = {
    decision: clamp(N + (row.position === 'OUVREUR' || row.position === 'DEMI_DE_MELEE' ? 8 : 0)),
    leadership: clamp(N + noise(7)),
    sangFroid: clamp(N + noise(8)),
    agressivite: clamp(N + (isFwd ? 5 : 0) + noise(9)),
    professionnalisme: clamp(N + noise(10)),
    discipline: clamp(N + noise(11)),
  };

  const positionSpecific: Player['positionSpecific'] = {};
  if (row.position === 'PILIER_GAUCHE' || row.position === 'PILIER_DROIT') {
    positionSpecific.pousseeMelee = clamp(N + 10);
    positionSpecific.liftEnTouche = clamp(N + 5);
  }
  if (row.position === 'TALONNEUR') {
    positionSpecific.pousseeMelee = clamp(N + 5);
    positionSpecific.qualiteLancer = clamp(N + 12);
  }
  if (row.position === 'DEUXIEME_LIGNE_GAUCHE' || row.position === 'DEUXIEME_LIGNE_DROITE') {
    positionSpecific.pousseeMelee = clamp(N + 8);
    positionSpecific.sautEnTouche = clamp(N + 12);
  }
  if (row.position === 'TROISIEME_LIGNE_AILE_GAUCHE' || row.position === 'TROISIEME_LIGNE_AILE_DROITE' || row.position === 'NUMERO_8') {
    positionSpecific.liftEnTouche = clamp(N + 8);
    positionSpecific.grattage = clamp(N + 10);
  }
  if (row.position === 'DEMI_DE_MELEE') {
    positionSpecific.passeRapide = clamp(N + 10);
  }
  if (row.position === 'AILIER_GAUCHE' || row.position === 'AILIER_DROIT' || row.position === 'ARRIERE') {
    positionSpecific.finition = clamp(N + 5);
    positionSpecific.jeuAerien = clamp(N + 8);
  }

  const id = (`${row.clubId}_${row.firstName}_${row.lastName}`.toLowerCase().replace(/\s+/g, '_')) as PlayerId;

  // Construction du Player avant traits — les traits sont générés à partir des stats
  const playerWithoutTraits: Player = {
    id,
    clubId: row.clubId as ClubId,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: `${row.birthYear}-01-01`,
    position: row.position,
    secondaryPositions: [],
    isJiff: row.isJiff,
    technical,
    physical,
    mental,
    positionSpecific,
    traits: [],
    hidden: { potentiel: clamp(N + 5), ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: {
      startSeason: 2025,
      endSeason: contractEndSeason(row),
      annualSalary: 100_000 + N * 5_000,
    },
  };

  // Génération déterministe des traits depuis hash du nom + niveau (reproductible)
  const traitRng = createRng(`${row.clubId}_${row.firstName}_${row.lastName}_${row.niveau}`);
  const traitIds = generateTraitsForPlayer(playerWithoutTraits, traitRng) as readonly TraitId[];

  return {
    ...playerWithoutTraits,
    traits: traitIds,
  };
}

// =============================================================================
// Construction de SeedData
// =============================================================================

export interface Roster {
  readonly club: Club;
  readonly players: readonly Player[];
}

export interface SeedData {
  readonly clubs: ReadonlyMap<ClubId, Roster>;
}

export function buildSeedData(clubsCsv: string, playersCsv: string): SeedData {
  const clubsRows = parseCsv(clubsCsv);
  const playersRows = parseCsv(playersCsv);

  const clubsById = new Map<ClubId, { club: Club; players: Player[] }>();

  for (const r of clubsRows) {
    const id = r.id as ClubId;
    const club: Club = {
      id,
      name: r.name ?? '',
      shortName: r.shortName ?? '',
      city: r.city ?? '',
      tier: (r.tier ?? 'BUDGET_MOYEN') as ClubTier,
      tacticalIdentity: (r.tacticalIdentity ?? 'MIXTE') as TacticalIdentity,
      stadiumCapacity: Number(r.stadiumCapacity ?? 0),
      annualBudget: Number(r.annualBudget ?? 0),
      salaryCapUsage: Number(r.annualBudget ?? 0) * 0.7,
      jiffCount: 0,
      reputation: Number(r.reputation ?? 50),
    };
    clubsById.set(id, { club, players: [] });
  }

  for (const r of playersRows) {
    const clubId = r.clubId as ClubId;
    const entry = clubsById.get(clubId);
    if (!entry) continue;
    const player = expandPlayer({
      clubId: r.clubId ?? '',
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      position: r.position as Position,
      birthYear: Number(r.birthYear ?? 1995),
      niveau: Number(r.niveau ?? 50),
      isJiff: (r.isJiff ?? 'false') === 'true',
    });
    entry.players.push(player);
  }

  const result = new Map<ClubId, Roster>();
  for (const [id, { club, players }] of clubsById) {
    const jiffCount = players.filter(p => p.isJiff).length;
    result.set(id, { club: { ...club, jiffCount }, players });
  }

  return { clubs: result };
}

// =============================================================================
// Sélection du XV titulaire
// =============================================================================

const STARTER_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

function playerOverall(p: Player): number {
  const t = p.technical;
  const ph = p.physical;
  const m = p.mental;
  return (
    (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5 * 0.4
    + (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4 * 0.3
    + (m.decision + m.sangFroid + m.discipline) / 3 * 0.3
  );
}

function pickStartingFifteen(
  players: readonly Player[],
  unavailable: ReadonlySet<PlayerId> = new Set(),
): { starters: RosterEntry[]; substitutes: RosterEntry[] } {
  const used = new Set<PlayerId>();
  const starters: RosterEntry[] = [];
  // V0.7+0.8 : exclure retraités / free agents / blessés / suspendus / sélectionnés en équipe nationale
  const available = players.filter(p =>
    !p.retired && !p.freeAgent && !p.dynamic.injury &&
    p.dynamic.suspendedUntilRound === undefined &&
    !unavailable.has(p.id),
  );

  for (const position of STARTER_POSITIONS) {
    const candidates = available
      .filter(p => p.position === position && !used.has(p.id))
      .sort((a, b) => playerOverall(b) - playerOverall(a));

    let pick = candidates[0];
    if (!pick) {
      const isFwdSlot = FORWARDS.has(position);
      const fallback = players
        .filter(p => !used.has(p.id) && FORWARDS.has(p.position) === isFwdSlot)
        .sort((a, b) => playerOverall(b) - playerOverall(a));
      pick = fallback[0];
    }
    if (!pick) {
      // Dernier recours : n'importe quel joueur encore libre, avant à l'aile ou
      // ailier en troisième ligne. Un club dont l'effectif s'est creusé à un
      // poste — quatre saisons de mercato et de retraites y suffisent — faisait
      // jusqu'ici **lever une exception non rattrapée** : la journée ne
      // s'avançait plus, sans le moindre message, et la partie était morte.
      // Aligner un joueur hors de son poste est mauvais pour l'équipe ; c'est
      // exactement ce qu'un vrai club ferait, et c'est infiniment préférable à
      // une saison qui se fige.
      pick = players
        .filter(p => !used.has(p.id))
        .sort((a, b) => playerOverall(b) - playerOverall(a))[0];
    }
    if (!pick) {
      throw new Error(
        `pickStartingFifteen: effectif insuffisant (${players.length} joueurs) pour aligner un XV`,
      );
    }
    used.add(pick.id);
    starters.push({
      playerId: pick.id,
      position,
      captainArmband: position === 'OUVREUR' || position === 'DEMI_DE_MELEE',
    });
  }

  const remaining = available
    .filter(p => !used.has(p.id))
    .sort((a, b) => playerOverall(b) - playerOverall(a))
    .slice(0, 8);
  const substitutes: RosterEntry[] = remaining.map(p => ({
    playerId: p.id,
    position: p.position,
    captainArmband: false,
  }));

  return { starters, substitutes };
}

// =============================================================================
// Construction d'un MatchInput depuis SeedData
// =============================================================================

export interface MatchSeedOptions {
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly matchId?: string;
  readonly weather?: MatchInput['weather'];
  readonly fieldCondition?: MatchInput['fieldCondition'];
  readonly homeAdvantageBonus?: number;
  /**
   * V0.58 — niveau de public. Par défaut `MOYEN`, le point neutre : un match
   * libre ou une rencontre auto-simulée ne doit pas hériter d'un stade plein.
   */
  readonly homeFans?: import('../engine/match/crowd.js').CrowdLevel;
  /** Compo override pour HOME (15 titulaires + 8 remplaçants). Sinon auto-pick. */
  readonly homeLineup?: ManualLineup;
  /** Compo override pour AWAY (utilisé pour replay). Sinon auto-pick. */
  readonly awayLineup?: ManualLineup;
  /**
   * V0.31 — effectif réel d'un club, overrides appliqués.
   *
   * Sans lui, la composition d'un match auto-simulé était tirée du CSV brut :
   * un joueur transféré continuait de jouer pour son ancien club et un blessé
   * était aligné comme si de rien n'était. Tout le mercato des clubs IA n'avait
   * donc aucun effet sur le terrain.
   */
  readonly rosterProvider?: (clubId: string) => readonly Player[];
  /**
   * V0.44 — clubs hors CSV.
   *
   * Le seed ne connaît que les quatorze clubs du fichier. Depuis que la Pro D2
   * se joue, un match peut opposer deux clubs qui n'y figurent pas : sans ce
   * fournisseur, la rencontre échouait sur « Club inconnu » et la journée ne
   * s'avançait plus.
   */
  readonly clubProvider?: (clubId: string) => Club | undefined;
  /**
   * V0.32 — plan de match. Absent, il est déduit de l'identité du club : c'est
   * ce qui donne à chaque adversaire une manière de jouer reconnaissable.
   */
  readonly homePlan?: PreMatchTacticalPlan;
  readonly awayPlan?: PreMatchTacticalPlan;
}

export interface ManualLineup {
  readonly starters: readonly { readonly playerId: string; readonly position: Position }[];
  readonly substitutes: readonly string[];
  /** Capitaine (porte le brassard). Optionnel — fallback : OUVREUR titulaire. */
  readonly captainPlayerId?: string;
  /** Buteur explicite. Optionnel — fallback : OUVREUR ou meilleur jeuAuPiedPlace. */
  readonly placeKickerId?: string;
  /**
   * V0.34 — rôle de chaque titulaire, par identifiant de joueur. Absent, le
   * rôle qui met le mieux en valeur le joueur est retenu automatiquement.
   */
  readonly roles?: Readonly<Record<string, RoleId>>;
}

/**
 * Applique son rôle à chaque titulaire.
 *
 * Sans rôle explicite, on retient celui qui met le mieux en valeur le joueur :
 * une équipe composée automatiquement — l'IA, ou le manager qui valide sans
 * rien toucher — doit avoir une identité, pas jouer sans rôles pendant que
 * l'autre en a.
 */
function applyRolesToStarters(
  playersById: Map<PlayerId, Player>,
  starters: readonly RosterEntry[],
  roles: Readonly<Record<string, RoleId>> | undefined,
): void {
  for (const entry of starters) {
    const player = playersById.get(entry.playerId);
    if (!player) continue;
    // Le rôle suit le poste occupé sur la feuille, pas le poste nominal du
    // joueur : un centre aligné à l'aile joue un rôle d'ailier.
    const positioned = player.position === entry.position
      ? player
      : { ...player, position: entry.position };
    const roleId = roles?.[entry.playerId as string] ?? bestRoleFor(positioned);
    if (!roleId) continue;
    playersById.set(entry.playerId, applyRole(positioned, roleId));
  }
}

function buildSquadFromManualLineup(players: readonly Player[], lineup: ManualLineup): { starters: RosterEntry[]; substitutes: RosterEntry[] } {
  const byId = new Map(players.map(p => [p.id, p] as const));
  const defaultCaptainId = suggestCaptain(
    lineup.starters
      .map(e => byId.get(e.playerId as PlayerId))
      .filter((p): p is Player => p !== undefined),
  )?.id as string | undefined;
  const starters: RosterEntry[] = [];
  for (const entry of lineup.starters) {
    const p = byId.get(entry.playerId as PlayerId);
    if (!p) throw new Error(`buildSquadFromManualLineup: joueur introuvable ${entry.playerId}`);
    // V0.50 — à défaut de désignation, le brassard va au plus grand meneur
    // d'hommes du XV, et non plus à l'ouvreur : c'est le poste du meneur de
    // jeu, ce qui n'est pas la même chose.
    const isCaptain = lineup.captainPlayerId
      ? entry.playerId === lineup.captainPlayerId
      : entry.playerId === defaultCaptainId;
    starters.push({ playerId: p.id, position: entry.position, captainArmband: isCaptain });
  }
  const subs: RosterEntry[] = [];
  for (const id of lineup.substitutes) {
    const p = byId.get(id as PlayerId);
    if (!p) continue;
    subs.push({ playerId: p.id, position: p.position, captainArmband: false });
  }
  return { starters, substitutes: subs };
}

export function makeMatchInputFromSeed(
  seed: SeedData,
  opts: MatchSeedOptions,
): MatchInput & { homeClub: Club; awayClub: Club } {
  const clubOf = (clubId: string): Club | undefined =>
    seed.clubs.get(clubId as ClubId)?.club ?? opts.clubProvider?.(clubId);
  const homeClubData = clubOf(opts.homeClubId);
  const awayClubData = clubOf(opts.awayClubId);
  if (!homeClubData) throw new Error(`Club inconnu : ${opts.homeClubId}`);
  if (!awayClubData) throw new Error(`Club inconnu : ${opts.awayClubId}`);

  const rosterOf = opts.rosterProvider ?? ((clubId: string) => rosterForClub(seed, clubId));
  const homePlayers = rosterOf(opts.homeClubId);
  const awayPlayers = rosterOf(opts.awayClubId);

  const homePicks = opts.homeLineup
    ? buildSquadFromManualLineup(homePlayers, opts.homeLineup)
    : pickStartingFifteen(homePlayers);
  const awayPicks = opts.awayLineup
    ? buildSquadFromManualLineup(awayPlayers, opts.awayLineup)
    : pickStartingFifteen(awayPlayers);

  const playersById = new Map<PlayerId, Player>();
  for (const p of homePlayers) playersById.set(p.id, p);
  for (const p of awayPlayers) playersById.set(p.id, p);

  // V0.34 — les rôles s'appliquent aux titulaires, sur la copie du joueur
  // utilisée par le moteur. La fiche du joueur en base n'est jamais touchée :
  // un rôle vaut pour un match, pas pour une carrière.
  applyRolesToStarters(playersById, homePicks.starters, opts.homeLineup?.roles);
  applyRolesToStarters(playersById, awayPicks.starters, opts.awayLineup?.roles);

  const homeSquad: MatchSquad = {
    clubId: homeClubData.id,
    starters: homePicks.starters,
    substitutes: homePicks.substitutes,
    ...(opts.homeLineup?.placeKickerId ? { placeKickerId: opts.homeLineup.placeKickerId as PlayerId } : {}),
  };
  const awaySquad: MatchSquad = {
    clubId: awayClubData.id,
    starters: awayPicks.starters,
    substitutes: awayPicks.substitutes,
    ...(opts.awayLineup?.placeKickerId ? { placeKickerId: opts.awayLineup.placeKickerId as PlayerId } : {}),
  };

  // V0.32 — chaque club joue selon son identité. Un plan codé en dur pour tout
  // le monde rendait Castres et le Stade Français rigoureusement identiques sur
  // le terrain, alors que leur identité était affichée partout dans l'interface.
  const homePlan = opts.homePlan ?? planForIdentity(homeClubData.tacticalIdentity);
  const awayPlan = opts.awayPlan ?? planForIdentity(awayClubData.tacticalIdentity);

  return {
    matchId: (opts.matchId ?? `${homeClubData.id}_vs_${awayClubData.id}`) as MatchId,
    home: {
      squad: homeSquad,
      tacticalPlan: homePlan,
      liveMoments: [],
    },
    away: {
      squad: awaySquad,
      tacticalPlan: awayPlan,
      liveMoments: [],
    },
    playersById,
    weather: opts.weather ?? 'SEC',
    fieldCondition: opts.fieldCondition ?? 'BON',
    homeAdvantageBonus: opts.homeAdvantageBonus ?? 1.0,
    homeFans: opts.homeFans ?? 'MOYEN',
    homeClub: homeClubData,
    awayClub: awayClubData,
  };
}

export function listClubsFromSeed(seed: SeedData): readonly Club[] {
  return Array.from(seed.clubs.values()).map(r => r.club);
}

/** Renvoie l'effectif complet d'un club (utilisé par l'écran de compo). */
export function rosterForClub(seed: SeedData, clubId: string): readonly Player[] {
  return seed.clubs.get(clubId as ClubId)?.players ?? [];
}

/** Renvoie l'auto-pick d'un XV titulaire (point de départ pour la compo manuelle). */
export function autoLineupForClub(
  seed: SeedData,
  clubId: string,
  unavailable: ReadonlySet<PlayerId> = new Set(),
  /** V0.31 — effectif réel, overrides appliqués. Voir `MatchSeedOptions`. */
  rosterProvider?: (clubId: string) => readonly Player[],
): ManualLineup {
  const players = rosterProvider ? rosterProvider(clubId) : rosterForClub(seed, clubId);
  const picks = pickStartingFifteen(players, unavailable);
  return {
    starters: picks.starters.map(s => ({ playerId: s.playerId as string, position: s.position })),
    substitutes: picks.substitutes.map(s => s.playerId as string),
  };
}
