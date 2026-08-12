/**
 * Le filet sous le rendu : v0.60.
 *
 * Sans lui, la moindre exception dans un composant démontait l'arbre React
 * entier : page blanche définitive, aucun message, et surtout aucun moyen de
 * sauvegarder la saison en cours. Un défaut d'affichage coûtait la carrière.
 *
 * Ce qui est offert ici est volontairement modeste : dire que c'est cassé, dire
 * quoi, et proposer de recharger. La sauvegarde automatique s'exécutant à
 * chaque journée, ce qui est perdu ne dépasse jamais la journée entamée.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // La console est la seule trace disponible, et la pile de composants est ce
    // qui permet de retrouver l'écran fautif depuis une capture d'écran.
    console.error('Rendu interrompu', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-screen">
        <div className="crash-card">
          <div className="panel-tag">Interruption</div>
          <h2>L'affichage s'est arrêté</h2>
          <p>
            Un écran n'a pas pu se dessiner. Votre partie est sauvegardée à
            chaque journée : recharger vous ramène au plus tard au début de
            celle que vous veniez d'entamer.
          </p>
          <pre className="crash-detail">{error.message}</pre>
          <div className="modal-actions">
            <button
              type="button"
              className="primary"
              onClick={() => window.location.reload()}
            >
              Recharger le jeu
            </button>
          </div>
        </div>
      </div>
    );
  }
}
