/**
 * Le capitaine — V0.50.
 *
 * `captainArmband` existait depuis la V0.2. Il était écrit à quatre endroits —
 * la génération de feuille de match, l'adversaire européen, l'écran d'avant-match
 * — et **lu nulle part**. Le manager choisissait son capitaine dans une liste
 * déroulante, et ce choix ne touchait rien : ni le match, ni le vestiaire, ni
 * l'homme à qui l'on venait de confier le groupe.
 *
 * C'est le même défaut que le jeu traîne depuis le début, sous sa forme la plus
 * pure : un champ écrit, jamais lu.
 *
 * ## Ce qu'un capitaine change, et ce qu'il ne change pas
 *
 * Il ne rend personne meilleur. Un capitaine ne plaque pas mieux et ne court
 * pas plus vite — en faire un bonus d'attributs serait une caricature.
 *
 * Ce qu'il fait, c'est **relayer et tenir** :
 *
 *  - il relaie la causerie. Le vestiaire écoutait jusqu'ici une moyenne de
 *    quinze leaderships ; il écoute d'abord un homme ;
 *  - il tient la discipline. Une équipe avec un capitaine respecté sur le
 *    terrain concède moins de fautes bêtes — et le perd quand il sort ;
 *  - et le brassard **se paie en retour** : c'est une reconnaissance, donc du
 *    moral, pour celui qui le porte.
 *
 * Les trois effets sont volontairement modestes. Un capitaine qui vaudrait dix
 * points par match ferait de ce choix le seul qui compte.
 */

import type { Player, PlayerId } from '../types.js';
import type { RosterEntry } from './types.js';

// =============================================================================
// L'autorité
// =============================================================================

/**
 * Ce qui fait qu'un homme est suivi, de 0 à 100.
 *
 * Le leadership pèse le plus, mais il ne suffit pas : un capitaine qui perd son
 * sang-froid à la première échauffourée n'en tient aucune, et un indiscipliné
 * ne peut pas exiger la discipline des autres. C'est aussi ce qui empêche de
 * donner le brassard mécaniquement au meilleur joueur.
 */
export function captainAuthority(player: Player): number {
  const base =
    player.mental.leadership * 0.55 +
    player.mental.sangFroid * 0.25 +
    player.mental.discipline * 0.20;

  let bonus = 0;
  let malus = 0;
  const has = (id: string): boolean => player.traits.some(t => t === id);
  if (has('leader_naturel')) bonus += 10;
  if (has('charismatique')) bonus += 6;
  if (has('mentor')) bonus += 4;
  if (has('professionnel')) bonus += 3;
  if (has('suiveur')) malus += 12;
  if (has('second_couteau')) malus += 8;
  if (has('solitaire')) malus += 6;
  if (has('hothead')) malus += 5;

  // Le bonus de trait se loge dans ce qui reste au-dessus de la note brute,
  // au lieu de s'y ajouter à plat. Sans cela, deux internationaux dotés de
  // `leader_naturel` sortaient tous les deux à 100 : la note saturait, et
  // l'écran d'avant-match ne permettait plus de les départager. Le malus, lui,
  // s'applique en entier — rien n'empêche de mal porter un brassard.
  const headroom = (100 - base) / 100;
  return Math.max(0, Math.min(100, Math.round(base + bonus * headroom - malus)));
}

/**
 * Capitaine suggéré dans un groupe.
 *
 * L'écran d'avant-match proposait « l'ouvreur, sinon le premier de la liste ».
 * C'est le poste du meneur de jeu, pas celui du meneur d'hommes.
 */
