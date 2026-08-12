/**
 * Catalogue de traits — V0.4.
 *
 * Référence : 03-modele-joueur.md, section B (5-6 traits combinés, pool 30-50).
 * Inspiration M5 : Crusader Kings 3 — comportement émergent par combinaison.
 *
 * Structure :
 *   - 5 catégories (leadership, mental, ambition, relationnel, style)
 *   - "dur" = caractère stable (rarement modifié)
 *   - "doux" = peut évoluer avec l'expérience (V0.5+)
 *   - "exclusiveWith" = traits incompatibles (ne peuvent pas cohabiter)
 *
 * Les modifiers numériques sont consommés par le calcul de mood, l'IA des choix
 * d'événements, et le moteur de match (V0.5+).
 */

export type TraitCategory = 'LEADERSHIP' | 'MENTAL' | 'AMBITION' | 'RELATIONNEL' | 'STYLE';

export type TraitSeverity = 'DUR' | 'DOUX';   // dur = stable, doux = évolutif

export interface TraitDef {
  readonly id: string;
  readonly label: string;
  readonly category: TraitCategory;
  readonly severity: TraitSeverity;
  readonly description: string;
  /** IDs de traits incompatibles (validation à la génération). */
  readonly exclusiveWith?: readonly string[];
  /** Effet narratif (positif / négatif / mixte) — guide l'affichage UI. */
  readonly tone: 'positive' | 'negative' | 'neutral';
  /** Modificateurs numériques (consommés par mood, événements, moteur). */
  readonly modifiers?: TraitModifiers;
}

export interface TraitModifiers {
  /** Bonus / malus de leadership (capitanat, influence vestiaire). */
  readonly leadership?: number;
  /** Influence sur le mood quand titulaire / remplaçant. */
  readonly statusSensitivity?: number;     // -10 (insensible) à +10 (très sensible)
  /** Effet sur le mood lors d'un revers (défaite, mauvaise perf). */
  readonly resilienceUnderPressure?: number;
  /** Tendance à se mettre en retrait du collectif. */
  readonly socialRetreat?: number;
  /** Impact sur les relations partagées (mentor → relations +). */
  readonly relationshipBuilder?: number;
}

// =============================================================================
// Catalogue (~30 traits)
// =============================================================================

