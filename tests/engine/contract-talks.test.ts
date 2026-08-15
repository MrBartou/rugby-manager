/**
 * Les discussions de contrat : V0.64.
 *
 * Trois situations qui n'existaient pas : la revalorisation en cours de
 * contrat, le pré-contrat à six mois de l'échéance, et la résiliation à
 * l'amiable. Ce que les tests protègent, c'est la règle commune : **le levier
 * appartient à celui qui peut partir**. Un remplaçant ne doit pas pouvoir
 * exiger, et un joueur heureux ne doit pas se racheter pour rien.
 */

import { describe, expect, it } from 'vitest';
import {
  answerRenegotiation,
  applyPreContracts,
  applyRenegotiation,
  applyTermination,
  evaluatePreContract,
  evaluateTermination,
  preContractEligible,
  preContractWindowOpens,
  renegotiationRequest,
  salaryGap,
  terminationCost,
  wantsRenegotiation,
} from '../../src/engine/club/contract-talks.js';
import { expectedMarketSalary } from '../../src/engine/club/contracts.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId } from '../../src/engine/types.js';

const SEASON = 2026;
const SQUAD = makeSquad('c1' as ClubId, 72).players;
const BASE = SQUAD[9]!;

const joueur = (over: Partial<Player> = {}): Player => ({
  ...BASE,
  birthDate: '1999-01-01',
  contract: { startSeason: 2024, endSeason: 2029, annualSalary: 120_000 },
  ...over,
});

describe('la revalorisation', () => {
  it('un titulaire sous-payé demande à discuter', () => {
    expect(wantsRenegotiation({ player: joueur(), currentSeason: SEASON, playRatio: 0.8 })).toBe(true);
  });

  it('un remplaçant n\'a aucun levier, même sous-payé', () => {
    expect(salaryGap({ player: joueur(), currentSeason: SEASON })).toBeGreaterThan(0);
    expect(wantsRenegotiation({ player: joueur(), currentSeason: SEASON, playRatio: 0.2 })).toBe(false);
  });

  it('un joueur déjà au tarif du marché ne demande rien', () => {
    const paye = joueur({ contract: { startSeason: 2024, endSeason: 2029, annualSalary: 2_000_000 } });
    expect(wantsRenegotiation({ player: paye, currentSeason: SEASON, playRatio: 0.9 })).toBe(false);
  });

  it('en dernière année ce n\'est plus une revalorisation, c\'est une prolongation', () => {
    const finissant = joueur({ contract: { startSeason: 2024, endSeason: SEASON, annualSalary: 120_000 } });
    expect(wantsRenegotiation({ player: finissant, currentSeason: SEASON, playRatio: 0.9 })).toBe(false);
  });

  it('il demande davantage que ce qu\'il touche', () => {
    const req = renegotiationRequest({ player: joueur(), currentSeason: SEASON, playRatio: 0.8 });
    expect(req.annualSalary).toBeGreaterThan(120_000);
    expect(req.extraYears).toBe(1);
  });

  it('un loyal accepte une revalorisation partielle, un ambitieux la refuse', () => {
    const req = renegotiationRequest({ player: joueur(), currentSeason: SEASON, playRatio: 0.8 });
    const offert = Math.round(req.annualSalary * 0.9);
    const loyal = joueur({ hidden: { ...BASE.hidden, loyaute: 95, ambition: 30 } });
    const ambitieux = joueur({ hidden: { ...BASE.hidden, loyaute: 20, ambition: 95 } });
    expect(answerRenegotiation({ player: loyal, request: req, offeredSalary: offert, seed: 's' }).kind)
      .toBe('ACCEPT');
    expect(answerRenegotiation({ player: ambitieux, request: req, offeredSalary: offert, seed: 's' }).kind)
      .not.toBe('ACCEPT');
  });

  it('une aumône est prise pour un refus', () => {
    const req = renegotiationRequest({ player: joueur(), currentSeason: SEASON, playRatio: 0.8 });
    const res = answerRenegotiation({
      player: joueur(), request: req, offeredSalary: Math.round(req.annualSalary * 0.3), seed: 's',
    });
    expect(res.kind).toBe('REFUSE');
  });

  it('l\'agent peut renchérir sur la demande de son joueur', () => {
    const req = renegotiationRequest({ player: joueur(), currentSeason: SEASON, playRatio: 0.8 });
    const args = { player: joueur(), request: req, offeredSalary: req.annualSalary, seed: 's' };
    expect(answerRenegotiation(args).kind).toBe('ACCEPT');
    expect(answerRenegotiation({ ...args, agentFactor: 1.2 }).kind).not.toBe('ACCEPT');
  });

  it('la revalorisation efface la progression, sinon on paie deux fois la même hausse', () => {
    const progressif = joueur({
      contract: { startSeason: 2024, endSeason: 2029, annualSalary: 120_000, salaryProgression: 0.08 },
    });
    const apres = applyRenegotiation(progressif, 260_000, 1, SEASON);
    expect(apres.contract.salaryProgression).toBeUndefined();
    expect(apres.contract.annualSalary).toBe(260_000);
    expect(apres.contract.endSeason).toBe(2030);
    expect(apres.dynamic.mood).toBeGreaterThan(progressif.dynamic.mood);
  });
});

