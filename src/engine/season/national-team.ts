/**
 * Le XV de France — V0.58.
 *
 * Les trêves internationales existent depuis la V0.8, et une sélection n'y a
 * jamais été autre chose qu'une **absence** : les trois meilleurs JIFF de
 * chaque club — quarante-deux joueurs pour une équipe de quinze — disparaissaient
 * deux journées, revenaient, et rien n'avait changé. Aucun match n'était joué,
 * aucune cape n'était comptée, être international ne valait rien.
 *
 * C'est pourtant l'un des deux horizons d'une carrière de joueur français, et
 * la seule chose qu'un club puisse offrir qu'un autre club ne peut pas acheter :
 * de la visibilité au bon moment.
 *
 * ## Ce que le module fait
 *
 *  - il **compose un groupe** de trente-trois, avec des quotas par poste : un
 *    sélectionneur ne prend pas les trente-trois meilleurs joueurs du pays, il
 *    prend cinq piliers, trois talonneurs et deux arrières ;
 *  - il **compte les capes**, et une carrière internationale finit par peser
 *    sur ce que vaut un joueur et sur ce qu'il accepte ;
 *  - il **joue les matchs** — deux tests d'automne, cinq matchs du Tournoi —
 *    et en publie les résultats ;
 *  - il **renvoie les joueurs fatigués**, et parfois blessés.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne simule pas les rencontres internationales phase par phase. Le moteur en
 * serait capable, mais il faudrait construire cinq effectifs étrangers complets
 * pour une information qui tient en une ligne de score. On estime le résultat à
 * partir de la force du groupe retenu, comme `loans.ts` estime le temps de jeu
 * d'un joueur prêté plutôt que de lui simuler une saison de Pro D2.
 *
 * Et il ne déplace pas les trêves du calendrier : le club perd ses
 * internationaux aux journées 9, 10, 16 et 17, comme depuis la V0.8. Le Tournoi
 * compte cinq matchs pour deux journées de trêve — ils sont donc résolus en
 * deux blocs. C'est une approximation assumée du calendrier réel, où le Top 14
 * continue de se jouer pendant une partie du Tournoi.
 */

import type { ClubId, Player, PlayerId, Position } from '../types.js';
import type { Rng } from '../rng.js';

// =============================================================================
// Qui est sélectionnable
// =============================================================================

/** Taille du groupe, comme dans la vraie vie. */
export const SQUAD_SIZE = 33;

/**
 * Quotas par poste.
 *
 * C'est ce qui distingue une sélection d'un classement : un sélectionneur ne
 * prend pas les trente-trois meilleurs joueurs du pays. Sans quotas, le groupe
 * se remplissait de troisièmes lignes — ils sont nombreux et bien notés — et
 * partait au Tournoi sans talonneur.
 */
const QUOTAS: readonly { readonly group: string; readonly count: number }[] = [
  { group: 'PILIER', count: 5 },
  { group: 'TALONNEUR', count: 3 },
  { group: 'DEUXIEME_LIGNE', count: 4 },
  { group: 'TROISIEME_LIGNE', count: 6 },
  { group: 'DEMI_DE_MELEE', count: 3 },
  { group: 'OUVREUR', count: 3 },
  { group: 'CENTRE', count: 4 },
  { group: 'AILIER', count: 3 },
  { group: 'ARRIERE', count: 2 },
];

function groupOf(position: Position): string {
  switch (position) {
    case 'PILIER_GAUCHE': case 'PILIER_DROIT': return 'PILIER';
    case 'DEUXIEME_LIGNE_GAUCHE': case 'DEUXIEME_LIGNE_DROITE': return 'DEUXIEME_LIGNE';
    case 'TROISIEME_LIGNE_AILE_GAUCHE': case 'TROISIEME_LIGNE_AILE_DROITE': case 'NUMERO_8':
      return 'TROISIEME_LIGNE';
    case 'CENTRE_INTERIEUR': case 'CENTRE_EXTERIEUR': return 'CENTRE';
    case 'AILIER_GAUCHE': case 'AILIER_DROIT': return 'AILIER';
    default: return position;
  }
}

