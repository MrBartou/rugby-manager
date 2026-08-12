/**
 * La carrière d'un joueur — V0.59.
 *
 * Le jeu accumule depuis longtemps tout ce qu'il faut pour raconter une
 * carrière : un centre de formation (V0.39), des prêts (V0.55), une progression
 * qui se paie en minutes (V0.14), des honneurs individuels (V0.53), des capes
 * (V0.58). Et la fiche d'un joueur ne montrait **que la saison en cours**.
 *
 * Un espoir qu'on sort du centre à dix-huit ans, qu'on prête deux saisons,
 * qu'on installe titulaire, qui décroche sa première sélection puis un
 * Brennus, arrivait à trente-quatre ans sans qu'une seule ligne n'en garde
 * trace. Le jeu long n'avait pas de mémoire, donc pas de récompense.
 *
 * ## Une seule source, pas deux
 *
 * `CareerHistory.playerCareerStats` cumulait déjà essais et matchs, et
 * alimentait le tableau des meilleurs marqueurs du club. Ce module le
 * **remplace** plutôt que de vivre à côté : ce projet a déjà payé trois fois le
 * prix de deux sources de vérité pour la même donnée (V0.53, V0.54, V0.55). Les
 * totaux se dérivent des lignes de saison, jamais l'inverse.
 */

import type { ClubId, PlayerId } from '../types.js';

// =============================================================================
// Le registre
// =============================================================================

export interface PlayerSeasonLine {
  readonly season: number;
  readonly clubId: ClubId;
  readonly matches: number;
  readonly minutes: number;
  readonly tries: number;
  /** Sélections gagnées **cette saison-là**, pas en cumul. */
  readonly caps: number;
  /** Titres individuels de la saison — « Meilleur espoir », « XV type »… */
  readonly honours: readonly string[];
  /** Vrai si la saison s'est jouée ailleurs, en prêt. */
  readonly onLoan?: boolean;
  /**
   * V0.60 — nombre de saisons couvertes par la ligne, quand elle en replie
   * plusieurs. Absent vaut une : une ligne ordinaire est une saison.
   */
  readonly seasons?: number;
}

export interface PlayerCareer {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly lines: readonly PlayerSeasonLine[];
}

export type CareerBook = ReadonlyMap<PlayerId, PlayerCareer>;

export const EMPTY_BOOK: CareerBook = new Map();

/**
 * Le tassement d'une carrière achevée : v0.60.
 *
 * Le registre garde une ligne par saison et par joueur, pour tout le rugby
 * français. Sur vingt saisons, cela finit par peser autant que la base joueurs
 * elle-même dans une sauvegarde qui tient sous les cinq mégaoctets du
 * navigateur, toutes parties confondues.
 *
 * Une carrière terminée depuis longtemps ne s'ouvre plus : son détail
 * saison par saison n'est plus lu par personne. On la replie donc en une ligne
 * par club, ce qui ne change rien à ce qui reste consultable : les totaux et
 * les records de club se dérivent de la somme des lignes, et cette somme est
 * exactement préservée. Le repli garde la première saison sous chaque maillot,
 * qui est la seule date qu'on affiche encore.
 *
 * On ne touche jamais aux carrières en cours : c'est leur détail qui fait
 * l'intérêt de la fiche.
 */
export function compactCareer(career: PlayerCareer): PlayerCareer {
  if (career.lines.length <= 1) return career;

  const byClub = new Map<ClubId, PlayerSeasonLine>();
  for (const line of career.lines) {
    const current = byClub.get(line.clubId);
    if (!current) {
      byClub.set(line.clubId, line);
      continue;
    }
    byClub.set(line.clubId, {
      season: Math.min(current.season, line.season),
      clubId: line.clubId,
      seasons: (current.seasons ?? 1) + (line.seasons ?? 1),
      matches: current.matches + line.matches,
      minutes: current.minutes + line.minutes,
      tries: current.tries + line.tries,
      caps: current.caps + line.caps,
      honours: [...current.honours, ...line.honours],
      ...(current.onLoan === true || line.onLoan === true ? { onLoan: true } : {}),
    });
  }

  return {
    ...career,
    lines: [...byClub.values()].sort((a, b) => a.season - b.season),
  };
}

/**
 * Replie les carrières qui n'ont plus rien produit depuis un moment.
 *
 * Le seuil se compte en saisons sans la moindre ligne : un joueur qui n'a plus
 * rien joué depuis trois ans a raccroché, ou n'est plus dans le monde du jeu.
 */
export function compactBook(
  book: CareerBook,
  currentSeason: number,
  idleSeasons: number,
): CareerBook {
  const next = new Map<PlayerId, PlayerCareer>();
  for (const [playerId, career] of book) {
    const derniere = career.lines.reduce((max, l) => Math.max(max, l.season), 0);
    next.set(
      playerId,
      currentSeason - derniere >= idleSeasons ? compactCareer(career) : career,
    );
  }
  return next;
}

// =============================================================================
// Écriture
// =============================================================================

export interface SeasonEntry {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly clubId: ClubId;
  readonly matches: number;
  readonly minutes: number;
  readonly tries: number;
  readonly caps: number;
  readonly honours: readonly string[];
  readonly onLoan?: boolean;
}

/**
 * Consigne une saison écoulée.
 *
 * Une saison sans une seule apparition ni le moindre titre n'est pas
 * consignée : un joueur blessé toute l'année ne doit pas laisser une ligne de
 * zéros dans son palmarès. C'est un registre de ce qui s'est passé, pas un
 * calendrier.
 */
