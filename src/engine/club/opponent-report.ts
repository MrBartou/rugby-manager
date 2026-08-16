/**
 * Dossier d'avant-match sur l'adversaire — V0.36.
 *
 * L'écran de préparation ne recevait que le nom de l'adversaire. Le manager
 * choisissait son plan, ses rôles et sa composition sans rien savoir de qui il
 * affrontait : trois curseurs et dix-neuf rôles décidés à l'aveugle.
 *
 * ## Le scouting sert enfin deux fois
 *
 * Tout ce dossier passe par le filtre de la connaissance. Un adversaire jamais
 * observé reste flou ; un adversaire suivi se lit précisément. Jusqu'ici le
 * scouting ne servait qu'au recrutement — c'est-à-dire une fois par fenêtre de
 * mercato — alors qu'il devrait peser chaque semaine.
 *
 * ## Ce qu'on ne donne pas
 *
 * Ni sa composition exacte, ni ses attributs au point près. On donne ce qu'un
 * staff observe vraiment : une forme, une manière de jouer, des lignes fortes
 * et des lignes fragiles, et les hommes dont il faut se méfier.
 */

import type { Club, ClubId, Player, Position } from '../types.js';
import {
  favouriteCall,
  readLevel,
  type CallUsage,
  type Playbook,
} from '../match/playbook.js';
import { certaintyFor, currentAbility, estimateAttribute, type Certainty, type ScoutingState } from './scouting.js';
import { canCover, isForwardPosition } from '../match/bench.js';
import { planForIdentity } from '../match/tactics.js';
import type { PreMatchTacticalPlan } from '../match/types.js';

// =============================================================================
// Modèle
// =============================================================================

export type UnitId = 'PACK' | 'CHARNIERE' | 'TROIS_QUARTS';

export interface UnitAssessment {
  readonly unit: UnitId;
  readonly label: string;
  /**
   * Niveau estimé de la ligne — **pas** sa valeur réelle. Un adversaire mal
   * connu est mal évalué, et c'est le sens même du dossier : sans ce filtre,
   * on livrait des notes au point près sur une équipe jamais observée.
   */
  readonly rating: number;
  /** Fourchette lisible (« 78–86 »), ou « ? » si l'on ne sait rien. */
  readonly display: string;
  /**
   * Faux quand la ligne n'a jamais été observée. `rating` et `versusLeague` ne
   * veulent alors rien dire et ne doivent pas être affichés : `estimateAttribute`
   * renvoie la valeur réelle dans son point d'estimation, seul `display` est
   * masqué — s'y fier aurait divulgué le niveau exact d'un adversaire inconnu.
   */
  readonly known: boolean;
  /** Écart estimé au niveau moyen du championnat. Nul si la ligne est inconnue. */
  readonly versusLeague: number;
}

export interface OpponentThreat {
  readonly player: Player;
  readonly rating: number;
  /** Pourquoi il est dangereux — son atout dominant. */
  readonly reason: string;
}

export interface OpponentReport {
  readonly club: Club;
  /** Ce qu'on sait d'eux : détermine la précision de tout le reste. */
  readonly certainty: Certainty;
  /** Résultats récents, du plus ancien au plus récent. */
  readonly form: readonly (-1 | 0 | 1)[];
  readonly rank: number | undefined;
  /** Plan qu'ils joueront, déduit de leur identité. */
  readonly expectedPlan: PreMatchTacticalPlan;
  readonly units: readonly UnitAssessment[];
  /** Ligne la plus solide et la plus fragile — la lecture qui oriente un plan. */
  readonly strength: UnitAssessment | undefined;
  readonly weakness: UnitAssessment | undefined;
  readonly threats: readonly OpponentThreat[];
  /** Absents connus : blessés et suspendus de leur effectif. */
  readonly unavailable: readonly Player[];
  /**
   * V0.65 : ce que leur analyse a repéré de **nos** habitudes de touche.
   *
   * Le dossier d'avant-match ne servait qu'à préparer l'attaque. Cette ligne le
   * retourne vers nous : elle dit ce que l'adversaire a compris de notre carnet,
   * et c'est le seul avertissement que le manager recevra avant de se faire
   * contrer une touche sur deux.
   */
  readonly lineoutWarning?: string;
}

const UNIT_LABEL: Readonly<Record<UnitId, string>> = {
  PACK: 'Le pack',
  CHARNIERE: 'La charnière',
  TROIS_QUARTS: 'Les trois-quarts',
};

function unitOf(position: Position): UnitId {
  if (isForwardPosition(position)) return 'PACK';
  if (position === 'DEMI_DE_MELEE' || position === 'OUVREUR') return 'CHARNIERE';
  return 'TROIS_QUARTS';
}

// =============================================================================
// Construction
// =============================================================================

