/**
 * Les cibles de calibration du moteur : V0.61.
 *
 * Elles viennent de `docs/design/14-tests-validation.md`, section D, et disent
 * ce qu'une rencontre simulée doit produire pour ressembler à du rugby : essais
 * par match, pourcentage de réussite au pied, avantage du terrain, possession.
 *
 * ## Pourquoi elles vivent ici
 *
 * Elles étaient écrites en dur dans `tools/calibrate.ts`, seul consommateur.
 * L'intégration continue lançait de son côté une suite `tests/simulation` qui
 * n'a jamais existé, sur une taille d'échantillon que rien ne lisait : le
 * pipeline échouait à chaque pull request depuis le premier commit, sans que
 * personne ne regarde. Les recopier dans la suite de tests aurait installé deux
 * sources de vérité pour le même contrat, ce que ce projet a déjà payé trois
 * fois. Le harnais de calibration et les tests statistiques lisent donc les
 * mêmes chiffres, à un seul endroit.
 */

export interface CalibrationTarget {
  readonly min?: number;
  readonly max?: number;
}

/**
 * Le contrat que le moteur doit tenir.
 *
 * Les taux sont exprimés en proportion (0 à 1), les compteurs en unités par
 * match. Toucher à ces valeurs, c'est changer la définition de ce qu'est un
 * match crédible : cela se fait après mesure, jamais pour faire passer un test.
 */
export const CALIBRATION_TARGETS = {
  triesPerMatch: { min: 4, max: 6 },
  triesStdDev: { max: 2 },
  placeKickRate: { min: 0.60, max: 0.70 },
  phasesPerMatch: { min: 70, max: 80 },
  drawRate: { max: 0.08 },
  homeWinRateBalanced: { min: 0.42, max: 0.58 },
  possessionBalanced: { min: 0.45, max: 0.55 },
  strongWinRateGap: { min: 0.65, max: 0.78 },
  possessionGap: { min: 0.30, max: 0.40 },
  totalPointsBalanced: { min: 35, max: 70 },
} satisfies Record<string, CalibrationTarget>;

/** Niveaux des deux scénarios de référence. */
export const CALIBRATION_SCENARIOS = {
  balanced: { home: 60, away: 60 },
  skewed: { home: 75, away: 45 },
} as const;
