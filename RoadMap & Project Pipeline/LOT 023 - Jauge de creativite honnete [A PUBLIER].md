# LOT 023 — La jauge de créativité ne ment plus — FICHE

> **Statut :** 🟡 A PUBLIER — ouvert et terminé le 2026-08-01
> **Branche :** `feat/lot23-jauge-creativite`
> **Niveau d'audit : Standard** — changement d'écran, zéro changement de la consigne envoyée
> à l'IA (verrouillé par les tests existants du LOT 011, inchangés)
> **Version visée :** 5.14, avec les LOTS 021 et 022
> **Origine :** ressenti de Joel (« on a bricolé un truc, je pense qu'on peut faire mieux »)

---

## 1. Le défaut

**Le curseur avait 101 positions et ne produisait que 3 résultats.**

```
curseur   0 → CLASSIQUE        curseur  34 → ÉQUILIBRÉE
curseur  33 → CLASSIQUE        curseur  66 → ÉQUILIBRÉE
                                curseur  67 → TRÈS CRÉATIF
```

Glisser de 0 à 33 ne changeait rien. Glisser de 33 à 34 changeait tout. Et **rien à l'écran
n'indiquait de quel côté de la bascule on se trouvait** — les trois libellés sous le curseur
étaient figés depuis toujours, aucun ne s'allumait.

**Origine du bricolage, datée** : le curseur pilotait à l'origine la « température » du
modèle IA — un réglage réellement continu. Au LOT 011, Gemini 3.x a rendu ce mécanisme inerte
et il a été remplacé par une consigne textuelle à 3 paliers. **Le curseur, lui, est resté**,
seul vestige d'un moteur qui n'existe plus — c'est le seul curseur de tout l'écran IA, les
sept autres réglages sont tous des puces à choix.

---

## 2. Décisions de Joel (2026-08-01)

- **Le problème identifié : « le réglage est faux »** (pas « ça ne change rien aux
  recettes » — donc la consigne envoyée à l'IA n'était PAS en cause).
- **La forme retenue : garder le geste du curseur**, avec 3 crans fermes et le palier actif
  mis en évidence — pas un remplacement par des puces.

---

## 3. Le correctif

**Le curseur (`index.html`)** reçoit `step="50"` : min 0, max 100, seuls 0/50/100 sont
atteignables au glisser. Trois arrêts francs, plus aucune position ambiguë.

**Le libellé actif se met en évidence** (`.creativity-labels .active`, vert et gras) —
recalculé à la restauration du panneau (`restoreAIConfig`) et à **chaque geste** de
l'utilisateur (`saveAiConfigFromUI`, appelée par `oninput`) : la mise en évidence suit le
doigt pendant le glisser, pas seulement à la réouverture.

**SSOT du seuillage** : le calcul « quel palier pour quelle valeur » vivait, dupliqué en
silence, uniquement dans la consigne envoyée à l'IA. Il est extrait dans
`creativityLevel()` (`src/utils/helpers.js`), utilisé par les DEUX consommateurs — la
consigne IA (`creativityInstruction`, `src/services/gemini.js`) et la mise en évidence à
l'écran (`src/ui/aiPanel.js`) — sans en changer les seuils (`<=33` / `<=66` / le reste,
identiques depuis le LOT 011).

**Ce qui NE change PAS, et c'est vérifié** : les trois phrases envoyées à l'IA
(« Reste CLASSIQUE… », « Vise un bon ÉQUILIBRE… », « Sois TRÈS CRÉATIF… ») sont
**inchangées au mot près** — les tests `tests/gemini.test.js` qui les verrouillent depuis
le LOT 011 passent sans aucune modification.

**Le cas des valeurs héritées** (ancienne sauvegarde continue, ou le tirage aléatoire
80-100 du bouton 🎲) : `restoreAIConfig` affiche le curseur sur le **cran le plus proche**
de la valeur réelle — jamais entre deux arrêts — sans jamais modifier
`state.aiConfig.creativity` lui-même. L'affichage est arrondi, la donnée garde sa
précision d'origine.

---

## 4. Ce qui n'a pas bougé, volontairement

- **Le modèle de données** reste un nombre 0-100 (`state.aiConfig.creativity`), pas une
  énumération à 3 valeurs. Cause : plusieurs tests existants (LOT 017, LOT 019) utilisent
  des valeurs arbitraires (42, 87…) pour prouver que la donnée transite sans jamais être
  contrainte aux seules valeurs 0/50/100 — resserrer le modèle aurait élargi le lot bien
  au-delà de la jauge elle-même.
- **Le bouton 🎲 (`generateRandomWithStock`)** continue de tirer un nombre entre 80 et 100 :
  il retombe dans le même palier « créatif » quel que soit le tirage exact, donc son
  comportement observable est inchangé.
- **`areSimilar`, `normalizeString`, tout le reste de l'IA** : hors périmètre.

---

## 5. Validation

**Types OK · Vitest OK · Pytest OK · build OK.** 17 tests neufs — 5 sur le SSOT du
seuillage (`tests/creativity-level.test.js`), 7 sur la mise en évidence à l'écran
(`tests/creativity-slider-ui.test.js`, dont le cas de la valeur héritée et le geste en
direct) — et zéro modification des tests qui verrouillent la consigne IA.
