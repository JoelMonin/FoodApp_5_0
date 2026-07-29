# LOT 007 — Synchro collaborative — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — spec à auditer, aucune ligne de code écrite
> **Branche :** `feat/lot7-synchro-collaborative`
> **Niveau d'audit : DUR** (`CLAUDE.md` §5) · **Effort estimé :** ~6 h
> **Rédigée le :** 2026-07-28, après phase découverte exhaustive
> **Version de la spec :** 1.0

---

## 0. POURQUOI CE LOT EST CLASSÉ SENSIBLE

C'est **le seul endroit de l'application où un défaut ne produit pas un affichage bizarre mais
la perte définitive de données réelles**. Il touche deux zones classées sensibles dans
`DOCTRINE_PRODUIT.md` §3 : le moteur d'état (`src/state.js`) et le service Firebase.

Conséquences de gouvernance : spec écrite et auditée **avant** la première ligne de code,
tests unitaires dédiés à la logique de fusion, audit Dur sur le diff final.

---

## 1. FAITS ÉTABLIS (vérifiés, à contester si faux)

Cette section est la base factuelle de toute la spec. **Un auditeur doit d'abord vérifier
ces faits** : si l'un est faux, la conception qui en découle l'est aussi.

### 1.1 Il n'existe aucune synchronisation bidirectionnelle aujourd'hui

| Fait | Preuve |
|---|---|
| Le bouton « Cloud Sync » **télécharge seulement** | `index.html:232` et `:260` → `onclick="pullFromFirebase()"` |
| `pushToFirebase` **n'est branché sur aucun bouton** | 0 occurrence de `pushTo` dans `index.html` |
| L'envoi n'est donc atteignable que par la console | `js/app.js:1498-1506` |
| Dernière écriture réelle constatée dans la base | `lastSync: 2026-07-28T15:33:42.234Z` (lecture directe de la base) |

### 1.2 Il n'existe aucun horodatage exploitable

| Fait | Preuve |
|---|---|
| **Aucun champ de date sur aucun élément** d'aucune collection | Recherche `updatedAt\|createdAt\|lastModified` : 0 hit hors génération d'`id` |
| `lastSync` est **écrit dans une valeur de retour jetée** | `src/services/firebase.js:27-30` ; l'appelant `js/app.js:1500` fait `await syncPush(state);` sans affectation |
| `lastSync` **n'est lu par personne** | `#info-last-sync` (`index.html:625`) n'est référencé par aucun code |

**Conséquence majeure : la règle « le plus récent gagne » est aujourd'hui INAPPLICABLE.**
Il n'existe aucune donnée permettant de savoir qui a modifié quoi en dernier.

### 1.3 L'envoi écrase l'intégralité du document cloud

`syncPush` utilise **`PUT`** sur `/users/FoodApp_V5_Joel.json` (`src/services/firebase.js:15-21`).
En REST Firebase, `PUT` **remplace le nœud entier** : toute clé absente du corps est supprimée
côté cloud. `PATCH` n'est utilisé nulle part.

### 1.4 Les identifiants ne sont pas fiables pour une fusion

| Problème | Preuve | Impact sur la fusion |
|---|---|---|
| `generateId` est **non déterministe** (horloge + aléa) | `src/utils/helpers.js:34-36` | Deux appareils créant « lait » produisent **deux ingrédients distincts** → doublon garanti |
| Des ingrédients **sans `id`** peuvent exister | `sanitizeGlobalState` n'en attribue jamais (`src/state.js:99-108`) ; cas testé `tests/state.test.js:50` | Infusionnables par clé |
| `aiSuggestions` **n'a aucun identifiant** et est adressé **par index** | `js/app.js:452` | Une fusion réordonnant le tableau ferait pointer les cartes sur les mauvaises recettes |

### 1.5 La moitié du scénario de Joel est hors périmètre

**`shoppingChecked` n'appartient pas à `state`** (`src/state.js:40`, `export let shoppingChecked = new Set()`).
Il est persisté dans une **clé localStorage séparée** (`pantry_v5_checked`) et **`syncPush(state)`
ne le reçoit donc jamais** (`js/app.js:1500`).

