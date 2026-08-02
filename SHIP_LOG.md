# SHIP LOG - FoodApp

## État du Projet
- **Version actuelle** : 5.15.0
- **Dernière mise à jour** : 02/08/2026
- **Statut** : Version 5.15 publiée (LOTS 025-027) — l'import de recette lit la fiche
  officielle que les sites publient pour les machines, l'aperçu montre la recette entière,
  les prompts de génération sont soignés (catégories fournies, anti-répétition 60 min,
  qualité d'étapes partagée, SSOT), et l'option Keto rejoint les régimes.

## Historique des modifications
- [x] [VERSION 5.15 - OnLine] 02/08/2026 : Publication des lots 025 à 027
    - **LOT 025 — Amélioration IA** : né d'un constat de Joel (recette Marmiton « perdue »
      après transformation — elle existait, l'écran ne montrait que la phrase d'accroche).
      L'aperçu montre désormais la recette ENTIÈRE ; et surtout **l'import lit la fiche
      officielle `schema.org/Recipe`** que les sites publient pour les machines (10 sites
      sur 13 mesurés, dont 6 jamais vus, choisis à l'aveugle) — pour la blanquette témoin :
      1 257 caractères envoyés à l'IA au lieu de 290 414. Sans fiche : repli sur le nettoyeur
      avec message honnête, puis collage manuel. + P2 : l'IA ne mange plus les apostrophes.
      2 audits Codex (spec : 6 findings traités · diff final : **GO**)
    - **LOT 026 — Prompts de génération** : 5 chantiers décidés par Joel après audit des
      prompts — la liste des catégories enfin DONNÉE à l'IA, bouton 🎲 supprimé (décision
      produit : du théâtre), anti-répétition sur 60 min en série (mémoire de session
      uniquement), même exigence de qualité d'étapes dans les deux prompts (autosuffisantes :
      durées, températures, repères concrets), SSOT des consignes communes. + correctif
      post-essai réel : plafond de sortie doublé (16384), erreurs en français affichées 6 s.
      Audit final Codex : **GO** (2 findings contre-vérifiés par mutation puis corrigés)
    - **LOT 027 — Option Keto** : 6ᵉ puce diététique. 1 ligne d'HTML, ZÉRO JS de production
      (toute la chaîne était générique), 6 tests neufs dont la PREMIÈRE couverture de la
      ligne « RÉGIMES & EXCLUSIONS » du prompt. Publié sans essai préalable par décision
      de Joel (feu vert direct, tracé fiche §5-6)
    - Refusé par Joel, à ne pas re-proposer : muscler la phrase « TRÈS CRÉATIF »
    - Métriques : types OK + 934/934 Vitest + 16/16 Pytest verts, build OK ·
      33 mutations rouges cumulées sur les 3 lots (18+12+3), 0 nulle
