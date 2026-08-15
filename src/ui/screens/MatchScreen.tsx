import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { clubCssVars } from '../theme/club-identity.js';
import type { MatchSetup } from '../App.js';
import { MatchPitch } from '../components/MatchPitch.js';
import { PhaseTimeline } from '../components/PhaseTimeline.js';
import { MatchSummary } from '../components/MatchSummary.js';
import type { MatchSpeed } from '../settings.js';
import { adviseSubstitution } from '../../engine/club/delegation.js';
import { approximateOverall } from '../../engine/club/development.js';
import { LiveMomentModal } from '../components/LiveMomentModal.js';
import { createMatchSession, type MatchSession } from '../../engine/match/session.js';
import { BenchPanel } from '../components/BenchPanel.js';
import {
  DEFENSIVE_LINE_LABEL,
  OCCUPATION_LABEL,
} from '../../engine/match/tactics.js';
import type { PreMatchTacticalPlan } from '../../engine/match/types.js';
import {
  defaultDisplayName,
  generateSaveId,
  matchSaveRepository,
  SCHEMA_VERSION,
} from '../../data/match-save-repository.js';
import { generateStaffForClub } from '../../engine/club/staff.js';
import { formationFor, onFieldAt, type PitchActor } from '../pitch/phase-formation.js';
import { TONE_LABEL, type TalkOutcome } from '../../engine/match/team-talk.js';
import type { IndividualInstructions } from '../../engine/match/instructions.js';
import type { Player, PlayerId } from '../../engine/types.js';

interface Props {
  readonly setup: MatchSetup;
  readonly onBack: () => void;
  /** Si fourni, le bouton "Retour saison" appelle ce callback avec les scores et le matchInput. */
  readonly onMatchFinished?: (
    homeScore: number,
    awayScore: number,
    result: import('../../engine/match/types.js').MatchResult,
    matchInput: import('../../engine/match/types.js').MatchInput,
  ) => void;
  /**
   * V0.62 — vitesse choisie dans les réglages.
   *
   * La rencontre démarre à la vitesse que le joueur a fixée une fois pour
   * toutes, plutôt qu'à celle du code. Elle reste modifiable en cours de match :
   * un réglage par défaut n'est pas un verrou.
   */
  readonly defaultSpeed?: MatchSpeed;
  /**
   * V0.62 — les remplacements confiés à l'adjoint.
   *
   * Absent, le manager décide de tout, comme avant : rien n'est délégué tant
   * qu'on ne l'a pas demandé.
   */
  readonly delegatedSubstitutions?: { readonly quality: number };
}

/** Correspondance entre le réglage et l'échelle interne du lecteur. */
const SPEED_LABEL: Readonly<Record<MatchSpeed, string>> = {
  'x0.5': '×0.5', 'x1': '×1', 'x2': '×2', 'x4': '×4', 'x16': '×16',
};

const SPEEDS = [
  { label: '×0.5', ms: 2400 },   // lent : 2.4s par phase, on prend le temps de lire
  { label: '×1', ms: 1300 },     // normal : ~1.3s, lisible
  { label: '×2', ms: 600 },      // rapide
  { label: '×4', ms: 220 },      // très rapide
  { label: '×16', ms: 50 },      // sauter rapidement
] as const;

/**
 * Boucle :
 *   - timer auto : si playing, on révèle une phase de plus à chaque tick
 *   - dès qu'on a tout révélé et que la session est `in-progress`, on advance() pour produire la suite
 *   - dès que la session est `awaiting-decision` et qu'on a tout révélé, on affiche le modal
 *   - dès que `finished` et qu'on a tout révélé, on affiche le summary
 */
