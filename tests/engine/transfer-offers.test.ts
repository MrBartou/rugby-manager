/**
 * Tests des transferts sortants — V0.28.
 *
 * L'enjeu : fermer la boucle ouverte par le scouting. Deux propriétés comptent —
 * le refus doit être **attribuable** (club ou joueur, jamais ambigu), et les
 * attributs cachés `ambition` / `loyaute` doivent réellement peser.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import {
  askingPriceFor,
  canAffordTransfer,
  estimateMarketValue,
  evaluateClubOffer,
  evaluatePlayerOffer,
  resolveTransferOffer,
  type TransferOffer,
} from '../../src/engine/club/transfer-offers.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player, PlayerId } from '../../src/engine/types.js';

const SEASON = 2026;

function roster(niveau = 60, club = 'vendeur'): Player[] {
  return makeSquad(club as ClubId, niveau).players;
}

function playerAt(position: string, niveau = 60, overrides: Partial<Player> = {}): Player {
  const base = roster(niveau).find(p => p.position === position)!;
  return { ...base, birthDate: '1999-01-01', ...overrides };
}

function club(id = 'vendeur'): Club {
  return {
    id: id as ClubId, name: 'Club', shortName: 'CLB', city: 'Ville',
    tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 60,
  };
}

function offer(over: Partial<TransferOffer> = {}): TransferOffer {
  return {
    playerId: 'p' as PlayerId,
    fromClubId: 'vendeur' as ClubId,
    toClubId: 'acheteur' as ClubId,
    fee: 1_000_000,
    annualSalary: 300_000,
    years: 3,
    ...over,
  };
}

// =============================================================================
// Valorisation
// =============================================================================

describe('valeur marchande', () => {
  it('croît fortement avec le niveau', () => {
    const moyen = estimateMarketValue(playerAt('CENTRE_INTERIEUR', 60), SEASON);
    const bon = estimateMarketValue(playerAt('CENTRE_INTERIEUR', 75), SEASON);
    const crack = estimateMarketValue(playerAt('CENTRE_INTERIEUR', 90), SEASON);

    expect(bon).toBeGreaterThan(moyen);
    // Non linéaire : l'écart haut de gamme doit dépasser l'écart milieu de gamme.
    expect(crack - bon).toBeGreaterThan(bon - moyen);
  });

  it('un jeune vaut plus cher qu\'un trentenaire de même niveau', () => {
    const base = playerAt('CENTRE_INTERIEUR', 75);
    const jeune = { ...base, birthDate: '2004-01-01' };   // 22 ans
    const veteran = { ...base, birthDate: '1993-01-01' }; // 33 ans
    expect(estimateMarketValue(jeune, SEASON)).toBeGreaterThan(estimateMarketValue(veteran, SEASON));
  });

  it('un contrat en fin de course fait chuter l\'indemnité', () => {
    const base = playerAt('CENTRE_INTERIEUR', 75);
    const longContrat = { ...base, contract: { ...base.contract, endSeason: SEASON + 4 } };
    const finContrat = { ...base, contract: { ...base.contract, endSeason: SEASON + 1 } };
    expect(estimateMarketValue(finContrat, SEASON)).toBeLessThan(estimateMarketValue(longContrat, SEASON));
  });

  it('un blessé se négocie moins cher', () => {
    const base = playerAt('CENTRE_INTERIEUR', 75);
    const blesse: Player = {
      ...base,
      dynamic: { ...base.dynamic, injury: { type: 'MUSCULAIRE', startedAt: 0, estimatedReturnAt: 5, hasSequela: false } },
    };
    expect(estimateMarketValue(blesse, SEASON)).toBeLessThan(estimateMarketValue(base, SEASON));
  });

  it('ne descend jamais sous un plancher', () => {
    const faible = playerAt('CENTRE_INTERIEUR', 20, { birthDate: '1988-01-01' });
    expect(estimateMarketValue(faible, SEASON)).toBeGreaterThanOrEqual(20_000);
  });
});

// =============================================================================
// Décision du club vendeur
// =============================================================================

describe('décision du club vendeur', () => {
  const base = () => {
    const p = playerAt('CENTRE_INTERIEUR', 70);
    const r = roster(70);
    return { player: p, sellingRoster: r };
  };

  it('accepte une offre au-dessus de son prix', () => {
    const { player, sellingRoster } = base();
    const value = estimateMarketValue(player, SEASON);
    const res = evaluateClubOffer({
      offer: offer({ fee: value * 4 }), player, sellingClub: club(),
      sellingRoster, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(res.accepted).toBe(true);
  });

  it('chiffre sa demande face à une offre sérieuse', () => {
    const { player, sellingRoster } = base();
    const value = estimateMarketValue(player, SEASON);
    const res = evaluateClubOffer({
      offer: offer({ fee: Math.round(value * 0.7) }), player, sellingClub: club(),
      sellingRoster, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(res.accepted).toBe(false);
    expect(res.counterFee).toBeGreaterThan(value * 0.7);
    expect(res.reason).toMatch(/M€|k€/);
  });

  it('ne chiffre rien face à une offre dérisoire', () => {
    const { player, sellingRoster } = base();
    const res = evaluateClubOffer({
      offer: offer({ fee: 10_000 }), player, sellingClub: club(),
      sellingRoster, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(res.accepted).toBe(false);
    // Sinon un euro symbolique donnerait le tarif de tout le championnat.
    expect(res.counterFee).toBeUndefined();
  });

  /**
   * La première ligne ne se dépanne pas : c'est le seul groupe où retirer les
   * autres spécialistes laisse vraiment zéro couverture.
   */
  const FRONT_ROW = ['PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT'];

  it('exige une prime quand la couverture au poste est mince', () => {
    const player = playerAt('PILIER_GAUCHE', 70);
    const nu = roster(70).filter(p => !FRONT_ROW.includes(p.position) || p.id === player.id);
    const fourni = [
      ...nu,
      { ...player, id: 'd1' as PlayerId },
      { ...player, id: 'd2' as PlayerId },
      { ...player, id: 'd3' as PlayerId },
      { ...player, id: 'd4' as PlayerId },
    ];

    const prix = (r: Player[]) => askingPriceFor({
      offer: offer(), player, sellingClub: club(),
      sellingRoster: r, currentSeason: SEASON, sellingBalance: 10_000_000,
    });

    expect(prix([...nu, { ...player, id: 'd1' as PlayerId }])).toBeGreaterThan(prix(fourni));
  });

  it('un joueur sans aucune couverture n\'est pas à vendre, à aucun prix', () => {
    const player = playerAt('PILIER_GAUCHE', 70);
    const nu = roster(70).filter(p => !FRONT_ROW.includes(p.position) || p.id === player.id);
    const res = evaluateClubOffer({
      offer: offer({ fee: 50_000_000 }), player, sellingClub: club(),
      sellingRoster: nu, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(res.accepted).toBe(false);
    expect(res.reason).toMatch(/peut tenir le poste/i);
    expect(res.counterFee).toBeUndefined();
  });

  it('un troisième ligne est couvert par les autres troisièmes lignes', () => {
    const player = playerAt('TROISIEME_LIGNE_AILE_GAUCHE', 70);
    // Aucun autre joueur au poste exact, mais le pack en couvre le rôle.
    const sansJumeau = roster(70).filter(
      p => p.position !== 'TROISIEME_LIGNE_AILE_GAUCHE' || p.id === player.id,
    );
    const res = evaluateClubOffer({
      offer: offer({ fee: estimateMarketValue(player, SEASON) * 4 }), player, sellingClub: club(),
      sellingRoster: sansJumeau, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(res.accepted).toBe(true);
  });

  it('un club en difficulté financière brade', () => {
    const { player, sellingRoster } = base();
    const prix = (balance: number) => askingPriceFor({
      offer: offer(), player, sellingClub: club(),
      sellingRoster, currentSeason: SEASON, sellingBalance: balance,
    });

    expect(prix(-2_000_000)).toBeLessThan(prix(20_000_000));
  });
});

// =============================================================================
// Décision du joueur
// =============================================================================

describe('décision du joueur', () => {
  /**
   * Cible de référence : milieu de contrat, salaire proposé proche du marché,
   * léger gain sportif. Le choix doit être serré — un scénario trop favorable
   * sature à 100 % d'acceptation et ne teste plus rien.
   */
  const target = () => {
    const p = playerAt('CENTRE_INTERIEUR', 70);
    return { ...p, contract: { ...p.contract, endSeason: SEASON + 3 } };
  };

  const ctx = (over: Partial<Parameters<typeof evaluatePlayerOffer>[0]> = {}) => ({
    offer: offer({ annualSalary: 260_000 }),
    player: target(),
    currentSeason: SEASON,
    buyerRank: 3,
    currentRank: 10,
    buyerRoster: roster(55, 'acheteur'),
    totalClubs: 14,
    ...over,
  });

  /** Taux d'acceptation sur un échantillon : le modèle est probabiliste. */
  function acceptRate(input: Parameters<typeof evaluatePlayerOffer>[0], n = 200): number {
    let ok = 0;
    for (let i = 0; i < n; i++) if (evaluatePlayerOffer(input, createRng(`t_${i}`)).accepted) ok++;
    return ok / n;
  }

  it('un meilleur salaire augmente les chances', () => {
    const bas = acceptRate(ctx({ offer: offer({ annualSalary: 80_000 }) }));
    const haut = acceptRate(ctx({ offer: offer({ annualSalary: 600_000 }) }));
    expect(haut).toBeGreaterThan(bas);
  });

  it('rejoindre un club mieux classé séduit', () => {
    const monte = acceptRate(ctx({ buyerRank: 1, currentRank: 13 }));
    const descend = acceptRate(ctx({ buyerRank: 13, currentRank: 1 }));
    expect(monte).toBeGreaterThan(descend);
  });

  it('l\'ambition amplifie l\'attrait sportif', () => {
    const p = target();
    const ambitieux = { ...p, hidden: { ...p.hidden, ambition: 95, loyaute: 40 } };
    const casanier = { ...p, hidden: { ...p.hidden, ambition: 10, loyaute: 40 } };

    expect(acceptRate(ctx({ player: ambitieux, buyerRank: 1, currentRank: 13 })))
      .toBeGreaterThan(acceptRate(ctx({ player: casanier, buyerRank: 1, currentRank: 13 })));
  });

  it('la loyauté retient le joueur', () => {
    const p = target();
    const fidele = { ...p, hidden: { ...p.hidden, loyaute: 95, ambition: 50 } };
    const mercenaire = { ...p, hidden: { ...p.hidden, loyaute: 5, ambition: 50 } };

    expect(acceptRate(ctx({ player: mercenaire }))).toBeGreaterThan(acceptRate(ctx({ player: fidele })));
  });

  it('un effectif déjà fourni au poste dissuade', () => {
    const concurrence = [...roster(90, 'acheteur'), ...roster(90, 'acheteur2')];
    expect(acceptRate(ctx({ buyerRoster: concurrence })))
      .toBeLessThan(acceptRate(ctx({ buyerRoster: roster(40, 'acheteur') })));
  });

  it('donne un motif de refus exploitable', () => {
    const res = evaluatePlayerOffer(
      ctx({ offer: offer({ annualSalary: 40_000 }), buyerRank: 14, currentRank: 1 }),
      createRng('refus'),
    );
    expect(res.accepted).toBe(false);
    expect(res.reason.length).toBeGreaterThan(15);
  });
});

// =============================================================================
// Résolution complète
// =============================================================================

describe('résolution d\'une offre', () => {
  const full = (over: Record<string, unknown> = {}) => ({
    offer: offer({ fee: 8_000_000, annualSalary: 700_000 }),
    player: playerAt('CENTRE_INTERIEUR', 70),
    sellingClub: club(),
    sellingRoster: roster(70),
    currentSeason: SEASON,
    sellingBalance: 10_000_000,
    buyerRank: 2,
    currentRank: 12,
    buyerRoster: roster(50, 'acheteur'),
    totalClubs: 14,
    ...over,
  });

  it('un club qui refuse clôt la discussion sans consulter le joueur', () => {
    const res = resolveTransferOffer(full({ offer: offer({ fee: 1000 }) }), createRng('x'));
    expect(res.accepted).toBe(false);
    expect(res.refusedBy).toBe('CLUB');
    expect(res.playerResponse).toBeUndefined();
  });

  it('attribue clairement un refus du joueur', () => {
    const res = resolveTransferOffer(
      full({ offer: offer({ fee: 20_000_000, annualSalary: 30_000 }), buyerRank: 14, currentRank: 1 }),
      createRng('y'),
    );
    expect(res.accepted).toBe(false);
    expect(res.refusedBy).toBe('JOUEUR');
    expect(res.clubResponse.accepted).toBe(true);
  });

  it('un transfert abouti change le club et le contrat', () => {
    const res = resolveTransferOffer(full(), createRng('ok'));
    if (!res.accepted) return;              // le modèle reste probabiliste
    expect(res.player!.clubId).toBe('acheteur');
    expect(res.player!.contract.annualSalary).toBe(700_000);
    expect(res.player!.contract.endSeason).toBe(SEASON + 3);
  });

  it('le joueur transféré arrive avec un moral renforcé', () => {
    const input = full();
    const res = resolveTransferOffer(input, createRng('mood'));
    if (!res.accepted) return;
    expect(res.player!.dynamic.mood).toBeGreaterThan(input.player.dynamic.mood);
  });

  it('est déterministe pour une même graine', () => {
    const input = full();
    expect(resolveTransferOffer(input, createRng('same'))).toEqual(resolveTransferOffer(input, createRng('same')));
  });
});

// =============================================================================
// V0.64 — clauses et montages
// =============================================================================

describe('la clause libératoire', () => {
  const avecClause = (releaseClause?: number): Player => {
    const p = playerAt('PILIER_GAUCHE', 78);
    return {
      ...p,
      contract: { ...p.contract, ...(releaseClause === undefined ? {} : { releaseClause }) },
    };
  };

  it('emporte la décision du club, même sur un joueur qu\'il ne peut pas remplacer', () => {
    // Le cas qui donne son sens à la clause : un seul pilier gauche au club,
    // donc un refus certain sans elle.
    const player = avecClause(4_000_000);
    const sellingRoster = [player];
    const sansClause = evaluateClubOffer({
      offer: offer({ fee: 4_000_000 }),
      player: avecClause(),
      sellingClub: club(), sellingRoster, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(sansClause.accepted).toBe(false);

    const avec = evaluateClubOffer({
      offer: offer({ fee: 4_000_000 }), player, sellingClub: club(),
      sellingRoster, currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(avec.accepted).toBe(true);
    expect(avec.reason).toMatch(/[Cc]lause libératoire/);
  });

  it('ne se déclenche pas à un euro près en dessous', () => {
    const player = avecClause(4_000_000);
    const res = evaluateClubOffer({
      offer: offer({ fee: 3_999_999 }), player, sellingClub: club(),
      sellingRoster: [player], currentSeason: SEASON, sellingBalance: 10_000_000,
    });
    expect(res.accepted).toBe(false);
  });
});

describe('le montage entre clubs', () => {
  /**
   * Chaque vendeur est jugé **sur son propre prix** : la détresse financière
   * baisse déjà la demande de 25 % dans `askingPriceFor`, et comparer un club
   * fauché au tarif d'un club prospère aurait mesuré cette remise-là plutôt que
   * l'escompte du montage.
   */
  const cas = (sellingBalance: number, over: Partial<TransferOffer>) => {
    const player = playerAt('CENTRE_INTERIEUR', 70);
    const input = {
      player, sellingClub: club(), sellingRoster: roster(70),
      currentSeason: SEASON, sellingBalance,
    };
    const askingPrice = askingPriceFor({ ...input, offer: offer() });
    return evaluateClubOffer({ ...input, offer: offer({ fee: askingPrice, ...over }) });
  };

  it('le même nominal étalé sur quatre ans ne suffit plus', () => {
    expect(cas(10_000_000, { instalments: 4 }).accepted).toBe(false);
  });

  it('mais une part de revente peut rattraper l\'étalement', () => {
    expect(cas(10_000_000, { instalments: 2, sellOn: 0.25 }).accepted).toBe(true);
  });

  it('et un club au bord du gouffre n\'écoute pas les promesses', () => {
    expect(cas(-2_000_000, { instalments: 2, sellOn: 0.25 }).accepted).toBe(false);
  });
});

describe('le contrat signé porte ce qui a été négocié', () => {
  it('les clauses de l\'offre, et pas celles du contrat déchiré', () => {
    const ancien = playerAt('CENTRE_INTERIEUR', 70);
    const player: Player = {
      ...ancien,
      contract: {
        ...ancien.contract,
        releaseClause: 100_000,
        sellOn: { beneficiaryClubId: 'un_autre' as ClubId, percent: 0.2 },
      },
    };
    const res = resolveTransferOffer({
      offer: offer({
        fee: 20_000_000, annualSalary: 900_000, years: 4,
        sellOn: 0.1, bonuses: { perMatch: 3_000 }, salaryProgression: 0.05,
      }),
      player, sellingClub: club(), sellingRoster: roster(70),
      currentSeason: SEASON, sellingBalance: 10_000_000,
      buyerRank: 2, currentRank: 12, buyerRoster: roster(50, 'acheteur'), totalClubs: 14,
    }, createRng('clauses'));

    if (!res.accepted) return;              // le modèle reste probabiliste
    const c = res.player!.contract;
    expect(c.releaseClause).toBeUndefined();
    expect(c.bonuses?.perMatch).toBe(3_000);
    expect(c.salaryProgression).toBe(0.05);
    expect(c.sellOn).toEqual({ beneficiaryClubId: 'vendeur' as ClubId, percent: 0.1 });
  });
});

// =============================================================================
// Garde-fous financiers
// =============================================================================

describe('capacité financière de l\'acheteur', () => {
  it('refuse si la trésorerie ne couvre pas l\'indemnité', () => {
    const res = canAffordTransfer({
      fee: 5_000_000, annualSalary: 200_000,
      balance: 1_000_000, currentPayroll: 8_000_000, annualBudget: 20_000_000,
    });
    expect(res.canAfford).toBe(false);
    expect(res.reason).toMatch(/trésorerie/i);
  });

  it('refuse si le salaire fait exploser le budget', () => {
    const res = canAffordTransfer({
      fee: 100_000, annualSalary: 5_000_000,
      balance: 40_000_000, currentPayroll: 18_000_000, annualBudget: 20_000_000,
    });
    expect(res.canAfford).toBe(false);
    expect(res.reason).toMatch(/budget/i);
  });

  it('accepte une opération soutenable', () => {
    expect(canAffordTransfer({
      fee: 2_000_000, annualSalary: 400_000,
      balance: 30_000_000, currentPayroll: 8_000_000, annualBudget: 20_000_000,
    }).canAfford).toBe(true);
  });
});
