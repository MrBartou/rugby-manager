/**
 * Messagerie du manager — V0.42.
 *
 * Deux propriétés portent le module : la boîte ne **duplique** pas — rejouer une
 * intersaison après un rechargement est le cas normal — et surtout elle ne
 * **rouvre pas** un message déjà lu, sans quoi le compteur de non-lus mentirait
 * à chaque chargement de sauvegarde.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_MAILBOX,
  MAIL_CAPACITY,
  appendMail,
  filterMails,
  mailAcademyIntake,
  mailInjury,
  mailJobOffers,
  mailMilestone,
  mailBoardReview,
  mailObjectiveSet,
  mailPressInterview,
  mailSeasonVerdict,
  mailTransfer,
  mailTransferBudget,
  answerMail,
  effectOf,
  pendingAnswers,
  markAllRead,
  markRead,
  seasonLabel,
  seasonsInMailbox,
  unreadCount,
  type MailDraft,
} from '../../src/engine/season/mailbox.js';
import type { ClubId } from '../../src/engine/types.js';

const CLUB = 'sfp' as ClubId;

function draft(over: Partial<MailDraft> = {}): MailDraft {
  return {
    season: 2026, round: 5, sender: 'PRESIDENT',
    subject: 'Un sujet', body: 'Un corps.', importance: 'NORMALE', ...over,
  };
}

describe('boîte', () => {
  it('dépose le plus récent en tête, quel que soit l\'ordre d\'arrivée', () => {
    let box = appendMail(EMPTY_MAILBOX, [draft({ subject: 'a', round: 14 })]);
    box = appendMail(box, [draft({ subject: 'b', round: 3 })]);
    box = appendMail(box, [draft({ subject: 'c', round: 2, season: 2027 })]);
    expect(box.mails.map(m => m.subject)).toEqual(['c', 'a', 'b']);
  });

  it('ne duplique pas un message déjà déposé', () => {
    const d = draft();
    expect(appendMail(appendMail(EMPTY_MAILBOX, [d]), [d]).mails).toHaveLength(1);
  });

  it('ne rouvre pas un message déjà lu', () => {
    // Sans cela, chaque rechargement de sauvegarde rendrait toute la boîte
    // non-lue et le badge de navigation ne voudrait plus rien dire.
    const d = draft();
    let box = appendMail(EMPTY_MAILBOX, [d]);
    box = markRead(box, box.mails[0]!.id);
    box = appendMail(box, [d]);
    expect(unreadCount(box)).toBe(0);
  });

  it('plafonne pour ne pas alourdir la sauvegarde', () => {
    let box = EMPTY_MAILBOX;
    for (let i = 0; i < MAIL_CAPACITY + 30; i++) {
      box = appendMail(box, [draft({ subject: `m${i}`, round: i })]);
    }
    expect(box.mails).toHaveLength(MAIL_CAPACITY);
    expect(box.mails[0]!.subject).toBe(`m${MAIL_CAPACITY + 29}`);
  });

  it('ne recrée pas d\'objet quand il n\'y a rien à déposer', () => {
    const box = appendMail(EMPTY_MAILBOX, [draft()]);
    expect(appendMail(box, [])).toBe(box);
    expect(markRead(box, 'inconnu')).toBe(box);
    const allRead = markAllRead(box);
    expect(markAllRead(allRead)).toBe(allRead);
  });

  it('compte et efface les non-lus', () => {
    let box = appendMail(EMPTY_MAILBOX, [draft({ subject: 'a' }), draft({ subject: 'b' })]);
    expect(unreadCount(box)).toBe(2);
    box = markRead(box, box.mails[0]!.id);
    expect(unreadCount(box)).toBe(1);
    expect(unreadCount(markAllRead(box))).toBe(0);
  });
});

describe('filtres', () => {
  const box = appendMail(EMPTY_MAILBOX, [
    draft({ sender: 'PRESIDENT', subject: 'A', season: 2026 }),
    draft({ sender: 'AGENT', subject: 'B', season: 2026 }),
    draft({ sender: 'PRESIDENT', subject: 'C', season: 2027 }),
  ]);

  it('filtre par expéditeur', () => {
    expect(filterMails(box, { sender: 'PRESIDENT' })).toHaveLength(2);
  });

  it('filtre par saison', () => {
    expect(filterMails(box, { season: 2027 })).toHaveLength(1);
  });

  it('filtre les non-lus', () => {
    const read = markRead(box, box.mails[0]!.id);
    expect(filterMails(read, { unreadOnly: true })).toHaveLength(2);
  });

  it('liste les saisons de la plus récente à la plus ancienne', () => {
    expect(seasonsInMailbox(box)).toEqual([2027, 2026]);
  });
});

describe('rédaction', () => {
  it('accueille un nouvel arrivant autrement qu\'un habitué', () => {
    const base = {
      season: 2026, clubId: CLUB, clubName: 'Stade Français',
      objectiveKind: 'TOP_4' as const, objectiveLabel: 'Top 4', boardConfidence: 60,
    };
    expect(mailObjectiveSet({ ...base, seasonsAtClub: 0 }).body).toMatch(/Bienvenue/);
    expect(mailObjectiveSet({ ...base, seasonsAtClub: 2 }).body).not.toMatch(/Bienvenue/);
  });

  it('durcit le ton quand la confiance est entamée', () => {
    const mail = mailObjectiveSet({
      season: 2026, clubId: CLUB, clubName: 'Stade Français',
      objectiveKind: 'TOP_4', objectiveLabel: 'Top 4', boardConfidence: 20, seasonsAtClub: 2,
    });
    expect(mail.body).toMatch(/redressement/);
  });

  it('écrit un verdict différent pour chaque sort', () => {
    const base = {
      season: 2026, clubId: CLUB, clubName: 'Stade Français', finalRank: 7,
      objectiveLabel: 'Top 4', boardConfidence: 20,
    };
    const limoge = mailSeasonVerdict({ ...base, objectiveMet: false, wonTitle: false, verdict: 'LIMOGE' });
    const rate = mailSeasonVerdict({ ...base, objectiveMet: false, wonTitle: false, verdict: 'AVERTI' });
    const tenu = mailSeasonVerdict({ ...base, finalRank: 3, objectiveMet: true, wonTitle: false, verdict: 'RECONDUIT' });
    const titre = mailSeasonVerdict({ ...base, finalRank: 1, objectiveMet: true, wonTitle: true, verdict: 'RECONDUIT' });

    expect(limoge.subject).toMatch(/Fin de votre mission/);
    expect(rate.importance).toBe('HAUTE');
    expect(tenu.importance).toBe('NORMALE');
    expect(titre.subject).toMatch(/Bouclier/);
  });

  it('parle à un manager sans club autrement qu\'à un manager en poste', () => {
    expect(mailJobOffers({ season: 2026, clubNames: ['Vannes'], unemployed: true })!.body)
      .toMatch(/perd de sa valeur/);
    expect(mailJobOffers({ season: 2026, clubNames: ['Vannes'], unemployed: false })!.body)
      .toMatch(/Rien ne vous oblige/);
  });

  it('n\'écrit pas quand il n\'y a rien à dire', () => {
    expect(mailJobOffers({ season: 2026, clubNames: [], unemployed: true })).toBeUndefined();
    expect(mailAcademyIntake({ season: 2026, clubId: CLUB, count: 0, academyLevel: 10 }))
      .toBeUndefined();
    expect(mailTransfer({ season: 2026, round: 0, clubId: CLUB, arrivals: [], departures: [],
      windowLabel: 'Mercato estival' })).toBeUndefined();
  });

  it('signale un jalon de carrière, une seule fois par palier', () => {
    expect(mailMilestone({ season: 2030, seasonsManaged: 5, titles: 3, reputation: 70 })!.subject)
      .toMatch(/histoire/);
    expect(mailMilestone({ season: 2030, seasonsManaged: 5, titles: 0, reputation: 85 })!.subject)
      .toMatch(/staff national/);
    expect(mailMilestone({ season: 2030, seasonsManaged: 4, titles: 0, reputation: 50 }))
      .toBeUndefined();
  });

  it('n\'ouvre pas d\'arbitrage sur une enveloppe inexistante', () => {
    expect(mailTransferBudget({ season: 2026, clubId: CLUB, amount: 0 })).toBeUndefined();
    expect(mailTransferBudget({ season: 2026, clubId: CLUB, amount: 2_000_000 })).toBeDefined();
  });

  it('nomme les saisons à la française', () => {
    expect(seasonLabel(2025)).toBe('2025-26');
    expect(seasonLabel(2099)).toBe('2099-00');
  });
});

describe('messages à réponse — V0.43', () => {
  const press = mailPressInterview({ season: 2026, round: 9, clubName: 'Toulouse', losses: 4 });
  const board = mailBoardReview({
    season: 2026, round: 12, clubId: CLUB, rank: 11,
    objectiveLabel: 'Top 4', confidence: 24,
  });

  it('propose des réponses, chacune annonçant ce qu\'elle engage', () => {
    // Répondre à l'aveugle ne serait pas un choix : chaque option doit dire son prix.
    for (const mail of [press, board]) {
      expect(mail.actions!.length).toBeGreaterThanOrEqual(2);
      for (const a of mail.actions!) expect(a.hint.length).toBeGreaterThan(0);
    }
  });

  it('fige le message une fois répondu', () => {
    // Sans cela, on rejouerait la même décision à chaque ouverture de la boîte
    // et les effets se cumuleraient.
    let box = appendMail(EMPTY_MAILBOX, [press]);
    const id = box.mails[0]!.id;
    box = answerMail(box, id, 'PRESSE_ASSUMER');
    expect(box.mails[0]!.answeredWith).toBe('PRESSE_ASSUMER');

    const after = answerMail(box, id, 'PRESSE_ELUDER');
    expect(after).toBe(box);
    expect(after.mails[0]!.answeredWith).toBe('PRESSE_ASSUMER');
  });

  it('répondre vaut lecture', () => {
    let box = appendMail(EMPTY_MAILBOX, [board]);
    box = answerMail(box, box.mails[0]!.id, 'BOARD_REDRESSER');
    expect(unreadCount(box)).toBe(0);
  });

  it('refuse une option qui n\'était pas proposée', () => {
    const box = appendMail(EMPTY_MAILBOX, [press]);
    expect(answerMail(box, box.mails[0]!.id, 'BOARD_MOYENS')).toBe(box);
  });

  it('liste ce qui attend encore une décision', () => {
    let box = appendMail(EMPTY_MAILBOX, [press, board, draft({ subject: 'simple info' })]);
    expect(pendingAnswers(box)).toHaveLength(2);
    box = answerMail(box, box.mails.find(m => m.actions)!.id, 'BOARD_REDRESSER');
    expect(pendingAnswers(box)).toHaveLength(1);
  });

  it('arbitre franchise et popularité en sens contraires', () => {
    // Défendre son groupe grandit l'entraîneur et agace le bureau ; c'est
    // exactement l'arbitrage qui rend la réponse intéressante.
    const assumer = effectOf('PRESSE_ASSUMER');
    const defendre = effectOf('PRESSE_DEFENDRE');
    expect(defendre.reputationDelta).toBeGreaterThan(assumer.reputationDelta);
    expect(defendre.confidenceDelta).toBeLessThan(assumer.confidenceDelta);
  });

  it('lit le montant porté par l\'identifiant de réponse', () => {
    // L'enveloppe varie d'un contrat à l'autre : elle voyage dans l'id pour
    // qu'une réponse reste une simple chaîne, relisible des saisons plus tard.
    expect(effectOf('BUDGET_DEPENSER:2500000').cashDelta).toBe(2_500_000);
    expect(effectOf('BUDGET_DEPENSER').cashDelta).toBe(0);
    expect(effectOf('BUDGET_GARDER').cashDelta).toBe(0);
  });

  it('ne casse pas sur une réponse inconnue', () => {
    // Une sauvegarde ancienne peut porter un identifiant qui n'existe plus.
    const e = effectOf('OPTION_DISPARUE');
    expect(e.reputationDelta).toBe(0);
    expect(e.cashDelta).toBe(0);
  });
});

describe('sollicitations récurrentes — V0.43', () => {
  it('ne convoque qu\'une fois par saison, quelle que soit la durée de l\'état', () => {
    // La confiance reste basse plusieurs journées d'affilée : sans identité de
    // déduplication propre, le bureau réécrivait à **chaque** journée — onze
    // fois la même lettre sur un seul exercice, constaté en jeu.
    let box = EMPTY_MAILBOX;
    for (let round = 10; round <= 20; round++) {
      box = appendMail(box, [mailBoardReview({
        season: 2028, round, clubId: CLUB, rank: 13,
        objectiveLabel: 'Top 4', confidence: 12,
      })]);
    }
    expect(box.mails).toHaveLength(1);
    expect(box.mails[0]!.round).toBe(10);
  });

  it('ne redemande pas un entretien à chaque journée d\'une série', () => {
    let box = EMPTY_MAILBOX;
    for (const round of [27, 28, 29, 30]) {
      box = appendMail(box, [mailPressInterview({
        season: 2027, round, clubName: 'Toulouse', losses: 4,
      })]);
    }
    expect(box.mails).toHaveLength(1);
  });

  it('laisse revenir la sollicitation la saison suivante', () => {
    // Dédupliquer trop large éteindrait la mécanique pour le reste de la carrière.
    let box = appendMail(EMPTY_MAILBOX, [mailBoardReview({
      season: 2028, round: 12, clubId: CLUB, rank: 13, objectiveLabel: 'Top 4', confidence: 12,
    })]);
    box = appendMail(box, [mailBoardReview({
      season: 2029, round: 12, clubId: CLUB, rank: 13, objectiveLabel: 'Top 4', confidence: 12,
    })]);
    expect(box.mails).toHaveLength(2);
  });

  it('ne déduplique pas les messages horodatés légitimes', () => {
    // Deux blessures à deux journées différentes restent deux messages.
    const a = mailInjury({ season: 2026, round: 4, clubId: CLUB, playerName: 'A',
      injuryType: 'MUSCULAIRE', returnsAtRound: 10 });
    const b = mailInjury({ season: 2026, round: 9, clubId: CLUB, playerName: 'B',
      injuryType: 'MUSCULAIRE', returnsAtRound: 15 });
    expect(appendMail(EMPTY_MAILBOX, [a, b]).mails).toHaveLength(2);
  });
});
