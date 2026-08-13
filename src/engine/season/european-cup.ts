/**
 * Coupe d'Europe — V0.13.
 *
 * Jusqu'ici le jeu ne comportait qu'une seule compétition. Conséquence : on pouvait
 * aligner ses quinze meilleurs joueurs vingt-six journées d'affilée sans le moindre
 * coût. La profondeur d'effectif, la formation de jeunes et les quotas JIFF
 * n'avaient donc aucun enjeu — alors que **l'arbitrage entre les compétitions est
 * la tension centrale du métier de manager en Top 14**.
 *
 * Ce module ajoute une seconde compétition entrelacée au championnat :
 *
 *  - qualification selon le classement de la saison précédente
 *  - phase de poule de 4 matchs, placés sur des journées de championnat précises,
 *    ce qui crée des semaines doubles et **force la rotation**
 *  - phase finale à élimination directe (huitièmes → finale)
 *
 * ## Adversaires européens
 *
 * Les clubs européens sont **générés procéduralement** plutôt que saisis nommément.
 * C'est un choix délibéré : cela évite d'ajouter une dépendance de licence sur des
 * clubs étrangers (cf. 12-juridique.md) tout en fournissant une opposition crédible
 * et calibrée. Chaque adversaire porte une ville, un pays et une force.
 */

import { createRng, type Rng } from '../rng.js';
import type { ClubId } from '../types.js';

// =============================================================================
// Compétitions
// =============================================================================

export type CompetitionId = 'TOP14' | 'CHAMPIONS_CUP' | 'CHALLENGE_CUP';

export const COMPETITION_LABEL: Readonly<Record<CompetitionId, string>> = {
  TOP14: 'Top 14',
  CHAMPIONS_CUP: 'Coupe d\'Europe',
  CHALLENGE_CUP: 'Challenge européen',
};

/**
 * Nombre de clubs français qualifiés pour la coupe majeure.
 * Les suivants basculent en Challenge, comme dans le format réel.
 */
export const CHAMPIONS_CUP_QUALIFIED = 6;
export const CHALLENGE_CUP_QUALIFIED = 4;

/** Détermine la compétition européenne d'un club selon son rang de la saison passée. */
export function competitionForRank(rank: number): CompetitionId | undefined {
  if (rank <= CHAMPIONS_CUP_QUALIFIED) return 'CHAMPIONS_CUP';
  if (rank <= CHAMPIONS_CUP_QUALIFIED + CHALLENGE_CUP_QUALIFIED) return 'CHALLENGE_CUP';
  return undefined;
}

// =============================================================================
// Adversaires européens générés
// =============================================================================

export interface EuropeanOpponent {
  readonly id: ClubId;
  readonly name: string;
  /** Ville d'origine — sert à garantir des adversaires distincts dans une poule. */
  readonly city: string;
  readonly country: 'ANGLETERRE' | 'IRLANDE' | 'ECOSSE' | 'PAYS_DE_GALLES' | 'ITALIE' | 'AFRIQUE_DU_SUD';
  /** Force globale 40-85, comparable au « niveau » d'un effectif. */
  readonly strength: number;
}

interface CityPool {
  readonly country: EuropeanOpponent['country'];
  readonly cities: readonly string[];
  /** Force moyenne du championnat d'origine. */
  readonly baseStrength: number;
}

const EUROPEAN_POOLS: readonly CityPool[] = [
  { country: 'ANGLETERRE', baseStrength: 66, cities: ['Northfield', 'Bexley', 'Ashcombe', 'Draymoor', 'Kingsholm Park', 'Whitfield'] },
  { country: 'IRLANDE', baseStrength: 70, cities: ['Ballymore', 'Rathcairn', 'Dunmara', 'Kilbrennan'] },
  { country: 'ECOSSE', baseStrength: 60, cities: ['Craigmuir', 'Inverloch', 'Glenmarnock'] },
  { country: 'PAYS_DE_GALLES', baseStrength: 58, cities: ['Aberdare Vale', 'Llanfaren', 'Cwmbrach'] },
  { country: 'ITALIE', baseStrength: 54, cities: ['Valsecca', 'Montebruno', 'Ripalta'] },
  { country: 'AFRIQUE_DU_SUD', baseStrength: 68, cities: ['Highveld', 'Karoo Bay', 'Stellenkloof'] },
];

const CLUB_SUFFIXES: readonly string[] = ['RFC', 'Rugby', 'Warriors', 'Athletic', 'United', 'Rugby Club'];

