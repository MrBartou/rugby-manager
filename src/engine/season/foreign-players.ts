/**
 * Les joueurs qui ne sont pas d'ici (V0.63).
 *
 * Le jeu fabrique des joueurs étrangers à trois endroits désormais : les clubs
 * de la coupe d'Europe, les nations qu'affronte le XV de France, et le marché
 * international. Jusqu'à la V0.63 il n'y en avait qu'un, la feuille de match
 * d'un adversaire européen écrite dans `data/`, et le premier réflexe en
 * ajoutant les deux autres aurait été de la recopier.
 *
 * C'est la faute que ce projet a déjà payée trois fois (deux `StaffMember`,
 * deux modules de sélection nationale, deux modèles de billetterie). Le
 * générateur vit donc ici, dans le moteur, à un seul exemplaire.
 *
 * ## Pourquoi dans `engine/` et plus dans `data/`
 *
 * `data/european-opponent.ts` justifiait son emplacement par la pureté du
 * moteur : « le moteur ignore d'où viennent les joueurs qu'on lui passe ».
 * C'était vrai tant que seule l'interface fabriquait ces joueurs. Depuis que la
 * session de saison doit composer sept adversaires internationaux pour les
 * simuler elle-même, il lui faut ce générateur, et `engine/` n'a pas le droit
 * d'importer `data/`. Fabriquer un joueur fictif est de toute façon de la règle
 * de jeu, pas de la persistance : `club/youth-generation.ts` le fait déjà ici.
 *
 * ## Ce que le module garantit
 *
 * **Le déterminisme d'identité.** Deux appels avec la même graine d'identité
 * rendent le même homme : même nom, même âge, même poste. C'est ce qui permet
 * à un club européen de garder son effectif d'une saison à l'autre au lieu
 * d'être régénéré, et donc à un adversaire d'exister.
 */

import { createRng } from '../rng.js';
import type { ClubId, Player, PlayerId, Position } from '../types.js';

// =============================================================================
// Les pays
// =============================================================================

/**
 * Les nationalités que le jeu sait fabriquer.
 *
 * Les six premières sont européennes (coupes), les trois dernières viennent de
 * l'hémisphère sud : elles n'existaient pas avant la V0.63, faute de marché
 * international où les rencontrer.
 */
export type ForeignCountry =
  | 'ANGLETERRE'
  | 'IRLANDE'
  | 'ECOSSE'
  | 'PAYS_DE_GALLES'
  | 'ITALIE'
  | 'AFRIQUE_DU_SUD'
  | 'NOUVELLE_ZELANDE'
  | 'AUSTRALIE'
  | 'ARGENTINE';

export const COUNTRY_LABEL: Readonly<Record<ForeignCountry, string>> = {
  ANGLETERRE: 'Angleterre',
  IRLANDE: 'Irlande',
  ECOSSE: 'Écosse',
  PAYS_DE_GALLES: 'Pays de Galles',
  ITALIE: 'Italie',
  AFRIQUE_DU_SUD: 'Afrique du Sud',
  NOUVELLE_ZELANDE: 'Nouvelle-Zélande',
  AUSTRALIE: 'Australie',
  ARGENTINE: 'Argentine',
};

/**
 * Patronymes par pays. Volontairement génériques : ce sont des joueurs
 * fictifs, pas des sportifs réels.
 */
