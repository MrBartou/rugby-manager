/**
 * Génération de jeunes — V0.7 phase 4.
 *
 * Chaque club produit 4-6 jeunes par saison, modulé par le niveau du centre
 * de formation (1-5). Les jeunes ont :
 *  - 18-20 ans
 *  - stats basses (35-55)
 *  - potentiel élevé (60-90 selon académie)
 *  - contrat 3 ans, salaire bas (50-100k€)
 *
 * Noms tirés d'une banque française. Positions équilibrées (avants/arrières).
 */

import { createRng, type Rng } from '../rng.js';
import { focusBonusFor, positionPoolFor, type AcademyFocus } from './academy.js';
import type {
  Club,
  ClubId,
  MentalAttributes,
  PhysicalAttributes,
  Player,
  PlayerId,
  Position,
  PositionSpecificStats,
  TechnicalAttributes,
} from '../types.js';

// =============================================================================
// Banque de noms (proxy : prénoms et noms typiques rugby français)
// =============================================================================

const FIRST_NAMES = [
  'Antoine', 'Mathieu', 'Julien', 'Maxime', 'Thomas', 'Lucas', 'Hugo', 'Romain',
  'Théo', 'Nathan', 'Léo', 'Paul', 'Arthur', 'Louis', 'Gabriel', 'Raphaël',
  'Adrien', 'Baptiste', 'Clément', 'Damien', 'Alexandre', 'Florian', 'Pierre',
  'Vincent', 'Nicolas', 'Sébastien', 'Jérémy', 'Quentin', 'Antonin', 'Tom',
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier',
  'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier',
  'Faure', 'Rousseau', 'Blanc', 'Guérin', 'Muller', 'Henry', 'Roussel', 'Boyer',
];

// =============================================================================
// Distribution par poste pour une promo (≈ XV équilibré)
// =============================================================================

const YOUTH_POSITION_POOL: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'TROISIEME_LIGNE_AILE_GAUCHE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'AILIER_DROIT', 'ARRIERE',
];

function clampPotential(v: number): number {
  return Math.max(35, Math.min(95, v));
}

function pickPositions(rng: Rng, count: number): readonly Position[] {
  const out: Position[] = [];
  for (let i = 0; i < count; i++) {
    out.push(rng.pick(YOUTH_POSITION_POOL));
  }
  return out;
}

// =============================================================================
// Stats : bases basses + variance
// =============================================================================

function statBase(rng: Rng, mid: number, range: number): number {
  return Math.max(1, Math.min(99, Math.round(mid + (rng.next() - 0.5) * range * 2)));
}

function buildTechnical(rng: Rng, position: Position): TechnicalAttributes {
  const base = 42;
  const isFwd = ['PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT', 'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE', 'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8'].includes(position);
  return {
    passe: statBase(rng, base + (isFwd ? -10 : 5), 8),
    plaquage: statBase(rng, base + (isFwd ? 5 : 0), 8),
    jeuAuPiedPlace: statBase(rng, position === 'OUVREUR' ? base + 5 : base - 15, 8),
    jeuAuPiedDynamique: statBase(rng, position === 'OUVREUR' || position === 'DEMI_DE_MELEE' || position === 'ARRIERE' ? base + 5 : base - 8, 8),
    visionDeJeu: statBase(rng, base, 8),
    conservation: statBase(rng, base + (isFwd ? 5 : 0), 6),
    prisedeballeHaute: statBase(rng, ['AILIER_GAUCHE', 'AILIER_DROIT', 'ARRIERE'].includes(position) ? base + 5 : base - 5, 6),
    deblayage: statBase(rng, base + (isFwd ? 5 : -8), 6),
  };
}

function buildPhysical(rng: Rng, position: Position): PhysicalAttributes {
  const isFwd = ['PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT', 'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE', 'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8'].includes(position);
  return {
    vitesse: statBase(rng, isFwd ? 35 : 55, 8),
    puissance: statBase(rng, isFwd ? 55 : 40, 8),
    endurance: statBase(rng, 50, 8),
    detente: statBase(rng, 45, 8),
    robustesse: statBase(rng, 50, 10),
  };
}

function buildMental(rng: Rng): MentalAttributes {
  return {
    decision: statBase(rng, 40, 8),
    leadership: statBase(rng, 35, 10),
    sangFroid: statBase(rng, 40, 10),
    agressivite: statBase(rng, 50, 12),
    professionnalisme: statBase(rng, 50, 10),
    discipline: statBase(rng, 50, 10),
  };
}

