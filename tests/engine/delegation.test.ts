/**
 * Déléguer à son staff : V0.62.
 *
 * Le troisième pilier du GDD, « déléguer ce qu'on ne veut pas gérer », n'avait
 * jamais été implémenté : le staff se recrutait, pesait sur la progression,
 * parlait pendant les matchs, et ne décidait jamais rien.
 *
 * Ce qui est vérifié ici : rien n'est délégué par défaut, déléguer coûte
 * quelque chose, et déléguer ne peut jamais rendre meilleur que décider
 * soi-même.
 */

import { describe, expect, it } from 'vitest';
import {
  DELEGATION_OWNER,
  EARLIEST_SUBSTITUTION_MINUTE,
  adviseSubstitution,
  NO_DELEGATION,
  NO_STAFF_QUALITY,
  decideMinorOffer,
  delegateQuality,
  delegationPenalty,
  focusForPlayer,
  isDelegated,
  lineupMistakes,
  summarise,
  toggleDelegation,
} from '@/engine/club/delegation.js';
import type { StaffMember } from '@/engine/club/staff.js';
import type { ClubId, Player, PlayerId } from '@/engine/types.js';

const membre = (role: StaffMember['role'], quality: number): StaffMember => ({
  id: `s_${role}`,
  clubId: 'a',
  firstName: 'A',
  lastName: role,
  role,
  bias: 'NEUTRE',
  tagline: '',
  quality,
  salary: 100_000,
});

describe('rien n\'est délégué par défaut', () => {
  it('le manager décide de tout tant qu\'il n\'a rien dit', () => {
    expect(NO_DELEGATION.delegated).toEqual([]);
    expect(isDelegated(NO_DELEGATION, 'COMPOSITION')).toBe(false);
  });

  it('et chaque domaine se reprend d\'un clic', () => {
    const delegue = toggleDelegation(NO_DELEGATION, 'COMPOSITION');
    expect(isDelegated(delegue, 'COMPOSITION')).toBe(true);
    expect(isDelegated(toggleDelegation(delegue, 'COMPOSITION'), 'COMPOSITION')).toBe(false);
  });

  it('sans jamais dupliquer un domaine', () => {
    const deux = toggleDelegation(toggleDelegation(NO_DELEGATION, 'ENTRAINEMENT'), 'REMPLACEMENTS');
    expect(deux.delegated).toHaveLength(2);
  });
});

describe('la décision vaut ce que vaut celui qui la prend', () => {
  it('chaque domaine a son responsable', () => {
    const staff = [membre('ENTRAINEUR_CHEF', 82), membre('ENTRAINEUR_SKILLS', 61)];
    expect(delegateQuality(staff, 'COMPOSITION')).toBe(82);
    expect(delegateQuality(staff, 'ENTRAINEMENT')).toBe(61);
    expect(DELEGATION_OWNER.OFFRES_MINEURES).toBe('PRESIDENT');
  });

  it('un poste vacant ne vaut pas zéro', () => {
    // Un club a toujours quelqu'un pour aligner une équipe, même mal.
    expect(delegateQuality([], 'COMPOSITION')).toBe(NO_STAFF_QUALITY);
  });
});

describe('déléguer coûte quelque chose', () => {
  it('un adjoint excellent ne fait presque rien perdre', () => {
    expect(delegationPenalty(100)).toBe(1);
    expect(delegationPenalty(90)).toBeGreaterThan(0.98);
  });

  it('un adjoint dépassé fait perdre plus', () => {
    expect(delegationPenalty(40)).toBeLessThan(delegationPenalty(80));
  });

  it('mais déléguer ne rend jamais meilleur que décider soi-même', () => {
    // Sans quoi le jeu se jouerait tout seul, et il n'y aurait plus rien à faire.
    for (const q of [0, 45, 70, 100, 150]) {
      expect(delegationPenalty(q)).toBeLessThanOrEqual(1);
    }
  });

  it('et une compétence aberrante reste bornée', () => {
    expect(delegationPenalty(-50)).toBeGreaterThan(0);
    expect(delegationPenalty(500)).toBe(1);
  });
});

