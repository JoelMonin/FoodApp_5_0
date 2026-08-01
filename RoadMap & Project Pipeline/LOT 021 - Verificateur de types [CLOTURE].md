# LOT 021 — Le vérificateur de types — FICHE

> **Statut :** ✅ CLOTURE — publié en **Version 5.14** le 2026-08-01, avec les LOTS 022, 023
> et 024. Ouvert et terminé le même jour.
> **Branche :** `feat/lot21-verificateur-de-types` (depuis `main`, V5.13 publiée)
> **Niveau d'audit : Léger** — outillage pur, zéro changement de comportement (825 tests
> identiques avant et après), pare-feu A/B respecté à la lettre
> **Version visée :** 5.14
> **Origine :** évaluation de la qualité du code demandée par Joel le 2026-08-01. Diagnostic :
> « la qualité vient de la méthode, pas de l'outillage — il n'y a aucun garde-fou technique ».
> Chantier n°1 des quatre qu'il a validés.

---

## 1. Pourquoi ce lot

**Le motif est un incident réel, pas une préférence de style.** Au LOT 017, `js/app.js` a
importé pendant **cinq volets** deux fonctions qui n'existaient plus dans leurs modules,
**avec 798 tests verts**. Vitest résout les modules à la demande et n'a jamais rien vu ; la
construction de production, elle, échouait net. La branche était impubliable et **rien ne le
disait**.

La construction a été ajoutée à la validation à ce moment-là — mais elle n'attrape le défaut
qu'à la toute fin. Un vérificateur de types le voit **immédiatement**.

---

## 2. Ce qui a été mis en place

| Fichier | Rôle |
|---|---|
| `jsconfig.json` | La configuration. `checkJs: true`, `strict: false` — la cible, ce sont les fautes FACTUELLES, pas une migration de langage. |
| `types/app-dom.d.ts` | Trois ajustements décrivant des réalités du navigateur absentes de la bibliothèque standard. **Aucun code, rien n'est exécuté.** |
| `validate.bat` / `npm run check` | Le vérificateur devient l'**étape 1 sur 4**, placée en tête parce qu'elle est la plus rapide (**1,2 s**) et la plus précoce. |
| `typescript` | Ajouté aux outils de développement. **La règle « zéro dépendance » de l'application est intacte** : rien n'est livré au navigateur. |

---

## 3. Le résultat : 128 → 0

**128 signalements au premier passage. Zéro à la fin. Aucun changement de comportement.**

**87 des 128 (68 %) avaient UNE SEULE cause** : la bibliothèque standard décrit
`document.getElementById()` comme rendant un élément *générique*, sans `.value` (53 cas),
`.disabled` (16), `.checked` (5). Une déclaration de trois lignes les a tous éteints.

> **Choix assumé** : la déclaration annonce un *champ de saisie* (`HTMLInputElement`) et non
> `any`. `any` aurait fait taire le vérificateur pour de bon, **y compris sur une faute de
> frappe**. Là, `.valeu` reste détecté. Ce qu'on perd — « ce div n'a pas de `.value` » —
> n'était pas la cible.

**Le reste, groupe par groupe :**

| Cause | Nb | Traitement |
|---|---|---|
| Options de `callAI` non documentées | 14 | **Vrai défaut de documentation** — voir §4 |
| Béquilles annonçant « aucun argument » | 6 | **Vrai défaut de contrat** — voir §4 |
| Listes d'éléments (`querySelectorAll`) | 8 | Même déclaration que ci-dessus |
| Plein écran des vieux navigateurs | 6 | Vraies fonctions de vrais navigateurs, déclarées |
| Conversions implicites (nombre → texte) | 9 | `String(...)` explicite — le navigateur faisait déjà la conversion, comportement identique |
| `.cancel()` du temporisateur | 2 | **Vrai défaut d'annotation** — voir §4 |
| Divers (lecture de fichier, focus, cases) | 5 | Annotations locales |
| Configuration IA incomplète | 1 | **Vrai constat, NON corrigé** — voir §5 |

---

## 4. Trois vrais défauts trouvés — qu'aucun test ne pouvait voir

1. **`callAI` documentait 3 options sur 9.** Le corps de la fonction lisait `maxTokens`,
   `isJSON`, `temperature`, `topK`, `topP` et `schema` ; le contrat d'entrée les passait sous
   silence. C'est l'écart typique entre ce qu'un code **fait** et ce qu'il **annonce** —
   invisible aux tests, qui vérifient le faire.
2. **Les trois béquilles mentaient sur leur signature.** Leur objet de contrat, censé se lire
   d'un coup d'œil, déclarait des fonctions **sans aucun paramètre** alors que les appelants
   leur en passent un à trois. En les nommant, une erreur **nouvelle** est apparue — et elle
   venait de MOI : j'avais annoté `buildRecipeHandlers(recette, index, source)` alors que le
   vrai ordre est `(recette, source, favId)`. **Le vérificateur a corrigé le correcteur.**
3. **`debounce` annonçait un simple `Function`** alors que la phrase juste à côté disait
   « dotée d'une méthode `.cancel()` ». **La prose savait, l'annotation non** — et un outil ne
   lit que l'annotation. Illustration directe du chantier n°2 (dette des commentaires).

---

## 5. Un constat signalé, délibérément NON corrigé

`src/state.js` fabrique une configuration IA **à la main** (`{ apiKey: '' }`) alors que
`defaultAiConfig()` existe vingt lignes plus haut et est la source de vérité. Une
configuration reconstruite par ce chemin n'a **ni régime, ni cuisines, ni créativité**.
L'application tient debout parce que chaque lecteur a son propre repli (`?? 50`), mais c'est
une entorse à la règle « un paramètre, une seule représentation ».

**Pourquoi on n'y touche pas** : corriger changerait le comportement. Le pare-feu A/B veut que
ça sorte d'un lot d'outillage et devienne une décision de Joel. Le constat est écrit **dans le
code**, à l'endroit exact, pas seulement ici.

---

## 6. La preuve — le LOT 017 rejoué

**Attendu écrit AVANT exécution** : en important une fonction inexistante, le vérificateur
doit signaler « n'exporte pas ce membre », et Vitest doit rester **vert**.

**Résultat :**
```
js/app.js(161,30): error TS2305: Module '"../src/ui/shopping.js"'
                   has no exported member 'fonctionQuiNExistePas'.
Vitest : Tests  20 passed (20)
```

**L'incident du LOT 017 est reproduit à l'identique, et désormais attrapé en 1,2 seconde.**
Les tests, eux, restent aveugles — c'est structurel, pas un manque de tests.

---

## 7. Ce qu'on n'a PAS fait

- **Aucune conversion en TypeScript.** Le projet reste du JavaScript ; l'outil ne fait que le
  relire.
- **Aucun durcissement (`strict`).** Il noierait les vraies fautes sous des milliers de
  remarques. À décider plus tard, sur mesure.
- **Les tests ne sont pas vérifiés** (`include` couvre `src/` et `js/`). Les y ajouter
  demanderait de déclarer les outils de test ; gain faible, bruit certain.
- **Aucune correction de comportement** — les trois défauts du §4 sont des corrections de
  *documentation* et de *déclaration*. Le constat du §5 attend une décision.
