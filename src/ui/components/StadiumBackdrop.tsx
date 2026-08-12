/**
 * Décor de stade procédural — V0.20.
 *
 * Le jeu n'avait **aucune imagerie** : que des formes et du texte sur du noir.
 * C'est ce qui l'empêchait le plus de respirer le jeu vidéo, là où FIFA ou EA FC
 * posent des rendus de stade et de joueurs derrière chaque écran clé.
 *
 * On ne peut pas embarquer de photographies (droits, poids), alors on dessine :
 * tribunes en gradins, pylônes d'éclairage, foule pointilliste, halo de
 * projecteurs. Le tout en SVG, teinté par les couleurs du club, donc léger,
 * net à toutes les résolutions et cohérent avec l'identité en place.
 *
 * Le décor est **déterministe** : la foule d'un club donné est toujours la même,
 * pour éviter le scintillement d'un rendu à l'autre.
 */

import { useMemo } from 'react';

interface Props {
  /** Sert de graine : le même club produit toujours le même stade. */
  readonly seed: string;
  /** Couleur des projecteurs et du halo. */
  readonly accent: string;
  /** Intensité globale, 0 à 1. Baisse-la quand du contenu passe par-dessus. */
  readonly intensity?: number;
  readonly className?: string;
}

/** Générateur pseudo-aléatoire déterministe (xorshift 32 bits). */
function makeRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0xffffffff;
  };
}

interface Spectator {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly o: number;
}

export function StadiumBackdrop({ seed, accent, intensity = 1, className }: Props) {
  /**
   * La foule : quelques centaines de points répartis dans les gradins, avec une
   * densité qui décroît vers le haut (les rangs du fond se perdent dans l'ombre).
   */
  const crowd = useMemo<readonly Spectator[]>(() => {
    const rand = makeRandom(seed);
    const out: Spectator[] = [];
    for (let i = 0; i < 420; i++) {
      const x = rand() * 1200;
      // Concentration dans la bande de tribunes (y entre 40 et 210).
      const t = rand();
      const y = 40 + t * t * 175;
      out.push({
        x,
        y,
        r: 1.1 + rand() * 1.5,
        // Plus on est haut, plus on est sombre.
        o: 0.12 + (y / 215) * 0.5 * rand(),
      });
    }
    return out;
  }, [seed]);

  const uid = `stadium-${seed.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg
      className={className}
      viewBox="0 0 1200 340"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ opacity: intensity }}
    >
      <defs>
        {/* Halo des projecteurs, teinté par le club. */}
        <radialGradient id={`${uid}-flood`} cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.30" />
          <stop offset="45%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>

        {/* Profondeur des tribunes : sombre en haut, éclairé en bas. */}
        <linearGradient id={`${uid}-stand`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05070b" />
          <stop offset="70%" stopColor="#0d131c" />
          <stop offset="100%" stopColor="#141c28" />
        </linearGradient>

        {/* Pelouse en contrebas, éclairée par les projecteurs. */}
        <linearGradient id={`${uid}-turf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c3a24" />
          <stop offset="100%" stopColor="#0a1610" />
        </linearGradient>

        {/* Fondu du bas : le décor se dissout dans l'interface. */}
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="72%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.96" />
        </linearGradient>
      </defs>

      {/* Ciel nocturne */}
      <rect width="1200" height="340" fill="#04060a" />

      {/* Halo général des projecteurs */}
      <rect width="1200" height="340" fill={`url(#${uid}-flood)`} />

      {/* Tribunes en gradins — trois niveaux décalés donnent la profondeur. */}
      <path d="M0 210 L0 96 L200 74 L420 62 L780 62 L1000 74 L1200 96 L1200 210 Z" fill={`url(#${uid}-stand)`} />
      <path d="M0 210 L0 134 L240 116 L960 116 L1200 134 L1200 210 Z" fill="#0a1018" opacity="0.85" />
      <path d="M0 212 L0 168 L300 156 L900 156 L1200 168 L1200 212 Z" fill="#0e1622" opacity="0.9" />

      {/* Foule */}
      <g>
        {crowd.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 9 === 0 ? accent : '#8d97ab'} opacity={s.o} />
        ))}
      </g>

      {/* Pylônes d'éclairage */}
      {[168, 1032].map(x => (
        <g key={x}>
          <rect x={x - 2} y="18" width="4" height="86" fill="#141a24" />
          <rect x={x - 34} y="8" width="68" height="18" rx="2" fill="#1b2330" />
          {[-24, -8, 8, 24].map(dx => (
            <circle key={dx} cx={x + dx} cy="17" r="4.5" fill={accent} opacity="0.9" />
          ))}
          {/* Cône de lumière */}
          <path
            d={`M${x} 26 L${x - 190} 300 L${x + 190} 300 Z`}
            fill={accent}
            opacity="0.05"
          />
        </g>
      ))}

      {/* Ligne de touche et pelouse */}
      <rect x="0" y="212" width="1200" height="128" fill={`url(#${uid}-turf)`} />
      <rect x="0" y="212" width="1200" height="2" fill="#ffffff" opacity="0.18" />

      {/* Rayures de tonte */}
      <g opacity="0.05">
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={i * 88} y="214" width="44" height="126" fill="#ffffff" />
        ))}
      </g>

      {/* Fondu vers l'interface */}
      <rect width="1200" height="340" fill={`url(#${uid}-fade)`} />
    </svg>
  );
}
