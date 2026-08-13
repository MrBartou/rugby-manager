/**
 * Le règlement opposable — V0.45.
 *
 * La propriété qui gouverne le calibrage : **personne ne doit être condamné au
 * coup d'envoi**. Une règle qui met douze clubs sur quatorze en infraction dès
 * la première journée n'est pas une contrainte, c'est un jeu cassé — c'est ce
 * qui s'est produit avec le plafond officiel de 10 M€ et un quota JIFF exprimé
 * en nombre absolu.
 */

import { describe, expect, it } from 'vitest';
import {
  CAP_TOLERANCE,
  SALARY_CAP_PRO_D2,
  SALARY_CAP_TOP14,
  canRegister,
  capReport,
  computePayroll,
  countsAsOffence,
  headroomAfterSigning,
  jiffReport,
  matchSheetCompliant,
  reviewLeague,
  reviewSeason,
  salaryCapFor,
  sanctionSummary,
  withCapUsage,
} from '../../src/engine/club/regulations.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player } from '../../src/engine/types.js';

const SQUAD: readonly Player[] = makeSquad('t' as ClubId, 70).players;

function withSalary(players: readonly Player[], annual: number): readonly Player[] {
  return players.map(p => ({ ...p, contract: { ...p.contract, annualSalary: annual } }));
}

function withJiff(players: readonly Player[], jiffCount: number): readonly Player[] {
  return players.map((p, i) => ({ ...p, isJiff: i < jiffCount }));
}

const CLUB: Club = {
  id: 't' as ClubId, name: 'Test', shortName: 'TST', city: 'Ville',
  tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000, annualBudget: 20_000_000,
  salaryCapUsage: 0, jiffCount: 0, reputation: 50,
};

describe('masse salariale', () => {
  it('ne compte que ceux qu\'on paie', () => {
    // Les blessés comptent — c'est tout l'intérêt d'un plafond : on paie même
    // ceux qui ne jouent pas. Les retraités et agents libres, non.
    const roster: readonly Player[] = [
      ...withSalary(SQUAD.slice(0, 3), 100_000),
      { ...SQUAD[3]!, retired: true, contract: { ...SQUAD[3]!.contract, annualSalary: 999_000 } },
      { ...SQUAD[4]!, freeAgent: true, contract: { ...SQUAD[4]!.contract, annualSalary: 999_000 } },
    ];
    expect(computePayroll(roster)).toBe(300_000);
  });

  it('distingue les deux étages', () => {
    expect(salaryCapFor('TOP14')).toBe(SALARY_CAP_TOP14);
    expect(salaryCapFor('PRO_D2')).toBe(SALARY_CAP_PRO_D2);
    expect(SALARY_CAP_PRO_D2).toBeLessThan(SALARY_CAP_TOP14);
  });

  it('rend un club descendu mécaniquement hors des clous', () => {
    // Il garde ses contrats de Top 14 : la relégation impose de dégraisser.
    const roster = withSalary(SQUAD, 300_000);
    expect(capReport(roster, 'TOP14').status).not.toBe('DEPASSEMENT');
    expect(capReport(roster, 'PRO_D2').status).toBe('DEPASSEMENT');
  });

  it('tolère un léger dépassement sans convoquer la commission', () => {
    // Une prime ou un joker médical ne doit pas déclencher une sanction.
    const juste = Math.floor((SALARY_CAP_TOP14 * (1 + CAP_TOLERANCE * 0.5)) / SQUAD.length);
    expect(capReport(withSalary(SQUAD, juste), 'TOP14').status).not.toBe('DEPASSEMENT');
  });

  it('signale la tension avant la rupture', () => {
    const tendu = Math.floor((SALARY_CAP_TOP14 * 0.95) / SQUAD.length);
    expect(capReport(withSalary(SQUAD, tendu), 'TOP14').status).toBe('TENDU');
  });

  it('répond avant la signature, pas au bilan', () => {
    const roster = withSalary(SQUAD, 100_000);
    const avant = capReport(roster, 'TOP14').headroom;
    expect(headroomAfterSigning(roster, 'TOP14', 500_000)).toBe(avant - 500_000);
  });

  it('inscrit la consommation réelle sur le club', () => {
    // `salaryCapUsage` était un champ mis à zéro partout et jamais calculé.
    const updated = withCapUsage(CLUB, withSalary(SQUAD, 100_000));
    expect(updated.salaryCapUsage).toBe(computePayroll(withSalary(SQUAD, 100_000)));
  });
});

