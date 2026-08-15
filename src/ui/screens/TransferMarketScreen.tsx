import { useState } from 'react';
import type { IncomingOffer } from '../../engine/club/transfer-market.js';
import { offerToFreeAgent } from '../../engine/club/transfer-market.js';
import { expectedMarketSalary } from '../../engine/club/contracts.js';
import {
  CERTAINTY_LABEL,
  certaintyFor,
  estimateAttribute,
  estimatePotential,
  estimateValue,
  type ScoutingState,
} from '../../engine/club/scouting.js';
import type { BidOutcome, BidPreview, BidTerms } from '../../engine/game/season-session.js';
import { estimateMarketValue as marketValueOf } from '../../engine/club/transfer-offers.js';
import type { AiTransfer } from '../../engine/club/ai-market.js';
import type { LoanOffer } from '../../engine/club/loans.js';
import type { ShortlistEntry } from '../../engine/club/shortlist.js';
import type { TransferWindowStatus } from '../../engine/season/transfer-window.js';
import {
  KeyAttributes,
  POSITION_LINE,
  PositionBadge,
  keyAttributesFor,
  type PositionLine,
} from '../components/DataBits.js';
import { evaluateIdentityFit } from '../../engine/club/identity-fit.js';
import type { InternationalTarget } from '../../engine/club/international-market.js';
import { COUNTRY_LABEL } from '../../engine/season/foreign-players.js';
import type { Club, ClubId, Player, PlayerId } from '../../engine/types.js';
import type { CapReport, JiffReport } from '../../engine/club/regulations.js';

interface Props {
  readonly playerClubId: ClubId;
  /** V0.15 — connaissance du club sur chaque joueur du marché. */
  readonly scouting: ScoutingState;
  readonly scoutingSlots: number;
  readonly onAssignScout: (playerId: PlayerId) => void;
  readonly onUnassignScout: (playerId: PlayerId) => void;
  readonly playerClub: Club;
  /**
   * V0.45 — la contrainte réglementaire, affichée en permanence.
   *
   * Le plafond et le quota ne servent à rien s'ils ne se voient qu'au bilan de
   * fin de saison : c'est **devant une offre** qu'ils doivent peser.
   */
  readonly regulation: {
    readonly cap: CapReport;
    readonly jiff: JiffReport;
    readonly transferBan: boolean;
  };
  readonly currentSeason: number;
  readonly seed: string;
  /**
   * V0.61 — la liste de suivi.
   *
   * Distincte des créneaux de scouting : elle n'apprend rien sur un joueur, elle
   * garde l'œil dessus. Confondre les deux viderait l'observation de son
   * intérêt.
   */
  readonly shortlist?: {
    readonly entries: readonly ShortlistEntry[];
    readonly watched: ReadonlySet<string>;
    readonly onToggle: (playerId: PlayerId) => void;
  };
  readonly freeAgents: readonly Player[];
  readonly incomingOffers: readonly IncomingOffer[];
  readonly onSignFreeAgent: (player: Player, offer: { years: number; annualSalary: number }) => void;
  readonly onResolveIncomingOffer: (offerId: string, accept: boolean) => void;
  /**
   * V0.55 — les prêts.
   *
   * C'est la troisième voie pour un jeune : ni prendre des minutes à l'équipe
   * première, ni stagner sur le banc.
   */
  readonly loans?: {
    readonly candidates: readonly Player[];
    readonly active: readonly {
      readonly playerName: string;
      readonly clubName: string;
      readonly playingTime: number;
      readonly costLine: string;
    }[];
    readonly offersFor: (player: Player) => readonly LoanOffer[];
    readonly tradeoff: (offer: LoanOffer, player: Player) => string;
    readonly onSend: (player: Player, offer: LoanOffer) => void;
  };
  readonly onBack?: () => void;
  /** V0.61 — ouvrir la fiche d'un joueur suivi. */
  readonly onOpenPlayer?: (player: Player) => void;
  /**
   * V0.21 — tous les joueurs du championnat, hors club utilisateur.
   * Sans eux, l'onglet Transferts se limitait aux agents libres : un écran vide
   * la moitié de la saison, alors que la mécanique de scouting était prête.
   */
  readonly leaguePlayers: readonly Player[];
  readonly clubNameById: (clubId: string) => string;
  /**
   * V0.28 — transferts sortants. Sans eux, la recherche et le scouting étaient
   * une impasse : on pouvait tout savoir d'un joueur sans jamais pouvoir l'acheter.
   */
  readonly previewBid: (player: Player) => BidPreview;
  readonly onSubmitBid: (player: Player, terms: BidTerms) => BidOutcome;
  /**
   * V0.29 — mouvements du dernier mercato des clubs IA. Sans cette vitrine, le
   * championnat bougeait sans que le manager s'en aperçoive jamais.
   */
  readonly aiMarket: readonly AiTransfer[];
  /** V0.30 — état de la fenêtre de mercato, qui vaut aussi pour le manager. */
  readonly transferWindow: TransferWindowStatus;
  /**
   * V0.37 — blessés ouvrant droit à un joker médical, et agents libres
   * signables pour chacun. Seule dérogation à la fenêtre.
   */
  readonly jokerOptions: readonly {
    readonly injured: Player;
    readonly returnsAtRound: number;
    readonly candidates: readonly Player[];
  }[];
  readonly onSignJoker: (injuredId: PlayerId, candidate: Player, annualSalary: number) => string | undefined;
  /**
   * V0.63 : le marché international.
   *
   * Meilleur à prix égal que le marché français, et non-JIFF : c'est le seul
   * endroit du jeu où recruter **coûte une place** sur la feuille de match.
   */
  readonly international?: {
    readonly targets: readonly InternationalTarget[];
    readonly onBid: (
      target: InternationalTarget,
      bid: { fee: number; annualSalary: number; years: number },
    ) => { readonly ok: boolean; readonly message: string };
  };
}

function formatEuros(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}

function approximateOverall(p: Player): number {
  const t = p.technical, ph = p.physical, m = p.mental;
  const techAvg = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const physAvg = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const mentAvg = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return Math.round((techAvg + physAvg + mentAvg) / 3);
}

