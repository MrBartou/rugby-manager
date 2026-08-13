/**
 * Actualités du championnat — V0.40.
 *
 * Le journal existait depuis V0.38, coincé en bas de l'écran Compétition sous
 * la forme d'un tableau. Il occupe désormais son propre onglet et adopte la
 * présentation d'un fil social : chaque événement est un message publié par un
 * compte, avec son auteur, son horodatage et son fil de discussion.
 *
 * ## Pourquoi cette forme
 *
 * Une liste de lignes se lit comme un relevé comptable. Un fil se **parcourt** :
 * l'œil accroche l'avatar, le nom du club, puis la phrase. C'est ce qui donne
 * l'impression d'un championnat qui vit plutôt que d'un tableau qui se remplit.
 *
 * ## Les comptes
 *
 * Ce qui touche un club précis est publié **par ce club** ; le reste vient de
 * la rédaction. Attribuer tout à une source unique aplatirait le fil, et les
 * blasons sont le repère le plus rapide pour savoir qui parle.
 */

import { useMemo, useState } from 'react';
import {
  NEWS_KIND_LABEL,
  filterNews,
  seasonsInFeed,
  type NewsFeed,
  type NewsItem,
  type NewsKind,
} from '../../engine/season/news.js';
import type { PlayerId } from '../../engine/types.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { readableAccent } from '../theme/club-identity.js';

interface Props {
  readonly feed: NewsFeed;
  readonly currentSeason: number;
  readonly currentRound: number;
  readonly playerClubId: string;
  readonly clubName: (clubId: string) => string;
  readonly clubShortName: (clubId: string) => string;
  /**
   * V0.61 — le fil devient un point de départ.
   *
   * On y lisait « Untel out jusqu'à la J18 » et il fallait retrouver le joueur à
   * la main dans l'effectif. Le club auteur et, quand l'entrée en désigne un, le
   * joueur concerné s'ouvrent directement.
   */
  readonly onSelectClub?: (clubId: string) => void;
  readonly onSelectPlayer?: (playerId: PlayerId) => void;
}

const KINDS: readonly NewsKind[] = ['TRANSFERT', 'MERCATO', 'BLESSURE', 'RESULTAT', 'SAISON'];

/** Compte de la rédaction, pour tout ce qui ne relève pas d'un club. */
const DESK = { name: 'Le Quinze Info', handle: '@lequinze' };

/**
 * Ancienneté d'une entrée, dans le registre d'un fil social.
 *
 * On compte en journées de championnat, pas en heures : c'est l'unité de temps
 * du jeu, et « il y a 3 j » se lit exactement comme sur un vrai fil.
 */
function elapsed(item: NewsItem, season: number, round: number): string {
  if (item.season !== season) {
    const seasons = season - item.season;
    return `${seasons} saison${seasons > 1 ? 's' : ''}`;
  }
  if (item.round === 0) return 'intersaison';
  const delta = round - item.round;
  if (delta <= 0) return 'à l\'instant';
  return `${delta} j`;
}

export function NewsScreen({
  feed, currentSeason, currentRound, playerClubId, clubName, clubShortName,
  onSelectClub, onSelectPlayer,
}: Props) {
  const [kind, setKind] = useState<NewsKind | 'ALL'>('ALL');
  const [mineOnly, setMineOnly] = useState(false);
  const [season, setSeason] = useState<number | 'ALL'>('ALL');

  const seasons = useMemo(() => seasonsInFeed(feed), [feed]);
  const items = useMemo(() => filterNews(feed, {
    ...(kind !== 'ALL' ? { kind } : {}),
    ...(season !== 'ALL' ? { season } : {}),
    mineOnly,
  }), [feed, kind, season, mineOnly]);

  return (
    <section className="news-screen">
      <div className="screen-head">
        <h2>Actualités</h2>
        <span className="screen-head-meta">
          {items.length} publication{items.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre de filtres, en tête de fil comme les onglets d'un réseau. */}
      <div className="feed-filters">
        <div className="filter-group">
          <button type="button" className={`filter-chip small ${kind === 'ALL' ? 'active' : ''}`} onClick={() => setKind('ALL')}>
            Tout
          </button>
          {KINDS.map(k => (
            <button
              key={k}
              type="button"
              className={`filter-chip small ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {NEWS_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`filter-chip small ${mineOnly ? 'active' : ''}`}
          onClick={() => setMineOnly(v => !v)}
        >
          Mon club
        </button>

        {seasons.length > 1 && (
          <select
            className="feed-season"
            value={season === 'ALL' ? '' : String(season)}
            onChange={e => setSeason(e.target.value === '' ? 'ALL' : Number(e.target.value))}
          >
            <option value="">Toutes saisons</option>
            {seasons.map(s => (
              <option key={s} value={s}>{s}-{String(s + 1).slice(-2)}</option>
            ))}
          </select>
        )}
      </div>

      {items.length === 0 && (
        <div className="feed-empty">
          <p>Rien à signaler pour l'instant.</p>
          <p className="fe-sub">
            Le fil se remplit au fil des journées, des mercatos et des blessures.
          </p>
        </div>
      )}

      <ol className="feed">
        {items.map(item => {
          const authorId = item.clubId as string | undefined;
          const author = authorId
            // Un pseudo ne contient ni espace ni accent : « @la rochelle » se
            // lisait comme une faute plutôt que comme un compte.
            ? {
              name: clubName(authorId),
              handle: `@${clubShortName(authorId).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s]/g, '')}`,
            }
            : DESK;
          // Couleur du club, corrigée pour rester lisible sur fond sombre.
          const accent = authorId ? readableAccent(authorId) : undefined;

          return (
            <li
              key={item.id}
              className={`post ${item.involvesPlayer ? 'mine' : ''}`}
              {...(accent ? { style: { ['--post-accent' as string]: accent } } : {})}
            >
              <div
                className={`post-avatar ${authorId && onSelectClub ? 'clickable' : ''}`}
                onClick={authorId && onSelectClub ? () => onSelectClub(authorId) : undefined}
                title={authorId && onSelectClub ? 'Voir la fiche du club' : undefined}
              >
                {authorId
                  ? <ClubCrest clubId={authorId} initials={clubShortName(authorId)} size={38} />
                  : <span className="desk-avatar" aria-hidden>15</span>}
              </div>

              <div className="post-body">
                <div className="post-meta">
                  <span className="pm-name">{author.name}</span>
                  {item.involvesPlayer && authorId === playerClubId && (
                    <span className="pm-badge">vous</span>
                  )}
                  <span className="pm-handle">{author.handle}</span>
                  <span className="pm-dot">·</span>
                  <span className="pm-time">{elapsed(item, currentSeason, currentRound)}</span>
                  <span className={`pm-kind k-${item.kind.toLowerCase()}`}>
                    {NEWS_KIND_LABEL[item.kind]}
                  </span>
                </div>

                <p className="post-text">
                  {item.headline}
                  {item.playerId && onSelectPlayer && (
                    <button
                      type="button"
                      className="post-link"
                      onClick={() => onSelectPlayer(item.playerId!)}
                    >
                      voir la fiche
                    </button>
                  )}
                </p>

                {/* Le détail chiffré prend la forme d'une carte jointe : c'est ce
                    qui le distingue du corps du message sans l'enterrer. */}
                {item.detail && (
                  <div className="post-card">
                    <span className="pc-label">
                      {item.round > 0 ? `Journée ${item.round}` : 'Intersaison'}
                      {item.season !== currentSeason && ` · ${item.season}-${String(item.season + 1).slice(-2)}`}
                    </span>
                    <span className="pc-value">{item.detail}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
