/**
 * L'Europe qui dure (V0.63).
 *
 * Depuis la V0.13, les adversaires européens étaient **régénérés à chaque
 * saison** : quatre inconnus tirés au sort en septembre, oubliés en mai, quatre
 * autres l'année suivante. Une campagne européenne ne pouvait donc rien
 * raconter. Battre Ballymore en poule ne voulait rien dire, parce que Ballymore
 * n'existait pas avant le tirage et n'existerait plus après. Le palmarès de la
 * compétition, lui, n'existait pas du tout : personne ne remportait la coupe
 * d'Europe les années où le club dirigé n'y était pas.
 *
 * Ce module donne à l'Europe ce que le championnat a depuis la V0.9 : une
 * **mémoire**. Trente-deux clubs qui existent en dehors de nous, gardent leur
 * effectif, montent et descendent de niveau, gagnent des titres, et dont on
 * peut dire au bout de dix saisons lequel est le grand club de la décennie.
 *
 * ## Ce qui est persisté, et ce qui ne l'est pas
 *
 * On garde par club : son identité, son niveau, sa forme, sa graine d'effectif
 * et son palmarès. On ne garde **pas** les vingt-trois joueurs eux-mêmes : ils
 * sont reconstruits à l'identique depuis la graine (voir `foreign-players.ts`),
 * vieillissent d'un an par saison et se renouvellent poste par poste.
 *
 * C'est un choix de coût assumé. Stocker sept cent trente-six joueurs
 * étrangers ferait plus que doubler la taille d'une sauvegarde, pour une
 * information que le manager ne voit que quatre-vingts minutes par an, et que
 * la reconstruction déterministe rend de toute façon identique. Ce qu'on
 * perdrait à ne pas les stocker, leurs blessures et leur forme individuelle,
 * n'a jamais existé : le moteur ne simule pas les matchs entre clubs
 * étrangers.
 *
 * ## Le reste du tableau
 *
 * Le club dirigé joue sa campagne pour de vrai, match par match. Les autres
 * sont résolus de façon abstraite, à l'écart de niveau : c'est ce qui permet
 * d'avoir un vainqueur chaque saison sans simuler cent quatre-vingts matchs
 * qu'aucun joueur ne regardera. Et quand le club dirigé est du tableau, son
 * parcours réel **prime** : on ne va pas lui faire perdre en quart une coupe
 * qu'il vient de gagner sur le terrain.
 */

import { createRng } from '../rng.js';
import type { ClubId } from '../types.js';
import {
  CHALLENGE_CUP_QUALIFIED,
  CHAMPIONS_CUP_QUALIFIED,
  EUROPEAN_POOLS,
  summarisePool,
  type CompetitionId,
  type EuropeanCampaign,
  type EuropeanOpponent,
} from './european-cup.js';
import type { ForeignCountry } from './foreign-players.js';

// =============================================================================
// Les clubs
// =============================================================================

export interface EuropeanClubRecord {
  readonly id: ClubId;
  readonly name: string;
  readonly city: string;
  readonly country: ForeignCountry;
  /** Niveau courant, 38-88. Il dérive d'une saison à l'autre. */
  readonly strength: number;
  /**
   * Forme du moment, -6 à +6.
   *
   * Distincte du niveau : un club peut traverser une bonne année sans devenir
   * un grand club, et c'est ce qui rend un tirage jamais tout à fait lisible.
   */
  readonly form: number;
  /** Graine d'effectif, stable pour la vie du club. */
  readonly squadSeed: string;
  /** Saison de fondation : elle donne l'âge des joueurs et leur renouvellement. */
  readonly foundedSeason: number;
  readonly seasonsPlayed: number;
  readonly championsTitles: number;
  readonly challengeTitles: number;
}

export interface EuropeanHonour {
  readonly season: number;
  readonly competition: CompetitionId;
  readonly winnerName: string;
  readonly runnerUpName: string;
  /** Le vainqueur est-il un club français ? */
  readonly frenchWinner: boolean;
}

export interface EuropeanWorld {
  readonly clubs: readonly EuropeanClubRecord[];
  /** Palmarès, de la plus ancienne saison à la plus récente. */
  readonly honours: readonly EuropeanHonour[];
}

export const EMPTY_EUROPEAN_WORLD: EuropeanWorld = { clubs: [], honours: [] };

