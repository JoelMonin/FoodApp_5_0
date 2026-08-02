# AUDIT DU DIFF FINAL — LOT 028 « Envie du moment » (FoodApp)

Tu audites le diff final d'un lot terminé. **Mandat : `AGENTS.md`.** Tu es en LECTURE SEULE et
tu n'écris aucun code de ta propre initiative. Ton livrable est un verdict argumenté, pas un
correctif.

## Périmètre exact

```
git diff main...HEAD          # branche feat/lot28-envie-du-moment
```

Commits du lot : `250dddc` (la fonctionnalité), `ce6c239` (configuration Codex),
`797fe95` (pont d'audit). **Seul `250dddc` porte du code applicatif** — les deux autres sont
de l'outillage d'audit, à ne regarder que pour vérifier qu'ils ne touchent pas l'application.

Fiche du lot (spécification et critères posés AVANT implémentation) :
`RoadMap & Project Pipeline/LOT 028 - Envie du moment [EN COURS].md`.

## Ce que le lot prétend faire

1. Un champ texte libre **« Envie du moment »** (`ai-envie` → `aiConfig.envie`), en tête des
   réglages IA, borné à 100 caractères.
2. Cette consigne part dans le prompt de `generateRecipes` (`src/services/gemini.js`) comme
   **exigence stricte** : les 5 recettes doivent TOUTES y répondre. Demande littérale de
   Joel : « je veux dire "chili con carne" et n'avoir QUE des chili con carne ».
3. **Hiérarchie** : la consigne prime sur les contraintes 1 (type de plat) et 2 (cuisine),
   **jamais** sur la 3 (ingrédients imposés).
4. **Non-régression stricte** : consigne vide ET exceptions vides ⇒ le message envoyé à
   l'IA est identique à celui d'avant le lot, **octet pour octet**.
5. Le champ « Exceptions autorisées » (`aiConfig.exceptions`), **jamais branché à aucun prompt
   depuis l'origine du projet** (ni même dans l'oracle `foodapp-v5-Joel.html`), part enfin
   dans le message, en sous-ligne de la contrainte 6.
6. Le rappel sous le bouton Générer (`updateAiCtaSummary`) affiche la consigne active et se
   rafraîchit à la frappe (il ne suivait que les puces).
7. `ai-envie` ajouté à `AI_FORM_FIELD_IDS` (`src/services/sync.js`) pour qu'un pull cloud
   n'écrase pas une saisie en cours.

## Ce qui a DÉJÀ été fait de mon côté — ne le refais pas, conteste-le si tu le crois faux

- **Preuve par retrait : 9 mutations, 9 rouges nommées, 0 nulle, témoin vert.** Dont deux
  mutations INVERSES (M8/M9) prouvant que le test de non-régression mord si un bloc neuf
  s'invite dans un message qui ne devrait pas le contenir.
- **Contre-épreuve d'égalité exécutée** : la version de `main` et celle de la branche ont été
  chargées côte à côte dans un même test temporaire et appelées sur les mêmes entrées (stock,
  épinglés, hors stock, régime, cuisine, exclusions, anti-répétition). Sans consigne :
  égalité stricte des deux corps de requête. Avec consigne : différence confirmée.
- Validation unifiée verte : types OK · 948/948 Vitest · 216/216 Pytest · build OK.
- Vérification visuelle sur l'application lancée : champ en tête hors accordéon, rappel à jour
  à la frappe, consigne de 62 caractères tronquée sans casser la barre collante.

## TES AXES — cherche à démolir, pas à valider

**A. La hiérarchie est-elle réellement tenue ?** Le lot écrit la priorité dans un bloc de
texte adressé au modèle, sans toucher à la « RÈGLE D'OR » existante (contrainte 6). Est-ce
cohérent ? Y a-t-il une combinaison de réglages où les deux consignes se contredisent
frontalement dans le même message ? Cite les deux passages littéralement.

**B. Le champ « exceptions » enfin branché est-il un changement de comportement non déclaré ?**
Des utilisateurs ont des valeurs déjà enregistrées dans ce champ (Joel a « Riz » dans une
sauvegarde du 2026-07-29). À la première génération après déploiement, ces valeurs partiront
dans le prompt **sans que personne n'ait rien retapé**. Est-ce correctement tracé dans la
fiche ? Est-ce acceptable au regard du pare-feu A/B de `CLAUDE.md` §5, ou cela aurait-il dû
faire l'objet d'une décision explicite de Joel ?

**C. Robustesse des données.** Une valeur `envie` non-textuelle venue du cloud ou d'un fichier
de sauvegarde corrompu peut-elle faire planter `envieActive` (`src/utils/helpers.js`),
`updateAiCtaSummary` (`src/ui/aiPanel.js`) ou la construction du prompt ? Trace
`sanitizeGlobalState`, `extractSyncedState`, `importJSON`. Le lot crée-t-il une exposition
NOUVELLE, ou reste-t-il au niveau de risque déjà consigné sous le finding **F-011**
(`audits/BACKLOG_TECHNIQUE.md`, garde de type absente) ?

**D. Injection de consigne.** `maxlength="100"` est un garde-fou HTML, contournable par le
cloud et par une sauvegarde restaurée, qui n'ont pas de bornes. Que peut faire une valeur
`envie` hostile de 5 000 caractères contenant des instructions ? Est-ce un risque NOUVEAU, ou
identique à celui d'`exclusions`, qui existe depuis l'origine ? Sois précis : ne dramatise pas,
ne minimise pas.

**E. Qualité des verrous.** Lis `tests/envie-du-moment.test.js` et le test ajouté dans
`tests/sync-engine.test.js`. Pour CHAQUE test, pose la question de mutation : « quelle
modification plausible du code de production le ferait rougir ? » Un test qu'aucune mutation ne
fait rougir est un faux verrou — nomme-le. Vérifie en particulier que l'assertion de
non-régression est correcte (elle utilise `\n\n` échappé, parce que le corps de la requête est
du JSON — est-ce juste ?).

**F. Effets de bord non déclarés.** `updateAiCtaSummary` passe de privée à exportée et de
`textContent` à `replaceChildren`. Un appelant existant peut-il en souffrir ? Le passage de
`<textarea>` à `<input>` dans `tests/_helpers/dom-helpers.js` casse-t-il un test qui
dépendrait de la balise ? L'ajout de `maxlength="80"` sur `ai-exceptions`, qui n'en avait
aucun, tronque-t-il une valeur déjà enregistrée ?

**G. Cycles d'import.** `src/ui/settings.js` importe désormais `updateAiCtaSummary` depuis
`src/ui/aiPanel.js`. Vérifie qu'`aiPanel.js` n'importe jamais `settings.js`, directement ou
transitivement.

## Format de sortie attendu

Un verdict global : **GO**, **GO AVEC RÉSERVES** ou **NO-GO**.

Puis, pour chaque finding : gravité (BLOQUANT / MAJEUR / MINEUR), `fichier:ligne`, la
**citation littérale** du code en cause, le scénario concret de défaillance (entrées →
conséquence observable pour Joel), et la mutation qui le prouverait.

Si un axe ne donne rien, écris-le explicitement plutôt que de meubler. **N'invente jamais un
numéro de ligne** : cite ce que tu as lu. Un finding formellement exact peut reposer sur une
prémisse métier fausse — dis-le quand tu as un doute sur la prémisse.