function overall(p: Player): number {
  const t = p.technical, ph = p.physical, m = p.mental;
  const tech = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const phys = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const ment = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (tech + phys + ment) / 3;
}

function ageOf(p: Player, currentSeason: number): number {
  return currentSeason - Number(p.birthDate.slice(0, 4));
}

/**
 * Éligibilité.
 *
 * Le jeu représente la qualification française par `isJiff` — formé en France.
 * C'est une approximation du règlement réel, mais c'est celle que porte déjà
 * tout le reste du code, et en changer ici créerait deux définitions.
 */
export function isEligible(p: Player, currentSeason: number): boolean {
  if (p.retired || p.freeAgent || !p.isJiff) return false;
  if (p.dynamic.injury) return false;
  if (p.dynamic.suspendedUntilRound !== undefined) return false;
  const age = ageOf(p, currentSeason);
  return age >= 18 && age <= 36;
}

// =============================================================================
// Les capes
// =============================================================================

export interface CapRecord {
  readonly caps: number;
  readonly firstSeason: number;
  readonly lastSeason: number;
}

export type Caps = ReadonlyMap<PlayerId, CapRecord>;

export const NO_CAPS: Caps = new Map();

/** Un international confirmé, au sens où le vestiaire l'entend. */
export const ESTABLISHED_CAPS = 10;

/**
 * Les capes d'avant la première journée.
 *
 * Sans elles, la carrière commençait dans un monde où personne n'avait jamais
 * porté le maillot : le premier communiqué annonçait une « première sélection »
 * pour Antoine Dupont, ce qui est à peu près le contraire de ce qu'on cherche à
 * raconter. On estime donc un passé à partir de ce que le joueur est
 * aujourd'hui — son niveau et son âge — plutôt que d'inventer une base de
 * données de capes à maintenir.
 *
 * Le seuil compte autant que la formule : l'immense majorité des joueurs
 * professionnels ne sont jamais sélectionnés, et un jeu où tout le monde a deux
 * capes banaliserait la seule chose qu'on essaie de rendre rare.
 */
const CAP_THRESHOLD = 72;

/** Nombre de matchs par fenêtre internationale. */
export const SIX_NATIONS_MATCHES = 5;
export const AUTUMN_TESTS = 2;

/**
 * Matchs internationaux d'une saison : deux tests d'automne, cinq au Tournoi.
 *
 * Sert de plafond au rythme estimé : sans lui, la formule attribuait onze capes
 * par an au meilleur joueur du pays, dans un monde qui n'en joue que sept.
 * Antoine Dupont démarrait à quatre-vingt-treize sélections — plus qu'une
 * carrière entière n'en permet ici.
 */
export const CAPS_PER_SEASON = AUTUMN_TESTS + SIX_NATIONS_MATCHES;

export function seedInitialCaps(
  players: readonly Player[],
  currentSeason: number,
): Caps {
  const out = new Map<PlayerId, CapRecord>();
  for (const p of players) {
    if (!p.isJiff || p.retired) continue;
    const level = overall(p);
    if (level < CAP_THRESHOLD) continue;
    const age = ageOf(p, currentSeason);
    const years = Math.max(0, Math.min(14, age - 21));
    if (years === 0) continue;
    // Un joueur d'exception est sélectionné presque à chaque fenêtre ; un
    // international occasionnel une fois de temps en temps.
    const perYear = Math.min(CAPS_PER_SEASON, Math.pow((level - 70) / 25, 2) * 10);
    const caps = Math.round(years * perYear);
    if (caps <= 0) continue;
    out.set(p.id, {
      caps,
      firstSeason: currentSeason - years,
      lastSeason: currentSeason - 1,
    });
  }
  return out;
}

// =============================================================================
// La sélection
// =============================================================================

