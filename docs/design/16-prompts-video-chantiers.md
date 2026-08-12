# Prompts vidéo IA — les chantiers

Séquences courtes (6–8 s) illustrant les quatre chantiers de la direction du
club (`ProjectKind` dans `src/engine/club/club-management.ts`).

Trois prompts par chantier, calés sur le cycle de vie d'un `OngoingProject` :

| État | Quand | Ce qu'on montre |
| --- | --- | --- |
| **Lancement** | saison où `canLaunch` passe | on casse, on terrasse, rien n'existe encore |
| **En cours** | `readyAtSeason` non atteint | la structure monte, tout est à l'arrêt |
| **Livraison** | `advanceProject` livre | l'installation en service, occupée |

Le stade dure 2 saisons (`projectDuration`), il a donc réellement les trois
états. Les autres chantiers durent 1 saison : « en cours » sert d'écran de
transition d'intersaison, ou de variante si la livraison ne rend pas bien.

## Parti pris : on doit reconnaître le lieu

Le but est l'identification. Le stade est donc **nommé** et décrit par ses
repères réels — quartier des Sept Deniers, périphérique derrière la tribune
Est, quatre tribunes basses aux coins ouverts, rouge et noir. On continue en
revanche à ne pas faire apparaître de **logo ni de flocage lisible** : ça
n'ajoute rien à la reconnaissance du lieu, et c'est ce qui fait refuser un
prompt par la plupart des générateurs.

Repères vérifiés, à réutiliser dans les prompts :

- 19 500 places, pelouse de 120 × 70 m, poteaux de 21 m, écrans géants ;
- quartier des Sept Deniers, au nord-ouest de Toulouse, près de la Garonne ;
- complexe de 10 hectares, terrains d'entraînement tout autour du stade ;
- construit de 1978 à 1983, agrandi en 2003 ;
- la **tribune Est longe le périphérique** — c'est celle que le vrai projet
  d'agrandissement prévoit de surélever d'un niveau, pour +3 000 places.

Ce dernier point tombe juste : `SEATS_PER_LEVEL` vaut exactement 3 000.

## Bloc de style — à coller en tête de chaque prompt

```
Cinématique broadcast, photoréaliste, objectif anamorphique 35 mm, faible
profondeur de champ. Un seul mouvement de caméra lent et continu, sans coupe.
24 fps, 8 secondes, 16:9.
Étalonnage : béton froid, ciel laiteux du Sud-Ouest, une seule couleur d'accent
chaude (rouge brique et noir). Grain argentique léger.
Ambiance : chantier réel filmé au documentaire, jamais un rendu 3D d'architecte.
```

## Bloc négatif — à coller en fin de chaque prompt

```
Négatif : texte, sous-titres, watermark, logo, marque, panneau publicitaire
lisible, maillot floqué, visage reconnaissable en gros plan, foule aux visages
déformés, membres surnuméraires, style cartoon, rendu 3D lisse, scintillement,
zoom brutal, coupe au montage.
```

---

## 1. `STADE` — Agrandissement du stade

*+3 000 places par niveau. Recettes de match et ambiance.*

### 1.1 Lancement — le prompt principal (Ernest-Wallon, niveau 1)

```
Vue aérienne de drone, basse et lente, en travelling avant vers le stade
Ernest-Wallon de Toulouse, l'enceinte du Stade Toulousain dans le quartier des
Sept Deniers, fin d'après-midi d'été. Stade de rugby compact de 19 500 places :
quatre tribunes basses en béton, séparées, coins ouverts sur le ciel, disposées
au plus près d'une pelouse de 120 sur 70 mètres, sièges rouges et noirs, hauts
poteaux de rugby blancs de 21 mètres. Autour de l'enceinte, un complexe de dix
hectares : terrains d'entraînement en herbe alignés, parkings, rangées de
platanes, et les toits de tuiles romanes et la brique rose de Toulouse jusqu'à
l'horizon. Derrière la tribune Est passe le périphérique toulousain, ses deux
rubans de circulation en léger remblai.
Cette tribune Est vient d'être mise à nu pour être surélevée : ses sièges ont
été déposés et empilés sur des palettes, les gradins béton sont dégarnis, une
pelleteuse et deux camions-bennes creusent une saignée de terre ocre entre la
tribune et le périphérique, des barrières de chantier ceinturent la zone. Les
trois autres tribunes sont intactes. La pelouse est protégée sous des bâches
blanches. Lumière rasante de 19 h, poussière en suspension. Stade vide.
```

