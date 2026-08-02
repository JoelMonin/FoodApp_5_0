# LOT 027 — Option Keto `[EN COURS]`

**Ouvert le 2026-08-02** · Branche `feat/lot27-option-keto` (**chaînée sur
`feat/lot26-prompts-generation`**, même procédé que les LOTS 016/017/018 — décision de Joel :
« on ne push pas encore », les lots 025 + 026 + 027 partiront ensemble) · Niveau d'audit :
**Léger** (auto-audit + relecture scope/diff/tests).

---

## 1. D'OÙ ÇA VIENT

Demande de Joel du 2026-08-02, juste après la clôture de l'audit du LOT 026 :
« maintenant je voudrais ajouter "Keto" dans les options diététiques ».

**Le régime cétogène en une phrase** : très pauvre en glucides, riche en graisses, protéines
modérées — le corps bascule sur les graisses comme carburant (cétose). Exclut sucre, pain,
pâtes, riz, pommes de terre, légumineuses, la plupart des fruits ; favorise viandes, poissons,
œufs, fromages, crème, huiles, avocat, oléagineux, légumes verts.

## 2. CE QUE ÇA CHANGE À L'ÉCRAN

Une **6ᵉ puce « Keto »** dans « Options diététiques » du panneau IA, à côté de Sans céréales,
Sans gluten, Sans laitiers, Végétarien, Vegan. Cochée, elle part dans la consigne envoyée à
l'IA (ligne « RÉGIMES & EXCLUSIONS ») comme les cinq autres. Rien d'autre ne bouge.

**Point de comportement existant, signalé à Joel AVANT ouverture (pas de changement)** : la
« règle d'or » du prompt dit qu'un ingrédient IMPOSÉ gagne toujours sur le régime. Riz imposé
+ Keto cochée → l'IA mettra du riz. Voulu depuis l'origine, s'applique à Keto comme aux autres.

## 3. PHASE DÉCOUVERTE (agent Explore, 2026-08-02 — 8 ressources, 6 points d'attention)

**Ressources réutilisées (le lot n'écrit AUCUN JS de production)** :
- `toggleAiChip` (`src/ui/aiPanel.js:235-241`) : générique, pousse le `data-val` de chaque
  puce active dans `state.aiConfig[field]`. Rien à toucher.
- `restoreAIConfig` (`aiPanel.js:205-214`) : rallume par correspondance stricte sur
  `data-val`, champ déduit de l'id `ai-diet-chips`. Une 6ᵉ puce marche sans une ligne de JS.
- Seul lecteur métier : `gemini.js:209` (`dietStr = diet.join(', ')`) → ligne « 6. RÉGIMES &
  EXCLUSIONS » du prompt (`:245`). **Le `data-val` EST le texte lu par le modèle.**
- Sync cloud, sauvegarde fichier, reset, migration : tous génériques, aucun filtrage — une
  valeur nouvelle traverse tout le circuit (vérifié `firebase.js:64-91`, `actions.js:260/349`,
  `state.js:257`).
- CSS : `.chip`/​`.chip.active` suffisent, zéro sélecteur par `data-val` dans tout `css/`.
- Patron de test transposable : `tests/cuisine-ssot.test.js` (lecture du vrai `index.html`
  par `readFileSync` + bout-en-bout clic → état → rechargement → puce rallumée + prompt réel
  via fetch mocké).

**Points d'attention retenus** :
- **Aucune liste blanche des régimes n'existe** : `index.html` est la seule source des
  valeurs. Rien à mettre à jour ailleurs — mais rien ne protège d'une faute de frappe, d'où
  le verrou de ce lot.
- **Zéro test ne couvrait la ligne « RÉGIMES & EXCLUSIONS » du prompt** (recherche
  `RÉGIMES|dietStr` dans tests/ : aucune correspondance). Ce lot pose le premier.
- **Signalé, hors périmètre (pare-feu A/B)** : `diet` n'a pas la garde de type que `cuisines`
  a (`state.js:284` force `cuisines` en tableau, pas d'équivalent `diet`) — un `diet`
  corrompu en chaîne planterait au `.join`. Consigné au registre technique (F-011), pas
  corrigé ici.
- Anecdotique : un appareil resté sur l'ANCIENNE page qui reçoit « keto » du cloud n'a pas de
  puce à rallumer — invisible jusqu'au rechargement (GitHub Pages sert la même version à
  tous, la fenêtre est courte).

## 4. SPÉCIFICATION

1. **`index.html`** : 6ᵉ puce dans `#ai-diet-chips`, même gabarit que les cinq autres :
   `data-val="keto"`, libellé « Keto », `onclick="toggleAiChip('diet',this)"`.
   **Choix du `data-val` : `keto`** — c'est le terme le plus universellement compris par les
   modèles (plus que « cetogene » sans accent), il suit le gabarit kebab-case sans accent des
   cinq valeurs existantes, et il part tel quel dans le prompt.
2. **Aucun code JS de production** : confirmé par la découverte.
3. **Test de verrou — nouveau fichier `tests/diet-chips.test.js`** (aucun domicile naturel :
   `cuisine-ssot` est verrouillé sur le champ `cuisines`, `restore-ai-config` ne lit jamais le
   vrai `index.html`). Contenu : les 6 valeurs exactes de `#ai-diet-chips` dans la vraie page,
   bout-en-bout clic → état → rechargement pour Keto, et la ligne « RÉGIMES & EXCLUSIONS :
   keto » dans le message réellement envoyé à l'IA (première couverture de cette ligne).
   + entrée `PROJECT_MAP.md` (verrou pytest).
4. **Preuve par retrait** : retirer la puce → test nommé rougit ; témoin non muté vert.

## 5. CRITÈRES D'ACCEPTATION (posés AVANT implémentation)

- [x] La puce « Keto » s'affiche dans les options diététiques et se coche/décoche comme les
  autres — prouvé par le bout-en-bout de `tests/diet-chips.test.js`.
- [x] Cochée, la génération d'idées reçoit la valeur keto dans « RÉGIMES & EXCLUSIONS » —
  prouvé sur le message réellement construit (fetch mocké), première couverture de cette ligne.
- [x] Elle survit à un rechargement de page (restauration des réglages) comme les cinq autres
  — prouvé par le même bout-en-bout (état conservé, puce rallumée, voisine éteinte).
- [x] Validation unifiée verte : **934/934 Vitest · 16/16 Pytest · types OK · build OK**,
  preuve par retrait 3/3 (2026-08-02).
- [ ] Essai réel de Joel : une génération avec Keto cochée sort des recettes cétogènes.

## 6. SUIVI

| Étape | État |
|---|---|
| Branche + fiche + suivi | ✅ 2026-08-02 |
| Phase découverte | ✅ 2026-08-02 — 8 ressources, 6 points d'attention (§3), F-011 consigné au registre technique |
| Implémentation + tests | ✅ 2026-08-02 — 1 ligne dans `index.html`, ZÉRO JS de production, `tests/diet-chips.test.js` (6 tests) + entrée `PROJECT_MAP.md` |
| Preuve par retrait | ✅ 2026-08-02 — **3 mutations / 3 rouges nommées, 0 nulle, témoin vert** (M1 puce retirée → 2 rouges ; M2 ligne RÉGIMES débranchée → 3 rouges ; M3 rallumage débranché → 1 rouge) |
| Validation unifiée | ✅ 2026-08-02 — **934/934 Vitest · 16/16 Pytest · types OK · build OK** |
| Essai réel de Joel | ⏳ |
