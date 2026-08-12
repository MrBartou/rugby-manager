/**
 * Recharger en phases finales ne détruit plus la phase finale : v0.60.
 *
 * Les tableaux des barrages, des demies et de la finale sont des variables de
 * session, jamais sauvegardées. Elles n'étaient reconstruites qu'à la journée
 * qui les concerne : au chargement d'une partie en demi-finales, les barrages
 * restaient vides, leurs vainqueurs introuvables, la demie n'était pas composée
 * et la saison se terminait sans champion.
 *
 * Rien n'a besoin d'être ajouté à la sauvegarde. Le classement y est, et les
 * phases finales n'en modifient pas une ligne : le tableau se redéduit à
 * l'identique, et ses vainqueurs se lisent dans l'historique.
 */

import { describe, expect, it } from 'vitest';
import { createSeasonSession, type SeasonSession } from '@/engine/game/season-session.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import type { MatchInput } from '@/engine/match/types.js';
import type { ClubId, MatchId, Player, PlayerId, Position } from '@/engine/types.js';

const POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

const CLUBS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g',
  'h', 'i', 'j', 'k', 'l', 'm', 'n',
].map(id => id as ClubId);

function player(clubId: ClubId, position: Position, i: number): Player {
  const n = 70;
  return {
    id: `${clubId}_${i}` as PlayerId,
    clubId, firstName: 'T', lastName: `P${i}`, birthDate: '1996-01-01',
    position, secondaryPositions: [], isJiff: true,
    technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
    physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
    mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
    positionSpecific: { pousseeMelee: n },
    traits: [],
    hidden: { potentiel: n, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2028, annualSalary: 100_000 },
  };
}