- [x] [GOUVERNANCE - non publié] 02/08/2026 : Nettoyage du backlog et registre des dettes
    - **Aucun code applicatif touché** — uniquement des documents de suivi. La construction
      produit des fichiers identiques ; rien ne change à l'écran
    - **Nettoyage des 4 fiches de backlog**, relues et re-vérifiées dans le code point par
      point. Elles avaient vieilli en silence : **toutes les références de ligne de la fiche
      « Durcissements » étaient fausses** (elle citait `js/app.js:2135` et `:2781`, alors que
      ce fichier ne fait plus que 568 lignes depuis le LOT 018) et la fiche « Accessibilité »
      visait `css/style.css`, découpé en 13 sections depuis le LOT 014 — y écrire une règle
      est même devenu interdit par un verrou
    - **Cinq points étaient déjà réglés** sans que personne ne l'ait noté : articles libres
      supprimés, modale morte retirée, `sanitize()` supprimée, deux défauts de catégorisation
      corrigés. Ils dormaient dans la liste comme du travail restant
    - **Un chiffre corrigé** : les temporisations sans test étaient annoncées « 9 sur 20 »,
      elles sont **5 sur 16** — recomptées sur le code d'aujourd'hui
    - **2 fiches fermées** (Régressions de la migration : zéro case non cochée, conservée
      pour son §5 « faux morts », garde-fou permanent · Second rangement de `app.js` :
      absorbée par les LOTS 017/018, cible « sous 700 lignes » dépassée à 568)
    - **Création de `audits/BACKLOG_TECHNIQUE.md`**, le registre des dettes techniques. Il
      était réclamé par l'étape 5bis du démarrage de session depuis sa création mais
      **n'avait jamais existé** — vérifié, aucune trace dans tout l'historique git. Les
      10 findings y sont **déplacés, pas copiés** (F-001 à F-010) : un finding n'a qu'un seul
      domicile, sinon les deux versions divergent
    - **La dette la plus risquée, désormais tracée (F-002)** : restaurer une sauvegarde hors
      ligne puis se reconnecter n'est couvert par **aucun test** — rien ne garantit que c'est
      l'état restauré qui part, et non l'ancien contenu du cloud qui revient l'écraser
    - **Frontière posée** pour ne plus se reposer la question : un CHANTIER reste au backlog
      produit, un FINDING va au registre. L'accessibilité reste donc un chantier — et le seul
      encore ouvert (6 findings re-mesurés et tous confirmés : 47 `<div>` cliquables,
      0 attribut d'accessibilité, cibles tactiles à 32 et 22 px pour 44 attendus)
    - **Leçon consignée** : une fiche qui cite des numéros de ligne se périme au premier
      rangement — aucune citation ne vaut sans re-vérification
    - **Fusionné dans `main` en local le 02/08/2026, sciemment NON publié** (décision de
      Joel) : l'envoi vers GitHub attendra d'être groupé avec un prochain lot
    - Métriques : types OK + 842/842 Vitest + 16/16 Pytest verts, build OK
- [x] [VERSION 5.14 - OnLine] 01/08/2026 : Publication des lots 021 à 024
    - Quatre lots chaînés, nés de l'évaluation de la qualité du code demandée par Joel —
      publiés d'un bloc, comportement quasi entièrement inchangé
    - **LOT 021 — Le vérificateur de types** : relit le JavaScript existant sans rien
      convertir. 128 signalements au premier passage → **0**, sans qu'une ligne de
      comportement ne change (tests identiques avant/après). 87 des 128 dus à une seule
      cause. Le défaut du LOT 017 (imports cassés, 798 tests verts) est rejoué et attrapé
      en **1,2 s** — la validation unifiée passe de 3 à **4 étapes**, le vérificateur en tête
    - **LOT 022 — La fiche de réglages IA toujours complète** : née d'un constat du LOT 021.
      Une restauration cloud/fichier sans réglages envoyait littéralement « Exactement
      **undefined** personnes » à Gemini. Un seul gardien comble les cases absentes sans
      jamais toucher à un choix (`0` et `''` compris). **Le premier endroit diagnostiqué
      était le mauvais** — corrigé, prouvé par mutation (3/3)
    - **LOT 023 — La jauge de créativité ne ment plus** : ressenti de Joel (« on a bricolé
      un truc »). Le curseur avait 101 positions pour seulement 3 résultats réels, sans
      qu'aucun ne soit jamais mis en évidence. Curseur à 3 arrêts fermes, libellé actif
      visible en direct. **La consigne envoyée à l'IA n'a pas changé d'un mot**, vérifié par
      mutation (4/4)
    - **LOT 024 — Nettoyage + une auto-correction.** Sweep des comments-dette : périmètre
      bien plus étroit que redouté (6 cas sur tout `src/`, 3 traités). `foodapp-v5-Joel.html`
      étiqueté ARCHIVE en tête de fichier. **Le plus notable** : en préparant la correction
      des « chiffres faux du LOT 018 » que j'avais moi-même signalés la veille, un réaudit
      git ligne par ligne a montré que les chiffres déjà publiés étaient **corrects** — mon
      diagnostic de la veille, lui, était faux (deux registrars oubliés dans un `grep` trop
      rapide). Rien à corriger dans les fiches LOT 017/018 ; corrigé où l'erreur vivait
    - Métriques : types OK + 842/842 Vitest + 16/16 Pytest verts, build OK
- [x] [VERSION 5.13 - OnLine] 01/08/2026 : Publication du lot 020
    - Lot 020 — Ranger les achats : une barre collante « 🏠 Ranger N achats » apparaît en bas
      de la liste dès qu'un article est coché. Les cochés passent en stock et quittent la
      liste, **les non cochés ne bougent pas** — c'est toute la différence avec « 🗑️ Vider »,
      inchangé à côté
    - **Fonctionnalité NEUVE, pas une restauration** : vérifié, l'oracle ne connaît que
      « Vider », qui balaie tout sans jamais toucher au stock. Décision produit de Joel,
      pas un portage
    - Le point qu'il demandait de surveiller (« attention au cas où j'avais encore du
      stock ») est sans danger : le modèle ne connaît pas les quantités, seulement un
      oui/non — racheter ce qu'on avait déjà est neutre. Prouvé par un test dédié
    - L'action ne range que l'**intersection** « dans le panier ET coché » : une coche peut
      survivre à la disparition de son article, elle ne doit jamais remettre en stock un
      article absent de la liste
    - **+ un défaut existant corrigé, en commit séparé et EN PREMIER** (`be124cb`) :
      `toggleStock` était le seul des quatre chemins de sortie du panier à ne pas effacer la
      coche. L'id restait dans le jeu de coches, persisté ET synchronisé — l'article revenait
      plus tard dans la liste **déjà coché tout seul**. La règle du passage en stock vit
      désormais dans un helper unique, `_passerEnStock`
    - **Preuve par retrait 6/6, 0 nulle.** La plus parlante rejoue le défaut corrigé et fait
      rougir deux tests de deux lots différents — la preuve que les deux chemins partagent
      bien une règle unique
    - Deux erreurs rattrapées avant commit : un libellé « mon 1 achat » qui ne se dit pas, et
      **un test interrogeant `localStorage` sur une mauvaise clé** (il aurait comparé `null` à
      `null` et serait passé quoi que fasse le code — faux verrou du type que le LOT 014
      traquait). Réécrit avec témoin ; la mutation M4 prouve qu'il mord
    - Aucune modification d'`index.html` : la barre est rendue dans le conteneur existant,
      en dernier, collante par CSS — l'audit reste au niveau Standard
    - **Testé par Joel avant publication**, verdict « c'est ok »
    - Métriques : 825/825 Vitest + 16/16 Pytest verts, build OK — Tests: 841 passed
