/**
 * Les trente joueurs sur le terrain — V0.57.
 *
 * ## Pourquoi ce module existe, alors qu'on s'y était refusé
 *
 * La vue de match portait en tête une consigne explicite : *« Pas de 30 ronds
 * qui sautent. Pas de mensonge. »* Le raisonnement était juste — le moteur ne
 * suit pas trente positions, il enchaîne des phases abstraites — mais il menait
 * à un terrain vide où seul le ballon se déplaçait. On ne voyait pas un match
 * de rugby, on lisait un journal des opérations.
 *
 * On garde donc la contrainte, et on abandonne la conclusion. **Rien ici n'est
 * inventé** : chaque placement se déduit de ce que la simulation affirme.
 *
 *  - le **type de phase** dit la figure : une mêlée se pousse à huit contre
 *    huit, une touche s'aligne perpendiculairement à la ligne de touche, un
 *    ruck ramène quelques avants sur le ballon ;
 *  - la **position du ballon** dit où cette figure se pose sur le terrain ;
 *  - la **possession** dit qui attaque, donc dans quel sens tout le monde
 *    regarde ;
 *  - les **contributions** de la phase — le moteur nomme le porteur, le
 *    plaqueur, le buteur, le marqueur, le sanctionné — disent qui mettre en
 *    évidence ;
 *  - les **remplacements déjà effectués** disent qui est encore sur le pré.
 *
 * Ce que le module ne fait pas, et ne fera pas : décider de quoi que ce soit.
 * Aucun résultat ne dépend d'une coordonnée calculée ici. C'est une mise en
 * scène de la simulation, pas une simulation parallèle — si les deux devaient
 * un jour diverger, c'est celle-ci qui a tort.
 */

import type { PlayerId, Position } from '../../engine/types.js';
import type { MatchSquad, PhaseRecord, Possession, SubstitutionRecord } from '../../engine/match/types.js';

// =============================================================================
// Qui est sur le terrain
// =============================================================================

export interface OnFieldPlayer {
  readonly id: PlayerId;
  readonly shirt: number;
  readonly position: Position;
}

const SHIRT_OF: Readonly<Record<Position, number>> = {
  PILIER_GAUCHE: 1, TALONNEUR: 2, PILIER_DROIT: 3,
  DEUXIEME_LIGNE_GAUCHE: 4, DEUXIEME_LIGNE_DROITE: 5,
  TROISIEME_LIGNE_AILE_GAUCHE: 6, TROISIEME_LIGNE_AILE_DROITE: 7, NUMERO_8: 8,
  DEMI_DE_MELEE: 9, OUVREUR: 10,
  AILIER_GAUCHE: 11, CENTRE_INTERIEUR: 12, CENTRE_EXTERIEUR: 13, AILIER_DROIT: 14,
  ARRIERE: 15,
};

/**
 * Le XV réellement sur le pré à la minute donnée.
 *
 * On applique les remplacements déjà effectués : montrer un joueur sorti à la
 * cinquantième minute serait exactement le genre de mensonge qu'on s'interdit,
 * d'autant que le moteur sait précisément qui est entré et quand.
 */
export function onFieldAt(
  squad: MatchSquad,
  substitutions: readonly SubstitutionRecord[],
  minute: number,
): readonly OnFieldPlayer[] {
  const byShirt = new Map<number, OnFieldPlayer>();
  for (const entry of squad.starters) {
    const shirt = SHIRT_OF[entry.position];
    byShirt.set(shirt, { id: entry.playerId, shirt, position: entry.position });
  }
  for (const sub of substitutions) {
    if (sub.minute > minute) continue;
    const shirt = SHIRT_OF[sub.position];
    byShirt.set(shirt, { id: sub.onPlayerId, shirt, position: sub.position });
  }
  return [...byShirt.values()].sort((a, b) => a.shirt - b.shirt);
}

// =============================================================================
// Ce qu'on affiche
// =============================================================================

export type Spotlight = 'PORTEUR' | 'PLAQUEUR' | 'BUTEUR' | 'MARQUEUR' | 'SANCTIONNE';

