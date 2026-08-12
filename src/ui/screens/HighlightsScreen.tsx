/**
 * Les temps forts d'un match auto-simulé — V0.57.
 *
 * Quand le manager ne joue pas sa rencontre — journée simulée, match d'un rival
 * — il n'en voyait qu'un tableau de phases. Ici, les six à huit moments qui ont
 * décidé du match sont **rejoués** sur le même terrain que la vue en direct,
 * avec les trente joueurs, le score qui bouge et les noms.
 *
 * On réutilise `MatchPitch` tel quel : c'est le même terrain, la même mise en
 * place, la même façon de nommer un joueur. Un condensé qui ne ressemblerait
 * pas au match qu'on joue soi-même serait une deuxième interface à entretenir.
 */

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { MatchPitch } from '../components/MatchPitch.js';
import { clubCssVars } from '../theme/club-identity.js';
import { formationFor, onFieldAt } from '../pitch/phase-formation.js';
import { highlightsIntro, selectHighlights, type Highlight } from '../../engine/match/highlights.js';
import type { MatchInput, MatchResult } from '../../engine/match/types.js';
import type { PlayerId } from '../../engine/types.js';

interface Props {
  readonly result: MatchResult;
  readonly input: MatchInput;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly homeName: string;
  readonly awayName: string;
  readonly homeShort: string;
  readonly awayShort: string;
  readonly onBack: () => void;
}

/** Durée d'un temps fort à l'écran. Assez pour lire la légende, pas plus. */
const BEAT_MS = 2600;

const KIND_LABEL: Readonly<Record<Highlight['kind'], string>> = {
  ESSAI: 'Essai',
  CARTON: 'Carton',
  AU_PIED: 'Au pied',
  FRANCHISSEMENT: 'Franchissement',
  TURNOVER: 'Ballon volé',
  BASCULE: 'Le match bascule',
};

export function HighlightsScreen({
  result, input, homeClubId, awayClubId,
  homeName, awayName, homeShort, awayShort, onBack,
}: Props) {
  const highlights = selectHighlights(result);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    if (index >= highlights.length - 1) return;
    const t = setTimeout(() => setIndex(i => i + 1), BEAT_MS);
    return () => clearTimeout(t);
  }, [playing, index, highlights.length]);

  if (highlights.length === 0) {
    return (
      <section className="highlights">
        <div className="hl-empty">
          <p>Rien à retenir de cette rencontre.</p>
          <button type="button" className="primary" onClick={onBack}>Retour</button>
        </div>
      </section>
    );
  }

  const current = highlights[Math.min(index, highlights.length - 1)]!;
  const subs = { home: result.homeSubstitutions, away: result.awaySubstitutions };
  const home = onFieldAt(input.home.squad, subs.home, current.minute);
  const away = onFieldAt(input.away.squad, subs.away, current.minute);

  // Le moteur exprime la position du ballon du point de vue de l'attaquant.
  const pos = current.phase.state.possession;
  const signed = current.phase.state.fieldPosition;
  const homeRef = pos === 'HOME' ? signed : pos === 'AWAY' ? -signed : 0;
  const ballX = (homeRef + 50) / 100;

  const actors = formationFor({ phase: current.phase, home, away, ballX });
  const nameOf = (id: PlayerId): string | undefined => input.playersById.get(id)?.lastName;
  const last = index >= highlights.length - 1;

  return (
    <section
      className="highlights"
      style={clubCssVars(homeClubId) as CSSProperties}
    >
      <div className="hl-head">
        <div className="hl-title">Temps forts</div>
        <div className="hl-intro">{highlightsIntro(highlights)}</div>
      </div>

      <MatchPitch
        visiblePhases={[current.phase]}
        homeClubId={homeClubId}
        awayClubId={awayClubId}
        homeName={homeName}
        awayName={awayName}
        homeShort={homeShort}
        awayShort={awayShort}
        homeScore={current.homeScore}
        awayScore={current.awayScore}
        minute={current.minute}
        live={false}
        weather={input.weather}
        actors={actors}
        nameOf={nameOf}
      />

      <div className={`hl-caption kind-${current.kind.toLowerCase()}`}>
        <span className="hl-min">{current.minute}'</span>
        <span className="hl-kind">{KIND_LABEL[current.kind]}</span>
        <span className="hl-text">{current.caption}</span>
      </div>

      <div className="hl-controls">
        <button type="button" onClick={onBack}>Retour</button>
        <button
          type="button"
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          ← Précédent
        </button>
        <button type="button" onClick={() => setPlaying(p => !p)}>
          {playing ? 'Pause' : 'Reprendre'}
        </button>
        <button
          type="button"
          onClick={() => setIndex(i => Math.min(highlights.length - 1, i + 1))}
          disabled={last}
        >
          Suivant →
        </button>
        <div className="hl-dots" aria-label={`Moment ${index + 1} sur ${highlights.length}`}>
          {highlights.map((h, i) => (
            <button
              key={h.phase.index}
              type="button"
              className={`hl-dot ${i === index ? 'active' : ''} ${i < index ? 'seen' : ''}`}
              onClick={() => { setPlaying(false); setIndex(i); }}
              title={`${h.minute}' — ${KIND_LABEL[h.kind]}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
