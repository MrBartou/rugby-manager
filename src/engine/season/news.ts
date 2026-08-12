/**
 * Fil d'actualité du championnat — V0.38.
 *
 * Le jeu produisait déjà quantité d'événements : transferts, mercatos d'hiver,
 * blessures longues, titres, descentes. Aucun n'était conservé. Seuls les
 * mouvements de la **dernière** fenêtre restaient visibles, et tout le reste
 * disparaissait dès la journée suivante.
 *
 * Une carrière sans mémoire n'est pas une carrière : on ne peut ni se souvenir
 * de la saison où l'on a vendu son ouvreur, ni relire ce qui a mené à une
 * descente.
 *
 * ## Un journal, pas un état
 *
 * Les entrées sont **immuables et horodatées** par saison et journée. Ce module
 * ne recalcule rien : il enregistre ce qui s'est produit, au moment où ça s'est
 * produit. C'est ce qui permet de le sauvegarder tel quel et de le relire des
 * années plus tard.
 */

import type { ClubId } from '../types.js';

// =============================================================================
// Modèle
// =============================================================================

export type NewsKind =
  | 'TRANSFERT'
  | 'MERCATO'
  | 'BLESSURE'
  | 'RESULTAT'
  | 'CONTRAT'
  | 'SAISON'
  /** V0.58 — sélections et résultats du XV de France. */
  | 'SELECTION';

export interface NewsItem {
  readonly id: string;
  readonly season: number;
  /** Journée de championnat. 0 = intersaison. */
  readonly round: number;
  readonly kind: NewsKind;
  readonly headline: string;
  /** Détail facultatif, affiché en second plan. */
  readonly detail?: string;
  /** Club concerné, pour filtrer et colorer l'entrée. */
  readonly clubId?: ClubId;
  /** Vrai quand l'entrée concerne directement le club de l'utilisateur. */
  readonly involvesPlayer: boolean;
}

export const NEWS_KIND_LABEL: Readonly<Record<NewsKind, string>> = {
  TRANSFERT: 'Transfert',
  MERCATO: 'Mercato',
  BLESSURE: 'Infirmerie',
  RESULTAT: 'Résultat',
  CONTRAT: 'Contrat',
  SAISON: 'Saison',
  SELECTION: 'Sélection',
};

/**
 * Plafond du journal.
 *
 * Une carrière de vingt saisons produirait des milliers d'entrées, toutes
 * sérialisées dans la sauvegarde à chaque tour. On garde les plus récentes :
 * un fil d'actualité se lit du présent vers le passé, et personne ne remonte à
 * la journée 14 de la saison 2031.
 */
export const NEWS_CAPACITY = 400;

// =============================================================================
// Journal
// =============================================================================

export interface NewsFeed {
  /** Du plus récent au plus ancien. */
  readonly items: readonly NewsItem[];
}

export const EMPTY_NEWS: NewsFeed = { items: [] };

/**
 * Ajoute des entrées en tête du journal.
 *
 * L'identifiant est dérivé du contenu et de l'horodatage : rejouer deux fois la
 * même intersaison — ce qui arrive au rechargement d'une sauvegarde — ne doit
 * pas dupliquer les entrées.
 */
export function appendNews(feed: NewsFeed, entries: readonly Omit<NewsItem, 'id'>[]): NewsFeed {
  if (entries.length === 0) return feed;

  const existing = new Set(feed.items.map(i => i.id));
  const added: NewsItem[] = [];

  for (const entry of entries) {
    const id = `${entry.season}_${entry.round}_${entry.kind}_${entry.headline}`;
    if (existing.has(id)) continue;
    existing.add(id);
    added.push({ ...entry, id });
  }

  if (added.length === 0) return feed;

  // Tri explicite plutôt que confiance à l'ordre d'insertion : les entrées
  // arrivent de plusieurs sources — journée, mercato, fin de saison — qui ne se
  // suivent pas nécessairement dans l'ordre chronologique. Sans ce tri, le fil
  // affichait une J13 au-dessus d'une J14.
  const merged = [...added, ...feed.items].sort((a, b) =>
    b.season - a.season || b.round - a.round);

  return { items: merged.slice(0, NEWS_CAPACITY) };
}

