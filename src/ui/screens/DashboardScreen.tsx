import type { SeasonState } from '../../engine/game/season-session.js';
import type { Club, Player } from '../../engine/types.js';
import { matchesForRound } from '../../engine/season/calendar.js';
import { detectHumanThreads, type HumanThread } from '../../engine/human/threads.js';
import { HumanThreads } from '../components/HumanThreads.js';
import type { CareerHistory } from '../../engine/season/records.js';
import { clubPalmares } from '../../engine/season/records.js';
import { clubLeaders, type CareerBook } from '../../engine/season/player-career.js';
import { Confetti } from '../components/Confetti.js';
import type { ManagerReputation } from '../../engine/season/manager-reputation.js';
import { DIVISION_LABEL, type Division } from '../../engine/season/divisions.js';
import type { AgendaDestination, AgendaItem } from '../../engine/season/manager-agenda.js';
import { reputationLabel } from '../../engine/season/manager-reputation.js';
import type { BoardConfidence, SeasonObjective } from '../../engine/season/board-objective.js';
import { boardConfidenceLabel } from '../../engine/season/board-objective.js';
import { TRAINING_FOCUS_LABEL, type DevelopmentReport } from '../../engine/club/development.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { StadiumBackdrop } from '../components/StadiumBackdrop.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import {
  COMPETITION_LABEL,
  summarisePool,
  type EuropeanStage,
} from '../../engine/season/european-cup.js';

interface Props {
  readonly state: SeasonState;
  readonly clubs: readonly Club[];
  /** V0.44 — l'étage où l'on joue : un classement de Pro D2 ne s'annonce pas « Top 14 ». */
  readonly division: Division;
  /** V0.49 — ce qui réclame l'attention du manager, déjà trié par urgence. */
  readonly agenda: readonly AgendaItem[];
  readonly onNavigate?: (destination: AgendaDestination) => void;
  readonly playerClubRoster: readonly Player[];
  readonly recentResultsForPlayer: readonly (-1 | 0 | 1)[];
  readonly playRatioByPlayer: ReadonlyMap<string, number>;
  readonly onPlayMatch: () => void;
  readonly onSimRoundOnly: () => void;
  readonly onSkipRound: () => void;
  readonly onStartNextSeason: () => void;
  readonly onThreadClick: (thread: HumanThread) => void;
  /** V0.13 — lance le match de coupe d'Europe de la semaine. */
  readonly onPlayEuropeanMatch: () => void;
  /** V0.14 — progressions de la dernière intersaison. */
  readonly developmentReports: readonly DevelopmentReport[];
  readonly rolloverSummary: { retiredCount: number; freeAgentCount: number; youthCount: number; newSeason: number } | null;
  readonly careerHistory: CareerHistory;
  /** V0.59 — registre de carrière des joueurs, pour les records du club. */
  readonly careerBook: CareerBook;
  readonly reputation: ManagerReputation;
  readonly objective: SeasonObjective | null;
  readonly boardConfidence: BoardConfidence;
}

function clubName(clubs: readonly Club[], id: string): string {
  return clubs.find(c => c.id === id)?.name ?? id;
}

function clubShort(clubs: readonly Club[], id: string): string {
  return clubs.find(c => c.id === id)?.shortName ?? id;
}

