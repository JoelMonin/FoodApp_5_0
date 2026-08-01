# LOT 022 — La fiche de réglages IA ne peut plus arriver à moitié vide — FICHE

> **Statut :** ✅ CLOTURE — publié en **Version 5.14** le 2026-08-01, avec les LOTS 021, 023
> et 024. Ouvert et terminé le même jour.
> **Branche :** `feat/lot22-reglages-ia-complets`, chaînée depuis `feat/lot21-verificateur-de-types`
> **Niveau d'audit : Standard** — changement de COMPORTEMENT, dans le chemin de restauration
> (cloud et fichier). Preuve par retrait obligatoire.
> **Version visée :** 5.14, avec le LOT 021
> **Origine :** constat ouvert par le vérificateur de types (LOT 021 §5), explication détaillée
> demandée par Joel, correction décidée par lui.

---

## 1. Le défaut

Deux chemins fabriquaient la fiche de réglages IA **à la main**, avec la seule clé d'API, alors
que `defaultAiConfig()` (`src/state.js:25`) est la représentation canonique. Tout le reste —
type de plat, nombre de personnes, temps, difficulté, régime, cuisines, équipement,
créativité — disparaissait.

**Ce que ça produisait vraiment.** La moitié des réglages ont un filet chez le constructeur de
message (`aiConfig.diet || []`), l'autre moitié n'en a **aucun**. Le message envoyé à Gemini
contenait donc, mot pour mot — reproduit et vérifié :

```
1. TYPE DE PLAT : Obligatoire -> undefined.
4. NOMBRE DE PERSONNES : Exactement undefined personnes.
7. TEMPS & DIFFICULTÉ : Max undefined minutes max, niveau undefined.
```

Rien ne plantait, une partie des consignes tenait — d'où la discrétion du défaut. Des recettes
sortaient, mais pour un nombre de personnes fantôme et sans les contraintes de Joel.

---

## 2. La correction du diagnostic — le premier endroit montré était le mauvais

Le vérificateur avait signalé **le repli de `sanitizeGlobalState`** (`if (!state.aiConfig)`),
et c'est ce que j'ai d'abord présenté à Joel. En creusant à sa demande, la **vraie porte
d'entrée** est ailleurs :

`applyExternalState` (`src/state.js`, restauration **cloud ou fichier**) construisait
`{ ...(data.aiConfig || {}), apiKey: localApiKey }`. Quand la donnée entrante n'a pas de
réglages, le résultat est une fiche à **une seule case** — mais **non vide**. L'ancien garde
`if (!state.aiConfig)` voyait donc un objet valide et **ne faisait rien**.

**C'est prouvé, pas déduit** : la mutation M3 (§4) ne corrige que le cas « fiche absente » —
la restauration cloud continue de rougir. Corriger l'endroit que j'avais d'abord montré
n'aurait pas réparé le défaut.

Le bon geste existait déjà **deux fois** dans le dépôt (`services/firebase.js:91`,
`actions.js:349`) : partir de la fiche complète et n'écraser que ce qui arrive. Trois
endroits, deux corrects, un fautif.

---

## 3. Le correctif — un seul gardien

```js
state.aiConfig = { ...defaultAiConfig(), ...(state.aiConfig || {}) };
```

**Pourquoi dans `sanitizeGlobalState` et nulle part ailleurs** : c'est le rôle même de cette
fonction, et **tous** les chemins d'entrée y passent — chargement local (`l.131`), `setState`
(`l.~304`, donc aussi `applyExternalState`), réinitialisation (`actions.js:207`). Un gardien
unique plutôt que trois recopies : c'est exactement l'erreur qu'on corrige.

**L'ordre de fusion est le cœur de la règle** : les défauts d'ABORD, les réglages de Joel
PAR-DESSUS. Seule une case **absente** est comblée. Une case présente est intouchable, **y
compris quand elle vaut `0` ou `''`** — une créativité réglée à zéro est un choix, pas une
absence (même piège qu'au LOT 017 sur ce réglage précis).

---

## 4. Preuve par retrait — 3/3, 0 nulle

| Mutation | Ce qu'elle rejoue | Résultat |
|---|---|---|
| **M1** | Retour au repli d'origine | 7 tests nommés rouges, témoin vert |
| **M2** | **Ordre de fusion inversé** — les défauts écraseraient les réglages de Joel | 8 rouges, témoin vert |
| **M3** | On ne comble que la fiche *absente* (le correctif que j'avais d'abord proposé) | 6 rouges — **la restauration cloud passe toujours au travers** |

M2 est le garde-fou le plus important du lot : il prouve qu'un réglage volontaire ne peut pas
être remplacé par un défaut.

---

## 5. Un test existant réécrit — en connaissance de cause

`tests/state.test.js` gravait « `aiConfig` est REMPLACÉ en entier » en vérifiant que les
champs valent **`undefined`**. La règle de fond — *les réglages de l'ANCIENNE fiche ne
survivent jamais à une restauration* — **est intacte** : le correctif ne réinjecte jamais les
anciennes valeurs, uniquement les valeurs par défaut.

Ce test vérifiait donc le **symptôme**, pas la règle. Or `undefined` n'était pas une
intention : c'est précisément ce qui partait dans le message envoyé à l'IA. Le test est
réécrit pour verrouiller **les deux** : ce qui ne doit pas survivre (`not.toBe(90)`) **et** ce
qu'on trouve désormais à la place (`toBe(50)`). C'est un verrou plus fort qu'avant, pas plus
faible.

---

## 6. Validation

**Types OK · 831/831 Vitest · 16/16 Pytest · build OK.** 6 tests neufs
(`tests/ai-config-complete.test.js`), dont une **preuve de bout en bout** qui ne regarde pas
une structure de données mais **le message réellement envoyé** : après restauration d'une
sauvegarde sans réglages, il ne contient plus le mot `undefined`.