describe('le pré-contrat', () => {
  const finissant = joueur({ contract: { startSeason: 2024, endSeason: SEASON, annualSalary: 120_000 } });

  it('la fenêtre s\'ouvre à mi-saison, et la Pro D2 a la sienne', () => {
    expect(preContractWindowOpens(26)).toBe(13);
    expect(preContractWindowOpens(30)).toBe(15);
  });

  it('ne concerne que la dernière année de contrat, et pas avant la fenêtre', () => {
    const args = { currentSeason: SEASON, round: 20, totalRounds: 26 };
    expect(preContractEligible({ ...args, player: finissant })).toBe(true);
    expect(preContractEligible({ ...args, player: joueur() })).toBe(false);
    expect(preContractEligible({ ...args, round: 4, player: finissant })).toBe(false);
  });

  it('un salaire supérieur emporte la signature', () => {
    const res = evaluatePreContract({
      player: finissant, currentSeason: SEASON, annualSalary: 3_000_000,
      buyerRank: 8, currentRank: 8, totalClubs: 14,
    });
    expect(res.kind).toBe('ACCEPT');
  });

  it('un club mieux classé compense une partie de l\'écart', () => {
    // Un salaire juste sous le tarif du marché : le bas de tableau ne peut pas
    // l'emporter avec ça, le leader si.
    const reference = expectedMarketSalary(finissant, SEASON);
    const args = {
      player: finissant, currentSeason: SEASON,
      annualSalary: Math.round(reference * 0.95), currentRank: 13, totalClubs: 14,
    };
    expect(evaluatePreContract({ ...args, buyerRank: 13 }).kind).toBe('REFUSE');
    expect(evaluatePreContract({ ...args, buyerRank: 1 }).kind).toBe('ACCEPT');
  });

  it('au rollover, le joueur change de club sans passer par le vivier des libres', () => {
    const players = applyPreContracts({
      players: [finissant],
      preContracts: [{
        playerId: finissant.id, playerName: 'X',
        fromClubId: 'c1' as ClubId, toClubId: 'c2' as ClubId, toClubName: 'C2',
        signedSeason: SEASON, annualSalary: 250_000, years: 3,
      }],
      newSeason: SEASON + 1,
    });
    expect(players[0]!.clubId).toBe('c2');
    expect(players[0]!.freeAgent).toBe(false);
    expect(players[0]!.contract.annualSalary).toBe(250_000);
    expect(players[0]!.contract.endSeason).toBe(SEASON + 3);
  });

  it('et un joueur sans pré-contrat n\'est pas touché', () => {
    const players = applyPreContracts({
      players: [finissant], preContracts: [], newSeason: SEASON + 1,
    });
    expect(players[0]).toBe(finissant);
  });
});

describe('la résiliation à l\'amiable', () => {
  it('coûte moins cher sur un joueur malheureux', () => {
    const heureux = joueur({ dynamic: { ...BASE.dynamic, mood: 95 } });
    const malheureux = joueur({ dynamic: { ...BASE.dynamic, mood: 15 } });
    expect(terminationCost({ player: malheureux, currentSeason: SEASON }))
      .toBeLessThan(terminationCost({ player: heureux, currentSeason: SEASON }));
  });

  it('ne coûte rien sur un contrat qui s\'achève de toute façon', () => {
    const finissant = joueur({ contract: { startSeason: 2024, endSeason: SEASON, annualSalary: 120_000 } });
    expect(terminationCost({ player: finissant, currentSeason: SEASON })).toBe(0);
  });

  it('ne rachète jamais la totalité du contrat restant', () => {
    const p = joueur({ dynamic: { ...BASE.dynamic, mood: 100 }, hidden: { ...BASE.hidden, loyaute: 100 } });
    const restant = 120_000 * 3;
    expect(terminationCost({ player: p, currentSeason: SEASON })).toBeLessThan(restant);
  });

  it('une offre trop basse est refusée, une offre proche appelle un chiffre', () => {
    const p = joueur();
    const asked = terminationCost({ player: p, currentSeason: SEASON });
    expect(evaluateTermination({ player: p, currentSeason: SEASON, offered: asked }).kind).toBe('ACCEPT');
    expect(evaluateTermination({ player: p, currentSeason: SEASON, offered: Math.round(asked * 0.8) }).kind)
      .toBe('COUNTER');
    expect(evaluateTermination({ player: p, currentSeason: SEASON, offered: 0 }).kind).toBe('REFUSE');
  });

  it('le joueur résilié est libre le jour même', () => {
    const libre = applyTermination(joueur());
    expect(libre.freeAgent).toBe(true);
    expect(libre.clubId).toBe('libre' as ClubId);
    expect(libre.id).toBe(BASE.id as PlayerId);
  });
});
