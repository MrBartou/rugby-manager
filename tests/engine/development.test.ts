/**
 * Tests du développement des joueurs — V0.14.
 *
 * L'enjeu : avant ce module, rien de ce que faisait le manager ne changeait un
 * joueur. Ces tests vérifient que les cinq leviers agissent réellement, et que le
 * plus important d'entre eux — **le temps de jeu** — domine les autres.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import {
  AVERAGE_COACHING,
  DEFAULT_TRAINING_FOCUS,
  developPlayer,
  developSquad,
  playingTimeFactor,
  approximateOverall,
  type CoachingQuality,
  type TrainingFocus,
} from '../../src/engine/club/development.js';
import { coachingQualityFromStaff, generateStaffForClub, staffSalaryFor } from '../../src/engine/club/staff.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player } from '../../src/engine/types.js';

// =============================================================================
// Helpers
// =============================================================================

function basePlayer(overrides: Partial<Player> = {}): Player {
  const { players } = makeSquad('club_home' as ClubId, 55);
  const p = players.find(x => x.position === 'CENTRE_INTERIEUR')!;
  return { ...p, ...overrides };
}

/** Fabrique un joueur d'un âge donné (la date de naissance porte l'âge). */
function aged(age: number, seasonStart = 2026, overrides: Partial<Player> = {}): Player {
  return basePlayer({ birthDate: `${seasonStart - age}-01-01`, ...overrides });
}

/**
 * Fait évoluer un joueur N fois avec des graines différentes et renvoie la
 * variation moyenne d'overall. Le modèle est probabiliste : une exécution isolée
 * ne prouve rien.
 */
function meanGrowth(
  player: Player,
  opts: { minutes: number; focus?: TrainingFocus; coaching?: CoachingQuality; runs?: number },
): number {
  const runs = opts.runs ?? 60;
  let total = 0;
  for (let i = 0; i < runs; i++) {
    const before = approximateOverall(player);
    const { player: after } = developPlayer(
      {
        player,
        newSeason: 2026,
        minutesPlayed: opts.minutes,
        focus: opts.focus ?? DEFAULT_TRAINING_FOCUS,
        coaching: opts.coaching ?? AVERAGE_COACHING,
      },
      createRng(`dev_${i}`),
    );
    total += approximateOverall(after) - before;
  }
  return total / runs;
}

// =============================================================================
// Temps de jeu — le levier central
// =============================================================================

describe('temps de jeu', () => {
  it('un joueur qui ne joue pas progresse beaucoup moins qu\'un titulaire', () => {
    const jeune = aged(20, 2026, { hidden: { ...basePlayer().hidden, potentiel: 90 } });
    const banc = meanGrowth(jeune, { minutes: 0 });
    const titulaire = meanGrowth(jeune, { minutes: 2000 });

    expect(titulaire).toBeGreaterThan(banc * 2);
  });

  it('le facteur de temps de jeu est monotone croissant', () => {
    const paliers = [0, 200, 500, 900, 1500, 2200].map(playingTimeFactor);
    for (let i = 1; i < paliers.length; i++) {
      expect(paliers[i]!).toBeGreaterThan(paliers[i - 1]!);
    }
  });

  it('reste le levier dominant face à un mauvais staff', () => {
    const jeune = aged(20, 2026, { hidden: { ...basePlayer().hidden, potentiel: 90 } });
    const faibleStaffMaisJoue = meanGrowth(jeune, {
      minutes: 2000,
      coaching: { physique: 25, technique: 25, mental: 25, formation: 25 },
    });
    const bonStaffMaisNeJouePas = meanGrowth(jeune, {
      minutes: 0,
      coaching: { physique: 95, technique: 95, mental: 95, formation: 95 },
    });

    expect(faibleStaffMaisJoue).toBeGreaterThan(bonStaffMaisNeJouePas);
  });
});

// =============================================================================
// Âge et potentiel
// =============================================================================

