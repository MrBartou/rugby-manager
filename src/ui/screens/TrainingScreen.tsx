/**
 * Écran Entraînement : V0.14, remis en forme en V0.62.1.
 *
 * C'est ici que le manager agit sur ses joueurs, ce qui était jusqu'ici
 * impossible : l'entraînement ne produisait qu'un bonus tactique d'un match, et
 * la progression se réduisait à une courbe d'âge.
 *
 * L'écran expose les trois leviers du développement :
 *   - le **focus d'entraînement** de chaque joueur
 *   - son **temps de jeu**, qui est de loin le facteur dominant
 *   - la **qualité de l'encadrement**, agrégée depuis le staff du club
 *
 * ## Ce que la mise en page ratait
 *
 * Cinq panneaux avaient été ajoutés au fil de six versions dans une grille à
 * deux colonnes qui les plaçait dans l'ordre du code. Personne n'a resitué les
 * suivants : l'effectif, le tableau de vingt-huit lignes qui est le travail
 * même de l'écran, avait fini dans la colonne étroite, à deux cent soixante-dix
 * pixels de large et mille quatre cents de haut, sous un panneau de délégation
 * qui occupait toute la hauteur d'un écran.
 *
 * D'où le placement explicite : le tableau tient la colonne large, les
 * panneaux de décision se rangent dans une colonne latérale, et le suivi des
 * espoirs, qui est une liste large, passe en pleine largeur dessous. Une grille
 * qui laisse tomber ses enfants là où ils viennent se dérègle à chaque ajout ;
 * une grille nommée refuse le nouvel arrivant tant qu'on ne lui a pas dit où il
 * va.
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
import { Interrupteur } from '../components/Interrupteur.js';

function formatEuros(n: number): string {
  return Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M€` : `${Math.round(n / 1_000)} k€`;
}

interface Props {
  readonly roster: readonly Player[];
  readonly trainingByPlayer: ReadonlyMap<PlayerId, TrainingFocus>;
  readonly seasonStats: ReadonlyMap<PlayerId, { readonly tries: number; readonly matches: number; readonly minutes: number }>;
  readonly coaching: CoachingQuality;
  readonly staff: readonly StaffMember[];
  /** V0.15 : connaissance des joueurs, qui remplace l'approximation par l'âge. */
  readonly scouting: ScoutingState;
  readonly currentSeason: number;
  readonly onSetFocus: (playerId: PlayerId, focus: TrainingFocus) => void;
  readonly onSetFocusForAll: (focus: TrainingFocus) => void;
  /**
   * V0.55 : joueurs mis au repos cette semaine.
   *
   * Le repos récupère franchement et met à l'abri des blessures, mais fait
   * perdre du rythme : c'est l'arbitrage qui manquait à la semaine.
   */
  readonly rested?: ReadonlySet<PlayerId>;
  readonly onToggleRest?: (playerId: PlayerId) => void;
  readonly onBack: () => void;
  /**
   * V0.39 : centre de formation. L'académie produisait des jeunes sans que le
   * manager ait jamais rien décidé, c'était le dernier grand système du jeu où
   * il était spectateur.
   */
  readonly academy: AcademyState;
  readonly academyCostPerSeason: number;
  readonly academyTarget: number;
  readonly onSetAcademy: (plan: { investment?: AcademyInvestment; focus?: AcademyFocus }) => void;
  /**
   * V0.43 : espoirs sortis du centre. Sans ce suivi, l'investissement dans la
   * formation ne se jugeait à rien, les jeunes se fondaient dans l'effectif
   * dès leur arrivée.
   */
  readonly prospects: readonly ProspectRecord[];
  /** V0.44 : techniciens disponibles cette saison. */
  readonly staffMarket: readonly StaffCandidate[];
  /**
   * V0.62 : la délégation au staff.
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

/**
 * Plafond de la jauge de temps de jeu.
 *
 * `playingTimeFactor` ne récompense plus rien au-delà de 1800 minutes : la
 * jauge s'arrête donc là où le moteur s'arrête, sans quoi elle promettrait un
 * gain qui n'existe pas. Le repère à 1200 marque l'entrée dans la tranche
 * idéale, seul seuil que le manager a intérêt à viser.
 */
const MINUTES_FULL = 1800;
const MINUTES_IDEAL = 1200;

function ageOf(player: Player, season: number): number {
  return season - Number(player.birthDate.slice(0, 4));
}

/**
 * Traduit le facteur de temps de jeu en une appréciation lisible.
 *
 * Les libellés répétaient « Temps de jeu » que la colonne annonce déjà : sur
 * vingt-huit lignes, cela faisait vingt-huit fois le même mot pour rien, et
 * poussait la dernière colonne hors du cadre.
 */
