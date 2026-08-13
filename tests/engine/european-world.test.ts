/**
 * L'Europe persistante (V0.63).
 *
 * Le défaut corrigé : les adversaires européens étaient régénérés chaque
 * saison. Battre un club en poule ne voulait rien dire, puisqu'il n'existait
 * pas avant le tirage et n'existerait plus après. Et personne ne remportait la
 * coupe d'Europe les années où le club dirigé n'y était pas.
 *
 * Ce qui est vérifié ici : les clubs durent, leurs effectifs aussi, le
 * continent bouge sans se tasser contre ses bornes, et chaque saison désigne
 * deux vainqueurs, dont le nôtre quand c'est nous qui avons gagné sur le
 * terrain.
 */

import { describe, expect, it } from 'vitest';
import {
  clubsOfCompetition,
  createEuropeanWorld,
  drawPoolOpponents,
  asOpponent,
  europeanRollOfHonour,
  outcomeOfCampaign,
  palmaresLabel,
  runEuropeanSeason,
  EUROPEAN_CLUB_COUNT,
  type EuropeanWorld,
  type FrenchEntrant,
} from '../../src/engine/season/european-world.js';
import { generatePoolCampaign, type EuropeanCampaign } from '../../src/engine/season/european-cup.js';
import { buildEuropeanSquad } from '../../src/data/european-opponent.js';
import type { ClubId } from '../../src/engine/types.js';

const SEED = 'monde';
const SEASON = 2025;

function monde(): EuropeanWorld {
  return createEuropeanWorld(SEED, SEASON);
}

/** Les dix clubs français qualifiés, de la première à la dixième place. */
function entrants(): readonly FrenchEntrant[] {
  const out: FrenchEntrant[] = [];
  for (let rank = 1; rank <= 10; rank++) {
    out.push({
      clubId: `fr${rank}` as ClubId,
      name: `Club français ${rank}`,
      competition: rank <= 6 ? 'CHAMPIONS_CUP' : 'CHALLENGE_CUP',
      strength: 78 - rank * 2,
    });
  }
  return out;
}

describe('le continent existe', () => {
  it('trente-deux clubs, tous de villes différentes', () => {
    const world = monde();
    expect(world.clubs).toHaveLength(EUROPEAN_CLUB_COUNT);
    expect(new Set(world.clubs.map(c => c.city)).size).toBe(EUROPEAN_CLUB_COUNT);
    expect(new Set(world.clubs.map(c => c.id)).size).toBe(EUROPEAN_CLUB_COUNT);
  });

  it('se répartit entre les deux coupes sans qu\'un club joue les deux', () => {
    const world = monde();
    const majeure = clubsOfCompetition(world, 'CHAMPIONS_CUP');
    const challenge = clubsOfCompetition(world, 'CHALLENGE_CUP');
    expect(majeure.length + challenge.length).toBe(EUROPEAN_CLUB_COUNT);
    const croisement = majeure.filter(c => challenge.some(o => o.id === c.id));
    expect(croisement).toHaveLength(0);
    // La coupe majeure prend les meilleurs : c'est la seule conséquence visible
    // du niveau d'un club étranger.
    const pireMajeure = Math.min(...majeure.map(c => c.strength));
    const meilleurChallenge = Math.max(...challenge.map(c => c.strength));
    expect(pireMajeure).toBeGreaterThanOrEqual(meilleurChallenge);
  });

  it('tire quatre adversaires distincts, et le même tirage à chaque appel', () => {
    const world = monde();
    const draw = (): readonly string[] => drawPoolOpponents({
      world, competition: 'CHAMPIONS_CUP', season: SEASON, seed: SEED, count: 4,
    }).map(c => c.id as string);

    const premier = draw();
    expect(premier).toHaveLength(4);
    expect(new Set(premier).size).toBe(4);
    // Un tirage au sort a lieu une fois, pas à chaque ouverture d'un écran.
    expect(draw()).toEqual(premier);
    // Et il change d'une saison à l'autre.
    const suivante = drawPoolOpponents({
      world, competition: 'CHAMPIONS_CUP', season: SEASON + 1, seed: SEED, count: 4,
    }).map(c => c.id as string);
    expect(suivante).not.toEqual(premier);
  });
});