/**
 * Taille du continent.
 *
 * Trente-deux clubs, c'est ce qu'il faut pour remplir les deux compétitions
 * (dix-huit en coupe majeure, quatorze en Challenge) sans jamais tirer deux
 * fois le même adversaire dans une poule de quatre.
 */
export const EUROPEAN_CLUB_COUNT = 32;

/** Clubs européens (hors français) engagés en coupe majeure. */
export const CHAMPIONS_CUP_EUROPEAN_SLOTS = 18;

const CLUB_SUFFIXES: readonly string[] = ['RFC', 'Rugby', 'Warriors', 'Athletic', 'United', 'Rugby Club'];

/**
 * Peuple l'Europe au premier jour d'une carrière.
 *
 * Une seule fois : ces clubs sont ensuite sauvegardés et vieillissent avec la
 * partie. Les villes sont uniques par construction : deux clubs homonymes dans
 * une poule de quatre trahiraient immédiatement la génération procédurale.
 */
export function createEuropeanWorld(seed: string, currentSeason: number): EuropeanWorld {
  const rng = createRng(`eu_world_${seed}`);
  const clubs: EuropeanClubRecord[] = [];

  const candidates: { country: ForeignCountry; city: string; base: number }[] = [];
  for (const pool of EUROPEAN_POOLS) {
    for (const city of pool.cities) {
      candidates.push({ country: pool.country, city, base: pool.baseStrength });
    }
  }

  for (let i = 0; i < Math.min(EUROPEAN_CLUB_COUNT, candidates.length); i++) {
    const c = candidates[i]!;
    const suffix = CLUB_SUFFIXES[rng.nextInt(0, CLUB_SUFFIXES.length - 1)]!;
    clubs.push({
      id: `eu_${c.city.toLowerCase().replace(/[^a-z]/g, '')}` as ClubId,
      name: `${c.city} ${suffix}`,
      city: c.city,
      country: c.country,
      strength: clampStrength(c.base + rng.nextInt(-9, 9)),
      form: 0,
      squadSeed: `${seed}_${c.city.toLowerCase().replace(/[^a-z]/g, '')}`,
      // Fondés avant le début de la partie : leurs joueurs ont déjà un âge et
      // une ancienneté le jour où on les rencontre pour la première fois.
      foundedSeason: currentSeason - rng.nextInt(0, 5),
      seasonsPlayed: 0,
      championsTitles: 0,
      challengeTitles: 0,
    });
  }

  return { clubs, honours: [] };
}

function clampStrength(v: number): number {
  return Math.max(38, Math.min(88, Math.round(v)));
}

// =============================================================================
// Qui joue quoi
// =============================================================================

/**
 * Répartition des clubs européens entre les deux coupes.
 *
 * Au niveau, et recalculée chaque saison : un club qui progresse finit par
 * monter en coupe majeure, un club qui décline en redescend. C'est la seule
 * conséquence visible du niveau d'un club étranger, et elle suffit à donner au
 * continent un mouvement d'ensemble.
 */
export function competitionOfClub(world: EuropeanWorld, clubId: ClubId): CompetitionId {
  const ranked = rankedClubs(world);
  const index = ranked.findIndex(c => c.id === clubId);
  return index >= 0 && index < CHAMPIONS_CUP_EUROPEAN_SLOTS ? 'CHAMPIONS_CUP' : 'CHALLENGE_CUP';
}

function rankedClubs(world: EuropeanWorld): readonly EuropeanClubRecord[] {
  return [...world.clubs].sort((a, b) => (b.strength - a.strength) || (a.id as string).localeCompare(b.id as string));
}

export function clubsOfCompetition(
  world: EuropeanWorld,
  competition: CompetitionId,
): readonly EuropeanClubRecord[] {
  const ranked = rankedClubs(world);
  return competition === 'CHAMPIONS_CUP'
    ? ranked.slice(0, CHAMPIONS_CUP_EUROPEAN_SLOTS)
    : ranked.slice(CHAMPIONS_CUP_EUROPEAN_SLOTS);
}

/**
 * Traduit un club du monde en adversaire de feuille de match.
 *
 * La force jouée intègre la forme : c'est elle qui fait qu'un même club ne se
 * bat pas de la même façon d'une saison à l'autre.
 */
export function asOpponent(club: EuropeanClubRecord): EuropeanOpponent {
  return {
    id: club.id,
    name: club.name,
    city: club.city,
    country: club.country,
    strength: clampStrength(club.strength + club.form),
    squadSeed: club.squadSeed,
    foundedSeason: club.foundedSeason,
  };
}

