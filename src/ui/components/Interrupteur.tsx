/**
 * L'interrupteur : V0.62.1.
 *
 * Dessiné pour l'écran de réglages, puis réclamé par l'entraînement, où la
 * colonne « Repos » exposait encore une case à cocher native au milieu de
 * contrôles redessinés. Deux exemplaires du même contrôle auraient divergé à la
 * première retouche : c'est exactement la variante du défaut maison, deux
 * sources de vérité pour une même chose.
 *
 * L'`input` reste sous le rail dessiné. Il porte le clavier, le libellé pour
 * les lecteurs d'écran et l'état coché : redessiner un contrôle ne doit jamais
 * revenir à en construire un qui n'obéit qu'à la souris.
 */

interface Props {
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
  /** Libellé lu par les lecteurs d'écran : le rail dessiné ne dit rien. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly title?: string;
}

export function Interrupteur({ checked, onChange, label, disabled, title }: Props) {
  return (
    <span className="switch" title={title ?? ''}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled ?? false}
        aria-label={label}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="switch-rail" aria-hidden />
    </span>
  );
}