export interface PitchActor {
  readonly key: string;
  readonly team: 'HOME' | 'AWAY';
  readonly shirt: number;
  readonly playerId: PlayerId;
  /** Le long du terrain : 0 = ligne d'en-but HOME, 1 = ligne d'en-but AWAY. */
  readonly x: number;
  /** En travers : 0 et 1 sont les lignes de touche. */
  readonly y: number;
  readonly forward: boolean;
  readonly spotlight?: Spotlight;
}

export interface FormationInput {
  readonly phase: PhaseRecord;
  readonly home: readonly OnFieldPlayer[];
  readonly away: readonly OnFieldPlayer[];
  /** Position du ballon, déjà ramenée au repère HOME (0..1). */
  readonly ballX: number;
}

// =============================================================================
// Les figures
// =============================================================================

/**
 * Décalages d'un groupe, en mètres, relativement au point de fixation.
 *
 * `back` : recul par rapport au ballon dans le sens de l'attaque — positif =
 * derrière le ballon pour l'attaquant, donc devant lui pour le défenseur.
 * `side` : écart latéral en mètres.
 */
type Offsets = Readonly<Record<number, { back: number; side: number }>>;

/** Mêlée fermée : première ligne au contact, huit joueurs liés. */
const SCRUM_PACK: Offsets = {
  1: { back: 1.0, side: -1.2 }, 2: { back: 1.0, side: 0 }, 3: { back: 1.0, side: 1.2 },
  4: { back: 2.4, side: -0.6 }, 5: { back: 2.4, side: 0.6 },
  6: { back: 2.6, side: -2.2 }, 7: { back: 2.6, side: 2.2 },
  8: { back: 3.8, side: 0 },
};

/**
 * Touche : deux lignes parallèles perpendiculaires à la ligne de touche.
 *
 * L'écart se fait donc en `side` — vers l'intérieur du terrain — et non en
 * `back`. C'est ce qui distingue visuellement une touche de tout le reste :
 * deux colonnes qui rentrent dans le terrain depuis le bord.
 */
const LINEOUT_THROWER: Offsets = { 2: { back: 0, side: 0 } };
const LINEOUT_JUMPERS: Offsets = {
  1: { back: 0.8, side: 5 }, 3: { back: 0.8, side: 8 },
  4: { back: 0.8, side: 11 }, 5: { back: 0.8, side: 14 },
  6: { back: 0.8, side: 17 }, 8: { back: 0.8, side: 20 }, 7: { back: 0.8, side: 23 },
};
const LINEOUT_DEFENDERS: Offsets = {
  2: { back: -2.5, side: 3 },
  1: { back: -0.8, side: 5 }, 3: { back: -0.8, side: 8 },
  4: { back: -0.8, side: 11 }, 5: { back: -0.8, side: 14 },
  6: { back: -0.8, side: 17 }, 8: { back: -0.8, side: 20 }, 7: { back: -0.8, side: 23 },
};
/** En touche, les trois-quarts attendent au large, dans l'axe du terrain. */
const LINEOUT_BACKS: Offsets = {
  9: { back: 2, side: 2 }, 10: { back: 9, side: 12 },
  12: { back: 12, side: 22 }, 13: { back: 14, side: 31 },
  11: { back: 10, side: 40 }, 14: { back: 18, side: 48 }, 15: { back: 26, side: 30 },
};
const LINEOUT_DEF_BACKS: Offsets = {
  9: { back: -3, side: 3 }, 10: { back: -8, side: 14 },
  12: { back: -8, side: 24 }, 13: { back: -8, side: 33 },
  11: { back: -8, side: 42 }, 14: { back: -10, side: 12 }, 15: { back: -24, side: 26 },
};

/** Distance de la ligne de touche où se joue un alignement. */
const LINEOUT_AXIS = 0.08;

/** Ruck : trois avants au sol, les autres répartis autour. */
const RUCK_PACK: Offsets = {
  1: { back: 0.6, side: -1.2 }, 2: { back: 0.6, side: 0 }, 3: { back: 0.6, side: 1.2 },
  4: { back: 3, side: -6 }, 5: { back: 3, side: 6 },
  6: { back: 5, side: -13 }, 7: { back: 5, side: 13 },
  8: { back: 2, side: 3 },
};

