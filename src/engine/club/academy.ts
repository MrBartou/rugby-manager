/**
 * Centre de formation — V0.39.
 *
 * L'académie produisait trois à six jeunes par intersaison, avec un niveau
 * dicté par le tier du club et rien d'autre. Le manager était spectateur du
 * dernier grand système du jeu : il voyait arriver la promotion sans avoir
 * jamais rien décidé.
 *
 * ## Deux décisions, un arbitrage
 *
 * - **L'investissement** : combien on met dans le centre chaque saison. Il se
 *   paie en trésorerie et met des années à porter ses fruits.
 * - **L'orientation** : sur quoi on forme. Un centre orienté avants sort des
 *   piliers et des deuxièmes lignes, pas des ailiers.
 *
 * ## Pourquoi c'est lent
 *
 * Le niveau du centre ne suit pas le budget de l'année : il **converge** vers
 * lui. Investir massivement une saison puis couper ne donne rien, et un centre
 * délaissé se dégrade lentement plutôt que de s'effondrer. C'est ce qui fait de
 * la formation un choix de long terme, et non un curseur qu'on pousse l'année
 * où l'on a de l'argent.
 */

import type { Club, PlayerId, Position } from '../types.js';

// =============================================================================
// Modèle
// =============================================================================

export type AcademyInvestment = 'MINIMAL' | 'MODERE' | 'SOUTENU' | 'MAXIMAL';
export type AcademyFocus = 'AVANTS' | 'EQUILIBRE' | 'TROIS_QUARTS';

export interface AcademyState {
  /** Niveau effectif du centre, 1 à 5. C'est lui qui décide de la qualité. */
  readonly level: number;
  readonly investment: AcademyInvestment;
  readonly focus: AcademyFocus;
}

export const INVESTMENT_LABEL: Readonly<Record<AcademyInvestment, string>> = {
  MINIMAL: 'Minimal',
  MODERE: 'Modéré',
  SOUTENU: 'Soutenu',
  MAXIMAL: 'Maximal',
};

export const FOCUS_LABEL: Readonly<Record<AcademyFocus, string>> = {
  AVANTS: 'Formation d\'avants',
  EQUILIBRE: 'Équilibrée',
  TROIS_QUARTS: 'Formation de trois-quarts',
};

export const INVESTMENT_HINT: Readonly<Record<AcademyInvestment, string>> = {
  MINIMAL: 'On entretient les installations, rien de plus. Le centre s\'étiole.',
  MODERE: 'Un fonctionnement normal : le centre se maintient à son niveau.',
  SOUTENU: 'Éducateurs supplémentaires et prospection élargie. Le centre progresse.',
  MAXIMAL: 'Moyens d\'un grand club formateur. Coûteux, et long à porter ses fruits.',
};

/**
 * Niveau vers lequel converge le centre pour un investissement donné.
 *
 * Un club ne peut pas viser plus haut que ses moyens : la cible est plafonnée
 * par la taille du club. Un promu qui met tout dans sa formation ne rattrape
 * pas Toulouse en une saison, mais il progresse réellement.
 */
export function targetLevel(investment: AcademyInvestment, club: Club): number {
  const ambition: Record<AcademyInvestment, number> = {
    MINIMAL: 1,
    MODERE: 3,
    SOUTENU: 4,
    MAXIMAL: 5,
  };
  const ceiling = club.tier === 'GROS_BUDGET' ? 5 : club.tier === 'BUDGET_MOYEN' ? 4.5 : 4;
  return Math.min(ambition[investment], ceiling);
}

/** Coût annuel du centre, prélevé à l'intersaison. */
export function academyCost(investment: AcademyInvestment, club: Club): number {
  const share: Record<AcademyInvestment, number> = {
    MINIMAL: 0.01,
    MODERE: 0.025,
    SOUTENU: 0.045,
    MAXIMAL: 0.07,
  };
  return Math.round((club.annualBudget * share[investment]) / 10_000) * 10_000;
}

