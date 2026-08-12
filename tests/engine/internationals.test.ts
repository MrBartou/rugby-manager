/**
 * Le calendrier des trêves internationales.
 *
 * V0.60 : les tests de sélection ont disparu avec la sélection qu'ils testaient.
 * Elle appelait les trois meilleurs JIFF de chaque club, quarante-deux joueurs
 * pour une équipe de quinze, et n'était plus appelée par rien depuis que la
 * V0.58 a livré un vrai XV de France. Ce qui reste ici est le calendrier, qui
 * lui sert toujours.
 */

import { describe, it, expect } from 'vitest';
import {
  INTERNATIONAL_BREAK_ROUNDS,
  isInternationalBreak,
  isWindowClosing,
  windowOf,
} from '@/engine/season/internationals.js';

describe('isInternationalBreak', () => {
  it('reconnaît les rounds de trêve', () => {
    for (const r of INTERNATIONAL_BREAK_ROUNDS) {
      expect(isInternationalBreak(r)).toBe(true);
    }
    expect(isInternationalBreak(1)).toBe(false);
    expect(isInternationalBreak(20)).toBe(false);
  });
});

describe('les deux fenêtres de la saison', () => {
  it('distingue la tournée d\'automne du Tournoi', () => {
    expect(windowOf(9)).toBe('AUTOMNE');
    expect(windowOf(16)).toBe('TOURNOI');
    expect(windowOf(5)).toBeUndefined();
  });

  it('sait quelle journée solde les comptes', () => {
    expect(isWindowClosing(10)).toBe(true);
    expect(isWindowClosing(17)).toBe(true);
    expect(isWindowClosing(9)).toBe(false);
  });
});
