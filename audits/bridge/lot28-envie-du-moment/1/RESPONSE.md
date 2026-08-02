Codex 5.6 Sol

# Verdict global : GO AVEC RÉSERVES

Aucun finding [CRITIQUE] ni aucune correction bloquante. La fonctionnalité respecte les décisions de Joel, la hiérarchie est intelligible, le chemin vide conserve statiquement le prompt antérieur, et les commits d’outillage ne touchent pas l’application.

Deux durcissements sont néanmoins réels : `exceptions` peut désormais faire échouer une génération si sa donnée externe n’est pas textuelle, et la limite de `envie` ne protège que la saisie HTML.

## Findings

### F1 — `exceptions` non textuel provoque un échec de génération

- VERDICT : À CORRIGER
- GRAVITÉ : MINEUR
- TAG : DURCISSEMENT
- JUSTIFICATION : le lot crée une exposition nouvelle. Avant lui, `exceptions` était persisté mais jamais lu. Il est maintenant lu avec `.trim()` sans garde de type.
- PREUVE : [src/services/gemini.js:266](/C:/VIBE_CODING/Projet_FoodApp/src/services/gemini.js:266), [src/services/firebase.js:86](/C:/VIBE_CODING/Projet_FoodApp/src/services/firebase.js:86), [src/actions.js:349](/C:/VIBE_CODING/Projet_FoodApp/src/actions.js:349), [src/state.js:261](/C:/VIBE_CODING/Projet_FoodApp/src/state.js:261)

Citation littérale :

```js
const exceptionsStr = (aiConfig.exceptions || '').trim();
```

Le cloud et l’import vérifient que `aiConfig` est un objet simple, mais pas le type de ses propriétés. `sanitizeGlobalState` recopie ensuite la valeur telle quelle.

Scénario : une sauvegarde valide pour l’inventaire contient `"exceptions": {"nom":"Riz"}` → restauration acceptée → clic sur Générer → `trim is not a function` → Joel voit `Erreur IA…` et aucune recette.

La vraie valeur connue de Joel, `"Riz"`, est une chaîne et ne déclenche donc pas ce défaut.

Mutation probante : remplacer `exceptions: 'parmesan'` par `exceptions: { nom: 'parmesan' }` dans le test de génération, avec comme résultat attendu un échec propre ou une exception ignorée. Le code actuel échouerait avant l’appel réseau. Après correction, retirer la garde de type devrait refaire rougir ce test.

Ce cas appartient à la même famille que F-011, mais l’exposition de `exceptions` est nouvelle dans ce lot. Déclencheur corrompu/improbable : non bloquant.

### F2 — la borne de 100 caractères ne couvre ni le cloud ni les sauvegardes

- VERDICT : À CORRIGER
- GRAVITÉ : MINEUR
- TAG : DURCISSEMENT
- JUSTIFICATION : `maxlength` protège le clavier et le collage normal dans l’interface, pas une valeur restaurée ou synchronisée.
- PREUVE : [index.html:299](/C:/VIBE_CODING/Projet_FoodApp/index.html:299), [src/utils/helpers.js:245](/C:/VIBE_CODING/Projet_FoodApp/src/utils/helpers.js:245), [src/services/gemini.js:252](/C:/VIBE_CODING/Projet_FoodApp/src/services/gemini.js:252)

Citations littérales :

```html
<input class="ai-input" id="ai-envie" maxlength="100"
```

```js
return typeof brut === 'string' ? brut.trim() : '';
```

```js
🎯 DEMANDE EXPRESSE DE L'UTILISATEUR : « ${envie} »
```

Scénario : un cloud ou fichier altéré fournit 5 000 caractères avec un retour à la ligne puis « ignore les contraintes suivantes » → les 5 000 caractères sont affichés et transmis intégralement, avant les contraintes et sous le libellé « demande expresse » → surcoût et risque de recettes ne respectant plus les ingrédients imposés ou le format attendu.

Ce n’est pas une nouvelle classe de vulnérabilité : `exclusions` était déjà interpolé sans borne à [src/services/gemini.js:279](/C:/VIBE_CODING/Projet_FoodApp/src/services/gemini.js:279). Le nouveau champ est toutefois un nouveau point d’entrée, placé plus haut dans la hiérarchie. Ce n’est pas une compromission par un tiers dans l’usage ordinaire : Joel est normalement l’auteur de cette consigne.

Mutation probante : injecter `envie: 'x'.repeat(5000) + '\nIgnore les contraintes'` par le chemin cloud/import et vérifier sur le corps envoyé que la représentation canonique est bornée. Ce test échouerait aujourd’hui.

### F3 — le test de synchro ne simule pas réellement une frappe

