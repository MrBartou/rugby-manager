/**
 * Discipline et indiscipline — V0.13.
 *
 * Constat avant ce module : le moteur sifflait **2,8 pénalités par match** (contre
 * une vingtaine dans un vrai match de Top 14), avec des taux fixes — le ruck, qui
 * est en réalité la première source de sanctions, était à 3 % plat. Conséquences :
 *
 *  - le score total plafonnait autour de 31 points cumulés (cible : 35-70), parce
 *    que les coups de pied de pénalité ne pesaient que 2 points par match
 *  - les attributs `discipline` et `agressivite`, présents sur chaque joueur,
 *    n'avaient aucun effet sur le jeu : une équipe indisciplinée ne payait rien
 *
 * Ce module fournit le multiplicateur d'indiscipline commun à tous les sous-systèmes.
 * Une équipe disciplinée concède environ deux fois moins qu'une équipe au bord de
 * la rupture.
 */

import type { Player } from '../types.js';

/** Bornes du multiplicateur, pour éviter qu'un effectif extrême ne casse la calibration. */
const MIN_MULTIPLIER = 0.62;
const MAX_MULTIPLIER = 1.55;

/**
 * Multiplicateur d'indiscipline d'un groupe de joueurs.
 *
 * - `discipline` élevée → moins de fautes (levier principal)
 * - `agressivite` élevée → plus de fautes, mais c'est aussi ce qui fait les bons
 *   défenseurs : le joueur agressif est un pari, exactement comme dans la réalité
 * - la fatigue dégrade la discipline en fin de match (placages en retard, hors-jeu)
 *
 * Retourne 1.0 pour un groupe moyen (discipline 60, agressivité 55, frais).
 */
export function indisciplineMultiplier(players: readonly Player[], fatigue: number): number {
  if (players.length === 0) return 1;

  let discipline = 0;
  let agressivite = 0;
  for (const p of players) {
    discipline += p.mental.discipline;
    agressivite += p.mental.agressivite;
  }
  discipline /= players.length;
  agressivite /= players.length;

  // Centrage sur un effectif moyen : discipline 60, agressivité 55.
  const disciplineTerm = (60 - discipline) / 100;      // +0.40 si discipline 20
  const agressiviteTerm = (agressivite - 55) / 180;    // +0.25 si agressivité 100
  const fatigueTerm = (fatigue / 100) * 0.28;          // +0.28 à bout de souffle

  const raw = 1 + disciplineTerm + agressiviteTerm + fatigueTerm;
  return Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, raw));
}

/**
 * Part des pénalités qui dégénèrent en carton.
 *
 * Ce sont les deux seuls paramètres libres introduits par la V0.52 : c'est sur
 * eux qu'on règle si la calibration bouge, jamais sur le moteur existant.
 *
 * Réglés par la mesure sur 1500 matchs. Le moteur siffle 7,9 pénalités par
 * rencontre — bien moins que les vingt d'un vrai match, parce qu'une phase du
 * moteur condense plusieurs temps de jeu, et cette valeur-là est calibrée
 * depuis la V0.13 : on ne la touche pas. À 0,055, on obtenait 0,40 carton jaune
 * par match, deux fois trop peu. Aux valeurs retenues : **0,87 jaune et 0,079
 * rouge par rencontre**, tous camps confondus, ce qui correspond au Top 14
 * récent — et les douze cibles de calibration tiennent.
 */
export const YELLOW_ON_PENALTY = 0.125;
export const RED_ON_PENALTY = 0.010;

/**
 * Une pénalité devient-elle un carton ?
 *
 * `cardRate` porte la main plus ou moins leste de l'arbitre. Le tempérament du
 * fautif compte aussi : un joueur indiscipliné et agressif ne prend pas un
 * simple rappel à l'ordre.
 */
export function rollCard(
  offender: Player | undefined,
  rng: { next(): number },
  cardRate = 1,
): 'YELLOW' | 'RED' | undefined {
  if (!offender) return undefined;
  const temper = Math.max(0.4, Math.min(1.9,
    1 + (55 - offender.mental.discipline) / 130 + (offender.mental.agressivite - 55) / 190));
  const r = rng.next();
  if (r < RED_ON_PENALTY * cardRate * temper) return 'RED';
  if (r < (RED_ON_PENALTY + YELLOW_ON_PENALTY) * cardRate * temper) return 'YELLOW';
  return undefined;
}

/**
 * Le joueur qui concède la pénalité, tiré au sort pondéré par l'indiscipline
 * individuelle. Sert à alimenter les stats (`penaltiesConceded`) et le narratif :
 * « troisième pénalité de Dupont, le banc s'agite ».
 */
export function pickOffender(
  players: readonly Player[],
  rng: { next(): number },
): Player | undefined {
  if (players.length === 0) return undefined;
  const weights = players.map(p =>
    Math.max(1, (100 - p.mental.discipline) * 0.7 + p.mental.agressivite * 0.3),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return players[i] ?? players[0];
  }
  return players[players.length - 1] ?? players[0];
}
