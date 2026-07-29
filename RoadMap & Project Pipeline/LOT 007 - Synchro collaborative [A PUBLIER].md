# LOT 007 — Synchro bidirectionnelle — SPÉCIFICATION v3

> **Statut :** 🟢 **A PUBLIER** (clôturé le 2026-07-30) — code écrit le 2026-07-29
> (`8c9e8fc`) ; **AUDIT DUR PASSÉ le 2026-07-30** : Gemini 3.6 Flash GO (cloud restauré,
> SHA-256 identique) · Codex 5.6 **GO final** après deux cycles de corrections
> (`1560763`, `24d8cb3`) — détail §12 bis.
> **Tests §6.2 LEVÉS par décision explicite de Joel (2026-07-30)** : « on passe cette
> étape, et si j'ai des problèmes dans la vraie vie on en reparle » — le constat se
> fera à l'usage réel, après publication.
> **Branche :** `feat/lot7-synchro-collaborative`
> **Niveau d'audit : DUR** (`CLAUDE.md` §5) · **Effort estimé :** ~4 h *(v1 : 6 h, v2 : 3 h)*
> **v1 le 2026-07-28** · **v2 le 2026-07-28 (audit Gemini + arbitrage de Joel)** ·
> **v3 le 2026-07-29 (duel Gemini 3.1 Pro × Codex 5.6 sur la v2 : double NO-GO, §0 ter)**
>
> **⛔ PRÉALABLE BLOQUANT : `LOT 008 — Données en sécurité`.** L'envoi automatique
> amplifierait les casses d'import/réinitialisation recensées dans
> `Backlog/BACKLOG - Regressions de la migration.md` en perte de données multi-appareils.
> Aucune ligne de ce lot ne s'écrit tant que le LOT 008 n'est pas clos.

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

## 0 ter. AUDIT DE LA v2 — duel Gemini 3.1 Pro × Codex 5.6 (2026-07-29)

La v2 a été soumise en duel à deux auditeurs indépendants, avec l'inventaire complet des
régressions de la migration en lecture obligatoire. **Double NO-GO** — pas sur le principe du
remplacement entier (validé par les deux), mais sur des trous que cette v3 corrige.

| Constat (auditeur) | Contre-vérification | Réponse v3 |
|---|---|---|
| L'envoi auto **amplifie** les casses d'import/réinitialisation en perte multi-appareils *(les deux)* | ✅ Fondé | **LOT 008 créé, préalable bloquant** |
| Un pull peut **écraser une modification locale non envoyée** — fenêtre des 2 s, retour réseau, rechargement *(les deux)* | ✅ Fondé, trou de conception | Drapeau **« EN ATTENTE » persisté** : tant qu'il est levé, aucun pull n'est appliqué, l'envoi passe d'abord (§4.3-4.4) |
| `lastSync` dans le document synchronisé **réamorce la boucle** : chaque succès modifie le document mémorisé *(Codex seul — Gemini l'a manqué)* | ✅ Fondé | `lastSync` devient une **métadonnée locale**, hors document, hors comparaison (§4.1) |
| « La suppression ne revient JAMAIS » est **survendu** : un appareil resté sur un état ancien la ressuscite s'il écrit avant son pull *(Codex)* | ✅ Fondé | §3 et §6.2 réécrits honnêtement |
| Contradiction §4.1/§4.2 : `shoppingChecked` synchronisé mais « transport inchangé » *(les deux)* | ✅ Fondé | §4.2 corrigé : `firebase.js` **est** modifié |
| L'import JSON contourne la protection de la clé API *(les deux)* | ✅ Fondé | LOT 008 : point d'entrée unique `applyExternalState` pour cloud ET fichiers |
| Slider de créativité non restauré → un « 50 » par défaut serait **diffusé partout** *(Codex)* | ✅ Fondé | LOT 008 |
| `shoppingChecked` garde des **ids orphelins** → état incohérent diffusé *(Codex)* | ✅ Fondé | LOT 008 (hygiène du Set) |
| Un ancien client qui écrit **supprime** `shoppingChecked` du cloud *(Codex)* | ✅ Fondé, impact faible (parc = les appareils de Joel, migrés ensemble) | Règle du champ absent = vide, jamais une erreur (§4.1) |

> Gemini avait validé l'anti-boucle (son B2) là où Codex a trouvé le réamorçage par `lastSync`.
> **Deux auditeurs, deux angles morts différents — c'est la démonstration de l'intérêt du duel.**

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

### Rafraîchissement des constats au démarrage du chantier (2026-07-29, post-LOT 008)

Vérifié par la phase découverte et confirmé par l'audit Codex du rapport d'exploration :
trois constats ci-dessus/du §1 étaient périmés à l'ouverture du chantier.

- **« Téléchargement au démarrage : perdu »** — plus exact : le pull de démarrage EXISTE
  (`js/app.js:86`, restauré aux LOTS 005/006), en ARRIÈRE-PLAN avec garde-fou d'empreinte —
  inversion assumée de l'oracle (qui bloquait l'écran sur le réseau). Ce lot le conserve
  et le raccorde au drapeau « EN ATTENTE ».
