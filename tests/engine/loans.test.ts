/**
 * Le prêt — V0.55.
 *
 * Un jeune n'avait que deux issues : prendre des minutes à l'équipe première,
 * ce qu'une course au titre interdit, ou stagner — puisque la progression se
 * paie en minutes depuis la V0.14.
 *
 * Ce qui est testé ici : la troisième voie existe, elle est **réservée à ceux
 * qui en ont besoin**, et elle constitue un vrai arbitrage — on gagne un joueur
 * formé dans un an, on en perd un tout de suite.
 */

import { describe, expect, it } from 'vitest';
import {
  LOAN_MAX_AGE,
  isLoanable,
  loanCost,
  loanMinutes,
  loanWageReliefPerRound,
  loanOffersFor,
  loanReport,
  loanTradeoff,
  canRecall,
  recallLoan,
  resolveLoanOption,
  type ActiveLoan,
} from '../../src/engine/club/loans.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player, PlayerId } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE = SQUAD.players[0]!;

const jeune = (over: Partial<Player> = {}): Player => ({
  ...BASE,
  birthDate: '2004-05-01',
  contract: { startSeason: 2025, endSeason: 2028, annualSalary: 90_000 },
  ...over,
});

const club = (id: string, reputation: number): Club => ({
  id: id as ClubId, name: `Club ${id}`, shortName: id.toUpperCase(), city: 'Ville',
  tier: reputation >= 75 ? 'GROS_BUDGET' : reputation >= 55 ? 'BUDGET_MOYEN' : 'PETIT_BUDGET',
  tacticalIdentity: 'MIXTE',
  stadiumCapacity: 12_000, annualBudget: 12_000_000,
  salaryCapUsage: 0, jiffCount: 0, reputation,
});

const ACCUEIL: readonly Club[] = [
  club('gros', 88), club('moyen', 60), club('prod2_a', 50),
  club('prod2_b', 42), club('prod2_c', 32),
];

describe('le prêt est réservé à ceux qui en ont besoin', () => {
  it('accepte un jeune qui ne joue pas', () => {
    expect(isLoanable({ player: jeune(), playRatio: 0.1, currentSeason: 2025 })).toBe(true);
  });

  it('refuse celui qui joue déjà ici', () => {
    // Prêter un titulaire n'a aucun sens formateur.
    expect(isLoanable({ player: jeune(), playRatio: 0.8, currentSeason: 2025 })).toBe(false);
  });

  it('refuse un joueur trop âgé pour un prêt formateur', () => {
    const vétéran = jeune({ birthDate: '1993-01-01' });
    expect(isLoanable({ player: vétéran, playRatio: 0.1, currentSeason: 2025 })).toBe(false);
    // La limite se lit dans le module, pas dans ce test.
    expect(LOAN_MAX_AGE).toBeGreaterThan(20);
  });

  it('refuse celui dont le contrat s\'achève — le prêter serait le perdre', () => {
    const finContrat = jeune({
      contract: { startSeason: 2023, endSeason: 2025, annualSalary: 90_000 },
    });
    expect(isLoanable({ player: finContrat, playRatio: 0.1, currentSeason: 2025 })).toBe(false);
  });

  it('refuse un blessé et un joueur libre', () => {
    const blessé = jeune({
      dynamic: {
        ...BASE.dynamic,
        injury: {
          type: 'MUSCULAIRE', startedAt: 6, estimatedReturnAt: 12, hasSequela: false,
        },
      },
    });
    expect(isLoanable({ player: blessé, playRatio: 0.1, currentSeason: 2025 })).toBe(false);
    expect(isLoanable({ player: jeune({ freeAgent: true }), playRatio: 0.1, currentSeason: 2025 }))
      .toBe(false);
  });
});