// =============================================================================
// Filtres
// =============================================================================

export interface NewsFilter {
  readonly kind?: NewsKind;
  /** Ne garder que ce qui touche le club de l'utilisateur. */
  readonly mineOnly?: boolean;
  readonly season?: number;
}

export function filterNews(feed: NewsFeed, filter: NewsFilter): readonly NewsItem[] {
  return feed.items.filter(item => {
    if (filter.kind && item.kind !== filter.kind) return false;
    if (filter.mineOnly && !item.involvesPlayer) return false;
    if (filter.season !== undefined && item.season !== filter.season) return false;
    return true;
  });
}

/** Saisons présentes dans le journal, de la plus récente à la plus ancienne. */
export function seasonsInFeed(feed: NewsFeed): readonly number[] {
  return [...new Set(feed.items.map(i => i.season))].sort((a, b) => b - a);
}

// =============================================================================
// Rédaction
// =============================================================================

function euros(n: number): string {
  return Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)} M€`
    : `${Math.round(n / 1_000)} k€`;
}

/**
 * Entrées produites par une fenêtre de mercato.
 *
 * On ne consigne que ce qui se raconte : les transferts payants et les recrues
 * libres. Les prolongations sont utiles au moteur mais ne font pas l'actualité —
 * en écrire cent cinquante noierait le fil le jour de la falaise de contrats.
 */
export function newsFromMarket(
  transfers: readonly {
    readonly kind: string;
    readonly playerName: string;
    readonly fromClubName: string;
    readonly toClubName: string;
    readonly toClubId: ClubId;
    readonly fromClubId: ClubId;
    readonly fee: number;
    readonly overall: number;
  }[],
  season: number,
  round: number,
  playerClubId: ClubId,
  windowLabel: string,
): readonly Omit<NewsItem, 'id'>[] {
  const notable = transfers.filter(t =>
    t.kind === 'TRANSFERT' || t.kind === 'RECRUE_LIBRE' || t.kind === 'DEPART_LIBRE');
  if (notable.length === 0) return [];

  const entries: Omit<NewsItem, 'id'>[] = notable.map(t => ({
    season,
    round,
    kind: 'TRANSFERT' as const,
    // Un agent libre ne « quitte » personne : il s'engage. Et un joueur libéré
    // pour tenir le plafond ne « s'engage » nulle part — sans cette troisième
    // formulation, un cadre disparaissait de son club sans explication.
    headline: t.kind === 'DEPART_LIBRE'
      ? `${t.playerName} est libéré par ${t.fromClubName}`
      : t.fee > 0
        ? `${t.playerName} quitte ${t.fromClubName} pour ${t.toClubName}`
        : `${t.playerName} s'engage avec ${t.toClubName}`,
    detail: t.kind === 'DEPART_LIBRE'
      ? `Masse salariale — niveau ${t.overall}`
      : t.fee > 0
        ? `${euros(t.fee)} — niveau ${t.overall}`
        : `Libre — niveau ${t.overall}`,
    clubId: t.kind === 'DEPART_LIBRE' ? t.fromClubId : t.toClubId,
    involvesPlayer: t.toClubId === playerClubId || t.fromClubId === playerClubId,
  }));

  const paid = notable.filter(t => t.fee > 0);
  const total = paid.reduce((s, t) => s + t.fee, 0);

  return [
    {
      season,
      round,
      kind: 'MERCATO' as const,
      headline: `${windowLabel} : ${notable.length} mouvement${notable.length > 1 ? 's' : ''} dans le championnat`,
      detail: paid.length > 0 ? `${euros(total)} dépensés en indemnités` : 'Aucune indemnité versée',
      involvesPlayer: false,
    },
    ...entries,
  ];
}

