# LOT 015 — Réglages fiables et cohérents — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — s'exécute après le LOT 012 et AVANT le LOT 013
> **Branche à créer :** `feat/lot15-reglages-fiables`
> **Niveau d'audit : DUR** — le lot touche les sauvegardes, les restaurations et des
> risques de données incohérentes (zones sensibles : `src/state.js`, chemins d'export/import)
> **Effort estimé :** ~2 journées (révisé après l'audit du 2026-07-30 : 10 chantiers,
> dont 2 blocages sur le format du fichier de sauvegarde) · **Version visée :** 5.8

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
fiche `LOT 008 - Donnees en securite [CLOTURE].md` (les protections à ne PAS casser),
et **l'ORACLE COMPORTEMENTAL : monolithe `foodapp-v5-Joel.html` l.6464-6487
(`exportClipboard`), l.6489-6515 (`exportJSON` / `importJSON`)**.

⚠️ **L'oracle a été relu le 2026-07-30 et il change la lecture du lot :** les chantiers
1, 2 et 3 ne sont pas des « améliorations » mais bien des **régressions de migration**
(le monolithe faisait déjà juste). Il révèle aussi deux pertes non repérées au premier
passage (chantier 9).

---

## Objectif

Chaque bouton de la page Réglages doit produire **exactement ce que son titre et son
sous-titre annoncent**. Aujourd'hui, plusieurs cartes mentent : « Copier mon stock » copie
la liste de courses, « Données techniques (JSON) » copie du texte, la carte « Mise à zéro »
annonce d'effacer la clé API alors qu'elle la conserve. La page est contrôlée comme un
**ensemble cohérent** avant que le LOT 013 ne fige son comportement par des tests et que le
LOT 014 ne déplace `exportClipboard`.

## Périmètre — 10 chantiers (tous les arbitrages tranchés par Joel le 2026-07-30)

### 1. « Copier mon stock (liste simple) » copie… la liste de courses

**Aujourd'hui :** le bouton (`index.html:508-514`) promet « Liste brute de vos ingrédients
disponibles », mais `exportClipboard('simple')` (`js/app.js:1163-1171`) filtre `i.inCart`
(les articles À acheter) sous un en-tête « 🛒 LISTE DE COURSES ».

**Attendu :**
**Oracle (monolithe l.6466-6468) :** `const inStock = state.ingredients.filter(i => i.inStock)`
puis `text = inStock.map(i => i.name).join('\n')` — **le stock, confirmé.** Régression nette.

**Attendu :**
- utiliser uniquement les ingrédients réellement **en stock** (`inStock`) ;
- en-tête cohérent avec le titre du bouton (stock, pas courses) ;
- état vide honnête : si le stock est vide, le texte copié le dit — pas de toast de succès
  qui laisse croire qu'une liste utile a été copiée (voir chantier 9 : l'oracle avait
  déjà ce garde-fou).

### 2. « Partager mon stock par rayons » embarque tout l'inventaire

**Aujourd'hui :** `exportClipboard('categorized')` (`js/app.js:1178-1186`) parcourt TOUT
`state.ingredients` avec des statuts ✅/🛒/⚪ — les produits absents et ceux seulement mis
aux courses partent dans le partage.

**Attendu :**
**Oracle (monolithe l.6469-6475) :** groupe le **seul** `inStock` par catégorie, avec
l'emoji de rubrique (`EMOJI_CATEGORY_DEFAULTS`) et des lignes `  - nom`. Régression nette.
⚠️ `EMOJI_CATEGORY_DEFAULTS` est un nom du monolithe : l'équivalent modulaire est
`getCategoryEmoji` (`src/data.js:38`, déjà importé par `js/app.js:19`) — ne pas recréer
une seconde table (SSOT §6).

**Attendu :**
- uniquement les ingrédients **en stock**, regroupés par catégorie ;
- ne pas inclure les produits absents ni ceux seulement placés dans les courses ;
- même exigence d'état vide honnête que le chantier 1.

### 3. « Copier ma liste de courses » oublie les articles libres

**Aujourd'hui :** `exportClipboard('cart')` (`js/app.js:1187-1198`) inclut les ingrédients
`inCart` mais **ignore `state.customCartItems`** (les articles ajoutés à la main dans la
liste de courses).

