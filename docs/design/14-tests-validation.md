# 14. Tests et validation

> Statut : ✅ Tests unitaires + simulation tests en place (71/71 verts en V0.5).

## 📋 État V0.5

- ✅ **Unit tests** Vitest : 71 tests, 8 fichiers
  - `scrum.test.ts`, `scrum-dominance.test.ts`, `simulation.test.ts`
  - `season.test.ts`, `season-flow.test.ts` (régression demi → finale)
  - `human.test.ts`, `relationships.test.ts`, `threads.test.ts`
- ✅ **Simulation tests** : 200 matchs simulés à chaque run de tests, distributions vérifiées
- ✅ **Calibration** : `npm run calibrate` lance 1000 matchs vs cibles V1
- ⬜ **Property-based testing** (fast-check) — V0.6
- ⬜ **CI Github Actions** : 10k matchs à chaque PR — V0.6
- ⬜ **E2E UI tests** Playwright — V0.7 (après wireframes finalisés)
- ⬜ **Bêta privée** (5-10 testeurs) — V0.9

### Calibration actuelle (1000 matchs équilibrés 60v60)

| Métrique | Cible V1 | V0.5 actuel |
|---|---|---|
| Essais / match | 4-6 | 4.77 ✓ |
| Phases / match | 70-80 | 73.0 ✓ |
| % tirs au but | 60-70% | 64% ✓ |
| % nuls | <8% | 3% ✓ |
| Possession équilibrée | 45-55% | 46% ✓ |
| Victoires écart 30 (équipe forte) | 65-78% | 71% ✓ |

---

## A. Critères provisoires "ready to ship v1"

> ⚠️ Décision : critères figés post-bêta. Mais une boussole provisoire est définie pour ne pas dériver.

### Les 7 critères

| # | Critère | Cible | Mesure |
|---|---------|-------|--------|
| 1 | MVP fonctionnel | 1 saison jouable bout en bout sans crash bloquant | Bêta privée complète sans abandon technique |
| 2 | Validation game design | ≥3 testeurs jouent 1 saison entière + reviennent | Sondage post-bêta |
| 3 | Test "1h de plus" | ≥70% des testeurs répondent par phrase concrète (match ou joueur) | Sondage post-session |
| 4 | Stabilité | 0 bug critique sur les 7 derniers jours bêta | Tracker bug |
| 5 | Performance | 1 saison auto-sim < 2 min sur i5/16Go | Benchmark CI |
| 6 | Coverage moteur | ≥80% sur `engine/*` | Vitest |
| 7 | Calibrage moteur | 4-6 essais/match, 60-70% pénalités sur 10k matchs simulés | CI simulation |

### Règle d'engagement

> Si **6/7 critères OK** + bêta privée positive sur l'engagement → on ship. On ne court pas après le 7ème.

---

## B. Tests automatisés (pyramide complète)

### Unit tests — `engine/*`
- **Outil** : Vitest
- **Cible coverage** : ≥80% sur `engine/`
- **Ce qui est testé** :
  - Fonctions pures du moteur (mêlée, touche, jeu courant, ruck, jeu au pied)
  - Reducer `applyEvent(state, event)` — exhaustivement par type d'event
  - Calculs mood, relations, traits

### Property-based testing — invariants
- **Outil** : fast-check
- **Ce qui est testé** :
  - Score d'un match toujours ≥ 0
  - Possession totale = 100%
  - Somme des essais individuels = essais équipe
  - Aucun joueur n'a un attribut hors [0, 100]
  - Le mood est toujours dans [0, 100]
  - Aucun event ne fait disparaître un joueur de l'effectif sans cause valide
  - Replay d'une séquence d'events depuis l'état initial = état final identique

### Simulation tests — distributions
- **Outil** : Vitest + script de simulation
- **CI** : 1 000 matchs à chaque commit, 10 000 matchs à chaque PR
- **Ce qui est validé** :
  - 4-6 essais/match en moyenne (écart-type acceptable)
  - 60-70% pénalités réussies
  - ~75 phases par match
  - Possession ~50/50 entre équipes équivalentes
  - Écart de niveau (gros vs petit) → ~70/30 en faveur du gros
  - Pas de drift (les distributions doivent rester stables après chaque PR)

### Integration tests
- **Outil** : Vitest
- **Ce qui est testé** :
  - Flow end-to-end avec `LocalSQLiteRepository` mockée
  - Save → load → état identique
  - Migration de schéma de save entre versions

### E2E UI tests
- **Outil** : Playwright
- **Quand** : V0.5+ (une fois les 4 écrans MVP en place)
- **Ce qui est testé** :
  - Naviguer entre les 4 écrans MVP
  - Jouer un match complet
  - Sauvegarder et recharger
  - Smoke tests sur les interactions clés (composition, live moments)

---

## C. Plan de bêta-test

### Phase 1 — Bêta privée (V0.9, ~1 mois)

- **5-10 testeurs** : proches + fans rugby (au moins 2 fans hardcore FM/manager)
- **Distribution** : Itch.io key privée ou Steam playtest
- **Ce qui est testé** :
  - 1 saison complète jouée par chacun
  - ≥50 matchs joués cumulés
  - Engagement réel ("est-ce qu'ils y reviennent volontairement ?")
- **Feedback collecté** :
  - Bug tracker (Linear ou GitHub Issues privé)
  - Sondage hebdo (1 question : "qu'est-ce qui t'a fait revenir cette semaine ?")
  - Sondage final ("ressort en 1 mot", "tu reviendrais demain ?")

### Phase 2 — Pas d'early access payante

> Décision : skip cette phase. Si la bêta privée révèle des manques, on peut la rouvrir.

### Phase 3 — Wishlist Steam pré-launch (V0.99, optionnel)

- Inviter ~50 wishlist Steam à un playtest court (1 semaine)
- Test de scalabilité (plus de profils différents)
- Smoke test final avant release

---

## D. Critères de validation du moteur de match

> Critères repris de la section 6.

À chaque PR sur `engine/`, vérifier (en CI) :

```
Distribution sur 10 000 matchs simulés :

✅ Essais par match : moyenne 4-6, écart-type < 2
✅ Pénalités par match : moyenne 8-12
✅ % réussite pénalités : 60-70%
✅ Phases par match : 70-80
✅ Possession équipe forte vs faible (delta 30%) : 65-75 / 25-35
✅ Possession équipes équivalentes : 45-55 / 45-55
✅ Cartons par match : 0.3-0.7 jaunes, 0.05-0.1 rouges
✅ % matchs nuls : < 8%
```

Si une métrique drift hors-cible → CI échoue, PR bloquée.

---

## E. Outillage de quality assurance

- **Linear** ou **GitHub Issues** : tracker bugs + features bêta
- **Sentry** ou **Bugsnag** : crash reports en bêta + post-launch (avec opt-in RGPD)
- **PostHog** ou analytics maison : flux d'usage anonymisé en bêta (avec opt-in)
- **Discord bêta privé** : channel par testeur pour feedback rapide

---

## F. Validation pré-release (checklist V1.0)

- [ ] 6/7 critères ready-to-ship validés
- [ ] EULA + politique confidentialité publiées
- [ ] Page Steam validée (capsules, screenshots, trailer, description FR + EN)
- [ ] Page Itch.io validée
- [ ] Build Steam soumis et validé par Steam
- [ ] Backup save format documenté (compatibilité ascendante post-launch)
- [ ] Discord public ouvert + modération en place
- [ ] Plan de support post-launch (combien d'heures/semaine bug fixing ?)
