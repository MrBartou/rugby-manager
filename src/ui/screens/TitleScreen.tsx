/**
 * TitleScreen — V0.10.
 *
 * Écran titre cinématique. Apparaît au lancement avant SeasonSetup.
 * Doit donner l'impression "tu lances un jeu", pas "tu ouvres une app".
 */

import { useEffect, useState } from 'react';
import { resetOnboarding } from '../components/Onboarding.js';
import { seasonSaveRepository, type SeasonSaveMeta } from '../../data/season-save-repository.js';

interface Props {
  readonly onNewCareer: () => void;
  readonly onContinue: (saveId: string) => void;
  readonly onFreeMatch: () => void;
}

export function TitleScreen({ onNewCareer, onContinue, onFreeMatch }: Props) {
  const [saves, setSaves] = useState<readonly SeasonSaveMeta[]>([]);
  const [replayed, setReplayed] = useState(false);

  const replayIntro = (): void => {
    resetOnboarding();
    setReplayed(true);
  };

  useEffect(() => {
    seasonSaveRepository.list().then(setSaves);
  }, []);

  const lastSave = saves[0];

  return (
    <div className="title-screen">
      {/* Stade SVG en fond — terrain en plongée + projecteurs */}
      <svg className="title-bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="spot1" cx="20%" cy="0%" r="60%">
            <stop offset="0%" stopColor="rgba(91,255,220,0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="spot2" cx="80%" cy="100%" r="60%">
            <stop offset="0%" stopColor="rgba(110,168,255,0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="pitch-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0d1015" />
            <stop offset="100%" stopColor="#161922" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#pitch-grad)" />
        <rect width="1600" height="900" fill="url(#spot1)" />
        <rect width="1600" height="900" fill="url(#spot2)" />

        {/* Terrain stylisé : lignes en perspective */}
        <g stroke="rgba(91,255,220,0.06)" strokeWidth="1" fill="none">
          {/* Ligne de but proche */}
          <path d="M 100 700 L 1500 700" strokeWidth="2" opacity="0.4" />
          {/* 22 m */}
          <path d="M 250 580 L 1350 580" opacity="0.3" />
          {/* Ligne médiane */}
          <path d="M 380 460 L 1220 460" opacity="0.25" />
          {/* 22 m adverse */}
          <path d="M 510 340 L 1090 340" opacity="0.2" />
          {/* Ligne d'en-but */}
          <path d="M 640 220 L 960 220" opacity="0.15" />
          {/* Lignes de touche */}
          <path d="M 100 700 L 640 220" opacity="0.4" />
          <path d="M 1500 700 L 960 220" opacity="0.4" />
        </g>

        {/* Cercle central */}
        <circle cx="800" cy="460" r="40" stroke="rgba(91,255,220,0.08)" strokeWidth="1" fill="none" />

        {/* Projecteurs */}
        <g fill="rgba(91,255,220,0.4)">
          <circle cx="100" cy="100" r="2" />
          <circle cx="400" cy="80" r="2" />
          <circle cx="800" cy="60" r="2" />
          <circle cx="1200" cy="80" r="2" />
          <circle cx="1500" cy="100" r="2" />
        </g>
      </svg>

      <div className="title-content">
        <div className="title-meta-top">
          <span className="title-version">V0.10 · ALPHA</span>
        </div>

        <div className="title-hero">
          <h1 className="title-logo">
            <span className="title-logo-le">LE</span>
            <span className="title-logo-quinze">QUINZE</span>
          </h1>
          <p className="title-tagline">Manager de rugby · Top 14</p>
        </div>

        <div className="title-actions">
          {lastSave && (
            <button type="button" className="title-cta primary" onClick={() => onContinue(lastSave.saveId)}>
              <span className="title-cta-label">Reprendre la carrière</span>
              <span className="title-cta-sub">{lastSave.displayName}</span>
            </button>
          )}
          <button type="button" className="title-cta" onClick={onNewCareer}>
            <span className="title-cta-label">Nouvelle carrière</span>
            <span className="title-cta-sub">Choisir un club et lancer une saison</span>
          </button>
          <button type="button" className="title-cta ghost" onClick={onFreeMatch}>
            <span className="title-cta-label">Match libre</span>
            <span className="title-cta-sub">Une rencontre, deux clubs au choix</span>
          </button>
        </div>

        <div className="title-foot">
          <span className="title-foot-line">Saison 2025-26 · 14 clubs · 26 journées + phases finales</span>
          {/* V0.49 — l'introduction s'étalant désormais sur toute la carrière,
              elle doit pouvoir se rejouer sans repartir de zéro. */}
          <button type="button" className="title-foot-link" onClick={replayIntro}>
            {replayed ? 'Explications réactivées' : 'Revoir les explications'}
          </button>
        </div>
      </div>
    </div>
  );
}
