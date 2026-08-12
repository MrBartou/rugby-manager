/**
 * Les honneurs de fin de saison — V0.53.
 *
 * Une année se terminait sur un classement et rien d'autre : ni meilleur
 * joueur, ni XV de la saison, ni meilleur espoir.
 *
 * La propriété qui rend le trophée crédible : on note **par rapport au poste**.
 * Sans cela, il reviendrait chaque année à un ailier, et personne ne le
 * regarderait plus — un troisième ligne qui gratte trente ballons et plaque
 * deux cents fois ne marque aucun essai.
 */

import { describe, expect, it } from 'vitest';
import {
  computeHonours,
  honoursOf,
  seasonRating,
  type HonourStat,
  type HonoursInput,
} from '../../src/engine/season/honours.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId, Position } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE = SQUAD.players[0]!;

const player = (id: string, position: Position, birthYear = 1996): Player => ({
  ...BASE,
  id: id as PlayerId,
  firstName: 'P',
  lastName: id.toUpperCase(),
  position,
  birthDate: `${birthYear}-03-01`,
});

const stat = (over: Partial<HonourStat> = {}): HonourStat => ({
  tries: 0, matches: 20, minutes: 1600,
  tackles: 0, meters: 0, turnovers: 0, defendersBeaten: 0, lineBreaks: 0,
  ...over,
});

const input = (
  entries: readonly (readonly [Player, HonourStat])[],
  over: Partial<HonoursInput> = {},
): HonoursInput => ({
  players: entries.map(([p]) => p),
  stats: new Map(entries.map(([p, s]) => [p.id, s])),
  currentSeason: 2025,
  roundsPlayed: 26,
  clubNameOf: () => 'Club test',
  ...over,
});

describe('on note chacun à son poste', () => {
  it('une saison moyenne vaut à peu près la même note à chaque ligne', () => {
    // Valeurs relevées sur le moteur, par joueur et par saison — voir le
    // tableau du module. C'est la condition pour qu'un pilier puisse gagner.
    const moyennes: readonly (readonly [Position, HonourStat])[] = [
      ['PILIER_GAUCHE', stat({ tries: 0.8, tackles: 28.3, turnovers: 0.3, meters: 37.7, defendersBeaten: 2.3, lineBreaks: 0.4 })],
      ['DEUXIEME_LIGNE_GAUCHE', stat({ tries: 2.3, tackles: 36.2, turnovers: 0.3, meters: 71.5, defendersBeaten: 4.7, lineBreaks: 1.3 })],
      ['NUMERO_8', stat({ tries: 2.0, tackles: 39.0, turnovers: 0.4, meters: 87.8, defendersBeaten: 5.4, lineBreaks: 0.8 })],
      ['OUVREUR', stat({ tries: 3.4, tackles: 8.0, turnovers: 0, meters: 39.6, defendersBeaten: 2.8, lineBreaks: 0.6 })],
      ['AILIER_GAUCHE', stat({ tries: 5.0, tackles: 14.8, turnovers: 0.2, meters: 85.7, defendersBeaten: 4.3, lineBreaks: 0.9 })],
    ];

    const notes = moyennes.map(([pos, st]) => seasonRating(player(pos, pos), st));
    for (const n of notes) {
      expect(n).toBeGreaterThan(7);
      expect(n).toBeLessThan(13);
    }
  });

  it('un essai vaut plus à un pilier qu\'à un ailier', () => {
    const pilier = player('pilier', 'PILIER_GAUCHE');
    const ailier = player('ailier', 'AILIER_DROIT');
    const avec = stat({ tries: 5 });
    const sans = stat();
    expect(seasonRating(pilier, avec) - seasonRating(pilier, sans))
      .toBeGreaterThan(seasonRating(ailier, avec) - seasonRating(ailier, sans));
  });

  it('ramène la note au match : la longévité ne suffit pas', () => {
    const p = player('x', 'NUMERO_8');
    const régulier = seasonRating(p, stat({ matches: 26, turnovers: 26 }));
    const rare = seasonRating(p, stat({ matches: 5, turnovers: 5 }));
    expect(régulier).toBeCloseTo(rare, 1);
  });

  it('ne note pas celui qui n\'a jamais joué', () => {
    expect(seasonRating(player('x', 'ARRIERE'), stat({ matches: 0 }))).toBe(0);
  });
});

