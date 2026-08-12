/**
 * La semaine d'entraînement — V0.44.
 *
 * Le plan de semaine existait depuis V0.3, mais son seul effet vivait le temps
 * d'un match : un bonus tactique et quelques points de fatigue au coup d'envoi.
 * « Forte » coûtait six points de fatigue et rapportait un point et demi de
 * discipline tactique — autant dire que le choix se faisait tout seul, et qu'il
 * n'y avait aucune raison de lever le pied.
 *
 * ## Ce qui manquait : le risque et la durée
 *
 * Une semaine d'entraînement n'est pas un curseur de bonus, c'est un pari sur
 * des corps. Charger, c'est gagner de l'acuité et prendre le risque de perdre
 * un cadre pour un mois. Lever le pied, c'est récupérer et s'émousser.
 *
 * Le module agit sur `dynamic.forme` et `dynamic.fatigue`, que le moteur de
 * match lit déjà, et produit de vraies blessures : la décision porte donc au-delà
 * du week-end, ce qui est tout l'intérêt d'une **saison**.
 *
 * ## Le staff médical sert enfin à quelque chose
 *
 * La qualité de l'encadrement physique divise le risque. C'est le lien qui rend
 * le recrutement d'un médecin comparable à celui d'un joueur : moins spectaculaire,
 * mais il protège l'effectif toute l'année.
 */

import type { Rng } from '../rng.js';
import type { InjuryType, Player, PlayerId } from '../types.js';
import type { TrainingLoad } from '../match/week-plan.js';

// =============================================================================
// Ce que produit une semaine
// =============================================================================

export interface WeekEffect {
  /** Variation de forme, en points. */
  readonly forme: number;
  /** Variation de fatigue, en points. */
  readonly fatigue: number;
  /** Probabilité de base qu'un joueur se blesse à l'entraînement. */
  readonly injuryRisk: number;
}

/**
 * Effet de chaque charge.
 *
 * L'asymétrie est voulue : la charge forte donne plus de forme qu'elle n'en
 * coûte en récupération, sinon personne ne la choisirait jamais. Son prix est
 * ailleurs — dans le risque, qui est dix fois celui d'une semaine légère.
 */
export const WEEK_EFFECTS: Readonly<Record<TrainingLoad, WeekEffect>> = {
  LIGHT: { forme: -2, fatigue: -12, injuryRisk: 0.004 },
  MEDIUM: { forme: +1, fatigue: -4, injuryRisk: 0.012 },
  HARD: { forme: +4, fatigue: +8, injuryRisk: 0.040 },
};

export const LOAD_LABEL: Readonly<Record<TrainingLoad, string>> = {
  LIGHT: 'Légère',
  MEDIUM: 'Modérée',
  HARD: 'Forte',
};

// =============================================================================
// Résolution
// =============================================================================

export interface TrainingInjury {
  readonly playerId: Player['id'];
  readonly playerName: string;
  readonly type: InjuryType;
  /** Durée en journées de championnat. */
  readonly weeks: number;
}

export interface TrainingWeekResult {
  readonly players: readonly Player[];
  readonly injuries: readonly TrainingInjury[];
  /** Variation moyenne de forme sur l'effectif, pour le compte rendu. */
  readonly averageFormeDelta: number;
}

export interface TrainingWeekInput {
  readonly players: readonly Player[];
  readonly load: TrainingLoad;
  /**
   * Qualité de la préparation physique et du suivi médical, 0-100. Elle divise
   * le risque : c'est ce qui rend un bon médecin comparable à une recrue.
   */
  readonly medicalQuality: number;
  readonly currentRound: number;
  readonly currentSeason: number;
  /**
   * V0.55 — joueurs mis au repos cette semaine.
   *
   * La charge était **collective** : impossible de ménager un cadre de
   * trente-quatre ans tout en poussant les jeunes, alors que c'est précisément
   * ce qu'on gère le reste du temps avec la rotation. Le repos ne fait pas
   * progresser, mais il récupère et il ne blesse pas — c'est l'arbitrage.
   */
  readonly rested?: ReadonlySet<PlayerId>;
  readonly rng: Rng;
}

/**
 * Ce qu'une semaine de repos apporte.
 *
 * La récupération est franche — c'est tout l'intérêt — mais la forme s'émousse
 * un peu : un joueur qui ne s'entraîne pas perd le rythme. Sans ce coût, mettre
 * tout l'effectif au repos chaque semaine serait gratuit.
 */
export const REST_EFFECT = { forme: -1, fatigue: -18 } as const;

