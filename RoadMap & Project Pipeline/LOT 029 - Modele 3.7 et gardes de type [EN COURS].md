# LOT 029 — Modèle 3.7 et gardes de type `[EN COURS]`

**Ouvert le 2026-08-03** · Branche `feat/lot29-modele-37-et-gardes` (**chaînée sur
`feat/lot28-envie-du-moment`**, qui porte encore 2 commits non publiés — même procédé qu'aux
LOTS 016/017/018 et 025/026/027) · Niveau d'audit : **Standard** (`src/services/gemini.js` et
`src/state.js` sont des zones sensibles de `DOCTRINE_PRODUIT.md` §3, mais le lot n'ajoute
aucune fonctionnalité : il change un nom de modèle et pose des gardes défensives).

---

## 1. D'OÙ ÇA VIENT

**Trois demandes réunies en un seul lot** parce qu'elles touchent exactement la même zone
(`aiConfig` et le message envoyé à l'IA) et se valident ensemble :

1. **Joel, 2026-08-03** : « je pense que 3.7 flash est dispo… vérifie ». **Vérifié : c'est
   exact.** `gemini-3.7-flash` est sorti en août 2026, il est **stable**, au **même prix** que
   le modèle actuel (0,75 $ / 3,75 $ par million de jetons), **gratuit** sur l'offre utilisée,
   et il **supporte le mode réflexion `high`** dont la génération de recettes dépend.
2. **F-011** (registre technique) : `aiConfig.diet` n'a pas la garde de type que `cuisines` a.
3. **F-012** (registre technique, né de l'audit Codex du LOT 028) : `aiConfig.exclusions` est
   le dernier champ libre envoyé à l'IA sans garde de type ni borne de longueur.

Décision de Joel du 2026-08-03 : « ouvre le lot avec F-011 et F-012 ».

## 2. CE QUE ÇA CHANGE POUR JOEL

- **Les recettes, la nutrition et l'import de recettes** seront écrits par un modèle plus
  récent, présenté par Google comme meilleur sur le suivi d'instructions complexes — ce qu'on
  lui demande précisément (8 contraintes numérotées, dont « l'envie du moment » qui doit primer
  sur les autres). **Aucun changement d'écran, aucun changement de prix.**
- **Les catégories et emojis** ne changent pas de modèle : `gemini-3.5-flash-lite` reste le
  plus récent des « lite » et coûte moitié moins cher.
- **Rien de visible pour les gardes de type** : elles ne se déclenchent que sur des données
  déjà abîmées. Leur bénéfice est de transformer un plantage en non-événement.

## 3. PHASE DÉCOUVERTE (2026-08-03)

⚠️ **Menée directement, sans agent Explore** — écart déclaré à `CLAUDE.md` §3. Motif : la zone
(`aiConfig`, modèles IA, construction du prompt) a été cartographiée intégralement les 2 et
3 août par les découvertes des LOTS 027 et 028, et par l'audit Codex du LOT 028 qui a remonté
tous les chemins externes. Sept vérifications ciblées ont été refaites sur pièce, listées
ci-dessous.

### 3.1 Le circuit du modèle — entièrement générique, une seule ligne à changer

- **SSOT** : `AI_ROLES` (`src/constants.js:8-11`), deux valeurs.
- **Réimposé à CHAQUE chargement** : `sanitizeGlobalState` fait
  `state.aiConfig.models = defaultAiModels()` (`src/state.js:265`) — c'est le correctif de
  l'**incident `gemini-2.0-flash` du 28/07/2026**, où un modèle hors service stocké en
  localStorage puis republié au cloud avait cassé toutes les fonctions IA. Ce filet reste en
  place et protège aussi ce lot.
- **Neuf sites de lecture**, tous avec repli sur `AI_ROLES` : `gemini.js:81/304/378`,
  `addForm.js:225/383`, `emojiModal.js:140`, `pasteRecipe.js:241`, `recipeModal.js:118`,
  `settings.js:115` (affichage en lecture seule).
- **Le document cloud ne transporte PAS les modèles** (`firebase.js:90`, verrouillé par
  `tests/sync-scope.test.js:55`) : un appareil resté sur l'ancienne version ne peut pas
  réinjecter l'ancien modèle.

➜ **Changer `AI_ROLES.REASONING` suffit.** Aucune migration de données, aucun autre fichier.

### 3.2 ⚠️ F-011 EST PLUS LARGE QUE CE QUE LE REGISTRE ANNONÇAIT

Le registre ne parle que de `diet`. **La vérification sur pièce en trouve un second, et son
défaut est plus sournois** :

| Champ tableau | Garde ? | Ce qui se passe si la valeur est une chaîne corrompue |
|---|---|---|
| `cuisines` | ✅ `state.js:287` | Rien, la garde le remet en tableau |
| `diet` | ❌ | **Plante** au `.join(', ')` de `gemini.js:209` |
| `equip` | ❌ | **Plante** au `.map()` de `gemini.js:213` — mais **plus tard** : la ligne teste d'abord `cfgEquip.includes('Poêles')`, or **une chaîne possède aussi `.includes`**, donc le test réussit au lieu d'échouer et le plantage survient à la ligne suivante |

Le cas `equip` est exactement le genre de défaut qu'une lecture rapide manque : la garde
apparente (`includes`) n'en est pas une, parce qu'elle est vraie pour les deux types.

### 3.3 F-012 confirmé, et sans risque de plantage

`gemini.js:285` interpole `${aiConfig.exclusions || 'rien'}` **brut**. Une valeur non textuelle
ne plante pas (l'interpolation rend `[object Object]`) mais part telle quelle dans le message,
et une valeur démesurée n'est bornée par rien. C'est le dernier des trois champs libres à ne
pas passer par `consigneLibre` — `envie` et `exceptions` y sont passés au LOT 028.

### 3.4 Les tests suivent le changement de modèle… sauf un

- `tests/ai-models-info.test.js` référence les modèles **symboliquement** (`AI_ROLES.REASONING`
  / `.FAST`, lignes 47-48, 56, 71) : ces assertions suivront automatiquement.
- **SAUF les lignes 35-36**, qui écrivent les noms EN DUR dans une assertion négative
  (`not.toContain('gemini-3.6-flash')`). Après le changement, elles resteraient **vertes en ne
  vérifiant plus rien** — le pire état pour un test : vivant, rassurant, inutile. Son intention
  (« aucun nom de modèle en dur dans le HTML ») doit être réécrite symboliquement.
- **Commentaire à corriger** : `gemini.js:97-98` nomme « `gemini-3.6-flash`,
  `gemini-3.5-flash-lite` — les deux seuls modèles utilisés par ce projet ». Laissé tel quel,
  il devient faux le jour même.

### 3.5 ⚠️ AUCUN TEST NE VERROUILLE LA VALEUR DES MODÈLES — et c'est volontaire

Aucun test n'assert que `AI_ROLES.REASONING === 'gemini-3.x-flash'`. **Le changement de modèle
est donc totalement invisible pour la suite de tests** : elle restera verte quoi qu'on écrive,
y compris un nom de modèle inexistant. C'est cohérent (un test qui recopie la SSOT ne prouve
rien), mais il faut en tirer la conséquence : **la seule preuve possible que le nouveau modèle
fonctionne est un essai réel de Joel.** Ce lot ne peut pas être publié sans.

## 4. SPÉCIFICATION

### Chantier A — Le modèle de raisonnement passe en 3.7

1. `src/constants.js` : `REASONING: 'gemini-3.6-flash'` → `'gemini-3.7-flash'`. **Une ligne.**
   `FAST` ne bouge pas.
2. `src/services/gemini.js:97-98` : commentaire mis à jour (les paramètres `temperature`/
   `topK`/`topP` restent ignorés par toute la génération 3.x — à re-vérifier, pas à supposer).
3. `tests/ai-models-info.test.js:35-36` : assertions réécrites sur `AI_ROLES`, pour qu'elles
   continuent de mordre après tout changement futur de modèle.

### Chantier B — F-011 : gardes de type sur les champs tableau d'`aiConfig`

Dans `sanitizeGlobalState` (`src/state.js`), aligner `diet` et `equip` sur la garde existante
de `cuisines` — **même formulation, à la suite, pour qu'on voie d'un coup d'œil que les trois
sont traités pareil**. Pas de garde générique par boucle : la liste explicite se relit, et un
champ tableau ajouté demain devra être ajouté ici consciemment.

### Chantier C — F-012 : `exclusions` rejoint les deux autres champs libres

1. `src/constants.js` : `MAX_EXCLUSIONS_CHARS = 80` (aligné sur le `maxlength` de la page).
2. `src/services/gemini.js:285` : `consigneLibre(aiConfig.exclusions, MAX_EXCLUSIONS_CHARS)`.
3. Le repli `'rien'` est **conservé** : c'est le texte que le modèle lit depuis l'origine, il
   n'a aucune raison de changer.

### Chantier D — LA PANNE RÉELLE DE JOEL (extension de périmètre, autorisée le 2026-08-03)

**Signalée en cours de lot** : « j'ai quand même ce message la plupart du temps avec les envies
du moment » — capture à l'appui : « Erreur IA : Réponse incomplète ou illisible. Réessayez ».
Extension de périmètre **annoncée à Joel et autorisée par lui** (« oui, fais le chantier D »),
pas glissée en douce.

**Diagnostic (posé sur le code, pas supposé)** : une « envie du moment » demande **5 variantes
d'un même plat**, chacune avec les étapes détaillées exigées depuis le LOT 026 — bien plus de
texte que 5 plats différents. Le plafond de sortie (16 384) est **partagé avec les jetons de
réflexion** (`thinkingLevel: 'high'`). La réponse est coupée en plein vol ; le sauvetage
récupère les recettes complètes, mais quand la coupure tombe dans la **première**, il n'y a
rien à sauver. **C'est la DEUXIÈME sous-estimation du même plafond** (LOT 026 : 8 192 → 16 384,
déjà après une panne réelle de Joel).

**Aggravant trouvé au passage** : l'app **ne lisait jamais** le motif d'arrêt renvoyé par Google
(`finishReason`). Elle ne pouvait donc pas distinguer « réponse coupée » de « réponse
illisible », et conseillait « réessayez » dans les deux cas — conseil **faux** sur une
troncature, dont la cause est structurelle et se reproduit à l'identique.

**Correctifs** :
1. `MAX_OUTPUT_TOKENS_IA = 65536` (SSOT `src/constants.js`) — le **maximum accepté par
   `gemini-3.7-flash`, vérifié sur la documentation Google**. Confirmé par Joel : « je pense
   que le nouveau gemini 3.7 accepte plus ». Aucun surcoût : on paie les jetons produits, pas
   le plafond. Les **deux** appels (génération et recette collée) pointent sur la SSOT.
2. `callAI` lit `finishReason === 'MAX_TOKENS'` et le signale par un rappel `onTruncated`,
   sur le modèle d'`onThinkingFallback` déjà en place.
3. **Deux pannes, deux messages** : une réponse coupée dit qu'elle a été coupée et oriente vers
   le bon geste (raccourcir la demande) ; une réponse illisible garde le message du LOT 026.
4. **Le sauvetage garde la priorité** : une coupure APRÈS une recette complète rend cette
   recette plutôt qu'une erreur — mieux vaut une recette que zéro.

**Deux tests du LOT 026 ont rougi, et c'était leur travail** : ils figeaient `16384` au chiffre
près. Réécrits sur la SSOT, ils vérifient désormais ce qui compte (le service n'invente pas son
plafond) et survivront au prochain relèvement. Le **verrou de non-retour** sous 16 384 vit dans
`tests/reponse-tronquee.test.js`.

### Ce que ce lot NE fait PAS

- **Aucune autre garde de type** (`meal`, `time`, `diff`, `ppl`, `creativity`) : aucune ne peut
  planter (interpolations et comparaisons). Les ajouter serait du durcissement spéculatif.
- **Aucun changement de prompt** hors la borne d'`exclusions`.
- **Aucun changement d'écran.**

## 5. CRITÈRES D'ACCEPTATION (posés AVANT implémentation)

- [ ] `gemini-3.7-flash` est le modèle utilisé pour recettes, nutrition et import ; `FAST`
  inchangé ; **aucun nom de modèle écrit ailleurs que dans la SSOT**.
- [ ] L'écran Réglages affiche le nouveau modèle sans qu'une ligne d'affichage ait été touchée
  (preuve que la SSOT tient).
- [ ] Un `diet` ou un `equip` corrompu en chaîne **ne fait plus échouer la génération** —
  prouvé par un test qui plantait avant le correctif.
- [ ] Un `exclusions` non textuel ou démesuré est neutralisé comme `envie` et `exceptions`.
- [ ] Le test « aucun nom de modèle en dur dans le HTML » **mord encore** après le changement
  (vérifié par mutation, pas par lecture).
- [ ] Validation unifiée verte + preuve par retrait : une mutation rouge nommée par garde posée.
- [ ] **Essai réel de Joel OBLIGATOIRE avant publication** (cf. §3.5 : aucun test ne peut
  prouver que le nouveau modèle répond bien) — générer 5 idées, dont une avec une « envie du
  moment », et confirmer que la qualité tient.

## 6. SUIVI

| Étape | État |
|---|---|
| Branche + fiche + suivi | ✅ 2026-08-03 |
| Phase découverte | ✅ 2026-08-03 — 7 vérifications, dont l'élargissement de F-011 à `equip` (§3.2) et l'angle mort du §3.5 |
| Chantier A — modèle 3.7 | ✅ 2026-08-03 — une ligne dans la SSOT ; commentaire périmé et test à nom en dur corrigés |
| Chantier B — F-011 | ✅ 2026-08-03 — `listeSure` (SSOT) sur les 3 champs tableau, aux DEUX étages (assainissement + lecture du prompt) |
| Chantier C — F-012 | ✅ 2026-08-03 — `exclusions` rejoint `envie` et `exceptions` |
| Chantier D — réponse coupée | ✅ 2026-08-03 — plafond en SSOT à 65 536, motif d'arrêt lu, deux messages distincts, sauvetage prioritaire |
| Preuve par retrait | ✅ 2026-08-03 — **8 mutations / 8 rouges nommées, 0 nulle**, témoin vert |
| Validation unifiée | ✅ 2026-08-03 — **972/972 Vitest · 216/216 Pytest · types OK · build OK** |
| Essai réel du modèle 3.7 | ✅ 2026-08-03 — « j'ai testé, ça marche » (criticité §3.5 levée) |
| Audit du diff final | ⏳ |
| Essai réel du chantier D | ⏳ **bloquant** — regénérer avec une envie du moment, le message ne doit plus tomber |
| Publication | ⏳ |
