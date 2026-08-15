/**
 * Les agents — V0.64.
 *
 * L'« agent » n'était jusqu'ici qu'un expéditeur de mail. Ce qui est vérifié
 * ici : il représente plusieurs joueurs et s'en souvient, sa commission coûte
 * vraiment de l'argent, et une relation dégradée finit par fermer une porte
 * sans jamais fermer le mercato entier.
 */

import { describe, expect, it } from 'vitest';
import {
  AGENT_POOL_SIZE,
  BLOCK_THRESHOLD,
  FAVOUR_THRESHOLD,
  agentOf,
  agentProposals,
  agentStance,
  applyAgentEvent,
  buildAgentPool,
  clientsOf,
  commissionFor,
  decayStandings,
  standingOf,
  type AgentStandings,
} from '../../src/engine/club/agents.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, PlayerId } from '../../src/engine/types.js';

const POOL = buildAgentPool();
const SQUAD = makeSquad('c1' as ClubId, 70).players;

describe('le vivier', () => {
  it('compte dix-huit agents', () => {
    expect(POOL).toHaveLength(AGENT_POOL_SIZE);
  });

  it('ne bouge pas d\'une saison à l\'autre : le casting est fixe', () => {
    // La graine de partie change chaque saison. Un vivier tiré dessus aurait
    // fait dériver les tarifs d'hommes que l'on connaît depuis vingt ans, sans
    // que la relation, elle, change d'interlocuteur.
    expect(buildAgentPool()).toEqual(POOL);
  });

  it('la commission reste dans une fourchette crédible', () => {
    for (const agent of POOL) {
      expect(agent.commission).toBeGreaterThanOrEqual(0.03);
      expect(agent.commission).toBeLessThanOrEqual(0.10);
    }
  });

  it('un requin prélève plus qu\'un agent familial', () => {
    const requin = POOL.find(a => a.style === 'REQUIN')!;
    const familial = POOL.find(a => a.style === 'FAMILIAL')!;
    expect(requin.commission).toBeGreaterThan(familial.commission);
  });
});

