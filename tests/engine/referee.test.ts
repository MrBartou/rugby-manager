/**
 * L'arbitre et le carton en direct — V0.52.
 *
 * Trois commentaires du moteur invoquaient l'arbitre depuis la V0.13 sans qu'il
 * existe, et `PhaseOutcome.cardIssued` était déclaré, raconté par le narratif —
 * et **jamais produit** par aucun sous-système.
 *
 * Deux choses sont prouvées ici :
 *
 *  1. l'exclusion temporaire **retire réellement un joueur du terrain** et le
 *     rend dix minutes plus tard, avec tous les cas tordus qui vont avec ;
 *  2. l'arbitre change le nombre de pénalités et de cartons d'un match, mesuré
 *     sur des rencontres entières.
 */

import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_EFFECTS,
  NEUTRAL_REFEREE,
  REFEREES,
  policyEffects,
  recommendedPolicy,
  refereeById,
  refereeEffects,
  refereeFor,
} from '../../src/engine/match/referee.js';
import {
  SIN_BIN_MINUTES,
  createSquadRuntime,
  onFieldPlayers,
  returnFromSinBin,
  scrumsUncontested,
  sendOff,
  sendToSinBin,
  sinBinned,
} from '../../src/engine/match/bench.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { createMatchSession } from '../../src/engine/match/session.js';
import { createRng } from '../../src/engine/rng.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import type { ClubId, MatchId, Player, PlayerId } from '../../src/engine/types.js';
import type { MatchInput } from '../../src/engine/match/types.js';

// =============================================================================
// Le corps arbitral
// =============================================================================

describe('douze arbitres, et douze profils différents', () => {
  it('en compte bien douze, tous distincts', () => {
    expect(REFEREES).toHaveLength(12);
    expect(new Set(REFEREES.map(r => r.id)).size).toBe(12);
    expect(new Set(REFEREES.map(r => r.name)).size).toBe(12);
  });

  it('propose de vrais contrastes, pas douze variantes du même', () => {
    const rucks = REFEREES.map(r => r.ruck);
    expect(Math.max(...rucks) - Math.min(...rucks)).toBeGreaterThan(0.4);
    const scrums = REFEREES.map(r => r.scrum);
    expect(Math.max(...scrums) - Math.min(...scrums)).toBeGreaterThan(0.4);
  });

  it('a des arbitres sévères au sol et permissifs en mêlée, et l\'inverse', () => {
    expect(REFEREES.some(r => r.ruck > 1.15 && r.scrum < 0.95)).toBe(true);
    expect(REFEREES.some(r => r.scrum > 1.15 && r.ruck < 0.95)).toBe(true);
  });

  it('ne donne le biais domicile qu\'à une minorité, et petit', () => {
    const biased = REFEREES.filter(r => r.homeBias !== 1);
    expect(biased.length).toBeGreaterThan(0);
    expect(biased.length).toBeLessThan(REFEREES.length / 3);
    for (const r of biased) expect(r.homeBias).toBeLessThan(1.12);
  });

  it('donne à chacun une réputation qui dit quelque chose', () => {
    for (const r of REFEREES) expect(r.reputation.length).toBeGreaterThan(25);
  });

  it('se retrouve par identifiant, et retombe sur le neutre s\'il est inconnu', () => {
    expect(refereeById(REFEREES[3]!.id).name).toBe(REFEREES[3]!.name);
    expect(refereeById('ref_inexistant')).toBe(NEUTRAL_REFEREE);
  });

  it('désigne de façon déterministe', () => {
    expect(refereeFor(createRng('j12_toulouse')).id)
      .toBe(refereeFor(createRng('j12_toulouse')).id);
  });
});

describe('ce que l\'arbitre impose', () => {
  it('ne change rien quand il n\'y en a pas', () => {
    expect(refereeEffects(undefined, 'HOME')).toEqual(NEUTRAL_EFFECTS);
  });

  it('reporte la sévérité de chaque domaine sur le domaine correspondant', () => {
    const sévèreAuSol = REFEREES.find(r => r.ruck >= 1.25)!;
    const e = refereeEffects(sévèreAuSol, 'AWAY');
    expect(e.ruckPenalty).toBeGreaterThan(1.2);
    expect(e.scrumPenalty).toBeLessThan(e.ruckPenalty);
  });

  it('le biais domicile allège les locaux et laisse les visiteurs intacts', () => {
    const biaisé = REFEREES.find(r => r.homeBias > 1)!;
    const chezSoi = refereeEffects(biaisé, 'HOME');
    const dehors = refereeEffects(biaisé, 'AWAY');
    expect(chezSoi.ruckPenalty).toBeLessThan(dehors.ruckPenalty);
  });

  it('ne range jamais son carton pour l\'équipe qui reçoit', () => {
    const biaisé = REFEREES.find(r => r.homeBias > 1)!;
    expect(refereeEffects(biaisé, 'HOME').cardRate)
      .toBe(refereeEffects(biaisé, 'AWAY').cardRate);
  });
});

