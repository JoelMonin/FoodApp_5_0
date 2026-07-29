# LOT 007 — Synchro collaborative

> **Statut :** 🔵 EN COURS — spec validée, implémentation à venir
> **Branche :** `feat/lot7-synchro-collaborative`
> **Effort estimé :** ~4 h · **Niveau d'audit : DUR** (zone sensible)
> **Ouvert le :** 2026-07-28

---

## Pourquoi ce lot est classé sensible

C'est **le seul endroit de l'application où un défaut n'entraîne pas un affichage bizarre mais
la perte définitive de données réelles**. Il touche deux zones classées sensibles dans
`DOCTRINE_PRODUIT.md` §3 : le moteur d'état (`src/state.js`) et le service Firebase.
→ Spec écrite avant le code, audit Dur, tests dédiés sur la logique de fusion.

---

## Le besoin, dans les mots de Joel

> « Si je rajoute un ingrédient et que je synchronise, en fait ça télécharge l'inventaire
> depuis le cloud plutôt que de faire une vraie synchro bidirectionnelle. »

Constat vérifié : le bouton « Cloud Sync » appelle `pullFromFirebase`, qui **télécharge
seulement**. La fonction d'envoi existe (`pushToFirebase`) mais **n'est branchée sur aucun
bouton de l'interface**. Rien de ce que fait Joel ne remonte donc jamais au cloud.

## Usage réel (7 questions posées à Joel le 2026-07-28)

| Question | Réponse |
|---|---|
| Appareils | **PC + téléphone** |
| Deux appareils en même temps ? | **Oui, et j'agis sur les deux** |
| Quelqu'un d'autre modifie les mêmes données ? | **Oui, sa compagne / la famille** |
| Réseau au magasin | Correct |
| Fréquence des suppressions | **Quasi jamais** |
| Scénario à deux | **Elle ajoute des articles pendant qu'il coche en rayon** |
| Arbitrage souhaité | **Le plus récent gagne, sans me déranger** |

## La contradiction que ces réponses ont révélée

Joel demandait « le plus récent gagne » **et** une collaboration à deux. Or, appliquée à
l'inventaire **entier**, cette règle casse systématiquement la collaboration :

> Sa compagne ajoute « lait » à 17h02. Joel coche des tomates à 17h03. Le téléphone de Joel
> envoie **tout son inventaire**, qui ne connaît pas le lait. **Le lait disparaît.**

Ce n'est pas un cas rare : c'est le scénario nominal décrit par Joel. **« Le plus récent
gagne » en bloc est donc incompatible avec l'usage réel.**

## La règle retenue

**« Le plus récent gagne » — mais article par article, pas sur l'inventaire entier.**

1. À chaque synchro, comparaison **ingrédient par ingrédient** (clé : `id`).
2. Présent d'un seul côté → **conservé**. L'ajout de la compagne apparaît chez Joel.
3. Présent des deux côtés → **la version modifiée en dernier gagne**. Chacun gagne sur ce
   qu'il a touché, personne n'écrase personne.
4. Envoi **automatique 2 secondes** après la dernière action (réutilise le `debounce` du
   LOT 005) : 15 cases cochées = **un seul** envoi.
5. Récupération automatique au retour sur l'app et périodiquement quand elle est ouverte.
6. **Voyant d'état visible** : à jour ✓ / en cours / échec. Aucune question, aucune fenêtre
   d'interruption — conforme à « sans me déranger ».
7. Le bouton « Cloud Sync » devient un « forcer maintenant » (récupère **puis** envoie).

## Limite assumée — décision explicite

**Les suppressions ne se propagent pas entre appareils.** Un ingrédient supprimé pendant une
synchro croisée peut réapparaître une fois ; il suffit de le re-supprimer. Gérer proprement ce
cas exige de mémoriser les suppressions (« pierres tombales »), ce qui **doublerait la
complexité du lot** pour un événement que Joel qualifie de « quasi jamais ».
→ **Limite documentée et acceptée**, à rouvrir si l'usage change.

## Prérequis technique

Les ingrédients n'ont **pas** de date de dernière modification aujourd'hui. Il faut en ajouter
une (`updatedAt`) et la renseigner à chaque changement. C'est ce champ qui rend la règle
« le plus récent gagne » applicable article par article.

Point d'attention : les données déjà présentes dans le cloud n'ont pas ce champ. La fusion
doit donc traiter son absence sans rien perdre.

## Bénéfice collatéral

Le premier envoi **nettoiera la base cloud** des modèles IA périmés (`gemini-2.0-flash`,
`gemini-2.5-flash`) constatés le 2026-07-28.

## Critères d'acceptation

- [ ] Ajout d'un ingrédient sur l'appareil A → il apparaît sur l'appareil B après synchro
- [ ] Ajout simultané sur A et B → **les deux** sont conservés
- [ ] Modification du même ingrédient sur A puis B → la version de B (plus récente) gagne
- [ ] 15 cases cochées d'affilée → **un seul** envoi réseau
- [ ] Coupure réseau pendant un envoi → aucune perte locale, voyant en échec
- [ ] Données cloud sans `updatedAt` (existant) → fusion sans perte
- [ ] La clé API n'est jamais envoyée au cloud ni effacée localement
- [ ] Tests unitaires dédiés à la fusion, y compris les cas limites ci-dessus
- [ ] Validation unifiée verte + audit Dur

## Traçabilité

- Finding d'origine : `ULTRA_AUDIT_REPORT.md` A11 (« modifications locales écrasées »)
- Dépend de : `applyCloudState` introduit au LOT 006
