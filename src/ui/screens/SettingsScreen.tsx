/**
 * L'écran de réglages : V0.62.
 *
 * Le jeu n'en avait aucun. La vitesse du match se rechoisissait à chaque
 * rencontre, les trente-deux animations tournaient pour tout le monde, et un
 * joueur qui distingue mal le rouge du vert n'avait aucun recours devant les
 * liserés d'aptitude de la composition, ce qui concerne environ un homme sur
 * douze.
 *
 * ## Ce que chaque réglage promet
 *
 * Rien n'est décoratif ici. Chaque ligne dit ce qu'elle change et, quand la
 * réponse n'est pas évidente, ce qu'elle ne change pas : couper la sauvegarde
 * automatique n'efface aucune partie, et le volume n'a pas encore d'effet
 * puisque le son arrive en V0.69. L'annoncer vaut mieux que laisser croire à un
 * réglage mort.
 */

import type { Settings, MatchSpeed, TextScale } from '../settings.js';
import { systemPrefersReducedMotion } from '../settings.js';
import { Interrupteur } from '../components/Interrupteur.js';

interface Props {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
  readonly onBack: () => void;
}

const SPEEDS: readonly { readonly value: MatchSpeed; readonly label: string }[] = [
  { value: 'x0.5', label: '×0,5' },
  { value: 'x1', label: '×1' },
  { value: 'x2', label: '×2' },
  { value: 'x4', label: '×4' },
  { value: 'x16', label: '×16' },
];

const SCALES: readonly { readonly value: TextScale; readonly label: string }[] = [
  { value: 'PETIT', label: 'Petit' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'GRAND', label: 'Grand' },
  { value: 'TRES_GRAND', label: 'Très grand' },
];

export function SettingsScreen({ settings, onChange, onBack }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void =>
    onChange({ ...settings, [key]: value });

  const systemeReduit = systemPrefersReducedMotion();

  return (
    <section className="settings-screen">
      <div className="screen-head">
        <h2>Réglages</h2>
        <button onClick={onBack} type="button" className="ghost">← Retour</button>
      </div>

      <p className="settings-intro">
        Ces réglages suivent le joueur, pas la partie : ils valent pour toutes
        vos carrières et ne voyagent pas avec un fichier de sauvegarde.
      </p>

      <div className="settings-group">
        <div className="settings-group-head">
          <div className="panel-tag">Match</div>
          <span className="settings-group-note">Ce qui se passe pendant une rencontre</span>
        </div>

        <div className="setting">
          <div className="setting-label">
            <span>Vitesse par défaut</span>
            <span className="setting-hint">
              Appliquée à chaque rencontre. Reste modifiable en cours de match.
            </span>
          </div>
          <div className="segmented">
            {SPEEDS.map(s => (
              <button
                key={s.value}
                type="button"
                className={settings.matchSpeed === s.value ? 'active' : ''}
                onClick={() => set('matchSpeed', s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-head">
          <div className="panel-tag">Partie</div>
          <span className="settings-group-note">Sauvegarde et garde-fous</span>
        </div>

        <label className="setting">
          <div className="setting-label">
            <span>Sauvegarde automatique</span>
            <span className="setting-hint">
              À chaque journée. La couper n'efface aucune partie : elle cesse
              simplement de les mettre à jour toute seule.
            </span>
          </div>
          <Interrupteur
            checked={settings.autosave}
            onChange={v => set('autosave', v)}
            label="Sauvegarde automatique"
          />
        </label>

        <label className="setting">
          <div className="setting-label">
            <span>Demander confirmation</span>
            <span className="setting-hint">
              Avant les gestes qu'on ne peut pas défaire : quitter une carrière,
              supprimer une sauvegarde.
            </span>
          </div>
          <Interrupteur
            checked={settings.confirmations}
            onChange={v => set('confirmations', v)}
            label="Demander confirmation"
          />
        </label>
      </div>

      <div className="settings-group">
        <div className="settings-group-head">
          <div className="panel-tag">Accessibilité</div>
          <span className="settings-group-note">Confort de lecture et de mouvement</span>
        </div>

        <label className="setting">
          <div className="setting-label">
            <span>Animations réduites</span>
            <span className="setting-hint">
              {systemeReduit
                ? 'Votre système le demande déjà : les animations sont réduites quoi qu\'il arrive.'
                : 'Coupe les transitions et les confettis. Le jeu reste identique, il bouge moins.'}
            </span>
          </div>
          <Interrupteur
            checked={settings.reducedMotion || systemeReduit}
            disabled={systemeReduit}
            onChange={v => set('reducedMotion', v)}
            label="Animations réduites"
          />
        </label>

        <div className="setting">
          <div className="setting-label">
            <span>Taille du texte</span>
            <span className="setting-hint">Agrandit toute l'interface, pas seulement les libellés.</span>
          </div>
          <div className="segmented">
            {SCALES.map(s => (
              <button
                key={s.value}
                type="button"
                className={settings.textScale === s.value ? 'active' : ''}
                onClick={() => set('textScale', s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-label">
            <span>Palette des indicateurs</span>
            <span className="setting-hint">
              Le mode daltonien remplace le rouge et le vert par du bleu et de
              l'orange partout où une couleur porte une information.
            </span>
          </div>
          <div className="segmented">
            {([['STANDARD', 'Standard'], ['DALTONIEN', 'Daltonien']] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={settings.palette === v ? 'active' : ''}
                onClick={() => set('palette', v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-label">
            <span>Thème</span>
            <span className="setting-hint">Le thème clair convient mieux à un écran très lumineux.</span>
          </div>
          <div className="segmented">
            {([['SOMBRE', 'Sombre'], ['CLAIR', 'Clair']] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={settings.colourMode === v ? 'active' : ''}
                onClick={() => set('colourMode', v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* L'aperçu vaut mieux qu'une description : on voit immédiatement si la
            palette choisie se lit, et c'est le seul moyen de vérifier soi-même
            que les trois états se distinguent. */}
        <div className="palette-preview">
          <span className="pp-item good">Excellent</span>
          <span className="pp-item mid">Correct</span>
          <span className="pp-item bad">Insuffisant</span>
          <p className="pp-caption">
            Ces trois pastilles emploient les couleurs que le jeu utilise partout
            où un indicateur juge quelque chose. Si vous les distinguez ici, vous
            les distinguerez sur le terrain.
          </p>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-head">
          <div className="panel-tag">Son</div>
          <span className="settings-group-note">Prévu pour la V0.69</span>
        </div>
        <div className="setting">
          <div className="setting-label">
            <span>Volume général</span>
            <span className="setting-hint">
              Sans effet pour l'instant : le son arrive en V0.69. Le réglage est
              conservé d'ici là.
            </span>
          </div>
          <span className="setting-range">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={e => set('volume', Number(e.target.value))}
              aria-label="Volume général"
            />
            <span className="setting-value">{settings.volume} %</span>
          </span>
        </div>
      </div>
    </section>
  );
}
