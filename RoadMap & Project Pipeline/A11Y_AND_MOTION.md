# ♿ CHANTIER — A11Y_AND_MOTION

> **Priorité :** Basse (long terme)
> **Effort estimé :** 1-2 jours
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01) §"Vérifications Visuelles Recommandées"
> **Statut :** À démarrer en dernier

---

## 🎯 Objectif

Améliorer l'accessibilité de l'application (sémantique HTML, navigation clavier, ATs) et respecter les préférences utilisateur sur les animations.

L'application est destinée à un usage personnel mais l'usage mobile (cibles tactiles 44px) reste une exigence concrète.

---

## 📋 Findings concernés

### F1 — `<div>` cliquables au lieu de `<button>`
- **Fichier** : `index.html:204-375`
- **Statut** : HYPOTHESIS — Confiance 75-80/100
- **Problème** : `.sb-item`, `.bn-item`, `.chip` sont des `<div>` avec `onclick`. Lecteurs d'écran ne les annoncent pas comme interactifs.
- **Concerné** :
  - Sidebar items (`.sb-item`)
  - Bottom nav items (`.bn-item`)
  - Chips de filtre inventaire
  - Chips de configuration IA (meal/time/diff/ppl/diet/cuisine/equip)
  - Accordéons "filtres avancés"

### F2 — Chips simulant des boutons radio sans ARIA
- **Fichier** : `index.html:338-375` (chips meal/time/diff/ppl)
- **Statut** : HYPOTHESIS — Confiance 75/100
- **Problème** : Sélection unique simulée mais pas de `role="radio"` ni `aria-checked`. Navigation clavier dégradée.

### F3 — Bottom nav sans `aria-current`
- **Fichier** : `index.html:714-733`
- **Statut** : HYPOTHESIS — Confiance 72/100
- **Problème** : Onglet actif identifié uniquement par `class="active"`. Pas annoncé aux ATs.

### F4 — Accordéon sans `aria-expanded`
- **Fichier** : `index.html:384`
- **Statut** : HYPOTHESIS — Confiance 72/100
- **Problème** : `onclick="this.parentElement.classList.toggle('open')"` sans gestion ARIA.

### F5 — 11 keyframes sans `prefers-reduced-motion`
- **Fichier** : `css/style.css:416-426 + 672-697 + 2661-2683 + 2695-2699`
- **Statut** : HYPOTHESIS — Confiance 68-72/100
- **Problème** : Animations `fadeUp`, `sync-spin`, `shake`, `spin`, `toastIn/Out`, etc. ne respectent pas le préf utilisateur (motion sickness, vestibulaire).

### F6 — Cibles tactiles < 44px
- **Fichier** : `css/style.css:3038-3062 (modale btns 32×32) + 1057-1079 (checkbox shopping 22×22)`
- **Statut** : HYPOTHESIS — Confiance 65-68/100
- **Problème** : Boutons modale (imprimer, fullscreen) à 32×32. Checkbox shopping à 22×22. Risque misclick mobile.

---

## 📝 Plan d'action

### Étape 1 — Migration sémantique des éléments cliquables (3-4h)

**Stratégie** : remplacer les `<div onclick=...>` par `<button onclick=...>` avec reset CSS pour conserver l'apparence.

**Ajouter dans `style.css`** :
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

Modifier `toggleAiSingle` dans `app.js` pour mettre à jour `aria-checked` :
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

Ajouter à la fin de `css/style.css` :
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
- Fichiers concernés : `index.html`, `css/style.css`, `js/app.js` (toggleAiSingle, toggleAiChip, renderCurrentView), `src/ui/pantry.js`, `src/ui/shopping.js`, `src/ui/recipe.js`