describe('quota JIFF', () => {
  it('s\'apprécie en proportion, pas en nombre', () => {
    // Un seuil absolu de seize mettait douze clubs sur quatorze hors des clous.
    const petit = jiffReport(withJiff(SQUAD.slice(0, 17), 9));
    expect(petit.compliant).toBe(true);
    expect(petit.required).toBe(9);
  });

  it('dit combien d\'étrangers on peut encore enregistrer', () => {
    // C'est la seule formulation qui serve à décider devant une offre.
    const serre = jiffReport(withJiff(SQUAD.slice(0, 17), 9));
    const large = jiffReport(withJiff(SQUAD.slice(0, 17), 15));
    expect(large.foreignHeadroom).toBeGreaterThan(serre.foreignHeadroom);
  });

  it('ne se dégrade qu\'en recrutant hors formation française', () => {
    const base = withJiff(SQUAD.slice(0, 16), 8);
    expect(jiffReport(base).compliant).toBe(true);
    const avecEtrangers: readonly Player[] = [
      ...base,
      ...SQUAD.slice(16, 20).map(p => ({ ...p, isJiff: false })),
    ];
    expect(jiffReport(avecEtrangers).compliant).toBe(false);
  });

  it('contrôle aussi la feuille de match', () => {
    expect(matchSheetCompliant(withJiff(SQUAD.slice(0, 23), 12))).toBe(true);
    expect(matchSheetCompliant(withJiff(SQUAD.slice(0, 23), 5))).toBe(false);
  });
});

describe('la commission', () => {
  const conforme = capReport(withSalary(SQUAD, 100_000), 'TOP14');
  const jiffOk = jiffReport(withJiff(SQUAD, SQUAD.length));

  it('ne sanctionne pas un club en règle', () => {
    expect(reviewSeason({ cap: conforme, jiff: jiffOk, repeatOffender: false })).toEqual([]);
  });

  it('inflige une amende pour un dépassement modéré, sans toucher au classement', () => {
    // Retirer des points pour 10 % de dépassement condamnerait la saison
    // suivante avant qu'elle ne commence.
    const leger = capReport(withSalary(SQUAD, Math.floor(SALARY_CAP_TOP14 * 1.1 / SQUAD.length)), 'TOP14');
    const out = reviewSeason({ cap: leger, jiff: jiffOk, repeatOffender: false });
    expect(out[0]!.kind).toBe('AMENDE');
    expect(out[0]!.pointsDeducted).toBe(0);
  });

  it('retire des points au-delà de vingt pour cent', () => {
    const lourd = capReport(withSalary(SQUAD, Math.floor(SALARY_CAP_TOP14 * 1.4 / SQUAD.length)), 'TOP14');
    const out = reviewSeason({ cap: lourd, jiff: jiffOk, repeatOffender: false });
    expect(out[0]!.kind).toBe('RETRAIT_POINTS');
    expect(out[0]!.pointsDeducted).toBeGreaterThan(0);
    expect(out[0]!.transferBan).toBe(true);
  });

  it('plafonne le retrait pour ne pas condamner la saison suivante', () => {
    const enorme = capReport(withSalary(SQUAD, SALARY_CAP_TOP14), 'TOP14');
    expect(reviewSeason({ cap: enorme, jiff: jiffOk, repeatOffender: true })[0]!.pointsDeducted)
      .toBeLessThanOrEqual(12);
  });

  it('durcit pour un récidiviste', () => {
    const leger = capReport(withSalary(SQUAD, Math.floor(SALARY_CAP_TOP14 * 1.1 / SQUAD.length)), 'TOP14');
    expect(reviewSeason({ cap: leger, jiff: jiffOk, repeatOffender: true })[0]!.kind)
      .toBe('RETRAIT_POINTS');
  });

  it('sanctionne le quota séparément du plafond', () => {
    const jiffHors = jiffReport(withJiff(SQUAD, 2));
    const out = reviewSeason({ cap: conforme, jiff: jiffHors, repeatOffender: false });
    expect(out).toHaveLength(1);
    expect(out[0]!.transferBan).toBe(true);
  });

  it('résume ce qu\'il en coûte', () => {
    const lourd = capReport(withSalary(SQUAD, Math.floor(SALARY_CAP_TOP14 * 1.4 / SQUAD.length)), 'TOP14');
    const s = reviewSeason({ cap: lourd, jiff: jiffOk, repeatOffender: false })[0]!;
    expect(sanctionSummary(s)).toMatch(/points retirés/);
    expect(sanctionSummary(s)).toMatch(/interdiction de recruter/);
  });
});

describe('enregistrement d\'une recrue', () => {
  const roster = withSalary(SQUAD, 100_000);

  it('laisse forcer le dépassement, en le disant', () => {
    // Interdire ferait de la règle une validation de formulaire ; l'avertir en
    // fait une décision.
    const out = canRegister({ roster, division: 'TOP14', annualSalary: SALARY_CAP_TOP14, transferBan: false });
    expect(out.allowed).toBe(true);
    expect(out.warning).toMatch(/Dépassement/);
  });

  it('refuse pendant une interdiction de recruter', () => {
    const out = canRegister({ roster, division: 'TOP14', annualSalary: 100_000, transferBan: true });
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/interdiction/i);
  });

  it('ne dit rien quand tout va bien', () => {
    const out = canRegister({ roster, division: 'TOP14', annualSalary: 100_000, transferBan: false });
    expect(out.allowed).toBe(true);
    expect(out.warning).toBeUndefined();
  });
});

