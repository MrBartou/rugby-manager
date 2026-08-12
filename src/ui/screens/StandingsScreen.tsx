/**
 * StandingsScreen — V0.12.
 *
 * Drill-down complet : tableau toutes colonnes (J, V, N, D, BP, BC, Diff, BO, BD, Pts),
 * forme sur les 5 derniers matchs (W/N/L), moyennes attaque/défense par match,
 * zones de qualification (Top 6 = phases finales) et de relégation surlignées.
 */

import type { SeasonState } from '../../engine/game/season-session.js';
import { relegationStatusForRank } from '../../engine/season/relegation.js';
import { DIVISION_LABEL, type Division } from '../../engine/season/divisions.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { FormGuide } from '../components/DataBits.js';
import { COMPETITION_LABEL, competitionForRank } from '../../engine/season/european-cup.js';
import type { Club } from '../../engine/types.js';

interface Props {
  readonly state: SeasonState;
  readonly clubs: readonly Club[];
  /** V0.44 — l'étage où l'on joue : un classement de Pro D2 ne s'annonce pas « Top 14 ». */
  readonly division: Division;
}

interface FormResult {
  readonly result: 'W' | 'D' | 'L';
  readonly bonus: boolean;
}

function clubName(clubs: readonly Club[], id: string): string {
  return clubs.find(c => c.id === id)?.name ?? id;
}
function clubShort(clubs: readonly Club[], id: string): string {
  return clubs.find(c => c.id === id)?.shortName ?? id;
}

/** Calcule la forme (5 derniers résultats) d'un club. */
function computeForm(state: SeasonState, clubId: string): FormResult[] {
  const matches = state.history
    .filter(h => h.homeClubId === clubId || h.awayClubId === clubId)
    .slice(-5);
  return matches.map(h => {
    const isHome = h.homeClubId === clubId;
    const myScore = isHome ? h.homeScore : h.awayScore;
    const oppScore = isHome ? h.awayScore : h.homeScore;
    const result: 'W' | 'D' | 'L' = myScore > oppScore ? 'W' : myScore === oppScore ? 'D' : 'L';
    const bonus = result === 'W' ? oppScore <= myScore - 8 : oppScore - myScore <= 7 && result === 'L';
    return { result, bonus };
  });
}