/**
 * Les quatre adversaires de poule du club dirigé.
 *
 * Tirés dans sa compétition, distincts, et **stables pour la saison** : le
 * tirage au sort a lieu une fois, pas à chaque ouverture d'un écran.
 */
export function drawPoolOpponents(input: {
  readonly world: EuropeanWorld;
  readonly competition: CompetitionId;
  readonly season: number;
  readonly seed: string;
  readonly count: number;
}): readonly EuropeanClubRecord[] {
  const field = clubsOfCompetition(input.world, input.competition);
  if (field.length === 0) return [];
  const rng = createRng(`eu_draw_${input.seed}_${input.season}_${input.competition}`);
  const remaining = [...field];
  const out: EuropeanClubRecord[] = [];
  for (let i = 0; i < input.count && remaining.length > 0; i++) {
    out.push(remaining.splice(rng.nextInt(0, remaining.length - 1), 1)[0]!);
  }
  return out;
}

// =============================================================================
// La saison européenne des autres
// =============================================================================

/** Où s'est arrêté un club, du plus tôt au plus tard. */
export type EuropeanStageOutcome =
  | 'POOL_OUT'
  | 'ROUND_OF_16'
  | 'QUARTERFINAL'
  | 'SEMIFINAL'
  | 'RUNNER_UP'
  | 'WINNER';

const KNOCKOUT_FIELD = 16;

export interface FrenchEntrant {
  readonly clubId: ClubId;
  readonly name: string;
  readonly competition: CompetitionId;
  /** Niveau du club, sur l'échelle des adversaires européens. */
  readonly strength: number;
}

export interface EuropeanSeasonInput {
  readonly world: EuropeanWorld;
  readonly season: number;
  readonly seed: string;
  readonly frenchEntrants: readonly FrenchEntrant[];
  /**
   * Parcours réellement accompli par le club dirigé, quand il jouait la coupe.
   *
   * Il prime sur la simulation abstraite : le tableau doit s'accorder à ce que
   * le manager vient de vivre sur le terrain, jamais l'inverse.
   */
  readonly playerClub?: {
    readonly clubId: ClubId;
    readonly competition: CompetitionId;
    readonly outcome: EuropeanStageOutcome;
  };
}

export interface EuropeanSeasonResult {
  readonly world: EuropeanWorld;
  /** Les deux finales de la saison. */
  readonly honours: readonly EuropeanHonour[];
}

interface Entrant {
  readonly key: string;
  readonly name: string;
  readonly strength: number;
  readonly french: boolean;
}

/**
 * Déroule la saison européenne complète, hors matchs du club dirigé.
 *
 * Appelée à l'intersaison. Elle produit les deux vainqueurs de l'année, met à
 * jour les palmarès et fait dériver le niveau des clubs étrangers.
 */
export function runEuropeanSeason(input: EuropeanSeasonInput): EuropeanSeasonResult {
  const honours: EuropeanHonour[] = [];
  const titles = new Map<string, CompetitionId>();

  for (const competition of ['CHAMPIONS_CUP', 'CHALLENGE_CUP'] as const) {
    const european = clubsOfCompetition(input.world, competition);
    const entrants: Entrant[] = [
      ...european.map(c => ({
        key: c.id as string,
        name: c.name,
        strength: c.strength + c.form,
        french: false,
      })),
      ...input.frenchEntrants
        .filter(e => e.competition === competition)
        .map(e => ({ key: e.clubId as string, name: e.name, strength: e.strength, french: true })),
    ];
    if (entrants.length < 2) continue;

    const forced = input.playerClub?.competition === competition ? input.playerClub : undefined;
    const final = runBracket({
      entrants,
      seed: `${input.seed}_${input.season}_${competition}`,
      ...(forced ? { forced: { key: forced.clubId as string, outcome: forced.outcome } } : {}),
    });
    if (!final) continue;

    honours.push({
      season: input.season,
      competition,
      winnerName: final.winner.name,
      runnerUpName: final.runnerUp.name,
      frenchWinner: final.winner.french,
    });
    if (!final.winner.french) titles.set(final.winner.key, competition);
  }

  const clubs = input.world.clubs.map(club => {
    const title = titles.get(club.id as string);
    return {
      ...club,
      ...driftOf(club, input.season, input.seed),
      seasonsPlayed: club.seasonsPlayed + 1,
      championsTitles: club.championsTitles + (title === 'CHAMPIONS_CUP' ? 1 : 0),
      challengeTitles: club.challengeTitles + (title === 'CHALLENGE_CUP' ? 1 : 0),
    };
  });

  return {
    world: { clubs, honours: [...input.world.honours, ...honours] },
    honours,
  };
}

