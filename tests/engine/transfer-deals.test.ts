/**
 * La forme d'un transfert — V0.64.
 *
 * Ce qui est vérifié ici : un montage ne doit jamais être gratuit. Étaler
 * l'indemnité coûte au vendeur, donc il en demande davantage ; une part de
 * revente vaut quelque chose, mais pas son nominal, sinon elle remplacerait
 * l'argent et le mercato n'aurait plus de contrainte du tout.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_INSTALMENTS,
  discountRate,
  effectiveFee,
  normaliseTerms,
  outstandingDebt,
  presentValueOfFee,
  pruneLedger,
  scheduleInstalments,
  sellOnInstalment,
  sellOnWorth,
  settleDueInstalments,
  upfrontCost,
  type DealTerms,
} from '../../src/engine/club/transfer-deals.js';
import type { ClubId, PlayerId } from '../../src/engine/types.js';

const RICHE = 20_000_000;
const FAUCHE = -1_000_000;

const termes = (over: Partial<DealTerms> = {}): DealTerms => ({
  fee: 3_000_000, instalments: 1, sellOn: 0, ...over,
});

describe('les termes se bornent', () => {
  it('un échelonnement absurde retombe dans le domaine du possible', () => {
    expect(normaliseTerms(termes({ instalments: 0 })).instalments).toBe(1);
    expect(normaliseTerms(termes({ instalments: 12 })).instalments).toBe(MAX_INSTALMENTS);
  });

  it('la part de revente se plafonne à trente pour cent', () => {
    expect(normaliseTerms(termes({ sellOn: 0.8 })).sellOn).toBe(0.30);
    expect(normaliseTerms(termes({ sellOn: -0.2 })).sellOn).toBe(0);
  });
});

describe('ce que le vendeur en retire', () => {
  it('trois millions étalés valent moins que trois millions comptant', () => {
    expect(presentValueOfFee(3_000_000, 3, 0.08)).toBeLessThan(3_000_000);
    expect(presentValueOfFee(3_000_000, 1, 0.08)).toBe(3_000_000);
  });

  it('un club dans le rouge escompte bien plus durement', () => {
    expect(discountRate(FAUCHE)).toBeGreaterThan(discountRate(RICHE));
    expect(effectiveFee(termes({ instalments: 4 }), FAUCHE))
      .toBeLessThan(effectiveFee(termes({ instalments: 4 }), RICHE));
  });

  it('une part de revente vaut quelque chose, mais bien moins que son nominal', () => {
    const worth = sellOnWorth(3_000_000, 0.20, RICHE);
    expect(worth).toBeGreaterThan(0);
    expect(worth).toBeLessThan(3_000_000 * 0.20 * 2);
  });

  it('et elle ne nourrit pas un club qui a besoin de liquide', () => {
    expect(sellOnWorth(3_000_000, 0.20, FAUCHE))
      .toBeLessThan(sellOnWorth(3_000_000, 0.20, RICHE));
  });

  it('un montage ne remplace jamais l\'argent : quatre ans plus trente pour cent ne valent pas le comptant', () => {
    // La règle de sûreté du module. Si elle tombe, on achète le championnat
    // avec des promesses.
    const montage = effectiveFee(termes({ instalments: 4, sellOn: 0.30 }), RICHE);
    expect(montage).toBeLessThan(termes().fee * 1.15);
  });
});

describe('ce que l\'acheteur sort le jour même', () => {
  it('une seule annuité, et c\'est tout l\'intérêt de la manœuvre', () => {
    expect(upfrontCost(termes({ fee: 4_000_000, instalments: 4 }))).toBe(1_000_000);
    expect(upfrontCost(termes({ fee: 4_000_000 }))).toBe(4_000_000);
  });
});

describe('le registre des échéances', () => {
  const args = {
    payerClubId: 'acheteur' as ClubId,
    payeeClubId: 'vendeur' as ClubId,
    playerId: 'p1' as PlayerId,
    playerName: 'Dupont',
    season: 2025,
  };

  it('la première annuité n\'y figure pas : elle est déjà payée', () => {
    const plan = scheduleInstalments({ ...args, terms: termes({ fee: 4_000_000, instalments: 4 }) });
    expect(plan).toHaveLength(3);
    expect(plan.map(i => i.season)).toEqual([2026, 2027, 2028]);
    expect(plan.reduce((s, i) => s + i.amount, 0)).toBe(3_000_000);
  });

  it('un paiement comptant ne laisse aucune créance', () => {
    expect(scheduleInstalments({ ...args, terms: termes() })).toHaveLength(0);
  });

  it('se solde à la saison dite, et pas avant', () => {
    const ledger = scheduleInstalments({ ...args, terms: termes({ fee: 3_000_000, instalments: 3 }) });
    const en2025 = settleDueInstalments(ledger, 2025);
    expect(en2025.settled).toHaveLength(0);

    const en2026 = settleDueInstalments(ledger, 2026);
    expect(en2026.settled).toHaveLength(1);
    expect(en2026.remaining).toHaveLength(1);
    expect(en2026.netFor('vendeur' as ClubId)).toBe(1_000_000);
    expect(en2026.netFor('acheteur' as ClubId)).toBe(-1_000_000);
  });

  it('une créance en retard se rattrape au lieu de disparaître', () => {
    // Le cas de la sauvegarde chargée deux saisons plus tard : tout ce qui est
    // échu est dû, pas seulement l'échéance de l'année.
    const ledger = scheduleInstalments({ ...args, terms: termes({ fee: 3_000_000, instalments: 3 }) });
    expect(settleDueInstalments(ledger, 2030).settled).toHaveLength(2);
    expect(settleDueInstalments(ledger, 2030).remaining).toHaveLength(0);
  });

  it('la dette d\'un club se lit d\'un coup d\'œil', () => {
    const ledger = scheduleInstalments({ ...args, terms: termes({ fee: 3_000_000, instalments: 3 }) });
    expect(outstandingDebt(ledger, 'acheteur' as ClubId)).toBe(2_000_000);
    expect(outstandingDebt(ledger, 'vendeur' as ClubId)).toBe(0);
  });

  it('une revente crée une créance immédiate', () => {
    const due = sellOnInstalment({ ...args, amount: 450_000 });
    expect(due.reason).toBe('REVENTE');
    expect(settleDueInstalments([due], 2025).settled).toHaveLength(1);
  });

  it('un club disparu du championnat n\'est plus ni débiteur ni créancier', () => {
    const ledger = scheduleInstalments({ ...args, terms: termes({ fee: 3_000_000, instalments: 3 }) });
    const connus = new Set<ClubId>(['acheteur' as ClubId]);
    expect(pruneLedger(ledger, connus)).toHaveLength(0);
  });
});