> **Les cases cochées en rayon sont purement locales à l'appareil.**
> Le scénario central — « elle ajoute pendant qu'il coche en rayon » — a sa moitié « cocher »
> entièrement hors du périmètre de synchro actuel. → **Décision requise, §6 D1.**

### 1.6 Un téléchargement écrase l'état d'affichage

`loadState` remet à zéro `search`, `filter`, `showInStockOnly`, `showInCartOnly`
(`src/state.js:61-65`). **`setState` ne le fait pas** (`src/state.js:127-131`) — or c'est la voie
empruntée par `applyCloudState`. Aujourd'hui un « Cloud Sync » peut donc **changer la vue
courante, le filtre et la recherche** depuis les valeurs de l'autre appareil.

**Avec une synchro automatique, ce défaut deviendrait permanent et très visible** : l'écran de
Joel changerait tout seul pendant qu'il fait ses courses.

### 1.7 Aucun filet réseau, aucun signal visuel

| Fait | Preuve |
|---|---|
| Pas de reprise, pas de file d'attente, pas de délai d'expiration | 0 occurrence de `retry\|backoff\|AbortController` |
| Aucun déclencheur automatique | 0 `setInterval`/`visibilitychange`/`online` dans le code actif |
| **Les styles du voyant existent déjà et ne sont jamais posés** | `.sync-indicator.thinking/.success/.error` — `css/style.css:662-687` |
| La fonction qui les posait n'existe que dans le monolithe abandonné | `setSyncStatus` — `foodapp-v5-Joel.html:4348-4368`, 0 hit dans `js/` et `src/` |

> **Même schéma qu'au LOT 006** : l'habillage visuel dort dans la feuille de style, la
> fonctionnalité a été perdue lors de la migration du LOT 003. **On restaure, on n'invente pas.**

### 1.8 La clé API peut être écrasée par le cloud

La garde de `applyCloudState` (`js/app.js:51-55`) ne se déclenche **que si le cloud a une clé
vide ou absente**. Si le document cloud contient une clé **non vide** — écriture manuelle,
client plus ancien, ou tout client n'ayant pas blanchi la clé — `setState(cloudData)` remplace
la clé locale par celle du cloud.

---

## 2. LE BESOIN

> « Si je rajoute un ingrédient et que je synchronise, en fait ça télécharge l'inventaire
> depuis le cloud plutôt que de faire une vraie synchro bidirectionnelle. »
> — Joel, 2026-07-28

### Usage réel (7 questions posées à Joel)

| Question | Réponse |
|---|---|
| Appareils | **PC + téléphone** |
| Deux appareils en même temps ? | **Oui, et j'agis sur les deux** |
| Quelqu'un d'autre modifie les mêmes données ? | **Oui, sa compagne / la famille** |
| Réseau au magasin | Correct |
| Fréquence des suppressions | **Quasi jamais** |
| Scénario type | **Elle ajoute des articles pendant qu'il coche en rayon** |
| Arbitrage souhaité | **Le plus récent gagne, sans me déranger** |

### La contradiction révélée par ces réponses

Joel demande « le plus récent gagne » **et** une collaboration à deux. Appliquée au document
**entier**, cette règle détruit systématiquement la collaboration :

> Sa compagne ajoute « lait » à 17h02. Joel coche des tomates à 17h03. Le téléphone de Joel
> envoie **tout son inventaire**, qui ne connaît pas le lait (`PUT`, §1.3). **Le lait disparaît.**

Ce n'est pas un cas rare : c'est le scénario nominal. **« Le plus récent gagne » appliqué au
document entier est incompatible avec l'usage réel.**

---

## 3. LA RÈGLE RETENUE

**« Le plus récent gagne » — appliqué article par article, jamais au document entier.**

1. À chaque synchro : **télécharger, fusionner, renvoyer** (lecture-modification-écriture).
2. Fusion **par identifiant**, collection par collection.
3. Élément présent d'un seul côté → **conservé**.
4. Élément présent des deux côtés → **la version au `updatedAt` le plus récent gagne**.
5. Envoi **automatique 2 secondes** après la dernière action (réutilise le `debounce` du LOT 005).
6. Téléchargement automatique au retour sur l'application et toutes les 60 secondes.
7. **Voyant d'état visible**, jamais de question ni de fenêtre d'interruption.

### Alternatives écartées, et pourquoi