function buildPositionSpecific(rng: Rng, position: Position): PositionSpecificStats {
  const out: PositionSpecificStats = {};
  if (position === 'PILIER_GAUCHE' || position === 'PILIER_DROIT') {
    out.pousseeMelee = statBase(rng, 50, 8);
  }
  if (position === 'TALONNEUR') {
    out.pousseeMelee = statBase(rng, 45, 8);
    out.qualiteLancer = statBase(rng, 50, 10);
  }
  if (position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE') {
    out.pousseeMelee = statBase(rng, 48, 8);
    out.sautEnTouche = statBase(rng, 55, 8);
  }
  if (position === 'TROISIEME_LIGNE_AILE_GAUCHE' || position === 'TROISIEME_LIGNE_AILE_DROITE' || position === 'NUMERO_8') {
    out.grattage = statBase(rng, 50, 10);
  }
  if (position === 'DEMI_DE_MELEE') {
    out.passeRapide = statBase(rng, 50, 8);
  }
  if (['AILIER_GAUCHE', 'AILIER_DROIT', 'ARRIERE'].includes(position)) {
    out.finition = statBase(rng, 50, 10);
    out.jeuAerien = statBase(rng, 45, 8);
  }
  return out;
}

// =============================================================================
// Génération
// =============================================================================

export interface GenerateYouthInput {
  readonly club: Club;
  readonly currentSeason: number;
  /** Niveau du centre de formation (1-5). 1=mauvais, 5=excellent. */
  readonly academyLevel: number;
  /**
   * V0.39 — orientation du centre. Absente, la promotion reste équilibrée : les
   * appelants antérieurs continuent de fonctionner à l'identique.
   */
  readonly focus?: AcademyFocus;
  readonly seed: string;
  readonly existingPlayerIds: ReadonlySet<string>;
}

export function generateYouthIntake(input: GenerateYouthInput): readonly Player[] {
  const rng = createRng(`${input.seed}_youth_${input.club.id}_${input.currentSeason}`);
  const count = rng.nextInt(3, 6);
  // V0.39 — l'orientation décide de *qui* sort du centre. Un centre orienté
  // avants sort des piliers, pas des ailiers.
  const focus = input.focus ?? 'EQUILIBRE';
  const pool = positionPoolFor(focus);
  const positions = Array.from({ length: count }, () => rng.pick(pool));
  const intake: Player[] = [];

  for (let i = 0; i < count; i++) {
    const position = positions[i]!;
    const age = rng.nextInt(18, 20);
    const birthYear = input.currentSeason - age;

    // Potentiel : modulé par academyLevel (1-5)
    // level 1 → 50-65, level 5 → 75-92
    const potentielMin = 45 + (input.academyLevel - 1) * 7;
    const potentielMax = potentielMin + 18;
    // Le bonus d'orientation reste modeste : l'orientation dit qui l'on forme,
    // c'est l'investissement qui décide de la qualité.
    const potentiel = clampPotential(
      rng.nextInt(potentielMin, Math.min(95, potentielMax)) + focusBonusFor(focus, position),
    );

    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    let id = (`${input.club.id}_youth_${input.currentSeason}_${firstName}_${lastName}_${i}`.toLowerCase().replace(/\s+/g, '_')) as PlayerId;
    while (input.existingPlayerIds.has(id as string)) {
      id = (id + '_x') as PlayerId;
    }

    const player: Player = {
      id,
      clubId: input.club.id,
      firstName,
      lastName,
      birthDate: `${birthYear}-${String(rng.nextInt(1, 12)).padStart(2, '0')}-${String(rng.nextInt(1, 28)).padStart(2, '0')}`,
      position,
      secondaryPositions: [],
      isJiff: true,                              // les jeunes formés au club sont JIFF
      technical: buildTechnical(rng, position),
      physical: buildPhysical(rng, position),
      mental: buildMental(rng),
      positionSpecific: buildPositionSpecific(rng, position),
      traits: [],
      hidden: {
        potentiel,
        ambition: rng.nextInt(40, 80),
        determinisme: rng.nextInt(40, 80),
        loyaute: rng.nextInt(60, 90),            // jeunes du centre = loyaux
        adaptabilite: rng.nextInt(40, 75),
      },
      dynamic: { forme: 60, fatigue: 0, mood: 70, moodModifiers: [] },
      contract: {
        startSeason: input.currentSeason,
        endSeason: input.currentSeason + 3,
        annualSalary: 50_000 + rng.nextInt(0, 50) * 1_000,
      },
    };
    intake.push(player);
  }
  return intake;
}