**Oracle (monolithe l.6476-6479) :** `[...cart.map(i => i.name), ...custom.map(i => i.name)]`
— les deux sources, confirmé. Régression nette.

⚠️ **PIÈGE MAJEUR — `customCartItems` est un champ fantôme dans l'app modulaire.** Aucun
code ne l'écrit ni ne l'affiche aujourd'hui (constat déjà posé par la fiche LOT 007, ligne
216 ; seuls `resetCart`/`resetAllData` le vident). Le monolithe, lui, l'alimentait (l.6110)
et permettait de le retirer (l.4829). **Mais la donnée existe RÉELLEMENT chez Joel** :
son export du 2026-07-29 contient `{ name: "porc haché", emoji: "🥩", source: "ai-extra" }`.
Autrement dit, cet article est déjà invisible dans l'app — l'inclure dans la copie
**récupère une donnée aujourd'hui perdue de vue**, ça ne crée pas une fonctionnalité.

**Conséquences à assumer dans ce lot :**
- le test ne peut PAS passer par l'interface (aucun parcours ne crée d'article libre) :
  il injecte la donnée directement dans l'état, comme le fait déjà `tests/sync-scope.test.js` ;
- **les articles libres n'ont pas de `category`** (structure réelle : `id`, `name`, `emoji`,
  `checked`, `source`) → le classement par rayon doit avoir une **règle explicite tranchée
  ici, pas laissée à l'exécutant**. ⚠️ **CORRECTION du 2026-07-30 : surtout PAS `AUTRES`.**
  `Autres` est à la fois une catégorie légitime (`src/data.js:32`) ET le repli imposé à
  tout ingrédient sans catégorie (`src/state.js:173`) : y verser les articles libres les
  mélangerait à de vrais ingrédients, et un test « jamais `undefined` » passerait au vert
  sans rien prouver. **Règle retenue : une rubrique au nom distinct et non collidable, du
  type `[ ARTICLES LIBRES ]`** ;
- **piège d'ordre :** `groupByCategory` trie les rubriques par tri par défaut
  (`js/app.js:1156`) — la rubrique dédiée sortirait au milieu, pas en fin. La placer en
  fin **sans modifier `groupByCategory`**, qui est partagé avec le format `categorized`
  et dont l'ordre est explicitement volontaire (`js/app.js:1154-1155`) : le pare-feu A/B
  interdit de changer l'ordre d'un format que ce chantier ne vise pas ;
- **hors périmètre :** rebrancher l'ajout/retrait d'articles libres dans l'interface reste
  un sujet à part (à verser au backlog si Joel le souhaite — ce lot ne fait que cesser de
  les ignorer à la copie).

**Attendu :**
- inclure les ingrédients marqués « À acheter » ET les articles libres `customCartItems` ;
- vérifier le résultat vide (les deux sources vides) et le classement par rayon.

### 4. « Données techniques (JSON) » — TRANCHÉ par Joel (2026-07-30) : SUPPRESSION SÈCHE

**Aujourd'hui :** le bouton (`index.html:529-535`) promet « la base technique complète »
en JSON, mais `exportClipboard('full')` (`js/app.js:1172-1177`) produit un texte
d'inventaire à emojis — pas du JSON.

**Décision de Joel : supprimer la carte, sans remplacement.** Analyse à l'appui : après
les chantiers 1-3, tous les besoins réels sont couverts (2 formats de partage du stock,
la liste de courses, et le fichier de sauvegarde pour le dépannage) — un 3e format
« inventaire complet » de 297 lignes dans le presse-papiers ne sert personne, et un vrai
JSON presse-papiers ferait doublon avec « Télécharger une sauvegarde ».

⚠️ **ÉCART ASSUMÉ À L'ORACLE — à ne pas traiter comme un défaut par l'audit Dur.** Le
monolithe possédait bien ce format (l.6480-6481 : nom, catégorie et tags `[stock]`
`[courses]` `[épinglé]` `[surgelé]`). La règle de campagne veut que l'oracle prime ; **ici
Joel tranche au-dessus de l'oracle** — le besoin a disparu, la carte s'en va. C'est une
décision produit datée et tracée, pas un oubli de restauration.