- [x] [VERSION 5.12 - OnLine] 01/08/2026 : Publication du lot 019
    - Lot 019 — La correspondance stock ↔ recette : l'inventaire a le dernier mot dès qu'il
      parle clairement, l'IA n'arbitre plus que la zone du doute
    - **Trois défauts corrigés, tous constatés sur des captures réelles** : le « premier
      voisin trouvé » au lieu du meilleur (« Fécule de tapioca » rattachée à « Fécule
      (maïs) » alors que la tapioca était en stock) ; « l'IA fait autorité », qui était une
      INVENTION de la version modulaire — l'oracle ne consulte jamais ce champ pour ce calcul
      — et faisait racheter une levure déjà en stock ; les mots vides et les pluriels de
      l'oracle, perdus au portage (cause directe du cas « Fécule DE tapioca »)
    - **10 critères d'acceptation** transcrits des captures. Répartition rouge/vert prédite
      AVANT écriture du code, puis vérifiée : exactement celle annoncée
    - **Preuve par retrait 7/7, 0 nulle.** Deux échecs au premier passage, tous deux
      instructifs : un trou du filet (rien ne couvrait le retrait du terme `s === missing`
      de `recipe.js` — commentaire affirmant un comportement non vérifié) et un **défaut de
      conception** dans le moteur neuf (une tolérance aux fautes de frappe doublait la
      dépluralisation ; les deux se couvrant mutuellement, aucune n'était prouvable). La
      tolérance a été retirée — elle était aussi la plus risquée (« Farine » et « Marine »
      classées comme le même ingrédient). **Deux mécanismes qui se couvrent l'un l'autre ne
      sont pas une sécurité, c'est un angle mort**
    - Écart à la spec assumé : quand l'IA se tait sur un article PLUS PRÉCIS que la demande,
      repli sur le comportement de l'oracle plutôt que sur « dans le doute, achète » — sans
      quoi un ingrédient épinglé ET en stock aurait été annoncé manquant
    - **⚠️ Publié sur feu vert explicite de Joel SANS sa vérification visuelle ni l'audit du
      diff final**, tous deux proposés et écartés par sa décision. Tracé ici, pas un oubli
    - Métriques : 810/810 Vitest + 16/16 Pytest verts, build OK — Tests: 826 passed
- [x] [VERSION 5.11 - OnLine] 01/08/2026 : Publication des lots 016 + 017 + 018
    - Trois lots chaînés sur une même lignée de branches, publiés d'un bloc — aucun
      changement voulu à l'écran, tout est sous le capot
    - **LOT 016 — Étiquettes de recette au propre** : les variantes `.r-tag` rouge et verte
      n'ont plus qu'une seule définition CSS (apparence prouvée identique au pixel), +6 tests
    - **LOT 017 — Second rangement de `js/app.js`** : 1527 → 625 lignes, six modules d'écran
      extraits (`modals`, `settings`, `favorites`, `topbar`, `pasteRecipe`, `aiPanel`).
      A révélé un trou systémique : la construction de production était cassée avec 798 tests
      verts — la **validation unifiée passe de 2 à 3 étapes** (le build en fait partie)
    - **LOT 018 — L'écran inventaire dans son module** : `src/ui/pantryView.js`, 625 → 568
      lignes, et la **première baisse réelle du couplage** de la série (10 points → 9)
    - Bilan du rangement complet : `js/app.js` 2823 → 568 lignes (−80 %) depuis la V5.10
    - Métriques : 798/798 Vitest + 16/16 Pytest verts, build OK — Tests: 814 passed
- [x] [VERSION 5.10 - OnLine] 31/07/2026 : Publication du lot 014
    - Lot 014 — Refonte SSOT et découpage : dernier lot de la campagne. Aucun changement
      voulu à l'écran ; tout le travail est sous le capot pour rendre le code sûr à modifier
    - **Découpage** : `js/app.js` réduit de 2823 à 1523 lignes (−46 %), 8 modules extraits
      (`exports`, `sync`, `categorize`, `stockMatch`, `addForm`, `cartPicker`, `emojiModal`,
      `recipeModal`) ; feuille de style découpée en 13 sections, produite identique octet
      pour octet, puis allégée de 62 règles mortes (−10,9 %)
    - **SSOT** : lecteur unique des réponses JSON de l'IA (`src/utils/aiJson.js`, 4 sites
      alignés + un 5e trouvé en route), message unique de clé API manquante (5 écrans),
      gardes d'entrée centralisées (`src/utils/validate.js`), 13 duplications supprimées,
      articles libres retirés (10 sites, décision de Joel)
    - **Verrous anti-récidive** : parité `on*=`↔`window` à l'exécution, imports ESM
      (22 sites corrigés), durcissement `PROJECT_MAP`, anti-duplication de sélecteurs CSS,
      `categories-ssot` — chacun avec garde anti-vide
    - **Preuve par retrait généralisée** : ~75 mutations sur le lot. Elles ont démasqué
      12 faux verrous hérités (le « 0 test tautologique » du LOT 013 était faux — addendum
      posé) puis 8 dans les tests neufs du lot lui-même
    - **Audit DUR final** : 6 agents adversariaux locaux en parallèle, chaque finding
      re-vérifié sur pièce. 1 bloquant (l'extracteur JSON unique recréait le symptôme qu'il
      devait éliminer, sur un autre chemin), 3 moyens et 3 mineurs — tous corrigés et prouvés
      par retrait. 1 mineur (`.r-tag`) documenté et volontairement reporté par Joel
    - Check-list des 41 régressions de la campagne reparcourue point par point (1 trou
      trouvé et comblé). Vérification visuelle des 5 vues et modales par Joel : « tout m'a
      l'air ok »
    - Métriques : 784/784 Vitest + 16/16 Pytest verts, build OK — Tests: 800 passed
