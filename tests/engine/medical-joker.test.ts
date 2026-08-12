/**
 * Joker médical — V0.37.
 *
 * C'est la seule dérogation à la fenêtre de mercato. Ce qu'on protège, ce sont
 * donc ses garde-fous : sans eux, le joker deviendrait un moyen de recruter
 * toute l'année en gardant un blessé sous le coude.
 */

import { describe, expect, it } from 'vitest';
import {
  JOKER_LEVEL_MARGIN,
  JOKER_MIN_ABSENCE,
  canBeJoker,
  eligibleJokers,
  jokerCandidates,
  jokerEligibility,
  signJoker,
} from '../../src/engine/club/medical-joker.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Injury, Player } from '../../src/engine/types.js';

const ROUND = 10;
const SEASON = 2026;

function squad(niveau = 70, club = 'club'): Player[] {
  return makeSquad(club as ClubId, niveau).players;
}

function injuredFor(rounds: number, base?: Player): Player {
  const p = base ?? squad()[0]!;
  const injury: Injury = {
    type: 'LIGAMENTAIRE',
    startedAt: ROUND - 1,
    estimatedReturnAt: ROUND + rounds,
    hasSequela: false,
  };
  return { ...p, dynamic: { ...p.dynamic, injury } };
}

function freeAgent(p: Player): Player {
  // `exactOptionalPropertyTypes` interdit `injury: undefined` : on retire la
  // clé plutôt que de l'affecter.
  const { injury, ...dynamic } = p.dynamic;
  void injury;
  return { ...p, freeAgent: true, dynamic };
}

// =============================================================================
// Ouverture du droit
// =============================================================================

describe('qui ouvre droit à un joker', () => {
  it('une absence longue y donne droit', () => {
    const r = jokerEligibility(injuredFor(JOKER_MIN_ABSENCE + 4), ROUND, new Set());
    expect(r.eligible).toBe(true);
    expect(r.returnsAtRound).toBe(ROUND + JOKER_MIN_ABSENCE + 4);
  });

  it('une absence courte n\'y donne pas droit', () => {
    const r = jokerEligibility(injuredFor(JOKER_MIN_ABSENCE - 1), ROUND, new Set());
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/trop courte/i);
  });

  it('un joueur valide n\'y donne pas droit', () => {
    const r = jokerEligibility(squad()[0]!, ROUND, new Set());
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/n'est pas blessé/i);
  });

  it('le droit s\'épuise à l\'usage', () => {
    const blessé = injuredFor(12);
    expect(jokerEligibility(blessé, ROUND, new Set()).eligible).toBe(true);
    // Sinon un seul joueur au long cours autoriserait un recrutement par journée.
    expect(jokerEligibility(blessé, ROUND, new Set([blessé.id])).eligible).toBe(false);
  });

  it('classe les blessés du plus longuement absent au moins', () => {
    const roster = squad();
    const court = injuredFor(9, roster[0]);
    const long = injuredFor(20, roster[1]);
    const candidats = jokerCandidates([court, long, ...roster.slice(2)], ROUND, new Set());
    expect(candidats[0]!.id).toBe(long.id);
  });
});

// =============================================================================
// Qui peut être signé
// =============================================================================

describe('qui peut être signé comme joker', () => {
  const blessé = injuredFor(14, squad(70).find(p => p.position === 'OUVREUR'));

  it('accepte un agent libre du même poste et de niveau comparable', () => {
    const candidat = freeAgent(squad(68, 'autre').find(p => p.position === 'OUVREUR')!);
    expect(canBeJoker(blessé, candidat).allowed).toBe(true);
  });

  it('refuse un joueur sous contrat', () => {
    const sousContrat = squad(65, 'autre').find(p => p.position === 'OUVREUR')!;
    const r = canBeJoker(blessé, sousContrat);
    expect(r.allowed).toBe(false);
    // C'est le point clé : autoriser un joueur sous contrat rouvrirait le
    // marché des transferts hors fenêtre, ce que V0.30 ferme précisément.
    expect(r.reason).toMatch(/libre/i);
  });

  it('refuse un joueur d\'un autre poste', () => {
    const pilier = freeAgent(squad(65, 'autre').find(p => p.position === 'PILIER_GAUCHE')!);
    expect(canBeJoker(blessé, pilier).allowed).toBe(false);
  });

  it('refuse un joker meilleur que le blessé', () => {
    const crack = freeAgent(squad(92, 'autre').find(p => p.position === 'OUVREUR')!);
    const r = canBeJoker(blessé, crack);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/meilleur/i);
  });

  it('tolère un écart marginal, pas une aubaine', () => {
    const roster = squad(70, 'autre');
    const modèle = roster.find(p => p.position === 'OUVREUR')!;
    const àPeinePlusFort: Player = freeAgent({
      ...modèle,
      technical: { ...modèle.technical, passe: Math.min(99, modèle.technical.passe + JOKER_LEVEL_MARGIN) },
    });
    expect(canBeJoker(blessé, àPeinePlusFort).allowed).toBe(true);
  });

  it('refuse un joker lui-même blessé', () => {
    const cassé = { ...freeAgent(squad(65, 'autre').find(p => p.position === 'OUVREUR')!) };
    const avecBlessure = {
      ...cassé,
      dynamic: {
        ...cassé.dynamic,
        injury: { type: 'COUP' as const, startedAt: 1, estimatedReturnAt: 12, hasSequela: false },
      },
    };
    expect(canBeJoker(blessé, avecBlessure).allowed).toBe(false);
  });

  it('trie les candidats du meilleur au moins bon', () => {
    const pool = [
      freeAgent(squad(55, 'a').find(p => p.position === 'OUVREUR')!),
      freeAgent(squad(66, 'b').find(p => p.position === 'OUVREUR')!),
      freeAgent(squad(60, 'c').find(p => p.position === 'OUVREUR')!),
    ];
    const list = eligibleJokers(blessé, pool);
    expect(list.length).toBeGreaterThan(1);
    for (let i = 1; i < list.length; i++) {
      const level = (p: Player) => p.technical.passe + p.physical.vitesse;
      expect(level(list[i - 1]!)).toBeGreaterThanOrEqual(level(list[i]!));
    }
  });
});

// =============================================================================
// Contrat
// =============================================================================

describe('contrat de joker', () => {
  it('s\'achève à la fin de la saison en cours', () => {
    const blessé = injuredFor(14);
    const candidat = freeAgent(squad(65, 'autre')[0]!);
    const signing = signJoker(blessé, candidat, 'club' as ClubId, SEASON, 120_000);

    // Un joker est un dépannage : le laisser signer trois ans en ferait le
    // moyen le plus économique de constituer un effectif.
    expect(signing.player.contract.startSeason).toBe(SEASON);
    expect(signing.player.contract.endSeason).toBe(SEASON);
    expect(signing.player.freeAgent).toBe(false);
    expect(signing.player.clubId).toBe('club');
    expect(signing.replacesId).toBe(blessé.id);
  });
});