describe('les offres sont un arbitrage', () => {
  const offres = () => loanOffersFor({
    player: jeune(),
    clubs: ACCUEIL,
    ownClubId: 'c1' as ClubId,
    rng: createRng('offres'),
  });

  it('ne propose que des clubs à la portée d\'un espoir', () => {
    for (const o of offres()) {
      const c = ACCUEIL.find(x => x.id === o.clubId)!;
      expect(c.reputation).toBeLessThanOrEqual(62);
    }
  });

  it('n\'en propose jamais plus de trois', () => {
    expect(offres().length).toBeLessThanOrEqual(3);
  });

  it('plus le club est modeste, plus il fait jouer et moins il paie', () => {
    const petit = loanOffersFor({
      player: jeune(), clubs: [club('petit', 32)], ownClubId: 'c1' as ClubId, rng: createRng('p'),
    })[0]!;
    const gros = loanOffersFor({
      player: jeune(), clubs: [club('gros', 62)], ownClubId: 'c1' as ClubId, rng: createRng('g'),
    })[0]!;
    expect(petit.playingTime).toBeGreaterThan(gros.playingTime);
    expect(petit.wageShare).toBeLessThan(gros.wageShare);
  });

  it('range les propositions par temps de jeu promis', () => {
    const o = offres();
    for (let i = 1; i < o.length; i++) {
      expect(o[i - 1]!.playingTime).toBeGreaterThanOrEqual(o[i]!.playingTime);
    }
  });

  it('ne propose rien quand aucun club n\'est à sa portée', () => {
    expect(loanOffersFor({
      player: jeune(), clubs: [club('enorme', 95)], ownClubId: 'c1' as ClubId, rng: createRng('x'),
    })).toEqual([]);
  });

  it('dit ce que la décision coûte, pas seulement ce qu\'elle rapporte', () => {
    const o = offres()[0]!;
    const texte = loanTradeoff(o, jeune());
    expect(texte).toContain('contre');
    expect(texte).toContain('indisponible');
  });
});

describe('ce que le prêt rapporte et ce qu\'il coûte', () => {
  const loan: ActiveLoan = {
    playerId: 'p' as PlayerId,
    playerName: 'Jean Dupuis',
    clubId: 'prod2_b' as ClubId,
    clubName: 'Club prod2_b',
    season: 2025,
    playingTime: 0.8,
    wageShare: 0.5,
  };

  it('rapporte des minutes, et c\'est ce qui fait progresser', () => {
    const minutes = loanMinutes(loan, 26);
    // Une saison quasi pleine ailleurs : nettement plus que sur le banc ici.
    expect(minutes).toBeGreaterThan(1200);
  });

  it('rapporte à proportion de ce qui a été promis', () => {
    const peu = loanMinutes({ ...loan, playingTime: 0.3 }, 26);
    expect(peu).toBeLessThan(loanMinutes(loan, 26) / 2);
  });

  it('coûte la part de salaire que le club accueillant ne prend pas', () => {
    expect(loanCost(loan, 100_000)).toBe(50_000);
    expect(loanCost({ ...loan, wageShare: 1 }, 100_000)).toBe(0);
  });

  it('rend compte franchement quand le prêt a échoué', () => {
    expect(loanReport(loan, loanMinutes({ ...loan, playingTime: 0.1 }, 26)))
      .toContain('pas tenu ses promesses');
  });

  it('et salue une saison pleine', () => {
    expect(loanReport(loan, loanMinutes(loan, 26))).toContain('saison pleine');
  });
});

describe('la part de salaire prise par le club d\'accueil', () => {
  const pret = (playerId: string, wageShare: number): ActiveLoan => ({
    playerId: playerId as PlayerId,
    playerName: 'Jeune',
    clubId: 'ailleurs' as ClubId,
    clubName: 'Ailleurs',
    season: 2025,
    playingTime: 0.6,
    wageShare,
  });

  const salaires = new Map<string, number>([['p1', 130_000], ['p2', 260_000]]);
  const salaireDe = (id: PlayerId): number | undefined => salaires.get(id as string);

  it('allège la feuille de paie journée après journée', () => {
    // V0.60 : `wageShare` ne servait qu'à l'affichage, le prêteur payait tout.
    const relief = loanWageReliefPerRound([pret('p1', 0.5)], salaireDe, 26);
    expect(relief).toBe(Math.round(130_000 * 0.5 / 26));
  });

  it('cumule les prêts en cours', () => {
    const relief = loanWageReliefPerRound([pret('p1', 0.5), pret('p2', 0.25)], salaireDe, 26);
    expect(relief).toBe(Math.round((130_000 * 0.5 + 260_000 * 0.25) / 26));
  });

  it('ignore un joueur qui n\'est plus à l\'effectif', () => {
    expect(loanWageReliefPerRound([pret('parti', 0.5)], salaireDe, 26)).toBe(0);
  });

  it('et ne divise jamais par zéro journée', () => {
    expect(loanWageReliefPerRound([pret('p1', 0.5)], salaireDe, 0)).toBe(0);
  });
});

// =============================================================================
// V0.64 : l'option d'achat et le rappel anticipé
// =============================================================================

