/**
 * Marché des techniciens — V0.44.
 *
 * Ce que le module doit garantir : **l'argent ne suffit pas**. Sans filtre sur
 * la stature du club, il suffirait d'avoir de la trésorerie pour rafler les
 * meilleurs, et un promu de Pro D2 s'offrirait le staff de Toulouse dès son
 * premier été.
 */

import { describe, expect, it } from 'vitest';
import {
  HIRABLE_ROLES,
  attractiveness,
  evaluateHire,
  generateStaffMarket,
  hireInto,
  isHirable,
  severanceFor,
  staffPayroll,
  type StaffCandidate,
} from '../../src/engine/club/staff-market.js';
import { generateStaffForClub, staffSalaryFor } from '../../src/engine/club/staff.js';
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

const GROS = club('gros', 'GROS_BUDGET', 92);
const PETIT = club('petit', 'PETIT_BUDGET', 30);
const rep = (score: number, titles = 0): ManagerReputation =>
  ({ score, titlesWon: titles, seasonsManaged: 4 });

const MARKET = generateStaffMarket({ season: 2026, seed: 'x' });

function candidate(over: Partial<StaffCandidate> = {}): StaffCandidate {
  const base = MARKET[0]!;
  return { ...base, ...over };
}

describe('le vivier', () => {
  it('ne propose que des postes qui se recrutent', () => {
    // Le président ne s'embauche pas, et l'entraîneur principal, c'est vous.
    expect(MARKET.every(c => isHirable(c.role))).toBe(true);
    expect(isHirable('PRESIDENT')).toBe(false);
    expect(isHirable('ENTRAINEUR_CHEF')).toBe(false);
    expect(HIRABLE_ROLES).not.toContain('PRESIDENT');
  });

  it('est déterministe pour une même saison', () => {
    expect(generateStaffMarket({ season: 2026, seed: 'x' })).toEqual(MARKET);
  });

  it('se renouvelle d\'une saison à l\'autre', () => {
    // Un marché figé ferait du recrutement une décision unique, prise une fois
    // pour toutes en début de carrière.
    const next = generateStaffMarket({ season: 2027, seed: 'x' });
    expect(next.map(c => c.id)).not.toEqual(MARKET.map(c => c.id));
  });

  it('mélange les niveaux', () => {
    // Sans médiocres, le marché n'offrirait pas un choix mais une échelle de prix.
    const qualities = MARKET.map(c => c.quality);
    expect(Math.max(...qualities) - Math.min(...qualities)).toBeGreaterThan(15);
  });

  it('classe du meilleur au moins bon', () => {
    for (let i = 1; i < MARKET.length; i++) {
      expect(MARKET[i - 1]!.quality).toBeGreaterThanOrEqual(MARKET[i]!.quality);
    }
  });
});

describe('la décision du candidat', () => {
  it('refuse un salaire en dessous de ses prétentions', () => {
    const c = candidate({ quality: 60, askingSalary: 200_000, expectation: 0 });
    const out = evaluateHire(c, GROS, rep(60), 150_000);
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe('SALAIRE_INSUFFISANT');
  });

  it('refuse un club trop petit, même payé au prix fort', () => {
    // C'est la garantie centrale : l'argent seul n'ouvre pas toutes les portes.
    const c = candidate({ quality: 90, askingSalary: 100_000, expectation: 85 });
    const out = evaluateHire(c, PETIT, rep(20), 100_000);
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe('CLUB_TROP_PETIT');
  });

  it('laisse un manager reconnu compenser la modestie de son club', () => {
    // C'est ce qui permet de bâtir : une gloire descendue en Pro D2 attire un
    // encadrement que le club seul n'obtiendrait jamais.
    const c = candidate({ quality: 75, askingSalary: 100_000, expectation: 45 });
    expect(evaluateHire(c, PETIT, rep(20), 100_000).accepted).toBe(false);
    expect(evaluateHire(c, PETIT, rep(95, 3), 100_000).accepted).toBe(true);
  });

  it('dit toujours pourquoi il refuse', () => {
    for (const c of MARKET) {
      const out = evaluateHire(c, PETIT, rep(10), 0);
      if (!out.accepted) expect(out.message.length).toBeGreaterThan(0);
    }
  });

  it('rend un gros club plus attirant qu\'un petit', () => {
    expect(attractiveness(GROS, rep(50))).toBeGreaterThan(attractiveness(PETIT, rep(50)));
  });
});

describe('composition du staff', () => {
  const staff = generateStaffForClub(GROS);

  it('remplace le titulaire du poste au lieu d\'empiler', () => {
    // Un club n'a qu'un adjoint avants : un organigramme à deux médecins ne
    // voudrait plus rien dire pour le calcul d'encadrement.
    const c = candidate({ role: 'MEDECIN', quality: 88 });
    const next = hireInto(staff, c, 'gros');
    expect(next.filter(m => m.role === 'MEDECIN')).toHaveLength(1);
    expect(next.find(m => m.role === 'MEDECIN')!.quality).toBe(88);
    expect(next).toHaveLength(staff.length);
  });

  it('conserve les autres postes intacts', () => {
    const next = hireInto(staff, candidate({ role: 'MEDECIN' }), 'gros');
    const before = staff.filter(m => m.role !== 'MEDECIN').map(m => m.id).sort();
    const after = next.filter(m => m.role !== 'MEDECIN').map(m => m.id).sort();
    expect(after).toEqual(before);
  });

  it('additionne la masse salariale', () => {
    expect(staffPayroll(staff)).toBe(staff.reduce((s, m) => s + m.salary, 0));
  });

  it('fait payer le départ du sortant', () => {
    // Sans indemnité, on renverrait tout l'encadrement chaque été pour repartir
    // du marché : la continuité n'aurait aucune valeur.
    const member = staff[0]!;
    expect(severanceFor(member)).toBeGreaterThan(0);
    expect(severanceFor(member)).toBeLessThan(member.salary);
  });

  it('aligne le prix demandé sur la grille des salaires', () => {
    for (const c of MARKET) expect(c.askingSalary).toBe(staffSalaryFor(c.quality));
  });
});
