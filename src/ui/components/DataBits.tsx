/**
 * Briques d'affichage de données — V0.16.
 *
 * L'interface manquait de vocabulaire visuel : tout était soit une barre pleine
 * soit du texte. Ces composants fournissent les repères denses qu'on attend d'un
 * jeu de management — guide de forme, jauge compacte, badge de poste — pour que
 * chaque ligne d'un tableau porte de l'information lisible d'un coup d'œil.
 */

import type { Position } from '../../engine/types.js';

// =============================================================================
// Guide de forme
// =============================================================================

/** Résultats récents, du plus ancien au plus récent. */
export function FormGuide({ results, max = 5 }: { readonly results: readonly (-1 | 0 | 1)[]; readonly max?: number }) {
  const shown = results.slice(-max);
  if (shown.length === 0) {
    return <span className="form-guide empty">—</span>;
  }
  return (
    <span className="form-guide">
      {shown.map((r, i) => (
        <span
          key={i}
          className={`form-pip ${r === 1 ? 'win' : r === -1 ? 'loss' : 'draw'}`}
          title={r === 1 ? 'Victoire' : r === -1 ? 'Défaite' : 'Nul'}
        >
          {r === 1 ? 'V' : r === -1 ? 'D' : 'N'}
        </span>
      ))}
    </span>
  );
}

// =============================================================================
// Jauge compacte
// =============================================================================

export type MeterTone = 'good' | 'ok' | 'low' | 'bad' | 'neutral';

export function toneFor(value: number, invert = false): MeterTone {
  const v = invert ? 100 - value : value;
  if (v >= 72) return 'good';
  if (v >= 52) return 'ok';
  if (v >= 32) return 'low';
  return 'bad';
}

/**
 * Jauge horizontale compacte avec valeur chiffrée.
 * `invert` sert aux mesures où « haut » est mauvais (la fatigue).
 */
