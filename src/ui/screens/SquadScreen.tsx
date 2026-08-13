/**
 * Vestiaire — V0.16, reconstruit.
 *
 * L'écran précédent était une grille de cartes qui n'affichait ni le poste ni le
 * moindre attribut : sur un effectif de rugby, on ne pouvait pas distinguer un
 * pilier d'un ailier. C'est pourtant l'écran central d'un jeu de management.
 *
 * Il est refait comme un vrai tableau d'effectif : dense, triable, filtrable,
 * avec pour chaque joueur son poste, son âge, son état physique, sa forme, ses
 * **attributs clés propres à son poste**, son temps de jeu et son potentiel
 * estimé par le scout.
 */

import { useMemo, useState } from 'react';
import {
  STATUS_DESCRIPTION,
  STATUS_LABEL as ROLE_LABEL,
  judgeStatus,
  statusOf,
  type SquadStatus,
  type StatusVerdict,
} from '../../engine/club/squad-status.js';
import type { Player, PlayerId, Position } from '../../engine/types.js';
import { computeMood } from '../../engine/human/mood.js';
import { computeRelationsForMood, type RelationsState } from '../../engine/human/relationships.js';
import { computeClubJiffStats } from '../../engine/club/jiff.js';
import { estimatePotential, type ScoutingState } from '../../engine/club/scouting.js';
import {
  KeyAttributes,
  Meter,
  POSITION_LINE,
  PositionBadge,
  keyAttributesFor,
  positionNumber,
  type PositionLine,
} from '../components/DataBits.js';
import { roleFitness, type RoleDefinition } from '../../engine/match/roles.js';
import { averageRating, type SeasonPlayerStat } from '../../engine/game/season-session.js';

interface Props {
  readonly clubName?: string;
  readonly players: readonly Player[];
  readonly currentSeason: number;
  readonly recentResults: readonly (-1 | 0 | 1)[];
  readonly playRatioByPlayer: ReadonlyMap<string, number>;
  readonly relations: RelationsState;
  /**
   * V0.61 — la statistique de saison au complet, note comprise.
   *
   * L'écran n'en lisait que trois champs alors que le moteur en tient huit
   * depuis la V0.13 : mètres, plaquages, grattages, défenseurs battus et
   * franchissements n'apparaissaient nulle part.
   */
  readonly seasonStats: ReadonlyMap<PlayerId, SeasonPlayerStat>;
  readonly scouting: ScoutingState;
  readonly currentRound: number;
  /** V0.50 — capitaine en titre, signalé dans la liste et pesant sur son moral. */
  readonly captainId?: PlayerId;
  /**
   * V0.50 — hiérarchie annoncée.
   *
   * Absente, chaque joueur retombe sur le statut que son temps de jeu suggère :
   * une sauvegarde antérieure n'a rien déclaré.
   */
  readonly squadStatuses?: ReadonlyMap<PlayerId, SquadStatus>;
  readonly onSetStatus?: (playerId: PlayerId, status: SquadStatus) => void;
  readonly onSelectPlayer: (player: Player) => void;
  readonly onBack?: () => void;
}

type LineFilter = 'ALL' | PositionLine;
type StatusFilter = 'ALL' | 'DISPO' | 'INDISPO' | 'JIFF' | 'JEUNES';
type SortKey =
  | 'poste' | 'nom' | 'age' | 'profil' | 'condition' | 'forme' | 'mood' | 'minutes' | 'potentiel'
  | 'note' | 'matchs' | 'essais' | 'metres' | 'plaquages' | 'grattages' | 'battus' | 'franchis';

/**
 * V0.61 — deux lectures du même effectif.
 *
 * L'écran répondait à « de quoi je dispose » et jamais à « qui produit ». Les
 * deux questions n'appellent pas les mêmes colonnes, et les empiler dans un
 * seul tableau aurait donné dix-huit colonnes illisibles.
 */
type Vue = 'EFFECTIF' | 'STATISTIQUES';

