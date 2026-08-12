/**
 * La météo — V0.51.
 *
 * `weather` est un champ **obligatoire** de `MatchInput` depuis la V0.2, avec
 * quatre valeurs. Il n'était implémenté qu'à un seul endroit — la réussite des
 * coups de pied placés — et valait `'SEC'` en dur dans le constructeur de
 * feuille de match. Aucun match de carrière n'a jamais été joué sous la pluie.
 *
 * Même constat pour `fieldCondition` : trois valeurs, un effet réel sur la
 * poussée en mêlée, et toujours `'BON'`.
 *
 * Or la pluie change le rugby plus que n'importe quel réglage tactique. Un
 * terrain gras, c'est moins de passes, plus de ballons lâchés, plus de jeu au
 * pied, moins d'essais et une mêlée qui ne pousse plus. Une soirée de vent, ce
 * sont des touches manquées et des buteurs à 40 %.
 *
 * ## Ce que cela change pour le manager
 *
 * C'est le premier élément du jeu qui rend la préparation **situationnelle**.
 * Jusqu'ici, un plan de match était bon ou mauvais dans l'absolu : on trouvait
 * le meilleur réglage et on le gardait vingt-six journées. Sous la pluie, jouer
 * la main devient une faute et l'occupation reprend son sens.
 */

import type { Rng } from '../rng.js';
import type { MatchInput } from './types.js';

export type Weather = MatchInput['weather'];
export type FieldCondition = MatchInput['fieldCondition'];

export const WEATHER_LABEL: Readonly<Record<Weather, string>> = {
  SEC: 'Temps sec',
  PLUIE: 'Pluie',
  VENT: 'Vent',
  EXTREME: 'Conditions extrêmes',
};

// =============================================================================
// Ce qu'il fait ce jour-là
// =============================================================================

/**
 * Mois approximatif d'une journée de championnat.
 *
 * Le Top 14 va de début septembre à fin juin, phases finales comprises. On ne
 * simule pas un calendrier réel — on veut seulement que les journées d'hiver
 * tombent en hiver, ce qui suffit à faire exister les soirées de décembre.
 */
export function monthOfRound(round: number): number {
  // 26 journées étalées de septembre (9) à mai (5), en repassant par janvier.
  const offset = Math.floor(((round - 1) / 26) * 9);
  return ((8 + offset) % 12) + 1;
}

/**
 * Probabilité de mauvais temps selon le mois.
 *
 * Septembre est presque toujours sec, décembre et janvier presque jamais. Ce
 * sont des ordres de grandeur, pas des relevés météorologiques.
 */
function badWeatherOdds(month: number): number {
  switch (month) {
    case 9: return 0.10;
    case 10: return 0.22;
    case 11: return 0.38;
    case 12: return 0.50;
    case 1: return 0.55;
    case 2: return 0.48;
    case 3: return 0.35;
    case 4: return 0.22;
    default: return 0.14;
  }
}

/**
 * Clubs où le vent fait partie du décor.
 *
 * Écrit à la main plutôt que déduit d'une latitude : c'est la même décision que
 * pour les rivalités. La Rochelle et Bayonne sont sur l'Atlantique, Perpignan
 * a la tramontane, Clermont et Grenoble ont la montagne.
 */
const WINDY_GROUNDS: ReadonlySet<string> = new Set([
  'la_rochelle', 'bayonne', 'biarritz', 'perpignan', 'usap',
  'clermont', 'grenoble', 'vannes', 'brive',
]);

/**
 * Temps qu'il fait pour une rencontre donnée.
 *
 * Déterministe : même journée, même stade, même graine — même temps. Sans cela,
 * recharger une sauvegarde changerait les conditions du match qu'on s'apprête à
 * jouer, et la préparation ne voudrait plus rien dire.
 */
