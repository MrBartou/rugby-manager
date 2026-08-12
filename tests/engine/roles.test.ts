/**
 * Rôles de joueurs — V0.34.
 *
 * La garantie qui compte : un rôle **redistribue** les qualités d'un joueur, il
 * ne lui en ajoute pas. Un rôle qui améliorerait tout serait le seul qu'on
 * choisirait, et le choix disparaîtrait.
 */

import { describe, expect, it } from 'vitest';
import {
  ROLES,
  applyRole,
  bestRoleFor,
  defaultRoleFor,
  fitLabel,
  roleById,
  roleFitness,
  rolesForPosition,
} from '../../src/engine/match/roles.js';
import { ALL_POSITIONS, type Player, type Position } from '../../src/engine/types.js';
import { makeSquad } from './fixtures.js';
import type { ClubId } from '../../src/engine/types.js';

function playerAt(position: Position, niveau = 70): Player {
  return makeSquad('x' as ClubId, niveau).players.find(p => p.position === position)!;
}

/** Somme de tous les attributs numériques d'un joueur. */
function totalAttributes(p: Player): number {
  const specific = Object.values(p.positionSpecific).reduce<number>((s, v) => s + (v ?? 0), 0);
  return (
    Object.values(p.technical).reduce((s, v) => s + v, 0)
    + Object.values(p.physical).reduce((s, v) => s + v, 0)
    + Object.values(p.mental).reduce((s, v) => s + v, 0)
    + specific
  );
}

