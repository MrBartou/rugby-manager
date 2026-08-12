/**
 * Scouting et connaissance des joueurs — V0.15.
 *
 * Jusqu'ici un joueur était un tableau de chiffres exacts : `hidden.potentiel`
 * n'était affiché nulle part, mais il n'était pas *estimé* non plus. Recruter
 * revenait donc à lire un tableau, jamais à faire un pari. Le poste de
 * `SCOUT_PRINCIPAL` n'était qu'un intitulé.
 *
 * Ce module introduit une **connaissance graduelle** :
 *
 *  - chaque joueur porte une familiarité 0-100 vis-à-vis du club utilisateur
 *  - les attributs et surtout le potentiel s'affichent en **fourchettes** qui se
 *    resserrent à mesure que la familiarité monte
 *  - la qualité du scout accélère l'acquisition et réduit l'erreur
 *
 * ## Déterminisme
 *
 * L'estimation est une **fonction pure** de (valeur réelle, familiarité, sel).
 * C'est essentiel : une estimation retirée au hasard à chaque rendu donnerait des
 * fourchettes qui dansent sous les yeux du joueur, et permettrait de « rafraîchir »
 * l'affichage jusqu'à obtenir la bonne réponse. Le biais du scout est donc stable
 * — il peut se tromper, mais il se trompe toujours dans le même sens.
 */

import type { ClubId, Player, PlayerId } from '../types.js';

// =============================================================================
// Familiarité
// =============================================================================

/** Familiarité de départ pour un joueur de son propre effectif. */
export const OWN_SQUAD_BASE_FAMILIARITY = 58;

/**
 * Plafond de familiarité. On ne connaît jamais un joueur *parfaitement* :
 * garder une marge résiduelle préserve la part d'incertitude du métier.
 */
export const MAX_FAMILIARITY = 96;

export type ScoutingSource =
  | 'EFFECTIF'        // joueur de son club : on le voit tous les jours
  | 'ADVERSAIRE'      // affronté en match
  | 'MISSION'         // observé par le scout sur demande
  | 'INCONNU';

export interface PlayerKnowledge {
  readonly familiarity: number;
  readonly source: ScoutingSource;
}

export const UNKNOWN_KNOWLEDGE: PlayerKnowledge = { familiarity: 0, source: 'INCONNU' };

/** Facteur d'efficacité du scout (0.70 à 1.30) d'après sa compétence. */
export function scoutEfficiency(scoutQuality: number): number {
  return 0.70 + (scoutQuality / 100) * 0.60;
}

/** Gain de familiarité pour un joueur de son propre effectif, après un match joué. */
export function familiarityFromOwnSquad(matchesPlayed: number, scoutQuality: number): number {
  const gain = OWN_SQUAD_BASE_FAMILIARITY + matchesPlayed * 2.2 * scoutEfficiency(scoutQuality);
  return Math.min(MAX_FAMILIARITY, Math.round(gain));
}

/** Gain apporté par une journée de mission de scouting. */
export function familiarityFromScoutingRound(current: number, scoutQuality: number): number {
  // Progression décroissante : les premières observations apprennent beaucoup,
  // les suivantes affinent. Sans ça, deux journées suffiraient à tout savoir.
  const remaining = MAX_FAMILIARITY - current;
  const gain = remaining * 0.18 * scoutEfficiency(scoutQuality);
  return Math.min(MAX_FAMILIARITY, Math.round(current + Math.max(2, gain)));
}

/** Gain apporté par une confrontation directe. */
export function familiarityFromFacing(current: number, scoutQuality: number): number {
  const gain = 6 * scoutEfficiency(scoutQuality);
  return Math.min(MAX_FAMILIARITY, Math.round(current + gain));
}

// =============================================================================
// Estimation
// =============================================================================

export type Certainty = 'INCONNU' | 'VAGUE' | 'APPROXIMATIF' | 'FIABLE' | 'CERTAIN';

export const CERTAINTY_LABEL: Readonly<Record<Certainty, string>> = {
  INCONNU: 'Jamais observé',
  VAGUE: 'Rapport très incertain',
  APPROXIMATIF: 'Première impression',
  FIABLE: 'Bien identifié',
  CERTAIN: 'Parfaitement connu',
};

