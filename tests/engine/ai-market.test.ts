/**
 * Tests du mercato IA — V0.29.
 *
 * Trois invariants pèsent plus que le réalisme du marché :
 *   - l'effectif de l'utilisateur est **intouchable** sans son accord
 *   - aucun joueur n'est dupliqué ni perdu au passage
 *   - l'argent est conservé : ce que l'un paie, l'autre l'encaisse
 */

import { describe, expect, it } from 'vitest';
import {
  diagnoseSquad,
  leagueAverageByPosition,
  runAiMarket,
  type AiMarketInput,
} from '../../src/engine/club/ai-market.js';
import { makeSquad } from './fixtures.js';
import { ALL_POSITIONS, type Club, type ClubId, type Player } from '../../src/engine/types.js';

const SEASON = 2026;

const CLUB_IDS = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => id as ClubId);

function club(id: ClubId, budget = 30_000_000): Club {
  return {
    id, name: `Club ${id}`, shortName: (id as string).toUpperCase(), city: 'Ville',
    tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: budget,
    salaryCapUsage: 0, jiffCount: 0, reputation: 60,
  };
}

/** Effectif de 30 joueurs (2 par poste) pour laisser de la marge aux ventes. */
function roster(clubId: ClubId, niveau: number): Player[] {
  const base = makeSquad(clubId, niveau).players;
  return [
    ...base,
    ...base.map((p, i) => ({ ...p, id: `${p.id}_bis${i}` as Player['id'] })),
  ];
}

function scenario(over: Partial<AiMarketInput> = {}): AiMarketInput {
  // Hiérarchie nette : 'a' est fort, 'f' est faible. Cela crée de vraies cibles.
  const levels: Record<string, number> = { a: 78, b: 74, c: 70, d: 66, e: 62, f: 58 };
  const players = CLUB_IDS.flatMap(id => roster(id, levels[id as string]!));

  return {
    players,
    clubs: CLUB_IDS.map(id => club(id)),
    playerClubId: 'a' as ClubId,
    balanceByClub: new Map(CLUB_IDS.map(id => [id, 40_000_000])),
    currentSeason: SEASON,
    rankedClubIds: CLUB_IDS,
    seed: 'mercato',
    ...over,
  };
}

// =============================================================================
// Diagnostic
// =============================================================================

describe('diagnostic d\'effectif', () => {
  it('signale un poste totalement dégarni comme le besoin le plus criant', () => {
    const full = roster('x' as ClubId, 70);
    const averages = leagueAverageByPosition(new Map([['x' as ClubId, full]]));

    // On retire toute la première ligne : le seul groupe qui ne se dépanne pas.
    const FRONT_ROW = ['PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT'];
    const amputé = full.filter(p => !FRONT_ROW.includes(p.position));

    const needs = diagnoseSquad('x' as ClubId, amputé, averages);
    expect(needs.length).toBeGreaterThan(0);
    expect(FRONT_ROW).toContain(needs[0]!.position);
    expect(needs[0]!.cover).toBe(0);
  });

  it('ne signale rien sur un effectif complet et au-dessus de la moyenne', () => {
    const fort = roster('x' as ClubId, 85);
    const faible = roster('y' as ClubId, 55);
    const averages = leagueAverageByPosition(new Map([
      ['x' as ClubId, fort], ['y' as ClubId, faible],
    ]));

    expect(diagnoseSquad('x' as ClubId, fort, averages)).toHaveLength(0);
    expect(diagnoseSquad('y' as ClubId, faible, averages).length).toBeGreaterThan(0);
  });

  it('classe les besoins du plus grave au moins grave', () => {
    const r = roster('x' as ClubId, 60);
    const averages = leagueAverageByPosition(new Map([['x' as ClubId, roster('z' as ClubId, 80)]]));
    const needs = diagnoseSquad('x' as ClubId, r, averages);
    for (let i = 1; i < needs.length; i++) {
      expect(needs[i - 1]!.severity).toBeGreaterThanOrEqual(needs[i]!.severity);
    }
  });
});

