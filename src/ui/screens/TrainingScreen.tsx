/**
 * Écran Entraînement — V0.14.
 *
 * C'est ici que le manager agit sur ses joueurs, ce qui était jusqu'ici impossible :
 * l'entraînement ne produisait qu'un bonus tactique d'un match, et la progression
 * se réduisait à une courbe d'âge.
 *
 * L'écran expose les trois leviers du développement :
 *   - le **focus d'entraînement** de chaque joueur
 *   - son **temps de jeu**, qui est de loin le facteur dominant
 *   - la **qualité de l'encadrement**, agrégée depuis le staff du club
 */

import { useMemo, useState } from 'react';
import type { Player, PlayerId } from '../../engine/types.js';
import type { CoachingQuality, TrainingFocus } from '../../engine/club/development.js';
import {
  TRAINING_FOCUS_DESCRIPTION,
  TRAINING_FOCUS_LABEL,
  playingTimeFactor,
  approximateOverall,
} from '../../engine/club/development.js';
import { staffRoleLabel, type StaffMember } from '../../engine/club/staff.js';
import {
  DELEGATION_DESCRIPTION,
  DELEGATION_LABEL,
  type DelegationArea,
  type DelegationSummary,
} from '../../engine/club/delegation.js';
import {
  ROLE_EFFECT,
  staffPayroll,
  type HireVerdict,
  type StaffCandidate,
} from '../../engine/club/staff-market.js';
import { estimatePotential, upsideLabel, type ScoutingState } from '../../engine/club/scouting.js';
import {
  FOCUS_LABEL,
  INVESTMENT_HINT,
  INVESTMENT_LABEL,
  PROSPECT_VERDICT_LABEL,
  academyRecord,
  prospectStatus,
  type AcademyFocus,
  type AcademyInvestment,
  type AcademyState,
  type ProspectRecord,
} from '../../engine/club/academy.js';

