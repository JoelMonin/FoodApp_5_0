# LOT 025 — Amélioration IA `[EN COURS]`

**Ouvert le 2026-08-02** · Branche `feat/lot25-amelioration-ia` · Niveau d'audit : **Standard**

---

## 1. D'OÙ ÇA VIENT

Joel importe la recette Marmiton « Aubergines au four »
(`https://www.marmiton.org/recettes/recette_aubergines-au-four_13572.aspx`), clique sur
« Transformer avec l'IA », et **croit que l'application a perdu sa recette** : le grand champ
de texte ne contient plus qu'une phrase d'accroche.

**Diagnostic (2026-08-02) : la transformation avait réussi.** La recette structurée existait
bien, complète, mais elle vivait en mémoire (`_lastTransformedRecipe`) sans jamais être
montrée. `src/ui/pasteRecipe.js:216` écrit volontairement un accusé de réception à la place du
texte source, et n'affiche que `recipe.description`.

**Le défaut n'est donc pas dans le traitement, il est dans ce que l'écran montre : on demande
à Joel de sauvegarder quelque chose qu'il ne peut pas voir.**

Deux autres constats faits dans la foulée :
- **Le titre importé garde son préfixe** : « Lire la page » recopie la première ligne du
  service de lecture telle quelle, d'où `Title: Aubergines au four : la meilleure recette`
  (`src/ui/pasteRecipe.js:174`). L'IA le rattrape ; « Sauvegarder tel quel » ne le rattrape pas.
- **Toute la page part à l'IA** : bandeau cookies, « 1117 partenaires », menus, 176
  commentaires, pied de page. ~90 % de bruit, et 9 autres recettes d'aubergines en liens dans
  ce bruit.

---

## 2. PÉRIMÈTRE

| Volet | Sujet | Décidé par |
|---|---|---|
| **0** | Combler l'angle mort de test : prouver que le texte collé arrive dans le message envoyé à l'IA | Découverte (gap n°6) |
| **A** | Aperçu complet de la recette après transformation | Joel, 2026-08-02 |
| **B** | Nettoyer la page importée AVANT de l'envoyer à l'IA (+ titre sans préfixe) | Joel, 2026-08-02 |
| **C** | Rapport de fidélité IA ↔ site — **analyse seule, aucun changement de prompt sans feu vert** | Joel, 2026-08-02 |

**Hors périmètre, tracé volontairement :**
- La SSOT des consignes de prompt (gap n°5 de la découverte) : les deux gros prompts de
  `src/services/gemini.js` recopient les mêmes règles avec des formulations divergentes, et
  ces textes sont figés au mot près par `tests/gemini.test.js`. Les factoriser change ce que
  l'IA reçoit → **pare-feu A/B**, lot dédié.
- Toute modification du prompt (volet C) tant que Joel n'a pas tranché.

---

## 3. PHASE DÉCOUVERTE (faite le 2026-08-02, agent Explore)

**12 ressources réutilisables**, dont les 3 rendus de recette purs de `src/ui/recipe.js`,
`h()` (`src/utils/dom.js:8`), `isValidRecipe` (`src/utils/validate.js:87`) et les points
d'accroche existants `resetPasteModal`/`setPasteSaveButtonsEnabled`.

**7 gaps**, dont les 4 qui commandent ce lot :
1. **Aucun rendu de recette en TEXTE** — `buildClipboardText` ne compose que des listes
   d'inventaire. À écrire.
2. **Aucun nettoyeur de page web** — ni Markdown, ni HTML, ni tronqueur. À écrire.
3. **Aucun conteneur d'aperçu dans `index.html`** → **contourné** : l'aperçu réutilise le
   champ existant, donc **zéro modification d'`index.html`** (même choix qu'au LOT 020 pour
   la barre « Ranger »).
4. **Angle mort de test** : aucun test ne prouve que le paramètre `content` de
   `transformRecipeFromText` arrive dans le corps HTTP → **volet 0, en premier**.

**Décisions de conception prises à la découverte :**
- **L'aperçu reste dans `#paste-content`**, en texte. Motif : le champ est déjà verrouillé
  après transformation (contrat figé par `tests/favorites-rich.test.js:349`), le texte est
  lisible, copiable et comparable ligne à ligne avec le site — exactement l'usage de Joel.
  L'alternative (rendu visuel riche) obligerait à découper `renderRecipeDetail`, partagé par
  3 écrans : risque sans rapport avec le besoin.
