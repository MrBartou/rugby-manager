/**
 * Les nations, et le match qu'on leur joue (V0.63).
 *
 * La V0.58 a donné au jeu un vrai XV de France : un groupe de trente-trois, des
 * capes, des résultats. Mais les résultats étaient **estimés** : un score tiré
 * de l'écart de force entre la France et un nombre fixe attaché à l'adversaire.
 * Le module l'assumait dans son en-tête : « il faudrait construire cinq
 * effectifs étrangers complets pour une information qui tient en une ligne de
 * score ».
 *
 * Cette phrase n'est plus vraie depuis que la coupe d'Europe a besoin des mêmes
 * effectifs (`foreign-players.ts`). Ce qui coûtait cher est déjà écrit, et ce
 * qu'on gagne à jouer les matchs pour de vrai est exactement ce qui manquait à
 * une carrière internationale :
 *
 *  - **des performances**, pas seulement une présence. Un joueur revient du
 *    Tournoi avec des essais, des plaquages, une note ;
 *  - **des capes méritées** : on n'en compte plus une par joueur convoqué, mais
 *    une par joueur réellement sur la feuille des vingt-trois. Vingt-huitième
 *    du groupe, on rentre sans cape, comme dans la vraie vie ;
 *  - **des blessures en bleu**, qui font mal parce qu'elles arrivent au club
 *    par une porte que le manager ne contrôle pas.
 *
 * ## Ce que le module ne fait pas
 *
 * Il ne simule pas le Tournoi des autres : on ne joue que les matchs de la
 * France. Le classement final se lit dans ses résultats, pas dans une table de
 * cinq nations qui s'affrontent entre elles : personne ne regarderait
 * Italie-Écosse, et le coût serait le même que celui du reste du Tournoi réuni.
 */

import { suggestCaptain } from '../match/captain.js';
import type { MatchInput, MatchSquad, RosterEntry } from '../match/types.js';
import type { Club, ClubId, MatchId, Player, PlayerId, Position } from '../types.js';
import {
  BENCH_POSITIONS,
  STARTER_POSITIONS,
  buildForeignSheet,
  type ForeignCountry,
} from './foreign-players.js';
import type { Nation } from './national-team.js';

// =============================================================================
// L'adversaire
// =============================================================================

/**
 * Le pays d'origine des joueurs de chaque sélection.
 *
 * Les nations du Tournoi portent le nom de leur pays ; celles de la tournée
 * d'automne viennent de l'hémisphère sud, dont les patronymes n'existaient pas
 * avant la V0.63.
 */
const COUNTRY_OF_NATION: Readonly<Record<string, ForeignCountry>> = {
  IRL: 'IRLANDE',
  ENG: 'ANGLETERRE',
  SCO: 'ECOSSE',
  WAL: 'PAYS_DE_GALLES',
  ITA: 'ITALIE',
  RSA: 'AFRIQUE_DU_SUD',
  NZL: 'NOUVELLE_ZELANDE',
  AUS: 'AUSTRALIE',
  ARG: 'ARGENTINE',
};

/**
 * La sélection adverse, telle qu'elle se présente cette année-là.
 *
 * Persistante comme un club européen : la graine ne dépend pas de la saison,
 * donc l'Irlande de cette année est celle de l'an dernier, vieillie d'un an.
 * C'est ce qui permet de dire qu'on a « déjà battu ce dix d'ouverture ».
 */
export function buildNationSquad(input: {
  readonly nation: Nation;
  readonly currentSeason: number;
  readonly careerStartSeason: number;
}): { readonly squad: MatchSquad; readonly players: readonly Player[] } {
  const country = COUNTRY_OF_NATION[input.nation.id] ?? 'ANGLETERRE';
  const clubId = `nat_${input.nation.id.toLowerCase()}` as ClubId;

  const sheet = buildForeignSheet({
    clubId,
    country,
    strength: input.nation.strength,
    squadSeed: `nation_${input.nation.id}`,
    currentSeason: input.currentSeason,
    foundedSeason: input.careerStartSeason,
    // Une sélection nationale n'a pas de banc au rabais : ses remplaçants sont
    // les vingt-troisièmes meilleurs joueurs d'un pays, pas des doublures de
    // club.
    benchDrop: 2,
  });

  const starters: RosterEntry[] = sheet.starters.map(p => ({
    playerId: p.id,
    position: p.position,
    captainArmband: false,
  }));
  const captain = suggestCaptain(sheet.starters);
  if (captain) {
    const idx = starters.findIndex(e => e.playerId === captain.id);
    if (idx >= 0) starters[idx] = { ...starters[idx]!, captainArmband: true };
  }

  return {
    squad: {
      clubId,
      starters,
      substitutes: sheet.substitutes.map(p => ({
        playerId: p.id,
        position: p.position,
        captainArmband: false,
      })),
    },
    players: sheet.players,
  };
}

// =============================================================================
// Le XV de France
// =============================================================================

export interface FranceSheet {
  readonly squad: MatchSquad;
  /** Les vingt-trois retenus pour ce match : ceux-là seuls prennent une cape. */
  readonly matchdayIds: readonly PlayerId[];
  readonly starterIds: readonly PlayerId[];
}