**Attendu :**
- retirer la carte d'`index.html` ET la branche `'full'` d'`exportClipboard` ;
- **3 recherches convergentes** avant chaque retrait (`CLAUDE.md` §5) : appel direct,
  accès dynamique (chaîne `'full'`), configuration/scripts annexes. ⚠️ Le monolithe
  appelle `exportClipboard('cart')` depuis une **seconde entrée** (barre supérieure,
  l.4554) : vérifier qu'aucune entrée équivalente n'existe dans `index.html` avant de
  toucher aux autres formats ;
- pare-feu A/B : la suppression ne touche AUCUN autre format de copie.

### 5. Télécharger / Restaurer une sauvegarde — aller-retour cohérent des coches

**Aujourd'hui (preuves) :**
- `exportJSON` (`src/actions.js:152-168`) exporte `state` seul — **les coches de courses
  `shoppingChecked` n'y sont pas** : c'est un Set séparé (`src/state.js:50`) persisté sous
  sa propre clé (`src/state.js:127-131`) ;
- restaurer un fichier (`importJSON` → `applyExternalState`, `src/actions.js:170-188`)
  laisse donc en place les **anciennes coches** d'un état précédent ;
- `restoreJSON` (`js/app.js:1832-1835`) ne réarme pas le champ fichier — contrairement à
  `importStockOnly` (`js/app.js:1837-1841`) — donc sélectionner **deux fois le même
  fichier** ne déclenche rien la seconde fois ;
- le sous-titre « Télécharger une sauvegarde » (`index.html:542-543`) ne dit pas que la
  clé API est exclue de l'export ;
- le sous-titre « Restaurer » (`index.html:550`) annonce « Remplace TOUTES vos données
  actuelles » — **inexact** : `applyExternalState` → `setState` fusionne
  (`{ ...state, ...data }`, `src/state.js:200-204`), donc **toute clé absente du fichier
  est conservée telle quelle**. Un fichier partiel ne remplace pas tout.

⚠️ **RISQUE PRINCIPAL DU LOT — l'articulation avec la synchro cloud (LOT 007), à traiter
explicitement, c'est ce qui justifie le niveau d'audit DUR :**
- `applyExternalState(data)` planifie un **envoi cloud par défaut** (`scheduleSync = true`,
  `src/state.js:222`) : une restauration de fichier PART vers le cloud ;
- les coches vivent hors de `state` (Set séparé) et le périmètre du document synchronisé
  les inclut (LOT 007 §4.1, `tests/sync-scope.test.js`). Donc si la restauration remplace
  les coches, ce remplacement doit être fait **AVANT** la sauvegarde/l'envoi, pour que
  l'état et les coches partent dans le **même** document ;
- sinon : fenêtre d'incohérence où le cloud reçoit le nouvel inventaire avec les
  ANCIENNES coches — exactement le risque « données incohérentes » que ce lot doit fermer ;
- vérifier aussi le sens inverse : une restauration ne doit pas être écrasée par un pull
  concurrent (réutiliser les garde-fous du LOT 007, ne pas en réinventer).

**Attendu :**
- définir un aller-retour cohérent pour `shoppingChecked` : la sauvegarde emporte les
  coches, la restauration les remplace — restaurer un fichier ne conserve JAMAIS les
  coches d'un état précédent ;
- compatibilité avec les anciennes sauvegardes dépourvues de ce champ (comportement
  défini et testé, pas un plantage ni des coches fantômes) ;
- réarmer le champ fichier après CHAQUE tentative (réussite, erreur, format non reconnu)
  pour pouvoir resélectionner le même fichier ;
- textes honnêtes : rappeler que la clé API locale est **exclue de l'export** et
  **conservée à la restauration** (comportement LOT 008, casses C3a/C3b) ;
- décider et écrire **où** les coches vivent dans le fichier — ⚠️ **voir le chantier 10b
  AVANT de choisir** : une clé posée naïvement à la racine crée un doublon dans l'état et
  casse la compatibilité descendante. Le format retenu doit être documenté dans la fiche
  à l'exécution ;
