# BACKLOG — Régressions de la migration monolithe → modules

> **⚑ CHECK-LIST DE LA CAMPAGNE « Restauration & Refonte » (2026-07-29).** Cet inventaire
> est ventilé dans les lots ; chaque lot coche ses points ici à sa clôture. Fin du LOT 012 :
> tout §1-§4 coché ou explicitement reporté.
>
> | Points | Lot |
> |---|---|
> | C2, C3, C4 + créativité + hygiène `shoppingChecked` | **LOT 008** ✅ terminé, double audit passé (2026-07-29), À PUBLIER |
> | §2 (info-last-sync, info-network, online/offline, voyant) | **LOT 007** |
> | C1, C6, C7, C8 (3 champs restants) | **LOT 009** |
> | C5, C9, C10, C11, C12 | **LOT 010** |
> | §4 SAUF la topbar (cartes/détail/prompts/favoris/URL) + confort de génération (§3) | **LOT 011** |
> | §3 restant (picker 🎲, clavier, styles neufs…) + **topbar contextuelle (§4)** | **LOT 012** |
> | §5 (faux morts) : NE PAS restaurer — garde-fou permanent | tous |
> | Duplication `.generate-btn` (§ fin) | **LOT 014** |
>
> **Origine :** balayage systématique du 2026-07-29, déclenché par la découverte que la
> synchro automatique du LOT 007 était la **troisième** perte silencieuse de la même
> migration (LOTS 001-003). Quatre agents en parallèle (fonctions, câblage événementiel,
> interface, styles) + 4 signalements de Gemini 3.1 Pro.
> **Méthode de preuve :** toute absence déclarée = 2 recherches convergentes minimum ;
> les points lourds ont en plus été contre-vérifiés manuellement par Claude Code.
> **Couverture :** 102 fonctions du monolithe, 407 sélecteurs CSS, 111 ids HTML,
> la totalité des écouteurs d'événements et minuteries.

## Verdict global

