/**
 * Identité visuelle des clubs — V0.16.
 *
 * Jusqu'ici, l'interface était rigoureusement identique quel que soit le club
 * managé : mêmes gris, même accent menthe, aucun blason. On *utilisait une app*
 * au lieu de *manager Toulouse*. Seul l'écran de match exploitait des couleurs
 * d'équipe — la preuve que le besoin était identifié mais jamais généralisé.
 *
 * Ce module fournit la couche d'identité que toute la direction artistique
 * « broadcast » vient exploiter : l'accent de l'interface **devient la couleur du
 * club**, comme un habillage d'avant-match change selon l'affiche.
 *
 * ## Périmètre juridique
 *
 * On ne reproduit **aucun logo** : les blasons sont générés géométriquement à
 * partir des initiales et des couleurs. Les couleurs d'un club sont un fait
 * notoire, pas une marque figurative — c'est volontairement moins exposé que les
 * noms de clubs et de joueurs déjà présents dans les données (cf. 12-juridique.md).
 */

export interface ClubIdentity {
  /** Couleur dominante du maillot. */
  readonly primary: string;
  /** Couleur d'accompagnement (bandes, col, short). */
  readonly secondary: string;
  /**
   * Couleur de texte à poser sur `primary`. Calculée pour rester lisible :
   * certains clubs jouent en jaune vif, où du blanc serait illisible.
   */
  readonly onPrimary: string;
  /** Forme du blason généré. */
  readonly crest: CrestShape;
  /** Motif du maillot, utilisé par les bandeaux d'habillage. */
  readonly pattern: JerseyPattern;
}

export type CrestShape = 'ECU' | 'ROND' | 'BOUCLIER' | 'LOSANGE';
export type JerseyPattern = 'UNI' | 'BANDES' | 'CERCEAUX' | 'CHEVRON';

/**
 * Couleurs des 14 clubs de Top 14. Ce sont les couleurs de maillot, connues de
 * tous ; aucune n'est une reproduction de marque.
 */
const TOP14_IDENTITIES: Readonly<Record<string, ClubIdentity>> = {
  toulouse:    { primary: '#E2001A', secondary: '#111111', onPrimary: '#FFFFFF', crest: 'ECU',      pattern: 'UNI' },
  ubb:         { primary: '#8C1D2C', secondary: '#F2F2F2', onPrimary: '#FFFFFF', crest: 'BOUCLIER', pattern: 'CHEVRON' },
  larochelle:  { primary: '#FFD100', secondary: '#111111', onPrimary: '#1A1A00', crest: 'ROND',     pattern: 'CERCEAUX' },
  toulon:      { primary: '#D2001C', secondary: '#111111', onPrimary: '#FFFFFF', crest: 'BOUCLIER', pattern: 'BANDES' },
  racing:      { primary: '#7BAFD4', secondary: '#FFFFFF', onPrimary: '#0A1A24', crest: 'LOSANGE',  pattern: 'BANDES' },
  stade:       { primary: '#E5397F', secondary: '#0A2A5E', onPrimary: '#FFFFFF', crest: 'ECU',      pattern: 'UNI' },
  clermont:    { primary: '#FFDD00', secondary: '#14213D', onPrimary: '#1A1A00', crest: 'ROND',     pattern: 'BANDES' },
  lyon:        { primary: '#C8102E', secondary: '#0A2A5E', onPrimary: '#FFFFFF', crest: 'BOUCLIER', pattern: 'CHEVRON' },
  montpellier: { primary: '#0B4DA2', secondary: '#F2F2F2', onPrimary: '#FFFFFF', crest: 'ECU',      pattern: 'CERCEAUX' },
  castres:     { primary: '#4B92DB', secondary: '#FFFFFF', onPrimary: '#06192B', crest: 'LOSANGE',  pattern: 'CERCEAUX' },
  pau:         { primary: '#0B6E4F', secondary: '#FFFFFF', onPrimary: '#FFFFFF', crest: 'ECU',      pattern: 'BANDES' },
  bayonne:     { primary: '#0B4DA2', secondary: '#E2001A', onPrimary: '#FFFFFF', crest: 'BOUCLIER', pattern: 'CHEVRON' },
  usap:        { primary: '#C8102E', secondary: '#FFB81C', onPrimary: '#FFFFFF', crest: 'ECU',      pattern: 'BANDES' },
  vannes:      { primary: '#B01B2E', secondary: '#FFFFFF', onPrimary: '#FFFFFF', crest: 'ROND',     pattern: 'UNI' },
};