- **compatibilité descendante** : vérifier ce que fait réellement la 5.5 en ligne d'un
  fichier neuf — l'hypothèse « le champ inconnu est ignoré » est **fausse** telle quelle
  (chantier 10b) ; c'est le format choisi qui doit la rendre vraie.

### 6. « Mise à zéro complète » — le texte de la carte contredit le code

**Aujourd'hui :** la carte (`index.html:575-576`) annonce « Efface absolument tout (Stock,
Favoris, Config) », mais `resetAllData` (`src/actions.js:81-84`) **conserve la clé API**
(et le dit dans son propre confirm) ; le reset est aussi poussé vers le cloud.

**Attendu :**
- conserver le comportement sûr du LOT 008 tel quel (sérialisation avec la synchro, push
  explicite, suggestions IA purgées) — on ne touche PAS au code du reset sans nécessité ;
- corriger le **texte de la carte** : l'inventaire, les favoris et les réglages IA sont
  réinitialisés, la clé API est conservée ;
- préciser que la remise à zéro vise **aussi le cloud**.

### 7. Non-régressions (garde-fous du lot)

- « Importer uniquement le stock » reste une **fusion douce** (pas un remplacement) —
  son COMPORTEMENT ne bouge pas, seuls ses textes sont corrigés (chantier 8) ;
- « Réinitialiser mon panier » continue de vider les ingrédients à acheter,
  `customCartItems` ET `shoppingChecked` ;
- aucune régression des protections du LOT 008 (clé API jamais exportée, point d'entrée
  unique `applyExternalState`, reset sûr).

### 8. Clarté UX de la page (décisions Joel 2026-07-30) — textes et retours, pas de redesign

**Pare-feu A/B strict : ce chantier ne change que des libellés et des messages, jamais un
comportement** (à la seule exception des toasts chiffrés, qui font partie du comportement
attendu des chantiers 1-3).

- **Titres de sections orientés intention, sans jargon** : « Copier dans le
  presse-papiers » → « Partager » · « Fichier JSON » → « Sauvegarde » (le mot JSON reste
  admis dans les sous-titres pour décrire le fichier).
- **Toasts de copie honnêtes et chiffrés** : « Stock copié (23 ingrédients) », « Liste de
  courses copiée (8 articles) »… et état vide explicite (« Votre stock est vide — rien à
  copier ») au lieu du « Copié ! » générique actuel (`js/app.js:1203`).
- **La paire Restaurer / Importer uniquement le stock doit devenir limpide** (constat
  Joel 2026-07-30 : distinction pas claire) :
  - « Restaurer une sauvegarde » = **remplacement total** — le sous-titre doit le dire
    en une phrase simple (tout est remplacé par le fichier, clé API locale conservée) ;
  - « Importer uniquement le stock » = **fusion douce** — sous-titre actuel
    (`index.html:557`) doublement inexact : il ne met pas à jour que la « disponibilité »
    (il applique aussi panier, épinglés, congelé — `src/actions.js:216-218`) et il peut
    **ajouter** des ingrédients inconnus (`src/actions.js:221-227`). Réécrire le
    sous-titre pour dire la vérité, SANS changer le comportement ;
  - son toast dit « 📥 Restauration : X mis à jour, Y ajoutés » (`src/actions.js:231`) —
    le mot « Restauration » entretient la confusion avec le bouton d'à côté : reformuler
    (ex. « Stock fusionné : X mis à jour, Y ajoutés ») ;
  - les deux boutons acceptent le même fichier (celui de « Télécharger une sauvegarde ») :
    les sous-titres doivent le rendre évident.

### 9. Deux régressions de copie révélées par l'oracle (relecture du 2026-07-30)

Absentes du brief initial — trouvées en relisant `exportClipboard` du monolithe.

- **Le garde-fou « rien à copier » a été perdu.** Le monolithe sortait AVANT toute copie
  quand le texte était vide : `if (!text) { toast('Rien à copier', 'error'); return; }`
  (l.6483). Aujourd'hui, un stock vide copie quand même un en-tête suivi de « (Vide) » et
  affiche un toast de succès. **C'est la cause racine des « états vides malhonnêtes »** des
  chantiers 1-3 : restaurer ce garde-fou les règle tous d'un coup — une seule correction,
  pas quatre (SSOT).
