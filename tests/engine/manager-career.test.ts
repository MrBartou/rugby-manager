/**
 * Carrière du manager — V0.41.
 *
 * La propriété qui porte tout le module : **la carrière ne se termine jamais**.
 * Un limogeage doit rendre libre, et un manager libre doit toujours pouvoir
 * rebondir — sans quoi le jeu retombe dans l'écran-titre qu'on vient de
 * supprimer.
 */

import { describe, expect, it } from 'vitest';
import {
  applyBoardVerdict,
  clubStature,
  idleReputationDecay,
  jobOffersFor,
  midSeasonSackings,
  sackedCoaches,
  type ManagerStatus,
} from '../../src/engine/season/manager-career.js';
import { createRng } from '../../src/engine/rng.js';
import type { Club, ClubId } from '../../src/engine/types.js';
import type { ManagerReputation } from '../../src/engine/season/manager-reputation.js';

function club(id: string, tier: Club['tier'], reputation: number): Club {
  return {
    id: id as ClubId, name: `Club ${id}`, shortName: id.toUpperCase(), city: 'Ville',
    tier, tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation,
  };
}

const CLUBS: readonly Club[] = [
  club('gros', 'GROS_BUDGET', 92),
  club('moyen', 'BUDGET_MOYEN', 60),
  club('petit', 'PETIT_BUDGET', 30),
];

const rep = (score: number): ManagerReputation => ({ score, titlesWon: 0, seasonsManaged: 4 });
const LIBRE: ManagerStatus = { kind: 'LIBRE', since: 2027, reason: 'LIMOGE' };

describe('stature d\'un club', () => {
  it('classe les clubs du plus au moins exigeant', () => {
    expect(clubStature(CLUBS[0]!)).toBeGreaterThan(clubStature(CLUBS[1]!));
    expect(clubStature(CLUBS[1]!)).toBeGreaterThan(clubStature(CLUBS[2]!));
  });

  it('tient compte de l\'histoire autant que du budget', () => {
    // Un club historique désargenté reste plus exigeant qu'un petit club sans passé.
    const historique = club('h', 'PETIT_BUDGET', 85);
    const anonyme = club('a', 'PETIT_BUDGET', 25);
    expect(clubStature(historique)).toBeGreaterThan(clubStature(anonyme));
  });
});

describe('limogeages dans le championnat', () => {
  const ranks = new Map<ClubId, number>([
    ['gros' as ClubId, 13],    // catastrophique pour ce club
    ['moyen' as ClubId, 8],    // dans les clous
    ['petit' as ClubId, 12],   // maintien assuré
  ]);

  it('sanctionne l\'échec au regard de la stature du club', () => {
    // Sur plusieurs tirages, le gros club en échec doit sauter bien plus souvent.
    let gros = 0, petit = 0;
    for (let i = 0; i < 60; i++) {
      const s = sackedCoaches(CLUBS, ranks, 'moyen' as ClubId, createRng(`s${i}`));
      if (s.some(x => x.clubId === 'gros')) gros++;
      if (s.some(x => x.clubId === 'petit')) petit++;
    }
    expect(gros).toBeGreaterThan(petit * 2);
  });

  it('libère malgré tout des postes à tous les étages', () => {
    // Sans rotation de fond, les seuls postes vacants seraient ceux des gros
    // clubs, et un manager modeste ne recevrait plus jamais d'offre.
    let petitLibre = 0;
    for (let i = 0; i < 80; i++) {
      const s = sackedCoaches(CLUBS, ranks, 'gros' as ClubId, createRng(`c${i}`));
      if (s.some(x => x.clubId === 'petit')) petitLibre++;
    }
    expect(petitLibre).toBeGreaterThan(0);
  });

  it('ne limoge jamais l\'entraîneur du club de l\'utilisateur', () => {
    for (let i = 0; i < 30; i++) {
      const s = sackedCoaches(CLUBS, ranks, 'gros' as ClubId, createRng(`p${i}`));
      expect(s.some(x => x.clubId === 'gros')).toBe(false);
    }
  });

  it('est déterministe pour une même graine', () => {
    expect(sackedCoaches(CLUBS, ranks, 'moyen' as ClubId, createRng('k')))
      .toEqual(sackedCoaches(CLUBS, ranks, 'moyen' as ClubId, createRng('k')));
  });
});

