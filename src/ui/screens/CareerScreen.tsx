/**
 * Ma carrière — V0.42.
 *
 * La carrière du manager existait en pièces détachées : une réputation dans un
 * coin du tableau de bord, un objectif dans le bandeau, un limogeage dans le
 * fil d'actualité du championnat, des offres dans une modale qui ne durait
 * qu'un clic. Rien ne réunissait tout cela, et rien n'en gardait la trace.
 *
 * ## Trois manières de regarder la même chose
 *
 *  - la **messagerie** dit ce qu'on attend de vous, maintenant ;
 *  - le **parcours** dit d'où vous venez, saison par saison ;
 *  - le **palmarès** dit ce qu'il en reste.
 *
 * Le bandeau d'identité, lui, reste affiché quel que soit l'onglet : c'est la
 * seule information dont on a besoin en permanence — qui vous êtes, où vous
 * êtes, et ce que le board pense de vous.
 */

import { useMemo, useState } from 'react';
import {
  SENDERS,
  effectOf,
  filterMails,
  seasonsInMailbox,
  unreadCount,
  type Mail,
  type MailSender,
  type Mailbox,
} from '../../engine/season/mailbox.js';
import { contractSummary, type ManagerContract } from '../../engine/season/contract-negotiation.js';
import {
  VERDICT_LABEL,
  bestSeason,
  careerTotals,
  clubSpells,
  reputationCurve,
  worstSeason,
  type ManagerCareer,
} from '../../engine/season/manager-record.js';
import { reputationLabel, type ManagerReputation } from '../../engine/season/manager-reputation.js';
import { boardConfidenceLabel, type BoardConfidence, type SeasonObjective } from '../../engine/season/board-objective.js';
import type { ManagerStatus } from '../../engine/season/manager-career.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { europeanRollOfHonour, type EuropeanWorld } from '../../engine/season/european-world.js';
import { COMPETITION_LABEL } from '../../engine/season/european-cup.js';

interface Props {
  readonly career: ManagerCareer;
  readonly mailbox: Mailbox;
  readonly reputation: ManagerReputation;
  readonly status: ManagerStatus;
  readonly confidence: BoardConfidence;
  readonly objective: SeasonObjective | null;
  readonly currentSeason: number;
  readonly clubName: (clubId: string) => string;
  readonly clubShortName: (clubId: string) => string;
  readonly onReadMail: (id: string) => void;
  readonly onAnswerMail: (mailId: string, actionId: string) => void;
  readonly onMarkAllRead: () => void;
  /** V0.43 — contrat en cours, absent pour une carrière antérieure. */
  readonly contract?: ManagerContract;
  /**
   * V0.48 — ce que le président demande **en plus** du classement.
   *
   * Affiché en permanence : une exigence qu'on ne relit qu'au bilan de fin de
   * saison n'infléchit aucune décision en cours de route.
   */
  readonly expectations?: readonly { readonly wording: string }[];
  /**
   * V0.53 — le classement des entraîneurs du championnat, vous compris.
   *
   * Sans lui, la réputation reste un nombre isolé sur une fiche. Avec lui, elle
   * devient un rang — et un rang, on cherche à le monter.
   */
  readonly peers?: readonly {
    readonly name: string;
    readonly reputation: number;
    readonly clubName: string | undefined;
    readonly isPlayer: boolean;
  }[];
  /**
   * V0.63 : le palmarès européen, saison par saison.
   *
   * L'Europe désignait un vainqueur les seules années où le club dirigé y
   * jouait, et l'oubliait aussitôt. Une carrière de dix ans peut désormais dire
   * qui a dominé le continent pendant qu'on montait son club.
   */
  readonly europeanWorld?: EuropeanWorld;
}

type Tab = 'mails' | 'parcours' | 'palmares' | 'confreres';

const TAB_LABEL: Readonly<Record<Tab, string>> = {
  mails: 'Messagerie',
  parcours: 'Parcours',
  palmares: 'Palmarès',
  confreres: 'Confrères',
};