const CREST_SHAPES: readonly CrestShape[] = ['ECU', 'ROND', 'BOUCLIER', 'LOSANGE'];
const PATTERNS: readonly JerseyPattern[] = ['UNI', 'BANDES', 'CERCEAUX', 'CHEVRON'];

/** Palette de repli pour les clubs générés (promus de Pro D2, adversaires européens). */
const FALLBACK_COLORS: readonly (readonly [string, string])[] = [
  ['#1D6F8B', '#F2F2F2'],
  ['#6B3FA0', '#FFD100'],
  ['#2E7D32', '#111111'],
  ['#B5651D', '#FFFFFF'],
  ['#37474F', '#FF7043'],
  ['#8E244D', '#F5E6C8'],
  ['#0F5257', '#EFC050'],
  ['#7A3E1D', '#E8DCC8'],
];

/** Hash déterministe d'une chaîne. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/** Luminance relative, pour décider d'un texte clair ou sombre. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Identité d'un club. Les clubs inconnus (promus, adversaires européens) reçoivent
 * une identité générée stable plutôt qu'un gris par défaut : rien ne doit rester
 * anonyme à l'écran.
 */
export function clubIdentity(clubId: string): ClubIdentity {
  const known = TOP14_IDENTITIES[clubId];
  if (known) return known;

  const h = hash(clubId);
  const pair = FALLBACK_COLORS[h % FALLBACK_COLORS.length]!;
  const primary = pair[0];
  return {
    primary,
    secondary: pair[1],
    onPrimary: luminance(primary) > 0.45 ? '#12140F' : '#FFFFFF',
    crest: CREST_SHAPES[(h >> 3) % CREST_SHAPES.length]!,
    pattern: PATTERNS[(h >> 7) % PATTERNS.length]!,
  };
}

/** Convertit un hex en `r, g, b` pour composer des rgba() en CSS. */
export function hexToRgbChannels(hex: string): string {
  const n = hex.replace('#', '');
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ].join(', ');
}

/**
 * Éclaircit une couleur vers le blanc.
 * Les couleurs de maillot sont souvent trop sombres pour servir d'accent sur fond
 * noir (le bordeaux de l'UBB, le vert de Pau) : on remonte la luminosité pour
 * garantir la lisibilité sans perdre l'identité.
 */
export function lighten(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix(parseInt(n.slice(0, 2), 16));
  const g = mix(parseInt(n.slice(2, 4), 16));
  const b = mix(parseInt(n.slice(4, 6), 16));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Variante lisible d'une couleur de club sur fond sombre.
 * Sert d'accent d'interface : c'est elle qui remplace le cyan générique.
 */
export function readableAccent(hex: string): string {
  const l = luminance(hex);
  if (l >= 0.30) return hex;              // déjà clair (jaune, ciel)
  if (l >= 0.14) return lighten(hex, 0.22);
  return lighten(hex, 0.42);              // bordeaux, vert foncé, bleu marine
}

/**
 * Variables CSS à poser sur un conteneur pour teinter toute l'interface aux
 * couleurs du club. C'est le pivot de la direction « broadcast » : chaque écran
 * s'habille comme une affiche d'avant-match.
 */
export function clubCssVars(clubId: string): Record<string, string> {
  const id = clubIdentity(clubId);
  const accent = readableAccent(id.primary);
  return {
    '--club-primary': id.primary,
    '--club-primary-rgb': hexToRgbChannels(id.primary),
    '--club-secondary': id.secondary,
    '--club-on-primary': id.onPrimary,
    '--club-accent': accent,
    '--club-accent-rgb': hexToRgbChannels(accent),
  };
}