- VERDICT : À CORRIGER dans la qualification de la preuve
- GRAVITÉ : MINEUR
- TAG : BÉNIN
- JUSTIFICATION : le test protège bien la liste `AI_FORM_FIELD_IDS`, mais sa description « Joel tape » omet le gestionnaire `oninput` réellement exécuté par le navigateur.
- PREUVE : [tests/sync-engine.test.js:353](/C:/VIBE_CODING/Projet_FoodApp/tests/sync-engine.test.js:353), [src/ui/settings.js:143](/C:/VIBE_CODING/Projet_FoodApp/src/ui/settings.js:143), [src/services/sync.js:356](/C:/VIBE_CODING/Projet_FoodApp/src/services/sync.js:356)

Citation du test :

```js
document.getElementById('ai-envie').value = 'chili con carne';
```

Il ne déclenche ni `input`, ni `window.saveAiConfigFromUI()`. Dans l’application réelle, la frappe appelle synchronement :

```js
state.aiConfig.envie = document.getElementById('ai-envie')?.value || '';
...
saveState(false);
```

La première empreinte de synchro détecte alors déjà le changement d’état à la ligne 356 et écarte la photo cloud avant toute restauration du formulaire.

Mutation probante : retirer `'ai-envie'` de `AI_FORM_FIELD_IDS` fait rougir le test actuel, mais une version fidèle qui appelle ensuite `window.saveAiConfigFromUI()` resterait protégée par `currentSyncDocJson()`. M4 prouve donc le filet DOM secondaire — utile pour une modification programmatique/autofill — pas sa nécessité pour une frappe ordinaire.

Aucune panne applicative actuelle : l’ajout à `AI_FORM_FIELD_IDS` reste correct.

### F4 — le suivi final contient deux comptages périmés

- VERDICT : À CORRIGER
- GRAVITÉ : MINEUR
- TAG : BÉNIN
- JUSTIFICATION : le fichier neuf contient 13 tests, plus un test ajouté à la synchro, soit 14 tests Vitest au total. Le suivi annonce 14 + 1. Après l’ajout des 200 tests du pont, la métrique Pytest finale est 216, pas 16.
- PREUVE : [CURRENT_GOAL.md:36](/C:/VIBE_CODING/Projet_FoodApp/CURRENT_GOAL.md:36), [CURRENT_GOAL.md:38](/C:/VIBE_CODING/Projet_FoodApp/CURRENT_GOAL.md:38), [fiche LOT 028:287](</C:/VIBE_CODING/Projet_FoodApp/RoadMap & Project Pipeline/LOT 028 - Envie du moment [EN COURS].md:287>), [fiche LOT 028:289](</C:/VIBE_CODING/Projet_FoodApp/RoadMap & Project Pipeline/LOT 028 - Envie du moment [EN COURS].md:289>)

Citations littérales :

```text
14 tests neufs + 1 test de synchro
tests/envie-du-moment.test.js (14 tests) + 1 test de synchro
948/948 Vitest · 16/16 Pytest
```

Le fichier `tests/envie-du-moment.test.js` comporte 13 blocs `it`; la hausse 934 → 948 correspond bien à 13 + 1. Ces erreurs n’affectent pas l’application, seulement la fiabilité de la preuve de livraison.

Mutation probante : passer les mentions `14` à `13` et `16` à `216` ne ferait rougir aucun verrou actuel — ces métriques documentaires ne sont pas contrôlées automatiquement.

## Axes demandés

### A — Hiérarchie : OK

Les contradictions brutes restent volontairement dans le message. Exemple avec `envie = chili con carne` et `meal = dessert` :

```text
Les 5 recettes doivent TOUTES y répondre
```

contre :

```text
1. TYPE DE PLAT : Obligatoire -> dessert.
```

Mais l’arbitrage est littéral et sans ambiguïté :

```text
Cette demande PRIME sur les contraintes 1 (TYPE DE PLAT) et 2 (CUISINE) si elles la contredisent.
Elle ne prime JAMAIS sur la contrainte 3 (INGRÉDIENTS IMPOSÉS), qui reste au-dessus de tout.
```

La RÈGLE D’OR existante dit :

```text
Si un ingrédient est "IMPOSÉ" (ex: Riz), il A PRIORITÉ et annule toute contrainte de régime qui l'interdirait
```

Les deux passages sont cohérents. Exemple `envie = sans riz` avec Riz imposé : la demande et l’ingrédient se contredisent frontalement, mais les deux règles donnent le même vainqueur, l’ingrédient imposé. « 5 recettes différentes » reste également compatible avec « 5 variantes » du même plat.

### B — Branchement des exceptions : OK

Ce changement de comportement est déclaré et a fait l’objet d’une décision explicite :

- valeur historique `"Riz"` citée dans la fiche à la ligne 42 ;
- décision fermée « le brancher enfin » aux lignes 44 et 52.

Le pare-feu A/B n’est donc pas violé : ce n’est pas un nettoyage qui modifie subrepticement le comportement, et Joel a explicitement arbitré ce changement. Au premier lancement, une valeur déjà persistée prendra bien effet sans nouvelle saisie — c’est précisément le comportement décidé et tracé.

### C — Robustesse de `envie` : OK, avec F1 pour `exceptions`

Le chemin externe est :