/** Même code couleur que la feuille de match : au dessus du décile, sous la moyenne, le reste. */
function noteClass(rating: number | undefined): string {
  if (rating === undefined) return 'dim';
  if (rating >= 7) return 'haute';
  if (rating < 5.5) return 'basse';
  return '';
}

const LINE_LABEL: Record<LineFilter, string> = {
  ALL: 'Tout l\'effectif',
  AVANTS: 'Avants',
  DEMIS: 'Demis',
  TROIS_QUARTS: 'Trois-quarts',
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  ALL: 'Tous',
  DISPO: 'Disponibles',
  INDISPO: 'Indisponibles',
  JIFF: 'JIFF',
  JEUNES: 'Moins de 23 ans',
};

function ageOf(p: Player, season: number): number {
  return season - Number(p.birthDate.slice(0, 4));
}

/** Condition physique : l'inverse de la fatigue, plus parlant pour le manager. */
function conditionOf(p: Player): number {
  return 100 - p.dynamic.fatigue;
}

interface Row {
  readonly player: Player;
  readonly age: number;
  readonly condition: number;
  readonly mood: number;
  readonly minutes: number;
  readonly matches: number;
  readonly potentialPoint: number;
  readonly potentialDisplay: string;
  /** V0.35 — rôle où ses qualités servent le mieux. Absent si le poste n'en propose aucun. */
  readonly naturalRole: RoleDefinition | undefined;
  readonly unavailable: string | undefined;
  /** V0.50 — rôle annoncé par le manager, et ce que le joueur en pense. */
  readonly status: SquadStatus;
  readonly statusVerdict: StatusVerdict;
  /** V0.61 — ce que la saison a produit, pour la vue statistiques. */
  readonly stat: SeasonPlayerStat | undefined;
  readonly rating: number | undefined;
}

