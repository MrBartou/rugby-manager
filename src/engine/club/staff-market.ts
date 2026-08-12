/**
 * Marché du staff — V0.44.
 *
 * `generateStaffForClub()` fabrique l'encadrement à partir de la seule
 * réputation du club, de façon déterministe. Appelée à chaque besoin, elle
 * renvoie toujours les mêmes huit personnes avec les mêmes notes : la qualité
 * d'encadrement d'un club était donc **figée à vie**.
 *
 * Ce n'est pas un détail d'affichage. Cette note pilote la progression des
 * joueurs, le nombre de créneaux d'observation du scout et la qualité de la
 * formation. Autrement dit : le levier le plus profond du jeu sur le long terme
 * était le seul sur lequel le manager n'avait aucune prise.
 *
 * ## Ce qui s'arbitre
 *
 * Un bon adjoint coûte moins cher qu'un bon joueur et rapporte plus longtemps —
 * mais il se paie sur la même trésorerie, et il ne se voit pas le dimanche. Le
 * choix est là : améliorer l'équipe maintenant, ou améliorer ce qui la fait
 * progresser.
 *
 * ## Qui accepte de venir
 *
 * Un technicien reconnu ne rejoint pas n'importe qui. Sa décision se joue sur
 * la stature du club et la réputation du manager — le même couple qui gouverne
 * déjà les offres d'emploi et la négociation de contrat. Sans ce filtre, il
 * suffirait d'avoir de l'argent pour rafler les meilleurs, et un promu de Pro
 * D2 s'offrirait le staff de Toulouse.
 */

import { createRng, type Rng } from '../rng.js';
import type { Club } from '../types.js';
import { clubStature } from '../season/manager-career.js';
import type { ManagerReputation } from '../season/manager-reputation.js';
import {
  staffSalaryFor,
  type StaffMember,
  type StaffRole,
} from './staff.js';

// =============================================================================
// Les postes qui se recrutent
// =============================================================================

/**
 * Le président ne se recrute pas, et l'entraîneur principal, c'est vous.
 *
 * Les inclure laisserait croire qu'on peut se remplacer soi-même ou choisir son
 * employeur depuis l'organigramme.
 */
export const HIRABLE_ROLES: readonly StaffRole[] = [
  'ADJOINT_AVANTS',
  'ADJOINT_TROIS_QUARTS',
  'ENTRAINEUR_SKILLS',
  'MEDECIN',
  'PREPARATEUR_MENTAL',
  'SCOUT_PRINCIPAL',
];

export function isHirable(role: StaffRole): boolean {
  return HIRABLE_ROLES.includes(role);
}

/** Ce que chaque poste améliore concrètement, dit au manager sans détour. */
export const ROLE_EFFECT: Readonly<Record<StaffRole, string>> = {
  ENTRAINEUR_CHEF: 'C\'est vous.',
  ADJOINT_AVANTS: 'Progression physique des joueurs.',
  ADJOINT_TROIS_QUARTS: 'Progression technique des trois-quarts.',
  ENTRAINEUR_SKILLS: 'Progression technique de tout l\'effectif.',
  MEDECIN: 'Récupération et progression physique.',
  PREPARATEUR_MENTAL: 'Progression mentale et sang-froid.',
  SCOUT_PRINCIPAL: 'Créneaux d\'observation et précision des rapports.',
  PRESIDENT: 'Ne se recrute pas.',
};

// =============================================================================
// Candidats
// =============================================================================

export interface StaffCandidate extends StaffMember {
  /** Ce qu'il faudra lui verser chaque année. */
  readonly askingSalary: number;
  /**
   * Ce qu'il attend du club pour dire oui, sur l'échelle de stature 0-100.
   * Rendu visible : un candidat hors de portée ne doit pas se découvrir au clic.
   */
  readonly expectation: number;
}

const FIRST_NAMES = [
  'Bernard', 'Christophe', 'Didier', 'Fabien', 'Gérald', 'Hervé', 'Jean-Marc',
  'Laurent', 'Michel', 'Olivier', 'Patrice', 'Raphaël', 'Serge', 'Thierry',
  'Vincent', 'Yannick', 'Alain', 'Bruno', 'Cédric', 'Frédéric',
];

const LAST_NAMES = [
  'Alvarez', 'Barthez', 'Cazenave', 'Duvivier', 'Estève', 'Fourcade', 'Gaillard',
  'Hourcade', 'Irastorza', 'Jauzion', 'Larrieu', 'Mermoz', 'Nallet', 'Ondarts',
  'Pelous', 'Quesada', 'Rougerie', 'Sarraméa', 'Tordo', 'Vermeulen',
];

const ROLE_BIAS: Readonly<Record<StaffRole, StaffMember['bias']>> = {
  ENTRAINEUR_CHEF: 'NEUTRE',
  ADJOINT_AVANTS: 'AGRESSIF',
  ADJOINT_TROIS_QUARTS: 'OUVERT',
  ENTRAINEUR_SKILLS: 'OUVERT',
  MEDECIN: 'PRUDENT',
  PREPARATEUR_MENTAL: 'PRUDENT',
  SCOUT_PRINCIPAL: 'NEUTRE',
  PRESIDENT: 'BUSINESS',
};

