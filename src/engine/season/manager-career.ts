/**
 * Carrière du manager — V0.41.
 *
 * Le joueur choisissait un club au début et y restait jusqu'à ce que le board
 * le remercie — auquel cas la partie s'arrêtait net. La réputation était
 * calculée, stockée, sauvegardée, et ne servait qu'à **une seule chose** :
 * durcir l'objectif de la saison suivante.
 *
 * Gagner le Brennus avec Vannes et finir 9e avec Toulouse menaient donc au même
 * endroit. Ce module donne à la réussite une conséquence et à l'échec une
 * suite.
 *
 * ## Trois mécaniques
 *
 *  - les clubs **limogent** leur entraîneur quand la saison est ratée ;
 *  - les postes vacants **approchent** un manager à leur portée ;
 *  - être limogé rend **libre**, pas mort : on rebondit plus bas.
 *
 * ## Ce qui décide de tout : la réputation face à la stature
 *
 * Un club n'approche pas n'importe qui, et un manager n'accepte pas n'importe
 * quoi. La comparaison entre la réputation du manager et la stature du club
 * détermine à la fois qui appelle et ce que le board attendra — c'est la même
 * échelle qui gouverne l'ascension et la chute.
 */

import type { Rng } from '../rng.js';
import type { Club, ClubId } from '../types.js';
import { computeObjective, type SeasonObjective } from './board-objective.js';
import type { ManagerReputation } from './manager-reputation.js';

// =============================================================================
// Statut
// =============================================================================

export type ManagerStatus =
  | { readonly kind: 'EN_POSTE'; readonly clubId: ClubId }
  /** Limogé ou démissionnaire : sans club, en attente d'une proposition. */
  | { readonly kind: 'LIBRE'; readonly since: number; readonly reason: 'LIMOGE' | 'DEPART' }
  /**
   * V0.59 — sélectionneur du XV de France.
   *
   * Ni en poste dans un club ni libre : le poste ne se cumule pas, et il ne
   * laisse pas non plus disponible. Sept matchs par an, un groupe qu'on compose
   * aux fenêtres internationales, et le reste du temps les tribunes du Top 14.
   */
  | { readonly kind: 'SELECTIONNEUR'; readonly since: number; readonly failures: number };

// =============================================================================
// Stature d'un club
// =============================================================================

/**
 * Exigence d'un club, sur la même échelle 0-100 que la réputation.
 *
 * On mélange réputation du club et budget : un club historique désargenté reste
 * exigeant, un nouveau riche l'est aussi. Prendre l'un sans l'autre laisserait
 * passer l'un des deux cas.
 */
export function clubStature(club: Club): number {
  const byTier = club.tier === 'GROS_BUDGET' ? 70 : club.tier === 'BUDGET_MOYEN' ? 45 : 25;
  return Math.round(club.reputation * 0.55 + byTier * 0.45);
}

// =============================================================================
// Limogeages chez les autres clubs
// =============================================================================

export interface CoachSacking {
  readonly clubId: ClubId;
  readonly clubName: string;
  /** Ce qui a coûté sa place à l'entraîneur, pour le fil d'actualité. */
  readonly reason: string;
}

/**
 * Clubs qui se séparent de leur entraîneur à l'issue de la saison.
 *
 * Sans limogeages ailleurs, aucun poste ne se libérerait et la carrière serait
 * un cul-de-sac : le manager ne pourrait jamais bouger, quelle que soit sa
 * réussite.
 *
 * Le critère est l'écart entre le classement obtenu et celui qu'un club de
 * cette stature devait viser. Un promu 12e ne licencie personne ; un gros
 * budget 12e, oui.
 */
/**
 * Rotation de fond du métier : un banc change de titulaire même sans échec.
 * C'est ce qui garantit des postes vacants à tous les étages du championnat.
 */
const BASELINE_CHURN = 0.12;