/** Blessures d'entraînement : jamais de fracture, on ne plaque personne. */
const TRAINING_INJURY_TYPES: readonly InjuryType[] = ['MUSCULAIRE', 'LIGAMENTAIRE', 'COUP'];

/**
 * Applique une semaine d'entraînement à un effectif.
 *
 * Les joueurs déjà blessés ou suspendus sont laissés de côté : ils ne
 * s'entraînent pas avec le groupe, et les charger deux fois n'aurait pas de
 * sens.
 */
export function resolveTrainingWeek(input: TrainingWeekInput): TrainingWeekResult {
  const effect = WEEK_EFFECTS[input.load];
  // Un encadrement médiocre double presque le risque ; un excellent le divise
  // par deux. La borne basse évite qu'un club sans staff devienne injouable.
  const protection = Math.max(0.5, Math.min(1.8, 1.6 - input.medicalQuality / 100));

  const injuries: TrainingInjury[] = [];
  let formeTotal = 0;
  let trained = 0;

  const players = input.players.map(player => {
    if (player.retired || player.freeAgent) return player;
    if (player.dynamic.injury) return player;
    if (player.dynamic.suspendedUntilRound !== undefined
      && player.dynamic.suspendedUntilRound > input.currentRound) return player;

    // V0.55 — celui qu'on ménage récupère franchement, ne risque rien, et
    // perd un peu de rythme.
    if (input.rested?.has(player.id) === true) {
      return {
        ...player,
        dynamic: {
          ...player.dynamic,
          forme: clamp(player.dynamic.forme + REST_EFFECT.forme),
          fatigue: clamp(player.dynamic.fatigue + REST_EFFECT.fatigue),
        },
      };
    }

    trained++;

    // Un organisme fragile ou vieillissant encaisse moins bien la charge. C'est
    // ce qui donne un sens au fait de ménager un cadre de trente-quatre ans.
    const age = input.currentSeason - Number(player.birthDate.slice(0, 4));
    const wear = (100 - player.physical.robustesse) / 100 + Math.max(0, age - 30) * 0.06;
    const risk = effect.injuryRisk * protection * (0.6 + wear);

    if (input.rng.nextBool(Math.min(0.25, risk))) {
      const type = TRAINING_INJURY_TYPES[input.rng.nextInt(0, TRAINING_INJURY_TYPES.length - 1)]!;
      const weeks = type === 'LIGAMENTAIRE'
        ? input.rng.nextInt(6, 14)
        : input.rng.nextInt(1, 5);
      injuries.push({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        type,
        weeks,
      });
      return {
        ...player,
        dynamic: {
          ...player.dynamic,
          injury: {
            type,
            startedAt: input.currentRound,
            estimatedReturnAt: input.currentRound + weeks,
            // Une lésion ligamentaire contractée à l'entraînement laisse des
            // traces, comme celle prise en match.
            hasSequela: type === 'LIGAMENTAIRE',
          },
        },
      };
    }

    formeTotal += effect.forme;
    return {
      ...player,
      dynamic: {
        ...player.dynamic,
        forme: clamp(player.dynamic.forme + effect.forme),
        fatigue: clamp(player.dynamic.fatigue + effect.fatigue),
      },
    };
  });

  return {
    players,
    injuries,
    averageFormeDelta: trained > 0 ? Math.round((formeTotal / trained) * 10) / 10 : 0,
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Ce que la charge annonce au manager, avant qu'il ne choisisse.
 *
 * Le risque est donné en pourcentage d'effectif touché sur la semaine plutôt
 * qu'en probabilité par joueur : c'est la seule formulation qui parle à
 * quelqu'un qui gère un groupe de vingt-sept.
 */
export function weekForecast(load: TrainingLoad, squadSize: number, medicalQuality: number): string {
  const effect = WEEK_EFFECTS[load];
  const protection = Math.max(0.5, Math.min(1.8, 1.6 - medicalQuality / 100));
  const expected = effect.injuryRisk * protection * squadSize;

  const forme = effect.forme >= 0 ? `+${effect.forme}` : `${effect.forme}`;
  const fatigue = effect.fatigue >= 0 ? `+${effect.fatigue}` : `${effect.fatigue}`;
  const blesses = expected < 0.15
    ? 'risque de blessure négligeable'
    : `environ ${expected.toFixed(1)} blessé${expected >= 1.5 ? 's' : ''} attendu${expected >= 1.5 ? 's' : ''}`;

  return `Forme ${forme}, fatigue ${fatigue} — ${blesses}.`;
}
