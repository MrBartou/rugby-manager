/**
 * Année sabbatique — V0.43.
 *
 * V0.41 promettait qu'un limogeage ne terminait plus la carrière, mais le
 * manager libre devait reprendre un banc **immédiatement** : les seules offres
 * tombaient à l'intersaison, et refuser n'aurait mené qu'à un écran vide. La
 * modale masquait donc son bouton « décliner », et le rebond était en réalité
 * une obligation.
 *
 * Cet écran est ce qui manquait. Il ne donne aucun levier — c'est le propos :
 * on regarde le championnat se jouer sans soi, la réputation s'érode, et on
 * attend qu'un banc se libère. Ce que le joueur perd en pouvoir, la carrière
 * le gagne en poids : un limogeage coûte désormais quelque chose.
 */

import type { ClubStanding } from '../../engine/season/standings.js';
import { reputationLabel, type ManagerReputation } from '../../engine/season/manager-reputation.js';
import { ClubCrest } from '../components/ClubCrest.js';

interface Props {
  readonly season: number;
  readonly round: number;
  readonly totalRounds: number;
  readonly standings: readonly ClubStanding[];
  readonly reputation: ManagerReputation;
  /** Saison depuis laquelle le manager est sans club. */
  readonly since: number;
  /** Bancs libérés cette saison, en attente d'un titulaire. */
  readonly vacancies: readonly string[];
  readonly clubName: (clubId: string) => string;
  readonly clubShortName: (clubId: string) => string;
  readonly onAdvance: () => void;
  readonly onOpenOffers: () => void;
  readonly hasOffers: boolean;
}

function seasonLabel(season: number): string {
  return `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
}

export function SabbaticalScreen({
  season, round, totalRounds, standings, reputation, since, vacancies,
  clubName, clubShortName, onAdvance, onOpenOffers, hasOffers,
}: Props) {
  const ranked = [...standings].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });

  return (
    <section className="screen sabbatical-screen">
      <div className="sabbatical-head">
        <span className="panel-tag">Sans club</span>
        <h2>Année sabbatique</h2>
        <p className="sabbatical-intro">
          Vous êtes libre depuis {seasonLabel(since)}. Le championnat continue sans vous ;
          votre réputation s'érode à chaque saison passée hors d'un banc.
        </p>
      </div>

      <div className="sabbatical-status">
        <div className="ss-item">
          <span className="ss-label">Saison en cours</span>
          <span className="ss-value">{seasonLabel(season)} · journée {round}/{totalRounds}</span>
        </div>
        <div className="ss-item">
          <span className="ss-label">Réputation</span>
          <span className="ss-value">{reputation.score}/100 — {reputationLabel(reputation.score)}</span>
        </div>
        <div className="ss-item">
          <span className="ss-label">Bancs libérés</span>
          <span className="ss-value">{vacancies.length}</span>
        </div>
      </div>

      <div className="sabbatical-actions">
        <button type="button" className="primary" onClick={onAdvance}>
          Passer la journée →
        </button>
        {hasOffers && (
          <button type="button" className="secondary" onClick={onOpenOffers}>
            Consulter les propositions
          </button>
        )}
      </div>

      {/* Les bancs vacants sont la seule information qui compte ici : c'est ce
          qu'on attend. */}
      {vacancies.length > 0 && (
        <div className="dashboard-panel">
          <div className="panel-tag">Postes vacants</div>
          <ul className="vacancy-list">
            {vacancies.map(id => (
              <li key={id} className="vacancy-row">
                <ClubCrest clubId={id} initials={clubShortName(id)} size={26} />
                <span>{clubName(id)}</span>
                <span className="vacancy-note">cherche un entraîneur</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="dashboard-panel">
        <div className="panel-tag">Classement</div>
        <ol className="sabbatical-table">
          {ranked.map((row, i) => (
            <li key={row.clubId as string} className="sab-row">
              <span className="sab-rank">{i + 1}</span>
              <ClubCrest clubId={row.clubId as string} initials={clubShortName(row.clubId as string)} size={22} />
              <span className="sab-club">{clubName(row.clubId as string)}</span>
              <span className="sab-pts">{row.leaguePoints} pts</span>
              <span className="sab-diff">
                {row.pointsFor - row.pointsAgainst >= 0 ? '+' : ''}
                {row.pointsFor - row.pointsAgainst}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
