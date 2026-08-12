/**
 * La hiérarchie de l'effectif — V0.50.
 *
 * Le statut d'un joueur n'a jamais été qu'une **déduction** de son temps de
 * jeu : le manager ne pouvait rien annoncer, donc rien tenir ni rien trahir.
 *
 * La propriété qui fait de l'annonce une décision : c'est **l'écart** entre ce
 * qui a été dit et ce qui est vécu qui décide du moral, jamais le temps de jeu
 * brut. Et un XV ne contient que quinze places, ce qui interdit de promettre le
 * même rôle à tout le monde.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATUS,
  EXPECTED_RATIO,
  SEASON_PLACES,
  coherence,
  departureRisk,
  inferStatus,
  judgeStatus,
  salaryExpectation,
  statusOf,
  type SquadStatus,
} from '../../src/engine/club/squad-status.js';
import { computeMood } from '../../src/engine/human/mood.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId, TraitId } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE: Player = SQUAD.players[0]!;

const withTraits = (ids: readonly string[]): Player =>
  ({ ...BASE, traits: ids as readonly TraitId[] });

describe('c\'est l\'écart qui compte, pas les minutes', () => {
  it('un espoir à 15 % est en paix, un cadre aux mêmes minutes est amer', () => {
    const espoir = judgeStatus('ESPOIR', 0.15);
    const cadre = judgeStatus('CADRE', 0.15);
    expect(espoir.verdict).toBe('TENU');
    expect(espoir.moodDelta).toBeGreaterThan(0);
    expect(cadre.verdict).toBe('SOUS_UTILISE');
    expect(cadre.moodDelta).toBeLessThan(-8);
  });

  it('le manque à gagner se paie proportionnellement', () => {
    const peu = judgeStatus('CADRE', 0.5);
    const pas = judgeStatus('CADRE', 0.05);
    expect(pas.moodDelta).toBeLessThan(peu.moodDelta);
  });

  it('jouer plus que promis ne rend jamais malheureux', () => {
    const surclassé = judgeStatus('ESPOIR', 0.7);
    expect(surclassé.verdict).toBe('SUR_UTILISE');
    expect(surclassé.moodDelta).toBeGreaterThan(0);
  });

  it('tolère les aléas d\'une saison sans crier à la trahison', () => {
    // Un cadre à 60 % quand on lui en promettait 75 : blessures, suspensions,
    // adversaires qui ne conviennent pas. Personne ne s'en offusque.
    expect(judgeStatus('CADRE', 0.6).verdict).toBe('TENU');
  });

  it('être hors projet coûte, même quand c\'est « tenu »', () => {
    const horsProjet = judgeStatus('HORS_PROJET', 0);
    expect(horsProjet.verdict).toBe('TENU');
    expect(horsProjet.moodDelta).toBeLessThan(0);
  });

  it('le tempérament amplifie la mise à l\'écart', () => {
    const ambitieux = judgeStatus('CADRE', 0.2, ['ambitieux', 'rancunier']);
    const satisfait = judgeStatus('CADRE', 0.2, ['satisfait', 'professionnel']);
    expect(ambitieux.moodDelta).toBeLessThan(satisfait.moodDelta);
  });

  it('ne descend jamais dans un puits sans fond', () => {
    expect(judgeStatus('CADRE', 0, ['ambitieux', 'mercenaire', 'rancunier']).moodDelta)
      .toBeGreaterThanOrEqual(-22);
  });
});

describe('le moral suit l\'annonce, pas le temps de jeu', () => {
  const player = withTraits([]);
  const mood = (playRatio: number, squadStatus?: SquadStatus): number =>
    computeMood({
      player, recentResults: [0, 0, 0], playRatio, currentSeason: 2025,
      ...(squadStatus !== undefined ? { squadStatus } : {}),
    }).mood;

  it('un jeune annoncé espoir n\'est plus puni de ne pas jouer', () => {
    // Sans annonce, 15 % de temps de jeu valait « peu utilisé », soit -10.
    expect(mood(0.15, 'ESPOIR')).toBeGreaterThan(mood(0.15));
  });

  it('un remplaçant annoncé cadre va plus mal qu\'un remplaçant sans promesse', () => {
    expect(mood(0.15, 'CADRE')).toBeLessThan(mood(0.15));
  });

  it('sans annonce, rien ne change pour une sauvegarde antérieure', () => {
    // C'est la garantie de compatibilité : le statut reste déduit.
    for (const ratio of [0, 0.2, 0.5, 0.9]) {
      expect(mood(ratio)).toBe(mood(ratio, undefined));
    }
  });
});

describe('un XV ne contient que quinze places', () => {
  const fill = (n: number, s: SquadStatus): SquadStatus[] => Array.from({ length: n }, () => s);

  it('refuse une hiérarchie où tout le monde est cadre', () => {
    expect(coherence(fill(30, 'CADRE')).overcommitted).toBe(true);
  });

  it('accepte une hiérarchie qui tient dans une saison', () => {
    const report = coherence([
      ...fill(15, 'CADRE'), ...fill(8, 'ROTATION'), ...fill(5, 'ESPOIR'), ...fill(2, 'HORS_PROJET'),
    ]);
    expect(report.overcommitted).toBe(false);
    expect(report.promisedPlaces).toBeLessThanOrEqual(report.availablePlaces * 1.05);
  });

  it('compte les places d\'une saison, banc compris', () => {
    expect(SEASON_PLACES).toBeGreaterThan(15);
    expect(SEASON_PLACES).toBeLessThan(23);
  });

  it('dit ce qu\'il compte, dans les deux cas', () => {
    expect(coherence(fill(30, 'CADRE')).summary).toContain('trop');
    expect(coherence(fill(4, 'ESPOIR')).summary).toContain('espoirs');
  });
});

describe('le statut engage ailleurs que sur le moral', () => {
  it('un cadre se sait cadre et le fait payer', () => {
    expect(salaryExpectation('CADRE')).toBeGreaterThan(salaryExpectation('ROTATION'));
    expect(salaryExpectation('HORS_PROJET')).toBeLessThan(salaryExpectation('ROTATION'));
  });

  it('mettre quelqu\'un hors projet le pousse vers la sortie', () => {
    expect(departureRisk('HORS_PROJET', 'TENU')).toBeGreaterThan(0.2);
  });

  it('un cadre qu\'on ne fait pas jouer part plus qu\'un espoir dans le même cas', () => {
    expect(departureRisk('CADRE', 'SOUS_UTILISE'))
      .toBeGreaterThan(departureRisk('ESPOIR', 'SOUS_UTILISE'));
  });

  it('ne pousse personne dehors quand la parole est tenue', () => {
    expect(departureRisk('CADRE', 'TENU')).toBe(0);
    expect(departureRisk('ESPOIR', 'TENU')).toBe(0);
  });
});

describe('le repli sur ce que le temps de jeu suggère', () => {
  it('propose cadre à un titulaire, espoir à un jeune qui ne joue pas', () => {
    expect(inferStatus(0.8, 28)).toBe('CADRE');
    expect(inferStatus(0.05, 20)).toBe('ESPOIR');
    expect(inferStatus(0, 31)).toBe('HORS_PROJET');
  });

  it('la déclaration prime toujours sur la déduction', () => {
    const map = new Map<PlayerId, SquadStatus>([[BASE.id, 'HORS_PROJET']]);
    expect(statusOf(map, BASE, 0.9, 2025)).toBe('HORS_PROJET');
    expect(statusOf(new Map(), BASE, 0.9, 2025)).toBe('CADRE');
  });

  it('les ratios attendus vont bien du plus au moins exigeant', () => {
    expect(EXPECTED_RATIO.CADRE).toBeGreaterThan(EXPECTED_RATIO.ROTATION);
    expect(EXPECTED_RATIO.ROTATION).toBeGreaterThan(EXPECTED_RATIO.ESPOIR);
    expect(EXPECTED_RATIO.HORS_PROJET).toBe(0);
    expect(EXPECTED_RATIO[DEFAULT_STATUS]).toBe(EXPECTED_RATIO.ROTATION);
  });
});
