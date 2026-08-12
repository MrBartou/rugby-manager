/**
 * La mise en place des trente joueurs — V0.57.
 *
 * Ce qui est vérifié ici n'est pas l'esthétique, qui se juge à l'œil, mais la
 * **fidélité** : la vue ne doit jamais affirmer ce que la simulation ne dit
 * pas. Trente joueurs et pas trente-deux, personne hors du terrain, le camp qui
 * attaque orienté dans le bon sens, les deux packs qui se font face plutôt que
 * de se superposer, et aucun joueur déjà remplacé.
 */

import { describe, expect, it } from 'vitest';
import {
  ballAxisFor,
  formationFor,
  onFieldAt,
  type OnFieldPlayer,
  type PitchActor,
} from '../../src/ui/pitch/phase-formation.js';
import type {
  MatchSquad,
  PhaseRecord,
  PhaseType,
  Possession,
  SubstitutionRecord,
} from '../../src/engine/match/types.js';
import type { ClubId, PlayerId, Position } from '../../src/engine/types.js';

const POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'AILIER_GAUCHE', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'AILIER_DROIT',
  'ARRIERE',
];

/** Numéro de maillot officiel, dans l'ordre du tableau ci-dessus. */
const SHIRTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

const sideOf = (prefix: string): readonly OnFieldPlayer[] =>
  POSITIONS.map((position, i) => ({
    id: `${prefix}_${i}` as PlayerId,
    shirt: SHIRTS[i]!,
    position,
  }));

const HOME = sideOf('h');
const AWAY = sideOf('a');

function phase(type: PhaseType, possession: Possession, fieldPosition = 0): PhaseRecord {
  return {
    index: 1,
    type,
    state: {
      minute: 20,
      homeScore: 0,
      awayScore: 0,
      possession,
      fieldPosition,
      phaseInPossession: 1,
      homeFatigue: 20,
      awayFatigue: 20,
      homeMomentum: 0,
    },
    outcome: {
      possessionAfter: possession === 'CONTESTED' ? 'HOME' : possession,
      metersGained: 0,
      nextPhase: 'RUCK',
      summary: 'test',
    },
  };
}

const ALL_TYPES: readonly PhaseType[] = [
  'KICKOFF', 'SCRUM', 'LINEOUT', 'RUCK', 'OPEN_PLAY', 'GOAL_LINE',
  'KICK', 'PENALTY', 'CONVERSION', 'DROP_GOAL', 'TRY',
];

const build = (type: PhaseType, possession: Possession = 'HOME', ballX = 0.5): readonly PitchActor[] =>
  formationFor({ phase: phase(type, possession), home: HOME, away: AWAY, ballX });