/**
 * Fait évoluer le centre d'une saison.
 *
 * La convergence est volontairement lente et **asymétrique** : on progresse
 * moins vite qu'on ne se dégrade est le réflexe habituel, mais ici c'est
 * l'inverse — un centre met des années à se construire et se maintient un temps
 * sur son acquis. C'est ce qui rend le désinvestissement tentant à court terme
 * et coûteux à long terme, exactement l'arbitrage qu'on veut poser.
 */
export function advanceAcademy(state: AcademyState, club: Club): AcademyState {
  const target = targetLevel(state.investment, club);
  const gap = target - state.level;
  const step = gap > 0 ? Math.min(gap, 0.35) : Math.max(gap, -0.2);
  return { ...state, level: Math.round((state.level + step) * 100) / 100 };
}

export function defaultAcademyState(club: Club): AcademyState {
  return {
    level: club.tier === 'GROS_BUDGET' ? 4 : club.tier === 'BUDGET_MOYEN' ? 3 : 2,
    investment: 'MODERE',
    focus: 'EQUILIBRE',
  };
}

// =============================================================================
// Orientation
// =============================================================================

const FORWARDS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
];

const BACKS: readonly Position[] = [
  'DEMI_DE_MELEE', 'OUVREUR',
  'AILIER_GAUCHE', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'AILIER_DROIT',
  'ARRIERE',
];

/**
 * Postes que le centre propose, selon son orientation.
 *
 * On ne supprime jamais complètement un versant : un centre orienté avants
 * sort encore un demi de mêlée de temps en temps, sans quoi une orientation
 * tenue trois saisons laisserait le club sans le moindre trois-quarts formé.
 */
export function positionPoolFor(focus: AcademyFocus): readonly Position[] {
  switch (focus) {
    case 'AVANTS':
      return [...FORWARDS, ...FORWARDS, ...BACKS];
    case 'TROIS_QUARTS':
      return [...BACKS, ...BACKS, ...FORWARDS];
    case 'EQUILIBRE':
    default:
      return [...FORWARDS, ...BACKS];
  }
}

/**
 * Bonus de potentiel accordé aux postes travaillés par le centre.
 *
 * Modeste à dessein : l'orientation décide de **qui** l'on forme, la qualité
 * vient de l'investissement. Un gros bonus ferait de l'orientation le seul
 * réglage qui compte.
 */
export function focusBonusFor(focus: AcademyFocus, position: Position): number {
  if (focus === 'EQUILIBRE') return 0;
  const isForward = FORWARDS.includes(position);
  const favoured = focus === 'AVANTS' ? isForward : !isForward;
  return favoured ? 4 : -3;
}

// =============================================================================
// Suivi des espoirs — V0.43
// =============================================================================

/**
 * Un jeune sorti du centre, suivi nommément.
 *
 * V0.39 produisait une promotion par intersaison et la déversait dans
 * l'effectif. Passé le mail d'arrivée, plus rien ne distinguait ces joueurs des
 * autres : on ne savait ni d'où ils venaient, ni s'ils progressaient, ni si
 * l'investissement consenti dans le centre avait servi à quelque chose.
 *
 * Le suivi ne stocke que ce qui **ne se recalcule pas** — l'année d'entrée et
 * le niveau de départ. Tout le reste (niveau courant, âge, temps de jeu) se lit
 * sur le joueur au moment de l'affichage, ce qui évite deux sources de vérité
 * qui finiraient par diverger.
 */
export interface ProspectRecord {
  readonly playerId: PlayerId;
  /** Saison d'intégration au groupe professionnel. */
  readonly intakeSeason: number;
  /** Niveau à la sortie du centre — la référence de toute progression. */
  readonly intakeOverall: number;
  /** Niveau du centre l'année de sa formation, pour juger la promotion. */
  readonly academyLevel: number;
}

export const EMPTY_PROSPECTS: readonly ProspectRecord[] = [];

/**
 * Ajoute une promotion au suivi.
 *
 * Idempotent : rejouer une intersaison au rechargement d'une sauvegarde ne doit
 * pas dupliquer un espoir ni écraser son niveau de départ — ce qui effacerait
 * précisément la progression qu'on cherche à mesurer.
 */