describe('ce qu\'on annonce avant de cocher', () => {
  it('le nom et le niveau de celui à qui l\'on confie', () => {
    // Déléguer à un incompétent doit être un choix, pas une découverte en fin
    // de saison.
    const staff = [membre('ENTRAINEUR_CHEF', 84)];
    const compo = summarise(NO_DELEGATION, staff).find(s => s.area === 'COMPOSITION')!;
    expect(compo.verdict).toContain('ENTRAINEUR_CHEF');
    expect(compo.verdict).toContain('de confiance');
    expect(compo.quality).toBe(84);
  });

  it('et le dit franchement quand le poste est vide', () => {
    const compo = summarise(NO_DELEGATION, []).find(s => s.area === 'COMPOSITION')!;
    expect(compo.verdict).toContain('Personne à ce poste');
  });

  it('les quatre domaines, dans l\'ordre où on les rencontre', () => {
    expect(summarise(NO_DELEGATION, []).map(s => s.area))
      .toEqual(['COMPOSITION', 'REMPLACEMENTS', 'ENTRAINEMENT', 'OFFRES_MINEURES']);
  });
});

describe('ce que l\'adjoint choisit à l\'entraînement', () => {
  const joueur = (over: Partial<Player> = {}): Player => {
    const n = 70;
    return {
      id: 'p' as PlayerId, clubId: 'a' as ClubId,
      firstName: 'T', lastName: 'P', birthDate: '1998-01-01',
      position: 'OUVREUR', secondaryPositions: [], isJiff: true,
      technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
      physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
      mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
      positionSpecific: {}, traits: [],
      hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
      dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
      contract: { startSeason: 2025, endSeason: 2028, annualSalary: 100_000 },
      ...over,
    };
  };

  it('un organisme fragile récupère, quel que soit son âge', () => {
    const fragile = joueur({
      physical: { vitesse: 70, puissance: 70, endurance: 70, detente: 70, robustesse: 30 },
    });
    expect(focusForPlayer(fragile, 2026)).toBe('RECUPERATION');
  });

  it('un vétéran entretient son physique', () => {
    expect(focusForPlayer(joueur({ birthDate: '1993-01-01' }), 2026)).toBe('PHYSIQUE');
  });

  it('un jeune travaille son poste', () => {
    expect(focusForPlayer(joueur({ birthDate: '2005-01-01' }), 2026)).toBe('POSTE');
  });

  it('et les autres travaillent leur point faible', () => {
    const faibleMental = joueur({
      mental: { decision: 40, leadership: 60, sangFroid: 40, agressivite: 60, professionnalisme: 60, discipline: 40 },
    });
    expect(focusForPlayer(faibleMental, 2026)).toBe('MENTAL');
  });
});

describe('ce que l\'adjoint fait d\'une offre reçue', () => {
  it('une offre sur un cadre remonte toujours au manager', () => {
    // Déléguer les petites décisions ne doit jamais faire partir un titulaire
    // dans votre dos.
    expect(decideMinorOffer({ isKeyPlayer: true, playRatio: 0.1, offerRatio: 3 }))
      .toBe('AU_MANAGER');
    expect(decideMinorOffer({ isKeyPlayer: false, playRatio: 0.8, offerRatio: 3 }))
      .toBe('AU_MANAGER');
  });

  it('il refuse ce qui brade un remplaçant', () => {
    expect(decideMinorOffer({ isKeyPlayer: false, playRatio: 0.1, offerRatio: 0.6 }))
      .toBe('REFUSER');
  });

  it('et accepte une offre correcte sur un joueur qui ne joue pas', () => {
    expect(decideMinorOffer({ isKeyPlayer: false, playRatio: 0.1, offerRatio: 1.2 }))
      .toBe('ACCEPTER');
  });
});