| Alternative | Raison du rejet |
|---|---|
| Document entier, le plus récent gagne | Détruit la collaboration (§2) — c'est le scénario nominal de Joel |
| Demander à l'utilisateur en cas de conflit | Joel a explicitement demandé « sans me déranger » |
| Fusion avec propagation des suppressions (pierres tombales) | Double la complexité pour un événement que Joel qualifie de « quasi jamais » (§5.8) |
| Écriture par élément (`PATCH` par ingrédient) | ~300 requêtes ; le modèle de données est un tableau, mal adapté aux clés Firebase |

---

## 4. CONCEPTION

### 4.1 Nouveau module `src/services/sync.js`

**La logique de fusion doit être pure et testable isolément.** `firebase.js` reste un simple
transport (il ne connaît que HTTP), `sync.js` porte les règles.

```
src/services/firebase.js   → transport seul (inchangé, sauf §4.7)
src/services/sync.js       → NOUVEAU : fusion pure + orchestration
```

`PROJECT_MAP.md` doit être mis à jour dans le même commit (verrou
`tests/test_project_map_freshness.py`).

### 4.2 Modèle de données — champ `updatedAt`

Chaque élément des collections synchronisées porte un champ `updatedAt` (chaîne ISO 8601).

**Où l'apposer.** Il n'existe **aucun point de passage unique de mutation** (§1.4, B3 de la
découverte) : 20 sites mutent les objets directement. Deux options :

- **Option retenue — horodatage au point de sauvegarde.** `saveState()` est le goulot commun
  (30 appelants). Avant sérialisation, on compare l'état à un instantané précédent et on
  horodate **les éléments réellement modifiés**. Aucun des 20 sites de mutation n'est touché :
  impossible d'en oublier un.
- Option écartée — instrumenter les 20 sites : fastidieux, et **toute mutation future non
  instrumentée casserait silencieusement la synchro**.

> **Point à challenger par l'auditeur** : le coût d'une comparaison d'instantané à chaque
> `saveState()` sur ~300 ingrédients, sachant que `switchView` déclenche un `saveState` à
> chaque changement d'onglet (`js/app.js:170`).

### 4.3 Identifiants — traitement des trois défauts du §1.4

**a) Éléments sans `id`** (données anciennes). `sanitizeGlobalState` leur attribue un
identifiant **déterministe dérivé du nom normalisé** :

```
id = 'ing_legacy_' + hash(normalizeString(name))
```

Déterministe = **les deux appareils calculent le même identifiant** pour le même ingrédient,
donc la fusion les reconnaît au lieu de les dupliquer. Un identifiant aléatoire produirait un
doublon systématique.

**b) Ajouts indépendants du même ingrédient** (elle ajoute « lait » sur son téléphone, lui sur
son PC) : deux `id` différents → **deux entrées après fusion**. → **Décision requise, §6 D2.**

**c) `aiSuggestions`** : sans identifiant, adressé par index, volatile. → **exclu de la
synchro** (§4.4).

### 4.4 Périmètre de synchronisation — table de vérité

| Clé | Traitement | Justification |
|---|---|---|
| `ingredients` | **Fusion par `id`** | Cœur du besoin |
| `favorites` | **Fusion par `id`** | Identifiants stables (`fav_…`) |
| `extraIngredients` | **Fusion par `id`** | Identifiants stables (`extra_…`) |
| `aiConfig` (hors `apiKey`) | Remplacement au plus récent | Réglages, pas de la donnée |
| `aiConfig.apiKey` | **Jamais envoyé, jamais écrasé** | §4.6 |
| `shoppingChecked` | **À décider** | §6 D1 — hors de `state` aujourd'hui |
| `customCartItems` | **À décider** | §6 D3 — champ fantôme, aucun code ne l'écrit |
| `currentView`, `filter`, `search`, `showInStockOnly`, `showInCartOnly`, `currentSuggestionIdx` | **Jamais synchronisés — ni envoyés, ni appliqués** | §1.6 : sinon l'écran de Joel change tout seul |
| `aiSuggestions` | **Jamais synchronisé** | Sans identifiant, adressé par index (§1.4) |
| `lastSync` | Métadonnée, écrite à chaque envoi réussi | Alimente le voyant |

