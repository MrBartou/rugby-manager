/**
 * Le banc du XV de France — V0.59.
 *
 * La carrière de manager mène de club en club, de plus en plus gros, et
 * s'arrête là. La sélection est l'autre direction — pas plus haut, ailleurs.
 *
 * Ce qui est vérifié ici : l'appel est **rare** (sans quoi il ne vaudrait
 * rien), la lettre dit franchement ce que le poste coûte, et on peut en être
 * démis — un poste dont on ne peut pas tomber est un décor.
 */

import { describe, expect, it } from 'vitest';
import {
  FEDERATION_MIN_REPUTATION,
  FEDERATION_MIN_SEASONS,
  federationApproaches,
  federationLetter,
  reviewNationalSeason,
} from '../../src/engine/season/national-job.js';
import { reportWindow, type InternationalResult } from '../../src/engine/season/national-team.js';
import type { ManagerReputation } from '../../src/engine/season/manager-reputation.js';

const gagnant: ManagerReputation = { score: 80, seasonsManaged: 6, titlesWon: 2 };

const approche = (over: Partial<ManagerReputation> = {}, vacant = true, inPost = false) =>
  federationApproaches({
    reputation: { ...gagnant, ...over },
    vacant,
    alreadyInPost: inPost,
  });

describe('la fédération ne recrute pas n\'importe qui', () => {
  it('approche un manager titré et installé', () => {
    expect(approche()).toBe(true);
  });

  it('mais pas un débutant, même brillant', () => {
    expect(approche({ seasonsManaged: FEDERATION_MIN_SEASONS - 1 })).toBe(false);
  });

  it('ni une réputation insuffisante', () => {
    expect(approche({ score: FEDERATION_MIN_REPUTATION - 1 })).toBe(false);
  });

  it('ni quelqu\'un qui n\'a jamais rien gagné', () => {
    // Une réputation bâtie sur des maintiens honorables ne suffit pas : c'est
    // ce qui doit rendre l'appel mémorable.
    expect(approche({ titlesWon: 0 })).toBe(false);
  });

  it('et pas quand le poste est occupé', () => {
    expect(approche({}, false)).toBe(false);
    expect(approche({}, true, true)).toBe(false);
  });
});

describe('la lettre ne cache pas le prix', () => {
  it('dit qu\'il faut quitter son club, en le nommant', () => {
    const texte = federationLetter(gagnant, 'Stade Toulousain');
    expect(texte).toContain('Stade Toulousain');
    expect(texte).toContain('ne se cumule pas');
  });

  it('et rappelle ce qu\'elle a vu', () => {
    expect(federationLetter(gagnant, undefined)).toContain('2 Boucliers');
    expect(federationLetter({ ...gagnant, titlesWon: 1 }, undefined))
      .toContain('un Bouclier');
  });

  it('sans mention du club pour un manager sans poste', () => {
    expect(federationLetter(gagnant, undefined)).not.toContain('quitter');
  });
});

describe('on juge le sélectionneur sur le Tournoi', () => {
  const tournoi = (victoires: number) => {
    const results: InternationalResult[] = Array.from({ length: 5 }, (_, i) => ({
      opponent: `Adv${i}`,
      franceScore: i < victoires ? 30 : 10,
      opponentScore: i < victoires ? 10 : 30,
      home: i % 2 === 0,
    }));
    return reportWindow('TOURNOI', results);
  };

  it('un Grand Chelem rapporte gros', () => {
    const r = reviewNationalSeason({ tournament: tournoi(5), consecutiveFailures: 0 });
    expect(r.verdict).toBe('EXCELLENT');
    expect(r.reputationDelta).toBeGreaterThan(10);
    expect(r.dismissed).toBe(false);
  });

  it('trois victoires, c\'est honnête sans plus', () => {
    const r = reviewNationalSeason({ tournament: tournoi(3), consecutiveFailures: 0 });
    expect(r.verdict).toBe('CORRECT');
    expect(Math.abs(r.reputationDelta)).toBeLessThan(4);
  });

  it('un premier échec coûte de la réputation, pas la place', () => {
    const r = reviewNationalSeason({ tournament: tournoi(1), consecutiveFailures: 0 });
    expect(r.verdict).toBe('INSUFFISANT');
    expect(r.reputationDelta).toBeLessThan(0);
    expect(r.dismissed).toBe(false);
  });

  it('le second l\'emporte', () => {
    // Un poste dont on ne peut pas tomber n'est pas un poste.
    const r = reviewNationalSeason({ tournament: tournoi(1), consecutiveFailures: 1 });
    expect(r.dismissed).toBe(true);
  });

  it('et un bon Tournoi remet le compteur à zéro côté appelant', () => {
    // Le module ne gère pas le compteur : il dit seulement si la mission
    // s'arrête. C'est l'appelant qui remet à zéro après un verdict correct —
    // ce test documente le contrat plutôt qu'un comportement interne.
    expect(reviewNationalSeason({ tournament: tournoi(4), consecutiveFailures: 1 }).dismissed)
      .toBe(false);
  });

  it('une saison sans Tournoi disputé compte comme un échec', () => {
    const r = reviewNationalSeason({ tournament: undefined, consecutiveFailures: 0 });
    expect(r.verdict).toBe('INSUFFISANT');
  });
});