describe('l\'option d\'achat', () => {
  const pret = (over: Partial<ActiveLoan> = {}): ActiveLoan => ({
    playerId: 'p1' as PlayerId, playerName: 'Dupont',
    clubId: 'c2' as ClubId, clubName: 'Vannes',
    season: 2026, playingTime: 0.8, wageShare: 0.5,
    ...over,
  });

  it('un club d\'accueil sur trois en demande une', () => {
    const clubs = [club('a', 40), club('b', 45), club('c', 50)];
    const avecOption = ['s1', 's2', 's3', 's4', 's5', 's6'].flatMap(seed => loanOffersFor({
      player: jeune(), clubs, ownClubId: 'c1' as ClubId,
      rng: createRng(seed), optionValue: 1_000_000,
    })).filter(o => o.optionToBuy !== undefined);
    expect(avecOption.length).toBeGreaterThan(0);
    for (const o of avecOption) expect(o.optionToBuy!.fee).toBeGreaterThan(0);
  });

  it('une option obligatoire se paie moins cher qu\'une option laissée au choix', () => {
    const clubs = [club('a', 40), club('b', 45), club('c', 50)];
    const toutes = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].flatMap(seed => loanOffersFor({
      player: jeune(), clubs, ownClubId: 'c1' as ClubId,
      rng: createRng(seed), optionValue: 1_000_000,
    })).map(o => o.optionToBuy).filter((o): o is NonNullable<typeof o> => o !== undefined);
    const obligatoires = toutes.filter(o => o.mandatory);
    const facultatives = toutes.filter(o => !o.mandatory);
    if (obligatoires.length > 0 && facultatives.length > 0) {
      expect(obligatoires[0]!.fee).toBeLessThan(facultatives[0]!.fee);
    }
  });

  it('sans valeur transmise, aucune option ne peut être chiffrée', () => {
    const sansValeur = loanOffersFor({
      player: jeune(), clubs: [club('a', 40), club('b', 45), club('c', 50)],
      ownClubId: 'c1' as ClubId, rng: createRng('option'),
    });
    expect(sansValeur.every(o => o.optionToBuy === undefined)).toBe(true);
  });

  it('une option obligatoire se lève quoi qu\'il arrive', () => {
    const res = resolveLoanOption({
      loan: pret({ optionToBuy: { fee: 900_000, mandatory: true } }),
      minutesPlayed: 0, roundsPlayed: 26,
    });
    expect(res.kind).toBe('LEVEE');
  });

  it('une option facultative se juge sur les minutes réelles', () => {
    const loan = pret({ optionToBuy: { fee: 900_000, mandatory: false } });
    const beaucoup = resolveLoanOption({ loan, minutesPlayed: 26 * 0.8 * 72, roundsPlayed: 26 });
    const blesse = resolveLoanOption({ loan, minutesPlayed: 300, roundsPlayed: 26 });
    expect(beaucoup.kind).toBe('LEVEE');
    expect(blesse.kind).toBe('ABANDONNEE');
  });

  it('un rappel anticipé fait tomber l\'option', () => {
    const loan = recallLoan(pret({ optionToBuy: { fee: 900_000, mandatory: true } }), 12);
    expect(loan.optionToBuy).toBeUndefined();
    expect(resolveLoanOption({ loan, minutesPlayed: 2000, roundsPlayed: 26 }).kind).toBe('AUCUNE');
  });
});

describe('le rappel anticipé', () => {
  const pret = (over: Partial<ActiveLoan> = {}): ActiveLoan => ({
    playerId: 'p1' as PlayerId, playerName: 'Dupont',
    clubId: 'c2' as ClubId, clubName: 'Vannes',
    season: 2026, playingTime: 0.8, wageShare: 0.5,
    ...over,
  });

  it('ne s\'obtient qu\'en crise de blessures', () => {
    const base = { loan: pret(), round: 10, totalRounds: 26 };
    expect(canRecall({ ...base, healthyCoverAtPosition: 3 }).allowed).toBe(false);
    expect(canRecall({ ...base, healthyCoverAtPosition: 1 }).allowed).toBe(true);
  });

  it('ne se demande pas deux fois, ni en fin de saison', () => {
    expect(canRecall({
      loan: recallLoan(pret(), 8), healthyCoverAtPosition: 0, round: 12, totalRounds: 26,
    }).allowed).toBe(false);
    expect(canRecall({
      loan: pret(), healthyCoverAtPosition: 0, round: 26, totalRounds: 26,
    }).allowed).toBe(false);
  });
});
