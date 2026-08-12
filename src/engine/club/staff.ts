/**
 * Staff voix — V0.4 Phase 3 (M12 Disco Elysium / Total War: TK).
 *
 * Référence : 04-modele-equipe-club.md (8 staff par club avec personnalités).
 *
 * V0.4 Phase 3 : génération automatique de 8 staff par club avec un biais.
 * Le biais détermine la teneur des conseils dans les live moments :
 *   - Médecin            → toujours pour le repos / sortie d'un joueur fatigué
 *   - Adjoint avants     → pousser, monter en pression, jouer le pack
 *   - Adjoint 3/4        → ouvrir le jeu, mouvement, prise de risque
 *   - Préparateur mental → temporiser, calmer le jeu, gestion mood
 *   - Président          → résultats, image médiatique, recettes
 *   - Coach skills       → confiance dans les individualités
 *   - Scout              → long terme (V0.5+)
 *   - Coach principal    → vision globale, autorité
 */

import { createRng } from '../rng.js';
import type { Club } from '../types.js';
import type { CoachingQuality } from './development.js';

export type StaffRole =
  | 'ENTRAINEUR_CHEF'
  | 'ADJOINT_AVANTS'
  | 'ADJOINT_TROIS_QUARTS'
  | 'MEDECIN'
  | 'PREPARATEUR_MENTAL'
  | 'ENTRAINEUR_SKILLS'
  | 'SCOUT_PRINCIPAL'
  | 'PRESIDENT';

export type StaffBias =
  | 'PRUDENT'         // médecin, préparateur mental
  | 'AGRESSIF'        // adjoint avants, hothead
  | 'OUVERT'          // adjoint 3/4, créatif
  | 'BUSINESS'        // président
  | 'NEUTRE';

export interface StaffMember {
  readonly id: string;
  readonly clubId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: StaffRole;
  readonly bias: StaffBias;
  /** Description courte affichable dans l'UI (ex : "Adjoint avants — pousse pour la mêlée"). */
  readonly tagline: string;
  /**
   * V0.14 — compétence du staff (0-100). Jusqu'ici les 8 membres du staff
   * n'étaient que des voix dans les live moments, sans le moindre effet
   * mécanique. Cette note pilote désormais la progression des joueurs
   * (cf. `club/development.ts`) et rend le recrutement de staff signifiant.
   */
  readonly quality: number;
  /** Salaire annuel, en euros. */
  readonly salary: number;
}

/** Domaine de développement influencé par chaque rôle. */
export type CoachingDomain = 'physique' | 'technique' | 'mental' | 'formation' | 'aucun';

const ROLE_DOMAIN: Record<StaffRole, CoachingDomain> = {
  ENTRAINEUR_CHEF: 'technique',
  ADJOINT_AVANTS: 'physique',
  ADJOINT_TROIS_QUARTS: 'technique',
  MEDECIN: 'physique',
  PREPARATEUR_MENTAL: 'mental',
  ENTRAINEUR_SKILLS: 'technique',
  SCOUT_PRINCIPAL: 'formation',
  PRESIDENT: 'aucun',
};

export function staffDomain(role: StaffRole): CoachingDomain {
  return ROLE_DOMAIN[role];
}

const ROLE_LABEL: Record<StaffRole, string> = {
  ENTRAINEUR_CHEF: 'Entraîneur principal',
  ADJOINT_AVANTS: 'Adjoint avants',
  ADJOINT_TROIS_QUARTS: 'Adjoint 3/4',
  MEDECIN: 'Médecin du club',
  PREPARATEUR_MENTAL: 'Préparateur mental',
  ENTRAINEUR_SKILLS: 'Coach skills',
  SCOUT_PRINCIPAL: 'Scout principal',
  PRESIDENT: 'Président',
};

const ROLE_BIAS: Record<StaffRole, StaffBias> = {
  ENTRAINEUR_CHEF: 'NEUTRE',
  ADJOINT_AVANTS: 'AGRESSIF',
  ADJOINT_TROIS_QUARTS: 'OUVERT',
  MEDECIN: 'PRUDENT',
  PREPARATEUR_MENTAL: 'PRUDENT',
  ENTRAINEUR_SKILLS: 'OUVERT',
  SCOUT_PRINCIPAL: 'NEUTRE',
  PRESIDENT: 'BUSINESS',
};

const ROLE_TAGLINE: Record<StaffRole, string> = {
  ENTRAINEUR_CHEF: 'Garde la vue d\'ensemble.',
  ADJOINT_AVANTS: 'Met l\'accent sur la conquête et le combat.',
  ADJOINT_TROIS_QUARTS: 'Pousse pour le mouvement et la prise de risque.',
  MEDECIN: 'Veille à la santé des joueurs au-dessus de tout.',
  PREPARATEUR_MENTAL: 'S\'occupe du moral et de la gestion du stress.',
  ENTRAINEUR_SKILLS: 'Travaille sur les fondamentaux individuels.',
  SCOUT_PRINCIPAL: 'Vision long-terme, recrutement.',
  PRESIDENT: 'Demande des résultats et veille à l\'image.',
};