/**
 * Compose le XV de départ et le banc dans le groupe convoqué.
 *
 * Le classement du sélectionneur (`selectionScore`) est déjà fait : on le
 * reçoit trié, et on remplit chaque poste avec le mieux classé qui peut
 * l'occuper. Le tri par rotation décale la liste d'un match à l'autre : un
 * groupe de trente-trois qui jouerait cinq fois le même XV n'aurait aucune
 * raison d'être de trente-trois.
 */
export function buildFranceSheet(input: {
  /** Le groupe, du mieux classé au moins bien classé. */
  readonly ranked: readonly Player[];
  readonly clubId: ClubId;
  /** Numéro du match dans la fenêtre, pour faire tourner. */
  readonly matchIndex: number;
}): FranceSheet {
  const used = new Set<PlayerId>();
  const starters: RosterEntry[] = [];

  const pickFor = (position: Position, skip: number): Player | undefined => {
    const fits = input.ranked.filter(p => !used.has(p.id) && canPlay(p, position));
    if (fits.length === 0) {
      return input.ranked.find(p => !used.has(p.id));
    }
    // La rotation prend le second homme du poste quand il y en a un : c'est
    // ainsi qu'un groupe entier joue une fenêtre, et non quinze joueurs.
    return fits[Math.min(skip, fits.length - 1)];
  };

  for (const position of STARTER_POSITIONS) {
    const player = pickFor(position, input.matchIndex % 2);
    if (!player) continue;
    used.add(player.id);
    starters.push({ playerId: player.id, position, captainArmband: false });
  }

  const captain = suggestCaptain(
    starters.map(s => input.ranked.find(p => p.id === s.playerId)).filter((p): p is Player => p !== undefined),
  );
  if (captain) {
    const idx = starters.findIndex(e => e.playerId === captain.id);
    if (idx >= 0) starters[idx] = { ...starters[idx]!, captainArmband: true };
  }

  const substitutes: RosterEntry[] = [];
  for (const position of BENCH_POSITIONS) {
    const player = pickFor(position, 0);
    if (!player) continue;
    used.add(player.id);
    substitutes.push({ playerId: player.id, position, captainArmband: false });
  }

  const starterIds = starters.map(s => s.playerId);
  return {
    squad: { clubId: input.clubId, starters, substitutes },
    matchdayIds: [...starterIds, ...substitutes.map(s => s.playerId)],
    starterIds,
  };
}

/** Un joueur peut-il tenir ce poste ? Son poste principal, ou l'un des seconds. */
function canPlay(player: Player, position: Position): boolean {
  return player.position === position || player.secondaryPositions.includes(position);
}

// =============================================================================
// Le match
// =============================================================================

/** Le club fictif sous lequel le moteur enregistre le XV de France. */
export const FRANCE_NATIONAL_CLUB = 'nat_fra' as ClubId;

/** Le maillot bleu, vu par le moteur : un club comme un autre. */
export function franceClub(): Club {
  return {
    id: FRANCE_NATIONAL_CLUB,
    name: 'France',
    shortName: 'FRA',
    city: 'Saint-Denis',
    tier: 'GROS_BUDGET',
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 80_000,
    annualBudget: 0,
    salaryCapUsage: 0,
    jiffCount: 33,
    reputation: 82,
  };
}

function nationClub(nation: Nation): Club {
  return {
    id: `nat_${nation.id.toLowerCase()}` as ClubId,
    name: nation.name,
    shortName: nation.id,
    city: nation.name,
    tier: 'GROS_BUDGET',
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 60_000,
    annualBudget: 0,
    salaryCapUsage: 0,
    jiffCount: 23,
    reputation: nation.strength,
  };
}

export interface InternationalMatchInput {
  readonly nation: Nation;
  readonly france: FranceSheet;
  readonly francePlayers: readonly Player[];
  readonly nationSquad: { readonly squad: MatchSquad; readonly players: readonly Player[] };
  readonly atHome: boolean;
  readonly matchId: string;
}

/**
 * Assemble le `MatchInput` d'un test international.
 *
 * Un stade national se remplit toujours : c'est la seule différence de fond
 * avec une affiche de club, et elle joue dans le moteur depuis la V0.58.
 */
export function buildInternationalMatchInput(input: InternationalMatchInput): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  for (const p of input.francePlayers) playersById.set(p.id, p);
  for (const p of input.nationSquad.players) playersById.set(p.id, p);

  const plan = {
    occupation: 'MEDIANE',
    defensiveLine: 'RIDEAU',
    setPiecesFocus: ['NONE'],
  } as const;

  const franceSide = { squad: input.france.squad, tacticalPlan: plan, liveMoments: [] };
  const nationSide = { squad: input.nationSquad.squad, tacticalPlan: plan, liveMoments: [] };

  return {
    matchId: input.matchId as MatchId,
    home: input.atHome ? franceSide : nationSide,
    away: input.atHome ? nationSide : franceSide,
    playersById,
    weather: 'SEC',
    fieldCondition: 'BON',
    homeAdvantageBonus: 1.0,
    homeFans: 'BEAUCOUP',
    homeClub: input.atHome ? franceClub() : nationClub(input.nation),
    awayClub: input.atHome ? nationClub(input.nation) : franceClub(),
    playerSide: input.atHome ? 'HOME' : 'AWAY',
  };
}