describe('le banc que l\'adjoint fait entrer', () => {
  const surLeTerrain = (fatigue: number, id = 'titulaire') => ({
    playerId: id as PlayerId, position: 'PILIER_GAUCHE' as const, fatigue,
  });
  const surLeBanc = (overall: number, id = 'remplacant') => ({
    playerId: id as PlayerId, fatigue: 0, covers: ['PILIER_GAUCHE' as const], overall,
  });

  const base = {
    minute: 60,
    onField: [surLeTerrain(85)],
    bench: [surLeBanc(70)],
    substitutionsUsed: 0,
    substitutionsAllowed: 8,
    quality: 70,
  };

  it('personne ne sort avant l\'heure de jeu', () => {
    // Le match se joue : vider son banc à la vingtième minute n'est pas une
    // délégation, c'est un sabotage.
    expect(adviseSubstitution({ ...base, minute: EARLIEST_SUBSTITUTION_MINUTE - 1 }))
      .toBeUndefined();
  });

  it('sort le joueur le plus cuit', () => {
    const conseil = adviseSubstitution({
      ...base,
      onField: [surLeTerrain(70, 'frais'), surLeTerrain(92, 'cuit')],
    });
    expect(conseil?.off).toBe('cuit');
  });

  it('et fait entrer le meilleur qui couvre le poste', () => {
    const conseil = adviseSubstitution({
      ...base,
      bench: [surLeBanc(58, 'faible'), surLeBanc(76, 'bon')],
    });
    expect(conseil?.on).toBe('bon');
  });

  it('un adjoint dépassé laisse ses joueurs s\'épuiser plus longtemps', () => {
    const fatigueMoyenne = { ...base, onField: [surLeTerrain(70)] };
    expect(adviseSubstitution({ ...fatigueMoyenne, quality: 90 })).toBeDefined();
    expect(adviseSubstitution({ ...fatigueMoyenne, quality: 20 })).toBeUndefined();
  });

  it('ne fait rien quand le quota est épuisé', () => {
    expect(adviseSubstitution({ ...base, substitutionsUsed: 8 })).toBeUndefined();
  });

  it('ni quand personne au banc ne couvre le poste', () => {
    expect(adviseSubstitution({
      ...base,
      bench: [{ playerId: 'ailier' as PlayerId, fatigue: 0, covers: ['AILIER_GAUCHE'], overall: 90 }],
    })).toBeUndefined();
  });

  it('et ne bouge pas tant que personne n\'est fatigué', () => {
    // Une délégation qui changerait quelque chose à chaque phase serait
    // insupportable à regarder.
    expect(adviseSubstitution({ ...base, onField: [surLeTerrain(20)] })).toBeUndefined();
  });
});

describe('la compo que rend l\'adjoint', () => {
  const rng = (suite: readonly number[]) => {
    let i = 0;
    return { nextInt: (): number => suite[i++ % suite.length]! };
  };

  it('un adjoint excellent ne se trompe pas', () => {
    expect(lineupMistakes(95, 15, 8, rng([0]))).toEqual([]);
  });

  it('un adjoint correct se trompe une fois', () => {
    expect(lineupMistakes(75, 15, 8, rng([3, 2]))).toHaveLength(1);
  });

  it('un adjoint dépassé se trompe plusieurs fois', () => {
    expect(lineupMistakes(40, 15, 8, rng([1, 0, 2, 1, 3, 2])).length).toBeGreaterThan(1);
  });

  it('et ne se trompe jamais deux fois sur le même joueur', () => {
    // Échanger deux fois le même titulaire le remettrait sur le terrain : une
    // erreur qui s'annule n'est pas une erreur.
    const swaps = lineupMistakes(40, 15, 8, rng([5, 1, 5, 2, 5, 3]));
    expect(new Set(swaps.map(s => s.starterIndex)).size).toBe(swaps.length);
  });

  it('sans banc, personne ne peut se tromper', () => {
    expect(lineupMistakes(20, 15, 0, rng([0]))).toEqual([]);
  });
});