export function MatchScreen({
  setup, onBack, onMatchFinished, defaultSpeed = 'x1', delegatedSubstitutions,
}: Props) {
  // Session est créée une fois par setup (matchInput + seed [+ replay])
  const sessionRef = useRef<MatchSession | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createMatchSession(setup.matchInput, setup.seed, {
      ...(setup.preloadedDecisions ? { preloadedDecisions: setup.preloadedDecisions } : {}),
    });
  }

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const [, setVersion] = useState(0);
  const forceRerender = (): void => setVersion(v => v + 1);

  const [displayedCount, setDisplayedCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(
    () => Math.max(0, SPEEDS.findIndex(s => s.label === SPEED_LABEL[defaultSpeed])),
  );
  /** V0.33 — tiroir de gestion en direct (banc + plan de match). */
  const [sidelineOpen, setSidelineOpen] = useState(false);

  const session = sessionRef.current;
  const state = session.getState();
  const allRevealed = displayedCount >= state.phases.length;
  const showModal = allRevealed && state.status === 'awaiting-decision' && state.pendingMoment !== undefined;
  const showSummary = allRevealed && state.status === 'finished';

  // Auto-advance timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing) return;
    if (showModal || showSummary) return;

    const speed = SPEEDS[speedIdx]?.ms ?? 700;
    timerRef.current = setTimeout(() => {
      const s = session.getState();
      if (displayedCount < s.phases.length) {
        // Encore des phases produites mais pas révélées
        setDisplayedCount(c => c + 1);
      } else if (s.status === 'in-progress') {
        // V0.62 — l'adjoint gère le banc, si on le lui a confié. On le consulte
        // avant de produire la phase suivante : un remplacement décidé après
        // coup ne servirait plus à rien.
        if (delegatedSubstitutions) {
          const squad = session.getLiveSquad();
          const conseil = adviseSubstitution({
            // La session expose déjà des minutes : le compteur en secondes est
            // interne. Diviser ici une seconde fois aurait figé l'adjoint à la
            // première minute, et le banc ne serait jamais entré.
            minute: s.minute,
            onField: squad.onField.map(p => ({
              playerId: p.player.id, position: p.position, fatigue: p.fatigue,
            })),
            bench: squad.bench.map(b => ({
              playerId: b.player.id,
              fatigue: b.fatigue,
              covers: b.covers,
              overall: approximateOverall(b.player),
            })),
            substitutionsUsed: squad.substitutionsUsed,
            substitutionsAllowed: squad.substitutionsAllowed,
            quality: delegatedSubstitutions.quality,
          });
          if (conseil) session.substitute(conseil.off, conseil.on);
        }
        // Tout révélé, plus de phases en réserve : produire la suite
        session.advance();
        forceRerender();
        // Le tick suivant (re-render → useEffect re-run) prendra la nouvelle phase
      }
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, displayedCount, speedIdx, session, showModal, showSummary, state.status, state.phases.length, delegatedSubstitutions]);

  // Reset si on change de setup
  useEffect(() => {
    sessionRef.current = createMatchSession(setup.matchInput, setup.seed, {
      ...(setup.preloadedDecisions ? { preloadedDecisions: setup.preloadedDecisions } : {}),
    });
    setDisplayedCount(0);
    setPlaying(true);
    setSaveStatus('idle');
    forceRerender();
  }, [setup.matchInput, setup.seed, setup.preloadedDecisions]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const onChooseOption = (optionId: string): void => {
    session.applyDecision(optionId);
    // V0.45 — une causerie se raconte. Sans retour, le manager choisirait un ton
    // sans jamais savoir comment le vestiaire l'a pris.
    const talk = session.getState().lastTalk;
    if (talk) setTalkFeedback(talk);
    forceRerender();
  };

  const [talkFeedback, setTalkFeedback] = useState<TalkOutcome | null>(null);

  const onSkipDecision = (): void => {
    const m = session.getState().pendingMoment;
    if (m) session.applyDecision(m.defaultOptionId);
    forceRerender();
  };

  const onNextPhaseManual = (): void => {
    const s = session.getState();
    if (displayedCount < s.phases.length) {
      setDisplayedCount(c => c + 1);
    } else if (s.status === 'in-progress') {
      session.advance();
      setDisplayedCount(c => c + 1);
      forceRerender();
    }
  };

  const onSkipToEnd = (): void => {
    while (true) {
      const s = session.getState();
      if (s.status === 'finished') break;
      if (s.status === 'awaiting-decision' && s.pendingMoment) {
        session.applyDecision(s.pendingMoment.defaultOptionId);
      } else {
        session.advance();
      }
    }
    setDisplayedCount(session.getState().phases.length);
    setPlaying(false);
    forceRerender();
  };

  const onReplay = (): void => {
    sessionRef.current = createMatchSession(setup.matchInput, setup.seed, {
      ...(setup.preloadedDecisions ? { preloadedDecisions: setup.preloadedDecisions } : {}),
    });
    setDisplayedCount(0);
    setPlaying(true);
    setSaveStatus('idle');
    forceRerender();
  };

  const onSaveMatch = async (): Promise<void> => {
    if (!session) return;
    const result = session.getResult();
    const log = session.getDecisionLog();
    const homeTries = result.phases.filter(p => p.outcome.tryScored === 'HOME').length;
    const awayTries = result.phases.filter(p => p.outcome.tryScored === 'AWAY').length;
    try {
      await matchSaveRepository.save({
        saveId: generateSaveId(),
        displayName: defaultDisplayName(setup.homeClub.shortName, setup.awayClub.shortName, result.homeScore, result.awayScore),
        savedAt: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        homeClubId: setup.homeClub.id,
        awayClubId: setup.awayClub.id,
        matchSeed: setup.seed,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        homeTries,
        awayTries,
        narrativeSummary: result.narrativeSummary,
        decisionLog: log,
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  // ---------------------------------------------------------------------------
  // Score / minute affichés
  // ---------------------------------------------------------------------------

  const visiblePhases = useMemo(
    () => state.phases.slice(0, displayedCount),
    [state.phases, displayedCount],
  );

  const lastVisible = visiblePhases[visiblePhases.length - 1];
  const finished = showSummary;
  const homeScoreShown = finished
    ? state.homeScore
    : lastVisible
      ? phaseScoreHome(lastVisible)
      : 0;
  const awayScoreShown = finished
    ? state.awayScore
    : lastVisible
      ? phaseScoreAway(lastVisible)
      : 0;
  const minuteShown = finished ? 80 : lastVisible?.state.minute ?? 0;

  const totalRevealed = displayedCount;
  const totalProduced = state.phases.length;

  // V0.33 — état du bord de touche. Relu à chaque rendu : la fatigue bouge à
  // chaque phase, un instantané figé induirait le manager en erreur.
  const liveSquad = session.getLiveSquad();
  const livePlan = session.getTacticalPlan();

  /**
   * V0.57 — les trente joueurs, replacés à chaque phase révélée.
   *
   * Recalculé à partir de la phase affichée, pas de la phase produite : le
   * moteur a souvent plusieurs longueurs d'avance sur ce que le manager
   * regarde, et les joueurs doivent se déplacer au rythme du récit.
   */
  const actors: readonly PitchActor[] = useMemo(() => {
    if (!lastVisible) return [];
    const subs = session.getSubstitutions();
    const minute = lastVisible.state.minute;
    const home = onFieldAt(setup.matchInput.home.squad, subs.home, minute);
    const away = onFieldAt(setup.matchInput.away.squad, subs.away, minute);
    // Le moteur exprime la position du ballon du point de vue de l'attaquant :
    // on la ramène au repère du terrain avant de placer qui que ce soit.
    const pos = lastVisible.state.possession;
    const signed = lastVisible.state.fieldPosition;
    const homeRef = pos === 'HOME' ? signed : pos === 'AWAY' ? -signed : 0;
    const ballX = (homeRef + 50) / 100;
    return formationFor({ phase: lastVisible, home, away, ballX });
  }, [lastVisible, session, setup.matchInput]);

  const nameOf = (id: import('../../engine/types.js').PlayerId): string | undefined =>
    setup.matchInput.playersById.get(id)?.lastName;

  const changePlan = (patch: Partial<PreMatchTacticalPlan>): void => {
    session.setTacticalPlan({ ...livePlan, ...patch });
    setVersion(v => v + 1);
  };

  /*
   * V0.65 — les consignes individuelles depuis le bord de touche.
   *
   * Le marquage n'existe que si les deux hommes sont désignés : une consigne à
   * moitié donnée ne doit rien produire du tout, ni effet ni malus, plutôt que
   * de coûter le prix du marqueur sans gêner personne.
   */
  const liveInstructions = session.getInstructions();
  const opponentsOnField: readonly Player[] = (() => {
    const subs = session.getSubstitutions();
    const minute = lastVisible?.state.minute ?? 0;
    const side = setup.matchInput.playerSide === 'AWAY' ? setup.matchInput.home : setup.matchInput.away;
    const sideSubs = setup.matchInput.playerSide === 'AWAY' ? subs.home : subs.away;
    return onFieldAt(side.squad, sideSubs, minute)
      .map(entry => setup.matchInput.playersById.get(entry.id))
      .filter((p): p is Player => p !== undefined);
  })();

  const changeInstructions = (patch: Partial<IndividualInstructions>): void => {
    session.setInstructions({ ...liveInstructions, ...patch });
    setVersion(v => v + 1);
  };

  const setMarker = (markerId: string): void => {
    const targetId = liveInstructions.marking?.targetId;
    if (markerId === '' || targetId === undefined) {
      const { marking: _drop, ...reste } = liveInstructions;
      session.setInstructions(markerId === '' ? reste : {
        ...reste,
        ...(targetId !== undefined ? { marking: { markerId: markerId as PlayerId, targetId } } : {}),
      });
    } else {
      session.setInstructions({ ...liveInstructions, marking: { markerId: markerId as PlayerId, targetId } });
    }
    setVersion(v => v + 1);
  };

  const setMarkTarget = (targetId: string): void => {
    const markerId = liveInstructions.marking?.markerId;
    const { marking: _drop, ...reste } = liveInstructions;
    if (targetId === '' || markerId === undefined) {
      session.setInstructions(reste);
    } else {
      session.setInstructions({ ...reste, marking: { markerId, targetId: targetId as PlayerId } });
    }
    setVersion(v => v + 1);
  };

  return (
    <section
      className="match"
      style={clubCssVars(
        (setup.matchInput.playerSide === 'AWAY' ? setup.awayClub.id : setup.homeClub.id) as string,
      ) as CSSProperties}
    >
      <MatchPitch
        visiblePhases={visiblePhases}
        homeClubId={setup.homeClub.id as string}
        awayClubId={setup.awayClub.id as string}
        homeName={setup.homeClub.name}
        awayName={setup.awayClub.name}
        homeShort={setup.homeClub.shortName}
        awayShort={setup.awayClub.shortName}
        homeScore={homeScoreShown}
        awayScore={awayScoreShown}
        minute={minuteShown}
        live={!finished}
        weather={setup.matchInput.weather}
        actors={actors}
        nameOf={nameOf}
      />

      <div className="controls">
        <button onClick={onBack} type="button">← Retour</button>
        <button
          onClick={() => setPlaying(p => !p)}
          disabled={finished || showModal}
          type="button"
        >
          {playing ? 'Pause' : 'Reprendre'}
        </button>
        <button
          onClick={onNextPhaseManual}
          disabled={finished || playing || showModal}
          type="button"
        >
          Phase suivante
        </button>
        <button
          onClick={onSkipToEnd}
          disabled={finished}
          type="button"
        >
          Sauter à la fin
        </button>
        <button onClick={onReplay} type="button">
          Rejouer
        </button>

        <div className="spacer" />

        <span className="progress">vitesse</span>
        {SPEEDS.map((s, i) => (
          <button
            key={s.label}
            className={i === speedIdx ? 'primary' : ''}
            onClick={() => setSpeedIdx(i)}
            type="button"
          >
            {s.label}
          </button>
        ))}

        <span className="progress">{totalRevealed} / {totalProduced}{state.status === 'in-progress' ? '+' : ''}</span>
      </div>

      {/* ---- Gestion en direct (V0.33) ------------------------------------- */}
      {!finished && (
        <div className="sideline">
          <button
            type="button"
            className={`sideline-toggle ${sidelineOpen ? 'open' : ''}`}
            onClick={() => setSidelineOpen(o => !o)}
          >
            <span className="st-icon">{sidelineOpen ? '▾' : '▸'}</span>
            Bord de touche
            <span className="st-meta">
              {liveSquad.substitutionsUsed}/{liveSquad.substitutionsAllowed} remplacements
              {' · '}{OCCUPATION_LABEL[livePlan.occupation]}
              {' · '}{DEFENSIVE_LINE_LABEL[livePlan.defensiveLine]}
            </span>
          </button>

          {sidelineOpen && (
            <div className="sideline-body">
              <BenchPanel
                squad={liveSquad}
                disabled={showModal}
                onSubstitute={(offId, onId) => {
                  const outcome = session.substitute(offId, onId);
                  setVersion(v => v + 1);
                  return outcome.ok ? undefined : outcome.reason;
                }}
              />

              <div className="live-tactics">
                <span className="panel-tag">Plan de match</span>
                <p className="lt-hint">
                  Un ajustement prend effet immédiatement, pour les phases à venir.
                </p>

                <div className="lt-row">
                  <span className="lt-label">Occupation</span>
                  <div className="seg-btn">
                    {(['HAUTE', 'MEDIANE', 'BASSE'] as const).map(o => (
                      <button
                        key={o}
                        type="button"
                        className={o === livePlan.occupation ? 'active' : ''}
                        onClick={() => changePlan({ occupation: o })}
                      >
                        {OCCUPATION_LABEL[o]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lt-row">
                  <span className="lt-label">Défense</span>
                  <div className="seg-btn">
                    {(['MONTANTE', 'RIDEAU', 'STAND_OFF'] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        className={d === livePlan.defensiveLine ? 'active' : ''}
                        onClick={() => changePlan({ defensiveLine: d })}
                      >
                        {DEFENSIVE_LINE_LABEL[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* V0.65 — les consignes individuelles. Elles se donnent en
                    cours de match parce que c'est ainsi qu'elles se décident :
                    on marque un homme quand on a vu qu'il fait mal. */}
                <div className="lt-row">
                  <span className="lt-label">Au pied</span>
                  <div className="seg-btn">
                    {(['AUCUNE', 'DERRIERE_AILIER', 'CHANDELLE'] as const).map(k => (
                      <button
                        key={k}
                        type="button"
                        className={k === (liveInstructions.kicking ?? 'AUCUNE') ? 'active' : ''}
                        title={k === 'AUCUNE'
                          ? 'On joue ce qui se présente'
                          : k === 'DERRIERE_AILIER'
                            ? 'Taper derrière leur ailier : paie s\'il monte, rend le ballon s\'il recule'
                            : 'Chandelles sous leur arrière'}
                        onClick={() => changeInstructions({ kicking: k })}
                      >
                        {k === 'AUCUNE' ? 'Libre' : k === 'DERRIERE_AILIER' ? 'Derrière' : 'Chandelle'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lt-row">
                  <span className="lt-label">Marquage</span>
                  {/* Deux listes pleine largeur, l'une sous l'autre : le bord
                      de touche fait moins de trois cents pixels, et une ligne
                      « X colle Y » y débordait. */}
                  <div className="lt-marking">
                    <select
                      className="focus-select"
                      aria-label="Le joueur chargé du marquage"
                      value={(liveInstructions.marking?.markerId as string | undefined) ?? ''}
                      onChange={e => setMarker(e.target.value)}
                    >
                      <option value="">personne ne marque</option>
                      {liveSquad.onField.map(s => (
                        <option key={s.player.id as string} value={s.player.id as string}>
                          {s.player.lastName}
                        </option>
                      ))}
                    </select>
                    <select
                      className="focus-select"
                      aria-label="L'adversaire à marquer"
                      value={(liveInstructions.marking?.targetId as string | undefined) ?? ''}
                      onChange={e => setMarkTarget(e.target.value)}
                    >
                      <option value="">aucun adversaire</option>
                      {opponentsOnField.map(p => (
                        <option key={p.id as string} value={p.id as string}>{p.lastName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <PhaseTimeline
        phases={visiblePhases}
        homeShortName={setup.homeClub.shortName}
        awayShortName={setup.awayClub.shortName}
      />

      {showSummary && (
        <>
          <MatchSummary
            result={session.getResult()}
            homeName={setup.homeClub.name}
            awayName={setup.awayClub.name}
            homeClub={setup.homeClub}
            awayClub={setup.awayClub}
            playersById={setup.matchInput.playersById}
            {...(setup.matchInput.playerSide ? { playerSide: setup.matchInput.playerSide } : {})}
            playerPlan={livePlan}
          />
          <div className="save-bar">
            {onMatchFinished ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const r = session.getResult();
                  onMatchFinished(r.homeScore, r.awayScore, r, setup.matchInput);
                }}
              >
                Valider et retour saison →
              </button>
            ) : (
              <button
                type="button"
                onClick={onSaveMatch}
                disabled={saveStatus === 'saved'}
                className={saveStatus === 'saved' ? '' : 'primary'}
              >
                {saveStatus === 'saved' ? '✓ Sauvegardé' : saveStatus === 'error' ? 'Erreur — réessayer' : 'Sauvegarder ce match'}
              </button>
            )}
            {setup.preloadedDecisions && (
              <span className="replay-tag">Replay d'une sauvegarde</span>
            )}
          </div>
        </>
      )}

      {/* V0.45 — retour de causerie. Il s'efface au clic : c'est un moment de
          match, pas un panneau permanent. */}
      {talkFeedback && (
        <div
          className={`talk-feedback ${talkFeedback.backfired ? 'backfired' : 'ok'}`}
          role="status"
          onClick={() => setTalkFeedback(null)}
        >
          <span className="tf-tone">{TONE_LABEL[talkFeedback.tone]}</span>
          <p className="tf-narrative">{talkFeedback.narrative}</p>
          <span className="tf-effect">
            Moral {talkFeedback.moodDelta >= 0 ? '+' : ''}{talkFeedback.moodDelta}
            {' · discipline tactique '}
            {talkFeedback.tacticalBonus >= 0 ? '+' : ''}{talkFeedback.tacticalBonus}
          </span>
        </div>
      )}

      {showModal && state.pendingMoment && (
        <LiveMomentModal
          key={state.pendingMoment.id}
          moment={state.pendingMoment}
          staff={generateStaffForClub(setup.homeClub)}
          onChoose={onChooseOption}
          onSkip={onSkipDecision}
        />
      )}
    </section>
  );
}

// =============================================================================
// Helpers : score à un instant T (incluant l'outcome de la phase)
// =============================================================================

function phaseScoreHome(phase: import('../../engine/match/types.js').PhaseRecord): number {
  let s = phase.state.homeScore;
  if (phase.outcome.tryScored === 'HOME') s += 5;
  if (phase.outcome.pointsScored?.team === 'HOME') s += phase.outcome.pointsScored.value;
  return s;
}

function phaseScoreAway(phase: import('../../engine/match/types.js').PhaseRecord): number {
  let s = phase.state.awayScore;
  if (phase.outcome.tryScored === 'AWAY') s += 5;
  if (phase.outcome.pointsScored?.team === 'AWAY') s += phase.outcome.pointsScored.value;
  return s;
}
