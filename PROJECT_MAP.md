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
- `src/ui/components.js` : Composants UI réutilisables.
- `src/ui/pantry.js` : UI et gestion du garde-manger.
- `src/ui/recipe.js` : UI et affichage des recettes.
- `src/ui/shopping.js` : UI et liste de courses.
- `src/utils/dom.js` : Utilitaires de manipulation du DOM.
- `src/utils/helpers.js` : Helpers algorithmiques et formatage.

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
- `tests/picker-row-editing.test.js` : Édition par ligne du sélecteur d'articles (LOT 012, zone A — nom éditable et émoji via `cycleEmoji` qui relit le nom édité, validation lisant les valeurs éditées avec refus propre d'un nom vidé, acquis LOT 006 non régressés, défaut de case à cocher préexistant corrigé).
- `tests/keyboard-gestures.test.js` : Clavier et gestes (LOT 012, zone B — Entrée sur `#ez-input`/`#paste-title`, `touchmove` passif sur `.chips-row` qui stoppe la propagation, anti-autofill 100 ms après le démarrage).
- `tests/topbar-context.test.js` : Barre supérieure contextuelle (LOT 012, zone C — titres/sous-titres exacts, bouton d'action et icône mobile par vue, `#sync-indicator-mobile` jamais recréé à travers les rendus, retour auto après ajout, emoji deviné pour les extras, clé API vidable, `shoppingSource` remis à zéro, toasts panier/suppression sans toast sur le stock).
- `tests/export-clipboard.test.js` : Formats de copie vers le presse-papiers (LOT 015, sous-lot A — « Copier mon stock » copie bien le stock et non les courses, partage par rayons restreint au stock avec emoji de rubrique, articles libres inclus dans une rubrique dédiée toujours en fin, garde-fou « rien à copier » portant sur la source et non sur le texte final, repli de copie durci, toasts chiffrés, format `full` supprimé).
- `tests/settings-labels.test.js` : Textes des cartes de Réglages (LOT 015, sous-lot B — lit le vrai `index.html`, cible les boutons par leur `onclick` : carte JSON disparue, sections « Partager »/« Sauvegarde », clé API annoncée exclue du fichier, paire Restaurer/Importer nettement distincte, « Mise à zéro » ne prétend plus effacer la clé API).
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
