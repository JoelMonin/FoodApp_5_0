# BACKLOG — Alias `state` fragile

> **Priorité :** Moyenne (dette structurelle, pas de bug visible aujourd'hui)
> **Effort estimé :** 1 h
> **Origine :** ancien chantier `RACE_CONDITIONS_AI` §F3, **non traité** par le LOT 006
> **Rescapé le 2026-07-28** lors de la réorganisation de la roadmap

---

## Pourquoi cette fiche existe

L'ancien chantier `RACE_CONDITIONS_AI` contenait trois défauts. Les deux premiers ont été
corrigés par le **LOT 006** (collision de requêtes IA, bouton « Sauver » silencieux). Le
troisième ne l'a pas été. Sans cette fiche, il disparaissait avec le fichier d'origine.

## Le problème

`setState` (`src/state.js`) **réassigne** l'objet d'état au lieu de le modifier :

```javascript
export function setState(partialState) {
  state = { ...state, ...partialState };   // nouvelle référence
  sanitizeGlobalState();
  saveState();
}
```

Or `js/app.js` garde un alias local `let state = moduleState;`. Après chaque `setState`, cet
alias pointe vers l'**ancien** objet. Le code compense en réécrivant `state = moduleState;`
à chaque endroit concerné — aujourd'hui aux lignes du démarrage, de `applyCloudState` et de
l'écouteur `stateUpdated`.

**Le risque n'est pas théorique** : il suffit qu'un futur `setState` soit ajouté quelque part
sans le `state = moduleState;` qui va avec pour que l'application travaille silencieusement sur
des données périmées. Rien ne le signalerait.

## Options

**Option A — Muter au lieu de réassigner** (recommandée, ~1 h)
```javascript
export function setState(partialState) {
  Object.assign(state, partialState);
  sanitizeGlobalState();
  saveState();
}
```
L'alias reste valide à vie, les `state = moduleState;` compensatoires disparaissent.
*Attention* : `Object.assign` remplace `aiConfig` en entier (pas de fusion profonde) — c'est
le comportement actuel, donc pas de changement observable, mais à vérifier explicitement.

**Option B — Supprimer l'alias** et lire `moduleState.x` partout (~80 occurrences).
Plus propre sur le fond, beaucoup plus invasif.

## Pare-feu A/B

**Nature A** attendue (aucun changement de comportement observable), **à condition** de
démontrer l'équivalence sur `aiConfig` et sur les tableaux. Au moindre doute : B, donc spec.

## Critères d'acceptation

- [ ] Plus aucun `state = moduleState;` dans `js/app.js`
- [ ] Synchro cloud puis affichage de l'inventaire : comportement identique
- [ ] Tests existants verts, sans modification de leurs attendus

## Traçabilité

- Fichier d'origine : `RACE_CONDITIONS_AI.md` (devenu `LOT 006`)
- Audit : `ULTRA_AUDIT_REPORT.md` finding A8