export function sackedCoaches(
  clubs: readonly Club[],
  finalRanks: ReadonlyMap<ClubId, number>,
  playerClubId: ClubId,
  rng: Rng,
): readonly CoachSacking[] {
  const sackings: CoachSacking[] = [];

  for (const club of clubs) {
    if (club.id === playerClubId) continue;      // le sort du joueur se joue ailleurs
    const rank = finalRanks.get(club.id);
    if (rank === undefined) continue;

    const expected = expectedRankFor(club);
    const shortfall = rank - expected;

    // Au-delà du seuil, plus l'échec est net, plus la sanction est probable —
    // sans être automatique : un board peut toujours renouveler sa confiance.
    //
    // S'y ajoute une rotation de fond, indépendante du classement : départs,
    // fins de contrat, retraites. Sans elle, les seuls postes vacants étaient
    // ceux des gros clubs — les objectifs modestes étant presque toujours
    // atteints — et un manager limogé sans réputation ne recevait plus jamais
    // la moindre offre. Le rebond promis n'existait pas.
    const failureRisk = shortfall >= 4 ? Math.min(0.85, 0.25 + shortfall * 0.09) : 0;
    const risk = Math.max(failureRisk, BASELINE_CHURN);
    if (!rng.nextBool(risk)) continue;

    sackings.push({
      clubId: club.id,
      clubName: club.name,
      reason: shortfall < 4
        ? 'd\'un commun accord'
        : rank >= clubs.length - 1
          ? 'après une saison catastrophique'
          : `après une ${rank}ᵉ place, loin des attentes`,
    });
  }

  return sackings;
}

/**
 * Limogeages **en cours de saison** — V0.43.
 *
 * V0.41 ne libérait des bancs qu'à l'intersaison. Un manager sans club devait
 * donc reprendre immédiatement, faute de quoi il n'avait plus rien à faire
 * jusqu'à l'été suivant : l'année sabbatique était une impasse, et le jeu
 * l'interdisait plutôt que de la vivre.
 *
 * Un club ne renvoie pas son entraîneur en novembre pour un mauvais mois : il
 * faut un naufrage installé. Le seuil est donc plus dur qu'en fin de saison, et
 * la fenêtre est bornée — trop tôt, l'échantillon ne veut rien dire ; trop
 * tard, on finit la saison avec l'intérimaire.
 */
export const MIDSEASON_SACK_WINDOW = { from: 8, to: 20 } as const;

export function midSeasonSackings(
  clubs: readonly Club[],
  currentRanks: ReadonlyMap<ClubId, number>,
  round: number,
  rng: Rng,
): readonly CoachSacking[] {
  if (round < MIDSEASON_SACK_WINDOW.from || round > MIDSEASON_SACK_WINDOW.to) return [];

  const sackings: CoachSacking[] = [];
  for (const club of clubs) {
    const rank = currentRanks.get(club.id);
    if (rank === undefined) continue;

    const shortfall = rank - expectedRankFor(club);
    // Il faut un écart franc — six places sous les attentes — là où quatre
    // suffisent en fin d'exercice. Un club garde son entraîneur tant qu'il
    // reste une saison à retourner.
    if (shortfall < 6) continue;

    const risk = Math.min(0.30, 0.05 + (shortfall - 6) * 0.035);
    if (!rng.nextBool(risk)) continue;

    sackings.push({
      clubId: club.id,
      clubName: club.name,
      reason: `${rank}ᵉ à la journée ${round} — le bureau a tranché`,
    });
  }
  return sackings;
}

/** Classement qu'un club de cette stature est censé viser. */
function expectedRankFor(club: Club): number {
  const objective = computeObjective(club, 50);
  return objective.targetRank;
}

// =============================================================================
// Offres au manager
// =============================================================================

export interface JobOffer {
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly stature: number;
  /** Ce que le board attendra — calculé avec la réputation du manager. */
  readonly objective: SeasonObjective;
  /** Argument avancé par le club, en une phrase. */
  readonly pitch: string;
}

export interface JobOfferInput {
  readonly clubs: readonly Club[];
  /** Postes vacants : clubs sans entraîneur. */
  readonly vacancies: readonly ClubId[];
  readonly reputation: ManagerReputation;
  readonly status: ManagerStatus;
}

/**
 * Écart de stature au-delà duquel un club ne regarde même pas un manager.
 *
 * Asymétrique à dessein : un grand club ne recrute pas un inconnu (−12), mais
 * un petit club est ravi d'accueillir une gloire (+45). C'est ce qui permet de
 * rebondir après un limogeage sans jamais sauter les étapes vers le haut.
 */
const REACH_UP = 18;
const REACH_DOWN = 45;

/**
 * Propositions reçues par le manager.
 *
 * Un manager en poste n'est approché que par **plus gros que son club actuel** :
 * recevoir une offre d'un club plus modeste que le sien n'aurait aucun intérêt
 * et polluerait la décision.
 */