describe('la consigne au sol est un arbitrage', () => {
  it('contester rapporte des ballons et coûte des pénalités', () => {
    const total = policyEffects('CONTEST_TOTAL');
    expect(total.turnoverWon).toBeGreaterThan(1);
    expect(total.penaltyConceded).toBeGreaterThan(1);
  });

  it('s\'en priver fait l\'inverse, dans les deux sens', () => {
    const rien = policyEffects('PAS_DE_CONTEST');
    expect(rien.turnoverWon).toBeLessThan(1);
    expect(rien.penaltyConceded).toBeLessThan(1);
  });

  it('ne change rien par défaut', () => {
    expect(policyEffects(undefined)).toEqual(policyEffects('EQUILIBRE'));
  });

  it('le staff déconseille le contest face à un arbitre sévère au sol', () => {
    const sévère = REFEREES.find(r => r.ruck >= 1.25)!;
    const laxiste = REFEREES.find(r => r.ruck <= 0.82)!;
    expect(recommendedPolicy(sévère)).toBe('PAS_DE_CONTEST');
    expect(recommendedPolicy(laxiste)).toBe('CONTEST_TOTAL');
  });
});

// =============================================================================
// Le cachot
// =============================================================================

describe('l\'exclusion temporaire retire vraiment un joueur', () => {
  const squadOf = () => {
    const s = makeSquad('c1' as ClubId, 70);
    const byId = new Map<PlayerId, Player>(s.players.map(p => [p.id, p] as const));
    return createSquadRuntime(s.squad.starters, s.squad.substitutes, byId, s.players[9]!, 0);
  };

  it('fait tomber le XV à quatorze, puis le rend à quinze', () => {
    const sq = squadOf();
    const victime = sq.slots[5]!.player;
    expect(sendToSinBin(sq, victime.id, 30)).toBe(true);
    expect(onFieldPlayers(sq)).toHaveLength(14);
    expect(sinBinned(sq).map(p => p.id)).toEqual([victime.id]);

    // Pas une minute trop tôt.
    expect(returnFromSinBin(sq, 30 + SIN_BIN_MINUTES - 1)).toHaveLength(0);
    expect(onFieldPlayers(sq)).toHaveLength(14);

    expect(returnFromSinBin(sq, 30 + SIN_BIN_MINUTES)).toHaveLength(1);
    expect(onFieldPlayers(sq)).toHaveLength(15);
  });

  it('lui rend exactement son poste', () => {
    const sq = squadOf();
    const slot = sq.slots[3]!;
    const poste = slot.position;
    const victime = slot.player;
    sendToSinBin(sq, victime.id, 20);
    returnFromSinBin(sq, 30);
    const retrouvé = sq.slots.find(s => s.player.id === victime.id);
    expect(retrouvé?.position).toBe(poste);
  });

  it('le rouge ne revient jamais', () => {
    const sq = squadOf();
    const exclu = sq.slots[7]!.player;
    expect(sendOff(sq, exclu.id, 25)).toBe(true);
    expect(onFieldPlayers(sq)).toHaveLength(14);
    returnFromSinBin(sq, 90);
    expect(onFieldPlayers(sq)).toHaveLength(14);
    expect(sq.sentOff.has(exclu.id)).toBe(true);
  });

  it('un rouge pris au cachot l\'empêche de revenir', () => {
    const sq = squadOf();
    const victime = sq.slots[2]!.player;
    sendToSinBin(sq, victime.id, 10);
    expect(sendOff(sq, victime.id, 12)).toBe(true);
    returnFromSinBin(sq, 90);
    expect(onFieldPlayers(sq).some(p => p.id === victime.id)).toBe(false);
  });

  it('un pilier au cachot fait passer les mêlées en simulé, le temps de la peine', () => {
    const sq = squadOf();
    const pilier = sq.slots.find(s => s.position === 'PILIER_GAUCHE')!.player;
    expect(scrumsUncontested(sq)).toBe(false);
    sendToSinBin(sq, pilier.id, 40);
    expect(scrumsUncontested(sq)).toBe(true);
    returnFromSinBin(sq, 50);
    // Dix minutes, pas tout le match : un carton jaune ne se paie pas deux fois.
    expect(scrumsUncontested(sq)).toBe(false);
  });

  it('rend le tee au meilleur botteur présent quand le buteur est sanctionné', () => {
    const sq = squadOf();
    const buteur = sq.kicker;
    sendToSinBin(sq, buteur.id, 15);
    expect(sq.kicker.id).not.toBe(buteur.id);
    expect(onFieldPlayers(sq).some(p => p.id === sq.kicker.id)).toBe(true);
  });

  it('ne fait rien d\'un joueur qui n\'est pas sur le terrain', () => {
    const sq = squadOf();
    expect(sendToSinBin(sq, 'fantome' as PlayerId, 10)).toBe(false);
    expect(onFieldPlayers(sq)).toHaveLength(15);
  });
});

