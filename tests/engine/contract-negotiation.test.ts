/**
 * Négociation de contrat — V0.43.
 *
 * La propriété qui porte le module : **aucune demande n'est gratuite**. Si l'on
 * pouvait tout obtenir, ou si un terme ne coûtait rien, la négociation ne serait
 * qu'un menu d'options et le joueur cocherait le maximum sans réfléchir.
 */

import { describe, expect, it } from 'vitest';
import {
  DURATION_OPTIONS,
  MODEST_DEMANDS,
  contractExpired,
  contractSummary,
  defaultContract,
  negotiate,
  negotiationCredit,
  objectiveWithSalary,
  patienceFor,
  salaryFor,
  signContract,
  transferBudgetFor,
  type Demands,
} from '../../src/engine/season/contract-negotiation.js';
import type { Club, ClubId } from '../../src/engine/types.js';
import type { ManagerReputation } from '../../src/engine/season/manager-reputation.js';
import type { SeasonObjective } from '../../src/engine/season/board-objective.js';

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

const rep = (score: number, titles = 0, seasons = 4): ManagerReputation =>
  ({ score, titlesWon: titles, seasonsManaged: seasons });

const TOUT: Demands = { seasons: 5, salary: 'ELEVE', budget: 'AMBITIEUSE' };

describe('crédit auprès du président', () => {
  it('récompense l\'écart entre la réputation et la stature du club', () => {
    expect(negotiationCredit(PETIT, rep(80))).toBeGreaterThan(negotiationCredit(GROS, rep(80)));
  });

  it('fait peser un titre plus lourd qu\'une saison de plus', () => {
    const avecTitre = negotiationCredit(PETIT, rep(60, 1, 4));
    const avecAnciennete = negotiationCredit(PETIT, rep(60, 0, 5));
    expect(avecTitre).toBeGreaterThan(avecAnciennete);
  });
});

describe('réponse du président', () => {
  it('accepte sans discuter le contrat que tout le monde obtient', () => {
    expect(negotiate(GROS, rep(20), MODEST_DEMANDS).accepted).toBe(true);
  });

  it('refuse tout à un inconnu qui vise trop haut', () => {
    const out = negotiate(GROS, rep(20), TOUT);
    expect(out.accepted).toBe(false);
    expect(out.counter).toBeDefined();
  });

  it('accorde ses exigences à une gloire qui descend d\'un cran', () => {
    expect(negotiate(PETIT, rep(90, 3), TOUT).accepted).toBe(true);
  });

  it('ne ferme jamais la porte : un refus revient avec une contre-proposition', () => {
    // Faire échouer la signature laisserait le manager sans club sur un mauvais
    // clic — ce qui n'est pas un choix, seulement une punition.
    for (const score of [0, 15, 40, 65]) {
      const out = negotiate(GROS, rep(score), TOUT);
      if (!out.accepted) expect(out.counter).toBeDefined();
    }
  });

  it('lâche le budget avant le salaire, et la durée en dernier', () => {
    // Le budget sort du même portefeuille que les joueurs : c'est ce qui coûte
    // le plus cher au club, donc ce qu'il concède en premier. Un manager qui a
    // du crédit garde donc sa durée et son salaire.
    const out = negotiate(PETIT, rep(55), TOUT);
    expect(out.accepted).toBe(false);
    expect(out.counter!.budget).not.toBe('AMBITIEUSE');
    expect(out.counter!.salary).toBe('ELEVE');
    expect(out.counter!.seasons).toBe(5);
  });

  it('ne laisse au débutant que le contrat de base', () => {
    // Crédit nul : tout ce qui se paie lui est refusé, mais le minimum reste
    // acquis — sinon le club refuserait celui qu'il vient d'appeler.
    const out = negotiate(GROS, rep(20), TOUT);
    expect(out.counter).toEqual(MODEST_DEMANDS);
    expect(negotiate(GROS, rep(20), MODEST_DEMANDS).accepted).toBe(true);
  });

  it('propose une contre-offre effectivement acceptable', () => {
    // Une contre-proposition que le président refuserait à son tour serait une
    // impasse déguisée.
    for (const score of [0, 25, 50, 75, 100]) {
      const out = negotiate(GROS, rep(score), TOUT);
      if (out.counter) expect(negotiate(GROS, rep(score), out.counter).accepted).toBe(true);
    }
  });
});

describe('contrepartie des termes', () => {
  it('un long bail achète de la patience, sans rendre inamovible', () => {
    expect(patienceFor(1, 'STANDARD')).toBe(1);
    expect(patienceFor(5, 'STANDARD')).toBe(3);
    // Au-delà, on ne pourrait plus jamais être limogé.
    expect(patienceFor(5, 'STANDARD')).toBeLessThanOrEqual(3);
  });

  it('se payer cher, c\'est être jugé plus vite', () => {
    expect(patienceFor(5, 'ELEVE')).toBeLessThan(patienceFor(5, 'STANDARD'));
    expect(patienceFor(1, 'ELEVE')).toBeGreaterThanOrEqual(1);
  });

  it('un salaire au-dessus du marché durcit la mission', () => {
    const objectif: SeasonObjective = { kind: 'TOP_6', targetRank: 6, label: 'Top 6' };
    expect(objectiveWithSalary(objectif, 'ELEVE').kind).toBe('TOP_4');
    expect(objectiveWithSalary(objectif, 'STANDARD')).toBe(objectif);
  });

  it('ne durcit pas au-delà du titre', () => {
    const champion: SeasonObjective = { kind: 'CHAMPION', targetRank: 1, label: 'Brennus' };
    expect(objectiveWithSalary(champion, 'ELEVE')).toBe(champion);
  });

  it('indexe salaire et enveloppe sur le club', () => {
    expect(salaryFor(GROS, 'STANDARD')).toBeGreaterThan(salaryFor(PETIT, 'STANDARD'));
    expect(salaryFor(GROS, 'ELEVE')).toBeGreaterThan(salaryFor(GROS, 'STANDARD'));
    expect(transferBudgetFor(GROS, 'AUCUNE')).toBe(0);
    expect(transferBudgetFor(GROS, 'AMBITIEUSE')).toBeGreaterThan(transferBudgetFor(GROS, 'RAISONNABLE'));
  });
});

describe('contrat signé', () => {
  it('traduit les demandes en termes chiffrés', () => {
    const c = signContract(GROS, { seasons: 3, salary: 'ELEVE', budget: 'RAISONNABLE' }, 2026);
    expect(c.seasons).toBe(3);
    expect(c.salary).toBeGreaterThan(0);
    expect(c.transferBudget).toBeGreaterThan(0);
    expect(c.patience).toBe(1);
  });

  it('sait quand il arrive à échéance', () => {
    const c = signContract(GROS, { ...MODEST_DEMANDS, seasons: 3 }, 2026);
    expect(contractExpired(c, 2027)).toBe(false);
    expect(contractExpired(c, 2028)).toBe(true);
  });

  it('se résume en une ligne lisible', () => {
    const c = signContract(GROS, { seasons: 2, salary: 'STANDARD', budget: 'RAISONNABLE' }, 2026);
    expect(contractSummary(c)).toMatch(/2 saisons/);
    expect(contractSummary(c)).toMatch(/M€ de renfort/);
  });

  it('offre un repli aux carrières commencées sans négociation', () => {
    expect(defaultContract(2025).patience).toBe(2);
    expect(DURATION_OPTIONS).toContain(defaultContract(2025).seasons);
  });
});
