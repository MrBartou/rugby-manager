/**
 * Le comparateur : V0.61.
 *
 * Choisir entre deux joueurs se faisait en ouvrant une fiche, en la fermant, en
 * ouvrant l'autre, et en se fiant à sa mémoire. C'est exactement la décision
 * qu'un manager prend le plus souvent, et c'était la moins outillée du jeu.
 *
 * ## Ce qui est comparé, et à quelle condition
 *
 * Les attributs passent par l'estimation du scout, comme sur la fiche. Un
 * joueur mal connu affiche une fourchette, et **une fourchette ne se compare
 * pas** : on ne désigne un meilleur que lorsque les deux estimations ne se
 * chevauchent pas. Trancher entre « 68–81 » et « 72–85 » serait inventer une
 * précision que le scouting n'a pas rapportée, et le jeu ment déjà bien assez
 * peu pour ne pas commencer ici.
 */

import { Fragment } from 'react';
import type { Player, PlayerId } from '../../engine/types.js';
import type { SeasonPlayerStat } from '../../engine/game/season-session.js';
import { averageRating } from '../../engine/game/season-session.js';
import { estimateAttribute, estimatePotential, type Estimate } from '../../engine/club/scouting.js';
import { positionLabel } from './DataBits.js';

export interface CompareEntry {
  readonly player: Player;
  /** Connaissance du joueur, de 0 à 100. */
  readonly familiarity: number;
  readonly stat: SeasonPlayerStat | undefined;
}

interface Props {
  readonly entries: readonly CompareEntry[];
  readonly currentSeason: number;
  readonly onRemove: (playerId: PlayerId) => void;
  readonly onClose: () => void;
}

/** Les attributs mis face à face, par famille. */
const FAMILLES: readonly {
  readonly titre: string;
  readonly lignes: readonly { readonly label: string; readonly lire: (p: Player) => number; readonly cle: string }[];
}[] = [
  {
    titre: 'Technique',
    lignes: [
      { label: 'Passe', cle: 'passe', lire: p => p.technical.passe },
      { label: 'Plaquage', cle: 'plaquage', lire: p => p.technical.plaquage },
      { label: 'Vision de jeu', cle: 'visionDeJeu', lire: p => p.technical.visionDeJeu },
      { label: 'Conservation', cle: 'conservation', lire: p => p.technical.conservation },
      { label: 'Déblayage', cle: 'deblayage', lire: p => p.technical.deblayage },
      { label: 'Jeu au pied', cle: 'jeuAuPiedPlace', lire: p => p.technical.jeuAuPiedPlace },
    ],
  },
  {
    titre: 'Physique',
    lignes: [
      { label: 'Vitesse', cle: 'vitesse', lire: p => p.physical.vitesse },
      { label: 'Puissance', cle: 'puissance', lire: p => p.physical.puissance },
      { label: 'Endurance', cle: 'endurance', lire: p => p.physical.endurance },
      { label: 'Robustesse', cle: 'robustesse', lire: p => p.physical.robustesse },
    ],
  },
  {
    titre: 'Mental',
    lignes: [
      { label: 'Décision', cle: 'decision', lire: p => p.mental.decision },
      { label: 'Leadership', cle: 'leadership', lire: p => p.mental.leadership },
      { label: 'Sang-froid', cle: 'sangFroid', lire: p => p.mental.sangFroid },
      { label: 'Discipline', cle: 'discipline', lire: p => p.mental.discipline },
    ],
  },
];

/**
 * Qui l'emporte sur une ligne, quand quelqu'un l'emporte.
 *
 * Une fourchette qui en chevauche une autre ne départage personne : le scout
 * n'en sait pas assez, et le dire vaut mieux que trancher au hasard.
 */
function meilleur(estimations: readonly Estimate[]): number | undefined {
  let gagnant = -1;
  let meilleurMin = -1;
  for (let i = 0; i < estimations.length; i++) {
    const e = estimations[i]!;
    if (e.certainty === 'INCONNU') return undefined;
    if (e.min > meilleurMin) {
      meilleurMin = e.min;
      gagnant = i;
    }
  }
  if (gagnant < 0) return undefined;
  // Le gagnant doit dominer tous les autres sans chevauchement.
  const sien = estimations[gagnant]!;
  const domine = estimations.every((e, i) => i === gagnant || e.max < sien.min);
  return domine ? gagnant : undefined;
}

