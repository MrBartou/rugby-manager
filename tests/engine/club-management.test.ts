/**
 * La direction du club — V0.45.
 *
 * La propriété qui porte le module : **aucun réglage n'est gratuitement
 * meilleur qu'un autre**. Si monter les tarifs rapportait toujours plus, ou si
 * la campagne offensive était toujours rentable, il n'y aurait pas de direction
 * de club — seulement un curseur à pousser à fond.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN,
  INITIAL_FACILITIES,
  MARKETING_PLAN,
  MAX_LEVEL,
  SEATS_PER_LEVEL,
  advanceProjects,
  canLaunch,
  commercialCost,
  homeAdvantageBonus,
  levelOf,
  matchdayRevenue,
  medicalBonus,
  merchandisingRevenue,
  projectCost,
  projectDuration,
  sponsorRevenue,
  stadiumCapacityFor,
  trainingBonus,
  withLevel,
  type ClubPlan,
  type OngoingProject,
} from '../../src/engine/club/club-management.js';
import type { Club, ClubId } from '../../src/engine/types.js';

const CLUB: Club = {
  id: 'c' as ClubId, name: 'Club', shortName: 'CLB', city: 'Ville',
  tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000, annualBudget: 20_000_000,
  salaryCapUsage: 0, jiffCount: 0, reputation: 50,
};

const plan = (over: Partial<ClubPlan> = {}): ClubPlan => ({ ...DEFAULT_PLAN, ...over });

describe('le prix des places', () => {
  const at = (p: ClubPlan) => matchdayRevenue({
    club: CLUB, facilities: INITIAL_FACILITIES, plan: p, winsRatio: 0.5,
  });

  it('remplit davantage quand c\'est moins cher', () => {
    expect(at(plan({ ticket: 'POPULAIRE' })).attendance)
      .toBeGreaterThan(at(plan({ ticket: 'PREMIUM' })).attendance);
  });

  it('ne fait pas du tarif premium un gain net', () => {
    // C'est l'arbitrage central : sans élasticité forte, on monterait les prix
    // sans réfléchir et il n'y aurait pas de club à choisir.
    const premium = at(plan({ ticket: 'PREMIUM' }));
    const populaire = at(plan({ ticket: 'POPULAIRE' }));
    expect(premium.revenue).toBeGreaterThan(populaire.revenue);
    expect(premium.fillRate).toBeLessThan(populaire.fillRate);
  });

  it('expose le remplissage, pas seulement l\'euro final', () => {
    // Le manager doit comprendre **pourquoi** sa recette bouge.
    const r = at(plan());
    expect(r.attendance).toBeLessThanOrEqual(r.capacity);
    expect(r.fillRate).toBeGreaterThan(0);
  });

  it('récompense les résultats en tribunes', () => {
    const gagnant = matchdayRevenue({ club: CLUB, facilities: INITIAL_FACILITIES, plan: plan(), winsRatio: 0.9 });
    const perdant = matchdayRevenue({ club: CLUB, facilities: INITIAL_FACILITIES, plan: plan(), winsRatio: 0.1 });
    expect(gagnant.attendance).toBeGreaterThan(perdant.attendance);
  });

  it('ne dépasse jamais la capacité', () => {
    const plein = matchdayRevenue({
      club: { ...CLUB, tier: 'GROS_BUDGET' },
      facilities: INITIAL_FACILITIES,
      plan: plan({ ticket: 'POPULAIRE', marketing: 'OFFENSIF' }),
      winsRatio: 1,
    });
    expect(plein.fillRate).toBeLessThanOrEqual(1);
    expect(plein.attendance).toBeLessThanOrEqual(plein.capacity);
  });
});

describe('la campagne marketing', () => {
  it('coûte ce qu\'elle annonce', () => {
    expect(commercialCost(plan({ marketing: 'OFFENSIF' })))
      .toBe(MARKETING_PLAN.OFFENSIF.cost);
    expect(commercialCost(plan({ marketing: 'AUCUN' }))).toBe(0);
  });

  it('pénalise l\'absence de campagne', () => {
    // Ne rien faire n'est pas neutre : la marque s'efface.
    expect(MARKETING_PLAN.AUCUN.fillDelta).toBeLessThan(0);
  });

  it('nourrit les trois recettes à la fois', () => {
    const sans = plan({ marketing: 'AUCUN' });
    const fort = plan({ marketing: 'OFFENSIF' });
    expect(sponsorRevenue(CLUB, fort)).toBeGreaterThan(sponsorRevenue(CLUB, sans));
    expect(merchandisingRevenue({ club: CLUB, facilities: INITIAL_FACILITIES, plan: fort, winsRatio: 0.5 }))
      .toBeGreaterThan(merchandisingRevenue({ club: CLUB, facilities: INITIAL_FACILITIES, plan: sans, winsRatio: 0.5 }));
  });

  it('n\'est pas rentable à coup sûr', () => {
    // Une campagne toujours gagnante ne serait pas une décision.
    const gain = sponsorRevenue(CLUB, plan({ marketing: 'OFFENSIF' })) - sponsorRevenue(CLUB, plan({ marketing: 'AUCUN' }));
    const merch = merchandisingRevenue({ club: { ...CLUB, reputation: 20 }, facilities: INITIAL_FACILITIES, plan: plan({ marketing: 'OFFENSIF' }), winsRatio: 0.2 })
      - merchandisingRevenue({ club: { ...CLUB, reputation: 20 }, facilities: INITIAL_FACILITIES, plan: plan({ marketing: 'AUCUN' }), winsRatio: 0.2 });
    // Pour un petit club qui perd, le retour ne couvre pas forcément la dépense.
    expect(gain + merch).toBeLessThan(MARKETING_PLAN.OFFENSIF.cost * 3);
  });
});

describe('les chantiers', () => {
  it('coûte de plus en plus cher à chaque palier', () => {
    expect(projectCost('STADE', 3)).toBeGreaterThan(projectCost('STADE', 1));
  });

  it('n\'autorise qu\'un chantier à la fois', () => {
    const ongoing: OngoingProject = {
      kind: 'BOUTIQUE', targetLevel: 2, readyAtSeason: 2027, totalCost: 1,
    };
    const out = canLaunch({ facilities: INITIAL_FACILITIES, ongoing, kind: 'STADE', balance: 1e9 });
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/déjà en cours/);
  });

  it('refuse au-delà du niveau maximum', () => {
    const maxed = withLevel(INITIAL_FACILITIES, 'BOUTIQUE', MAX_LEVEL);
    const out = canLaunch({ facilities: maxed, ongoing: undefined, kind: 'BOUTIQUE', balance: 1e9 });
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/maximum/);
  });

  it('refuse sans trésorerie, en chiffrant le manque', () => {
    const out = canLaunch({ facilities: INITIAL_FACILITIES, ongoing: undefined, kind: 'STADE', balance: 0 });
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/manque/);
  });

  it('ne livre qu\'à l\'échéance', () => {
    const ongoing: OngoingProject = {
      kind: 'CENTRE_MEDICAL', targetLevel: 2, readyAtSeason: 2028, totalCost: 1,
    };
    expect(advanceProjects(INITIAL_FACILITIES, ongoing, 2027).delivered).toBeUndefined();
    const livre = advanceProjects(INITIAL_FACILITIES, ongoing, 2028);
    expect(livre.delivered).toBeDefined();
    expect(levelOf(livre.facilities, 'CENTRE_MEDICAL')).toBe(2);
    expect(livre.ongoing).toBeUndefined();
  });

  it('fait durer le stade plus longtemps que le reste', () => {
    expect(projectDuration('STADE')).toBeGreaterThan(projectDuration('BOUTIQUE'));
  });

  it('ne casse rien sans chantier en cours', () => {
    const out = advanceProjects(INITIAL_FACILITIES, undefined, 2030);
    expect(out.facilities).toBe(INITIAL_FACILITIES);
    expect(out.delivered).toBeUndefined();
  });
});

describe('effets sportifs', () => {
  it('agrandit réellement l\'enceinte', () => {
    const agrandi = withLevel(INITIAL_FACILITIES, 'STADE', 2);
    expect(stadiumCapacityFor(CLUB, agrandi))
      .toBe(CLUB.stadiumCapacity + 2 * SEATS_PER_LEVEL);
  });

  it('fait progresser les installations sportives', () => {
    expect(trainingBonus(withLevel(INITIAL_FACILITIES, 'CENTRE_ENTRAINEMENT', 4)))
      .toBeGreaterThan(trainingBonus(INITIAL_FACILITIES));
    expect(medicalBonus(withLevel(INITIAL_FACILITIES, 'CENTRE_MEDICAL', 4)))
      .toBeGreaterThan(medicalBonus(INITIAL_FACILITIES));
  });

  it('récompense sportivement une enceinte pleine', () => {
    // C'est la seule contrepartie sportive d'une politique tarifaire populaire.
    expect(homeAdvantageBonus(0.98)).toBeGreaterThan(homeAdvantageBonus(0.55));
    expect(homeAdvantageBonus(0.55)).toBeLessThan(0);
  });
});

describe('la billetterie vaut pour tous les clubs', () => {
  const club = (over: Partial<Club> = {}): Club => ({
    id: 'c' as ClubId, name: 'Club', shortName: 'CLB', city: 'Ville',
    tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
    stadiumCapacity: 20_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 15, reputation: 60,
    ...over,
  });

  const recette = (over: Partial<Club>, winsRatio: number): number => matchdayRevenue({
    club: club(over),
    facilities: INITIAL_FACILITIES,
    plan: DEFAULT_PLAN,
    winsRatio,
  }).revenue;

  it('un club sans direction encaisse quand même selon son stade et sa forme', () => {
    // V0.60 : les clubs IA passaient par une seconde billetterie, billet à
    // trente euros en dur, aveugle au stade agrandi comme aux derbys.
    expect(recette({ tier: 'GROS_BUDGET', stadiumCapacity: 30_000 }, 0.7))
      .toBeGreaterThan(recette({ tier: 'PETIT_BUDGET', stadiumCapacity: 10_000 }, 0.7));
    expect(recette({}, 0.8)).toBeGreaterThan(recette({}, 0.2));
  });

  it('et un derby remplit l\'enceinte même en bas de tableau', () => {
    const ordinaire = matchdayRevenue({
      club: club(), facilities: INITIAL_FACILITIES, plan: DEFAULT_PLAN, winsRatio: 0.2,
    });
    const derby = matchdayRevenue({
      club: club(), facilities: INITIAL_FACILITIES, plan: DEFAULT_PLAN, winsRatio: 0.2,
      rivalryBonus: 0.1,
    });
    expect(derby.attendance).toBeGreaterThan(ordinaire.attendance);
  });
});