- **Le repli de copie a été perdu.** Le monolithe, si `navigator.clipboard` échouait,
  retombait sur un `<textarea>` + `document.execCommand('copy')` (l.6484-6486). Aujourd'hui
  l'échec donne juste « Erreur lors de la copie » (`js/app.js:1204-1206`) et l'utilisateur
  n'a aucun recours. À restaurer (contexte non sécurisé, navigateur ancien, permission
  refusée).

**Écart assumé sur le FORMAT des lignes :** le monolithe copiait des noms nus
(`i.name`) ; l'app actuelle ajoute emoji et statut. **On garde le format actuel**, plus
lisible pour un partage — écart délibéré à l'oracle, tracé ici pour l'audit Dur.
⚠️ Conséquence à assumer : une fois la source restreinte à `inStock` (chantiers 1-2), le
marqueur de statut (`js/app.js:1175` et `1183`) vaudra **toujours ✅** — information morte
conservée par choix, ou marqueur retiré. À trancher à l'exécution, pas à improviser.

### 10. Le PÉRIMÈTRE du fichier de sauvegarde — 2 blocages trouvés à l'audit du 2026-07-30

**C'est le point le plus grave de la relecture, et il conditionne tout le chantier 5.**

**a) BLOQUANT — la sauvegarde emporte l'état d'écran, et le restaurer casse l'affichage.**
`exportJSON` sérialise `state` en ENTIER (`src/actions.js:155`) : partent donc dans le
fichier `currentView`, `search`, `filter`, `showInStockOnly`, `showInCartOnly`,
`aiSuggestions`, `currentSuggestionIdx`, `lastSync` (`src/state.js:40-47`). Au démarrage,
`loadState` neutralise explicitement recherche et filtres (`src/state.js:111-114`,
commentaire « for safety ») — **mais `applyExternalState` ne le fait jamais**
(`src/state.js:222-231` → `setState` → `sanitizeGlobalState`, qui n'y touche pas).
Conséquence concrète pour Joel : une sauvegarde faite pendant qu'un filtre « en stock » ou
une recherche étaient actifs, une fois restaurée, **affiche un inventaire filtré ou vide**,
et la boîte de recherche paraît vide alors que le filtre s'applique (rien ne réécrit le
champ — `js/app.js:708-713`). `currentView` restauré fait en plus changer d'écran tout seul.
**L'oracle faisait juste :** liste blanche de 5 clés à l'export (l.6490) et
`switchView('pantry')` après import (l.6509). C'est donc une **régression de migration
supplémentaire**, non répertoriée jusqu'ici.

→ **Attendu : définir une LISTE BLANCHE explicite du fichier de sauvegarde** (données
durables uniquement : inventaire, favoris, extras, articles libres, réglages IA sans clé,
coches) + un horodatage `exportedAt` (l'oracle l'avait, l'app l'a perdu). Et **neutraliser
recherche/filtres/vue à la restauration**, comme le fait déjà `loadState`.

**b) BLOQUANT — mettre les coches « à la racine du fichier » créerait un doublon dans
l'état (violation SSOT §6).** `setState` fusionne (`{ ...state, ...data }`,
`src/state.js:201`) : une clé `shoppingChecked` dans le fichier deviendrait un **tableau
`state.shoppingChecked`** cohabitant avec le **Set** `shoppingChecked` (`src/state.js:50`)
— deux représentations de la même donnée. Rien ne l'élague, elle serait persistée puis
re-exportée indéfiniment. Cela **invalide aussi la compatibilité descendante annoncée** :
la 5.5 en ligne n'ignorerait pas le champ, elle l'absorberait et le figerait.

→ **Attendu : les coches entrent par `replaceShoppingChecked` (`src/state.js:86-89`), pas
par le `spread` de `setState`.** Le champ du fichier doit être extrait AVANT et retiré de
l'objet passé à `applyExternalState`. Vérifier ensuite qu'aucune clé fantôme ne subsiste
dans `state`.