function formatEuros(n: number): string {
  return Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M€` : `${Math.round(n / 1_000)} k€`;
}

interface Props {
  readonly roster: readonly Player[];
  readonly trainingByPlayer: ReadonlyMap<PlayerId, TrainingFocus>;
  readonly seasonStats: ReadonlyMap<PlayerId, { readonly tries: number; readonly matches: number; readonly minutes: number }>;
  readonly coaching: CoachingQuality;
  readonly staff: readonly StaffMember[];
  /** V0.15 — connaissance des joueurs, qui remplace l'approximation par l'âge. */
  readonly scouting: ScoutingState;
  readonly currentSeason: number;
  readonly onSetFocus: (playerId: PlayerId, focus: TrainingFocus) => void;
  readonly onSetFocusForAll: (focus: TrainingFocus) => void;
  /**
   * V0.55 — joueurs mis au repos cette semaine.
   *
   * Le repos récupère franchement et met à l'abri des blessures, mais fait
   * perdre du rythme : c'est l'arbitrage qui manquait à la semaine.
   */
  readonly rested?: ReadonlySet<PlayerId>;
  readonly onToggleRest?: (playerId: PlayerId) => void;
  readonly onBack: () => void;
  /**
   * V0.39 — centre de formation. L'académie produisait des jeunes sans que le
   * manager ait jamais rien décidé : c'était le dernier grand système du jeu où
   * il était spectateur.
   */
  readonly academy: AcademyState;
  readonly academyCostPerSeason: number;
  readonly academyTarget: number;
  readonly onSetAcademy: (plan: { investment?: AcademyInvestment; focus?: AcademyFocus }) => void;
  /**
   * V0.43 — espoirs sortis du centre. Sans ce suivi, l'investissement dans la
   * formation ne se jugeait à rien : les jeunes se fondaient dans l'effectif
   * dès leur arrivée.
   */
  readonly prospects: readonly ProspectRecord[];
  /** V0.44 — techniciens disponibles cette saison. */
  readonly staffMarket: readonly StaffCandidate[];
  /**
   * V0.62 — la délégation au staff.
   *
   * Troisième pilier du GDD, jamais implémenté : le staff se recrutait, pesait
   * sur la progression, et ne décidait jamais rien.
   */
  readonly delegation?: {
    readonly summaries: readonly DelegationSummary[];
    readonly onToggle: (area: DelegationArea) => void;
  };
  readonly treasury: number;
  readonly hireVerdict: (candidate: StaffCandidate) => HireVerdict;
  readonly onHireStaff: (candidate: StaffCandidate) => void;
}

const FOCUS_ORDER: readonly TrainingFocus[] = [
  'EQUILIBRE', 'PHYSIQUE', 'TECHNIQUE', 'POSTE', 'MENTAL', 'RECUPERATION',
];

function ageOf(player: Player, season: number): number {
  return season - Number(player.birthDate.slice(0, 4));
}

/** Traduit le facteur de temps de jeu en une appréciation lisible. */
function playingTimeLabel(minutes: number): { label: string; tone: 'good' | 'mid' | 'bad' } {
  const factor = playingTimeFactor(minutes);
  if (factor >= 1.10) return { label: 'Temps de jeu idéal', tone: 'good' };
  if (factor >= 0.80) return { label: 'Temps de jeu correct', tone: 'good' };
  if (factor >= 0.52) return { label: 'Trop peu joué', tone: 'mid' };
  if (minutes > 0) return { label: 'Marginal', tone: 'bad' };
  return { label: 'N\'a pas joué', tone: 'bad' };
}

function coachingTone(value: number): 'good' | 'mid' | 'bad' {
  if (value >= 70) return 'good';
  if (value >= 48) return 'mid';
  return 'bad';
}

export function TrainingScreen({
  roster, trainingByPlayer, seasonStats, coaching, staff, scouting, currentSeason,
  onSetFocus, onSetFocusForAll, onBack, rested, onToggleRest,
  academy, academyCostPerSeason, academyTarget, onSetAcademy, prospects,
  staffMarket, treasury, hireVerdict, onHireStaff, delegation,
}: Props) {
  const [sortBy, setSortBy] = useState<'minutes' | 'age' | 'name'>('minutes');
  const [marketOpen, setMarketOpen] = useState(false);

  const active = useMemo(
    () => roster.filter(p => !p.retired && !p.freeAgent),
    [roster],
  );

  const sorted = useMemo(() => {
    const rows = [...active];
    if (sortBy === 'minutes') {
      rows.sort((a, b) => (seasonStats.get(b.id)?.minutes ?? 0) - (seasonStats.get(a.id)?.minutes ?? 0));
    } else if (sortBy === 'age') {
      rows.sort((a, b) => ageOf(a, currentSeason) - ageOf(b, currentSeason));
    } else {
      rows.sort((a, b) => a.lastName.localeCompare(b.lastName));
    }
    return rows;
  }, [active, sortBy, seasonStats, currentSeason]);

  const coachingRows: readonly { key: keyof CoachingQuality; label: string }[] = [
    { key: 'physique', label: 'Préparation physique' },
    { key: 'technique', label: 'Technique' },
    { key: 'mental', label: 'Mental' },
    { key: 'formation', label: 'Formation des jeunes' },
  ];

  return (
    <section className="training-screen">
      <div className="screen-head">
        <h2>Entraînement</h2>
        <span className="screen-head-meta">
          Les progrès s'appliquent à l'intersaison — le temps de jeu compte plus que tout le reste.
        </span>
        <button onClick={onBack} type="button" className="ghost">← Retour</button>
      </div>

      <div className="training-layout">
        {/* ---- Centre de formation (V0.39) ---------------------------------- */}
        <div className="dashboard-panel academy-panel">
          <div className="panel-tag">Centre de formation</div>

          <div className="academy-level">
            <span className="al-value">{academy.level.toFixed(1)}</span>
            <span className="al-scale">/ 5</span>
            <span className="al-target">
              {academy.level < academyTarget - 0.05 ? `progresse vers ${academyTarget.toFixed(1)}`
                : academy.level > academyTarget + 0.05 ? `redescend vers ${academyTarget.toFixed(1)}`
                  : 'stabilisé'}
            </span>
          </div>
          <div className="al-bar">
            <span className="al-fill" style={{ width: `${(academy.level / 5) * 100}%` }} />
            {/* Repère de la cible : c'est là que le centre finira par se poser. */}
            <span className="al-goal" style={{ left: `${(academyTarget / 5) * 100}%` }} />
          </div>

          <div className="prep-row">
            <div className="prep-label">Investissement</div>
            <div className="seg-btn">
              {(['MINIMAL', 'MODERE', 'SOUTENU', 'MAXIMAL'] as AcademyInvestment[]).map(i => (
                <button
                  key={i}
                  type="button"
                  className={i === academy.investment ? 'active' : ''}
                  onClick={() => onSetAcademy({ investment: i })}
                >
                  {INVESTMENT_LABEL[i]}
                </button>
              ))}
            </div>
            <div className="prep-hint">
              {INVESTMENT_HINT[academy.investment]}
              {' '}<strong>{formatEuros(academyCostPerSeason)}/saison.</strong>
            </div>
          </div>

          <div className="prep-row">
            <div className="prep-label">Orientation</div>
            <div className="seg-btn">
              {(['AVANTS', 'EQUILIBRE', 'TROIS_QUARTS'] as AcademyFocus[]).map(f => (
                <button
                  key={f}
                  type="button"
                  className={f === academy.focus ? 'active' : ''}
                  onClick={() => onSetAcademy({ focus: f })}
                >
                  {f === 'AVANTS' ? 'Avants' : f === 'EQUILIBRE' ? 'Équilibrée' : 'Trois-quarts'}
                </button>
              ))}
            </div>
            <div className="prep-hint">
              {FOCUS_LABEL[academy.focus]} — décide des postes formés, pas de la qualité.
              Celle-ci vient de l'investissement.
            </div>
          </div>

          <p className="academy-note">
            Le niveau du centre ne suit pas le budget de l'année : il y converge sur plusieurs
            saisons. Investir un an puis couper ne donne rien.
          </p>
        </div>

        <ProspectsPanel
          prospects={prospects}
          roster={roster}
          seasonStats={seasonStats}
          currentSeason={currentSeason}
        />

        {/* ---- Délégation ---------------------------------------------------- */}
        {delegation && (
          <div className="dashboard-panel">
            <div className="panel-tag">Ce que vous confiez au staff</div>
            <p className="deleg-intro">
              Rien n'est délégué tant que vous ne le décidez pas, et tout se
              reprend d'un clic. L'adjoint décide comme un adjoint : sa
              compétence fixe la qualité de ce qu'il choisit à votre place.
            </p>
            <ul className="deleg-list">
              {delegation.summaries.map(item => (
                <li key={item.area} className={item.delegated ? 'on' : ''}>
                  <label className="deleg-row">
                    <input
                      type="checkbox"
                      checked={item.delegated}
                      onChange={() => delegation.onToggle(item.area)}
                    />
                    <span className="deleg-body">
                      <span className="deleg-label">{DELEGATION_LABEL[item.area]}</span>
                      <span className="deleg-desc">{DELEGATION_DESCRIPTION[item.area]}</span>
                      <span className={`deleg-owner ${item.quality >= 60 ? 'ok' : 'faible'}`}>
                        {item.verdict}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---- Encadrement --------------------------------------------------- */}
        <div className="dashboard-panel">
          <div className="panel-tag">Encadrement</div>
          <ul className="coaching-list">
            {coachingRows.map(row => {
              const value = coaching[row.key];
              return (
                <li key={row.key} className={`coaching-row ${coachingTone(value)}`}>
                  <span className="coaching-label">{row.label}</span>
                  <span className="coaching-bar-wrap">
                    <span className="coaching-bar" style={{ width: `${value}%` }} />
                  </span>
                  <span className="coaching-value">{value}</span>
                </li>
              );
            })}
          </ul>

          <div className="staff-list">
            <div className="staff-list-tag">Staff technique</div>
            {staff
              .filter(m => m.role !== 'PRESIDENT')
              .map(m => (
                <div key={m.id} className="staff-row">
                  <span className="staff-name">{m.firstName} {m.lastName}</span>
                  <span className="staff-role">{staffRoleLabel(m.role)}</span>
                  <span className={`staff-quality ${coachingTone(m.quality)}`}>{m.quality}</span>
                </div>
              ))}
          </div>

          {/* V0.44 — l'encadrement se recrute. Il pilotait déjà la progression
              des joueurs, les créneaux du scout et la formation : c'était le
              levier le plus profond du jeu, et le seul sans aucune prise. */}
          <div className="staff-payroll">
            <span>Masse salariale du staff</span>
            <strong>{Math.round(staffPayroll(staff) / 1000)} k€/an</strong>
          </div>
          <button
            type="button"
            className="secondary staff-market-toggle"
            onClick={() => setMarketOpen(o => !o)}
          >
            {marketOpen ? 'Fermer le marché' : 'Marché des techniciens'}
          </button>

          {marketOpen && (
            <StaffMarketPanel
              market={staffMarket}
              staff={staff}
              treasury={treasury}
              verdictFor={hireVerdict}
              onHire={onHireStaff}
            />
          )}
        </div>

        {/* ---- Effectif ------------------------------------------------------ */}
        <div className="dashboard-panel training-main">
          <div className="training-toolbar">
            <div className="panel-tag">Effectif ({sorted.length})</div>
            <div className="training-actions">
              <label className="training-sort">
                Trier
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                  <option value="minutes">Temps de jeu</option>
                  <option value="age">Âge</option>
                  <option value="name">Nom</option>
                </select>
              </label>
              <label className="training-sort">
                Tout l'effectif
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) onSetFocusForAll(e.target.value as TrainingFocus);
                  }}
                >
                  <option value="">Appliquer un focus…</option>
                  {FOCUS_ORDER.map(f => (
                    <option key={f} value={f}>{TRAINING_FOCUS_LABEL[f]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="training-scroll">
            <table className="training-table">
              <thead>
                <tr>
                  <th className="col-player">Joueur</th>
                  <th className="num-head">Âge</th>
                  <th className="num-head">Minutes</th>
                  <th className="col-wide">Situation</th>
                  <th className="num-head">Potentiel</th>
                  <th className="col-wide">Focus d'entraînement</th>
                  <th>Repos</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(player => {
                  const minutes = seasonStats.get(player.id)?.minutes ?? 0;
                  const age = ageOf(player, currentSeason);
                  const time = playingTimeLabel(minutes);
                  const focus = trainingByPlayer.get(player.id) ?? 'EQUILIBRE';
                  const familiarity = scouting.knowledge.get(player.id)?.familiarity ?? 0;
                  const potential = estimatePotential(player, familiarity, currentSeason);
                  return (
                    <tr key={player.id}>
                      <td className="col-player">
                        <span className="sheet-name">{player.firstName} {player.lastName}</span>
                        <span className="sheet-pos">{player.position.replaceAll('_', ' ').toLowerCase()}</span>
                      </td>
                      <td className="mono">{age}</td>
                      <td className="mono">{minutes}</td>
                      <td className="col-wide">
                        <span className={`time-pill ${time.tone}`}>{time.label}</span>
                        <span className="upside">{upsideLabel(player, familiarity, currentSeason)}</span>
                      </td>
                      <td className="mono potential-cell">{potential.display}</td>
                      <td className="col-wide">
                        <select
                          className="focus-select"
                          value={focus}
                          onChange={e => onSetFocus(player.id, e.target.value as TrainingFocus)}
                          title={TRAINING_FOCUS_DESCRIPTION[focus]}
                        >
                          {FOCUS_ORDER.map(f => (
                            <option key={f} value={f}>{TRAINING_FOCUS_LABEL[f]}</option>
                          ))}
                        </select>
                      </td>
                      {/* V0.55 — ménager un homme sans ménager tout le groupe.
                          La charge était collective : impossible de préserver
                          un cadre de 34 ans en poussant les jeunes. */}
                      <td>
                        <input
                          type="checkbox"
                          className="rest-check"
                          checked={rested?.has(player.id) ?? false}
                          onChange={() => onToggleRest?.(player.id)}
                          disabled={onToggleRest === undefined}
                          title="Le mettre au repos cette semaine : il récupère, ne risque rien, et perd un peu de rythme."
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Espoirs du centre — V0.43
// =============================================================================

/**
 * Ce que sont devenus les jeunes formés au club.
 *
 * On juge sur la **progression depuis la sortie du centre**, jamais sur le
 * niveau brut : +6 en deux ans vaut autant à 55 qu'à 70, et c'est la seule
 * lecture qui dise si l'investissement a servi à quelque chose.
 */
function ProspectsPanel({
  prospects, roster, seasonStats, currentSeason,
}: {
  readonly prospects: readonly ProspectRecord[];
  readonly roster: readonly Player[];
  readonly seasonStats: ReadonlyMap<PlayerId, { readonly tries: number; readonly matches: number; readonly minutes: number }>;
  readonly currentSeason: number;
}) {
  const byId = new Map(roster.map(p => [p.id as string, p]));

  const statuses = prospects
    .map(record => {
      const player = byId.get(record.playerId as string);
      const alive = player && !player.retired && !player.freeAgent ? player : undefined;
      return prospectStatus(
        record,
        alive
          ? { overall: approximateOverall(alive), age: ageOf(alive, currentSeason) }
          : undefined,
        seasonStats.get(record.playerId)?.matches ?? 0,
        currentSeason,
      );
    })
    // Les promotions récentes en tête : c'est là que se joue la décision de
    // donner ou non du temps de jeu.
    .sort((a, b) => b.record.intakeSeason - a.record.intakeSeason
      || b.progression - a.progression);

  const bilan = academyRecord(statuses);

  return (
    <div className="dashboard-panel prospects-panel">
      <div className="panel-tag">Espoirs formés au club</div>

      {statuses.length === 0 ? (
        <p className="academy-note">
          Aucune promotion suivie pour l'instant. La première sortira à l'intersaison.
        </p>
      ) : (
        <>
          <ul className="prospect-summary">
            <li><span>Suivis</span><strong>{bilan.tracked}</strong></li>
            <li><span>Percées</span><strong>{bilan.breakthroughs}</strong></li>
            <li><span>Encore au club</span><strong>{bilan.stillAtClub}</strong></li>
            <li>
              <span>Progression moyenne</span>
              <strong className={bilan.averageProgression >= 0 ? 'up' : 'down'}>
                {bilan.averageProgression >= 0 ? '+' : ''}{bilan.averageProgression}
              </strong>
            </li>
          </ul>

          <ul className="prospect-list">
            {statuses.map(s => {
              const player = byId.get(s.record.playerId as string);
              return (
                <li key={s.record.playerId as string} className={`prospect-row v-${s.verdict.toLowerCase()}`}>
                  <span className="pr-name">
                    {player ? `${player.firstName} ${player.lastName}` : 'Joueur parti'}
                  </span>
                  <span className="pr-intake">promo {s.record.intakeSeason}</span>
                  <span className="pr-age">{s.stillHere ? `${s.age} ans` : '—'}</span>
                  <span className="pr-level">
                    {s.record.intakeOverall} → <strong>{s.stillHere ? s.currentOverall : '—'}</strong>
                  </span>
                  <span className={`pr-prog ${s.progression >= 0 ? 'up' : 'down'}`}>
                    {s.progression >= 0 ? '+' : ''}{s.progression}
                  </span>
                  <span className="pr-matches">{s.matchesPlayed} m.</span>
                  <span className={`pr-verdict v-${s.verdict.toLowerCase()}`}>
                    {PROSPECT_VERDICT_LABEL[s.verdict]}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Marché des techniciens — V0.44
// =============================================================================

/**
 * Le vivier disponible, et ce que chaque signature coûterait.
 *
 * On affiche le **titulaire en place** en face de chaque candidat : un
 * recrutement de staff n'a de sens que comparé à ce qu'on a déjà, et embaucher
 * revient toujours à congédier quelqu'un — un club n'a qu'un adjoint avants.
 */
function StaffMarketPanel({
  market, staff, treasury, verdictFor, onHire,
}: {
  readonly market: readonly StaffCandidate[];
  readonly staff: readonly StaffMember[];
  readonly treasury: number;
  readonly verdictFor: (candidate: StaffCandidate) => HireVerdict;
  readonly onHire: (candidate: StaffCandidate) => void;
}) {
  if (market.length === 0) {
    return <p className="academy-note">Aucun technicien sur le marché cette saison.</p>;
  }

  return (
    <ul className="staff-market">
      {market.map(c => {
        const holder = staff.find(m => m.role === c.role);
        const verdict = verdictFor(c);
        const upgrade = holder ? c.quality - holder.quality : c.quality;
        const affordable = treasury >= c.askingSalary;

        return (
          <li key={c.id} className="staff-cand">
            <div className="sc-head">
              <span className="sc-name">{c.firstName} {c.lastName}</span>
              <span className="sc-role">{staffRoleLabel(c.role)}</span>
              <span className={`sc-quality ${coachingTone(c.quality)}`}>{c.quality}</span>
            </div>
            <p className="sc-tagline">{c.tagline}</p>
            <p className="sc-effect">{ROLE_EFFECT[c.role]}</p>

            <div className="sc-compare">
              <span>
                En place : {holder ? `${holder.lastName} (${holder.quality})` : 'personne'}
              </span>
              <span className={upgrade >= 0 ? 'up' : 'down'}>
                {upgrade >= 0 ? '+' : ''}{upgrade}
              </span>
            </div>

            <div className="sc-foot">
              <span className="sc-salary">{Math.round(c.askingSalary / 1000)} k€/an</span>
              <button
                type="button"
                className="primary sc-hire"
                disabled={!verdict.accepted || !affordable}
                title={verdict.accepted ? undefined : verdict.message}
                onClick={() => onHire(c)}
              >
                Engager
              </button>
            </div>
            {/* Un refus doit se lire avant le clic, pas après. */}
            {!verdict.accepted && <p className="sc-refusal">{verdict.message}</p>}
            {verdict.accepted && !affordable && (
              <p className="sc-refusal">Trésorerie insuffisante.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