describe('les trophées', () => {
  const champ = player('champ', 'NUMERO_8', 1994);
  const espoir = player('espoir', 'OUVREUR', 2004);
  const finisseur = player('finisseur', 'AILIER_GAUCHE', 1995);
  const quelconque = player('quelconque', 'TALONNEUR', 1993);

  const données = input([
    [champ, stat({ turnovers: 40, tackles: 240, meters: 700, defendersBeaten: 40 })],
    [espoir, stat({ tries: 4, meters: 600, lineBreaks: 10, defendersBeaten: 25 })],
    [finisseur, stat({ tries: 15, meters: 1500, lineBreaks: 20 })],
    [quelconque, stat({ tackles: 90 })],
  ]);

  it('désigne un meilleur joueur, avec ce qui le lui a valu', () => {
    const h = computeHonours(données);
    expect(h.bestPlayer).toBeDefined();
    expect(h.bestPlayer!.line).toContain('moyenne');
    expect(h.bestPlayer!.clubName).toBe('Club test');
  });

  it('réserve le trophée d\'espoir aux vingt-trois ans et moins', () => {
    const h = computeHonours(données);
    expect(h.bestYoungPlayer?.playerId).toBe(espoir.id);
  });

  it('donne le titre de meilleur marqueur au total brut, pas à la note', () => {
    const h = computeHonours(données);
    expect(h.topTryScorer?.playerId).toBe(finisseur.id);
    expect(h.topTryScorer!.line).toContain('15 essais');
  });

  it('compose un XV type sans jamais aligner deux fois le même homme', () => {
    const complet = input(
      SQUAD.players.slice(0, 15).map((p, i) => [
        p, stat({ tries: i % 4, tackles: 100 + i * 5, turnovers: i }),
      ] as const),
    );
    const h = computeHonours(complet);
    const ids = h.teamOfTheSeason.map(l => l.playerId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(h.teamOfTheSeason.length).toBeGreaterThan(10);
  });

  it('exige d\'avoir tenu la saison', () => {
    // Trois matchs énormes ne valent pas un trophée : c'est la règle de tous
    // les vrais palmarès, et elle a la même raison d'être ici.
    const éclair = player('eclair', 'ARRIERE');
    const h = computeHonours(input([
      [éclair, stat({ matches: 3, tries: 9, meters: 900, lineBreaks: 15 })],
      [champ, stat({ turnovers: 20, tackles: 200 })],
    ]));
    expect(h.bestPlayer?.playerId).not.toBe(éclair.id);
  });

  it('ne décerne rien plutôt que d\'inventer un lauréat', () => {
    const h = computeHonours(input([[champ, stat({ matches: 2 })]]));
    expect(h.bestPlayer).toBeUndefined();
    expect(h.teamOfTheSeason).toEqual([]);
    expect(h.season).toBe(2025);
  });

  it('ne sacre pas un meilleur marqueur sans le moindre essai', () => {
    const h = computeHonours(input([[quelconque, stat({ tackles: 120 })]]));
    expect(h.topTryScorer).toBeUndefined();
  });
});

describe('le palmarès personnel', () => {
  it('retient ce qu\'un joueur a gagné, saison après saison', () => {
    const p = player('vedette', 'OUVREUR', 2003);
    const saison = (season: number) => computeHonours(input([
      [p, stat({ tries: 10, meters: 900, lineBreaks: 14, defendersBeaten: 30 })],
    ], { currentSeason: season }));

    const palmares = honoursOf([saison(2025), saison(2026)], p.id);
    expect(palmares.length).toBeGreaterThanOrEqual(4);
    expect(palmares.some(h => h.label.includes('Meilleur joueur'))).toBe(true);
    expect(palmares.some(h => h.label.includes('XV de la saison'))).toBe(true);
    expect(new Set(palmares.map(h => h.season))).toEqual(new Set([2025, 2026]));
  });

  it('ne retient rien pour qui n\'a rien gagné', () => {
    const p = player('anonyme', 'PILIER_DROIT');
    const autre = player('vedette', 'OUVREUR');
    const h = computeHonours(input([
      [autre, stat({ tries: 10, meters: 900 })],
      [p, stat({ tackles: 10 })],
    ]));
    expect(honoursOf([h], p.id).some(x => x.label.includes('Meilleur joueur'))).toBe(false);
  });
});