### 1.2 En cours

```
Plan large au sol puis lente montée sur grue, à l'aube brumeuse, sur la tribune
Est du stade Ernest-Wallon de Toulouse en cours de surélévation. Deux grues à
tour immobiles dominent l'enceinte compacte du Stade Toulousain, une forêt
d'échafaudages tubulaires habille un squelette de poteaux et poutres en béton
préfabriqué monté au-dessus de l'ancienne tribune. Une demi-nappe de gradins
neufs est posée, l'autre moitié n'est qu'armatures et coffrages ouverts sur le
ciel. Des filets de chantier verts battent au vent le long de la façade, côté
périphérique. Sur le parvis, des rangées de sièges rouges neufs encore emballés
sous film plastique. En vis-à-vis, les trois autres tribunes basses et leur
béton patiné, les écrans géants éteints, la pelouse impeccable et les poteaux
blancs. La caméra s'élève jusqu'à révéler que la nouvelle travée dépasse
désormais d'un étage tout le reste du stade. Ciel gris perle, chantier désert.
```

### 1.3 Livraison

```
Contre-plongée en travelling latéral lent, soir de match sous les projecteurs,
au pied de la tribune Est surélevée du stade Ernest-Wallon de Toulouse. Le
nouveau deuxième niveau est plein à craquer : sièges rouges et noirs, béton
clair encore net, garde-corps neufs, écharpes rouge et noir tournoyantes, mains
levées, fumigènes dont la fumée traverse les faisceaux des projecteurs. La
caméra glisse le long de la tribune puis pivote pour embrasser l'enceinte
entière — pelouse éclatante aux lignes blanches fraîches, poteaux blancs de
21 mètres, écrans géants allumés, les trois tribunes basses d'origine en
vis-à-vis, plus sombres et d'un étage plus bas, et les coins ouverts sur la
nuit toulousaine. Silhouettes de spectateurs en contre-jour, aucun visage net.
```

---

## 2. `CENTRE_ENTRAINEMENT` — Centre d'entraînement

*Progression des joueurs accélérée.*

### 2.1 Lancement

```
Plan large en travelling latéral lent, matin gris, sur un terrain
d'entraînement de rugby éventré. La pelouse a été décapée par bandes, laissant
une terre ocre striée de tranchées de drainage où reposent des tuyaux annelés
noirs. Une niveleuse et un rouleau compresseur sont à l'arrêt au milieu du
terrain, des piquets de géomètre et des cordeaux orange quadrillent l'espace.
Au fond, un hangar métallique ancien aux bardages ternis, et une rangée de
poteaux de rugby démontés couchés dans l'herbe. Flaques d'eau reflétant le
ciel. Aucune présence humaine.
```

### 2.2 En cours

```
Travelling avant lent au ras du sol, fin de journée, sur un centre
d'entraînement de rugby en construction. Au premier plan, un terrain hybride
en cours de pose : rouleaux de gazon synthétique fibré déroulés à moitié,
lignes de fibres visibles, sacs de sable de lestage alignés. Au second plan, un
bâtiment bas en ossature métallique dont la charpente est montée mais les
bardages seulement à moitié posés, laissant voir l'intérieur nu et les
suspensions d'éclairage encore emballées. Un chariot élévateur à l'arrêt, des
plots de béton, un compresseur. Lumière orange rasante traversant la structure
ouverte. Chantier désert.
```

### 2.3 Livraison

```
Travelling latéral lent, aube d'hiver, le long d'un terrain d'entraînement de
rugby neuf en service. Pelouse hybride impeccable, lignes blanches nettes,
haleine de buée dans l'air froid. Une dizaine de joueurs en tenue
d'entraînement sombre et sans marquage travaillent en atelier : sleds de
poussée, boucliers de contact, plots, échelles de rythme au sol. À l'arrière,
un bâtiment bas neuf en bardage sombre et grandes baies vitrées reflétant le
ciel rose, et une salle de musculation éclairée derrière la vitre. Cônes,
ballons et bidons alignés au cordeau. Vu de loin, aucun visage identifiable.
```

---

## 3. `CENTRE_MEDICAL` — Centre médical

*Moins de blessures à l'entraînement, retours plus rapides.*

### 3.1 Lancement