- **« Clé API préservée : dégradé (F8) »** — corrigé par le LOT 008 : `applyExternalState`
  (`src/state.js:171`) préserve la clé locale INCONDITIONNELLEMENT. Le trou F8 n'existe
  plus ; ce lot s'appuie sur ce point d'entrée unique.
- **`lastSync`** — jamais actualisé par le code actuel (retour de `syncPush` jeté, F4), mais
  une VIEILLE valeur peut encore être relue depuis localStorage ou le cloud par les fusions
  génériques (`state.js:55`, `:171`) : « toujours null » était trop catégorique (Codex).
  La v3 le sort du document synchronisé (métadonnée locale) — cette relecture fantôme cesse.

Rappel d'exécution (Codex) : ne pas recopier le monolithe aveuglément — le démarrage
instantané, la temporisation 2 s, les pulls périodiques et l'anti-écrasement hors ligne sont
des améliorations VOLONTAIRES de cette spec, à conserver.

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
4. Aucune fusion, aucun arbitrage : **la suppression se propage**, puisque l'absence d'un
   article est une information transmise comme une autre. **Honnêteté imposée par l'audit
   v2** : un appareil resté sur un état ANTÉRIEUR à la suppression peut encore la ressusciter
   s'il écrit avant son prochain pull. Cette fenêtre est bornée par les pulls automatiques
   (§4.4) ; elle n'est jamais nulle.

### Conséquence assumée, énoncée sans détour

