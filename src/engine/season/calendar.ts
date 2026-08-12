/**
 * Calendrier de saison Top 14 — V0.3 simplifié.
 *
 * Référence : 02-gdd.md, "Boucle saisonnière".
 *
 * V0.3 : round-robin double aller-retour (chaque club joue 2× chaque adversaire).
 * Avec 14 clubs : 13×2 = 26 journées. Chaque journée a 7 matchs.
 *
 * V0.4+ : trêves internationales (Novembre, Tournoi des 6 Nations) où des cadres
 * partent jouer en sélection.
 *
 * Algorithme : circle method (algorithme classique de round-robin).
 */

import type { ClubId } from '../types.js';

export interface ScheduledMatch {
  /** Numéro de la journée (1..26). */
  readonly round: number;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
}

export interface SeasonCalendar {
  /** Total de journées dans la saison régulière. */
  readonly totalRounds: number;
  /** Tous les matchs prévus, dans l'ordre des journées. */
  readonly matches: readonly ScheduledMatch[];
}

/**
 * Génère un calendrier round-robin double pour N clubs.
 * - N=14 → 26 journées de 7 matchs chacune
 * - N pair (sinon on ajoute un "bye" — pas pris en charge en V0.3)
 *
 * Améliorations V0.3.1 :
 *   - Shuffle déterministe des clubs basé sur le seed (chaque saison a un calendrier différent)
 *   - Alternance home/away pour le club pivot (sinon il reçoit toutes les journées du leg 1)
 *   - Le retour inverse home/away par rapport à l'aller
 */
export function generateRoundRobinCalendar(clubIds: readonly ClubId[], seed = 0): SeasonCalendar {
  if (clubIds.length < 2) throw new Error('generateRoundRobinCalendar : il faut au moins 2 clubs');
  if (clubIds.length % 2 !== 0) throw new Error('generateRoundRobinCalendar : nombre de clubs impair non géré (V0.4 ajoutera bye)');

  const N = clubIds.length;
  const halfRounds = N - 1;                 // 13 pour 14 clubs
  const totalRounds = halfRounds * 2;       // 26
  const matchesPerRound = N / 2;            // 7

  // Shuffle déterministe : Fisher-Yates avec seed
  const ids = shuffleSeeded([...clubIds], seed);

  const matches: ScheduledMatch[] = [];

  for (let firstLeg = 0; firstLeg < 2; firstLeg++) {
    const positions = ids.slice();

    for (let r = 0; r < halfRounds; r++) {
      const round = firstLeg * halfRounds + r + 1;

      for (let m = 0; m < matchesPerRound; m++) {
        const a = positions[m];
        const b = positions[N - 1 - m];
        if (!a || !b) continue;

        // Alternance home/away :
        //   - Pour le club pivot (m === 0, position 0 fixée par circle method),
        //     alterner par round pour briser la séquence "tout à domicile sur le leg 1"
        //   - Pour les autres : home = a (premier listed) sur l'aller
        let home: ClubId;
        let away: ClubId;
        if (m === 0) {
          // Pivot : alternance home/away par parité de la journée du leg
          if (r % 2 === 0) { home = a; away = b; }
          else { home = b; away = a; }
        } else {
          // Alternance plus douce sur les autres matchs : on swap selon la parité
          // de (m + r) pour répartir, sans casser le miroir aller/retour
          if ((m + r) % 2 === 0) { home = a; away = b; }
          else { home = b; away = a; }
        }

        // Au retour, on inverse pour que chaque équipe reçoive une fois et se déplace une fois
        if (firstLeg === 1) {
          [home, away] = [away, home];
        }

        matches.push({ round, homeClubId: home, awayClubId: away });
      }

      // Rotation : on garde positions[0] fixe, on fait tourner le reste
      const rotated = [positions[0]!, positions[N - 1]!, ...positions.slice(1, N - 1)];
      for (let i = 0; i < N; i++) positions[i] = rotated[i]!;
    }
  }

  // Post-process : casser les séquences home/away > 2 en swappant des paires
  // aller/retour. Ça préserve le total 13H+13A pour chaque équipe.
  const balanced = rebalanceAlternation(matches, ids, halfRounds, seed);

  return { totalRounds, matches: balanced };
}