/**
 * L'évolution d'un club étranger d'une saison à l'autre.
 *
 * Le niveau bouge peu et lentement, un club ne devient pas une puissance en un
 * été ; la forme, elle, bouge beaucoup. Sans ce rappel vers la moyenne, vingt saisons
 * de dérive aléatoire finiraient par écraser tout le continent contre les
 * bornes : trente-deux clubs à 88 ou à 38, et plus aucun tirage intéressant.
 */
function driftOf(
  club: EuropeanClubRecord,
  season: number,
  seed: string,
): { readonly strength: number; readonly form: number } {
  const rng = createRng(`eu_drift_${seed}_${season}_${club.id as string}`);
  const pull = (63 - club.strength) * 0.06;
  return {
    strength: clampStrength(club.strength + pull + rng.nextGaussian(0, 2.2)),
    form: Math.max(-6, Math.min(6, Math.round(rng.nextGaussian(0, 3)))),
  };
}

/**
 * Le tableau final d'une compétition.
 *
 * Seize qualifiés, quatre tours, et l'écart de niveau qui décide de chaque
 * match avec assez de bruit pour qu'un outsider passe de temps en temps. Le
 * club dirigé, lui, ne joue pas ici : son sort est déjà écrit par ses vrais
 * matchs, et on le place au tour où il s'est réellement arrêté.
 */