- **Le nettoyage est posé dans `fetchRecipeFromUrl`, pas dans `gemini.js`.** Joel voit donc
  exactement ce qui partira à l'IA, et peut corriger à la main. Un nettoyage invisible côté
  service aurait été impossible à vérifier à l'œil.
- **Le nettoyeur ne rend JAMAIS le vide** : si ses règles mangent tout, il rend le texte
  d'origine. Une heuristique ne doit jamais casser un import.

---

## 4. CRITÈRES D'ACCEPTATION

1. Après transformation, le champ affiche : titre, accroche, temps/personnes/difficulté/
   cuisine, **la liste complète des ingrédients avec quantités**, et **toutes les étapes
   numérotées**.
2. Le champ reste verrouillé après transformation (acquis LOT 011 non régressé).
3. Une réponse IA refusée (`isValidRecipe` faux) laisse le texte de Joel **intact et
   modifiable** — aucun aperçu écrit (acquis LOT 014 volet C non régressé).
4. À la réouverture de la fenêtre, aucun aperçu de la session précédente ne survit.
5. Import Marmiton : le texte retenu ne contient plus le bandeau cookies, les menus, les
   commentaires ni le pied de page.
6. Import Marmiton : le titre proposé est `Aubergines au four`, sans préfixe `Title:`.
7. Le nettoyeur rend le texte d'origine plutôt que du vide quand ses règles ne trouvent rien.
8. Un test prouve que le contenu du champ arrive réellement dans le corps envoyé à l'IA.

---

## 5. SUIVI

| Volet | État | Preuves |
|---|---|---|
| 0 — angle mort de test | ✅ | 1 test dans `tests/gemini.test.js` · mutation **M6** rouge |
| A — aperçu complet | ✅ | `src/utils/recipeText.js` + `tests/recipe-text-preview.test.js` (16 tests) · mutation **M1** rouge |
| B — nettoyage de page | ✅ | `src/utils/webClean.js` + `tests/web-clean.test.js` (18 tests) + 2 tests d'intégration · mutations **M2/M3/M4/M5/M7** rouges |
| C — rapport de fidélité | ✅ | §6 ci-dessous — **analyse seule, aucun prompt modifié** |

**Validation : 879/879 Vitest · 16/16 Pytest · vérificateur de types OK · build OK.**

**Preuve par retrait : 7 mutations, 7 rouges, 0 nulle** — chacune avec un test NOMMÉ (exigence
du LOT 014 : un code de sortie non nul peut n'être qu'un plantage au chargement).

| # | Ce qu'on casse | Test qui rougit |
|---|---|---|
| M1 | L'aperçu retombe sur la seule description (état d'avant le lot) | `CRITÈRE 1 — le champ montre la recette COMPLÈTE` |
| M2 | Le nettoyeur ne coupe plus la tête | `jette le bandeau de consentement et les menus` |
| M3 | Le nettoyeur ne coupe plus le pied | `jette les recettes liées, les commentaires et le pied de page` |
| M4 | Le garde-fou « jamais du vide » est débranché | `rend le texte d'origine quand ses règles ont tout mangé` |
| M5 | Le titre ne préfère plus le titre de niveau 1 | `propose « Aubergines au four » comme titre, sans le préfixe` |
| M6 | Le texte collé disparaît du message envoyé à l'IA | `envoie réellement le texte collé dans le corps de la requête` |
| M7 | La page n'est plus nettoyée avant le champ | `retire le bandeau de consentement et le pied de page` |

**Épreuve du réel (2026-08-02, sur la vraie page Marmiton, lecteur de page réel) :**

| | Avant | Après |
|---|---|---|
| Texte envoyé à l'IA | 25 075 caractères (~6 270 jetons) | **2 551 caractères (~640 jetons)** |
| Réduction | — | **−90 %** |
| Titre proposé | `Title: Aubergines au four : la meilleure recette` | **`Aubergines au four`** |

Disparus : bandeau de consentement, « 1117 partenaires », six menus, fil d'Ariane, les neuf
autres recettes d'aubergines en liens, les 176 commentaires, le pied de page et les mentions
légales. **Limite connue et assumée** : le pavé de newsletter de fin d'article survit
(~700 caractères). Il est inoffensif — aucun risque de le confondre avec une recette — et le
retirer exigerait un marqueur taillé pour ce site précis. **On ne sur-ajuste pas une
heuristique à une page.**

---

## 6. VOLET C — RAPPORT DE FIDÉLITÉ IA ↔ SITE (analyse, aucun changement)