const TAGLINES: readonly string[] = [
  'Sort d\'un club où il a tout structuré',
  'Réputation d\'exigence, parfois cassante',
  'Formé à l\'école néo-zélandaise',
  'Discret, méthodique, très suivi par ses joueurs',
  'Ancien international reconverti',
  'Passé par un centre de formation reconnu',
  'Cherche un projet plutôt qu\'un salaire',
  'Revient après une année sabbatique',
];

/**
 * Le vivier disponible à un instant donné.
 *
 * Renouvelé à chaque intersaison : un marché figé ferait du recrutement de
 * staff une décision unique en début de carrière, prise une fois pour toutes.
 */
export function generateStaffMarket(input: {
  readonly season: number;
  readonly seed: string;
  readonly count?: number;
}): readonly StaffCandidate[] {
  const rng = createRng(`staff_market_${input.seed}_${input.season}`);
  const count = input.count ?? 12;
  const out: StaffCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const role = rng.pick(HIRABLE_ROLES);
    // Distribution volontairement étalée : sans médiocres, le marché n'offrirait
    // aucun choix, seulement une échelle de prix.
    const quality = Math.max(25, Math.min(93, Math.round(rng.nextGaussian(58, 15))));
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const salary = staffSalaryFor(quality);

    out.push({
      id: `cand_${input.season}_${i}`,
      clubId: 'libre',
      firstName,
      lastName,
      role,
      bias: ROLE_BIAS[role],
      tagline: rng.pick(TAGLINES),
      quality,
      salary,
      askingSalary: salary,
      expectation: expectationFor(quality, rng),
    });
  }

  return out.sort((a, b) => b.quality - a.quality);
}

/**
 * Stature de club qu'un technicien de ce niveau estime mériter.
 *
 * L'aléa est là pour qu'un très bon élément soit parfois accessible à un petit
 * club — c'est la bonne affaire qui rend le marché intéressant à parcourir.
 */
function expectationFor(quality: number, rng: Rng): number {
  return Math.max(0, Math.round((quality - 30) * 0.95 + rng.nextInt(-12, 6)));
}

// =============================================================================
// La décision du candidat
// =============================================================================

export type StaffRefusal = 'CLUB_TROP_PETIT' | 'SALAIRE_INSUFFISANT';

export interface HireVerdict {
  readonly accepted: boolean;
  readonly reason?: StaffRefusal;
  readonly message: string;
}

/**
 * Un manager reconnu compense la modestie de son club.
 *
 * C'est ce qui permet de bâtir : une gloire qui descend en Pro D2 peut y
 * attirer un encadrement que le club seul n'obtiendrait jamais.
 */
export function attractiveness(club: Club, reputation: ManagerReputation): number {
  return clubStature(club) + Math.round(reputation.score * 0.30) + reputation.titlesWon * 4;
}

export function evaluateHire(
  candidate: StaffCandidate,
  club: Club,
  reputation: ManagerReputation,
  offeredSalary: number,
): HireVerdict {
  if (offeredSalary < candidate.askingSalary) {
    return {
      accepted: false,
      reason: 'SALAIRE_INSUFFISANT',
      message: `${candidate.lastName} attend ${Math.round(candidate.askingSalary / 1000)} k€ par an.`,
    };
  }

  const pull = attractiveness(club, reputation);
  if (pull < candidate.expectation) {
    return {
      accepted: false,
      reason: 'CLUB_TROP_PETIT',
      message: `${candidate.lastName} vise plus haut que ${club.name} pour l'instant.`,
    };
  }

  return {
    accepted: true,
    message: `${candidate.firstName} ${candidate.lastName} rejoint le staff.`,
  };
}

// =============================================================================
// Composition du staff
// =============================================================================

/**
 * Remplace le titulaire d'un poste.
 *
 * Un club n'a qu'un adjoint avants : embaucher, c'est nécessairement congédier
 * celui qui était là. Le rendre explicite évite un organigramme à deux
 * médecins dont on ne saurait plus lequel compte.
 */
export function hireInto(
  staff: readonly StaffMember[],
  candidate: StaffCandidate,
  clubId: string,
): readonly StaffMember[] {
  const hired: StaffMember = {
    id: `${clubId}_${candidate.role}_${candidate.id}`,
    clubId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    role: candidate.role,
    bias: candidate.bias,
    tagline: candidate.tagline,
    quality: candidate.quality,
    salary: candidate.askingSalary,
  };
  return [...staff.filter(m => m.role !== candidate.role), hired];
}

/** Masse salariale annuelle de l'encadrement. */
export function staffPayroll(staff: readonly StaffMember[]): number {
  return staff.reduce((sum, m) => sum + m.salary, 0);
}

/**
 * Indemnité de rupture.
 *
 * Sans coût, on renverrait tout l'encadrement chaque été pour repartir du
 * marché : la continuité n'aurait aucune valeur.
 */
export function severanceFor(member: StaffMember): number {
  return Math.round(member.salary * 0.5);
}
