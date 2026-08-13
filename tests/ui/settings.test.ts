/**
 * Les préférences du joueur : V0.62.
 *
 * Aucun écran de réglages n'existait. Ce qui est vérifié ici tient en une
 * phrase : une préférence abîmée ne doit jamais empêcher le jeu de démarrer.
 * C'est la leçon de la v0.60 sur le stockage, appliquée avant qu'elle ne coûte
 * quelque chose.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  applySettings,
  loadSettings,
  saveSettings,
  type Settings,
} from '@/ui/settings.js';

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, String(v)); }
  removeItem(k: string): void { this.data.delete(k); }
  key(i: number): string | null { return [...this.data.keys()][i] ?? null; }
}

const memory = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = memory;

const CLE = 'rm_settings_v1';

beforeEach(() => localStorage.clear());

describe('un stockage vide donne les valeurs par défaut', () => {
  it('sans rien réclamer au joueur', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('un aller-retour conserve les choix', () => {
  it('tous les champs', () => {
    const choisi: Settings = {
      matchSpeed: 'x4',
      autosave: false,
      confirmations: false,
      volume: 30,
      reducedMotion: true,
      textScale: 'GRAND',
      palette: 'DALTONIEN',
      colourMode: 'CLAIR',
    };
    saveSettings(choisi);
    expect(loadSettings()).toEqual(choisi);
  });
});

describe('une préférence abîmée n\'empêche pas de jouer', () => {
  it('un bloc illisible retombe entièrement par défaut', () => {
    localStorage.setItem(CLE, '{ ceci n\'est pas du JSON');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('un champ inconnu retombe seul, les autres survivent', () => {
    // Champ par champ : un réglage de trop ne doit pas emporter les bons.
    localStorage.setItem(CLE, JSON.stringify({
      matchSpeed: 'x1000',
      textScale: 'ENORME',
      palette: 'ARC_EN_CIEL',
      autosave: false,
    }));
    const lu = loadSettings();
    expect(lu.matchSpeed).toBe(DEFAULT_SETTINGS.matchSpeed);
    expect(lu.textScale).toBe(DEFAULT_SETTINGS.textScale);
    expect(lu.palette).toBe(DEFAULT_SETTINGS.palette);
    expect(lu.autosave).toBe(false);
  });

  it('un volume hors bornes est écarté', () => {
    localStorage.setItem(CLE, JSON.stringify({ volume: 5000 }));
    expect(loadSettings().volume).toBe(DEFAULT_SETTINGS.volume);
  });

  it('et un booléen qui n\'en est pas un aussi', () => {
    localStorage.setItem(CLE, JSON.stringify({ autosave: 'oui' }));
    expect(loadSettings().autosave).toBe(DEFAULT_SETTINGS.autosave);
  });
});

describe('le thème et la palette passent par des attributs', () => {
  it('applySettings ne pose jamais de couleur en ligne', () => {
    // V0.62.1 : la feuille de style doit rester seule juge de l'apparence. Un
    // style en ligne posé par le code court-circuiterait le thème, ce qui est
    // exactement le défaut qu'on vient de corriger dans le CSS lui-même.
    const racine = { dataset: {} as Record<string, string>, style: { props: {} as Record<string, string>, setProperty(k: string, v: string) { this.props[k] = v; } } };
    (globalThis as unknown as { document: unknown }).document = { documentElement: racine };
    (globalThis as unknown as { window: unknown }).window = { matchMedia: () => ({ matches: false }) };

    applySettings({ ...DEFAULT_SETTINGS, colourMode: 'CLAIR', palette: 'DALTONIEN', textScale: 'GRAND' });

    expect(racine.dataset.theme).toBe('clair');
    expect(racine.dataset.palette).toBe('daltonien');
    expect(racine.dataset.motion).toBe('complet');
    // Seule exception assumée : l'échelle de texte, qui est un nombre et non
    // une couleur, et que la feuille consomme via une variable.
    expect(Object.keys(racine.style.props)).toEqual(['--text-scale']);
  });

  it('respecte la préférence système d\'emblée', () => {
    const racine = { dataset: {} as Record<string, string>, style: { setProperty() { /* ignoré */ } } };
    (globalThis as unknown as { document: unknown }).document = { documentElement: racine };
    (globalThis as unknown as { window: unknown }).window = { matchMedia: () => ({ matches: true }) };

    applySettings({ ...DEFAULT_SETTINGS, reducedMotion: false });
    expect(racine.dataset.motion).toBe('reduit');
  });
});
