/**
 * Fenêtres de mercato — V0.30.
 *
 * Jusqu'ici le marché n'avait pas de calendrier : les clubs IA ne bougeaient
 * qu'à l'intersaison, tandis que le manager pouvait signer n'importe qui à
 * n'importe quelle journée. Deux régimes différents pour les mêmes règles.
 *
 * ## Deux fenêtres, les mêmes pour tout le monde
 *
 * - **Estivale** — la queue du marché d'été, jusqu'à la J3. Le gros des
 *   mouvements a déjà eu lieu pendant l'intersaison ; ce qui reste, ce sont les
 *   dossiers qui traînent.
 * - **Hivernale** : la trêve de fin d'année, quatre journées à mi-parcours. Le
 *   marché des urgences : on y répare une saison, on n'y construit pas un
 *   effectif.
 *
 * ## Deux divisions, deux calendriers
 *
 * V0.60 : la fenêtre hivernale était figée à J13-J16, ce qui est le milieu du
 * Top 14 et pas celui de la Pro D2, qui joue trente journées. Un manager de
 * deuxième division voyait donc son marché d'hiver s'ouvrir à la fin novembre
 * et se refermer bien avant la trêve. Elle se calcule maintenant à partir du
 * nombre de journées de la division.
 *
 * Le reste du temps, aucun joueur sous contrat ne change de club. Laisser le
 * manager acheter en continu pendant que l'IA attend l'été lui donnerait un
 * avantage que rien ne justifie — et viderait de son sens la contrainte
 * calendaire qu'on impose à tout le monde.
 *
 * Les **agents libres** restent signables toute l'année : ils n'appartiennent à
 * personne, aucun club n'est lésé, et c'est le seul recours d'une équipe
 * décimée par les blessures en février.
 */

export type TransferWindowId = 'ESTIVAL' | 'HIVERNAL';

export interface TransferWindow {
  readonly id: TransferWindowId;
  readonly label: string;
  /** Première journée où la fenêtre est ouverte. */
  readonly opensAt: number;
  /** Dernière journée où la fenêtre est ouverte (incluse). */
  readonly closesAfter: number;
}

/** Nombre de journées de la division par défaut : le Top 14. */
const DEFAULT_REGULAR_ROUNDS = 26;

/** Durée de la fenêtre hivernale, en journées. */
const WINTER_LENGTH = 4;

/**
 * Les deux fenêtres d'une division, d'après son nombre de journées.
 *
 * L'estivale ne bouge pas : c'est la queue du marché d'été, et elle se compte
 * depuis le début de la saison. L'hivernale s'ouvre à mi-parcours, là où le
 * calendrier réel place la trêve.
 */
export function transferWindowsFor(
  regularRounds: number = DEFAULT_REGULAR_ROUNDS,
): readonly TransferWindow[] {
  const rounds = regularRounds > WINTER_LENGTH * 2 ? regularRounds : DEFAULT_REGULAR_ROUNDS;
  const winterOpens = Math.round(rounds / 2);
  return [
    { id: 'ESTIVAL', label: 'Mercato estival', opensAt: 1, closesAfter: 3 },
    {
      id: 'HIVERNAL',
      label: 'Mercato hivernal',
      opensAt: winterOpens,
      closesAfter: winterOpens + WINTER_LENGTH - 1,
    },
  ];
}

/** Les fenêtres du Top 14, conservées pour les appels qui n'ont pas de contexte. */
export const TRANSFER_WINDOWS: readonly TransferWindow[] = transferWindowsFor();

/** Fenêtre ouverte à cette journée, s'il y en a une. */
export function windowForRound(
  round: number,
  regularRounds?: number,
): TransferWindow | undefined {
  return transferWindowsFor(regularRounds).find(w => round >= w.opensAt && round <= w.closesAfter);
}

export function isTransferWindowOpen(round: number, regularRounds?: number): boolean {
  return windowForRound(round, regularRounds) !== undefined;
}

/** Vrai uniquement à la journée d'ouverture : le moment où l'IA agit. */
export function isWindowOpeningRound(
  round: number,
  id: TransferWindowId,
  regularRounds?: number,
): boolean {
  const window = transferWindowsFor(regularRounds).find(w => w.id === id);
  return window !== undefined && window.opensAt === round;
}

/** Prochaine fenêtre à s'ouvrir, ou `undefined` si la saison n'en compte plus. */
export function nextWindow(round: number, regularRounds?: number): TransferWindow | undefined {
  return transferWindowsFor(regularRounds).find(w => w.opensAt > round);
}

export interface TransferWindowStatus {
  readonly open: boolean;
  /** Fenêtre en cours, si elle est ouverte. */
  readonly current?: TransferWindow;
  /** Journées restantes avant la fermeture (0 = dernier jour). */
  readonly roundsLeft?: number;
  /** Prochaine fenêtre, quand le marché est fermé. */
  readonly next?: TransferWindow;
  /** Journées à patienter avant sa réouverture. */
  readonly roundsUntilNext?: number;
  /** Phrase prête à afficher — le manager doit savoir où il en est d'un coup d'œil. */
  readonly summary: string;
}

/**
 * État du marché à une journée donnée.
 *
 * Renvoie une phrase toute faite : dispersée dans l'interface, la logique
 * « ouvert / fermé / plus jamais cette saison » se serait fatalement contredite
 * d'un écran à l'autre.
 */
export function transferWindowStatus(
  round: number,
  regularRounds?: number,
): TransferWindowStatus {
  const current = windowForRound(round, regularRounds);
  if (current) {
    const roundsLeft = current.closesAfter - round;
    return {
      open: true,
      current,
      roundsLeft,
      summary: roundsLeft === 0
        ? `${current.label} : dernier jour`
        : `${current.label} : ouvert encore ${roundsLeft} journée${roundsLeft > 1 ? 's' : ''}`,
    };
  }

  const upcoming = nextWindow(round, regularRounds);
  if (!upcoming) {
    return { open: false, summary: 'Marché fermé jusqu\'à l\'intersaison' };
  }

  return {
    open: false,
    next: upcoming,
    roundsUntilNext: upcoming.opensAt - round,
    summary: `Marché fermé, ${upcoming.label} à la J${upcoming.opensAt}`,
  };
}