export interface OpponentReportInput {
  readonly club: Club;
  readonly roster: readonly Player[];
  /** Tous les effectifs du championnat, pour situer l'adversaire. */
  readonly leagueRosters: ReadonlyMap<ClubId, readonly Player[]>;
  readonly scouting: ScoutingState;
  readonly form: readonly (-1 | 0 | 1)[];
  readonly rank: number | undefined;
  readonly currentRound: number;
  /**
   * V0.65 : notre propre carnet, ce qu'on en a joué, et la qualité d'analyse de
   * l'adversaire. Trois choses que le dossier ne pouvait pas deviner seul.
   */
  readonly ownPlaybook?: Playbook;
  readonly ownCallUsage?: CallUsage;
  readonly opponentAnalysis?: number;
}

/**
 * XV probable : le meilleur joueur disponible à chaque poste.
 *
 * C'est exactement la logique de composition automatique du moteur, donc une
 * anticipation honnête plutôt qu'une devinette — et c'est bien l'équipe qu'on
 * affrontera si l'adversaire ne bricole pas.
 */
function probableFifteen(roster: readonly Player[], currentRound: number): readonly Player[] {
  const available = roster.filter(p =>
    !p.retired && !p.freeAgent && !p.dynamic.injury
    && (p.dynamic.suspendedUntilRound === undefined || p.dynamic.suspendedUntilRound <= currentRound),
  );

  const chosen: Player[] = [];
  const used = new Set<string>();

  for (const position of ALL_FIFTEEN) {
    const best = available
      .filter(p => !used.has(p.id as string) && canCover(p, position))
      .sort((a, b) => currentAbility(b) - currentAbility(a))[0];
    if (best) {
      chosen.push(best);
      used.add(best.id as string);
    }
  }
  return chosen;
}

const ALL_FIFTEEN: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'AILIER_GAUCHE', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'AILIER_DROIT',
  'ARRIERE',
];

