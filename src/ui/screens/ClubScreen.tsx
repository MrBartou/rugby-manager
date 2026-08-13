/**
 * La fiche d'un club : V0.61.
 *
 * On croisait un adversaire quatorze fois par saison sans jamais pouvoir
 * l'ouvrir. Le classement donnait des points, le dossier d'avant-match donnait
 * une tendance pour la rencontre du jour, et rien ne disait qui joue là-bas, ni
 * ce que ce club vaut, ni ce qu'on a fait contre lui depuis qu'on est en poste.
 *
 * ## Ce qu'on voit d'un club adverse
 *
 * Pas tout. L'effectif se lit à travers ce que le scouting a appris : un club
 * jamais observé montre ses joueurs, leur poste et leur âge, mais pas des notes
 * chiffrées qu'aucun observateur n'a rapportées. Afficher un effectif entier au
 * détail près ferait du scouting une formalité, et le rapport d'observation
 * n'aurait plus rien à apprendre à personne.
 *
 * Pour son propre club, le voile tombe : on connaît ses joueurs.
 */

import { useMemo, useState } from 'react';
import type { Club, Player, PlayerId } from '../../engine/types.js';
import type { ClubStanding } from '../../engine/season/standings.js';
import type { SeasonPlayerStat } from '../../engine/game/season-session.js';
import { averageRating } from '../../engine/game/season-session.js';
import type { HeadToHead } from '../../engine/season/rivalries.js';
import { certaintyFor, estimatePotential, type ScoutingState } from '../../engine/club/scouting.js';
import { approximateOverall } from '../../engine/club/development.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { PositionBadge } from '../components/DataBits.js';
import { positionLineOf } from './SquadScreen.js';

interface Props {
  readonly club: Club;
  readonly isPlayerClub: boolean;
  /** Effectif visible du club, déjà filtré des retraités et des agents libres. */
  readonly roster: readonly Player[];
  readonly standing: ClubStanding | undefined;
  readonly rank?: number;
  readonly currentSeason: number;
  readonly seasonStats: ReadonlyMap<PlayerId, SeasonPlayerStat>;
  readonly scouting: ScoutingState;
  /** Bilan des confrontations depuis la prise de fonction. Absent si jamais joué. */
  readonly headToHead: HeadToHead | undefined;
  /** Cinq derniers résultats du club, du plus ancien au plus récent. */
  readonly form: readonly ('V' | 'N' | 'D')[];
  readonly onSelectPlayer: (player: Player) => void;
  readonly onBack: () => void;
}

const TIER_LABEL: Readonly<Record<Club['tier'], string>> = {
  GROS_BUDGET: 'Gros budget',
  BUDGET_MOYEN: 'Budget moyen',
  PETIT_BUDGET: 'Petit budget',
};

const IDENTITY_LABEL: Readonly<Record<Club['tacticalIdentity'], string>> = {
  JEU_AVANTS: 'Jeu d\'avants',
  GRAND_ECART: 'Jeu déployé',
  MIXTE: 'Jeu mixte',
  DEFENSE_DE_FER: 'Défense de fer',
};

