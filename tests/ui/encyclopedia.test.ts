/**
 * L'encyclopédie : V0.62.
 *
 * Le troisième pilier du projet vise le fan de rugby qui n'a jamais touché à un
 * jeu de management. Or le jeu lui lance « JIFF », « salary cap », « bonus
 * offensif » et « fenêtre de mercato » sans jamais définir aucun de ces mots,
 * qui décident pourtant de sa saison.
 *
 * Ce qui est vérifié ici : chaque entrée dit ce que le mot veut dire **et** ce
 * qu'il implique, la recherche ne noie pas le lecteur, et chaque écran a une
 * porte d'entrée qui existe.
 */

import { describe, expect, it } from 'vitest';
import {
  GLOSSARY,
  GLOSSARY_TOPIC_LABEL,
  SCREEN_ENTRY_POINT,
  searchGlossary,
} from '@/ui/encyclopedia.js';

describe('chaque entrée tient sa promesse', () => {
  it('définit le terme et dit ce qu\'il change', () => {
    // Une définition de dictionnaire ne sert à rien : savoir ce qu'est un JIFF
    // ne dit pas ce qui arrive quand on n'en aligne pas assez.
    for (const entry of GLOSSARY) {
      expect(entry.definition.length, entry.term).toBeGreaterThan(30);
      expect(entry.whatItMeans.length, entry.term).toBeGreaterThan(40);
    }
  });

  it('a des identifiants uniques', () => {
    const ids = GLOSSARY.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('range chaque terme dans un thème connu', () => {
    for (const entry of GLOSSARY) {
      expect(GLOSSARY_TOPIC_LABEL[entry.topic], entry.term).toBeDefined();
    }
  });

  it('et donne au moins un mot-clé de recherche', () => {
    for (const entry of GLOSSARY) {
      expect(entry.keywords.length, entry.term).toBeGreaterThan(0);
      expect(entry.keywords.every(k => k === k.toLowerCase()), entry.term).toBe(true);
    }
  });
});

describe('la recherche', () => {
  it('trouve un terme par son nom', () => {
    expect(searchGlossary('jiff').map(e => e.id)).toContain('jiff');
  });

  it('le trouve aussi par un mot-clé', () => {
    expect(searchGlossary('plafond').map(e => e.id)).toContain('salary-cap');
    expect(searchGlossary('descente').map(e => e.id)).toContain('barrage-accession');
  });

  it('ne cherche pas dans les définitions', () => {
    // Un mot fréquent comme « joueur » remonterait toute l'encyclopédie, ce qui
    // revient à ne rien chercher du tout.
    expect(searchGlossary('joueur').length).toBeLessThan(GLOSSARY.length);
  });

  it('rend tout quand on ne cherche rien', () => {
    expect(searchGlossary('')).toHaveLength(GLOSSARY.length);
    expect(searchGlossary('   ')).toHaveLength(GLOSSARY.length);
  });

  it('et rend une liste vide plutôt qu\'un hasard', () => {
    expect(searchGlossary('zzzzz')).toEqual([]);
  });
});

describe('les portes d\'entrée contextuelles', () => {
  it('chaque écran pointe vers une entrée qui existe', () => {
    // Une porte d'entrée vers un identifiant disparu ouvrirait l'encyclopédie
    // sur du vide, ce que personne ne remarquerait avant un joueur.
    const ids = new Set(GLOSSARY.map(e => e.id));
    for (const [ecran, entryId] of Object.entries(SCREEN_ENTRY_POINT)) {
      expect(ids.has(entryId), `${ecran} → ${entryId}`).toBe(true);
    }
  });

  it('couvre les écrans où la question se pose', () => {
    for (const ecran of ['transfers', 'finances', 'standings', 'squad']) {
      expect(SCREEN_ENTRY_POINT[ecran], ecran).toBeDefined();
    }
  });
});
