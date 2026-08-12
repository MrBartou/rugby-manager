import { useEffect, useRef } from 'react';
import type { PhaseRecord } from '../../engine/match/types.js';

interface Props {
  readonly phases: readonly PhaseRecord[];
  readonly homeShortName: string;
  readonly awayShortName: string;
}

function fieldLabel(pos: number, attacker: 'HOME' | 'AWAY' | 'CONTESTED', homeShort: string, awayShort: string): string {
  // pos est dans le référentiel de l'attaquant (-50 = en-but, +50 = essai).
  // On mappe en référentiel HOME pour l'affichage neutre.
  const homePerspective = attacker === 'HOME' ? pos : attacker === 'AWAY' ? -pos : 0;
  if (homePerspective > 35) return `${awayShort} 22`;
  if (homePerspective > 0) return `${awayShort} ½`;
  if (homePerspective > -35) return `${homeShort} ½`;
  return `${homeShort} 22`;
}

function rowClass(phase: PhaseRecord): string {
  if (phase.outcome.tryScored) return 'phase-row try';
  if (phase.outcome.summary.includes('manquée')) return 'phase-row miss';
  if (phase.outcome.pointsScored) return 'phase-row highlight';
  if (phase.outcome.penaltyAwarded) return 'phase-row highlight';
  return 'phase-row';
}

export function PhaseTimeline({ phases, homeShortName, awayShortName }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll vers le bas quand de nouvelles phases arrivent
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [phases.length]);

  return (
    <div className="timeline" ref={scrollRef}>
      <div className="timeline-header">
        <span>min</span>
        <span>score</span>
        <span>position</span>
        <span>poss.</span>
        <span>type</span>
        <span>action</span>
      </div>
      {phases.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
          Le match va commencer…
        </div>
      )}
      {phases.map(phase => {
        const possClass =
          phase.state.possession === 'HOME' ? 'home' :
          phase.state.possession === 'AWAY' ? 'away' : '';
        const possLabel =
          phase.state.possession === 'HOME' ? homeShortName :
          phase.state.possession === 'AWAY' ? awayShortName :
          '——';
        return (
          <div key={phase.index} className={rowClass(phase)}>
            <span className="min">{phase.state.minute}'</span>
            <span className="score">{phase.state.homeScore} – {phase.state.awayScore}</span>
            <span className="field">
              {fieldLabel(phase.state.fieldPosition, phase.state.possession as 'HOME' | 'AWAY' | 'CONTESTED', homeShortName, awayShortName)}
            </span>
            <span className={`poss ${possClass}`}>{possLabel}</span>
            <span className="type">{phase.type}</span>
            <span className="summary">{phase.outcome.summary}</span>
          </div>
        );
      })}
    </div>
  );
}
