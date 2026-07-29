# LOT 007 — Synchro bidirectionnelle — SPÉCIFICATION v2

> **Statut :** 🔵 EN COURS — spec v2 après audit, aucune ligne de code écrite
> **Branche :** `feat/lot7-synchro-collaborative`
> **Niveau d'audit : DUR** (`CLAUDE.md` §5) · **Effort estimé :** ~3 h *(v1 : 6 h)*
> **v1 rédigée le 2026-07-28** · **v2 le 2026-07-28 après audit Gemini 3.1 Pro + arbitrage de Joel**

---

## 0. HISTORIQUE DE CETTE SPEC — pourquoi une v2

La **v1** proposait une fusion article par article (« le plus récent gagne » au niveau de
chaque ingrédient). L'audit a démontré qu'elle **rendait la suppression impossible** :

> Joel supprime le beurre. 2 s plus tard la synchro télécharge le cloud, qui contient encore le
> beurre. La fusion voit « présent d'un seul côté → on conserve ». **Le beurre réapparaît
> immédiatement, sur son propre appareil.** Pas une fois : à chaque tentative.

La limite que la v1 faisait accepter à Joel (« un article supprimé peut réapparaître une fois »)
était donc **fausse** : la suppression n'aurait plus fonctionné du tout. Décision rouverte, et
**Joel a tranché : renoncer à la fusion, revenir au plus simple.**

### Ce que cet arbitrage supprime

| Complexité de la v1 | Statut en v2 |
|---|---|
| Moteur de fusion article par article | ❌ supprimé |
| Champ `updatedAt` sur chaque élément + horodatage aux 20 sites de mutation | ❌ supprimé |
| Identifiants déterministes pour les éléments sans `id` | ❌ supprimé |
| Pierres tombales pour les suppressions | ❌ inutile |
| Nouveau module `src/services/sync.js` | ❌ inutile |

