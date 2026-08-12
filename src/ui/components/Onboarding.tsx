/**
 * L'introduction — V0.12, refondue en V0.49.
 *
 * La version d'origine portait à la fois le contenu du tutoriel, l'ordre des
 * étapes et le rendu. Le contenu et l'ordre sont partis dans
 * [season/onboarding.ts](../../engine/season/onboarding.ts), où ils se testent.
 *
 * Ce qui reste ici est ce qui ne peut pas vivre ailleurs : mesurer un élément
 * de la page, y découper un trou dans le voile, poser une bulle à côté, et se
 * souvenir de ce qui a déjà été lu.
 */

import { useEffect, useLayoutEffect, useState } from 'react';
import type { Lesson, LessonId } from '../../engine/season/onboarding.js';

/** Leçons déjà lues. */
const SEEN_KEY = 'lequinze.onboarding.seen';
/** Refus global : plus aucune explication. */
const OFF_KEY = 'lequinze.onboarding.off';
/** Clé de la V0.12, encore posée chez les joueurs de la première heure. */
const LEGACY_KEY = 'lequinze.onboarding.dismissed';

// =============================================================================
// Mémoire
// =============================================================================

export function readSeen(): readonly LessonId[] {
  try {
    // Un ancien « tuto passé » vaut refus global : on ne va pas resservir
    // quatorze cartes à quelqu'un qui avait déjà cliqué « passer ».
    if (localStorage.getItem(LEGACY_KEY) === '1') return [];
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as readonly LessonId[] : [];
  } catch {
    return [];
  }
}

export function isOnboardingOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
      || localStorage.getItem(LEGACY_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(id: LessonId): void {
  try {
    const next = [...new Set([...readSeen(), id])];
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

function turnOff(): void {
  try { localStorage.setItem(OFF_KEY, '1'); } catch { /* noop */ }
}

/** Remet l'introduction à zéro, pour la rejouer depuis le menu titre. */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
    localStorage.removeItem(OFF_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* noop */ }
}

// =============================================================================
// Rendu
// =============================================================================

interface Props {
  /** Leçon à afficher, ou rien. */
  readonly lesson: Lesson | undefined;
  /** Appelé une fois la leçon lue ou l'introduction coupée. */
  readonly onSeen: () => void;
}

interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

function readRect(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Onboarding({ lesson, onSeen }: Props) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const target = lesson?.target;

  // La cible peut apparaître après la leçon — un panneau qui se monte, une
  // liste qui se remplit. On la remesure tant que la bulle est là.
  useLayoutEffect(() => {
    if (lesson === undefined) { setTargetRect(null); return; }
    const update = (): void => {
      setTargetRect(target === undefined ? null : readRect(target));
    };
    update();
    window.addEventListener('resize', update);
    const ticker = window.setInterval(update, 400);
    return () => {
      window.removeEventListener('resize', update);
      window.clearInterval(ticker);
    };
  }, [lesson, target]);

  // Échap vaut « compris » : rester coincé derrière une bulle serait pire que
  // de la fermer trop tôt.
  useEffect(() => {
    if (lesson === undefined) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      remember(lesson.id);
      onSeen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lesson, onSeen]);

  if (lesson === undefined) return null;

  const acknowledge = (): void => {
    remember(lesson.id);
    onSeen();
  };

  const silence = (): void => {
    turnOff();
    onSeen();
  };

  const tooltipStyle: React.CSSProperties = (() => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const margin = 16;
    switch (lesson.placement) {
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left + targetRect.width + margin,
          transform: 'translateY(-50%)',
        };
      case 'top':
        return {
          top: targetRect.top - margin,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
      default:
        return {
          top: targetRect.top + targetRect.height + margin,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
    }
  })();

  // Le trou dans le voile est découpé par un masque CSS ; on ne passe ici que
  // ses coordonnées.
  const overlayStyle: React.CSSProperties = targetRect ? {
    ['--spot-x' as string]: `${targetRect.left + targetRect.width / 2}px`,
    ['--spot-y' as string]: `${targetRect.top + targetRect.height / 2}px`,
    ['--spot-r' as string]: `${Math.max(targetRect.width, targetRect.height) / 2 + 14}px`,
  } : {};

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Introduction">
      <div
        className={`onboarding-overlay ${targetRect ? 'has-spot' : 'no-spot'}`}
        style={overlayStyle}
      />
      {targetRect && (
        <div
          className="onboarding-ring"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
      <div className="onboarding-tooltip" style={tooltipStyle}>
        <h3>{lesson.title}</h3>
        <p>{lesson.body}</p>
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={silence}>
            Ne plus rien m'expliquer
          </button>
          <div className="onboarding-nav">
            <button type="button" className="primary" onClick={acknowledge}>
              Compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
