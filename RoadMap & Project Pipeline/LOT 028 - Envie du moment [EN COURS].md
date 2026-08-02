# LOT 028 — Envie du moment `[EN COURS]`

**Ouvert le 2026-08-02** · Branche `feat/lot28-envie-du-moment` (depuis `main`, V5.15) ·
Niveau d'audit : **Standard** (audit de spec court + audit du diff final) — le lot touche
`src/services/gemini.js`, zone sensible de `DOCTRINE_PRODUIT.md` §3.

---

## 1. D'OÙ ÇA VIENT

Demande de Joel du 2026-08-02, le jour de la publication de la V5.15 :
« je voudrais pouvoir imposer un type de plat ou une contrainte particulière à la génération,
via un champ d'entrée libre ».

**Précision donnée par Joel le même jour** : « je veux donc pouvoir par exemple dire "chili con
carne" et n'avoir QUE des propositions de recettes de chili con carne ». La consigne n'est donc
pas un indice, c'est une **exigence stricte** : les 5 propositions doivent toutes y répondre —
5 variantes du même plat, pas 5 plats différents dont un chili.

## 2. CE QUE ÇA CHANGE À L'ÉCRAN

1. Un champ texte libre **« Envie du moment »**, en **tête des réglages IA** (dans la boîte
   « Paramètres rapides », toujours visible — pas dans l'accordéon « Filtres avancés » qu'il
   faudrait déplier).
2. Le **résumé sous le bouton « Obtenir 5 suggestions »** affiche la consigne active :
   « PLAT · 2 PERS. · « chili con carne » ». C'est le garde-fou contre le piège de ce genre de
   champ — une consigne tapée un mardi, oubliée, qui continue de tout filtrer une semaine plus
   tard. Aujourd'hui ce résumé n'est **jamais** rafraîchi à la frappe : il le sera.
3. Le champ **« Exceptions autorisées »** se met enfin à servir (cf. §3).

## 3. LA TROUVAILLE DE LA DÉCOUVERTE : UN CHAMP DÉCORATIF DEPUIS L'ORIGINE

`aiConfig.exceptions` (champ « Exceptions autorisées », `index.html:386`) est **saisi,
enregistré, synchronisé au cloud, sauvegardé dans le fichier JSON et restauré au
rechargement** — mais **n'est lu par AUCUN prompt** : ni la génération de recettes, ni la
transformation de recette collée, ni la nutrition, ni la catégorie, ni les deux chemins
d'emoji. Vérifié sur les 6 prompts du dépôt.

**Et ce n'est pas une régression de la migration** : l'oracle `foodapp-v5-Joel.html:5207-5228`
ne le lit pas davantage. Le champ n'a **jamais** été branché, depuis le premier jour.

**Joel s'en est déjà servi** : sa sauvegarde du 2026-07-29 contient `"exceptions": "Riz"`. Il a
écrit une consigne en croyant qu'elle serait suivie ; elle n'a jamais quitté son appareil.
**Décision de Joel (question fermée, 2026-08-02) : le brancher enfin**, dans ce lot.

## 4. LES TROIS DÉCISIONS DE JOEL (2026-08-02, questions fermées — ne pas re-demander)

| # | Question | Décision |
|---|---|---|
| 1 | Où placer le champ ? | **En tête des réglages** (boîte toujours visible), + rappel de la consigne active sous le bouton Générer |
| 2 | Qui gagne si la consigne libre contredit une puce ? | **La consigne libre**, sauf les ingrédients imposés qui restent au-dessus de tout (règle d'or inchangée) |
| 3 | Sort du champ « Exceptions autorisées » | **Le brancher enfin** (plutôt que le retirer ou le laisser décoratif) |

## 5. PHASE DÉCOUVERTE (agent Explore, 2026-08-02 — 14 ressources, 12 gaps)

**Le circuit existe déjà à l'identique** : `aiConfig.exclusions` fait exactement le trajet
visé — `index.html:442-448` (saisie, `oninput="saveAiConfigFromUI()"`, `maxlength="80"`) →
`src/ui/settings.js:145` (écriture, `saveState(false)`) → `src/ui/aiPanel.js:187`
(restauration) → `src/services/sync.js:98` (empreinte anti-écrasement) →
`src/services/gemini.js:245` (lecture dans le prompt). **Le lot recopie ce circuit, il n'en
invente aucun.**

**Tout ce qui touche l'état est générique** : une clé ajoutée à `defaultAiConfig()`
(`src/state.js:25-33`) est comblée sur TOUS les chemins d'entrée — vieux `localStorage`
(`sanitizeGlobalState`, `state.js:257`), pull cloud (`firebase.js:91`), restauration de
fichier (`actions.js:349`), remise à zéro (`actions.js:192`) — et repart au cloud et dans la
sauvegarde sans aucune liste blanche à tenir (`firebase.js:64-65`, `BACKUP_STATE_KEYS`).

**Le patron d'une contrainte conditionnelle dans le prompt existe** : `antiRepetePrompt`
(`gemini.js:228-235`, LOT 026) — liste vide ⇒ chaîne vide ⇒ **pas un jeton dépensé**, message
strictement identique à aujourd'hui.

**Points d'attention retenus (les 12 gaps, triés par ce qu'ils coûtent si on les rate)** :

