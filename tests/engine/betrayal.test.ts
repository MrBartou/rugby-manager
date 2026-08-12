/**
 * Les suites d'une promesse trahie — V0.49.
 *
 * La V0.48 faisait payer une trahison en moral, et rien d'autre. Une jauge qui
 * baisse s'encaisse en haussant les épaules : on pouvait promettre à tout le
 * vestiaire et vivre très bien avec.
 *
 * Ce qui est testé ici, c'est ce qui rend la trahison coûteuse pour de bon :
 * le joueur peut demander à partir, le vestiaire prend toujours quelque chose,
 * et « accepter la demande » fait réellement venir des clubs.
 */

import { describe, expect, it } from 'vitest';
import {
  betrayalFallout,
  resolveTransferRequest,
} from '../../src/engine/human/player-talk.js';
import { generateIncomingOffers } from '../../src/engine/club/transfer-market.js';
import { buildAgenda } from '../../src/engine/season/manager-agenda.js';
import {
  appendMail,
  effectOf,
  mailTransferRequest,
  pendingAnswers,
  answerMail,
  EMPTY_MAILBOX,
} from '../../src/engine/season/mailbox.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player, PlayerId, TraitId } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE: Player = SQUAD.players[0]!;

const withTraits = (ids: readonly string[]): Player =>
  ({ ...BASE, traits: ids as readonly TraitId[] });

/** Part des trahisons qui débouchent sur une demande de départ. */
const requestRate = (player: Player): number => {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (betrayalFallout({ player, rng: createRng(`b${i}`) }).transferRequest) n++;
  }
  return n / 400;
};

describe('le tempérament décide de qui claque la porte', () => {
  it('un ambitieux et un mercenaire partent bien plus souvent qu\'un loyal', () => {
    const loyal = requestRate(withTraits(['loyal', 'attache_club']));
    const mercenaire = requestRate(withTraits(['mercenaire', 'ambitieux']));
    expect(mercenaire).toBeGreaterThan(loyal + 0.3);
  });

  it('personne n\'est totalement à l\'abri, ni totalement condamné', () => {
    const loyal = requestRate(withTraits(['loyal', 'attache_club', 'professionnel']));
    const mercenaire = requestRate(withTraits(['mercenaire', 'ambitieux', 'rancunier']));
    expect(loyal).toBeGreaterThan(0);
    expect(mercenaire).toBeLessThan(1);
  });
});

describe('le vestiaire encaisse toujours', () => {
  it('une parole non tenue coûte du moral même quand le joueur se tait', () => {
    for (let i = 0; i < 40; i++) {
      const fallout = betrayalFallout({
        player: withTraits(['loyal']), rng: createRng(`v${i}`),
      });
      expect(fallout.dressingRoomDelta).toBeLessThan(0);
    }
  });

  it('coûte davantage quand l\'affaire sort au grand jour', () => {
    const quiet = betrayalFallout({ player: withTraits(['loyal', 'attache_club']), rng: createRng('q') });
    const loud = betrayalFallout({ player: withTraits(['mercenaire', 'ambitieux']), rng: createRng('q') });
    expect(loud.transferRequest).toBe(true);
    expect(quiet.transferRequest).toBe(false);
    expect(loud.dressingRoomDelta).toBeLessThan(quiet.dressingRoomDelta);
  });
});

describe('les deux réponses sont défendables', () => {
  it('accepter apaise le joueur et ne coûte rien au vestiaire', () => {
    const r = resolveTransferRequest('ACCEPTER');
    expect(r.playerMoodDelta).toBeGreaterThan(0);
    expect(r.dressingRoomDelta).toBe(0);
    expect(r.listed).toBe(true);
  });

  it('retenir garde le joueur mais laisse deux traces', () => {
    const r = resolveTransferRequest('RETENIR');
    expect(r.playerMoodDelta).toBeLessThan(0);
    expect(r.dressingRoomDelta).toBeLessThan(0);
    expect(r.listed).toBe(false);
  });
});