export interface NationalSquad {
  readonly season: number;
  readonly players: readonly PlayerId[];
  /** Ceux qui découvrent la sélection — c'est l'information qui fait la une. */
  readonly newCaps: readonly PlayerId[];
  readonly captain: PlayerId | undefined;
  /** Force moyenne du groupe, qui décidera des résultats. */
  readonly strength: number;
}

export interface SelectionInput {
  /**
   * Le vivier : tout le rugby français, les deux divisions confondues.
   *
   * Le sélectionneur ne regarde pas un championnat, il regarde un pays — et un
   * joueur de Pro D2 en forme peut se retrouver dans le groupe.
   */
  readonly players: readonly Player[];
  readonly caps: Caps;
  /**
   * Part de matchs disputés cette saison, par joueur.
   *
   * Un joueur **absent de la carte** est une inconnue, pas un remplaçant : sa
   * division n'est pas simulée en détail. On le traite alors comme un joueur au
   * temps de jeu ordinaire, faute de quoi une division entière serait écartée
   * de la sélection pour une information qu'on n'a simplement pas.
   */
  readonly playRatio: ReadonlyMap<PlayerId, number>;
  readonly currentSeason: number;
}

/** Temps de jeu supposé d'un joueur dont on ne suit pas le championnat. */
export const UNKNOWN_PLAY_RATIO = 0.55;

/**
 * Ce qui décide d'une sélection.
 *
 * Le niveau d'abord, évidemment. Mais un sélectionneur ne lit pas une fiche : il
 * regarde qui joue et comment il joue en ce moment. Un très bon joueur qui ne
 * dispute pas un match dans son club ne part pas au Tournoi, et un joueur de
 * trente-cinq ans à niveau égal cède la place — c'est le genre de choix qu'on
 * commente pendant six mois.
 *
 * Les capes comptent un peu, et pas plus : elles représentent la confiance
 * acquise, pas un droit de propriété sur le maillot.
 */
export function selectionScore(input: {
  readonly player: Player;
  readonly caps: Caps;
  readonly playRatio: number;
  readonly currentSeason: number;
}): number {
  const p = input.player;
  const base = overall(p);
  const forme = (p.dynamic.forme - 60) * 0.12;
  // Le temps de jeu pèse fort : c'est le premier critère qu'un sélectionneur
  // énonce en conférence de presse, et il a raison.
  const minutes = (Math.min(1, input.playRatio) - 0.5) * 12;

  const age = ageOf(p, input.currentSeason);
  const usure = age >= 33 ? -(age - 32) * 2.2 : age <= 20 ? -3 : 0;

  const capes = input.caps.get(p.id)?.caps ?? 0;
  const confiance = Math.min(4, capes * 0.35);

  const mental = (p.mental.sangFroid - 60) * 0.05;

  return base + forme + minutes + usure + confiance + mental;
}

/**
 * Le groupe retenu pour la fenêtre internationale.
 *
 * Déterministe : à effectifs et forme identiques, la même liste. Le hasard n'a
 * pas sa place dans une sélection — un manager doit pouvoir comprendre pourquoi
 * son joueur n'y est pas, et agir dessus.
 */
