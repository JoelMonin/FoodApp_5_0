# SHIP LOG - FoodApp

## État du Projet
- **Version actuelle** : 5.9.0
- **Dernière mise à jour** : 31/07/2026
- **Statut** : Version 5.9 publiée (LOT 013) — le filet de tests est en place et en ligne.
  Prochain et dernier chantier de la campagne « Restauration & Refonte » : LOT 014
  (refonte SSOT et découpage), visé en 5.10

## Historique des modifications
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
