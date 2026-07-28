import { h } from '../utils/dom.js';
import { ActionButton, Badge } from './components.js';

export function renderIngCard(ing, handlers) {
  const { toggleStock, togglePin, toggleCart, deleteIngredient, openEditEmoji } = handlers;

  let cls = 'ing-card';
  if (ing.pinned) cls += ' pinned';
  if (ing.inCart) cls += ' in-cart';
  if (ing.inStock) cls += ' in-stock';
  if (!ing.inCart && !ing.inStock) cls += ' out-of-stock';

  return h('div', {
    class: cls,
    onclick: () => toggleStock(ing.id),
    title: `Cliquer pour ${ing.inStock ? 'retirer' : 'ajouter'}`
  }, [
    h('div', { class: 'ing-top-badges' }, [
      h('div', { class: 'ing-top-left' }, ing.frozen ? Badge('❄️') : null),
      h('div', { class: 'ing-top-right' }, [
        ing.inCart ? Badge('🛒') : null,
        ing.pinned ? Badge('📌') : null
      ])
    ]),
    h('span', {
      class: 'ing-emoji',
      onclick: (e) => { e.stopPropagation(); openEditEmoji(ing.id); },
      title: "Changer l'icône"
    }, ing.emoji),
    h('div', { class: 'ing-name' }, ing.name),
    h('div', { class: 'ing-cat' }, ing.category),
    h('div', { class: 'ing-actions' }, [
      ActionButton('📌', () => togglePin(ing.id), ing.pinned ? 'active-pin' : '', "Épingler"),
      ActionButton('🛒', () => toggleCart(ing.id), ing.inCart ? 'active-cart' : '', "Courses"),
      ActionButton('🗑️', () => deleteIngredient(ing.id), 'del', "Supprimer définitivement")
    ])
  ]);
}

export function renderPantryGrid(gridEl, emptyEl, ingredients, handlers) {
  if (!gridEl) return;

  if (ingredients.length === 0) {
    gridEl.replaceChildren();
    gridEl.classList.add('hidden');
    emptyEl?.classList.remove('hidden');
  } else {
    gridEl.classList.remove('hidden');
    emptyEl?.classList.add('hidden');
    
    const fragment = document.createDocumentFragment();
    ingredients.forEach(ing => {
      fragment.appendChild(renderIngCard(ing, handlers));
    });
    gridEl.replaceChildren(fragment);
  }
}