export function TransferMarketScreen({
  playerClubId, playerClub, currentSeason, seed,
  freeAgents, incomingOffers, scouting, scoutingSlots, shortlist,
  onAssignScout, onUnassignScout,
  onSignFreeAgent, onResolveIncomingOffer,
  leaguePlayers, clubNameById, onOpenPlayer,
  previewBid, onSubmitBid, aiMarket, transferWindow, jokerOptions, onSignJoker, regulation, loans,
  international,
}: Props) {
  const [tab, setTab] = useState<
    'RECHERCHE' | 'SUIVIS' | 'MERCATO' | 'ETRANGER' | 'LIBRES' | 'JOKER' | 'OFFRES' | 'PRETS'
  >('RECHERCHE');
  /** V0.63 : cible étrangère dont on prépare l'offre. */
  const [intlTarget, setIntlTarget] = useState<InternationalTarget | null>(null);
  const [intlFee, setIntlFee] = useState(0);
  const [intlSalary, setIntlSalary] = useState(0);
  const [intlYears, setIntlYears] = useState(3);
  /** V0.55 — joueur dont on examine les propositions de prêt. */
  const [loanTarget, setLoanTarget] = useState<Player | null>(null);
  const [posFilter, setPosFilter] = useState<'ALL' | PositionLine>('ALL');
  const [ageFilter, setAgeFilter] = useState<'ALL' | 'JEUNES' | 'CONFIRMES' | 'EXPERIMENTES'>('ALL');
  const [search, setSearch] = useState('');
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [selectedFA, setSelectedFA] = useState<Player | null>(null);
  const [offerYears, setOfferYears] = useState(2);
  const [offerSalary, setOfferSalary] = useState(150_000);
  const [feedback, setFeedback] = useState<string | null>(null);

  // V0.28 — négociation pour un joueur sous contrat.
  const [target, setTarget] = useState<Player | null>(null);
  const [preview, setPreview] = useState<BidPreview | null>(null);
  const [fee, setFee] = useState(1_000_000);
  const [bidSalary, setBidSalary] = useState(200_000);
  const [bidYears, setBidYears] = useState(3);
  const [bidResult, setBidResult] = useState<BidOutcome | null>(null);
  /*
   * V0.64 — le montage et les clauses.
   *
   * Repliés par défaut : le mercato doit rester une offre sèche pour qui ne veut
   * pas monter un dossier. Les déplier est un choix, et c'est ce choix qui donne
   * au manager pauvre les moyens de signer au-dessus de sa trésorerie.
   */
  const [showTerms, setShowTerms] = useState(false);
  const [instalments, setInstalments] = useState(1);
  const [sellOn, setSellOn] = useState(0);
  const [matchBonus, setMatchBonus] = useState(0);
  const [releaseClause, setReleaseClause] = useState(0);

  const openOfferDialog = (p: Player) => {
    setSelectedFA(p);
    const expected = expectedMarketSalary(p, currentSeason);
    setOfferSalary(expected);
    setFeedback(null);
  };

  const openBidDialog = (p: Player) => {
    const pv = previewBid(p);
    setTarget(p);
    setPreview(pv);
    setBidResult(null);
    // Point de départ fourni par le moteur : il tient compte du brouillard de
    // scouting, l'écran n'a pas accès à la valeur réelle du joueur.
    setFee(pv.suggestedFee);
    setBidSalary(Math.max(pv.expectedSalary, pv.currentSalary));
    setBidYears(3);
    setShowTerms(false);
    setInstalments(1);
    setSellOn(0);
    setMatchBonus(0);
    setReleaseClause(0);
  };

  const closeBidDialog = () => {
    setTarget(null);
    setPreview(null);
    setBidResult(null);
  };

  const submitBid = () => {
    if (!target) return;
    const outcome = onSubmitBid(target, {
      fee, annualSalary: bidSalary, years: bidYears,
      ...(instalments > 1 ? { instalments } : {}),
      ...(sellOn > 0 ? { sellOn } : {}),
      ...(matchBonus > 0 ? { bonuses: { perMatch: matchBonus } } : {}),
      ...(releaseClause > 0 ? { releaseClause } : {}),
    });
    setBidResult(outcome);
    // Le chiffrage bouge après coup — trésorerie entamée, délai posé. Sans ce
    // rappel, la modale affichait encore l'ancienne trésorerie après signature
    // pendant que le HUD, lui, montrait la bonne.
    setPreview(previewBid(target));
    if (outcome.kind === 'SIGNED') {
      setFeedback(`${target.firstName} ${target.lastName} rejoint ${playerClub.name} pour ${formatEuros(fee)} !`);
    }
  };

  const submitOffer = () => {
    if (!selectedFA) return;
    const response = offerToFreeAgent(
      selectedFA, playerClubId,
      { years: offerYears, annualSalary: offerSalary },
      currentSeason, seed,
    );
    if (response.kind === 'ACCEPT') {
      onSignFreeAgent(selectedFA, { years: offerYears, annualSalary: offerSalary });
      setFeedback(`${selectedFA.firstName} ${selectedFA.lastName} a signé !`);
      setSelectedFA(null);
    } else {
      setFeedback(`Refusé : ${response.reason}`);
    }
  };

  return (
    <section className="finances-screen">
      <div className="screen-head">
        <h2>Marché des transferts</h2>
        <span className="screen-head-meta">
          Saison {currentSeason}-{(currentSeason + 1).toString().slice(-2)}
        </span>
        <span className={`window-pill ${transferWindow.open ? 'open' : 'closed'}`}>
          <span className="wp-dot" />
          {transferWindow.summary}
        </span>
      </div>

      {/* V0.45 — le règlement en tête d'écran. Le plafond ne pèse sur une
          décision que s'il est lisible au moment où on la prend. */}
      <div className={`regulation-bar ${regulation.cap.status.toLowerCase()}`}>
        <div className="reg-item">
          <span className="reg-label">Masse salariale</span>
          <span className="reg-value">
            {(regulation.cap.payroll / 1_000_000).toFixed(2)} / {(regulation.cap.cap / 1_000_000).toFixed(1)} M€
          </span>
          <div className="reg-bar">
            <div
              className="reg-bar-fill"
              style={{ width: `${Math.min(100, regulation.cap.usage)}%` }}
            />
          </div>
          <span className="reg-note">
            {regulation.cap.headroom >= 0
              ? `${Math.round(regulation.cap.headroom / 1000)} k€ de marge`
              : `${Math.round(-regulation.cap.headroom / 1000)} k€ au-dessus du plafond`}
          </span>
        </div>

        <div className="reg-item">
          <span className="reg-label">Quota JIFF</span>
          <span className="reg-value">
            {regulation.jiff.count} / {regulation.jiff.total} — minimum {regulation.jiff.required}
          </span>
          <span className="reg-note">
            {regulation.jiff.compliant
              ? `${regulation.jiff.foreignHeadroom} recrue${regulation.jiff.foreignHeadroom > 1 ? 's' : ''} hors formation française possible${regulation.jiff.foreignHeadroom > 1 ? 's' : ''}`
              : `${regulation.jiff.shortfall} JIFF manquant${regulation.jiff.shortfall > 1 ? 's' : ''}`}
          </span>
        </div>

        {regulation.transferBan && (
          <div className="reg-ban">Interdiction de recruter en cours</div>
        )}
      </div>

      {feedback && <div className="rollover-banner">{feedback}</div>}

      {/* Onglets : la recherche devient l'entrée principale du marché. */}
      <div className="market-tabs">
        {([
          ['RECHERCHE', `Recherche de joueurs (${leaguePlayers.length})`],
          ['SUIVIS', `Liste de suivi (${shortlist?.entries.length ?? 0})`],
          ['MERCATO', `Mercato du championnat (${aiMarket.filter(t => t.kind === 'TRANSFERT').length})`],
          ['ETRANGER', `Marché international (${international?.targets.length ?? 0})`],
          ['LIBRES', `Agents libres (${freeAgents.length})`],
          ['JOKER', `Joker médical (${jokerOptions.length})`],
          ['OFFRES', `Offres reçues (${incomingOffers.length})`],
          ['PRETS', `Prêts (${loans?.active.length ?? 0})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`market-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'SUIVIS' && (
        <div className="market-panel">
          <div className="panel-tag">Liste de suivi ({shortlist?.entries.length ?? 0})</div>
          {(!shortlist || shortlist.entries.length === 0) && (
            <p className="empty">
              Aucun joueur suivi. L'étoile, dans la recherche ou sur une fiche,
              garde un joueur à l'œil sans consommer de créneau d'observation.
            </p>
          )}
          {shortlist && shortlist.entries.length > 0 && (
            <table className="squad-table">
              <thead>
                <tr>
                  <th className="c-pos">Poste</th>
                  <th className="c-name">Joueur</th>
                  <th className="num-head">Âge</th>
                  <th>Club</th>
                  <th className="num-head">Fin de contrat</th>
                  <th>Alerte</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shortlist.entries.map(({ player, alert }) => (
                  <tr
                    key={player.id}
                    className="clickable"
                    onClick={() => onOpenPlayer?.(player)}
                    title="Voir la fiche"
                  >
                    <td className="c-pos"><PositionBadge position={player.position} /></td>
                    <td className="c-name"><span className="sq-name">{player.firstName} {player.lastName}</span></td>
                    <td className="num">{currentSeason - Number(player.birthDate.slice(0, 4))}</td>
                    <td>{player.freeAgent ? 'Sans club' : clubNameById(player.clubId as string)}</td>
                    <td className="num">{player.freeAgent ? '—' : player.contract.endSeason}</td>
                    <td className={alert?.urgent ? 'shortlist-alert urgent' : 'shortlist-alert'}>
                      {alert?.message ?? '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => shortlist.onToggle(player.id)}
                        title="Retirer de la liste de suivi"
                      >
                        ★
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'RECHERCHE' && (() => {
        const slotsFull = scouting.assignments.length >= scoutingSlots;
        const q = search.trim().toLowerCase();

        const results = leaguePlayers
          .filter(p => {
            if (posFilter !== 'ALL' && POSITION_LINE[p.position] !== posFilter) return false;
            const age = currentSeason - Number(p.birthDate.slice(0, 4));
            if (ageFilter === 'JEUNES' && age > 23) return false;
            if (ageFilter === 'CONFIRMES' && (age < 24 || age > 29)) return false;
            if (ageFilter === 'EXPERIMENTES' && age < 30) return false;
            if (watchedOnly && !scouting.assignments.includes(p.id)) return false;
            if (q) {
              const hay = `${p.firstName} ${p.lastName} ${clubNameById(p.clubId as string)}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          })
          .sort((a, b) => approximateOverall(b) - approximateOverall(a))
          .slice(0, 60);

        return (
          <>
            <div className="market-toolbar">
              <div className="filter-group">
                {([['ALL', 'Tous postes'], ['AVANTS', 'Avants'], ['DEMIS', 'Demis'], ['TROIS_QUARTS', 'Trois-quarts']] as const).map(([k, l]) => (
                  <button key={k} type="button" className={`filter-chip ${posFilter === k ? 'active' : ''}`} onClick={() => setPosFilter(k)}>{l}</button>
                ))}
              </div>
              <div className="filter-group">
                {([['ALL', 'Tous âges'], ['JEUNES', '≤ 23 ans'], ['CONFIRMES', '24-29'], ['EXPERIMENTES', '30+']] as const).map(([k, l]) => (
                  <button key={k} type="button" className={`filter-chip small ${ageFilter === k ? 'active' : ''}`} onClick={() => setAgeFilter(k)}>{l}</button>
                ))}
              </div>
              <button
                type="button"
                className={`filter-chip small ${watchedOnly ? 'active' : ''}`}
                onClick={() => setWatchedOnly(v => !v)}
              >
                👁 Sous observation ({scouting.assignments.length}/{scoutingSlots})
              </button>
              <input
                className="squad-search"
                type="search"
                placeholder="Nom ou club…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="squad-table-wrap">
              <table className="squad-table">
                <thead>
                  <tr>
                    <th className="c-pos">Poste</th>
                    <th className="c-name">Joueur</th>
                    <th className="c-club">Club</th>
                    <th className="num-head">Âge</th>
                    <th className="c-attrs">Points forts</th>
                    <th className="num-head">Niveau</th>
                    <th className="num-head">Potentiel</th>
                    <th className="num-head">Salaire</th>
                    <th className="num-head">Valeur</th>
                    <th className="c-scout">Scout</th>
                    <th className="c-scout"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(p => {
                    const age = currentSeason - Number(p.birthDate.slice(0, 4));
                    const familiarity = scouting.knowledge.get(p.id)?.familiarity ?? 0;
                    const certainty = certaintyFor(familiarity);
                    const ability = estimateAttribute(approximateOverall(p), familiarity, `${p.id}_ov`, 14);
                    const potential = estimatePotential(p, familiarity, currentSeason);
                    const watched = scouting.assignments.includes(p.id);
                    const fit = evaluateIdentityFit(playerClub, p);
                    return (
                      <tr key={p.id}>
                        <td className="c-pos"><PositionBadge position={p.position} /></td>
                        <td className="c-name">
                          {/* V0.61 — l'étoile garde un joueur à l'œil sans
                              consommer de créneau d'observation : suivre et
                              observer sont deux gestes différents. */}
                          {shortlist && (
                            <button
                              type="button"
                              className={`watch-star ${shortlist.watched.has(p.id as string) ? 'on' : ''}`}
                              onClick={() => shortlist.onToggle(p.id)}
                              title={shortlist.watched.has(p.id as string)
                                ? 'Retirer de la liste de suivi'
                                : 'Suivre ce joueur'}
                            >
                              ★
                            </button>
                          )}
                          <span className="sq-name">{p.firstName} {p.lastName}</span>
                          <span className="sq-tags">
                            {p.isJiff && <span className="sq-tag jiff">JIFF</span>}
                            {fit.fit === 'GOOD' && <span className="sq-tag fit">colle au projet</span>}
                          </span>
                        </td>
                        <td className="market-club c-club">{clubNameById(p.clubId as string)}</td>
                        <td className="num">{age}</td>
                        <td className="c-attrs">
                          {/* Les points forts passent par le filtre du scout, comme le
                              niveau : afficher « 99 » sur un joueur jamais observé
                              contredisait le « ? » de la colonne d'à côté. */}
                          <KeyAttributes
                            attributes={keyAttributesFor(p as never).map(a => ({
                              label: a.label,
                              value: a.value,
                              estimate: estimateAttribute(a.value, familiarity, `${p.id}_${a.label}`, 16),
                            }))}
                          />
                        </td>
                        <td className="num" title={CERTAINTY_LABEL[certainty]}>
                          {ability.certainty === 'INCONNU' ? '—' : ability.display}
                        </td>
                        <td className="num potential" title={CERTAINTY_LABEL[certainty]}>
                          {potential.certainty === 'INCONNU' ? '—' : potential.display}
                        </td>
                        <td className="num">{formatEuros(p.contract.annualSalary)}</td>
                        <td className="num" title={CERTAINTY_LABEL[certainty]}>
                          {(() => {
                            const v = estimateValue(marketValueOf(p, currentSeason), familiarity, p.id as string);
                            if (v.certainty === 'INCONNU') return '—';
                            return <span className="value-range">{formatEuros(v.min)} – {formatEuros(v.max)}</span>;
                          })()}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={watched ? 'scout-btn watching' : 'scout-btn'}
                            disabled={!watched && slotsFull}
                            title={watched ? 'Retirer de la surveillance' : slotsFull ? 'Créneaux de scouting saturés' : 'Envoyer le scout'}
                            onClick={() => (watched ? onUnassignScout(p.id) : onAssignScout(p.id))}
                          >
                            {watched ? '👁 suivi' : 'observer'}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="bid-btn"
                            disabled={!transferWindow.open}
                            title={transferWindow.open ? 'Proposer une offre' : transferWindow.summary}
                            onClick={() => openBidDialog(p)}
                          >
                            recruter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {results.length === 0 && (
                <p className="squad-empty">Aucun joueur ne correspond à ces critères.</p>
              )}
            </div>
          </>
        );
      })()}

      {/* ---- Mercato du championnat (V0.29) --------------------------------- */}
      {tab === 'MERCATO' && (() => {
        const paid = aiMarket.filter(t => t.kind === 'TRANSFERT');
        const free = aiMarket.filter(t => t.kind === 'RECRUE_LIBRE');
        const renewals = aiMarket.filter(t => t.kind === 'PROLONGATION');
        const total = paid.reduce((s, t) => s + t.fee, 0);

        if (aiMarket.length === 0) {
          return (
            <div className="dashboard-panel">
              <div className="panel-tag">Mercato</div>
              <p className="empty">
                Aucun mouvement pour l'instant. Le marché du championnat s'anime à l'intersaison.
              </p>
            </div>
          );
        }

        return (
          <>
            <div className="mercato-summary">
              <div className="ms-stat">
                <span className="ms-value">{paid.length}</span>
                <span className="ms-label">transferts payants</span>
              </div>
              <div className="ms-stat">
                <span className="ms-value">{formatEuros(total)}</span>
                <span className="ms-label">dépensés au total</span>
              </div>
              <div className="ms-stat">
                <span className="ms-value">{free.length}</span>
                <span className="ms-label">joueurs libres recrutés</span>
              </div>
              <div className="ms-stat">
                <span className="ms-value">{renewals.length}</span>
                <span className="ms-label">prolongations</span>
              </div>
            </div>

            <div className="dashboard-panel">
              <div className="panel-tag">Mouvements — {transferWindow.current?.label ?? 'dernière fenêtre'}</div>
              {paid.length === 0 && free.length === 0 && (
                <p className="empty">
                  Aucun changement de club : les équipes ont seulement prolongé leurs joueurs.
                </p>
              )}
              <ul className="mercato-list">
                {[...paid, ...free].map(t => (
                  <li key={t.playerId} className={`mercato-row ${t.kind === 'TRANSFERT' ? 'paid' : 'free'}`}>
                    <PositionBadge position={t.position} />
                    <span className="mr-name">{t.playerName}</span>
                    <span className="mr-overall">{t.overall}</span>
                    <span className="mr-move">
                      <span className="mr-from">{t.fromClubName}</span>
                      <span className="mr-arrow">→</span>
                      <span className="mr-to">{t.toClubName}</span>
                    </span>
                    <span className="mr-fee">
                      {t.kind === 'TRANSFERT' ? formatEuros(t.fee) : 'libre'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        );
      })()}

      {/* ---- Joker médical (V0.37) ------------------------------------------ */}
      {tab === 'JOKER' && (
        <div className="dashboard-panel">
          <div className="panel-tag">Joker médical</div>
          <p className="joker-rule">
            Un joueur absent longue durée peut être remplacé <strong>hors fenêtre de mercato</strong>.
            Le joker doit être libre, jouer au même poste, et ne pas être meilleur que le blessé :
            on répare un effectif, on ne le renforce pas. Son contrat s'achève en fin de saison.
          </p>

          {jokerOptions.length === 0 && (
            <p className="empty">
              Aucun blessé de longue durée dans l'effectif — le joker ne s'ouvre pas.
            </p>
          )}

          {jokerOptions.map(({ injured, returnsAtRound, candidates }) => (
            <div key={injured.id as string} className="joker-case">
              <div className="joker-injured">
                <PositionBadge position={injured.position} />
                <span className="ji-name">{injured.firstName} {injured.lastName}</span>
                <span className="ji-injury">
                  {injured.dynamic.injury?.type.toLowerCase()} — retour prévu J{returnsAtRound}
                </span>
              </div>

              {candidates.length === 0 ? (
                <p className="joker-none">Aucun agent libre ne convient à ce poste.</p>
              ) : (
                <ul className="joker-candidates">
                  {candidates.slice(0, 5).map(c => {
                    const salary = expectedMarketSalary(c, currentSeason);
                    return (
                      <li key={c.id as string}>
                        <PositionBadge position={c.position} />
                        <span className="jc-name">{c.firstName} {c.lastName}</span>
                        <span className="jc-age">{currentSeason - Number(c.birthDate.slice(0, 4))} ans</span>
                        <span className="jc-salary">{formatEuros(salary)}/an</span>
                        <button
                          type="button"
                          className="jc-sign"
                          onClick={() => {
                            const refusal = onSignJoker(injured.id, c, salary);
                            setFeedback(refusal ?? `${c.lastName} signe comme joker de ${injured.lastName}.`);
                          }}
                        >
                          signer
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'PRETS' && loans && (
        <div className="dashboard-panel">
          <div className="panel-tag">Joueurs prêtés ({loans.active.length})</div>
          {loans.active.length === 0 ? (
            <p className="market-empty">Aucun joueur prêté cette saison.</p>
          ) : (
            <ul className="offers-list">
              {loans.active.map((l, i) => (
                <li key={`${l.playerName}_${i}`} className="offer-row">
                  <div className="offer-text">
                    <strong>{l.playerName}</strong> à <strong>{l.clubName}</strong>
                    <div className="offer-detail">
                      {Math.round(l.playingTime * 100)} % du temps de jeu promis · {l.costLine}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="panel-tag" style={{ marginTop: 'var(--sp-4)' }}>
            Peuvent partir jouer ailleurs ({loans.candidates.length})
          </div>
          {!transferWindow.open ? (
            <p className="market-empty">
              Le marché est fermé : un prêt se conclut pendant une fenêtre, comme un transfert.
            </p>
          ) : loans.candidates.length === 0 ? (
            <p className="market-empty">
              Aucun jeune ne gagnerait à être prêté : ils jouent tous suffisamment ici.
            </p>
          ) : (
            <ul className="offers-list">
              {loans.candidates.map(p => (
                <li key={p.id as string} className="offer-row">
                  <div className="offer-text">
                    <strong>{p.firstName} {p.lastName}</strong>
                    <div className="offer-detail">{p.position.replace(/_/g, ' ').toLowerCase()}</div>
                  </div>
                  <button
                    type="button"
                    className="offer-btn"
                    onClick={() => setLoanTarget(loanTarget?.id === p.id ? null : p)}
                  >
                    {loanTarget?.id === p.id ? 'Fermer' : 'Voir les offres'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {loanTarget && (
            <div className="loan-offers">
              <div className="panel-tag">
                Propositions pour {loanTarget.firstName} {loanTarget.lastName}
              </div>
              <ul className="offers-list">
                {loans.offersFor(loanTarget).map(o => (
                  <li key={o.clubId as string} className="offer-row">
                    <div className="offer-text">
                      <strong>{o.clubName}</strong>
                      <div className="offer-detail">{o.pitch}</div>
                      {/* On dit ce que ça coûte autant que ce que ça rapporte. */}
                      <div className="offer-detail">{loans.tradeoff(o, loanTarget)}</div>
                    </div>
                    <button
                      type="button"
                      className="offer-btn accept"
                      onClick={() => { loans.onSend(loanTarget, o); setLoanTarget(null); }}
                    >
                      Prêter
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'OFFRES' && incomingOffers.length > 0 && (
        <div className="dashboard-panel">
          <div className="panel-tag">Offres entrantes ({incomingOffers.length})</div>
          <ul className="offers-list">
            {incomingOffers.map(o => (
              <li key={o.id} className="offer-row">
                <div className="offer-text">
                  <strong>{o.fromClubName}</strong> propose {formatEuros(o.transferAmount)} pour <strong>{o.playerLastName}</strong>
                  <div className="offer-detail">
                    Salaire offert au joueur : {formatEuros(o.proposedAnnualSalary)}/an sur {o.proposedYears} ans
                  </div>
                </div>
                <div className="offer-actions">
                  <button type="button" className="primary" onClick={() => onResolveIncomingOffer(o.id, true)}>
                    Vendre
                  </button>
                  <button type="button" onClick={() => onResolveIncomingOffer(o.id, false)}>
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'ETRANGER' && (
      <div className="dashboard-panel">
        <div className="panel-tag">Marché international ({international?.targets.length ?? 0})</div>
        <p className="market-hint">
          Un joueur formé hors de France n'est pas JIFF : chaque recrue étrangère
          prend une place sur une feuille de match qui doit en compter douze sur
          vingt-trois. L'effectif compte {regulation.jiff.count} JIFF sur{' '}
          {regulation.jiff.total}, soit{' '}
          {regulation.jiff.foreignHeadroom > 0
            ? `${regulation.jiff.foreignHeadroom} recrue${regulation.jiff.foreignHeadroom > 1 ? 's' : ''} étrangère${regulation.jiff.foreignHeadroom > 1 ? 's' : ''} possible${regulation.jiff.foreignHeadroom > 1 ? 's' : ''} avant de passer sous le seuil.`
            : 'aucune marge : une recrue étrangère de plus et la feuille de match n\'est plus conforme.'}
        </p>
        {(!international || international.targets.length === 0) && (
          <p className="empty">Aucun joueur étranger sur le marché cette fenêtre.</p>
        )}
        {international && international.targets.length > 0 && (
          <table className="finances-history">
            <thead>
              <tr>
                <th>Nom</th><th>Poste</th><th>Âge</th><th>Niveau</th>
                <th>Club</th><th>Indemnité</th><th>Salaire attendu</th><th></th>
              </tr>
            </thead>
            <tbody>
              {international.targets.map(t => {
                const age = currentSeason - Number(t.player.birthDate.slice(0, 4));
                const horsPortee = playerClub.reputation < t.minimumReputation;
                return (
                  <tr key={t.player.id}>
                    <td>
                      {t.player.firstName} {t.player.lastName}
                      <span className="pc-tag injury" style={{ marginLeft: 6 }}>non-JIFF</span>
                    </td>
                    <td className="c-pos"><PositionBadge position={t.player.position} /></td>
                    <td>{age}</td>
                    <td>{approximateOverall(t.player)}</td>
                    <td>
                      {t.fromClubName}
                      <div className="offer-detail">{COUNTRY_LABEL[t.country]}</div>
                    </td>
                    <td>{formatEuros(t.askingPrice)}</td>
                    <td>{formatEuros(t.salaryDemand)}</td>
                    <td>
                      <button
                        type="button"
                        disabled={horsPortee}
                        title={horsPortee
                          ? 'Il ne voit pas ce club comme une étape de sa carrière.'
                          : 'Faire une offre'}
                        onClick={() => {
                          setIntlTarget(t);
                          setIntlFee(t.askingPrice);
                          setIntlSalary(t.salaryDemand);
                          setIntlYears(3);
                          setFeedback(null);
                        }}
                      >
                        {horsPortee ? 'hors de portée' : 'Faire offre'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      {intlTarget && international && (
        <div className="modal-backdrop" onClick={() => setIntlTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{intlTarget.player.firstName} {intlTarget.player.lastName}</h3>
            <p className="offer-detail">
              {intlTarget.fromClubName} · {COUNTRY_LABEL[intlTarget.country]} ·
              {' '}indemnité demandée {formatEuros(intlTarget.askingPrice)}
            </p>
            <label>
              Indemnité de transfert
              <input
                type="number"
                step={50_000}
                value={intlFee}
                onChange={e => setIntlFee(Number(e.target.value))}
              />
            </label>
            <label>
              Salaire annuel
              <input
                type="number"
                step={10_000}
                value={intlSalary}
                onChange={e => setIntlSalary(Number(e.target.value))}
              />
            </label>
            <label>
              Durée (années)
              <input
                type="number"
                min={1}
                max={5}
                value={intlYears}
                onChange={e => setIntlYears(Number(e.target.value))}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const outcome = international.onBid(intlTarget, {
                    fee: intlFee,
                    annualSalary: intlSalary,
                    years: intlYears,
                  });
                  setFeedback(outcome.message);
                  if (outcome.ok) setIntlTarget(null);
                }}
              >
                Envoyer l'offre
              </button>
              <button type="button" onClick={() => setIntlTarget(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'LIBRES' && (
      <div className="dashboard-panel">
        <div className="panel-tag">Agents libres ({freeAgents.length})</div>
        {freeAgents.length === 0 && <p className="empty">Aucun joueur libre disponible.</p>}
        {freeAgents.length > 0 && (
          <table className="finances-history">
            <thead>
              <tr>
                <th>Nom</th><th>Poste</th><th>Âge</th><th>Niveau</th><th>Potentiel</th>
                <th>Dernier salaire</th><th>Scout</th><th></th>
              </tr>
            </thead>
            <tbody>
              {freeAgents.map(p => {
                const age = currentSeason - Number(p.birthDate.slice(0, 4));
                const fit = evaluateIdentityFit(playerClub, p);
                // V0.15 : hors de son effectif, on ne voit qu'une estimation.
                const familiarity = scouting.knowledge.get(p.id)?.familiarity ?? 0;
                const certainty = certaintyFor(familiarity);
                const ability = estimateAttribute(approximateOverall(p), familiarity, `${p.id}_overall`, 14);
                const potential = estimatePotential(p, familiarity, currentSeason);
                const watched = scouting.assignments.includes(p.id);
                const slotsFull = scouting.assignments.length >= scoutingSlots;
                return (
                  <tr key={p.id}>
                    <td>
                      {p.firstName} {p.lastName}
                      {fit.fit === 'GOOD' && <span className="pc-tag young" style={{ marginLeft: 6 }}>colle</span>}
                      {fit.fit === 'BAD' && <span className="pc-tag injury" style={{ marginLeft: 6 }}>contre-culture</span>}
                    </td>
                    <td className="c-pos"><PositionBadge position={p.position} /></td>
                    <td>{age}</td>
                    <td title={CERTAINTY_LABEL[certainty]}>{ability.display}</td>
                    <td className="potential-cell" title={CERTAINTY_LABEL[certainty]}>{potential.display}</td>
                    <td>{formatEuros(p.contract.annualSalary)}</td>
                    <td>
                      <button
                        type="button"
                        className={watched ? 'scout-btn watching' : 'scout-btn'}
                        disabled={!watched && slotsFull}
                        title={
                          watched ? 'Retirer de la surveillance'
                            : slotsFull ? 'Tous les créneaux de scouting sont occupés'
                              : 'Envoyer le scout observer ce joueur'
                        }
                        onClick={() => (watched ? onUnassignScout(p.id) : onAssignScout(p.id))}
                      >
                        {watched ? '👁 suivi' : 'observer'}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => openOfferDialog(p)}>Faire offre</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      {/* ---- Négociation d'un transfert (V0.28) ------------------------------ */}
      {target && preview && (() => {
        const age = currentSeason - Number(target.birthDate.slice(0, 4));
        const value = preview.valueRange;
        const fit = evaluateIdentityFit(playerClub, target);
        const signed = bidResult?.kind === 'SIGNED';

        const askingPrice = bidResult?.kind === 'REFUSED'
          ? bidResult.resolution.clubResponse.counterFee
          : undefined;
        const feeSliderMax = Math.max(
          2_000_000,
          preview.suggestedFee * 4,
          askingPrice !== undefined ? askingPrice * 1.15 : 0,
        );

        // V0.64 — seule la première annuité sort tout de suite : c'est elle que
        // la trésorerie doit couvrir, et non l'indemnité entière.
        const upfront = Math.round(fee / instalments);
        const feeOverBudget = upfront > preview.balance;
        const salaryOverBudget = bidSalary > preview.payrollHeadroom;
        const canSubmit = !signed && !preview.blocked && preview.cooldownRounds === 0
          && !feeOverBudget && !salaryOverBudget;

        return (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal bid-modal">
              <div className="modal-header">
                <span className="modal-tag">Offre de transfert</span>
                <h3>{target.firstName} {target.lastName}</h3>
                <p className="modal-context">
                  {preview.sellingClubName} • {target.position.replaceAll('_', ' ').toLowerCase()} • {age} ans
                  {' • '}contrat jusqu'en {target.contract.endSeason}
                  {preview.contractYearsLeft <= 1 && <span className="bid-flag hot"> fin de contrat</span>}
                </p>
                {fit.fit === 'BAD' && (
                  <p className="modal-context jiff-warning">⚠ {fit.reason} Le vestiaire encaissera mal cette arrivée.</p>
                )}
              </div>

              <div className="bid-body">
                {/* Ce que le service recrutement sait — pas ce que le vendeur demande. */}
                <div className="bid-facts">
                  <div className="bid-fact">
                    <span className="bf-label">Valeur estimée</span>
                    <span className="bf-value">
                      {value.certainty === 'INCONNU'
                        ? <span className="bf-unknown">jamais observé</span>
                        : `${formatEuros(value.min)} – ${formatEuros(value.max)}`}
                    </span>
                  </div>
                  <div className="bid-fact">
                    <span className="bf-label">Salaire actuel</span>
                    <span className="bf-value">{formatEuros(preview.currentSalary)}/an</span>
                  </div>
                  <div className="bid-fact">
                    <span className="bf-label">Attend environ</span>
                    <span className="bf-value">{formatEuros(preview.expectedSalary)}/an</span>
                  </div>
                  <div className="bid-fact">
                    <span className="bf-label">Trésorerie</span>
                    <span className={`bf-value ${feeOverBudget ? 'over' : ''}`}>{formatEuros(preview.balance)}</span>
                  </div>
                  <div className="bid-fact">
                    <span className="bf-label">Marge salariale</span>
                    <span className={`bf-value ${salaryOverBudget ? 'over' : ''}`}>{formatEuros(preview.payrollHeadroom)}/an</span>
                  </div>
                  {/* V0.64 — ce qu'on doit savoir avant de miser : qui d'autre
                      suit le joueur, et à qui l'on parle. Affiché ici et pas
                      après le refus : perdre une cible qu'on savait convoitée
                      est une décision, l'apprendre après coup est un tirage. */}
                  <div className="bid-fact">
                    <span className="bf-label">Clubs sur le coup</span>
                    <span className={`bf-value ${preview.interestedClubs >= 3 ? 'over' : ''}`}>
                      {preview.interestedClubs === 0 ? 'aucun' : preview.interestedClubs}
                    </span>
                  </div>
                  <div className="bid-fact">
                    <span className="bf-label">Agent</span>
                    <span className="bf-value">{preview.agentName}</span>
                  </div>
                  <div className="bid-fact">
                    <span className="bf-label">Commission</span>
                    <span className="bf-value">{formatEuros(preview.agentCommission)}</span>
                  </div>
                </div>

                {preview.agentStance !== 'NEUTRE' && (
                  <p className={`bid-hint ${preview.agentStance === 'BLOQUE' ? 'bid-agent-blocked' : ''}`}>
                    {preview.agentReason}
                  </p>
                )}

                {value.certainty === 'INCONNU' && (
                  <p className="bid-hint">
                    Aucun rapport de scouting : vous négocierez à l'aveugle sur le prix.
                  </p>
                )}

                <div className="bid-sliders">
                  <label className="bid-slider">
                    <span className="bs-head">
                      Indemnité de transfert
                      <strong className={feeOverBudget ? 'over' : ''}>{formatEuros(fee)}</strong>
                    </span>
                    {/* L'amplitude suit la cible : un curseur 0–40 M€ rendrait
                        impossible le réglage fin sur un joueur à 300 k€. Elle
                        s'élargit dès que le vendeur a annoncé son prix. */}
                    <input
                      type="range"
                      min={0}
                      max={feeSliderMax}
                      step={Math.max(10_000, Math.round(feeSliderMax / 300 / 10_000) * 10_000)}
                      value={Math.min(fee, feeSliderMax)}
                      disabled={signed}
                      onChange={e => setFee(Number(e.target.value))}
                    />
                  </label>
                  <label className="bid-slider">
                    <span className="bs-head">
                      Salaire annuel proposé
                      <strong className={salaryOverBudget ? 'over' : ''}>{formatEuros(bidSalary)}</strong>
                    </span>
                    <input
                      type="range" min={50_000} max={2_500_000} step={10_000} value={bidSalary}
                      disabled={signed}
                      onChange={e => setBidSalary(Number(e.target.value))}
                    />
                  </label>
                  <label className="bid-slider">
                    <span className="bs-head">Durée du contrat<strong>{bidYears} an(s)</strong></span>
                    <input
                      type="range" min={1} max={5} value={bidYears}
                      disabled={signed}
                      onChange={e => setBidYears(Number(e.target.value))}
                    />
                  </label>
                </div>

                {/* V0.64 — le dossier, replié tant qu'on n'en veut pas. */}
                <button
                  type="button"
                  className="bid-terms-toggle"
                  aria-expanded={showTerms}
                  onClick={() => setShowTerms(v => !v)}
                >
                  {showTerms ? 'Masquer le montage' : 'Monter un dossier (échéances, revente, primes)'}
                </button>

                {showTerms && (
                  <div className="bid-sliders bid-terms">
                    <label className="bid-slider">
                      <span className="bs-head">
                        Paiement échelonné
                        <strong>
                          {instalments === 1
                            ? 'comptant'
                            : `${instalments} annuités de ${formatEuros(upfront)}`}
                        </strong>
                      </span>
                      <input
                        type="range" min={1} max={4} value={instalments}
                        disabled={signed}
                        onChange={e => setInstalments(Number(e.target.value))}
                      />
                    </label>
                    <label className="bid-slider">
                      <span className="bs-head">
                        Pourcentage à la revente
                        <strong>{sellOn === 0 ? 'aucun' : `${Math.round(sellOn * 100)} %`}</strong>
                      </span>
                      <input
                        type="range" min={0} max={30} step={5} value={Math.round(sellOn * 100)}
                        disabled={signed}
                        onChange={e => setSellOn(Number(e.target.value) / 100)}
                      />
                    </label>
                    <label className="bid-slider">
                      <span className="bs-head">
                        Prime par match disputé
                        <strong>{matchBonus === 0 ? 'aucune' : `${formatEuros(matchBonus)}`}</strong>
                      </span>
                      <input
                        type="range" min={0} max={20_000} step={1_000} value={matchBonus}
                        disabled={signed}
                        onChange={e => setMatchBonus(Number(e.target.value))}
                      />
                    </label>
                    <label className="bid-slider">
                      <span className="bs-head">
                        Clause libératoire
                        <strong>{releaseClause === 0 ? 'aucune' : formatEuros(releaseClause)}</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={Math.round(feeSliderMax * 2)}
                        step={100_000}
                        value={Math.min(releaseClause, Math.round(feeSliderMax * 2))}
                        disabled={signed}
                        onChange={e => setReleaseClause(Number(e.target.value))}
                      />
                    </label>
                    <p className="bid-hint">
                      Étaler l'indemnité soulage la trésorerie mais fait baisser ce que le
                      vendeur en retire. Une prime et une clause libératoire, elles, rendent
                      le contrat plus attirant pour le joueur.
                    </p>
                  </div>
                )}

                {/* Réponse. Le refus doit toujours être attribué : sans savoir qui a
                    dit non, le manager ne sait pas quel curseur bouger. */}
                {bidResult && bidResult.kind === 'BLOCKED' && (
                  <div className="bid-response refused"><strong>Impossible</strong><p>{bidResult.reason}</p></div>
                )}
                {bidResult && bidResult.kind === 'REFUSED' && (() => {
                  const counter = bidResult.resolution.clubResponse.counterFee;
                  return (
                    <div className={`bid-response ${counter !== undefined ? 'negotiating' : 'refused'}`}>
                      <strong>
                        {bidResult.resolution.refusedBy === 'CLUB'
                          ? `${preview.sellingClubName} refuse`
                          : `${target.lastName} refuse`}
                      </strong>
                      <p>
                        {(bidResult.resolution.playerResponse ?? bidResult.resolution.clubResponse).reason}
                      </p>
                      {counter !== undefined ? (
                        <button
                          type="button"
                          className="bid-meet-price"
                          onClick={() => setFee(counter)}
                          disabled={counter > preview.balance}
                        >
                          {counter > preview.balance
                            ? 'Hors de portée de votre trésorerie'
                            : `Aligner l'offre sur ${formatEuros(counter)}`}
                        </button>
                      ) : (
                        <p className="bid-cooldown">
                          Nouvelle approche possible dans {bidResult.cooldownRounds} journée(s).
                        </p>
                      )}
                    </div>
                  );
                })()}
                {bidResult && bidResult.kind === 'LOST' && (
                  <div className="bid-response refused">
                    <strong>Doublé sur le fil</strong>
                    <p>{bidResult.reason}</p>
                  </div>
                )}
                {bidResult && bidResult.kind === 'SIGNED' && (
                  <div className="bid-response accepted">
                    <strong>Accord trouvé</strong>
                    <p>{target.firstName} {target.lastName} signe pour {bidYears} an(s).</p>
                  </div>
                )}

                {!bidResult && preview.cooldownRounds > 0 && (
                  <div className="bid-response refused">
                    <strong>Approche récente</strong>
                    <p>Ce joueur a déjà été sollicité. Réessayez dans {preview.cooldownRounds} journée(s).</p>
                  </div>
                )}
                {!bidResult && preview.blocked && (
                  <div className="bid-response refused"><strong>Impossible</strong><p>{preview.blocked}</p></div>
                )}
              </div>

              <div className="modal-footer">
                {!signed && (
                  <button type="button" className="primary" disabled={!canSubmit} onClick={submitBid}>
                    {bidResult ? 'Améliorer l\'offre' : 'Soumettre l\'offre'}
                  </button>
                )}
                <button type="button" onClick={closeBidDialog} className="modal-skip">
                  {signed ? 'Fermer' : 'Abandonner'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedFA && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-tag">Offre de signature</span>
              <h3>{selectedFA.firstName} {selectedFA.lastName}</h3>
              <p className="modal-context">
                {selectedFA.position} • {currentSeason - Number(selectedFA.birthDate.slice(0, 4))} ans • niveau ~{approximateOverall(selectedFA)}
              </p>
              <p className="modal-context" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Salaire de marché estimé : {formatEuros(expectedMarketSalary(selectedFA, currentSeason))}/an
              </p>
              {(() => {
                const fit = evaluateIdentityFit(playerClub, selectedFA);
                if (fit.fit === 'BAD') {
                  return (
                    <p className="modal-context jiff-warning">
                      ⚠ {fit.reason} Le vestiaire encaissera mal cette signature.
                    </p>
                  );
                }
                if (fit.fit === 'GOOD') {
                  return (
                    <p className="modal-context" style={{ color: 'var(--green, #4c4)', fontSize: 11 }}>
                      ✓ {fit.reason}
                    </p>
                  );
                }
                return null;
              })()}
            </div>
            <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                Durée : {offerYears} an(s)
                <input
                  type="range" min={1} max={5} value={offerYears}
                  onChange={e => setOfferYears(Number(e.target.value))}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                Salaire annuel : {formatEuros(offerSalary)}
                <input
                  type="range" min={50_000} max={2_000_000} step={10_000} value={offerSalary}
                  onChange={e => setOfferSalary(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="primary" onClick={submitOffer}>
                Proposer
              </button>
              <button type="button" onClick={() => setSelectedFA(null)} className="modal-skip">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