const ageOf = (p: Player, saison: number): number => saison - Number(p.birthDate.slice(0, 4));

const euros = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M€` : `${Math.round(n / 1000)} k€`;

export function PlayerCompare({ entries, currentSeason, onRemove, onClose }: Props) {
  if (entries.length < 2) return null;

  const estimations = (cle: string, lire: (p: Player) => number): readonly Estimate[] =>
    entries.map(e => estimateAttribute(lire(e.player), e.familiarity, `${e.player.id}_${cle}`));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal compare" onClick={e => e.stopPropagation()}>
        <div className="panel-tag">Comparer</div>

        <div className="compare-grid" style={{ gridTemplateColumns: `10rem repeat(${entries.length}, 1fr)` }}>
          <div className="compare-corner" />
          {entries.map(({ player, familiarity }) => (
            <div key={player.id as string} className="compare-head">
              <button
                type="button"
                className="compare-remove"
                onClick={() => onRemove(player.id)}
                title="Retirer de la comparaison"
              >
                ×
              </button>
              <div className="compare-name">{player.firstName} {player.lastName}</div>
              <div className="compare-sub">
                {positionLabel(player.position)} · {ageOf(player, currentSeason)} ans
              </div>
              <div className="compare-sub dim">
                Potentiel {estimatePotential(player, familiarity, currentSeason).display}
              </div>
            </div>
          ))}

          <div className="compare-family">Saison</div>
          {entries.map(({ player }) => <div key={`f_${player.id as string}`} className="compare-family" />)}

          {([
            ['Note', (e: CompareEntry) => averageRating(e.stat)?.toFixed(1) ?? '—'],
            ['Matchs', (e: CompareEntry) => e.stat?.matches ?? 0],
            ['Minutes', (e: CompareEntry) => e.stat?.minutes ?? 0],
            ['Essais', (e: CompareEntry) => e.stat?.tries ?? 0],
            ['Salaire', (e: CompareEntry) => euros(e.player.contract.annualSalary)],
            ['Fin de contrat', (e: CompareEntry) => e.player.contract.endSeason],
          ] as const).map(([label, lire]) => (
            <Ligne key={label} label={label} entries={entries} rendu={lire} />
          ))}

          {FAMILLES.map(famille => (
            <FamilleBloc
              key={famille.titre}
              famille={famille}
              entries={entries}
              estimations={estimations}
            />
          ))}
        </div>

        <p className="compare-note">
          Une fourchette qui en chevauche une autre ne départage personne : le
          scout n'en sait pas encore assez pour trancher.
        </p>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function Ligne({
  label, entries, rendu,
}: {
  readonly label: string;
  readonly entries: readonly CompareEntry[];
  readonly rendu: (e: CompareEntry) => string | number;
}) {
  return (
    <>
      <div className="compare-label">{label}</div>
      {entries.map(e => (
        <div key={`${label}_${e.player.id as string}`} className="compare-cell">{rendu(e)}</div>
      ))}
    </>
  );
}

function FamilleBloc({
  famille, entries, estimations,
}: {
  readonly famille: (typeof FAMILLES)[number];
  readonly entries: readonly CompareEntry[];
  readonly estimations: (cle: string, lire: (p: Player) => number) => readonly Estimate[];
}) {
  return (
    <>
      <div className="compare-family">{famille.titre}</div>
      {entries.map(e => (
        <div key={`fam_${famille.titre}_${e.player.id as string}`} className="compare-family" />
      ))}
      {famille.lignes.map(ligne => {
        const est = estimations(ligne.cle, ligne.lire);
        const gagnant = meilleur(est);
        return (
          <Fragment key={ligne.cle}>
            <div className="compare-label">{ligne.label}</div>
            {est.map((e, i) => (
              <div
                key={`${ligne.cle}_${entries[i]!.player.id as string}`}
                className={`compare-cell ${gagnant === i ? 'best' : ''}`}
              >
                {e.display}
              </div>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