/**
 * Mappage tier → academyLevel par défaut (V0.7 : avant un éventuel upgrade UI).
 */
export function defaultAcademyLevel(club: Club): number {
  switch (club.tier) {
    case 'GROS_BUDGET': return 4;
    case 'BUDGET_MOYEN': return 3;
    case 'PETIT_BUDGET': return 2;
  }
}

// =============================================================================
// Vivier d'agents libres — V0.37
// =============================================================================

/**
 * Joueurs sans club, disponibles dès le coup d'envoi de la carrière.
 *
 * Sans eux, le marché des agents libres restait **vide toute la saison** : les
 * contrats n'expirent qu'à l'intersaison. Le joker médical n'avait donc jamais
 * personne à signer, et un club décimé par les blessures ne pouvait rien faire.
 *
 * Ce sont des joueurs de complément, pas des aubaines : trentenaires en fin de
 * parcours ou seconds couteaux restés sans contrat. Un vivier de cracks ferait
 * du recrutement un self-service.
 */
export function generateFreeAgentPool(input: {
  readonly currentSeason: number;
  readonly seed: string;
  readonly count?: number;
  readonly existingPlayerIds: ReadonlySet<string>;
}): readonly Player[] {
  const rng = createRng(`free_agents_${input.seed}_${input.currentSeason}`);
  const count = input.count ?? 22;
  const pool: Player[] = [];
  const taken = new Set(input.existingPlayerIds);

  for (let i = 0; i < count; i++) {
    // Un poste par tirage, sans quota : le vivier n'a pas à être équilibré,
    // c'est même ce qui rend certaines blessures difficiles à compenser.
    const position = pickPositions(rng, 1)[0]!;
    const age = rng.nextInt(24, 34);
    const birthYear = input.currentSeason - age;

    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    let id = (`libre_${input.currentSeason}_${firstName}_${lastName}_${i}`
      .toLowerCase().replace(/\s+/g, '_')) as PlayerId;
    while (taken.has(id as string)) id = (id + '_x') as PlayerId;
    taken.add(id as string);

    pool.push({
      id,
      // Un agent libre n'appartient à personne : le club d'origine ne sert qu'à
      // l'identification, `freeAgent` fait foi partout dans le moteur.
      clubId: 'libre' as Player['clubId'],
      firstName,
      lastName,
      birthDate: `${birthYear}-${String(rng.nextInt(1, 12)).padStart(2, '0')}-${String(rng.nextInt(1, 28)).padStart(2, '0')}`,
      position,
      secondaryPositions: [],
      isJiff: rng.nextBool(0.55),
      technical: buildTechnical(rng, position),
      physical: buildPhysical(rng, position),
      mental: buildMental(rng),
      positionSpecific: buildPositionSpecific(rng, position),
      traits: [],
      hidden: {
        potentiel: rng.nextInt(48, 68),
        ambition: rng.nextInt(30, 70),
        determinisme: rng.nextInt(30, 70),
        loyaute: rng.nextInt(30, 70),
        adaptabilite: rng.nextInt(45, 85),
      },
      dynamic: { forme: 55, fatigue: 0, mood: 55, moodModifiers: [] },
      freeAgent: true,
      contract: {
        startSeason: input.currentSeason,
        endSeason: input.currentSeason,
        annualSalary: 60_000 + rng.nextInt(0, 60) * 1_000,
      },
    });
  }

  return pool;
}

// =============================================================================
// Effectif complet d'un club — V0.44
// =============================================================================

/**
 * Les quinze postes, plus la profondeur qu'un club doit avoir pour tenir une
 * saison de vingt-six journées avec des blessés et des suspendus.
 */
const SQUAD_TEMPLATE: readonly Position[] = [
  // Deux joueurs par poste de devant, la mêlée s'use vite.
  'PILIER_GAUCHE', 'PILIER_GAUCHE', 'TALONNEUR', 'TALONNEUR', 'PILIER_DROIT', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_GAUCHE',
  'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8', 'NUMERO_8',
  'DEMI_DE_MELEE', 'DEMI_DE_MELEE', 'OUVREUR', 'OUVREUR',
  'AILIER_GAUCHE', 'AILIER_DROIT', 'AILIER_DROIT',
  'CENTRE_INTERIEUR', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'ARRIERE', 'ARRIERE',
];

