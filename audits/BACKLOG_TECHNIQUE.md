# 🧾 BACKLOG TECHNIQUE — registre des dettes et findings d'audit

> **Créé le 2026-08-02.** Ce registre était réclamé par l'étape 5bis du démarrage de session
> (`/init`) depuis sa création, mais **n'avait jamais existé** (vérifié : aucune trace dans
> tout l'historique git). Les findings vivaient éparpillés dans les fiches de backlog, où ils
> se sont périmés en silence — c'est exactement ce que ce fichier existe pour empêcher.

## À quoi sert ce fichier

**Un finding technique n'a qu'UN seul domicile : ici.** C'est la règle SSOT (`CLAUDE.md` §6)
appliquée au suivi de la dette.

| Ce qui va ICI | Ce qui va AILLEURS |
|---|---|
| Un défaut ponctuel trouvé par un audit ou une découverte | Un **chantier** (plusieurs jours, un plan, une valeur produit) → fiche `RoadMap & Project Pipeline/Backlog/` |
| Un angle mort de test | Un lot en cours → fiche `LOT NNN - … .md` |
| Une dette assumée, avec son motif | Une livraison → `SHIP_LOG.md` |

**Frontière avec le backlog produit**, pour ne pas se poser la question deux fois :
l'accessibilité est un **chantier** (1-2 jours, plan rédigé, bénéfice visible par Joel), pas
un finding — elle reste dans
`RoadMap & Project Pipeline/Backlog/BACKLOG - Accessibilite et animations.md`.

## Règles de tenue

1. **Numéro attribué à l'ouverture, jamais modifié** (`F-NNN`), même après traitement.
2. **Date d'origine obligatoire** — c'est elle qui permet au démarrage de session de repérer
   ce qui traîne depuis plus d'un mois.
3. **Rien ne se supprime.** Un finding traité descend dans la section « traités / écartés »
   avec sa **preuve** ; un finding écarté y descend avec son **motif**.
4. **Un finding traité doit le PROUVER** : titre marqué `TRAITÉ` ou `ÉCARTÉ`, et une phrase
   qui dit ce qui a été vérifié, où, et quand. Un texte au conditionnel (« si on traite… »)
   n'est pas un traitement — c'est un finding ouvert mal rangé.
5. **Aucune citation de ligne ne vaut sans re-vérification.** Leçon du nettoyage du
   2026-08-02 : toutes les références de l'ancien backlog étaient fausses après un simple
   rangement de fichiers.

---

# Findings actifs

### [F-001] L'import par nom peut confondre deux ingrédients homonymes

- **Origine** : audit Dur du LOT 008 (Codex 5.6), 2026-07-29 — tagué DURCISSEMENT, non bloquant.
- **Gravité** : basse — conditionnel, ne se déclenche pas avec les fichiers actuels.
- **Où** : `src/actions.js:398` (`importStockOnly`) — **vérifié sur pièce le 2026-08-02**.
- **Le défaut** : quand l'identifiant d'une entrée du fichier de sauvegarde est inconnu, la
  fonction retombe sur une correspondance **par nom seul** (`areSimilar`). Or le catalogue
  contient légitimement deux « Haricot (rouge) » — le sec (`pa7`) et la conserve
  (`re_ing_17745578567330`). Une vieille sauvegarde dont les identifiants ont changé peut
  donc appliquer l'état de l'un à l'autre.
- **Piste** : préférer une correspondance de même catégorie quand plusieurs noms
  correspondent. Ajouter un test avec deux homonymes de catégories différentes.
- ⚠️ **Pare-feu A/B** : le monolithe (oracle l.6517-6562) correspondait par nom seul. Ce
  durcissement **dépasse l'oracle** — c'est un changement de comportement à faire valider,
  pas un portage.

### [F-002] Restauration hors ligne puis reconnexion : jamais testée (moteur de synchro)

- **Origine** : audit Gemini du LOT 015, 2026-07-30 — antérieur à ce lot, non aggravé par lui.
- **Gravité** : **la plus élevée du registre** — perte de données silencieuse si le scénario
  se réalise.
- **Où** : moteur de synchro, `src/services/sync.js` (reprise sur échec du LOT 007).
- **Le défaut** : restaurer une sauvegarde sans réseau planifie un envoi qui échoue. Rien ne
  garantit qu'à la reconnexion c'est bien l'état **restauré** qui part, et non l'ancien
  contenu du cloud qui revient l'écraser. La reprise sur échec existe, **ce scénario précis
  n'est couvert par aucun test**.
- **Ce que Joel verrait** : un message de restauration réussie, puis ses données d'avant qui
  reviennent toutes seules quelques instants plus tard. Sans aucun avertissement.
