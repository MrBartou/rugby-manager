/**
 * Le capitaine — V0.50.
 *
 * `captainArmband` était écrit à quatre endroits et lu nulle part : choisir son
 * capitaine ne touchait rien. Ce qui est testé ici, c'est ce qui fait qu'un
 * brassard compte — et surtout ce qui l'empêche de trop compter.
 *
 * La propriété la plus importante est celle que la calibration a imposée :
 * l'apport du capitaine est **relatif au groupe qu'il mène**. Un bonus absolu
 * donnait un avantage de plus aux gros clubs, qui ont déjà les meilleurs
 * joueurs donc les meilleurs capitaines.
 */

import { describe, expect, it } from 'vitest';
import {
  armbandLoss,
  armbandMoodBonus,
  averageAuthority,
  captainAuthority,
  captainDisciplineFactor,
  captainFrom,
  suggestCaptain,
} from '../../src/engine/match/captain.js';
import { computeMood } from '../../src/engine/human/mood.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId, TraitId } from '../../src/engine/types.js';
import type { RosterEntry } from '../../src/engine/match/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE: Player = SQUAD.players[0]!;

const withMental = (over: Partial<Player['mental']>, traits: readonly string[] = []): Player => ({
  ...BASE,
  mental: { ...BASE.mental, ...over },
  traits: traits as readonly TraitId[],
});

describe('l\'autorité ne se confond pas avec le talent', () => {
  it('tient d\'abord au leadership, mais pas seulement', () => {
    const leader = withMental({ leadership: 90, sangFroid: 70, discipline: 70 });
    const solitaire = withMental({ leadership: 40, sangFroid: 70, discipline: 70 });
    expect(captainAuthority(leader)).toBeGreaterThan(captainAuthority(solitaire));
  });

  it('sanctionne celui qui perd son sang-froid ou sa discipline', () => {
    const posé = withMental({ leadership: 80, sangFroid: 85, discipline: 85 });
    const soupe = withMental({ leadership: 80, sangFroid: 25, discipline: 25 });
    expect(captainAuthority(posé) - captainAuthority(soupe)).toBeGreaterThan(15);
  });

  it('écoute les traits, dans les deux sens', () => {
    const neutre = withMental({ leadership: 70, sangFroid: 70, discipline: 70 });
    const né = withMental({ leadership: 70, sangFroid: 70, discipline: 70 }, ['leader_naturel']);
    const suiveur = withMental({ leadership: 70, sangFroid: 70, discipline: 70 }, ['suiveur']);
    expect(captainAuthority(né)).toBeGreaterThan(captainAuthority(neutre));
    expect(captainAuthority(suiveur)).toBeLessThan(captainAuthority(neutre));
  });

  it('reste bornée entre 0 et 100', () => {
    const extrême = withMental(
      { leadership: 100, sangFroid: 100, discipline: 100 },
      ['leader_naturel', 'charismatique', 'mentor', 'professionnel'],
    );
    expect(captainAuthority(extrême)).toBeLessThanOrEqual(100);
    expect(captainAuthority(withMental({ leadership: 0, sangFroid: 0, discipline: 0 }, ['suiveur'])))
      .toBeGreaterThanOrEqual(0);
  });
});

describe('la désignation', () => {
  it('propose le meneur d\'hommes, pas l\'ouvreur d\'office', () => {
    const leader = { ...withMental({ leadership: 95, sangFroid: 80, discipline: 80 }), id: 'leader' as PlayerId };
    const autres = [1, 2, 3].map(i => ({
      ...withMental({ leadership: 45, sangFroid: 50, discipline: 50 }),
      id: `p${i}` as PlayerId,
    }));
    expect(suggestCaptain([...autres, leader])?.id).toBe('leader');
  });

  it('ne propose personne dans un groupe vide', () => {
    expect(suggestCaptain([])).toBeUndefined();
  });

  it('retrouve le capitaine sur une feuille de match, et son absence', () => {
    const byId = new Map<PlayerId, Player>(SQUAD.players.map(p => [p.id, p] as const));
    const entries: RosterEntry[] = SQUAD.players.slice(0, 3).map((p, i) => ({
      playerId: p.id, position: p.position, captainArmband: i === 1,
    }));
    expect(captainFrom(entries, byId)?.id).toBe(SQUAD.players[1]!.id);
    expect(captainFrom(entries.map(e => ({ ...e, captainArmband: false })), byId))
      .toBeUndefined();
  });
});