export interface GenerateSquadInput {
  readonly clubId: ClubId;
  readonly currentSeason: number;
  /**
   * Niveau visé de l'effectif, sur l'échelle des attributs. Le Top 14 tourne
   * autour de 68-80 ; la Pro D2 se situe nettement en dessous, et c'est
   * précisément ce qui fait de la descente une sanction.
   */
  readonly targetLevel: number;
  readonly seed: string;
  readonly existingPlayerIds: ReadonlySet<string>;
}

/**
 * Effectif complet et crédible pour un club qui n'en a pas.
 *
 * Les clubs de Pro D2 n'existent dans aucun CSV : les écrire à la main
 * représenterait plusieurs centaines de lignes de données mortes, et les
 * régénérer à chaque appel donnerait des joueurs différents d'un rendu à
 * l'autre. On les fabrique donc une fois, de façon **déterministe**, et
 * l'appelant les persiste comme n'importe quel autre joueur.
 *
 * La couverture de tous les postes est garantie par construction — un club sans
 * numéro 8 fige la composition d'équipe, et donc la saison.
 */
export function generateClubSquad(input: GenerateSquadInput): readonly Player[] {
  const rng = createRng(`squad_${input.seed}_${input.clubId as string}`);
  const taken = new Set(input.existingPlayerIds);
  const squad: Player[] = [];

  // Décalage appliqué aux attributs : les générateurs visent un jeune de centre
  // de formation, on remonte l'ensemble au niveau demandé.
  const lift = input.targetLevel - 45;

  SQUAD_TEMPLATE.forEach((position, i) => {
    const age = rng.nextInt(20, 33);
    const birthYear = input.currentSeason - age;
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);

    let id = (`${input.clubId as string}_${firstName}_${lastName}_${i}`
      .toLowerCase().replace(/\s+/g, '_')) as PlayerId;
    while (taken.has(id as string)) id = (id + '_x') as PlayerId;
    taken.add(id as string);

    // Les meilleurs joueurs d'un club sont au-dessus de sa moyenne, les
    // doublures en dessous : un effectif plat n'a pas de hiérarchie, donc
    // aucune décision de composition à prendre.
    const spread = rng.nextInt(-6, 8);
    const shift = (v: number): number => Math.max(1, Math.min(99, Math.round(v + lift + spread)));

    const technical = buildTechnical(rng, position);
    const physical = buildPhysical(rng, position);
    const mental = buildMental(rng);
    const specific = buildPositionSpecific(rng, position);

    squad.push({
      id,
      clubId: input.clubId,
      firstName,
      lastName,
      birthDate: `${birthYear}-${String(rng.nextInt(1, 12)).padStart(2, '0')}-${String(rng.nextInt(1, 28)).padStart(2, '0')}`,
      position,
      secondaryPositions: [],
      isJiff: rng.nextBool(0.7),
      technical: mapAttributes(technical, shift),
      physical: mapAttributes(physical, shift),
      mental: mapAttributes(mental, shift),
      positionSpecific: mapAttributes(specific, shift),
      traits: [],
      hidden: {
        potentiel: Math.min(99, Math.round(input.targetLevel + rng.nextInt(2, 18))),
        ambition: rng.nextInt(30, 80),
        determinisme: rng.nextInt(30, 80),
        loyaute: rng.nextInt(30, 80),
        adaptabilite: rng.nextInt(40, 85),
      },
      dynamic: { forme: 55, fatigue: 0, mood: 55, moodModifiers: [] },
      freeAgent: false,
      contract: {
        startSeason: input.currentSeason,
        // Échéances étalées : sans quoi tout l'effectif arriverait en fin de
        // contrat la même année et le club se viderait d'un coup.
        endSeason: input.currentSeason + rng.nextInt(1, 4),
        annualSalary: 45_000 + Math.round(input.targetLevel * 1_800) + rng.nextInt(0, 40) * 1_000,
      },
    });
  });

  return squad;
}

/** Applique un décalage à tous les champs numériques d'un bloc d'attributs. */
function mapAttributes<T extends object>(block: T, shift: (v: number) => number): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    out[key] = typeof value === 'number' ? shift(value) : value;
  }
  return out as T;
}
