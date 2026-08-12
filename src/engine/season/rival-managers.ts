/**
 * Les managers rivaux — V0.53.
 *
 * Les clubs IA licencient leur entraîneur depuis la V0.43 : c'est de là que
 * viennent les postes vacants. Mais **cet entraîneur n'existait nulle part**.
 * Une vacance était un simple identifiant de club, et le monde limogeait des
 * fantômes.
 *
 * Conséquence sur la carrière du joueur : sa réputation ne se comparait à rien.
 * Personne ne lui disputait le banc qu'il visait, personne ne soulevait le
 * Brennus à sa place, personne ne se faisait virer après six défaites pendant
 * qu'il tenait le sien. La ligne « réputation 62 » de sa fiche ne mesurait rien.
 *
 * ## Ce que ce module ajoute, et ce qu'il n'ajoute pas
 *
 * Il **ne simule pas** treize managers en train de composer une équipe : le
 * moteur décide déjà des résultats des clubs IA, et doubler cette décision
 * n'apporterait rien. Ce qu'il ajoute, c'est un **nom sur chaque banc** et une
 * carrière qui bouge : on est limogé, on rebondit ailleurs, on monte ou on
 * descend dans l'estime générale.
 *
 * Et surtout : quand un banc se libère, le joueur n'est plus seul à le vouloir.
 */

import type { Club, ClubId } from '../types.js';
import type { Rng } from '../rng.js';

// =============================================================================
// Le corps des entraîneurs
// =============================================================================

/** Ce qu'un entraîneur fait jouer à son club. */
export type ManagerStyle = 'JEU_AVANTS' | 'JEU_MAIN' | 'PRAGMATIQUE' | 'FORMATEUR';

export const STYLE_LABEL: Readonly<Record<ManagerStyle, string>> = {
  JEU_AVANTS: 'Jeu d\'avants',
  JEU_MAIN: 'Jeu de mouvement',
  PRAGMATIQUE: 'Pragmatique',
  FORMATEUR: 'Formateur',
};

export interface RivalManager {
  readonly id: string;
  readonly name: string;
  /** Réputation 0-100, sur la même échelle que celle du joueur. */
  readonly reputation: number;
  readonly style: ManagerStyle;
  /** Ce que la presse dit de lui, en une phrase. */
  readonly reputationLine: string;
  /** Saisons passées sur un banc, tous clubs confondus. */
  readonly seasons: number;
  /** Nombre de fois qu'il a été remercié. */
  readonly sackings: number;
}

/**
 * Le vivier de départ.
 *
 * Quinze noms pour quatorze bancs de Top 14 : il faut au moins un entraîneur
 * disponible au premier limogeage, sinon le premier banc libéré resterait vide.
 * Écrits à la main comme les arbitres et les rivalités — une réputation qui
 * s'échelonne de 34 à 88, pour que la hiérarchie se voie.
 */
