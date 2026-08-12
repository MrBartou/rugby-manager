/**
 * Messagerie du manager — V0.42.
 *
 * Le jeu s'adressait au manager par deux canaux seulement : des modales, qui
 * disparaissent dès qu'on clique, et un libellé de confiance sur le tableau de
 * bord, qui n'est qu'un état. Rien ne **s'adressait** à lui dans la durée.
 *
 * Conséquence : le board fixait un objectif sans jamais l'annoncer, remerciait
 * sans lettre, un jeune sortait du centre sans que personne ne le signale, et
 * un limogeage se lisait dans le fil d'actualité du championnat au milieu des
 * transferts des autres clubs.
 *
 * ## Une boîte, pas un journal
 *
 * [news.ts](./news.ts) raconte le **championnat** : ce qui s'y passe concerne
 * tout le monde et n'attend rien de personne. La messagerie est l'inverse — on
 * y écrit **au manager**, avec un expéditeur qui a une intention. Les deux
 * cohabitent sans se recouper : un transfert conclu par un rival est une
 * actualité ; le même joueur passé sous son nez est un mail de son agent.
 *
 * D'où le non-lu, qui n'a aucun sens pour un fil d'actualité et tout son sens
 * ici : c'est ce qui distingue une information reçue d'une information subie.
 */

import type { ClubId } from '../types.js';
import type { ObjectiveKind } from './board-objective.js';
import type { SeasonVerdict } from './manager-record.js';

// =============================================================================
// Modèle
// =============================================================================

export type MailSender =
  | 'PRESIDENT'
  | 'DIRECTION_SPORTIVE'
  | 'AGENT'
  | 'PRESSE'
  | 'FEDERATION'
  | 'STAFF_MEDICAL'
  | 'FORMATION';

export interface SenderIdentity {
  readonly label: string;
  /** Fonction affichée sous le nom, comme dans une signature de courrier. */
  readonly role: string;
  /** Initiales de l'avatar, faute de blason de club sur l'expéditeur. */
  readonly initials: string;
}

export const SENDERS: Readonly<Record<MailSender, SenderIdentity>> = {
  PRESIDENT: { label: 'Le président', role: 'Bureau directeur', initials: 'PR' },
  DIRECTION_SPORTIVE: { label: 'Direction sportive', role: 'Cellule recrutement', initials: 'DS' },
  AGENT: { label: 'Agent de joueur', role: 'Cabinet de représentation', initials: 'AG' },
  PRESSE: { label: 'Le Quinze Info', role: 'Rédaction', initials: 'LQ' },
  FEDERATION: { label: 'Fédération', role: 'Direction technique nationale', initials: 'FF' },
  STAFF_MEDICAL: { label: 'Staff médical', role: 'Infirmerie du club', initials: 'MD' },
  FORMATION: { label: 'Centre de formation', role: 'Responsable académie', initials: 'CF' },
};

/**
 * Ce qu'un mail réclame du manager.
 *
 * Un courrier purement informatif se classe ; un courrier qui attend une
 * décision doit se voir. Sans cette distinction, la boîte devient un dépotoir
 * où l'essentiel se noie dans le protocole.
 */
export type MailImportance = 'NORMALE' | 'HAUTE';

/**
 * Réponse possible à un message — V0.43.
 *
 * La boîte était à sens unique : le président écrivait, on encaissait. Une
 * poignée de messages appellent pourtant une réaction, et c'est là que la
 * messagerie cesse d'être un carnet pour devenir un lieu de décision.
 *
 * Chaque option porte son effet **annoncé** : personne ne doit répondre à
 * l'aveugle, sinon le choix n'en est plus un.
 */
export interface MailAction {
  readonly id: string;
  readonly label: string;
  /** Ce que cela engage, dit franchement. */
  readonly hint: string;
}

export interface Mail {
  readonly id: string;
  readonly season: number;
  /** Journée de championnat. 0 = intersaison. */
  readonly round: number;
  readonly sender: MailSender;
  readonly subject: string;
  /** Corps du message. Les paragraphes sont séparés par une ligne vide. */
  readonly body: string;
  readonly importance: MailImportance;
  readonly read: boolean;
  /** Club concerné, pour colorer le message. */
  readonly clubId?: ClubId;
  /** Réponses proposées, tant qu'aucune n'a été donnée. */
  readonly actions?: readonly MailAction[];
  /** Option retenue. Une fois répondu, le message se fige. */
  readonly answeredWith?: string;
  /**
   * Identité de déduplication, quand l'horodatage ne convient pas.
   *
   * L'identifiant par défaut inclut la journée : deux sollicitations du même
   * ordre à deux journées différentes sont donc deux messages distincts. C'est
   * juste pour une blessure, faux pour une convocation du bureau — qui se
   * déclenche sur un **état durable** et repartait donc à chaque journée tant
   * que l'état durait. Onze fois la même lettre en un exercice.
   */
  readonly dedupKey?: string;
}

