/**
 * Banc de touche en direct — V0.33.
 *
 * Les huit remplacements, la fatigue individuelle et les règles de première
 * ligne existaient depuis V0.13, mais tournaient en pilote automatique : le
 * manager ne voyait ni qui était cuit, ni qui attendait sur le banc, et ne
 * pouvait rien y faire. Tout ce travail était invisible.
 *
 * Ce panneau ouvre le banc pendant le match : on choisit qui sort, qui entre,
 * et le moteur applique ses propres règles (quota, couverture de poste, retour
 * interdit) en renvoyant un motif clair quand il refuse.
 */

import { useState } from 'react';
import type { LiveSquadView } from '../../engine/match/session.js';
import type { PlayerId, Position } from '../../engine/types.js';
import { PositionBadge } from './DataBits.js';

interface Props {
  readonly squad: LiveSquadView;
  readonly onSubstitute: (offId: PlayerId, onId: PlayerId) => string | undefined;
  readonly disabled: boolean;
}

/** Au-delà, un joueur est visiblement émoussé — c'est le seuil des live moments. */
const TIRED = 60;
const SPENT = 75;

function fatigueTone(f: number): string {
  if (f >= SPENT) return 'spent';
  if (f >= TIRED) return 'tired';
  return 'fresh';
}

export function BenchPanel({ squad, onSubstitute, disabled }: Props) {
  const [offId, setOffId] = useState<PlayerId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quotaReached = squad.substitutionsUsed >= squad.substitutionsAllowed;
  const offSlot = squad.onField.find(s => s.player.id === offId);

  /** Remplaçants capables de tenir le poste du sortant sélectionné. */
  const eligible = offSlot
    ? squad.bench.filter(b => b.covers.includes(offSlot.position))
    : [];

  const pick = (id: PlayerId): void => {
    setError(null);
    setOffId(prev => (prev === id ? null : id));
  };

  const bringOn = (onId: PlayerId): void => {
    if (!offId) return;
    const refusal = onSubstitute(offId, onId);
    if (refusal) {
      setError(refusal);
      return;
    }
    setOffId(null);
    setError(null);
  };

  return (
    <div className="bench-panel">
      <div className="bench-head">
        <span className="panel-tag">Banc de touche</span>
        <span className={`bench-quota ${quotaReached ? 'full' : ''}`}>
          {squad.substitutionsUsed} / {squad.substitutionsAllowed} remplacements
        </span>
        {squad.uncontestedScrums && (
          <span className="bench-warning">⚠ Mêlées simulées — plus de première ligne</span>
        )}
      </div>

      {/* V0.52 — qui est au cachot, et donc pourquoi on joue à quatorze. */}
      {squad.sinBinned.length > 0 && (
        <div className="sideline-sinbin">
          Au cachot : {squad.sinBinned.map(p => p.lastName).join(', ')}
        </div>
      )}

      <div className="bench-cols">
        {/* ---- Sur le terrain ------------------------------------------------ */}
        <div className="bench-col">
          <div className="bench-col-tag">Sur le terrain</div>
          <ul className="bench-list">
            {squad.onField.map(slot => {
              const selected = slot.player.id === offId;
              return (
                <li key={slot.player.id as string}>
                  <button
                    type="button"
                    className={`bench-row ${selected ? 'selected' : ''}`}
                    disabled={disabled || quotaReached}
                    onClick={() => pick(slot.player.id)}
                  >
                    <PositionBadge position={slot.position} />
                    <span className="br-name">{slot.player.lastName}</span>
                    <span className={`br-fatigue ${fatigueTone(slot.fatigue)}`}>
                      <span className="brf-bar" style={{ width: `${Math.min(100, slot.fatigue)}%` }} />
                      <span className="brf-value">{Math.round(slot.fatigue)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---- Remplaçants --------------------------------------------------- */}
        <div className="bench-col">
          <div className="bench-col-tag">
            {offSlot ? `Peut remplacer ${offSlot.player.lastName}` : `Remplaçants (${squad.bench.length})`}
          </div>

          {squad.bench.length === 0 && <p className="bench-empty">Banc vide.</p>}

          <ul className="bench-list">
            {squad.bench.map(b => {
              // Hors sélection on montre tout le banc ; une fois le sortant
              // choisi, on grise ceux qui ne couvrent pas son poste plutôt que
              // de les masquer — le manager doit comprendre pourquoi.
              const usable = !offSlot || eligible.some(e => e.player.id === b.player.id);
              return (
                <li key={b.player.id as string}>
                  <button
                    type="button"
                    className={`bench-row ${usable ? '' : 'unusable'}`}
                    disabled={disabled || quotaReached || !offSlot || !usable}
                    title={usable ? undefined : `${b.player.lastName} ne couvre pas ce poste`}
                    onClick={() => bringOn(b.player.id)}
                  >
                    <PositionBadge position={b.player.position} />
                    <span className="br-name">{b.player.lastName}</span>
                    <span className="br-covers">
                      {b.covers.length === 0
                        ? '—'
                        : shortCovers(b.covers)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {error && <p className="bench-error">{error}</p>}
      {!error && quotaReached && (
        <p className="bench-note">Quota atteint : plus aucun remplacement possible.</p>
      )}
      {!error && !quotaReached && !offSlot && (
        <p className="bench-note">Choisissez le joueur à sortir.</p>
      )}
    </div>
  );
}

/** Postes couverts, dédoublonnés par groupe pour tenir sur une ligne. */
function shortCovers(positions: readonly Position[]): string {
  const seen = new Set<string>();
  for (const p of positions) {
    seen.add(p.replaceAll('_GAUCHE', '').replaceAll('_DROITE', '').replaceAll('_DROIT', ''));
  }
  const list = [...seen].map(p => p.slice(0, 3).toLowerCase());
  return list.length > 3 ? `${list.slice(0, 3).join(' ')}…` : list.join(' ');
}