describe('la récidive ne s\'arme pas sur un avertissement', () => {
  it('un avertissement sans suite ne compte pas comme antécédent', () => {
    // Il armait la récidive au même titre qu'un retrait de points : un club
    // prévenu une fois repartait récidiviste l'année suivante.
    expect(countsAsOffence({
      kind: 'AVERTISSEMENT',
      reason: 'quota JIFF juste sous le seuil',
      pointsDeducted: 0,
      fine: 0,
      transferBan: false,
    })).toBe(false);
  });

  it('une amende, un retrait ou une interdiction, oui', () => {
    const base = {
      kind: 'AMENDE' as const,
      reason: 'dépassement',
      pointsDeducted: 0,
      fine: 0,
      transferBan: false,
    };
    expect(countsAsOffence({ ...base, fine: 250_000 })).toBe(true);
    expect(countsAsOffence({ ...base, pointsDeducted: 3 })).toBe(true);
    expect(countsAsOffence({ ...base, transferBan: true })).toBe(true);
  });
});

/**
 * La revue de la commission, pour tout le championnat : V0.62.
 *
 * Ces règles vivaient dans `App.tsx`, mêlées à la publication des actualités et
 * à l'écriture d'une demi-douzaine de références React. Elles décident des
 * points retirés, des interdictions de recruter et des amendes de toute une
 * division : rien n'en était testable tant que ça vivait dans un composant.
 */
describe('la revue annuelle de tout le championnat', () => {
  const club = (id: string): Club => ({
    id: id as ClubId,
    name: `Club ${id}`,
    shortName: id.toUpperCase(),
    city: 'Ville',
    tier: 'BUDGET_MOYEN',
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000,
    annualBudget: 12_000_000,
    salaryCapUsage: 0,
    jiffCount: 15,
    reputation: 60,
  });

  /** Un effectif conforme : sous le plafond, quota JIFF tenu. */
  const conforme = (): readonly Player[] => withJiff(withSalary(SQUAD, 200_000), SQUAD.length);

  /** Un effectif très au-dessus du plafond : la sanction doit mordre. */
  const horsClous = (): readonly Player[] => withJiff(withSalary(SQUAD, 900_000), SQUAD.length);

  it('ne retient que les clubs sanctionnés', () => {
    const revue = reviewLeague({
      clubs: [club('a'), club('b')],
      division: 'TOP14',
      rosterOf: (id) => (id === ('a' as ClubId) ? horsClous() : conforme()),
      repeatOffenders: new Set(),
    });

    expect(revue.reviews.map(r => r.clubId)).toEqual(['a']);
  });

  it('agrège points, amendes et interdictions', () => {
    const revue = reviewLeague({
      clubs: [club('a')],
      division: 'TOP14',
      rosterOf: horsClous,
      repeatOffenders: new Set(),
    });

    const bilan = revue.reviews[0]!;
    expect(bilan.pointsDeducted).toBe(
      bilan.verdicts.reduce((n, v) => n + v.pointsDeducted, 0),
    );
    expect(bilan.fine).toBe(bilan.verdicts.reduce((n, v) => n + v.fine, 0));
    expect(revue.penaltiesByClub.get('a' as ClubId)).toBe(bilan.pointsDeducted || undefined);
  });

  it('la récidive aggrave, et ne s\'arme que sur une vraie sanction', () => {
    // V0.60 : un simple avertissement armait la récidive, ce qui accélérait
    // les retraits de points de tout le championnat.
    const sansAntecedent = reviewLeague({
      clubs: [club('a')],
      division: 'TOP14',
      rosterOf: horsClous,
      repeatOffenders: new Set(),
    });
    const avecAntecedent = reviewLeague({
      clubs: [club('a')],
      division: 'TOP14',
      rosterOf: horsClous,
      repeatOffenders: new Set(['a' as ClubId]),
    });

    expect(avecAntecedent.reviews[0]!.pointsDeducted)
      .toBeGreaterThanOrEqual(sansAntecedent.reviews[0]!.pointsDeducted);
    expect([...sansAntecedent.repeatOffenders]).toEqual(['a']);
  });

  it('ne juge pas un club sans effectif', () => {
    // Une liste vide n'est pas un club conforme : c'est un club qu'on ne sait
    // pas juger, et le sanctionner n'aurait aucun sens.
    const revue = reviewLeague({
      clubs: [club('vide')],
      division: 'TOP14',
      rosterOf: () => [],
      repeatOffenders: new Set(),
    });
    expect(revue.reviews).toEqual([]);
    expect(revue.repeatOffenders.size).toBe(0);
  });

  it('applique le plafond de la division jouée', () => {
    // Le même effectif est conforme en Top 14 et hors des clous en Pro D2,
    // dont le plafond vaut moins de la moitié.
    const effectif = (): readonly Player[] => withJiff(withSalary(SQUAD, 350_000), SQUAD.length);
    const top14 = reviewLeague({
      clubs: [club('a')], division: 'TOP14', rosterOf: effectif, repeatOffenders: new Set(),
    });
    const prod2 = reviewLeague({
      clubs: [club('a')], division: 'PRO_D2', rosterOf: effectif, repeatOffenders: new Set(),
    });

    expect(top14.reviews.length).toBeLessThan(prod2.reviews.length + 1);
    expect(prod2.reviews.length).toBe(1);
  });
});