**c) Les coches restaurées doivent être filtrées.** Le LOT 008 (chantier 7) garantit que le
Set ne contient que des ids réellement « à acheter » (verrouillé par
`tests/actions-data.test.js:308-339`). Une restauration brute réintroduirait des ids
fantômes, invisibles à l'écran (`src/ui/shopping.js:42`) mais poussés au cloud
(`src/services/firebase.js:61`). → ne garder que les ids présents dans l'inventaire
restauré et marqués `inCart`.

**d) Un fichier à inventaire VIDE passe la garde d'entrée.** `importJSON` ne teste que la
présence de `data.ingredients` (`src/actions.js:175`) — or `[]` est « vrai ».
`sanitizeGlobalState` reconstruit alors les ~297 ingrédients par défaut
(`src/state.js:161-169`) et l'envoi cloud part quand même. → durcir la garde (tableau NON
vide), en s'alignant sur celle du chemin cloud (`js/app.js:370-376`), plus stricte.

## Frontières avec les autres lots

- **LOT 011** : la carte « Transformer un texte en recette » (lecture URL propre, titre
  automatique, nettoyage des champs, aperçu) reste au LOT 011 — hors périmètre ici.
- **LOT 012** : la barre supérieure de Réglages reste au LOT 012.
- **LOT 013** (après ce lot) — ⚠️ **CHEVAUCHEMENT À TRANCHER AVANT OUVERTURE.** La fiche
  du LOT 013 se réserve nommément la ligne « `exportClipboard` | 1 test par format + état
  vide + ordre conservé » (`LOT 013 …md:37`), alors que le plan de test ci-dessous exige
  déjà un test par format. **Règle retenue : le LOT 015 écrit les tests de ce qu'il
  CORRIGE** (c'est la preuve de sa propre correction, et la gouvernance interdit de dire
  « fini » sans preuve) ; **le LOT 013 retire ces lignes de son périmètre** et se concentre
  sur ce qu'il est seul à couvrir. À répercuter dans la fiche du LOT 013 au moment de
  l'ouverture de ce lot. Aligner aussi la MÉTHODE : le LOT 013 §D impose l'accès **via
  `window`** et interdit l'extraction (l.67-79) — le LOT 015 doit suivre la même
  convention, donc **ne pas ajouter `exportClipboard` au bloc `export {}`**
  (`js/app.js:505-521`) : la fonction n'est exposée que sur `window` (`js/app.js:38-42`,
  `2009-2031`), et c'est suffisant pour la tester.
- **LOT 014** : déplacera ensuite `exportClipboard` hors de `js/app.js` **sans changer
  son comportement** (ce lot-ci fixe le comportement, le 014 déplace le code).

## Plan de test

⚠️ **Contrainte d'environnement mesurée le 2026-07-30 :** sous jsdom, `navigator.clipboard`
**et** `document.execCommand` sont `undefined`. Conséquences obligatoires :
- chaque test de copie doit **simuler `navigator.clipboard`**, sinon le `try` de
  `js/app.js:1201-1207` avale une erreur et le test valide en réalité le chemin d'échec ;
- le repli de copie ne peut être prouvé que par **espionnage d'un `execCommand` simulé** —
  et le code du repli doit **vérifier l'existence de `document.execCommand` avant de
  l'appeler**, sinon il plante en test (et sur certains navigateurs).

- [ ] Un test par format de copie restant (`simple`, `categorized`, `cart`) + preuve de
      la suppression propre de `'full'` (3 recherches convergentes consignées, aucune
      référence morte)
- [ ] Tests des toasts chiffrés et des messages d'état vide (chantiers 1-3 et 8)
- [ ] Tests avec stock vide, courses vides, et articles libres (`customCartItems`)
- [ ] Test aller-retour sauvegarde → restauration **avec coches** (les anciennes coches ne
      survivent jamais)
- [ ] Test d'une ancienne sauvegarde sans le champ des coches (compatibilité)
- [ ] Test de deux sélections successives du même fichier (champ réarmé)
- [ ] Preuve que la **clé API ne sort jamais** (presse-papiers ET fichier)
- [ ] Garde-fou « rien à copier » : chaque format, source vide → aucune écriture dans le
      presse-papiers + message d'erreur (chantier 9)
- [ ] Repli de copie : `navigator.clipboard` en échec → le texte est quand même copié
      (chantier 9)
