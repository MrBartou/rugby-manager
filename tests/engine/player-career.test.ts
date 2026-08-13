/**
 * La carrière d'un joueur — V0.59.
 *
 * La fiche ne montrait que la saison en cours : un espoir formé au club, prêté
 * deux ans, installé titulaire, sélectionné puis champion arrivait à trente-
 * quatre ans sans qu'une ligne n'en garde trace.
 *
 * Ce qui est vérifié ici : le registre garde le **détail** saison par saison,
 * les totaux s'en dérivent (jamais l'inverse — c'est la faute que ce projet a
 * déjà payée trois fois), rejouer une saison ne la double pas, et un cumul
 * antérieur se reprend sans mentir sur ce qu'on en sait.
 */

import { describe, expect, it } from 'vitest';
import {
  compactBook,
  compactCareer,
  EMPTY_BOOK,
  careerTotals,
  clubLeaders,
  fromLegacyTotals,
  recordSeason,
  retirementTribute,
  totalsAtClub,
  type CareerBook,
  type SeasonEntry,
} from '../../src/engine/season/player-career.js';
import type { ClubId, PlayerId } from '../../src/engine/types.js';

const TOULOUSE = 'toulouse' as ClubId;
const PAU = 'pau' as ClubId;

const entry = (over: Partial<SeasonEntry> = {}): SeasonEntry => ({
  playerId: 'p1' as PlayerId,
  playerName: 'Antoine Dupont',
  clubId: TOULOUSE,
  matches: 24,
  minutes: 1780,
  tries: 9,
  caps: 7,
  honours: [],
  ...over,
});

const book = (): CareerBook => {
  let b = recordSeason(EMPTY_BOOK, 2025, [entry()]);
  b = recordSeason(b, 2026, [entry({ matches: 21, minutes: 1540, tries: 6, caps: 7 })]);
  return recordSeason(b, 2027, [entry({ matches: 19, minutes: 1320, tries: 4, caps: 5 })]);
};

describe('le registre garde le détail', () => {
  it('une ligne par saison, dans l\'ordre', () => {
    const career = book().get('p1' as PlayerId)!;
    expect(career.lines.map(l => l.season)).toEqual([2025, 2026, 2027]);
  });

  it('les totaux se dérivent des lignes', () => {
    const t = careerTotals(book().get('p1' as PlayerId));
    expect(t.seasons).toBe(3);
    expect(t.matches).toBe(64);
    expect(t.minutes).toBe(4640);
    expect(t.tries).toBe(19);
    expect(t.caps).toBe(19);
  });

  it('et distinguent ce qui a été fait sous chaque maillot', () => {
    const b = recordSeason(book(), 2028, [entry({ clubId: PAU, matches: 20, tries: 3, caps: 0 })]);
    const career = b.get('p1' as PlayerId)!;
    expect(totalsAtClub(career, TOULOUSE).matches).toBe(64);
    expect(totalsAtClub(career, PAU).matches).toBe(20);
    expect(careerTotals(career).clubs).toEqual([TOULOUSE, PAU]);
  });

  it('marque une saison passée en prêt', () => {
    const b = recordSeason(EMPTY_BOOK, 2025, [entry({ clubId: PAU, onLoan: true })]);
    expect(b.get('p1' as PlayerId)!.lines[0]!.onLoan).toBe(true);
  });
});

describe('ce qu\'on ne consigne pas', () => {
  it('une saison blanche ne laisse pas une ligne de zéros', () => {
    // Un joueur blessé toute l'année n'a rien à voir figurer dans son palmarès.
    const b = recordSeason(EMPTY_BOOK, 2025, [
      entry({ matches: 0, minutes: 0, tries: 0, caps: 0, honours: [] }),
    ]);
    expect(b.size).toBe(0);
  });

  it('mais une saison sans match avec une sélection, si', () => {
    const b = recordSeason(EMPTY_BOOK, 2025, [
      entry({ matches: 0, minutes: 0, tries: 0, caps: 2 }),
    ]);
    expect(b.get('p1' as PlayerId)!.lines).toHaveLength(1);
  });

  it('rejouer une saison la remplace au lieu de la doubler', () => {
    // Une intersaison relancée ne doit pas créer deux lignes 2025.
    let b = recordSeason(EMPTY_BOOK, 2025, [entry({ matches: 10 })]);
    b = recordSeason(b, 2025, [entry({ matches: 24 })]);
    const lines = b.get('p1' as PlayerId)!.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]!.matches).toBe(24);
  });
});

describe('les records du club', () => {
  const many = (): CareerBook => {
    let b = recordSeason(EMPTY_BOOK, 2025, [
      entry({ playerId: 'a' as PlayerId, playerName: 'Penaud', tries: 15, matches: 26 }),
      entry({ playerId: 'b' as PlayerId, playerName: 'Jalibert', tries: 5, matches: 24 }),
      entry({ playerId: 'c' as PlayerId, playerName: 'Etzebeth', clubId: PAU, tries: 20, matches: 26 }),
    ]);
    b = recordSeason(b, 2026, [
      entry({ playerId: 'b' as PlayerId, playerName: 'Jalibert', tries: 4, matches: 25 }),
    ]);
    return b;
  };

  it('classent par essais et ne mélangent pas les clubs', () => {
    const top = clubLeaders(many(), TOULOUSE, 'tries', 3);
    expect(top.map(t => t.playerName)).toEqual(['Penaud', 'Jalibert']);
    expect(top[0]!.value).toBe(15);
  });

  it('savent aussi qui a le plus porté le maillot', () => {
    // Jalibert cumule 49 matchs en deux saisons, Penaud 26 en une.
    const top = clubLeaders(many(), TOULOUSE, 'matches', 3);
    expect(top[0]!.playerName).toBe('Jalibert');
    expect(top[0]!.value).toBe(49);
  });
});