export interface Mailbox {
  /** Du plus récent au plus ancien. */
  readonly mails: readonly Mail[];
}

export const EMPTY_MAILBOX: Mailbox = { mails: [] };

/**
 * Plafond de la boîte.
 *
 * Plus bas que celui du fil d'actualité : un mail est long, et une carrière de
 * vingt saisons en produirait des centaines, tous sérialisés à chaque
 * sauvegarde. Cent vingt couvre largement plusieurs saisons de correspondance.
 */
export const MAIL_CAPACITY = 120;

// =============================================================================
// Boîte
// =============================================================================

export type MailDraft = Omit<Mail, 'id' | 'read'>;

/**
 * Dépose des messages dans la boîte.
 *
 * L'identifiant dérive du contenu et de l'horodatage, comme pour le fil
 * d'actualité : rejouer une intersaison au rechargement d'une sauvegarde ne
 * doit pas remplir la boîte de doublons — ni surtout **rendre non-lu** un
 * message déjà ouvert.
 */
export function appendMail(box: Mailbox, drafts: readonly MailDraft[]): Mailbox {
  if (drafts.length === 0) return box;

  const existing = new Set(box.mails.map(m => m.id));
  const added: Mail[] = [];

  for (const d of drafts) {
    const id = d.dedupKey ?? `${d.season}_${d.round}_${d.sender}_${d.subject}`;
    if (existing.has(id)) continue;
    existing.add(id);
    added.push({ ...d, id, read: false });
  }

  if (added.length === 0) return box;

  const merged = [...added, ...box.mails].sort((a, b) =>
    b.season - a.season || b.round - a.round);

  return { mails: merged.slice(0, MAIL_CAPACITY) };
}

/**
 * Consigne la réponse donnée à un message.
 *
 * Répondre fige le message : sans cela, on rejouerait la même décision autant
 * de fois qu'on rouvre la boîte, et chaque effet se cumulerait.
 */
export function answerMail(box: Mailbox, id: string, actionId: string): Mailbox {
  const target = box.mails.find(m => m.id === id);
  if (!target || target.answeredWith !== undefined) return box;
  if (!target.actions?.some(a => a.id === actionId)) return box;
  return {
    mails: box.mails.map(m =>
      m.id === id ? { ...m, answeredWith: actionId, read: true } : m),
  };
}

/** Messages qui attendent encore une réponse. */
export function pendingAnswers(box: Mailbox): readonly Mail[] {
  return box.mails.filter(m => m.actions !== undefined && m.answeredWith === undefined);
}

export function markRead(box: Mailbox, id: string): Mailbox {
  const target = box.mails.find(m => m.id === id);
  if (!target || target.read) return box;
  return { mails: box.mails.map(m => (m.id === id ? { ...m, read: true } : m)) };
}

export function markAllRead(box: Mailbox): Mailbox {
  if (box.mails.every(m => m.read)) return box;
  return { mails: box.mails.map(m => (m.read ? m : { ...m, read: true })) };
}

export function unreadCount(box: Mailbox): number {
  return box.mails.reduce((n, m) => n + (m.read ? 0 : 1), 0);
}

export interface MailFilter {
  readonly sender?: MailSender;
  readonly unreadOnly?: boolean;
  readonly season?: number;
}

export function filterMails(box: Mailbox, filter: MailFilter): readonly Mail[] {
  return box.mails.filter(m => {
    if (filter.sender && m.sender !== filter.sender) return false;
    if (filter.unreadOnly && m.read) return false;
    if (filter.season !== undefined && m.season !== filter.season) return false;
    return true;
  });
}

/** Saisons présentes dans la boîte, de la plus récente à la plus ancienne. */
export function seasonsInMailbox(box: Mailbox): readonly number[] {
  return [...new Set(box.mails.map(m => m.season))].sort((a, b) => b - a);
}

// =============================================================================
// Rédaction
// =============================================================================

/**
 * Lettre de mission du président, en ouverture de saison.
 *
 * L'objectif était jusqu'ici une étiquette dans le bandeau, sans auteur ni
 * moment. Le recevoir écrit change sa nature : ce n'est plus un paramètre du
 * jeu, c'est une commande passée par quelqu'un.
 */
