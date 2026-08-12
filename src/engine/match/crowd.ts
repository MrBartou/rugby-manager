/**
 * Le public — V0.58.
 *
 * `homeFans` est déclaré sur chaque feuille de match depuis la V0.1 et **lu
 * nulle part** : huitième champ mort du projet, après le brassard, l'élan, la
 * météo, le carton, les modificateurs de moral et les deux attributs cachés.
 *
 * L'affluence, elle, était bien calculée depuis la V0.45 — remplissage du
 * stade selon la forme, le tarif et le marketing — mais son effet sur la
 * rencontre était replié dans un `tacticalBonus` bricolé côté interface. Deux
 * problèmes en un : le moteur ignorait le public, et l'interface calculait un
 * effet de jeu, ce qui n'est pas son travail.
 *
 * Ce module met les deux bouts ensemble. Le remplissage devient un niveau de
 * public, le niveau de public entre dans la feuille de match, et le moteur en
 * tire l'avantage du terrain.
 *
 * ## Le point neutre
 *
 * `MOYEN` ne change rien, exactement. C'est la valeur que porte la fixture du
 * harnais de calibration depuis toujours : la calibration reste donc valide par
 * construction, sans qu'on ait à la rejouer pour la conserver. Même procédé que
 * pour la météo (V0.51) et l'arbitre (V0.52).
 */

/** Niveaux de public, tels que la feuille de match les porte depuis la V0.1. */
export type CrowdLevel = 'PEU' | 'MOYEN' | 'BEAUCOUP';

export const CROWD_LABEL: Readonly<Record<CrowdLevel, string>> = {
  PEU: 'Stade clairsemé',
  MOYEN: 'Affluence correcte',
  BEAUCOUP: 'Stade plein',
};

/**
 * Multiplicateur appliqué à l'avantage du terrain.
 *
 * Un stade plein ne transforme pas une équipe, il la porte : on ne va pas
 * au-delà de la moitié en plus. À l'inverse, jouer devant des tribunes vides
 * retire l'essentiel de ce que « recevoir » veut dire — c'est le vrai coût
 * d'une politique tarifaire trop gourmande ou d'une saison ratée.
 */
export function crowdFactor(level: CrowdLevel): number {
  switch (level) {
    case 'PEU': return 0.55;
    case 'MOYEN': return 1;
    case 'BEAUCOUP': return 1.45;
  }
}

/**
 * Le niveau de public correspondant à un taux de remplissage.
 *
 * Les seuils sont ceux qu'on lit dans une enceinte : en dessous des deux tiers
 * ça sonne creux, au-dessus de neuf sur dix c'est plein.
 */
export function crowdFromFillRate(fillRate: number): CrowdLevel {
  if (fillRate < 0.66) return 'PEU';
  if (fillRate >= 0.9) return 'BEAUCOUP';
  return 'MOYEN';
}

/**
 * Ce que le staff en dit avant le coup d'envoi.
 *
 * Qualifie sans chiffrer l'effet, comme partout : le manager doit savoir que
 * son stade va peser ou non, pas lire un coefficient.
 */
export function crowdHint(level: CrowdLevel, attendance: number, capacity: number): string {
  const pct = capacity > 0 ? Math.round((attendance / capacity) * 100) : 0;
  const chiffres = `${attendance.toLocaleString('fr-FR')} / ${capacity.toLocaleString('fr-FR')} · ${pct} %`;
  switch (level) {
    case 'BEAUCOUP':
      return `${chiffres} — le stade poussera derrière vous.`;
    case 'PEU':
      return `${chiffres} — des tribunes clairsemées : recevoir ne vaudra pas grand-chose.`;
    case 'MOYEN':
      return `${chiffres} — une affluence ordinaire.`;
  }
}