Si l'appareil B modifie quoi que ce soit **avant d'avoir récupéré** un changement fait sur
l'appareil A, l'envoi de B **écrase ce changement**, silencieusement. C'est l'ordre
d'ARRIVÉE des requêtes au serveur qui tranche, pas l'heure du geste de l'utilisateur
(précision d'audit Codex).

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
| `aiConfig` **hors `apiKey` et hors `models`** | ✅ | Réglages IA. `models` est EXCLU (correction Codex, SSOT) : valeur dérivée d'`AI_ROLES` et réécrasée à chaque chargement — la synchroniser créerait un faux conflit entre appareils de versions différentes |
| **`shoppingChecked`** | ✅ **NOUVEAU** | Décision de Joel. Aujourd'hui hors périmètre (F5) |
| `aiConfig.apiKey` | ❌ **jamais envoyée, jamais écrasée** | §4.6 |
| `currentView`, `filter`, `search`, `showInStockOnly`, `showInCartOnly`, `currentSuggestionIdx` | ❌ | F6 — sinon l'écran de Joel changerait tout seul en plein magasin |
| `aiSuggestions` | ❌ | Volatile, sans identifiant, adressé par index (`js/app.js:452`) |
| `lastSync` | ❌ **métadonnée locale** | Correction d'audit v2 (Codex) : dans le document, chaque succès de synchro modifiait le contenu mémorisé et réamorçait un envoi. Stockée hors document (localStorage), exclue de la comparaison anti-boucle. Alimente le voyant et `#info-last-sync` |

**Changement observable annoncé** : aujourd'hui `syncPush` envoie **tout** `state`. Restreindre
le périmètre est un changement de comportement assumé. Conséquence sur les données déjà dans le
cloud : les clés retirées du document **disparaîtront du cloud au premier envoi** (`PUT`, F3).
Sans effet pratique — `loadState` réinitialise déjà ces champs à chaque démarrage (F6).

#### Intégration de `shoppingChecked`

`shoppingChecked` est un `Set` hors de `state` (F5), persisté dans sa propre clé localStorage.
Il est **sérialisé en tableau d'identifiants** dans le document synchronisé, et reconstruit en
`Set` à la réception — **extrait AVANT l'appel à `setState`** : il ne doit jamais apparaître
dans `state` (ce serait une seconde représentation, contraire au SSOT — réserve Codex). Son
stockage local séparé reste inchangé.

**Règle du champ absent** (correction d'audit v2, précisée par l'audit de campagne) : un
document cloud sans `shoppingChecked` (écrit par un ancien client) est traité comme
« aucune coche », jamais comme une erreur. Aucun champ du périmètre n'est obligatoire à la
réception — mais l'absence retombe sur la valeur PAR DÉFAUT appliquée explicitement clé par
clé (§4.3), PAS sur `sanitizeGlobalState` : le sanitizer ne remet pas à zéro `favorites` ou
`extraIngredients`, et `setState` fusionne — la valeur locale survivrait (constat Codex).

⚠️ **Piège technique (Codex)** : `shoppingChecked` est un export ESM de `src/state.js` — il
n'est PAS réassignable depuis `js/app.js`. La reconstruction du Set à la réception vit donc
dans `src/state.js` (fonction dédiée, ex. `replaceShoppingChecked(tableau)`), jamais par
affectation directe côté appelant.

### 4.2 Ce qui n'est pas touché

- **Aucun champ ajouté à aucun élément.** Pas de `updatedAt`, pas de `deletedAt`.
- **Aucun des 20 sites de mutation n'est modifié.**
- `src/services/firebase.js` : **modifié** (correction d'audit v2 — la v2 se contredisait en
  le disant « inchangé ») : construction du document selon le périmètre §4.1, injection de
  `shoppingChecked` sérialisé, exclusion de `lastSync`, délai d'expiration (§4.7). C'est le
  SEUL endroit qui décide de ce qui part au cloud — SSOT du périmètre.
- **Le point d'accroche de la planification vit dans `src/state.js::saveState`** (§4.5) —
  correction Codex : §4.2 disait « tout tient dans app.js » alors que les actions métier de
  `src/actions.js` appellent `saveState` DIRECTEMENT, sans passer par `app.js` ; un moteur
  accroché ailleurs manquerait ces mutations réelles. Pour éviter tout cycle d'import,
  `state.js` n'importe JAMAIS `firebase.js` ni le moteur : il expose une inscription
  (`registerSyncScheduler(fn)` ou équivalent) que le moteur, hébergé dans `js/app.js`,
  fournit au démarrage. Aucun autre nouveau module.

### 4.3 Séquence d'une synchronisation

```
ENVOI (déclenché par une modification locale, temporisé 2 s)
  0. toute modification locale lève le drapeau « EN ATTENTE » (persisté en localStorage)
  1. construire le document à envoyer (périmètre §4.1, clé API retirée, sans lastSync)
  2. GARDE-FOU : document sans `ingredients` exploitable → REFUS + voyant erreur (§4.9)
  3. si identique au DERNIER DOCUMENT CLOUD CONNU → baisser le drapeau, NE RIEN FAIRE
     (référence mise à jour à chaque envoi réussi ET à chaque pull appliqué — §4.5)
  4. PUT vers Firebase
  5. succès → mémoriser le document envoyé + baisser le drapeau + lastSync locale + voyant
     échec RÉCUPÉRABLE (réseau, délai, 5xx) → voyant « échec », drapeau MAINTENU,
                                               une nouvelle tentative à 10 s
     refus du GARDE-FOU client (§4.9)        → drapeau BAISSÉ, voyant erreur persistant,
                                               aucun retry (document invalide)
     refus SERVEUR (HTTP 4xx)                → drapeau MAINTENU, AUCUN retry automatique,
                                               voyant erreur persistant (données valides,
                                               on les protège — voir §4.9)

RÉCUPÉRATION (démarrage, retour sur l'app, toutes les 60 s, retour réseau, clic manuel)
  0. drapeau « EN ATTENTE » levé → NE PAS APPLIQUER de pull : envoyer d'abord (§4.4)
  1. GET depuis Firebase
  2. document nul (base vide) ou malformé (§4.9) → ne rien appliquer
  3. appliquer le document CLÉ PAR CLÉ sur le périmètre §4.1 : valeur du cloud si présente,
     sinon valeur PAR DÉFAUT (tableau vide…) — JAMAIS la valeur locale. ⚠️ `setState`
     FUSIONNE (`{...state, ...données}`) : une clé absente du cloud y survivrait
     localement, contredisant le remplacement entier (correction Codex). Construire
     l'objet complet clé par clé AVANT de l'appliquer. Clé API locale préservée (§4.6)
  4. marquer l'application comme « issue de la synchro »                   ← anti-boucle
  5. reconstruire shoppingChecked, redessiner la vue
```

**Le drapeau persisté couvre aussi le rechargement de page** (correction d'audit v2) : si
l'app est fermée avec des modifications non envoyées, le démarrage suivant ENVOIE avant
d'appliquer le moindre pull. Sans lui, le pull de démarrage écraserait silencieusement les
modifications faites hors ligne juste avant la fermeture.

### 4.4 Déclenchement

| Événement | Action |
|---|---|
| Démarrage | Récupération (le garde-fou d'empreinte du LOT 005 est **conservé** : il protège une modification faite pendant l'attente réseau) |
| Modification locale | Envoi temporisé **2 s** |
| Retour sur l'application (`visibilitychange`) | Récupération |
| Toutes les **60 s**, application visible | Récupération |
| Retour du réseau (`online`) | **Envoi d'abord** si modifications en attente, récupération ensuite (§4.4) |
| Clic sur « Cloud Sync » | Récupération **puis** envoi, immédiatement |

**Une seule opération à la fois.** Une demande arrivant pendant une opération en vol est mise
en attente et exécutée après — jamais accumulée.

**Arbitrage local/cloud** (correction d'audit v2, relevée par les deux auditeurs) :

- Drapeau « EN ATTENTE » levé → tout déclencheur de récupération devient **envoi d'abord**,
  récupération ensuite, seulement si l'envoi a réussi.
- Retour du réseau : même règle — jamais de pull destructif par-dessus des modifications
  non envoyées.
- Une nouvelle modification pendant qu'un retry est programmé : le retry est **annulé** et
  remplacé par la temporisation normale de 2 s. Il n'existe jamais qu'UN timer d'envoi.
- Retour du réseau alors qu'un retry est programmé : le retry est **annulé et absorbé** par
  le cycle déclenché par l'événement `online` — jamais deux envois pour la même cause
  (correction Codex).
- L'état réseau (`#info-network`) est affiché dès le démarrage (`navigator.onLine`), pas
  seulement au premier événement `online`/`offline`.

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
2. **Comparaison de contenu — contre le DERNIER DOCUMENT CLOUD CONNU.** La référence est
   mise à jour à chaque envoi réussi **ET à chaque pull appliqué** (correction d'audit de
   campagne, Codex). Comparer au seul « dernier envoyé » laissait réémettre un contenu
   périmé : B envoie V1, reçoit V2 d'A, puis une simple sauvegarde d'un champ NON
   synchronisé (vue, filtre) lève le drapeau — V2 ≠ V1, donc B renverrait V2… en écrasant
   le V3 qu'A a publié entre-temps, sans avoir modifié une seule donnée synchronisée. Avec
   la référence « dernier cloud connu », le document de B est identique à V2 → aucun envoi.
   Un envoi identique à la référence est **abandonné avant la requête réseau**. Conditions
   de validité : `lastSync` hors document (§4.1), sinon chaque succès réamorçait le verrou
   (constat Codex du duel v2).

**Précision d'implémentation** (correction d'audit v2, Codex) : le `saveState(false)` actuel
de `src/state.js` ne supprime que l'événement de RENDU (`stateUpdated`) — il ne coupe aucun
envoi. La planification d'envoi ne doit donc **PAS** être accrochée à l'événement
`stateUpdated` : elle vit DANS `saveState`, derrière un paramètre explicite, pour que le
chemin « application d'un pull » puisse sauvegarder localement SANS jamais planifier d'envoi —
exactement le contrat du `saveState(false)` du monolithe (l.4335-4340).

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

### 4.9 Garde-fous sortants et entrants — ajout d'audit v2

1. **Jamais d'envoi d'un état non exploitable.** Un document dont `ingredients` n'est pas un
   tableau non vide alors que le dernier document envoyé en avait un → envoi REFUSÉ, voyant
   en erreur, aucun retry. Symétrique du garde `if (data && data.ingredients)` que le
   monolithe avait côté réception (l.4405). Une vidange volontaire (réinitialisation assumée,
   LOT 008) passe par un chemin explicite qui l'autorise.

   **Règle anti-verrouillage à TROIS cas (affinée par le double audit de campagne :
   Gemini 3.6 Flash a trouvé le verrouillage, Codex 5.6 a montré que la première correction
   échangeait le verrouillage contre une perte de données)** :
   - **Échec récupérable** (réseau, délai, 5xx) : drapeau MAINTENU, une tentative à 10 s.
   - **Refus du garde-fou client** (document non exploitable) : drapeau **BAISSÉ**, voyant
     erreur persistant, aucun retry. Un document invalide n'a rien de valide à protéger —
     le laisser bloquer les pulls verrouillerait l'appareil à jamais (constat Flash).
   - **Refus serveur HTTP 4xx** (autorisation, règles Firebase) : drapeau **MAINTENU**,
     aucun retry automatique, voyant erreur persistant. Ici les données locales sont
     VALIDES — baisser le drapeau permettrait au pull suivant de les écraser sans qu'elles
     aient jamais été envoyées (constat Codex). Pas de verrouillage réel : un 4xx à l'envoi
     implique un 4xx à la récupération (mêmes règles d'accès), la synchro est morte dans
     les DEUX sens tant que l'accès n'est pas réparé ; toute nouvelle modification locale
     ou clic manuel retente l'envoi.
2. **Jamais d'application d'un document malformé.** À la réception : `ingredients` absent ou
   non-tableau → document ignoré, voyant en erreur discrète. (La validation de schéma
   complète reste au LOT 014.)
3. **Import de fichier et réinitialisation** : comportements définis au LOT 008 (préalable).
   Règles héritées ici : la restauration TOTALE d'un fichier est suivie d'un envoi normal —
   c'est voulu, restaurer = restaurer partout, et le texte du bouton l'annonce ; l'import
   « stock seulement » est une fusion (LOT 008), son envoi est un envoi ordinaire ; la
   réinitialisation reconstruit l'inventaire par défaut et le propage, le texte de
   confirmation l'annonce.

---

## 5. MIGRATION

**Aucune migration de données.** Aucun champ n'est ajouté aux éléments existants. Le premier
envoi réécrit simplement le document cloud selon le périmètre §4.1.

**Bénéfice collatéral** : ce premier envoi nettoie la base cloud des modèles IA périmés
(`gemini-2.0-flash`, `gemini-2.5-flash`) constatés le 2026-07-28.

---

## 6. PLAN DE TEST

### 6.1 Tests unitaires — TOUS ÉCRITS ET VERTS le 2026-07-29
(`tests/firebase.test.js` étendu + `tests/sync-scope.test.js` + `tests/sync-engine.test.js` —
le moteur vivant dans `js/app.js` (§4.2), ses points d'entrée sont exportés pour la 3e suite)

- [x] Le document envoyé **ne contient jamais** la clé API *(durci : la clé est ABSENTE,
      plus seulement blanchie)*
- [x] Le document envoyé **ne contient pas** `currentView`, `filter`, `search`,
      `showInStockOnly`, `showInCartOnly`, `currentSuggestionIdx`, `aiSuggestions`
- [x] Le document envoyé **contient** `shoppingChecked` sous forme de tableau d'identifiants
- [x] Un document reçu contenant une clé API non vide **ne remplace pas** la clé locale (F8)
- [x] Un document reçu **ne modifie pas** la vue ni les filtres locaux (F6)
- [x] `shoppingChecked` est reconstruit en `Set` à la réception (muté en place, jamais réassigné)
- [x] Base vide (`null`) → aucune application, aucune erreur
- [x] Rejet réseau de `fetch` → erreur remontée, aucune exception non gérée
- [x] Expiration du délai (15 s) → traité comme un échec, aucune perte locale
- [x] **Anti-boucle** : un document identique au dernier envoyé n'est pas renvoyé
- [x] **Anti-boucle** : une application issue de la synchro ne planifie pas d'envoi
- [x] Le document envoyé **ne contient pas** `lastSync` (métadonnée locale, §4.1)
- [x] Drapeau « EN ATTENTE » levé → une récupération n'applique RIEN et déclenche l'envoi
      (+ variante : si l'envoi échoue, AUCUN GET ne part — pas de pull destructif)
- [x] Drapeau persisté : rechargement avec modifications non envoyées → envoi avant tout pull
- [x] Un document sans `ingredients` exploitable n'est **jamais envoyé** (garde §4.9)
- [x] Un document reçu malformé (`ingredients` non-tableau) est **ignoré sans exception**
- [x] Un document reçu **sans** `shoppingChecked` → « aucune coche », sans erreur
- [x] Une modification pendant un retry programmé → le retry est annulé, un seul timer d'envoi
- [x] Un refus du garde-fou client (§4.9) **baisse** le drapeau — l'appareil n'est jamais
      verrouillé
- [x] Un refus serveur (HTTP 4xx) **maintient** le drapeau sans retry automatique — des
      modifications jamais envoyées ne peuvent pas être écrasées par un pull ultérieur
- [x] Après un pull appliqué, une sauvegarde d'un champ NON synchronisé (vue, filtre) ne
      déclenche **aucun** envoi (référence = dernier cloud connu, §4.5)
- [x] Un document cloud sans `favorites` → favoris locaux REMPLACÉS par vide, pas conservés
      (application clé par clé, §4.3)
- [x] *(hors liste initiale)* 15 coches espacées de 100 ms → **un seul** envoi (débounce)
- [x] *(hors liste initiale)* Des gestes pendant la requête de pull écartent la photo cloud
      (garde-fou d'empreinte du LOT 005, GÉNÉRALISÉ à tous les pulls)
- [x] *(hors liste initiale)* Voyant : `À jour ✓` puis retour `Cloud Sync` à 2 s ;
      `#info-last-sync` et `#info-network` alimentés

### 6.2 Tests manuels à deux appareils (validation par Joel)

> **LEVÉS par décision explicite de Joel à la clôture (2026-07-30)** — non exécutés,
> pas cochés. Le constat se fera à l'usage réel après publication ; tout problème
> rencontré rouvrira ce point (les scénarios ci-dessous servent alors de grille de
> diagnostic). Le GO statique des deux auditeurs n'est pas remis en cause par ce report.

- [ ] Ajout sur A → apparaît sur B dans la minute
- [ ] **Suppression sur A → l'article ne revient pas** sur un appareil à jour (le défaut qui a
      fait tomber la v1). Cas limite assumé, à constater une fois : B resté sur un état
      antérieur qui écrit AVANT son pull le ressuscite — vérifier que le pull suivant de B
      (≤ 60 s) referme la fenêtre
- [ ] Modification sur A hors ligne → retour du réseau → la modification est ENVOYÉE, pas
      écrasée par le pull du retour réseau
- [ ] Modification puis rechargement immédiat de la page → la modification part au démarrage
      suivant (drapeau persisté)
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
3. **Hors ligne : un drapeau, pas une file.** Les modifications restent locales ; le drapeau
   « EN ATTENTE » persisté garantit qu'elles repartent au retour du réseau OU au démarrage
   suivant. Mais il n'y a qu'UN état à envoyer (le dernier), pas un historique : deux
   appareils hors ligne en même temps se départagent par « le dernier envoi gagne ».
4. **Résurrection résiduelle d'une suppression** (§3) : fenêtre bornée par les pulls (60 s,
   retour d'app, démarrage), jamais nulle. Acceptée.

---

## 8. HORS PÉRIMÈTRE

- Authentification Firebase (risque accepté, `.claude/audit_memory.md`)
- Validation de schéma des données cloud (→ `Backlog/BACKLOG - Validation des donnees externes.md`)
- Alias `state` fragile (→ LOT 014)
- Panneau « Informations Système » : ce lot ne restaure QUE `#info-last-sync` et
  `#info-network` (périmètre synchro, fiche régressions §2) ; les trois autres champs
  (`info-api-key`, `info-fb-user`, `info-storage`) → LOT 009

---

## 9. CRITÈRES D'ACCEPTATION

- [x] Tous les tests du §6.1 passent *(2026-07-29 : 82/82 vitest, dont 35 nouveaux)*
- [x] Validation unifiée verte (`.\validate.bat`) et `npm run build` OK *(13/13 pytest, build 562 ms)*
- [x] `PROJECT_MAP.md` à jour *(2 suites ajoutées)*
- [~] Tests manuels du §6.2 : **LEVÉS par décision explicite de Joel (2026-07-30)** —
      constat reporté à l'usage réel, critère non exigé pour la clôture
- [x] Audit Dur rendu, réserves traitées *(2026-07-30 : Gemini GO + Codex GO final après
      2 cycles de corrections — 5 findings et 2 scénarios maintenus, tous fermés avec tests)*
- [x] Aucun changement de comportement observable **non listé** dans cette spec ni dans les
      §12/§12 bis *(vérifié par les deux auditeurs sur le diff complet)*

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
- Audit de la v1 : Gemini 3.1 Pro, 2026-07-28 — NO-GO, 2 défauts sur 4 retenus
- Audit de la v2 : **duel Gemini 3.1 Pro × Codex 5.6**, 2026-07-29 — double NO-GO, tous les
  constats fondés intégrés dans cette v3 (§0 ter)
- Audit de campagne (2026-07-29, sur la v3) : Gemini 3.6 Flash + Codex 5.6 — intégrés :
  anti-verrouillage à trois cas (§4.9), référence « dernier cloud connu » (§4.5), accroche
  dans `saveState` sans cycle (§4.2), application clé par clé (§4.3), `models` exclu du
  périmètre (§4.1), annulation du retry au retour réseau (§4.4)
- Dépend de : **LOT 008 (préalable bloquant)**, `applyExternalState` (créé au LOT 008,
  extension de l'`applyCloudState` du LOT 006), `debounce` (LOT 005)
- Absorbe : `#info-last-sync`, `#info-network`, écouteurs `online`/`offline`
  (`Backlog/BACKLOG - Regressions de la migration.md` §2)

---

## 12. RÉALISATION (2026-07-29) — code écrit, en attente d'audit Dur + tests §6.2

**Fichiers modifiés** : `src/state.js` (inscription `registerSyncScheduler`, paramètre
`scheduleSync` de `saveState`/`setState`/`applyExternalState`, `replaceShoppingChecked`) ·
`src/services/firebase.js` (réécrit : `buildSyncDocument`/`extractSyncedState` = SSOT du
périmètre §4.1, délai 15 s, erreurs porteuses du code HTTP) · `js/app.js` (moteur complet
§4.3-4.9 + voyant + panneau) · `src/actions.js` (`resetAllData` → chemin explicite
`syncPush(state, coches)`) · 4 suites de test · `PROJECT_MAP.md`.

**Choix d'implémentation assumés** (tout écart à la lettre de la spec est listé ICI —
critère §9 « aucun changement non listé ») :

1. **Toast des échecs** : les échecs d'ENVOI sont toujours toastés ; un échec de pull
   AUTOMATIQUE ne met que le voyant en erreur (un pull manuel toaste). La lettre du §4.8
   (« toast pour tous les échecs ») aurait produit un toast toutes les 60 s en cas de panne
   serveur — contraire à son propre esprit anti-bruit. Les pulls périodiques sont d'ailleurs
   suspendus hors ligne (`navigator.onLine`), le voyant « Hors ligne » informant déjà.
2. **Garde-fou d'empreinte généralisé** : la spec conservait le garde du LOT 005 au
   démarrage ; il protège désormais TOUS les pulls (60 s, visibilité, online, manuel) contre
   un geste fait pendant l'attente réseau — coches incluses dans l'empreinte.
3. **Compteur de génération de modification** : le drapeau « EN ATTENTE » n'est baissé après
   un envoi réussi que si RIEN n'a changé pendant le vol de la requête (trou de la fenêtre
   « modification pendant l'envoi » non couvert par la spec, fermé ici).
4. **`syncPush(state, coches)` retourne le document envoyé** (l'ancien retour `lastSync`
   horodaté était jeté par tous les appelants — F4). `resetAllData` l'appelle directement :
   c'est le chemin explicite de vidange volontaire prévu au §4.9.1.
5. **`updateSystemInfo`** : l'ancien corps visait `#system-storage`, id inexistant
   (0 occurrence, preuve de la phase découverte) — remplacé par l'alimentation des deux
   tuiles du périmètre (`#info-last-sync`, `#info-network`, oracle l.4466-4482). Les trois
   autres tuiles restent au LOT 009.
6. **Voyant** : libellés du §4.8, erreur PERSISTANTE (pas de retour auto, contrairement à
   l'oracle), timer de retour annulable (l'oracle empilait les `setTimeout`).
7. **`pushToFirebase` exposé** (câblé sur aucun bouton, F2) : conservé, rebranché sur le
   moteur (`requestSyncOp('send')`).
8. **`state.lastSync` (champ d'état)** : désormais totalement inerte (hors document, hors
   lecture). Sa suppression du state serait un nettoyage hors spec → LOT 014.
9. **Moteur hébergé dans `js/app.js`** (§4.2 respecté, aucun nouveau module) ; ses points
   d'entrée sont exportés en fin de fichier UNIQUEMENT pour `tests/sync-engine.test.js`
   (sans effet dans le navigateur). Troisième suite de test non prévue par le §6.1, qui
   n'en nommait que deux.

**Validation du 2026-07-29** : 82/82 vitest (35 nouveaux tests synchro) · 13/13 pytest ·
`npm run build` OK. Les cases restantes du §9 attendent l'audit Dur et les tests à deux
appareils de Joel.

---

## 12 bis. AUDIT DUR DU CODE (2026-07-29/30) — verdicts et corrections

**Gemini 3.6 Flash : GO** sur les 7 points, protocole cloud respecté (restauration
prouvée, SHA-256 identique avant/après). **Codex 5.6 (Sol) : NO-GO** — 3 findings
CRITIQUES + 2 réserves, tous CONTRE-VÉRIFIÉS FONDÉS. Racine commune : le drapeau
« EN ATTENTE » se levait pour N'IMPORTE QUELLE sauvegarde, pas seulement pour une
modification du document synchronisé. Corrections livrées le 2026-07-30 :

| # | Finding (Codex) | Correction | Test de régression |
|---|---|---|---|
| C1 | Changer d'écran hors ligne levait le drapeau → au retour réseau, un VIEIL inventaire partait AVANT le pull et écrasait un cloud plus récent | La référence « dernier cloud connu » est **persistée** (`pantry_v5_sync_ref`, SSOT dans `constants.js`) ; `scheduleSyncPush` ne lève le drapeau que si le document synchronisé **diffère réellement** de cette référence | `sync-engine` : « une navigation ne lève jamais le drapeau » |
| C2 | Un réglage IA modifié pendant un pull en vol était écrasé par la photo cloud, puis considéré « déjà envoyé » | L'empreinte du garde-fou de pull = le **document synchronisé entier** (`currentSyncDocJson`), plus seulement les 4 tableaux + coches | `sync-engine` : « un réglage IA modifié pendant un pull… » |
| C3 | Le reset (via `switchView` → `saveState`) laissait un drapeau résiduel → **second PUT fantôme** au redémarrage, capable d'écraser une écriture concurrente | `resetAllData` sauvegarde SANS planification (`saveState(true, false)`) et écrit lui-même la référence après son PUT explicite | `actions-data` : « ne programme AUCUN envoi fantôme… » |
| D1 (durcissement) | Drapeau maintenu après 4xx/retry épuisé + pulls périodiques = un retry toutes les 60 s, contrairement à la promesse « une seule tentative » | `_syncSendBlocked` : après 4xx ou épuisement du retry, les cycles AUTOMATIQUES ne tentent plus rien ; une modification, un clic manuel ou le retour réseau réautorisent | `sync-engine` : 2 tests (blocage + réautorisation manuelle) |
| D2 (bénin) | Au démarrage hors ligne, l'échec du pull remplaçait « Hors ligne » par « Échec — réessayer » | Pas de pull initial si `navigator.onLine` est faux — l'écouteur `online` s'en chargera | `sync-engine` : « un démarrage hors ligne garde le voyant » |

**Validation post-corrections (2026-07-30)** : 88/88 vitest (6 tests de régression
d'audit ajoutés) · 13/13 pytest · build OK. Ce que Gemini avait validé (périmètre
étanche, anti-boucle après référence connue, clé API) reste intact — Codex l'avait
d'ailleurs confirmé dans son propre rapport.

### Contre-vérification Codex (2026-07-30) : C2/D1/D2 fermés, C1/C3 MAINTENUS → 2e correction

Sol a validé C2, D1 et D2 mais maintenu C1 et C3 avec des scénarios plus fins,
tous deux contre-vérifiés fondés et corrigés :

| # | Scénario maintenu (Codex) | Correction | Test exigé par Codex, livré |
|---|---|---|---|
| C1 | **Référence ABSENTE** (premier lancement de cette version) : toute sauvegarde comparait à `null` → une navigation hors ligne relevait le drapeau → PUT furtif avant le GET au retour réseau | **Amorçage** : à l'init, référence absente + drapeau baissé → la référence devient l'état local tel quel (persistée). EXCEPTION : drapeau levé → pas d'amorçage, les modifications en attente partent d'abord (la garantie du drapeau persisté est conservée) | « référence absente + démarrage hors ligne + navigation + retour réseau → aucun PUT furtif avant le GET » + le cas drapeau levé |
| C3 | Le reset restait **hors de la file du moteur** : un envoi temporisé déjà armé, ou un PUT déjà EN VOL, pouvait aboutir APRÈS le PUT du reset et restaurer l'ancien état dans le cloud | **Barrière de quiescence** (`registerSyncBarrier`/`awaitSyncQuiescence` dans `state.js`, sans cycle d'import) : le reset annule tout envoi temporisé et ATTEND la fin d'un envoi en vol avant son propre PUT | « un PUT du moteur retenu en vol aboutit AVANT le PUT du reset, jamais après » (vrai moteur, requête contrôlée, ordre des écritures vérifié) + le cas timer armé |

**Validation (2026-07-30)** : 92/92 vitest (4 tests de contre-vérification ajoutés) ·
13/13 pytest · build OK.

**VERDICT FINAL Codex (2026-07-30, sur `1560763..24d8cb3`) : GO — NO-GO levé.**
Les deux réfutations acceptées avec preuves (amorçage/exception « correctement
ordonnés », barrière « annule le timer, vide l'opération en attente et attend
réellement l'opération en vol »). Citation : « Les tests manuels à deux appareils
du §6.2 restent la dernière validation normale, mais ils ne remettent pas en cause
le GO statique. »