export function mailObjectiveSet(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly objectiveKind: ObjectiveKind;
  readonly objectiveLabel: string;
  readonly boardConfidence: number;
  readonly seasonsAtClub: number;
}): MailDraft {
  const opening = args.seasonsAtClub === 0
    ? `Bienvenue à ${args.clubName}. Le bureau vous a choisi et vous laisse les clés du sportif.`
    : args.boardConfidence >= 60
      ? `La saison qui s'ouvre est votre ${ordinal(args.seasonsAtClub + 1)} sur ce banc, et le bureau vous renouvelle sa confiance.`
      : `Le bureau attend un redressement après l'exercice écoulé.`;

  const pressure = args.objectiveKind === 'CHAMPION'
    ? 'Rien d\'autre que le Bouclier ne sera considéré comme une réussite.'
    : args.objectiveKind === 'MAINTIEN'
      ? 'Les moyens sont ce qu\'ils sont ; l\'essentiel est de rester dans l\'élite.'
      : 'Nous jugerons sur la saison régulière, pas sur les intentions.';

  return {
    season: args.season,
    round: 0,
    sender: 'PRESIDENT',
    subject: `Objectif ${seasonLabel(args.season)} : ${args.objectiveLabel}`,
    body: `${opening}\n\nL'objectif fixé pour l'exercice est le suivant : ${args.objectiveLabel}. ${pressure}\n\nNous restons à votre disposition pour le recrutement et la structure sportive.`,
    importance: 'HAUTE',
    clubId: args.clubId,
  };
}

/** Verdict du board à la clôture de la saison. */
export function mailSeasonVerdict(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly finalRank: number;
  readonly objectiveLabel: string;
  readonly objectiveMet: boolean;
  readonly wonTitle: boolean;
  readonly verdict: SeasonVerdict;
  readonly boardConfidence: number;
}): MailDraft {
  const rank = args.finalRank > 0 ? `${args.finalRank}ᵉ` : 'non classé';

  if (args.verdict === 'LIMOGE') {
    return {
      season: args.season,
      round: 0,
      sender: 'PRESIDENT',
      subject: 'Fin de votre mission',
      body: `Le bureau s'est réuni ce matin. Après une ${rank} place et un objectif « ${args.objectiveLabel} » non rempli, il a été décidé de mettre un terme à votre mission à ${args.clubName}.\n\nCette décision n'enlève rien au travail accompli au quotidien. Nous vous souhaitons de retrouver rapidement un banc.`,
      importance: 'HAUTE',
      clubId: args.clubId,
    };
  }

  if (args.wonTitle) {
    return {
      season: args.season,
      round: 0,
      sender: 'PRESIDENT',
      subject: 'Le Bouclier est à la maison',
      body: `Il n'y a pas grand-chose à ajouter : ${args.clubName} est champion de France.\n\nLe bureau tient à vous dire ce qu'il doit à votre travail. Prenez le temps de savourer — nous reparlerons de la suite très vite.`,
      importance: 'HAUTE',
      clubId: args.clubId,
    };
  }

  if (args.objectiveMet) {
    return {
      season: args.season,
      round: 0,
      sender: 'PRESIDENT',
      subject: 'Bilan de saison : objectif rempli',
      body: `${rank} au terme de la saison régulière : l'objectif « ${args.objectiveLabel} » est atteint.\n\nLe bureau vous renouvelle sa confiance (${args.boardConfidence}/100) et travaillera avec vous sur l'effectif de la saison prochaine.`,
      importance: 'NORMALE',
      clubId: args.clubId,
    };
  }

  return {
    season: args.season,
    round: 0,
    sender: 'PRESIDENT',
    subject: 'Bilan de saison : nos attentes n\'ont pas été tenues',
    body: `${rank} au terme de la saison régulière, pour un objectif fixé à « ${args.objectiveLabel} ».\n\nLe bureau prend acte et vous laisse la saison prochaine pour redresser la situation. Notre confiance est à ${args.boardConfidence}/100 ; elle ne survivrait pas à un second exercice de ce niveau.`,
    importance: 'HAUTE',
    clubId: args.clubId,
  };
}

/** Un club vacant se manifeste — le mail double la modale, qui elle ne dure pas. */
export function mailJobOffers(args: {
  readonly season: number;
  readonly clubNames: readonly string[];
  readonly unemployed: boolean;
}): MailDraft | undefined {
  if (args.clubNames.length === 0) return undefined;
  const list = args.clubNames.join(', ');

  return {
    season: args.season,
    round: 0,
    sender: 'AGENT',
    subject: args.unemployed
      ? `${args.clubNames.length} club${args.clubNames.length > 1 ? 's' : ''} vous ${args.clubNames.length > 1 ? 'attendent' : 'attend'}`
      : `On vous veut ailleurs : ${list}`,
    body: args.unemployed
      ? `J'ai fait le tour des bancs libres. Voici qui accepterait de vous recevoir : ${list}.\n\nNe traînez pas. Un entraîneur sans club perd de sa valeur à chaque mois qui passe, et les postes se pourvoient vite.`
      : `Discussion informelle ce matin : ${list} se ${args.clubNames.length > 1 ? 'renseignent' : 'renseigne'} sur votre situation.\n\nRien ne vous oblige à bouger. Mais une porte ouverte ne le reste pas éternellement.`,
    importance: 'HAUTE',
  };
}