**Question de Joel** : « est-ce que l'IA a bien retranscrit la recette, et est-ce que j'ai
toute l'info utile pour la réaliser sans problème ? »

**Réponse courte : l'IA ne RETRANSCRIT pas, elle RÉÉCRIT — et c'est le prompt qui le lui
demande.** Ce n'est pas un défaut d'exécution, c'est une intention inscrite dans les
consignes, et Joel ne le savait pas.

### 6.1 Preuve sur pièce — la page Marmiton importée

Le texte source ne donne **aucune quantité** pour 4 de ses 5 ingrédients : `huile d'olive`,
`sel`, `poivre`, `herbes de Provence` (seul `4 aubergines` porte un nombre). Or le prompt
(`src/services/gemini.js:295-297`) ordonne :

> « INGRÉDIENTS & QUANTITÉS : Spécifie des quantités réalistes, précises et cohérentes
> (ex: "500g", "20cl"), **jamais vides**. »

**L'IA a donc l'ordre explicite d'inventer ce que le site ne dit pas.** Sur du sel et du
poivre, c'est sans conséquence. Sur une recette où l'auteur est volontairement vague, cela
fabrique une précision fausse — que rien à l'écran ne distingue d'une quantité réellement lue.

Trois autres consignes vont dans le même sens : « LE TITRE : doit être techniquement exact »,
« LE TEMPS : doit inclure toute étape obligatoire », « ÉTAPES : inclus au moins un repère
sensoriel ». Ce sont des consignes d'**amélioration**, pas de transcription.

### 6.1 bis — ⚠️ AUTO-CORRECTION DU 2026-08-02 : MA GÉNÉRALISATION ÉTAIT FAUSSE

Joel a contesté le §6.1 capture à l'appui. **Vérifié sur pièce, il a raison.**

**Ce qui était faux** : avoir laissé entendre que Marmiton ne porte pas de quantités. La fiche
structurée de la blanquette (`recette_blanquette-de-veau-facile_19219.aspx`) en donne
treize : `1 kg de blanquette de veau`, `25 cl de vin blanc`, `1 petite boîte de champignon`,
`1 petit pot de crème fraîche`… La capture de Joel affichait `½ kg` et `13 cl` simplement
parce que la page était réglée sur 2 personnes au lieu de 4 : **le site recalcule tout seul.**

**Ce qui reste vrai, et seulement ça** : sur la page **aubergines** précisément, 4 ingrédients
sur 5 ne portent aucune quantité — vérifié jusque dans les données structurées du site
(`huile d'olive`, `herbes de Provence`, `poivre`, `sel`). C'est une propriété de CETTE
recette, pas une propriété de Marmiton. Généraliser d'un seul exemple était l'erreur.

### 6.2 Points relevés sur la blanquette — ⚠️ DEUX SUR TROIS ÉTAIENT FAUX

Ces points avaient été posés comme « à vérifier face au site, pas des erreurs prouvées ». La
vérification a été faite le 2026-08-02 sur les données structurées du site. **Verdict : sur la
blanquette, l'IA a transcrit FIDÈLEMENT. C'est moi qui avais tort, pas elle.**

| Point que j'avais soulevé | Ce que dit le site | Verdict |
|---|---|---|
| « légèrement dorés » alors qu'une blanquette ne se colore pas | Étape 1 : « Faire revenir la viande dans un peu de beurre doux **jusqu'à ce que les morceaux soient un peu dorés** » | ❌ **MON ERREUR** — l'IA est fidèle |
| Champignons ajoutés trop tôt avant 1h30-2h de mijotage | Étape 4 : champignons incorporés **avec** carottes et oignons, AVANT le mijotage de l'étape 5 | ❌ **MON ERREUR** — l'IA est fidèle |
| Apostrophes disparues (« d une cocotte ») | Rien dans le code ne les retire | ✅ **CONFIRMÉ** — seul défaut réel |

**LEÇON, la même qu'au LOT 019 et au LOT 024** : j'ai opposé mon opinion culinaire au texte
source sans être allé lire le texte source. Une « vérification » qui ne rouvre pas la donnée
d'origine n'est pas une vérification. Le seul des trois points qui tenait est celui que
j'avais effectivement vérifié dans le code.

**Conséquence sur les correctifs proposés au §6.3** : **P3 (« ne modifie aucune étape
technique ») perd sa justification** — il était fondé sur ces deux faux positifs. **P1**
garde une base étroite (la page aubergines), et **P2 reste le seul correctif appuyé sur un
défaut confirmé.**

### 6.2 bis — Points d'origine, conservés pour la trace

