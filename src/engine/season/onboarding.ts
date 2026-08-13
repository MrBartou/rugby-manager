/**
 * L'introduction — V0.49, refonte.
 *
 * Le tutoriel d'origine datait de la V0.12. Il annonçait « on fait le tour des
 * écrans en 30 secondes » et présentait quatre onglets, à un moment où le jeu
 * en comptait quatre. Il en compte neuf, et porte une quinzaine de systèmes :
 * plafond salarial, quota JIFF, feuille de route du président, semaine
 * d'entraînement, causerie, conversations, promesses, demandes de départ,
 * direction du club, courrier à réponses, centre de formation, rivalités.
 *
 * Deux façons de rattraper ce retard :
 *
 *  - allonger la visite guidée — quinze cartes d'affilée avant d'avoir joué le
 *    moindre match. Personne ne les lit, et personne ne s'en souvient ;
 *  - **n'expliquer une chose qu'au moment où elle arrive**.
 *
 * C'est la seconde qui est retenue. À l'arrivée, on dit le strict nécessaire :
 * qui vous êtes, ce qu'on attend de vous, où regarder, comment lancer la
 * semaine. Le reste attend son heure : le plafond salarial s'explique le jour
 * où il est tendu, la promesse le jour où l'on en fait une, la demande de
 * départ le jour où elle tombe.
 *
 * ## Ce que ce module est
 *
 * Une **règle d'éligibilité**, pas un composant. Il reçoit l'état du jeu et ce
 * qui a déjà été vu, et renvoie la leçon à afficher — ou rien. Le rendu, le
 * spotlight et le stockage sont l'affaire de l'interface.
 *
 * Le mettre ici plutôt que dans le composant a une raison précise : le projet
 * n'a pas d'infrastructure de test de composants. Une règle qui vit dans le
 * moteur se teste ; la même règle noyée dans un `useEffect` ne se teste pas.
 */

// =============================================================================
// Modèle
// =============================================================================

export type LessonId =
  | 'bienvenue'
  | 'mission'
  | 'agenda'
  | 'semaine'
  | 'plafond'
  | 'reponse'
  | 'promesse'
  | 'depart'
  | 'mercato'
  | 'entrainement'
  | 'conversation'
  | 'direction'
  | 'exigences'
  | 'carriere';

export interface Lesson {
  readonly id: LessonId;
  readonly title: string;
  readonly body: string;
  /** Élément à mettre en lumière, s'il y en a un. */
  readonly target?: string;
  readonly placement?: 'right' | 'bottom' | 'top';
}

/** Onglet affiché au moment où l'on regarde. */
export type OnboardingScreen =
  | 'dashboard' | 'squad' | 'training' | 'standings'
  | 'transfers' | 'news' | 'career' | 'finances' | 'direction'
  | 'player' | 'autre';

export interface OnboardingContext {
  readonly screen: OnboardingScreen;
  readonly currentRound: number;
  /** Matchs déjà joués dans la carrière, toutes saisons confondues. */
  readonly seasonsPlayed: number;

  readonly capUsage: number;
  readonly transferWindowOpen: boolean;
  readonly pendingAnswers: number;
  readonly agendaCount: number;
  readonly openPromises: number;
  readonly transferRequests: number;
  readonly expectations: number;

  /** Leçons déjà vues, pour ne jamais répéter. */
  readonly seen: readonly LessonId[];
}

// =============================================================================
// Le contenu
// =============================================================================

/**
 * Texte des leçons.
 *
 * Au vouvoiement, comme tout le reste du jeu — le tutoriel d'origine tutoyait,
 * ce qui en faisait le seul endroit où le jeu changeait de voix.
 */