// =============================================================================
// Heuristique de réduction des streaks home/away
// =============================================================================

function maxStreakForClub(matches: readonly ScheduledMatch[], club: ClubId): number {
  const seq = matches
    .filter(m => m.homeClubId === club || m.awayClubId === club)
    .sort((a, b) => a.round - b.round)
    .map(m => m.homeClubId === club ? 'H' : 'A');
  let max = 1;
  let cur = 1;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}

function totalStreakBadness(matches: readonly ScheduledMatch[], clubs: readonly ClubId[]): number {
  let total = 0;
  for (const c of clubs) {
    const s = maxStreakForClub(matches, c);
    if (s > 2) total += (s - 2) * (s - 2);   // pénalise quadratiquement
  }
  return total;
}

function swapHomeAway(m: ScheduledMatch): ScheduledMatch {
  return { round: m.round, homeClubId: m.awayClubId, awayClubId: m.homeClubId };
}

/**
 * Itère jusqu'à 300 swaps de paires aller/retour pour réduire les streaks home/away
 * de chaque équipe. Chaque swap inverse home/away dans le match round X ET son miroir
 * (round X + halfRounds), ce qui préserve le total home/away par équipe.
 */
function rebalanceAlternation(
  matches: readonly ScheduledMatch[],
  clubs: readonly ClubId[],
  halfRounds: number,
  seed: number,
): ScheduledMatch[] {
  let current = matches.slice();
  let bestBadness = totalStreakBadness(current, clubs);
  if (bestBadness === 0) return current;

  // RNG simple pour explorer l'espace
  let state = (seed >>> 0) || 1;
  const rng = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const totalRounds = halfRounds * 2;

  for (let iter = 0; iter < 500; iter++) {
    if (bestBadness === 0) break;

    // Pick une journée aléatoire dans le leg 1 pour swapper avec son miroir
    const r1 = 1 + Math.floor(rng() * halfRounds);
    const r2 = r1 + halfRounds;

    // Pick un match dans cette journée
    const r1Matches = current.filter(m => m.round === r1);
    if (r1Matches.length === 0) continue;
    const targetMatch = r1Matches[Math.floor(rng() * r1Matches.length)]!;

    // Trouve son miroir au retour (mêmes 2 clubs, home/away inversés)
    const mirrorIdx = current.findIndex(m =>
      m.round === r2 &&
      m.homeClubId === targetMatch.awayClubId &&
      m.awayClubId === targetMatch.homeClubId
    );
    if (mirrorIdx < 0) continue;
    const targetIdx = current.findIndex(m => m === targetMatch);
    if (targetIdx < 0) continue;

    // Tentative : swap home/away dans les deux matchs
    const tentative = current.slice();
    tentative[targetIdx] = swapHomeAway(targetMatch);
    tentative[mirrorIdx] = swapHomeAway(current[mirrorIdx]!);

    const newBadness = totalStreakBadness(tentative, clubs);
    if (newBadness < bestBadness) {
      current = tentative;
      bestBadness = newBadness;
    }
    void totalRounds;
  }

  return current;
}