**Trois des quatre défauts relevés par l'audit disparaissent avec la conception qui les
portait.** Le quatrième (boucle d'envois) reste et est traité en §4.5.

### Suites données à l'audit — pour mémoire

| ID audit | Verdict | Suite |
|---|---|---|
| **C3** — suppression impossible | ✅ **Fondé, critique** | Conception abandonnée |
| **C4** — boucle d'envois mutuels | ✅ **Fondé** | Traité en §4.5 |
| **C1** — horodatage par instantané non fiable | ⚠️ **Fondé sur le principe, faux sur le motif** | Sans objet en v2. La performance annoncée comme bloquante a été mesurée : **0,46 ms** sur 70 Ko (≈ 2 ms sur mobile, seuil de perception 16 ms). Le vrai argument était la fiabilité, pas le coût. |
| **C2** — collision d'identifiants | ❌ **Non fondé** | Vérifié : les seules collisions de `normalizeString` sont entre deux orthographes du **même** ingrédient (pommes de terre/PDT, Thé/The, Ail/Aïl). Deux ingrédients distincts restent distincts. Sans objet en v2. |

---

## 0 bis. CE LOT RESTAURE UN COMPORTEMENT PERDU — pas une nouveauté

**Vérifié dans `foodapp-v5-Joel.html` (monolithe d'avant la migration).** La synchronisation
automatique **existait et fonctionnait**. Elle a été perdue lors du découpage en modules
(LOT 001/002), sans que personne ne le remarque.

| Ce que faisait le monolithe | Preuve | État actuel |
|---|---|---|
| **Envoi automatique à chaque action** | `saveState(push = true)` → `if (push) pushToFirebase()` (l.4335-4339) | ❌ perdu — `saveState` a été migré dans `src/state.js` sans cet appel |
| **Téléchargement au démarrage** | `await pullFromFirebase()` dans `init()` (l.6755) | ❌ perdu |
| **Verrou anti-boucle** | `saveState(false)` appelé dans `pushToFirebase` et `pullFromFirebase` (l.4419, 4441) | ❌ perdu — c'est exactement le défaut C4 de l'audit |
| **Remise à zéro des champs d'affichage après réception** | `state.search=""; state.filter="all"; state.showInStockOnly=false;` avec le commentaire *« ALWAYS RESET SEARCH/FILTER after Cloud Pull to avoid ghost locks »* (l.4415-4418) | ❌ perdu — c'est le fait **F6** |
| **Clé API préservée sans condition** | `state.aiConfig.apiKey = localKey` — inconditionnel (l.4409-4413) | ❌ dégradé — la version actuelle ne préserve que si le cloud a une clé vide (**F8**) |
| **Voyant d'état branché** | `setSyncStatus('thinking'/'success'/'error')` (l.4400, 4421, 4423) | ❌ perdu — c'est le fait **F7** |
| **Garde sur un cloud vide ou malformé** | `if (data && data.ingredients)` (l.4405) | ❌ perdu |

> **Troisième perte confirmée de la même migration**, après le sélecteur d'articles (LOT 006)
> et les styles du détail de recette (hotfix du 2026-07-28). Le monolithe était **plus correct
> que le code actuel** sur au moins deux points : le verrou anti-boucle et la préservation de
> la clé API.
>
> **Conséquence pour l'implémentation : on porte ces mécanismes, on ne les réinvente pas.**
> Le défaut C4 relevé par l'audit avait déjà sa solution écrite il y a trois mois.

### Deux points où l'on fait mieux que l'original

1. **Temporisation de 2 s.** Le monolithe envoyait à **chaque** action, sans temporisation :
   cocher 30 articles en rayon = 30 envois de ~70 Ko, soit ~2 Mo de données mobiles. La
   temporisation ramène cela à **un seul envoi**.
2. **Délai d'expiration et nouvelle tentative.** Le monolithe n'en avait aucun (§4.7).

### Un point qui est réellement nouveau

**Les cases cochées n'étaient synchronisées ni avant ni maintenant.** Dans le monolithe,
`shoppingChecked` était déjà hors de `state` (l.4262), avec le commentaire explicite
*« IDs of checked cart items (in-trip) »* — c'était un choix délibéré : les coches étaient
propres à une sortie de courses et à un appareil.

**Les inclure (décision de Joel) est donc une vraie nouveauté, pas une restauration.**
À surveiller à l'usage : si deux personnes font leurs courses séparément en même temps, leurs
coches se mélangeront.

---

## 1. FAITS ÉTABLIS

Faits vérifiés en phase découverte, **tous confirmés par l'audit**. Si l'un est faux, la
conception qui en découle l'est aussi.

| ID | Fait | Preuve |
|---|---|---|
| F1 | Le bouton « Cloud Sync » **télécharge seulement** | `index.html:232`, `:260` → `pullFromFirebase()` |
| F2 | `pushToFirebase` **n'est branché sur aucun bouton** | 0 occurrence de `pushTo` dans `index.html` |
| F3 | `syncPush` utilise **`PUT`** : le nœud cloud est remplacé en entier | `src/services/firebase.js:15-21` |
| F4 | `lastSync` est écrit dans une valeur de retour **jetée**, et lu par personne | `firebase.js:27-30` vs `js/app.js:1500` |
| F5 | **`shoppingChecked` n'est pas dans `state`** → jamais envoyé au cloud | `src/state.js:40`, `js/app.js:1500` |
| F6 | `setState` **ne remet pas à zéro** les champs d'affichage, contrairement à `loadState` | `state.js:127-131` vs `state.js:61-65` |
| F7 | Les styles du voyant existent et **ne sont jamais posés** | `css/style.css:662-687` ; `setSyncStatus` n'existe que dans le monolithe abandonné |
| F8 | La clé API locale est **écrasable** si le cloud en contient une non vide | `js/app.js:51-55` |
| F9 | Aucune reprise, aucun délai d'expiration, aucun déclencheur automatique | 0 occurrence de `retry`/`setInterval`/`visibilitychange` |

---

## 2. LE BESOIN ET LES ARBITRAGES DE JOEL

> « Ce que je veux, c'est une vraie synchro bidirectionnelle. »

| Décision | Choix de Joel |
|---|---|
| Règle de conflit | **Le plus récent gagne, sur le document entier** — conscient que les modifications concurrentes de l'autre appareil peuvent être perdues |
| Cases cochées en rayon | **À synchroniser** (elles ne l'étaient pas du tout, F5) |
| Bouton | **Un seul**, qui fait tout |
| Interruptions | **Aucune** — pas de question, pas de fenêtre de conflit |
| Déclenchement | **Automatique** après chaque modification |

---

## 3. LA RÈGLE RETENUE

**Le document entier est remplacé. Le dernier appareil qui écrit gagne.**

1. Toute modification locale déclenche un envoi **temporisé de 2 secondes**.
2. L'envoi remplace le document cloud (`PUT`, comportement actuel conservé).
3. Une récupération applique le document cloud **en entier** à l'état local.
4. Aucune fusion, aucun arbitrage : **la suppression fonctionne parfaitement**, puisque
   l'absence d'un article est une information transmise comme une autre.

### Conséquence assumée, énoncée sans détour

Si l'appareil B modifie quoi que ce soit **avant d'avoir récupéré** un changement fait sur
l'appareil A, l'envoi de B **écrase ce changement**, silencieusement.

**Fenêtre de risque = le temps écoulé depuis la dernière récupération de B.** Elle est réduite
par la récupération automatique (§4.4) mais **n'est jamais nulle**. C'est le prix, accepté par
Joel, d'une suppression qui fonctionne et d'une mécanique simple.

---

## 4. CONCEPTION

### 4.1 Périmètre du document synchronisé

| Clé | Synchronisée ? | Justification |
|---|---|---|
| `ingredients` | ✅ | Cœur du besoin |
| `favorites` | ✅ | |
| `extraIngredients` | ✅ | |
| `customCartItems` | ✅ | Conservée telle quelle — champ fantôme, aucun code ne l'écrit, mais l'exclure serait un changement gratuit |
| `aiConfig` **hors `apiKey`** | ✅ | Réglages IA |
| **`shoppingChecked`** | ✅ **NOUVEAU** | Décision de Joel. Aujourd'hui hors périmètre (F5) |
| `aiConfig.apiKey` | ❌ **jamais envoyée, jamais écrasée** | §4.6 |
| `currentView`, `filter`, `search`, `showInStockOnly`, `showInCartOnly`, `currentSuggestionIdx` | ❌ | F6 — sinon l'écran de Joel changerait tout seul en plein magasin |
| `aiSuggestions` | ❌ | Volatile, sans identifiant, adressé par index (`js/app.js:452`) |
| `lastSync` | ✅ | Horodatage du document, alimente le voyant |

**Changement observable annoncé** : aujourd'hui `syncPush` envoie **tout** `state`. Restreindre
le périmètre est un changement de comportement assumé. Conséquence sur les données déjà dans le
cloud : les clés retirées du document **disparaîtront du cloud au premier envoi** (`PUT`, F3).
Sans effet pratique — `loadState` réinitialise déjà ces champs à chaque démarrage (F6).

#### Intégration de `shoppingChecked`

`shoppingChecked` est un `Set` hors de `state` (F5), persisté dans sa propre clé localStorage.
Il est **sérialisé en tableau d'identifiants** dans le document synchronisé, et reconstruit en
`Set` à la réception. Son stockage local séparé reste inchangé : **aucune modification du
modèle de données**, seulement du périmètre d'envoi.

### 4.2 Ce qui n'est pas touché

- **Aucun champ ajouté à aucun élément.** Pas de `updatedAt`, pas de `deletedAt`.
- **Aucun des 20 sites de mutation n'est modifié.**
- `src/services/firebase.js` : transport inchangé, sauf ajout du délai d'expiration (§4.7).
- Aucun nouveau module. Tout tient dans `js/app.js` et une extension de `firebase.js`.

### 4.3 Séquence d'une synchronisation

```
ENVOI (déclenché par une modification locale, temporisé 2 s)
  1. construire le document à envoyer (périmètre §4.1, clé API retirée)
  2. si identique au dernier document envoyé avec succès → NE RIEN FAIRE   ← anti-boucle
  3. PUT vers Firebase
  4. succès → mémoriser le document envoyé + horodater lastSync + voyant « à jour »
     échec  → voyant « échec », une nouvelle tentative à 10 s, l'état local reste la référence

RÉCUPÉRATION (démarrage, retour sur l'app, toutes les 60 s, clic manuel)
  1. GET depuis Firebase
  2. document nul (base vide) → ne rien appliquer
  3. appliquer le document : périmètre §4.1 uniquement, clé API locale préservée
  4. marquer l'application comme « issue de la synchro »                   ← anti-boucle
  5. reconstruire shoppingChecked, redessiner la vue
```

### 4.4 Déclenchement

| Événement | Action |
|---|---|
| Démarrage | Récupération (le garde-fou d'empreinte du LOT 005 est **conservé** : il protège une modification faite pendant l'attente réseau) |
| Modification locale | Envoi temporisé **2 s** |
| Retour sur l'application (`visibilitychange`) | Récupération |
| Toutes les **60 s**, application visible | Récupération |
| Retour du réseau (`online`) | Récupération puis envoi si nécessaire |
| Clic sur « Cloud Sync » | Récupération **puis** envoi, immédiatement |

**Une seule opération à la fois.** Une demande arrivant pendant une opération en vol est mise
en attente et exécutée après — jamais accumulée.

### 4.5 Anti-boucle — correction du défaut C4 de l'audit

Le défaut : recevoir des données déclenche une sauvegarde, qui déclenche un envoi, qui
déclenche la réception d'en face, indéfiniment.

**Le monolithe avait déjà résolu ce problème** : ses fonctions d'envoi et de réception
appelaient `saveState(false)` — le `false` coupant précisément le réenvoi (§0 bis). Le
mécanisme existe encore aujourd'hui sous une autre forme : `saveState(updateUI)` dans
`src/state.js`. **On restaure le principe, on ne l'invente pas.**

**Deux verrous indépendants**, l'un suffirait, les deux se couvrent mutuellement :

1. **Drapeau d'origine.** Une application de données issue de la synchro est marquée comme
   telle et **ne planifie aucun envoi**.
2. **Comparaison de contenu.** Un envoi dont le document est identique au dernier envoi réussi
   est **abandonné avant la requête réseau**. Même si le drapeau était oublié un jour, la
   boucle ne pourrait pas s'établir.

### 4.6 Invariants de sécurité — non négociables

1. **La clé API n'est jamais envoyée au cloud.** Déjà en place (`firebase.js:12`), couvert par
   `tests/firebase.test.js`.
2. **La clé API locale n'est jamais écrasée par le cloud**, y compris si le cloud en contient
   une non vide. **Corrige le trou F8** : la clé locale est réinjectée **sans condition** sur
   le contenu du cloud.
3. **Une récupération n'applique que les clés du périmètre §4.1.** Une clé inconnue présente
   dans le cloud est ignorée, jamais appliquée aveuglément.

### 4.7 Robustesse réseau

- **Délai d'expiration de 15 s** sur `syncPull` et `syncPush` (`AbortController`) — aujourd'hui
  une requête pendante bloque indéfiniment (F9).
- **Une seule nouvelle tentative** après 10 s en cas d'échec, puis arrêt. Pas de reprise
  exponentielle : disproportionné ici.
- Un envoi échoué **ne perd rien** : l'état local reste la référence.

### 4.8 Voyant d'état

Réutilise **les classes CSS déjà présentes et inutilisées** (F7) — même schéma qu'au LOT 006 :
on restaure ce que la migration a perdu, on n'invente pas.

| État | Classe existante | Libellé |
|---|---|---|
| Inactif | — | `Cloud Sync` |
| En cours | `.thinking` (rotation) | `Synchro…` |
| Réussi | `.success` (2 s puis retour) | `À jour ✓` |
| Échec | `.error` (secousse) | `Échec — réessayer` |
| Hors ligne | `.error` | `Hors ligne` |

Les deux voyants (`#sync-indicator-desktop`, `#sync-indicator-mobile`) sont mis à jour ensemble.
**Aucun toast pour une synchro automatique réussie** — ce serait du bruit toutes les minutes.
Le toast est conservé pour le **clic manuel** et pour **tous les échecs**.

---

## 5. MIGRATION

**Aucune migration de données.** Aucun champ n'est ajouté aux éléments existants. Le premier
envoi réécrit simplement le document cloud selon le périmètre §4.1.

**Bénéfice collatéral** : ce premier envoi nettoie la base cloud des modèles IA périmés
(`gemini-2.0-flash`, `gemini-2.5-flash`) constatés le 2026-07-28.

---

## 6. PLAN DE TEST

### 6.1 Tests unitaires (`tests/firebase.test.js` étendu + `tests/sync-scope.test.js`)

- [ ] Le document envoyé **ne contient jamais** la clé API *(existant, à conserver)*
- [ ] Le document envoyé **ne contient pas** `currentView`, `filter`, `search`,
      `showInStockOnly`, `showInCartOnly`, `currentSuggestionIdx`, `aiSuggestions`
- [ ] Le document envoyé **contient** `shoppingChecked` sous forme de tableau d'identifiants
- [ ] Un document reçu contenant une clé API non vide **ne remplace pas** la clé locale (F8)
- [ ] Un document reçu **ne modifie pas** la vue ni les filtres locaux (F6)
- [ ] `shoppingChecked` est reconstruit en `Set` à la réception
- [ ] Base vide (`null`) → aucune application, aucune erreur *(cas non couvert aujourd'hui)*
- [ ] Rejet réseau de `fetch` → erreur remontée, aucune exception non gérée
- [ ] Expiration du délai → traité comme un échec, aucune perte locale
- [ ] **Anti-boucle** : un document identique au dernier envoyé n'est pas renvoyé
- [ ] **Anti-boucle** : une application issue de la synchro ne planifie pas d'envoi

### 6.2 Tests manuels à deux appareils (validation par Joel)

- [ ] Ajout sur A → apparaît sur B dans la minute
- [ ] **Suppression sur A → l'article ne revient JAMAIS** (le défaut qui a fait tomber la v1)
- [ ] Case cochée sur A → visible sur B
- [ ] 15 cases cochées d'affilée → **un seul** envoi (onglet réseau)
- [ ] Mode avion pendant un envoi → voyant en échec, **aucune perte**, renvoi au retour
- [ ] La vue et le filtre de Joel **ne changent jamais tout seuls** (F6)
- [ ] Deux appareils ouverts et inactifs → **aucun trafic** au-delà des récupérations de 60 s
      (vérifie l'anti-boucle §4.5)

---

## 7. LIMITES ASSUMÉES

1. **Modifications concurrentes perdues.** Voir §3 — c'est la conséquence directe et acceptée
   de l'arbitrage de Joel. Si cela devient gênant à l'usage, la fusion article par article
   redevient possible dans un lot ultérieur, avec ses pierres tombales.
2. **Horloges désynchronisées** : `lastSync` sert d'affichage, pas d'arbitrage — sans impact ici.
3. **Pas de mode hors ligne durable** : les modifications restent locales et repartent au retour
   du réseau, mais aucune file d'attente persistante n'est mise en place.

---

## 8. HORS PÉRIMÈTRE

- Authentification Firebase (risque accepté, `.claude/audit_memory.md`)
- Validation de schéma des données cloud (→ `Backlog/BACKLOG - Validation des donnees externes.md`)
- Alias `state` fragile (→ `Backlog/BACKLOG - Alias state fragile.md`)
- Panneau « Informations Système » mort (`updateSystemInfo` cible `#system-storage`, inexistant)

---

## 9. CRITÈRES D'ACCEPTATION

- [ ] Tous les tests du §6.1 passent
- [ ] Validation unifiée verte (`.\validate.bat`) et `npm run build` OK
- [ ] `PROJECT_MAP.md` à jour si un fichier est ajouté
- [ ] Tests manuels du §6.2 validés **par Joel, à deux appareils, en conditions réelles**
- [ ] Audit Dur rendu, réserves traitées
- [ ] Aucun changement de comportement observable **non listé** dans cette spec

---

## 10. PLAN DE REPLI

Livré sur `feat/lot7-synchro-collaborative`, non fusionné tant que Joel n'a pas validé. En cas
de problème après publication, `git revert` du commit de fusion restaure le comportement
précédent.

**Compatibilité ascendante** : le document cloud reste un objet `state` de même forme, en
version restreinte. Un client de l'ancienne version le relit sans erreur — il retrouvera
simplement ses champs d'affichage réinitialisés, ce que `loadState` fait déjà à chaque
démarrage (F6). **Aucune destruction mutuelle possible entre les deux versions.**

---

## 11. TRAÇABILITÉ

- Finding d'origine : `ULTRA_AUDIT_REPORT.md` A11
- Audit de la v1 : Gemini 3.1 Pro, 2026-07-28 — verdict NO-GO, 2 défauts sur 4 retenus
- Dépend de : `applyCloudState` (LOT 006), `debounce` (LOT 005)
