# Rugby Manager

> Un rugby manager qui prend enfin au sérieux la tactique du sport et la vie du vestiaire.
>
> **Le FM du rugby français**, avec un focus sur la modélisation rugby-spécifique du match et la vie de vestiaire émergente.

## État du projet

**V0.5** — toutes les mécaniques de fond sont en place. Prêt pour la bêta privée.

| Jalon | Statut |
|---|---|
| V0.1 — Proto moteur match | ✅ |
| V0.2 — Vertical slice "1 match jouable" | ✅ |
| V0.3 — Saison Top 14 + boucle hebdo | ✅ |
| V0.4 — Système humain v0 | ✅ |
| V0.5 — Polish + UI | ✅ |
| V0.9 — Bêta privée | ⬜ |
| V1.0 — Release | ⬜ |

## 📚 Documentation

Toute la documentation est dans **[docs/](./docs/)**.

- [docs/README.md](./docs/README.md) — index principal
- [docs/STATUS.md](./docs/STATUS.md) — tableau de bord d'implémentation
- [docs/CHANGELOG.md](./docs/CHANGELOG.md) — historique V0.1 → V0.5
- [docs/design/](./docs/design/) — 14 documents de design produit
- [docs/dev/setup.md](./docs/dev/setup.md) — guide développeur

## 🚀 Démarrage rapide

```bash
npm install
npm run test              # 71/71 tests verts
npm run dev               # http://localhost:5173

# CLI
npm run play -- list                        # liste des 14 clubs
npm run play -- 42 toulouse usap            # match précis
npm run play:stats -- toulouse usap 500     # stats agrégées
npm run calibrate                           # 1000 matchs vs cibles V1
```

## Les deux moteurs de retour

Le joueur revient parce qu'il a deux fils ouverts qu'il veut tirer :

- **Moteur A** — le match qui arrive (ponctuel, programmé)
- **Moteur B** — l'histoire humaine en cours (continu, émergent)

Les deux se nourrissent mutuellement.

## Test de validation permanent

> *"Pourquoi tu joues encore une heure de plus ?"*

Le joueur doit pouvoir répondre par une phrase concrète mentionnant soit un match, soit un joueur, soit les deux. Si la réponse est *"je sais pas, j'avance"*, le système est cassé.