function seasonLabel(season: number): string {
  return `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
}

/** Rang à la française : premier s'abrège « 1ᵉʳ », les autres « ᵉ ». */
function rankLabel(rank: number): string {
  return rank === 1 ? '1ᵉʳ' : `${rank}ᵉ`;
}

export function CareerScreen({
  career, mailbox, reputation, status, confidence, objective, currentSeason,
  clubName, clubShortName, onReadMail, onAnswerMail, onMarkAllRead, contract, expectations, peers,
  europeanWorld,
}: Props) {
  const [tab, setTab] = useState<Tab>('mails');
  const unread = unreadCount(mailbox);
  const totals = useMemo(() => careerTotals(career), [career]);

  return (
    <section className="screen career-screen">
      <ManagerIdentity
        career={career}
        reputation={reputation}
        status={status}
        confidence={confidence}
        objective={objective}
        currentSeason={currentSeason}
        totals={totals}
        clubName={clubName}
        clubShortName={clubShortName}
        {...(contract ? { contract } : {})}
        {...(expectations && expectations.length > 0 ? { expectations } : {})}
      />

      <div className="career-tabs" role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map(key => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`career-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {TAB_LABEL[key]}
            {key === 'mails' && unread > 0 && <span className="career-tab-badge">{unread}</span>}
          </button>
        ))}
      </div>

      {tab === 'mails' && (
        <MailView
          mailbox={mailbox}
          clubShortName={clubShortName}
          onReadMail={onReadMail}
          onAnswerMail={onAnswerMail}
          onMarkAllRead={onMarkAllRead}
        />
      )}
      {tab === 'parcours' && (
        <JourneyView career={career} clubShortName={clubShortName} />
      )}
      {tab === 'palmares' && (
        <>
          <HonoursView career={career} totals={totals} clubShortName={clubShortName} />
          {europeanWorld && <EuropeanHonoursView world={europeanWorld} />}
        </>
      )}
      {tab === 'confreres' && <PeersView peers={peers ?? []} />}
    </section>
  );
}

// =============================================================================
// Le palmarès européen
// =============================================================================

/**
 * V0.63 : ce que l'Europe a donné pendant la carrière.
 *
 * Deux lectures : les finales année par année, et le classement des clubs par
 * titres. La seconde est celle qui compte au bout de dix saisons : c'est elle
 * qui dit lequel était le grand club de la décennie, et si on en fait partie.
 */
