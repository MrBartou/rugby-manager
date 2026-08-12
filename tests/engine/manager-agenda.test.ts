/**
 * La semaine du manager — V0.49.
 *
 * La propriété qui décide de l'utilité du digest : **il se tait quand tout va
 * bien**. Un agenda qui parle toutes les semaines ne se lit plus au bout de
 * trois journées, et on rate celle où il fallait agir.
 */

import { describe, expect, it } from 'vitest';
import {
  buildAgenda,
  type AgendaInput,
} from '../../src/engine/season/manager-agenda.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player } from '../../src/engine/types.js';

const ROSTER: readonly Player[] = makeSquad('c' as ClubId, 70).players;

const calm: AgendaInput = {
  currentRound: 10,
  roster: ROSTER.map(p => ({ ...p, contract: { ...p.contract, endSeason: 2030 } })),
  currentSeason: 2026,
  capUsage: 70,
  capOver: false,
  jiffHeadroom: 6,
  jiffCompliant: true,
  transferBan: false,
  promises: [],
  expectations: [],
  unreadMails: 0,
  pendingAnswers: 0,
  boardConfidence: 60,
  transferWindowOpen: false,
};

const at = (over: Partial<AgendaInput> = {}) => buildAgenda({ ...calm, ...over });
const ids = (over: Partial<AgendaInput> = {}) => at(over).map(i => i.id);

describe('le silence', () => {
  it('ne dit rien quand rien ne brûle', () => {
    expect(at()).toEqual([]);
  });

  it('ne signale pas un plafond respecté ni un quota tenu', () => {
    // Dire que tout va bien n'appelle aucune décision et noierait le reste.
    expect(ids({ capUsage: 60, jiffHeadroom: 9 })).toEqual([]);
  });

  it('ne signale pas une promesse en bonne voie', () => {
    expect(ids({
      promises: [{ playerName: 'Dupont', dueAtRound: 14, onTrack: true }],
    })).toEqual([]);
  });

  it('ne signale pas une exigence déjà tenue', () => {
    expect(ids({ expectations: [{ wording: 'Tenir la masse', met: true }] })).toEqual([]);
  });
});

describe('ce qui remonte', () => {
  it('met l\'interdiction de recruter en tête', () => {
    const out = at({ transferBan: true, unreadMails: 3 });
    expect(out[0]!.id).toBe('ban');
    expect(out[0]!.severity).toBe('URGENT');
  });

  it('distingue un plafond dépassé d\'un plafond tendu', () => {
    expect(at({ capOver: true, capUsage: 110 })[0]!.severity).toBe('URGENT');
    expect(at({ capUsage: 95 })[0]!.severity).toBe('ATTENTION');
  });

  it('alerte sur un quota JIFF non rempli', () => {
    expect(at({ jiffCompliant: false })[0]!.severity).toBe('URGENT');
  });

  it('ne parle de marge JIFF nulle que si le mercato est ouvert', () => {
    // Hors fenêtre, l'information n'appelle aucune décision.
    expect(ids({ jiffHeadroom: 0, transferWindowOpen: false })).toEqual([]);
    expect(ids({ jiffHeadroom: 0, transferWindowOpen: true })).toContain('jiff');
  });

  it('durcit une promesse à mesure que l\'échéance approche', () => {
    const loin = at({ promises: [{ playerName: 'X', dueAtRound: 20, onTrack: false }] });
    const proche = at({ promises: [{ playerName: 'X', dueAtRound: 11, onTrack: false }] });
    expect(loin[0]!.severity).toBe('ATTENTION');
    expect(proche[0]!.severity).toBe('URGENT');
  });

  it('dit qu\'une échéance est passée', () => {
    const out = at({ promises: [{ playerName: 'X', dueAtRound: 8, onTrack: false }] });
    expect(out[0]!.detail).toMatch(/passée/);
  });

  it('remonte une exigence du président non tenue', () => {
    const out = at({ expectations: [{ wording: 'Faire jouer les jeunes', met: false }] });
    expect(out[0]!.detail).toMatch(/jeunes/);
    expect(out[0]!.destination).toBe('career');
  });

  it('alerte sur un poste menacé', () => {
    expect(ids({ boardConfidence: 12 })).toContain('confidence');
  });

  it('préfère les messages à répondre au simple non-lu', () => {
    const out = at({ unreadMails: 5, pendingAnswers: 2 });
    expect(out.map(i => i.id)).toContain('answers');
    expect(out.map(i => i.id)).not.toContain('mails');
  });

  it('signale une infirmerie chargée, pas un blessé isolé', () => {
    const blesse = (n: number): readonly Player[] => ROSTER.map((p, i) => i < n
      ? {
        ...p,
        dynamic: {
          ...p.dynamic,
          injury: { type: 'MUSCULAIRE' as const, startedAt: 1, estimatedReturnAt: 20, hasSequela: false },
        },
      }
      : p);
    expect(ids({ roster: blesse(1) })).not.toContain('infirmary');
    expect(ids({ roster: blesse(4) })).toContain('infirmary');
  });

  it('rappelle les contrats qui expirent', () => {
    const expirant = ROSTER.map(p => ({ ...p, contract: { ...p.contract, endSeason: 2026 } }));
    expect(ids({ roster: expirant })).toContain('contracts');
  });

  it('rappelle le chantier en cours sans en faire une urgence', () => {
    const out = at({ project: { label: 'Stade', readyAtSeason: 2028 } });
    expect(out[0]!.severity).toBe('INFO');
  });
});

describe('ordre', () => {
  it('classe du plus urgent au moins', () => {
    const out = at({
      transferBan: true,
      unreadMails: 2,
      expectations: [{ wording: 'Tenir la masse', met: false }],
      project: { label: 'Stade', readyAtSeason: 2028 },
    });
    const severities = out.map(i => i.severity);
    expect(severities).toEqual([...severities].sort((a, b) =>
      ({ URGENT: 0, ATTENTION: 1, INFO: 2 })[a] - ({ URGENT: 0, ATTENTION: 1, INFO: 2 })[b]));
  });

  it('donne une destination à tout ce qui appelle une action', () => {
    const out = at({ transferBan: true, capOver: true, boardConfidence: 10 });
    for (const item of out) expect(item.destination).toBeDefined();
  });
});
