/**
 * Fil d'actualité — V0.38.
 *
 * Deux propriétés portent tout le reste : le journal ne **duplique** pas —
 * rejouer une intersaison après un rechargement est le cas normal — et il ne
 * **grossit pas sans fin**, faute de quoi une carrière longue alourdirait
 * chaque sauvegarde.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_NEWS,
  NEWS_CAPACITY,
  appendNews,
  filterNews,
  newsFromInjury,
  newsFromMarket,
  newsFromResult,
  newsFromSeasonEnd,
  seasonsInFeed,
  type NewsItem,
} from '../../src/engine/season/news.js';
import type { ClubId } from '../../src/engine/types.js';

const MINE = 'moi' as ClubId;

function entry(over: Partial<Omit<NewsItem, 'id'>> = {}): Omit<NewsItem, 'id'> {
  return {
    season: 2026, round: 5, kind: 'RESULTAT',
    headline: 'Quelque chose est arrivé', involvesPlayer: false, ...over,
  };
}

describe('journal', () => {
  it('ajoute en tête : le plus récent d\'abord', () => {
    let feed = appendNews(EMPTY_NEWS, [entry({ headline: 'ancien' })]);
    feed = appendNews(feed, [entry({ headline: 'récent', round: 6 })]);
    expect(feed.items[0]!.headline).toBe('récent');
  });

  it('ne duplique pas une entrée déjà consignée', () => {
    const e = entry({ headline: 'Match nul à Pau' });
    let feed = appendNews(EMPTY_NEWS, [e]);
    // Rejouer la même journée arrive à chaque rechargement de sauvegarde.
    feed = appendNews(feed, [e]);
    expect(feed.items).toHaveLength(1);
  });

  it('distingue deux entrées identiques de journées différentes', () => {
    let feed = appendNews(EMPTY_NEWS, [entry({ headline: 'Victoire', round: 3 })]);
    feed = appendNews(feed, [entry({ headline: 'Victoire', round: 9 })]);
    expect(feed.items).toHaveLength(2);
  });

  it('plafonne pour ne pas alourdir la sauvegarde', () => {
    let feed = EMPTY_NEWS;
    for (let i = 0; i < NEWS_CAPACITY + 50; i++) {
      feed = appendNews(feed, [entry({ headline: `entrée ${i}`, round: i })]);
    }
    expect(feed.items).toHaveLength(NEWS_CAPACITY);
    // Ce sont les plus récentes qu'on garde.
    expect(feed.items[0]!.headline).toBe(`entrée ${NEWS_CAPACITY + 49}`);
  });

  it('ordonne du plus récent au plus ancien, quel que soit l\'ordre d\'arrivée', () => {
    // Les entrées viennent de plusieurs sources — journée, mercato, fin de
    // saison — qui ne se suivent pas dans l'ordre chronologique.
    let feed = appendNews(EMPTY_NEWS, [entry({ headline: 'a', round: 14 })]);
    feed = appendNews(feed, [entry({ headline: 'b', round: 13 })]);
    feed = appendNews(feed, [entry({ headline: 'c', round: 16 })]);
    feed = appendNews(feed, [entry({ headline: 'd', round: 3, season: 2027 })]);

    expect(feed.items.map(i => i.headline)).toEqual(['d', 'c', 'a', 'b']);
  });

  it('ne recrée pas d\'objet quand il n\'y a rien à ajouter', () => {
    const feed = appendNews(EMPTY_NEWS, [entry()]);
    expect(appendNews(feed, [])).toBe(feed);
  });
});

describe('filtres', () => {
  const feed = appendNews(EMPTY_NEWS, [
    entry({ kind: 'TRANSFERT', headline: 'A', involvesPlayer: true, season: 2026 }),
    entry({ kind: 'BLESSURE', headline: 'B', involvesPlayer: true, season: 2026 }),
    entry({ kind: 'TRANSFERT', headline: 'C', involvesPlayer: false, season: 2027 }),
  ]);

  it('filtre par nature', () => {
    expect(filterNews(feed, { kind: 'TRANSFERT' })).toHaveLength(2);
  });

  it('filtre sur le club de l\'utilisateur', () => {
    expect(filterNews(feed, { mineOnly: true })).toHaveLength(2);
  });

  it('filtre par saison', () => {
    expect(filterNews(feed, { season: 2027 })).toHaveLength(1);
  });

  it('liste les saisons de la plus récente à la plus ancienne', () => {
    expect(seasonsInFeed(feed)).toEqual([2027, 2026]);
  });
});

describe('rédaction', () => {
  it('résume un mercato et détaille ses mouvements', () => {
    const items = newsFromMarket([
      { kind: 'TRANSFERT', playerName: 'Dupont', fromClubName: 'A', toClubName: 'B',
        toClubId: 'b' as ClubId, fromClubId: 'a' as ClubId, fee: 8_000_000, overall: 90 },
      { kind: 'PROLONGATION', playerName: 'Autre', fromClubName: 'A', toClubName: 'A',
        toClubId: 'a' as ClubId, fromClubId: 'a' as ClubId, fee: 0, overall: 70 },
    ], 2026, 0, MINE, 'Mercato estival');

    // Les prolongations n'entrent pas : en consigner cent cinquante noierait le
    // fil le jour de la falaise de contrats.
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('MERCATO');
    expect(items[0]!.headline).toMatch(/1 mouvement/);
    expect(items[1]!.detail).toMatch(/8\.00 M€/);
  });

  it('ne produit rien quand aucun mouvement ne se raconte', () => {
    expect(newsFromMarket([
      { kind: 'PROLONGATION', playerName: 'X', fromClubName: 'A', toClubName: 'A',
        toClubId: 'a' as ClubId, fromClubId: 'a' as ClubId, fee: 0, overall: 70 },
    ], 2026, 0, MINE, 'Mercato estival')).toHaveLength(0);
  });

  it('un agent libre s\'engage, il ne quitte personne', () => {
    const items = newsFromMarket([
      { kind: 'RECRUE_LIBRE', playerName: 'Bonnet', fromClubName: 'Sans club', toClubName: 'Vannes',
        toClubId: 'v' as ClubId, fromClubId: 'libre' as ClubId, fee: 0, overall: 46 },
    ], 2026, 13, MINE, 'Mercato hivernal');
    const transfert = items.find(i => i.kind === 'TRANSFERT')!;
    expect(transfert.headline).toMatch(/s'engage avec Vannes/);
    expect(transfert.headline).not.toMatch(/quitte/);
  });

  it('signale un transfert impliquant le club de l\'utilisateur', () => {
    const items = newsFromMarket([
      { kind: 'TRANSFERT', playerName: 'X', fromClubName: 'Moi', toClubName: 'B',
        toClubId: 'b' as ClubId, fromClubId: MINE, fee: 1_000_000, overall: 80 },
    ], 2026, 0, MINE, 'Mercato estival');
    expect(items.find(i => i.kind === 'TRANSFERT')!.involvesPlayer).toBe(true);
  });

  it('consigne une blessure longue', () => {
    const item = newsFromInjury({
      playerName: 'Alldritt', injuryType: 'LIGAMENTAIRE', returnsAtRound: 22,
      season: 2026, round: 8, clubId: MINE,
    });
    expect(item.headline).toMatch(/J22/);
    expect(item.involvesPlayer).toBe(true);
  });

  it('ne retient un match que s\'il sort de l\'ordinaire', () => {
    const base = { season: 2026, round: 4, opponentName: 'Pau', atHome: true, clubId: MINE };
    // Un fil qui retient tous les matchs n'est plus un fil, c'est un calendrier.
    expect(newsFromResult({ ...base, myScore: 22, theirScore: 19 })).toBeUndefined();
    expect(newsFromResult({ ...base, myScore: 45, theirScore: 10 })).toBeDefined();
    expect(newsFromResult({ ...base, myScore: 6, theirScore: 40 })!.headline).toMatch(/Correction/);
  });

  it('consigne le titre et le classement final', () => {
    const items = newsFromSeasonEnd({
      season: 2026, championName: 'Toulouse',
      playerClubName: 'La Rochelle', playerRank: 3, playerClubId: MINE,
    });
    expect(items).toHaveLength(2);
    expect(items[0]!.headline).toMatch(/champion/i);
    expect(items[1]!.headline).toMatch(/3ᵉ/);
    expect(items[0]!.involvesPlayer).toBe(false);
  });
});

describe('rédaction — libérations pour le plafond (V0.46)', () => {
  it('dit qu\'un joueur est libéré, pas qu\'il s\'engage', () => {
    // Sans cette formulation, un cadre disparaissait de son club sans la
    // moindre explication dans le fil.
    const items = newsFromMarket([
      { kind: 'DEPART_LIBRE', playerName: 'Dupont', fromClubName: 'Toulouse', toClubName: 'Sans club',
        toClubId: 'libre' as ClubId, fromClubId: 'toulouse' as ClubId, fee: 0, overall: 92 },
    ], 2026, 0, MINE, 'Mercato estival');
    const t = items.find(i => i.kind === 'TRANSFERT')!;
    expect(t.headline).toMatch(/libéré par Toulouse/);
    expect(t.headline).not.toMatch(/s'engage/);
    expect(t.detail).toMatch(/Masse salariale/);
  });

  it('rattache l\'entrée au club qui perd le joueur', () => {
    const items = newsFromMarket([
      { kind: 'DEPART_LIBRE', playerName: 'X', fromClubName: 'Toulouse', toClubName: 'Sans club',
        toClubId: 'libre' as ClubId, fromClubId: 'toulouse' as ClubId, fee: 0, overall: 80 },
    ], 2026, 0, MINE, 'Mercato estival');
    expect(items.find(i => i.kind === 'TRANSFERT')!.clubId).toBe('toulouse');
  });
});