- [ ] Articles libres sans catégorie → rubrique dédiée, jamais `undefined` (chantier 3)
- [ ] **Synchro :** restauration d'un fichier → l'état ET les coches partent dans le
      MÊME document cloud (chantier 5) ; aucune fenêtre avec les anciennes coches
- [ ] Restauration d'un fichier **partiel** : comportement conforme au texte affiché
      (les clés absentes sont conservées — chantier 5)
- [ ] **Sauvegarde faite avec un filtre/une recherche actifs → restaurée, l'inventaire
      s'affiche en entier** (aucun filtre, aucune recherche, vue par défaut — chantier 10a)
- [ ] Le fichier exporté ne contient **que** la liste blanche (aucun champ d'écran, aucune
      suggestion IA) + `exportedAt` (chantier 10a)
- [ ] Après restauration, `state` ne contient **aucune clé fantôme** `shoppingChecked` —
      les coches vivent dans le Set seul (chantier 10b)
- [ ] Coches restaurées **filtrées** : un id absent de l'inventaire ou non « à acheter »
      n'entre jamais dans le Set (chantier 10c)
- [ ] Fichier avec `ingredients: []` → **refusé**, pas de reconstruction des 297 par
      défaut, aucun envoi cloud (chantier 10d)
- [ ] Manuels (Joel) : vérification navigateur de CHAQUE carte de Réglages — le résultat
      correspond au titre et au sous-titre

## Critères d'acceptation

- [ ] Suppression sèche du bouton « Données techniques (JSON) » appliquée (arbitrage
      Joel du 2026-07-30) et retouches UX du chantier 8 en place
- [ ] Validation unifiée verte + build OK
- [ ] **Audit DUR final** (boucle par étape + /ultra-audit — zones sauvegardes/restauration)
- [ ] Chaque carte de Réglages vérifiée en navigateur par Joel

## Traçabilité

- Origine : brief de Joel du 2026-07-30 (fiabilité complète de la page Réglages) ;
  arbitrages tranchés le même jour (suppression sèche du bouton JSON, retouches UX)
- Dépend de : LOT 012 (ordre de campagne) · protections du LOT 008 (à préserver)
- Bloque : LOT 013 (tests figés sur le comportement corrigé) · LOT 014 (déplacement de
  `exportClipboard` à comportement constant)
- Note : les lignes citées dans le brief d'origine ont été revérifiées sur le code du
  2026-07-30 et corrigées dans cette fiche (léger décalage de numérotation).
- **Relecture du 2026-07-30 (avant ouverture)** : confrontation à l'oracle monolithe et au
  moteur de synchro. Ajouts : chantier 9 (garde-fou « rien à copier » + repli de copie),
  risque synchro du chantier 5, champ fantôme `customCartItems` et sa règle de classement
  (chantier 3), écarts à l'oracle assumés (chantiers 4 et 9), inexactitude du texte
  « Remplace TOUTES vos données » (chantier 5).
- **Audit adversarial du 2026-07-30 (avant ouverture, agent dédié)** : 8 angles morts
  trouvés, tous intégrés. Deux BLOQUANTS → chantier 10 (l'état d'écran part dans la
  sauvegarde et casse l'affichage à la restauration ; les coches à la racine créeraient un
  doublon SSOT). Cinq IMPORTANTS → contrainte jsdom du plan de test, rubrique `AUTRES`
  collidante corrigée en `ARTICLES LIBRES`, coches restaurées à filtrer, garde d'entrée
  d'un inventaire vide, chevauchement de tests avec le LOT 013 tranché. Un MINEUR →
  `getCategoryEmoji` au lieu du nom monolithe, marqueur ✅ devenu constant.
  L'audit a aussi **levé une inquiétude** : les garde-fous du LOT 007 protègent déjà une
  restauration d'un pull concurrent (`js/app.js:223-232, 357, 377-382`) — rien à ajouter.
- **À verser au backlog si Joel le souhaite** (hors périmètre de ce lot) : rebrancher
  l'ajout/retrait d'articles libres dans la liste de courses — le champ existe, la donnée
  existe, mais aucune interface ne le nourrit depuis la migration.