/** Avants dispersés dans le jeu courant. */
const LOOSE_PACK: Offsets = {
  1: { back: 4, side: -11 }, 2: { back: 3, side: -4 }, 3: { back: 4, side: 8 },
  4: { back: 6, side: -17 }, 5: { back: 6, side: 15 },
  6: { back: 2, side: -6 }, 7: { back: 2, side: 6 }, 8: { back: 1, side: 0 },
};

/**
 * Ligne de trois-quarts, en diagonale derrière le ballon.
 *
 * C'est la forme qu'on reconnaît d'un coup d'œil sur une image de rugby :
 * chaque joueur un peu plus loin et un peu plus en retrait que le précédent.
 */
const BACKLINE: Offsets = {
  9: { back: 2, side: 2 },
  10: { back: 8, side: 8 },
  12: { back: 11, side: 17 },
  13: { back: 13, side: 25 },
  11: { back: 12, side: -28 },
  14: { back: 16, side: 32 },
  15: { back: 24, side: 4 },
};

/**
 * Le même groupe, vu depuis l'autre camp.
 *
 * Sans ce miroir, les deux packs recevaient les mêmes décalages dans le même
 * repère : ils se superposaient au lieu de se faire face, et une mêlée
 * s'affichait comme un seul tas de huit joueurs.
 */
function mirrored(offsets: Offsets): Offsets {
  const out: Record<number, { back: number; side: number }> = {};
  for (const [shirt, o] of Object.entries(offsets)) {
    out[Number(shirt)] = { back: -o.back, side: -o.side };
  }
  return out;
}

const SCRUM_PACK_DEF = mirrored(SCRUM_PACK);
const RUCK_PACK_DEF = mirrored(RUCK_PACK);
const LOOSE_PACK_DEF = mirrored(LOOSE_PACK);

/** Rideau défensif : une ligne plate, un peu en avant du regroupement. */
const DEF_LINE: Offsets = {
  9: { back: -1, side: -3 },
  10: { back: -6, side: 6 },
  12: { back: -6, side: 14 },
  13: { back: -6, side: 22 },
  11: { back: -6, side: 30 },
  14: { back: -7, side: -20 },
  15: { back: -20, side: 0 },
};

/** Coup d'envoi : le camp qui engage monte en ligne. */
const KICKOFF_PACK: Offsets = {
  1: { back: 1, side: -28 }, 2: { back: 1, side: -20 }, 3: { back: 1, side: -12 },
  4: { back: 1, side: -4 }, 5: { back: 1, side: 4 },
  6: { back: 1, side: 12 }, 7: { back: 1, side: 20 }, 8: { back: 1, side: 28 },
};
const KICKOFF_BACKS: Offsets = {
  9: { back: 6, side: 0 }, 10: { back: 0, side: -33 },
  12: { back: 8, side: -14 }, 13: { back: 8, side: 14 },
  11: { back: 14, side: -25 }, 14: { back: 14, side: 25 }, 15: { back: 20, side: 0 },
};
const KICKOFF_RECEIVE: Offsets = {
  1: { back: -14, side: -29 }, 2: { back: -14, side: -18 }, 3: { back: -14, side: -6 },
  4: { back: -18, side: -24 }, 5: { back: -18, side: -12 },
  6: { back: -14, side: 8 }, 7: { back: -14, side: 20 }, 8: { back: -18, side: 14 },
};
const KICKOFF_RECEIVE_BACKS: Offsets = {
  9: { back: -22, side: 0 }, 10: { back: -26, side: -10 },
  12: { back: -24, side: 10 }, 13: { back: -28, side: 21 },
  11: { back: -30, side: -27 }, 14: { back: -30, side: 29 }, 15: { back: -38, side: 4 },
};

/** Tir au but : le camp qui subit se range derrière sa ligne. */
const BEHIND_POSTS_PACK: Offsets = {
  1: { back: -24, side: -14 }, 2: { back: -24, side: -6 }, 3: { back: -24, side: 2 },
  4: { back: -24, side: 10 }, 5: { back: -24, side: 18 },
  6: { back: -26, side: -22 }, 7: { back: -26, side: 25 }, 8: { back: -26, side: -30 },
};
const BEHIND_POSTS_BACKS: Offsets = {
  9: { back: -28, side: 6 }, 10: { back: -30, side: -8 },
  12: { back: -30, side: 14 }, 13: { back: -32, side: 21 },
  11: { back: -34, side: -25 }, 14: { back: -34, side: 29 }, 15: { back: -40, side: 0 },
};