describe('ce qu\'il apporte est relatif au groupe', () => {
  const leader = withMental({ leadership: 95, sangFroid: 85, discipline: 85 }, ['leader_naturel']);
  const moyens = [1, 2, 3].map(() => withMental({ leadership: 50, sangFroid: 50, discipline: 50 }));
  const excellents = [1, 2, 3].map(() => withMental({ leadership: 92, sangFroid: 88, discipline: 88 }));

  it('un leader dans un groupe moyen tient réellement la discipline', () => {
    const factor = captainDisciplineFactor(leader, true, averageAuthority(moyens));
    expect(factor).toBeLessThan(1);
  });

  it('le même leader entouré de cadres n\'apporte presque plus rien', () => {
    const dansMoyens = captainDisciplineFactor(leader, true, averageAuthority(moyens));
    const dansCadres = captainDisciplineFactor(leader, true, averageAuthority(excellents));
    expect(dansCadres).toBeGreaterThan(dansMoyens);
    // C'est la propriété qui a sauvé la calibration : le gros club, qui a déjà
    // les meilleurs joueurs, ne reçoit pas en plus le meilleur bonus.
    expect(Math.abs(1 - dansCadres)).toBeLessThan(Math.abs(1 - dansMoyens));
  });

  it('un capitaine plus faible que son groupe coûte au lieu de rapporter', () => {
    const faible = withMental({ leadership: 30, sangFroid: 35, discipline: 40 }, ['suiveur']);
    expect(captainDisciplineFactor(faible, true, averageAuthority(excellents)))
      .toBeGreaterThan(1);
  });

  it('reste dans une fourchette étroite, quoi qu\'il arrive', () => {
    const extrêmes = [
      captainDisciplineFactor(leader, true, 0),
      captainDisciplineFactor(withMental({ leadership: 0, sangFroid: 0, discipline: 0 }), true, 100),
    ];
    for (const f of extrêmes) {
      expect(f).toBeGreaterThanOrEqual(0.94);
      expect(f).toBeLessThanOrEqual(1.06);
    }
  });

  it('ne compte plus dès qu\'il a quitté le terrain, ni s\'il n\'existe pas', () => {
    expect(captainDisciplineFactor(leader, false, averageAuthority(moyens))).toBe(1);
    expect(captainDisciplineFactor(undefined, true, averageAuthority(moyens))).toBe(1);
  });
});

describe('le brassard qui change de bras', () => {
  it('coûte d\'autant plus que l\'homme comptait', () => {
    const patron = armbandLoss(withMental({ leadership: 95, sangFroid: 90, discipline: 90 }));
    const figurant = armbandLoss(withMental({ leadership: 50, sangFroid: 50, discipline: 50 }));
    expect(patron.tacticalMalus).toBeLessThan(figurant.tacticalMalus);
    expect(patron.narrative).toContain('brassard');
  });

  it('ne coûte rien quand il n\'y avait pas de capitaine, ou pas d\'autorité', () => {
    expect(armbandLoss(undefined).tacticalMalus).toBe(0);
    expect(armbandLoss(undefined).phases).toBe(0);
    expect(armbandLoss(withMental({ leadership: 30, sangFroid: 30, discipline: 30 })).tacticalMalus)
      .toBe(0);
  });

  it('reste un contrecoup passager, pas une condamnation', () => {
    const loss = armbandLoss(withMental({ leadership: 99, sangFroid: 99, discipline: 99 }));
    expect(Math.abs(loss.tacticalMalus)).toBeLessThanOrEqual(2.5);
    expect(loss.phases).toBeLessThanOrEqual(10);
  });
});

describe('le brassard compte pour celui qui le porte', () => {
  it('remonte le moral du capitaine', () => {
    const player = withMental({ leadership: 85, sangFroid: 80, discipline: 80 });
    const avec = computeMood({
      player, recentResults: [1, 1, 0], playRatio: 0.8, currentSeason: 2025, isCaptain: true,
    }).mood;
    const sans = computeMood({
      player, recentResults: [1, 1, 0], playRatio: 0.8, currentSeason: 2025,
    }).mood;
    expect(avec).toBeGreaterThan(sans);
  });

  it('vaut davantage à qui a l\'autorité de le porter', () => {
    const patron = armbandMoodBonus(withMental({ leadership: 95, sangFroid: 90, discipline: 90 }));
    const timide = armbandMoodBonus(withMental({ leadership: 25, sangFroid: 30, discipline: 40 }));
    expect(patron).toBeGreaterThan(timide);
  });

  it('ne suffit jamais à sauver quelqu\'un qui ne joue pas', () => {
    const player = withMental({ leadership: 90, sangFroid: 85, discipline: 85 });
    const capitaineRemplaçant = computeMood({
      player, recentResults: [-1, -1, -1], playRatio: 0, currentSeason: 2025, isCaptain: true,
    }).mood;
    expect(capitaineRemplaçant).toBeLessThan(50);
  });
});
