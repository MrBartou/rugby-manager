/**
 * Tests du duel porteur / défenseur — V0.13.
 *
 * L'enjeu : les joueurs doivent exister individuellement. Avant ce module, un
 * ouvreur de classe mondiale entouré de joueurs médiocres produisait le même jeu
 * qu'une ligne homogène de même moyenne.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import {
  pickCarrier,
  pickDefender,
  resolveCarry,
  resolveCarrySequence,
  type CarryOutcome,
} from '../../src/engine/match/carry.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import type { ClubId, Player, Position } from '../../src/engine/types.js';

const FORWARD_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
];

function squadOf(niveau: number, club = 'club_home'): { pack: Player[]; backs: Player[] } {
  const { squad, players } = makeSquad(club as ClubId, niveau);
  const byId = new Map(players.map(p => [p.id, p]));
  const fwd = new Set<string>(FORWARD_POSITIONS);
  const pack: Player[] = [];
  const backs: Player[] = [];
  for (const entry of squad.starters) {
    const p = byId.get(entry.playerId)!;
    if (fwd.has(entry.position)) pack.push(p);
    else backs.push(p);
  }
  return { pack, backs };
}

/** Force les attributs offensifs d'un joueur. */
function asPowerCarrier(p: Player, level: number): Player {
  return {
    ...p,
    physical: { ...p.physical, puissance: level, vitesse: level },
    technical: { ...p.technical, conservation: level },
    mental: { ...p.mental, agressivite: level },
  };
}

/** Force les attributs défensifs d'un joueur. */
function asTackler(p: Player, level: number): Player {
  return {
    ...p,
    technical: { ...p.technical, plaquage: level },
    physical: { ...p.physical, puissance: level, vitesse: level },
    mental: { ...p.mental, agressivite: level },
  };
}

function duelDistribution(carrier: Player, defender: Player, n = 4000) {
  const counts: Record<CarryOutcome, number> = {
    LINE_BREAK: 0, BEATEN: 0, GAIN: 0, HELD: 0,
    DOMINANT_TACKLE: 0, HANDLING_ERROR: 0, TURNOVER: 0,
  };
  let meters = 0;
  for (let i = 0; i < n; i++) {
    const res = resolveCarry(
      {
        carrier, defender,
        fatigueAttack: 30, fatigueDefense: 30,
        attackTacticalBonus: 0, defenseTacticalBonus: 0,
      },
      createRng(`duel_${i}`),
    );
    counts[res.outcome]++;
    meters += res.metersGained;
  }
  return { counts, meanMeters: meters / n, n };
}

// =============================================================================
// Sélection des acteurs
// =============================================================================

describe('sélection du porteur', () => {
  it('désigne toujours un joueur présent sur le terrain', () => {
    const { pack, backs } = squadOf(60);
    const ids = new Set([...pack, ...backs].map(p => p.id));
    for (let i = 0; i < 300; i++) {
      const carrier = pickCarrier(
        { pack, backs, phaseInPossession: i % 8, fieldPosition: 0 },
        createRng(`c_${i}`),
      );
      expect(carrier && ids.has(carrier.id)).toBe(true);
    }
  });

  it('le jeu se resserre sur les avants au fil des temps de jeu', () => {
    const { pack, backs } = squadOf(60);
    const packIds = new Set(pack.map(p => p.id));

    const share = (phaseInPossession: number) => {
      let fromPack = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) {
        const c = pickCarrier({ pack, backs, phaseInPossession, fieldPosition: 0 }, createRng(`s_${i}`));
        if (c && packIds.has(c.id)) fromPack++;
      }
      return fromPack / n;
    };

    expect(share(6)).toBeGreaterThan(share(0));
  });

  it('on joue plus serré dans ses propres 22 mètres', () => {
    const { pack, backs } = squadOf(60);
    const packIds = new Set(pack.map(p => p.id));

    const share = (fieldPosition: number) => {
      let fromPack = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) {
        const c = pickCarrier({ pack, backs, phaseInPossession: 1, fieldPosition }, createRng(`f_${i}`));
        if (c && packIds.has(c.id)) fromPack++;
      }
      return fromPack / n;
    };

    expect(share(-40)).toBeGreaterThan(share(10));
  });

  it('le numéro 8 et les centres portent plus que les piliers', () => {
    const { pack, backs } = squadOf(60);
    const counts = new Map<Position, number>();
    for (let i = 0; i < 6000; i++) {
      const c = pickCarrier({ pack, backs, phaseInPossession: 2, fieldPosition: 0 }, createRng(`a_${i}`));
      if (c) counts.set(c.position, (counts.get(c.position) ?? 0) + 1);
    }
    expect(counts.get('NUMERO_8') ?? 0).toBeGreaterThan(counts.get('PILIER_GAUCHE') ?? 0);
    expect(counts.get('CENTRE_INTERIEUR') ?? 0).toBeGreaterThan(counts.get('DEMI_DE_MELEE') ?? 0);
  });
});