describe('un adversaire garde son effectif', () => {
  it('les mêmes hommes reviennent la saison suivante, un an de plus', () => {
    const club = asOpponent(monde().clubs[0]!);
    const cette = buildEuropeanSquad(club, 'peu-importe', SEASON);
    const suivante = buildEuropeanSquad(club, 'autre-graine', SEASON + 1);

    const noms = (s: typeof cette): readonly string[] =>
      s.players.map(p => `${p.firstName} ${p.lastName}`);

    // Le renouvellement change quelques postes, pas l'équipe.
    const communs = noms(cette).filter(n => noms(suivante).includes(n));
    expect(communs.length).toBeGreaterThanOrEqual(18);

    const ouvreur = cette.players.find(p => p.position === 'OUVREUR')!;
    const memeOuvreur = suivante.players.find(p => p.id === ouvreur.id);
    if (memeOuvreur) {
      expect(Number(memeOuvreur.birthDate.slice(0, 4))).toBe(Number(ouvreur.birthDate.slice(0, 4)));
    }
  });

  it('vieillit sans devenir une maison de retraite', () => {
    const club = asOpponent(monde().clubs[3]!);
    const ages = (season: number): readonly number[] =>
      buildEuropeanSquad(club, 's', season).players
        .map(p => season - Number(p.birthDate.slice(0, 4)));

    for (const season of [SEASON, SEASON + 5, SEASON + 12, SEASON + 20]) {
      const liste = ages(season);
      expect(Math.max(...liste)).toBeLessThanOrEqual(34);
      expect(Math.min(...liste)).toBeGreaterThanOrEqual(19);
    }
  });
});

describe('la saison européenne des autres', () => {
  it('désigne deux vainqueurs par saison, et les archive', () => {
    const result = runEuropeanSeason({
      world: monde(), season: SEASON, seed: SEED, frenchEntrants: entrants(),
    });
    expect(result.honours).toHaveLength(2);
    expect(result.honours.map(h => h.competition).sort())
      .toEqual(['CHALLENGE_CUP', 'CHAMPIONS_CUP']);
    for (const h of result.honours) {
      expect(h.winnerName).not.toBe(h.runnerUpName);
      expect(h.season).toBe(SEASON);
    }
    expect(result.world.honours).toHaveLength(2);
  });

  it('inscrit le titre au palmarès du club qui l\'a gagné', () => {
    const result = runEuropeanSeason({
      world: monde(), season: SEASON, seed: SEED, frenchEntrants: entrants(),
    });
    for (const h of result.honours) {
      if (h.frenchWinner) continue;
      const champion = result.world.clubs.find(c => c.name === h.winnerName)!;
      expect(champion.championsTitles + champion.challengeTitles).toBe(1);
      expect(palmaresLabel(champion)).toBeDefined();
    }
  });

  it('le parcours réel du club dirigé prime sur la simulation', () => {
    // Une coupe gagnée sur le terrain ne peut pas être perdue en quart par le
    // tableau abstrait, et inversement.
    const gagnant = runEuropeanSeason({
      world: monde(),
      season: SEASON,
      seed: SEED,
      frenchEntrants: entrants(),
      playerClub: {
        clubId: 'fr3' as ClubId,
        competition: 'CHAMPIONS_CUP',
        outcome: 'WINNER',
      },
    });
    const majeure = gagnant.honours.find(h => h.competition === 'CHAMPIONS_CUP')!;
    expect(majeure.winnerName).toBe('Club français 3');
    expect(majeure.frenchWinner).toBe(true);

    const sorti = runEuropeanSeason({
      world: monde(),
      season: SEASON,
      seed: SEED,
      frenchEntrants: entrants(),
      playerClub: {
        clubId: 'fr3' as ClubId,
        competition: 'CHAMPIONS_CUP',
        outcome: 'POOL_OUT',
      },
    });
    const sansNous = sorti.honours.find(h => h.competition === 'CHAMPIONS_CUP')!;
    expect(sansNous.winnerName).not.toBe('Club français 3');
    expect(sansNous.runnerUpName).not.toBe('Club français 3');
  });

  it('vingt saisons ne tassent pas le continent contre ses bornes', () => {
    let world = monde();
    for (let i = 0; i < 20; i++) {
      world = runEuropeanSeason({
        world, season: SEASON + i, seed: SEED, frenchEntrants: entrants(),
      }).world;
    }
    const niveaux = world.clubs.map(c => c.strength);
    expect(Math.max(...niveaux)).toBeLessThanOrEqual(88);
    expect(Math.min(...niveaux)).toBeGreaterThanOrEqual(38);
    // Un continent où tout le monde se vaut n'a plus de tirage intéressant.
    expect(Math.max(...niveaux) - Math.min(...niveaux)).toBeGreaterThan(10);
    expect(world.honours).toHaveLength(40);
    // Au bout de vingt ans, on sait qui a dominé.
    const palmares = europeanRollOfHonour(world);
    expect(palmares.length).toBeGreaterThan(0);
    expect(palmares[0]!.titles + palmares[0]!.challenges).toBeGreaterThan(0);
  });

  it('chaque club joue une saison de plus par saison', () => {
    const result = runEuropeanSeason({
      world: monde(), season: SEASON, seed: SEED, frenchEntrants: entrants(),
    });
    expect(result.world.clubs.every(c => c.seasonsPlayed === 1)).toBe(true);
  });
});

