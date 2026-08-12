/**
 * Échelonnement des fins de contrat — V0.31.
 *
 * Régression contre la falaise : tous les contrats du seed s'achevaient la même
 * année. Les clubs IA encaissaient grâce à leur prolongation automatique, mais
 * l'effectif de l'utilisateur — qui renouvelle à la main — perdait 26 points de
 * moyenne en une seule intersaison.
 */

import { describe, expect, it } from 'vitest';
import { expandPlayer, type PlayerCompactRow } from '../../src/data/seed.js';
import type { Position } from '../../src/engine/types.js';

const SEED_SEASON = 2025;

const NOMS = [
  'Baille', 'Marchand', 'Aldegheri', 'Meafou', 'Flament', 'Cros', 'Jelonch',
  'Roumat', 'Dupont', 'Ntamack', 'Lebel', 'Barassi', 'Ahki', 'Mallia', 'Ramos',
  'Bielle', 'Moefana', 'Depoortere', 'Penaud', 'Jalibert', 'Lucu', 'Poirot',
  'Bourgarit', 'Alldritt', 'Botia', 'Dulin', 'Danty', 'Atonio', 'Skelton',
];

function row(lastName: string, birthYear: number, i: number): PlayerCompactRow {
  return {
    clubId: `club${i % 14}`,
    firstName: 'Test',
    lastName,
    position: 'CENTRE_INTERIEUR' as Position,
    birthYear,
    niveau: 70,
    isJiff: true,
  };
}

/** Échantillon d'âges réalistes, reproductible. */
function cohorte(): PlayerCompactRow[] {
  const out: PlayerCompactRow[] = [];
  for (let i = 0; i < NOMS.length * 6; i++) {
    const age = 20 + (i * 7) % 17;              // 20 à 36 ans
    out.push(row(`${NOMS[i % NOMS.length]}${Math.floor(i / NOMS.length)}`, SEED_SEASON - age, i));
  }
  return out;
}

describe('fins de contrat du seed', () => {
  const players = cohorte().map(expandPlayer);

  it('répartit les échéances sur plusieurs saisons', () => {
    const parSaison = new Map<number, number>();
    for (const p of players) {
      parSaison.set(p.contract.endSeason, (parSaison.get(p.contract.endSeason) ?? 0) + 1);
    }

    expect(parSaison.size).toBeGreaterThanOrEqual(4);

    // Aucune saison ne doit concentrer plus de la moitié des contrats : c'est
    // exactement ce qui rendait l'intersaison ingérable.
    const pire = Math.max(...parSaison.values());
    expect(pire).toBeLessThan(players.length * 0.5);
  });

  it('n\'engage personne au-delà d\'un âge déraisonnable', () => {
    for (const p of players) {
      const ageALaFin = p.contract.endSeason - Number(p.birthDate.slice(0, 4));
      expect(ageALaFin).toBeLessThanOrEqual(37);
    }
  });

  it('donne toujours au moins une saison de contrat', () => {
    for (const p of players) {
      expect(p.contract.endSeason).toBeGreaterThan(SEED_SEASON);
    }
  });

  it('est déterministe : deux chargements donnent les mêmes échéances', () => {
    const encore = cohorte().map(expandPlayer);
    expect(encore.map(p => p.contract.endSeason)).toEqual(players.map(p => p.contract.endSeason));
  });

  it('un joueur donné garde son échéance quel que soit son niveau', () => {
    const base = row('Dupont', 1996, 0);
    const fort = expandPlayer({ ...base, niveau: 95 });
    const faible = expandPlayer({ ...base, niveau: 45 });
    expect(fort.contract.endSeason).toBe(faible.contract.endSeason);
  });
});