const ROSTER: readonly Omit<RivalManager, 'seasons' | 'sackings'>[] = [
  { id: 'mgr_lasserre', name: 'Jean-Marc Lasserre', reputation: 88, style: 'PRAGMATIQUE',
    reputationLine: 'Trois titres et une réputation de gagneur froid.' },
  { id: 'mgr_dutronc', name: 'Philippe Dutronc', reputation: 82, style: 'JEU_AVANTS',
    reputationLine: 'Bâtit ses équipes autour du pack et ne s\'en excuse pas.' },
  { id: 'mgr_ibanez', name: 'Ramón Ibáñez', reputation: 78, style: 'JEU_MAIN',
    reputationLine: 'Fait jouer un rugby de mouvement que tout le monde admire et que peu copient.' },
  { id: 'mgr_verdier', name: 'Olivier Verdier', reputation: 74, style: 'FORMATEUR',
    reputationLine: 'A sorti plus d\'internationaux qu\'il n\'a gagné de trophées.' },
  { id: 'mgr_kavanagh', name: 'Declan Kavanagh', reputation: 70, style: 'PRAGMATIQUE',
    reputationLine: 'Redresse les clubs en difficulté, puis s\'en va.' },
  { id: 'mgr_soulier', name: 'Bruno Soulier', reputation: 66, style: 'JEU_AVANTS',
    reputationLine: 'Conquête, occupation, discipline. Rien d\'autre.' },
  { id: 'mgr_delmas', name: 'Éric Delmas', reputation: 61, style: 'JEU_MAIN',
    reputationLine: 'Séduisant à domicile, fragile à l\'extérieur.' },
  { id: 'mgr_ferreira', name: 'Tiago Ferreira', reputation: 57, style: 'FORMATEUR',
    reputationLine: 'Fait confiance aux jeunes, parfois trop tôt.' },
  { id: 'mgr_bonnaire', name: 'Stéphane Bonnaire', reputation: 53, style: 'PRAGMATIQUE',
    reputationLine: 'Solide, discret, jamais spectaculaire.' },
  { id: 'mgr_wallace', name: 'Andrew Wallace', reputation: 49, style: 'JEU_MAIN',
    reputationLine: 'Arrivé de l\'hémisphère sud avec des idées et peu de résultats.' },
  { id: 'mgr_pradal', name: 'Michel Pradal', reputation: 45, style: 'JEU_AVANTS',
    reputationLine: 'Vieux routier du championnat, deux fois sauveur d\'un maintien.' },
  { id: 'mgr_teixeira', name: 'Luis Teixeira', reputation: 41, style: 'FORMATEUR',
    reputationLine: 'Sorti du centre de formation, jamais parti bien loin.' },
  { id: 'mgr_castex', name: 'Yannick Castex', reputation: 38, style: 'PRAGMATIQUE',
    reputationLine: 'Adjoint promu, encore à faire ses preuves.' },
  { id: 'mgr_orsini', name: 'Marc Orsini', reputation: 36, style: 'JEU_MAIN',
    reputationLine: 'Un passage remarqué en Pro D2, rien prouvé au-dessus.' },
  { id: 'mgr_lehmann', name: 'Karl Lehmann', reputation: 34, style: 'JEU_AVANTS',
    reputationLine: 'Réputation d\'homme dur, résultats en dents de scie.' },
];

// =============================================================================
// L'état du corps
// =============================================================================

export interface RivalState {
  readonly managers: readonly RivalManager[];
  /** Qui entraîne quoi. Le club de l'utilisateur n'y figure jamais. */
  readonly byClub: ReadonlyMap<string, string>;
}

export const EMPTY_RIVALS: RivalState = { managers: [], byClub: new Map() };

/**
 * Installe un entraîneur sur chaque banc, sauf celui de l'utilisateur.
 *
 * Les meilleurs vont aux plus gros clubs : c'est ainsi qu'un championnat se
 * range, et cela rend crédible le fait qu'un grand club ne vienne pas chercher
 * un inconnu.
 */
export function seedRivals(
  clubs: readonly Club[],
  playerClubId: ClubId,
  reputationOf: (c: Club) => number,
): RivalState {
  const managers: RivalManager[] = ROSTER.map(m => ({ ...m, seasons: 0, sackings: 0 }));
  const benches = clubs
    .filter(c => c.id !== playerClubId)
    .sort((a, b) => reputationOf(b) - reputationOf(a));

  const byClub = new Map<string, string>();
  const pool = [...managers].sort((a, b) => b.reputation - a.reputation);
  for (let i = 0; i < benches.length && i < pool.length; i++) {
    byClub.set(benches[i]!.id as string, pool[i]!.id);
  }
  return { managers, byClub };
}

/** L'entraîneur d'un club, s'il en a un. */
export function managerOf(state: RivalState, clubId: ClubId): RivalManager | undefined {
  const id = state.byClub.get(clubId as string);
  return id === undefined ? undefined : state.managers.find(m => m.id === id);
}

/** Ceux qui n'ont pas de banc et attendent leur tour. */
export function unemployed(state: RivalState): readonly RivalManager[] {
  const employed = new Set(state.byClub.values());
  return state.managers.filter(m => !employed.has(m.id));
}

// =============================================================================
// La carrière bouge
// =============================================================================

/**
 * Un club remercie son entraîneur.
 *
 * Le limogeage coûte de la réputation, mais moins qu'on ne croit : dans le
 * rugby professionnel, se faire virer d'un club en difficulté n'a jamais fermé
 * de portes. C'est la répétition qui condamne, d'où le compteur.
 */
export function sackRival(state: RivalState, clubId: ClubId): {
  readonly state: RivalState;
  readonly sacked: RivalManager | undefined;
} {
  const sacked = managerOf(state, clubId);
  if (sacked === undefined) return { state, sacked: undefined };

  const byClub = new Map(state.byClub);
  byClub.delete(clubId as string);

  const managers = state.managers.map(m => m.id === sacked.id
    ? {
      ...m,
      reputation: Math.max(20, m.reputation - 6),
      sackings: m.sackings + 1,
    }
    : m);

  return { state: { managers, byClub }, sacked: { ...sacked } };
}

