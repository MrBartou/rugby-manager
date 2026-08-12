import { getTraitDef } from '../../engine/human/traits.js';

interface Props {
  readonly traitId: string;
  readonly small?: boolean;
}

export function TraitChip({ traitId, small = false }: Props) {
  const def = getTraitDef(traitId);
  if (!def) return null;
  return (
    <span
      className={`trait-chip trait-${def.tone} ${small ? 'small' : ''}`}
      title={def.description}
    >
      {def.label}
    </span>
  );
}