export function SquadScreen({
  players, currentSeason, recentResults, playRatioByPlayer, relations,
  seasonStats, scouting, currentRound, captainId,
  squadStatuses, onSetStatus, onSelectPlayer, onBack,
}: Props) {
  const [line, setLine] = useState<LineFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'poste', desc: false });
  const [vue, setVue] = useState<Vue>('EFFECTIF');
  const [query, setQuery] = useState('');

  const active = useMemo(
    () => players.filter(p => !p.retired && !p.freeAgent),
    [players],
  );

  const rows: readonly Row[] = useMemo(() => active.map(player => {
    const relationsFactors = computeRelationsForMood(relations, player.id);
    const playRatio = playRatioByPlayer.get(player.id as string) ?? 0.5;
    const status = statusOf(squadStatuses ?? new Map(), player, playRatio, currentSeason);
    const mood = computeMood({
      player,
      recentResults,
      playRatio,
      currentSeason,
      currentRound,
      relationsFactors,
      isCaptain: player.id === captainId,
      squadStatus: status,
    }).mood;
    const statusVerdict = judgeStatus(
      status, playRatio, player.traits as readonly string[],
    ).verdict;

    const stat = seasonStats.get(player.id);
    const familiarity = scouting.knowledge.get(player.id)?.familiarity ?? 0;
    const potential = estimatePotential(player, familiarity, currentSeason);

    const injury = player.dynamic.injury;
    const suspended = player.dynamic.suspendedUntilRound !== undefined
      && player.dynamic.suspendedUntilRound > currentRound;
    const unavailable = injury
      ? `Blessé — ${injury.type.toLowerCase()}`
      : suspended
        ? `Suspendu jusqu'à J${player.dynamic.suspendedUntilRound}`
        : undefined;

    return {
      player,
      age: ageOf(player, currentSeason),
      condition: conditionOf(player),
      mood,
      minutes: stat?.minutes ?? 0,
      matches: stat?.matches ?? 0,
      potentialPoint: potential.point,
      potentialDisplay: potential.display,
      // V0.35 — profil naturel : le rôle où ses qualités servent le mieux.
      naturalRole: roleFitness(player)[0]?.role,
      unavailable,
      status,
      statusVerdict,
      stat,
      rating: averageRating(stat),
    };
  }), [active, relations, recentResults, playRatioByPlayer, currentSeason, seasonStats,
    scouting, currentRound, captainId, squadStatuses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (line !== 'ALL' && POSITION_LINE[r.player.position] !== line) return false;
      if (status === 'DISPO' && r.unavailable) return false;
      if (status === 'INDISPO' && !r.unavailable) return false;
      if (status === 'JIFF' && !r.player.isJiff) return false;
      if (status === 'JEUNES' && r.age > 23) return false;
      if (q && !`${r.player.firstName} ${r.player.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, line, status, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sort.desc ? -1 : 1;
    copy.sort((a, b) => {
      switch (sort.key) {
        case 'nom': return dir * a.player.lastName.localeCompare(b.player.lastName);
        case 'age': return dir * (a.age - b.age);
        case 'condition': return dir * (a.condition - b.condition);
        case 'forme': return dir * (a.player.dynamic.forme - b.player.dynamic.forme);
        case 'mood': return dir * (a.mood - b.mood);
        case 'minutes': return dir * (a.minutes - b.minutes);
        case 'potentiel': return dir * (a.potentialPoint - b.potentialPoint);
        // Trier par profil regroupe les joueurs de même rôle : c'est ainsi
        // qu'on repère d'un coup d'œil qu'on n'a aucun gratteur dans l'effectif.
        case 'profil': return dir * (a.naturalRole?.label ?? '').localeCompare(b.naturalRole?.label ?? '');
        // V0.61 — les colonnes de la vue statistiques. Un joueur sans note
        // passe derrière tout le monde plutôt que devant : il n'a pas joué.
        case 'note': return dir * ((a.rating ?? -1) - (b.rating ?? -1));
        case 'matchs': return dir * (a.matches - b.matches);
        case 'essais': return dir * ((a.stat?.tries ?? 0) - (b.stat?.tries ?? 0));
        case 'metres': return dir * ((a.stat?.meters ?? 0) - (b.stat?.meters ?? 0));
        case 'plaquages': return dir * ((a.stat?.tackles ?? 0) - (b.stat?.tackles ?? 0));
        case 'grattages': return dir * ((a.stat?.turnovers ?? 0) - (b.stat?.turnovers ?? 0));
        case 'battus': return dir * ((a.stat?.defendersBeaten ?? 0) - (b.stat?.defendersBeaten ?? 0));
        case 'franchis': return dir * ((a.stat?.lineBreaks ?? 0) - (b.stat?.lineBreaks ?? 0));
        case 'poste':
        default:
          return dir * (Number(positionNumber(a.player.position)) - Number(positionNumber(b.player.position)));
      }
    });
    return copy;
  }, [filtered, sort]);

  // --- Bandeau de synthèse -------------------------------------------------
  const jiff = useMemo(() => computeClubJiffStats(active), [active]);
  const avgAge = active.length > 0
    ? (active.reduce((a, p) => a + ageOf(p, currentSeason), 0) / active.length).toFixed(1)
    : '—';
  const unavailableCount = rows.filter(r => r.unavailable).length;
  const payroll = active.reduce((a, p) => a + p.contract.annualSalary, 0);

  const toggleSort = (key: SortKey): void => {
    setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'nom' && key !== 'poste' }));
  };

  const sortMark = (key: SortKey): string => (sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : '');

  return (
    <section className="squad-screen">
      <div className="screen-head">
        <h2>Vestiaire</h2>
        {onBack && <button onClick={onBack} type="button" className="ghost">← Retour</button>}
      </div>

      {/* Synthèse d'effectif : ce qu'un manager veut savoir en arrivant. */}
      <div className="squad-summary">
        <div className="ss-item">
          <span className="ss-value">{active.length}</span>
          <span className="ss-label">joueurs</span>
        </div>
        <div className="ss-item">
          <span className="ss-value">{avgAge}</span>
          <span className="ss-label">âge moyen</span>
        </div>
        <div className={`ss-item ${jiff.belowThreshold ? 'warn' : ''}`}>
          <span className="ss-value">{jiff.jiffCount}</span>
          <span className="ss-label">
            JIFF {jiff.belowThreshold ? `· il en manque ${jiff.shortfall}` : '· quota tenu'}
          </span>
        </div>
        <div className={`ss-item ${unavailableCount > 3 ? 'warn' : ''}`}>
          <span className="ss-value">{unavailableCount}</span>
          <span className="ss-label">indisponibles</span>
        </div>
        <div className="ss-item">
          <span className="ss-value">{(payroll / 1_000_000).toFixed(1)}<span className="ss-unit">M€</span></span>
          <span className="ss-label">masse salariale</span>
        </div>
      </div>

      {/* Filtres */}
      <div className="squad-toolbar">
        <div className="filter-group">
          {(['ALL', 'AVANTS', 'DEMIS', 'TROIS_QUARTS'] as LineFilter[]).map(l => (
            <button
              key={l}
              type="button"
              className={`filter-chip ${line === l ? 'active' : ''}`}
              onClick={() => setLine(l)}
            >
              {LINE_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {(['ALL', 'DISPO', 'INDISPO', 'JIFF', 'JEUNES'] as StatusFilter[]).map(st => (
            <button
              key={st}
              type="button"
              className={`filter-chip small ${status === st ? 'active' : ''}`}
              onClick={() => setStatus(st)}
            >
              {STATUS_LABEL[st]}
            </button>
          ))}
        </div>
        <input
          className="squad-search"
          type="search"
          placeholder="Rechercher un joueur…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {/* V0.61 — la même liste, lue autrement : de quoi je dispose, puis qui
            produit. Deux questions différentes, deux jeux de colonnes. */}
        <div className="squad-view-switch">
          {([['EFFECTIF', 'Effectif'], ['STATISTIQUES', 'Statistiques']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={vue === v ? 'active' : ''}
              onClick={() => {
                setVue(v);
                setSort(v === 'STATISTIQUES' ? { key: 'note', desc: true } : { key: 'poste', desc: false });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau dense */}
      <div className="squad-table-wrap">
        <table className="squad-table">
          <thead>
            <tr>
              <th className="c-pos sortable" onClick={() => toggleSort('poste')}>Poste{sortMark('poste')}</th>
              <th className="c-name sortable" onClick={() => toggleSort('nom')}>Joueur{sortMark('nom')}</th>
              {vue === 'EFFECTIF' ? (
                <>
                  <th className="sortable num-head" onClick={() => toggleSort('age')}>Âge{sortMark('age')}</th>
                  <th className="c-attrs">Points forts</th>
                  <th className="c-role sortable" onClick={() => toggleSort('profil')}>Profil{sortMark('profil')}</th>
                  <th className="c-status">Rôle annoncé</th>
                  <th className="sortable" onClick={() => toggleSort('condition')}>Condition{sortMark('condition')}</th>
                  <th className="sortable" onClick={() => toggleSort('forme')}>Forme{sortMark('forme')}</th>
                  <th className="sortable" onClick={() => toggleSort('mood')}>Moral{sortMark('mood')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('minutes')}>Minutes{sortMark('minutes')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('potentiel')}>Potentiel{sortMark('potentiel')}</th>
                </>
              ) : (
                <>
                  <th className="sortable num-head" onClick={() => toggleSort('note')} title="Note moyenne sur 10, calculée sur les seuls matchs notés. 6 est la médiane du poste, 7,5 le neuvième décile.">Note{sortMark('note')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('matchs')}>Matchs{sortMark('matchs')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('minutes')}>Minutes{sortMark('minutes')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('essais')}>Essais{sortMark('essais')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('metres')} title="Mètres gagnés balle en main">Mètres{sortMark('metres')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('battus')} title="Défenseurs battus">Battus{sortMark('battus')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('franchis')} title="Franchissements du rideau défensif">Franchis.{sortMark('franchis')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('plaquages')}>Plaquages{sortMark('plaquages')}</th>
                  <th className="sortable num-head" onClick={() => toggleSort('grattages')} title="Ballons grattés">Grattages{sortMark('grattages')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr
                key={row.player.id}
                className={row.unavailable ? 'unavailable' : ''}
                onClick={() => onSelectPlayer(row.player)}
                title={row.unavailable ?? 'Voir la fiche'}
              >
                <td className="c-pos"><PositionBadge position={row.player.position} /></td>
                <td className="c-name">
                  <span className="sq-name">{row.player.firstName} {row.player.lastName}</span>
                  <span className="sq-tags">
                    {/* V0.50 — le brassard se voit dans la liste : c'est un
                        statut, pas un réglage d'avant-match. */}
                    {row.player.id === captainId && (
                      <span className="sq-tag captain" title="Capitaine">C</span>
                    )}
                    {row.player.isJiff && <span className="sq-tag jiff">JIFF</span>}
                    {row.unavailable && <span className="sq-tag out">{row.unavailable}</span>}
                  </span>
                </td>
                {vue === 'EFFECTIF' ? (
                  <>
                    <td className="num">{row.age}</td>
                    <td className="c-attrs">
                      <KeyAttributes attributes={keyAttributesFor(row.player as never)} />
                    </td>
                    <td className="c-role">
                      {row.naturalRole
                        ? <span className="sq-role" title={row.naturalRole.description}>{row.naturalRole.label}</span>
                        : <span className="sq-role none">—</span>}
                    </td>
                    {/* V0.50 — le rôle s'annonce ici, là où l'on regarde son
                        effectif. Le pastille dit ce que le joueur en pense. */}
                    <td className="c-status" onClick={e => e.stopPropagation()}>
                      <select
                        className={`sq-status ${row.statusVerdict.toLowerCase()}`}
                        value={row.status}
                        disabled={onSetStatus === undefined}
                        onChange={e => onSetStatus?.(row.player.id, e.target.value as SquadStatus)}
                        title={STATUS_DESCRIPTION[row.status]}
                      >
                        {(['CADRE', 'ROTATION', 'ESPOIR', 'HORS_PROJET'] as const).map(st => (
                          <option key={st} value={st}>{ROLE_LABEL[st]}</option>
                        ))}
                      </select>
                    </td>
                    <td><Meter value={row.condition} label="Condition" /></td>
                    <td><Meter value={row.player.dynamic.forme} label="Forme" /></td>
                    <td><Meter value={row.mood} label="Moral" /></td>
                    <td className="num">
                      {row.minutes > 0 ? row.minutes : '—'}
                      {row.matches > 0 && <span className="sq-sub">{row.matches} m</span>}
                    </td>
                    <td className="num potential">{row.potentialDisplay}</td>
                  </>
                ) : (
                  <>
                    <td className={`num sq-note ${noteClass(row.rating)}`}>
                      {row.rating?.toFixed(1) ?? '—'}
                    </td>
                    <td className="num">{row.matches || '—'}</td>
                    <td className="num">{row.minutes || '—'}</td>
                    <td className="num">{row.stat?.tries || '—'}</td>
                    <td className="num">{row.stat?.meters ? Math.round(row.stat.meters) : '—'}</td>
                    <td className="num">{row.stat?.defendersBeaten || '—'}</td>
                    <td className="num">{row.stat?.lineBreaks || '—'}</td>
                    <td className="num">{row.stat?.tackles || '—'}</td>
                    <td className="num">{row.stat?.turnovers || '—'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <p className="squad-empty">Aucun joueur ne correspond à ces filtres.</p>
        )}
      </div>
    </section>
  );
}

/** Réexport utilitaire — d'autres écrans classent par poste. */
export function positionLineOf(p: Position): PositionLine {
  return POSITION_LINE[p];
}