describe('le courrier de l\'agent', () => {
  const draft = mailTransferRequest({
    season: 2025, round: 12, clubId: 'c1' as ClubId,
    playerId: 'p_42', playerName: 'Antoine Dupont',
  });

  it('propose les deux options, chacune avec ce qu\'elle engage', () => {
    expect(draft.actions).toHaveLength(2);
    for (const action of draft.actions ?? []) {
      expect(action.hint.length).toBeGreaterThan(10);
    }
  });

  it('ne revient pas à chaque journée pour la même affaire', () => {
    const first = appendMail(EMPTY_MAILBOX, [draft]);
    const again = appendMail(first, [{ ...draft, round: 13 }]);
    expect(again.mails).toHaveLength(1);
  });

  it('attend une réponse tant qu\'on n\'a pas tranché', () => {
    const box = appendMail(EMPTY_MAILBOX, [draft]);
    expect(pendingAnswers(box)).toHaveLength(1);
    const answered = answerMail(box, box.mails[0]!.id, 'DEPART_ACCEPTER:p_42');
    expect(pendingAnswers(answered)).toHaveLength(0);
  });

  it('ne prend pas l\'identifiant du joueur pour un chèque', () => {
    // `effectOf` suffixe parfois un montant après le deux-points. Ici c'est un
    // identifiant : rien ne doit sortir de la trésorerie.
    const effect = effectOf('DEPART_ACCEPTER:p_42');
    expect(effect.cashDelta).toBe(0);
    expect(effect.reply.length).toBeGreaterThan(10);
  });
});

describe('la liste des transferts fait venir du monde', () => {
  const buyers: readonly Club[] = ['c2', 'c3', 'c4'].map((id, i) => ({
    id: id as ClubId, name: `Club ${i + 2}`, shortName: 'CLB', city: 'Ville',
    tier: 'GROS_BUDGET' as const, tacticalIdentity: 'MIXTE' as const,
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 55,
  }));

  /** Un joueur qu'aucun club ne serait venu chercher : moyen, sous contrat long. */
  const modest: Player = {
    ...SQUAD.players[3]!,
    contract: { ...SQUAD.players[3]!.contract, endSeason: 2030 },
  };

  const offersOver = (rounds: number, wantAway: readonly PlayerId[]): number => {
    let n = 0;
    for (let round = 1; round <= rounds; round++) {
      n += generateIncomingOffers({
        playerClubId: 'c1' as ClubId,
        playerClubRoster: [modest],
        otherClubs: buyers,
        round,
        currentSeason: 2025,
        seed: 'offres',
        wantAwayIds: wantAway,
      }).length;
    }
    return n;
  };

  it('sans demande acceptée, personne ne se déplace pour lui', () => {
    expect(offersOver(200, [])).toBe(0);
  });

  it('une fois sur la liste, les offres finissent par tomber', () => {
    expect(offersOver(200, [modest.id])).toBeGreaterThan(10);
  });

  it('et elles portent bien sur lui', () => {
    for (let round = 1; round <= 200; round++) {
      const offers = generateIncomingOffers({
        playerClubId: 'c1' as ClubId,
        playerClubRoster: [modest],
        otherClubs: buyers,
        round,
        currentSeason: 2025,
        seed: 'offres',
        wantAwayIds: [modest.id],
      });
      for (const offer of offers) expect(offer.playerId).toBe(modest.id);
    }
  });
});

describe('la demande remonte dans la semaine du manager', () => {
  const CALM = {
    currentRound: 10,
    roster: [] as readonly Player[],
    currentSeason: 2025,
    capUsage: 80,
    capOver: false,
    jiffHeadroom: 5,
    jiffCompliant: true,
    transferBan: false,
    promises: [],
    expectations: [],
    unreadMails: 0,
    pendingAnswers: 0,
    boardConfidence: 60,
    transferWindowOpen: false,
  };

  it('une demande sans réponse passe devant tout le reste', () => {
    const agenda = buildAgenda({
      ...CALM,
      transferRequests: [{ playerName: 'Antoine Dupont', status: 'EN_ATTENTE' }],
    });
    expect(agenda[0]?.severity).toBe('URGENT');
    expect(agenda[0]?.headline).toContain('Dupont');
  });

  it('une fois sur la liste, elle ne fait plus que se rappeler au bon souvenir', () => {
    const agenda = buildAgenda({
      ...CALM,
      transferRequests: [{ playerName: 'Antoine Dupont', status: 'SUR_LA_LISTE' }],
    });
    expect(agenda).toHaveLength(1);
    expect(agenda[0]?.severity).toBe('INFO');
    expect(agenda[0]?.destination).toBe('transfers');
  });

  it('reste muette quand aucune affaire n\'est ouverte', () => {
    expect(buildAgenda(CALM)).toHaveLength(0);
    expect(buildAgenda({ ...CALM, transferRequests: [] })).toHaveLength(0);
  });
});