describe('courbe d\'âge', () => {
  it('un jeune progresse, un trentenaire décline', () => {
    const jeune = aged(19, 2026, { hidden: { ...basePlayer().hidden, potentiel: 90 } });
    const vieux = aged(34);

    expect(meanGrowth(jeune, { minutes: 1800 })).toBeGreaterThan(0);
    expect(meanGrowth(vieux, { minutes: 1800 })).toBeLessThan(0);
  });

  it('le déclin s\'accentue avec l\'âge', () => {
    const a32 = meanGrowth(aged(32), { minutes: 1500 });
    const a36 = meanGrowth(aged(36), { minutes: 1500 });
    expect(a36).toBeLessThan(a32);
  });

  it('le potentiel plafonne la progression', () => {
    const bride = aged(20, 2026, { hidden: { ...basePlayer().hidden, potentiel: 56 } });
    const libre = aged(20, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });
    expect(meanGrowth(libre, { minutes: 2000 })).toBeGreaterThan(meanGrowth(bride, { minutes: 2000 }));
  });

  it('ne dépasse jamais le potentiel sur les attributs entraînés', () => {
    const player = aged(19, 2026, { hidden: { ...basePlayer().hidden, potentiel: 60 } });
    let current = player;
    for (let season = 0; season < 8; season++) {
      current = developPlayer(
        { player: current, newSeason: 2026 + season, minutesPlayed: 2000, focus: 'PHYSIQUE', coaching: AVERAGE_COACHING },
        createRng(`cap_${season}`),
      ).player;
    }
    // Le physique est le domaine travaillé : il ne doit pas franchir le plafond.
    for (const v of Object.values(current.physical)) {
      expect(v).toBeLessThanOrEqual(60);
    }
  });
});

// =============================================================================
// Focus d'entraînement
// =============================================================================

describe('focus d\'entraînement', () => {
  const jeune = () => aged(21, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });

  function domainGain(focus: TrainingFocus, domain: 'physical' | 'technical' | 'mental'): number {
    let total = 0;
    const runs = 60;
    for (let i = 0; i < runs; i++) {
      const p = jeune();
      const after = developPlayer(
        { player: p, newSeason: 2026, minutesPlayed: 1800, focus, coaching: AVERAGE_COACHING },
        createRng(`focus_${i}`),
      ).player;
      const before = Object.values(p[domain]).reduce((a, b) => a + b, 0);
      const now = Object.values(after[domain]).reduce((a, b) => a + b, 0);
      total += now - before;
    }
    return total / runs;
  }

  it('le focus physique développe surtout le physique', () => {
    expect(domainGain('PHYSIQUE', 'physical')).toBeGreaterThan(domainGain('TECHNIQUE', 'physical'));
  });

  it('le focus technique développe surtout la technique', () => {
    expect(domainGain('TECHNIQUE', 'technical')).toBeGreaterThan(domainGain('PHYSIQUE', 'technical'));
  });

  it('le focus mental développe surtout le mental', () => {
    expect(domainGain('MENTAL', 'mental')).toBeGreaterThan(domainGain('PHYSIQUE', 'mental'));
  });

  it('la récupération sacrifie la progression', () => {
    const p = jeune();
    expect(meanGrowth(p, { minutes: 1800, focus: 'RECUPERATION' }))
      .toBeLessThan(meanGrowth(p, { minutes: 1800, focus: 'EQUILIBRE' }));
  });

  it('le focus poste développe les compétences spécifiques', () => {
    const ailier = basePlayer({
      position: 'AILIER_DROIT',
      birthDate: '2005-01-01',
      positionSpecific: { finition: 50, jeuAerien: 50 },
      hidden: { ...basePlayer().hidden, potentiel: 92 },
    });
    let gains = 0;
    for (let i = 0; i < 60; i++) {
      const after = developPlayer(
        { player: ailier, newSeason: 2026, minutesPlayed: 1800, focus: 'POSTE', coaching: AVERAGE_COACHING },
        createRng(`pos_${i}`),
      ).player;
      gains += (after.positionSpecific.finition ?? 0) - 50;
    }
    expect(gains).toBeGreaterThan(0);
  });

  it('le travail physique ralentit le déclin d\'un vétéran', () => {
    const veteran = aged(33);
    const avec = meanGrowth(veteran, { minutes: 1500, focus: 'PHYSIQUE' });
    const sans = meanGrowth(veteran, { minutes: 1500, focus: 'TECHNIQUE' });
    expect(avec).toBeGreaterThan(sans);
  });

  it('le mental continue de progresser même chez un joueur en déclin', () => {
    const veteran = aged(34);
    let mentalGain = 0;
    for (let i = 0; i < 60; i++) {
      const after = developPlayer(
        { player: veteran, newSeason: 2026, minutesPlayed: 1500, focus: 'MENTAL', coaching: AVERAGE_COACHING },
        createRng(`vet_${i}`),
      ).player;
      mentalGain += Object.values(after.mental).reduce((a, b) => a + b, 0)
        - Object.values(veteran.mental).reduce((a, b) => a + b, 0);
    }
    expect(mentalGain).toBeGreaterThan(0);
  });
});