// Fisher-Yates déterministe (LCG très simple à partir du seed)
function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  let state = (seed >>> 0) || 1;
  const next = (): number => {
    // LCG (Numerical Recipes)
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Renvoie les matchs d'une journée donnée (1-indexed). */
export function matchesForRound(calendar: SeasonCalendar, round: number): readonly ScheduledMatch[] {
  return calendar.matches.filter(m => m.round === round);
}

/** Renvoie le prochain match programmé pour un club, à partir d'une journée donnée. */
export function nextMatchForClub(
  calendar: SeasonCalendar,
  clubId: ClubId,
  fromRound: number,
): ScheduledMatch | undefined {
  return calendar.matches.find(m =>
    m.round >= fromRound && (m.homeClubId === clubId || m.awayClubId === clubId)
  );
}

// =============================================================================
// Phases finales Top 14
// =============================================================================

export interface PlayoffRounds {
  readonly PLAYOFFS: number;
  readonly SEMIFINALS: number;
  readonly FINAL: number;
}

/**
 * Journées régulières d'un championnat à quatorze clubs.
 *
 * Nommée plutôt qu'écrite en dur : c'est elle qui fixait implicitement les
 * numéros de phases finales partout dans le moteur.
 */
export const TOP14_REGULAR_ROUNDS = 26;

/**
 * Numéros de « round » virtuels des phases finales, au-delà de la saison
 * régulière.
 *
 * Ils étaient figés à 27, 28 et 29 — les trois journées qui suivent un
 * championnat à quatorze clubs. Le jour où la Pro D2 est passée à seize clubs
 * et trente journées, ces numéros sont tombés **au milieu** de sa saison
 * régulière : le moteur ne déclenchait plus jamais ses phases finales, et un
 * manager relégué jouait une saison qui s'arrêtait sans champion.
 *
 * Les phases finales suivent donc désormais la longueur réelle du championnat.
 *
 * Format inchangé : top 6 → barrages (3v6, 4v5), demies (1 vs vainqueur 4/5,
 * 2 vs vainqueur 3/6), finale.
 */
export function playoffRoundsAfter(regularRounds: number): PlayoffRounds {
  return {
    PLAYOFFS: regularRounds + 1,
    SEMIFINALS: regularRounds + 2,
    FINAL: regularRounds + 3,
  };
}

/** Phases finales du Top 14 — le cas de loin le plus courant. */
export const PLAYOFF_ROUNDS: PlayoffRounds = playoffRoundsAfter(TOP14_REGULAR_ROUNDS);

export function isPlayoffRound(round: number, regularRounds = TOP14_REGULAR_ROUNDS): boolean {
  const p = playoffRoundsAfter(regularRounds);
  return round >= p.PLAYOFFS && round <= p.FINAL;
}

export interface PlayoffMatch extends ScheduledMatch {
  /** Étiquette du match (ex : "Barrage 1", "Demi-finale 2", "Finale"). */
  readonly label: string;
}

/** Génère les matchs de barrages à partir du top 6 du classement. */
export function generatePlayoffMatches(
  rankedTop6: readonly ClubId[],
  regularRounds = TOP14_REGULAR_ROUNDS,
): readonly PlayoffMatch[] {
  const round = playoffRoundsAfter(regularRounds).PLAYOFFS;
  if (rankedTop6.length < 6) {
    throw new Error('generatePlayoffMatches: top 6 incomplet');
  }
  // Format Top 14 : 3 reçoit 6, 4 reçoit 5
  const c3 = rankedTop6[2]!;
  const c4 = rankedTop6[3]!;
  const c5 = rankedTop6[4]!;
  const c6 = rankedTop6[5]!;
  return [
    { round, homeClubId: c3, awayClubId: c6, label: 'Barrage 1 (3 vs 6)' },
    { round, homeClubId: c4, awayClubId: c5, label: 'Barrage 2 (4 vs 5)' },
  ];
}

/** Génère les demi-finales : 1 vs vainqueur barrage 2, 2 vs vainqueur barrage 1. */
export function generateSemifinals(
  rankedTop2: readonly ClubId[],
  playoffWinner1: ClubId,
  playoffWinner2: ClubId,
  regularRounds = TOP14_REGULAR_ROUNDS,
): readonly PlayoffMatch[] {
  if (rankedTop2.length < 2) throw new Error('generateSemifinals: top 2 incomplet');
  const round = playoffRoundsAfter(regularRounds).SEMIFINALS;
  const c1 = rankedTop2[0]!;
  const c2 = rankedTop2[1]!;
  return [
    { round, homeClubId: c1, awayClubId: playoffWinner2, label: 'Demi-finale 1' },
    { round, homeClubId: c2, awayClubId: playoffWinner1, label: 'Demi-finale 2' },
  ];
}

/** Finale Top 14 (terrain neutre — Stade de France). */
export function generateFinal(
  semifinalWinner1: ClubId,
  semifinalWinner2: ClubId,
  regularRounds = TOP14_REGULAR_ROUNDS,
): PlayoffMatch {
  return {
    round: playoffRoundsAfter(regularRounds).FINAL,
    homeClubId: semifinalWinner1,
    awayClubId: semifinalWinner2,
    label: 'Finale (Stade de France)',
  };
}
