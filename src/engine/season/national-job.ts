/**
 * Le banc du XV de France — V0.59.
 *
 * Le XV de France existe depuis la V0.58 : un groupe se compose, des capes se
 * cumulent, un Tournoi se joue. Il n'était entraîné par personne.
 *
 * C'est pourtant le seul poste que le jeu ne pouvait pas déjà offrir. La
 * carrière de manager (V0.41) mène de club en club, de plus en plus gros, et
 * s'arrête là : un manager à trois Brennus n'a plus rien à gagner qu'un
 * quatrième. La sélection est l'autre direction — pas plus haut, ailleurs.
 *
 * ## Ce qu'on gagne et ce qu'on perd
 *
 * On **quitte son club**. C'est la règle réelle, et c'est ce qui fait du poste
 * une décision plutôt qu'une récompense : on lâche une équipe qu'on a mis des
 * années à construire pour sept matchs par an. Plus de mercato, plus de semaine
 * d'entraînement, plus de finances — on compose, on parle au groupe, on joue.
 * Entre les fenêtres, on regarde le Top 14 se jouer sans nous.
 *
 * ## Qui est approché
 *
 * La fédération ne recrute pas un espoir. Elle veut un palmarès, une réputation
 * établie, et de préférence quelqu'un qui a déjà gagné quelque chose. Elle est
 * aussi patiente : le poste ne se libère pas tous les ans.
 */

import type { ManagerReputation } from './manager-reputation.js';
import type { WindowReport } from './national-team.js';

// =============================================================================
// L'accès au poste
// =============================================================================

/** Réputation en dessous de laquelle la fédération ne regarde pas. */
export const FEDERATION_MIN_REPUTATION = 72;
/** Saisons de métier exigées : on ne confie pas le XV de France à un débutant. */
export const FEDERATION_MIN_SEASONS = 4;

export interface NationalJobInput {
  readonly reputation: ManagerReputation;
  /** Vrai si le poste est effectivement vacant cette intersaison. */
  readonly vacant: boolean;
  /** Vrai si le manager occupe déjà le banc national. */
  readonly alreadyInPost: boolean;
}

/**
 * La fédération approche-t-elle le manager ?
 *
 * Trois conditions, et la troisième est la plus dure : il faut avoir gagné.
 * Une réputation bâtie sur des maintiens honorables ne suffit pas — c'est
 * précisément ce qui doit rendre l'appel rare et mémorable.
 */
export function federationApproaches(input: NationalJobInput): boolean {
  if (!input.vacant || input.alreadyInPost) return false;
  const { score, seasonsManaged, titlesWon } = input.reputation;
  if (seasonsManaged < FEDERATION_MIN_SEASONS) return false;
  if (score < FEDERATION_MIN_REPUTATION) return false;
  return titlesWon >= 1;
}

/**
 * Ce que la fédération écrit.
 *
 * Elle nomme ce qu'elle a vu — c'est ce qui donne au courrier son poids — et
 * elle dit franchement ce que le poste coûte. Une offre qui ne mentionnerait
 * pas le club qu'on abandonne serait un piège, pas une proposition.
 */
export function federationLetter(
  reputation: ManagerReputation,
  currentClubName: string | undefined,
): string {
  const titres = reputation.titlesWon === 1
    ? 'un Bouclier de Brennus'
    : `${reputation.titlesWon} Boucliers de Brennus`;

  const adieu = currentClubName
    ? `\n\nCe poste ne se cumule pas : accepter, c'est quitter ${currentClubName}. Sept matchs par an, un groupe que vous ne choisirez qu'aux fenêtres internationales, et le reste du temps les tribunes du Top 14.`
    : '';

  return `${titres} en ${reputation.seasonsManaged} saisons, une réputation de ${reputation.score} sur 100. Nous cherchons un sélectionneur, et le comité vous a placé en tête de sa liste.${adieu}\n\nLa réponse vous appartient.`;
}

// =============================================================================
// Ce que le poste attend
// =============================================================================

export type NationalVerdict = 'EXCELLENT' | 'CORRECT' | 'INSUFFISANT';

export interface NationalSeasonReview {
  readonly verdict: NationalVerdict;
  readonly summary: string;
  /** Ce que la saison rapporte — ou coûte — en réputation. */
  readonly reputationDelta: number;
  /** Vrai si la fédération met fin à la mission. */
  readonly dismissed: boolean;
}

/**
 * Le bilan d'une saison internationale.
 *
 * On juge sur le Tournoi, pas sur la tournée d'automne : c'est là que se joue
 * la réputation d'un sélectionneur, et une tournée ratée contre les
 * Néo-Zélandais ne coûte sa place à personne.
 *
 * Le seuil de renvoi est bas — deux Tournois manqués de suite — parce qu'un
 * poste dont on ne peut pas être démis n'est pas un poste, c'est un décor.
 */
export function reviewNationalSeason(input: {
  readonly tournament: WindowReport | undefined;
  readonly consecutiveFailures: number;
}): NationalSeasonReview {
  const won = input.tournament?.won ?? 0;
  const total = input.tournament?.results.length ?? 5;

  if (won === total) {
    return {
      verdict: 'EXCELLENT',
      summary: 'Grand Chelem. Le pays vous doit une soirée.',
      reputationDelta: 12,
      dismissed: false,
    };
  }
  if (won >= 4) {
    return {
      verdict: 'EXCELLENT',
      summary: `Tournoi remporté — ${won} victoires sur ${total}.`,
      reputationDelta: 8,
      dismissed: false,
    };
  }
  if (won === 3) {
    return {
      verdict: 'CORRECT',
      summary: 'Trois victoires : un Tournoi honnête, sans plus.',
      reputationDelta: 1,
      dismissed: false,
    };
  }
  return {
    verdict: 'INSUFFISANT',
    summary: won <= 1
      ? `Tournoi manqué : ${won} victoire${won > 1 ? 's' : ''} sur ${total}. La presse réclame des comptes.`
      : `Deux victoires sur ${total} : la fédération attendait mieux.`,
    reputationDelta: -6,
    // Deux échecs de suite, et la mission s'arrête.
    dismissed: input.consecutiveFailures + 1 >= 2,
  };
}