> **Changement de comportement notable** : aujourd'hui `syncPush` envoie **tout** `state`
> (§1.6). Restreindre le périmètre est donc un changement observable, **assumé et annoncé**.

### 4.5 Algorithme de fusion

```
fusionnerCollection(locale, distante) :
    parId = Map()
    pour chaque élément de distante :  parId[élément.id] = élément
    pour chaque élément de locale :
        existant = parId[élément.id]
        si absent            → parId[élément.id] = élément
        sinon                → parId[élément.id] = plusRécent(élément, existant)
    retourner valeurs(parId)

plusRécent(a, b) :
    ta = a.updatedAt ou null ; tb = b.updatedAt ou null
    si ta et tb   → retourner (ta >= tb) ? a : b
    si ta seul    → retourner a          # horodaté = postérieur à la migration
    si tb seul    → retourner b
    sinon         → retourner a          # aucun horodaté : le local gagne (arbitraire, documenté)
```

**Cas limites à couvrir par les tests (§7) :**

| Cas | Comportement attendu |
|---|---|
| Cloud vide (`null`) | Aucune fusion, envoi de l'état local |
| Collection absente côté cloud | Le local est conservé intégralement |
| Firebase rend un objet au lieu d'un tableau | Reconverti (`Object.values`, déjà fait `src/state.js:91-95`) |
| Élément sans `id` des deux côtés | Identifiant déterministe attribué avant fusion (§4.3a) |
| `updatedAt` absent des deux côtés (données existantes) | Le local gagne, sans perte |
| `updatedAt` identique | Le local gagne (déterministe, jamais aléatoire) |
| Horloges désynchronisées entre appareils | **Limite assumée** (§8) |

### 4.6 Invariants de sécurité — non négociables

1. **La clé API n'est jamais envoyée au cloud.** Déjà en place (`src/services/firebase.js:12`),
   couvert par `tests/firebase.test.js:11-40`.
2. **La clé API locale n'est jamais écrasée par le cloud** — y compris si le cloud contient une
   clé non vide. **Corrige le trou du §1.8** : la clé locale est réinjectée systématiquement,
   sans condition sur le contenu du cloud.
3. **Aucune donnée locale n'est supprimée par une fusion.** Une fusion ne peut qu'ajouter ou
   remplacer par plus récent.

### 4.7 Déclenchement

