/**
 * Le thème clair reste lisible : V0.62.1.
 *
 * Trois teintes du thème clair ont été livrées sous le seuil AA parce que
 * personne ne les avait mesurées : elles avaient été posées à l'œil, en
 * supposant qu'un thème clair est un thème sombre inversé. Le vert des
 * indicateurs tombait à 2,66 dans son emploi réel, le jaune à 2,89, et la
 * couleur des libellés secondaires à 4,05 sur les fonds enfoncés.
 *
 * Ce test relit les valeurs dans la feuille de style et refait le calcul du
 * WCAG. Il ne juge pas du goût : il empêche seulement qu'une teinte retouchée
 * repasse sous la barre sans que personne ne s'en aperçoive, ce qui est
 * exactement ce qui s'est produit.
 *
 * ## Le pire cas, pas le cas commode
 *
 * Un indicateur ne s'affiche presque jamais sur le fond blanc. Il s'affiche en
 * pastille, c'est-à-dire en texte plein sur une teinte à 12 % de lui-même,
 * elle-même posée sur un fond de panneau. La teinte tire alors le fond vers le
 * texte et mange du contraste. C'est cette combinaison qui est vérifiée.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/*
 * La feuille de style est relue sur le disque, et non importée.
 *
 * Vitest neutralise le CSS par défaut : un `import ... ?raw` renvoie une chaîne
 * vide, et le test passait alors sans rien vérifier, ce qui est pire que de
 * l'absence de test. L'URL est résolue depuis ce module plutôt que depuis le
 * répertoire courant, pour que le résultat ne dépende pas d'où on le lance.
 */
const CSS = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');

/** Seuil AA pour du texte courant. Les grands titres relèvent de 3,0. */
const AA = 4.5;

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ] as const;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Compose une couleur translucide sur son fond, comme le ferait le rendu. */
function over(front: Rgb, alpha: number, back: Rgb): Rgb {
  return [
    front[0] * alpha + back[0] * (1 - alpha),
    front[1] * alpha + back[1] * (1 - alpha),
    front[2] * alpha + back[2] * (1 - alpha),
  ] as const;
}

/**
 * Lit une variable dans un bloc de la feuille de style.
 *
 * On relit le fichier plutôt que de recopier les valeurs dans le test : une
 * copie se désynchronise, et un test qui vérifie sa propre copie ne vérifie
 * rien. C'est la variante du défaut maison, deux sources de vérité.
 */
function readBlock(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`bloc introuvable : ${selector}`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const body = CSS.slice(open + 1, close);
  const vars = new Map<string, string>();
  for (const line of body.split('\n')) {
    const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (m?.[1] && m[2]) vars.set(m[1], m[2].trim());
  }
  return vars;
}

const clair = readBlock(":root[data-theme='clair']");

function hexVar(name: string): Rgb {
  const value = clair.get(name);
  if (!value || !value.startsWith('#')) {
    throw new Error(`${name} attendu en hexadécimal, lu : ${String(value)}`);
  }
  return parseHex(value);
}

describe('thème clair : les teintes restent au-dessus du seuil AA', () => {
  const fonds: readonly { readonly nom: string; readonly variable: string }[] = [
    { nom: 'page', variable: '--bg-0' },
    { nom: 'panneau', variable: '--bg-1' },
    { nom: 'section', variable: '--bg-2' },
    { nom: 'creux', variable: '--bg-3' },
  ];

  const signaux = ['--green', '--red', '--yellow', '--blue', '--accent'] as const;

  it.each(signaux)('%s se lit en texte plein sur les quatre fonds', variable => {
    const teinte = hexVar(variable);
    for (const fond of fonds) {
      expect(
        contrast(teinte, hexVar(fond.variable)),
        `${variable} sur le fond ${fond.nom}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  // Le cas qui avait été manqué : la pastille, où la teinte douce rapproche le
  // fond du texte au lieu de l'en éloigner.
  it.each(signaux)('%s se lit dans sa pastille, teinte douce comprise', variable => {
    const teinte = hexVar(variable);
    for (const fond of fonds) {
      const pastille = over(teinte, 0.12, hexVar(fond.variable));
      expect(
        contrast(teinte, pastille),
        `${variable} en pastille sur le fond ${fond.nom}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it('les libellés secondaires tiennent jusque sur les fonds enfoncés', () => {
    // C'est `--bg-3` qui les a fait tomber : la première correction n'avait été
    // mesurée que contre le fond global, où la marge était confortable.
    for (const fond of fonds) {
      expect(
        contrast(hexVar('--text-muted'), hexVar(fond.variable)),
        `--text-muted sur le fond ${fond.nom}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it('le texte porté par un fond d\'accent reste lisible', () => {
    expect(
      contrast(hexVar('--text-on-accent'), hexVar('--accent')),
    ).toBeGreaterThanOrEqual(AA);
  });

  /**
   * La palette daltonienne ne dispense pas du contraste.
   *
   * Elle répond à une autre question, distinguer deux signaux l'un de l'autre,
   * et il serait absurde qu'un joueur qui l'active y perde la lisibilité qu'on
   * vient de rendre aux autres.
   */
  describe('palette daltonienne', () => {
    const daltonien = readBlock(":root[data-theme='clair'][data-palette='daltonien']");

    it.each(['--green', '--red', '--yellow'])('%s tient les mêmes seuils', variable => {
      const brut = daltonien.get(variable);
      expect(brut, `${variable} attendu dans la palette daltonienne`).toBeDefined();
      const teinte = parseHex(brut as string);
      for (const fond of fonds) {
        const bg = hexVar(fond.variable);
        expect(contrast(teinte, bg), `${variable} sur ${fond.nom}`).toBeGreaterThanOrEqual(AA);
        expect(
          contrast(teinte, over(teinte, 0.12, bg)),
          `${variable} en pastille sur ${fond.nom}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    });
  });
});
