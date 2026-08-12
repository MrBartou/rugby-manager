/**
 * Les réactions du vestiaire — V0.53.
 *
 * `applySquadMoodDelta` n'était appelé que sur une promesse trahie, et il
 * appliquait le **même** delta à tout le monde. Vendre un joueur apprécié,
 * écarter un cadre, destituer le capitaine : personne ne bronchait.
 *
 * La propriété qui distingue ce module d'un simple malus collectif : la
 * réaction est **individuelle**, et c'est le graphe de relations qui la décide.
 * Un delta uniforme aurait été plus simple, et aurait rendu le graphe inutile
 * une fois de plus.
 */

import { describe, expect, it } from 'vitest';
import {
  EVENT_LABEL,
  reactionSummary,
  roomReaction,
  type RoomEvent,
} from '../../src/engine/human/dressing-room.js';
import { updateRelationScore } from '../../src/engine/human/relationships.js';
import type { RelationsState } from '../../src/engine/human/relationships.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const GROUPE: readonly Player[] = SQUAD.players.slice(0, 12);
const SUJET = GROUPE[0]!;
const AMI = GROUPE[1]!;
const RIVAL = GROUPE[2]!;
const NEUTRE = GROUPE[3]!;

const EMPTY: RelationsState = { byPair: new Map() };

const avecLiens = (): RelationsState => {
  let r = updateRelationScore(EMPTY, SUJET.id, AMI.id, 80, 'amis');
  r = updateRelationScore(r, SUJET.id, RIVAL.id, -80, 'clash');
  return r;
};

const react = (event: RoomEvent, relations?: RelationsState) =>
  roomReaction({
    subject: SUJET,
    squad: GROUPE,
    event,
    ...(relations ? { relations } : {}),
  });

describe('la réaction est individuelle', () => {
  it('un ami prend la décision bien plus mal que les autres', () => {
    const r = react('VENDU', avecLiens());
    const ami = r.find(x => x.playerId === AMI.id)!;
    const neutre = r.find(x => x.playerId === NEUTRE.id)!;
    expect(ami.delta).toBeLessThan(neutre.delta);
    expect(ami.reason).toContain('proche');
  });

  it('un rival n\'en souffre pas — une place se libère', () => {
    const r = react('VENDU', avecLiens());
    const rival = r.find(x => x.playerId === RIVAL.id)!;
    expect(rival.delta).toBeGreaterThan(0);
  });

  it('les autres encaissent la gravité de base', () => {
    const r = react('VENDU', avecLiens());
    const neutre = r.find(x => x.playerId === NEUTRE.id)!;
    expect(neutre.delta).toBeLessThan(0);
    expect(neutre.delta).toBeGreaterThan(-4);
  });

  it('n\'oublie jamais le sujet lui-même', () => {
    expect(react('VENDU', avecLiens()).some(x => x.playerId === SUJET.id)).toBe(false);
  });

  it('sans graphe de relations, tout le monde réagit pareil', () => {
    // Compatibilité : une sauvegarde sans relations ne doit pas planter, elle
    // retombe simplement sur un malus uniforme.
    const deltas = new Set(react('VENDU').map(x => x.delta));
    expect(deltas.size).toBe(1);
  });
});

describe('le poids de l\'homme compte', () => {
  it('perdre quelqu\'un d\'entouré coûte plus cher que perdre un isolé', () => {
    let entouré = EMPTY;
    for (const p of GROUPE.slice(1, 7)) {
      entouré = updateRelationScore(entouré, SUJET.id, p.id, 80, 'amis');
    }
    const avec = roomReaction({ subject: SUJET, squad: GROUPE, event: 'VENDU', relations: entouré });
    const sans = react('VENDU');

    const moyenne = (rs: readonly { delta: number }[]) =>
      rs.reduce((s, r) => s + r.delta, 0) / rs.length;
    expect(moyenne(avec)).toBeLessThan(moyenne(sans));
  });

  it('mais un vestiaire encaisse : il ne s\'effondre jamais', () => {
    let tous = EMPTY;
    for (const p of GROUPE.slice(1)) {
      tous = updateRelationScore(tous, SUJET.id, p.id, 90, 'amis');
    }
    const r = roomReaction({
      subject: SUJET, squad: GROUPE, event: 'CAPITAINE_DESTITUE', relations: tous,
    });
    for (const x of r) expect(x.delta).toBeGreaterThan(-10);
  });
});

describe('chaque décision a son poids', () => {
  it('destituer le capitaine secoue plus que vendre un joueur', () => {
    const vendu = react('VENDU')[0]!.delta;
    const destitué = react('CAPITAINE_DESTITUE')[0]!.delta;
    expect(destitué).toBeLessThan(vendu);
  });

  it('nomme chaque décision en clair', () => {
    for (const e of ['VENDU', 'MIS_A_L_ECART', 'CAPITAINE_DESTITUE', 'PROMESSE_TRAHIE'] as const) {
      expect(EVENT_LABEL[e].length).toBeGreaterThan(8);
      expect(react(e)[0]!.reason).toContain(SUJET.lastName);
    }
  });
});

describe('ce que le staff en rapporte', () => {
  it('se contente de constater quand personne n\'est touché', () => {
    expect(reactionSummary(SUJET, react('VENDU'))).toContain('sans broncher');
  });

  it('signale ceux que la décision a vraiment atteints', () => {
    let entouré = EMPTY;
    for (const p of GROUPE.slice(1, 5)) {
      entouré = updateRelationScore(entouré, SUJET.id, p.id, 80, 'amis');
    }
    const r = roomReaction({ subject: SUJET, squad: GROUPE, event: 'VENDU', relations: entouré });
    expect(reactionSummary(SUJET, r)).toMatch(/joueurs? viv/);
  });

  it('ne liste jamais trente réactions', () => {
    expect(reactionSummary(SUJET, react('VENDU')).length).toBeLessThan(90);
  });
});
