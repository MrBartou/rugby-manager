/**
 * Coque de l'application — V0.18, restructurée.
 *
 * La version précédente utilisait une **barre latérale gauche** : c'est un
 * pattern d'application web, pas de jeu. Les jeux de management sportif
 * (FIFA/EA FC en tête) posent la navigation **en haut**, sous forme d'onglets,
 * avec un bandeau d'informations permanent et une barre d'actions en bas.
 *
 * Cette coque reprend cette structure :
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  blason · club · saison   [HUD : J, rang, €] │  ← identité + état
 *   ├──────────────────────────────────────────────┤
 *   │  ONGLETS ——————————————————————————————————  │  ← navigation
 *   ├──────────────────────────────────────────────┤
 *   │                                              │
 *   │                  contenu                     │  ← pleine largeur
 *   │                                              │
 *   ├──────────────────────────────────────────────┤
 *   │  actions contextuelles          sauvegarder  │  ← barre d'actions
 *   └──────────────────────────────────────────────┘
 *
 * Effet secondaire important : le contenu récupère toute la largeur de l'écran,
 * ce qui bénéficie directement aux tableaux denses.
 */

import type { CSSProperties, ReactNode } from 'react';
import { ClubCrest } from './ClubCrest.js';
import { clubCssVars } from '../theme/club-identity.js';
import {
  IconBall,
  IconCalendar,
  IconChart,
  IconCoin,
  IconMegaphone,
  IconWhistle,
  IconTrophy,
  IconExchange,
  IconFlag,
  IconTarget,
  IconUsers,
} from './Icons.js';

export type NavKey = 'dashboard' | 'standings' | 'squad' | 'training' | 'finances' | 'transfers' | 'news' | 'career' | 'direction';

interface NavItem {
  readonly key: NavKey;
  readonly label: string;
  readonly icon: ReactNode;
  readonly badge?: number;
}

/** Une statistique du bandeau HUD. */
export interface HudStat {
  readonly label: string;
  readonly value: string;
  /** Met la valeur en avant (couleur du club). */
  readonly highlight?: boolean;
  /** Signale une situation à risque. */
  readonly warn?: boolean;
}

interface AppShellProps {
  readonly clubId: string;
  readonly active: NavKey;
  readonly onNavigate: (key: NavKey) => void;
  readonly onExitSeason?: () => void;
  /** V0.62 — ouvre les réglages, depuis le pied de l'écran. */
  readonly onOpenSettings?: () => void;
  /** V0.62 — ouvre l'encyclopédie sur l'entrée qui correspond à l'écran courant. */
  readonly onOpenHelp?: () => void;
  readonly onSave?: () => void;
  readonly saveStatus?: 'idle' | 'saved' | 'error';
  readonly clubName: string;
  readonly seasonLabel: string;
  readonly phaseLabel: string;
  readonly objectiveLabel?: string;
  readonly transfersBadge?: number;
  /** V0.42 — courrier non lu, badgé sur l'onglet carrière. */
  readonly mailsBadge?: number;
  /** V0.18 — indicateurs permanents affichés dans le bandeau supérieur. */
  readonly hudStats?: readonly HudStat[];
  readonly children: ReactNode;
}

export function AppShell({
  active, onNavigate, onExitSeason, onSave, saveStatus, onOpenSettings, onOpenHelp,
  clubId, clubName, seasonLabel, phaseLabel, objectiveLabel,
  transfersBadge, mailsBadge, hudStats = [],
  children,
}: AppShellProps) {
  const items: readonly NavItem[] = [
    { key: 'dashboard', label: 'Accueil', icon: <IconChart size={16} /> },
    { key: 'squad', label: 'Effectif', icon: <IconUsers size={16} /> },
    { key: 'training', label: 'Entraînement', icon: <IconTarget size={16} /> },
    { key: 'standings', label: 'Compétition', icon: <IconCalendar size={16} /> },
    { key: 'transfers', label: 'Transferts', icon: <IconExchange size={16} />, ...(transfersBadge ? { badge: transfersBadge } : {}) },
    { key: 'news', label: 'Actus', icon: <IconMegaphone size={16} /> },
    { key: 'career', label: 'Ma carrière', icon: <IconWhistle size={16} />, ...(mailsBadge ? { badge: mailsBadge } : {}) },
    { key: 'finances', label: 'Finances', icon: <IconCoin size={16} /> },
    { key: 'direction', label: 'Direction', icon: <IconTrophy size={16} /> },
  ];

  return (
    <div className="shell" style={clubCssVars(clubId) as CSSProperties}>
      {/* ---- Bandeau d'identité + HUD ------------------------------------ */}
      <header className="hud-bar">
        <div className="hud-identity">
          <ClubCrest clubId={clubId} initials={clubName.slice(0, 3)} size={42} />
          <div className="hud-identity-text">
            <span className="hud-club">{clubName}</span>
            <span className="hud-season">
              {seasonLabel}
              <span className="hud-sep" />
              {phaseLabel}
            </span>
          </div>
        </div>

        <div className="hud-stats">
          {objectiveLabel && (
            <div className="hud-stat">
              <span className="hud-stat-label">Objectif</span>
              <span className="hud-stat-value">{objectiveLabel}</span>
            </div>
          )}
          {hudStats.map(stat => (
            <div key={stat.label} className={`hud-stat ${stat.warn ? 'warn' : ''}`}>
              <span className="hud-stat-label">{stat.label}</span>
              <span className={`hud-stat-value ${stat.highlight ? 'accent' : ''}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="hud-brand">
          <IconBall size={13} />
          <span>Le Quinze</span>
          <span className="hud-version" title={`Version ${__APP_VERSION__}`}>
            Alpha v{__APP_VERSION__}
          </span>
        </div>
      </header>

      {/* ---- Onglets ------------------------------------------------------ */}
      <nav className="hud-tabs" role="tablist">
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === active}
            className={`hud-tab ${item.key === active ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
            data-coachmark={`nav-${item.key}`}
          >
            <span className="hud-tab-icon">{item.icon}</span>
            <span className="hud-tab-label">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="hud-tab-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="shell-content">
        {children}
      </main>

      {/* ---- Barre d'actions ---------------------------------------------- */}
      <footer className="hud-actions">
        <div className="hud-actions-left">
          {onExitSeason && (
            <button type="button" className="hud-action ghost" onClick={onExitSeason}>
              <IconFlag size={13} />
              Quitter la carrière
            </button>
          )}
          {/* V0.62 — les réglages se prennent au pied de l'écran plutôt que dans
              la navigation : on y va rarement, et une dixième vignette aurait
              coûté de la place à ce qu'on ouvre tous les jours. */}
          {onOpenSettings && (
            <button type="button" className="hud-action ghost" onClick={onOpenSettings}>
              Réglages
            </button>
          )}
          {/* V0.62 — l'encyclopédie s'ouvre d'un clic depuis n'importe quel
              écran, sur le terme qu'on y rencontre. */}
          {onOpenHelp && (
            <button
              type="button"
              className="hud-action ghost"
              onClick={onOpenHelp}
              title="Encyclopédie : JIFF, salary cap, bonus, mercato…"
            >
              ? Aide
            </button>
          )}
        </div>
        <div className="hud-actions-right">
          {onSave && (
            <button
              type="button"
              className={`hud-action ${saveStatus === 'saved' ? 'done' : ''}`}
              onClick={onSave}
              disabled={saveStatus === 'saved'}
            >
              {saveStatus === 'saved' ? '✓ Sauvegardé'
                : saveStatus === 'error' ? '⚠ Erreur — réessayer'
                  : 'Sauvegarder'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export { IconBall };