// =============================================================================
// Joueur et staff
// =============================================================================

describe('professionnalisme et encadrement', () => {
  it('un joueur professionnel tire davantage de son entraînement', () => {
    const base = aged(21, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });
    const serieux = { ...base, mental: { ...base.mental, professionnalisme: 95 } };
    const dilettante = { ...base, mental: { ...base.mental, professionnalisme: 20 } };

    expect(meanGrowth(serieux, { minutes: 1800 })).toBeGreaterThan(meanGrowth(dilettante, { minutes: 1800 }));
  });

  it('un meilleur staff accélère la progression', () => {
    const jeune = aged(21, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });
    const bon = meanGrowth(jeune, {
      minutes: 1800, focus: 'PHYSIQUE',
      coaching: { physique: 95, technique: 50, mental: 50, formation: 50 },
    });
    const mauvais = meanGrowth(jeune, {
      minutes: 1800, focus: 'PHYSIQUE',
      coaching: { physique: 20, technique: 50, mental: 50, formation: 50 },
    });
    expect(bon).toBeGreaterThan(mauvais);
  });

  it('seul le staff du domaine travaillé compte', () => {
    const jeune = aged(21, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });
    // On travaille le physique : améliorer le staff mental ne doit rien changer.
    const a = meanGrowth(jeune, {
      minutes: 1800, focus: 'PHYSIQUE',
      coaching: { physique: 60, technique: 50, mental: 20, formation: 50 },
    });
    const b = meanGrowth(jeune, {
      minutes: 1800, focus: 'PHYSIQUE',
      coaching: { physique: 60, technique: 50, mental: 95, formation: 50 },
    });
    expect(Math.abs(a - b)).toBeLessThan(0.35);
  });

  it('le centre de formation n\'aide que les jeunes', () => {
    const bonneFormation: CoachingQuality = { physique: 55, technique: 55, mental: 55, formation: 95 };
    const mauvaiseFormation: CoachingQuality = { physique: 55, technique: 55, mental: 55, formation: 20 };

    const jeune = aged(20, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });
    expect(meanGrowth(jeune, { minutes: 1800, coaching: bonneFormation }))
      .toBeGreaterThan(meanGrowth(jeune, { minutes: 1800, coaching: mauvaiseFormation }));

    const confirme = aged(27, 2026, { hidden: { ...basePlayer().hidden, potentiel: 92 } });
    expect(Math.abs(
      meanGrowth(confirme, { minutes: 1800, coaching: bonneFormation })
      - meanGrowth(confirme, { minutes: 1800, coaching: mauvaiseFormation }),
    )).toBeLessThan(0.3);
  });
});

// =============================================================================
// Rapports
// =============================================================================

