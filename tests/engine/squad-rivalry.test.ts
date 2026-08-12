/**
 * Les rivalités de vestiaire — V0.56.
 *
 * `RIVAL` existait dans le type des relations depuis la V0.4 sans que rien ne le
 * produise jamais. Ce qui est testé ici : la concurrence au poste tend
 * réellement une relation, elle ne la tend que quand il y a matière, et la
 * hiérarchie annoncée par le manager change le résultat.
 */

import { describe, expect, it } from 'vitest';
import {
  CONFLICT_THRESHOLD,
  TOLERANCE,
  applyRivalryTensions,
  rivalrySummary,
  rivalryTensions,
} from '../../src/engine/human/squad-rivalry.js';
import { getRelation } from '../../src/engine/human/relationships.js';
import type { RelationsState } from '../../src/engine/human/relationships.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId, Position, TraitId } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE = SQUAD.players[0]!;

const joueur = (
  id: string,
  position: Position,
  over: { traits?: readonly string[]; retired?: boolean; freeAgent?: boolean } = {},
): Player => ({
  ...BASE,
  id: id as PlayerId,
  lastName: id.toUpperCase(),
  position,
  traits: (over.traits ?? []) as readonly TraitId[],
  ...(over.retired !== undefined ? { retired: over.retired } : {}),
  ...(over.freeAgent !== undefined ? { freeAgent: over.freeAgent } : {}),
});

const EMPTY: RelationsState = { byPair: new Map() };

/** Titulaire indiscutable contre remplaçant qui ne joue jamais. */
const ratios = (a: number, b: number): ReadonlyMap<PlayerId, number> =>
  new Map([['a' as PlayerId, a], ['b' as PlayerId, b]]);

describe('la concurrence au poste finit par tendre une relation', () => {
  const titulaire = joueur('a', 'OUVREUR');
  const remplaçant = joueur('b', 'OUVREUR');

  it('tend la relation quand l\'un joue et l\'autre regarde', () => {
    const t = rivalryTensions({
      roster: [titulaire, remplaçant],
      playRatio: ratios(0.9, 0.05),
    });
    expect(t).toHaveLength(1);
    expect(t[0]!.delta).toBeLessThan(0);
  });

  it('c\'est celui qui joue le moins qui rumine', () => {
    const t = rivalryTensions({
      roster: [titulaire, remplaçant],
      playRatio: ratios(0.9, 0.05),
    })[0]!;
    expect(t.frustrated).toBe('b');
    expect(t.ahead).toBe('a');
  });

  it('ne tend rien quand le poste se partage', () => {
    // Une rotation n'est pas une injustice : c'est le déséquilibre qui blesse.
    expect(rivalryTensions({
      roster: [titulaire, remplaçant],
      playRatio: ratios(0.55, 0.45),
    })).toEqual([]);
    expect(TOLERANCE).toBeGreaterThan(0.1);
  });

  it('ne tend rien entre deux postes qui ne se disputent rien', () => {
    // Un pilier ne prend la place de personne au centre.
    expect(rivalryTensions({
      roster: [joueur('a', 'PILIER_GAUCHE'), joueur('b', 'CENTRE_INTERIEUR')],
      playRatio: ratios(0.9, 0.05),
    })).toEqual([]);
  });

  it('mais bien entre deux postes interchangeables', () => {
    // Les deux ailiers portent des numéros différents et le même maillot.
    expect(rivalryTensions({
      roster: [joueur('a', 'AILIER_GAUCHE'), joueur('b', 'AILIER_DROIT')],
      playRatio: ratios(0.9, 0.05),
    })).toHaveLength(1);
  });

  it('ignore les retraités et les joueurs libres', () => {
    expect(rivalryTensions({
      roster: [titulaire, joueur('b', 'OUVREUR', { retired: true })],
      playRatio: ratios(0.9, 0.05),
    })).toEqual([]);
    expect(rivalryTensions({
      roster: [titulaire, joueur('b', 'OUVREUR', { freeAgent: true })],
      playRatio: ratios(0.9, 0.05),
    })).toEqual([]);
  });
});