/** Entrée pour une blessure longue durée du club de l'utilisateur. */
export function newsFromInjury(args: {
  readonly playerName: string;
  readonly injuryType: string;
  readonly returnsAtRound: number;
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
}): Omit<NewsItem, 'id'> {
  return {
    season: args.season,
    round: args.round,
    kind: 'BLESSURE',
    headline: `${args.playerName} out jusqu'à la J${args.returnsAtRound}`,
    detail: args.injuryType.toLowerCase(),
    clubId: args.clubId,
    involvesPlayer: true,
  };
}

/** Entrée pour un match du club de l'utilisateur qui mérite d'être retenu. */
export function newsFromResult(args: {
  readonly season: number;
  readonly round: number;
  readonly opponentName: string;
  readonly myScore: number;
  readonly theirScore: number;
  readonly atHome: boolean;
  readonly clubId: ClubId;
}): Omit<NewsItem, 'id'> | undefined {
  const margin = args.myScore - args.theirScore;
  // On ne consigne pas les rencontres ordinaires : un fil qui retient tous les
  // matchs n'est plus un fil d'actualité, c'est un calendrier.
  if (Math.abs(margin) < 21) return undefined;

  const verb = margin > 0 ? 'Démonstration contre' : 'Correction reçue à';
  return {
    season: args.season,
    round: args.round,
    kind: 'RESULTAT',
    headline: `${verb} ${args.opponentName} — ${args.myScore}-${args.theirScore}`,
    detail: args.atHome ? 'à domicile' : 'à l\'extérieur',
    clubId: args.clubId,
    involvesPlayer: true,
  };
}

/**
 * La liste du XV de France, et ce qu'elle change pour le club — V0.58.
 *
 * On nomme les joueurs du club retenus, et on distingue les premières
 * sélections : c'est l'information qui fait la une, et c'est la récompense du
 * manager qui a fait jouer un jeune formé chez lui.
 */
export function newsFromSelection(args: {
  readonly season: number;
  readonly round: number;
  readonly clubId: ClubId;
  readonly windowLabel: string;
  readonly selectedNames: readonly string[];
  readonly newCapNames: readonly string[];
}): Omit<NewsItem, 'id'> | undefined {
  if (args.selectedNames.length === 0) return undefined;
  const n = args.selectedNames.length;
  return {
    season: args.season,
    round: args.round,
    kind: 'SELECTION',
    headline: `${n} sélectionné${n > 1 ? 's' : ''} pour ${args.windowLabel}`,
    detail: args.newCapNames.length > 0
      ? `${args.selectedNames.join(', ')} — première sélection pour ${args.newCapNames.join(', ')}`
      : args.selectedNames.join(', '),
    clubId: args.clubId,
    involvesPlayer: true,
  };
}

/** Bilan d'une fenêtre internationale — V0.58. */
export function newsFromInternationalWindow(args: {
  readonly season: number;
  readonly round: number;
  readonly headline: string;
  readonly scores: readonly string[];
}): Omit<NewsItem, 'id'> {
  return {
    season: args.season,
    round: args.round,
    kind: 'SELECTION',
    headline: args.headline,
    detail: args.scores.join(' · '),
    involvesPlayer: false,
  };
}

/** Entrées de fin de saison : titre, descente, bilan du club. */
export function newsFromSeasonEnd(args: {
  readonly season: number;
  readonly championName: string | undefined;
  readonly playerClubName: string;
  readonly playerRank: number;
  readonly playerClubId: ClubId;
}): readonly Omit<NewsItem, 'id'>[] {
  const entries: Omit<NewsItem, 'id'>[] = [];

  if (args.championName) {
    entries.push({
      season: args.season,
      round: 0,
      kind: 'SAISON',
      headline: `${args.championName} champion de France`,
      involvesPlayer: args.championName === args.playerClubName,
    });
  }

  entries.push({
    season: args.season,
    round: 0,
    kind: 'SAISON',
    headline: `${args.playerClubName} termine ${args.playerRank}ᵉ`,
    clubId: args.playerClubId,
    involvesPlayer: true,
  });

  return entries;
}