describe('rapport de progression', () => {
  it('explique pourquoi un joueur n\'a pas progressé', () => {
    const jeune = aged(20);
    const { report } = developPlayer(
      { player: jeune, newSeason: 2026, minutesPlayed: 0, focus: 'EQUILIBRE', coaching: AVERAGE_COACHING },
      createRng('r1'),
    );
    expect(report.reasons.join(' ')).toMatch(/n'a pas joué/i);
  });

  it('mentionne le déclin pour un vétéran', () => {
    const { report } = developPlayer(
      { player: aged(35), newSeason: 2026, minutesPlayed: 1500, focus: 'EQUILIBRE', coaching: AVERAGE_COACHING },
      createRng('r2'),
    );
    expect(report.reasons.join(' ')).toMatch(/décline/i);
  });

  it('liste chaque attribut modifié avec ses valeurs avant/après', () => {
    const jeune = aged(19, 2026, { hidden: { ...basePlayer().hidden, potentiel: 95 } });
    const { report } = developPlayer(
      { player: jeune, newSeason: 2026, minutesPlayed: 2000, focus: 'PHYSIQUE', coaching: AVERAGE_COACHING },
      createRng('r3'),
    );
    expect(report.changes.length).toBeGreaterThan(0);
    for (const c of report.changes) {
      expect(c.after).not.toBe(c.before);
      expect(c.label.length).toBeGreaterThan(2);
    }
  });

  it('un joueur retraité n\'évolue pas', () => {
    const { player, report } = developPlayer(
      { player: basePlayer({ retired: true }), newSeason: 2026, minutesPlayed: 0, focus: 'EQUILIBRE', coaching: AVERAGE_COACHING },
      createRng('r4'),
    );
    expect(report.changes).toHaveLength(0);
    expect(player.technical).toEqual(basePlayer({ retired: true }).technical);
  });
});

// =============================================================================
// Effectif complet
// =============================================================================

describe('développement d\'un effectif', () => {
  it('est déterministe pour une même graine', () => {
    const { players } = makeSquad('club_home' as ClubId, 60);
    const input = {
      players,
      newSeason: 2026,
      seed: 'x',
      minutesByPlayer: new Map(players.map(p => [p.id, 1500])),
      focusByPlayer: new Map(players.map(p => [p.id, 'EQUILIBRE' as TrainingFocus])),
      coachingByClub: new Map(),
    };
    expect(developSquad(input).players).toEqual(developSquad(input).players);
  });

  it('ne produit un rapport que pour les joueurs ayant évolué', () => {
    const { players } = makeSquad('club_home' as ClubId, 60);
    const result = developSquad({
      players,
      newSeason: 2026,
      seed: 'y',
      minutesByPlayer: new Map(players.map(p => [p.id, 1800])),
      focusByPlayer: new Map(),
      coachingByClub: new Map(),
    });
    for (const r of result.reports) expect(r.changes.length).toBeGreaterThan(0);
    expect(result.players).toHaveLength(players.length);
  });
});

// =============================================================================
// Staff
// =============================================================================

describe('staff', () => {
  function club(reputation: number): Club {
    return {
      id: `c_${reputation}` as ClubId,
      name: 'Club', shortName: 'CLB', city: 'Ville',
      tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
      stadiumCapacity: 15_000, annualBudget: 20_000_000,
      salaryCapUsage: 0, jiffCount: 0, reputation,
    };
  }

  it('un club réputé attire un meilleur encadrement', () => {
    const gros = coachingQualityFromStaff(generateStaffForClub(club(95)));
    const petit = coachingQualityFromStaff(generateStaffForClub(club(30)));
    expect(gros.technique).toBeGreaterThan(petit.technique);
    expect(gros.physique).toBeGreaterThan(petit.physique);
  });

  it('la génération est déterministe', () => {
    expect(generateStaffForClub(club(60))).toEqual(generateStaffForClub(club(60)));
  });

  it('couvre tous les domaines de développement', () => {
    const q = coachingQualityFromStaff(generateStaffForClub(club(60)));
    for (const v of [q.physique, q.technique, q.mental, q.formation]) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('un staff vide donne un encadrement médiocre, pas zéro', () => {
    const q = coachingQualityFromStaff([]);
    expect(q.technique).toBeGreaterThan(20);
    expect(q.technique).toBeLessThan(50);
  });

  it('le salaire croît avec la compétence', () => {
    expect(staffSalaryFor(90)).toBeGreaterThan(staffSalaryFor(60));
    expect(staffSalaryFor(60)).toBeGreaterThan(staffSalaryFor(30));
  });
});