describe('ce qu\'on lui a annoncé change tout', () => {
  const roster = [joueur('a', 'OUVREUR'), joueur('b', 'OUVREUR')];
  const playRatio = ratios(0.9, 0.05);

  const tension = (status?: 'CADRE' | 'ROTATION' | 'ESPOIR'): number =>
    rivalryTensions({
      roster,
      playRatio,
      ...(status ? { statuses: new Map([['b' as PlayerId, status]]) } : {}),
    })[0]?.delta ?? 0;

  it('un cadre écarté le vit plus mal qu\'un joueur de rotation', () => {
    expect(tension('CADRE')).toBeLessThan(tension('ROTATION'));
  });

  it('un espoir ne va jamais jusqu\'à la brouille, un cadre si', () => {
    // C'est ce qui fait de la hiérarchie de la V0.50 un outil de vestiaire :
    // nommer un jeune « espoir » ne le rend pas indifférent, mais l'empêche de
    // basculer. On mesure donc sur une saison entière, pas sur une journée —
    // l'écart d'un match tient dans l'arrondi.
    const saison = (status: 'CADRE' | 'ESPOIR'): number => {
      let state: RelationsState = EMPTY;
      for (let i = 0; i < 26; i++) {
        state = applyRivalryTensions(state, {
          roster,
          playRatio,
          statuses: new Map([['b' as PlayerId, status]]),
        }).relations;
      }
      return getRelation(state, 'a' as PlayerId, 'b' as PlayerId).score;
    };
    expect(saison('CADRE')).toBeLessThanOrEqual(CONFLICT_THRESHOLD);
    expect(saison('ESPOIR')).toBeGreaterThan(CONFLICT_THRESHOLD);
  });

  it('sans annonce, on retombe sur le statut par défaut', () => {
    expect(tension()).toBe(tension('ROTATION'));
  });
});

describe('le tempérament décide de qui le vit mal', () => {
  const playRatio = ratios(0.9, 0.05);
  const contre = (traits: readonly string[]): number =>
    rivalryTensions({
      roster: [joueur('a', 'OUVREUR'), joueur('b', 'OUVREUR', { traits })],
      playRatio,
    })[0]?.delta ?? 0;

  it('un ambitieux supporte moins bien qu\'un joueur ordinaire', () => {
    expect(contre(['ambitieux'])).toBeLessThan(contre([]));
  });

  it('un mentor ne voit pas un concurrent, il voit un jeune à former', () => {
    expect(contre(['mentor'])).toBeGreaterThan(contre([]));
  });
});

describe('appliqué au graphe, ça finit par casser', () => {
  const roster = [joueur('a', 'OUVREUR'), joueur('b', 'OUVREUR')];
  const input = { roster, playRatio: ratios(0.95, 0) };

  it('écrit la tension dans la relation, avec son motif', () => {
    const out = applyRivalryTensions(EMPTY, input);
    const rel = getRelation(out.relations, 'a' as PlayerId, 'b' as PlayerId);
    expect(rel.score).toBeLessThan(0);
    expect(rel.lastReason).toContain('Concurrence au poste');
  });

  it('une saison de banc suffit à ouvrir un conflit, une journée non', () => {
    // Le rythme voulu : assez lent pour que le manager puisse corriger le tir,
    // assez sûr pour qu'ignorer le problème toute une saison se paie.
    let state = EMPTY;
    let round = 0;
    let ouvert = 0;
    while (round < 26) {
      const out = applyRivalryTensions(state, input);
      state = out.relations;
      round++;
      if (out.flares.length > 0) ouvert = round;
    }
    expect(ouvert).toBeGreaterThan(5);
    expect(ouvert).toBeLessThanOrEqual(26);
    expect(getRelation(state, 'a' as PlayerId, 'b' as PlayerId).score)
      .toBeLessThanOrEqual(CONFLICT_THRESHOLD);
  });

  it('n\'alerte qu\'une fois, au moment de la bascule', () => {
    // Sans ce filtre, le staff enverrait le même avertissement toutes les
    // journées pendant six mois.
    let state = EMPTY;
    let alertes = 0;
    for (let i = 0; i < 40; i++) {
      const out = applyRivalryTensions(state, input);
      state = out.relations;
      alertes += out.flares.length;
    }
    expect(alertes).toBe(1);
  });

  it('ne touche pas au graphe quand personne n\'est lésé', () => {
    const out = applyRivalryTensions(EMPTY, { roster, playRatio: ratios(0.5, 0.5) });
    expect(out.relations).toBe(EMPTY);
    expect(out.flares).toEqual([]);
  });
});

describe('ce que le staff en dit', () => {
  const nameOf = (id: PlayerId): string => String(id).toUpperCase();

  it('ne nomme qu\'une tension, la pire', () => {
    const texte = rivalrySummary([
      { frustrated: 'b' as PlayerId, ahead: 'a' as PlayerId, delta: -1, reason: '' },
      { frustrated: 'd' as PlayerId, ahead: 'c' as PlayerId, delta: -3, reason: '' },
    ], nameOf);
    expect(texte).toContain('D');
    expect(texte).not.toContain('B');
  });

  it('se tait sur une simple contrariété', () => {
    expect(rivalrySummary(
      [{ frustrated: 'b' as PlayerId, ahead: 'a' as PlayerId, delta: -1, reason: '' }],
      nameOf,
    )).toBeUndefined();
    expect(rivalrySummary([], nameOf)).toBeUndefined();
  });
});