/** Blessure longue : le staff médical rend son diagnostic. */
export function mailInjury(args: {
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
  readonly playerName: string;
  readonly injuryType: string;
  readonly returnsAtRound: number;
}): MailDraft {
  const weeks = Math.max(1, args.returnsAtRound - args.round);
  return {
    season: args.season,
    round: args.round,
    sender: 'STAFF_MEDICAL',
    subject: `${args.playerName} — indisponible ${weeks} semaine${weeks > 1 ? 's' : ''}`,
    body: `Examens terminés. Lésion de type ${args.injuryType.toLowerCase()} pour ${args.playerName}.\n\nRetour à la compétition envisagé pour la journée ${args.returnsAtRound}. Nous vous tiendrons informé de la reprise de course.`,
    importance: weeks >= 8 ? 'HAUTE' : 'NORMALE',
    clubId: args.clubId,
  };
}

/** Sortie de promotion du centre de formation. */
export function mailAcademyIntake(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly count: number;
  readonly bestName?: string;
  readonly bestLevel?: number;
  readonly academyLevel: number;
}): MailDraft | undefined {
  if (args.count === 0) return undefined;
  const highlight = args.bestName
    ? `\n\nLe plus prometteur du groupe est ${args.bestName} (niveau ${args.bestLevel}). Il mérite du temps de jeu s'il en trouve.`
    : '';

  return {
    season: args.season,
    round: 0,
    sender: 'FORMATION',
    subject: `${args.count} jeune${args.count > 1 ? 's' : ''} intègre${args.count > 1 ? 'nt' : ''} le groupe pro`,
    body: `La promotion sortante est arrivée à maturité : ${args.count} joueur${args.count > 1 ? 's rejoignent' : ' rejoint'} l'effectif professionnel.${highlight}\n\nNiveau actuel du centre : ${args.academyLevel}/20.`,
    importance: 'NORMALE',
    clubId: args.clubId,
  };
}

/** Mouvement de mercato touchant directement le club. */
export function mailTransfer(args: {
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
  readonly arrivals: readonly string[];
  readonly departures: readonly string[];
  readonly windowLabel: string;
}): MailDraft | undefined {
  if (args.arrivals.length === 0 && args.departures.length === 0) return undefined;

  const lines: string[] = [];
  if (args.arrivals.length > 0) lines.push(`Arrivées : ${args.arrivals.join(', ')}.`);
  if (args.departures.length > 0) lines.push(`Départs : ${args.departures.join(', ')}.`);

  return {
    season: args.season,
    round: args.round,
    sender: 'DIRECTION_SPORTIVE',
    subject: `${args.windowLabel} — bilan de nos mouvements`,
    body: `La fenêtre se referme. Voici ce qui a bougé dans nos rangs.\n\n${lines.join('\n')}\n\nLa cellule reste en veille sur les postes que vous jugerez encore fragiles.`,
    importance: 'NORMALE',
    clubId: args.clubId,
  };
}

/**
 * Brouille de vestiaire — V0.56.
 *
 * Envoyé une seule fois, au moment où la tension entre deux joueurs devient un
 * conflit ouvert. Ce n'est pas un bulletin d'humeur hebdomadaire : le manager
 * doit apprendre qu'une relation a cassé, pas suivre une jauge.
 */
export function mailSquadRift(args: {
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
  readonly frustratedName: string;
  readonly aheadName: string;
  readonly position: string;
}): MailDraft {
  return {
    season: args.season,
    round: args.round,
    sender: 'DIRECTION_SPORTIVE',
    subject: `Tension entre ${args.frustratedName} et ${args.aheadName}`,
    body: `Le vestiaire nous remonte quelque chose, et ça ne vient pas de nulle part : ${args.frustratedName} ne supporte plus d'être derrière ${args.aheadName} au poste de ${args.position.toLowerCase()}.\n\nÇa se règle de trois façons — vous lui donnez du temps de jeu, vous lui expliquez clairement où il en est dans la hiérarchie, ou vous acceptez de le voir partir. Laisser pourrir est la seule option qui n'en est pas une : ces choses-là finissent par se voir sur le terrain.`,
    importance: 'NORMALE',
    clubId: args.clubId,
  };
}