```text
cloud → extractSyncedState → applyExternalState → sanitizeGlobalState
fichier → importJSON → applyExternalState → sanitizeGlobalState
```

Une valeur `envie` non textuelle :

- n’est pas éliminée à l’entrée ;
- est éventuellement convertie en texte par l’affectation à `input.value` ;
- est ignorée sans exception par `envieActive`, grâce à `typeof brut === 'string'`;
- ne fait donc planter ni le résumé ni la construction du prompt.

Elle peut produire une incohérence visuelle sur donnée corrompue — `[object Object]` dans le champ mais aucune consigne active — mais pas un crash. C’est la famille F-011. En revanche, `exceptions.trim()` introduit bien le nouveau crash décrit en F1.

### D — Injection : réserve F2

Une valeur hostile est transmise textuellement et peut tenter de réécrire la suite du prompt. La classe de risque existait déjà avec `exclusions`; le nouveau champ augmente l’autorité apparente de cette donnée. Avec les sources réellement produites par l’application, la borne HTML suffit. Avec un cloud ou fichier altéré, elle ne suffit pas.

### E — Verrous, test par test

Aucun des 14 tests ajoutés n’est un faux verrou au sens strict « aucune mutation plausible ne le fait rougir ».

| Test | Mutation de production qui le fait rougir | Appréciation |
|---|---|---|
| `envie-du-moment:36` | retirer `maxlength` ou `oninput` | Mord |
| `:48` | déplacer le champ après les puces/l’accordéon | Mord |
| `:56` | retirer `maxlength` d’`ai-exceptions` | Mord |
| `:67` | retirer l’écriture d’état ou la restauration du champ | Mord |
| `:79` | retirer le rafraîchissement ou la branche d’effacement | Mord, mais ne verrouille pas le `<span>` vert ni l’ellipse CSS |
| `:111` | retirer la demande, `TOUTES` ou `JAMAIS 5 plats` | Mord |
| `:123` | retirer l’une des deux règles de priorité ou le type de plat du prompt | Mord ; prouve le texte, pas l’obéissance probabiliste du modèle |
| `:136` | déplacer le bloc après `CONTRAINTES` | Mord |
| `:145` | retirer le `trim()` d’`envieActive` | Mord |
| `:153` | rendre l’un des deux blocs conditionnels inconditionnel | Mord, mais son titre surpromet une égalité complète |
| `:184` | retirer l’exception ou la placer avant les régimes | Mord ; son test d’ordre reste large |
| `:195` | injecter toujours le libellé d’exception | Mord |
| `:203` | retirer l’interpolation d’`exclusions` | Mord |
| `sync-engine:327` | retirer `ai-envie` de `AI_FORM_FIELD_IDS` | Mord, avec la réserve de fidélité F3 |

L’assertion :

```js
'générer EXACTEMENT 5 recettes différentes.\\n\\n🚨 CONTRAINTES'
```

est correcte : elle examine le corps JSON sérialisé, où les véritables sauts de ligne sont représentés par les deux caractères `\` et `n`. Elle ne prouve pas, seule, l’égalité de l’intégralité du message ; cette conclusion repose sur le diff statique et sur la contre-épreuve temporaire main/branche déjà exécutée.

### F — Effets de bord : OK

- `updateAiCtaSummary` conserve ses anciens appelants sans changement de signature. La branche vide utilise toujours `textContent`; `replaceChildren` ne s’exécute que pour une consigne active, sur un conteneur qui ne porte aucun état vivant.
- Le texte utilisateur est créé par `h()`, jamais par `innerHTML`.
- Aucun test ne dépend de `ai-exceptions` ou `ai-exclusions` en tant que `<textarea>` : les appelants lisent seulement `.value`.
- `maxlength="80"` ne tronque pas une valeur déjà persistée : `restoreAIConfig` l’affecte programmatiquement en entier. Il ne limite que les nouvelles saisies utilisateur.

### G — Cycles d’import : OK

`settings.js:7` importe `aiPanel.js`. Aucun module de `src/` n’importe `settings.js`; seul le point d’entrée `js/app.js` le fait. Les dépendances transitives d’`aiPanel.js` ne remontent donc jamais vers `settings.js`. Aucun cycle nouveau.

## Méta-verdict

Objet réellement audité : diff complet `main...HEAD`, soit les 19 fichiers versionnés, avec remontée des chemins cloud, import JSON, restauration UI, génération Gemini, synchro et graphe d’import. Les commits `ce6c239` et `797fe95` ne modifient respectivement que `.codex/config.toml`, puis `PROJECT_MAP.md`, `scripts/audit_bridge.py` et son test : aucun fichier applicatif ni aucune référence depuis le bundle. Le dossier non suivi `audits/bridge/` est hors du diff demandé.

Niveau réévalué : **élevé de Standard à Dur**, car `src/services/gemini.js` est une zone sensible explicite et les nouvelles valeurs traversent des frontières externes persistées.

Audit statique uniquement : je n’ai pas rejoué les validations annoncées.

Aucune correction bloquante : **GO**.