export function selectNationalSquad(input: SelectionInput): NationalSquad {
  const eligibles = input.players.filter(p => isEligible(p, input.currentSeason));

  const scored = eligibles
    .map(p => ({
      player: p,
      score: selectionScore({
        player: p,
        caps: input.caps,
        playRatio: input.playRatio.get(p.id) ?? UNKNOWN_PLAY_RATIO,
        currentSeason: input.currentSeason,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const picked: { player: Player; score: number }[] = [];
  for (const quota of QUOTAS) {
    const duGroupe = scored.filter(s => groupOf(s.player.position) === quota.group);
    picked.push(...duGroupe.slice(0, quota.count));
  }

  // Les quotas peuvent laisser des places vides — un championnat sans assez de
  // talonneurs français, ce qui arrive après quelques saisons de recrutement
  // étranger. On complète alors au mérite, comme le ferait un sélectionneur.
  if (picked.length < SQUAD_SIZE) {
    const dedans = new Set(picked.map(s => s.player.id as string));
    for (const s of scored) {
      if (picked.length >= SQUAD_SIZE) break;
      if (dedans.has(s.player.id as string)) continue;
      picked.push(s);
      dedans.add(s.player.id as string);
    }
  }

  const players = picked.map(s => s.player.id);
  const newCaps = picked
    .filter(s => (input.caps.get(s.player.id)?.caps ?? 0) === 0)
    .map(s => s.player.id);

  // Le capitaine : le plus capé du groupe, départagé par le leadership. C'est à
  // peu près ainsi que ça se décide, et sûrement pas au niveau brut.
  const captain = [...picked]
    .sort((a, b) => {
      const ca = input.caps.get(a.player.id)?.caps ?? 0;
      const cb = input.caps.get(b.player.id)?.caps ?? 0;
      if (ca !== cb) return cb - ca;
      return b.player.mental.leadership - a.player.mental.leadership;
    })[0]?.player.id;

  const strength = picked.length === 0
    ? 0
    : picked.slice(0, 23).reduce((sum, s) => sum + overall(s.player), 0)
      / Math.min(23, picked.length);

  return {
    season: input.currentSeason,
    players,
    newCaps,
    captain,
    strength,
  };
}

/** Ajoute une cape à chaque sélectionné réellement entré en jeu. */
export function applyCaps(caps: Caps, squad: NationalSquad, matchesPlayed: number): Caps {
  const next = new Map(caps);
  for (const id of squad.players) {
    const current = next.get(id);
    next.set(id, {
      caps: (current?.caps ?? 0) + matchesPlayed,
      firstSeason: current?.firstSeason ?? squad.season,
      lastSeason: squad.season,
    });
  }
  return next;
}

// =============================================================================
// Les matchs
// =============================================================================

export interface Nation {
  readonly id: string;
  readonly name: string;
  /** Force de référence, sur la même échelle que le niveau d'un joueur. */
  readonly strength: number;
}

/**
 * Les cinq adversaires du Tournoi.
 *
 * Forces fixes : ce sont des repères, pas des équipes qu'on simule. Elles
 * situent la France sans prétendre modéliser le rugby international.
 */
export const NATIONS: readonly Nation[] = [
  { id: 'IRL', name: 'Irlande', strength: 80 },
  { id: 'ENG', name: 'Angleterre', strength: 76 },
  { id: 'SCO', name: 'Écosse', strength: 73 },
  { id: 'WAL', name: 'Pays de Galles', strength: 71 },
  { id: 'ITA', name: 'Italie', strength: 64 },
];

/** Adversaires de la tournée d'automne. */
export const AUTUMN_OPPONENTS: readonly Nation[] = [
  { id: 'NZL', name: 'Nouvelle-Zélande', strength: 84 },
  { id: 'RSA', name: 'Afrique du Sud', strength: 83 },
];

export type Window = 'AUTOMNE' | 'TOURNOI';

export interface InternationalResult {
  readonly opponent: string;
  readonly franceScore: number;
  readonly opponentScore: number;
  readonly home: boolean;
}

/**
 * Résout une fenêtre internationale.
 *
 * L'écart de force décide de l'espérance de points ; le bruit fait le reste. Le
 * modèle est volontairement simple et **bruyant** : une équipe de France qui
 * gagnerait mécaniquement tous ses matchs dès qu'elle est la mieux notée
 * enlèverait au Tournoi ce qui en fait un tournoi.
 */
export function playWindow(input: {
  readonly window: Window;
  readonly franceStrength: number;
  readonly rng: Rng;
}): readonly InternationalResult[] {
  const opponents = input.window === 'AUTOMNE' ? AUTUMN_OPPONENTS : NATIONS;
  const out: InternationalResult[] = [];

  for (let i = 0; i < opponents.length; i++) {
    const opp = opponents[i]!;
    const home = i % 2 === 0;
    const delta = (input.franceStrength - opp.strength) + (home ? 3 : 0);
    const franceScore = Math.max(0, Math.round(22 + delta * 0.55 + input.rng.nextGaussian(0, 9)));
    const oppScore = Math.max(0, Math.round(22 - delta * 0.45 + input.rng.nextGaussian(0, 9)));
    out.push({ opponent: opp.name, franceScore, opponentScore: oppScore, home });
  }
  return out;
}

export interface WindowReport {
  readonly window: Window;
  readonly results: readonly InternationalResult[];
  readonly won: number;
  readonly lost: number;
  readonly drawn: number;
  /** Rang final au Tournoi, quand c'en est un. */
  readonly headline: string;
}

export function reportWindow(window: Window, results: readonly InternationalResult[]): WindowReport {
  let won = 0, lost = 0, drawn = 0;
  for (const r of results) {
    if (r.franceScore > r.opponentScore) won++;
    else if (r.franceScore < r.opponentScore) lost++;
    else drawn++;
  }

  const headline = window === 'AUTOMNE'
    ? `Tournée d'automne : ${won} victoire${won > 1 ? 's' : ''} en ${results.length} tests.`
    : won === results.length
      ? 'Grand Chelem ! La France remporte le Tournoi sans perdre un match.'
      : won >= 4
        ? `La France remporte le Tournoi (${won} victoires).`
        : won >= 3
          ? `Tournoi honorable pour la France : ${won} victoires.`
          : `Tournoi manqué : ${won} victoire${won > 1 ? 's' : ''} sur ${results.length}.`;

  return { window, results, won, lost, drawn, headline };
}

// =============================================================================
// Ce que la sélection coûte au club
// =============================================================================

/**
 * Fatigue accumulée par un international pendant la fenêtre.
 *
 * C'est la contrepartie, et elle est réelle : un joueur qui enchaîne cinq
 * matchs internationaux revient dans un état que son club subit. Sans ce coût,
 * une sélection serait une bonne nouvelle sans revers, ce qu'aucun entraîneur
 * de club ne dirait.
 */
export function internationalFatigue(matchesPlayed: number): number {
  return Math.round(matchesPlayed * 7.5);
}

/**
 * Ce que le staff annonce quand la liste tombe.
 *
 * On nomme les nouveaux : c'est ce qui fait la une, et c'est la récompense
 * d'un manager qui a fait jouer un jeune formé au club.
 */
export function selectionNarrative(
  squad: NationalSquad,
  clubPlayers: readonly Player[],
): string | undefined {
  const duClub = clubPlayers.filter(p => squad.players.includes(p.id));
  if (duClub.length === 0) return undefined;

  const nouveaux = duClub.filter(p => squad.newCaps.includes(p.id));
  const noms = duClub.map(p => p.lastName).join(', ');

  if (nouveaux.length > 0) {
    const premiers = nouveaux.map(p => `${p.firstName} ${p.lastName}`).join(', ');
    return `${duClub.length} joueur${duClub.length > 1 ? 's' : ''} du club dans le groupe : ${noms}. Première sélection pour ${premiers}.`;
  }
  return `${duClub.length} joueur${duClub.length > 1 ? 's' : ''} du club dans le groupe : ${noms}.`;
}

/** Répartition des sélectionnés par club — pour le fil d'actualité. */
export function selectedByClub(
  squad: NationalSquad,
  players: readonly Player[],
): ReadonlyMap<ClubId, number> {
  const byId = new Map(players.map(p => [p.id as string, p] as const));
  const out = new Map<ClubId, number>();
  for (const id of squad.players) {
    const club = byId.get(id as string)?.clubId;
    if (!club) continue;
    out.set(club, (out.get(club) ?? 0) + 1);
  }
  return out;
}