- **Piste** : test d'intégration — restauration avec `fetch` en échec, puis reconnexion, et
  vérifier le contenu réellement envoyé. Le LOT 015 a déjà fermé un trou voisin (la barrière
  de quiescence) : sa mécanique de test sert de modèle.

### [F-003] Deux boutons inatteignables dans le pied de page du détail de recette

- **Origine** : découverte du LOT 013, 2026-07-30.
- **Gravité** : nulle pour l'usage — code mort, aucun impact visible.
- **Où** : `src/ui/recipe.js:180-183` — **re-localisé le 2026-08-02** (l'ancienne fiche citait
  `:173-176`, périmé).
- **Le défaut** : la branche finale du pied de page (« 💾 Sauver » / « 🛒 + Liste ») couvre une
  provenance autre que `ai` et `fav`. Or seules ces deux provenances sont jamais produites.
  Ces boutons ne peuvent donc pas s'afficher.
- **Piste** : retrait, avec les **3 recherches convergentes** obligatoires (`CLAUDE.md` §5) —
  appel direct, accès dynamique, configuration.

### [F-004] Cinq temporisations ne sont couvertes par aucun test

- **Origine** : découverte du LOT 013, 2026-07-30. **Intégralement re-mesuré le 2026-08-02**
  (le compte précédent, « 9 sur 20 », portait sur un code qui n'existe plus).
- **Gravité** : basse — angle mort de test, pas un défaut constaté.
- **Compte réel** : **16 sites de temporisation, 11 couverts** par un test qui avance
  vraiment l'horloge, **5 non couverts** :

| Délai | Où | Ce que ça fait |
|---|---|---|
| 10 ms | `src/utils/dom.js:50` | apparition en fondu d'un message |
| 3 000 ms | `src/utils/dom.js:51` | durée d'affichage d'un message |
| 300 ms | `src/utils/dom.js:53` | retrait du message après le fondu |
| 1 800 ms | `src/actions.js:230` | laisse lire l'erreur avant le rechargement, après un reset dont l'envoi cloud a échoué |
| 2 000 ms | `src/services/sync.js:131` (`SYNC_STATUS_RESET_MS`) | retour du voyant de synchro à « au repos » |

- **Méthode de vérification (2026-08-02)** : 9 fichiers de tests utilisent l'horloge simulée ;
  `SYNC_STATUS_RESET_MS` n'apparaît dans aucun test, et aucune durée de message non plus.

### [F-005] Le câblage du démarrage reste hors de portée des tests

- **Origine** : découverte du LOT 013, 2026-07-30. **Partiellement traité** par le LOT 014 §F.
- **Gravité** : basse — angle mort documenté, assumé.
- **Le défaut** : `DOMContentLoaded` ne se déclenche jamais sous Vitest
  (`document.readyState === 'complete'` avant l'import du module). **L'ordre** dans lequel le
  démarrage enchaîne ses initialisations n'est donc prouvable que par lecture ou preuve
  navigateur. Les fonctions elles-mêmes sont testables une à une ; c'est le câblage qui ne
  l'est pas.
- **Ce qui est déjà couvert** : le verrou de parité `on*=` ↔ `window` (LOT 014 §F) s'exécute
  pour de vrai et attrape la panne la plus fréquente — un bouton qui n'appelle plus rien.
- **Ce qui reste** : l'ordre des opérations, notamment l'acquis « le rendu local précède
  toute attente réseau » (LOT 005). L'auditeur du LOT 013 a vérifié qu'un
  `window.dispatchEvent(new Event('DOMContentLoaded'))` déclenche bien le gestionnaire ; le
  blocage est ailleurs — ce gestionnaire enchaîne une dizaine d'initialisations à effets de
  bord réels (réseau, minuteries, écouteurs) qu'il faudrait neutraliser une à une.
- **À trancher un jour** : le faire, ou l'assumer définitivement. En l'état : assumé.

### [F-011] `aiConfig.diet` n'a pas la garde de type que `cuisines` possède

- **Origine** : découverte du LOT 027 (agent Explore), 2026-08-02.
- **Gravité** : basse — conditionnel, exige une donnée déjà corrompue (cloud ou fichier).
- **Où** : `src/state.js:284` force `cuisines` en tableau (`if (!Array.isArray(...)) = []`) ;
  **aucune ligne équivalente pour `diet`** — vérifié sur pièce le 2026-08-02.
- **Le défaut** : un `diet` corrompu en chaîne (sauvegarde bricolée, document cloud abîmé)
  traverse tout le circuit sans être rejeté et plante au `.join(', ')` de
  `src/services/gemini.js:209` — la génération d'idées afficherait une erreur technique.
- **Piste** : aligner `diet` (et les autres champs tableau de `aiConfig`) sur la garde de
  `cuisines`, avec un test par champ.
- ⚠️ **Pare-feu A/B** : durcissement défensif, pas un portage — hors périmètre du LOT 027
  (qui ne touche aucun JS de production), à faire valider comme changement dédié.

---

# Findings traités / écartés

### [F-006] TRAITÉ — Articles libres (`customCartItems`) : champ fantôme

- **Origine** : audit LOT 008 (2026-07-29) + constat du LOT 015 (2026-07-30).
- **Le défaut** : le champ existait, était synchronisé et copié, mais n'était **ni affiché ni
  créable** depuis la migration. Deux findings distincts en découlaient (retrait incomplet
  dans `removeFromCart`, absence totale d'interface).
- **TRAITÉ par suppression** — décision de Joel, LOT 014 §G, publié en 5.10 le 2026-07-31.
  Rebranchement écarté : « ni voulus ni utiles ».
- **Preuve, re-vérifiée le 2026-08-02** : `customCartItems` n'existe plus que sous trois
  formes délibérées — deux commentaires expliquant le retrait (`src/constants.js:38`,
  `src/services/firebase.js:20`) et une ligne qui efface le champ d'un ancien état
  (`src/state.js:200`).

### [F-007] ÉCARTÉ — Divergence des articles libres entre deux appareils

- **Origine** : audit Gemini du LOT 015, 2026-07-30.
- **Le scénario** : l'appareil A vide le panier pendant que B a des modifications en attente ;
  l'envoi de B réinjecte son ancien `customCartItems` et les articles réapparaissent sur A.
- **ÉCARTÉ — sans objet depuis le 2026-07-31** : le scénario suppose un `customCartItems`
  synchronisé, or le champ n'existe plus (cf. F-006). Il tombe mécaniquement.

### [F-008] TRAITÉ — La modale « ajout groupé » n'était ouverte par personne

- **Origine** : découverte du LOT 013, 2026-07-30.
- **Le défaut** : `#modal-shopping-bulk` (2 ids, 3 `onclick`) n'avait aucun appelant. Pire,
  son gestionnaire `confirmBulkAdd` lisait un `data-id` que personne n'écrivait : même
  ouverte à la main, elle n'aurait pas fonctionné.
- **TRAITÉ par retrait** — LOT 014, avec les 3 recherches convergentes.
- **Preuve, re-vérifiée le 2026-08-02** : ni `#modal-shopping-bulk` ni `confirmBulkAdd` ne
  se trouvent plus dans `index.html` ni dans `js/app.js`.

### [F-009] TRAITÉ — `sanitize()` sans aucun appelant de production

- **Origine** : découverte du LOT 013, 2026-07-30.
- **Le défaut** : `src/utils/dom.js` exportait une fonction dont le seul appelant était un
  test — renforcer ses tests serait revenu à tester du code mort.
- **TRAITÉ par suppression** — LOT 014 (addendum posé sur la fiche du LOT 003).
- **Preuve, re-vérifiée le 2026-08-02** : plus aucune fonction `sanitize` exportée par
  `src/utils/dom.js`.

### [F-010] TRAITÉ — Deux défauts de la déduction de catégorie

- **Origine** : tests de caractérisation écrits avant le déplacement vers
  `src/utils/categorize.js`, LOT 014.
- **Les défauts** : (1) le repli « végétal » était au singulier — une réponse d'IA au pluriel
  (« Produits végétaux », la formulation la plus naturelle) atterrissait dans le repli
  générique « Conserves & bocaux », donc au mauvais rayon ; (2) `sanitizeCategory` levait sur
  une catégorie non-chaîne (`{"category": 42}`), exception avalée en silence — la suggestion
  disparaissait sans aucun message.
- **TRAITÉS le 2026-07-31**, sur décision de Joel, dans un commit séparé du déplacement.
- **Preuve** : les deux tests « DÉFAUT CONNU » ont été **inversés** — ils verrouillent
  désormais la correction, avec un cas de non-régression chacun pour qu'un correctif trop
  large ne passe pas inaperçu (`tests/categorize.test.js`).

---

## Traçabilité

- **Origine des findings F-001 à F-010** : audit Dur du LOT 008 (Codex 5.6, 2026-07-29),
  découverte du LOT 013 (2026-07-30), audit Gemini du LOT 015 (2026-07-30).
- **Ils vivaient jusqu'ici** dans
  `RoadMap & Project Pipeline/Backlog/BACKLOG - Durcissements import et panier.md`, devenue
  une fiche de trace historique qui pointe vers ce registre (règle « rien ne se supprime »).
- **Migration du 2026-08-02** : déplacement, pas copie — un finding n'a qu'un seul domicile.
