import type { IndividualMatchStats, MatchResult } from '../../engine/match/types.js';
import type { Club, Player, PlayerId } from '../../engine/types.js';
import { buildRichNarrative } from '../../engine/match/narrative.js';
import { computeTeamStats, readPlanOutcome, type TeamMatchStats } from '../../engine/match/team-stats.js';
import type { PreMatchTacticalPlan } from '../../engine/match/types.js';

interface Props {
  readonly result: MatchResult;
  readonly homeName: string;
  readonly awayName: string;
  readonly homeClub?: Club;
  readonly awayClub?: Club;
  readonly playersById: ReadonlyMap<PlayerId, Player>;
  /**
   * V0.36 — côté dirigé par le manager et plan qu'il a joué. Absents pour un
   * match libre : on affiche alors les statistiques sans les commenter.
   */
  readonly playerSide?: 'HOME' | 'AWAY';
  readonly playerPlan?: PreMatchTacticalPlan;
}

export function MatchSummary({
  result, homeName, awayName, homeClub, awayClub, playersById, playerSide, playerPlan,
}: Props) {
  // V0.36 — le manager doit pouvoir juger son plan. Sans ces chiffres, il
  // choisissait une occupation ou une défense sans jamais savoir ce qu'elle
  // avait produit.
  const teamStats = computeTeamStats(result);
  const mine = playerSide === 'AWAY' ? teamStats.away : teamStats.home;
  const theirs = playerSide === 'AWAY' ? teamStats.home : teamStats.away;
  const verdicts = playerPlan ? readPlanOutcome(mine, theirs, playerPlan) : [];

  const richNarrative = buildRichNarrative({
    phases: result.phases,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    ...(homeClub ? { homeClub } : {}),
    ...(awayClub ? { awayClub } : {}),
    playersById,
    individualStats: result.individualStats,
  });
  const homeTries = result.phases.filter(p => p.outcome.tryScored === 'HOME').length;
  const awayTries = result.phases.filter(p => p.outcome.tryScored === 'AWAY').length;
  const placeKickAttempts = result.phases.filter(p =>
    p.type === 'CONVERSION' ||
    (p.type === 'PENALTY' && (p.outcome.summary.startsWith('pénalité réussie') || p.outcome.summary.startsWith('pénalité manquée')))
  ).length;
  const placeKickMakes = result.phases.filter(p =>
    p.outcome.pointsScored?.type === 'CONVERSION' || p.outcome.pointsScored?.type === 'PENALTY'
  ).length;

  // Top marqueurs (essais)
  const topScorers: { player: Player; tries: number }[] = [];
  for (const [pid, stats] of result.individualStats) {
    if (stats.tries > 0) {
      const player = playersById.get(pid);
      if (player) topScorers.push({ player, tries: stats.tries });
    }
  }
  topScorers.sort((a, b) => b.tries - a.tries);

  // Buteurs principaux
  const kickers: { player: Player; made: number; attempted: number }[] = [];
  for (const [pid, stats] of result.individualStats) {
    if (stats.placeKicks.attempted > 0) {
      const player = playersById.get(pid);
      if (player) kickers.push({ player, made: stats.placeKicks.made, attempted: stats.placeKicks.attempted });
    }
  }
  kickers.sort((a, b) => b.attempted - a.attempted);

  const winner =
    result.homeScore > result.awayScore ? `Victoire de ${homeName}` :
    result.homeScore < result.awayScore ? `Victoire de ${awayName}` :
    'Match nul';

  // V0.13 — feuille de statistiques individuelles, alimentée par les duels
  // porteur/défenseur. Avant, seuls les essais et les tirs au but existaient.
  type StatRow = { player: Player; stats: IndividualMatchStats };
  const statRows: StatRow[] = [];
  for (const [pid, stats] of result.individualStats) {
    const player = playersById.get(pid);
    if (player && stats.minutesPlayed > 0) statRows.push({ player, stats });
  }

  // Répartition par camp via le club du joueur (les deux feuilles sont disjointes).
  const homeId = homeClub?.id;
  const rowsFor = (clubId: string | undefined): StatRow[] =>
    clubId === undefined ? [] : statRows.filter(r => r.player.clubId === clubId);
  const homeRows = rowsFor(homeId);
  const awayRows = rowsFor(awayClub?.id);

  const totalPenalties = result.phases.filter(p => p.outcome.penaltyAwarded).length;
  const goalLineSequences = result.phases.filter(
    p => p.type === 'GOAL_LINE' && p.outcome.nextPhase !== 'GOAL_LINE',
  ).length;
  const goalLineHeld = result.phases.filter(
    p => p.type === 'GOAL_LINE' && p.outcome.nextPhase !== 'GOAL_LINE' && !p.outcome.tryScored,
  ).length;
  const substitutions = result.homeSubstitutions.length + result.awaySubstitutions.length;

  return (
    <>
      <div className="match-narrative">
        <div className="narrative-headline">{richNarrative.headline}</div>
        {richNarrative.paragraphs.map(p => (
          <div key={p.tag} className="narrative-para">
            <div className="narrative-tag">{p.tag}</div>
            <p>{p.text}</p>
          </div>
        ))}
      </div>

      <div className="summary-stats">
        <div className="stat">
          <span className="label">Essais HOME</span>
          <span className="value">{homeTries}</span>
        </div>
        <div className="stat">
          <span className="label">Essais AWAY</span>
          <span className="value">{awayTries}</span>
        </div>
        <div className="stat">
          <span className="label">Tirs au but</span>
          <span className="value">{placeKickMakes}/{placeKickAttempts}</span>
        </div>
        <div className="stat">
          <span className="label">Phases jouées</span>
          <span className="value">{result.phases.length}</span>
        </div>
      </div>

      {topScorers.length > 0 && (
        <div className="players-panel">
          <div className="players-tag">Marqueurs</div>
          <ul>
            {topScorers.slice(0, 5).map(s => (
              <li key={s.player.id}>
                <span className="player-name">{s.player.firstName} {s.player.lastName}</span>
                <span className="player-meta">{s.player.position.replaceAll('_', ' ').toLowerCase()}</span>
                <span className="player-stat">{s.tries} essai{s.tries > 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kickers.length > 0 && (
        <div className="players-panel">
          <div className="players-tag">Buteurs</div>
          <ul>
            {kickers.slice(0, 3).map(k => {
              const pct = k.attempted > 0 ? Math.round((k.made / k.attempted) * 100) : 0;
              return (
                <li key={k.player.id}>
                  <span className="player-name">{k.player.firstName} {k.player.lastName}</span>
                  <span className="player-meta">{k.player.position.replaceAll('_', ' ').toLowerCase()}</span>
                  <span className="player-stat">{k.made}/{k.attempted} ({pct}%)</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(goalLineSequences > 0 || substitutions > 0) && (
        <div className="summary-stats">
          {goalLineSequences > 0 && (
            <div className="stat">
              <span className="label">Ballons portés à 5 m</span>
              <span className="value">{goalLineSequences}</span>
              <span className="stat-note">
                {goalLineHeld > 0
                  ? `${goalLineHeld} repoussé${goalLineHeld > 1 ? 's' : ''} par la défense`
                  : 'tous conclus par un essai'}
              </span>
            </div>
          )}
          <div className="stat">
            <span className="label">Pénalités sifflées</span>
            <span className="value">{totalPenalties}</span>
          </div>
          {substitutions > 0 && (
            <div className="stat">
              <span className="label">Remplacements</span>
              <span className="value">{substitutions}</span>
              <span className="stat-note">
                {result.homeSubstitutions.length} / {result.awaySubstitutions.length}
              </span>
            </div>
          )}
          {result.uncontestedScrums && (
            <div className="stat">
              <span className="label">Mêlées</span>
              <span className="value">simulées</span>
              <span className="stat-note">plus de première ligne</span>
            </div>
          )}
        </div>
      )}

      {/* ---- Débriefing tactique (V0.36) ---------------------------------- */}
      <div className="debrief">
        <div className="debrief-head">
          <div className="players-tag">Débriefing</div>
          <span className="statsheet-hint">
            Le territoire se lit sur ses propres possessions : les deux camps peuvent dépasser 50 %.
          </span>
        </div>

        <table className="debrief-table">
          <thead>
            <tr>
              <th className="dt-home">{homeName}</th>
              <th className="dt-metric">&nbsp;</th>
              <th className="dt-away">{awayName}</th>
            </tr>
          </thead>
          <tbody>
            <ComparisonRow label="Possession" home={`${teamStats.home.possession} %`} away={`${teamStats.away.possession} %`}
              homeBetter={teamStats.home.possession > teamStats.away.possession} />
            <ComparisonRow label="Jeu dans le camp adverse" home={`${teamStats.home.territory} %`} away={`${teamStats.away.territory} %`}
              homeBetter={teamStats.home.territory > teamStats.away.territory} />
            <ComparisonRow label="Mêlées gagnées" home={setPiece(teamStats.home.scrums)} away={setPiece(teamStats.away.scrums)}
              homeBetter={rateOf(teamStats.home.scrums) > rateOf(teamStats.away.scrums)} />
            <ComparisonRow label="Touches gagnées" home={setPiece(teamStats.home.lineouts)} away={setPiece(teamStats.away.lineouts)}
              homeBetter={rateOf(teamStats.home.lineouts) > rateOf(teamStats.away.lineouts)} />
            <ComparisonRow label="Coups de pied tactiques" home={String(teamStats.home.kicks)} away={String(teamStats.away.kicks)}
              homeBetter={false} />
            <ComparisonRow label="Ballons perdus" home={String(teamStats.home.turnoversLost)} away={String(teamStats.away.turnoversLost)}
              homeBetter={teamStats.home.turnoversLost < teamStats.away.turnoversLost} />
            <ComparisonRow label="Pénalités concédées" home={String(teamStats.home.penaltiesConceded)} away={String(teamStats.away.penaltiesConceded)}
              homeBetter={teamStats.home.penaltiesConceded < teamStats.away.penaltiesConceded} />
            <ComparisonRow label="Incursions à 5 m" home={String(teamStats.home.goalLineSequences)} away={String(teamStats.away.goalLineSequences)}
              homeBetter={teamStats.home.goalLineSequences > teamStats.away.goalLineSequences} />
          </tbody>
        </table>

        {verdicts.length > 0 && (
          <ul className="plan-verdicts">
            {verdicts.map(v => (
              <li key={v.dial}>
                <span className="pv-dial">{v.dial}</span>
                <span className="pv-reading">{v.reading}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(homeRows.length > 0 || awayRows.length > 0) && (
        <div className="statsheet">
          <div className="statsheet-head">
            <div className="players-tag">Feuille de statistiques</div>
            <span className="statsheet-hint">
              Triée par mètres gagnés · valeurs à l'échelle du moteur
            </span>
          </div>
          {[
            { label: homeName, rows: homeRows },
            { label: awayName, rows: awayRows },
          ]
            .filter(side => side.rows.length > 0)
            .map(side => (
              <div key={side.label} className="statsheet-side">
                <div className="statsheet-team">{side.label}</div>
                <div className="statsheet-scroll">
                  <table className="statsheet-table">
                    <thead>
                      <tr>
                        <th className="col-player">Joueur</th>
                        <th title="Minutes jouées">MIN</th>
                        <th title="Ballons portés">CRS</th>
                        <th title="Mètres gagnés balle en main">M</th>
                        <th title="Défenseurs battus">DB</th>
                        <th title="Franchissements">FR</th>
                        <th title="Plaquages réussis">PLQ</th>
                        <th title="Plaquages manqués">MQ</th>
                        <th title="Ballons grattés">GRT</th>
                        <th title="Essais">E</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...side.rows]
                        .sort((a, b) => b.stats.metersWithBall - a.stats.metersWithBall)
                        .map(({ player, stats }) => (
                          <tr key={player.id}>
                            <td className="col-player">
                              <span className="sheet-name">{player.lastName}</span>
                              <span className="sheet-pos">{shortPosition(player.position)}</span>
                            </td>
                            <td className={stats.minutesPlayed < 80 ? 'dim' : ''}>{stats.minutesPlayed}</td>
                            <td>{stats.carries || '—'}</td>
                            <td className={stats.metersWithBall > 0 ? 'strong' : ''}>{stats.metersWithBall || '—'}</td>
                            <td>{stats.defendersBeaten || '—'}</td>
                            <td className={stats.lineBreaks > 0 ? 'accent' : ''}>{stats.lineBreaks || '—'}</td>
                            <td>{stats.tackles || '—'}</td>
                            <td className={stats.tacklesMissed > 0 ? 'warn' : ''}>{stats.tacklesMissed || '—'}</td>
                            <td className={stats.turnoversWon > 0 ? 'accent' : ''}>{stats.turnoversWon || '—'}</td>
                            <td className={stats.tries > 0 ? 'accent' : ''}>{stats.tries || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 14, padding: '8px 0' }}>
        {winner}
      </div>
    </>
  );
}

/** Abréviation de poste pour les tableaux denses. */
function shortPosition(position: string): string {
  const map: Record<string, string> = {
    PILIER_GAUCHE: 'PG', TALONNEUR: 'TAL', PILIER_DROIT: 'PD',
    DEUXIEME_LIGNE_GAUCHE: '2L', DEUXIEME_LIGNE_DROITE: '2L',
    TROISIEME_LIGNE_AILE_GAUCHE: '3L', TROISIEME_LIGNE_AILE_DROITE: '3L',
    NUMERO_8: 'N8', DEMI_DE_MELEE: 'DM', OUVREUR: 'OUV',
    CENTRE_INTERIEUR: 'CI', CENTRE_EXTERIEUR: 'CE',
    AILIER_GAUCHE: 'AIL', AILIER_DROIT: 'AIL', ARRIERE: 'ARR',
  };
  return map[position] ?? position.slice(0, 3);
}

// =============================================================================
// Débriefing — briques d'affichage
// =============================================================================

function rateOf(r: TeamMatchStats['scrums']): number {
  return r.total === 0 ? 0 : r.won / r.total;
}

function setPiece(r: TeamMatchStats['scrums']): string {
  if (r.total === 0) return '—';
  return `${Math.round((r.won / r.total) * 100)} % (${r.won}/${r.total})`;
}

/**
 * Une ligne de comparaison, le libellé au centre.
 *
 * Les deux colonnes se font face de part et d'autre du libellé : c'est la
 * disposition des feuilles de match télévisées, et elle rend la comparaison
 * immédiate là où deux tableaux séparés obligeraient à faire des allers-retours.
 */
function ComparisonRow({ label, home, away, homeBetter }: {
  readonly label: string;
  readonly home: string;
  readonly away: string;
  readonly homeBetter: boolean;
}) {
  return (
    <tr>
      <td className={`dt-home ${homeBetter ? 'lead' : ''}`}>{home}</td>
      <td className="dt-metric">{label}</td>
      <td className={`dt-away ${!homeBetter && home !== away ? 'lead' : ''}`}>{away}</td>
    </tr>
  );
}
