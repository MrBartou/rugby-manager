/**
 * Blason de club généré — V0.16.
 *
 * Aucun logo réel n'est reproduit : la forme est construite géométriquement à
 * partir des couleurs du club, de son motif de maillot et de ses initiales.
 * L'objectif n'est pas de ressembler au vrai blason, mais de donner à chaque club
 * une **signature visuelle immédiatement reconnaissable** à l'écran.
 */

import { clubIdentity } from '../theme/club-identity.js';

interface Props {
  readonly clubId: string;
  /** Initiales affichées (shortName du club, 2-3 lettres). */
  readonly initials: string;
  readonly size?: number;
  readonly className?: string;
}

/** Tracé du contour selon la forme héraldique. */
function outlinePath(shape: ReturnType<typeof clubIdentity>['crest']): string {
  switch (shape) {
    case 'ECU':
      // Écu français : épaules droites, pointe basse.
      return 'M8 6 H56 V38 Q56 52 32 60 Q8 52 8 38 Z';
    case 'BOUCLIER':
      // Bouclier arrondi.
      return 'M32 4 L58 14 V34 Q58 52 32 61 Q6 52 6 34 V14 Z';
    case 'LOSANGE':
      return 'M32 4 L59 32 L32 60 L5 32 Z';
    case 'ROND':
    default:
      return 'M32 4 A28 28 0 1 1 31.9 4 Z';
  }
}

export function ClubCrest({ clubId, initials, size = 40, className }: Props) {
  const id = clubIdentity(clubId);
  const clip = `crest-clip-${clubId}`;
  const path = outlinePath(id.crest);
  const label = initials.slice(0, 3).toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={`Blason ${label}`}
    >
      <defs>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
      </defs>

      {/* Fond aux couleurs du club */}
      <path d={path} fill={id.primary} />

      {/* Motif du maillot, découpé dans la forme */}
      <g clipPath={`url(#${clip})`} opacity={0.9}>
        {id.pattern === 'BANDES' && (
          <>
            <rect x="22" y="0" width="8" height="64" fill={id.secondary} opacity={0.85} />
            <rect x="34" y="0" width="8" height="64" fill={id.secondary} opacity={0.85} />
          </>
        )}
        {id.pattern === 'CERCEAUX' && (
          <>
            <rect x="0" y="16" width="64" height="7" fill={id.secondary} opacity={0.85} />
            <rect x="0" y="32" width="64" height="7" fill={id.secondary} opacity={0.85} />
            <rect x="0" y="48" width="64" height="7" fill={id.secondary} opacity={0.85} />
          </>
        )}
        {id.pattern === 'CHEVRON' && (
          <path d="M0 44 L32 20 L64 44 V64 H0 Z" fill={id.secondary} opacity={0.8} />
        )}
        {id.pattern === 'UNI' && (
          <path d="M0 46 L64 24 V64 H0 Z" fill={id.secondary} opacity={0.22} />
        )}
      </g>

      {/* Liseré */}
      <path d={path} fill="none" stroke={id.secondary} strokeWidth="2.5" opacity={0.95} />

      {/* Initiales */}
      <text
        x="32"
        y="36"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={id.onPrimary}
        style={{
          font: `700 ${label.length > 2 ? 17 : 21}px var(--font-display, sans-serif)`,
          letterSpacing: '0.02em',
          paintOrder: 'stroke',
        }}
        stroke={id.primary}
        strokeWidth="3"
      >
        {label}
      </text>
    </svg>
  );
}
