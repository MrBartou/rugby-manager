/**
 * La hiérarchie de l'effectif — V0.50.
 *
 * Le moral d'un joueur dépend depuis la V0.4 de son « statut dans l'équipe ».
 * Ce statut n'a jamais été autre chose qu'une **déduction** : le moteur regarde
 * la part de matchs disputés et en conclut « titulaire indiscutable » au-dessus
 * de 85 %, « peu utilisé » en dessous de 30 %.
 *
 * Conséquence : le manager ne pouvait rien **annoncer**. La seule façon de dire
 * à un joueur « tu es un cadre » était de le faire jouer, et la seule façon de
 * dire à un jeune « prends ton temps » était… de le faire jouer aussi, faute de
 * quoi il se démoralisait comme un international mis au placard.
 *
 * C'est le pendant manquant de la promesse de temps de jeu de la V0.48 : celle-ci
 * porte sur six journées et un homme, la hiérarchie porte sur la saison et tout
 * le groupe.
 *
 * ## Ce qui en fait une décision
 *
 * Annoncer ne coûte rien sur le moment — c'est **tenir** qui coûte. Deux
 * mécanismes l'imposent :
 *
 *  - un statut est une attente chiffrée de temps de jeu. Le joueur compare ce
 *    qu'on lui a dit à ce qu'il vit, et c'est **l'écart** qui décide de son
 *    moral, pas le temps de jeu brut. Un cadre à 30 % est furieux ; un espoir à
 *    20 % est parfaitement en paix ;
 *  - un XV ne contient que quinze places. Promettre le statut de cadre à vingt
 *    joueurs est une promesse arithmétiquement intenable, et le module le dit.
 */

import type { Player, PlayerId } from '../types.js';

// =============================================================================
// Les statuts
// =============================================================================

export type SquadStatus = 'CADRE' | 'ROTATION' | 'ESPOIR' | 'HORS_PROJET';

export const STATUS_LABEL: Readonly<Record<SquadStatus, string>> = {
  CADRE: 'Cadre',
  ROTATION: 'Rotation',
  ESPOIR: 'Espoir',
  HORS_PROJET: 'Hors projet',
};

export const STATUS_DESCRIPTION: Readonly<Record<SquadStatus, string>> = {
  CADRE: 'Il joue quand il est disponible. Attend d\'être aligné.',
  ROTATION: 'Il tourne avec les autres. Une semaine sur deux lui convient.',
  ESPOIR: 'Il apprend. Quelques entrées lui suffisent, il ne réclame rien.',
  HORS_PROJET: 'Il sait qu\'il ne compte pas. Il cherchera autre chose.',
};

/**
 * Part de matchs que chaque statut promet, implicitement.
 *
 * Ce sont les chiffres sur lesquels le joueur juge — pas des quotas que le
 * moteur ferait respecter. Le manager reste libre de composer comme il veut ;
 * il en paie simplement le prix en vestiaire.
 */
export const EXPECTED_RATIO: Readonly<Record<SquadStatus, number>> = {
  CADRE: 0.75,
  ROTATION: 0.45,
  ESPOIR: 0.15,
  HORS_PROJET: 0,
};

/** Statut par défaut, quand le manager n'a rien annoncé. */
export const DEFAULT_STATUS: SquadStatus = 'ROTATION';

/**
 * Statut que le temps de jeu constaté suggère.
 *
 * Sert de proposition à l'écran d'effectif et de repli pour une sauvegarde
 * antérieure à la V0.50, où personne n'a jamais rien déclaré : sans cela,
 * charger une vieille partie repasserait tout le monde en « rotation » et
 * bouleverserait le moral de l'effectif du jour au lendemain.
 */
export function inferStatus(playRatio: number, age: number): SquadStatus {
  if (playRatio >= 0.6) return 'CADRE';
  if (playRatio >= 0.25) return 'ROTATION';
  if (age <= 23) return 'ESPOIR';
  return playRatio > 0 ? 'ROTATION' : 'HORS_PROJET';
}