// =============================================================================
// Le placement
// =============================================================================

const clampX = (v: number): number => Math.max(0.02, Math.min(0.98, v));
const clampY = (v: number): number => Math.max(0.04, Math.min(0.96, v));

/** Un mètre le long du terrain — 100 m entre les lignes d'en-but. */
const MX = 0.01;
/** Un mètre en travers — 70 m entre les lignes de touche. */
const MY = 1 / 70;

interface PlaceArgs {
  readonly players: readonly OnFieldPlayer[];
  readonly team: 'HOME' | 'AWAY';
  readonly originX: number;
  readonly originY: number;
  /** Sens de l'attaque le long du terrain : +1 vers l'en-but AWAY. */
  readonly dir: 1 | -1;
  /**
   * Sens de l'écart latéral.
   *
   * Vaut `dir` la plupart du temps — le côté ouvert bascule avec le sens du
   * jeu — mais est forcé à +1 en touche, où l'alignement rentre toujours dans
   * le terrain depuis le bord, quel que soit le camp qui lance.
   */
  readonly sideDir: 1 | -1;
  readonly offsets: Offsets;
  readonly spotlights: ReadonlyMap<PlayerId, Spotlight>;
}

function place(args: PlaceArgs, out: PitchActor[]): void {
  for (const p of args.players) {
    const o = args.offsets[p.shirt];
    if (!o) continue;
    const spot = args.spotlights.get(p.id);
    out.push({
      key: `${args.team}_${p.shirt}`,
      team: args.team,
      shirt: p.shirt,
      playerId: p.id,
      x: clampX(args.originX - args.dir * o.back * MX),
      y: clampY(args.originY + args.sideDir * o.side * MY),
      forward: p.shirt <= 8,
      ...(spot ? { spotlight: spot } : {}),
    });
  }
}

/**
 * Qui mérite d'être mis en évidence sur cette phase.
 *
 * Uniquement des joueurs que le moteur a nommés : celui qui a porté le ballon,
 * celui qui a plaqué, le buteur, le marqueur, le sanctionné. On ne devine
 * personne — un rond mis en avant sans raison serait une affirmation que la
 * simulation n'a pas faite.
 */
function spotlightsOf(phase: PhaseRecord): ReadonlyMap<PlayerId, Spotlight> {
  const map = new Map<PlayerId, Spotlight>();
  const o = phase.outcome;

  let bestCarry = 0;
  let carrier: PlayerId | undefined;
  let bestTackle = 0;
  let tackler: PlayerId | undefined;
  for (const c of o.contributions ?? []) {
    const carried = (c.carries ?? 0) + (c.metersWithBall ?? 0) / 10;
    if (carried > bestCarry) { bestCarry = carried; carrier = c.playerId; }
    if ((c.tackles ?? 0) > bestTackle) { bestTackle = c.tackles ?? 0; tackler = c.playerId; }
  }
  if (carrier) map.set(carrier, 'PORTEUR');
  if (tackler && !map.has(tackler)) map.set(tackler, 'PLAQUEUR');

  if (o.keyPlayerId) {
    if (o.tryScored) map.set(o.keyPlayerId, 'MARQUEUR');
    else if (o.pointsScored || phase.type === 'PENALTY' || phase.type === 'CONVERSION'
      || phase.type === 'DROP_GOAL') {
      map.set(o.keyPlayerId, 'BUTEUR');
    }
  }
  // Le carton prime : c'est l'information la plus forte de la phase.
  if (o.cardIssued) map.set(o.cardIssued.playerId, 'SANCTIONNE');
  return map;
}

/**
 * Où se trouve le ballon, en travers du terrain.
 *
 * Presque toujours dans l'axe — sauf en touche, où la figure entière se pose
 * sur la ligne de touche. Sans cette exception, l'alignement se formait au bord
 * pendant que le ballon flottait au milieu du terrain, ce qui donnait à voir
 * deux actions différentes en même temps.
 */