/**
 * Génère un adversaire européen déterministe.
 * `salt` doit varier d'un adversaire à l'autre pour éviter les doublons.
 *
 * `excludeCities` évite qu'une même poule oppose deux clubs de la même ville,
 * ce qui trahirait immédiatement la génération procédurale.
 */
export function generateEuropeanOpponent(
  salt: string,
  rng: Rng,
  excludeCities: ReadonlySet<string> = new Set(),
): EuropeanOpponent {
  const available = EUROPEAN_POOLS
    .map(p => ({ ...p, cities: p.cities.filter(c => !excludeCities.has(c)) }))
    .filter(p => p.cities.length > 0);
  const source = available.length > 0 ? available : EUROPEAN_POOLS;

  const pool = source[rng.nextInt(0, source.length - 1)]!;
  const city = pool.cities[rng.nextInt(0, pool.cities.length - 1)]!;
  const suffix = CLUB_SUFFIXES[rng.nextInt(0, CLUB_SUFFIXES.length - 1)]!;
  const strength = Math.max(40, Math.min(85, pool.baseStrength + rng.nextInt(-8, 8)));
  return {
    id: `eu_${salt}` as ClubId,
    name: `${city} ${suffix}`,
    city,
    country: pool.country,
    strength,
  };
}

// =============================================================================
// Calendrier européen
// =============================================================================

/**
 * Journées de championnat sur lesquelles se greffent les matchs européens.
 *
 * Ce sont ces semaines-là qui coûtent : le club joue deux matchs en peu de jours,
 * la fatigue s'accumule et il faut faire tourner l'effectif.
 */
export const EUROPEAN_ROUNDS: readonly number[] = [9, 11, 13, 15];

/**
 * Journées des phases finales européennes.
 *
 * V0.60 : le commentaire les annonçait « après la fin du championnat régulier »
 * alors qu'elles se greffent sur ses dernières journées. C'est la réalité du
 * calendrier qui a raison, pas la phrase : huitièmes en avril, finale en mai,
 * pendant que le championnat court encore. Le prix se paie sur le terrain, en
 * fatigue accumulée au pire moment de la saison, et c'est tout l'intérêt.
 */
export const EUROPEAN_KNOCKOUT_ROUNDS = {
  ROUND_OF_16: 18,
  QUARTERFINAL: 20,
  SEMIFINAL: 22,
  FINAL: 24,
} as const;

export type EuropeanStage = 'POOL' | 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';

export interface EuropeanFixture {
  /** Journée de championnat sur laquelle ce match se greffe. */
  readonly round: number;
  readonly stage: EuropeanStage;
  readonly opponent: EuropeanOpponent;
  /** true si le club joueur reçoit. */
  readonly atHome: boolean;
  readonly competition: CompetitionId;
}

export interface EuropeanCampaign {
  readonly competition: CompetitionId;
  readonly fixtures: readonly EuropeanFixture[];
  /** Résultats enregistrés, dans l'ordre. */
  readonly results: readonly EuropeanResult[];
}

export interface EuropeanResult {
  readonly round: number;
  readonly stage: EuropeanStage;
  readonly opponentName: string;
  readonly clubScore: number;
  readonly opponentScore: number;
  readonly atHome: boolean;
}

/**
 * Construit la phase de poule : 4 matchs, 2 à domicile et 2 à l'extérieur,
 * contre 4 adversaires distincts.
 */
export function generatePoolCampaign(
  competition: CompetitionId,
  seed: string,
): EuropeanCampaign {
  const rng = createRng(`eu_pool_${seed}`);
  const fixtures: EuropeanFixture[] = [];
  const usedCities = new Set<string>();

  for (let i = 0; i < EUROPEAN_ROUNDS.length; i++) {
    const round = EUROPEAN_ROUNDS[i]!;
    const opponent = generateEuropeanOpponent(`${seed}_${i}`, rng, usedCities);
    usedCities.add(opponent.city);
    fixtures.push({
      round,
      stage: 'POOL',
      opponent: adjustForCompetition(opponent, competition),
      atHome: i % 2 === 0,          // alternance domicile / extérieur
      competition,
    });
  }

  return { competition, fixtures, results: [] };
}

/** Le Challenge européen oppose des adversaires sensiblement plus faibles. */
function adjustForCompetition(opponent: EuropeanOpponent, competition: CompetitionId): EuropeanOpponent {
  if (competition !== 'CHALLENGE_CUP') return opponent;
  return { ...opponent, strength: Math.max(38, opponent.strength - 12) };
}

// =============================================================================
// Qualification pour les phases finales
// =============================================================================

