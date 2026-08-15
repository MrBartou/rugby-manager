/**
 * Dossier d'avant-match — V0.36.
 *
 * L'invariant décisif : **rien ne doit fuir**. Un adversaire jamais observé ne
 * livre ni note de ligne, ni point faible, ni joueur à surveiller. C'est ce qui
 * donne au scouting une utilité hebdomadaire — sans quoi le dossier serait un
 * cadeau et l'observation, une formalité.
 */

import { describe, expect, it } from 'vitest';
import { buildOpponentReport, reportHint } from '../../src/engine/club/opponent-report.js';
import { EMPTY_SCOUTING, advanceScouting, type ScoutingState } from '../../src/engine/club/scouting.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player } from '../../src/engine/types.js';
import { DEFAULT_PLAYBOOK, type CallUsage } from '../../src/engine/match/playbook.js';

function club(id: string, identity: Club['tacticalIdentity'] = 'MIXTE'): Club {
  return {
    id: id as ClubId, name: `Club ${id}`, shortName: id.toUpperCase(), city: 'Ville',
    tier: 'BUDGET_MOYEN', tacticalIdentity: identity,
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 60,
  };
}

const ROSTERS = new Map<ClubId, readonly Player[]>([
  ['fort' as ClubId, makeSquad('fort' as ClubId, 82).players],
  ['moyen' as ClubId, makeSquad('moyen' as ClubId, 68).players],
  ['faible' as ClubId, makeSquad('faible' as ClubId, 54).players],
]);

/** Connaissance parfaite d'un effectif, comme après des saisons d'observation. */
function knownScouting(roster: readonly Player[]): ScoutingState {
  return advanceScouting(EMPTY_SCOUTING, {
    ownSquadIds: roster.map(p => p.id),
    matchesPlayedByPlayer: new Map(roster.map(p => [p.id, 30])),
    facedOpponentIds: [],
    scoutQuality: 85,
  });
}

function report(target: ClubId, scouting: ScoutingState, identity: Club['tacticalIdentity'] = 'MIXTE') {
  return buildOpponentReport({
    club: club(target as string, identity),
    roster: ROSTERS.get(target)!,
    leagueRosters: ROSTERS,
    scouting,
    form: [1, -1, 1, 1, 0],
    rank: 3,
    currentRound: 6,
  });
}

describe('adversaire jamais observé', () => {
  const r = report('fort' as ClubId, EMPTY_SCOUTING);

  it('ne livre aucune note de ligne', () => {
    for (const u of r.units) {
      expect(u.known).toBe(false);
      expect(u.display).toBe('?');
      // `estimateAttribute` restitue la valeur réelle dans son point d'estimation :
      // s'y fier aurait divulgué le niveau exact d'un adversaire inconnu.
      expect(u.rating).toBe(0);
      expect(u.versusLeague).toBe(0);
    }
  });

  it('ne désigne ni point fort ni point faible', () => {
    expect(r.strength).toBeUndefined();
    expect(r.weakness).toBeUndefined();
  });

  it('ne cite aucun joueur à surveiller', () => {
    expect(r.threats).toHaveLength(0);
  });

  it('invite à envoyer un scout plutôt qu\'à conclure', () => {
    expect(reportHint(r)).toMatch(/scout/i);
  });
});

describe('adversaire bien connu', () => {
  const r = report('fort' as ClubId, knownScouting(ROSTERS.get('fort' as ClubId)!));

  it('chiffre chaque ligne', () => {
    expect(r.units).toHaveLength(3);
    for (const u of r.units) {
      expect(u.known).toBe(true);
      expect(u.rating).toBeGreaterThan(0);
      expect(Number.isInteger(u.rating)).toBe(true);
    }
  });

  it('situe l\'équipe par rapport au championnat', () => {
    // Le club le plus fort des trois doit ressortir au-dessus de la moyenne.
    expect(r.units.every(u => u.versusLeague > 0)).toBe(true);
  });

  it('désigne la ligne la plus forte et la moins forte', () => {
    expect(r.strength).toBeDefined();
    expect(r.weakness).toBeDefined();
    expect(r.strength!.versusLeague).toBeGreaterThanOrEqual(r.weakness!.versusLeague);
  });

  it('cite des joueurs à surveiller, avec un motif', () => {
    expect(r.threats.length).toBeGreaterThan(0);
    expect(r.threats.length).toBeLessThanOrEqual(3);
    for (const t of r.threats) expect(t.reason.length).toBeGreaterThan(5);
    // Classés par niveau décroissant : le plus dangereux d'abord.
    for (let i = 1; i < r.threats.length; i++) {
      expect(r.threats[i - 1]!.rating).toBeGreaterThanOrEqual(r.threats[i]!.rating);
    }
  });

  it('ne parle pas de maillon faible pour une ligne au-dessus du championnat', () => {
    // Toutes leurs lignes dominent : annoncer un « maillon faible » enverrait le
    // manager attaquer un point qui n'en est pas un.
    expect(reportHint(r)).not.toMatch(/maillon faible/);
  });
});