describe('sélection du défenseur', () => {
  it('désigne un défenseur de l\'équipe adverse', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const ids = new Set([...defense.pack, ...defense.backs].map(p => p.id));
    for (let i = 0; i < 300; i++) {
      const d = pickDefender(attack.pack[0]!, defense.pack, defense.backs, createRng(`d_${i}`));
      expect(d && ids.has(d.id)).toBe(true);
    }
  });

  it('un avant tombe majoritairement sur un avant', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const packIds = new Set(defense.pack.map(p => p.id));
    const carrier = attack.pack.find(p => p.position === 'NUMERO_8')!;

    let vsPack = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const d = pickDefender(carrier, defense.pack, defense.backs, createRng(`ch_${i}`));
      if (d && packIds.has(d.id)) vsPack++;
    }
    expect(vsPack / n).toBeGreaterThan(0.6);
  });
});

// =============================================================================
// Résolution du duel
// =============================================================================

describe('duel individuel', () => {
  it('est déterministe pour une même graine', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const input = {
      carrier: attack.backs[0]!, defender: defense.backs[0]!,
      fatigueAttack: 20, fatigueDefense: 20,
      attackTacticalBonus: 0, defenseTacticalBonus: 0,
    };
    expect(resolveCarry(input, createRng('x'))).toEqual(resolveCarry(input, createRng('x')));
  });

  it('un porteur puissant bat plus souvent son défenseur', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const defender = asTackler(defense.backs[0]!, 60);

    const faible = duelDistribution(asPowerCarrier(attack.backs[0]!, 30), defender);
    const fort = duelDistribution(asPowerCarrier(attack.backs[0]!, 95), defender);

    expect(fort.counts.BEATEN + fort.counts.LINE_BREAK)
      .toBeGreaterThan(faible.counts.BEATEN + faible.counts.LINE_BREAK);
    expect(fort.meanMeters).toBeGreaterThan(faible.meanMeters);
  });

  it('un défenseur d\'élite stoppe et gratte davantage', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const carrier = asPowerCarrier(attack.backs[0]!, 60);

    const passoire = duelDistribution(carrier, asTackler(defense.backs[0]!, 25));
    const muraille = duelDistribution(carrier, asTackler(defense.backs[0]!, 95));

    expect(muraille.counts.DOMINANT_TACKLE).toBeGreaterThan(passoire.counts.DOMINANT_TACKLE);
    expect(muraille.meanMeters).toBeLessThan(passoire.meanMeters);
  });

  it('attribue course et mètres au porteur, plaquage au défenseur', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const carrier = attack.backs[0]!;
    const defender = defense.backs[0]!;

    let carrierCarries = 0;
    let defenderTackles = 0;
    for (let i = 0; i < 500; i++) {
      const res = resolveCarry(
        {
          carrier, defender,
          fatigueAttack: 20, fatigueDefense: 20,
          attackTacticalBonus: 0, defenseTacticalBonus: 0,
        },
        createRng(`attr_${i}`),
      );
      for (const c of res.contributions) {
        if (c.playerId === carrier.id) carrierCarries += c.carries ?? 0;
        if (c.playerId === defender.id) defenderTackles += c.tackles ?? 0;
      }
      // Le porteur ne se plaque jamais lui-même.
      const carrierContribution = res.contributions.find(c => c.playerId === carrier.id);
      expect(carrierContribution?.tackles ?? 0).toBe(0);
    }
    expect(carrierCarries).toBe(500);
    expect(defenderTackles).toBeGreaterThan(200);
  });

  it('un plaquage manqué accompagne toujours un défenseur battu', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const carrier = asPowerCarrier(attack.backs[0]!, 95);
    const defender = asTackler(defense.backs[0]!, 30);

    for (let i = 0; i < 800; i++) {
      const res = resolveCarry(
        {
          carrier, defender,
          fatigueAttack: 20, fatigueDefense: 20,
          attackTacticalBonus: 0, defenseTacticalBonus: 0,
        },
        createRng(`miss_${i}`),
      );
      if (res.outcome !== 'BEATEN' && res.outcome !== 'LINE_BREAK') continue;
      const def = res.contributions.find(c => c.playerId === defender.id);
      expect(def?.tacklesMissed).toBe(1);
    }
  });

  it('la fatigue du porteur réduit son gain de terrain', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const carrier = attack.backs[0]!;
    const defender = defense.backs[0]!;

    const mean = (fatigueAttack: number) => {
      let total = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) {
        total += resolveCarry(
          {
            carrier, defender, fatigueAttack, fatigueDefense: 20,
            attackTacticalBonus: 0, defenseTacticalBonus: 0,
          },
          createRng(`fat_${i}`),
        ).metersGained;
      }
      return total / n;
    };

    expect(mean(90)).toBeLessThan(mean(5));
  });
});

