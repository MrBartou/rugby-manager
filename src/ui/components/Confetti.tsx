/**
 * Confetti — célébration SVG pour les grands moments (Brennus, essai, victoire).
 * Pas de lib externe, déterministe par seed.
 */

import { useMemo } from 'react';

interface Props {
  readonly seed?: string;
  readonly count?: number;
  readonly intensity?: 'light' | 'normal' | 'celebration';
}

const COLORS = ['#5bffdc', '#3eddbb', '#6ea8ff', '#ffc14a', '#4ade80'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Confetti({ seed = 'brennus', count, intensity = 'celebration' }: Props) {
  const pieces = useMemo(() => {
    const total = count ?? (intensity === 'celebration' ? 60 : intensity === 'normal' ? 30 : 15);
    const out: Array<{ x: number; y: number; size: number; rotate: number; delay: number; duration: number; color: string; shape: 'rect' | 'circle' }> = [];
    let h = hash(seed);
    const rand = (): number => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 0xffffffff;
    };
    for (let i = 0; i < total; i++) {
      out.push({
        x: rand() * 100,
        y: -5 - rand() * 20,
        size: 6 + rand() * 8,
        rotate: rand() * 360,
        delay: rand() * 1.5,
        duration: 3 + rand() * 2,
        color: COLORS[Math.floor(rand() * COLORS.length)]!,
        shape: rand() > 0.5 ? 'rect' : 'circle',
      });
    }
    return out;
  }, [seed, count, intensity]);

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size * (p.shape === 'rect' ? 0.5 : 1)}px`,
            background: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
