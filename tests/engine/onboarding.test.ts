/**
 * L'introduction — V0.49.
 *
 * Le tutoriel de la V0.12 promettait « le tour des écrans en 30 secondes » et
 * présentait quatre onglets, à un moment où le jeu en comptait quatre. Il en
 * compte neuf et porte une quinzaine de systèmes.
 *
 * La propriété qui remplace la visite guidée : **on n'explique une chose qu'au
 * moment où elle arrive**, une seule fois, et le plus souvent on ne dit rien.
 */

import { describe, expect, it } from 'vitest';
import {
  LESSON_ORDER,
  nextLesson,
  type LessonId,
  type OnboardingContext,
} from '../../src/engine/season/onboarding.js';

/** Une carrière installée, en pleine saison, sans rien de particulier. */
const CALME: OnboardingContext = {
  screen: 'dashboard',
  currentRound: 12,
  seasonsPlayed: 2,
  capUsage: 80,
  transferWindowOpen: false,
  pendingAnswers: 0,
  agendaCount: 0,
  openPromises: 0,
  transferRequests: 0,
  expectations: 0,
  seen: [],
};

const ctx = (over: Partial<OnboardingContext>): OnboardingContext =>
  ({ ...CALME, ...over });

/** Déroule les leçons d'un contexte figé jusqu'à épuisement. */
const drain = (base: OnboardingContext): readonly LessonId[] => {
  const out: LessonId[] = [];
  for (let i = 0; i < 30; i++) {
    const lesson = nextLesson({ ...base, seen: out });
    if (lesson === undefined) break;
    out.push(lesson.id);
  }
  return out;
};

describe('le silence est le cas normal', () => {
  it('ne dit rien à un manager installé dont rien ne cloche', () => {
    expect(nextLesson(CALME)).toBeUndefined();
  });

  it('ne dit rien pendant un match ni sur un écran sans enjeu', () => {
    expect(nextLesson(ctx({ screen: 'autre', currentRound: 1, seasonsPlayed: 0 })))
      .toBeUndefined();
  });

  it('ne répète jamais une leçon déjà lue', () => {
    const first = nextLesson(ctx({ screen: 'training' }));
    expect(first?.id).toBe('entrainement');
    expect(nextLesson(ctx({ screen: 'training', seen: ['entrainement'] })))
      .toBeUndefined();
  });
});

describe('l\'arrivée reste courte', () => {
  const arrivee = ctx({ currentRound: 1, seasonsPlayed: 0 });

  it('tient en trois cartes quand rien ne réclame l\'attention', () => {
    expect(drain(arrivee)).toEqual(['bienvenue', 'mission', 'semaine']);
  });

  it('commence par se présenter, et finit par la semaine à préparer', () => {
    const suite = drain(arrivee);
    expect(suite[0]).toBe('bienvenue');
    expect(suite[suite.length - 1]).toBe('semaine');
  });

  it('ajoute l\'agenda en fin de marche quand il a de quoi parler', () => {
    expect(drain({ ...arrivee, agendaCount: 3 }))
      .toEqual(['bienvenue', 'mission', 'semaine', 'agenda']);
  });

  it('n\'a jamais plus de quatre cartes, agenda compris', () => {
    expect(drain({ ...arrivee, agendaCount: 3 })).toHaveLength(4);
  });

  it('ne se rejoue pas au début de chaque saison', () => {
    // La journée 1 revient tous les ans ; la première carrière, non.
    expect(nextLesson(ctx({ currentRound: 1, seasonsPlayed: 1 }))).toBeUndefined();
  });
});

describe('chaque leçon attend son heure', () => {
  const cas: readonly { readonly id: LessonId; readonly over: Partial<OnboardingContext> }[] = [
    { id: 'depart', over: { transferRequests: 1 } },
    { id: 'reponse', over: { pendingAnswers: 1 } },
    { id: 'plafond', over: { capUsage: 101 } },
    { id: 'promesse', over: { openPromises: 1 } },
    { id: 'agenda', over: { agendaCount: 2 } },
    { id: 'mercato', over: { screen: 'transfers', transferWindowOpen: true } },
    { id: 'conversation', over: { screen: 'player' } },
    { id: 'entrainement', over: { screen: 'training' } },
    { id: 'direction', over: { screen: 'direction' } },
    { id: 'exigences', over: { screen: 'career', expectations: 2 } },
    { id: 'carriere', over: { screen: 'career' } },
  ];

  for (const { id, over } of cas) {
    it(`sort « ${id} » quand la situation se présente, et pas avant`, () => {
      expect(nextLesson(ctx(over))?.id).toBe(id);
      expect(nextLesson(CALME)?.id).not.toBe(id);
    });
  }

  it('n\'explique le mercato que la fenêtre ouverte', () => {
    expect(nextLesson(ctx({ screen: 'transfers', transferWindowOpen: false })))
      .toBeUndefined();
  });

  it('n\'explique le plafond que lorsqu\'il devient serré', () => {
    expect(nextLesson(ctx({ capUsage: 94 }))).toBeUndefined();
    expect(nextLesson(ctx({ capUsage: 95 }))?.id).toBe('plafond');
  });
});

describe('l\'ordre trie ce qui presse', () => {
  it('sert la demande de départ avant le courrier et le plafond', () => {
    const lesson = nextLesson(ctx({
      transferRequests: 1, pendingAnswers: 3, capUsage: 120, agendaCount: 4,
    }));
    expect(lesson?.id).toBe('depart');
  });

  it('sert une décision à prendre avant une explication de confort', () => {
    const lesson = nextLesson(ctx({ screen: 'career', pendingAnswers: 1, expectations: 2 }));
    expect(lesson?.id).toBe('reponse');
  });

  it('n\'affiche qu\'une leçon à la fois, même quand tout arrive ensemble', () => {
    const lesson = nextLesson(ctx({
      screen: 'transfers', transferWindowOpen: true, capUsage: 130,
      pendingAnswers: 2, transferRequests: 1,
    }));
    expect(lesson).toBeDefined();
    expect(typeof lesson?.id).toBe('string');
  });
});

describe('le contenu tient debout', () => {
  it('ne propose aucune leçon en double', () => {
    expect(new Set(LESSON_ORDER).size).toBe(LESSON_ORDER.length);
  });

  it('donne à chaque leçon un titre et un corps dignes de ce nom', () => {
    const seen: LessonId[] = [];
    const everything = ctx({
      currentRound: 1, seasonsPlayed: 0, screen: 'dashboard',
      capUsage: 130, transferWindowOpen: true, pendingAnswers: 2,
      agendaCount: 4, openPromises: 1, transferRequests: 1, expectations: 2,
    });
    for (const screen of ['dashboard', 'transfers', 'player', 'training', 'direction', 'career'] as const) {
      for (let i = 0; i < 20; i++) {
        const lesson = nextLesson({ ...everything, screen, seen });
        if (lesson === undefined) break;
        expect(lesson.title.length).toBeGreaterThan(8);
        expect(lesson.body.length).toBeGreaterThan(60);
        seen.push(lesson.id);
      }
    }
    // En promenant le manager sur tous les écrans, on finit par tout voir.
    expect(seen).toHaveLength(LESSON_ORDER.length);
  });
});
