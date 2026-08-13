/**
 * Les préférences du joueur : V0.62.
 *
 * Aucun écran de réglages n'existait. La vitesse du match se rechoisissait à
 * chaque rencontre, les animations tournaient pour tout le monde, et un joueur
 * qui distingue mal le rouge du vert n'avait aucun recours devant les liserés
 * d'aptitude de la composition.
 *
 * ## Pourquoi elles ne vivent pas dans la sauvegarde
 *
 * Une préférence suit **le joueur**, pas la carrière. Le confort de lecture, la
 * vitesse du match ou les animations réduites ne doivent pas se réinitialiser
 * parce qu'on démarre une nouvelle partie, ni voyager avec un fichier de
 * sauvegarde qu'on transmettrait. Elles vivent donc à part, sous leur propre
 * clé, et se lisent avant même qu'une partie soit chargée.
 *
 * La délégation au staff, elle, est un choix de carrière : elle est dans la
 * sauvegarde, avec le reste de ce qui se décide en poste.
 */

export type MatchSpeed = 'x0.5' | 'x1' | 'x2' | 'x4' | 'x16';
export type TextScale = 'PETIT' | 'NORMAL' | 'GRAND' | 'TRES_GRAND';
export type ColourMode = 'SOMBRE' | 'CLAIR';
/**
 * Palette des indicateurs.
 *
 * `DALTONIEN` remplace le couple rouge/vert par bleu/orange, discriminable par
 * les deutéranopes et les protanopes, soit environ un homme sur douze. Ce n'est
 * pas un thème : les couleurs de marque ne bougent pas, seuls les signaux qui
 * portent une information changent.
 */
export type Palette = 'STANDARD' | 'DALTONIEN';

export interface Settings {
  /** Vitesse de lecture d'un match, appliquée par défaut à chaque rencontre. */
  readonly matchSpeed: MatchSpeed;
  /** Sauvegarde automatique à chaque journée. La désactiver n'efface rien. */
  readonly autosave: boolean;
  /** Demander confirmation avant les gestes irréversibles. */
  readonly confirmations: boolean;
  /** Volume général, préparé pour la V0.69. Sans effet aujourd'hui. */
  readonly volume: number;
  readonly reducedMotion: boolean;
  readonly textScale: TextScale;
  readonly palette: Palette;
  readonly colourMode: ColourMode;
}

export const DEFAULT_SETTINGS: Settings = {
  matchSpeed: 'x1',
  autosave: true,
  confirmations: true,
  volume: 70,
  reducedMotion: false,
  textScale: 'NORMAL',
  palette: 'STANDARD',
  colourMode: 'SOMBRE',
};

export const TEXT_SCALE_VALUE: Readonly<Record<TextScale, number>> = {
  PETIT: 0.92,
  NORMAL: 1,
  GRAND: 1.12,
  TRES_GRAND: 1.25,
};

export const MATCH_SPEED_VALUE: Readonly<Record<MatchSpeed, number>> = {
  'x0.5': 0.5, 'x1': 1, 'x2': 2, 'x4': 4, 'x16': 16,
};

const STORAGE_KEY = 'rm_settings_v1';

/**
 * Lecture défensive.
 *
 * Un réglage inconnu ou abîmé retombe sur sa valeur par défaut, champ par
 * champ : c'est la leçon de la v0.60 sur le stockage, appliquée ici avant
 * qu'elle ne coûte quelque chose. Une préférence illisible ne doit jamais
 * empêcher le jeu de démarrer.
 */
export function loadSettings(): Settings {
  try {
    const brut = localStorage.getItem(STORAGE_KEY);
    if (!brut) return DEFAULT_SETTINGS;
    const lu = JSON.parse(brut) as Partial<Settings>;
    return {
      matchSpeed: lu.matchSpeed && lu.matchSpeed in MATCH_SPEED_VALUE
        ? lu.matchSpeed : DEFAULT_SETTINGS.matchSpeed,
      autosave: typeof lu.autosave === 'boolean' ? lu.autosave : DEFAULT_SETTINGS.autosave,
      confirmations: typeof lu.confirmations === 'boolean'
        ? lu.confirmations : DEFAULT_SETTINGS.confirmations,
      volume: typeof lu.volume === 'number' && lu.volume >= 0 && lu.volume <= 100
        ? Math.round(lu.volume) : DEFAULT_SETTINGS.volume,
      reducedMotion: typeof lu.reducedMotion === 'boolean'
        ? lu.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
      textScale: lu.textScale && lu.textScale in TEXT_SCALE_VALUE
        ? lu.textScale : DEFAULT_SETTINGS.textScale,
      palette: lu.palette === 'DALTONIEN' || lu.palette === 'STANDARD'
        ? lu.palette : DEFAULT_SETTINGS.palette,
      colourMode: lu.colourMode === 'CLAIR' || lu.colourMode === 'SOMBRE'
        ? lu.colourMode : DEFAULT_SETTINGS.colourMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Un stockage plein ne doit pas empêcher de jouer : la préférence vaudra
    // pour la session en cours, et c'est tout ce qu'on peut promettre.
  }
}

/**
 * Le réglage système, quand le joueur n'a rien dit.
 *
 * `prefers-reduced-motion` est une préférence du système d'exploitation. La
 * respecter d'emblée est la seule attitude correcte : un joueur sujet au mal
 * des transports ne devrait pas avoir à découvrir un écran de réglages pour
 * cesser d'être malade.
 */
export function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Applique les réglages au document.
 *
 * Tout passe par des attributs sur la racine, jamais par des styles en ligne :
 * la feuille de style reste la seule à décider de l'apparence, et un réglage
 * ajouté demain n'aura pas à toucher au rendu de chaque composant.
 */
export function applySettings(settings: Settings): void {
  const racine = document.documentElement;
  racine.dataset.palette = settings.palette === 'DALTONIEN' ? 'daltonien' : 'standard';
  racine.dataset.theme = settings.colourMode === 'CLAIR' ? 'clair' : 'sombre';
  racine.dataset.motion = settings.reducedMotion || systemPrefersReducedMotion()
    ? 'reduit' : 'complet';
  racine.style.setProperty('--text-scale', String(TEXT_SCALE_VALUE[settings.textScale]));
}