| Événement | Action |
|---|---|
| Démarrage | Téléchargement + fusion (le garde-fou d'empreinte du LOT 005 devient inutile et sera retiré : la fusion protège mieux) |
| Modification locale | Envoi **temporisé de 2 s** (télécharger → fusionner → renvoyer) |
| Retour sur l'application (`visibilitychange`) | Téléchargement + fusion |
| Toutes les 60 s, application visible | Téléchargement + fusion |
| Clic sur « Cloud Sync » | Synchro complète immédiate |
| Perte/retour réseau (`online`/`offline`) | Voyant mis à jour ; renvoi au retour |

**Anti-tempête** : une seule synchro à la fois ; si une synchro est demandée pendant qu'une
autre est en vol, elle est mise en attente et exécutée après (pas d'accumulation).

### 4.8 Interface — voyant d'état

Réutilise **les classes CSS déjà présentes et inutilisées** (§1.7) :
`.sync-indicator.thinking` (rotation), `.success` (vert), `.error` (rouge + secousse).

| État | Classe | Libellé |
|---|---|---|
| Inactif | — | `Cloud Sync` |
| En cours | `.thinking` | `Synchro…` |
| Réussi | `.success` (2 s puis retour) | `À jour ✓` |
| Échec | `.error` | `Échec — réessayer` |
| Hors ligne | `.error` | `Hors ligne` |

Les deux voyants (`#sync-indicator-desktop`, `#sync-indicator-mobile`) sont mis à jour ensemble.
**Aucun toast pour une synchro automatique réussie** (ce serait du bruit toutes les minutes) ;
le toast est conservé pour les actions manuelles et **tous les échecs**.

### 4.9 Échecs réseau

- Un envoi échoué **ne perd rien** : l'état local reste la référence, le voyant passe en échec.
- **Une seule nouvelle tentative** après 10 s, puis on s'arrête et on attend une action ou le
  cycle de 60 s. Pas de reprise exponentielle : disproportionné ici.
- `syncPull`/`syncPush` reçoivent un **délai d'expiration de 15 s** (`AbortController`) —
  aujourd'hui une requête pendante bloque indéfiniment (§1.7).

---

## 5. MIGRATION DES DONNÉES EXISTANTES

Le premier chargement après livraison rencontre des données **sans `updatedAt`** et
potentiellement **sans `id`** (§1.4), côté local **et** côté cloud (297 ingrédients, 7 favoris
constatés le 2026-07-28).

1. `sanitizeGlobalState` attribue les identifiants manquants de façon déterministe (§4.3a).
2. Les éléments sans `updatedAt` sont **laissés tels quels** (pas d'horodatage rétroactif, qui
   serait un mensonge). La règle de fusion les traite (§4.5).
3. Le premier envoi réussi écrit l'état fusionné et **nettoie au passage la base cloud** des
   modèles IA périmés (`gemini-2.0-flash`, `gemini-2.5-flash`) constatés le 2026-07-28.

**Aucune migration destructive. Aucune réécriture en masse des horodatages.**

---

## 6. DÉCISIONS REQUISES DE JOEL

Ces trois points ne peuvent pas être tranchés techniquement — ils relèvent du produit.

### D1 — Les cases cochées doivent-elles être synchronisées ? *(le plus important)*

Aujourd'hui, non (§1.5). Le scénario que Joel décrit — elle ajoute pendant qu'il coche en
rayon — n'est donc qu'à moitié couvert : il verra ses ajouts, elle ne verra pas ses coches.

- **Option A** — Les inclure dans la synchro. Elle voit en direct ce qui est déjà acheté.
  Coût : sortir `shoppingChecked` de son coin et l'intégrer au modèle synchronisé (~1 h).
- **Option B** — Les laisser locales. Chaque appareil a ses propres coches.

### D2 — Que faire quand le même ingrédient est ajouté des deux côtés ?

Elle ajoute « lait » sur son téléphone, Joel ajoute « lait » sur son PC. Identifiants
différents (§1.4) → deux entrées après fusion.

- **Option A** — Les laisser toutes les deux (Joel supprime le doublon). Simple, prévisible.
- **Option B** — Les fusionner si les noms se ressemblent, via `areSimilar`
  (`src/utils/helpers.js:59`), déjà utilisé pour la détection de doublons à l'ajout.
  **Risque** : `areSimilar` accepte l'inclusion, donc « riz » et « chorizo » se ressemblent —
  une fusion automatique pourrait **supprimer le mauvais ingrédient**.

> **Recommandation : Option A.** L'option B viole l'invariant §4.6.3 (une fusion ne supprime
> jamais rien) sur la foi d'une comparaison approximative.

### D3 — Que faire de `customCartItems` ?

Champ présent dans `state`, envoyé au cloud, **jamais écrit par aucun code actif** — vestige du
monolithe. Le retirer, ou le conserver au cas où ?

---

## 7. PLAN DE TEST

### 7.1 Tests unitaires — logique de fusion (nouveau `tests/sync.test.js`)

La fusion étant pure, elle se teste sans réseau ni DOM :

- [ ] Élément présent seulement en local → conservé
- [ ] Élément présent seulement dans le cloud → ajouté
- [ ] Même `id`, `updatedAt` local plus récent → version locale
- [ ] Même `id`, `updatedAt` cloud plus récent → version cloud
- [ ] Même `id`, `updatedAt` identique → version locale (déterminisme)
- [ ] Aucun `updatedAt` des deux côtés → version locale, aucune perte
- [ ] Un seul côté horodaté → le côté horodaté gagne
- [ ] Cloud `null` → état local retourné intact
- [ ] Collection cloud sous forme d'objet Firebase → reconvertie sans perte
- [ ] Éléments sans `id` → identifiants déterministes, **aucun doublon entre deux appareils**
- [ ] **Scénario de Joel** : local = tomates cochées, cloud = lait ajouté → **les deux présents**
- [ ] Les champs d'affichage ne franchissent jamais la fusion
- [ ] La clé API locale survit à un cloud porteur d'une clé non vide (§1.8)

### 7.2 Tests d'intégration (`tests/firebase.test.js` étendu)

- [ ] Le corps envoyé **ne contient jamais** la clé API (déjà couvert, à conserver)
- [ ] Le corps envoyé **ne contient pas** les champs d'affichage
- [ ] Base vide (`null`) → pas d'erreur (**cas non couvert aujourd'hui**)
- [ ] Rejet réseau de `fetch` → erreur remontée, pas d'exception non gérée
- [ ] Expiration du délai → traité comme un échec, aucune perte locale

### 7.3 Tests manuels à deux appareils (validation par Joel)

- [ ] Ajout sur A → apparaît sur B dans la minute
- [ ] Ajouts simultanés sur A et B → **les deux** conservés
- [ ] Modification du même ingrédient sur A puis B → la version de B gagne
- [ ] 15 cases cochées d'affilée → **un seul** envoi (à vérifier dans l'onglet réseau)
- [ ] Mode avion pendant un envoi → voyant en échec, **aucune perte**, renvoi au retour
- [ ] La vue et le filtre de Joel **ne changent jamais tout seuls** (§1.6)