describe('catalogue', () => {
  it('couvre les quinze postes', () => {
    for (const position of ALL_POSITIONS) {
      expect(rolesForPosition(position).length).toBeGreaterThan(0);
    }
  });

  it('propose un vrai choix à chaque poste', () => {
    for (const position of ALL_POSITIONS) {
      expect(rolesForPosition(position).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('n\'a pas d\'identifiant en double', () => {
    expect(new Set(ROLES.map(r => r.id)).size).toBe(ROLES.length);
  });

  it('décrit chaque rôle en toutes lettres', () => {
    for (const r of ROLES) {
      expect(r.label.length).toBeGreaterThan(3);
      expect(r.description.length).toBeGreaterThan(20);
    }
  });
});

describe('application d\'un rôle', () => {
  it('ne change rien sans rôle', () => {
    const p = playerAt('OUVREUR');
    expect(applyRole(p, undefined)).toBe(p);
  });

  it('ignore un rôle qui ne correspond pas au poste', () => {
    const ailier = playerAt('AILIER_GAUCHE');
    expect(applyRole(ailier, 'PILIER_ANCRE')).toBe(ailier);
  });

  it('ne modifie jamais le joueur d\'origine', () => {
    const p = playerAt('OUVREUR');
    const avant = JSON.stringify(p);
    applyRole(p, 'OUVREUR_METRONOME');
    expect(JSON.stringify(p)).toBe(avant);
  });

  it('redistribue sans enrichir : le total reste stable', () => {
    for (const role of ROLES) {
      const p = playerAt(role.positions[0]!, 60);
      const after = applyRole(p, role.id);
      // Tolérance d'un point : les bornes 1-99 peuvent rogner un extrême.
      expect(Math.abs(totalAttributes(after) - totalAttributes(p))).toBeLessThanOrEqual(1);
    }
  });

  it('déplace bien les qualités dans le sens annoncé', () => {
    const ouvreur = playerAt('OUVREUR');
    const metronome = applyRole(ouvreur, 'OUVREUR_METRONOME');
    const animateur = applyRole(ouvreur, 'OUVREUR_ANIMATEUR');

    expect(metronome.technical.jeuAuPiedPlace).toBeGreaterThan(ouvreur.technical.jeuAuPiedPlace);
    expect(animateur.technical.jeuAuPiedPlace).toBeLessThan(ouvreur.technical.jeuAuPiedPlace);
    expect(animateur.technical.visionDeJeu).toBeGreaterThan(ouvreur.technical.visionDeJeu);
  });

  it('ne crée pas d\'attribut spécifique absent', () => {
    const ailier = playerAt('AILIER_GAUCHE');
    const sansFinition: Player = { ...ailier, positionSpecific: {} };
    const after = applyRole(sansFinition, 'AILIER_FINISSEUR');
    // Donner une « finition » à qui n'en a pas n'aurait aucun sens : le moteur
    // retombe déjà sur un attribut générique quand le spécifique manque.
    expect(after.positionSpecific.finition).toBeUndefined();
  });

  it('reste dans les bornes de l\'échelle', () => {
    const extreme: Player = {
      ...playerAt('PILIER_GAUCHE'),
      physical: { vitesse: 2, puissance: 98, endurance: 99, detente: 50, robustesse: 50 },
    };
    const after = applyRole(extreme, 'PILIER_ANCRE');
    for (const v of Object.values(after.physical)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(99);
    }
  });
});

describe('choix automatique', () => {
  it('propose un rôle par défaut à chaque poste', () => {
    for (const position of ALL_POSITIONS) {
      expect(defaultRoleFor(position)).toBeDefined();
    }
  });

  it('retient un rôle valide pour le poste', () => {
    for (const position of ALL_POSITIONS) {
      const chosen = bestRoleFor(playerAt(position))!;
      expect(roleById(chosen)!.positions).toContain(position);
    }
  });

  it('aligne un joueur dans ce qu\'il sait faire', () => {
    const base = playerAt('OUVREUR');
    const buteur: Player = {
      ...base,
      technical: { ...base.technical, jeuAuPiedPlace: 95, visionDeJeu: 40, passe: 40 },
    };
    const meneur: Player = {
      ...base,
      technical: { ...base.technical, jeuAuPiedPlace: 40, visionDeJeu: 95, passe: 90 },
    };

    expect(bestRoleFor(buteur)).toBe('OUVREUR_METRONOME');
    expect(bestRoleFor(meneur)).toBe('OUVREUR_ANIMATEUR');
  });
});

describe('affinité avec les rôles', () => {
  it('classe tous les rôles du poste, du plus naturel au moins', () => {
    for (const position of ALL_POSITIONS) {
      const fits = roleFitness(playerAt(position));
      expect(fits.length).toBe(rolesForPosition(position).length);
      for (let i = 1; i < fits.length; i++) {
        expect(fits[i - 1]!.score).toBeGreaterThanOrEqual(fits[i]!.score);
      }
    }
  });

  it('donne le meilleur rôle en tête, cohérent avec le choix automatique', () => {
    for (const position of ALL_POSITIONS) {
      const p = playerAt(position);
      expect(roleFitness(p)[0]!.role.id).toBe(bestRoleFor(p));
    }
  });

  it('récompense un joueur taillé pour le rôle et sanctionne l\'inverse', () => {
    const base = playerAt('AILIER_GAUCHE');
    const finisseur: Player = {
      ...base,
      positionSpecific: { ...base.positionSpecific, finition: 95, jeuAerien: 30 },
      technical: { ...base.technical, prisedeballeHaute: 30 },
    };
    const fits = roleFitness(finisseur);
    const finition = fits.find(f => f.role.id === 'AILIER_FINISSEUR')!;
    const contre = fits.find(f => f.role.id === 'AILIER_CONTRE_ATTAQUANT')!;
    expect(finition.score).toBeGreaterThan(contre.score);
  });

  it('compare des rôles qui ne touchent pas le même nombre d\'attributs', () => {
    // Un joueur uniformément moyen doit obtenir des scores voisins de zéro
    // partout : sans moyennes, le rôle le plus « large » l'emporterait toujours.
    const uniforme = playerAt('NUMERO_8', 60);
    for (const { score } of roleFitness(uniforme)) {
      expect(Math.abs(score)).toBeLessThan(12);
    }
  });

  it('traduit le score en appréciation lisible', () => {
    expect(fitLabel(15).tone).toBe('natural');
    expect(fitLabel(5).tone).toBe('good');
    expect(fitLabel(0).tone).toBe('ok');
    expect(fitLabel(-10).tone).toBe('poor');
    for (const s of [20, 5, 0, -10]) expect(fitLabel(s).label.length).toBeGreaterThan(5);
  });
});