describe('l\'hommage au moment de raccrocher', () => {
  it('chiffre ce qui a été fait', () => {
    const texte = retirementTribute(book().get('p1' as PlayerId), 'Dupont');
    expect(texte).toContain('64 matchs');
    expect(texte).toContain('19 essais');
    expect(texte).toContain('19 sélections');
  });

  it('salue la fidélité d\'une carrière au même club', () => {
    let b = EMPTY_BOOK;
    for (let s = 2020; s < 2028; s++) b = recordSeason(b, s, [entry()]);
    expect(retirementTribute(b.get('p1' as PlayerId), 'Dupont')).toContain('même club');
  });

  it('reste sobre pour qui n\'a rien joué', () => {
    const texte = retirementTribute(undefined, 'Martin');
    expect(texte).toContain('sans avoir trouvé sa place');
    expect(texte).not.toMatch(/\d/);
  });

  it('ne compte pas des distinctions qui n\'existent pas', () => {
    expect(retirementTribute(book().get('p1' as PlayerId), 'Dupont'))
      .not.toContain('distinction');
    const avecTitre = recordSeason(book(), 2028, [entry({ honours: ['Meilleur joueur'] })]);
    expect(retirementTribute(avecTitre.get('p1' as PlayerId), 'Dupont'))
      .toContain('1 distinction');
  });
});

describe('la reprise d\'un cumul antérieur', () => {
  it('consigne le passé en une ligne, sans inventer de découpage', () => {
    // Les sauvegardes d'avant la V0.59 ne portent qu'un total. Le répartir sur
    // des saisons plausibles serait pire que d'admettre qu'on ne sait pas.
    const b = fromLegacyTotals([
      { playerId: 'p1' as PlayerId, playerName: 'Dupont', clubId: TOULOUSE, tries: 14, matches: 50 },
    ], 2027);
    const career = b.get('p1' as PlayerId)!;
    expect(career.lines).toHaveLength(1);
    expect(career.lines[0]!.season).toBe(2027);
    expect(career.lines[0]!.matches).toBe(50);
    // Les minutes n'ont jamais été cumulées avant : on ne les reconstitue pas.
    expect(career.lines[0]!.minutes).toBe(0);
  });

  it('ignore un joueur qui n\'avait rien à son compteur', () => {
    expect(fromLegacyTotals([
      { playerId: 'x' as PlayerId, playerName: 'X', clubId: TOULOUSE, tries: 0, matches: 0 },
    ], 2027).size).toBe(0);
  });
});

describe('le repli d\'une carrière achevée', () => {
  it('résume chaque club en une ligne sans rien perdre des totaux', () => {
    // V0.60 : le registre garde une ligne par saison pour tout le rugby
    // français. Sur vingt saisons, il pèse autant que la base joueurs dans une
    // sauvegarde bornée par les cinq mégaoctets du navigateur.
    const complete = recordSeason(book(), 2028, [entry({ clubId: PAU, matches: 20, tries: 3, caps: 0 })])
      .get('p1' as PlayerId)!;
    const replie = compactCareer(complete);

    expect(replie.lines).toHaveLength(2);
    expect(careerTotals(replie)).toEqual(careerTotals(complete));
    expect(totalsAtClub(replie, TOULOUSE)).toEqual(totalsAtClub(complete, TOULOUSE));
  });

  it('garde la première saison sous chaque maillot', () => {
    const replie = compactCareer(book().get('p1' as PlayerId)!);
    expect(replie.lines[0]!.season).toBe(2025);
  });

  it('ne perd pas les distinctions', () => {
    const avecTitres = recordSeason(book(), 2028, [entry({ honours: ['XV type'] })])
      .get('p1' as PlayerId)!;
    expect(compactCareer(avecTitres).lines[0]!.honours).toContain('XV type');
  });

  it('ne touche pas à une carrière en cours', () => {
    // C'est son détail saison par saison qui fait l'intérêt de la fiche.
    const livre = compactBook(book(), 2028, 3);
    expect(livre.get('p1' as PlayerId)!.lines).toHaveLength(3);
  });

  it('replie celle qui n\'a plus rien produit depuis longtemps', () => {
    const livre = compactBook(book(), 2035, 3);
    expect(livre.get('p1' as PlayerId)!.lines).toHaveLength(1);
    expect(careerTotals(livre.get('p1' as PlayerId))).toEqual(careerTotals(book().get('p1' as PlayerId)));
  });

  it('et les records de club restent les mêmes', () => {
    const avant = clubLeaders(book(), TOULOUSE, 'tries', 3);
    const apres = clubLeaders(compactBook(book(), 2035, 3), TOULOUSE, 'tries', 3);
    expect(apres).toEqual(avant);
  });
});