// =============================================================================
// Tenir sa parole
// =============================================================================

export type StatusVerdict = 'TENU' | 'SOUS_UTILISE' | 'SUR_UTILISE';

export interface StatusJudgement {
  readonly verdict: StatusVerdict;
  /** Écart entre le temps de jeu promis et le temps de jeu vécu, en points. */
  readonly gap: number;
  readonly moodDelta: number;
  readonly reason: string;
}

/**
 * Tolérance avant qu'un joueur estime qu'on lui a menti.
 *
 * Large à dessein : une blessure, une suspension, un adversaire qui ne convient
 * pas — un effectif ne tourne jamais au chiffre près, et un joueur
 * professionnel le sait.
 */
const TOLERANCE = 0.18;

/**
 * Ce qu'un joueur pense de son sort, au regard de ce qu'on lui a dit.
 *
 * C'est **l'écart** qui compte, jamais le temps de jeu brut. Un espoir à 15 %
 * est content ; le même, à qui l'on aurait promis d'être cadre, est amer avec
 * exactement les mêmes minutes. C'est toute la différence entre subir une
 * hiérarchie et l'avoir acceptée.
 *
 * Jouer **plus** que promis ne rend jamais malheureux : personne ne s'est
 * jamais plaint d'être surclassé. Cela vaut un petit bonus, pas un malus.
 */
export function judgeStatus(
  status: SquadStatus,
  playRatio: number,
  traitIds: readonly string[] = [],
): StatusJudgement {
  const expected = EXPECTED_RATIO[status];
  const gap = playRatio - expected;

  if (gap >= TOLERANCE) {
    return {
      verdict: 'SUR_UTILISE',
      gap,
      moodDelta: 4,
      reason: `Joue plus que son statut de ${STATUS_LABEL[status].toLowerCase()} ne le promettait`,
    };
  }

  if (gap > -TOLERANCE) {
    return {
      verdict: 'TENU',
      gap,
      moodDelta: status === 'HORS_PROJET' ? -6 : 3,
      reason: status === 'HORS_PROJET'
        ? 'Écarté du projet, et il le sait'
        : `Son rôle de ${STATUS_LABEL[status].toLowerCase()} est respecté`,
    };
  }

  // Sous-utilisé : le manque à gagner se paie proportionnellement, amplifié par
  // la sensibilité au statut que portent déjà les traits.
  const shortfall = -gap - TOLERANCE;
  const base = -Math.round(shortfall * 45);
  const sensitivity = statusSensitivity(traitIds);
  return {
    verdict: 'SOUS_UTILISE',
    gap,
    moodDelta: Math.max(-22, Math.round(base * sensitivity)),
    reason: `On lui avait annoncé un rôle de ${STATUS_LABEL[status].toLowerCase()}`,
  };
}

/**
 * Amplification par le tempérament.
 *
 * Les mêmes traits que ceux qui pèsent déjà sur le statut dans `mood.ts` : un
 * ambitieux ne vit pas la mise à l'écart comme un satisfait.
 */
function statusSensitivity(traitIds: readonly string[]): number {
  let s = 1;
  if (traitIds.includes('ambitieux')) s += 0.3;
  if (traitIds.includes('mercenaire')) s += 0.2;
  if (traitIds.includes('rancunier')) s += 0.2;
  if (traitIds.includes('satisfait')) s -= 0.35;
  if (traitIds.includes('professionnel')) s -= 0.15;
  if (traitIds.includes('attache_club')) s -= 0.2;
  return Math.max(0.3, s);
}

// =============================================================================
// Ce qu'un effectif peut porter
// =============================================================================

export interface CoherenceReport {
  readonly cadres: number;
  readonly rotation: number;
  readonly espoirs: number;
  readonly horsProjet: number;
  /** Somme des temps de jeu promis, en places de feuille de match. */
  readonly promisedPlaces: number;
  /** Places qu'une feuille de match offre réellement. */
  readonly availablePlaces: number;
  readonly overcommitted: boolean;
  readonly summary: string;
}