const LESSONS: Readonly<Record<LessonId, Lesson>> = {
  bienvenue: {
    id: 'bienvenue',
    title: 'Vous voilà en poste',
    body: 'Un club vous a confié son sportif. Ce que vous en ferez tient à trois choses : l\'équipe que vous alignez, les hommes que vous dirigez, et les comptes que vous laissez.',
  },
  mission: {
    id: 'mission',
    title: 'Ce qu\'on attend de vous',
    body: 'Le président a fixé une mission pour l\'exercice. Elle se juge sur la saison régulière — pas sur les intentions, pas sur les phases finales.',
  },
  agenda: {
    id: 'agenda',
    title: 'Votre semaine, en un coup d\'œil',
    body: 'Ce bloc remonte ce qui réclame une décision : une règle enfreinte, une promesse à tenir, un courrier sans réponse. Chaque ligne mène à l\'onglet concerné. Quand il se tait, c\'est que rien ne brûle.',
    target: '.agenda',
    placement: 'bottom',
  },
  semaine: {
    id: 'semaine',
    title: 'Préparer la semaine',
    body: 'Composition, charge d\'entraînement, plan de jeu, puis la causerie d\'avant-match. Vous pouvez aussi simuler directement — mais c\'est là que se gagne un match serré.',
    target: '[data-coachmark="play-match"]',
    placement: 'top',
  },
  plafond: {
    id: 'plafond',
    title: 'Le plafond salarial',
    body: 'Votre masse salariale pèse lourd face au plafond de la Ligue. Le dépasser n\'empêche pas de signer : la commission passe à l\'intersaison, et sanctionne par une amende, puis par un retrait de points en cas de récidive.',
    target: '[data-coachmark="nav-transfers"]',
    placement: 'bottom',
  },
  reponse: {
    id: 'reponse',
    title: 'Un courrier attend votre réponse',
    body: 'Certains messages proposent des options. Ce que vous répondez engage — réputation, confiance du bureau, parfois la trésorerie. Chaque option annonce ce qu\'elle coûte, et on ne répond qu\'une fois.',
    target: '[data-coachmark="nav-career"]',
    placement: 'bottom',
  },
  promesse: {
    id: 'promesse',
    title: 'Vous avez engagé votre parole',
    body: 'Une promesse de temps de jeu court sur six journées. Tenue, elle vaut plus qu\'un compliment. Trahie, elle coûte plus du double — et le joueur peut demander à partir.',
    target: '.agenda',
    placement: 'bottom',
  },
  depart: {
    id: 'depart',
    title: 'Un joueur veut partir',
    body: 'Son agent vous écrit. Le mettre sur la liste l\'apaise et ouvre la porte aux clubs intéressés ; le retenir garde l\'effectif intact, mais laisse un homme aigri dans un vestiaire qui a tout suivi.',
    target: '[data-coachmark="nav-career"]',
    placement: 'bottom',
  },
  mercato: {
    id: 'mercato',
    title: 'La fenêtre est ouverte',
    body: 'Agents libres, joueurs sous contrat à négocier, offres reçues sur vos cadres. Le plafond salarial et le quota JIFF s\'affichent en permanence : c\'est devant une offre qu\'ils doivent peser.',
    target: '[data-coachmark="nav-transfers"]',
    placement: 'bottom',
  },
  entrainement: {
    id: 'entrainement',
    title: 'La semaine d\'entraînement',
    body: 'Une semaine dure fait progresser plus vite et blesse davantage. Une semaine légère préserve. Le choix se paie dans les deux sens : il n\'y a pas de réglage gagnant.',
  },
  conversation: {
    id: 'conversation',
    title: 'Lui parler',
    body: 'Vous pouvez féliciter, recadrer, rassurer, exiger — ou promettre du temps de jeu. La réaction dépend de la situation du joueur et de son tempérament : un rancunier n\'encaisse pas un recadrage comme un professionnel.',
  },
  direction: {
    id: 'direction',
    title: 'La direction du club',
    body: 'Stade, centre d\'entraînement, centre médical, boutique : les chantiers se lancent un à un et se livrent une ou deux saisons plus tard. Le tarif des places et le plan marketing, eux, agissent dès la journée suivante.',
  },
  exigences: {
    id: 'exigences',
    title: 'Le président ne juge pas que le classement',
    body: 'Il a ajouté à votre mission ce qui manque à ce club-là : tenir la masse salariale, reconstituer la marge JIFF, faire jouer les jeunes, équilibrer les comptes. Deux exigences au maximum, jugées en fin de saison.',
    target: '[data-coachmark="nav-career"]',
    placement: 'bottom',
  },
  carriere: {
    id: 'carriere',
    title: 'Votre carrière vous suit',
    body: 'Courrier, parcours, palmarès : tout ce qu\'on vous écrit et tout ce que vous accomplissez reste consigné, d\'un club à l\'autre et d\'une saison à l\'autre.',
    target: '[data-coachmark="nav-career"]',
    placement: 'bottom',
  },
};

