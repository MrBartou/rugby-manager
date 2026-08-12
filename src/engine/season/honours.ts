/**
 * Les honneurs de fin de saison — V0.53.
 *
 * `records.ts` tenait le palmarès des clubs et les meilleurs réalisateurs, mais
 * il n'existait **ni meilleur joueur, ni XV de la saison, ni meilleur espoir**.
 * Une année se terminait sur un classement et rien d'autre.
 *
 * C'est le rituel qui manque à la fin d'un exercice, et surtout la récompense
 * du jeu long : sortir un joueur du centre de formation, lui donner du temps de
 * jeu pendant quatre saisons et le voir élu meilleur joueur du championnat,
 * c'est précisément ce qu'on vient chercher dans un jeu de management.
 *
 * ## Ce qui rend un classement crédible
 *
 * Pas les essais. Un troisième ligne qui gratte trente ballons et plaque deux
 * cents fois n'en marque aucun, et il peut être le meilleur joueur de la saison.
 * On note donc **par rapport à son poste** : un ailier est jugé sur ce qu'un
 * ailier produit, un pilier sur ce qu'un pilier produit. Sans cela, le trophée
 * reviendrait chaque année à un ailier, et personne ne regarderait plus.
 */

import type { Player, PlayerId, Position } from '../types.js';

// =============================================================================
// Ce qu'on regarde
// =============================================================================

/** Statistiques cumulées d'un joueur sur la saison. */
export interface HonourStat {
  readonly tries: number;
  readonly matches: number;
  readonly minutes: number;
  readonly tackles: number;
  readonly meters: number;
  readonly turnovers: number;
  readonly defendersBeaten: number;
  readonly lineBreaks: number;
}

export interface HonoursInput {
  /** Tous les joueurs du championnat, clubs adverses compris. */
  readonly players: readonly Player[];
  readonly stats: ReadonlyMap<PlayerId, HonourStat>;
  readonly currentSeason: number;
  /** Nombre de journées disputées, pour exiger une présence minimale. */
  readonly roundsPlayed: number;
  readonly clubNameOf: (player: Player) => string;
}

/**
 * Part des journées à avoir disputée pour être éligible.
 *
 * Sans ce seuil, un joueur revenu de blessure pour trois matchs énormes
 * raflerait le trophée devant celui qui a tenu la saison entière. C'est la
 * règle de tous les vrais trophées, et elle a la même raison d'être.
 */
const MIN_PRESENCE = 0.5;

// =============================================================================
// La note
// =============================================================================

type Line = 'PREMIERE_LIGNE' | 'DEUXIEME_LIGNE' | 'TROISIEME_LIGNE' | 'CHARNIERE' | 'TROIS_QUARTS';

function lineOf(position: Position): Line {
  switch (position) {
    case 'PILIER_GAUCHE': case 'TALONNEUR': case 'PILIER_DROIT':
      return 'PREMIERE_LIGNE';
    case 'DEUXIEME_LIGNE_GAUCHE': case 'DEUXIEME_LIGNE_DROITE':
      return 'DEUXIEME_LIGNE';
    case 'TROISIEME_LIGNE_AILE_GAUCHE': case 'TROISIEME_LIGNE_AILE_DROITE': case 'NUMERO_8':
      return 'TROISIEME_LIGNE';
    case 'DEMI_DE_MELEE': case 'OUVREUR':
      return 'CHARNIERE';
    default:
      return 'TROIS_QUARTS';
  }
}