1. **`AI_FORM_FIELD_IDS` (`sync.js:98`)** — si le nouvel id n'y est PAS ajouté : Joel tape sa
   consigne, un pull cloud arrive au même instant, l'empreinte est jugée inchangée, et
   **`restoreAIConfig()` écrase sa saisie en cours**. C'est le défaut FV-3 déjà figé par
   `tests/sync-engine.test.js:285-320` — mais ce test est écrit **en dur sur `ai-exclusions`**,
   il ne couvrira jamais un champ neuf. **Verrou dédié obligatoire dans ce lot.**
2. **`restoreAIConfig` n'a rien de générique pour les champs texte** (`aiPanel.js:186-187`) :
   la ligne du nouveau champ s'écrit à la main, sinon la consigne disparaît de l'écran au
   rechargement tout en restant active dans l'état — le pire des deux mondes.
3. **`updateAiCtaSummary` est privée** (`aiPanel.js:219`, non exportée) et **jamais appelée par
   `saveAiConfigFromUI`** : le résumé ne bouge pas à la frappe. À exporter et importer dans
   `settings.js` — précédent exact déjà en place avec `updateCreativityLabels`
   (`settings.js:7`), sans cycle d'import.
4. **`.ai-cta-summary` n'a AUCUNE troncature** (`css/sections/05-ai.css:58-66`) et est en
   `text-transform:uppercase` : une consigne longue déformerait la barre collante. Le
   sélecteur `.ai-cta-summary span` (`:67-69`, vert) existe **et n'est utilisé nulle part** —
   c'est la place prévue par le design d'origine pour cette mise en évidence.
5. **Aucun test ne couvre `aiConfig.exclusions` dans le prompt** (`Exclure formellement` :
   0 occurrence dans `tests/`). La moitié droite de la ligne 6 est nue ; ce lot la couvre en
   passant, puisqu'il écrit juste à côté.
6. **Aucun test ne verrouille les NUMÉROS des lignes du prompt** — seulement les libellés
   (`'CUISINE : italienne'`, `'RÉGIMES & EXCLUSIONS : keto'`, `"RÈGLE D'OR"`,
   `'TYPE DE PLAT : Obligatoire -> Tous types'`…). La numérotation peut donc bouger ; les
   libellés existants, non. **Choix retenu : ne toucher AUCUNE ligne numérotée** (cf. §6).
7. **Deux mines à `not.toContain`** : `tests/ai-config-complete.test.js:118`
   (`not.toContain('undefined')` — casse si la nouvelle clé manque de `defaultAiConfig()`) et
   `gemini.test.js:242` / `ai-anti-repetition.test.js:85` (`not.toContain('DÉJÀ PROPOSÉES')` —
   casse si le nouveau libellé réutilise ces mots). Aucun des deux ne doit être « réparé » :
   ils font leur travail.
8. **`tests/_helpers/dom-helpers.js:88,102` mentent sur la balise** : `ai-exceptions` et
   `ai-exclusions` y sont des `<textarea>` alors qu'`index.html:386,446` a des
   `<input class="ai-input">`, sans `maxlength`. Le garde-fou de fraîcheur
   (`dom-helpers-fraicheur.test.js`) **ne vérifie que les `id`**, jamais la balise ni les
   attributs : l'écart est invisible et le resterait. Corrigé dans ce lot (§6.6) — y ajouter
   un troisième champ en laissant deux mensonges à côté serait poser un piège en connaissance
   de cause.