const SURNAMES: Readonly<Record<ForeignCountry, readonly string[]>> = {
  ANGLETERRE: ['Hartley', 'Radwan', 'Sinckler', 'Ewels', 'Cokanasiga', 'Ludlam', 'Whiteley', 'Barrow'],
  IRLANDE: ['O\'Mahony', 'Kilcoyne', 'Doris', 'Gibson', 'Hanrahan', 'Treacy', 'McCloskey', 'Baird'],
  ECOSSE: ['Ritchie', 'Gray', 'Bhatti', 'Horne', 'Kinghorn', 'Fagerson', 'Turner', 'Steele'],
  PAYS_DE_GALLES: ['Llewellyn', 'Prydderch', 'Meredith', 'Gethin', 'Rhys-Owen', 'Tovey', 'Cadwallader', 'Vaughan'],
  ITALIE: ['Bellini', 'Ferrari', 'Zanon', 'Lucchesi', 'Riccioni', 'Vintcent', 'Trulla', 'Odogwu'],
  AFRIQUE_DU_SUD: ['Mostert', 'Nkosi', 'Dyantyi', 'Venter', 'Kriel', 'Roos', 'Steenekamp', 'Mbonambi'],
  NOUVELLE_ZELANDE: ['Ioane', 'Taukei\'aho', 'Sotutu', 'Havili', 'Blackadder', 'Tuipulotu', 'Ngatai', 'Reihana'],
  AUSTRALIE: ['Kerevi', 'Hooper', 'Slipper', 'Petaia', 'Wilson', 'Daugunu', 'Paisami', 'Lonergan'],
  ARGENTINE: ['Matera', 'Sánchez', 'Boffelli', 'Kremer', 'Delguy', 'Bertranou', 'Gallo', 'Moroni'],
};

const FIRST_NAMES: Readonly<Record<ForeignCountry, readonly string[]>> = {
  ANGLETERRE: ['Josh', 'Kyle', 'Charlie', 'Ben', 'Alfie', 'Sam'],
  IRLANDE: ['Fionn', 'Niall', 'Sean', 'Cian', 'Ronan', 'Oisín'],
  ECOSSE: ['Ewan', 'Callum', 'Rory', 'Struan', 'Hamish', 'Duncan'],
  PAYS_DE_GALLES: ['Bryn', 'Rhodri', 'Dylan', 'Owain', 'Gareth', 'Ieuan'],
  ITALIE: ['Marco', 'Tomas', 'Lorenzo', 'Alessandro', 'Matteo', 'Pietro'],
  AFRIQUE_DU_SUD: ['Ruan', 'Andries', 'Sibusiso', 'Willem', 'Thabo', 'Jaco'],
  NOUVELLE_ZELANDE: ['Tane', 'Ari', 'Manaia', 'Josh', 'Rico', 'Kane'],
  AUSTRALIE: ['Lachlan', 'Jed', 'Harry', 'Isaac', 'Cooper', 'Nate'],
  ARGENTINE: ['Facundo', 'Santiago', 'Joaquín', 'Tomás', 'Emiliano', 'Lucas'],
};

// =============================================================================
// La feuille de match
// =============================================================================

export const STARTER_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR',
  'AILIER_GAUCHE', 'AILIER_DROIT',
  'ARRIERE',
];

/** Banc réglementaire : 5 avants, 3 arrières. */
export const BENCH_POSITIONS: readonly Position[] = [
  'TALONNEUR', 'PILIER_GAUCHE', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR', 'CENTRE_INTERIEUR',
];

const FORWARDS: ReadonlySet<Position> = new Set(STARTER_POSITIONS.slice(0, 8));