export function ballAxisFor(phaseType: PhaseRecord['type']): number {
  return phaseType === 'LINEOUT' ? LINEOUT_AXIS : 0.5;
}

/**
 * La mise en place complète, pour une phase donnée.
 *
 * Renvoie trente acteurs — quinze par camp — placés selon la figure qu'impose
 * le type de phase. Les coordonnées changent d'une phase à l'autre ; c'est
 * l'interpolation CSS qui produit le mouvement, pas ce module.
 */
export function formationFor(input: FormationInput): readonly PitchActor[] {
  const { phase, home, away, ballX } = input;
  // Une phase contestée n'a pas d'attaquant désigné : on prend le camp qui
  // recevra le ballon, faute de quoi la figure n'aurait pas d'orientation.
  const attacker: Possession = phase.state.possession === 'CONTESTED'
    ? (phase.outcome.possessionAfter === 'AWAY' ? 'AWAY' : 'HOME')
    : phase.state.possession;

  const attacking = attacker === 'HOME' ? home : away;
  const defending = attacker === 'HOME' ? away : home;
  const attTeam: 'HOME' | 'AWAY' = attacker;
  const defTeam: 'HOME' | 'AWAY' = attacker === 'HOME' ? 'AWAY' : 'HOME';
  const dir: 1 | -1 = attacker === 'HOME' ? 1 : -1;

  const spotlights = spotlightsOf(phase);
  const out: PitchActor[] = [];

  const common = { dir, sideDir: dir as 1 | -1, spotlights };

  switch (phase.type) {
    case 'LINEOUT': {
      // La seule figure qui ne se joue pas dans l'axe : elle se pose sur la
      // ligne de touche, et l'alignement rentre dans le terrain.
      const axis = { originX: ballX, originY: LINEOUT_AXIS, dir, sideDir: 1 as const, spotlights };
      place({ ...axis, players: attacking, team: attTeam, offsets: LINEOUT_THROWER }, out);
      place({ ...axis, players: attacking, team: attTeam, offsets: LINEOUT_JUMPERS }, out);
      place({ ...axis, players: attacking, team: attTeam, offsets: LINEOUT_BACKS }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: LINEOUT_DEFENDERS }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: LINEOUT_DEF_BACKS }, out);
      return out;
    }

    case 'KICKOFF': {
      const axis = { ...common, originX: ballX, originY: 0.5 };
      place({ ...axis, players: attacking, team: attTeam, offsets: KICKOFF_PACK }, out);
      place({ ...axis, players: attacking, team: attTeam, offsets: KICKOFF_BACKS }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: KICKOFF_RECEIVE }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: KICKOFF_RECEIVE_BACKS }, out);
      return out;
    }

    case 'PENALTY':
    case 'CONVERSION':
    case 'DROP_GOAL': {
      const axis = { ...common, originX: ballX, originY: 0.5 };
      place({ ...axis, players: attacking, team: attTeam, offsets: LOOSE_PACK }, out);
      place({ ...axis, players: attacking, team: attTeam, offsets: BACKLINE }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: BEHIND_POSTS_PACK }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: BEHIND_POSTS_BACKS }, out);
      return out;
    }

    default: {
      const isScrum = phase.type === 'SCRUM';
      const isBreakdown = phase.type === 'RUCK' || phase.type === 'GOAL_LINE';
      const pack = isScrum ? SCRUM_PACK : isBreakdown ? RUCK_PACK : LOOSE_PACK;
      const packDef = isScrum ? SCRUM_PACK_DEF : isBreakdown ? RUCK_PACK_DEF : LOOSE_PACK_DEF;
      const axis = { ...common, originX: ballX, originY: 0.5 };
      place({ ...axis, players: attacking, team: attTeam, offsets: pack }, out);
      place({ ...axis, players: attacking, team: attTeam, offsets: BACKLINE }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: packDef }, out);
      place({ ...axis, players: defending, team: defTeam, offsets: DEF_LINE }, out);
      return out;
    }
  }
}
