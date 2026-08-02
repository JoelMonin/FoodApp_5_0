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
| D — fiche structurée | ✅ | `src/utils/recipeSchema.js` + `tests/recipe-schema.test.js` (24 tests) + 10 tests d'intégration · mutations **D1→D9** rouges · audit de spec Codex intégré (§10.1 bis) |

**Validation finale du lot : 912/912 Vitest · 16/16 Pytest · types OK · build OK.**
**Preuve par retrait cumulée : 16 mutations, 16 rouges, 0 nulle** (7 volets 0/A/B + 9 volet D).

### ÉPREUVE DU RÉEL DU VOLET D (13 sites, 2026-08-02)

**10 fiches officielles lues / 3 replis.** Le parcours complet a été exécuté site par site :

| Chemin | Sites | Résultat |
|---|---|---|
| ✅ Fiche du site | Marmiton (×2), 750g, Marie Claire, Journal des Femmes, Deliacious, Mes brouillons, By ACB 4 you, Aux Fourneaux, Un déjeuner de soleil | **722 à 1 573 caractères**, contre 139 000 à 741 000 pour la page |
| ⚠️ Repli nettoyeur | Chef Simon, PimpUp, Healthy Julia | Comportement du volet B, inchangé, + message honnête |

**Chef Simon bascule correctement** : sa fiche existe mais ne porte aucune étape — la règle
du finding 3 la refuse au lieu de livrer une recette sans préparation.

**Ce que l'IA reçoit désormais pour la blanquette de Joel** : les 13 ingrédients avec leurs
quantités et les 7 étapes au mot près, **1 257 caractères au lieu de 290 414**.

**Limite connue, NON corrigée volontairement** : la `description` de Marmiton porte son
argumentaire de référencement (« Notée 4.9/5 par 2776 membres Marmiton »). ~150 caractères
sur 1 257, sans effet observé — et la leçon du §7 vient d'être payée : on ne taille pas une
règle sur mesure pour un site à la première gêne.

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

---

## 10. SPEC DU VOLET D — LECTURE DE LA FICHE STRUCTURÉE (à auditer AVANT implémentation)