const euros = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M€` : `${Math.round(n / 1000)} k€`;

function ageOf(player: Player, currentSeason: number): number {
  return currentSeason - Number(player.birthDate.slice(0, 4));
}

export function ClubScreen({
  club, isPlayerClub, roster, standing, rank, currentSeason,
  seasonStats, scouting, headToHead, form, onSelectPlayer, onBack,
}: Props) {
  const [ligne, setLigne] = useState<'TOUS' | 'AVANTS' | 'TROIS_QUARTS'>('TOUS');

  const lignes = useMemo(() => {
    const filtres = roster.filter(p => {
      if (ligne === 'TOUS') return true;
      const l = positionLineOf(p.position);
      return ligne === 'AVANTS' ? l === 'AVANTS' : l !== 'AVANTS';
    });

    return filtres
      .map(player => {
        const familiarity = scouting.knowledge.get(player.id)?.familiarity ?? 0;
        const stat = seasonStats.get(player.id);
        return {
          player,
          age: ageOf(player, currentSeason),
          // Le niveau chiffré n'apparaît que pour ses propres joueurs ou pour
          // un joueur assez observé pour qu'un rapport soit fiable : c'est ce
          // qui donne sa valeur au scouting. La familiarité se lit de 0 à 100,
          // et son vocabulaire vient du module plutôt que d'un seuil en dur.
          niveau: isPlayerClub || certaintyFor(familiarity) === 'FIABLE' || certaintyFor(familiarity) === 'CERTAIN'
            ? Math.round(approximateOverall(player))
            : undefined,
          potentiel: estimatePotential(player, familiarity, currentSeason).display,
          matches: stat?.matches ?? 0,
          tries: stat?.tries ?? 0,
          rating: averageRating(stat),
        };
      })
      .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.matches - a.matches);
  }, [roster, ligne, scouting, isPlayerClub, currentSeason, seasonStats]);

  const masse = roster.reduce((total, p) => total + p.contract.annualSalary, 0);
  const ageMoyen = roster.length > 0
    ? (roster.reduce((total, p) => total + ageOf(p, currentSeason), 0) / roster.length).toFixed(1)
    : '—';

  return (
    <section className="club-screen">
      <div className="screen-head">
        <h2>Fiche club</h2>
        <button onClick={onBack} type="button" className="ghost">← Retour</button>
      </div>

      <div className="club-hero">
        <ClubCrest clubId={club.id as string} initials={club.shortName} size={54} />
        <div className="club-hero-body">
          <div className="club-hero-name">{club.name}</div>
          <div className="club-hero-sub">
            {club.city} · {TIER_LABEL[club.tier]} · {IDENTITY_LABEL[club.tacticalIdentity]}
          </div>
        </div>
        {form.length > 0 && (
          <div className="club-form" title="Cinq derniers matchs, du plus ancien au plus récent">
            {form.map((r, i) => (
              <span key={i} className={`club-form-dot ${r}`}>{r}</span>
            ))}
          </div>
        )}
      </div>

      <div className="club-facts">
        <div className="cf-item">
          <span className="cf-value">{rank ? (rank === 1 ? '1er' : `${rank}e`) : '—'}</span>
          <span className="cf-label">au classement</span>
        </div>
        <div className="cf-item">
          <span className="cf-value">{standing?.leaguePoints ?? '—'}</span>
          <span className="cf-label">points</span>
        </div>
        <div className="cf-item">
          <span className="cf-value">
            {standing ? `${standing.wins}-${standing.draws}-${standing.losses}` : '—'}
          </span>
          <span className="cf-label">V-N-D</span>
        </div>
        <div className="cf-item">
          <span className="cf-value">{club.stadiumCapacity.toLocaleString('fr-FR')}</span>
          <span className="cf-label">places</span>
        </div>
        <div className="cf-item">
          <span className="cf-value">{euros(masse)}</span>
          <span className="cf-label">masse salariale</span>
        </div>
        <div className="cf-item">
          <span className="cf-value">{ageMoyen}</span>
          <span className="cf-label">âge moyen</span>
        </div>
      </div>

      {/* Le bilan des confrontations n'existe que depuis qu'on est en poste :
          c'est une mémoire de manager, pas une archive de la ligue. */}
      {headToHead && !isPlayerClub
        && (headToHead.wins + headToHead.draws + headToHead.losses) > 0 && (
        <div className="club-h2h">
          <div className="panel-tag">Face à eux</div>
          <div className="h2h-line">
            <b>{headToHead.wins}</b> victoire{headToHead.wins > 1 ? 's' : ''},{' '}
            <b>{headToHead.draws}</b> nul{headToHead.draws > 1 ? 's' : ''},{' '}
            <b>{headToHead.losses}</b> défaite{headToHead.losses > 1 ? 's' : ''}
            {headToHead.streak !== 0 && ' · '}
            {headToHead.streak !== 0 && (
              <span className={`h2h-streak ${headToHead.streak > 0 ? 'good' : 'bad'}`}>
                {headToHead.streak > 0
                  ? `${headToHead.streak} victoire${headToHead.streak > 1 ? 's' : ''} de suite`
                  : `${-headToHead.streak} défaite${headToHead.streak < -1 ? 's' : ''} de suite`}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="club-roster">
        <div className="club-roster-head">
          <div className="panel-tag">Effectif ({roster.length})</div>
          <div className="squad-view-switch">
            {([['TOUS', 'Tous'], ['AVANTS', 'Avants'], ['TROIS_QUARTS', 'Trois-quarts']] as const)
              .map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={ligne === v ? 'active' : ''}
                  onClick={() => setLigne(v)}
                >
                  {label}
                </button>
              ))}
          </div>
        </div>

        {!isPlayerClub && (
          <p className="club-roster-hint">
            Ce qu'on voit d'un club adverse dépend de ce que le scouting en a rapporté.
          </p>
        )}

        <div className="squad-table-wrap">
          <table className="squad-table">
            <thead>
              <tr>
                <th className="c-pos">Poste</th>
                <th className="c-name">Joueur</th>
                <th className="num-head">Âge</th>
                <th className="num-head">Niveau</th>
                <th className="num-head">Potentiel</th>
                <th className="num-head">Matchs</th>
                <th className="num-head">Essais</th>
                <th className="num-head">Note</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(row => (
                <tr key={row.player.id} onClick={() => onSelectPlayer(row.player)} title="Voir la fiche">
                  <td className="c-pos"><PositionBadge position={row.player.position} /></td>
                  <td className="c-name">
                    <span className="sq-name">{row.player.firstName} {row.player.lastName}</span>
                    {row.player.isJiff && <span className="sq-tag jiff">JIFF</span>}
                  </td>
                  <td className="num">{row.age}</td>
                  <td className="num">{row.niveau ?? '—'}</td>
                  <td className="num potential">{row.potentiel}</td>
                  <td className="num">{row.matches || '—'}</td>
                  <td className="num">{row.tries || '—'}</td>
                  <td className="num">{row.rating?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