// =============================================================================
// La preuve, sur des matchs entiers
// =============================================================================

describe('l\'arbitre change le match', () => {
  const play = (referee: typeof REFEREES[number] | undefined, n = 350) => {
    let penalties = 0;
    let cards = 0;
    for (let i = 0; i < n; i++) {
      const base = makeMatchInput({ homeNiveau: 70, awayNiveau: 70, matchId: `ref_${i}` });
      const input: MatchInput = {
        ...base,
        matchId: `ref_${referee?.id ?? 'none'}_${i}` as MatchId,
        ...(referee ? { referee } : {}),
      };
      const r = simulateMatch(input, `s${i}`);
      for (const p of r.phases) {
        if (p.outcome.penaltyAwarded) penalties++;
        if (p.outcome.cardIssued) cards++;
      }
    }
    return { penalties: penalties / n, cards: cards / n };
  };

  it('un arbitre pointilleux siffle nettement plus qu\'un arbitre qui laisse jouer', () => {
    const sévère = play(REFEREES.find(r => r.id === 'ref_ferrand'));
    const laxiste = play(REFEREES.find(r => r.id === 'ref_delahaye'));
    expect(sévère.penalties).toBeGreaterThan(laxiste.penalties * 1.15);
  });

  it('et sort davantage de cartons', () => {
    const sévère = play(REFEREES.find(r => r.id === 'ref_ferrand'));
    const laxiste = play(REFEREES.find(r => r.id === 'ref_delahaye'));
    expect(sévère.cards).toBeGreaterThan(laxiste.cards);
  });

  it('les cartons tombent à un rythme crédible', () => {
    // Mesuré à 0,87 jaune et 0,079 rouge par rencontre avec un arbitre neutre.
    const neutre = play(undefined, 500);
    expect(neutre.cards).toBeGreaterThan(0.5);
    expect(neutre.cards).toBeLessThan(1.6);
  });

  it('la session sort réellement le sanctionné du terrain', () => {
    // On s'appuie sur le **rouge**, qui est définitif : le jaune ne dure que
    // dix minutes, et `advance()` enchaîne plusieurs phases d'un coup — on
    // regarderait donc le plus souvent après le retour du sanctionné, ce qui ne
    // prouverait rien.
    for (let i = 0; i < 300; i++) {
      const base = makeMatchInput({ homeNiveau: 70, awayNiveau: 70, matchId: `bin_${i}` });
      const session = createMatchSession(
        { ...base, matchId: `bin_${i}` as MatchId, playerSide: 'HOME' },
        `bin${i}`,
      );
      while (session.getState().status !== 'finished') {
        const st = session.getState();
        if (st.status === 'awaiting-decision' && st.pendingMoment) {
          session.applyDecision(st.pendingMoment.options[0]!.id);
          continue;
        }
        session.advance();
      }
      const result = session.getResult();
      const red = result.phases.find(ph =>
        ph.outcome.cardIssued?.color === 'RED' && ph.outcome.penaltyAwarded === 'AWAY');
      if (!red) continue;

      // Un rouge contre le camp dirigé : il finit la rencontre à quatorze.
      const squad = session.getLiveSquad();
      expect(squad.onField).toHaveLength(14);
      expect(result.cardsIssued.some(c => c.color === 'RED')).toBe(true);
      return;
    }
    throw new Error('aucun carton rouge du camp dirigé en 300 matchs');
  });

  it('`cardIssued` cesse d\'être un champ mort', () => {
    // Il était déclaré depuis la V0.2, raconté par le narratif, et jamais
    // produit par aucun sous-système.
    expect(play(undefined, 200).cards).toBeGreaterThan(0);
  });
});