/**
 * Places qu'une feuille de match offre réellement.
 *
 * Quinze titulaires, plus la valeur des entrées en jeu du banc — un remplaçant
 * qui entre à l'heure de jeu compte pour environ un tiers de match. C'est le
 * plafond arithmétique de ce qu'un manager peut promettre.
 */
export const SEASON_PLACES = 15 + 8 * 0.35;

/**
 * Dit si la hiérarchie annoncée tient debout.
 *
 * Sans ce garde-fou, déclarer tout le monde cadre serait gratuit : chacun se
 * sentirait reconnu et personne ne pourrait jouer les 75 % promis. Le module ne
 * l'interdit pas — il l'annonce, et le vestiaire s'en chargera.
 */
export function coherence(statuses: readonly SquadStatus[]): CoherenceReport {
  const count = (s: SquadStatus): number => statuses.filter(x => x === s).length;
  const cadres = count('CADRE');
  const rotation = count('ROTATION');
  const espoirs = count('ESPOIR');
  const horsProjet = count('HORS_PROJET');

  // Un joueur à qui l'on promet 75 % consomme 0,75 apparition par match ; le XV
  // plus le banc en offre `SEASON_PLACES` par match. Les deux se comparent
  // directement — le nombre de journées se simplifie des deux côtés.
  const promised = statuses.reduce((sum, s) => sum + EXPECTED_RATIO[s], 0);
  const overcommitted = promised > SEASON_PLACES * 1.05;

  return {
    cadres, rotation, espoirs, horsProjet,
    promisedPlaces: Math.round(promised * 10) / 10,
    availablePlaces: Math.round(SEASON_PLACES * 10) / 10,
    overcommitted,
    summary: overcommitted
      ? `Vous avez promis plus de temps de jeu qu'une saison n'en contient. ${cadres} cadres, c'est trop pour quinze places.`
      : `${cadres} cadres, ${rotation} en rotation, ${espoirs} espoirs, ${horsProjet} hors projet.`,
  };
}

// =============================================================================
// Ce que le statut change ailleurs
// =============================================================================

/**
 * Exigence salariale, en multiplicateur du salaire de marché.
 *
 * Un cadre se sait cadre et le fait payer ; un joueur qu'on écarte sait qu'il
 * n'a pas de levier. Le statut cesse ainsi d'être une simple jauge de moral
 * pour devenir un engagement financier.
 */
export function salaryExpectation(status: SquadStatus): number {
  switch (status) {
    case 'CADRE': return 1.15;
    case 'ROTATION': return 1;
    case 'ESPOIR': return 0.85;
    case 'HORS_PROJET': return 0.8;
  }
}

/**
 * Surcroît de risque de demande de départ apporté par le statut.
 *
 * S'ajoute au risque calculé par [player-talk](../human/player-talk.ts) lors
 * d'une promesse trahie, et sert aussi de risque propre en intersaison : un
 * joueur mis hors projet finit par vouloir partir même sans qu'on lui ait rien
 * promis.
 */
export function departureRisk(status: SquadStatus, judgement: StatusVerdict): number {
  if (status === 'HORS_PROJET') return 0.35;
  if (judgement === 'SOUS_UTILISE') return status === 'CADRE' ? 0.25 : 0.12;
  return 0;
}

/** Statuts d'un effectif, indexés par joueur. */
export type StatusMap = ReadonlyMap<PlayerId, SquadStatus>;

/** Statut d'un joueur, avec repli sur ce que son temps de jeu suggère. */
export function statusOf(
  map: StatusMap,
  player: Player,
  playRatio: number,
  currentSeason: number,
): SquadStatus {
  const declared = map.get(player.id);
  if (declared !== undefined) return declared;
  const age = currentSeason - Number(player.birthDate.slice(0, 4));
  return inferStatus(playRatio, age);
}