function playingTimeLabel(minutes: number): { label: string; tone: 'good' | 'mid' | 'bad' } {
  const factor = playingTimeFactor(minutes);
  if (factor >= 1.10) return { label: 'Idéal', tone: 'good' };
  if (factor >= 0.80) return { label: 'Correct', tone: 'good' };
  if (factor >= 0.52) return { label: 'Trop peu', tone: 'mid' };
  if (minutes > 0) return { label: 'Marginal', tone: 'bad' };
  return { label: 'Pas joué', tone: 'bad' };
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

  /**
   * Le bilan de la rotation, avant le détail ligne à ligne.
   *
   * Vingt-huit lignes ne disent pas d'elles-mêmes si l'effectif est bien
   * employé : il faut les compter. Le tableau répond à « que faire de cet
   * homme », ce résumé répond à « où en est le groupe », et c'est la question
   * qu'on se pose en arrivant sur l'écran.
   */
  const bilan = useMemo(() => {
    let bien = 0, sous = 0, hors = 0;
    for (const player of active) {
      const tone = playingTimeLabel(seasonStats.get(player.id)?.minutes ?? 0).tone;
      if (tone === 'good') bien++;
      else if (tone === 'mid') sous++;
      else hors++;
    }
    return { bien, sous, hors, repos: active.filter(p => rested?.has(p.id)).length };
  }, [active, seasonStats, rested]);

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
          Les progrès s'appliquent à l'intersaison. Le temps de jeu compte plus
          que tout le reste.
        </span>
        <button onClick={onBack} type="button" className="ghost">← Retour</button>
      </div>

      <div className="training-layout">
        {/* ---- Effectif : le travail même de l'écran, donc la colonne large -- */}
        <div className="dashboard-panel training-main">
          <div className="training-toolbar">
            <div className="training-toolbar-title">
              <div className="panel-tag">Effectif</div>
              <span className="training-count">{sorted.length} joueurs</span>
            </div>
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

          <ul className="training-bilan">
            <li className="tb-good">
              <strong>{bilan.bien}</strong>
              <span>bien employés</span>
            </li>
            <li className="tb-mid">
              <strong>{bilan.sous}</strong>
              <span>trop peu joué</span>
            </li>
            <li className="tb-bad">
              <strong>{bilan.hors}</strong>
              <span>hors rotation</span>
            </li>
            <li className="tb-rest">
              <strong>{bilan.repos}</strong>
              <span>au repos cette semaine</span>
            </li>
          </ul>

          <div className="training-scroll">
            <table className="training-table">
              <thead>
                <tr>
                  <th className="col-player">Joueur</th>
                  <th className="num-head">Âge</th>
                  <th className="col-time">Temps de jeu</th>
                  <th className="col-pot">Potentiel</th>
                  <th className="col-wide">Focus d'entraînement</th>
                  <th className="col-rest">Repos</th>
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
                  const auRepos = rested?.has(player.id) ?? false;
                  return (
                    <tr key={player.id} className={auRepos ? 'is-rested' : ''}>
                      <td className="col-player">
                        <span className="sheet-name">{player.firstName} {player.lastName}</span>
                        <span className="sheet-pos">{player.position.replaceAll('_', ' ').toLowerCase()}</span>
                      </td>
                      <td className="mono">{age}</td>

                      {/* Minutes, jauge et appréciation dans une seule colonne :
                          les trois disent la même chose, les séparer obligeait à
                          lire de gauche à droite pour recomposer une évidence. */}
                      <td className="col-time">
                        <span className="tt-line">
                          <span className="tt-minutes mono">{minutes}</span>
                          <span className="tt-unit">min</span>
                          <span className={`time-pill ${time.tone}`}>{time.label}</span>
                        </span>
                        <span className="tt-bar" aria-hidden>
                          <span
                            className={`tt-fill ${time.tone}`}
                            style={{ width: `${Math.min(100, (minutes / MINUTES_FULL) * 100)}%` }}
                          />
                          <span
                            className="tt-goal"
                            style={{ left: `${(MINUTES_IDEAL / MINUTES_FULL) * 100}%` }}
                          />
                        </span>
                      </td>

                      <td className="col-pot">
                        <span className="tp-value mono">{potential.display}</span>
                        <span className="tp-upside">
                          {upsideLabel(player, familiarity, currentSeason)}
                        </span>
                      </td>

                      <td className="col-wide">
                        <select
                          className="focus-select"
                          value={focus}
                          onChange={e => onSetFocus(player.id, e.target.value as TrainingFocus)}
                          title={TRAINING_FOCUS_DESCRIPTION[focus]}
                          aria-label={`Focus de ${player.lastName}`}
                        >
                          {FOCUS_ORDER.map(f => (
                            <option key={f} value={f}>{TRAINING_FOCUS_LABEL[f]}</option>
                          ))}
                        </select>
                      </td>

                      {/* V0.55 : ménager un homme sans ménager tout le groupe.
                          La charge était collective, impossible de préserver un
                          cadre de 34 ans en poussant les jeunes. */}
                      <td className="col-rest">
                        <Interrupteur
                          checked={auRepos}
                          disabled={onToggleRest === undefined}
                          onChange={() => onToggleRest?.(player.id)}
                          label={`Mettre ${player.firstName} ${player.lastName} au repos`}
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

        {/* ---- Colonne des décisions ---------------------------------------- */}
        <aside className="training-aside">
          {/* ---- Encadrement ------------------------------------------------ */}
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

            {/* V0.44 : l'encadrement se recrute. Il pilotait déjà la progression
                des joueurs, les créneaux du scout et la formation : c'était le
                levier le plus profond du jeu, et le seul sans aucune prise. */}
            <div className="staff-payroll">
              <span>Masse salariale du staff</span>
              <strong>{Math.round(staffPayroll(staff) / 1000)} k€/an</strong>
            </div>
            <button
              type="button"
              className="secondary staff-market-toggle"
              onClick={() => setMarketOpen(true)}
            >
              Marché des techniciens ({staffMarket.length})
            </button>
          </div>

          {/* ---- Délégation -------------------------------------------------- */}
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
                      <span className="deleg-body">
                        <span className="deleg-label">{DELEGATION_LABEL[item.area]}</span>
                        <span className="deleg-desc">{DELEGATION_DESCRIPTION[item.area]}</span>
                        <span className={`deleg-owner ${item.quality >= 60 ? 'ok' : 'faible'}`}>
                          {item.verdict}
                        </span>
                      </span>
                      <Interrupteur
                        checked={item.delegated}
                        onChange={() => delegation.onToggle(item.area)}
                        label={DELEGATION_LABEL[item.area]}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- Centre de formation (V0.39) --------------------------------- */}
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
                {FOCUS_LABEL[academy.focus]} : décide des postes formés, pas de
                la qualité. Celle-ci vient de l'investissement.
              </div>
            </div>

            <p className="academy-note">
              Le niveau du centre ne suit pas le budget de l'année : il y converge
              sur plusieurs saisons. Investir un an puis couper ne donne rien.
            </p>
          </div>
        </aside>

        {/* ---- Espoirs : une liste large, donc pleine largeur ---------------- */}
        <ProspectsPanel
          prospects={prospects}
          roster={roster}
          seasonStats={seasonStats}
          currentSeason={currentSeason}
        />
      </div>

      {marketOpen && (
        <StaffMarketDialog
          market={staffMarket}
          staff={staff}
          treasury={treasury}
          verdictFor={hireVerdict}
          onHire={onHireStaff}
          onClose={() => setMarketOpen(false)}
        />
      )}
    </section>
  );
}

