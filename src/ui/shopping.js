import { h } from '../utils/dom.js';
import { SectionLabel } from './components.js';

export function renderShoppingItem(item, isChecked, handlers) {
  const { toggleShoppingCheck, removeFromCart } = handlers;

  const tag = item.source === 'ai-extra' 
    ? h('span', { class: 'si-tag blue' }, '🛍 hors stock') 
    : item.source === 'ai' 
      ? h('span', { class: 'si-tag gold' }, '✨ IA') 
      : null;

  const sourceInfo = item.shoppingSource 
    ? h('div', { class: 'si-source' }, `🛒 Pour : ${item.shoppingSource}`) 
    : null;

  return h('div', {
    class: `shop-item${isChecked ? ' checked' : ''}`,
    onclick: () => toggleShoppingCheck(item.id, item.type)
  }, [
    h('div', { class: `si-check${isChecked ? ' done' : ''}` }),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 0' } }, [
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h('span', { class: 'si-emoji' }, item.emoji || '🛒'),
        h('span', { class: 'si-name', style: { fontWeight: '600' } }, item.name),
        tag
      ]),
      sourceInfo
    ]),
    h('span', {
      class: 'si-del',
      onclick: (e) => { e.stopPropagation(); removeFromCart(item.id, item.type); },
      title: 'Retirer'
    }, '✕')
  ]);
}

export function renderShoppingList(containerEl, cartItems, shoppingChecked, handlers) {
  if (!containerEl) return;

  const total = cartItems.length;
  const checkedCount = [...shoppingChecked].filter(id => cartItems.some(i => i.id === id)).length;

  if (total === 0) {
    containerEl.replaceChildren(
      h('div', { style: { textAlign: 'center', padding: '60px 20px', color: 'var(--txt-soft)' } }, [
        h('div', { style: { fontSize: '48px', marginBottom: '12px' } }, '🛒'),
        h('div', { style: { fontFamily: "'Lora',serif", fontSize: '17px', color: 'var(--txt)', marginBottom: '6px' } }, 'Liste vide'),
        h('div', { style: { fontSize: '13px' } }, "Ajoutez des ingrédients depuis l'inventaire ou via les Recettes IA.")
      ])
    );
    return;
  }

  const pct = total > 0 ? Math.round(checkedCount / total * 100) : 0;

  // Group by category
  const grouped = {};
  cartItems.forEach(ing => {
    const cat = ing.category || 'Autres';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...ing, type: 'db' });
  });

  const fragment = document.createDocumentFragment();

  // Progress Bar
  fragment.appendChild(h('div', { class: 'shop-progress-bar' }, [
    h('div', { class: 'spb-row' }, [
      h('div', { class: 'spb-title' }, 'Liste de courses'),
      h('div', { class: 'spb-count' }, `${checkedCount} / ${total} cochés`)
    ]),
    h('div', { class: 'spb-track' }, [
      h('div', { class: 'spb-fill', style: { width: `${pct}%` } })
    ])
  ]));

  // Categorized items
  Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .forEach(([cat, items]) => {
      fragment.appendChild(SectionLabel(cat));
      items
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .forEach(item => {
          fragment.appendChild(renderShoppingItem(item, shoppingChecked.has(item.id), handlers));
        });
    });

  containerEl.replaceChildren(fragment);
}
