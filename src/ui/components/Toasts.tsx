/**
 * Notifications d'action — V0.21.
 *
 * Aucune action ne produisait de retour : sauvegarder, changer un entraînement,
 * mettre un joueur sous observation ou signer un agent libre se faisaient dans un
 * silence complet. Le joueur ne savait pas si son geste avait été pris en compte.
 *
 * Ce module fournit un accusé de réception discret, en bas à droite, qui
 * disparaît seul. Il ne bloque jamais l'interface.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastKind = 'info' | 'success' | 'warn';

interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
}

interface ToastApi {
  /** Affiche un accusé de réception. */
  readonly notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi>({ notify: () => {} });

/** Hook d'accès. Sûr hors provider : il ne fait alors rien. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DURATION_MS = 3200;

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts(list => {
      // Plafond : au-delà de trois, on empile sans fin en cas d'action répétée.
      const next = [...list, { id, kind, message }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    const timer = window.setTimeout(() => {
      setToasts(list => list.filter(t => t.id !== id));
    }, DURATION_MS);
    timers.current.push(timer);
  }, []);

  // Nettoyage : sans ça, un démontage en cours de route laisse des timers actifs.
  useEffect(() => () => {
    for (const t of timers.current) window.clearTimeout(t);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="toast-mark" aria-hidden="true">
              {t.kind === 'success' ? '✓' : t.kind === 'warn' ? '!' : '•'}
            </span>
            <span className="toast-text">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