export function DashboardScreen({
  state, clubs, division, agenda, onNavigate, playerClubRoster, recentResultsForPlayer, playRatioByPlayer,
  onPlayMatch, onSimRoundOnly, onSkipRound, onStartNextSeason,
  onThreadClick, onPlayEuropeanMatch, developmentReports, rolloverSummary, careerHistory, careerBook, reputation,
  objective, boardConfidence,
}: Props) {
  const threads = detectHumanThreads({
    clubPlayers: playerClubRoster,
    relations: state.relations,
    recentResults: recentResultsForPlayer,
    currentSeason: state.currentSeason,
    playRatioByPlayer,
    pendingEvents: state.pendingEvents,
    moodDeltasByPlayer: state.moodDeltasByPlayer,
  });
  const ranking = [...state.standings.values()].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });

  const playerStanding = state.standings.get(state.playerClubId);
  const playerRank = ranking.findIndex(r => r.clubId === state.playerClubId) + 1;
  const playerName = clubName(clubs, state.playerClubId);

  const next = state.playerNextMatch;
  const isPlayerHome = next?.homeClubId === state.playerClubId;
  const opponentId = next ? (isPlayerHome ? next.awayClubId : next.homeClubId) : undefined;

  // 5 prochains matchs du joueur
  const upcomingForPlayer = state.calendar.matches
    .filter(m => m.round >= state.currentRound && (m.homeClubId === state.playerClubId || m.awayClubId === state.playerClubId))
    .slice(0, 5);

  // Tous les matchs de la journée actuelle (saison régulière)
  const roundMatches = state.currentRound <= state.calendar.totalRounds
    ? matchesForRound(state.calendar, state.currentRound)
    : [];

  const finished = state.status === 'finished';
  const eliminated = state.status === 'eliminated';
  const inPlayoffs = state.phase !== 'regular' && state.phase !== 'over';

  const phaseLabel =
    state.phase === 'regular' ? `Journée ${state.currentRound}/${state.calendar.totalRounds}` :
    state.phase === 'playoffs' ? 'Barrages' :
    state.phase === 'semifinals' ? 'Demi-finales' :
    state.phase === 'final' ? 'Finale' :
    'Saison terminée';

  const playoffMatchLabel = next && 'label' in next ? next.label : undefined;
  const championName = state.champion ? clubName(clubs, state.champion) : undefined;

  return (
    <section className="dashboard">
      {/* Si le club joueur est champion, on remplace le tableau de bord par un héros Brennus */}
      <div className="screen-head">
        <h2>Tableau de bord</h2>
        <span className="screen-head-meta">
          {finished
            ? `Saison terminée${championName ? ` — Champion : ${championName}` : ''}`
            : `${phaseLabel} • ${playerRank > 0 ? `${playerRank}e du classement` : '—'}`}
        </span>
      </div>

      {/* V0.49 — ce qui réclame l'attention, avant tout le reste. Une quinzaine
          de systèmes tiennent chacun leur état ; sans cette remontée, il fallait
          faire le tour de dix onglets pour savoir quoi faire. */}
      {!finished && agenda.length > 0 && (
        <div className="agenda">
          <div className="panel-tag">Cette semaine</div>
          <ul className="agenda-list">
            {agenda.map(item => (
              <li key={item.id} className={`agenda-item ${item.severity.toLowerCase()}`}>
                <button
                  type="button"
                  className="agenda-btn"
                  disabled={!item.destination}
                  onClick={() => item.destination && onNavigate?.(item.destination)}
                >
                  <span className="ag-headline">{item.headline}</span>
                  <span className="ag-detail">{item.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {finished ? (
        <div className={`finished-banner ${state.champion === state.playerClubId ? 'champion' : ''}`}>
          <h3>
            {state.champion === state.playerClubId
              ? `🏆 Brennus ${state.currentSeason}-${(state.currentSeason + 1).toString().slice(-2)}`
              : `Saison ${state.currentSeason}-${(state.currentSeason + 1).toString().slice(-2)} terminée`}
          </h3>
          {championName && (
            <p><strong>{championName}</strong> remporte le Bouclier de Brennus.</p>
          )}
          <p>{playerName} termine {playerRank}e (saison régulière) avec {playerStanding?.leaguePoints ?? 0} points.</p>
          <p>{playerStanding?.wins ?? 0}V {playerStanding?.draws ?? 0}N {playerStanding?.losses ?? 0}D — {playerStanding?.pointsFor ?? 0}/{playerStanding?.pointsAgainst ?? 0} pts marqués/encaissés</p>
          <div className="next-match-actions" style={{ marginTop: '1rem' }}>
            <button className="primary" type="button" onClick={onStartNextSeason}>
              Saison suivante ({state.currentSeason + 1}-{(state.currentSeason + 2).toString().slice(-2)}) →
            </button>
          </div>
        </div>
      ) : eliminated ? (
        <div className="next-match-hero">
          <div className="next-match-tag">{phaseLabel}</div>
          <div className="next-match-meta">
            {(() => {
              // V0.9 : wording adapté selon le rang final saison régulière
              if (state.phase === 'playoffs' && playerRank > 0 && playerRank <= 4) {
                return `${playerName} (${playerRank}e) est qualifié directement pour les demi-finales — pas de match en barrages.`;
              }
              if (state.phase === 'semifinals' && playerRank > 0 && playerRank <= 6) {
                return `${playerName} (${playerRank}e) a été éliminé en barrages.`;
              }
              if (state.phase === 'final' && playerRank > 0 && playerRank <= 6) {
                return `${playerName} (${playerRank}e) a été éliminé avant la finale.`;
              }
              return `${playerName} (${playerRank}e) n'est pas qualifié pour les phases finales.`;
            })()}
          </div>
          <div className="next-match-actions">
            <button className="primary" onClick={onSkipRound} type="button">
              {state.phase === 'playoffs' && playerRank > 0 && playerRank <= 4
                ? 'Simuler les barrages et passer en demi-finale →'
                : 'Simuler la journée et continuer'}
            </button>
          </div>
        </div>
      ) : (
        (() => {
          // ---------------------------------------------------------------
          // V0.16 — Habillage d'avant-match façon retransmission.
          // Le prochain match est *l'*information du tableau de bord : il occupe
          // toute la largeur, porte les couleurs des deux clubs et affiche leurs
          // blasons. Avant, il avait exactement le même poids visuel que les
          // panneaux secondaires.
          // ---------------------------------------------------------------
          if (!next || !opponentId) {
            return (
              <div className="broadcast-hero empty">
                <div className="bh-tag">{phaseLabel}</div>
                <p className="bh-empty">Aucun match programmé.</p>
              </div>
            );
          }

          const homeId = next.homeClubId as string;
          const awayId = next.awayClubId as string;
          const homeIdentity = clubIdentity(homeId);
          const awayIdentity = clubIdentity(awayId);

          const occasion =
            state.phase === 'final' ? 'FINALE'
              : state.phase === 'semifinals' ? 'DEMI-FINALE'
                : state.phase === 'playoffs' ? 'BARRAGE'
                  : undefined;

          return (
            <div
              className={`broadcast-hero ${occasion ? 'occasion' : ''}`}
              style={{
                ['--home-color' as string]: readableAccent(homeIdentity.primary),
                ['--away-color' as string]: readableAccent(awayIdentity.primary),
              }}
            >
              {/* Décor de stade : c'est lui qui donne l'échelle et l'atmosphère. */}
              <StadiumBackdrop
                className="bh-stadium"
                seed={isPlayerHome ? homeId : awayId}
                accent={readableAccent((isPlayerHome ? homeIdentity : awayIdentity).primary)}
                intensity={0.85}
              />

              {/* Bandes inclinées aux couleurs des deux clubs */}
              <div className="bh-bands" aria-hidden="true">
                <span className="bh-band home" />
                <span className="bh-band away" />
              </div>

              <div className="bh-top">
                <span className="bh-tag">
                  {occasion ?? (inPlayoffs ? phaseLabel : `Journée ${state.currentRound}`)}
                  {playoffMatchLabel && ` · ${playoffMatchLabel}`}
                </span>
                <span className="bh-venue">
                  {isPlayerHome ? 'À domicile' : 'À l\'extérieur'}
                </span>
              </div>

              <div className="bh-fixture">
                <div className="bh-side home">
                  <ClubCrest clubId={homeId} initials={clubShort(clubs, homeId)} size={62} />
                  <div className="bh-side-text">
                    <span className="bh-club">{clubName(clubs, homeId)}</span>
                    <span className="bh-side-role">Reçoit</span>
                  </div>
                </div>

                <div className="bh-vs">
                  <span className="bh-vs-mark">VS</span>
                </div>

                <div className="bh-side away">
                  <div className="bh-side-text">
                    <span className="bh-club">{clubName(clubs, awayId)}</span>
                    <span className="bh-side-role">Se déplace</span>
                  </div>
                  <ClubCrest clubId={awayId} initials={clubShort(clubs, awayId)} size={62} />
                </div>
              </div>

              <div className="bh-actions">
                <button className="bh-cta" onClick={onPlayMatch} type="button" data-coachmark="play-match">
                  Préparer la semaine
                  <span className="bh-cta-arrow">→</span>
                </button>
                <button className="bh-ghost" onClick={onSimRoundOnly} type="button">
                  Simuler la journée
                </button>
              </div>
            </div>
          );
        })()
      )}

      <div className="dash-secondary">
      {objective && (
        <div className="dashboard-panel" style={{ borderLeft: `3px solid ${boardConfidence.score >= 50 ? 'var(--green, #4c4)' : boardConfidence.score >= 20 ? 'var(--accent, #fa3)' : 'var(--red, #c44)'}`, padding: '12px 16px' }}>
          <div className="panel-tag">Objectif du board</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <strong>{objective.label}</strong>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Confiance : {boardConfidence.score}/100 — {boardConfidenceLabel(boardConfidence.score)}
              {boardConfidence.consecutiveFailures > 0 && ` (${boardConfidence.consecutiveFailures} échec${boardConfidence.consecutiveFailures > 1 ? 's' : ''} cumulés)`}
            </span>
          </div>
        </div>
      )}

      {state.europeanCampaign && (() => {
        const campaign = state.europeanCampaign;
        const pool = summarisePool(campaign);
        const fixture = state.europeanFixture;
        const label = COMPETITION_LABEL[campaign.competition];

        return (
          <div className="euro-panel">
            <div className="euro-head">
              <div className="panel-tag">{label}</div>
              <span className="euro-record">
                {pool.played > 0
                  ? `${pool.won}V — ${pool.lost}D · ${pool.pointsFor}/${pool.pointsAgainst}`
                  : 'Phase de poule à venir'}
                {pool.played >= 4 && (
                  <span className={pool.qualified ? 'euro-qualified' : 'euro-out'}>
                    {pool.qualified ? ' · qualifié' : ' · éliminé'}
                  </span>
                )}
              </span>
            </div>

            {/* Parcours : un jeton par match, joué ou à venir. */}
            <div className="euro-track">
              {campaign.fixtures.map(f => {
                const played = campaign.results.find(r => r.stage === 'POOL' && r.round === f.round);
                const won = played ? played.clubScore > played.opponentScore : undefined;
                const isNext = fixture?.round === f.round && fixture.stage === 'POOL';
                return (
                  <div
                    key={`${f.round}_${f.opponent.id}`}
                    className={`euro-leg ${played ? (won ? 'won' : 'lost') : ''} ${isNext ? 'next' : ''}`}
                  >
                    <span className="euro-leg-round">J{f.round}</span>
                    <span className="euro-leg-opp">
                      {f.atHome ? '' : '@ '}{f.opponent.name}
                    </span>
                    <span className="euro-leg-score">
                      {played ? `${played.clubScore}-${played.opponentScore}` : '—'}
                    </span>
                  </div>
                );
              })}
              {campaign.results
                .filter(r => r.stage !== 'POOL')
                .map(r => (
                  <div
                    key={`ko_${r.stage}`}
                    className={`euro-leg ${r.clubScore > r.opponentScore ? 'won' : 'lost'}`}
                  >
                    <span className="euro-leg-round">{stageShort(r.stage)}</span>
                    <span className="euro-leg-opp">{r.atHome ? '' : '@ '}{r.opponentName}</span>
                    <span className="euro-leg-score">{r.clubScore}-{r.opponentScore}</span>
                  </div>
                ))}
            </div>

            {fixture && (
              <div className="euro-next">
                <div className="euro-next-info">
                  <strong>{fixture.opponent.name}</strong>
                  <span className="euro-next-meta">
                    {fixture.atHome ? 'à domicile' : 'à l\'extérieur'}
                    {' · '}{countryLabel(fixture.opponent.country)}
                    {' · '}niveau {fixture.opponent.strength}
                    {fixture.stage !== 'POOL' && ` · ${stageShort(fixture.stage)}`}
                  </span>
                  <span className="euro-warning">
                    Semaine double : les joueurs alignés seront fatigués pour la journée de championnat.
                  </span>
                </div>
                <button className="primary" type="button" onClick={onPlayEuropeanMatch}>
                  Jouer le match européen →
                </button>
              </div>
            )}
          </div>
        );
      })()}

      </div>

      {state.relegationStatus !== 'SAFE' && !finished && (
        <div className={`relegation-banner ${state.relegationStatus === 'RELEGATED' ? 'danger' : 'warn'}`}>
          {state.relegationStatus === 'RELEGATED'
            ? `${playerName} est en position de relégation directe (${playerRank}e). Il faut réagir.`
            : `${playerName} est en position de barrage (${playerRank}e) — un match couperet contre le 2e de Pro D2.`}
        </div>
      )}

      {state.isInternationalBreak && (() => {
        const calledUp = state.callUpSchedule.byRound.get(state.currentRound) ?? new Set();
        const myCalledUp = playerClubRoster.filter(p => calledUp.has(p.id));
        return (
          <div className="rollover-banner" style={{ borderLeftColor: 'var(--accent, var(--blue, #4af))' }}>
            🏉 Trêve internationale — {myCalledUp.length} de tes joueurs sont en sélection :
            {' '}{myCalledUp.map(p => p.lastName).join(', ') || 'aucun'}.
          </div>
        );
      })()}

      {rolloverSummary && (
        <div className="rollover-banner">
          Bienvenue en saison {rolloverSummary.newSeason}-{(rolloverSummary.newSeason + 1).toString().slice(-2)}.
          {rolloverSummary.retiredCount > 0
            ? ` ${rolloverSummary.retiredCount} retraite${rolloverSummary.retiredCount > 1 ? 's' : ''}.`
            : ' Aucune retraite.'}
          {rolloverSummary.freeAgentCount > 0 &&
            ` ${rolloverSummary.freeAgentCount} joueur${rolloverSummary.freeAgentCount > 1 ? 's' : ''} libre${rolloverSummary.freeAgentCount > 1 ? 's' : ''} sur le marché.`}
          {rolloverSummary.youthCount > 0 &&
            ` ${rolloverSummary.youthCount} jeune${rolloverSummary.youthCount > 1 ? 's' : ''} promu${rolloverSummary.youthCount > 1 ? 's' : ''} des centres de formation.`}
        </div>
      )}

      {developmentReports.length > 0 && (() => {
        const mine = new Set(playerClubRoster.map(p => p.id));
        const rows = developmentReports
          .filter(r => mine.has(r.playerId))
          .sort((a, b) => b.netChange - a.netChange);
        if (rows.length === 0) return null;

        const progress = rows.filter(r => r.netChange > 0).slice(0, 5);
        const decline = rows.filter(r => r.netChange < 0).slice(-3).reverse();
        const nameOf = (id: string): string => {
          const p = playerClubRoster.find(x => x.id === id);
          return p ? `${p.firstName} ${p.lastName}` : id;
        };

        return (
          <div className="development-panel">
            <div className="development-head">
              <div className="panel-tag">Intersaison — évolution de l'effectif</div>
              <span className="development-unit">total des points d'attributs gagnés ou perdus</span>
            </div>
            <div className="development-cols">
              <div>
                <div className="development-col-tag up">Ont progressé</div>
                {progress.length === 0 && <p className="development-empty">Personne n'a réellement progressé.</p>}
                {progress.map(r => (
                  <div key={r.playerId as string} className="development-row">
                    <span className="development-name">{nameOf(r.playerId as string)}</span>
                    <span className="development-meta">
                      {r.age} ans · {r.minutesPlayed} min · {TRAINING_FOCUS_LABEL[r.focus]}
                    </span>
                    <span className="development-delta up" title={`${r.changes.length} attributs améliorés`}>
                      +{r.netChange}
                    </span>
                    <span className="development-detail">
                      {r.changes.slice(0, 3).map(c => `${c.label} ${c.before}→${c.after}`).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <div className="development-col-tag down">Ont décliné</div>
                {decline.length === 0 && <p className="development-empty">Aucun déclin marqué.</p>}
                {decline.map(r => (
                  <div key={r.playerId as string} className="development-row">
                    <span className="development-name">{nameOf(r.playerId as string)}</span>
                    <span className="development-meta">{r.age} ans · {r.minutesPlayed} min</span>
                    <span className="development-delta down" title={`${r.changes.length} attributs en baisse`}>
                      {r.netChange}
                    </span>
                    <span className="development-detail">
                      {r.changes.slice(0, 3).map(c => `${c.label} ${c.before}→${c.after}`).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {rows[0] && rows[0].reasons.length > 0 && (
              <p className="development-hint">{rows[0].reasons[0]}</p>
            )}
          </div>
        );
      })()}

      {finished && state.champion === state.playerClubId && (
        <Confetti seed={`brennus_${state.currentSeason}`} intensity="celebration" />
      )}

      <div className="dashboard-grid">
        <div className="tile-threads">
          <HumanThreads threads={threads} onClick={onThreadClick} />
        </div>

        <div className="dashboard-panel tile-calendar">
          <div className="panel-tag">Calendrier — {playerName}</div>
          <div className="tile-scroll">
          {upcomingForPlayer.length === 0 && <p className="empty">Plus de matchs.</p>}
          {upcomingForPlayer.length > 0 && (
            <ul className="schedule-list">
              {upcomingForPlayer.map(m => {
                const home = m.homeClubId === state.playerClubId;
                const opp = home ? m.awayClubId : m.homeClubId;
                return (
                  <li key={`${m.round}_${m.homeClubId}_${m.awayClubId}`}>
                    <span className="r-num">J{m.round}</span>
                    <span className="r-loc">{home ? 'dom.' : 'ext.'}</span>
                    <span className="r-opp">{clubName(clubs, opp)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        </div>

        <div className="dashboard-panel tile-standings">
          <div className="panel-tag">Classement {DIVISION_LABEL[division]}</div>
          <div className="tile-scroll">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club</th>
                <th>J</th>
                <th>V</th>
                <th>N</th>
                <th>D</th>
                <th>BO</th>
                <th>BD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, idx) => (
                <tr
                  key={r.clubId}
                  className={r.clubId === state.playerClubId ? 'me' : ''}
                >
                  <td>{idx + 1}</td>
                  <td>{clubShort(clubs, r.clubId)}</td>
                  <td>{r.played}</td>
                  <td>{r.wins}</td>
                  <td>{r.draws}</td>
                  <td>{r.losses}</td>
                  <td>{r.tryBonus}</td>
                  <td>{r.losingBonus}</td>
                  <td className="pts">{r.leaguePoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {roundMatches.length > 0 && state.history.length > 0 && (
        <div className="dashboard-panel tile-results">
          <div className="panel-tag">Derniers résultats — Journée {state.history[state.history.length - 1]?.round}</div>
          <ul className="results-list">
            {state.history.slice(-7).reverse().map((h, i) => (
              <li key={i}>
                <span className="rl-home">{clubShort(clubs, h.homeClubId)}</span>
                <span className="rl-score">{h.homeScore} - {h.awayScore}</span>
                <span className="rl-away">{clubShort(clubs, h.awayClubId)}</span>
                {h.playerPlayed && <span className="rl-tag">vous</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(careerHistory.seasons.length > 0 || reputation.seasonsManaged > 0) && (() => {
        const palm = clubPalmares(careerHistory, state.playerClubId);
        // V0.59 — les records du club se dérivent du registre de carrière, qui
        // garde le détail saison par saison. « Top scorers all-time » était de
        // l'anglais au milieu d'un jeu français, en plus d'être approximatif.
        const meilleursMarqueurs = clubLeaders(careerBook, state.playerClubId, 'tries', 3);
        const plusCapes = clubLeaders(careerBook, state.playerClubId, 'matches', 3);
        return (
          <div className="dashboard-panel tile-career">
            <div className="panel-tag">Carrière manager</div>
            <ul className="finances-lines">
              <li><span>Réputation</span>
                <strong>{reputation.score}/100 — {reputationLabel(reputation.score)}</strong>
              </li>
              <li><span>Saisons jouées</span><strong>{palm.seasonsPlayed}</strong></li>
              <li><span>Bouclier de Brennus</span><strong>{palm.championships}</strong></li>
              <li><span>Finales perdues</span><strong>{palm.finalsLost}</strong></li>
            </ul>
            {meilleursMarqueurs.length > 0 && (
              <>
                <div className="panel-tag" style={{ marginTop: 12 }}>Meilleurs marqueurs du club</div>
                <ul className="finances-lines">
                  {meilleursMarqueurs.map(t => (
                    <li key={t.playerId as string}>
                      <span>{t.playerName}</span>
                      <strong>{t.value} essai{t.value > 1 ? 's' : ''}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {plusCapes.length > 0 && (
              <>
                <div className="panel-tag" style={{ marginTop: 12 }}>Le plus de matchs sous le maillot</div>
                <ul className="finances-lines">
                  {plusCapes.map(t => (
                    <li key={t.playerId as string}>
                      <span>{t.playerName}</span>
                      <strong>{t.value} match{t.value > 1 ? 's' : ''}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })()}
    </section>
  );
}

/** Abréviation d'un tour de coupe d'Europe. */
function stageShort(stage: EuropeanStage): string {
  const map: Record<EuropeanStage, string> = {
    POOL: 'Poule',
    ROUND_OF_16: '8es',
    QUARTERFINAL: '1/4',
    SEMIFINAL: '1/2',
    FINAL: 'Finale',
  };
  return map[stage];
}

/** Libellé lisible du pays d'un adversaire européen. */
function countryLabel(country: string): string {
  const map: Record<string, string> = {
    ANGLETERRE: 'Angleterre',
    IRLANDE: 'Irlande',
    ECOSSE: 'Écosse',
    PAYS_DE_GALLES: 'Pays de Galles',
    ITALIE: 'Italie',
    AFRIQUE_DU_SUD: 'Afrique du Sud',
  };
  return map[country] ?? country;
}
