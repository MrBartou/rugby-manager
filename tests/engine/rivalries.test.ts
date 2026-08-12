/**
 * Les rivalités — V0.48.
 *
 * Le risque propre à une table écrite à la main : une faute de frappe dans un
 * identifiant désactive silencieusement un derby. Personne ne s'en aperçoit —
 * le match se joue simplement comme un match ordinaire.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_HEAD_TO_HEAD,
  RIVALRIES,
  attendanceBonus,
  historyPressure,
  moodMultiplier,
  recordResult,
  rivalryBetween,
  rivalryContext,
  rivalsOf,
} from '../../src/engine/season/rivalries.js';
import { buildProD2Clubs } from '../../src/engine/season/divisions.js';
import type { ClubId } from '../../src/engine/types.js';

/**
 * Les quatorze identifiants du Top 14, recopiés de `data/clubs.csv`.
 *
 * On ne charge pas le CSV ici : il faut le système de fichiers, donc `tools/`,
 * qui n'est pas typechecké faute de `@types/node` — l'importer casserait
 * `tsc --noEmit`. Ce miroir peut théoriquement diverger, mais un changement
 * d'identifiant de club casserait bien plus que ce test.
 */
const TOP14_IDS: readonly string[] = [
  'toulouse', 'ubb', 'larochelle', 'toulon', 'racing', 'stade', 'clermont',
  'lyon', 'montpellier', 'castres', 'pau', 'bayonne', 'usap', 'vannes',
];

const KNOWN_IDS = new Set<string>([
  ...TOP14_IDS,
  ...buildProD2Clubs().map(c => c.id as string),
]);

describe('la table', () => {
  it('ne référence que des clubs qui existent', () => {
    // Une faute de frappe désactiverait le derby en silence.
    for (const r of RIVALRIES) {
      expect(KNOWN_IDS.has(r.a as string), `club inconnu : ${r.a as string}`).toBe(true);
      expect(KNOWN_IDS.has(r.b as string), `club inconnu : ${r.b as string}`).toBe(true);
    }
  });

  it('n\'oppose jamais un club à lui-même', () => {
    for (const r of RIVALRIES) expect(r.a).not.toBe(r.b);
  });

  it('ne déclare pas deux fois la même paire', () => {
    const seen = new Set<string>();
    for (const r of RIVALRIES) {
      const key = [r.a as string, r.b as string].sort().join('|');
      expect(seen.has(key), `paire en double : ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('nomme chaque rivalité', () => {
    for (const r of RIVALRIES) expect(r.name.length).toBeGreaterThan(5);
  });
});

describe('recherche', () => {
  it('trouve une rivalité dans les deux sens', () => {
    const a = rivalryBetween('toulouse' as ClubId, 'toulon' as ClubId);
    const b = rivalryBetween('toulon' as ClubId, 'toulouse' as ClubId);
    expect(a).toBeDefined();
    expect(a).toEqual(b);
  });

  it('ne trouve rien entre deux clubs sans histoire', () => {
    expect(rivalryBetween('vannes' as ClubId, 'montpellier' as ClubId)).toBeUndefined();
  });

  it('liste les rivaux d\'un club', () => {
    const rivals = rivalsOf('toulouse' as ClubId);
    expect(rivals).toContain('castres');
    expect(rivals).toContain('toulon');
    expect(rivals).not.toContain('toulouse');
  });
});

describe('ce qu\'un derby change', () => {
  it('remplit davantage qu\'un classique', () => {
    expect(attendanceBonus('DERBY')).toBeGreaterThan(attendanceBonus('CLASSIQUE'));
  });

  it('amplifie le moral dans les deux sens', () => {
    // Ne bonifier que la victoire ferait du derby une aubaine.
    expect(moodMultiplier('DERBY')).toBeGreaterThan(1);
    expect(moodMultiplier('DERBY')).toBeGreaterThan(moodMultiplier('CLASSIQUE'));
  });
});

describe('mémoire des confrontations', () => {
  it('compte les résultats', () => {
    let h = EMPTY_HEAD_TO_HEAD;
    h = recordResult(h, 'V');
    h = recordResult(h, 'D');
    h = recordResult(h, 'N');
    expect(h).toMatchObject({ wins: 1, losses: 1, draws: 1 });
  });

  it('suit la série en cours', () => {
    let h = EMPTY_HEAD_TO_HEAD;
    h = recordResult(recordResult(h, 'V'), 'V');
    expect(h.streak).toBe(2);
    h = recordResult(h, 'D');
    expect(h.streak).toBe(-1);
  });

  it('remet la série à zéro sur un nul', () => {
    let h = recordResult(recordResult(EMPTY_HEAD_TO_HEAD, 'V'), 'V');
    h = recordResult(h, 'N');
    expect(h.streak).toBe(0);
  });

  it('fait peser l\'histoire, sans qu\'elle écrase', () => {
    // Une longue disette rendrait sinon le club durablement inapte à ce match.
    let h = EMPTY_HEAD_TO_HEAD;
    for (let i = 0; i < 12; i++) h = recordResult(h, 'D');
    expect(historyPressure(h)).toBeGreaterThanOrEqual(-6);
    expect(historyPressure(h)).toBeLessThan(0);
  });

  it('raconte la confrontation à venir', () => {
    const r = RIVALRIES[0]!;
    let h = EMPTY_HEAD_TO_HEAD;
    expect(rivalryContext(r, h)).toMatch(/première confrontation/);
    for (let i = 0; i < 3; i++) h = recordResult(h, 'D');
    expect(rivalryContext(r, h)).toMatch(/3 défaites de rang/);
  });
});