/** Atout dominant d'un joueur, pour dire en un mot pourquoi il fait peur. */
function threatReason(p: Player): string {
  const candidates: { value: number; text: string }[] = [
    { value: p.physical.vitesse, text: 'très rapide' },
    { value: p.physical.puissance, text: 'puissant dans le contact' },
    { value: p.technical.plaquage, text: 'redoutable en défense' },
    { value: p.technical.visionDeJeu, text: 'excellente vision du jeu' },
    { value: p.technical.jeuAuPiedPlace, text: 'buteur de haut niveau' },
    { value: p.positionSpecific.grattage ?? 0, text: 'gratteur permanent' },
    { value: p.positionSpecific.pousseeMelee ?? 0, text: 'pilier de mêlée' },
    { value: p.positionSpecific.sautEnTouche ?? 0, text: 'cible d\'alignement' },
    { value: p.positionSpecific.finition ?? 0, text: 'finisseur clinique' },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return candidates[0]!.text;
}

export function buildOpponentReport(input: OpponentReportInput): OpponentReport {
  const { club, roster, leagueRosters, scouting, currentRound } = input;

  // Connaissance moyenne de l'effectif adverse : c'est elle qui décide de la
  // précision de tout le dossier.
  const fifteen = probableFifteen(roster, currentRound);
  const familiarities = fifteen.map(p => scouting.knowledge.get(p.id)?.familiarity ?? 0);
  const meanFamiliarity = familiarities.length === 0
    ? 0
    : familiarities.reduce((s, v) => s + v, 0) / familiarities.length;
  const certainty = certaintyFor(meanFamiliarity);

  // ---- Lignes ---------------------------------------------------------------
  const ratingOfUnit = (players: readonly Player[], unit: UnitId): number => {
    const inUnit = players.filter(p => unitOf(p.position) === unit);
    if (inUnit.length === 0) return 0;
    return inUnit.reduce((s, p) => s + currentAbility(p), 0) / inUnit.length;
  };

  const leagueAverages = new Map<UnitId, number>();
  for (const unit of ['PACK', 'CHARNIERE', 'TROIS_QUARTS'] as const) {
    const perClub: number[] = [];
    for (const [, r] of leagueRosters) {
      const value = ratingOfUnit(probableFifteen(r, currentRound), unit);
      if (value > 0) perClub.push(value);
    }
    leagueAverages.set(unit, perClub.length === 0 ? 60 : perClub.reduce((s, v) => s + v, 0) / perClub.length);
  }

  const units: UnitAssessment[] = (['PACK', 'CHARNIERE', 'TROIS_QUARTS'] as const).map(unit => {
    const truth = ratingOfUnit(fifteen, unit);
    // Même brouillard que sur les attributs d'un joueur : on estime, on ne
    // mesure pas. Le sel inclut le club et la ligne pour que l'erreur du staff
    // soit stable d'un affichage à l'autre.
    // Arrondi avant estimation : `estimateAttribute` restitue la valeur telle
    // quelle quand la connaissance est totale, et une note de ligne s'affiche
    // en entier, pas avec quatorze décimales.
    const estimate = estimateAttribute(Math.round(truth), meanFamiliarity, `unit_${club.id}_${unit}`, 12);
    const known = estimate.certainty !== 'INCONNU';
    return {
      unit,
      label: UNIT_LABEL[unit],
      rating: known ? Math.round(estimate.point) : 0,
      display: estimate.display,
      known,
      versusLeague: known ? Math.round(estimate.point - (leagueAverages.get(unit) ?? 60)) : 0,
    };
  });

  // Sans observation, il n'y a ni point fort ni point faible à désigner : en
  // proposer un reviendrait à inventer un renseignement.
  const ranked = units.every(u => u.known)
    ? [...units].sort((a, b) => b.versusLeague - a.versusLeague)
    : [];

  // ---- Joueurs à surveiller -------------------------------------------------
  // On ne cite que ceux qu'on a réellement observés : annoncer une menace sur
  // un joueur dont on ne sait rien serait une information inventée.
  const threats: OpponentThreat[] = fifteen
    .filter(p => certaintyFor(scouting.knowledge.get(p.id)?.familiarity ?? 0) !== 'INCONNU')
    .map(p => ({ player: p, rating: Math.round(currentAbility(p)), reason: threatReason(p) }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  const unavailable = roster.filter(p =>
    !p.retired && !p.freeAgent
    && (p.dynamic.injury !== undefined
      || (p.dynamic.suspendedUntilRound !== undefined && p.dynamic.suspendedUntilRound > currentRound)),
  );

  return {
    club,
    certainty,
    form: input.form,
    rank: input.rank,
    expectedPlan: planForIdentity(club.tacticalIdentity),
    units,
    strength: ranked[0],
    weakness: ranked.length > 0 ? ranked[ranked.length - 1] : undefined,
    threats,
    unavailable,
    ...(lineoutWarningFor(input) !== undefined
      ? { lineoutWarning: lineoutWarningFor(input)! } : {}),
  };
}

/**
 * L'avertissement de touche : V0.65.
 *
 * Il ne se déclenche que si les deux conditions de la lecture sont réunies, les
 * mêmes que dans le moteur : une combinaison assez répétée, et un adversaire
 * qui travaille ses adversaires. Le dire autrement produirait un dossier qui
 * annonce un danger que le match ne confirmerait pas, ce qui est pire que de
 * ne rien dire.
 */
function lineoutWarningFor(input: OpponentReportInput): string | undefined {
  const { ownPlaybook, ownCallUsage, opponentAnalysis } = input;
  if (!ownPlaybook || !ownCallUsage || opponentAnalysis === undefined) return undefined;

  const favourite = favouriteCall(ownCallUsage);
  if (!favourite) return undefined;

  const read = readLevel({
    usage: ownCallUsage,
    callId: favourite.callId,
    opponentPreparation: opponentAnalysis,
  });
  if (read < 0.25) return undefined;

  const name = ownPlaybook.calls.find(c => c.id === favourite.callId)?.name ?? 'votre combinaison fétiche';
  const part = Math.round(favourite.share * 100);
  return read >= 0.6
    ? `Ils connaissent votre fond de touche : « ${name} » sort ${part} % du temps, et leur analyse vidéo est bonne. Attendez-vous à être contré.`
    : `Leur cellule vidéo a repéré « ${name} » (${part} % de vos touches). Varier vous coûtera moins qu'un ballon perdu.`;
}

// =============================================================================
// Lecture
// =============================================================================

/**
 * Conseil tactique tiré du dossier.
 *
 * Une phrase, pas une recommandation impérative : le dossier éclaire, il ne
 * décide pas. Proposer « jouez ceci » ferait du plan de match un bouton à
 * presser plutôt qu'un choix.
 */
export function reportHint(report: OpponentReport): string {
  if (report.certainty === 'INCONNU') {
    return 'Effectif jamais observé : envoyez un scout pour y voir clair avant de les affronter.';
  }
  const { strength, weakness } = report;
  if (!strength || !weakness) return 'Pas assez d\'éléments pour dégager une tendance.';

  if (strength.unit === weakness.unit || strength.versusLeague === weakness.versusLeague) {
    return 'Équipe homogène : aucune ligne ne se détache, dans un sens ni dans l\'autre.';
  }

  const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n}`;
  // Parler de « maillon faible » pour une ligne encore au-dessus du championnat
  // serait faux et enverrait le manager attaquer un point qui n'en est pas un.
  // Sans verbe dans la seconde proposition : « les trois-quarts » est pluriel,
  // « la charnière » singulier, et l'ellipse évite un accord bancal.
  const weakWording = weakness.versusLeague >= 0
    ? `${weakness.label.toLowerCase()} leur ligne la moins dominante`
    : `${weakness.label.toLowerCase()} leur maillon faible`;

  return `${strength.label} est leur point fort (${signed(strength.versusLeague)} vs le championnat), ${weakWording} (${signed(weakness.versusLeague)}).`;
}