/**
 * Bilan des exigences de gestion — V0.48.
 *
 * Le président ne juge pas que le classement. Ce courrier fait le point sur ce
 * qu'il avait demandé en plus — masse salariale, quota, jeunes, comptes — et
 * dit ce que cela vaut pour sa confiance.
 */
export function mailExpectationReview(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly results: readonly {
    readonly wording: string;
    readonly summary: string;
    readonly met: boolean;
  }[];
  readonly confidenceDelta: number;
}): MailDraft | undefined {
  if (args.results.length === 0) return undefined;

  const lines = args.results
    .map(r => `${r.met ? '✓' : '✗'} ${r.wording}\n   ${r.summary}.`)
    .join('\n');
  const allMet = args.results.every(r => r.met);

  return {
    season: args.season,
    round: 0,
    sender: 'PRESIDENT',
    clubId: args.clubId,
    importance: allMet ? 'NORMALE' : 'HAUTE',
    dedupKey: `EXPECTATIONS_${args.season}_${args.clubId as string}`,
    subject: allMet
      ? 'Feuille de route tenue'
      : 'Feuille de route : nos attentes n\'ont pas toutes été suivies',
    body: `Au-delà du classement, voici où nous en sommes de ce qui avait été demandé.\n\n${lines}\n\n`
      + (allMet
        ? 'Le bureau apprécie que la maison soit tenue autant que l\'équipe.'
        : 'Un club ne se gère pas uniquement le dimanche. Nous comptons sur vous pour y remédier.')
      + ` (confiance ${args.confidenceDelta >= 0 ? '+' : ''}${args.confidenceDelta})`,
  };
}

/**
 * Verdict de la commission — V0.45.
 *
 * Une sanction qui n'arriverait que dans le fil d'actualité, au milieu des
 * transferts des autres clubs, se lirait comme une nouvelle parmi d'autres. Ici
 * on l'adresse au manager : c'est son effectif qui a été jugé.
 */
export function mailSanction(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly sanctions: readonly { readonly summary: string; readonly reason: string }[];
}): MailDraft | undefined {
  if (args.sanctions.length === 0) return undefined;
  const detail = args.sanctions.map(s => `• ${s.reason} — ${s.summary}.`).join('\n');

  return {
    season: args.season,
    round: 0,
    sender: 'FEDERATION',
    clubId: args.clubId,
    importance: 'HAUTE',
    dedupKey: `SANCTION_${args.season}_${args.clubId as string}`,
    subject: `Décision de la commission — exercice ${seasonLabel(args.season)}`,
    body: `La commission de contrôle des clubs a examiné les comptes de ${args.clubName}.\n\n${detail}\n\nCes mesures prennent effet immédiatement. Un nouveau manquement l'an prochain serait apprécié avec la plus grande sévérité.`,
  };
}

/**
 * Changement d'étage — V0.44.
 *
 * Descendre ou monter est l'événement le plus lourd d'une carrière de club :
 * il change le budget, l'effectif, l'ambition et jusqu'à ce que le président
 * peut décemment exiger. Il mérite mieux qu'une ligne dans le classement.
 */
export function mailDivisionChange(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly clubName: string;
  readonly promoted: boolean;
}): MailDraft {
  return {
    season: args.season,
    round: 0,
    sender: 'PRESIDENT',
    clubId: args.clubId,
    importance: 'HAUTE',
    subject: args.promoted
      ? `${args.clubName} retrouve le Top 14`
      : `${args.clubName} descend en Pro D2`,
    body: args.promoted
      ? `C'est fait : nous remontons.\n\nLe bureau mesure ce que cela doit à votre travail. La marche est haute — les moyens ne suivront pas immédiatement, et l'effectif qui a dominé la Pro D2 va découvrir un autre niveau. Nous en reparlerons au mercato.`
      : `La saison s'achève sur une relégation. ${args.clubName} jouera la Pro D2.\n\nLe bureau a décidé de vous garder : reconstruire demande de la continuité, et personne ne connaît mieux ce groupe. Les moyens seront réduits, l'objectif sera de remonter.`,
  };
}

/**
 * Jalons de carrière — ce que la presse retient.
 *
 * Sans eux, une carrière longue n'a aucun relief : on enchaîne les saisons sans
 * qu'aucune ne soit marquée comme un accomplissement.
 */