---

## 8. LIMITES ASSUMÉES

1. **Les suppressions ne se propagent pas de façon garantie.** Une suppression est envoyée au
   cloud, mais si un autre appareil ouvert détient encore l'élément, il le réintroduira à sa
   prochaine synchro. Joel supprime « quasi jamais » ; gérer ce cas exige des pierres tombales,
   ce qui doublerait la complexité du lot.
2. **Horloges désynchronisées.** `updatedAt` utilise l'horloge de l'appareil. Si le téléphone
   retarde de 10 minutes, il perdra ses arbitrages. Un horodatage serveur Firebase corrigerait
   ce point mais complique l'API REST. Acceptable pour un usage familial.
3. **Fenêtre de concurrence résiduelle.** Deux appareils qui téléchargent, fusionnent et
   renvoient exactement au même instant : le dernier écrit gagne pour les éléments qu'ils ont
   modifiés tous les deux. La fusion par élément réduit énormément cette fenêtre sans la fermer.
4. **Pas de mode hors ligne durable.** Les modifications restent locales et repartent au retour
   du réseau, mais aucune file d'attente persistante n'est mise en place.

---

## 9. HORS PÉRIMÈTRE

- Authentification Firebase (risque accepté par Joel le 2026-07-28, `.claude/audit_memory.md`)
- Validation de schéma des données cloud (→ `Backlog/BACKLOG - Validation des donnees externes.md`)
- Correction de l'alias `state` fragile (→ `Backlog/BACKLOG - Alias state fragile.md`)
- Panneau « Informations Système » mort (`updateSystemInfo` cible `#system-storage`, inexistant)
- Le menu « Moteur Tâches Complexes » sans effet (à arbitrer, cf. `ROADMAP.md`)

---

## 10. CRITÈRES D'ACCEPTATION

- [ ] Tous les tests du §7.1 et §7.2 passent
- [ ] Validation unifiée verte (`.\validate.bat`) et `npm run build` OK
- [ ] `PROJECT_MAP.md` mis à jour (nouveau module `src/services/sync.js`)
- [ ] Les tests manuels du §7.3 sont validés **par Joel en conditions réelles, à deux appareils**
- [ ] Audit Dur rendu, réserves traitées
- [ ] Aucun changement de comportement observable **non listé** dans cette spec

---

## 11. PLAN DE REPLI

Le lot est livré sur `feat/lot7-synchro-collaborative`, non fusionné tant que Joel n'a pas
validé. En cas de problème après publication, `git revert` du commit de fusion restaure le
comportement précédent : **les données cloud restent lisibles par l'ancienne version**, puisque
`updatedAt` est un champ additionnel que l'ancien code ignore.

**Seul point non réversible** : les identifiants attribués aux éléments qui n'en avaient pas
(§4.3a). Ils sont déterministes, donc reproductibles, et sans effet sur l'ancien code.

---

## 12. TRAÇABILITÉ

- Finding d'origine : `ULTRA_AUDIT_REPORT.md` A11 (« modifications locales écrasées par la synchro »)
- Dépend de : `applyCloudState` (LOT 006), `debounce` (LOT 005)
- Découverte complète : phase obligatoire du 2026-07-28, 20 zones de risque recensées