// =============================================================================
// Génération
// =============================================================================

const FIRST_NAMES = [
  'Pierre', 'Antoine', 'Yannick', 'Bernard', 'Christophe', 'Patrice', 'Frédéric',
  'Olivier', 'Laurent', 'Stéphane', 'Vincent', 'Pascal', 'Daniel', 'Alain',
  'Jean-Marc', 'Philippe', 'Marc', 'Didier', 'Hervé', 'Gérard',
];
const LAST_NAMES = [
  'Lopez', 'Garbajosa', 'Meilhan', 'Calbet', 'Estebanez', 'Ribes', 'Travers',
  'Vergallo', 'Galthié', 'Ibanez', 'Servat', 'Marconnet', 'Castaignède', 'Califano',
  'Couilloud', 'Bernat-Salles', 'Rougerie', 'Jauzion', 'Magne', 'Pelous',
];

function pickFromArray<T>(arr: readonly T[], idx: number): T {
  return arr[idx % arr.length]!;
}

function generateStaffName(seed: string, idx: number): { firstName: string; lastName: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) | 0;
  const fIdx = Math.abs(h + idx * 13) % FIRST_NAMES.length;
  const lIdx = Math.abs(h * 17 + idx * 31) % LAST_NAMES.length;
  return {
    firstName: pickFromArray(FIRST_NAMES, fIdx),
    lastName: pickFromArray(LAST_NAMES, lIdx),
  };
}

const STAFF_ROLES: readonly StaffRole[] = [
  'ENTRAINEUR_CHEF',
  'ADJOINT_AVANTS',
  'ADJOINT_TROIS_QUARTS',
  'MEDECIN',
  'PREPARATEUR_MENTAL',
  'ENTRAINEUR_SKILLS',
  'SCOUT_PRINCIPAL',
  'PRESIDENT',
];

/**
 * Génère 8 staff pour un club, déterministe via club id.
 *
 * La compétence est corrélée à la réputation du club : un gros budget attire un
 * meilleur encadrement. C'est ce qui rend le recrutement de staff intéressant
 * pour un petit club — c'est un levier moins cher qu'un transfert.
 */
export function generateStaffForClub(club: Club): readonly StaffMember[] {
  const rng = createRng(`staff_${club.id}`);
  const base = 34 + (club.reputation / 100) * 40;         // ~34 à ~74

  return STAFF_ROLES.map((role, idx) => {
    const { firstName, lastName } = generateStaffName(club.id as string, idx);
    const quality = Math.max(20, Math.min(95, Math.round(base + rng.nextInt(-9, 12))));
    return {
      id: `${club.id}_${role}`,
      clubId: club.id as string,
      firstName,
      lastName,
      role,
      bias: ROLE_BIAS[role],
      tagline: ROLE_TAGLINE[role],
      quality,
      salary: staffSalaryFor(quality),
    };
  });
}

/** Salaire attendu d'un membre du staff, fonction de sa compétence. */
export function staffSalaryFor(quality: number): number {
  // 20 → 45 k€, 95 → 320 k€. Courbe légèrement convexe : l'excellence se paie.
  const t = Math.max(0, Math.min(1, (quality - 20) / 75));
  return Math.round((45_000 + t * t * 275_000) / 1000) * 1000;
}

/**
 * Agrège le staff d'un club en qualité d'encadrement par domaine.
 * Un domaine sans staff retombe sur une valeur médiocre : il faut du monde.
 */
export function coachingQualityFromStaff(staff: readonly StaffMember[]): CoachingQuality {
  const sums: Record<CoachingDomain, { total: number; count: number }> = {
    physique: { total: 0, count: 0 },
    technique: { total: 0, count: 0 },
    mental: { total: 0, count: 0 },
    formation: { total: 0, count: 0 },
    aucun: { total: 0, count: 0 },
  };

  for (const member of staff) {
    const domain = ROLE_DOMAIN[member.role];
    if (domain === 'aucun') continue;
    sums[domain].total += member.quality;
    sums[domain].count += 1;
  }

  const mean = (d: CoachingDomain): number =>
    sums[d].count === 0 ? 35 : Math.round(sums[d].total / sums[d].count);

  return {
    physique: mean('physique'),
    technique: mean('technique'),
    mental: mean('mental'),
    formation: mean('formation'),
  };
}

// =============================================================================
// Helpers UI
// =============================================================================

export function staffRoleLabel(role: StaffRole): string {
  return ROLE_LABEL[role];
}

export function staffBiasColor(bias: StaffBias): string {
  switch (bias) {
    case 'AGRESSIF': return '#f85149';
    case 'OUVERT':   return '#3fb950';
    case 'PRUDENT':  return '#58a6ff';
    case 'BUSINESS': return '#d29922';
    case 'NEUTRE':   return '#8b949e';
  }
}