9. **Aucun échappement du texte libre** avant interpolation dans le prompt.
   `escapePromptValue` (`validate.js:125`) existe mais n'est câblé que sur le formulaire
   d'ajout. Le garde-fou déjà pratiqué dans ce projet pour ce risque est le `maxlength` HTML
   (80 sur `ai-exclusions`) — retenu ici (§6.1).
10. **L'ajout d'une clé à `aiConfig` change l'empreinte du document synchronisé**
    (`sync.js:82-84` via `firebase.js:64-65`) : au premier chargement après déploiement,
    chaque appareil enverra **un push** pour enrichir le document cloud. **Bénin et attendu**
    (le document s'enrichit, il ne s'appauvrit pas ; précédents LOTS 010 `cuisines` et 022) —
    tracé ici, pas corrigé.
11. **Aucune garde de type sur les champs texte de `aiConfig`** (`sanitizeGlobalState` ne
    durcit que `cuisines`) : même famille que le finding **F-011** du registre technique,
    classé pare-feu A/B. **Hors périmètre** — ce lot n'en ajoute pas et n'en retire pas.
12. **`PROJECT_MAP.md`** : ligne d'inventaire propre obligatoire pour tout nouveau fichier de
    test (verrou `test_project_map_freshness.py:101-110`, durci au LOT 014 — une mention en
    passant ne suffit plus), + révision des entrées touchées.

## 6. SPÉCIFICATION

### 6.1 Le champ (`index.html`)

Nouveau bloc `ai-field-group` inséré **entre `index.html:289` (`#ai-context-sub`) et `:291`**,
donc dans la boîte « Paramètres rapides », **hors accordéon** (décision 1) :

```html
<div class="ai-field-group">
  <span class="ai-field-label">Envie du moment <span …>(prioritaire)</span></span>
  <input class="ai-input" id="ai-envie" maxlength="100"
    placeholder="Ex : chili con carne, un plat à réchauffer demain…"
    oninput="saveAiConfigFromUI()">
</div>
```

- **`maxlength="100"`** : garde-fou contre la réécriture de consigne (gap 9). 100 plutôt que
  les 80 d'`ai-exclusions` — une envie peut être une phrase (« un plat à réchauffer demain »).
- **`oninput="saveAiConfigFromUI()"`** : réutilise la fonction déjà exposée sur `window`
  (`js/app.js:550`), donc **aucun câblage nouveau** et le verrou de parité
  `tests/html-window-parity.test.js` reste satisfait sans rien y ajouter.