export function StandingsScreen({ state, clubs, division }: Props) {
  const ranking = [...state.standings.values()].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.pointsFor - a.pointsFor;
  });

  const playerClubId = state.playerClubId;

  // Top 14 : 1-2 = qualifiés directs ½, 3-6 = barrages, 13 = barrage d'accession, 14 = descente.
  // V0.13 : les seuils de descente et de qualification européenne viennent du moteur,
  // pour que l'affichage ne puisse pas diverger des règles réellement appliquées.
  const QUALIF_DIRECT = 2;
  const QUALIF_BARRAGE = 6;

  // V0.23 — bandeau de situation : l'écran s'ouvrait directement sur un tableau
  // de 14 lignes, sans dire au manager où il en est ni ce qu'il vise.
  const playerRank = ranking.findIndex(r => r.clubId === playerClubId) + 1;
  const playerStanding = ranking[playerRank - 1];
  const playerForm = playerStanding ? computeForm(state, playerStanding.clubId) : [];
  const leader = ranking[0];
  const gapToLeader = playerStanding && leader ? leader.leaguePoints - playerStanding.leaguePoints : 0;
  const roundsLeft = Math.max(0, state.calendar.totalRounds - state.currentRound + 1);

  return (
    <section className="standings-screen">
      {playerStanding && (
        <div className="comp-strip">
          <div className="comp-rank">
            <span className="comp-rank-value">{playerRank}<sup>e</sup></span>
            <span className="comp-rank-label">au classement</span>
          </div>

          <div className="comp-stat">
            <span className="comp-stat-value">{playerStanding.leaguePoints}</span>
            <span className="comp-stat-label">points</span>
          </div>
          <div className="comp-stat">
            <span className="comp-stat-value">
              {playerStanding.wins}<span className="comp-sep">-</span>{playerStanding.draws}<span className="comp-sep">-</span>{playerStanding.losses}
            </span>
            <span className="comp-stat-label">V-N-D</span>
          </div>
          <div className="comp-stat">
            <span className={`comp-stat-value ${playerStanding.pointsFor - playerStanding.pointsAgainst >= 0 ? 'pos' : 'neg'}`}>
              {playerStanding.pointsFor - playerStanding.pointsAgainst >= 0 ? '+' : ''}
              {playerStanding.pointsFor - playerStanding.pointsAgainst}
            </span>
            <span className="comp-stat-label">différence</span>
          </div>
          <div className="comp-stat">
            <span className="comp-stat-value">{gapToLeader === 0 ? '—' : `-${gapToLeader}`}</span>
            <span className="comp-stat-label">sur le leader</span>
          </div>

          <div className="comp-form">
            <span className="comp-stat-label">Forme récente</span>
            <FormGuide results={playerForm.map(f => (f.result === 'W' ? 1 : f.result === 'L' ? -1 : 0))} />
          </div>

          <div className="comp-remaining">
            <span className="comp-stat-value">{roundsLeft}</span>
            <span className="comp-stat-label">journées restantes</span>
          </div>
        </div>
      )}

      <header className="standings-header">
        <h2>Classement {DIVISION_LABEL[division]} · {state.currentSeason}-{(state.currentSeason + 1).toString().slice(-2)}</h2>
        <div className="standings-legend">
          <span className="legend-item"><span className="legend-dot zone-direct" /> Qualif. ½ directe</span>
          <span className="legend-item"><span className="legend-dot zone-barrage" /> Barrages</span>
          <span className="legend-item"><span className="legend-dot zone-barrage-bas" /> Barrage d'accession</span>
          <span className="legend-item"><span className="legend-dot zone-rel" /> Relégation</span>
          <span className="legend-item"><span className="euro-badge major">EU</span> Coupe d'Europe</span>
          <span className="legend-item"><span className="euro-badge challenge">CH</span> Challenge</span>
        </div>
      </header>

      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th className="col-rank">#</th>
              <th className="col-club">Club</th>
              <th className="col-num" title="Matchs joués">J</th>
              <th className="col-num" title="Victoires">V</th>
              <th className="col-num" title="Nuls">N</th>
              <th className="col-num" title="Défaites">D</th>
              <th className="col-num" title="Points marqués">BP</th>
              <th className="col-num" title="Points encaissés">BC</th>
              <th className="col-num" title="Différentiel">+/-</th>
              <th className="col-num" title="Bonus offensif">BO</th>
              <th className="col-num" title="Bonus défensif">BD</th>
              <th className="col-num col-avg" title="Moy. marqués / match">Att.</th>
              <th className="col-num col-avg" title="Moy. encaissés / match">Déf.</th>
              <th className="col-form">Forme</th>
              <th className="col-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((s, i) => {
              const rank = i + 1;
              const isPlayer = s.clubId === playerClubId;
              const diff = s.pointsFor - s.pointsAgainst;
              const avgFor = s.played > 0 ? (s.pointsFor / s.played).toFixed(1) : '—';
              const avgAgainst = s.played > 0 ? (s.pointsAgainst / s.played).toFixed(1) : '—';
              const form = computeForm(state, s.clubId);
              const relegation = relegationStatusForRank(rank, ranking.length);
              const zoneClass =
                relegation === 'RELEGATED' ? 'zone-rel' :
                relegation === 'BARRAGE' ? 'zone-barrage-bas' :
                rank <= QUALIF_DIRECT ? 'zone-direct' :
                rank <= QUALIF_BARRAGE ? 'zone-barrage' : '';
              const europe = competitionForRank(rank);
              return (
                <tr key={s.clubId} className={`${zoneClass} ${isPlayer ? 'is-player' : ''}`}>
                  <td className="col-rank">{rank}</td>
                  <td className="col-club">
                    <ClubCrest clubId={s.clubId as string} initials={clubShort(clubs, s.clubId)} size={24} />
                    <span className="club-names">
                      <span className="club-short">{clubShort(clubs, s.clubId)}</span>
                      <span className="club-name">{clubName(clubs, s.clubId)}</span>
                    </span>
                    {europe && (
                      <span
                        className={`euro-badge ${europe === 'CHAMPIONS_CUP' ? 'major' : 'challenge'}`}
                        title={COMPETITION_LABEL[europe]}
                      >
                        {europe === 'CHAMPIONS_CUP' ? 'EU' : 'CH'}
                      </span>
                    )}
                  </td>
                  <td className="col-num">{s.played}</td>
                  <td className="col-num">{s.wins}</td>
                  <td className="col-num">{s.draws}</td>
                  <td className="col-num">{s.losses}</td>
                  <td className="col-num">{s.pointsFor}</td>
                  <td className="col-num">{s.pointsAgainst}</td>
                  <td className={`col-num ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </td>
                  <td className="col-num">{s.tryBonus}</td>
                  <td className="col-num">{s.losingBonus}</td>
                  <td className="col-num col-avg">{avgFor}</td>
                  <td className="col-num col-avg">{avgAgainst}</td>
                  <td className="col-form">
                    {form.length === 0 && <span className="form-empty">—</span>}
                    {form.map((f, idx) => (
                      <span
                        key={idx}
                        className={`form-pip form-${f.result.toLowerCase()}${f.bonus ? ' bonus' : ''}`}
                        title={`${f.result === 'W' ? 'Victoire' : f.result === 'D' ? 'Nul' : 'Défaite'}${f.bonus ? ' (bonus)' : ''}`}
                      >
                        {f.result}
                      </span>
                    ))}
                  </td>
                  <td className="col-pts">{s.leaguePoints}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="standings-footnote">
        Top 14 : <b>4 pts</b> par victoire, <b>2 pts</b> par nul, <b>1 pt</b> bonus offensif (≥3 essais d'écart) ou défensif (défaite ≤7 pts).
      </p>
    </section>
  );
}
