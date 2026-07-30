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