- [x] [VERSION 5.9 - OnLine] 31/07/2026 : Publication du lot 013
    - Lot 013 — Filet de tests UI : un lot **sans aucun changement visible**, et c'est le but.
      La campagne a restauré ~30 comportements perdus par la migration ; ce lot les décrit
      par des tests automatisés pour que la refonte du LOT 014 ne puisse pas les reperdre en
      silence. C'est précisément le filet qui manquait lors de la migration Vite
    - +102 tests (448 → 550). Quatre fonctions n'avaient AUCUN test : la saisie d'ingrédient
      avec son jeton anti-course, la recherche d'emoji par l'IA, l'affichage de la grille
      d'inventaire et celui de la liste de courses. Plus les trous ciblés relevés en
      découverte : créativité à 0, réponses IA dégradées, reprise d'un ingrédient similaire,
      identifiants uniques, pannes Firebase 500 / JSON invalide, recherche et filtres
    - **Matrice de couverture des 84 acquis des LOTS 005 à 015** : le vrai livrable du lot —
      pour chaque comportement restauré, le test nommé qui le fige. C'est elle qui servira de
      check-list de non-régression au LOT 014
    - Un seul écart au principe « zéro changement de comportement », autorisé par Joel à
      l'ouverture : des attributs d'ancrage (`id`, `data-testid`) posés sur les zones qui
      n'offraient aucune prise stable aux tests — cartes de Réglages, tuiles d'inventaire,
      lignes de courses, détail de recette. Ajout d'attributs uniquement, vérifié par les
      deux audits comme étant la seule modification hors tests
    - Audits : 2 agents adversariaux locaux ont pratiqué du **mutation testing** — casser le
      vrai code pour vérifier que les tests le détectent. Sur ~95 cas, zéro test tautologique.
      Leur vraie prise a été ailleurs : 6 lignes de la matrice citaient un test qui ne prouvait
      pas ce qu'elles annonçaient (comblées) et une citation était fausse (corrigée). Audit
      Gemini en complément : 12 questions fermées, vérifiées sur pièce une à une
    - Trouvé en chemin : les « articles libres » de la liste de courses sont un vestige à demi
      branché — conservés, synchronisés et copiés, mais jamais affichés ni créables. Joel a
      tranché leur **suppression**, programmée au LOT 014 (volet G)
    - Découverte technique consignée : un vrai bug de l'environnement de test (jsdom, pas de
      l'application) sur les sélecteurs d'attribut à valeur emoji — documenté comme piège
    - Métriques : 550/550 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.8 - OnLine] 30/07/2026 : Publication du lot 015
    - Lot 015 — Réglages fiables et cohérents : chaque bouton de la page fait désormais
      exactement ce que son titre annonce. « Copier mon stock » copiait la liste de
      courses sous un en-tête « LISTE DE COURSES » ; « Partager par rayons » emportait
      tout l'inventaire, produits absents compris ; « Copier ma liste de courses »
      oubliait les articles libres — dont un article réellement présent chez Joel,
      invisible dans l'app depuis la migration. Le bouton « Données techniques (JSON) »,
      qui ne produisait pas de JSON, a été supprimé (arbitrage de Joel)
    - Deux comportements perdus à la migration, restaurés depuis l'oracle : le garde-fou
      « rien à copier » (une liste vide ne se copie plus en annonçant un succès) et le
      repli de copie pour les navigateurs refusant le presse-papiers moderne — ce dernier
      durci par rapport à l'oracle, qui ne vérifiait ni l'existence de la fonction ni son
      résultat
    - Le fichier de sauvegarde a désormais un périmètre explicite et un horodatage : il
      emportait la vue en cours, la recherche et les filtres, si bien qu'une sauvegarde
      prise pendant qu'un filtre était actif rouvrait l'app filtrée ou vide. Les coches de
      la liste de courses font l'aller-retour, filtrées à l'arrivée, et ne polluent jamais
      l'état (avec un filet qui répare un état déjà pollué par une version antérieure)
    - Textes des cartes rendus honnêtes, sans redesign : sections « Partager » et
      « Sauvegarde », clé API annoncée exclue du fichier, paire Restaurer / Importer-stock
      enfin distincte (constat d'usage de Joel), « Mise à zéro » ne prétend plus effacer
      la clé API — le code la conserve
    - Défauts trouvés en cours de route et corrigés : la restauration ne se sérialisait
      pas avec un envoi cloud déjà en vol ; la garde d'entrée acceptait un inventaire vide,
      une chaîne, puis une liste de simples noms — chacun menant à la reconstruction des
      297 ingrédients par défaut et à leur envoi au cloud ; un fichier sans réglages IA
      effaçait les exclusions alimentaires ; « REMPLACE TOUT » était faux ; « Importer
      uniquement le stock » laissait des coches fantômes (écart de périmètre tranché par
      Joel)
    - Audits (Codex hors budget de jetons — dispositif de remplacement tranché par Joel) :
      phase découverte à 4 agents (fiche fausse sur presque toutes ses références de ligne,
      8 erreurs de fond, 7 pièges) ; audit de spec Gemini NO-GO sur 4 points, dont
      l'invalidation du raisonnement central d'un chantier ; 2 audits adversariaux locaux
      → 2 BLOQUANTS, 5 IMPORTANTS et 4 tests réécrits parce qu'ils ne prouvaient rien ;
      audit du diff final Gemini GO, sa seule critique de test réfutée à la vérification
    - Le trou de la barrière de quiescence du LOT 007 (le plus grave) annulait la
      restauration quelques secondes après le message de succès, sans aucun avertissement,
      et laissait le cloud sur l'ancien état
    - Zone qui n'avait AUCUN test : +91 tests (copie, textes des cartes, sauvegarde et
      restauration, moteur de synchro)
    - Métriques : 448/448 Vitest + 13/13 Pytest verts, build OK, vérification navigateur
      de Joel faite