export interface PoolOutcome {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  /** Qualifié pour les phases finales ? */
  readonly qualified: boolean;
}

/**
 * Bilan de poule. Il faut au moins 2 victoires sur 4 (ou une différence de points
 * positive avec 1 victoire) pour sortir — barre volontairement exigeante, sans quoi
 * l'arbitrage de rotation n'aurait pas de conséquence.
 */
export function summarisePool(campaign: EuropeanCampaign): PoolOutcome {
  const pool = campaign.results.filter(r => r.stage === 'POOL');
  let won = 0;
  let lost = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  for (const r of pool) {
    pointsFor += r.clubScore;
    pointsAgainst += r.opponentScore;
    if (r.clubScore > r.opponentScore) won++;
    else if (r.clubScore < r.opponentScore) lost++;
  }

  const diff = pointsFor - pointsAgainst;
  const qualified = pool.length >= EUROPEAN_ROUNDS.length && (won >= 2 || (won >= 1 && diff > 0));

  return { played: pool.length, won, lost, pointsFor, pointsAgainst, qualified };
}

/**
 * Construit le match à élimination directe suivant.
 * Renvoie undefined si la campagne est terminée (éliminé ou trophée remporté).
 */
export function nextKnockoutFixture(
  campaign: EuropeanCampaign,
  seed: string,
): EuropeanFixture | undefined {
  const outcome = summarisePool(campaign);
  if (!outcome.qualified) return undefined;

  const knockouts = campaign.results.filter(r => r.stage !== 'POOL');
  // Une seule défaite en phase finale et la campagne s'arrête.
  for (const r of knockouts) {
    if (r.clubScore <= r.opponentScore) return undefined;
  }

  const order: readonly { stage: EuropeanStage; round: number }[] = [
    { stage: 'ROUND_OF_16', round: EUROPEAN_KNOCKOUT_ROUNDS.ROUND_OF_16 },
    { stage: 'QUARTERFINAL', round: EUROPEAN_KNOCKOUT_ROUNDS.QUARTERFINAL },
    { stage: 'SEMIFINAL', round: EUROPEAN_KNOCKOUT_ROUNDS.SEMIFINAL },
    { stage: 'FINAL', round: EUROPEAN_KNOCKOUT_ROUNDS.FINAL },
  ];
  const next = order[knockouts.length];
  if (!next) return undefined;                 // trophée déjà remporté

  const rng = createRng(`eu_ko_${seed}_${next.stage}`);
  const opponent = generateEuropeanOpponent(`${seed}_ko_${knockouts.length}`, rng);
  // Les adversaires de phase finale sont plus relevés à mesure qu'on avance.
  const bump = knockouts.length * 3;
  return {
    round: next.round,
    stage: next.stage,
    opponent: { ...opponent, strength: Math.min(88, opponent.strength + bump) },
    // La finale se joue sur terrain neutre, modélisée comme un match à l'extérieur.
    atHome: next.stage !== 'FINAL' && knockouts.length % 2 === 0,
    competition: campaign.competition,
  };
}

/** La campagne s'est-elle soldée par un trophée ? */
export function hasWonCompetition(campaign: EuropeanCampaign): boolean {
  const final = campaign.results.find(r => r.stage === 'FINAL');
  return final !== undefined && final.clubScore > final.opponentScore;
}

/** Étiquette lisible du parcours, pour le bilan de fin de saison. */
export function campaignSummaryLabel(campaign: EuropeanCampaign): string {
  const label = COMPETITION_LABEL[campaign.competition];
  if (hasWonCompetition(campaign)) return `${label} remportée`;

  const knockouts = campaign.results.filter(r => r.stage !== 'POOL');
  const lastLost = [...knockouts].reverse().find(r => r.clubScore <= r.opponentScore);
  if (lastLost) {
    const stageLabel: Record<EuropeanStage, string> = {
      POOL: 'phase de poule',
      ROUND_OF_16: 'huitièmes de finale',
      QUARTERFINAL: 'quarts de finale',
      SEMIFINAL: 'demi-finales',
      FINAL: 'finale',
    };
    return `${label} — éliminé en ${stageLabel[lastLost.stage]}`;
  }

  const outcome = summarisePool(campaign);
  if (outcome.played < EUROPEAN_ROUNDS.length) return `${label} — en cours`;
  return outcome.qualified
    ? `${label} — qualifié pour les phases finales`
    : `${label} — éliminé en phase de poule (${outcome.won}V-${outcome.lost}D)`;
}