export function mailMilestone(args: {
  readonly season: number;
  readonly seasonsManaged: number;
  readonly titles: number;
  readonly reputation: number;
}): MailDraft | undefined {
  if (args.titles >= 3 && args.seasonsManaged >= 3) {
    return milestone(args.season, 'Une place dans l\'histoire du championnat',
      `Trois Bouclier de Brennus. Vous entrez dans le cercle très fermé des entraîneurs qui ont marqué le Top 14.\n\nNous préparons un portrait pour notre édition de fin de saison — accepteriez-vous un entretien ?`);
  }
  if (args.reputation >= 80) {
    return milestone(args.season, 'Le staff national suit votre travail',
      `Votre réputation dépasse désormais celle de la plupart de vos pairs. Les noms circulent quand on évoque l'avenir de l'encadrement national.\n\nRien d'officiel à ce stade, mais on parle de vous là où ça compte.`);
  }
  if (args.seasonsManaged === 10) {
    return milestone(args.season, 'Dix saisons sur un banc de Top 14',
      `Peu d'entraîneurs tiennent dix saisons dans ce championnat. Vous venez de boucler la vôtre.\n\nLa rédaction vous adresse ses félicitations.`);
  }
  return undefined;
}

function milestone(season: number, subject: string, body: string): MailDraft {
  return { season, round: 0, sender: 'PRESSE', subject, body, importance: 'NORMALE' };
}

// =============================================================================
// Messages à réponse — V0.43
// =============================================================================

/**
 * Ce qu'une réponse change dans la partie.
 *
 * Le moteur reste pur : il dit ce que la décision coûte ou rapporte, et c'est
 * l'appelant qui l'applique. Sans cette séparation, la messagerie manipulerait
 * la réputation, la confiance et les finances depuis un module dont ce n'est
 * pas le métier.
 */
export interface MailEffect {
  readonly reputationDelta: number;
  readonly confidenceDelta: number;
  /** Mouvement de trésorerie, en euros. */
  readonly cashDelta: number;
  /** Ce que l'on vous répond, une fois la décision prise. */
  readonly reply: string;
}

/**
 * Effets par identifiant de réponse.
 *
 * L'identifiant porte l'effet, plutôt qu'un couple (message, option) : c'est ce
 * qui permet de sauvegarder une réponse sous forme de simple chaîne et de la
 * relire des saisons plus tard sans reconstruire le message d'origine.
 */
export const MAIL_EFFECTS: Readonly<Record<string, MailEffect>> = {
  // Entretien de presse après une mauvaise série.
  PRESSE_ASSUMER: {
    reputationDelta: 2, confidenceDelta: 6, cashDelta: 0,
    reply: 'Votre franchise a été remarquée. Le bureau apprécie que vous n\'ayez cherché aucune excuse.',
  },
  PRESSE_DEFENDRE: {
    reputationDelta: 4, confidenceDelta: -4, cashDelta: 0,
    reply: 'Le vestiaire vous sait derrière lui. Le bureau, lui, aurait préféré un peu moins de bravade.',
  },
  PRESSE_ELUDER: {
    reputationDelta: -3, confidenceDelta: 0, cashDelta: 0,
    reply: 'Vous avez botté en touche. La presse l\'a écrit, et personne n\'a été dupe.',
  },

  // Mise au point du board quand la confiance s'effrite.
  BOARD_REDRESSER: {
    reputationDelta: 0, confidenceDelta: 10, cashDelta: 0,
    reply: 'Le bureau vous accorde le bénéfice du doute. Il attend des actes dès les prochaines journées.',
  },
  BOARD_MOYENS: {
    reputationDelta: 0, confidenceDelta: -6, cashDelta: 2_500_000,
    reply: 'Une rallonge est débloquée. Elle vous engage : personne n\'oubliera que vous l\'avez réclamée.',
  },
  BOARD_CONTESTER: {
    reputationDelta: 3, confidenceDelta: -12, cashDelta: 0,
    reply: 'Vous avez tenu tête. Le rapport de force est posé — il ne joue pas en votre faveur.',
  },

  // Demande de transfert d'un joueur à qui l'on avait promis du temps de jeu.
  // Aucun effet global ici : ce que cela coûte se joue sur le moral du joueur
  // et du vestiaire, que ce module ne connaît pas.
  DEPART_ACCEPTER: {
    reputationDelta: 0, confidenceDelta: 0, cashDelta: 0,
    reply: 'Il est sur la liste. Son agent fait déjà le tour des clubs intéressés.',
  },
  DEPART_RETENIR: {
    reputationDelta: 0, confidenceDelta: 0, cashDelta: 0,
    reply: 'Vous refusez de le laisser partir. Il l\'apprend par son agent, et il ne le prend pas bien.',
  },

  // Enveloppe de transfert promise à la signature.
  BUDGET_DEPENSER: {
    reputationDelta: 0, confidenceDelta: 0, cashDelta: 0,
    reply: 'L\'enveloppe est virée sur le compte du club. À vous d\'en faire quelque chose.',
  },
  BUDGET_GARDER: {
    reputationDelta: 0, confidenceDelta: 5, cashDelta: 0,
    reply: 'Le bureau salue votre prudence et gardera cela en mémoire au moment des comptes.',
  },
};

