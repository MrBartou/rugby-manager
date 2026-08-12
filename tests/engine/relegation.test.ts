/**
 * Tests de la relégation — V0.13.
 *
 * Sans descente, l'objectif « maintien » du président n'avait aucune conséquence :
 * finir quatorzième revenait à finir dixième.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import {
  DIRECT_RELEGATION_RANK,
  PLAYOFF_RELEGATION_RANK,
  generateProD2Contenders,
  isRelegationThreatened,
  promoteToTop14,
  relegationStatusForRank,
  resolveBarrage,
  resolveRelegation,
} from '../../src/engine/season/relegation.js';
import type { ClubId } from '../../src/engine/types.js';
import type { ClubStanding } from '../../src/engine/season/standings.js';

function standingsOf(count = 14): ClubStanding[] {
  return Array.from({ length: count }, (_, i) => ({
    clubId: `club_${i + 1}` as ClubId,
    played: 26,
    wins: 26 - i,
    draws: 0,
    losses: i,
    pointsFor: 700 - i * 20,
    pointsAgainst: 400 + i * 20,
    tryBonus: 5,
    losingBonus: 3,
    leaguePoints: 100 - i * 5,
  }));
}

describe('statut de relégation', () => {
  it('le dernier est relégué directement', () => {
    expect(relegationStatusForRank(DIRECT_RELEGATION_RANK)).toBe('RELEGATED');
  });

  it('l\'avant-dernier dispute le barrage', () => {
    expect(relegationStatusForRank(PLAYOFF_RELEGATION_RANK)).toBe('BARRAGE');
  });

  it('le reste du classement est sauf', () => {
    for (let rank = 1; rank <= 12; rank++) {
      expect(relegationStatusForRank(rank)).toBe('SAFE');
    }
  });
});

describe('menace de descente', () => {
  it('ne se déclenche pas en début de saison', () => {
    expect(isRelegationThreatened(14, 20)).toBe(false);
  });

  it('se déclenche en fin de saison pour le bas de tableau', () => {
    expect(isRelegationThreatened(12, 5)).toBe(true);
    expect(isRelegationThreatened(14, 3)).toBe(true);
  });

  it('ne concerne pas le haut de tableau', () => {
    expect(isRelegationThreatened(5, 3)).toBe(false);
  });
});

describe('clubs de Pro D2', () => {
  it('sont déterministes pour une saison donnée', () => {
    expect(generateProD2Contenders(2026)).toEqual(generateProD2Contenders(2026));
  });

  it('diffèrent d\'une saison à l\'autre', () => {
    const a = generateProD2Contenders(2026).map(c => c.name).join();
    const b = generateProD2Contenders(2031).map(c => c.name).join();
    expect(a).not.toBe(b);
  });

  it('sont classés par force décroissante et restent sous le niveau du Top 14', () => {
    const contenders = generateProD2Contenders(2026, 4);
    expect(contenders[0]!.strength).toBeGreaterThan(contenders[3]!.strength);
    for (const c of contenders) {
      expect(c.strength).toBeLessThanOrEqual(61);
      expect(c.strength).toBeGreaterThanOrEqual(42);
    }
  });

  it('ne produit jamais deux fois la même ville', () => {
    const names = generateProD2Contenders(2026, 4).map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('un promu arrive avec un statut de petit budget', () => {
    const club = promoteToTop14(generateProD2Contenders(2026)[0]!);
    expect(club.tier).toBe('PETIT_BUDGET');
    expect(club.reputation).toBeLessThan(50);
    expect(club.shortName).toHaveLength(3);
  });
});

describe('barrage d\'accession', () => {
  it('est déterministe pour une même graine', () => {
    const input = {
      top14ClubId: 'club_13' as ClubId,
      top14Strength: 55,
      challenger: generateProD2Contenders(2026)[1]!,
    };
    expect(resolveBarrage(input, createRng('b'))).toEqual(resolveBarrage(input, createRng('b')));
  });

  it('ne se termine jamais par un match nul', () => {
    for (let i = 0; i < 300; i++) {
      const res = resolveBarrage(
        {
          top14ClubId: 'club_13' as ClubId,
          top14Strength: 55,
          challenger: generateProD2Contenders(2026)[1]!,
        },
        createRng(`draw_${i}`),
      );
      expect(res.top14Score).not.toBe(res.challengerScore);
    }
  });

  it('le club de Top 14 est favori mais pas à l\'abri', () => {
    let survived = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const res = resolveBarrage(
        {
          top14ClubId: 'club_13' as ClubId,
          top14Strength: 55,
          challenger: generateProD2Contenders(2026)[1]!,
        },
        createRng(`fav_${i}`),
      );
      if (res.top14Survives) survived++;
    }
    const rate = survived / n;
    expect(rate).toBeGreaterThan(0.55);   // favori
    expect(rate).toBeLessThan(0.95);      // mais le match fait peur
  });

  it('un club de Top 14 très faible perd plus souvent', () => {
    const rate = (strength: number) => {
      let survived = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        const res = resolveBarrage(
          {
            top14ClubId: 'club_13' as ClubId,
            top14Strength: strength,
            challenger: generateProD2Contenders(2026)[1]!,
          },
          createRng(`w_${i}`),
        );
        if (res.top14Survives) survived++;
      }
      return survived / n;
    };
    expect(rate(45)).toBeLessThan(rate(70));
  });
});

describe('résolution de fin de saison', () => {
  const strengthByClub = () => 55;

  it('relègue le dernier et promeut le champion de Pro D2', () => {
    const res = resolveRelegation(
      { rankedStandings: standingsOf(), season: 2026, strengthByClub },
      createRng('r'),
    );
    expect(res.relegated).toContain('club_14');
    expect(res.promoted.length).toBeGreaterThanOrEqual(1);
  });

  it('promeut toujours autant de clubs qu\'il en relègue', () => {
    for (let i = 0; i < 50; i++) {
      const res = resolveRelegation(
        { rankedStandings: standingsOf(), season: 2026 + i, strengthByClub },
        createRng(`bal_${i}`),
      );
      expect(res.promoted.length).toBe(res.relegated.length);
    }
  });

  it('joue systématiquement le barrage du treizième', () => {
    const res = resolveRelegation(
      { rankedStandings: standingsOf(), season: 2026, strengthByClub },
      createRng('bar'),
    );
    expect(res.barrage).toBeDefined();
    expect(res.barrage!.top14ClubId).toBe('club_13');
  });

  it('le treizième descend s\'il perd son barrage', () => {
    // On cherche une graine où le barrage est perdu.
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const res = resolveRelegation(
        { rankedStandings: standingsOf(), season: 2026, strengthByClub: () => 40 },
        createRng(`lose_${i}`),
      );
      if (res.barrage && !res.barrage.top14Survives) {
        expect(res.relegated).toContain('club_13');
        expect(res.relegated).toHaveLength(2);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('ne fait rien sur un classement incomplet', () => {
    const res = resolveRelegation(
      { rankedStandings: standingsOf(6), season: 2026, strengthByClub },
      createRng('short'),
    );
    expect(res.relegated).toHaveLength(0);
    expect(res.promoted).toHaveLength(0);
  });
});
