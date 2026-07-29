# LOT 012 — Confort d'usage retrouvé — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — s'exécute après le LOT 011
> **Branche à créer :** `feat/lot12-confort-usage`
> **Niveau d'audit : Léger à Standard** (polish d'interface, aucune zone sensible)
> **Effort estimé :** ~1 journée

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
`Backlog/BACKLOG - Regressions de la migration.md` (§3), monolithe `foodapp-v5-Joel.html`
aux lignes citées — **oracle comportemental.**

---

## Objectif

La vingtaine de petits gestes qui faisaient la fluidité de l'app d'origine. Individuellement
mineurs, ensemble ils font la différence entre « ça marche » et « c'est agréable ».
**Arbitrage global de Joel (2026-07-29) : le comportement d'avant est la référence.**

## Périmètre

### A. Sélecteur d'articles : l'édition par ligne (complète le LOT 006)

**Oracle : monolithe l.5677-5700 (rendu), `cycleEmoji` l.5809-5824, `confirmRecipeToCart`
l.5826+.** Le LOT 006 a restauré le style et le pré-cochage ; il manque l'édition :
- chaque ligne : champ **nom modifiable** (`pick-name-*`), **emoji modifiable** avec bouton
  🎲 qui fait défiler les suggestions (le style `.picker-magic-btn` dort dans
  `css/style.css:2467-2485`), libellé de catégorie ;
- la validation (`confirmRecipeToCart`, `js/app.js:637+`) lit les valeurs ÉDITÉES, pas les
  valeurs d'origine ;
- `cycleEmoji` : suggestions par nom + liste de secours large, cycle circulaire (l.5819) ;
- **préserver les acquis du LOT 006** : pré-cochage « manquants seulement », badge
  « En stock », correspondances approximatives orange, case maîtresse fidèle.

### B. Clavier et gestes

**Oracle : l.6744, l.6746, l.6790-6793, l.6774-6781.**
- Entrée dans `#ez-input` (vue IA) → ajoute l'ingrédient hors stock ;
- Entrée dans `#paste-title` → focus sur `#paste-content` ;
- `touchmove` avec `stopPropagation` (passif) sur chaque `.chips-row` — scroll horizontal
  des filtres sans entraîner la page (mobile) ;
- vidage anti-autofill des champs de recherche 100 ms après le démarrage (recherche d'état
  ET valeur des inputs cohérentes).

### C. Navigation et retours visuels

**Oracle : `updateTopbar` l.4520-4579, l.6458, `updateBadges`, toasts des actions.**
- **Barre supérieure contextuelle** : le bouton d'action (`#top-action-btn`,
  `index.html:297`, aujourd'hui vidé systématiquement par `js/app.js:214`) redevient
  contextuel — ＋ (inventaire), « 📋 Copier » + « 🗑️ Vider » (courses), ⚙️ (IA),
  « 📋 Coller une recette » (favoris) ; icônes mobiles (`#mh-icons`) et sous-titre mobile
  (`#mh-subtitle`, compteur contextuel) dynamiques ; barres de recherche masquées hors
  inventaire ;
- retour automatique à l'inventaire ~500 ms après un ajout réussi (l.6458) ;
- compteur « Principal (N ingrédients) » de la barre latérale (`#sb-label-principal`) remis
  à jour ;
- toasts de feedback sur stock/panier/suppression restaurés, et remise à zéro de
  `shoppingSource` comme à l'origine (lire l.4724-4751 avant d'écrire) ;
- emoji deviné pour les ingrédients hors stock (`autoEmoji(val)` au lieu de « ✨ » fixe —
  `autoEmoji` existe, `src/utils/helpers.js`) ;
- suppression de la clé API possible : champ vidé + Sauver → clé effacée, toast « Clé API
  supprimée » (le monolithe l'acceptait ; l'actuel refuse).

### D. Styles jamais créés (nouveau code, pas des pertes)

- `.add-results-list` / `.add-res-item` (autocomplétion du formulaire d'ajout,
  `index.html:645`, `js/app.js:992`) : créer le style — lignes cliquables avec padding,
  survol, séparation ;
- `.tb-btn.small` (`src/ui/recipe.js:49`) : créer la variante réduite OU retirer la classe
  d'intention — pas de classe morte.

## Pièges connus

- Zone du sélecteur = zone du LOT 006 : tests de non-régression sur le pré-cochage avant/après.
- Le retour auto à l'inventaire ne doit PAS casser l'enchaînement d'ajouts : le formulaire se
  réinitialise déjà (LOT 006) — reproduire le comportement du monolithe tel quel (500 ms).
- `updateTopbar` touche `switchView` : vérifier chaque vue après (5 vues × bureau/mobile).
- La barre supérieure et le header mobile portent les **voyants de synchro et d'état réseau
  posés par le LOT 007** : ÉTENDRE la fonction existante sans les écraser (rappel d'audit de
  campagne, Gemini 3.6 Flash).

## Plan de test

- [ ] Unitaires : `cycleEmoji` (cycle circulaire, liste de secours) ; validation du sélecteur
      avec nom/emoji édités ; `autoEmoji` sur extra
- [ ] Manuels (Joel, mobile ET bureau) : 🎲 change l'emoji ; nom corrigé conservé dans la
      liste ; Entrée partout ; filtres scrollables au doigt ; barre supérieure contextuelle
      sur les 5 vues ; retour auto après ajout ; suppression de clé possible

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK ; audit Léger/Standard rendu
- [ ] Cocher les points §3 dans la fiche régressions — **fin de la restauration : tous les
      points §1-§4 de la fiche doivent être cochés ou explicitement reportés**

## Traçabilité

- Origine : fiche régressions §3 — balayage 2026-07-29 ; `cycleEmoji` signalé aussi par
  Gemini 3.1 Pro
- Dépend de : LOT 011 (ordre de campagne)