const NO_EFFECT: MailEffect = {
  reputationDelta: 0, confidenceDelta: 0, cashDelta: 0,
  reply: 'Votre réponse a été transmise.',
};

/**
 * Effet d'une réponse.
 *
 * Certaines décisions portent un montant qui n'est connu qu'à la rédaction —
 * l'enveloppe négociée à la signature varie d'un contrat à l'autre. Il est
 * suffixé à l'identifiant (`BUDGET_DEPENSER:2500000`) plutôt que gardé à part :
 * la réponse reste ainsi une simple chaîne, relisible telle quelle dans une
 * sauvegarde des années plus tard.
 */
export function effectOf(actionId: string): MailEffect {
  const [base, arg] = actionId.split(':');
  const effect = MAIL_EFFECTS[base ?? ''] ?? NO_EFFECT;
  const amount = arg !== undefined ? Number(arg) : NaN;
  return Number.isFinite(amount) && amount !== 0
    ? { ...effect, cashDelta: effect.cashDelta + amount }
    : effect;
}

/**
 * Sollicitation de la presse après une série de défaites.
 *
 * C'est le seul moment où l'on parle en son nom propre plutôt qu'au nom du
 * club, d'où l'effet sur la réputation là où le board ne joue que sur sa
 * confiance.
 */
export function mailPressInterview(args: {
  readonly season: number;
  readonly round: number;
  readonly clubName: string;
  readonly losses: number;
}): MailDraft {
  return {
    season: args.season,
    round: args.round,
    sender: 'PRESSE',
    // Une seule sollicitation par saison : la série dure plusieurs journées, et
    // la presse ne redemande pas un entretien chaque week-end.
    dedupKey: `PRESSE_SERIE_${args.season}`,
    subject: `${args.losses} défaites de rang — un mot ?`,
    body: `La série commence à faire du bruit et nous préparons un sujet sur ${args.clubName}.\n\nNous vous proposons de vous exprimer avant que d'autres ne le fassent à votre place. Trois minutes suffiront.`,
    importance: 'NORMALE',
    actions: [
      { id: 'PRESSE_ASSUMER', label: 'Assumer publiquement',
        hint: 'Le bureau apprécie. Réputation +2, confiance +6.' },
      { id: 'PRESSE_DEFENDRE', label: 'Défendre le groupe',
        hint: 'Le vestiaire suit, le bureau grince. Réputation +4, confiance −4.' },
      { id: 'PRESSE_ELUDER', label: 'Refuser de commenter',
        hint: 'Personne n\'est dupe. Réputation −3.' },
    ],
  };
}

/** Convocation du bureau quand la confiance s'effrite en cours de saison. */
export function mailBoardReview(args: {
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
  readonly rank: number;
  readonly objectiveLabel: string;
  readonly confidence: number;
}): MailDraft {
  return {
    season: args.season,
    round: args.round,
    sender: 'PRESIDENT',
    // Le bureau convoque une fois, pas à chaque journée où la confiance reste
    // basse — l'état est durable, la convocation ne l'est pas.
    dedupKey: `BOARD_REVIEW_${args.season}`,
    subject: 'Point d\'étape — nous devons parler',
    body: `${args.rank}ᵉ à la journée ${args.round}, pour une mission fixée à « ${args.objectiveLabel} ». Le bureau ne peut pas laisser passer cela sans en discuter.\n\nNotre confiance est tombée à ${args.confidence}/100. Dites-nous comment vous voyez la suite.`,
    importance: 'HAUTE',
    clubId: args.clubId,
    actions: [
      { id: 'BOARD_REDRESSER', label: 'Promettre un redressement',
        hint: 'Vous gagnez du crédit sur parole. Confiance +10.' },
      { id: 'BOARD_MOYENS', label: 'Réclamer des moyens',
        hint: '2,5 M€ débloqués, mais l\'échec vous appartiendra. Confiance −6.' },
      { id: 'BOARD_CONTESTER', label: 'Contester le procès',
        hint: 'Vous tenez tête. Réputation +3, confiance −12.' },
    ],
  };
}

/** Arbitrage sur l'enveloppe de transfert obtenue à la signature. */
export function mailTransferBudget(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly amount: number;
}): MailDraft | undefined {
  if (args.amount <= 0) return undefined;
  return {
    season: args.season,
    round: 0,
    sender: 'PRESIDENT',
    subject: `Votre enveloppe de ${euros(args.amount)}`,
    body: `Comme convenu à votre arrivée, une enveloppe de ${euros(args.amount)} vous est réservée pour renforcer l'effectif.\n\nLe bureau peut la virer dès maintenant, ou la garder au bilan si vous préférez travailler avec ce que vous avez.`,
    importance: 'HAUTE',
    clubId: args.clubId,
    actions: [
      { id: `BUDGET_DEPENSER:${args.amount}`, label: 'Débloquer l\'enveloppe',
        hint: `${euros(args.amount)} rejoignent la trésorerie du club.` },
      { id: 'BUDGET_GARDER', label: 'Laisser au bilan',
        hint: 'Rien n\'est versé. Confiance +5.' },
    ],
  };
}

