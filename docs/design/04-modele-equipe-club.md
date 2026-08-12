# 4. Modèle équipe et club

> Statut : ✅ Staff voix et identité tactique implémentés en V0.4 phase 3.

## 📋 État V0.5

- ✅ 8 staff par club avec biais (médecin/adjoints/président/etc.) — `src/engine/club/staff.ts`
- ✅ Voix qui s'expriment dans les live moments (Adjoint avants pour "verrouiller", Médecin pour "faire sortir"…)
- ✅ Identité tactique du club typée (`JEU_AVANTS`, `GRAND_ECART`, `MIXTE`, `DEFENSE_DE_FER`)
- ⬜ Conflits de voix (médecin vs adjoint avants sur joueur fragile) — V0.6
- ⬜ Modèle financier actif (salary cap, JIFF compteur) — V0.7
- ⬜ Infrastructures (stade, centre formation) — post-MVP

---

## A. Structure du staff (NPCs avec voix)

### Décision : **7-8 staff** avec personnalités (M12 — Disco Elysium voix internes)

> ⚠️ Risque identifié : "voix qui débattent" peut devenir cacophonie. À doser dans l'UI — les voix s'expriment seulement quand pertinent (pas toutes en même temps).

### Liste des staff MVP

| Rôle | Voix / Biais | Intervient sur |
|------|--------------|----------------|
| **Entraîneur en chef** | Vision globale, autorité ultime | Tactique, équipe-type, décisions techniques |
| **Adjoint avants** | Pousse à l'agressivité, focus pack | Mêlée, touche, mauls, sélection avants |
| **Adjoint 3/4 (arrières)** | Pousse au jeu de mouvement, créativité | Lancements, jeu courant, sélection 3/4 |
| **Médecin du club** | Prudence, protection joueurs | Blessures, charge d'entraînement, retours de blessure |
| **Préparateur mental** | Sensibilité humaine, fragilités | Mood, conflits vestiaire, gestion stress |
| **Entraîneur skills** | Détails techniques individuels | Plans individuels de progression, jeu au pied |
| **Scout principal** | Long terme, recrutement | Reports scouting (post-MVP : transferts) |
| **Président** | Performance court-terme, business | Objectifs saison, médias, finances |

### Règles d'expression

- **Une voix s'exprime quand pertinent** — pas de spam multi-voix
- **Conflits de voix possibles** : médecin vs adjoint avants sur un blessé qui veut jouer
- **Le joueur arbitre** — pas d'obligation de suivre un avis
- **Profil cumulé** : chaque voix a 1-2 traits propres (Optimiste / Anxieux / Discipliné / Iconoclaste...) qui modulent ses prises de position

---

## B. Modèle financier (post-MVP en grande partie)

> En MVP : finances simulées en arrière-plan, le joueur voit le budget mais ne le pilote pas activement.

- **Budget annuel** (variable par club)
- **Salary cap Top 14** (~10M€ pour la saison 2025-26 à valider)
- **Sources** : sponsors, billetterie, droits TV, partenariats
- **Dépenses** : salaires joueurs, salaires staff, infrastructures, voyages

### Système JIFF (pilier 4)

- Quota de Joueurs Issus des Filières de Formation à respecter
- Conséquences si non-respect : pénalités sportives ou financières (à confirmer règles 2025-26)
- Le joueur doit voir le compteur JIFF en permanence dans son effectif

---

## C. Infrastructures (post-MVP)

- **Stade** : capacité, ambiance, état
- **Centre d'entraînement** : qualité (impact entraînement)
- **Centre de formation** : qualité (impact génération jeunes — post-MVP)

---

## D. Réputation et identité du club

### Réputation

- Réputation sportive (résultats récents)
- Réputation médiatique (presse positive/négative)
- Attractivité (capacité à attirer joueurs)

### Identité tactique du club (pilier 4)

> Référence : "un ailier toulousain n'est pas le même profil qu'un ailier rochelais ; recruter à contre-culture du club a un coût humain"

- Chaque club a une identité tactique de référence (jeu d'avants / grand écart / mixte / défense de fer)
- Recruter à contre-culture coûte en cohésion (mood vestiaire, relations)
- Faire évoluer l'identité demande du temps (plusieurs saisons)
