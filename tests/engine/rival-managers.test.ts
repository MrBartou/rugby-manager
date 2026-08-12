/**
 * Les managers rivaux — V0.53.
 *
 * Les clubs IA licenciaient leur entraîneur depuis la V0.43, mais cet
 * entraîneur n'existait nulle part : une vacance était un simple identifiant de
 * club, et le monde limogeait des fantômes.
 *
 * Ce qui est testé ici : les bancs portent un nom, les carrières bougent — on
 * est limogé, on rebondit, on monte et on descend dans l'estime générale — et
 * surtout, **le joueur n'est plus seul à vouloir le poste**.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_RIVALS,
  STYLE_LABEL,
  contestedBy,
  fillVacancy,
  managerOf,
  reputationTable,
  reviewRivalSeason,
  sackRival,
  seedRivals,
  unemployed,
} from '../../src/engine/season/rival-managers.js';
import { createRng } from '../../src/engine/rng.js';
import type { Club, ClubId } from '../../src/engine/types.js';

const club = (id: string, reputation: number): Club => ({
  id: id as ClubId, name: `Club ${id}`, shortName: id.slice(0, 3).toUpperCase(), city: 'Ville',
  tier: reputation >= 75 ? 'GROS_BUDGET' : reputation >= 55 ? 'BUDGET_MOYEN' : 'PETIT_BUDGET',
  tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000, annualBudget: 20_000_000,
  salaryCapUsage: 0, jiffCount: 0, reputation,
});

const LEAGUE: readonly Club[] = [
  club('a', 92), club('b', 85), club('c', 80), club('d', 76), club('e', 72),
  club('f', 68), club('g', 64), club('h', 60), club('i', 56), club('j', 52),
  club('k', 48), club('l', 44), club('m', 40), club('n', 36),
];

const seed = (playerClub = 'a') =>
  seedRivals(LEAGUE, playerClub as ClubId, c => c.reputation);

describe('chaque banc porte un nom', () => {
  it('installe un entraîneur partout sauf chez l\'utilisateur', () => {
    const state = seed('a');
    expect(managerOf(state, 'a' as ClubId)).toBeUndefined();
    for (const c of LEAGUE.filter(x => x.id !== 'a')) {
      expect(managerOf(state, c.id)).toBeDefined();
    }
  });

  it('range les meilleurs sur les plus gros bancs', () => {
    const state = seed('n');
    const gros = managerOf(state, 'a' as ClubId)!;
    const petit = managerOf(state, 'm' as ClubId)!;
    expect(gros.reputation).toBeGreaterThan(petit.reputation);
  });

  it('garde des entraîneurs disponibles dès le départ', () => {
    // Sans réserve, le premier banc libéré resterait vide.
    expect(unemployed(seed()).length).toBeGreaterThan(0);
  });

  it('donne à chacun un nom, un style et une réputation qui se lisent', () => {
    for (const m of seed().managers) {
      expect(m.name.length).toBeGreaterThan(6);
      expect(STYLE_LABEL[m.style]).toBeDefined();
      expect(m.reputationLine.length).toBeGreaterThan(20);
      expect(m.reputation).toBeGreaterThanOrEqual(20);
      expect(m.reputation).toBeLessThanOrEqual(99);
    }
  });

  it('ne prétend rien quand il n\'y a pas encore de corps arbitral', () => {
    expect(managerOf(EMPTY_RIVALS, 'a' as ClubId)).toBeUndefined();
    expect(unemployed(EMPTY_RIVALS)).toEqual([]);
  });
});

describe('les carrières bougent', () => {
  it('un limogeage libère le banc et coûte de la réputation', () => {
    const state = seed('a');
    const avant = managerOf(state, 'c' as ClubId)!;
    const { state: after, sacked } = sackRival(state, 'c' as ClubId);

    expect(sacked?.id).toBe(avant.id);
    expect(managerOf(after, 'c' as ClubId)).toBeUndefined();
    const rebond = after.managers.find(m => m.id === avant.id)!;
    expect(rebond.reputation).toBeLessThan(avant.reputation);
    expect(rebond.sackings).toBe(1);
  });

  it('mais un limogeage ne détruit pas une carrière d\'un coup', () => {
    const state = seed('a');
    const avant = managerOf(state, 'b' as ClubId)!;
    const { state: after } = sackRival(state, 'b' as ClubId);
    const rebond = after.managers.find(m => m.id === avant.id)!;
    expect(avant.reputation - rebond.reputation).toBeLessThan(10);
  });

  it('ne fait rien d\'un club qui n\'avait pas d\'entraîneur', () => {
    const state = seed('a');
    const { state: after, sacked } = sackRival(state, 'a' as ClubId);
    expect(sacked).toBeUndefined();
    expect(after).toBe(state);
  });

  it('un banc vacant retrouve un entraîneur', () => {
    let state = seed('a');
    state = sackRival(state, 'd' as ClubId).state;
    const { state: after, hired } = fillVacancy(
      state, LEAGUE[3]!, 76, createRng('embauche'),
    );
    expect(hired).toBeDefined();
    expect(managerOf(after, 'd' as ClubId)?.id).toBe(hired?.id);
  });

  it('un club modeste ne décroche pas une gloire', () => {
    let state = seed('a');
    // On libère le plus petit banc et on regarde qui le prend.
    state = sackRival(state, 'n' as ClubId).state;
    const { hired } = fillVacancy(state, LEAGUE[13]!, 36, createRng('modeste'));
    expect(hired!.reputation).toBeLessThan(70);
  });

  it('finir mieux que prévu fait monter, et l\'inverse fait descendre', () => {
    const state = seed('a');
    const avant = managerOf(state, 'e' as ClubId)!.reputation;
    const monté = reviewRivalSeason(state, 'e' as ClubId, 2, 8);
    const descendu = reviewRivalSeason(state, 'e' as ClubId, 12, 5);
    expect(managerOf(monté, 'e' as ClubId)!.reputation).toBeGreaterThan(avant);
    expect(managerOf(descendu, 'e' as ClubId)!.reputation).toBeLessThan(avant);
  });

  it('compte les saisons passées sur un banc', () => {
    const state = reviewRivalSeason(seed('a'), 'f' as ClubId, 6, 6);
    expect(managerOf(state, 'f' as ClubId)!.seasons).toBe(1);
  });

  it('ne laisse jamais une réputation sortir de ses bornes', () => {
    let state = seed('a');
    for (let i = 0; i < 30; i++) state = reviewRivalSeason(state, 'g' as ClubId, 14, 1);
    expect(managerOf(state, 'g' as ClubId)!.reputation).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < 30; i++) state = reviewRivalSeason(state, 'g' as ClubId, 1, 14);
    expect(managerOf(state, 'g' as ClubId)!.reputation).toBeLessThanOrEqual(99);
  });
});

describe('aucun banc ne reste vide', () => {
  /**
   * C'est l'invariant que l'application doit tenir à chaque intersaison :
   * limoger sans repourvoir ferait s'empiler les vacances d'année en année
   * jusqu'à ce que la moitié du championnat joue sans entraîneur.
   */
  it('un cycle limogeage puis repourvue laisse tous les bancs occupés', () => {
    let state = seed('a');
    const limogés: ClubId[] = ['c', 'e', 'h', 'k'].map(id => id as ClubId);

    for (const clubId of limogés) state = sackRival(state, clubId).state;
    for (const clubId of limogés) {
      expect(managerOf(state, clubId)).toBeUndefined();
    }

    for (const clubId of limogés) {
      const club = LEAGUE.find(c => c.id === clubId)!;
      const { state: after, hired } = fillVacancy(
        state, club, club.reputation, createRng(`r_${clubId as string}`),
      );
      expect(hired).toBeDefined();
      state = after;
    }

    for (const c of LEAGUE.filter(x => x.id !== 'a')) {
      expect(managerOf(state, c.id)).toBeDefined();
    }
  });

  it('tient sur dix saisons de valse', () => {
    let state = seed('a');
    for (let saison = 0; saison < 10; saison++) {
      const victimes = LEAGUE
        .filter(c => c.id !== 'a')
        .slice(saison % 3, (saison % 3) + 3)
        .map(c => c.id);

      for (const clubId of victimes) state = sackRival(state, clubId).state;
      for (const clubId of victimes) {
        const club = LEAGUE.find(c => c.id === clubId)!;
        state = fillVacancy(
          state, club, club.reputation, createRng(`s${saison}_${clubId as string}`),
        ).state;
      }
    }
    // Après dix ans de chaises musicales, chaque club a toujours un entraîneur.
    for (const c of LEAGUE.filter(x => x.id !== 'a')) {
      expect(managerOf(state, c.id)).toBeDefined();
    }
  });
});