- [x] [VERSION 5.7 - OnLine] 30/07/2026 : Publication des lots 011 + 012
    - Lot 011 — Recettes IA riches : cartes de résultats complètes (méta, pitch, tags
      d'ingrédients colorés selon le stock, boutons directs), détail de recette riche
      (Nutri-Score, étapes cochables, pastilles d'état), prompts et appels IA re-blindés
      (RÈGLE D'OR, sécurité, JSON durci), mode 🎲 « recette aléatoire » complet (filtres
      réinitialisés, créativité boostée), confort de génération (textes d'attente animés,
      scroll auto mobile), récupération d'URL propre (Jina Reader), favoris riches (carte
      dédiée, date affichée, « Sauvegarder tel quel » restauré)
    - Lot 012 — Confort d'usage retrouvé : sélecteur d'articles éditable par ligne (nom +
      émoji via 🎲 `cycleEmoji`), gestes clavier (Entrée sur les champs d'ajout rapide,
      scroll horizontal des filtres sur mobile, anti-autofill), barre supérieure
      contextuelle restaurée (bouton d'action et icône mobile par vue, sans jamais
      recréer le voyant de synchro du LOT 007), retour auto à l'inventaire après un
      ajout, styles neufs pour l'autocomplétion du formulaire d'ajout
    - Deux défauts hors-plan trouvés et corrigés en cours de route : `areSimilar`
      confondait des ingrédients sans rapport par fragment de texte (« Eau »≈« Agneau »),
      corrigé en portant l'algorithme mot-à-mot de l'oracle (constat de Joel en test
      réel) ; la case à cocher du sélecteur s'affichait toujours visuellement cochée
      (défaut du LOT 006, jamais testé, trouvé par les tests de non-régression du LOT 012)
    - Audits : LOT 011 — audit de spec en duel (Gemini + Codex Terra, NO-GO puis GO),
      sous-lot moteur et sous-lot rendu chacun audité et corrigé (4 défauts réels au
      total, dont une vraie condition de course). LOT 012 — audit de spec ET audit du
      diff final tous deux par Codex Terra (GO à chaque fois), avec des corrections
      réelles à chaque passage
    - Check-list de campagne (`Backlog/BACKLOG - Regressions de la migration.md`)
      entièrement cochée ou explicitement reportée (§5, garde-fou permanent) — fin de la
      campagne de restauration ouverte le 2026-07-29
    - Métriques : 357/357 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.6 - OnLine] 30/07/2026 : Publication des lots 009 + 010
    - Lot 009 — Boutons morts rebranchés : icône d'ingrédient (grille locale immédiate),
      plein écran recette (vraie API navigateur + repli CSS), bouton imprimer + swipe-to-close
      restaurés dans le modal recette (entièrement rendu par `renderRecipeDetail`), panneau
      Informations Système (clé masquée, utilisateur cloud, taille du stockage)
    - Lot 010 — Règles métier retrouvées : filtre « type de cuisine » enfin transmis à l'IA
      (SSOT `cuisines`, migration douce du champ mort, étanchéité cloud), plafond de 6
      ingrédients épinglés restauré (libellé UI corrigé), zone « Ingrédients imposés »
      complète (épinglés + hors stock, sous-titre vivant), inventaire trié par ordre
      alphabétique français, quantités recalculées selon le nombre de personnes (`scaleQty`,
      fractions ASCII et Unicode gérées — corrige une corruption de l'oracle sur `1/2`),
      menu « Moteur Tâches Complexes » supprimé au profit d'une information en lecture seule
      dérivée de `AI_ROLES`
    - Correctif hors-plan (constaté par Joel en test réel après le lot 010) : le prompt IA
      avait perdu ses indications de format à la migration (quantité+unité, un seul emoji) —
      restaurées à l'identique de l'oracle, plus un filet de sécurité qui empêche tout texte
      parasite de s'afficher à la place d'un emoji
    - Audits : LOT 009 Standard GO (Codex) ; LOT 010 Dur — audit de spec avant code (NO-GO
      levé), audit interne 6 lentilles sur les chantiers 1-2 (0 défaut confirmé), Gemini GO
      sur le chantier 3, Codex Terra GO sur les chantiers 4-6 (2 durcissements comblés,
      dont un vrai trou dans le filet de sécurité emoji)
    - Deux arbitrages de Joel : SSOT strict sur `cuisines` ; prise en charge réelle des
      fractions dans le recalcul des quantités (dépassement volontaire de l'oracle,
      corrige un bug de corruption)
    - Métriques : 218/218 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.5 - OnLine] 30/07/2026 : Publication des lots 008 + 007
    - Lot 008 — Données en sécurité : « Importer uniquement le stock » refait fusionner
      (statuts seulement), export blanchi de la clé API, `applyExternalState` point d'entrée
      unique préservant la clé sans condition, réinitialisation qui repeuple (297 ingrédients
      reconstruits depuis l'export réel de Joel) et pousse au cloud avant rechargement,
      hygiène du Set des coches
    - Lot 007 — Synchro collaborative : restauration du `saveState(push)` du monolithe en
      moteur bidirectionnel complet — envoi temporisé 2 s, drapeau « EN ATTENTE » persisté,
      anti-boucle « dernier cloud connu » (persistée, amorcée au premier lancement), pulls
      périodiques 60 s + visibilité + retour réseau, délai 15 s + retry unique, barrière
      reset↔moteur, voyant d'état et panneau système rebranchés (CSS dormant F7/C8),
      coches de courses synchronisées (décision Joel)
    - Audits Dur : LOT 008 double audit passé (28-29/07) ; LOT 007 Gemini GO + Codex GO
      final après 2 cycles de corrections (5 findings + 2 scénarios maintenus, tous fermés
      avec tests). Tests réels à deux appareils levés par décision explicite de Joel —
      constat à l'usage
    - Métriques : 92/92 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.4 - OnLine] 29/07/2026 : Publication des lots 005 + 006
    - Lot 005 — Quick wins UX : démarrage instantané (rendu local d'abord, synchro en fond
      avec garde-fous d'empreinte), recherche fluide (debounce), croix d'effacement réparée,
      compteurs en une passe, notifications visibles, `setState` assainit les données externes
    - Lot 006 — Comportements produit : liste de courses qui ne pré-coche que les manquants,
      emojis devinés, puce « Autres », boutons de collage grisés, Cloud Sync qui n'efface
      plus la clé API (`applyCloudState`), anti-collision des requêtes IA, `AI_ROLES` SSOT
    - Publication groupée sur feu vert explicite de Joel, base saine avant la campagne
      « Restauration & Refonte » (LOTS 007-014, voir ROADMAP)
    - Métriques : 33/33 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.3 - OnLine] 28/07/2026 : Ouverture de la 5.3
    - Bascule des modèles IA vers `gemini-3.6-flash` (SSOT `AI_ROLES` dans `src/constants.js`)
    - Numéro de version porté à 5.3.0 et propagé via `sync_version.py`
    - Gouvernance : règle « historique lisible » (journal de versions, pas de micro-commits)
    - Sauvegarde des 5 commandes d'agents dans `.claude/commands`
