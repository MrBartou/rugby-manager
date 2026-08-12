/**
 * Affichage d'un attribut joueur — barre + lettre S/A/B/C/D.
 *
 * Référence : 03-modele-joueur.md, section A — échelle hybride affichée.
 *   S = 90-100, A = 75-89, B = 55-74, C = 35-54, D = 0-34
 *
 * V0.15 — la barre sait représenter une **connaissance incertaine** : quand un
 * joueur est mal connu, on n'affiche plus une valeur exacte mais la fourchette
 * dans laquelle le scout le situe. Voir `club/scouting.ts`.
 */

import type { Estimate } from '../../engine/club/scouting.js';

interface Props {
  readonly label: string;
  /** Valeur réelle. Ignorée si `estimate` est fourni et incertain. */
  readonly value: number;
  readonly compact?: boolean;
  /**
   * Estimation du scout. Si absente, l'attribut est affiché tel quel
   * (cas d'un joueur de son propre effectif parfaitement connu).
   */
  readonly estimate?: Estimate;
}

function letterFromValue(v: number): { letter: string; cls: string } {
  if (v >= 90) return { letter: 'S', cls: 'attr-s' };
  if (v >= 75) return { letter: 'A', cls: 'attr-a' };
  if (v >= 55) return { letter: 'B', cls: 'attr-b' };
  if (v >= 35) return { letter: 'C', cls: 'attr-c' };
  return { letter: 'D', cls: 'attr-d' };
}

export function AttributeBar({ label, value, compact = false, estimate }: Props) {
  const uncertain = estimate !== undefined && estimate.min !== estimate.max;

  // Joueur jamais observé : on ne montre rien du tout.
  if (estimate?.certainty === 'INCONNU') {
    return (
      <div className={`attr-row ${compact ? 'compact' : ''}`}>
        <span className="attr-label">{label}</span>
        <div className="attr-bar-wrap">
          <div className="attr-bar-unknown" />
        </div>
        <span className="attr-letter attr-unknown">?</span>
      </div>
    );
  }

  if (!uncertain) {
    const shown = estimate ? estimate.point : value;
    const { letter, cls } = letterFromValue(shown);
    return (
      <div className={`attr-row ${compact ? 'compact' : ''}`}>
        <span className="attr-label">{label}</span>
        <div className="attr-bar-wrap">
          <div className={`attr-bar ${cls}`} style={{ width: `${shown}%` }} />
        </div>
        <span className={`attr-letter ${cls}`}>{letter}</span>
      </div>
    );
  }

  // Fourchette : bande translucide de min à max, repère sur l'estimation ponctuelle.
  const { cls } = letterFromValue(estimate.point);
  return (
    <div className={`attr-row ${compact ? 'compact' : ''}`} title={`Estimation : ${estimate.display}`}>
      <span className="attr-label">{label}</span>
      <div className="attr-bar-wrap">
        <div
          className={`attr-band ${cls}`}
          style={{ left: `${estimate.min}%`, width: `${Math.max(2, estimate.max - estimate.min)}%` }}
        />
        <div className={`attr-band-mark ${cls}`} style={{ left: `${estimate.point}%` }} />
      </div>
      <span className={`attr-letter attr-range ${cls}`}>{estimate.min}–{estimate.max}</span>
    </div>
  );
}