export function certaintyFor(familiarity: number): Certainty {
  if (familiarity <= 4) return 'INCONNU';
  if (familiarity < 30) return 'VAGUE';
  if (familiarity < 58) return 'APPROXIMATIF';
  if (familiarity < 85) return 'FIABLE';
  return 'CERTAIN';
}

export interface Estimate {
  /** Borne basse de la fourchette perçue. */
  readonly min: number;
  /** Borne haute. */
  readonly max: number;
  /** Meilleure estimation ponctuelle du scout (peut être fausse). */
  readonly point: number;
  readonly certainty: Certainty;
  /** Texte prêt à afficher : « 74 » si certain, « 68–81 » sinon, « ? » si inconnu. */
  readonly display: string;
}

/**
 * Hash déterministe d'une chaîne, ramené dans [-1, 1].
 * Sert à donner au scout un biais stable, propre à chaque joueur et attribut.
 */
function signedHash(salt: string): number {
  let h = 2166136261;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 pour rester non signé, puis normalisation.
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Demi-largeur de la fourchette d'erreur pour une familiarité donnée. */
function errorWidth(familiarity: number, maxWidth: number): number {
  const known = Math.max(0, Math.min(100, familiarity)) / 100;
  // Décroissance quadratique : l'incertitude tombe vite au début puis se stabilise.
  return maxWidth * (1 - known) * (1 - known * 0.45);
}

function clampStat(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

/**
 * Estime un attribut visible (technique, physique, mental).
 *
 * `salt` doit identifier le couple joueur+attribut pour que le biais soit stable
 * et différent d'un attribut à l'autre.
 */
export function estimateAttribute(
  trueValue: number,
  familiarity: number,
  salt: string,
  maxWidth = 18,
): Estimate {
  const certainty = certaintyFor(familiarity);
  if (certainty === 'INCONNU') {
    return { min: 1, max: 99, point: trueValue, certainty, display: '?' };
  }

  const width = errorWidth(familiarity, maxWidth);
  if (width < 1.2) {
    return { min: trueValue, max: trueValue, point: trueValue, certainty, display: String(trueValue) };
  }

  // Biais stable : le scout se trompe toujours dans le même sens sur ce joueur.
  const bias = signedHash(salt) * width * 0.55;
  const point = clampStat(trueValue + bias);
  const min = clampStat(point - width);
  const max = clampStat(point + width);

  return { min, max, point, certainty, display: `${min}–${max}` };
}

/**
 * Estime le potentiel.
 *
 * Le potentiel est structurellement plus difficile à cerner que le niveau actuel :
 * on peut voir ce qu'un joueur *est*, beaucoup moins ce qu'il *deviendra*. La
 * familiarité effective est donc réduite, et la fourchette plus large.
 */
export function estimatePotential(
  player: Player,
  familiarity: number,
  /** Saison en cours. Sans elle, l'âge n'est pas pris en compte. */
  currentSeason?: number,
): Estimate {
  // Le potentiel d'un joueur mûr n'est plus une hypothèse : il l'a déjà atteint.
  // Sans cet ajustement, on affichait « 89–99 » pour un pilier de 30 ans, comme
  // s'il pouvait encore exploser.
  const age = currentSeason === undefined
    ? undefined
    : currentSeason - Number(player.birthDate.slice(0, 4));
  const maturity = age === undefined ? 0
    : age >= 30 ? 0.34
      : age >= 27 ? 0.24
        : age >= 24 ? 0.12
          : 0;

  const effective = Math.min(MAX_FAMILIARITY, familiarity * (0.72 + maturity));
  const estimate = estimateAttribute(
    player.hidden.potentiel,
    effective,
    `pot_${player.id}`,
    26,
  );

  // Un potentiel ne peut pas être inférieur au niveau déjà atteint : le scout le
  // sait, même quand il se trompe sur la marge de progression.
  const floor = Math.round(currentAbility(player));
  if (estimate.certainty === 'INCONNU') return estimate;
  const min = Math.max(estimate.min, floor);
  const max = Math.max(estimate.max, min);
  return {
    ...estimate,
    min,
    max,
    point: Math.max(estimate.point, min),
    display: min === max ? String(min) : `${min}–${max}`,
  };
}

/** Fourchette de valeur marchande, en euros. */
export interface ValueEstimate {
  readonly min: number;
  readonly max: number;
  readonly certainty: Certainty;
}

/**
 * Estime ce que vaut un joueur sur le marché — V0.28.
 *
 * Le chiffre exact reste l'affaire du club vendeur. Ce que le manager obtient,
 * c'est le chiffrage de **son** service recrutement : d'autant plus large qu'on
 * connaît mal le joueur. Une cible jamais observée n'est pas chiffrable, ce qui
 * donne enfin une raison mécanique d'envoyer un scout avant de dégainer.
 */
export function estimateValue(trueValue: number, familiarity: number, salt: string): ValueEstimate {
  const certainty = certaintyFor(familiarity);
  if (certainty === 'INCONNU') {
    return { min: 0, max: 0, certainty };
  }

  // ±55 % au pire, en proportion de la valeur : une erreur de 300 k€ sur un
  // joueur à 8 M€ n'a pas le même sens que sur un joueur à 400 k€.
  const width = errorWidth(familiarity, 0.55) * trueValue;
  const bias = signedHash(`val_${salt}`) * width * 0.5;
  const point = trueValue + bias;

  const round = (n: number): number => Math.max(20_000, Math.round(n / 10_000) * 10_000);
  return { min: round(point - width), max: round(point + width), certainty };
}

/** Niveau actuel approximatif — même formule que le développement. */
export function currentAbility(p: Player): number {
  const t = p.technical;
  const ph = p.physical;
  const m = p.mental;
  const tech = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const phys = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const ment = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (tech + phys + ment) / 3;
}

/**
 * Marge de progression perçue, exprimée qualitativement.
 * Remplace l'approximation par l'âge utilisée jusqu'ici dans l'écran Entraînement.
 */
export function upsideLabel(player: Player, familiarity: number, currentSeason?: number): string {
  const certainty = certaintyFor(familiarity);
  if (certainty === 'INCONNU') return 'Non évalué';

  const age = currentSeason === undefined
    ? undefined
    : currentSeason - Number(player.birthDate.slice(0, 4));

  // Passé un certain âge, la marge théorique ne se réalisera plus : annoncer
  // « encore un peu de marge » à un joueur de 33 ans serait un mauvais conseil,
  // même si son potentiel reste nominalement au-dessus de son niveau actuel.
  if (age !== undefined) {
    if (age >= 33) return 'En fin de carrière';
    if (age >= 30) return 'Sur le déclin';
    if (age >= 28) return 'À son sommet';
  }

  const estimate = estimatePotential(player, familiarity, currentSeason);
  const gap = estimate.point - currentAbility(player);

  const hedge = certainty === 'VAGUE' ? 'Peut-être ' : certainty === 'APPROXIMATIF' ? 'Sans doute ' : '';
  if (gap >= 18) return `${hedge}très grande marge`;
  if (gap >= 10) return `${hedge}belle marge`;
  if (gap >= 4) return `${hedge}encore un peu de marge`;
  return `${hedge}proche de son plafond`;
}

// =============================================================================
// État de scouting d'une saison
// =============================================================================

export interface ScoutingState {
  /** Familiarité par joueur. */
  readonly knowledge: ReadonlyMap<PlayerId, PlayerKnowledge>;
  /** Joueurs actuellement en mission d'observation. */
  readonly assignments: readonly PlayerId[];
  /**
   * V0.43 — clubs sous observation.
   *
   * Le dossier d'avant-match tirait sa précision de la familiarité moyenne du
   * XV adverse, laquelle ne montait qu'en **affrontant** l'équipe : on ne
   * pouvait rien préparer avant de l'avoir déjà jouée. Observer un club fait
   * progresser tout son effectif d'un coup, et c'est ce qui dé-brouille le
   * dossier là où l'on a investi.
   */
  readonly clubAssignments?: readonly ClubId[];
}

export const EMPTY_SCOUTING: ScoutingState = {
  knowledge: new Map(), assignments: [], clubAssignments: [],
};

/**
 * Coût d'une mission sur un club, en créneaux.
 *
 * Observer un effectif entier mobilise davantage qu'une cible isolée : c'est
 * l'arbitrage qui rend le choix intéressant — préparer un adversaire, ou
 * continuer à suivre ses pistes de recrutement.
 */
export const CLUB_MISSION_COST = 2;

/** Créneaux consommés par les missions en cours. */
export function usedSlots(state: ScoutingState): number {
  return state.assignments.length + (state.clubAssignments?.length ?? 0) * CLUB_MISSION_COST;
}

/** Met un club sous observation, si les créneaux le permettent. */
export function assignClubScout(
  state: ScoutingState,
  clubId: ClubId,
  scoutQuality: number,
): ScoutingState {
  const current = state.clubAssignments ?? [];
  if (current.includes(clubId)) return state;
  if (usedSlots(state) + CLUB_MISSION_COST > scoutingSlots(scoutQuality)) return state;
  return { ...state, clubAssignments: [...current, clubId] };
}

export function unassignClubScout(state: ScoutingState, clubId: ClubId): ScoutingState {
  const current = state.clubAssignments ?? [];
  if (!current.includes(clubId)) return state;
  return { ...state, clubAssignments: current.filter(id => id !== clubId) };
}

/**
 * Nombre de joueurs observables simultanément.
 * Un bon scout couvre plus de terrain — c'est ce qui rend le poste intéressant.
 */
export function scoutingSlots(scoutQuality: number): number {
  if (scoutQuality >= 85) return 5;
  if (scoutQuality >= 70) return 4;
  if (scoutQuality >= 50) return 3;
  return 2;
}

export function knowledgeOf(state: ScoutingState, playerId: PlayerId): PlayerKnowledge {
  return state.knowledge.get(playerId) ?? UNKNOWN_KNOWLEDGE;
}

/** Ajoute un joueur aux missions d'observation, dans la limite des créneaux. */
export function assignScout(
  state: ScoutingState,
  playerId: PlayerId,
  scoutQuality: number,
): ScoutingState {
  if (state.assignments.includes(playerId)) return state;
  if (usedSlots(state) >= scoutingSlots(scoutQuality)) return state;
  return { ...state, assignments: [...state.assignments, playerId] };
}

export function unassignScout(state: ScoutingState, playerId: PlayerId): ScoutingState {
  if (!state.assignments.includes(playerId)) return state;
  return { ...state, assignments: state.assignments.filter(id => id !== playerId) };
}

/**
 * Fait progresser la connaissance d'une journée.
 *
 * - les joueurs de l'effectif progressent seuls (on les côtoie)
 * - les cibles en mission progressent nettement plus vite
 * - les joueurs affrontés ce week-end laissent une impression
 */
export function advanceScouting(
  state: ScoutingState,
  input: {
    readonly ownSquadIds: readonly PlayerId[];
    readonly matchesPlayedByPlayer: ReadonlyMap<PlayerId, number>;
    readonly facedOpponentIds: readonly PlayerId[];
    readonly scoutQuality: number;
    /** V0.43 — effectifs des clubs sous observation. */
    readonly scoutedClubRosters?: ReadonlyMap<ClubId, readonly PlayerId[]>;
  },
): ScoutingState {
  const next = new Map(state.knowledge);

  for (const id of input.ownSquadIds) {
    const matches = input.matchesPlayedByPlayer.get(id) ?? 0;
    next.set(id, {
      familiarity: familiarityFromOwnSquad(matches, input.scoutQuality),
      source: 'EFFECTIF',
    });
  }

  for (const id of state.assignments) {
    const current = next.get(id);
    if (current?.source === 'EFFECTIF') continue;      // déjà à demeure
    next.set(id, {
      familiarity: familiarityFromScoutingRound(current?.familiarity ?? 0, input.scoutQuality),
      source: 'MISSION',
    });
  }

  // Un club observé fait progresser tout son effectif. Le gain est celui d'une
  // mission ordinaire : observer une équipe entière coûte deux créneaux, c'est
  // là que se paie l'ampleur — pas dans un rendement dégradé, qui rendrait la
  // mission simplement moins bonne au lieu d'être un autre choix.
  for (const clubId of state.clubAssignments ?? []) {
    for (const id of input.scoutedClubRosters?.get(clubId) ?? []) {
      const current = next.get(id);
      if (current?.source === 'EFFECTIF') continue;
      next.set(id, {
        familiarity: familiarityFromScoutingRound(current?.familiarity ?? 0, input.scoutQuality),
        source: 'MISSION',
      });
    }
  }

  for (const id of input.facedOpponentIds) {
    const current = next.get(id);
    if (current?.source === 'EFFECTIF' || current?.source === 'MISSION') continue;
    next.set(id, {
      familiarity: familiarityFromFacing(current?.familiarity ?? 0, input.scoutQuality),
      source: 'ADVERSAIRE',
    });
  }

  return { ...state, knowledge: next };
}
