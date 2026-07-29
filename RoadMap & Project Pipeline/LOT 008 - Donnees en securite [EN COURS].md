# LOT 008 — Données en sécurité — SPÉCIFICATION

> **Statut :** 🟡 EN COURS — ouvert le 2026-07-29 sur `feat/lot8-donnees-en-securite`
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
- passe par `setState` (qui assainit déjà via `sanitizeGlobalState`).

**Propriétaire et architecture (correction d'audit de campagne, Codex — indispensable pour
un exécutant sans contexte)** :
- `applyExternalState(data)` vit dans **`src/state.js`**, à côté de `setState` dont elle est
  la porte d'entrée sécurisée. Raison : ses trois appelants sont `js/app.js` (synchro du
  démarrage), `js/app.js` (bouton Cloud Sync) et `src/actions.js` (restauration de fichier) ;
  or `app.js` importe déjà `actions.js` — héberger la fonction dans `app.js` forcerait
  `actions.js` à l'importer en retour (**cycle interdit**). `state.js` est importable par
  les trois sans cycle.
- Les appelants d'`app.js` continuent de rafraîchir l'alias (`state = moduleState`) après
  l'appel, comme aujourd'hui (piège connu → LOT 014).
- L'actuelle `applyCloudState` (`js/app.js:47-59`) est SUPPRIMÉE au profit de cette version
  (3 recherches convergentes sur son nom avant suppression, `CLAUDE.md` §5).

### 4. Inventaire par défaut reconstruit (casse C4a)

**Aujourd'hui :** premier lancement ou données effacées → app VIDE. `state.ingredients = []`
(`src/state.js:19`), aucun repli dans `sanitizeGlobalState` (`src/state.js:88-115`).