La migration a très bien conservé la **structure** (105/105 éléments HTML retrouvés,
405/407 règles CSS migrées à l'identique). C'est le **recâblage JavaScript** qui a semé
les régressions : ~14 casses franches et ~20 pertes de confort. Le motif récurrent est
toujours le même : le style ou le HTML a survécu, le fil qui l'animait a été coupé ou
rebranché de travers.

---

## 1. CASSES FRANCHES — mort, mensonger ou dangereux (priorité haute)

| # | Quoi | Impact utilisateur | Ancrage technique |
|---|---|---|---|
| C1 | **Changer l'icône d'un ingrédient : mort** | Le clic plante silencieusement avant d'ouvrir la fenêtre (champ `edit-emoji-input` visé nulle part défini — câblage réinventé de travers, cet id n'a JAMAIS existé) | `js/app.js:862` (sans garde), modal `index.html:172-192` |
| C2 | ✅ **LOT 008** — **« Importer uniquement le stock » ment** | Les DEUX boutons d'import font un remplacement TOTAL ; la fusion douce (statuts seulement, favoris/config intacts) n'existe plus nulle part. Perte de données en croyant faire une maj légère | `index.html:587-588` (2× `restoreJSON`), monolithe l.6517-6562 (fusion `areSimilar`) — `importStockOnly` créée, `#restore-file` recâblé |
| C3 | ✅ **LOT 008** — **Clé API en clair dans les sauvegardes** + import qui l'efface | Le fichier exporté contient la clé Gemini (le monolithe la blanchissait) ; importer une vieille sauvegarde écrase la clé locale. Vraie origine probable du bug « ma clé disparaît » | `src/actions.js:76-84` vs monolithe l.6489-6490 et l.6507 — `exportJSON` blanchit, `applyExternalState` (point d'entrée unique) préserve la clé |
| C4 | ✅ **LOT 008** — **Inventaire vide au premier lancement / après réinitialisation** | Le monolithe reconstruisait ~273 ingrédients par défaut ET préservait la clé ; l'actuel fait `localStorage.clear()` + reload → app vide, clé perdue | `src/actions.js:64-69`, `src/state.js:88-115` (aucun repli), monolithe l.4310-4312 — repli sur `DEFAULT_DB` (297 entrées, reconstruites le 2026-07-29 depuis l'export réel de Joel) ; `resetAllData` pousse au cloud avant reload |
| C5 | **Filtre « Type de cuisine » silencieusement ignoré** | Les puces s'activent visuellement mais l'IA ne reçoit jamais le choix : écrit dans `aiConfig.cuisine`, lu depuis `aiConfig.cuisines` | `index.html:432-442` + `js/app.js:430-436` (écrit) vs `src/services/gemini.js:73` (lit) ; monolithe l.4958 mappait `cuisine→cuisines` |
| C6 | **Plein écran recette mort trois fois** | Bouton appelé sans argument (no-op) ; classe togglée `fullscreen` inconnue du CSS (qui attend `recipe-fullscreen`) ; API plein écran native (`requestFullscreen` + listeners) disparue | `index.html:116`, `js/app.js:528-531`, `css/style.css:3154-3177`, monolithe l.5432-5464 |
| C7 | **Bouton Imprimer détruit + swipe mort (modal recette)** | `openRecipeDetail` remplace tout le squelette statique du modal ; le bouton 🖨️ n'est jamais recréé (0 occurrence dans `src/ui/recipe.js`) et les listeners de fermeture par glissement partent avec | `js/app.js:463-464` (`replaceChildren` sur l'overlay), `index.html:115`, `js/app.js:1403-1407` |
| C8 | **Panneau « Informations Système » mort** | 5 lignes figées sur « -- » pour toujours (clé masquée, utilisateur cloud, taille stockage, dernière synchro, réseau) ; la fonction migrée vise un id inexistant | `index.html:609-629`, `js/app.js:775-779` (`system-storage` inexistant), monolithe l.4440-4487 |
| C9 | **Plafond « max 6 épinglés » perdu** | L'UI promet toujours « Max 6 ingrédients imposés » mais `togglePin` n'a plus aucun plafond ni toast (les extras, eux, gardent le leur) | `src/actions.js:20-26` vs monolithe l.4733-4742 ; promesse `index.html:404` |
| C10 | **Épinglés invisibles dans la vue IA** | Un ingrédient épinglé est bien envoyé à l'IA mais n'apparaît plus dans la zone « Ingrédients imposés » (impossible de le voir/retirer là) ; le sous-titre contextuel (« X en stock · Y épinglés ») est figé | `js/app.js:1240-1249` (extras seuls) vs monolithe l.4875-4910 ; `index.html:332` figé vs monolithe l.4943 |
| C11 | **Tri alphabétique de l'inventaire perdu** | Un ingrédient ajouté apparaît en fin de grille au lieu de sa place alphabétique | `js/app.js:281-301` (aucun tri) vs monolithe l.4646 (`localeCompare 'fr'`) |
| C12 | **Quantités non recalculées selon le nb de personnes** | Les boutons −/+ changent le chiffre affiché mais plus les quantités (300 g restait 300 g au lieu de 450 g) | `js/app.js:533-540` (commentaire « could be added ») vs monolithe l.5467-5540 (`scaleQty`) |

## 2. À ABSORBER PAR LE LOT 007 (périmètre synchro — déjà à moitié dans la spec)

- `#info-last-sync` (date de dernière synchro) et `#info-network` (état réseau) du panneau
  C8 : leur alimentation naturelle est le moteur de synchro du lot 7.
- Écouteurs `online`/`offline` : le lot 7 prévoit déjà un déclencheur de pull sur `online`.
- L'indicateur animé `.sync-indicator.thinking/.success/.error` : déjà dans la spec v2.
- Le reste du panneau C8 (`info-api-key`, `info-fb-user`, `info-storage`) reste hors lot 7.

## 3. CONFORT PERDU (restaurations légères, à grouper dans un lot « restauration »)

- **Bouton 🎲 de changement d'emoji dans le sélecteur** (`cycleEmoji`, monolithe l.5809) +
  édition par ligne du sélecteur (nom modifiable, emoji) — le lot 6 a restauré le style et
  le pré-cochage, pas l'édition. CSS `.picker-magic-btn` dormant (`css/style.css:2467`).
- **Grille d'emojis locale à l'ouverture** de « Modifier l'icône » (avec C1) + styles :
  le code émet `emoji-btn`, le CSS migré attend `emoji-edit-btn` (`css/style.css:2093`).
- **Entrée** ajoute l'ingrédient hors stock (`#ez-input`, monolithe l.6744) ; **Entrée** sur
  le titre de « Coller une recette » → saut au champ texte (l.6746).
- **Textes d'étape animés pendant la génération IA** (« Analyse du stock… », l.5052-5058).
- **Scroll auto vers les résultats IA sur mobile** après génération (l.5068-5072).
- **Retour auto à l'inventaire** 500 ms après un ajout (l.6458) — à arbitrer (choix produit ?).
- ✅ **LOT 008** — **Slider de créativité non restauré** au rechargement (revient à 50, puis
  écrase la vraie valeur à la première sauvegarde) — monolithe l.5033. `restoreAIConfig`
  repositionne désormais le slider.