function EuropeanHonoursView({ world }: { readonly world: EuropeanWorld }) {
  if (world.honours.length === 0) {
    return (
      <div className="honours-spells">
        <h3>Coupes d'Europe</h3>
        <p className="career-empty">
          Aucune finale européenne disputée depuis le début de la carrière.
        </p>
      </div>
    );
  }

  const roll = europeanRollOfHonour(world).slice(0, 8);
  const finales = [...world.honours].reverse().slice(0, 12);

  return (
    <div className="honours-spells">
      <h3>Coupes d'Europe</h3>
      <table className="peers-table">
        <thead>
          <tr>
            <th>Saison</th>
            <th>Compétition</th>
            <th>Vainqueur</th>
            <th>Finaliste</th>
          </tr>
        </thead>
        <tbody>
          {finales.map((h, i) => (
            <tr key={`${h.season}_${h.competition}_${i}`} className={h.frenchWinner ? 'is-player' : ''}>
              <td>{seasonLabel(h.season)}</td>
              <td>{COMPETITION_LABEL[h.competition]}</td>
              <td>{h.winnerName}</td>
              <td className="peers-club">{h.runnerUpName}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Les clubs qui comptent</h3>
      <table className="peers-table">
        <thead>
          <tr>
            <th className="num-head">#</th>
            <th>Club</th>
            <th className="num-head">Coupes d'Europe</th>
            <th className="num-head">Challenges</th>
          </tr>
        </thead>
        <tbody>
          {roll.map((row, i) => (
            <tr key={`${row.name}_${i}`}>
              <td className="num">{i + 1}</td>
              <td>{row.name}</td>
              <td className="num">{row.titles > 0 ? row.titles : '-'}</td>
              <td className="num">{row.challenges > 0 ? row.challenges : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Les confrères
// =============================================================================

/**
 * V0.53 — où l'on se situe parmi les entraîneurs du championnat.
 *
 * Le rang est ce qui donne sa valeur à la réputation : « 62 » ne veut rien
 * dire, « neuvième sur seize » se comprend d'un coup d'œil.
 */
function PeersView({ peers }: {
  readonly peers: readonly {
    readonly name: string;
    readonly reputation: number;
    readonly clubName: string | undefined;
    readonly isPlayer: boolean;
  }[];
}) {
  if (peers.length === 0) {
    return (
      <div className="career-empty">
        Le championnat n'a pas encore de corps d'entraîneurs.
      </div>
    );
  }

  return (
    <div className="peers-view">
      <table className="peers-table">
        <thead>
          <tr>
            <th className="num-head">#</th>
            <th>Entraîneur</th>
            <th>Club</th>
            <th className="num-head">Réputation</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((row, i) => (
            <tr key={`${row.name}_${i}`} className={row.isPlayer ? 'is-player' : ''}>
              <td className="num">{i + 1}</td>
              <td>{row.name}</td>
              <td className="peers-club">{row.clubName ?? 'Sans club'}</td>
              <td className="num">{row.reputation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Bandeau d'identité
// =============================================================================

function ManagerIdentity({
  career, reputation, status, confidence, objective, currentSeason, totals,
  clubName, clubShortName, contract, expectations,
}: {
  readonly career: ManagerCareer;
  readonly reputation: ManagerReputation;
  readonly status: ManagerStatus;
  readonly confidence: BoardConfidence;
  readonly objective: SeasonObjective | null;
  readonly currentSeason: number;
  readonly totals: ReturnType<typeof careerTotals>;
  readonly clubName: (clubId: string) => string;
  readonly clubShortName: (clubId: string) => string;
  readonly contract?: ManagerContract;
  readonly expectations?: readonly { readonly wording: string }[];
}) {
  const enPoste = status.kind === 'EN_POSTE';
  const clubId = enPoste ? (status.clubId as string) : undefined;
  const seasonsAtClub = clubId
    ? career.seasons.filter(s => (s.clubId as string) === clubId).length
    : 0;

  return (
    <div className="career-identity">
      <div className="ci-avatar">
        {clubId
          ? <ClubCrest clubId={clubId} initials={clubShortName(clubId)} size={56} />
          : <div className="ci-noclub" aria-hidden>—</div>}
      </div>

      <div className="ci-main">
        <span className="ci-title">{reputationLabel(reputation.score)}</span>
        <span className="ci-club">
          {enPoste
            ? `${clubName(clubId!)} · ${seasonsAtClub === 0 ? 'première saison' : `${seasonsAtClub + 1}ᵉ saison`}`
            : `Sans club depuis ${seasonLabel(status.since)}`}
        </span>

        <div className="ci-gauge">
          <div className="ci-gauge-head">
            <span>Réputation</span>
            <strong>{reputation.score}/100</strong>
          </div>
          <div className="ci-bar"><div className="ci-bar-fill" style={{ width: `${reputation.score}%` }} /></div>
        </div>

        {/* La confiance du board n'a de sens qu'en poste : un manager libre
            n'a plus de président pour la lui accorder ou la lui retirer. */}
        {enPoste && (
          <div className="ci-gauge">
            <div className="ci-gauge-head">
              <span>Confiance du board</span>
              <strong className={confidence.score < 30 ? 'warn' : ''}>
                {confidence.score}/100 — {boardConfidenceLabel(confidence.score)}
              </strong>
            </div>
            <div className="ci-bar">
              <div
                className={`ci-bar-fill ${confidence.score < 30 ? 'danger' : ''}`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ul className="ci-stats">
        <li><span>Saisons</span><strong>{totals.seasons}</strong></li>
        <li><span>Brennus</span><strong>{totals.titles}</strong></li>
        <li><span>Clubs</span><strong>{totals.clubsManaged}</strong></li>
        <li><span>Objectifs tenus</span><strong>{totals.successRate}%</strong></li>
      </ul>

      {enPoste && objective && (
        <div className="ci-objective">
          <span className="ci-objective-label">Mission {seasonLabel(currentSeason)}</span>
          <span className="ci-objective-value">{objective.label}</span>
          {contract && <span className="ci-contract">{contractSummary(contract)}</span>}
        </div>
      )}

      {enPoste && expectations && expectations.length > 0 && (
        <div className="ci-expectations">
          <span className="ci-objective-label">Aussi demandé</span>
          <ul>
            {expectations.map(e => <li key={e.wording}>{e.wording}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Messagerie
// =============================================================================

const SENDER_KEYS = Object.keys(SENDERS) as MailSender[];

function MailView({
  mailbox, clubShortName, onReadMail, onAnswerMail, onMarkAllRead,
}: {
  readonly mailbox: Mailbox;
  readonly clubShortName: (clubId: string) => string;
  readonly onReadMail: (id: string) => void;
  readonly onAnswerMail: (mailId: string, actionId: string) => void;
  readonly onMarkAllRead: () => void;
}) {
  const [sender, setSender] = useState<MailSender | 'ALL'>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [season, setSeason] = useState<number | 'ALL'>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);

  const seasons = seasonsInMailbox(mailbox);
  const mails = filterMails(mailbox, {
    ...(sender !== 'ALL' ? { sender } : {}),
    ...(unreadOnly ? { unreadOnly: true } : {}),
    ...(season !== 'ALL' ? { season } : {}),
  });

  // Le message ouvert peut disparaître d'un changement de filtre ; on retombe
  // alors sur le premier de la liste plutôt que sur un panneau vide.
  const open = mails.find(m => m.id === openId) ?? mails[0];

  const openMail = (mail: Mail): void => {
    setOpenId(mail.id);
    if (!mail.read) onReadMail(mail.id);
  };

  if (mailbox.mails.length === 0) {
    return (
      <p className="career-empty">
        Votre boîte est vide. Le président vous écrira dès qu'il aura fixé une mission.
      </p>
    );
  }

  return (
    <div className="mail-view">
      <div className="mail-filters">
        <select value={sender} onChange={e => setSender(e.target.value as MailSender | 'ALL')}>
          <option value="ALL">Tous les expéditeurs</option>
          {SENDER_KEYS.map(k => <option key={k} value={k}>{SENDERS[k].label}</option>)}
        </select>
        <select
          value={season === 'ALL' ? 'ALL' : String(season)}
          onChange={e => setSeason(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
        >
          <option value="ALL">Toutes les saisons</option>
          {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
        </select>
        <button
          type="button"
          className={`mail-toggle ${unreadOnly ? 'active' : ''}`}
          onClick={() => setUnreadOnly(v => !v)}
        >
          Non lus
        </button>
        <button type="button" className="mail-toggle" onClick={onMarkAllRead}>
          Tout marquer comme lu
        </button>
      </div>

      <div className="mail-layout">
        <ul className="mail-list">
          {mails.length === 0 && <li className="mail-none">Aucun message ne correspond.</li>}
          {mails.map(m => {
            const id = SENDERS[m.sender];
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className={`mail-row ${m.read ? '' : 'unread'} ${open?.id === m.id ? 'selected' : ''}`}
                  onClick={() => openMail(m)}
                >
                  <span className="mail-avatar" aria-hidden>
                    {m.clubId
                      ? <ClubCrest clubId={m.clubId as string} initials={clubShortName(m.clubId as string)} size={32} />
                      : <span className="mail-initials">{id.initials}</span>}
                  </span>
                  <span className="mail-row-text">
                    <span className="mail-row-head">
                      <span className="mail-from">{id.label}</span>
                      <span className="mail-date">
                        {seasonLabel(m.season)}{m.round > 0 ? ` · J${m.round}` : ' · intersaison'}
                      </span>
                    </span>
                    <span className="mail-subject">
                      {m.importance === 'HAUTE' && <span className="mail-flag" title="Important">!</span>}
                      {m.subject}
                    </span>
                  </span>
                  {m.actions && m.answeredWith === undefined
                    ? <span className="mail-todo" title="Réponse attendue">↩</span>
                    : !m.read && <span className="mail-dot" aria-label="Non lu" />}
                </button>
              </li>
            );
          })}
        </ul>

        {open && (
          <article className="mail-reader">
            <header className="mail-reader-head">
              <h3>{open.subject}</h3>
              <p className="mail-reader-from">
                <strong>{SENDERS[open.sender].label}</strong>
                <span> · {SENDERS[open.sender].role}</span>
                <span className="mail-date">
                  {' · '}{seasonLabel(open.season)}{open.round > 0 ? ` · J${open.round}` : ' · intersaison'}
                </span>
              </p>
            </header>
            {open.body.split('\n\n').map((para, i) => (
              <p key={i} className="mail-para">{para}</p>
            ))}

            {/* V0.43 — certains messages appellent une réponse. Chaque option
                annonce ce qu'elle engage : répondre à l'aveugle ne serait pas
                un choix. */}
            {open.actions && open.answeredWith === undefined && (
              <div className="mail-actions">
                {open.actions.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className="mail-action"
                    onClick={() => onAnswerMail(open.id, a.id)}
                  >
                    <span className="ma-label">{a.label}</span>
                    <span className="ma-hint">{a.hint}</span>
                  </button>
                ))}
              </div>
            )}

            {open.answeredWith !== undefined && (
              <div className="mail-answered">
                <span className="ma-chosen">
                  Vous avez répondu : {open.actions?.find(a => a.id === open.answeredWith)?.label ?? '—'}
                </span>
                <p className="mail-para">{effectOf(open.answeredWith).reply}</p>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Parcours
// =============================================================================

function JourneyView({
  career, clubShortName,
}: {
  readonly career: ManagerCareer;
  readonly clubShortName: (clubId: string) => string;
}) {
  const curve = reputationCurve(career);

  if (career.seasons.length === 0) {
    return (
      <p className="career-empty">
        Votre parcours s'écrira à la fin de votre première saison complète.
      </p>
    );
  }

  return (
    <div className="journey-view">
      <ReputationChart points={curve} />

      <ol className="journey-list">
        {[...career.seasons].reverse().map(s => (
          <li key={`${s.season}_${s.clubId as string}`} className={`journey-row v-${s.verdict.toLowerCase()}`}>
            <span className="jr-season">{seasonLabel(s.season)}</span>
            <ClubCrest clubId={s.clubId as string} initials={clubShortName(s.clubId as string)} size={30} />
            <span className="jr-club">{s.clubName}</span>

            <span className="jr-mission">
              <span className="jr-label">Mission</span>
              <span>{s.objectiveLabel}</span>
            </span>

            <span className="jr-rank">
              <span className="jr-label">Classement</span>
              <span>
                {s.finalRank > 0 ? rankLabel(s.finalRank) : '—'}
                {s.wonTitle && <span className="jr-brennus" title="Bouclier de Brennus"> ★</span>}
              </span>
            </span>

            <span className={`jr-outcome ${s.objectiveMet ? 'met' : 'missed'}`}>
              {s.objectiveMet ? 'Objectif tenu' : 'Objectif manqué'}
            </span>

            <span className={`jr-delta ${s.reputationDelta >= 0 ? 'up' : 'down'}`}>
              {s.reputationDelta >= 0 ? '+' : ''}{s.reputationDelta} rép.
            </span>

            <span className={`jr-verdict v-${s.verdict.toLowerCase()}`}>{VERDICT_LABEL[s.verdict]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Courbe de réputation.
 *
 * Tracée à la main en SVG : le projet n'embarque aucune librairie graphique, et
 * une polyligne sur une échelle fixe 0-100 suffit largement — ce qu'on veut
 * lire, c'est la pente, pas des valeurs au point près.
 */
function ReputationChart({ points }: { readonly points: readonly { season: number; score: number }[] }) {
  if (points.length < 2) return null;

  const W = 640, H = 120, PAD = 8;
  const step = (W - PAD * 2) / (points.length - 1);
  const y = (score: number): number => PAD + (1 - score / 100) * (H - PAD * 2);
  const coords = points.map((p, i) => `${PAD + i * step},${y(p.score)}`);

  return (
    <figure className="rep-chart">
      <figcaption>Réputation au fil des saisons</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Courbe de réputation" preserveAspectRatio="none">
        {[25, 50, 75].map(g => (
          <line key={g} x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} className="rc-grid" />
        ))}
        <polyline points={coords.join(' ')} className="rc-line" />
        {points.map((p, i) => (
          <circle key={p.season} cx={PAD + i * step} cy={y(p.score)} r={3} className="rc-dot" />
        ))}
      </svg>
      <div className="rc-axis">
        <span>{seasonLabel(points[0]!.season)}</span>
        <span>{seasonLabel(points[points.length - 1]!.season)}</span>
      </div>
    </figure>
  );
}

// =============================================================================
// Palmarès
// =============================================================================

function HonoursView({
  career, totals, clubShortName,
}: {
  readonly career: ManagerCareer;
  readonly totals: ReturnType<typeof careerTotals>;
  readonly clubShortName: (clubId: string) => string;
}) {
  const best = bestSeason(career);
  const worst = worstSeason(career);
  const spells = clubSpells(career);

  if (career.seasons.length === 0) {
    return <p className="career-empty">Rien à afficher pour l'instant — tout reste à gagner.</p>;
  }

  return (
    <div className="honours-view">
      <ul className="honours-grid">
        <HonourCard label="Bouclier de Brennus" value={totals.titles} highlight={totals.titles > 0} />
        <HonourCard label="Finales perdues" value={totals.finalsLost} />
        <HonourCard label="Saisons dirigées" value={totals.seasons} />
        <HonourCard label="Clubs entraînés" value={totals.clubsManaged} />
        <HonourCard label="Meilleur classement" value={totals.bestRank > 0 ? rankLabel(totals.bestRank) : '—'} />
        <HonourCard label="Objectifs tenus" value={`${totals.objectivesMet}/${totals.seasons}`} />
        <HonourCard label="Taux de réussite" value={`${totals.successRate}%`} />
        <HonourCard label="Limogeages" value={totals.sackings} highlight={false} warn={totals.sackings > 0} />
      </ul>

      <div className="honours-split">
        {best && <SeasonHighlight title="La saison de référence" record={best} tone="good" />}
        {/* Deux garde-fous : sur une carrière d'une seule saison, la meilleure
            et la pire sont la même ; et tant qu'aucune mission n'a été manquée,
            appeler « saison à oublier » une 2ᵉ place contredit le verdict
            affiché juste au-dessus. */}
        {worst && best && worst.season !== best.season && !worst.objectiveMet && (
          <SeasonHighlight title="La saison à oublier" record={worst} tone="bad" />
        )}
      </div>

      <div className="honours-spells">
        <h3>Passages</h3>
        <ol className="spell-list">
          {[...spells].reverse().map((sp, i) => (
            <li key={`${sp.clubId as string}_${sp.fromSeason}_${i}`} className="spell-row">
              <ClubCrest clubId={sp.clubId as string} initials={clubShortName(sp.clubId as string)} size={34} />
              <span className="sp-club">{sp.clubName}</span>
              <span className="sp-period">
                {sp.fromSeason === sp.toSeason
                  ? seasonLabel(sp.fromSeason)
                  : `${seasonLabel(sp.fromSeason)} → ${seasonLabel(sp.toSeason)}`}
              </span>
              <span className="sp-count">{sp.seasons} saison{sp.seasons > 1 ? 's' : ''}</span>
              <span className="sp-best">
                {sp.titles > 0 ? `${sp.titles} Brennus` : sp.bestRank > 0 ? `meilleur : ${rankLabel(sp.bestRank)}` : '—'}
              </span>
              <span className={`sp-end ${sp.endedBy ? sp.endedBy.toLowerCase() : 'ongoing'}`}>
                {sp.endedBy ? VERDICT_LABEL[sp.endedBy] : 'En poste'}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function HonourCard({
  label, value, highlight, warn,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly highlight?: boolean;
  readonly warn?: boolean;
}) {
  return (
    <li className={`honour-card ${highlight ? 'gold' : ''} ${warn ? 'warn' : ''}`}>
      <span className="hc-value">{value}</span>
      <span className="hc-label">{label}</span>
    </li>
  );
}

function SeasonHighlight({
  title, record, tone,
}: {
  readonly title: string;
  readonly record: ManagerCareer['seasons'][number];
  readonly tone: 'good' | 'bad';
}) {
  return (
    <div className={`season-highlight ${tone}`}>
      <span className="sh-title">{title}</span>
      <span className="sh-season">{seasonLabel(record.season)} · {record.clubName}</span>
      <p className="sh-body">
        {record.finalRank > 0 ? rankLabel(record.finalRank) : 'Non classé'} pour une mission
        « {record.objectiveLabel} ». {record.wonTitle
          ? 'Bouclier de Brennus remporté.'
          : record.reachedFinal
            ? 'Finale atteinte, titre manqué.'
            : record.objectiveMet
              ? 'Contrat rempli.'
              : 'Contrat non rempli.'}
      </p>
    </div>
  );
}
