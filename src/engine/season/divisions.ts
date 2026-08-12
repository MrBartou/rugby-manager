/**
 * Les deux étages du championnat — V0.44.
 *
 * [relegation.ts](./relegation.ts) savait depuis V0.13 reléguer un club et en
 * promouvoir un autre. Ce code n'a **jamais été appelé** : le classement
 * colorait la zone rouge, le tableau de bord avertissait, et à la fin de la
 * saison il ne se passait rien. On pouvait finir quatorzième chaque année sans
 * conséquence, et la Pro D2 n'était qu'un mot dans un message d'alerte.
 *
 * Il manquait surtout un endroit où **tomber**. Une carrière n'avait qu'un
 * plafond — le limogeage — et aucun plancher : rater sa saison coûtait sa
 * place, jamais son club.
 *
 * ## Une seconde division de plein droit
 *
 * La Pro D2 est ici un championnat comme l'autre : quatorze clubs, mêmes
 * journées, mêmes phases finales, mêmes finances. C'est délibéré — la saison
 * entière (calendrier, barrages, demies, finale, économie) fonctionne alors
 * sans une ligne de code spécifique, et un manager relégué continue de jouer
 * exactement comme avant, dans un monde plus pauvre.
 *
 * La vraie Pro D2 compte seize clubs et trente journées. On s'en écarte
 * sciemment : aligner les deux formats évitait de rendre paramétrable tout ce
 * qui, aujourd'hui, suppose vingt-six journées et des phases finales aux
 * journées 27 à 29.
 *
 * ## Le championnat qu'on ne joue pas
 *
 * Simuler match par match les deux divisions doublerait le coût d'une saison
 * pour une information dont on n'a besoin qu'une fois par an : qui monte, qui
 * descend. L'autre étage est donc résolu par un modèle léger — force des
 * effectifs plus aléa — et cela suffit à faire circuler les clubs.
 */

import { createRng, type Rng } from '../rng.js';
import type { Club, ClubId, TacticalIdentity } from '../types.js';

// =============================================================================
// Modèle
// =============================================================================

export type Division = 'TOP14' | 'PRO_D2';

export const DIVISION_LABEL: Readonly<Record<Division, string>> = {
  TOP14: 'Top 14',
  PRO_D2: 'Pro D2',
};

export const DIVISION_SHORT: Readonly<Record<Division, string>> = {
  TOP14: 'T14',
  PRO_D2: 'D2',
};

/** Nombre de clubs par division. Identique aux deux étages, à dessein. */
/**
 * Nombre de clubs par division.
 *
 * Ils n'ont jamais été égaux dans la réalité — le Top 14 en compte quatorze,
 * la Pro D2 seize — et le jeu les confondait, ce qui donnait à la deuxième
 * division un championnat de vingt-six journées au lieu de trente. Une saison
 * de Pro D2 est plus longue qu'une saison de Top 14 : c'est une part de ce qui
 * rend la remontée difficile.
 */
export const TOP14_CLUBS = 14;
export const PRO_D2_CLUBS = 16;


// =============================================================================
// Les clubs de Pro D2
// =============================================================================

interface ProD2Seed {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly city: string;
  readonly reputation: number;
  readonly identity: TacticalIdentity;
}

/**
 * Seize clubs stables d'une saison à l'autre.
 *
 * Ils ne sont pas tirés au hasard chaque année — c'était le défaut du module
 * d'origine, où le promu naissait au moment de monter et n'avait aucun passé.
 * Un club qu'on a battu en Pro D2 doit être le même quand on le retrouve trois
 * saisons plus tard.
 */
