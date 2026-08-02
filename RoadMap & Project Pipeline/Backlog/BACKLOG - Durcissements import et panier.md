# BACKLOG — Durcissements import et panier (réserves non bloquantes de l'audit LOT 008)

> **Origine :** audit Dur du LOT 008 par Codex 5.6 (Sol), 2026-07-29, complété par les
> découvertes des LOTS 013 et 015. Findings tagués DURCISSEMENT, explicitement non
> bloquants — consignés ici plutôt que corrigés en passant (discipline `CLAUDE.md` §5 :
> pas de « correction en passant » hors spec).
> **Priorité :** basse.

## ⚑ ÉTAT AU 2026-08-02 — fiche re-vérifiée point par point dans le code

Cette fiche avait vieilli en silence : elle décrivait un code qui n'existe plus. **Toutes
ses références de ligne étaient fausses** (`js/app.js` est passé de 2 823 à 568 lignes entre
temps, et le CSS a été découpé en 13 sections). Cinq de ses points étaient déjà réglés sans
que personne ne l'y note.

**Ce qui reste ouvert : 4 points**, tous re-mesurés sur le code d'aujourd'hui.

| # | Sujet | Visible par Joel ? |
|---|---|---|
| 1 | L'import par nom peut confondre deux ingrédients homonymes | Non — conditionnel |
| 4b | Restauration hors ligne puis reconnexion : jamais testée | **Oui, si ça arrive** |
| 5c | Deux boutons inatteignables dans la fenêtre de recette | Non — code mort |
| 6 | 5 temporisations sans aucun test | Non |

**Ce qui est soldé** : §2 et §3 (articles libres), §4a, §5a, §5b, §9 — détail et preuves en
fin de fiche, conservés pour la trace (règle « rien ne se supprime »).

---

# POINTS OUVERTS

## 1. Ambiguïté de l'import par nom quand deux ingrédients partagent un nom

**Vérifié le 2026-08-02, toujours vivant : `src/actions.js:398`.**

`importStockOnly` replie sur `areSimilar` par nom seul quand l'identifiant d'une entrée du
fichier est inconnu. Or le catalogue contient légitimement deux « Haricot (rouge) » (sec
`pa7` / conserve `re_ing_17745578567330`) : une vieille sauvegarde dont les identifiants ont
changé pourrait appliquer le statut de la conserve au haricot sec.

- **Cas conditionnel** : ne se déclenche pas avec les fichiers actuels (identifiants
  concordants).
- **Piste** : préférer une correspondance de même catégorie quand plusieurs noms
  correspondent.
- ⚠️ **Attention, pare-feu A/B** : le monolithe (oracle, l.6517-6562) correspondait par nom
  seul — ce durcissement DÉPASSE l'oracle, c'est donc un changement de comportement à
  assumer explicitement, pas un portage.
- Ajouter un test avec deux ingrédients homonymes de catégories différentes.

## 4b. Restauration hors ligne puis reconnexion — aucun test

Signalé par l'audit Gemini du LOT 015 (2026-07-30), antérieur à ce lot et non aggravé par lui.
**Toujours ouvert au 2026-08-02.**

Restaurer une sauvegarde sans réseau planifie un envoi qui échoue. Il faut garantir qu'à la
reconnexion c'est bien l'état **restauré** qui part, et non l'ancien contenu du cloud qui
revient l'écraser. Le moteur du LOT 007 a une reprise sur échec, mais **ce scénario précis
n'est couvert par aucun test**.

C'est le seul point de cette fiche qui pourrait mordre pour de vrai : il se solderait par la
perte silencieuse d'une restauration.

## 5c. Le 3ᵉ pied de page du détail de recette est inatteignable

**Vérifié le 2026-08-02, toujours vivant : `src/ui/recipe.js:180-183`** (la fiche citait
`:173-176`, périmé).

La branche finale du pied de page — les boutons « 💾 Sauver » et « 🛒 + Liste » — couvre une
provenance différente de `ai` et `fav`. Or seules ces deux provenances sont produites. Ces
deux boutons ne peuvent donc jamais s'afficher.

Du ménage, aucun impact. **3 recherches convergentes obligatoires avant retrait**
(`CLAUDE.md` §5) : appel direct, accès dynamique, configuration.

## 6. Cinq temporisations ne sont couvertes par aucun test

**RE-MESURÉ INTÉGRALEMENT le 2026-08-02.** L'ancienne version annonçait « 20 temporisations,
11 couvertes, 9 ouvertes », avec des références toutes fausses (`js/app.js:941`, `:2135`,
`:2781`, `:113`, `:114` — ce fichier ne fait plus que 568 lignes). Comptage réel :
**16 sites**, dont **11 couverts** par un test qui avance vraiment l'horloge, et **5 non
couverts** :

| Délai | Où | Ce que ça fait |
|---|---|---|
| 10 ms | `src/utils/dom.js:50` | apparition en fondu d'un message |
| 3 000 ms | `src/utils/dom.js:51` | durée d'affichage d'un message |
| 300 ms | `src/utils/dom.js:53` | retrait du message après le fondu |
| 1 800 ms | `src/actions.js:230` | laisse lire l'erreur avant le rechargement, après un reset dont l'envoi cloud a échoué |
| 2 000 ms | `src/services/sync.js:131` (`SYNC_STATUS_RESET_MS`) | retour du voyant de synchro à « au repos » |