describe('le joueur n\'est plus seul à vouloir le poste', () => {
  it('un rival mieux coté prend le banc convoité', () => {
    let state = seed('n');
    state = sackRival(state, 'a' as ClubId).state;   // le plus gros banc se libère
    expect(contestedBy(state, 92, 40)).toBeDefined();
  });

  it('mais s\'efface devant un manager qui a fait ses preuves', () => {
    let state = seed('n');
    state = sackRival(state, 'a' as ClubId).state;
    // Réputation supérieure à tout le vivier disponible : le banc est à lui.
    expect(contestedBy(state, 92, 99)).toBeUndefined();
  });

  it('ne fait pas descendre une gloire sur un banc trop modeste', () => {
    let state = seed('a');
    state = sackRival(state, 'n' as ClubId).state;
    const rival = contestedBy(state, 36, 20);
    if (rival) expect(rival.reputation).toBeLessThan(60);
  });
});

describe('la réputation devient un rang', () => {
  const table = () => reputationTable(
    seed('a'),
    { name: 'Vous', reputation: 62, clubName: 'Club a' },
    id => LEAGUE.find(c => (c.id as string) === id)?.name,
  );

  it('classe tout le monde, le joueur compris', () => {
    const rows = table();
    expect(rows.some(r => r.isPlayer)).toBe(true);
    expect(rows.length).toBe(seed('a').managers.length + 1);
  });

  it('range de la meilleure réputation à la plus faible', () => {
    const rows = table();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.reputation).toBeGreaterThanOrEqual(rows[i]!.reputation);
    }
  });

  it('dit à quel club chacun appartient, et laisse vide pour les sans-club', () => {
    const rows = table();
    expect(rows.some(r => r.clubName !== undefined)).toBe(true);
    expect(rows.some(r => r.clubName === undefined)).toBe(true);
  });
});