```
Travelling avant lent dans un couloir intérieur en démolition, éclairé par une
seule baie vitrée en bout de perspective. Les cloisons ont été abattues, les
gravats sont empilés en tas bâchés, des gaines électriques pendent du plafond
ouvert, les dalles de faux plafond ont été déposées et empilées contre un mur.
Le sol en béton porte encore les traces de colle de l'ancien revêtement. Des
bâches plastiques translucides isolent le fond du couloir et ondulent
légèrement. Lumière du jour crayeuse et poussiéreuse. Aucun ouvrier visible.
```

### 3.2 En cours

```
Plan large fixe avec très lente dérive latérale, dans une salle intérieure en
second œuvre. Murs fraîchement plaqués et enduits, blancs et bruts, sol en
résine claire en partie coulé, une bande de ragréage encore humide. Au centre,
deux grandes cuves de balnéothérapie en inox brossé viennent d'être livrées,
encore sanglées sur leurs palettes et protégées par du film étirable, à côté
d'une cabine de cryothérapie emballée. Des cartons de carrelage empilés, une
scie sur table sous une bâche, des projecteurs de chantier sur trépied
éclairant froidement la pièce. Câbles au sol, pièce inoccupée.
```

### 3.3 Livraison

```
Travelling avant lent dans une salle de rééducation sportive neuve et en
service, lumière du jour douce par une grande baie vitrée. Sol en résine bleu
sombre, tables de soin en cuir noir alignées, tapis roulants antigravité,
vélos de réathlétisation, un bassin de balnéothérapie en inox fumant
légèrement au fond de la pièce. Un kinésithérapeute en polo sombre sans
marquage travaille la cheville d'un joueur assis, vus de trois quarts dos.
Écrans de mesure allumés affichant des courbes abstraites illisibles. Ambiance
calme, propre, clinique mais chaude.
```

---

## 4. `BOUTIQUE` — Boutique et marque

*Recettes de merchandising et de sponsors.*

### 4.1 Lancement

```
Plan fixe légèrement en contre-plongée, avec dérive lente vers l'avant, devant
un local commercial vide en pied de tribune de stade. La vitrine est masquée
de l'intérieur par du papier kraft et des bâches, le rideau métallique est
relevé à moitié. À l'intérieur, un volume brut : béton au sol, murs
parpaings, une seule ampoule de chantier pendue au plafond, des tréteaux et un
escabeau. L'enseigne a été déposée, laissant une empreinte plus claire et les
trous de fixation sur la façade. Fin de journée pluvieuse, reflets sur le
parvis mouillé. Rue déserte.
```

### 4.2 En cours

```
Travelling avant lent en intérieur, dans une boutique en cours d'agencement.
Les portants métalliques noirs viennent d'être montés mais sont vides, les
étagères murales sont posées et encore protégées par des films bleus. Des
rails d'éclairage sur plafond noir mat sont branchés et éclairent des zones
inégales. Au sol, du parquet stratifié posé aux deux tiers, les lames restantes
empilées le long du mur. Des cartons scellés portant des étiquettes illisibles
occupent le centre de la pièce, un mannequin de vitrine nu et gris est couché
sur le comptoir non fini. Personne dans le local.
```

### 4.3 Livraison

```
Travelling latéral lent en extérieur puis léger panoramique vers l'intérieur,
jour de match en fin d'après-midi, devant une boutique de club neuve en pied
de tribune. Grande vitrine éclairée chaudement, murs sombres, portants pleins
de maillots rouges et noirs vierges de tout marquage, mur d'écharpes, ballons
alignés. Une file d'une quinzaine de supporters attend dehors sous une lumière
dorée, silhouettes et dos, sacs à la main. Reflets du parvis et de la
tribune dans la vitrine. Le mouvement se termine sur le comptoir où un vendeur
plie un maillot. Aucun visage net, aucun texte lisible.
```

---

## Notes de production

- **Cohérence entre les 12 clips** : générer d'abord une image fixe par
  chantier (même prompt, même graine), la valider, puis lancer les vidéos en
  *image-to-video* depuis cette image. Le texte seul dérive beaucoup d'un clip
  à l'autre.
- **Graine fixe** par chantier, incrémentée seulement pour les variantes.
- **Boucle** : le mouvement de caméra étant unidirectionnel et lent, la boucle
  se fait proprement en aller-retour (ping-pong) côté UI, sans fondu.
- **Variantes** : pour re-rouler un plan, ne changer que la première phrase
  (le mouvement de caméra) et garder le reste mot pour mot.
- **Format** : 16:9 pour une carte de chantier pleine largeur, 21:9 si le clip
  passe en bandeau d'en-tête de l'écran Direction. Prévoir aussi un export
  fixe de la dernière image pour l'état « livré » persistant.