- **Mode 🎲 « recette aléatoire » dégradé** : ne réinitialise plus les filtres ni ne booste
  la créativité (l.5083-5103) — simple alias de la génération normale.
- **Champs de « Coller une recette » non vidés** à l'ouverture (le lot 6 ne purge que la
  recette transformée, pas les champs titre/contenu/URL).
- **Suppression de la clé API impossible** (le monolithe acceptait une clé vide).
- **Scroll horizontal des filtres sur mobile** (`touchmove` stopPropagation, l.6790).
- **Anti-autofill** du champ recherche au boot (l.6774-6781).
- **Emoji deviné pour les ingrédients hors stock** (`autoEmoji` au lieu de « ✨ » fixe).
- **Compteur « Principal (N) »** de la barre latérale plus mis à jour (`sb-label-principal`).
- **Toasts de feedback** sur stock/panier/suppression disparus ; `resetCart` ne vide plus
  coches et articles libres.
- **Styles jamais créés** (nouveau code, pas des pertes) : `.add-results-list`/`.add-res-item`
  (autocomplétion d'ajout, texte brut non stylé), `.tb-btn.small`.

## 4. DÉGRADATIONS DE FOND (gros morceaux, chacun = un vrai chantier à arbitrer)

- **Cartes de résultats IA appauvries** : perdu — méta complète, pitch, tags d'ingrédients
  vert/orange/rouge avec correspondance stock (`.r-tag` orphelin dans `css/style.css:1618+`),
  boutons ⭐/🛍 directs, pastilles d'état dans le détail, étapes cochables, Nutri-Score visuel,
  affichage des favoris texte bruts (`r.content` plus géré → favori collé « tel quel » vide).
  Monolithe l.5283-5337.
- **Barre supérieure contextuelle** (→ **LOT 012**, seule entrée du §4 hors LOT 011) : le
  bouton d'action par vue (＋ / Copier / Vider / ⚙️ / Coller) est systématiquement vidé
  (`js/app.js:214`) ; icônes mobiles figées ; sous-titre mobile figé sur la version.
  Monolithe l.4520-4579.
- **Prompts IA appauvris** : `safetySettings BLOCK_NONE`, `topK/topP`, « RÈGLE D'OR »
  (imposés prioritaires sur le régime), consigne guillemets — perdus (risque : recettes
  bloquées par filtre de sécurité, JSON cassé plus fréquent). Le collage de recette a perdu
  l'injection de l'inventaire et le champ `s` (stock/pinned/missing).
- **Récupération d'URL dégradée** : Jina Reader (texte propre + titre auto) → allorigins
  (HTML brut, pas de titre).
- **Cartes favoris appauvries** : vignette, tags d'état, boutons Voir/Supprimer, CTA d'état
  vide, date de sauvegarde non stockée.

## 5. NE PAS « RESTAURER » — déjà mort dans le monolithe (preuve faite)

- `openShoppingBulkModal` / `modal-shopping-bulk` / `confirmBulkAdd` : aucun bouton ne
  l'appelait déjà dans le monolithe.
- `addCustomCartItem` + listener `#custom-cart-input` : id et fonction inexistants même
  dans le monolithe (no-op protégé par `?.`).
- `.toast.show`, `.search-input`, `.btn-text`, etc. : classes déjà émises sans règle CSS
  dans le monolithe — hooks sémantiques, aucun changement visuel.

## 6. Arbitrages Joel — TOUS TRANCHÉS le 2026-07-29

Arbitrage global de Joel : **le comportement du monolithe fait référence** (« tout
rebrancher »). En conséquence :

1. **Retour auto à l'inventaire** après ajout : RESTAURÉ (oracle, → LOT 012).
2. **Barre supérieure contextuelle** : RESTAURÉE (oracle, → LOT 012).
3. **Priorités** : ordre de campagne acté dans `ROADMAP.md` (008 → 007 → 009 → … → 014).
4. (Hors fiche, même jour) **Menu « Moteur Tâches Complexes »** : supprimé, remplacé par une
   information en lecture seule dérivée d'`AI_ROLES` (→ LOT 010 §6).

## Duplication SSOT relevée en passant

`.generate-btn` défini deux fois au niveau racine de `css/style.css` (l.1503 et l.3506,
avec `!important`) — complémentaires aujourd'hui, mais contraire à la règle SSOT.