describe('qui représente qui', () => {
  it('le lien ne dépend que de l\'identifiant du joueur', () => {
    const p = SQUAD[0]!;
    expect(agentOf(POOL, p.id).id).toBe(agentOf(POOL, p.id).id);
  });

  it('un agent tient plusieurs joueurs : c\'est ce qui donne du poids à la brouille', () => {
    const counts = new Map<string, number>();
    for (const p of SQUAD) {
      const id = agentOf(POOL, p.id).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeGreaterThan(1);
    expect(clientsOf(POOL, [...counts.keys()][0]!, SQUAD).length).toBeGreaterThan(0);
  });
});

describe('la relation', () => {
  const agent = POOL[1]!;   // carriériste : sensibilité neutre

  it('part de zéro et monte à la signature', () => {
    const standings: AgentStandings = {};
    expect(standingOf(standings, agent.id)).toBe(0);
    expect(standingOf(applyAgentEvent(standings, agent.id, 'SIGNATURE'), agent.id))
      .toBeGreaterThan(0);
  });

  it('descend quand on refuse la commission', () => {
    const apres = applyAgentEvent({}, agent.id, 'COMMISSION_REFUSEE');
    expect(standingOf(apres, agent.id)).toBeLessThan(0);
  });

  it('un requin encaisse l\'affront mais pas le refus d\'argent', () => {
    const requin = POOL.find(a => a.style === 'REQUIN')!;
    const familial = POOL.find(a => a.style === 'FAMILIAL')!;
    const argent = (id: string) => standingOf(applyAgentEvent({}, id, 'COMMISSION_REFUSEE'), id);
    const affront = (id: string) => standingOf(applyAgentEvent({}, id, 'OFFRE_INSULTANTE'), id);
    expect(argent(requin.id)).toBeLessThan(argent(familial.id));
    expect(affront(familial.id)).toBeLessThan(affront(requin.id));
  });

  it('ne sort jamais de la fourchette', () => {
    let standings: AgentStandings = {};
    for (let i = 0; i < 50; i++) standings = applyAgentEvent(standings, agent.id, 'COMMISSION_REFUSEE');
    expect(standingOf(standings, agent.id)).toBeGreaterThanOrEqual(-100);
    for (let i = 0; i < 100; i++) standings = applyAgentEvent(standings, agent.id, 'SIGNATURE');
    expect(standingOf(standings, agent.id)).toBeLessThanOrEqual(100);
  });

  it('s\'estompe d\'une saison à l\'autre, sinon une carrière longue ferme le mercato', () => {
    const rancune: AgentStandings = { [agent.id]: -80 };
    const apres = decayStandings(rancune);
    expect(standingOf(apres, agent.id)).toBeGreaterThan(-80);
    expect(standingOf(apres, agent.id)).toBeLessThan(0);
  });
});

describe('la commission', () => {
  const agent = POOL[1]!;

  it('se calcule sur le salaire total du contrat', () => {
    const un = commissionFor({ agent, annualSalary: 300_000, years: 1, standing: 0 });
    const trois = commissionFor({ agent, annualSalary: 300_000, years: 3, standing: 0 });
    expect(trois).toBe(un * 3);
  });

  it('une bonne relation vaut une remise, une mauvaise un supplément', () => {
    const args = { agent, annualSalary: 300_000, years: 3 };
    expect(commissionFor({ ...args, standing: 80 }))
      .toBeLessThan(commissionFor({ ...args, standing: -80 }));
  });
});

describe('la position à la table', () => {
  const agent = POOL[1]!;
  const base = { agent, annualSalary: 300_000, years: 3 };

  it('un agent brouillé finit par refuser de traiter', () => {
    const stance = agentStance({ ...base, standing: BLOCK_THRESHOLD - 1 });
    expect(stance.kind).toBe('BLOQUE');
  });

  it('une brouille légère se paie en salaire', () => {
    const stance = agentStance({ ...base, standing: -40 });
    expect(stance.kind).toBe('FREINE');
    expect(stance.salaryFactor).toBeGreaterThan(1);
  });

  it('une bonne relation aplanit', () => {
    const stance = agentStance({ ...base, standing: FAVOUR_THRESHOLD + 5 });
    expect(stance.kind).toBe('FACILITE');
    expect(stance.salaryFactor).toBeLessThan(1);
  });

  it('un carriériste fait payer un club de bas de tableau', () => {
    const carriériste = POOL.find(a => a.style === 'CARRIERISTE')!;
    const stance = agentStance({
      ...base, agent: carriériste, standing: 0, buyerRank: 12, totalClubs: 14,
    });
    expect(stance.kind).toBe('FREINE');
    expect(stance.salaryFactor).toBeGreaterThan(1);
  });

  it('et ne dit rien de tel pour un cador', () => {
    const carriériste = POOL.find(a => a.style === 'CARRIERISTE')!;
    const stance = agentStance({
      ...base, agent: carriériste, standing: 0, buyerRank: 2, totalClubs: 14,
    });
    expect(stance.kind).toBe('NEUTRE');
  });
});

describe('les sollicitations', () => {
  const candidates = SQUAD.slice(0, 12);

  it('personne ne propose rien à un manager qu\'il ne connaît pas', () => {
    const props = agentProposals({
      pool: POOL, standings: {}, candidates, round: 3, seed: 's',
    });
    expect(props).toHaveLength(0);
  });

  it('un agent conquis finit par proposer un de ses joueurs', () => {
    const standings: AgentStandings = Object.fromEntries(POOL.map(a => [a.id, 70]));
    const rounds = [1, 2, 3, 4, 5, 6].flatMap(round => agentProposals({
      pool: POOL, standings, candidates, round, seed: 's',
    }));
    expect(rounds.length).toBeGreaterThan(0);
    // Il ne propose que ses propres joueurs.
    for (const p of rounds) {
      expect(agentOf(POOL, p.playerId as PlayerId).id).toBe(p.agentId);
    }
  });

  it('à graine et journée égales, la même sollicitation', () => {
    const standings: AgentStandings = Object.fromEntries(POOL.map(a => [a.id, 70]));
    const args = { pool: POOL, standings, candidates, round: 4, seed: 's' };
    expect(agentProposals(args)).toEqual(agentProposals(args));
  });
});
