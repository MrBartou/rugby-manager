# 10. UI / UX

> Statut : ✅ Tous les 4 écrans MVP implémentés + extras (Vestiaire, Fiche joueur, PreMatch, Dashboard).

## 📋 État V0.5

Écrans implémentés :

- ✅ **Écran match** ([MatchScreen.tsx](../../src/ui/screens/MatchScreen.tsx)) — terrain SVG + scoreboard + timeline phases + modal live moments + résumé narratif
- ✅ **Dashboard** ([DashboardScreen.tsx](../../src/ui/screens/DashboardScreen.tsx)) — hero match + fils humains (V0.5) + calendrier + classement + résultats récents
- ✅ **Vestiaire** ([SquadScreen.tsx](../../src/ui/screens/SquadScreen.tsx)) — grille de cartes joueurs avec mood/forme + filtres
- ✅ **Fiche joueur** ([PlayerScreen.tsx](../../src/ui/screens/PlayerScreen.tsx)) — attributs S/A/B/C/D + traits + mood + relations clés
- ✅ **Composition + Préparation** ([PreMatchScreen.tsx](../../src/ui/screens/PreMatchScreen.tsx)) — sélecteurs poste avec auto-swap + capitaine + buteur + entraînement
- ✅ **Setup match isolé** ([SetupScreen.tsx](../../src/ui/screens/SetupScreen.tsx)) — V0.2
- ✅ **Setup saison** ([SeasonSetupScreen.tsx](../../src/ui/screens/SeasonSetupScreen.tsx)) — choix de club + reprise de saves

Charte appliquée :
- ✅ Direction sombre (bg `#0e1116`, accents bleus / verts / rouges sémantiques)
- ✅ Typo sans-sérif moderne pour le texte, mono pour les chiffres
- ✅ Densité aérée par défaut (cohérent pilier 3)
- ✅ Animations CSS (transitions ball, modal, phase reveal)

À faire :
- ⬜ Wireframes Figma exportés (la charte vit aujourd'hui dans le code uniquement)
- ⬜ Mode "expert" qui densifie l'affichage — V0.7
- ⬜ Mood board exportable

---

## Écrans prioritaires pour le vertical slice MVP (V0.2-V0.3)

Tous les 4 sont prioritaires (décision : "tous les écrans MVP") :

### 1. Écran match : live + résumé
**Cœur du vertical slice.** Vue 2D top-down du match en cours (PixiJS / Canvas).

Composants :
- **Vue terrain 2D** (vue de dessus, formes stylisées) avec joueurs, ballon, lignes
- **Bandeau temps + score** en haut
- **Bandeau live moments** quand un événement se déclenche (interruption, choix 2-3 options)
- **Mini stats live** (possession, mètres gagnés, plaquages réussis)
- **Post-match** : génération de résumé narratif + stats individuelles + performances marquantes

### 2. Dashboard + Calendrier
**Point d'entrée et sortie de session.** Doit répondre au test "pourquoi tu joues encore une heure ?".

Composants :
- **Hero** : prochain match (J-X, lieu, adversaire, contexte)
- **3-5 fils humains actifs** (cartes cliquables : "Dupont demande à parler", "Tension Martin/Bernard", "Mentor proposé pour Jeune", etc.)
- **Calendrier** synthétique (5-10 prochains matchs) + accès au calendrier complet
- **Notifications** : presse, médical, staff
- **Action principale** : "passer au prochain événement / jour"

### 3. Fiche joueur + Vue vestiaire
**Cœur du pilier 2.**

Fiche joueur :
- **En-tête** : nom, photo (post-MVP), poste, âge, contrat
- **Attributs** : barres + lettres S/A/B/C/D (3 catégories + sub-stats poste)
- **Traits** : 5-6 chips (Ambitieux, Charismatique, Fragile mentalement…)
- **Mood actuel** + top 3 modificateurs ("pourquoi il va mal")
- **Relations clés** : top 5 relations (positives et négatives)
- **Historique** : matchs joués, performances marquantes

Vue vestiaire :
- Vue d'ensemble effectif avec mood/forme par joueur
- Filtres : par poste, par fil ouvert, par mood
- Graphe de relations (mini, avec liens visibles)

### 4. Composition + Tactique pré-match
**Préparation match.**

Composants :
- **Effectif** : drag & drop pour la composition (15 + 8 remplaçants)
- **Vue indicateurs** : forme, mood, fatigue, rapport à l'adversaire
- **Tactique** : 3 niveaux choisis (philosophie / plan pré-match / lancements)
- **Avis du staff** (M12) : 1-2 voix pertinentes interviennent (médecin si blessure, adjoint avants si choix pack…)

---

## Charte graphique (à définir)

### Direction artistique
- [ ] Mood board (captures de jeux qu'on aime : Motorsport Manager, FM 24+, Crusader Kings 3 UI)
- [ ] Palette : sombre élégant ou clair éditorial ?
- [ ] Typographie : sérif (FM-style) ou sans-sérif moderne ?
- [ ] Style visuel match : minimaliste géométrique ou plus illustré ?

### Densité d'information
- [ ] Style FM dense (tableaux, beaucoup d'infos par écran) → fans hardcore
- [ ] Style aéré moderne (1 info clé par écran, navigation) → casual
- [ ] **Cible : aéré par défaut, mode "expert" qui densifie** (cohérent pilier 3)

---

## Outils de wireframing

- [ ] **Figma** : standard, gratuit, partage facile
- [ ] **Excalidraw** : très rapide pour les premiers jets
- [ ] **Penpot** : open source si éthique compte
- [ ] Papier crayon scanné : valable pour les premières itérations rapides

---

## Arborescence de navigation (à valider)

```
Dashboard (home)
├── Calendrier
├── Effectif
│   └── Fiche joueur
│   └── Vue vestiaire
├── Match (auto-ouvert le jour du match)
│   └── Composition + Tactique
│   └── Live match
│   └── Résumé post-match
├── Staff (les 8 voix accessibles)
└── Club (finances, infrastructures — post-MVP)
```
