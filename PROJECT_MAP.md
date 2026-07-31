# PROJECT_MAP.md — Index de cartographie rapide FoodApp

> **OÙ TROUVER QUOI EN 10 SECONDES.**
> Fichier maintenu et vérifié par `tests/test_project_map_freshness.py`.

---

## 1. COMPOSANTS ET MODULES CORE (`src/`)

- `src/state.js` : Moteur d'état réactif global (SSoT de l'application).
- `src/actions.js` : Handlers et actions utilisateur.
- `src/constants.js` : Constantes et verrous d'application.
- `src/data.js` : Données de recettes et listes d'ingrédients par défaut.
- `src/services/firebase.js` : Service d'intégration Firebase (Auth & Firestore).
- `src/services/gemini.js` : Service d'intégration IA Gemini.
- `src/ui/addForm.js` : Formulaire d'ajout d'ingrédient (LOT 014 §A, extrait de `js/app.js`). Détient l'état PRIVÉ du formulaire — catégorie choisie à la main, temporisations, jeton anti-course `_aiSuggestGenId` — que seule `resetManualCategory()` peut remettre à zéro depuis l'extérieur. `registerAddFormNav` injecte `switchView` (cycle réel : le formulaire renvoie à l'inventaire, `switchView` lit l'état du formulaire). Deux défauts connus figés et documentés en tête de fichier.
- `src/ui/cartPicker.js` : Sélecteur « envoyer une recette vers la liste de courses » (LOT 014 §A, extrait de `js/app.js`). Pré-coche ce qui manque, laisse corriger chaque ligne, puis fusionne avec l'inventaire. Détient l'état PRIVÉ du sélecteur. **Trois couplages INJECTÉS** (`registerCartPickerHooks`) plutôt qu'importés — `openModal`/`closeModal` ne sont pas de simples helpers, et `buildEmojiEditSuggestions` appartient à la modale d'édition d'icône : c'est le nœud annoncé par la phase découverte, détaillé dans l'en-tête du module.
- `src/ui/components.js` : Composants UI réutilisables.
- `src/ui/pantry.js` : UI et gestion du garde-manger.
- `src/ui/recipe.js` : UI et affichage des recettes.
- `src/ui/shopping.js` : UI et liste de courses.
- `src/utils/dom.js` : Utilitaires de manipulation du DOM.
- `src/utils/helpers.js` : Helpers algorithmiques et formatage.
- `src/services/sync.js` : Moteur de synchro bidirectionnelle (LOT 007) — file d'opérations, barrière de quiescence, garde-fous entrant/sortant, temporisation et retry. Extrait de `js/app.js` au LOT 014. Ses DEUX dépendances d'interface sont injectées par `registerSyncUi` (pas d'import circulaire) ; `js/app.js` republie ses noms à l'identique.
- `src/services/exports.js` : Composition des textes de partage (presse-papiers) — `buildClipboardText` est PURE (l'état lui est passé en paramètre) et `writeToClipboard` isole l'effet de bord. Extrait de `js/app.js` au LOT 014 ; le point d'entrée `exportClipboard` reste dans `js/app.js` car il est publié sur `window`.
- `src/utils/categorize.js` : Déduction de catégorie (`guessCategoryLocally` d'après le nom, `sanitizeCategory` qui traduit le vocabulaire de l'IA). Extrait de `js/app.js` au LOT 014, filet posé AVANT le déplacement. Porte 2 défauts latents connus, figés par les tests — voir son en-tête.
- `src/utils/stockMatch.js` : SSOT du calcul « en stock / manquant » (LOT 014 §A, extrait de `js/app.js`). `matchIngredientToStock` décide la couleur de chaque tag d'ingrédient et les lignes que le sélecteur de courses pré-coche ; `buildIngredientTags` en dérive les tags affichés. Trois règles verrouillées par des tests — voir son en-tête.
- `src/utils/validate.js` : SSOT des gardes d'entrée des données externes (localStorage, cloud, fichier de sauvegarde, réponses IA) + échappement des valeurs interpolées dans un prompt. Zéro dépendance : ne rejette jamais ce que `sanitizeGlobalState` sait réparer.

---

## 2. PAGES ET VUES FRONTALIERES

- `index.html` : Point d'entrée SPA moderne Vite.
- `foodapp-v5-Joel.html` : Version HTML historique monopage (> 1500 lignes, zone sensible).
- `js/app.js` : Point d'entrée d'initialisation du bundle.
- `css/style.css` : Feuille de style globale.

---

## 3. SUITE DE TESTS (`tests/`)

- `tests/state.test.js` : Tests unitaires du moteur d'état.
- `tests/actions-data.test.js` : Tests des actions données (LOT 008 — import/export/reset).
- `tests/helpers.test.js` : Tests des utilitaires algorithmiques.
- `tests/categorize.test.js` : Tests de CARACTÉRISATION de `src/utils/categorize.js`, écrits AVANT son déplacement — ils décrivent le comportement réel, défauts compris, pour prouver que le déménagement n'a rien changé.
- `tests/validate.test.js` : Tests des gardes d'entrée (`src/utils/validate.js`) — fige la FRONTIÈRE de chaque prédicat, y compris ce qu'il doit continuer d'ACCEPTER (anti-sur-durcissement).
- `tests/dom.test.js` : Tests de manipulation DOM.
- `tests/firebase.test.js` : Mocks et tests du service Firebase (transport, délai d'expiration).
- `tests/sync-scope.test.js` : Périmètre du document synchronisé (LOT 007 §4.1) et application clé par clé.
- `tests/sync-engine.test.js` : Moteur de synchro bidirectionnelle (LOT 007 — temporisation, drapeau, anti-boucle, retry).
- `tests/emoji-edit.test.js` : Édition d'icône d'ingrédient (LOT 009 — grille immédiate, clic = applique/sauvegarde/ferme).
- `tests/system-info.test.js` : Panneau Informations Système (LOT 009 — clé API masquée, utilisateur cloud, stockage local).
- `tests/swipe-close.test.js` : Glissement pour fermer un modal (LOT 009 — survit au rendu dynamique, geste isolé du précédent).
- `tests/gemini.test.js` : Mocks et tests du service IA Gemini.
- `tests/cuisine-ssot.test.js` : Champ canonique unique `cuisines` (LOT 010 — migration douce, étanchéité cloud, transmission réelle à l'IA, alignement interface ↔ champ).
- `tests/pin-cap.test.js` : Plafonds des ingrédients imposés (LOT 010 — 6 épinglés et 6 hors stock séparés, données existantes jamais tronquées, libellé généré depuis la SSOT).
- `tests/imposed-zone.test.js` : Zone « Ingrédients imposés » + sous-titre vivant (LOT 010 — épinglés et extras affichés ensemble, rafraîchissement après action, état vivant jamais figé).
- `tests/pantry-sort.test.js` : Tri alphabétique de l'inventaire (LOT 010 — tri français avec accents, appliqué après filtrage, identifiant jamais recalculé depuis la position, export presse-papier non affecté).
- `tests/recipe-scaling.test.js` : Quantités recalculées selon le nombre de personnes (LOT 010 — `scaleQty` pure : nombres, unités collées/séparées ml/kg/g/cl, fractions ASCII et Unicode sans dérive ; intégration écran recette : bornes 1-20, aucune mutation de la recette d'origine, réinitialisation à l'ouverture).
- `tests/ai-ingredient-fidelity.test.js` : Filet de sécurité emoji ingrédient de la liste de courses (LOT 010 — une unité renvoyée par erreur dans le champ emoji par l'IA ne s'affiche jamais à l'écran, retombe sur la déduction automatique).
- `tests/ai-models-info.test.js` : Menu « Moteur Tâches Complexes » supprimé (LOT 010 — remplacé par une information en lecture seule dérivée de la SSOT, aucun nom de modèle en dur, sauvegarde de la clé API non régressée).
- `tests/ai-random-mode.test.js` : Mode 🎲 aléatoire (LOT 011 — filtres réinitialisés dont `cuisines`, `ppl`/clé API/modèles jamais touchés, créativité 80-100 ponctuelle traduite en consigne texte, restaurée après coup).
- `tests/ai-url-fetch.test.js` : Récupération d'URL de recette (LOT 011 — Jina Reader sans repli sur allorigins, validations d'URL, délai d'expiration 10 s, extraction de titre, réponse vide traitée comme un échec).
- `tests/ai-cards-rich.test.js` : Cartes de résultats IA complètes (LOT 011 — numéro, méta, pitch, tags colorés (max 6, priorité stock avant nom exact), boutons ⭐/🛍 rendus seulement si leur handler est fourni).
- `tests/favorites-rich.test.js` : Favoris riches (LOT 011 — carte dédiée distincte des cartes IA, date stockée et affichée, état vide avec CTA, « Sauvegarder tel quel » restauré pour un texte collé sans transformation IA).
- `tests/recipe-detail-rich.test.js` : Écran de détail complet (LOT 011 — cas `r.content` (favori texte brut jamais vide), pastilles et « État des stocks » sans limite, Nutri-Score visuel, étapes cochables sans persistance, non-régression des 4 acquis 009/010).
- `tests/ai-generation-comfort.test.js` : Confort de génération (LOT 011 — textes d'attente animés avec minuteur garanti coupé, scroll auto sur mobile, remise à zéro de « Coller une recette » à l'ouverture, verrouillage + aperçu après transformation IA réussie).
- `tests/picker-row-editing.test.js` : Édition par ligne du sélecteur d'articles (LOT 012, zone A — nom éditable et émoji via `cycleEmoji` qui relit le nom édité, validation lisant les valeurs éditées avec refus propre d'un nom vidé, acquis LOT 006 non régressés, défaut de case à cocher préexistant corrigé ; LOT 013 — branche `areSimilar` de `confirmRecipeToCart` : un ingrédient déjà présent est réutilisé, jamais dupliqué).
- `tests/keyboard-gestures.test.js` : Clavier et gestes (LOT 012, zone B — Entrée sur `#ez-input`/`#paste-title`, `touchmove` passif sur `.chips-row` qui stoppe la propagation, anti-autofill 100 ms après le démarrage).
- `tests/topbar-context.test.js` : Barre supérieure contextuelle (LOT 012, zone C — titres/sous-titres exacts, bouton d'action et icône mobile par vue, `#sync-indicator-mobile` jamais recréé à travers les rendus, retour auto après ajout, emoji deviné pour les extras, clé API vidable, `shoppingSource` remis à zéro, toasts panier/suppression sans toast sur le stock).
- `tests/export-clipboard.test.js` : Formats de copie vers le presse-papiers (LOT 015, sous-lot A — « Copier mon stock » copie bien le stock et non les courses, partage par rayons restreint au stock avec emoji de rubrique, articles libres inclus dans une rubrique dédiée toujours en fin, garde-fou « rien à copier » portant sur la source et non sur le texte final, repli de copie durci, toasts chiffrés, format `full` supprimé).
- `tests/settings-labels.test.js` : Textes des cartes de Réglages (LOT 015, sous-lot B — carte JSON disparue, sections « Partager »/« Sauvegarde », clé API annoncée exclue du fichier, paire Restaurer/Importer nettement distincte, « Mise à zéro » ne prétend plus effacer la clé API ; LOT 013 — lit le vrai `index.html` et cible désormais les boutons par leur `id` stable, pas par leur `onclick`).
- `tests/backup-restore.test.js` : Sauvegarde et restauration de fichier (LOT 015, sous-lot C — périmètre explicite du fichier sans aucun champ d'écran, horodatage, clé API jamais écrite, aller-retour des coches filtrées et jamais présentes comme clé d'état, garde d'entrée refusant un inventaire vide ou non-tableau, barrière de synchro avant écriture, réarmement du champ fichier, purge des coches sur la fusion douce).
- `tests/_helpers/dom-helpers.js` : Infrastructure de test partagée (LOT 013 — `setupTestDOM`/`cleanupTestDOM` par zone VÉRIFIÉE contre le vrai `index.html`, `mockFetchResponse`/`mockFetchError`/`mockFetchTimeout`/`mockFetchNetworkError`, `mockLocalStorage`, `resetTestState`, fabriques `makeIngredient`/`makeRecipe`, `readToasts`/`lastToast` — factorise ce que 21 fichiers dupliquaient ; non un fichier de test lui-même, pas de `describe`/`it`).
- `tests/dom-helpers-fraicheur.test.js` : Garde-fou de fraîcheur des squelettes DOM (LOT 013 — chaque `id` posé par `setupTestDOM` doit exister dans le vrai `index.html`, sinon échec explicite plutôt qu'une dérive silencieuse).
- `tests/pantry-grid-render.test.js` : Rendu pur de la grille d'inventaire (LOT 013 — `renderPantryGrid`/`renderIngCard` n'avaient aucun test ; restitue l'ordre reçu SANS trier, badges d'état distincts des boutons d'action toujours présents, ancres `data-testid`/`data-ing-id`).
- `tests/shopping-list-render.test.js` : Rendu pur de la liste de courses (LOT 013 — `renderShoppingList`/`renderShoppingItem` n'avaient aucun test ; regroupe et trie par rayon puis par nom (à l'inverse du renderer d'inventaire), barre de progression, tags de provenance, ancres `data-testid`/`data-item-id`).
- `tests/add-emoji-search.test.js` : Recherche d'emoji par IA du formulaire d'ajout (LOT 013 — `searchEmojiAddAI` n'avait aucun test ; repli recherche/nom, sortie sans clé API, zéro emoji, auto-sélection seulement si le champ est vide, bouton toujours réarmé).
- `tests/add-input-suggestions.test.js` : Suggestions à la frappe du formulaire d'ajout (LOT 013 — `handleAddInput` n'avait aucun test ; détection locale exacte vs premier mot, catégorie manuelle qui court-circuite, JETON ANTI-COURSE `_aiSuggestGenId` prouvé par inversion de résolution — a mis au jour un piège jsdom réel sur les sélecteurs d'attribut à valeur emoji astrale).
- `tests/picker-selection.test.js` : Tests de CARACTÉRISATION de la SÉLECTION du sélecteur de courses (LOT 014 §A — `toggleAllPickerItems` et `updatePickerRow` étaient les 2 dernières zones aveugles de cet écran ; `picker-row-editing.test.js` couvre l'ÉDITION d'une ligne, jamais sa sélection). Verrouille le piège de la fonction : elle parcourt les cases par POSITION alors que le marquage se fait par IDENTIFIANT — les deux ne coïncident que parce que la case maîtresse vit hors de la liste.
- `tests/stock-match.test.js` : Tests de CARACTÉRISATION de `src/utils/stockMatch.js`, écrits AVANT son déplacement (LOT 014 §A). Fige les 3 règles du calcul « en stock / manquant » : `isExact` se calcule INDÉPENDAMMENT du stock, le statut annoncé par l'IA (`s`) fait autorité sur l'inventaire, et `areSimilar` compare des mots entiers (« Chou » ≠ « Chocolat »).
- `tests/keyboard-shortcuts.test.js` : Tests de CARACTÉRISATION des raccourcis clavier (LOT 014 §A — `initKeyboardShortcuts` était la dernière zone aveugle sans aucun test, faute d'être atteignable : elle n'est câblée qu'au démarrage et `DOMContentLoaded` ne se déclenche jamais sous Vitest). Échap ferme TOUTES les modales, priorité de la modale ouverte sur le formulaire d'ajout, et non-déclenchement sur une autre touche.
- `tests/add-form.test.js` : Tests de CARACTÉRISATION du formulaire d'ajout, écrits AVANT son déplacement vers `src/ui/addForm.js` (LOT 014 §A). Couvre les 3 fonctions restées aveugles — `selectEmoji`, `updateEmojiSuggestions`, `showCategoryIndicator`. Fige deux subtilités qu'un découpage aplatirait en silence : le nom public `updateEmojiSuggestions` désigne la version TEMPORISÉE, et la grille d'emojis est SENSIBLE aux accents alors que la liste de résultats du même formulaire ne l'est pas (défaut réel, figé et signalé, non corrigé ici).
- `tests/restore-ai-config.test.js` : Restauration des réglages IA à l'affichage (LOT 013 — `restoreAIConfig` n'avait qu'1 test ; créativité à 0 jamais remontée à 50, champs texte, puces tableau vs valeur simple, résumé CTA).
- `tests/analyze-nutrition.test.js` : Analyse nutritionnelle IA (LOT 013 — `analyzeNutrition` n'avait que 2 tests indirects ; 3 branches d'échec (sans clé, JSON invalide, panne réseau), libellé du bouton réarmé identique à l'origine).
- `tests/pantry-filters-search.test.js` : Filtrage de l'inventaire hors tri (LOT 013 — `getFilteredIngredients` : recherche texte insensible aux accents, cumul des toggles stock/panier, filtres exclusifs épinglés/surgelés).
- `tests/test_agents_md_freshness.py` : Verrou de fraîcheur Python pour `AGENTS.md`.
- `tests/test_project_map_freshness.py` : Verrou de fraîcheur Python pour `PROJECT_MAP.md`.
- `tests/test_version_ssot.py` : Verrou de cohérence du versionnage (SSOT `APP_VERSION`).

---

## 4. GOUVERNANCE ET OUTILLAGE (`scripts/`, `.agents/`, `.codex/`)

- `CLAUDE.md` : Fichier maître de gouvernance (source de vérité).
- `AGENTS.md` : Fichier généré pour les auditeurs.
- `DOCTRINE_PRODUIT.md` : Règles métier, seuils et style de collaboration.
- `.agents/01_auditor_role.md` : Mandat de l'auditeur.
- `.codex/config.toml` : Configuration des permissions Codex (:read-only).
- `scripts/sync_agents_md.py` : Générateur automatique d'AGENTS.md.
- `scripts/sync_version.py` : Propagateur de version (SSOT : `APP_VERSION` de `src/constants.js`).
- `scripts/audit_bridge.py` : Pont d'audit automatisé pour boucle autonome.
- `validate.bat` : Script de validation unifiée (`vitest run` + `pytest`).