function buildInput(homeClubId: ClubId, awayClubId: ClubId): MatchInput {
  const playersById = new Map<PlayerId, Player>();
  const side = (clubId: ClubId) => POSITIONS.map((pos, i) => {
    const p = player(clubId, pos, i);
    playersById.set(p.id, p);
    return { playerId: p.id, position: pos, captainArmband: false };
  });
  const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
  return {
    matchId: `${homeClubId}_${awayClubId}` as MatchId,
    home: { squad: { clubId: homeClubId, starters: side(homeClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    away: { squad: { clubId: awayClubId, starters: side(awayClubId), substitutes: [] }, tacticalPlan: plan, liveMoments: [] },
    playersById, weather: 'SEC', fieldCondition: 'BON', homeAdvantageBonus: 1, homeFans: 'MOYEN',
  };
}

function newSession(restoreFrom?: Parameters<typeof createSeasonSession>[0]['restoreFrom']): SeasonSession {
  return createSeasonSession({
    clubIds: CLUBS,
    playerClubId: 'a' as ClubId,
    seed: 'phases-finales',
    buildMatchInput: buildInput,
    playerClubRoster: POSITIONS.map((pos, i) => player('a' as ClubId, pos, i)),
    currentSeason: 2026,
    ...(restoreFrom ? { restoreFrom } : {}),
  });
}

/** Avance la saison jusqu'à une journée donnée, en jouant tout ce qui se présente. */
function playUntil(session: SeasonSession, round: number): void {
  let garde = 0;
  while (session.getState().currentRound < round && garde++ < 60) {
    const state = session.getState();
    const next = state.playerNextMatch;
    if (!next) { session.skipRound('auto'); continue; }
    const result = simulateMatch(buildInput(next.homeClubId, next.awayClubId), `r${state.currentRound}`);
    session.simulateOtherMatchesOfRound('test');
    session.commitPlayerMatch(result.homeScore, result.awayScore, result);
  }
}

/** La sauvegarde, réduite à ce dont la reprise a réellement besoin. */
function snapshot(session: SeasonSession) {
  const state = session.getState();
  return {
    currentRound: state.currentRound,
    history: [...state.history],
    standings: [...state.standings.values()],
  };
}

describe('une partie rechargée en phases finales continue', () => {
  const roundOf = (phase: 'playoffs' | 'semifinals' | 'final'): number => {
    const s = newSession().getState();
    return phase === 'playoffs' ? s.playoffRounds.PLAYOFFS
      : phase === 'semifinals' ? s.playoffRounds.SEMIFINALS
        : s.playoffRounds.FINAL;
  };

  /** Les affiches d'une journée, telles que l'historique les a retenues. */
  const affichesDeLa = (session: SeasonSession, round: number): readonly string[] =>
    session.getState().history
      .filter(h => h.round === round)
      .map(h => `${h.homeClubId as string}-${h.awayClubId as string}`)
      .sort();

  it('compose les mêmes demi-finales qu\'une partie jamais interrompue', () => {
    // Le tableau se déduit des barrages, qui ne sont plus en mémoire après un
    // rechargement : c'est là que la phase finale se perdait.
    const jouée = newSession();
    playUntil(jouée, roundOf('semifinals'));
    const avantLesDemies = snapshot(jouée);
    playUntil(jouée, roundOf('semifinals') + 1);

    const rechargée = newSession(avantLesDemies);
    playUntil(rechargée, roundOf('semifinals') + 1);

    const demies = affichesDeLa(rechargée, roundOf('semifinals'));
    expect(demies).toHaveLength(2);
    expect(demies).toEqual(affichesDeLa(jouée, roundOf('semifinals')));
  });

  it('et va jusqu\'au titre au lieu de s\'arrêter sans champion', () => {
    const jouée = newSession();
    playUntil(jouée, roundOf('semifinals'));

    const rechargée = newSession(snapshot(jouée));
    playUntil(rechargée, roundOf('final') + 1);

    const state = rechargée.getState();
    expect(state.status).toBe('finished');
    expect(state.champion).toBeDefined();
  });

  it('désigne le même champion que la partie jamais interrompue', () => {
    const jouée = newSession();
    playUntil(jouée, roundOf('final'));
    const avant = snapshot(jouée);

    playUntil(jouée, roundOf('final') + 1);
    const rechargée = newSession(avant);
    playUntil(rechargée, roundOf('final') + 1);

    expect(rechargée.getState().champion).toBe(jouée.getState().champion);
  });

  it('retrouve le champion d\'une finale déjà disputée', () => {
    // Sauvegarder après la finale et recharger ne doit pas effacer le titre.
    const jouée = newSession();
    playUntil(jouée, roundOf('final') + 1);
    const titre = jouée.getState().champion;
    expect(titre).toBeDefined();

    const rechargée = newSession({ ...snapshot(jouée), currentRound: roundOf('final') });
    expect(rechargée.getState().champion).toBe(titre);
  });
});

describe('une finale nulle désigne quand même un champion', () => {
  const roundOf = (): number => newSession().getState().playoffRounds.FINAL;

  /** Amène une session jusqu'à la finale, joueur qualifié ou non. */
  function jusquALaFinale(): SeasonSession {
    const session = newSession();
    playUntil(session, roundOf());
    return session;
  }

  it('le mieux classé de la saison régulière l\'emporte', () => {
    // Le règlement des phases finales tranche par le classement. Sans cela, une
    // finale nulle laissait le titre vacant et, avec lui, tout le bilan de fin
    // de saison : archives, verdict du président, réputation.
    const session = jusquALaFinale();
    const finale = session.getState().playerNextMatch;
    expect(finale, 'le club dirigé doit disputer la finale de ce scénario').toBeDefined();
    if (!finale) return;

    const résultat = simulateMatch(buildInput(finale.homeClubId, finale.awayClubId), 'finale');
    session.commitPlayerMatch(20, 20, résultat);

    const state = session.getState();
    expect(state.champion).toBeDefined();

    const classement = [...state.standings.values()]
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .map(s => s.clubId as string);
    const rangDe = (id: string): number => classement.indexOf(id);
    expect(rangDe(state.champion as string))
      .toBeLessThan(rangDe(
        state.champion === finale.homeClubId
          ? finale.awayClubId as string
          : finale.homeClubId as string,
      ));
  });
});