export function recordSeason(
  book: CareerBook,
  season: number,
  entries: readonly SeasonEntry[],
): CareerBook {
  const next = new Map(book);
  for (const e of entries) {
    if (e.matches === 0 && e.caps === 0 && e.honours.length === 0) continue;

    const current = next.get(e.playerId);
    const line: PlayerSeasonLine = {
      season,
      clubId: e.clubId,
      matches: e.matches,
      minutes: e.minutes,
      tries: e.tries,
      caps: e.caps,
      honours: e.honours,
      ...(e.onLoan ? { onLoan: true } : {}),
    };
    // Rejouer une saison déjà consignée la remplace : une intersaison relancée
    // ne doit pas doubler les lignes.
    const lines = [...(current?.lines ?? []).filter(l => l.season !== season), line]
      .sort((a, b) => a.season - b.season);

    next.set(e.playerId, {
      playerId: e.playerId,
      playerName: e.playerName,
      lines,
    });
  }
  return next;
}

// =============================================================================
// Lecture
// =============================================================================

export interface CareerTotals {
  readonly seasons: number;
  readonly matches: number;
  readonly minutes: number;
  readonly tries: number;
  readonly caps: number;
  readonly honours: number;
  readonly clubs: readonly ClubId[];
}

export function careerTotals(career: PlayerCareer | undefined): CareerTotals {
  const empty: CareerTotals = {
    seasons: 0, matches: 0, minutes: 0, tries: 0, caps: 0, honours: 0, clubs: [],
  };
  if (!career) return empty;

  const clubs: ClubId[] = [];
  let matches = 0, minutes = 0, tries = 0, caps = 0, honours = 0, seasons = 0;
  for (const l of career.lines) {
    seasons += l.seasons ?? 1;
    matches += l.matches;
    minutes += l.minutes;
    tries += l.tries;
    caps += l.caps;
    honours += l.honours.length;
    if (!clubs.includes(l.clubId)) clubs.push(l.clubId);
  }
  return { seasons, matches, minutes, tries, caps, honours, clubs };
}

/** Ce qu'un joueur a fait sous un maillot donné — la mémoire du club. */
export function totalsAtClub(career: PlayerCareer, clubId: ClubId): CareerTotals {
  return careerTotals({
    ...career,
    lines: career.lines.filter(l => l.clubId === clubId),
  });
}

export interface ClubRecordHolder {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly value: number;
}

/**
 * Les records du club : le plus de matchs, le plus d'essais.
 *
 * Remplace `topScorersForClub`, qui lisait des totaux cumulés à part. Tout se
 * dérive désormais des lignes de saison.
 */
export function clubLeaders(
  book: CareerBook,
  clubId: ClubId,
  key: 'matches' | 'tries',
  limit = 5,
): readonly ClubRecordHolder[] {
  const out: ClubRecordHolder[] = [];
  for (const career of book.values()) {
    const totals = totalsAtClub(career, clubId);
    const value = key === 'matches' ? totals.matches : totals.tries;
    if (value <= 0) continue;
    out.push({ playerId: career.playerId, playerName: career.playerName, value });
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

// =============================================================================
// Ce qu'on en dit
// =============================================================================

/**
 * L'hommage qu'on lit quand un joueur raccroche.
 *
 * C'est le moment où une carrière prend son sens, et jusqu'ici un joueur
 * disparaissait de l'effectif sans qu'une ligne ne le salue. On ne chiffre que
 * ce qui a été fait : pas de superlatif pour un remplaçant honnête, pas de
 * fausse modestie pour un homme à deux cents matchs.
 */
export function retirementTribute(
  career: PlayerCareer | undefined,
  lastName: string,
): string {
  const t = careerTotals(career);
  if (t.matches === 0) {
    return `${lastName} raccroche sans avoir trouvé sa place.`;
  }

  const parts: string[] = [`${t.matches} match${t.matches > 1 ? 's' : ''}`];
  if (t.tries > 0) parts.push(`${t.tries} essai${t.tries > 1 ? 's' : ''}`);
  if (t.caps > 0) parts.push(`${t.caps} sélection${t.caps > 1 ? 's' : ''} en équipe de France`);

  const palmares = t.honours > 0
    ? ` Il laisse ${t.honours} distinction${t.honours > 1 ? 's' : ''} individuelle${t.honours > 1 ? 's' : ''}.`
    : '';
  const fidelite = t.clubs.length === 1 && t.seasons >= 6
    ? ' Toute sa carrière au même club.'
    : '';

  return `${lastName} raccroche après ${t.seasons} saison${t.seasons > 1 ? 's' : ''} — ${parts.join(', ')}.${palmares}${fidelite}`;
}

/**
 * Reprise d'un cumul antérieur au registre.
 *
 * Les sauvegardes d'avant la V0.59 ne portent qu'un total d'essais et de
 * matchs, sans découpage. On le consigne en une ligne unique attribuée à la
 * saison de reprise, en le marquant pour ce qu'il est : un passé dont on ne
 * connaît que la somme. Inventer un découpage plausible serait pire que de
 * l'admettre.
 */
export function fromLegacyTotals(
  legacy: readonly {
    readonly playerId: PlayerId;
    readonly playerName: string;
    readonly clubId: ClubId;
    readonly tries: number;
    readonly matches: number;
  }[],
  beforeSeason: number,
): CareerBook {
  const book = new Map<PlayerId, PlayerCareer>();
  for (const l of legacy) {
    if (l.matches === 0 && l.tries === 0) continue;
    book.set(l.playerId, {
      playerId: l.playerId,
      playerName: l.playerName,
      lines: [{
        season: beforeSeason,
        clubId: l.clubId,
        matches: l.matches,
        // Les minutes n'ont jamais été cumulées avant la V0.59 : on ne les
        // reconstitue pas à partir des matchs, on les laisse à zéro.
        minutes: 0,
        tries: l.tries,
        caps: 0,
        honours: [],
      }],
    });
  }
  return book;
}
