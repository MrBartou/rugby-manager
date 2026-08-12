/**
 * useDismiss — petit hook pour les animations de fermeture des modaux.
 *
 * Usage :
 *   const { closing, dismiss } = useDismiss();
 *   <div className={`modal-backdrop ${closing ? 'closing' : ''}`}>
 *     <button onClick={() => dismiss(() => onChoose(id))}>…</button>
 *
 * `dismiss(cb)` arme la classe `closing` (déclenche l'animation CSS), puis appelle
 * `cb` après ~220ms — c'est à ce moment que le parent peut faire l'unmount.
 *
 * ## Attention : une modale de file d'attente doit porter une `key`
 *
 * `closing` est un état de composant. Si le parent réutilise la même instance
 * pour présenter l'élément suivant d'une file — événement humain, décision de
 * contrat, moment de match — l'état reste armé et le garde ci-dessous avale
 * **tous** les clics suivants : la modale devient définitivement inerte et la
 * partie est bloquée. Chaque appelant passe donc `key={item.id}`, pour que le
 * changement d'élément remonte un composant neuf.
 */

import { useState } from 'react';

const DISMISS_MS = 220;

export function useDismiss(): {
  readonly closing: boolean;
  readonly dismiss: (cb: () => void) => void;
} {
  const [closing, setClosing] = useState(false);
  const dismiss = (cb: () => void): void => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      cb();
      // Le garde se relâche une fois l'action passée. S'il restait armé, une
      // modale que le parent garde montée — parce que l'action n'a rien résolu,
      // ou parce qu'un autre élément de la file prend la place — avalerait
      // **tous** les clics suivants et bloquerait la partie sans issue. Quand le
      // parent démonte, cette remise à zéro est simplement sans effet.
      setClosing(false);
    }, DISMISS_MS);
  };
  return { closing, dismiss };
}