describe('le parcours du club dirigé se lit dans ses résultats', () => {
  const campagne = (
    results: readonly { stage: 'POOL' | 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL'; pour: number; contre: number }[],
  ): EuropeanCampaign => ({
    ...generatePoolCampaign('CHAMPIONS_CUP', 'x'),
    results: results.map((r, i) => ({
      round: 9 + i,
      stage: r.stage,
      opponentName: `Adversaire ${i}`,
      clubScore: r.pour,
      opponentScore: r.contre,
      atHome: i % 2 === 0,
    })),
  });

  it('sorti de poule, éliminé en quart, ou vainqueur', () => {
    const poules = [
      { stage: 'POOL' as const, pour: 10, contre: 30 },
      { stage: 'POOL' as const, pour: 12, contre: 20 },
      { stage: 'POOL' as const, pour: 9, contre: 25 },
      { stage: 'POOL' as const, pour: 14, contre: 18 },
    ];
    expect(outcomeOfCampaign(campagne(poules))).toBe('POOL_OUT');

    const qualifie = poules.map(p => ({ ...p, pour: 30, contre: 10 }));
    expect(outcomeOfCampaign(campagne([
      ...qualifie,
      { stage: 'ROUND_OF_16', pour: 25, contre: 12 },
      { stage: 'QUARTERFINAL', pour: 11, contre: 24 },
    ]))).toBe('QUARTERFINAL');

    expect(outcomeOfCampaign(campagne([
      ...qualifie,
      { stage: 'ROUND_OF_16', pour: 25, contre: 12 },
      { stage: 'QUARTERFINAL', pour: 25, contre: 12 },
      { stage: 'SEMIFINAL', pour: 25, contre: 12 },
      { stage: 'FINAL', pour: 19, contre: 17 },
    ]))).toBe('WINNER');

    expect(outcomeOfCampaign(campagne([
      ...qualifie,
      { stage: 'ROUND_OF_16', pour: 25, contre: 12 },
      { stage: 'QUARTERFINAL', pour: 25, contre: 12 },
      { stage: 'SEMIFINAL', pour: 25, contre: 12 },
      { stage: 'FINAL', pour: 17, contre: 19 },
    ]))).toBe('RUNNER_UP');
  });
});