/**
 * Un banc vacant trouve preneur.
 *
 * Le club prend le meilleur disponible **à sa portée** : un club modeste ne
 * décroche pas une gloire, un grand club ne se rabat pas sur un inconnu tant
 * qu'il a mieux. À défaut de candidat crédible, il prend qui reste — un club ne
 * commence pas une saison sans entraîneur.
 */
export function fillVacancy(
  state: RivalState,
  club: Club,
  clubStature: number,
  rng: Rng,
): { readonly state: RivalState; readonly hired: RivalManager | undefined } {
  const libres = unemployed(state);
  if (libres.length === 0) return { state, hired: undefined };

  const crédibles = libres.filter(m => Math.abs(m.reputation - clubStature) <= 22);
  const pool = crédibles.length > 0 ? crédibles : libres;
  // Le meilleur du lot, avec une part de hasard : un président n'est pas un
  // tableur, et deux carrières identiques ne se rejouent pas.
  const sorted = [...pool].sort((a, b) => b.reputation - a.reputation);
  const hired = sorted[rng.nextInt(0, Math.min(2, sorted.length - 1))]!;

  const byClub = new Map(state.byClub);
  byClub.set(club.id as string, hired.id);
  return { state: { managers: state.managers, byClub }, hired };
}

/**
 * Bilan de saison d'un entraîneur en poste.
 *
 * On ne juge pas sur le rang brut mais sur **l'écart à ce qu'on attendait de
 * lui** : finir huitième avec le budget de Toulouse est un échec, le même
 * classement avec celui de Vannes est un exploit. C'est le même principe que
 * pour le manager joueur.
 */
export function reviewRivalSeason(
  state: RivalState,
  clubId: ClubId,
  finalRank: number,
  expectedRank: number,
): RivalState {
  const manager = managerOf(state, clubId);
  if (manager === undefined) return state;

  const gap = expectedRank - finalRank;          // positif = mieux que prévu
  const delta = Math.max(-8, Math.min(8, Math.round(gap * 1.5)));

  return {
    ...state,
    managers: state.managers.map(m => m.id === manager.id
      ? {
        ...m,
        reputation: Math.max(20, Math.min(99, m.reputation + delta)),
        seasons: m.seasons + 1,
      }
      : m),
  };
}

// =============================================================================
// Le joueur n'est plus seul à vouloir le poste
// =============================================================================

/**
 * Un rival prend-il le banc avant le joueur ?
 *
 * C'est ce qui donne enfin un sens à la réputation du manager : elle ne sert
 * plus seulement à ouvrir des portes, elle se **compare** à celle des autres
 * candidats. Un banc convoité par Lasserre ne vous attendra pas.
 *
 * On ne compare qu'aux entraîneurs sans club : ceux qui sont en poste ne
 * démissionnent pas pour aller ailleurs en cours de mercato.
 */
export function contestedBy(
  state: RivalState,
  clubStature: number,
  playerReputation: number,
): RivalManager | undefined {
  const rivaux = unemployed(state)
    .filter(m => Math.abs(m.reputation - clubStature) <= 22)
    .filter(m => m.reputation > playerReputation + 8)
    .sort((a, b) => b.reputation - a.reputation);
  return rivaux[0];
}

/**
 * Classement de réputation, le joueur inclus.
 *
 * Sans cette lecture, la réputation reste un nombre isolé sur une fiche. Avec
 * elle, elle devient un rang — et un rang, on cherche à le monter.
 */
export function reputationTable(
  state: RivalState,
  player: {
    readonly name: string;
    readonly reputation: number;
    readonly clubName?: string | undefined;
  },
  clubNameOf: (clubId: string) => string | undefined,
): readonly {
  readonly name: string;
  readonly reputation: number;
  readonly clubName: string | undefined;
  readonly isPlayer: boolean;
}[] {
  const employedBy = new Map<string, string>();
  for (const [clubId, managerId] of state.byClub) employedBy.set(managerId, clubId);

  const rows = state.managers.map(m => ({
    name: m.name,
    reputation: m.reputation,
    clubName: (() => {
      const clubId = employedBy.get(m.id);
      return clubId === undefined ? undefined : clubNameOf(clubId);
    })(),
    isPlayer: false,
  }));

  rows.push({
    name: player.name,
    reputation: player.reputation,
    clubName: player.clubName,
    isPlayer: true,
  });

  return rows.sort((a, b) => b.reputation - a.reputation);
}