function runBracket(input: {
  readonly entrants: readonly Entrant[];
  readonly seed: string;
  readonly forced?: { readonly key: string; readonly outcome: EuropeanStageOutcome };
}): { readonly winner: Entrant; readonly runnerUp: Entrant } | undefined {
  const rng = createRng(`eu_bracket_${input.seed}`);
  const forcedKey = input.forced?.key;

  // Qualification : le niveau, plus le hasard d'une phase de poule.
  const ranked = [...input.entrants]
    .map(e => ({ e, score: e.strength + rng.nextGaussian(0, 6) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.e);

  let qualified = ranked.slice(0, Math.min(KNOCKOUT_FIELD, ranked.length));

  if (input.forced) {
    const player = input.entrants.find(e => e.key === forcedKey);
    const out = input.forced.outcome === 'POOL_OUT';
    const inField = qualified.some(e => e.key === forcedKey);
    if (player && out && inField) {
      qualified = qualified.filter(e => e.key !== forcedKey);
      const next = ranked.find(e => !qualified.includes(e) && e.key !== forcedKey);
      if (next) qualified = [...qualified, next];
    } else if (player && !out && !inField) {
      qualified = [...qualified.slice(0, qualified.length - 1), player];
    }
  }

  if (qualified.length < 2) return undefined;

  // Le tour auquel le club dirigé sort : il gagne jusque-là, et perd ce match.
  const exitRound: number | undefined = input.forced && input.forced.outcome !== 'POOL_OUT'
    ? EXIT_ROUND[input.forced.outcome]
    : undefined;

  let round = 0;
  let field = qualified;
  let runnerUp: Entrant | undefined;

  while (field.length > 1) {
    const next: Entrant[] = [];
    for (let i = 0; i + 1 < field.length; i += 2) {
      const a = field[i]!;
      const b = field[i + 1]!;
      const winner = decideTie({ a, b, rng, forcedKey, exitRound, round });
      if (field.length === 2) runnerUp = winner === a ? b : a;
      next.push(winner);
    }
    // Nombre impair : le dernier passe, comme un exempt de tableau.
    if (field.length % 2 === 1) next.push(field[field.length - 1]!);
    field = next;
    round++;
  }

  const winner = field[0];
  if (!winner || !runnerUp) return undefined;
  return { winner, runnerUp };
}

/**
 * Tour auquel un club s'arrête, selon le stade atteint.
 *
 * Un tableau de seize joue quatre tours : huitièmes (0), quarts (1), demies
 * (2), finale (3). « Éliminé en huitièmes » veut donc dire perdu au tour 0.
 */
const EXIT_ROUND: Readonly<Record<Exclude<EuropeanStageOutcome, 'POOL_OUT'>, number | undefined>> = {
  ROUND_OF_16: 0,
  QUARTERFINAL: 1,
  SEMIFINAL: 2,
  RUNNER_UP: 3,
  WINNER: undefined,
};

function decideTie(input: {
  readonly a: Entrant;
  readonly b: Entrant;
  readonly rng: ReturnType<typeof createRng>;
  readonly forcedKey: string | undefined;
  readonly exitRound: number | undefined;
  readonly round: number;
}): Entrant {
  const { a, b, forcedKey } = input;
  if (forcedKey !== undefined && (a.key === forcedKey || b.key === forcedKey)) {
    const player = a.key === forcedKey ? a : b;
    const other = a.key === forcedKey ? b : a;
    // Il gagne tant qu'il n'a pas atteint le tour où il est réellement sorti.
    if (input.exitRound === undefined || input.round < input.exitRound) return player;
    return other;
  }
  const delta = a.strength - b.strength + input.rng.nextGaussian(0, 7);
  return delta >= 0 ? a : b;
}

/**
 * Où s'est arrêté le club dirigé, lu depuis sa campagne réelle.
 *
 * C'est le pont entre les matchs que le manager vient de jouer et le tableau
 * européen qu'on déroule à l'intersaison.
 */
export function outcomeOfCampaign(campaign: EuropeanCampaign): EuropeanStageOutcome {
  const knockouts = campaign.results.filter(r => r.stage !== 'POOL');
  const lost = knockouts.find(r => r.clubScore <= r.opponentScore);
  if (lost) {
    switch (lost.stage) {
      case 'ROUND_OF_16': return 'ROUND_OF_16';
      case 'QUARTERFINAL': return 'QUARTERFINAL';
      case 'SEMIFINAL': return 'SEMIFINAL';
      case 'FINAL': return 'RUNNER_UP';
      default: return 'POOL_OUT';
    }
  }
  if (knockouts.some(r => r.stage === 'FINAL')) return 'WINNER';
  // Qualifié mais tableau inachevé : la saison s'est arrêtée avant, on le
  // classe au dernier tour qu'il a effectivement passé.
  if (summarisePool(campaign).qualified) {
    const reached = knockouts.length;
    return reached >= 3 ? 'SEMIFINAL' : reached === 2 ? 'QUARTERFINAL' : 'ROUND_OF_16';
  }
  return 'POOL_OUT';
}

// =============================================================================
// Lecture
// =============================================================================

/** Palmarès d'un club, tel qu'on l'affiche à côté de son nom. */
export function palmaresLabel(club: EuropeanClubRecord): string | undefined {
  const parts: string[] = [];
  if (club.championsTitles > 0) {
    parts.push(`${club.championsTitles} coupe${club.championsTitles > 1 ? 's' : ''} d'Europe`);
  }
  if (club.challengeTitles > 0) {
    parts.push(`${club.challengeTitles} Challenge${club.challengeTitles > 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Les clubs qui comptent, dans l'ordre du palmarès.
 *
 * C'est la question qu'on se pose au bout de dix saisons : qui a dominé
 * l'Europe pendant que je montais mon club ?
 */
export function europeanRollOfHonour(
  world: EuropeanWorld,
): readonly { readonly name: string; readonly titles: number; readonly challenges: number }[] {
  const fromClubs = world.clubs
    .filter(c => c.championsTitles > 0 || c.challengeTitles > 0)
    .map(c => ({ name: c.name, titles: c.championsTitles, challenges: c.challengeTitles }));

  // Les clubs français ne vivent pas dans ce monde : leurs titres ne sont
  // connus que par le palmarès des finales.
  const french = new Map<string, { titles: number; challenges: number }>();
  for (const h of world.honours) {
    if (!h.frenchWinner) continue;
    const entry = french.get(h.winnerName) ?? { titles: 0, challenges: 0 };
    if (h.competition === 'CHAMPIONS_CUP') entry.titles++;
    else entry.challenges++;
    french.set(h.winnerName, entry);
  }

  return [...fromClubs, ...[...french].map(([name, v]) => ({ name, ...v }))]
    .sort((a, b) => (b.titles - a.titles) || (b.challenges - a.challenges) || a.name.localeCompare(b.name));
}

/** Nombre de places françaises, toutes compétitions confondues. */
export const FRENCH_EUROPEAN_SLOTS = CHAMPIONS_CUP_QUALIFIED + CHALLENGE_CUP_QUALIFIED;