export function generateWeather(input: {
  readonly round: number;
  readonly homeClubId: string;
  readonly rng: Rng;
}): { readonly weather: Weather; readonly fieldCondition: FieldCondition } {
  const month = monthOfRound(input.round);
  const odds = badWeatherOdds(month);
  const windy = WINDY_GROUNDS.has(input.homeClubId);

  if (!input.rng.nextBool(odds + (windy ? 0.10 : 0))) {
    // Beau temps. Le terrain reste dur en fin d'été, bon le reste du temps.
    return {
      weather: 'SEC',
      fieldCondition: month === 9 || month === 6 ? 'DUR' : 'BON',
    };
  }

  // Mauvais temps : la nature de l'intempérie dépend du lieu et de la saison.
  const roll = input.rng.next();
  const windShare = windy ? 0.55 : 0.30;
  // Les conditions extrêmes restent rares — c'est ce qui leur garde leur poids.
  const extremeShare = month === 12 || month === 1 ? 0.12 : 0.05;

  if (roll < extremeShare) {
    return { weather: 'EXTREME', fieldCondition: 'GRAS' };
  }
  if (roll < extremeShare + windShare) {
    // Le vent sèche le terrain autant qu'il gêne le jeu.
    return { weather: 'VENT', fieldCondition: 'BON' };
  }
  return { weather: 'PLUIE', fieldCondition: 'GRAS' };
}

// =============================================================================
// Ce que cela change sur le terrain
// =============================================================================

export interface WeatherEffects {
  /** Multiplicateur du risque d'erreur de manipulation. */
  readonly handlingFactor: number;
  /** Multiplicateur de la tendance à jouer au pied. */
  readonly kickTendency: number;
  /** Multiplicateur de la probabilité d'essai. */
  readonly tryFactor: number;
  /** Malus additif sur la conquête en touche, échelle 0-100. */
  readonly lineoutMalus: number;
}

export const CLEAR_WEATHER: WeatherEffects = {
  handlingFactor: 1, kickTendency: 1, tryFactor: 1, lineoutMalus: 0,
};

/**
 * Effets d'une météo, communs aux deux camps.
 *
 * Il pleut pour tout le monde : ces facteurs ne sont **pas** un avantage pour
 * le club recevant. Ce qui distingue les deux équipes, c'est la façon dont
 * chacune s'y prépare — pas le ciel.
 *
 * La pluie touche la manipulation, le vent la conquête et le jeu au pied, les
 * conditions extrêmes les deux. Le jeu au pied placé, lui, est déjà pénalisé
 * dans [kicking](./kicking.ts) depuis la V0.2 — c'était le seul effet
 * implémenté, et il reste là où il est.
 */
export function weatherEffects(weather: Weather): WeatherEffects {
  switch (weather) {
    case 'SEC':
      return CLEAR_WEATHER;
    case 'PLUIE':
      return {
        handlingFactor: 1.30,
        kickTendency: 1.35,
        tryFactor: 0.88,
        lineoutMalus: 2,
      };
    case 'VENT':
      return {
        handlingFactor: 1.12,
        kickTendency: 0.85,   // on ose moins jouer au pied face au vent
        tryFactor: 0.95,
        lineoutMalus: 6,
      };
    case 'EXTREME':
      return {
        handlingFactor: 1.55,
        kickTendency: 1.45,
        tryFactor: 0.75,
        lineoutMalus: 8,
      };
  }
}

/**
 * Ce que le staff annonce en début de semaine.
 *
 * Dit ce que ça change, pas des pourcentages : c'est au manager d'en tirer un
 * plan de match.
 */
export function weatherHint(weather: Weather, field: FieldCondition): string {
  switch (weather) {
    case 'SEC':
      return field === 'DUR'
        ? 'Terrain sec et dur. Le ballon va vite, la mêlée pousse bien.'
        : 'Conditions idéales. Rien ne contrarie le jeu à la main.';
    case 'PLUIE':
      return 'Pluie annoncée, terrain gras. Le ballon va glisser : le jeu au pied et les avants prendront le pas.';
    case 'VENT':
      return 'Vent soutenu. Les touches vont souffrir et les buteurs aussi — mieux vaut garder le ballon.';
    case 'EXTREME':
      return 'Conditions exécrables. Ce sera un match d\'avants, et il faudra accepter de ne pas jouer.';
  }
}
