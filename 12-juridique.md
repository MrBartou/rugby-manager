# 12. Juridique

> Statut : ⚠️ Critique — décisions à reconfirmer avant release

---

## A. État des lieux — décisions sensibles

| # | Décision | Statut | Risque |
|---|----------|--------|--------|
| 1 | Licence officielle Top 14 (LNR) | ⚠️ À RECONFIRMER | Coût 6 chiffres, 6-12 mois négo |
| 2 | Scraping sources publiques | ⚠️ FLAG JURIDIQUE | Terms of service + sui generis |
| 3 | Droit à l'image joueurs | À traiter avec licence | Bloquant si licence abandonnée |

---

## B. Licence officielle Top 14

### Ce qui est protégé

- **Marques** : "Top 14", "Pro D2", logos LNR, "Bouclier de Brennus"
- **Logos et noms de clubs** (Stade Toulousain, Stade Français, etc.)
- **Identité visuelle** : couleurs, kits, mascottes

### Trois chemins possibles

**Chemin A — Licence officielle complète (décision actuelle, à reconfirmer)**
- Coût estimé : 6 chiffres minimum sur 3-5 ans
- Délai : 6-12 mois de négociation
- Inclus : marques + logos + noms clubs + (probablement) droits joueurs via accord LNR/Provale (syndicat joueurs)

**Chemin B — Pas de licence, fictifs proches**
- Noms clubs fictifs proches ("FC Toulouse" au lieu de "Stade Toulousain")
- Couleurs et villes OK (pas protégeables)
- Outil d'édition communautaire pour mods de noms réels

**Chemin C — Licence partielle**
- Accord direct avec quelques clubs (plus simple à négocier que LNR)
- Pas de "Top 14" comme marque, mais "Championnat de France" (générique non protégé)

### Décision à prendre avant V0.9 (bêta privée)

Le choix doit être verrouillé avant de communiquer publiquement (page Steam Coming Soon, Discord public).

---

## C. Scraping et données

### Le risque juridique

**Terms of Service des sources scrapées**
- rugby-club.fr, Wikipedia, sites stats : ToS interdisent souvent le scraping
- Cas Hi.Q vs LinkedIn (US) — scraping de données publiques OK pour usage personnel, mais commerciale = risque
- Cas LeBon vs LinkedIn / Pap (FR) — divergent

**Directive 96/9/CE (UE) — droit sui generis sur les bases de données**
- Une base de données peut être protégée même si chaque fait individuel ne l'est pas
- "Investissement substantiel" dans la collecte/vérification → protection 15 ans
- Risque : extraire systématiquement une base de données = atteinte au droit sui generis

**Droit à l'image / droits voisins**
- Stocker et rediffuser nom + stats d'un joueur dans un produit commercial = utilisation commerciale
- Pas évident, mais en France les juges sont plutôt protecteurs

### Plan d'action

1. **Phase dev (jusqu'à V0.5)** : scraping autorisé en interne pour calibrage et tests. Données non-distribuées.
2. **Avant V0.9 bêta privée** : décision finale sur licence + sourcing.
3. **Release** : soit données licenciées, soit hybride manuel/procédural. **Pas de scraping dans le binaire distribué.**

### Checklist avant scraping

- [ ] Lire les ToS de chaque source
- [ ] Respecter `robots.txt`
- [ ] Rate limiting raisonnable (pas de DOS implicite)
- [ ] Pas de stockage en clair des données scrapées dans un repo public
- [ ] Documentation interne du sourcing

---

## D. Droits sur le code et le jeu

### Licence du code source

- [ ] **Privé** (recommended pour un jeu commercial)
- [ ] Open source (GPL, MIT) — choix marketing/communauté

### Licence d'utilisation du jeu (EULA)

- [ ] EULA standard pour jeu Steam/Itch
- [ ] Limites : usage personnel, pas de revente, pas de reverse engineering hostile
- [ ] Mods autorisés et encouragés (cf. M14)

---

## E. RGPD (si online v2 ou collecte de feedback)

- Inscription Discord/email = donnée personnelle → RGPD
- Politique de confidentialité claire
- Possibilité de suppression de compte / données

> Pour v1 solo desktop : pas de collecte automatique. Crash reports uniquement avec opt-in explicite.

---

## F. Action items urgents

- [ ] **Avant V0.5** : décision finale licence (chemin A / B / C)
- [ ] **Avant V0.9** : EULA rédigée
- [ ] **Avant V1.0** : politique de confidentialité, compte développeur Steam (entité légale ou perso)
- [ ] **Si online v2** : conformité RGPD totale, hébergement EU