/**
 * Poids de chaque statistique selon la ligne.
 *
 * C'est tout le module : on ne compare pas un pilier à un ailier, on compare
 * chacun à ce que son poste réclame.
 *
 * ## Calés sur ce que le moteur produit réellement
 *
 * Première version écrite au jugé, sur des ordres de grandeur inventés — mille
 * quatre cents mètres pour un ailier, deux cents plaquages pour un troisième
 * ligne. Mesuré sur vingt-six matchs, le moteur produit tout autre chose, par
 * joueur et par saison :
 *
 * | ligne | essais | plaquages | grattages | mètres | battus | franchis |
 * |---|---|---|---|---|---|---|
 * | 1ʳᵉ ligne | 0,8 | 28,3 | 0,3 | 37,7 | 2,3 | 0,4 |
 * | 2ᵉ ligne | 2,3 | 36,2 | 0,3 | 71,5 | 4,7 | 1,3 |
 * | 3ᵉ ligne | 2,0 | 39,0 | 0,4 | 87,8 | 5,4 | 0,8 |
 * | charnière | 3,4 | 8,0 | 0,0 | 39,6 | 2,8 | 0,6 |
 * | trois-quarts | 5,0 | 14,8 | 0,2 | 85,7 | 4,3 | 0,9 |
 *
 * Les poids ci-dessous sont réglés pour qu'un joueur **moyen** de chaque ligne
 * sorte entre 8 et 12 de note. C'est la condition pour que le trophée puisse
 * revenir à un pilier ; sans elle, il irait chaque année à un ailier et
 * personne ne le regarderait plus.
 *
 * À noter, et c'est une limite du moteur plus que du barème : le grattage
 * individuel est quasi inexistant (0,3 par saison). Le poids qu'on lui donne ne
 * départage donc presque personne aujourd'hui — il est là pour le jour où le
 * ruck produira des turnovers nominatifs.
 */
const WEIGHTS: Readonly<Record<Line, Readonly<Record<keyof Omit<HonourStat, 'matches' | 'minutes'>, number>>>> = {
  PREMIERE_LIGNE: { tries: 15, tackles: 4.0, turnovers: 15, meters: 0.70, defendersBeaten: 4, lineBreaks: 8 },
  DEUXIEME_LIGNE: { tries: 12, tackles: 3.0, turnovers: 15, meters: 0.50, defendersBeaten: 4, lineBreaks: 6 },
  TROISIEME_LIGNE: { tries: 12, tackles: 2.8, turnovers: 18, meters: 0.50, defendersBeaten: 4, lineBreaks: 7 },
  CHARNIERE: { tries: 14, tackles: 6.0, turnovers: 15, meters: 1.20, defendersBeaten: 6, lineBreaks: 12 },
  TROIS_QUARTS: { tries: 12, tackles: 4.0, turnovers: 15, meters: 0.90, defendersBeaten: 6, lineBreaks: 12 },
};

/**
 * Note de saison d'un joueur, à son poste.
 *
 * Ramenée **au match disputé** : celui qui a joué vingt-six journées ne doit pas
 * l'emporter sur le seul volume, sinon le trophée récompenserait la résistance
 * aux blessures plutôt que le talent.
 */
export function seasonRating(player: Player, stat: HonourStat): number {
  if (stat.matches === 0) return 0;
  const w = WEIGHTS[lineOf(player.position)];
  const total =
    stat.tries * w.tries +
    stat.tackles * w.tackles +
    stat.turnovers * w.turnovers +
    stat.meters * w.meters +
    stat.defendersBeaten * w.defendersBeaten +
    stat.lineBreaks * w.lineBreaks;
  return Math.round((total / stat.matches) * 10) / 10;
}

// =============================================================================
// Les trophées
// =============================================================================

export interface Laureate {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly clubName: string;
  readonly position: Position;
  /** Ce qui lui a valu le trophée, en clair. */
  readonly line: string;
}

export interface SeasonHonours {
  readonly season: number;
  readonly bestPlayer: Laureate | undefined;
  readonly bestYoungPlayer: Laureate | undefined;
  readonly topTryScorer: Laureate | undefined;
  /** Le XV type, un joueur par poste. */
  readonly teamOfTheSeason: readonly Laureate[];
}

const EMPTY: SeasonHonours = {
  season: 0,
  bestPlayer: undefined,
  bestYoungPlayer: undefined,
  topTryScorer: undefined,
  teamOfTheSeason: [],
};