**Attendu (oracle : monolithe l.4309-4312 + `buildIngredients` l.4332) :** dans
`sanitizeGlobalState`, si `ingredients` est vide ou absent → reconstruire l'inventaire depuis
`DEFAULT_DB` (`src/data.js:42`) : `{ id, name, emoji, category, inStock:false, inCart:false,
pinned:false, frozen:false, shoppingSource:null }` par entrée. Reproduire le mapping exact du
monolithe (lire `buildIngredients` avant d'écrire).

**⚠️→✅ Constat fait puis RÉSOLU pendant l'implémentation (2026-07-29) :** `DEFAULT_DB` ne
contenait QUE 66 entrées, pas ~273. Le fichier `foodapp-data.js` chargé par le monolithe
(l.4225, `<script src="foodapp-data.js">`) — la vraie source des ~273 ingrédients — **n'a
jamais existé dans ce dépôt** (recherché sur tout l'historique git, aucune trace) : ce n'était
pas une régression de la migration, la donnée manquait déjà avant la modularisation.
**Résolu par Joel** : export réel de son inventaire du 2026-07-29 (« saumon fumé » en stock
= sa dernière modification, vérifié) fourni comme base de travail. `DEFAULT_DB` reconstruit
à partir de ces **297 ingrédients** (3 mois d'usage réel, statuts personnels retirés — seuls
`id/name/emoji/category/frozen` conservés, le catalogue n'a pas de notion de stock), groupés
par les 17 catégories canoniques. Aucun nombre n'est codé en dur nulle part (code, tests,
messages utilisateur) : tout dérive de `DEFAULT_DB.length`.

**Piège :** ce repli ne doit PAS se déclencher sur un état où `ingredients` existe mais est
volontairement réduit. Le déclencheur est « tableau vide ou absent », rien d'autre.

**Effet assumé (hérité de l'oracle, relevé par l'audit Codex)** : supprimer le DERNIER
ingrédient de l'inventaire déclenche cette reconstruction — l'inventaire « repart » aux
valeurs par défaut (66 aujourd'hui). C'était le comportement du monolithe (l.4310-4312). Il
neutralise au passage le scénario « inventaire légitimement vidé par suppressions » face au
garde-fou d'envoi du LOT 007 §4.9 (un inventaire vide ne peut pas persister). À constater en
test manuel, pas à « corriger ».

### 5. Réinitialisation sûre (casse C4b)

**Aujourd'hui :** `resetAllData` (`src/actions.js:64-69`) = `localStorage.clear()` + reload →
app vide ET clé API perdue.

**Attendu (précisé après l'audit de campagne Codex — le reset naïf était immédiatement
ANNULÉ : après le rechargement, le pull cloud du démarrage réappliquait l'ancien inventaire,
`js/app.js:112`)** :
1. préserver la clé API (la réinjecter après le nettoyage — le monolithe la préservait) ;
2. reconstruire l'inventaire par défaut IMMÉDIATEMENT (mécanisme du chantier 4) et le
   **persister en localStorage** — ne pas compter sur le rechargement ;
3. vider `shoppingChecked` et `customCartItems` ;
4. **pousser AUSSITÔT ce nouvel état vers le cloud** (`syncPush` existe déjà,
   `src/services/firebase.js`) : c'est ce qui empêche le pull du prochain démarrage de
   ressusciter l'ancien inventaire. Si l'envoi échoue (hors ligne…) : toast explicite
   « Réinitialisation locale seulement — l'ancien contenu du cloud peut revenir à la
   prochaine synchronisation » ;
5. texte de confirmation honnête : « Repart de l'inventaire par défaut (~270 ingrédients,
   tout décoché), ici ET dans le cloud. Votre clé API est conservée. » ;
6. recharger la page en dernier.

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

- [x] `importStockOnly` : fichier avec 1 id connu + 1 nom similaire + 1 inconnu → statuts mis
      à jour, inconnu ajouté, favoris et `aiConfig` STRICTEMENT identiques avant/après
- [x] `importStockOnly` ne modifie jamais `aiConfig.apiKey`
- [x] `exportJSON` : le contenu généré contient `"apiKey":""` et jamais la vraie clé
- [x] `applyExternalState` : donnée externe SANS clé + clé locale présente → clé locale intacte
- [x] `applyExternalState` : donnée externe AVEC clé ≠ clé locale → clé locale intacte (F8)
- [x] `sanitizeGlobalState` : `ingredients: []` → reconstruit l'inventaire depuis `DEFAULT_DB`
      (297 entrées — catalogue reconstruit le 2026-07-29, voir constat §4 ci-dessus)
- [x] `sanitizeGlobalState` : `ingredients` non vide → AUCUNE reconstruction
- [x] `resetCart` : Set `shoppingChecked` vidé + `customCartItems` vidé
- [x] `toggleCart` (sortie) et `deleteIngredient` : id retiré du Set
- [x] *(hors liste d'origine, ajoutés)* `resetAllData` pousse au cloud AVANT le rechargement
      (preuve d'ordre) ; `resetAllData` conserve la clé API ; annulation de la confirmation
      → aucune action

### Vérifications manuelles (Joel, en navigateur — seule preuve valable pour le visuel)

- [ ] Bouton « Importer uniquement le stock » avec un vieux fichier → favoris et clé intacts,
      toast « X mis à jour, Y ajoutés »
- [ ] « Restaurer une sauvegarde » d'un fichier exporté par le monolithe (clé vide) → clé
      locale toujours là
- [ ] « Réinitialisation totale » → inventaire par défaut complet, clé API encore configurée
- [ ] **Réinitialisation avec un cloud NON vide** (le test qui a fait tomber la première
      version de cette fiche, audit Codex) : reset → rechargement de la page → l'inventaire
      par défaut est TOUJOURS là, car le cloud contient désormais les défauts, pas l'ancien
      inventaire
- [ ] Recharger la page → le slider de créativité affiche la valeur choisie, pas 50

## Critères d'acceptation

- [x] Les 9 tests unitaires ci-dessus passent ; validation unifiée verte (`.\validate.bat`)
      — 46/46 tests JS + 13/13 verrous pytest, `.\validate.bat` = SUCCESS (2026-07-29)
- [x] `npm run build` OK (512 ms, aucune erreur)
- [x] Preuve écrite AVANT vérification pour chaque casse (règle `CLAUDE.md` §5) — chaque
      chantier ci-dessus documente l'attendu avant le code ; testé après coup, résultat conforme
- [ ] Audit Dur rendu (diff final), réserves traitées — **EN ATTENTE**, prochaine étape
- [ ] Vérifications manuelles en navigateur (Joel) — voir liste ci-dessus, non encore faites
- [ ] Cocher C2, C3, C4 + les 2 réserves Codex dans
      `Backlog/BACKLOG - Regressions de la migration.md`

## Traçabilité

- Origine : `Backlog/BACKLOG - Regressions de la migration.md` §1 (C2, C3, C4) — balayage du
  2026-07-29 ; réserves F7 du duel d'audit de la spec 007 v2
- Débloque : LOT 007 (spec v3, §0 ter)