// =============================================================================
// Espoirs du centre : V0.43
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
                  <span className="pr-age">{s.stillHere ? `${s.age} ans` : '·'}</span>
                  <span className="pr-level">
                    {s.record.intakeOverall} → <strong>{s.stillHere ? s.currentOverall : '·'}</strong>
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
// Marché des techniciens : V0.44, sorti du panneau en V0.62.1
// =============================================================================

/**
 * Le vivier disponible, et ce que chaque signature coûterait.
 *
 * On affiche le **titulaire en place** en face de chaque candidat : un
 * recrutement de staff n'a de sens que comparé à ce qu'on a déjà, et embaucher
 * revient toujours à congédier quelqu'un, un club n'ayant qu'un adjoint avants.
 *
 * Le marché s'ouvrait auparavant en accordéon dans le panneau Encadrement, qui
 * vit maintenant dans une colonne latérale : comparer six fiches à trois cents
 * pixels de large ne se pouvait pas. Il prend donc une fenêtre, où les cartes
 * se rangent côte à côte, ce que la comparaison réclame.
 */
function StaffMarketDialog({
  market, staff, treasury, verdictFor, onHire, onClose,
}: {
  readonly market: readonly StaffCandidate[];
  readonly staff: readonly StaffMember[];
  readonly treasury: number;
  readonly verdictFor: (candidate: StaffCandidate) => HireVerdict;
  readonly onHire: (candidate: StaffCandidate) => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal staff-market-modal" onClick={e => e.stopPropagation()}>
        <header className="smm-head">
          <div>
            <span className="panel-tag">Marché des techniciens</span>
            <p className="smm-sub">
              Engager remplace le titulaire du poste : un club n'a qu'un adjoint
              par domaine. La trésorerie disponible est de {formatEuros(treasury)}.
            </p>
          </div>
        </header>

        <div className="smm-body">
          {market.length === 0 ? (
            <p className="academy-note">Aucun technicien sur le marché cette saison.</p>
          ) : (
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
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
