# LOT 008 — Données en sécurité — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — prochain lot à coder (décision Joel 2026-07-29)
> **Branche à créer :** `feat/lot8-donnees-en-securite`
> **Niveau d'audit : DUR** — touche `src/state.js` et les chemins d'import/export (zone
> sensible « moteur d'état », `DOCTRINE_PRODUIT.md` §3)
> **Effort estimé :** ~½ à 1 journée
> **Rôle dans la campagne : PRÉALABLE BLOQUANT du LOT 007.** Verdict unanime du duel d'audit
> (Gemini 3.1 Pro + Codex 5.6, 2026-07-29) : la synchro automatique transformerait ces casses
> locales en perte de données multi-appareils.

**Lecture obligatoire avant d'écrire une ligne :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`,
`PROJECT_MAP.md`, `Backlog/BACKLOG - Regressions de la migration.md` (§1, casses C2-C3-C4),
et le monolithe `foodapp-v5-Joel.html` aux lignes citées — **il est l'oracle comportemental
de ce lot : on porte, on n'invente pas.**

---

## Objectif

Fermer les quatre chemins par lesquels l'application peut détruire ou divulguer des données :
l'import, l'export, la réinitialisation, et deux incohérences d'état que la synchro
diffuserait. Après ce lot, aucune action utilisateur ne peut perdre la clé API ni écraser
des données en prétendant faire autre chose.

## Périmètre — 7 chantiers

### 1. « Importer uniquement le stock » redevient une fusion (casse C2)

**Aujourd'hui :** les DEUX boutons d'import (`index.html:587-588`) appellent `restoreJSON` →
`Actions.importJSON` → `setState(data)` = remplacement total. Le sous-titre du bouton
(« sans modifier votre configuration ») est mensonger.

**Attendu (oracle : monolithe l.6517-6562) :** créer `importStockOnly(event)` :
- correspondance par `id` d'abord, puis par nom via `areSimilar` (`src/utils/helpers.js`) ;
- met à jour UNIQUEMENT `inStock`, `inCart`, `pinned`, `frozen` des ingrédients trouvés ;
- ajoute les ingrédients inconnus du fichier ;
- ne touche NI aux favoris, NI à `aiConfig`, NI aux autres clés ;
- toast final : « Restauration : X mis à jour, Y ajoutés » (formulation du monolithe).
- Câblage : `#restore-file` → `importStockOnly` ; `#import-file` reste sur la restauration
  totale. Exposer la nouvelle fonction sur `window` (bloc `expose()` de `js/app.js`).

### 2. L'export blanchit la clé API (casse C3a)

**Aujourd'hui :** `exportJSON` (`src/actions.js:76-84`) fait `JSON.stringify(state)` → la clé
Gemini part en clair dans le fichier téléchargé.

**Attendu (oracle : monolithe l.6489-6495) :** export d'un clone avec
`aiConfig: { ...state.aiConfig, apiKey: '' }`. Même principe que `syncPush`
(`src/services/firebase.js:9-13`) — c'est déjà la règle SSOT du projet pour la sortie de
données : la clé ne quitte jamais l'appareil.

### 3. Point d'entrée UNIQUE pour toute donnée externe : `applyExternalState` (casse C3b + F8)

**Aujourd'hui :** deux portes d'entrée divergentes. `applyCloudState` (`js/app.js:47-58`)
préserve la clé locale si le cloud n'en a pas ; `Actions.importJSON` (`src/actions.js:86-101`)
appelle `setState(data)` brut et détruit la clé locale si le fichier n'en contient pas — c'est
la vraie origine du bug « ma clé disparaît ».

**Attendu (leçon du LOT 006 + règle SSOT) :** UNE fonction `applyExternalState(data)` par
laquelle passent TOUS les chemins de données externes : synchro au démarrage, bouton Cloud
Sync, restauration totale de fichier. Comportement :
- préservation de la clé API locale **inconditionnelle** (oracle : monolithe l.4409-4413 et
  l.6507 — meilleure que l'actuelle, qui ne préserve que si le cloud est vide) ;
- passe par `setState` (qui assainit déjà via `sanitizeGlobalState`) ;
- maintient l'alias `state = moduleState` de `js/app.js` (piège connu, fiche
  `LOT 014` / ex-backlog alias state).
- `applyCloudState` est renommée/étendue — mettre à jour ses 2 appelants existants.

### 4. Inventaire par défaut reconstruit (casse C4a)

**Aujourd'hui :** premier lancement ou données effacées → app VIDE. `state.ingredients = []`
(`src/state.js:19`), aucun repli dans `sanitizeGlobalState` (`src/state.js:88-115`).

**Attendu (oracle : monolithe l.4309-4312 + `buildIngredients` l.4332) :** dans
`sanitizeGlobalState`, si `ingredients` est vide ou absent → reconstruire l'inventaire depuis
`DEFAULT_DB` (`src/data.js:42`, ~273 entrées) : `{ id, name, emoji, category, inStock:false,
inCart:false, pinned:false, frozen:false, shoppingSource:null }` par entrée. Reproduire le
mapping exact du monolithe (lire `buildIngredients` avant d'écrire).

**Piège :** ce repli ne doit PAS se déclencher sur un état où `ingredients` existe mais est
volontairement réduit. Le déclencheur est « tableau vide ou absent », rien d'autre.

### 5. Réinitialisation sûre (casse C4b)

**Aujourd'hui :** `resetAllData` (`src/actions.js:64-69`) = `localStorage.clear()` + reload →
app vide ET clé API perdue.

**Attendu :**
- préserver la clé API (la réinjecter après le nettoyage, avant le reload — le monolithe la
  préservait) ;
- au redémarrage, le repli du chantier 4 reconstruit l'inventaire par défaut ;
- vider aussi `shoppingChecked` et `customCartItems` ;
- réécrire le texte de confirmation honnêtement : « Repart de l'inventaire par défaut
  (~270 ingrédients, tout décoché). Votre clé API est conservée. » — et, quand le LOT 007
  sera actif, ce reset se propagera aux autres appareils : le LOT 007 ajoutera cette phrase
  au texte (décision actée en spec 007 §4.9).

### 6. Slider de créativité restauré (réserve d'audit Codex F7)

**Aujourd'hui :** `restoreAIConfig` (`js/app.js:391+`) ne repositionne pas le slider
(`index.html:465-466`). Après rechargement il revient à 50, et la première sauvegarde de
config écrase la vraie valeur — que la synchro diffuserait ensuite partout.

**Attendu (oracle : monolithe l.5033) :** `restoreAIConfig` repositionne le slider depuis
`state.aiConfig.creativity` (valeur + affichage du libellé associé s'il existe).

### 7. Hygiène de `shoppingChecked` (réserve d'audit Codex F7)

**Aujourd'hui :** retirer un article du panier, le supprimer, ou vider le panier laisse son
id dans le Set `shoppingChecked` (`src/actions.js:28-61` n'y touche jamais) → ids orphelins,
que la synchro du LOT 007 diffuserait.

**Attendu (oracle : monolithe l.4724-4751, l.4821-4832, l.6564-6569) :** `toggleCart` (sortie
du panier), `deleteIngredient`, `removeFromCart` et `resetCart` retirent l'id du Set et
persistent. `resetCart` vide aussi `customCartItems` (comportement du monolithe).

## Ce que ce lot NE fait PAS

- Aucune synchro automatique (LOT 007).
- Pas de validation de schéma généralisée (LOT 014) — seuls les comportements ci-dessus.
- Pas de refonte de `setState` ni de l'alias `state` (LOT 014).
- Aucun changement visuel hors textes de confirmation et toasts listés.

## Plan de test

### Tests unitaires (nouveaux : `tests/actions-data.test.js` ou extension des existants)

- [ ] `importStockOnly` : fichier avec 1 id connu + 1 nom similaire + 1 inconnu → statuts mis
      à jour, inconnu ajouté, favoris et `aiConfig` STRICTEMENT identiques avant/après
- [ ] `importStockOnly` ne modifie jamais `aiConfig.apiKey`
- [ ] `exportJSON` : le contenu généré contient `"apiKey":""` et jamais la vraie clé
- [ ] `applyExternalState` : donnée externe SANS clé + clé locale présente → clé locale intacte
- [ ] `applyExternalState` : donnée externe AVEC clé ≠ clé locale → clé locale intacte (F8)
- [ ] `sanitizeGlobalState` : `ingredients: []` → reconstruit ~273 entrées depuis `DEFAULT_DB`
- [ ] `sanitizeGlobalState` : `ingredients` non vide → AUCUNE reconstruction
- [ ] `resetCart` : Set `shoppingChecked` vidé + `customCartItems` vidé
- [ ] `toggleCart` (sortie) et `deleteIngredient` : id retiré du Set

### Vérifications manuelles (Joel, en navigateur — seule preuve valable pour le visuel)

- [ ] Bouton « Importer uniquement le stock » avec un vieux fichier → favoris et clé intacts,
      toast « X mis à jour, Y ajoutés »
- [ ] « Restaurer une sauvegarde » d'un fichier exporté par le monolithe (clé vide) → clé
      locale toujours là
- [ ] « Réinitialisation totale » → inventaire par défaut complet, clé API encore configurée
- [ ] Recharger la page → le slider de créativité affiche la valeur choisie, pas 50

## Critères d'acceptation

- [ ] Les 9 tests unitaires ci-dessus passent ; validation unifiée verte (`.\validate.bat`)
- [ ] `npm run build` OK
- [ ] Preuve écrite AVANT vérification pour chaque casse (règle `CLAUDE.md` §5)
- [ ] Audit Dur rendu (diff final), réserves traitées
- [ ] Cocher C2, C3, C4 + les 2 réserves Codex dans
      `Backlog/BACKLOG - Regressions de la migration.md`

## Traçabilité

- Origine : `Backlog/BACKLOG - Regressions de la migration.md` §1 (C2, C3, C4) — balayage du
  2026-07-29 ; réserves F7 du duel d'audit de la spec 007 v2
- Débloque : LOT 007 (spec v3, §0 ter)