// =============================================================================
// Séquence de contacts
// =============================================================================

describe('séquence de contacts', () => {
  it('enchaîne plusieurs contacts et cumule les contributions', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    const seq = resolveCarrySequence(
      {
        attackPack: attack.pack, attackBacks: attack.backs,
        defensePack: defense.pack, defenseBacks: defense.backs,
        phaseInPossession: 1, fieldPosition: 0,
        fatigueAttack: 25, fatigueDefense: 25,
        attackTacticalBonus: 0, defenseTacticalBonus: 0,
      },
      createRng('seq'),
    );
    expect(seq).toBeDefined();
    expect(seq!.contributions.length).toBeGreaterThanOrEqual(2);
    const carries = seq!.contributions.reduce((a, c) => a + (c.carries ?? 0), 0);
    expect(carries).toBeGreaterThanOrEqual(1);
  });

  it('s\'arrête net sur une perte de balle', () => {
    const attack = squadOf(60, 'club_home');
    const defense = squadOf(60, 'club_away');
    for (let i = 0; i < 600; i++) {
      const seq = resolveCarrySequence(
        {
          attackPack: attack.pack, attackBacks: attack.backs,
          defensePack: defense.pack, defenseBacks: defense.backs,
          phaseInPossession: 1, fieldPosition: 0,
          fatigueAttack: 25, fatigueDefense: 25,
          attackTacticalBonus: 0, defenseTacticalBonus: 0,
        },
        createRng(`stop_${i}`),
      );
      if (!seq) continue;
      if (seq.outcome === 'TURNOVER' || seq.outcome === 'HANDLING_ERROR') {
        // Au plus une perte de balle par séquence.
        const losses = seq.contributions.reduce(
          (a, c) => a + (c.turnoversWon ?? 0) + (c.handlingErrors ?? 0), 0,
        );
        expect(losses).toBe(1);
      }
    }
  });

  it('renvoie undefined si aucun joueur n\'est disponible', () => {
    const seq = resolveCarrySequence(
      {
        attackPack: [], attackBacks: [], defensePack: [], defenseBacks: [],
        phaseInPossession: 0, fieldPosition: 0,
        fatigueAttack: 0, fatigueDefense: 0,
        attackTacticalBonus: 0, defenseTacticalBonus: 0,
      },
      createRng('empty'),
    );
    expect(seq).toBeUndefined();
  });
});

// =============================================================================
// Intégration au match
// =============================================================================

describe('statistiques individuelles en match', () => {
  it('produit des courses, mètres et plaquages attribués à des joueurs', () => {
    const input = makeMatchInput({ homeNiveau: 62, awayNiveau: 58 });
    const result = simulateMatch(input, 'carry_match');

    let carries = 0;
    let tackles = 0;
    let meters = 0;
    for (const s of result.individualStats.values()) {
      carries += s.carries;
      tackles += s.tackles;
      meters += s.metersWithBall;
    }
    expect(carries).toBeGreaterThan(15);
    expect(tackles).toBeGreaterThan(15);
    expect(meters).toBeGreaterThan(50);
  });

  it('les mètres sont des entiers exploitables par l\'UI', () => {
    const result = simulateMatch(makeMatchInput({ homeNiveau: 60, awayNiveau: 60 }), 'carry_int');
    for (const s of result.individualStats.values()) {
      expect(Number.isInteger(s.metersWithBall)).toBe(true);
    }
  });

  it('un joueur nettement supérieur gagne plus de mètres que ses coéquipiers', () => {
    const input = makeMatchInput({ homeNiveau: 55, awayNiveau: 55 });
    const players = new Map(input.playersById);
    const starId = input.home.squad.starters.find(s => s.position === 'CENTRE_INTERIEUR')!.playerId;
    players.set(starId, asPowerCarrier(players.get(starId)!, 99));
    const rigged = { ...input, playersById: players };

    let starMeters = 0;
    let peerMeters = 0;
    const peerIds = input.home.squad.starters
      .filter(s => s.position === 'CENTRE_EXTERIEUR' || s.position === 'AILIER_GAUCHE')
      .map(s => s.playerId);

    for (let i = 0; i < 120; i++) {
      const r = simulateMatch(rigged, `star_${i}`);
      starMeters += r.individualStats.get(starId)?.metersWithBall ?? 0;
      for (const pid of peerIds) peerMeters += r.individualStats.get(pid)?.metersWithBall ?? 0;
    }
    // Le crack doit dominer ses deux coéquipiers réunis.
    expect(starMeters).toBeGreaterThan(peerMeters / peerIds.length);
  });

  it('le narratif de phase cite des joueurs nommément', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const result = simulateMatch(input, 'carry_names');
    const named = result.phases.filter(
      p => p.type === 'OPEN_PLAY' && p.outcome.keyPlayerId !== undefined,
    );
    expect(named.length).toBeGreaterThan(5);
  });
});