export function Meter({
  value, invert = false, label, width = 46,
}: {
  readonly value: number;
  readonly invert?: boolean;
  readonly label?: string;
  readonly width?: number;
}) {
  const tone = toneFor(value, invert);
  return (
    <span className="meter" title={label ? `${label} : ${Math.round(value)}` : String(Math.round(value))}>
      <span className="meter-track" style={{ width }}>
        <span className={`meter-fill ${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </span>
      <span className={`meter-value ${tone}`}>{Math.round(value)}</span>
    </span>
  );
}

// =============================================================================
// Poste
// =============================================================================

const POSITION_NUMBER: Readonly<Record<Position, string>> = {
  PILIER_GAUCHE: '1', TALONNEUR: '2', PILIER_DROIT: '3',
  DEUXIEME_LIGNE_GAUCHE: '4', DEUXIEME_LIGNE_DROITE: '5',
  TROISIEME_LIGNE_AILE_GAUCHE: '6', TROISIEME_LIGNE_AILE_DROITE: '7', NUMERO_8: '8',
  DEMI_DE_MELEE: '9', OUVREUR: '10',
  AILIER_GAUCHE: '11', CENTRE_INTERIEUR: '12', CENTRE_EXTERIEUR: '13', AILIER_DROIT: '14',
  ARRIERE: '15',
};

const POSITION_SHORT: Readonly<Record<Position, string>> = {
  PILIER_GAUCHE: 'PG', TALONNEUR: 'TAL', PILIER_DROIT: 'PD',
  DEUXIEME_LIGNE_GAUCHE: '2L', DEUXIEME_LIGNE_DROITE: '2L',
  TROISIEME_LIGNE_AILE_GAUCHE: '3L', TROISIEME_LIGNE_AILE_DROITE: '3L', NUMERO_8: 'N8',
  DEMI_DE_MELEE: 'DM', OUVREUR: 'OUV',
  AILIER_GAUCHE: 'AIL', CENTRE_INTERIEUR: 'CI', CENTRE_EXTERIEUR: 'CE', AILIER_DROIT: 'AIL',
  ARRIERE: 'ARR',
};

/**
 * Nom complet du poste, tel qu'on le dit à voix haute.
 *
 * `POSITION_SHORT` sert aux badges de composition, où la place manque ; celui-ci
 * sert dès qu'on écrit une phrase — un courrier, une fiche, un avertissement de
 * vestiaire.
 */
const POSITION_LABEL: Readonly<Record<Position, string>> = {
  PILIER_GAUCHE: 'Pilier gauche', TALONNEUR: 'Talonneur', PILIER_DROIT: 'Pilier droit',
  DEUXIEME_LIGNE_GAUCHE: 'Deuxième ligne gauche', DEUXIEME_LIGNE_DROITE: 'Deuxième ligne droite',
  TROISIEME_LIGNE_AILE_GAUCHE: 'Troisième ligne aile gauche',
  TROISIEME_LIGNE_AILE_DROITE: 'Troisième ligne aile droite', NUMERO_8: 'Numéro 8',
  DEMI_DE_MELEE: 'Demi de mêlée', OUVREUR: 'Ouvreur',
  CENTRE_INTERIEUR: 'Centre intérieur', CENTRE_EXTERIEUR: 'Centre extérieur',
  AILIER_GAUCHE: 'Ailier gauche', AILIER_DROIT: 'Ailier droit', ARRIERE: 'Arrière',
};

export function positionLabel(p: Position): string { return POSITION_LABEL[p] ?? p; }

export type PositionLine = 'AVANTS' | 'DEMIS' | 'TROIS_QUARTS';

export const POSITION_LINE: Readonly<Record<Position, PositionLine>> = {
  PILIER_GAUCHE: 'AVANTS', TALONNEUR: 'AVANTS', PILIER_DROIT: 'AVANTS',
  DEUXIEME_LIGNE_GAUCHE: 'AVANTS', DEUXIEME_LIGNE_DROITE: 'AVANTS',
  TROISIEME_LIGNE_AILE_GAUCHE: 'AVANTS', TROISIEME_LIGNE_AILE_DROITE: 'AVANTS', NUMERO_8: 'AVANTS',
  DEMI_DE_MELEE: 'DEMIS', OUVREUR: 'DEMIS',
  CENTRE_INTERIEUR: 'TROIS_QUARTS', CENTRE_EXTERIEUR: 'TROIS_QUARTS',
  AILIER_GAUCHE: 'TROIS_QUARTS', AILIER_DROIT: 'TROIS_QUARTS', ARRIERE: 'TROIS_QUARTS',
};

export function positionNumber(p: Position): string { return POSITION_NUMBER[p] ?? '?'; }
export function positionShort(p: Position): string { return POSITION_SHORT[p] ?? '?'; }

/** Numéro de maillot + abréviation, colorés par ligne. */
export function PositionBadge({ position }: { readonly position: Position }) {
  const line = POSITION_LINE[position];
  return (
    <span className={`pos-badge line-${line.toLowerCase()}`} title={position.replaceAll('_', ' ').toLowerCase()}>
      <span className="pos-num">{positionNumber(position)}</span>
      <span className="pos-short">{positionShort(position)}</span>
    </span>
  );
}

// =============================================================================
// Attributs clés par poste
// =============================================================================

/**
 * Les trois attributs qui comptent vraiment à chaque poste.
 *
 * C'est ce qui distingue un tableau d'effectif de rugby d'un tableau générique :
 * on juge un pilier sur sa poussée, un ouvreur sur son pied et sa vision.
 */
export interface KeyAttribute {
  readonly label: string;
  readonly value: number;
  /**
   * V0.21 — estimation du scout. Fournie pour les joueurs extérieurs au club,
   * dont on ne connaît pas les attributs exacts.
   */
  readonly estimate?: { readonly display: string; readonly point: number; readonly certainty: string };
}

export function keyAttributesFor(player: {
  position: Position;
  technical: Record<string, number>;
  physical: Record<string, number>;
  mental: Record<string, number>;
  positionSpecific: Record<string, number | undefined>;
}): readonly KeyAttribute[] {
  const t = player.technical;
  const ph = player.physical;
  const m = player.mental;
  const ps = player.positionSpecific;

  switch (player.position) {
    case 'PILIER_GAUCHE':
    case 'PILIER_DROIT':
      return [
        { label: 'MÊL', value: ps.pousseeMelee ?? ph.puissance! },
        { label: 'PUI', value: ph.puissance! },
        { label: 'PLQ', value: t.plaquage! },
      ];
    case 'TALONNEUR':
      return [
        { label: 'LAN', value: ps.qualiteLancer ?? t.passe! },
        { label: 'MÊL', value: ps.pousseeMelee ?? ph.puissance! },
        { label: 'PLQ', value: t.plaquage! },
      ];
    case 'DEUXIEME_LIGNE_GAUCHE':
    case 'DEUXIEME_LIGNE_DROITE':
      return [
        { label: 'TOU', value: ps.sautEnTouche ?? ph.detente! },
        { label: 'MÊL', value: ps.pousseeMelee ?? ph.puissance! },
        { label: 'DÉB', value: t.deblayage! },
      ];
    case 'TROISIEME_LIGNE_AILE_GAUCHE':
    case 'TROISIEME_LIGNE_AILE_DROITE':
    case 'NUMERO_8':
      return [
        { label: 'GRA', value: ps.grattage ?? t.deblayage! },
        { label: 'PLQ', value: t.plaquage! },
        { label: 'PUI', value: ph.puissance! },
      ];
    case 'DEMI_DE_MELEE':
      return [
        { label: 'PAS', value: ps.passeRapide ?? t.passe! },
        { label: 'VIS', value: t.visionDeJeu! },
        { label: 'PIED', value: t.jeuAuPiedDynamique! },
      ];
    case 'OUVREUR':
      return [
        { label: 'BUT', value: t.jeuAuPiedPlace! },
        { label: 'VIS', value: t.visionDeJeu! },
        { label: 'DÉC', value: m.decision! },
      ];
    case 'CENTRE_INTERIEUR':
      return [
        { label: 'PUI', value: ph.puissance! },
        { label: 'PLQ', value: t.plaquage! },
        { label: 'CON', value: t.conservation! },
      ];
    case 'CENTRE_EXTERIEUR':
      return [
        { label: 'VIT', value: ph.vitesse! },
        { label: 'PAS', value: t.passe! },
        { label: 'VIS', value: t.visionDeJeu! },
      ];
    case 'AILIER_GAUCHE':
    case 'AILIER_DROIT':
      return [
        { label: 'VIT', value: ph.vitesse! },
        { label: 'FIN', value: ps.finition ?? t.conservation! },
        { label: 'AÉR', value: ps.jeuAerien ?? t.prisedeballeHaute! },
      ];
    case 'ARRIERE':
    default:
      return [
        { label: 'AÉR', value: ps.jeuAerien ?? t.prisedeballeHaute! },
        { label: 'PIED', value: t.jeuAuPiedDynamique! },
        { label: 'VIT', value: ph.vitesse! },
      ];
  }
}

/** Trio d'attributs clés, affiché en pastilles compactes. */
export function KeyAttributes({ attributes }: { readonly attributes: readonly KeyAttribute[] }) {
  // Tout inconnu : une seule mention vaut mieux que trois pastilles « ? »
  // alignées, qui font du bruit sans rien apprendre.
  if (attributes.length > 0 && attributes.every(a => a.estimate?.certainty === 'INCONNU')) {
    return <span className="key-attrs-unknown">jamais observé</span>;
  }
  return (
    <span className="key-attrs">
      {attributes.map(a => {
        const unknown = a.estimate?.certainty === 'INCONNU';
        const shown = a.estimate ? a.estimate.display : String(Math.round(a.value));
        const tone = unknown ? 'neutral' : toneFor(a.estimate ? a.estimate.point : a.value);
        return (
          <span key={a.label} className={`key-attr ${tone} ${shown.length > 3 ? 'wide' : ''}`} title={a.label}>
            <span className="ka-label">{a.label}</span>
            <span className="ka-value">{unknown ? '?' : shown}</span>
          </span>
        );
      })}
    </span>
  );
}