export function jobOffersFor(input: JobOfferInput): readonly JobOffer[] {
  const { clubs, vacancies, reputation, status } = input;
  const byId = new Map(clubs.map(c => [c.id, c]));

  const currentStature = status.kind === 'EN_POSTE'
    ? clubStature(byId.get(status.clubId) ?? clubs[0]!)
    : -Infinity;

  const offers: JobOffer[] = [];

  for (const clubId of vacancies) {
    const club = byId.get(clubId);
    if (!club) continue;

    const stature = clubStature(club);
    if (stature - reputation.score > REACH_UP) continue;       // hors de portée
    if (reputation.score - stature > REACH_DOWN) continue;     // sous son rang
    if (status.kind === 'EN_POSTE' && stature <= currentStature) continue;

    offers.push({
      clubId,
      clubName: club.name,
      stature,
      objective: computeObjective(club, reputation.score),
      pitch: pitchFor(club, stature, reputation),
    });
  }

  // Un manager sans club doit toujours pouvoir rebondir. Si sa réputation ne
  // lui ouvre plus aucune porte, le poste vacant le moins prestigieux l'appelle
  // quand même : un club en difficulté prend qui est disponible. Sans ce
  // filet, un limogeage suivi d'une réputation basse enfermait le joueur dans
  // un écran sans issue — exactement le cul-de-sac que ce module supprime.
  if (offers.length === 0 && status.kind === 'LIBRE') {
    const fallback = vacancies
      .map(id => byId.get(id))
      .filter((c): c is Club => c !== undefined)
      .sort((a, b) => clubStature(a) - clubStature(b))[0];

    if (fallback) {
      offers.push({
        clubId: fallback.id,
        clubName: fallback.name,
        stature: clubStature(fallback),
        objective: computeObjective(fallback, reputation.score),
        pitch: `${fallback.name} n'a pas d'autre option et vous tend les clés.`,
      });
    }
  }

  // Le plus prestigieux en tête : c'est l'offre qu'on regarde d'abord.
  return offers.sort((a, b) => b.stature - a.stature);
}

function pitchFor(club: Club, stature: number, reputation: ManagerReputation): string {
  if (stature >= 65) {
    return `${club.name} veut renouer avec les titres et pense à vous pour y parvenir.`;
  }
  if (reputation.score - stature > 20) {
    return `${club.name} sait qu'il vise plus haut que ses moyens en vous appelant.`;
  }
  if (club.tier === 'PETIT_BUDGET') {
    return `${club.name} cherche un projet de long terme, avec les moyens du bord.`;
  }
  return `${club.name} veut passer un cap et vous confie son effectif.`;
}

// =============================================================================
// Sort du manager
// =============================================================================

export interface CareerVerdict {
  readonly status: ManagerStatus;
  /** Message à afficher au manager, le cas échéant. */
  readonly notice?: string;
}

/**
 * Applique le verdict du board au manager.
 *
 * Être limogé ne termine plus la carrière : on devient **libre**. C'est le
 * point de bascule de tout le module — la descente devient une étape, pas un
 * écran-titre.
 */
export function applyBoardVerdict(
  status: ManagerStatus,
  fired: boolean,
  season: number,
  clubName: string,
  consecutiveFailures: number,
  /**
   * V0.43 — saisons d'échec tolérées, négociées à la signature. Absent, on
   * retombe sur les deux saisons historiques : les carrières commencées avant
   * la négociation n'ont pas de contrat à consulter.
   */
  patience = 2,
): CareerVerdict {
  // Un contrat long protège d'un limogeage que la seule confiance déclencherait.
  const protectedByContract = consecutiveFailures < patience;
  if (!fired || protectedByContract || status.kind !== 'EN_POSTE') return { status };

  return {
    status: { kind: 'LIBRE', since: season, reason: 'LIMOGE' },
    notice: `${clubName} vous a remercié après ${consecutiveFailures} saisons sans atteindre les objectifs. Vous êtes désormais sans club — d'autres vous appelleront.`,
  };
}

/**
 * Réputation d'un manager resté sans club.
 *
 * On s'érode doucement quand on ne travaille plus : sans cela, un manager
 * pourrait décliner toutes les offres modestes en attendant indéfiniment que
 * Toulouse appelle.
 */
export function idleReputationDecay(reputation: ManagerReputation): ManagerReputation {
  return { ...reputation, score: Math.max(0, reputation.score - 4) };
}
