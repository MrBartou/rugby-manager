/**
 * Le banc du XV de France — V0.59.
 *
 * Sept matchs par an, et rien entre les deux. C'est ce qui rend le poste
 * différent d'un banc de club, et l'écran doit le montrer plutôt que de le
 * compenser : pas de mercato, pas d'entraînement, pas de finances. On regarde
 * le Top 14 se jouer, on compose quand la fenêtre s'ouvre, on joue.
 *
 * Le manager n'est pas spectateur de sa propre sélection : le sélectionneur du
 * jeu **propose** un groupe classé par mérite, et le manager en retire ou en
 * ajoute qui il veut. C'est le seul vrai levier du poste — autant qu'il soit
 * franc.
 */

import type { ClubStanding } from '../../engine/season/standings.js';
import type { ManagerReputation } from '../../engine/season/manager-reputation.js';
import type { NationalSquad } from '../../engine/season/national-team.js';
import type { WindowReport } from '../../engine/season/national-team.js';
import type { Player, PlayerId } from '../../engine/types.js';
import { positionShort } from '../components/DataBits.js';

interface Props {
  readonly season: number;
  readonly round: number;
  readonly totalRounds: number;
  readonly standings: readonly ClubStanding[];
  readonly reputation: ManagerReputation;
  readonly since: number;
  readonly clubName: (id: string) => string;
  /** Le groupe du moment — absent hors fenêtre internationale. */
  readonly squad: NationalSquad | undefined;
  /** Candidats classés par mérite, tels que le sélectionneur les voit. */
  readonly shortlist: readonly { readonly player: Player; readonly score: number }[];
  readonly capsOf: (id: PlayerId) => number;
  readonly reports: readonly WindowReport[];
  readonly onAdvance: () => void;
  readonly onToggle: (playerId: PlayerId) => void;
}

export function NationalScreen({
  season, round, totalRounds, standings, reputation, since, clubName,
  squad, shortlist, capsOf, reports, onAdvance, onToggle,
}: Props) {
  const ranked = [...standings].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });
  const retenus = new Set((squad?.players ?? []).map(id => id as string));
  const fenetre = squad !== undefined;

  return (
    <section className="national">
      <div className="nat-head">
        <div>
          <div className="nat-title">XV de France</div>
          <div className="nat-sub">
            Sélectionneur depuis {since}-{String((since + 1) % 100).padStart(2, '0')}
            {' · '}réputation {reputation.score}/100
          </div>
        </div>
        <button type="button" className="primary" onClick={onAdvance}>
          {fenetre ? 'Disputer la fenêtre →' : 'Journée suivante →'}
        </button>
      </div>

      <div className="nat-grid">
        <div className="dashboard-panel">
          <div className="panel-tag">
            {fenetre
              ? `Le groupe — ${retenus.size} joueurs`
              : 'Hors fenêtre internationale'}
          </div>
          {!fenetre && (
            <p className="nat-idle">
              Aucun rassemblement en cours. Le championnat se joue sans vous —
              c'est le moment de regarder qui monte.
            </p>
          )}
          {fenetre && (
            <ul className="nat-list">
              {shortlist.slice(0, 45).map(({ player }) => {
                const dedans = retenus.has(player.id as string);
                const capes = capsOf(player.id);
                return (
                  <li key={player.id as string}>
                    <button
                      type="button"
                      className={`nat-candidate ${dedans ? 'in' : ''}`}
                      onClick={() => onToggle(player.id)}
                      title={dedans ? 'Retirer du groupe' : 'Appeler dans le groupe'}
                    >
                      <span className="nc-pos">{positionShort(player.position)}</span>
                      <span className="nc-name">{player.firstName} {player.lastName}</span>
                      <span className="nc-club">{clubName(player.clubId as string)}</span>
                      <span className="nc-caps">{capes > 0 ? `${capes} sél.` : 'non capé'}</span>
                      <span className="nc-mark">{dedans ? '✓' : '+'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="nat-side">
          <div className="dashboard-panel">
            <div className="panel-tag">Résultats</div>
            {reports.length === 0 && (
              <p className="nat-idle">Aucun match disputé pour l'instant.</p>
            )}
            {reports.map((r, i) => (
              <div key={i} className="nat-report">
                <div className="nat-report-head">{r.headline}</div>
                <ul className="nat-scores">
                  {r.results.map((m, j) => (
                    <li key={j} className={m.franceScore > m.opponentScore ? 'win' : m.franceScore < m.opponentScore ? 'loss' : ''}>
                      <span>{m.home ? 'France' : m.opponent}</span>
                      <strong>{m.home ? m.franceScore : m.opponentScore} – {m.home ? m.opponentScore : m.franceScore}</strong>
                      <span>{m.home ? m.opponent : 'France'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="dashboard-panel">
            <div className="panel-tag">Top 14 — journée {round}/{totalRounds}</div>
            <ul className="nat-standings">
              {ranked.slice(0, 8).map((s, i) => (
                <li key={s.clubId as string}>
                  <span className="ns-rank">{i + 1}</span>
                  <span className="ns-club">{clubName(s.clubId as string)}</span>
                  <strong>{s.leaguePoints}</strong>
                </li>
              ))}
            </ul>
            <div className="nat-season">Saison {season}-{String((season + 1) % 100).padStart(2, '0')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