**Validé par Joel le 2026-08-02** (« oui, on fera le numéro 5 bien sûr »), après évaluation
comparée des alternatives (URL directe à l'IA, construction sans IA, Readability — toutes
trois écartées, motifs au §9 et dans l'échange du 2026-08-02). **Audit de spec demandé par
Joel à Codex AVANT la première ligne de code.**

### 10.1 Objectif en une phrase

Quand le site importé publie sa recette en fiche structurée (schema.org `Recipe`), c'est
CETTE fiche — normalisée — qui remplit le champ, à la place du texte de page nettoyé ;
sinon, rien ne change par rapport à aujourd'hui, et Joel est prévenu dans les deux cas.

### 10.1 bis — AUDIT DE SPEC CODEX DU 2026-08-02 : **GO AVEC RÉSERVES**, 6 findings

Audit demandé par Joel AVANT la première ligne de code (quota Codex revenu). **Les 6 findings
ont été contre-vérifiés sur pièce avant toute correction — aucun n'a été appliqué sur parole.**
Bilan : **4 confirmés, 1 partiellement, 1 plausible. Aucun à rejeter.** La spec ci-dessous est
la version CORRIGÉE ; les phrases contestées n'y figurent plus.

| # | Finding Codex | Contre-vérification | Suite donnée |
|---|---|---|---|
| 1 | Le repli Markdown après échec réseau contredit l'arbitrage LOT 011 §9 Q2 | ✅ **CONFIRMÉ** — Q2 lu dans le texte : « un seul chemin, un seul point de défaillance » | **Décision de Joel (D1 = A)** : un échec de lecture reste un échec sec |
| 2 | « 10 s PAR lecture » contredit l'acquis « délai 10 s » et porte l'attente à 20 s | ✅ **CONFIRMÉ, ma spec se contredisait** — le verrou `ai-url-fetch.test.js:107` n'avance qu'une fois de 10 s | **Décision de Joel (D2 = A)** : budget GLOBAL de 10 s |
| 3 | Plusieurs nœuds `Recipe` : sélection dépendante de l'ordre | 🟡 **PARTIEL** — mesuré sur 10 pages : 9 n'ont qu'une recette, 1 (« Mes brouillons ») en a **3 mais identiques**. Le danger décrit (recette voisine qui gagne) **n'est pas observé** ; le trou de spec, lui, est réel | Règle explicite : **la fiche la plus complète**, jamais « la première » |
| 4 | « Exploitable » laisse passer une fiche d'intitulés | 🟡 **PLAUSIBLE, non prouvé** (son exemple est hypothétique) — mais le trou se bouche pour rien | Les lignes qui ne sont qu'un intitulé de section sont retirées AVANT le jugement |
| 5 | Critères 4, 6, 8 non automatisables tels qu'écrits | ✅ **CONFIRMÉ** pour 4 et 6 (« toast honnête », « forme invalide » non définis) | Critères réécrits avec textes exacts et formes énumérées |
| 6 | `recetteEnTexte` (afficheur) réutilisé comme sérialiseur d'entrée IA | ✅ **CONFIRMÉ — le meilleur finding.** Un changement cosmétique de l'aperçu (majuscules, emojis, compteurs) modifierait **en silence le message envoyé à l'IA** | **Deux fonctions séparées** : `recetteEnTexte` affiche, `ficheEnTexteSource` alimente l'IA |

**⚠️ CONSÉQUENCE DU FINDING 5 À DÉCLARER, PAS À SUBIR** : le critère « les tests existants
restent verts SANS modification » **ne peut pas tenir**. Vérifié :
`tests/ai-url-fetch.test.js:57` exige `expect(fetch).toHaveBeenCalledTimes(1)`, or le chemin
sans fiche en fait désormais deux. **Ce test sera MODIFIÉ en connaissance de cause** — son
intention (URL exacte, jamais allorigins) est préservée, seul le comptage incident change.
`:93` (échec HTTP) reste à 1 appel grâce à D1 = A, et reste vert sans modification.

### 10.2 Parcours utilisateur (AUCUN changement d'interface)

1. Joel colle l'URL → « 🌍 Lire la page » (bouton existant, inchangé).
2. Lecture de la page en HTML via le lecteur ACTUEL (`r.jina.ai`, en-tête
   `x-return-format: html`). **Même service qu'aujourd'hui, autre format de sortie** —
   l'arbitrage LOT 011 §9 Q2 (« un seul lecteur, aucun repli sur un AUTRE service ») est
   respecté : Jina reste l'unique lecteur.
3. Fiche trouvée ET exploitable → le champ reçoit le TEXTE lisible composé depuis la fiche,
   le titre reçoit `fiche.name`, toast littéral :
   `✅ Fiche officielle du site trouvée.`
4. Lecture réussie mais AUCUNE fiche exploitable → SECONDE lecture, en Markdown (chemin
   actuel inchangé : `nettoyerPageWeb` + `extraireTitrePage`), toast littéral :
   `⚠️ Pas de fiche officielle — texte brut récupéré, relisez-le avant de transformer.`
   Deux lectures séquentielles UNIQUEMENT dans ce cas.
5. La suite est STRICTEMENT inchangée : « Transformer avec l'IA » → aperçu complet (volet A)
   → sauvegarde. L'IA reste l'unique fabricant de la recette finale.

**DÉCISION D1 DE JOEL (2026-08-02) = A — un échec de lecture reste un échec sec.** Si la
lecture HTML échoue (réseau, HTTP en erreur, réponse vide), on s'arrête là avec le message
littéral de l'oracle `Erreur de lecture. Vérifiez l'URL ou copiez le texte manuellement.` —
**aucune seconde tentative**. L'arbitrage LOT 011 §9 Q2 (« un seul chemin, un seul point de
défaillance ») est donc INTÉGRALEMENT respecté : la seconde lecture n'est pas un repli après
panne, c'est la suite normale d'une lecture RÉUSSIE. Argument chiffré à l'appui : le mode de
lecture HTML a été essayé sur 12 pages réelles, il a fonctionné 12 fois sur 12.

**DÉCISION D2 DE JOEL (2026-08-02) = A — budget GLOBAL de 10 secondes pour toute l'action**,
partagé par les deux lectures (un seul `AbortController`, un seul minuteur). Joel n'attend
jamais plus qu'aujourd'hui, et le verrou `ai-url-fetch.test.js:107` reste vert sans y toucher.
Si le budget est épuisé pendant la seconde lecture, message d'échec identique.

### 10.3 Découpage technique

**NOUVEAU MODULE `src/utils/recipeSchema.js`** — pur, zéro dépendance, comme `webClean.js` :
- `lireFicheRecette(html)` : trouve les blocs `<script type="application/ld+json">`
  (via `DOMParser`, PAS de regex sur le HTML), collecte **TOUS** les nœuds `@type: Recipe`
  (tolère le tableau de types, la récursion `@graph`, les tableaux racine), les normalise,
  et rend **LA PLUS COMPLÈTE** (nombre d'ingrédients + nombre d'étapes) parmi les
  exploitables — jamais « la première trouvée » (**finding 3**). Rend `null` sinon.
- `ficheEnTexteSource(fiche)` : sérialiseur DÉDIÉ à l'entrée IA — texte nu, **sans emoji,
  sans majuscules décoratives, sans compteur**. Volontairement SÉPARÉ de `recetteEnTexte`
  (**finding 6**) : l'un habille un aperçu pour Joel, l'autre alimente un message envoyé à
  l'IA. Les confondre ferait qu'un jour, changer la présentation à l'écran changerait le
  prompt en silence.
- `normaliserFiche(nœud)` : rend `{ name, description, people, time, ingredients[], steps[] }`
  ou `null`, en traitant les 4 pièges documentés (§9) :
  - `recipeIngredient` : tableau OU chaîne unique à retours ligne (Marie Claire) → liste ;
    puces retirées ; entités HTML décodées (`&#039;`, `&frac12;`…) ; lignes parasites
    éliminées (vides, se terminant par `:` comme « Ingrédients: » — cas 750g).
  - `recipeInstructions` : aplatissement RÉCURSIF (chaînes, `HowToStep.text`,
    `HowToSection.itemListElement`) ; entités décodées ; préfixes parasites
    (« Préparation: ») retirés.
  - `recipeYield` : chaîne, tableau ou nombre → premier entier trouvé, sinon absent.
  - Durées ISO 8601 (`PT2H15M`, `PT0H15M`) → « 2 h 15 », « 15 min » ; forme illisible → champ
    simplement absent (jamais d'erreur).
- `ficheExploitable(fiche)` : `name` non vide + ≥ 1 ingrédient + ≥ 1 étape (**cas Chef
  Simon** : fiche présente avec 0 étape → INEXPLOITABLE → repli). **Le jugement intervient
  APRÈS le retrait des lignes qui ne sont qu'un intitulé de section** (« Ingrédients »,
  « Préparation », « Instructions », « Étapes », avec ou sans deux-points) — **finding 4** :
  sans ce retrait, une fiche ne contenant que ces intitulés serait déclarée exploitable et
  remplacerait silencieusement un repli propre. Décodage des entités par `DOMParser` sur du
  texte inerte, JAMAIS par `innerHTML` sur le DOM vivant.

**MODIFIÉ `src/ui/pasteRecipe.js`** — `fetchRecipeFromUrl` orchestre : lecture HTML → fiche →
`ficheEnTexteSource` ; seconde lecture Markdown seulement si la première a RÉUSSI sans livrer
de fiche exploitable. Un seul `AbortController` pour les deux (budget global, D2).

**AUCUN changement à** : `index.html` (zéro élément, zéro `onclick`), `gemini.js`,
`recipeText.js`, `webClean.js`, aux réglages, à `window` (verrou de parité non concerné).

### 10.4 Critères d'acceptation (tous vérifiables par test automatisé, données réelles figées)

1. **Blanquette Marmiton** (fiche réelle recopiée en test) : champ = 13 ingrédients avec
   quantités + 7 étapes ; titre = le `name` de la fiche.
2. **750g** : la ligne parasite « Ingrédients: » n'apparaît pas ; `&#039;` devient `'`.
3. **Chef Simon** (fiche à 0 étape) : repli sur le nettoyeur + toast « pas de fiche ».
4. **Page sans fiche** : le champ reçoit exactement `nettoyerPageWeb(texte)` et le titre
   exactement `extraireTitrePage(texte)` (donc le comportement du volet B, déjà verrouillé
   par ses propres tests), plus le toast **littéral** `⚠️ Pas de fiche officielle — texte
   brut récupéré, relisez-le avant de transformer.` *(réécrit — finding 5)*
5. **`recipeYield`** : les 4 formes relevées (`"4 personnes"`, `["2","2 personnes"]`, `"4"`,
   `3`) donnent toutes un entier.
6. **Durées** : `PT2H15M` → « 2 h 15 » ; `PT25M` → « 25 min » ; `PT0H15M` → « 15 min » ;
   `PT1H` → « 1 h ». **Formes invalides ÉNUMÉRÉES et testées une par une** : `""`, `"1 hour"`,
   `"90"`, `90`, `null`, `undefined`, `{}` → le champ `time` est ABSENT de la fiche
   normalisée, et `normaliserFiche` rend quand même une fiche exploitable si le reste est
   bon. *(réécrit — finding 5 : « forme invalide » et « jamais de plantage » n'étaient pas
   définis)*
7. **`HowToSection` imbriquées** (cas synthétique, pas encore rencontré) : étapes aplaties
   dans l'ordre.
8. **Plusieurs nœuds `Recipe`** *(finding 3)* : sur trois nœuds dont un seul complet, c'est
   le complet qui gagne, quel que soit son rang dans le document.
9. **Fiche d'intitulés seuls** *(finding 4)* : une fiche dont tous les ingrédients et étapes
   sont des intitulés de section est déclarée INEXPLOITABLE → repli.
10. **Acquis intacts** : budget 10 s, réponse IA invalide → texte intact (LOT 014 §C), aperçu
    complet (volet A), remise à zéro à la réouverture (LOT 006). **Vérifié par la validation
    unifiée + relecture du diff** — et non par un test applicatif, cette exigence portant sur
    le diff et non sur un comportement *(reformulé — finding 5)*. **Une seule modification de
    test existant est prévue et déclarée** : `ai-url-fetch.test.js:57` (cf. §10.1 bis).

### 10.5 Tests et preuves prévus

- `tests/recipe-schema.test.js` (NOUVEAU) : caractérisation du normaliseur sur les formes
  réelles des 5 sites + `HowToSection` synthétique + entrées dégradées (`null`, HTML sans
  script, JSON invalide, fiche vide).
- `tests/ai-url-fetch.test.js` (ÉTENDU) : les 3 chemins de `fetchRecipeFromUrl`
  (fiche exploitable / fiche inexploitable / pas de fiche), toasts compris.
- Preuve par retrait prévue : ≥ 6 mutations nommées (détection fiche, exploitabilité,
  chaque normalisation, ordre du repli).
- `PROJECT_MAP.md` : entrées `recipeSchema.js` + test, dans le même commit.

### 10.6 Limites assumées (déjà actées par Joel)

- Page HTML plus lourde à télécharger (300-750 Ko vs 25 Ko) — sensible en 4G, prix du gain.
- Pages sans fiche : deux lectures séquentielles, donc plus lentes qu'aujourd'hui.
- P2 (apostrophes dans le prompt) : décision SÉPARÉE, hors de cette spec.