const PRO_D2_SEEDS: readonly ProD2Seed[] = [
  { id: 'prod2_brive', name: 'CA Brive', shortName: 'CAB', city: 'Brive', reputation: 52, identity: 'JEU_AVANTS' },
  { id: 'prod2_biarritz', name: 'Biarritz Olympique', shortName: 'BO', city: 'Biarritz', reputation: 50, identity: 'MIXTE' },
  { id: 'prod2_grenoble', name: 'FC Grenoble', shortName: 'FCG', city: 'Grenoble', reputation: 48, identity: 'JEU_AVANTS' },
  { id: 'prod2_oyonnax', name: 'Oyonnax Rugby', shortName: 'OYO', city: 'Oyonnax', reputation: 47, identity: 'DEFENSE_DE_FER' },
  { id: 'prod2_montauban', name: 'US Montauban', shortName: 'USM', city: 'Montauban', reputation: 44, identity: 'JEU_AVANTS' },
  { id: 'prod2_agen', name: 'SU Agen', shortName: 'SUA', city: 'Agen', reputation: 43, identity: 'MIXTE' },
  { id: 'prod2_colomiers', name: 'Colomiers Rugby', shortName: 'COL', city: 'Colomiers', reputation: 42, identity: 'GRAND_ECART' },
  { id: 'prod2_montdemarsan', name: 'Stade Montois', shortName: 'SMR', city: 'Mont-de-Marsan', reputation: 41, identity: 'MIXTE' },
  { id: 'prod2_beziers', name: 'AS Béziers', shortName: 'ASB', city: 'Béziers', reputation: 40, identity: 'JEU_AVANTS' },
  { id: 'prod2_provence', name: 'Provence Rugby', shortName: 'PRO', city: 'Aix-en-Provence', reputation: 40, identity: 'GRAND_ECART' },
  { id: 'prod2_nevers', name: 'USON Nevers', shortName: 'NEV', city: 'Nevers', reputation: 38, identity: 'DEFENSE_DE_FER' },
  { id: 'prod2_valence', name: 'Valence Romans', shortName: 'VRD', city: 'Valence', reputation: 37, identity: 'MIXTE' },
  { id: 'prod2_dax', name: 'US Dax', shortName: 'DAX', city: 'Dax', reputation: 36, identity: 'JEU_AVANTS' },
  { id: 'prod2_angouleme', name: 'Soyaux Angoulême XV', shortName: 'SAX', city: 'Angoulême', reputation: 35, identity: 'MIXTE' },
  { id: 'prod2_aurillac', name: 'Stade Aurillacois', shortName: 'AUR', city: 'Aurillac', reputation: 34, identity: 'DEFENSE_DE_FER' },
  { id: 'prod2_carcassonne', name: 'US Carcassonne', shortName: 'USC', city: 'Carcassonne', reputation: 33, identity: 'DEFENSE_DE_FER' },
];

/**
 * Construit les clubs de Pro D2.
 *
 * Budgets et enceintes très en dessous du Top 14 : c'est ce qui fait de la
 * descente une sanction, et de la remontée un projet. Un club qui descend
 * garde en revanche ses propres attributs — il n'est pas remplacé par une
 * coquille, il est juste au mauvais étage.
 */
export function buildProD2Clubs(): readonly Club[] {
  return PRO_D2_SEEDS.map(s => ({
    id: s.id as ClubId,
    name: s.name,
    shortName: s.shortName,
    city: s.city,
    tier: 'PETIT_BUDGET' as const,
    tacticalIdentity: s.identity,
    stadiumCapacity: 8_000 + Math.round(s.reputation * 90),
    annualBudget: 4_000_000 + s.reputation * 90_000,
    salaryCapUsage: 0,
    jiffCount: 0,
    reputation: s.reputation,
  }));
}

// =============================================================================
// Répartition
// =============================================================================

export interface DivisionState {
  readonly top14: readonly ClubId[];
  readonly proD2: readonly ClubId[];
}

export function initialDivisions(
  top14Clubs: readonly Club[],
  proD2Clubs: readonly Club[],
): DivisionState {
  return { top14: top14Clubs.map(c => c.id), proD2: proD2Clubs.map(c => c.id) };
}

export function divisionOf(state: DivisionState, clubId: ClubId): Division {
  return state.top14.includes(clubId) ? 'TOP14' : 'PRO_D2';
}

export function clubsOfDivision(state: DivisionState, division: Division): readonly ClubId[] {
  return division === 'TOP14' ? state.top14 : state.proD2;
}

/**
 * Échange les clubs entre les deux étages.
 *
 * Le nombre de montants doit égaler celui des descendants, sans quoi une
 * division finirait à treize clubs et le calendrier round-robin — qui exige un
 * effectif pair — ne se construirait plus. On tronque donc à la plus courte des
 * deux listes plutôt que de faire confiance à l'appelant.
 */
export function exchangeClubs(
  state: DivisionState,
  relegated: readonly ClubId[],
  promoted: readonly ClubId[],
): DivisionState {
  const count = Math.min(relegated.length, promoted.length);
  if (count === 0) return state;

  const down = new Set(relegated.slice(0, count).map(id => id as string));
  const up = new Set(promoted.slice(0, count).map(id => id as string));

  return {
    top14: [...state.top14.filter(id => !down.has(id as string)), ...promoted.slice(0, count)],
    proD2: [...state.proD2.filter(id => !up.has(id as string)), ...relegated.slice(0, count)],
  };
}

