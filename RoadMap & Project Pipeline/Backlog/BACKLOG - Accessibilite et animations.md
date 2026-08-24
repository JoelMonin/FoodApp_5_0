# ♿ CHANTIER — Accessibilité et animations

> **Priorité :** Basse (long terme)
> **Effort estimé :** 1-2 jours
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01) §"Vérifications Visuelles Recommandées"
> **Statut :** **FERMÉ — décision de Joel du 2026-08-04, volontairement non ouvert**

## ⚠️ DÉCISION DE JOEL (2026-08-04) : CHANTIER NON OUVERT

« on ne touche plus à l'appli […] je m'en fous ». Prise après relecture du vrai impact
utilisateur (ci-dessous) — pas une urgence ignorée : le seul point qui touchait vraiment
l'usage quotidien de Joel s'est révélé être une **mesure fausse** (cf. correction du
2026-08-04 juste en dessous). **Ne pas re-proposer** sauf nouvelle information.

## ⚑ CORRECTION DU 2026-08-04 — LA MESURE « CIBLES TACTILES » ÉTAIT TROMPEUSE

Cette fiche affirmait : « le point qui touche Joel tous les jours » à propos des cases à
cocher de la liste de courses (22×22 px, sous le standard 44 px). **Vérifié sur le code
(`src/ui/shopping.js:19-22`) : c'est FAUX.** 22 px est la taille du CARRÉ DESSINÉ, mais la
zone cliquable est `onclick` sur **toute la ligne de l'article** (`.shop-item`), pas sur le
petit carré seul. Un doigt touchant n'importe où sur « 🥕 Carottes » coche l'article — aucun
problème de précision tactile là où l'usage réel de Joel se passe (faire ses courses).

Restent réels, mais mineurs : les boutons d'en-tête de modale (imprimer, plein écran, fermer)
à 32×32 px — cliqués rarement, à l'arrêt, sans conséquence en cas de clic raté. Le reste du
chantier (ARIA, `<div>` cliquables, `prefers-reduced-motion`) sert les lecteurs d'écran et les
utilisateurs sensibles au mouvement — bénéfice nul pour Joel sur une app à usage personnel.

## ⚑ RE-VÉRIFIÉ LE 2026-08-02 — les 6 findings sont tous encore vivants

Les findings étaient marqués « HYPOTHESIS, confiance 65-80/100 ». Ils ont été **re-mesurés
dans le code** : ce ne sont plus des hypothèses, ce sont des faits. Les références ont été
corrigées au passage — celles d'origine visaient `css/style.css`, qui n'est plus qu'un
sommaire d'imports depuis le découpage du LOT 014.

| Mesure | Valeur constatée |
|---|---|
| Balises `<div ... onclick>` dans `index.html` | **47** (sur 83 éléments cliquables au total) |
| Attributs `aria-*` dans `index.html` | **0** |
| Attributs `role=` dans `index.html` | **0** |
| Animations déclarées | **11 déclarations, 10 noms** (`spin` est déclarée deux fois, cf. `10-spinner.css`) |
| Règles `prefers-reduced-motion` | **0** |
| Boutons d'en-tête de modale (`.mh-btn`) | **32 × 32 px** (`css/sections/09-modals.css:407`) |
| Cases à cocher de la liste de courses (`.si-check`) | **22 × 22 px** (`css/sections/04-shopping.css:67`) |

**Le point qui touche Joel tous les jours** : les cibles tactiles. Les boutons imprimer et
plein écran d'une recette font 32 px et les cases de la liste de courses 22 px, là où le
standard tactile est 44 px — au pouce, en faisant ses courses, c'est le clic raté.

⚠️ **Une correction à porter dans le plan ci-dessous** : il dit « ajouter dans
`css/style.css` ». **C'est désormais interdit** — ce fichier ne contient plus que les
13 `@import` de `css/sections/`, et le verrou `tests/css-sections.test.js` casse si une
règle y est écrite (elle passerait avant tout le reste). Toute règle neuve va dans la
section concernée, ou dans une section dédiée déclarée dans le sommaire.

---

## 🎯 Objectif

Améliorer l'accessibilité de l'application (sémantique HTML, navigation clavier, ATs) et respecter les préférences utilisateur sur les animations.

L'application est destinée à un usage personnel mais l'usage mobile (cibles tactiles 44px) reste une exigence concrète.

---

## 📋 Findings concernés