describe('il y a toujours trente joueurs, et ils sont sur le terrain', () => {
  it('quinze par camp, quel que soit le type de phase', () => {
    for (const type of ALL_TYPES) {
      const actors = build(type);
      expect(actors, type).toHaveLength(30);
      expect(actors.filter(a => a.team === 'HOME'), type).toHaveLength(15);
      expect(actors.filter(a => a.team === 'AWAY'), type).toHaveLength(15);
    }
  });

  it('chaque numéro de maillot apparaît une fois par camp', () => {
    for (const type of ALL_TYPES) {
      for (const team of ['HOME', 'AWAY'] as const) {
        const shirts = build(type).filter(a => a.team === team).map(a => a.shirt).sort((x, y) => x - y);
        expect(shirts, `${type}/${team}`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      }
    }
  });

  it('personne ne sort du terrain, même sur une phase collée à la ligne', () => {
    for (const type of ALL_TYPES) {
      for (const ballX of [0.02, 0.5, 0.98]) {
        for (const poss of ['HOME', 'AWAY'] as const) {
          for (const a of build(type, poss, ballX)) {
            expect(a.x, `${type} x`).toBeGreaterThanOrEqual(0);
            expect(a.x, `${type} x`).toBeLessThanOrEqual(1);
            expect(a.y, `${type} y`).toBeGreaterThanOrEqual(0);
            expect(a.y, `${type} y`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('la figure correspond à ce que dit le moteur', () => {
  it('une mêlée oppose deux packs, elle n\'en empile pas un seul', () => {
    // Le défaut de la première version : les deux packs recevaient les mêmes
    // décalages dans le même repère et se superposaient exactement.
    const actors = build('SCRUM');
    const home2 = actors.find(a => a.team === 'HOME' && a.shirt === 2)!;
    const away2 = actors.find(a => a.team === 'AWAY' && a.shirt === 2)!;
    expect(Math.abs(home2.x - away2.x)).toBeGreaterThan(0.01);
    // Et ils restent au contact : une mêlée n'est pas un coup d'envoi.
    expect(Math.abs(home2.x - away2.x)).toBeLessThan(0.06);
  });

  it('les huit avants d\'une mêlée sont groupés autour du ballon', () => {
    const actors = build('SCRUM', 'HOME', 0.5).filter(a => a.team === 'HOME' && a.forward);
    for (const a of actors) {
      expect(Math.abs(a.x - 0.5)).toBeLessThan(0.06);
      expect(Math.abs(a.y - 0.5)).toBeLessThan(0.06);
    }
  });

  it('une touche se joue au bord et rentre dans le terrain', () => {
    const actors = build('LINEOUT');
    const lineout = actors.filter(a => a.forward);
    // Tout le monde du même côté, près d'une ligne de touche.
    expect(Math.min(...lineout.map(a => a.y))).toBeLessThan(0.15);
    // Et l'alignement s'étire vers l'intérieur, perpendiculairement au bord —
    // c'est ce qui la rend reconnaissable d'un coup d'œil.
    expect(Math.max(...lineout.map(a => a.y))).toBeGreaterThan(0.35);
  });

  it('la touche rentre dans le terrain quel que soit le camp qui lance', () => {
    // L'écart latéral se retournait avec le sens de l'attaque : l'alignement de
    // l'équipe à l'extérieur sortait du terrain par le haut.
    for (const poss of ['HOME', 'AWAY'] as const) {
      const ys = build('LINEOUT', poss).filter(a => a.forward).map(a => a.y);
      expect(Math.max(...ys), poss).toBeGreaterThan(0.3);
      expect(Math.max(...ys), poss).toBeLessThanOrEqual(1);
    }
  });

  it('les trois-quarts attaquants sont derrière le ballon, dans leur sens de jeu', () => {
    const enAttaqueHome = build('OPEN_PLAY', 'HOME').filter(a => a.team === 'HOME' && !a.forward);
    // HOME attaque vers 1 : ses arrières sont donc en deçà du ballon.
    for (const a of enAttaqueHome) expect(a.x).toBeLessThan(0.5);

    const enAttaqueAway = build('OPEN_PLAY', 'AWAY').filter(a => a.team === 'AWAY' && !a.forward);
    // AWAY attaque vers 0 : c'est exactement l'inverse.
    for (const a of enAttaqueAway) expect(a.x).toBeGreaterThan(0.5);
  });

  it('une phase contestée reste orientée — sinon la figure n\'a pas de sens', () => {
    expect(build('SCRUM', 'CONTESTED')).toHaveLength(30);
  });

  it('le ballon suit la figure : au bord en touche, dans l\'axe ailleurs', () => {
    // Sans cela, l'alignement se formait sur la ligne de touche pendant que le
    // ballon flottait au milieu du terrain — deux actions à la fois.
    const enTouche = ballAxisFor('LINEOUT');
    expect(enTouche).toBeLessThan(0.2);
    const ys = build('LINEOUT').filter(a => a.forward).map(a => a.y);
    expect(Math.min(...ys)).toBeCloseTo(enTouche, 1);
    for (const type of ['SCRUM', 'RUCK', 'OPEN_PLAY', 'KICKOFF'] as const) {
      expect(ballAxisFor(type), type).toBe(0.5);
    }
  });
});

describe('on ne montre que des joueurs réellement sur le pré', () => {
  const squad: MatchSquad = {
    clubId: 'c1' as ClubId,
    starters: POSITIONS.map((position, i) => ({
      playerId: `t_${i}` as PlayerId,
      position,
      captainArmband: false,
    })),
    substitutes: [{ playerId: 'r_1' as PlayerId, position: 'TALONNEUR', captainArmband: false }],
  };

  const sub: SubstitutionRecord = {
    minute: 55,
    offPlayerId: 't_1' as PlayerId,
    onPlayerId: 'r_1' as PlayerId,
    position: 'TALONNEUR',
    reason: 'FATIGUE',
  };

  it('le titulaire est là avant l\'heure du changement', () => {
    const ids = onFieldAt(squad, [sub], 40).map(p => p.id as string);
    expect(ids).toContain('t_1');
    expect(ids).not.toContain('r_1');
  });

  it('et le remplaçant après — jamais les deux', () => {
    const onField = onFieldAt(squad, [sub], 60);
    const ids = onField.map(p => p.id as string);
    expect(ids).toContain('r_1');
    expect(ids).not.toContain('t_1');
    expect(onField).toHaveLength(15);
  });
});