/**
 * Demande de transfert après une promesse trahie — V0.49.
 *
 * L'agent écrit au manager parce que le joueur, lui, a cessé de lui parler.
 * Les deux réponses sont défendables, et c'est ce qui en fait une décision :
 * on garde un cadre aigri, ou on laisse partir un joueur qu'on avait soi-même
 * décidé de ne pas faire jouer.
 */
export function mailTransferRequest(args: {
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
  readonly playerId: string;
  readonly playerName: string;
}): MailDraft {
  return {
    season: args.season,
    round: args.round,
    sender: 'AGENT',
    subject: `${args.playerName} demande à partir`,
    body: `Mon client a attendu le temps de jeu que vous lui aviez promis. Il ne l'a pas eu, et il a cessé d'y croire.\n\nIl souhaite désormais quitter le club. Nous préférons vous l'annoncer avant que la presse ne s'en charge.\n\nÀ vous de nous dire si nous pouvons chercher une porte de sortie.`,
    importance: 'HAUTE',
    clubId: args.clubId,
    // L'identité du joueur, pas la journée : une demande par joueur et par
    // saison, sinon la même affaire reviendrait à chaque rechargement.
    dedupKey: `DEPART_${args.season}_${args.playerId}`,
    actions: [
      { id: `DEPART_ACCEPTER:${args.playerId}`, label: 'Le mettre sur la liste',
        hint: 'Il retrouve le moral, et les clubs peuvent venir le chercher.' },
      { id: `DEPART_RETENIR:${args.playerId}`, label: 'Le retenir',
        hint: 'Il reste, moral en berne, et le vestiaire encaisse aussi.' },
    ],
  };
}

/**
 * Le palmarès individuel de la saison — V0.53.
 *
 * Une année se terminait sur un classement. Le courrier de la Ligue est ce qui
 * la clôt vraiment, et c'est aussi là qu'on découvre qu'un joueur formé au club
 * vient d'être élu meilleur espoir du championnat.
 */
export function mailHonours(args: {
  readonly season: number;
  readonly clubId: ClubId;
  readonly bestPlayer?: { readonly name: string; readonly clubName: string };
  readonly bestYoung?: { readonly name: string; readonly clubName: string };
  readonly topScorer?: { readonly name: string; readonly clubName: string; readonly tries: number };
  /** Joueurs du club distingués, pour la note personnelle en fin de lettre. */
  readonly ownLaureates: readonly string[];
}): MailDraft | undefined {
  if (!args.bestPlayer && !args.bestYoung && !args.topScorer) return undefined;

  const lignes: string[] = [];
  if (args.bestPlayer) {
    lignes.push(`Meilleur joueur : ${args.bestPlayer.name} (${args.bestPlayer.clubName}).`);
  }
  if (args.bestYoung) {
    lignes.push(`Meilleur espoir : ${args.bestYoung.name} (${args.bestYoung.clubName}).`);
  }
  if (args.topScorer) {
    lignes.push(
      `Meilleur marqueur : ${args.topScorer.name} (${args.topScorer.clubName}), `
      + `${args.topScorer.tries} essai${args.topScorer.tries > 1 ? 's' : ''}.`,
    );
  }

  const note = args.ownLaureates.length > 0
    ? `\n\nNos félicitations pour ${args.ownLaureates.join(', ')} : votre travail y est pour quelque chose.`
    : '\n\nAucun de vos joueurs n\'a été distingué cette saison.';

  return {
    season: args.season,
    round: 0,
    sender: 'FEDERATION',
    subject: `Palmarès individuel ${seasonLabel(args.season)}`,
    body: `La Ligue a rendu son palmarès de la saison écoulée.\n\n${lignes.join('\n')}${note}`,
    importance: 'NORMALE',
    clubId: args.clubId,
    dedupKey: `HONNEURS_${args.season}`,
  };
}

// =============================================================================
// Utilitaires
// =============================================================================

export function seasonLabel(season: number): string {
  return `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
}

/** Montant en toutes lettres courtes, comme dans le fil d'actualité. */
function euros(n: number): string {
  return Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)} M€`
    : `${Math.round(n / 1_000)} k€`;
}

function ordinal(n: number): string {
  return n === 1 ? 'première' : `${n}ᵉ`;
}
