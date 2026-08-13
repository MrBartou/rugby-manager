/**
 * Les classements individuels du championnat : V0.61.
 *
 * Les statistiques de tous les joueurs des deux divisions étaient tenues depuis
 * la V0.53 et ne ressortaient qu'une fois l'an, sous forme de trophées. « Qui
 * est en tête des marqueurs », la question la plus banale d'un championnat,
 * n'avait pas de réponse pendant la saison.
 *
 * Ce qui est vérifié ici : les compteurs se classent bruts, la note se classe
 * en moyenne avec une présence exigée, un classement vide reste vide plutôt que
 * d'afficher des zéros, et le départage à égalité dit quelque chose.
 */

import { describe, expect, it } from 'vitest';
import {
  MIN_PRESENCE_NOTE,
  allLeaderboards,
  leaderboard,
  type LeaderStat,
} from '@/engine/season/leaderboards.js';
import type { ClubId, Player, PlayerId, Position } from '@/engine/types.js';

const n = 70;
function player(id: string, clubId = 'a', over: Partial<Player> = {}): Player {
  return {
    id: id as PlayerId,
    clubId: clubId as ClubId,
    firstName: 'T', lastName: id, birthDate: '1996-01-01',
    position: 'AILIER_GAUCHE' as Position, secondaryPositions: [], isJiff: true,
    technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
    physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
    mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: n, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2028, annualSalary: 100_000 },
    ...over,
  };
}

const stat = (over: Partial<LeaderStat> = {}): LeaderStat => ({
  matches: 10, minutes: 800, tries: 0, meters: 0, tackles: 0, turnovers: 0, ...over,
});

const contexte = (
  players: readonly Player[],
  stats: readonly [string, LeaderStat][],
  roundsPlayed = 12,
) => ({
  players,
  stats: new Map(stats.map(([id, s]) => [id as PlayerId, s])),
  roundsPlayed,
  clubNameOf: (p: Player) => `Club ${p.clubId as string}`,
});

describe('les compteurs se classent bruts', () => {
  it('le meilleur marqueur est celui qui a marqué le plus', () => {
    const rows = leaderboard('ESSAIS', contexte(
      [player('penaud'), player('villiere'), player('dupont')],
      [
        ['penaud', stat({ tries: 9 })],
        ['villiere', stat({ tries: 12, matches: 12 })],
        ['dupont', stat({ tries: 3 })],
      ],
    ));

    expect(rows.map(r => r.playerName)).toEqual(['T villiere', 'T penaud', 'T dupont']);
    expect(rows[0]!.value).toBe(12);
  });

  it('à égalité, celui qui a joué le moins passe devant', () => {
    // Autant produit en moins d'occasions. Le seul départage qui dise quelque
    // chose, plutôt que l'ordre alphabétique du hasard.
    const rows = leaderboard('ESSAIS', contexte(
      [player('a'), player('b')],
      [['a', stat({ tries: 8, matches: 14 })], ['b', stat({ tries: 8, matches: 9 })]],
    ));
    expect(rows[0]!.playerName).toBe('T b');
  });

  it('les mètres s\'arrondissent au mètre', () => {
    const rows = leaderboard('METRES', contexte(
      [player('a')], [['a', stat({ meters: 87.4 })]],
    ));
    expect(rows[0]!.value).toBe(87);
  });
});

describe('la note se classe en moyenne', () => {
  it('et exige une présence minimale', () => {
    // Un joueur revenu de blessure pour un match énorme ne trône pas devant
    // celui qui a tenu la saison.
    const seuil = Math.ceil(12 * MIN_PRESENCE_NOTE);
    const rows = leaderboard('NOTE', contexte(
      [player('regulier'), player('revenu')],
      [
        ['regulier', stat({ matches: 12, ratingSum: 12 * 7, ratedMatches: 12 })],
        ['revenu', stat({ matches: seuil - 1, ratingSum: 9.5, ratedMatches: 1 })],
      ],
    ));

    expect(rows.map(r => r.playerName)).toEqual(['T regulier']);
  });

  it('classe bien par moyenne et non par cumul', () => {
    const rows = leaderboard('NOTE', contexte(
      [player('a'), player('b')],
      [
        ['a', stat({ matches: 12, ratingSum: 12 * 6.2, ratedMatches: 12 })],
        ['b', stat({ matches: 6, ratingSum: 6 * 7.4, ratedMatches: 6 })],
      ],
    ));
    expect(rows[0]!.playerName).toBe('T b');
    expect(rows[0]!.value).toBe(7.4);
  });

  it('ignore un joueur qu\'aucun match n\'a noté', () => {
    // Sauvegardes antérieures à la V0.61 : le cumul existe, les notes non.
    const rows = leaderboard('NOTE', contexte(
      [player('a')], [['a', stat({ matches: 12 })]],
    ));
    expect(rows).toEqual([]);
  });
});

describe('ce qu\'un classement ne montre pas', () => {
  it('reste vide quand personne n\'a rien produit', () => {
    // Une colonne de zéros donne l'illusion d'une information.
    expect(leaderboard('GRATTAGES', contexte(
      [player('a'), player('b')], [['a', stat()], ['b', stat()]],
    ))).toEqual([]);
  });

  it('écarte les retraités et les joueurs sans club', () => {
    const rows = leaderboard('ESSAIS', contexte(
      [
        player('actif'),
        player('retraite', 'a', { retired: true }),
        player('libre', 'a', { freeAgent: true }),
      ],
      [
        ['actif', stat({ tries: 3 })],
        ['retraite', stat({ tries: 20 })],
        ['libre', stat({ tries: 15 })],
      ],
    ));
    expect(rows.map(r => r.playerName)).toEqual(['T actif']);
  });

  it('se limite à une division quand on le lui demande', () => {
    const rows = leaderboard('ESSAIS', {
      ...contexte(
        [player('top14', 'a'), player('prod2', 'z')],
        [['top14', stat({ tries: 5 })], ['prod2', stat({ tries: 9 })]],
      ),
      clubIds: new Set(['a' as ClubId]),
    });
    expect(rows.map(r => r.playerName)).toEqual(['T top14']);
  });

  it('et se coupe à la longueur demandée', () => {
    const players = Array.from({ length: 15 }, (_, i) => player(`p${i}`));
    const stats = players.map((p, i) => [p.id as string, stat({ tries: i + 1 })] as [string, LeaderStat]);
    expect(leaderboard('ESSAIS', contexte(players, stats), 5)).toHaveLength(5);
  });
});

describe('tous les classements d\'un coup', () => {
  it('sortent dans l\'ordre d\'affichage', () => {
    const tout = allLeaderboards(contexte(
      [player('a')], [['a', stat({ tries: 4, meters: 200, tackles: 30, turnovers: 2, ratingSum: 60, ratedMatches: 10 })]],
    ));
    expect(tout.map(t => t.kind)).toEqual(['ESSAIS', 'NOTE', 'METRES', 'PLAQUAGES', 'GRATTAGES']);
    expect(tout.every(t => t.rows.length === 1)).toBe(true);
  });
});