### F1 — `<div>` cliquables au lieu de `<button>`
- **Fichier** : `index.html` (numéros de ligne d'origine périmés — chercher `<div` + `onclick`)
- **Statut** : ✅ **CONFIRMÉ le 2026-08-02 — 47 balises concernées**
- **Problème** : `.sb-item`, `.bn-item`, `.chip` sont des `<div>` avec `onclick`. Lecteurs d'écran ne les annoncent pas comme interactifs.
- **Concerné** :
  - Sidebar items (`.sb-item`)
  - Bottom nav items (`.bn-item`)
  - Chips de filtre inventaire
  - Chips de configuration IA (meal/time/diff/ppl/diet/cuisine/equip)
  - Accordéons "filtres avancés"

### F2 — Chips simulant des boutons radio sans ARIA
- **Fichier** : `index.html` (chips meal/time/diff/ppl ; lignes d'origine périmées)
- **Statut** : ✅ **CONFIRMÉ le 2026-08-02 — 0 attribut `role=` et 0 `aria-*` dans tout le fichier**
- **Problème** : Sélection unique simulée mais pas de `role="radio"` ni `aria-checked`. Navigation clavier dégradée.

### F3 — Bottom nav sans `aria-current`
- **Fichier** : `index.html` (barre de navigation du bas, 5 `.bn-item`)
- **Statut** : ✅ **CONFIRMÉ le 2026-08-02 — aucun `aria-current` nulle part**
- **Problème** : Onglet actif identifié uniquement par `class="active"`. Pas annoncé aux ATs.

### F4 — Accordéon sans `aria-expanded`
- **Fichier** : `index.html` (en-tête « filtres avancés » du panneau IA)
- **Statut** : ✅ **CONFIRMÉ le 2026-08-02 — aucun `aria-expanded`**
- **Problème** : `onclick="this.parentElement.classList.toggle('open')"` sans gestion ARIA.

### F5 — 11 déclarations d'animation sans `prefers-reduced-motion`
- **Fichiers (re-localisés le 2026-08-02, le CSS a été découpé au LOT 014)** :
  `css/sections/02-layout.css` (`fadeUp`, `sync-spin`, `shake`, `pulse`) ·
  `css/sections/09-modals.css` (`fadeIn`, `slideUp`, `toastIn`, `toastOut`) ·
  `css/sections/10-spinner.css` (`spin`) · `css/sections/12-utilities.css` (`spin` — seconde
  déclaration, connue et documentée — et `pulseText`)
- **Statut** : ✅ **CONFIRMÉ le 2026-08-02 — 11 déclarations pour 10 noms, 0 règle `prefers-reduced-motion` dans tout le CSS**
- **Problème** : ces animations ne respectent pas la préférence système « réduire les animations » (sensibilité au mouvement, troubles vestibulaires).

### F6 — Cibles tactiles < 44px
- **Fichiers (re-localisés le 2026-08-02)** : `css/sections/09-modals.css:407` (`.mh-btn`,
  32 × 32) · `css/sections/04-shopping.css:67` (`.si-check`, 22 × 22)
- **Statut** : ✅ **CONFIRMÉ le 2026-08-02 — tailles relues sur pièce**
- **Problème** : boutons imprimer / plein écran d'une recette à 32 px, cases à cocher de la
  liste de courses à 22 px, pour un standard tactile à 44 px. **C'est le point le plus
  concret de la fiche** : il se paie en clics ratés au pouce, en pleine course.

---

## 📝 Plan d'action

### Étape 1 — Migration sémantique des éléments cliquables (3-4h)

**Stratégie** : remplacer les `<div onclick=...>` par `<button onclick=...>` avec reset CSS pour conserver l'apparence.

**Ajouter dans la section CSS concernée** — ⚠️ **PAS dans `css/style.css`**, qui n'est plus
qu'un sommaire d'imports (verrou `tests/css-sections.test.js`) :
```css
/* Reset bouton pour éléments interactifs */
button.sb-item, button.bn-item, button.chip,
button.tb-btn, button.modal-btn {
  background: none;
  border: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: inherit;
}

button.sb-item:focus-visible,
button.bn-item:focus-visible,
button.chip:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

**Dans `index.html`** : remplacer les `<div class="sb-item">`, `<div class="bn-item">`, `<div class="chip">` par `<button>` (sauf pour les chips dynamiques générées en JS qui doivent être mises à jour dans `src/ui/pantry.js` etc.).

**Dans les fichiers JS qui génèrent des chips dynamiques** (`src/ui/pantry.js`, etc.) :
```javascript
// Avant
h('div', { class: 'chip', onclick: ... }, label)
// Après
h('button', { class: 'chip', onclick: ..., type: 'button' }, label)
```

### Étape 2 — Ajouter ARIA aux chips radio-like (1h30)

Pour les chips meal/time/diff/ppl (sélection unique), ajouter `role="radio"` + `aria-checked` :

```html
<div class="chips-row" id="ai-meal-chips" role="radiogroup" aria-label="Type de repas">
  <button class="chip active" role="radio" aria-checked="true" data-val="indifferent" onclick="toggleAiSingle('meal',this)">🍽️ Indifférent</button>
  <button class="chip" role="radio" aria-checked="false" data-val="entrée" onclick="toggleAiSingle('meal',this)">🥗 Entrée</button>
  <!-- ... -->
</div>
```

Modifier `toggleAiSingle` (**aujourd'hui dans `src/ui/aiPanel.js:193`**, plus dans `app.js`)
pour mettre à jour `aria-checked` :
```javascript
function toggleAiSingle(field, el) {
  el.closest('.chips-row').querySelectorAll('.chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-checked', 'true');
  // ...
}
```

Pour `toggleAiChip` (sélection multiple, diet/cuisine/equip), utiliser `aria-pressed` :
```javascript
el.setAttribute('aria-pressed', el.classList.contains('active') ? 'true' : 'false');
```

### Étape 3 — Bottom nav `aria-current` (15 min)

Dans `renderCurrentView` (déjà existant), pour chaque `.bn-item` actif :
```javascript
document.querySelectorAll('.sb-item, .bn-item').forEach(el => {
  const isActive = el.dataset.view === view;
  el.classList.toggle('active', isActive);
  if (isActive) {
    el.setAttribute('aria-current', 'page');
  } else {
    el.removeAttribute('aria-current');
  }
});
```

### Étape 4 — Accordéon `aria-expanded` (15 min)

Modifier le `onclick` du header accordéon pour synchroniser `aria-expanded` :

```html
<div class="ai-accordion-header" 
     role="button"
     aria-expanded="false"
     onclick="(function(el){el.parentElement.classList.toggle('open');el.setAttribute('aria-expanded',el.parentElement.classList.contains('open'))})(this)">
```

Mieux : extraire en fonction nommée :
```javascript
window.toggleAccordion = function(headerEl) {
  const parent = headerEl.parentElement;
  parent.classList.toggle('open');
  headerEl.setAttribute('aria-expanded', parent.classList.contains('open'));
};
```

### Étape 5 — `prefers-reduced-motion` (45 min)

Ajouter dans une section dédiée de `css/sections/` (déclarée dans le sommaire), ⚠️ **jamais
dans `css/style.css`** :
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Pour les animations critiques où on veut garder un fondu doux, override sélectivement :
```css
@media (prefers-reduced-motion: reduce) {
  .toast {
    animation-duration: 0.15s !important;
  }
}
```

### Étape 6 — Cibles tactiles 44px (1h)

Identifier les éléments < 44px et ajouter padding ou `min-width/min-height` :

```css
/* Boutons modale (était 32×32) */
.modal-hdr-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 6px; /* l'icône reste petite mais la cible est large */
}

/* Checkbox shopping (était 22×22) */
.si-check {
  /* La checkbox visuelle reste 22, mais on l'enrobe d'un wrapper cliquable de 44 */
  width: 22px;
  height: 22px;
}
.shop-item {
  min-height: 44px; /* la zone tactile complète englobe la checkbox */
  padding: 11px;
}
```

### Étape 7 — Validation manuelle (30 min)

- Tab à travers la sidebar et la bottom nav : focus visible sur chaque item
- Activer "Réduire les animations" dans les paramètres système → vérifier que les keyframes sont quasi instantanées
- Tester sur mobile (taille d'écran < 375px) : tous les boutons facilement cliquables au pouce
- Lancer Lighthouse Accessibility audit (Chrome DevTools) → score doit augmenter (objectif : ≥85/100)

---

## ✅ Critères d'acceptation

- [ ] Aucun `<div onclick>` dans `index.html` (tous remplacés par `<button>`)
- [ ] Chips meal/time/diff/ppl ont `role="radio"` + `aria-checked` synchronisé
- [ ] Chips diet/cuisine/equip ont `aria-pressed` synchronisé
- [ ] Bottom nav onglet actif a `aria-current="page"`
- [ ] Accordéon a `aria-expanded` synchronisé
- [ ] `@media (prefers-reduced-motion: reduce)` présent dans `style.css`
- [ ] Boutons modale et checkbox shopping ont une zone tactile ≥ 44×44px
- [ ] Lighthouse Accessibility ≥ 85/100
- [ ] `npm run build` passe
- [ ] Aucune régression visuelle sur l'apparence existante

---

## 📌 Notes

- **Pas de framework a11y externe** — tout en HTML/CSS/JS natif.
- **Test manuel obligatoire** — l'audit auto (Lighthouse) ne détecte pas tout, notamment l'expérience clavier.
- **Compatibilité** : `prefers-reduced-motion` est supporté partout depuis 2020. `aria-current` depuis IE11+.
- **Objectif Lighthouse** : 85+ et non 100 (le 100 demande des optimisations très chronophages comme contraste parfait, qui n'apportent pas de bénéfice utilisateur ici).

---

## 🔗 Liens

- Rapport d'audit source : `ULTRA_AUDIT_REPORT.md` §"Vérifications Visuelles Recommandées"
- **Fichiers concernés, re-localisés le 2026-08-02** (le grand rangement des LOTS 014-018 a
  tout déplacé) : `index.html` · `css/sections/` (02-layout, 04-shopping, 09-modals,
  10-spinner, 12-utilities) · `src/ui/aiPanel.js` (`toggleAiSingle:193`,
  `toggleAiChip:202`) · `js/app.js` (`renderCurrentView:328`) · `src/ui/pantry.js` ·
  `src/ui/pantryView.js` · `src/ui/shopping.js` · `src/ui/recipe.js`
- 4 sites de `src/` génèrent des puces en JavaScript : elles devront basculer en `<button>`
  au même titre que celles écrites en dur dans `index.html`.
