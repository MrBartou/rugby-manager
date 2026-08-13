/**
 * La sauvegarde cesse de grossir sans borne : v0.60.
 *
 * `playerOverrides` porte la base joueurs entière, et les retraités y restaient
 * à vie. Mesuré : un joueur sérialisé pèse environ 880 octets, la base de départ
 * en compte 262, et chaque saison y ajoute ses retraites et sa promotion de
 * jeunes. Vingt saisons de carrière, l'horizon annoncé de cette version,
 * suffisaient à approcher les cinq mégaoctets de `localStorage` : la partie
 * finissait par mourir d'un stockage plein sans que rien ne l'annonce.
 *
 * Ce qui est vérifié ici : les retraites récentes ne bougent pas, les anciennes
 * sortent, celles qui viennent des données de base se réduisent à un
 * identifiant, et les joueurs générés en cours de partie disparaissent sans
 * emporter les vivants.
 */

import { describe, expect, it } from 'vitest';
import {
  RETIREMENT_GRACE_SEASONS,
  pruneRetiredOverrides,
} from '@/data/season-save-repository.js';
import type { ClubId, Player, PlayerId, Position } from '@/engine/types.js';

const n = 70;

function player(id: string, over: Partial<Player> = {}): Player {
  return {
    id: id as PlayerId,
    clubId: 'a' as ClubId,
    firstName: 'T', lastName: id, birthDate: '1996-01-01',
    position: 'OUVREUR' as Position, secondaryPositions: [], isJiff: true,
    technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
    physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
    mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
    positionSpecific: { pousseeMelee: n },
    traits: [],
    hidden: { potentiel: n, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2028, annualSalary: 100_000 },
    ...over,
  };
}

const retraite = (id: string, season: number): Player =>
  player(id, { retired: true, retirementSeason: season });

/** Les identifiants qui viennent des données de base. */
const duSeed = (id: PlayerId): boolean => (id as string).startsWith('seed_');

describe('l\'élagage des retraités', () => {
  const SAISON = 2040;

  it('ne touche pas aux joueurs en activité', () => {
    const vivants = [player('seed_1'), player('genere_1')];
    const { overrides, retiredSeedPlayerIds } = pruneRetiredOverrides(vivants, SAISON, duSeed);

    expect(overrides).toHaveLength(2);
    expect(retiredSeedPlayerIds).toEqual([]);
  });

  it('garde une retraite récente entière', () => {
    // Elle s'affiche encore dans le bilan d'intersaison.
    const recente = retraite('seed_1', SAISON - (RETIREMENT_GRACE_SEASONS - 1));
    const { overrides } = pruneRetiredOverrides([recente], SAISON, duSeed);

    expect(overrides.map(p => p.id as string)).toEqual(['seed_1']);
  });

  it('réduit une vieille retraite du seed à son identifiant', () => {
    const ancienne = retraite('seed_1', SAISON - RETIREMENT_GRACE_SEASONS);
    const { overrides, retiredSeedPlayerIds } = pruneRetiredOverrides([ancienne], SAISON, duSeed);

    expect(overrides).toEqual([]);
    expect(retiredSeedPlayerIds).toEqual(['seed_1']);
  });

  it('efface un joueur généré et depuis longtemps retraité', () => {
    // Rien ne permettrait de le reconstruire, et rien n'y renvoie : son passage
    // reste au registre de carrière, qui garde ses propres lignes.
    const jeune = retraite('genere_1', SAISON - 10);
    const { overrides, retiredSeedPlayerIds } = pruneRetiredOverrides([jeune], SAISON, duSeed);

    expect(overrides).toEqual([]);
    expect(retiredSeedPlayerIds).toEqual([]);
  });

  it('ne touche pas à une retraite sans année connue', () => {
    // Sauvegardes antérieures à V0.6 : on ne devine pas ce qu'on ignore.
    const sansDate = player('seed_1', { retired: true });
    const { overrides } = pruneRetiredOverrides([sansDate], SAISON, duSeed);

    expect(overrides).toHaveLength(1);
  });

  it('allège réellement ce qui est écrit', () => {
    const base = [player('seed_actif'), player('genere_actif')];
    const morts = Array.from({ length: 200 }, (_, i) => retraite(`seed_${i}`, SAISON - 5));

    const avant = JSON.stringify([...base, ...morts]).length;
    const { overrides, retiredSeedPlayerIds } = pruneRetiredOverrides(
      [...base, ...morts], SAISON, duSeed,
    );
    const apres = JSON.stringify(overrides).length + JSON.stringify(retiredSeedPlayerIds).length;

    expect(overrides).toHaveLength(2);
    expect(apres).toBeLessThan(avant / 10);
  });
});