function clamp(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

export interface ForeignPlayerInput {
  readonly clubId: ClubId;
  readonly country: ForeignCountry;
  readonly position: Position;
  /** Rang dans la feuille : sert à l'identifiant et au tirage des noms. */
  readonly index: number;
  /** Niveau visé, sur l'échelle 0-100 des attributs. */
  readonly strength: number;
  readonly birthYear: number;
  /**
   * Graine d'identité. Deux appels de même graine rendent le même homme : c'est
   * elle qui fait qu'un club européen garde son effectif d'une saison à l'autre.
   */
  readonly identity: string;
  readonly currentSeason: number;
}

/**
 * Fabrique un joueur cohérent avec le niveau de son club et son poste.
 *
 * Le profil suit les mêmes conventions que les effectifs du Top 14 : les avants
 * sont plus puissants et moins rapides, l'ouvreur bute, l'ailier prend les
 * ballons hauts.
 */
export function makeForeignPlayer(input: ForeignPlayerInput): Player {
  const rng = createRng(`foreign_${input.identity}`);
  const N = input.strength;
  const position = input.position;
  const isForward = FORWARDS.has(position);
  const noise = (): number => rng.nextInt(-5, 5);
  const surnames = SURNAMES[input.country];
  const firstNames = FIRST_NAMES[input.country];

  return {
    id: `${input.clubId as string}_p${input.index}_${hashOf(input.identity)}` as PlayerId,
    clubId: input.clubId,
    firstName: firstNames[rng.nextInt(0, firstNames.length - 1)]!,
    lastName: surnames[rng.nextInt(0, surnames.length - 1)]!,
    birthDate: `${input.birthYear}-${String(rng.nextInt(1, 12)).padStart(2, '0')}-${String(rng.nextInt(1, 28)).padStart(2, '0')}`,
    position,
    secondaryPositions: [],
    // Un joueur formé ailleurs n'est pas JIFF, et c'est tout l'enjeu du marché
    // international : chaque recrue étrangère resserre le quota de la feuille.
    isJiff: false,
    technical: {
      passe: clamp(N + noise() - (isForward ? 15 : 0)),
      plaquage: clamp(N + noise()),
      jeuAuPiedPlace: position === 'OUVREUR' ? clamp(N + 15) : position === 'ARRIERE' ? clamp(N + 5) : clamp(N - 25),
      jeuAuPiedDynamique: position === 'OUVREUR' || position === 'DEMI_DE_MELEE' || position === 'ARRIERE' ? clamp(N + 10) : clamp(N - 15),
      visionDeJeu: position === 'OUVREUR' || position === 'DEMI_DE_MELEE' ? clamp(N + 8) : clamp(N),
      conservation: clamp(N + (isForward ? 5 : 0)),
      prisedeballeHaute: position === 'AILIER_GAUCHE' || position === 'AILIER_DROIT' || position === 'ARRIERE' ? clamp(N + 10) : clamp(N - 5),
      deblayage: isForward ? clamp(N + 5) : clamp(N - 10),
    },
    physical: {
      vitesse: isForward ? clamp(N - 15) : clamp(N + 5),
      puissance: isForward ? clamp(N + 10) : clamp(N - 5),
      endurance: clamp(N + noise()),
      detente: position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE' ? clamp(N + 10) : clamp(N - 5),
      robustesse: clamp(N + noise()),
    },
    mental: {
      decision: clamp(N + (position === 'OUVREUR' ? 10 : 0)),
      leadership: clamp(N + noise()),
      sangFroid: clamp(N + noise()),
      agressivite: clamp(N + (isForward ? 5 : 0)),
      professionnalisme: clamp(N + noise()),
      discipline: clamp(N + noise()),
    },
    positionSpecific: buildPositionSpecific(position, N),
    traits: [],
    hidden: {
      potentiel: clamp(N + 5),
      ambition: rng.nextInt(35, 85),
      determinisme: rng.nextInt(35, 80),
      loyaute: rng.nextInt(30, 75),
      adaptabilite: rng.nextInt(35, 85),
    },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: {
      startSeason: input.currentSeason,
      endSeason: input.currentSeason + rng.nextInt(1, 3),
      annualSalary: 60_000 + Math.round(N * 4_200),
    },
  };
}

function buildPositionSpecific(position: Position, N: number): Player['positionSpecific'] {
  const out: Player['positionSpecific'] = {};
  if (position === 'PILIER_GAUCHE' || position === 'PILIER_DROIT') {
    out.pousseeMelee = clamp(N + 10);
    out.liftEnTouche = clamp(N + 5);
  }
  if (position === 'TALONNEUR') {
    out.pousseeMelee = clamp(N + 5);
    out.qualiteLancer = clamp(N + 12);
  }
  if (position === 'DEUXIEME_LIGNE_GAUCHE' || position === 'DEUXIEME_LIGNE_DROITE') {
    out.pousseeMelee = clamp(N + 8);
    out.sautEnTouche = clamp(N + 12);
  }
  if (position === 'TROISIEME_LIGNE_AILE_GAUCHE' || position === 'TROISIEME_LIGNE_AILE_DROITE' || position === 'NUMERO_8') {
    out.liftEnTouche = clamp(N + 8);
    out.grattage = clamp(N + 10);
  }
  if (position === 'DEMI_DE_MELEE') out.passeRapide = clamp(N + 10);
  if (position === 'AILIER_GAUCHE' || position === 'AILIER_DROIT' || position === 'ARRIERE') {
    out.finition = clamp(N + 5);
    out.jeuAerien = clamp(N + 8);
  }
  return out;
}

// =============================================================================
// Le renouvellement des effectifs
// =============================================================================

/**
 * Durée de vie d'un titulaire dans un effectif étranger, en saisons.
 *
 * C'est la valeur qui rend un effectif **persistant sans être immortel**.
 * Décalée d'un poste à l'autre, elle remplace en moyenne quatre joueurs par
 * saison : assez pour qu'un club change de visage en six ans, assez peu pour
 * qu'on reconnaisse l'équipe affrontée l'année dernière.
 */
export const FOREIGN_CAREER_LENGTH = 6;

/**
 * À quelle génération en est le poste `index` de cet effectif.
 *
 * Le décalage par `index` étale les départs : sans lui, les vingt-trois
 * joueurs partiraient à la retraite le même été.
 */
export function generationOf(seasonsSinceFounding: number, index: number): number {
  return Math.floor((seasonsSinceFounding + index) / FOREIGN_CAREER_LENGTH);
}

export interface ForeignSheetInput {
  readonly clubId: ClubId;
  readonly country: ForeignCountry;
  readonly strength: number;
  /** Graine stable de l'effectif, jamais dérivée de la saison. */
  readonly squadSeed: string;
  readonly currentSeason: number;
  /**
   * Saison de création du club. Les âges en découlent, et avec eux le fait
   * qu'un joueur vieillit d'un an par saison au lieu de renaître à trente ans.
   */
  readonly foundedSeason: number;
  /** Écart de niveau du banc par rapport au XV de départ. */
  readonly benchDrop?: number;
}

export interface ForeignSheet {
  readonly starters: readonly Player[];
  readonly substitutes: readonly Player[];
  readonly players: readonly Player[];
}

/**
 * Les vingt-trois d'un club ou d'une nation étrangère.
 *
 * Même graine + même saison de création = mêmes hommes, un an de plus. C'est la
 * promesse de la V0.63 : l'adversaire d'octobre dernier est encore là cette
 * année, avec un ou deux nouveaux visages.
 */
export function buildForeignSheet(input: ForeignSheetInput): ForeignSheet {
  const seasons = Math.max(0, input.currentSeason - input.foundedSeason);
  const benchDrop = input.benchDrop ?? 4;

  const build = (position: Position, index: number, strength: number): Player => {
    const generation = generationOf(seasons, index);
    const identity = `${input.squadSeed}_${index}_g${generation}`;
    // Âge d'arrivée dans l'effectif, puis un an de plus par saison passée.
    const ageRng = createRng(`age_${identity}`);
    const debutAge = ageRng.nextInt(21, 25);
    const debutSeason = input.foundedSeason + generation * FOREIGN_CAREER_LENGTH - index;
    return makeForeignPlayer({
      clubId: input.clubId,
      country: input.country,
      position,
      index,
      strength,
      birthYear: debutSeason - debutAge,
      identity,
      currentSeason: input.currentSeason,
    });
  };

  const starters = STARTER_POSITIONS.map((position, i) => build(position, i, input.strength));
  const substitutes = BENCH_POSITIONS.map(
    (position, i) => build(position, STARTER_POSITIONS.length + i, input.strength - benchDrop),
  );

  return { starters, substitutes, players: [...starters, ...substitutes] };
}

/**
 * Empreinte courte et stable d'une graine.
 *
 * Elle entre dans l'identifiant du joueur, et c'est ce qui distingue le pilier
 * d'aujourd'hui de celui qu'il a remplacé : deux générations d'un même poste
 * portant le même identifiant se confondraient dans le registre de carrière et
 * dans la mémoire des blessures.
 */
function hashOf(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}