- **`ai-exceptions` reçoit `maxlength="80"`** (il n'en avait aucun) : à partir de ce lot son
  contenu part dans le prompt, il doit être borné comme son jumeau. **Écart déclaré**, pas
  silencieux ; ne tronque aucune valeur existante (le `maxlength` ne limite que la saisie).

### 6.2 L'état (`src/state.js`)

Une clé `envie: ''` ajoutée à `defaultAiConfig()`. **Rien d'autre** : tous les chemins
d'entrée/sortie sont génériques (§5). `tests/ai-config-complete.test.js:41-43`, qui itère sur
`Object.keys(defaultAiConfig())`, couvrira la nouvelle clé **gratuitement**.

### 6.3 Le circuit écran ↔ état

| Endroit | Ajout |
|---|---|
| `src/ui/settings.js` (`saveAiConfigFromUI`) | lecture de `#ai-envie` **+ appel de `updateAiCtaSummary()`** (gap 3) |
| `src/ui/aiPanel.js` (`restoreAIConfig`) | ligne de restauration du champ (gap 2) |
| `src/ui/aiPanel.js` (`updateAiCtaSummary`) | passe **`export`** ; affiche la consigne active |
| `src/services/sync.js` (`AI_FORM_FIELD_IDS`) | `'ai-envie'` ajouté (gap 1) |

**SSOT de la normalisation** : une consigne faite d'espaces ne doit compter ni pour le prompt
ni pour le résumé. La règle vit **à un seul endroit** — `envieActive(aiConfig)` dans
`src/utils/helpers.js` — et non recopiée dans les deux appelants.

### 6.4 Le résumé sous le bouton (`updateAiCtaSummary`)

- Consigne vide → texte **strictement inchangé** : `Plat · 2 pers.` (le seul test existant du
  résumé, `tests/restore-ai-config.test.js:70-74`, reste vert sans modification).
- Consigne remplie → `Plat · 2 pers. · « chili con carne »`, la partie consigne dans un
  `<span>` (vert `--green`), construit avec `h()` — jamais d'`innerHTML` (règle de campagne).
- **CSS** : troncature ajoutée **sur le `span` seul** (`max-width` + `text-overflow: ellipsis`),
  pour qu'une consigne longue ne casse jamais la barre collante sans tronquer « 2 pers. »
  (gap 4).

### 6.5 Le prompt (`src/services/gemini.js`) — **AUCUNE ligne numérotée existante n'est touchée**

**(a) L'envie du moment — bloc prioritaire, avant la liste des contraintes.** Construit comme
`antiRepetePrompt` : vide ⇒ chaîne vide ⇒ message **identique à aujourd'hui, octet pour
octet**. Rempli ⇒ inséré entre la mission et `🚨 CONTRAINTES`, en tête, ce qui sert à la fois
la lecture du modèle et la règle de priorité :

> 🎯 DEMANDE EXPRESSE DE L'UTILISATEUR : « … »
> C'est l'EXIGENCE PRIORITAIRE : les 5 recettes doivent TOUTES y répondre (5 variantes
> répondant à cette demande, jamais 5 plats différents dont un seul correspondrait).
> Elle PRIME sur les contraintes 1 (type de plat) et 2 (cuisine) en cas de contradiction.
> Elle ne prime JAMAIS sur la contrainte 3 (ingrédients imposés).

La hiérarchie est donc **écrite dans le bloc neuf**, ce qui évite de réécrire la RÈGLE D'OR
(`:246`) que `tests/gemini.test.js:177` verrouille.

**(b) Les exceptions autorisées — sous-ligne conditionnelle de la contrainte 6.** Même patron :
vide ⇒ rien. Remplie ⇒ une ligne indentée sous « RÉGIMES & EXCLUSIONS », avant la RÈGLE D'OR :

> ✅ EXCEPTIONS AUTORISÉES (malgré les régimes ci-dessus) : …

Le libellé « 6. RÉGIMES & EXCLUSIONS : … » lui-même n'est **pas modifié** — les trois
assertions de `tests/diet-chips.test.js:81,89,97` restent vertes telles quelles.

### 6.6 Tests

**Nouveau fichier `tests/envie-du-moment.test.js`** (patron `tests/diet-chips.test.js` : vrai
`index.html` lu par `readFileSync` + bout-en-bout DOM + `fetch` mocké sur le prompt réel) :

1. le champ existe dans la vraie page, avec son `maxlength` et son `oninput` (verrou d'écran) ;
2. bout en bout : frappe → `state.aiConfig.envie` → rechargement → champ re-rempli ;
3. consigne remplie → le message envoyé à l'IA porte la demande expresse **et** la phrase de
   priorité ;
4. consigne vide → le message ne contient **aucune** trace du bloc (non-régression stricte) ;
5. consigne faite d'espaces → traitée comme vide (SSOT `envieActive`) ;
6. le résumé sous le bouton affiche la consigne, et redevient exactement `Plat · 2 pers.`
   quand on l'efface ;
7. **`ai-envie` est dans `AI_FORM_FIELD_IDS`** — verrou du gap 1, puisque le test FV-3
   existant est écrit en dur sur un autre champ ;
8. **exceptions** : rempli → la sous-ligne apparaît dans le prompt ; vide → rien ; et
   **première couverture de `exclusions` dans le prompt** (gap 5), écrite au passage.

**`tests/_helpers/dom-helpers.js`** : ajout de `#ai-envie` + correction des deux `<textarea>`
menteurs en `<input class="ai-input" maxlength="…">` (gap 8).

**`PROJECT_MAP.md`** : entrée du nouveau fichier de test + révision des entrées touchées
(`aiPanel.js`, `settings.js`, `sync.js`, `helpers.js`, `gemini.test.js`).

## 7. CRITÈRES D'ACCEPTATION (posés AVANT implémentation)

- [x] **Le cas de Joel** : consigne « chili con carne » ⇒ le message réellement envoyé à l'IA
  exige que les **5** recettes y répondent, en le disant explicitement (pas « inspire-toi de »).
  Prouvé sur le corps réel de la requête (fetch mocké) ; mutation **M1** rouge.
- [x] **La hiérarchie est dans le message** : la consigne prime sur type de plat et cuisine,
  jamais sur les ingrédients imposés. Prouvé, y compris que la puce contredite part quand même
  telle quelle (on ne réécrit pas les réglages de Joel dans son dos).
- [x] **Non-régression stricte** : consigne vide ET exceptions vides ⇒ le prompt est
  **identique à celui d'aujourd'hui**, jointure vérifiée au caractère près. **Prouvé dans les
  deux sens** : mutations **M8/M9** (les blocs neufs s'invitent toujours) font rougir le test
  nommé — un ajout silencieux au message de tout le monde est impossible.
  **+ CONTRE-ÉPREUVE INDÉPENDANTE (2026-08-02)** : la version de `main` et celle de la branche
  ont été chargées **côte à côte** dans un même test temporaire et appelées sur les mêmes
  entrées (stock, épinglés, hors stock, régime, cuisine, exclusions, anti-répétition). Sans
  consigne : `expect(apres).toBe(avant)` — **égalité stricte des deux messages**. Avec
  consigne : différence confirmée. Ce n'est donc pas une relecture qui l'affirme, mais une
  comparaison exécutée. Fichiers temporaires supprimés après exécution.
- [x] La consigne survit au rechargement (M5 rouge) et n'est **pas écrasée** par une synchro
  qui arrive pendant la frappe — test de comportement réel dans `tests/sync-engine.test.js`,
  à côté de son jumeau FV-3 ; mutation **M4** rouge.
- [x] Le résumé sous le bouton montre la consigne active ; il redevient exactement
  `Plat · 2 pers.` une fois le champ vidé (M6 rouge).
- [x] « Exceptions autorisées » arrive dans le prompt — le champ cesse d'être décoratif
  (M2 rouge). **Première couverture d'`exclusions` dans le prompt** écrite au passage.
- [x] Validation unifiée verte : **types OK · 952/952 Vitest · 216/216 Pytest · build OK**
  (2026-08-02, après correctifs d'audit) + **preuve par retrait 13/13 rouges nommées, 0 nulle,
  témoin vert**.
- [x] **Vérification visuelle sur l'app lancée** (2026-08-02) : « Envie du moment » est bien le
  **premier** réglage (avant « Type de plat »), **hors accordéon replié** ; le rappel se met à
  jour à la frappe et affiche la consigne en vert ; une consigne de 62 caractères **reste sur
  une seule ligne** (14 px) grâce à la troncature posée sur le `span` seul.
- [ ] **Essai réel de Joel** avant publication (une génération avec « chili con carne »).

## 8. ÉCARTS DÉCLARÉS (rien de silencieux)

1. **`ai-exceptions` reçoit `maxlength="80"`** — il n'en avait aucun. Justification : son
   contenu part désormais dans un prompt. Ne tronque aucune valeur déjà enregistrée (le
   `maxlength` ne borne que la saisie).
2. **`updateAiCtaSummary` passe de privée à exportée**, et de `textContent` à
   `replaceChildren` quand une consigne est active. Le seul test existant du résumé
   (`tests/restore-ai-config.test.js`) reste vert **sans modification**.
3. **`tests/_helpers/dom-helpers.js` corrigé** : `ai-exceptions` et `ai-exclusions` y étaient
   déclarés `<textarea>` alors que la vraie page porte des `<input class="ai-input">`. Écart
   préexistant, invisible pour le garde-fou de fraîcheur (qui ne compare que les `id`).
   Corrigé plutôt que contourné — y ajouter un troisième champ en laissant deux mensonges à
   côté aurait été poser un piège en connaissance de cause.
4. **`.claude/launch.json` créé** (configuration du serveur de développement local) : outillage,
   aucun effet sur l'application publiée.
5. **Un push cloud supplémentaire au premier chargement** après déploiement, sur chaque
   appareil : la nouvelle clé enrichit le document synchronisé, donc son empreinte change.
   Bénin et attendu (précédents LOTS 010 et 022) — tracé, pas corrigé.

## 9. AUDIT DU DIFF FINAL — CODEX 5.6 SOL, 2026-08-02 : **GO AVEC RÉSERVES**

**Premier audit du projet lancé par Claude lui-même**, via `scripts/audit_bridge.py` (le pont
arrivé du projet jumeau ce même jour) — plus aucun copier-coller par Joel. Tour `VALID`,
fil `019fc2fa-1fc8-7163-9349-cd0331894512`, artefacts dans
`audits/bridge/lot28-envie-du-moment/1/`.

**Codex relève le niveau d'audit de Standard à Dur** de sa propre initiative, au motif que
`src/services/gemini.js` est une zone sensible déclarée et que les nouvelles valeurs
traversent des frontières externes persistées (cloud, fichier de sauvegarde). Acté.

**4 findings, aucun bloquant. LES QUATRE VÉRIFIÉS SUR PIÈCE ET RETENUS — aucun rejeté.**

| # | Finding | Verdict après vérification | Correctif |
|---|---|---|---|
| **F1** | `exceptions` non textuel plante la génération (`.trim` sur un objet) | **RÉEL, et c'est MOI qui ai créé l'exposition** : ce champ n'était jamais lu avant ce lot. J'avais donné la garde de type à `envie`, mais pas au champ que je venais de brancher | Garde de type remontée en SSOT partagée (`consigneLibre`) |
| **F2** | La borne de 100 car. ne protège que le clavier — ni le cloud ni une sauvegarde restaurée | **RÉEL.** 5 000 caractères suivis d'« ignore les contraintes » arrivaient **en tête** du message, sous le libellé de plus haute autorité | Borne appliquée **dans le code**, SSOT `MAX_ENVIE_CHARS`/`MAX_EXCEPTIONS_CHARS`, page et code verrouillés d'accord par test |
| **F3** | Le test de synchro dit « Joel tape » alors qu'il ne déclenche pas `input` : il prouve le filet DOM, pas le trajet d'une vraie frappe | **RÉEL — la critique porte sur MA qualification de la preuve, pas sur le code.** Une version « fidèle » serait protégée par l'empreinte du document et cesserait de verrouiller la liste | Test conservé (il est le seul verrou de la liste), **intitulé et commentaire rectifiés** pour dire exactement ce qu'il prouve |
| **F4** | Deux comptages faux dans mes documents de suivi (14 tests au lieu de 13 ; 16 Pytest au lieu de 216) | **RÉEL.** Même famille que les chiffres recopiés sans être remesurés des LOTS 017/018 | Chiffres remesurés et corrigés partout |

**Ce que Codex a explicitement validé** : la hiérarchie des consignes (cohérente avec la RÈGLE
D'OR, même vainqueur dans le cas frontal « envie contre ingrédient imposé »), le branchement
des exceptions au regard du pare-feu A/B (décision de Joel tracée, donc pas une modification
subreptice), l'absence de cycle d'import, l'absence d'effet de bord sur `updateAiCtaSummary`,
et la justesse de l'assertion `\n\n` échappée du test de non-régression. **Aucun faux verrou**
parmi les tests, mutation par mutation.

## 10. SUIVI

| Étape | État |
|---|---|
| Branche + fiche + suivi | ✅ 2026-08-02 |
| Phase découverte | ✅ 2026-08-02 — 14 ressources, 12 gaps (§5) |
| Spécification | ✅ 2026-08-02 (§6) |
| Implémentation + tests | ✅ 2026-08-02 — 1 champ HTML, 1 clé d'état, 1 SSOT (`consigneLibre`/`envieActive`), 2 blocs conditionnels de prompt ; `tests/envie-du-moment.test.js` (**17 tests**) + 1 test de synchro |
| **Audit du diff final** | ✅ 2026-08-02 — **Codex 5.6 Sol : GO AVEC RÉSERVES**, 4 findings, 4 confirmés, 4 corrigés (§9) |
| Preuve par retrait | ✅ 2026-08-02 — **13 mutations / 13 rouges nommées, 0 nulle, témoin vert** (9 sur la fonctionnalité, 4 sur les correctifs d'audit) |
| Validation unifiée | ✅ 2026-08-02 — **types OK · 952/952 Vitest · 216/216 Pytest · build OK** |
| Vérification visuelle | ✅ 2026-08-02 (§7) |
| Essai réel de Joel | ⏳ **seul point restant** |
| Publication | ⏳ |