const ALL_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT', 'ARRIERE',
];

function ageOf(player: Player, season: number): number {
  return season - Number(player.birthDate.slice(0, 4));
}

/**
 * Les honneurs d'une saison.
 *
 * Renvoie des trophées vides plutôt que d'inventer un lauréat quand personne
 * n'a assez joué : une cérémonie sans candidat crédible vaut mieux qu'un
 * trophée décerné à un joueur qui a disputé deux matchs.
 */
export function computeHonours(input: HonoursInput): SeasonHonours {
  const minMatches = Math.max(1, Math.floor(input.roundsPlayed * MIN_PRESENCE));

  const rated = input.players
    .filter(p => !p.retired)
    .map(p => ({ player: p, stat: input.stats.get(p.id) }))
    .filter((e): e is { player: Player; stat: HonourStat } => e.stat !== undefined)
    .filter(e => e.stat.matches >= minMatches)
    .map(e => ({ ...e, rating: seasonRating(e.player, e.stat) }))
    .sort((a, b) => b.rating - a.rating);

  if (rated.length === 0) return { ...EMPTY, season: input.currentSeason };

  const laureate = (
    e: { player: Player; stat: HonourStat; rating: number },
    line: string,
  ): Laureate => ({
    playerId: e.player.id,
    playerName: `${e.player.firstName} ${e.player.lastName}`,
    clubName: input.clubNameOf(e.player),
    position: e.player.position,
    line,
  });

  const best = rated[0]!;

  // Meilleur espoir : 23 ans ou moins à la fin de la saison.
  const young = rated.find(e => ageOf(e.player, input.currentSeason + 1) <= 23);

  // Meilleur marqueur : là, c'est bien le total brut qui fait foi.
  const scorer = [...rated].sort((a, b) => b.stat.tries - a.stat.tries)[0];

  // XV type : le meilleur à chaque poste, jamais deux fois le même homme.
  const taken = new Set<PlayerId>();
  const team: Laureate[] = [];
  for (const position of ALL_POSITIONS) {
    const pick = rated.find(e => e.player.position === position && !taken.has(e.player.id));
    if (!pick) continue;
    taken.add(pick.player.id);
    team.push(laureate(pick, `${pick.rating} de moyenne`));
  }

  return {
    season: input.currentSeason,
    bestPlayer: laureate(best, `${best.rating} de moyenne sur ${best.stat.matches} matchs`),
    ...(young ? {
      bestYoungPlayer: laureate(
        young,
        `${ageOf(young.player, input.currentSeason + 1)} ans, ${young.stat.matches} matchs disputés`,
      ),
    } : { bestYoungPlayer: undefined }),
    ...(scorer && scorer.stat.tries > 0 ? {
      topTryScorer: laureate(
        scorer,
        `${scorer.stat.tries} essai${scorer.stat.tries > 1 ? 's' : ''}`,
      ),
    } : { topTryScorer: undefined }),
    teamOfTheSeason: team,
  };
}

/** Ce qu'un palmarès personnel retient d'une saison. */
export interface PlayerHonour {
  readonly season: number;
  readonly label: string;
}

/** Distinctions d'un joueur donné, pour sa fiche. */
export function honoursOf(
  history: readonly SeasonHonours[],
  playerId: PlayerId,
): readonly PlayerHonour[] {
  const out: PlayerHonour[] = [];
  for (const h of history) {
    if (h.bestPlayer?.playerId === playerId) {
      out.push({ season: h.season, label: 'Meilleur joueur du championnat' });
    }
    if (h.bestYoungPlayer?.playerId === playerId) {
      out.push({ season: h.season, label: 'Meilleur espoir' });
    }
    if (h.topTryScorer?.playerId === playerId) {
      out.push({ season: h.season, label: 'Meilleur marqueur' });
    }
    if (h.teamOfTheSeason.some(l => l.playerId === playerId)) {
      out.push({ season: h.season, label: 'XV de la saison' });
    }
  }
  return out;
}
