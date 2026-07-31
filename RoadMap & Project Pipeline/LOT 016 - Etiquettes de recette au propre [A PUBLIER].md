# LOT 016 — Étiquettes de recette au propre — FICHE

> **Statut :** 🟡 A PUBLIER — ouvert et terminé le 2026-07-31
> **Branche :** `feat/lot16-etiquettes-recette-css` (ouverte depuis `main` après publication du 5.10)
> **Niveau d'audit : Léger** (nettoyage CSS ciblé, aucun changement de comportement)
> **Effort réel :** ~1 heure · **Version visée :** 5.10.1

---

## Origine

Point de sortie n°2 du LOT 014, laissé **volontairement ouvert** par Joel : « on regardera
après si on peut rendre ça propre sans tout casser ». L'audit DUR final avait repéré que
`.r-tag.red` et `.r-tag.green` semblaient dupliquées entre `05-ai.css` et `12-utilities.css`,
mais n'y avait pas touché : `.r-tag` figure sur la liste des classes « CSS REBRANCHÉ par la
campagne — interdiction de les traiter en CSS mort ».

---

## Ce que le diagnostic a réellement trouvé

L'hypothèse du LOT 014 (« la version de `05-ai.css` serait du CSS mort ») était **vraie pour
le vert, fausse pour le rouge**. C'est tout l'intérêt d'avoir rouvert le dossier au lieu
d'appliquer la conclusion précédente.

| Variante | Situation avant | Verdict |
|---|---|---|
| `.r-tag.green` | `background` + `color` dans `05-ai.css`, **toutes deux** réécrites par `12-utilities.css` | **100 % morte** — retrait sans effet |
| `.r-tag.red` | 5 propriétés dans `05-ai.css` ; `background`/`color`/`border` réécrites, mais `font-weight: 600` et `box-shadow` **survivaient** | **Partiellement vivante** — un retrait en bloc aurait changé l'écran |
| `.r-tag.orange` | définie une seule fois (`12-utilities.css`) | rien à faire |
| `.r-tag` (base) | `05-ai.css` + une définition **légitime** dans `@media print` | rien à faire |

**Conséquence visuelle mesurée** : l'étiquette d'un ingrédient manquant affiche un fond rose
pâle (voulu par `12-utilities.css`) portant le gras et l'ombre rouges dessinés pour un fond
rouge vif (rescapés de `05-ai.css`). **Personne n'a jamais choisi ce mélange** : c'est le
produit accidentel de deux intentions qui se sont télescopées dans le monolithe d'origine.

**Le doublon est hérité, pas introduit par le découpage** : il est présent tel quel dans
l'oracle `foodapp-v5-Joel.html` (l.1463 et l.3011).

---

## Décisions de Joel (2026-07-31)

1. **Garder l'aspect actuel** — on range le code, aucun pixel ne bouge. Les deux autres
   options (rétablir le rouge vif jamais appliqué, ou retirer gras et ombre pour harmoniser
   avec les étiquettes verte et orange) lui ont été présentées avec un aperçu ; il a choisi
   de ne rien changer à l'écran.
2. **Laisser `gold` et `terra`** — deux variantes qu'aucun écran de l'application ne produit
   jamais (vérifié : la seule source de la classe est `src/utils/stockMatch.js:75`, qui rend
   `red`/`green`/`orange`, plus `blue` en dur pour la nutrition). Elles restent, pour garder
   ce lot centré sur la seule vraie anomalie.

---

## Ce qui a été fait

- **`css/sections/05-ai.css`** : les deux blocs de variante retirés, remplacés par des
  commentaires qui expliquent où vit désormais la définition et **pourquoi** (piège de la
  cascade). La base `.r-tag` et la variante `blue` restent : elles n'ont jamais eu de doublon.
- **`css/sections/12-utilities.css`** : devient l'unique lieu de définition des variantes
  rouge / verte / orange. Les deux propriétés vivantes du doublon (`font-weight`,
  `box-shadow`) y sont rapatriées **à l'identique**.
- **`tests/css-sections.test.js`** : +6 tests. Chaque variante ne doit être définie qu'une
  fois hors `@media`, et l'étiquette rouge doit conserver le gras et l'ombre rapatriés.

---

## Preuves

**Pare-feu A/B — l'apparence calculée est inchangée.** Un vérificateur applique la vraie
règle de la cascade CSS (spécificité, puis ordre) sur la feuille **produite par le build**,
et rend les propriétés finales des 6 variantes. Comparaison avant / après : **identique**.

**La preuve sait échouer (contre-épreuve).** Une comparaison qui répond toujours
« identique » ne prouve rien. En retirant le `font-weight: 600` rapatrié, le vérificateur
signale bien l'écart (`600` → `500`). Il mesure donc ce qu'il prétend mesurer.

**Preuve par retrait du verrou — 4 mutations, 4 rouges, chacune sur un test NOMMÉ**
(règle durcie du LOT 014 : un code de sortie non nul ne vaut pas preuve), avec un **témoin
non muté resté vert** :

| Mutation | Test qui rougit |
|---|---|
| Remettre `.r-tag.green` en doublon dans `05-ai.css` | `.r-tag.green n'est défini qu'une seule fois…` |
| Remettre `.r-tag.red` en doublon dans `05-ai.css` | `.r-tag.red n'est défini qu'une seule fois…` |
| Perdre le `font-weight` rapatrié | `l'étiquette rouge conserve le gras et l'ombre…` |
| Perdre le `box-shadow` rapatrié | `l'étiquette rouge conserve le gras et l'ombre…` |

**Validation unifiée : 790/790 Vitest · 16/16 Pytest · build OK.**

---

## Points de vigilance laissés au dossier

- **Ne pas remonter le bloc de `12-utilities.css` vers `05-ai.css`** en croyant « regrouper
  proprement » : c'est sa position TARDIVE qui lui donne raison dans la cascade. Le
  commentaire posé sur place le dit.
- **`gold` et `terra` restent inutilisées** — sujet volontairement non tranché ici.
- **Piège d'outillage rencontré** : muter un fichier CSS via PowerShell
  (`Get-Content`/`Set-Content`) a corrompu ses accents (double encodage). Le harnais de
  mutation a été réécrit en Node avec lecture/écriture `utf8` explicites. À retenir pour
  tout futur harnais sur des fichiers accentués.
- **Second piège du même harnais** : les sections CSS sont en fins de ligne Windows. Une
  ancre de mutation écrite avec `\n` seul n'y trouve rien — la mutation n'est alors jamais
  appliquée et le test reste vert, ce qui se lit comme « le verrou ne voit rien ». Deux des
  quatre preuves ont d'abord échoué pour cette seule raison.