export function suggestCaptain(players: readonly Player[]): Player | undefined {
  let best: Player | undefined;
  let bestScore = -1;
  for (const p of players) {
    const score = captainAuthority(p);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** Le capitaine désigné sur une feuille de match, s'il y en a un. */
export function captainFrom(
  starters: readonly RosterEntry[],
  playersById: ReadonlyMap<PlayerId, Player>,
): Player | undefined {
  const entry = starters.find(e => e.captainArmband);
  return entry === undefined ? undefined : playersById.get(entry.playerId);
}

// =============================================================================
// Ce qu'il change pendant le match
// =============================================================================

/**
 * Leadership entendu par le vestiaire à la pause.
 *
 * Une causerie ne se diffuse pas dans une moyenne : elle passe par ceux qui la
 * relaient, et d'abord par le capitaine. Il compte donc pour un bon tiers, le
 * reste du XV pour le solde — et pour rien du tout s'il est sorti.
 */
export function relayedLeadership(
  averageLeadership: number,
  captain: Player | undefined,
  captainOnField: boolean,
): number {
  if (captain === undefined || !captainOnField) return averageLeadership;
  return Math.round(averageLeadership * 0.65 + captainAuthority(captain) * 0.35);
}

/**
 * Facteur d'indiscipline apporté par le capitaine.
 *
 * Multiplie le multiplicateur d'indiscipline existant : en dessous de 1, on
 * concède moins.
 *
 * ## Pourquoi c'est relatif au groupe, et pas absolu
 *
 * Première version : le facteur ne dépendait que de l'autorité du capitaine.
 * La calibration l'a refusée — la victoire de l'équipe forte passait de 77,6 %
 * à 78,3 %, au-dessus de la cible. La raison est simple et le modèle était
 * faux : un gros club a les meilleurs joueurs **donc** les meilleurs capitaines,
 * et un bonus absolu revenait à donner un avantage de plus à celui qui en avait
 * déjà le plus.
 *
 * Ce qu'un capitaine apporte, ce n'est pas son autorité — c'est ce qu'il a **de
 * plus que ceux qu'il mène**. Un leader né dans un groupe de suiveurs change
 * tout ; le même entouré de quatorze cadres internationaux ne change presque
 * rien, parce que le groupe se tient déjà tout seul.
 *
 * Amplitude bornée à ±6 % : perceptible sur une saison, invisible sur un match,
 * ce qui est exactement le poids d'un brassard.
 */
export function captainDisciplineFactor(
  captain: Player | undefined,
  captainOnField: boolean,
  squadAverageAuthority: number,
): number {
  if (captain === undefined || !captainOnField) return 1;
  const edge = captainAuthority(captain) - squadAverageAuthority;
  const raw = 1 - Math.max(-0.06, Math.min(0.06, edge / 500));
  return Math.round(raw * 1000) / 1000;
}

/** Autorité moyenne d'un groupe, référence à laquelle le capitaine se compare. */
export function averageAuthority(players: readonly Player[]): number {
  if (players.length === 0) return 50;
  return players.reduce((sum, p) => sum + captainAuthority(p), 0) / players.length;
}

/**
 * Contrecoup de la sortie du capitaine.
 *
 * Blessure, carton, remplacement : le brassard change de bras au pire moment.
 * Le malus tactique est ponctuel et proportionnel à ce que l'homme
 * représentait — perdre un capitaine de façade ne coûte rien.
 */
export function armbandLoss(captain: Player | undefined): {
  readonly tacticalMalus: number;
  readonly phases: number;
  readonly narrative: string;
} {
  if (captain === undefined) {
    return { tacticalMalus: 0, phases: 0, narrative: '' };
  }
  const authority = captainAuthority(captain);
  // En dessous de 55, le groupe ne perd rien qu'il n'ait déjà.
  const malus = Math.max(0, Math.round(((authority - 55) / 45) * 2.5 * 10) / 10);
  return {
    // `-malus` vaudrait `-0` quand il n'y a rien à perdre : sans intérêt en
    // arithmétique, mais visible dès qu'on sérialise ou qu'on compare.
    tacticalMalus: malus > 0 ? -malus : 0,
    phases: malus > 0 ? 8 : 0,
    narrative: malus > 0
      ? `${captain.lastName} quitte le terrain. Le brassard change de bras, et ça se voit.`
      : `${captain.lastName} quitte le terrain.`,
  };
}

// =============================================================================
// Ce qu'il change en dehors du match
// =============================================================================

/**
 * Effet du brassard sur le moral de celui qui le porte.
 *
 * Un capitaine reconnu comme tel s'en trouve grandi ; un joueur à qui l'on
 * confie le groupe sans qu'il ait l'autorité pour le tenir y gagne moins — il
 * sait ce qu'on lui met sur les épaules.
 */
export function armbandMoodBonus(captain: Player): number {
  const authority = captainAuthority(captain);
  const has = (id: string): boolean => captain.traits.some(t => t === id);
  let bonus = authority >= 70 ? 6 : authority >= 50 ? 4 : 2;
  if (has('ambitieux')) bonus += 2;
  if (has('solitaire')) bonus -= 1;
  return bonus;
}
