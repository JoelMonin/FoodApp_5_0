# LOT 013 — Filet de tests UI — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — s'exécute après le LOT 012, **PRÉALABLE OBLIGATOIRE du LOT 014**
> **Branche à créer :** `feat/lot13-filet-tests-ui`
> **Niveau d'audit : Léger** (tests uniquement, aucun comportement modifié)
> **Effort estimé :** ~2 journées
> **Promu du backlog** (`BACKLOG - Filet de tests UI.md`, origine `ULTRA_AUDIT_REPORT.md`
> 2026-05-01) le 2026-07-29 — contenu intégral repris et actualisé ci-dessous.

---

## Objectif

Figer par des tests automatisés le comportement de l'application **restaurée** (LOTS 007-012),
AVANT la refonte du LOT 014. C'est la leçon centrale de la campagne : la migration
monolithe → modules a perdu ~30 comportements **parce qu'aucun test ne les décrivait**.
Le LOT 014 refera un déplacement massif de code — il ne partira pas sans ce filet.

**Règle absolue (pare-feu A/B, `CLAUDE.md` §5) : ce lot n'écrit QUE des tests.** Si un test
révèle un bug, le bug est consigné (fiche régressions ou backlog), pas corrigé ici — sauf
accord explicite de Joel.

## État des lieux (à actualiser à l'ouverture du lot)

Base : **33 tests Vitest** au 2026-07-29 (`helpers`, `firebase`, `gemini`, `dom`, `state`) +
13 verrous Pytest. Les LOTS 007-012 en auront ajouté — faire l'inventaire d'abord, ne pas
dupliquer.

## Périmètre

### A. Fonctions critiques sans filet (liste d'origine, à re-vérifier)

| Fonction | Où | Tests minimum |
|---|---|---|
| `handleAddInput` | `js/app.js` | happy path + vide + catégorie manuelle + erreur IA + jeton anti-course |
| `searchEmojiAddAI` | `js/app.js` | happy + erreur API + zéro emoji |
| `exportClipboard` | `js/app.js` | 1 test par format + état vide + ordre conservé |
| `analyzeNutrition` | `js/app.js` | happy + JSON invalide + erreur API |
| `confirmRecipeToCart` | `js/app.js` | happy + dédoublonnage `areSimilar` + valeurs éditées (LOT 012) |
| `restoreAIConfig` | `js/app.js` | défaut + config pleine + slider créativité (LOT 008) |
| `renderShoppingList` | `src/ui/shopping.js` | happy + vide + barre de progression |
| `renderRecipeDetail` | `src/ui/recipe.js` | 1 par source (ai/fav/paste) + `r.content` brut (LOT 011) + sans nutrition |
| `renderPantryGrid` | `src/ui/pantry.js` | plein + vide + tri français (LOT 010) |

**+ les mécanismes restaurés par la campagne** : moteur de synchro (compléter les tests du
LOT 007 si des trous restent), `importStockOnly`/`applyExternalState` (LOT 008),
`updateSystemInfo` (LOTS 007/009), plafond épinglés et `scaleQty` (LOT 010), prompts blindés
(LOT 011), `cycleEmoji` et topbar contextuelle (LOT 012).

### B. Tests existants à renforcer (liste d'origine)

- `generateId` : unicité prouvée sur un Set de 1000 (actuellement « reasonably unique ») ;
- `firebase.test.js` : structure complète du retour, modes d'échec 401/500/JSON invalide/
  timeout — en complément des tests du LOT 007 ;
- `gemini.test.js` : `candidates` manquant, `parts` vide, `text` manquant ;
- `dom.test.js` : cas XSS explicite (le nom du test promet, le corps doit prouver) ;
- `stripAccents` : null, undefined, chaîne vide, ligatures (`œuf`).

### C. Infrastructure

- `tests/_helpers/dom-helpers.js` : `setupTestDOM()` (squelette d'ids réels d'`index.html`),
  `cleanupTestDOM()`, `mockFetchResponse()`, `mockFetchError()` — le squelette de la fiche
  d'origine est un bon point de départ, à ALIGNER sur l'`index.html` réel du moment ;
- fake timers Vitest pour debounce/temporisations (200 ms recherche, 800 ms IA, 2 s synchro).

### D. Stratégie pour `js/app.js` (non importable tel quel)

Deux options héritées de la fiche d'origine — **choisir à l'ouverture** :
- **Option A** (recommandée) : extraire les fonctions PURES vers `src/` au fil des tests
  (`getFilteredIngredients`, `exportClipboard`, `guessCategoryLocally`…). ⚠️ C'est un
  AVANT-GOÛT du LOT 014 : extraction MINIMALE, sans réorganisation — le déplacement complet
  reste au 014 ;
- **Option B** : jsdom + mocks lourds sans toucher `app.js`.

## Critères d'acceptation

- [ ] **≥ 30 nouveaux tests** ; chaque fonction du tableau A couverte (happy path minimum)
- [ ] `generateId` non-flaky ; 3 modes d'échec Firebase ; 3 réponses IA dégradées
- [ ] Aucun `.skip`/`.only` ; validation unifiée verte ; build OK
- [ ] AUCUN comportement applicatif modifié (diff hors `tests/` ≈ vide, sauf Option A minimale)
- [ ] Audit Léger : relecture scope/diff

## Traçabilité

- Fiche d'origine : `Backlog/BACKLOG - Filet de tests UI.md` (supprimée à la promotion —
  contenu intégralement repris ici) ; source `ULTRA_AUDIT_REPORT.md` P1 Tests
- Débloque : LOT 014 (prérequis dur)