Les 11 autres sont couvertes (formulaire d'ajout, moteur de synchro, délai réseau Firebase,
lecture d'URL, anti-remplissage automatique, recherche temporisée, confort de génération,
retour auto après ajout). Vérification : 9 fichiers de tests utilisent l'horloge simulée ;
`SYNC_STATUS_RESET_MS` n'apparaît dans aucun test, et aucune durée de message non plus.

## 7 + 8. Le câblage du démarrage reste hors de portée des tests

`DOMContentLoaded` ne se déclenche jamais sous Vitest (`document.readyState === 'complete'`
avant l'import du module — vérifié en découverte du LOT 013). Conséquence : **l'ordre** dans
lequel le démarrage enchaîne ses initialisations n'est prouvable que par lecture ou preuve
navigateur. Les fonctions elles-mêmes sont testables une à une, c'est le câblage qui ne
l'est pas.

- **Partiellement soldé par le LOT 014 §F** : le verrou de parité `on*=` ↔ `window` s'exécute
  pour de vrai et attrape la panne la plus fréquente (un bouton qui n'appelle plus rien).
  L'ORDRE des opérations, lui, reste non prouvé.
- **Piste connue, non retenue jusqu'ici** : l'auditeur du LOT 013 a vérifié empiriquement que
  `window.dispatchEvent(new Event('DOMContentLoaded'))` déclenche bien le gestionnaire sous
  Vitest. Le blocage est ailleurs — le gestionnaire enchaîne une dizaine d'initialisations
  avec effets de bord réels (appels réseau, minuteries de synchro, écouteurs clavier). Les
  neutraliser pour isoler la seule question « le rendu local précède-t-il toute attente
  réseau » demande un vrai travail d'échafaudage.
- **À trancher un jour** : le faire, ou l'assumer comme angle mort documenté. En l'état,
  c'est un angle mort documenté.

---

# SOLDÉS — conservés pour la trace

## ✅ 2 et 3. Articles libres — SUPPRIMÉS (LOT 014 §G, publié en 5.10)

**Décision de Joel** (découverte du LOT 013) : les articles libres n'étaient ni voulus ni
utiles ; ils ont disparu au lieu d'être rebranchés. Les §2 et §3 décrivaient comment les
rebrancher — sans objet.

**Vérifié le 2026-08-02** : `customCartItems` n'existe plus que sous trois formes, toutes
délibérées — deux commentaires expliquant le retrait (`src/constants.js:38`,
`src/services/firebase.js:20`) et une ligne de nettoyage qui efface le champ d'un ancien
état (`src/state.js:200`).

## ✅ 4a. Divergence des articles libres entre deux appareils — TOMBE AVEC EUX

Le scénario supposait un `customCartItems` synchronisé. Il n'existe plus. Sans objet.

## ✅ 5a. La modale « ajout groupé » morte — RETIRÉE (LOT 014)

**Vérifié le 2026-08-02** : ni `#modal-shopping-bulk` ni `confirmBulkAdd` n'existent plus
dans `index.html` ou `js/app.js`. Retrait fait avec les 3 recherches convergentes.

## ✅ 5b. `sanitize()` sans appelant — SUPPRIMÉE (LOT 014)

**Vérifié le 2026-08-02** : plus aucune fonction `sanitize` exportée par
`src/utils/dom.js`.

## ✅ 9. Deux défauts de la déduction de catégorie — CORRIGÉS LE 2026-07-31

Trouvés par les **tests de caractérisation** écrits avant de déplacer `guessCategoryLocally`
et `sanitizeCategory` vers `src/utils/categorize.js`. D'abord **figés tels quels** le temps du
déplacement (un déménagement ne change pas de comportement), puis **corrigés sur décision de
Joel**, dans un commit séparé — pour qu'un problème sur la correction puisse se revert sans
défaire le rangement. Les deux tests « DÉFAUT CONNU » ont été **inversés** : ils verrouillent
maintenant la correction, avec un cas de non-régression chacun.

1. **Le repli « végétal » était au SINGULIER.** Une réponse d'IA au pluriel — « Produits
   végétaux », la formulation la plus naturelle en français — atterrissait dans le repli
   générique « Conserves & bocaux » (mauvais rayon dans la liste de courses).
2. **`sanitizeCategory` levait sur une catégorie non-chaîne.** Une IA renvoyant
   `{"category": 42}` faisait lever la fonction ; l'exception était avalée et Joel ne voyait
   **aucune erreur**, la suggestion disparaissait simplement.

---

## Traçabilité

- Audit source : NO-GO Codex 5.6 sur `f7d11ec`, corrigé en `2483c06` (les deux findings
  CRITIQUES — reset incomplet, export versionné — ont été traités ou levés par Joel ;
  cette fiche ne porte que les DURCISSEMENTS résiduels).
- Les deux autres durcissements du même audit ont été traités à la clôture du LOT 008 :
  test d'ordre push→reload durci (résolution prouvée, pas seulement l'invocation) ;
  `exportJSON` aligné sur l'oracle (`URL.revokeObjectURL` + toast « 💾 Export téléchargé »).
- **Nettoyage du 2026-08-02** : fiche re-vérifiée intégralement dans le code. 5 points passés
  en soldés avec leur preuve, les 4 restants re-mesurés et leurs références de ligne
  corrigées. Leçon consignée : une fiche de backlog qui cite des numéros de ligne se périme
  au premier rangement — **aucune citation ne vaut sans re-vérification**.