⚠️ **Le texte source de cette recette-là n'a pas été fourni : ces points sont des choses À
VÉRIFIER face au site, pas des erreurs prouvées.** L'aperçu livré au volet A rend
précisément cette vérification possible en un coup d'œil.

1. **Étape 1 — « jusqu'à ce qu'ils soient légèrement dorés ».** Une blanquette est par
   définition un ragoût *blanc* : la viande ne se colore pas. Si le site dit « sans les
   colorer », l'IA a modifié une étape qui définit le plat.
2. **Étape 4 — champignons en boîte ajoutés avant 1h30 à 2h de mijotage.** Des champignons
   déjà cuits mis en début de cuisson se délitent ; l'usage est de les ajouter en fin.
3. **Les apostrophes ont disparu** (« d une cocotte », « l eau », « jaune d oeuf »).
   **Cause probable identifiée dans notre propre prompt**, règle n°4
   (`src/services/gemini.js:303-304`) : « Utilise UNIQUEMENT des guillemets simples (') …
   Aucun guillemet double (") ». Vérifié : **ce n'est pas le code qui les retire** — aucune
   transformation de ce type n'existe dans `src/utils/aiJson.js` ni dans `gemini.js`.

### 6.3 Ce qui est proposé — ET NON FAIT (pare-feu A/B : décision de Joel requise)

Changer un prompt change ce que l'IA reçoit, donc un comportement observable. Ces trois
correctifs sont **rédigés et prêts, mais non appliqués** :

| # | Correctif proposé | Effet attendu |
|---|---|---|
| P1 | « N'invente JAMAIS une quantité absente du texte source : reprends sa formulation ou écris "selon le goût". » | La recette affichée cesse de fabriquer de la fausse précision |
| P2 | Garder l'interdiction des guillemets doubles, mais ajouter : « l'apostrophe normale reste OBLIGATOIRE dans les mots (l'eau, d'une). » | Fin des « d une cocotte » |
| P3 | « Ne modifie aucune étape technique du source : ni coloration, ni température, ni ordre d'ajout. » | La blanquette reste blanche |

**P2 ne doit PAS aller jusqu'à supprimer la règle n°4** : elle existe pour empêcher des
guillemets doubles non échappés de casser la lecture du JSON. Le correctif la précise, il ne
la retire pas.

---

## 7. LE NETTOYEUR FACE À D'AUTRES SITES — ⚠️ SUR-AJUSTÉ À MARMITON

Question de Joel le 2026-08-02 : « es-tu confiant ? est-ce qu'il marche sur d'autres pages ? »
**Réponse mesurée sur quatre sites réels : NON.**

| Site | Avant | Après | Réduction |
|---|---|---|---|
| Marmiton (celui qui a servi de modèle) | 25 075 | 2 551 | **−90 %** |
| Marie Claire | 34 491 | 12 029 | −65 % — mais **le plafond de 12 000 s'est déclenché**, donc la page a été coupée net, et il reste ~10 000 caractères de bruit |
| Journal des Femmes | 4 063 | 2 320 | −43 % |
| Deliacious (blog) | 5 057 | 4 296 | **−15 %** |

**CAUSE RACINE, une seule** : la coupe de tête repose sur la présence d'un titre de niveau 1
(`# Titre`) dans le Markdown. **Marmiton est le seul des quatre à en avoir un.** Sur les trois
autres, aucune coupe de tête n'a lieu, et seuls les marqueurs de fin travaillent. La règle a
été écrite en regardant une seule page : c'est du sur-ajustement, et il se mesure.

**Ce qui rassure quand même** : le garde-fou ne s'est déclenché sur aucun des quatre, aucune
recette n'a été amputée. Le nettoyeur est **faible hors Marmiton, jamais destructeur.**

## 8. LA VRAIE SOLUTION — LA FICHE RECETTE STRUCTURÉE (volet D proposé)

Découverte du 2026-08-02, vérifiée sur les cinq pages : **les cinq sites publient déjà leur
recette en données structurées** (schema.org `Recipe`, la fiche que Google lit pour afficher
les recettes dans ses résultats). Et le lecteur de page sait rendre le HTML brut, donc cette
fiche est atteignable depuis le navigateur — vérifié, en-tête `x-return-format: html`.

Sur la blanquette, cette fiche donne **exactement** : 13 ingrédients avec leurs quantités,
les 7 étapes au mot près, `4 personnes`, `PT2H15M`. **Poids : 1 088 caractères, contre 25 000
pour la page.** Soit **−96 %**, et surtout **plus rien à deviner** : l'IA n'aurait plus qu'à
poser emojis et catégories, au lieu de reconstituer une recette dans un tas de bruit.

**Ce que ça résout d'un coup** : le sur-ajustement du §7, le risque « l'IA suit une autre
recette de la page », et l'essentiel du grief du §6.

**⚠️ CE N'EST PAS GRATUIT — trois pièges déjà repérés, à traiter par des tests :**
1. **Les formes divergent d'un site à l'autre.** Marie Claire rend les ingrédients en **UNE
   SEULE CHAÎNE** avec des retours ligne, pas en liste. Le champ « personnes » est tantôt
   `"4 personnes"`, tantôt `"4"`, tantôt `["2", "2 personnes"]`. Il faut un normaliseur, écrit
   et testé — pas supposé.
2. **Les durées sont au format ISO** (`PT2H15M`), à traduire en « 2 h 15 ».
3. **Il faut un repli** : une page sans fiche structurée doit retomber sur le nettoyeur
   actuel. Les deux chemins cohabitent, le nouveau ne remplace rien.

## 9. ÉTAT DE L'ART — CE QUE FONT LES AUTRES (recherche du 2026-08-02)

Question de Joel : « ton nettoyeur est-il au top ? on n'est pas les premiers ? ». Recherche
faite (moi sur `recipe-scrapers`, puis un second LLM sur mandat écrit).

**VERDICT SUR LE NETTOYEUR MAISON : ce n'est pas seulement qu'il est faible (§7) — ce n'est
pas l'approche du domaine.** La bibliothèque de référence
([hhursev/recipe-scrapers](https://github.com/hhursev/recipe-scrapers), **649 sites**) ne
nettoie JAMAIS du texte à l'heuristique : elle lit la donnée structurée, puis applique des
pilotes sur mesure par site. Notre §8 réinventait l'état de l'art en tâtonnant.

**CE QUE LA RECHERCHE A FAIT ÉCONOMISER.** La référence lit la fiche sous TROIS formats
(JSON-LD, Microdata, RDFa) là où nous n'en testions qu'un. Les 3 sites en échec ont donc été
revérifiés sous les deux autres, **plus OpenGraph** : `itemtype=schema.org/Recipe` absent
partout, RDFa absent partout, 0 attribut `itemprop` utile. **Gain nul → deux lecteurs de plus
à NE PAS écrire.** Le score reste 9/12.

**⚠️ CONTRADICTION INTERNE DU RAPPORT REÇU, À NE PAS AVALER TELLE QUELLE.** Sa conclusion
recommande `@mozilla/readability` pour les 3 pages sans fiche — mais sa propre réponse n°3
établit que **Mealie et Tandoor REFUSENT l'import dans ce cas** et renvoient l'utilisateur à
une saisie manuelle, « car le taux d'échec ruinerait l'expérience utilisateur ». Les deux ne
peuvent pas être vrais dans le même contexte.

**Arbitrage retenu, et pourquoi il diffère d'eux** : Mealie doit produire une recette
STRUCTURÉE directement depuis le texte — d'où son refus. Nous, non : notre texte part à une
IA qui fait la structuration. **Un texte imparfait nous reste exploitable, pas à eux.** Le
nettoyeur maison garde donc sa place en dernier recours — mais comme filet déclaré tel, pas
comme solution.

**DÉCISION SUR READABILITY : NON, mesure à l'appui.** 25 Ko compressés, pour une application
dont tout le JavaScript pèse **31,58 Ko compressés** : l'ajouter **doublerait presque le
téléchargement** de l'app, pour améliorer 25 % des imports que la saisie manuelle couvre déjà.
Le rapport coût/bénéfice ne passe pas sur une app de cuisine utilisée au téléphone.

**CE QUI EST REPRIS DU DOMAINE (volet D)** — les 4 pièges de normalisation documentés, dont
**2 déjà rencontrés sur pièce chez nous** :
| Piège | Vu chez nous ? |
|---|---|
| `recipeInstructions` imbriquées en `HowToSection` → aplatissement RÉCURSIF | pas encore |
| Entités HTML non décodées (`&#039;`, `&frac12;`) | ✅ **750g** |
| Lignes parasites dans `recipeIngredient` | ✅ **750g** (un ingrédient nommé « Ingrédients: ») |
| `recipeYield` jamais un entier propre (`"4 personnes"`, `["2","2 personnes"]`, `"4"`) | ✅ **4 formes différentes sur 5 sites** |