describe('offres reçues', () => {
  const all = CLUBS.map(c => c.id);

  it('un club hors de portée n\'appelle pas', () => {
    const offers = jobOffersFor({
      clubs: CLUBS, vacancies: ['gros' as ClubId], reputation: rep(20), status: LIBRE,
    });
    // Le filet de rebond peut proposer le poste faute d'autre option ; ce qu'on
    // vérifie, c'est qu'un débutant n'y accède pas *par sa réputation*.
    expect(offers.every(o => o.pitch.includes('pas d\'autre option'))).toBe(true);
  });

  it('un manager reconnu reçoit les postes à sa mesure', () => {
    const offers = jobOffersFor({
      clubs: CLUBS, vacancies: all, reputation: rep(75), status: LIBRE,
    });
    expect(offers.some(o => o.clubId === 'gros')).toBe(true);
  });

  it('une icône ne redescend pas trop bas', () => {
    const offers = jobOffersFor({
      clubs: CLUBS, vacancies: all, reputation: rep(95), status: LIBRE,
    });
    expect(offers.some(o => o.clubId === 'petit')).toBe(false);
  });

  it('un manager en poste n\'est approché que par plus gros', () => {
    const offers = jobOffersFor({
      clubs: CLUBS,
      vacancies: all,
      reputation: rep(75),
      status: { kind: 'EN_POSTE', clubId: 'moyen' as ClubId },
    });
    // Recevoir une offre d'un club plus modeste que le sien n'aurait aucun sens.
    for (const o of offers) {
      expect(o.stature).toBeGreaterThan(clubStature(CLUBS[1]!));
    }
  });

  it('classe les offres du plus prestigieux au moins', () => {
    const offers = jobOffersFor({
      clubs: CLUBS, vacancies: all, reputation: rep(70), status: LIBRE,
    });
    for (let i = 1; i < offers.length; i++) {
      expect(offers[i - 1]!.stature).toBeGreaterThanOrEqual(offers[i]!.stature);
    }
  });

  it('un manager libre reçoit toujours au moins une porte de sortie', () => {
    // C'est la garantie centrale du module : la carrière ne se termine jamais.
    for (const score of [0, 10, 30, 55, 80, 100]) {
      const offers = jobOffersFor({
        clubs: CLUBS, vacancies: all, reputation: rep(score), status: LIBRE,
      });
      expect(offers.length).toBeGreaterThan(0);
    }
  });

  it('adapte l\'objectif annoncé à la réputation du manager', () => {
    const débutant = jobOffersFor({
      clubs: CLUBS, vacancies: ['moyen' as ClubId], reputation: rep(30), status: LIBRE,
    })[0]!;
    const reconnu = jobOffersFor({
      clubs: CLUBS, vacancies: ['moyen' as ClubId], reputation: rep(75), status: LIBRE,
    })[0]!;
    expect(reconnu.objective.targetRank).toBeLessThan(débutant.objective.targetRank);
  });
});

describe('sort du manager', () => {
  it('un limogeage rend libre au lieu de terminer la carrière', () => {
    const verdict = applyBoardVerdict(
      { kind: 'EN_POSTE', clubId: 'moyen' as ClubId }, true, 2028, 'Club moyen', 2,
    );
    expect(verdict.status.kind).toBe('LIBRE');
    expect(verdict.notice).toMatch(/sans club/i);
  });

  it('ne change rien quand le board renouvelle sa confiance', () => {
    const status: ManagerStatus = { kind: 'EN_POSTE', clubId: 'moyen' as ClubId };
    const verdict = applyBoardVerdict(status, false, 2028, 'Club moyen', 0);
    expect(verdict.status).toBe(status);
    expect(verdict.notice).toBeUndefined();
  });

  it('une saison sans club érode la réputation', () => {
    // Sans cela, on pourrait décliner toutes les offres modestes en attendant
    // indéfiniment que le meilleur club appelle.
    expect(idleReputationDecay(rep(50)).score).toBeLessThan(50);
    expect(idleReputationDecay(rep(2)).score).toBeGreaterThanOrEqual(0);
  });
});

describe('limogeages en cours de saison — V0.43', () => {
  const ranks = new Map<ClubId, number>([
    ['gros' as ClubId, 13],    // naufrage installé pour ce club
    ['moyen' as ClubId, 8],
    ['petit' as ClubId, 12],
  ]);

  it('ne se déclenche pas hors de la fenêtre', () => {
    // Trop tôt, l'échantillon ne veut rien dire ; trop tard, on finit la saison
    // avec l'intérimaire.
    for (const round of [1, 7, 21, 26]) {
      expect(midSeasonSackings(CLUBS, ranks, round, createRng(`w${round}`))).toEqual([]);
    }
  });

  it('exige un naufrage franc, pas un mauvais mois', () => {
    // « moyen » est 8e pour un objectif à 10 : personne ne bouge.
    let touched = 0;
    for (let i = 0; i < 80; i++) {
      const s = midSeasonSackings(CLUBS, ranks, 14, createRng(`m${i}`));
      if (s.some(x => x.clubId === 'moyen' || x.clubId === 'petit')) touched++;
    }
    expect(touched).toBe(0);
  });

  it('finit par libérer le banc d\'un club en perdition', () => {
    // Sans cela, l'année sabbatique n'aurait aucune issue avant l'été.
    let sacked = 0;
    for (let i = 0; i < 80; i++) {
      const s = midSeasonSackings(CLUBS, ranks, 14, createRng(`g${i}`));
      if (s.some(x => x.clubId === 'gros')) sacked++;
    }
    expect(sacked).toBeGreaterThan(0);
    expect(sacked).toBeLessThan(80);      // jamais automatique
  });

  it('reste plus rare qu\'un limogeage de fin de saison', () => {
    const compte = (fn: () => readonly { clubId: ClubId }[]) => {
      let n = 0;
      for (let i = 0; i < 120; i++) if (fn().some(x => x.clubId === 'gros')) n++;
      return n;
    };
    let i = 0;
    const midi = compte(() => midSeasonSackings(CLUBS, ranks, 14, createRng(`x${i++}`)));
    let j = 0;
    const fin = compte(() => sackedCoaches(CLUBS, ranks, 'moyen' as ClubId, createRng(`y${j++}`)));
    expect(midi).toBeLessThan(fin);
  });

  it('est déterministe pour une même graine', () => {
    expect(midSeasonSackings(CLUBS, ranks, 14, createRng('k')))
      .toEqual(midSeasonSackings(CLUBS, ranks, 14, createRng('k')));
  });
});