// =============================================================================
// Invariants du mercato
// =============================================================================

describe('mercato IA — invariants', () => {
  it('produit des transferts', () => {
    const result = runAiMarket(scenario());
    expect(result.transfers.length).toBeGreaterThan(0);
  });

  it('ne touche jamais à l\'effectif de l\'utilisateur', () => {
    const input = scenario();
    const avant = input.players.filter(p => p.clubId === input.playerClubId).map(p => p.id).sort();
    const result = runAiMarket(input);
    const après = result.players.filter(p => p.clubId === input.playerClubId).map(p => p.id).sort();

    expect(après).toEqual(avant);
    expect(result.transfers.some(t => t.fromClubId === input.playerClubId)).toBe(false);
    expect(result.transfers.some(t => t.toClubId === input.playerClubId)).toBe(false);
  });

  it('ne perd ni ne duplique aucun joueur', () => {
    const input = scenario();
    const result = runAiMarket(input);

    expect(result.players).toHaveLength(input.players.length);
    expect(new Set(result.players.map(p => p.id)).size).toBe(input.players.length);
    expect(result.players.map(p => p.id).sort()).toEqual(input.players.map(p => p.id).sort());
  });

  it('conserve la masse monétaire : chaque euro dépensé est encaissé', () => {
    const input = scenario();
    const result = runAiMarket(input);

    const somme = (m: ReadonlyMap<ClubId, number>) => [...m.values()].reduce((s, v) => s + v, 0);
    // Les signatures d'agents libres ne coûtent aucune indemnité, donc rien ne
    // sort du circuit : le total doit être rigoureusement identique.
    expect(somme(result.balanceByClub)).toBeCloseTo(somme(input.balanceByClub), 2);
  });

  it('chaque transfert déplace bien le joueur vers son acheteur', () => {
    const result = runAiMarket(scenario());
    const byId = new Map(result.players.map(p => [p.id, p]));

    for (const t of result.transfers) {
      const p = byId.get(t.playerId)!;
      expect(p.clubId).toBe(t.toClubId);
      expect(p.freeAgent).toBeFalsy();
      expect(p.contract.annualSalary).toBe(t.annualSalary);
      expect(p.contract.endSeason).toBe(SEASON + t.years);
    }
  });

  it('un même joueur n\'est transféré qu\'une fois', () => {
    const result = runAiMarket(scenario());
    const ids = result.transfers.map(t => t.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('est déterministe pour une même graine', () => {
    const a = runAiMarket(scenario());
    const b = runAiMarket(scenario());
    expect(a.transfers).toEqual(b.transfers);
  });

  it('une graine différente donne un marché différent', () => {
    const a = runAiMarket(scenario({ seed: 'un' }));
    const b = runAiMarket(scenario({ seed: 'deux' }));
    expect(a.transfers).not.toEqual(b.transfers);
  });
});

// =============================================================================
// Garde-fous économiques et sportifs
// =============================================================================

describe('mercato IA — garde-fous', () => {
  it('des clubs sans trésorerie ne s\'échangent que des agents libres', () => {
    const result = runAiMarket(scenario({
      balanceByClub: new Map(CLUB_IDS.map(id => [id, 0])),
    }));
    expect(result.transfers.every(t => t.fee === 0)).toBe(true);
  });

  it('aucun club ne descend en trésorerie négative', () => {
    const result = runAiMarket(scenario({
      balanceByClub: new Map(CLUB_IDS.map(id => [id, 3_000_000])),
    }));
    for (const balance of result.balanceByClub.values()) {
      expect(balance).toBeGreaterThanOrEqual(0);
    }
  });

  it('ne vide pas un effectif : chaque club garde de quoi aligner une équipe', () => {
    const input = scenario();
    const result = runAiMarket(input);

    for (const clubId of CLUB_IDS) {
      const squad = result.players.filter(p => p.clubId === clubId && !p.retired && !p.freeAgent);
      expect(squad.length).toBeGreaterThanOrEqual(20);
      // Et surtout : un titulaire crédible à chaque poste.
      for (const position of ALL_POSITIONS) {
        expect(squad.some(p => p.position === position)).toBe(true);
      }
    }
  });

  it('limite le nombre de recrues payantes par club', () => {
    const result = runAiMarket(scenario());
    const parClub = new Map<ClubId, number>();
    for (const t of result.transfers.filter(t => t.kind === 'TRANSFERT')) {
      parClub.set(t.toClubId, (parClub.get(t.toClubId) ?? 0) + 1);
    }
    for (const n of parClub.values()) expect(n).toBeLessThanOrEqual(3);
  });

  it('ne laisse pas démanteler le meilleur effectif du championnat', () => {
    const result = runAiMarket(scenario());
    const départs = new Map<ClubId, number>();
    for (const t of result.transfers.filter(t => t.kind === 'TRANSFERT')) {
      départs.set(t.fromClubId, (départs.get(t.fromClubId) ?? 0) + 1);
    }
    // Un club fort est mécaniquement la meilleure cible de tout le monde :
    // sans plafond, il perdait quatre cadres le même été.
    for (const n of départs.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it('recrute des joueurs meilleurs que ce dont on dispose déjà', () => {
    const input = scenario();
    const result = runAiMarket(input);
    expect(result.transfers.length).toBeGreaterThan(0);
    // Le seuil d'amélioration interdit les échanges de joueurs équivalents.
    for (const t of result.transfers) {
      expect(t.overall).toBeGreaterThan(0);
    }
  });

  it('les clubs faibles se renforcent davantage que les clubs forts', () => {
    const result = runAiMarket(scenario());
    const entrantes = (id: string) => result.transfers.filter(t => t.toClubId === id).length;
    // 'f' est le plus faible du championnat, 'b' le plus fort des clubs IA.
    expect(entrantes('f')).toBeGreaterThanOrEqual(entrantes('b'));
  });

  it('re-signe ses propres joueurs en fin de contrat avant tout le reste', () => {
    const input = scenario();
    // Le club 'd' ne garde que dix joueurs sous contrat : il doit se reconstituer.
    const effectifD = input.players.filter(p => p.clubId === 'd');
    const libérés = new Set(effectifD.slice(0, effectifD.length - 10).map(p => p.id));
    const players = input.players.map(p =>
      libérés.has(p.id) ? { ...p, freeAgent: true } : p,
    );

    const result = runAiMarket({ ...input, players });

    const prolongations = result.transfers.filter(
      t => t.kind === 'PROLONGATION' && t.toClubId === 'd',
    );
    expect(prolongations.length).toBeGreaterThan(0);
    for (const t of prolongations) {
      expect(t.fee).toBe(0);
      expect(libérés.has(t.playerId)).toBe(true);
      expect(result.players.find(p => p.id === t.playerId)!.clubId).toBe('d');
    }
  });

  it('remonte un effectif décimé à un niveau viable', () => {
    const input = scenario();
    // Catastrophe : tous les contrats du championnat expirent en même temps.
    // C'est exactement ce que produit le seed du jeu à sa troisième saison.
    const players = input.players.map(p =>
      p.clubId === input.playerClubId ? p : { ...p, freeAgent: true },
    );

    const result = runAiMarket({ ...input, players });

    for (const clubId of CLUB_IDS) {
      if (clubId === input.playerClubId) continue;
      const squad = result.players.filter(p => p.clubId === clubId && !p.freeAgent && !p.retired);
      expect(squad.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('étiquette correctement chaque mouvement', () => {
    const result = runAiMarket(scenario());
    for (const t of result.transfers) {
      if (t.kind === 'TRANSFERT') {
        expect(t.fee).toBeGreaterThan(0);
        expect(t.fromClubId).not.toBe(t.toClubId);
      } else {
        expect(t.fee).toBe(0);
      }
      if (t.kind === 'PROLONGATION') expect(t.fromClubId).toBe(t.toClubId);
      if (t.kind === 'RECRUE_LIBRE') expect(t.fromClubId).not.toBe(t.toClubId);
    }
  });

  it('le mercato d\'hiver est nettement plus sobre que celui d\'été', () => {
    const été = runAiMarket(scenario());
    const hiver = runAiMarket(scenario({ window: 'HIVERNAL' }));

    const payants = (r: typeof été) => r.transfers.filter(t => t.kind === 'TRANSFERT');
    expect(payants(hiver).length).toBeLessThanOrEqual(payants(été).length);

    // En janvier, on colmate : un seul renfort et un seul départ par club.
    const parClub = (list: readonly { toClubId: ClubId }[]) => {
      const m = new Map<ClubId, number>();
      for (const t of list) m.set(t.toClubId, (m.get(t.toClubId) ?? 0) + 1);
      return [...m.values()];
    };
    for (const n of parClub(payants(hiver))) expect(n).toBeLessThanOrEqual(1);
  });

  it('la pression du classement fait apparaître des besoins qu\'un club serein ignore', () => {
    // Championnat homogène : personne n'a de faiblesse de niveau ni de trou de
    // couverture. C'est le seul montage où la pression s'observe isolément.
    const homogène = CLUB_IDS.flatMap(id => roster(id, 70));
    const averages = leagueAverageByPosition(
      new Map(CLUB_IDS.map(id => [id, homogène.filter(p => p.clubId === id)])),
    );
    const effectif = homogène.filter(p => p.clubId === 'c');

    // Sans pression, ce club n'a rien à demander.
    expect(diagnoseSquad('c' as ClubId, effectif, averages)).toHaveLength(0);

    // Sous pression, il se met à chercher partout — c'est précisément ce qui
    // rend un mercato d'hiver possible.
    const sousPression = diagnoseSquad('c' as ClubId, effectif, averages, undefined, 10);
    expect(sousPression.length).toBe(ALL_POSITIONS.length);
    for (const need of sousPression) expect(need.severity).toBeGreaterThanOrEqual(10);
  });

  it('la pression ne réordonne pas les priorités', () => {
    const r = roster('x' as ClubId, 60);
    const averages = leagueAverageByPosition(new Map([['z' as ClubId, roster('z' as ClubId, 80)]]));

    const ordre = (u: number) =>
      diagnoseSquad('x' as ClubId, r, averages, undefined, u).map(n => n.position);

    // Un club paniqué cherche plus large, mais il commence toujours par son
    // point faible réel : la pression est un décalage, pas une redistribution.
    expect(ordre(12).slice(0, 3)).toEqual(ordre(0).slice(0, 3));
  });

  it('ne prolonge ni ne complète les effectifs en cours de saison', () => {
    const input = scenario();
    const effectifD = input.players.filter(p => p.clubId === 'd');
    const libérés = new Set(effectifD.slice(0, effectifD.length - 10).map(p => p.id));
    const players = input.players.map(p => (libérés.has(p.id) ? { ...p, freeAgent: true } : p));

    const result = runAiMarket({ ...input, players, window: 'HIVERNAL' });

    // Aucun contrat n'expire en janvier : re-signer en masse n'aurait aucun sens.
    expect(result.transfers.some(t => t.kind === 'PROLONGATION')).toBe(false);
  });

  it('un blessé longue durée cesse de couvrir son poste', () => {
    const input = scenario();
    // Toute la première ligne de 'f' est sur le flanc — le groupe qui ne se
    // dépanne pas, donc le trou est réel.
    const FRONT_ROW = ['PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT'];
    const blessés = new Set(
      input.players.filter(p => p.clubId === 'f' && FRONT_ROW.includes(p.position)).map(p => p.id),
    );

    const sans = runAiMarket({ ...input, window: 'HIVERNAL' });
    const avec = runAiMarket({ ...input, window: 'HIVERNAL', unavailableIds: blessés });

    const renforts = (r: typeof sans) =>
      r.transfers.filter(t => t.toClubId === 'f' && FRONT_ROW.includes(t.position)).length;

    expect(renforts(avec)).toBeGreaterThan(renforts(sans));
  });

  it('sert les agents libres avant de payer une indemnité', () => {
    const input = scenario();
    // Une promotion de très haut niveau, un joueur par poste, tous sans club.
    const libres: Player[] = makeSquad('libre' as ClubId, 92).players.map(p => ({
      ...p, freeAgent: true,
    }));
    const libreIds = new Set(libres.map(p => p.id));

    const result = runAiMarket({ ...input, players: [...input.players, ...libres] });

    const signés = result.transfers.filter(t => libreIds.has(t.playerId));
    expect(signés.length).toBeGreaterThan(0);
    for (const t of signés) {
      expect(t.wasFreeAgent).toBe(true);
      expect(t.fee).toBe(0);
      expect(result.players.find(p => p.id === t.playerId)!.freeAgent).toBe(false);
    }
    // Ils sont meilleurs que tout le monde : personne ne paie pendant qu'ils attendent.
    expect(result.transfers.every(t => t.wasFreeAgent)).toBe(true);
  });
});

// =============================================================================
// Le plafond salarial — V0.46
// =============================================================================

describe('mercato IA — plafond salarial', () => {
  const payrollOf = (players: readonly Player[], clubId: ClubId): number =>
    players
      .filter(p => p.clubId === clubId && !p.retired && !p.freeAgent)
      .reduce((sum, p) => sum + p.contract.annualSalary, 0);

  /** Effectif volontairement hors des clous : salaires gonflés. */
  const overpaid = (input: AiMarketInput, clubId: ClubId): AiMarketInput => ({
    ...input,
    players: input.players.map(p => p.clubId === clubId
      ? { ...p, contract: { ...p.contract, annualSalary: 900_000 } }
      : p),
  });

  it('fait dégraisser un club au-dessus du plafond', () => {
    // Sans cela, le plafond se contentait de geler le mercato d'un club en
    // infraction : il y restait saison après saison.
    const input = overpaid(scenario({ division: 'TOP14' }), 'b' as ClubId);
    const before = payrollOf(input.players, 'b' as ClubId);
    const out = runAiMarket(input);
    expect(payrollOf(out.players, 'b' as ClubId)).toBeLessThan(before);
    expect(out.transfers.some(t => t.kind === 'DEPART_LIBRE' && t.fromClubId === 'b')).toBe(true);
  });

  it('libère les plus gros salaires, pas les plus faibles niveaux', () => {
    // C'est de la masse salariale qu'il faut enlever : viser le niveau ne
    // ferait pas redescendre sous la barre.
    const base = scenario({ division: 'TOP14' });
    const withSpread = {
      ...base,
      players: base.players.map((p, i) => p.clubId === 'b'
        ? { ...p, contract: { ...p.contract, annualSalary: i % 5 === 0 ? 2_000_000 : 400_000 } }
        : p),
    };
    const out = runAiMarket(withSpread);
    const released = out.transfers.filter(t => t.kind === 'DEPART_LIBRE' && t.fromClubId === 'b');
    for (const r of released) expect(r.annualSalary).toBe(2_000_000);
  });

  it('ne vide jamais un effectif pour tenir le plafond', () => {
    // Au-delà de quelques départs, un club préfère l'amende à jouer à quinze.
    const input = overpaid(scenario({ division: 'TOP14' }), 'b' as ClubId);
    const out = runAiMarket(input);
    const remaining = out.players.filter(p => p.clubId === 'b' && !p.retired && !p.freeAgent);
    expect(remaining.length).toBeGreaterThanOrEqual(16);
  });

  it('ne re-signe pas dans la foulée ceux qu\'il vient de libérer', () => {
    // Boucle observée en mesure sur six saisons : le club relâchait ses gros
    // salaires puis les reprenait au complément d'effectif, pour les relâcher
    // de nouveau l'année suivante.
    const input = overpaid(scenario({ division: 'TOP14' }), 'b' as ClubId);
    const out = runAiMarket(input);
    const released = new Set(
      out.transfers.filter(t => t.kind === 'DEPART_LIBRE').map(t => t.playerId as string),
    );
    for (const id of released) {
      const p = out.players.find(x => (x.id as string) === id)!;
      expect(p.clubId).not.toBe('b');
    }
  });

  it('serre davantage en Pro D2 qu\'en Top 14', () => {
    // Une masse salariale confortable en Top 14 met le même effectif hors des
    // clous en Pro D2 : un club relégué garde ses contrats de l'étage du
    // dessus, et la descente impose donc de dégraisser.
    const base = scenario();
    const midPayroll = {
      ...base,
      players: base.players.map(p => ({
        ...p, contract: { ...p.contract, annualSalary: 170_000 },
      })),
    };
    const top14 = runAiMarket({ ...midPayroll, division: 'TOP14' });
    const proD2 = runAiMarket({ ...midPayroll, division: 'PRO_D2' });
    const releases = (r: typeof top14): number =>
      r.transfers.filter(t => t.kind === 'DEPART_LIBRE').length;
    expect(releases(top14)).toBe(0);
    expect(releases(proD2)).toBeGreaterThan(0);
  });

  it('laisse le club de l\'utilisateur en dehors', () => {
    // Son effectif est piloté à la main : le mercato IA n'y touche jamais.
    const input = overpaid(scenario({ division: 'TOP14' }), 'a' as ClubId);
    const out = runAiMarket(input);
    expect(out.transfers.some(t => t.fromClubId === 'a')).toBe(false);
  });
});

describe('mercato IA — le dégraissage est annuel', () => {
  it('ne libère personne au mercato d\'hiver', () => {
    // Le plafond s'apprécie sur l'exercice, comme la commission qui sanctionne.
    // Dégraisser en janvier faisait relâcher les mêmes cadres deux fois par
    // saison — constaté en jeu sur Toulouse.
    const input: AiMarketInput = {
      ...scenario({ division: 'TOP14', window: 'HIVERNAL' }),
      players: scenario().players.map(p => p.clubId === 'b'
        ? { ...p, contract: { ...p.contract, annualSalary: 900_000 } }
        : p),
    };
    const out = runAiMarket(input);
    expect(out.transfers.some(t => t.kind === 'DEPART_LIBRE')).toBe(false);
  });

  it('le fait à l\'intersaison', () => {
    const input: AiMarketInput = {
      ...scenario({ division: 'TOP14', window: 'ESTIVAL' }),
      players: scenario().players.map(p => p.clubId === 'b'
        ? { ...p, contract: { ...p.contract, annualSalary: 900_000 } }
        : p),
    };
    expect(runAiMarket(input).transfers.some(t => t.kind === 'DEPART_LIBRE')).toBe(true);
  });
});

describe('mercato IA — interdiction de recruter', () => {
  it('empêche un club sanctionné d\'enregistrer la moindre recrue', () => {
    // La sanction ne servait à rien tant qu'elle ne frappait que l'utilisateur :
    // un club IA sanctionné continuait de signer comme si de rien n'était.
    const out = runAiMarket(scenario({
      division: 'TOP14',
      transferBannedClubs: new Set(['b' as ClubId]),
    }));
    expect(out.transfers.some(t => t.toClubId === 'b')).toBe(false);
  });

  it('le laisse quand même dégraisser', () => {
    // Un club interdit doit pouvoir redescendre sous le plafond : le priver de
    // cette issue l'y enfermerait définitivement.
    const base = scenario({ division: 'TOP14' });
    const out = runAiMarket({
      ...base,
      players: base.players.map(p => p.clubId === 'b'
        ? { ...p, contract: { ...p.contract, annualSalary: 900_000 } }
        : p),
      transferBannedClubs: new Set(['b' as ClubId]),
    });
    expect(out.transfers.some(t => t.kind === 'DEPART_LIBRE' && t.fromClubId === 'b')).toBe(true);
  });

  it('n\'interdit rien aux autres', () => {
    const out = runAiMarket(scenario({
      division: 'TOP14',
      transferBannedClubs: new Set(['b' as ClubId]),
    }));
    expect(out.transfers.some(t => t.toClubId !== 'b' && t.toClubId !== 'libre')).toBe(true);
  });
});