describe('lecture générale', () => {
  it('annonce le plan que l\'adversaire va jouer', () => {
    const avants = report('moyen' as ClubId, EMPTY_SCOUTING, 'JEU_AVANTS');
    const ecart = report('moyen' as ClubId, EMPTY_SCOUTING, 'GRAND_ECART');
    expect(avants.expectedPlan).not.toEqual(ecart.expectedPlan);
  });

  it('signale les absents de leur effectif', () => {
    const roster = ROSTERS.get('moyen' as ClubId)!;
    const blessé: Player = {
      ...roster[0]!,
      dynamic: {
        ...roster[0]!.dynamic,
        injury: { type: 'FRACTURE', startedAt: 1, estimatedReturnAt: 20, hasSequela: false },
      },
    };
    const r = buildOpponentReport({
      club: club('moyen'),
      roster: [blessé, ...roster.slice(1)],
      leagueRosters: ROSTERS,
      scouting: EMPTY_SCOUTING,
      form: [],
      rank: 5,
      currentRound: 6,
    });
    expect(r.unavailable.map(p => p.id)).toContain(blessé.id);
  });

  it('exclut les absents du XV probable, donc des menaces', () => {
    const roster = ROSTERS.get('fort' as ClubId)!;
    const meilleur = [...roster].sort((a, b) => b.technical.plaquage - a.technical.plaquage)[0]!;
    const suspendu: Player = {
      ...meilleur,
      dynamic: { ...meilleur.dynamic, suspendedUntilRound: 12 },
    };
    const r = buildOpponentReport({
      club: club('fort'),
      roster: [suspendu, ...roster.filter(p => p.id !== meilleur.id)],
      leagueRosters: ROSTERS,
      scouting: knownScouting(roster),
      form: [],
      rank: 1,
      currentRound: 6,
    });
    expect(r.threats.some(t => t.player.id === suspendu.id)).toBe(false);
  });
});

// =============================================================================
// V0.65 — l'avertissement de touche
// =============================================================================

describe('le dossier se retourne vers nous', () => {
  const usageRepete: CallUsage = { rouleau: 27, sortie: 3 };

  const dossier = (over: Record<string, unknown>) => buildOpponentReport({
    club: club('moyen'),
    roster: ROSTERS.get('moyen' as ClubId)!,
    leagueRosters: ROSTERS,
    scouting: knownScouting(ROSTERS.get('moyen' as ClubId)!),
    form: [1, 0, 1, -1, 1],
    rank: 5,
    currentRound: 8,
    ownPlaybook: DEFAULT_PLAYBOOK,
    ownCallUsage: usageRepete,
    opponentAnalysis: 1,
    ...over,
  });

  it('prévient quand nos habitudes sont lisibles et qu\'ils savent lire', () => {
    const report = dossier({});
    expect(report.lineoutWarning).toBeDefined();
    expect(report.lineoutWarning).toContain('Rouleau');
  });

  it('se tait quand l\'adversaire ne prépare rien', () => {
    expect(dossier({ opponentAnalysis: 0 }).lineoutWarning).toBeUndefined();
  });

  it('se tait quand on varie', () => {
    expect(dossier({ ownCallUsage: { rouleau: 10, sortie: 10, fond: 10 } }).lineoutWarning)
      .toBeUndefined();
  });

  it('et se tait quand on ne lui a rien transmis', () => {
    expect(dossier({ ownPlaybook: undefined, ownCallUsage: undefined, opponentAnalysis: undefined }).lineoutWarning)
      .toBeUndefined();
  });
});
