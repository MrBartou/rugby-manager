/**
 * Set d'icônes SVG — V0.10.
 *
 * Style : line icons, stroke 1.6, currentColor (héritent la couleur du contexte).
 * Tailles standard : 16 / 20 / 24 px via la prop `size`.
 */

interface IconProps {
  readonly size?: number;
  readonly className?: string;
}

const baseProps = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export const IconBall = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-30 12 12)" />
    <path d="M7 14l10-4M9 16l6-2M9 8l6 2" transform="rotate(-30 12 12)" />
  </svg>
);

export const IconWhistle = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M3 12c0-2.5 2-4.5 4.5-4.5h7L20 5v9c0 1.1-.9 2-2 2h-2.5L14 18l-3-2H7.5C5 16 3 14 3 12z" />
    <circle cx="7.5" cy="12" r="1.2" />
  </svg>
);

export const IconTrophy = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M8 4h8v6a4 4 0 01-8 0V4z" />
    <path d="M8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3" />
    <path d="M10 14h4M9 17h6M9 17v3h6v-3" />
  </svg>
);

export const IconMedical = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M12 4v16M4 12h16" strokeWidth="2" />
    <rect x="3" y="3" width="18" height="18" rx="3" />
  </svg>
);

export const IconCoin = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9h4.5a1.5 1.5 0 010 3H9m0 0h6m-6 0v3h4.5a1.5 1.5 0 010-3" />
  </svg>
);

export const IconUsers = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M16 19v-2a3 3 0 00-3-3H6a3 3 0 00-3 3v2" />
    <circle cx="9.5" cy="8" r="3" />
    <path d="M21 19v-2a3 3 0 00-2-2.83M16 4a3 3 0 010 5.5" />
  </svg>
);

export const IconStar = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19l1-5.8L3.5 9.2l5.9-.8L12 3z" />
  </svg>
);

export const IconShield = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6l8-3z" />
  </svg>
);

export const IconExchange = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M7 7h12l-3-3M17 17H5l3 3" />
  </svg>
);

export const IconFlag = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

export const IconCalendar = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);

export const IconChart = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M3 20V8M9 20v-7M15 20v-4M21 20V4" />
  </svg>
);

/** Cible — onglet Entraînement (V0.14). */
export const IconTarget = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

export const IconWarning = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 11v4M12 17v.5" strokeWidth="2" />
  </svg>
);

export const IconArrowRight = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconArrowLeft = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

/** Porte-voix — l'onglet actualités (V0.40). */
export const IconMegaphone = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} className={className}>
    <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z" />
    <path d="M17 8.5a4 4 0 0 1 0 7" />
    <path d="M7 15v4" />
  </svg>
);