export function trackProspects(
  tracked: readonly ProspectRecord[],
  intake: readonly { readonly playerId: PlayerId; readonly overall: number }[],
  season: number,
  academyLevel: number,
): readonly ProspectRecord[] {
  const known = new Set(tracked.map(p => p.playerId as string));
  const added = intake
    .filter(p => !known.has(p.playerId as string))
    .map(p => ({
      playerId: p.playerId,
      intakeSeason: season,
      intakeOverall: Math.round(p.overall),
      academyLevel,
    }));
  return added.length > 0 ? [...tracked, ...added] : tracked;
}

/** Ce qu'est devenu un espoir, à l'instant où on le regarde. */
export interface ProspectStatus {
  readonly record: ProspectRecord;
  readonly currentOverall: number;
  readonly progression: number;
  readonly seasonsSince: number;
  readonly matchesPlayed: number;
  readonly age: number;
  /** Toujours au club, ou parti/retraité. */
  readonly stillHere: boolean;
  readonly verdict: ProspectVerdict;
}

/**
 * Jugement porté sur un espoir.
 *
 * Un jeune ne se juge pas à son niveau brut mais à ce qu'il en a fait depuis
 * sa sortie : +6 en deux ans est une réussite à 55 comme à 70. Sans quoi le
 * verdict ne dirait rien de plus que la colonne « niveau ».
 */
export type ProspectVerdict = 'TROP_TOT' | 'PERCEE' | 'PROGRESSE' | 'STAGNE' | 'PARTI';

export const PROSPECT_VERDICT_LABEL: Readonly<Record<ProspectVerdict, string>> = {
  TROP_TOT: 'Trop tôt pour juger',
  PERCEE: 'Perce dans le groupe',
  PROGRESSE: 'Progresse',
  STAGNE: 'Stagne',
  PARTI: 'A quitté le club',
};

/** Matchs à partir desquels on considère qu'un jeune s'est installé. */
export const BREAKTHROUGH_MATCHES = 10;

export function prospectStatus(
  record: ProspectRecord,
  player: { readonly overall: number; readonly age: number } | undefined,
  matchesPlayed: number,
  currentSeason: number,
): ProspectStatus {
  const seasonsSince = currentSeason - record.intakeSeason;

  if (!player) {
    return {
      record, currentOverall: record.intakeOverall, progression: 0,
      seasonsSince, matchesPlayed, age: 0, stillHere: false, verdict: 'PARTI',
    };
  }

  const currentOverall = Math.round(player.overall);
  const progression = currentOverall - record.intakeOverall;

  // Une première saison ne dit rien : un jeune ne progresse pas en six mois, et
  // le déclarer en échec dès sa sortie punirait précisément ce qu'on veut
  // encourager — la patience.
  const verdict: ProspectVerdict = seasonsSince < 1
    ? 'TROP_TOT'
    : matchesPlayed >= BREAKTHROUGH_MATCHES
      ? 'PERCEE'
      : progression >= 2
        ? 'PROGRESSE'
        : 'STAGNE';

  return {
    record, currentOverall, progression, seasonsSince, matchesPlayed,
    age: player.age, stillHere: true, verdict,
  };
}

/**
 * Bilan du centre sur toutes les promotions suivies.
 *
 * C'est le seul chiffre qui répond à la question posée par l'investissement :
 * est-ce que ça a servi ?
 */
export interface AcademyRecordSummary {
  readonly tracked: number;
  readonly breakthroughs: number;
  readonly stillAtClub: number;
  readonly averageProgression: number;
}

export function academyRecord(statuses: readonly ProspectStatus[]): AcademyRecordSummary {
  const judged = statuses.filter(s => s.verdict !== 'TROP_TOT' && s.stillHere);
  const total = judged.reduce((sum, s) => sum + s.progression, 0);
  return {
    tracked: statuses.length,
    breakthroughs: statuses.filter(s => s.verdict === 'PERCEE').length,
    stillAtClub: statuses.filter(s => s.stillHere).length,
    averageProgression: judged.length > 0
      ? Math.round((total / judged.length) * 10) / 10
      : 0,
  };
}
