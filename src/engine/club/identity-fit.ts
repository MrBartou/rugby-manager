/**
 * Identité club ↔ recrutement — V0.8 phase 4.
 *
 * Référence : 04-modele-equipe-club.md (identité tactique) + decisions.md
 * (recruter à contre-culture coûte cohésion).
 *
 * Évalue la compatibilité d'un joueur avec l'identité tactique du club. Un signing
 * BAD-fit applique un malus mood au reste du vestiaire (le vestiaire perçoit la
 * signature comme contraire à l'ADN du club).
 */

import type { Club, Player } from '../types.js';

export type IdentityFit = 'GOOD' | 'NEUTRAL' | 'BAD';

const FORWARD_POSITIONS = new Set([
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
]);

const BACK_POSITIONS = new Set([
  'AILIER_GAUCHE', 'AILIER_DROIT', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'ARRIERE',
]);

export interface FitEvaluation {
  readonly fit: IdentityFit;
  readonly reason: string;
}

export function evaluateIdentityFit(club: Club, player: Player): FitEvaluation {
  const isFwd = FORWARD_POSITIONS.has(player.position);
  const isBack = BACK_POSITIONS.has(player.position);
  const power = player.physical.puissance;
  const speed = player.physical.vitesse;
  const discipline = player.mental.discipline;
  const tackle = player.technical.plaquage;

  switch (club.tacticalIdentity) {
    case 'JEU_AVANTS':
      // ADN : pack lourd, défense basse, jeu fermé. Profil idéal : avant puissant.
      // Bad fit : ailier rapide-fragile, ouvreur joueur de mouvement, joueur de contact faible.
      if (isFwd && power >= 70) return { fit: 'GOOD', reason: 'Avant puissant — colle à l\'ADN.' };
      if (isBack && speed >= 80 && power < 60) {
        return { fit: 'BAD', reason: 'Trois-quart vif mais léger — vestiaire dubitatif.' };
      }
      return { fit: 'NEUTRAL', reason: '' };

    case 'GRAND_ECART':
      // ADN : jeu de mouvement, large, vitesse. Profil idéal : ailier/centre rapide.
      // Bad fit : avant lourd-statique avec faible mobilité.
      if (isBack && speed >= 75) return { fit: 'GOOD', reason: 'Profil rapide — colle au jeu large.' };
      if (isFwd && speed < 45 && power >= 75) {
        return { fit: 'BAD', reason: 'Avant statique — pas dans la philosophie.' };
      }
      return { fit: 'NEUTRAL', reason: '' };

    case 'DEFENSE_DE_FER':
      // ADN : défense montante, plaquages durs, discipline. Profil idéal : plaqueur discipliné.
      // Bad fit : indiscipliné chronique.
      if (tackle >= 75 && discipline >= 70) return { fit: 'GOOD', reason: 'Plaqueur discipliné — colle au système défensif.' };
      if (discipline < 45) return { fit: 'BAD', reason: 'Indiscipline incompatible avec l\'identité défensive.' };
      return { fit: 'NEUTRAL', reason: '' };

    case 'MIXTE':
      return { fit: 'NEUTRAL', reason: '' };
  }
}

/**
 * Applique le malus mood lié à un signing BAD-fit.
 * Tous les joueurs du club perdent N points de mood.
 */
export function applyBadFitMoodPenalty(roster: readonly Player[], penalty = 4): readonly Player[] {
  return roster.map<Player>(p => ({
    ...p,
    dynamic: { ...p.dynamic, mood: Math.max(0, p.dynamic.mood - penalty) },
  }));
}