- [x] [HOTFIX PRODUCTION] 28/07/2026 : Recettes IA réparées (SHA: 6fcd016)
    - Affichage des recettes IA restauré : `renderAIResults` ciblait un ID DOM inexistant
      (`ai-results-grid` au lieu de `ai-results-list`) — l'IA générait bien, rien ne s'affichait
      jamais à l'écran. Bug en ligne depuis au moins la 5.2 (SHA: 69da666)
    - Modal détail recette : ajout des styles manquants (`.modal-content`, `.mh-*`, `.rd-*`,
      `.rc-emoji`, `.rc-info`), utilisés par `src/ui/recipe.js` mais absents de la feuille de
      style — le détail s'affichait sans habillage (SHA: be85c74)
    - Origine : audit complet #2 (`ULTRA_AUDIT_REPORT.md`), diagnostic croisé Claude Code / Gemini
    - Métriques : 22/22 Vitest + 13/13 Pytest verts
- [x] [VERSION 5.2 - OnLine] 28/07/2026 : Publication de la 5.2 (tag v5.2)
    - Lot 4 : versionnage SSOT (APP_VERSION + sync_version.py + verrou pytest) — audit Standard a posteriori
    - Hotfix production : imports ESM avec extension .js (site GitHub Pages réparé)
    - Gouvernance : VERROU PRODUCTION (main = page en ligne, feu vert explicite obligatoire)
    - Métriques : 22/22 Vitest + 13/13 Pytest verts