// =============================================================================
// Le championnat qu'on ne joue pas
// =============================================================================

export interface ShadowStanding {
  readonly clubId: ClubId;
  readonly rank: number;
  readonly points: number;
}

/**
 * Classement final d'une division simulée en bloc.
 *
 * L'aléa est volontairement large : un championnat où le plus fort finit
 * toujours premier ne produirait jamais de surprise, et le manager relégué
 * saurait dès août quel club il doit battre pour remonter.
 */
export function shadowSeason(
  clubIds: readonly ClubId[],
  strengthOf: (clubId: ClubId) => number,
  rng: Rng,
): readonly ShadowStanding[] {
  return clubIds
    .map(clubId => ({
      clubId,
      // 26 journées à 4 points la victoire : l'échelle reste comparable à celle
      // d'un vrai classement, ce qui rend l'affichage lisible.
      points: Math.max(0, Math.round(strengthOf(clubId) * 1.35 + rng.nextGaussian(0, 12))),
    }))
    .sort((a, b) => b.points - a.points)
    .map((row, i) => ({ ...row, rank: i + 1, points: row.points }));
}

/** Graine stable pour la division qu'on ne joue pas. */
export function shadowRng(seed: string, season: number, division: Division): Rng {
  return createRng(`shadow_${seed}_${season}_${division}`);
}

// =============================================================================
// Montées et descentes
// =============================================================================

export interface PromotionOutcome {
  /** Clubs qui quittent le Top 14. */
  readonly relegated: readonly ClubId[];
  /** Clubs qui montent en Top 14. */
  readonly promoted: readonly ClubId[];
  /** Récit du barrage, quand il a eu lieu. */
  readonly barrage?: {
    readonly top14ClubId: ClubId;
    readonly challengerId: ClubId;
    readonly top14Survives: boolean;
    readonly top14Score: number;
    readonly challengerScore: number;
  };
}

export interface PromotionInput {
  /** Classement final du Top 14, du premier au dernier. */
  readonly top14Ranking: readonly ClubId[];
  /** Classement final de la Pro D2, du premier au dernier. */
  readonly proD2Ranking: readonly ClubId[];
  readonly strengthOf: (clubId: ClubId) => number;
}

/**
 * Applique le format d'accession du Top 14.
 *
 *  - le **14e** descend, le **champion** de Pro D2 monte ;
 *  - le **13e** défend sa place en barrage contre le **2e** de Pro D2.
 *
 * Le barrage est le moment qui donne son sel au bas de tableau : le treizième
 * n'est pas sauvé, et le deuxième n'est pas condamné à attendre un an.
 */
export function resolvePromotions(input: PromotionInput, rng: Rng): PromotionOutcome {
  const { top14Ranking, proD2Ranking, strengthOf } = input;
  if (top14Ranking.length < TOP14_CLUBS || proD2Ranking.length < 2) {
    return { relegated: [], promoted: [] };
  }

  const last = top14Ranking[TOP14_CLUBS - 1]!;
  const secondToLast = top14Ranking[TOP14_CLUBS - 2]!;
  const champion = proD2Ranking[0]!;
  const runnerUp = proD2Ranking[1]!;

  const relegated: ClubId[] = [last];
  const promoted: ClubId[] = [champion];

  // Le club de Top 14 reçoit : il part favori, mais la marche n'est pas si
  // haute qu'un treizième en fin de course domine un deuxième lancé.
  const delta = (strengthOf(secondToLast) + 4) - strengthOf(runnerUp);
  const top14Score = Math.max(0, Math.round(21 + delta * 0.42 + rng.nextGaussian(0, 7)));
  const rawChallenger = Math.max(0, Math.round(21 - delta * 0.30 + rng.nextGaussian(0, 7)));
  // Pas de match nul en barrage : celui qui reçoit passe.
  const challengerScore = rawChallenger === top14Score ? rawChallenger - 3 : rawChallenger;
  const survives = top14Score > challengerScore;

  if (!survives) {
    relegated.push(secondToLast);
    promoted.push(runnerUp);
  }

  return {
    relegated,
    promoted,
    barrage: {
      top14ClubId: secondToLast,
      challengerId: runnerUp,
      top14Survives: survives,
      top14Score,
      challengerScore: Math.max(0, challengerScore),
    },
  };
}