// =============================================================================
// Les conditions
// =============================================================================

/**
 * Conditions d'apparition, dans l'ordre de priorité.
 *
 * L'ordre est le contenu de ce module : ce qui bloque une décision passe avant
 * ce qui l'éclaire, et ce qui éclaire passe avant ce qui informe. Deux leçons
 * ne s'affichent jamais ensemble — on en montre une, et la suivante attend le
 * tour d'après.
 */
const RULES: readonly {
  readonly id: LessonId;
  readonly when: (ctx: OnboardingContext) => boolean;
}[] = [
  // ---- L'arrivée -----------------------------------------------------------
  // Quatre cartes, pas quinze, et seulement pour une première saison.
  { id: 'bienvenue', when: c => c.screen === 'dashboard' && isFirstWeek(c) },
  { id: 'mission', when: c => c.screen === 'dashboard' && isFirstWeek(c) },
  {
    id: 'semaine',
    when: c => c.screen === 'dashboard' && isFirstWeek(c),
  },

  // ---- Ce qui bloque une décision -----------------------------------------
  { id: 'depart', when: c => c.transferRequests > 0 },
  {
    id: 'reponse',
    when: c => c.pendingAnswers > 0,
  },
  {
    id: 'plafond',
    when: c => c.capUsage >= 95 && (c.screen === 'dashboard' || c.screen === 'transfers'),
  },

  // ---- Ce qui éclaire une décision en cours --------------------------------
  { id: 'promesse', when: c => c.openPromises > 0 && c.screen === 'dashboard' },
  // Le panneau s'explique le jour où il a quelque chose à dire — souvent dès
  // l'arrivée, où il ferme alors la marche, parfois bien plus tard.
  {
    id: 'agenda',
    when: c => c.screen === 'dashboard' && c.agendaCount > 0,
  },
  {
    id: 'mercato',
    when: c => c.transferWindowOpen && c.screen === 'transfers',
  },
  { id: 'conversation', when: c => c.screen === 'player' },
  { id: 'entrainement', when: c => c.screen === 'training' },
  { id: 'direction', when: c => c.screen === 'direction' },

  // ---- Ce qui informe ------------------------------------------------------
  {
    id: 'exigences',
    when: c => c.expectations > 0 && c.screen === 'career',
  },
  { id: 'carriere', when: c => c.screen === 'career' },
];

/**
 * Première semaine d'une première carrière.
 *
 * `seasonsPlayed` plutôt que la seule journée : la journée 1 revient au début
 * de **chaque** saison, et le tutoriel se rejouait donc tous les ans.
 */
function isFirstWeek(ctx: OnboardingContext): boolean {
  return ctx.currentRound <= 1 && ctx.seasonsPlayed === 0;
}

// =============================================================================
// La règle
// =============================================================================

/**
 * Prochaine leçon à afficher, s'il y en a une.
 *
 * Renvoie `undefined` la plupart du temps, et c'est voulu : un tutoriel qui a
 * quelque chose à dire à chaque écran redevient la visite guidée qu'on voulait
 * éviter.
 */
export function nextLesson(ctx: OnboardingContext): Lesson | undefined {
  const seen = new Set(ctx.seen);
  for (const rule of RULES) {
    if (seen.has(rule.id)) continue;
    if (rule.when(ctx)) return LESSONS[rule.id];
  }
  return undefined;
}

/** Nombre total de leçons, pour situer la progression. */
export const LESSON_COUNT = RULES.length;

/** Toutes les leçons, dans l'ordre où elles peuvent apparaître. */
export const LESSON_ORDER: readonly LessonId[] = RULES.map(r => r.id);