- [x] [PUBLICATION] 28/07/2026 : Synchronisation du dépôt distant et publication GitHub Pages (SHA: c6e82c5)
- [x] [GOUVERNANCE] 28/07/2026 : Cadre de gouvernance agentique et verrous de fraîcheur (SHA: 7af3e4b)
    - CLAUDE.md (source de vérité) + AGENTS.md généré + DOCTRINE_PRODUIT.md
    - Verrous pytest (AGENTS.md, PROJECT_MAP.md) + validation unifiée `validate.bat`
    - Métriques : 22/22 tests Vitest + 10/10 verrous Pytest verts
- [x] [BASELINE] 28/07/2026 : Initialisation git et baseline applicative (SHA: be74103)
- [x] Lot 1 : Extraction services (Firebase/Gemini) & Tests unitaires
- [x] Lot 2 : Modernisation architecture (Vite/ESM)
- [x] Lot 3 : Refactorisation UI (DOM Safe / h-functions)
    - [x] Migration index.html -> type module
    - [x] Refactorisation Inventaire (Pantry)
    - [x] Refactorisation Liste de courses (Shopping)
    - [x] Refactorisation Recettes IA et Favoris

## Notes techniques
- Architecture ESM modulaire (app.js < 400 lignes).
- Vitest : 22 tests passés (100% vert).
- Protection XSS totale : Suppression de innerHTML au profit de l'utilitaire `h()`.
- Build Vite validé pour production.
