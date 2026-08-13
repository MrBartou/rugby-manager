/**
 * Le bilan d'une saison : V0.61.
 *
 * Ce que produit la fin d'un exercice, une fois le dernier match joué : la ligne
 * qui entre aux archives, l'objectif tenu ou manqué, la réputation qui bouge, la
 * confiance du président, et le verdict qui en découle jusqu'au limogeage.
 *
 * ## Pourquoi c'est ici et plus dans l'interface
 *
 * Ces règles vivaient dans `App.tsx`, au milieu de l'intersaison, mêlées à la
 * publication des actualités et à la mise à jour d'une trentaine de références
 * React. Elles décident pourtant du sort du manager : c'est exactement ce que la
 * frontière moteur/interface réserve au moteur, et rien de tout cela n'était
 * testable tant que ça vivait dans un composant.
 *
 * L'ordre compte, et il est le même que dans la réalité d'un club : on constate
 * d'abord ce qui s'est passé, on juge ensuite si la mission est remplie, et le
 * président tranche en dernier. Inverser deux de ces étapes ferait juger un
 * manager sur une réputation déjà corrigée par sa propre saison.
 */

import type { ClubId, PlayerId } from '../types.js';
import type { SeasonRecord } from './records.js';
import {
  checkObjectiveMet,
  updateBoardConfidence,
  type BoardConfidence,
  type SeasonObjective,
} from './board-objective.js';
import { updateReputation, type ManagerReputation } from './manager-reputation.js';
import { applyBoardVerdict, type ManagerStatus } from './manager-career.js';
import type { ManagerSeasonRecord, SeasonVerdict } from './manager-record.js';

export interface SeasonVerdictInput {
  readonly season: number;
  readonly playerClubId: ClubId;
  readonly clubName: string;
  /** Champion du championnat, absent si la saison s'est close sans titre. */
  readonly champion?: ClubId;
  /** Rang final du club dirigé, 1-indexé. Zéro si introuvable. */
  readonly playerClubFinalRank: number;
  readonly playerClubReachedFinal: boolean;
  /** Finaliste battu, quand une finale a eu lieu. */
  readonly runnerUp?: ClubId;
  readonly topScorerOfSeason?: SeasonRecord['topScorerOfSeason'];
  readonly objective: SeasonObjective | undefined;
  readonly reputation: ManagerReputation;
  readonly confidence: BoardConfidence;
  readonly career: ManagerStatus;
  /** Patience négociée avec le président : elle retarde le couperet. */
  readonly contractPatience: number;
}

export interface SeasonVerdictOutcome {
  readonly seasonRecord: SeasonRecord;
  readonly objectiveMet: boolean;
  /** Résumé de l'objectif, tel que le président le formulerait. */
  readonly objectiveSummary: string;
  readonly reputation: ManagerReputation;
  readonly reputationDelta: number;
  readonly confidence: BoardConfidence;
  readonly career: ManagerStatus;
  /** Message de limogeage, s'il y en a un. */
  readonly notice: string | undefined;
  readonly verdict: SeasonVerdict;
  /**
   * Ligne de parcours du manager.
   *
   * Absente s'il n'était pas en poste : une saison passée sans club n'entre pas
   * au parcours, et l'y consigner créditerait le manager d'un résultat qui ne
   * lui appartient pas.
   */
  readonly managerSeason: ManagerSeasonRecord | undefined;
}

export function buildSeasonVerdict(input: SeasonVerdictInput): SeasonVerdictOutcome {
  const playerClubChampion = input.champion === input.playerClubId;

  const seasonRecord: SeasonRecord = {
    seasonStart: input.season,
    ...(input.champion !== undefined ? { champion: input.champion } : {}),
    ...(input.runnerUp !== undefined ? { runnerUp: input.runnerUp } : {}),
    playerClubFinalRank: input.playerClubFinalRank > 0 ? input.playerClubFinalRank : 0,
    playerClubReachedFinal: input.playerClubReachedFinal,
    playerClubChampion,
    ...(input.topScorerOfSeason !== undefined
      ? { topScorerOfSeason: input.topScorerOfSeason }
      : {}),
  };

  // On archive même sans objectif connu (sauvegarde antérieure à la V0.9) :
  // une ligne incomplète vaut mieux qu'un trou dans la carrière.
  const check = input.objective
    ? checkObjectiveMet({
      objective: input.objective,
      playerClubFinalRank: seasonRecord.playerClubFinalRank,
      playerClubChampion,
    })
    : { met: false, summary: '' };

  const reputationBefore = input.reputation.score;
  const reputation = updateReputation(input.reputation, {
    playerClubId: input.playerClubId,
    ...(input.champion !== undefined ? { champion: input.champion } : {}),
    playerClubReachedFinal: seasonRecord.playerClubReachedFinal,
    playerClubFinalRank: seasonRecord.playerClubFinalRank,
    objectiveMet: check.met,
    ...(input.objective ? { objectiveTargetRank: input.objective.targetRank } : {}),
  });

  const confidence = updateBoardConfidence(input.confidence, check.met, playerClubChampion);

  const wasInCharge = input.career.kind === 'EN_POSTE';
  const verdictStatus = applyBoardVerdict(
    input.career,
    confidence.fired,
    input.season,
    input.clubName,
    confidence.consecutiveFailures,
    input.contractPatience,
  );

  const fired = verdictStatus.status.kind === 'LIBRE';
  const verdict: SeasonVerdict = fired ? 'LIMOGE' : check.met ? 'RECONDUIT' : 'AVERTI';

  return {
    seasonRecord,
    objectiveMet: check.met,
    objectiveSummary: check.summary,
    reputation,
    reputationDelta: reputation.score - reputationBefore,
    confidence,
    career: verdictStatus.status,
    notice: verdictStatus.notice,
    verdict,
    managerSeason: wasInCharge
      ? {
        season: input.season,
        clubId: input.playerClubId,
        clubName: input.clubName,
        objectiveKind: input.objective?.kind ?? 'TOP_10',
        objectiveTargetRank: input.objective?.targetRank ?? 10,
        objectiveLabel: input.objective?.label ?? 'Non défini',
        finalRank: seasonRecord.playerClubFinalRank,
        objectiveMet: check.met,
        reachedFinal: seasonRecord.playerClubReachedFinal,
        wonTitle: playerClubChampion,
        reputationAfter: reputation.score,
        reputationDelta: reputation.score - reputationBefore,
        boardConfidence: confidence.score,
        verdict,
      }
      : undefined,
  };
}

/**
 * Le meilleur marqueur du club dirigé, tel qu'il entre aux archives.
 *
 * Rendu ici parce que c'est une règle d'archivage, pas d'affichage : on ne
 * consigne un meilleur marqueur que s'il a marqué.
 */
export function topScorerOf(
  stats: ReadonlyMap<PlayerId, { readonly tries: number }>,
  nameOf: (playerId: PlayerId) => { readonly name: string; readonly clubId: ClubId } | undefined,
): SeasonRecord['topScorerOfSeason'] {
  let best: { playerId: PlayerId; tries: number } | undefined;
  for (const [playerId, stat] of stats) {
    if (!best || stat.tries > best.tries) best = { playerId, tries: stat.tries };
  }
  if (!best || best.tries <= 0) return undefined;

  const who = nameOf(best.playerId);
  if (!who) return undefined;

  return {
    playerId: best.playerId,
    playerName: who.name,
    clubId: who.clubId,
    tries: best.tries,
  };
}