export const TRAITS: readonly TraitDef[] = [
  // -- Leadership ----------------------------------------------------------
  {
    id: 'leader_naturel',
    label: 'Leader naturel',
    category: 'LEADERSHIP',
    severity: 'DUR',
    tone: 'positive',
    description: 'Influence le vestiaire, capitanat envisageable, fédère autour de lui.',
    exclusiveWith: ['suiveur', 'electron_libre'],
    modifiers: { leadership: 8, relationshipBuilder: 4 },
  },
  {
    id: 'second_couteau',
    label: 'Second couteau',
    category: 'LEADERSHIP',
    severity: 'DOUX',
    tone: 'neutral',
    description: 'Soutien fiable, sans charisme dominant. Idéal vice-capitaine.',
    modifiers: { leadership: 3 },
  },
  {
    id: 'suiveur',
    label: 'Suiveur',
    category: 'LEADERSHIP',
    severity: 'DOUX',
    tone: 'neutral',
    description: 'A besoin d\'être guidé. Se fond dans le collectif, peu d\'influence personnelle.',
    exclusiveWith: ['leader_naturel'],
    modifiers: { leadership: -3 },
  },
  {
    id: 'electron_libre',
    label: 'Électron libre',
    category: 'LEADERSHIP',
    severity: 'DUR',
    tone: 'neutral',
    description: 'Imprévisible, ne suit pas les consignes. Talent brut mais difficile à manager.',
    exclusiveWith: ['leader_naturel', 'discipline'],
    modifiers: { socialRetreat: 5 },
  },

  // -- Mental --------------------------------------------------------------
  {
    id: 'sang_froid',
    label: 'Sang-froid',
    category: 'MENTAL',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Garde la tête froide dans les moments décisifs, fiable au pied.',
    exclusiveWith: ['fragile_mental', 'hothead'],
    modifiers: { resilienceUnderPressure: 6 },
  },
  {
    id: 'fragile_mental',
    label: 'Fragile mentalement',
    category: 'MENTAL',
    severity: 'DOUX',
    tone: 'negative',
    description: 'S\'effondre sous la pression. Mauvaise performance après une erreur.',
    exclusiveWith: ['sang_froid', 'professionnel'],
    modifiers: { resilienceUnderPressure: -7, statusSensitivity: 5 },
  },
  {
    id: 'hothead',
    label: 'Sang chaud',
    category: 'MENTAL',
    severity: 'DUR',
    tone: 'negative',
    description: 'Risque de carton, chambre les arbitres, mais peut allumer le pack.',
    exclusiveWith: ['sang_froid', 'professionnel'],
    modifiers: { resilienceUnderPressure: -3 },
  },
  {
    id: 'professionnel',
    label: 'Professionnel',
    category: 'MENTAL',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Hygiène irréprochable, exemple pour les jeunes. Peu sensible aux distractions.',
    exclusiveWith: ['hothead', 'fragile_mental'],
    modifiers: { resilienceUnderPressure: 3, statusSensitivity: -3 },
  },
  {
    id: 'travailleur',
    label: 'Travailleur acharné',
    category: 'MENTAL',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Premier à l\'entraînement, dernier parti. Progresse vite.',
    modifiers: { resilienceUnderPressure: 2 },
  },

  // -- Ambition ------------------------------------------------------------
  {
    id: 'ambitieux',
    label: 'Ambitieux',
    category: 'AMBITION',
    severity: 'DOUX',
    tone: 'neutral',
    description: 'Cherche un grand club, peut demander le départ si le club stagne.',
    exclusiveWith: ['attache_club'],
    modifiers: { statusSensitivity: 6 },
  },
  {
    id: 'satisfait',
    label: 'Satisfait',
    category: 'AMBITION',
    severity: 'DOUX',
    tone: 'neutral',
    description: 'Heureux de son sort actuel. Difficile à motiver pour aller plus haut.',
    modifiers: { statusSensitivity: -4 },
  },
  {
    id: 'mercenaire',
    label: 'Joueur d\'argent',
    category: 'AMBITION',
    severity: 'DUR',
    tone: 'negative',
    description: 'Suit l\'argent, peu attaché au maillot. À surveiller en fin de contrat.',
    exclusiveWith: ['attache_club', 'loyal'],
    modifiers: { socialRetreat: 4 },
  },
  {
    id: 'attache_club',
    label: 'Attaché au club',
    category: 'AMBITION',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Refuse les sirènes adverses, prêt à finir sa carrière sur place.',
    exclusiveWith: ['ambitieux', 'mercenaire'],
    modifiers: { statusSensitivity: -2 },
  },

  // -- Relationnel ---------------------------------------------------------
  {
    id: 'charismatique',
    label: 'Charismatique',
    category: 'RELATIONNEL',
    severity: 'DUR',
    tone: 'positive',
    description: 'Aimé du vestiaire, attire les nouveaux. Bonus aux relations.',
    exclusiveWith: ['solitaire'],
    modifiers: { relationshipBuilder: 6, leadership: 3 },
  },
  {
    id: 'solitaire',
    label: 'Solitaire',
    category: 'RELATIONNEL',
    severity: 'DUR',
    tone: 'neutral',
    description: 'Peu intégré au groupe, vit en marge. Pas mauvais joueur pour autant.',
    exclusiveWith: ['charismatique', 'mentor'],
    modifiers: { socialRetreat: 6, relationshipBuilder: -3 },
  },
  {
    id: 'mentor',
    label: 'Mentor',
    category: 'RELATIONNEL',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Investi dans la formation des jeunes. Bonus de progression pour ses élèves.',
    exclusiveWith: ['solitaire'],
    modifiers: { relationshipBuilder: 7 },
  },
  {
    id: 'rancunier',
    label: 'Rancunier',
    category: 'RELATIONNEL',
    severity: 'DUR',
    tone: 'negative',
    description: 'N\'oublie pas les conflits. Relations négatives durent plus longtemps.',
    exclusiveWith: ['loyal'],
    modifiers: { relationshipBuilder: -4 },
  },
  {
    id: 'loyal',
    label: 'Loyal',
    category: 'RELATIONNEL',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Soutient ses coéquipiers en toutes circonstances. Pardonne facilement.',
    exclusiveWith: ['rancunier', 'mercenaire'],
    modifiers: { relationshipBuilder: 4 },
  },
  {
    id: 'protecteur_jeunes',
    label: 'Protège les jeunes',
    category: 'RELATIONNEL',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Prend les jeunes sous son aile, les défend en interview.',
    modifiers: { relationshipBuilder: 5 },
  },

  // -- Style de jeu --------------------------------------------------------
  {
    id: 'aventureux',
    label: 'Aventureux',
    category: 'STYLE',
    severity: 'DUR',
    tone: 'neutral',
    description: 'Tente des choses. Crée des étincelles… ou des en-avants.',
    exclusiveWith: ['securitaire'],
  },
  {
    id: 'securitaire',
    label: 'Sécuritaire',
    category: 'STYLE',
    severity: 'DUR',
    tone: 'neutral',
    description: 'Joue sans risque. Faible d\'erreurs, peu de coups d\'éclat.',
    exclusiveWith: ['aventureux'],
  },
  {
    id: 'creatif',
    label: 'Créatif',
    category: 'STYLE',
    severity: 'DUR',
    tone: 'positive',
    description: 'Voit les espaces, ouvre les défenses. Rare et précieux.',
    exclusiveWith: ['securitaire'],
  },
  {
    id: 'discipline',
    label: 'Discipliné',
    category: 'STYLE',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Respecte les consignes, pas de pénalité bête. Idéal pour fin de match serrée.',
    exclusiveWith: ['electron_libre'],
  },
  {
    id: 'gros_motard',
    label: 'Gros bosseur sur les set-pieces',
    category: 'STYLE',
    severity: 'DOUX',
    tone: 'positive',
    description: 'Spécialiste mêlée/touche, premier sur les phases statiques.',
  },
  {
    id: 'killer_instinct',
    label: 'Instinct de tueur',
    category: 'STYLE',
    severity: 'DUR',
    tone: 'positive',
    description: 'Dans le rouge il fait la différence. Plus efficace en zone d\'essai.',
  },
  {
    id: 'fragile_blessure',
    label: 'Joueur de verre',
    category: 'MENTAL',
    severity: 'DUR',
    tone: 'negative',
    description: 'Cumule les blessures musculaires. Gestion fine de la charge nécessaire.',
  },
  {
    id: 'inusable',
    label: 'Inusable',
    category: 'MENTAL',
    severity: 'DUR',
    tone: 'positive',
    description: 'Rare en infirmerie. Peut enchaîner les matchs sans broncher.',
    exclusiveWith: ['fragile_blessure'],
  },
];

// =============================================================================
// Indexation par id pour lookup rapide
// =============================================================================

const TRAIT_BY_ID = new Map(TRAITS.map(t => [t.id, t] as const));

export function getTraitDef(id: string): TraitDef | undefined {
  return TRAIT_BY_ID.get(id);
}

export function traitsByCategory(category: TraitCategory): readonly TraitDef[] {
  return TRAITS.filter(t => t.category === category);
}

/** Vérifie si un set de traits est cohérent (pas d'exclusivités violées). */
export function areTraitsCompatible(traitIds: readonly string[]): boolean {
  const set = new Set(traitIds);
  for (const id of traitIds) {
    const def = TRAIT_BY_ID.get(id);
    if (!def?.exclusiveWith) continue;
    for (const ex of def.exclusiveWith) {
      if (set.has(ex)) return false;
    }
  }
  return true;
}
