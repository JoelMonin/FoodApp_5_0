import { h } from '../utils/dom.js';
import { CATEGORIE_PAR_DEFAUT } from '../data.js';
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
    'data-testid': 'shop-item',
    'data-item-id': item.id,
    onclick: () => toggleShoppingCheck(item.id)
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
      onclick: (e) => { e.stopPropagation(); removeFromCart(item.id); },
      title: 'Retirer'
    }, '✕')
  ]);
}

/**
 * BARRE « RANGER MES ACHATS » (LOT 020). Rendue en DERNIER dans la liste et collante en bas
 * de l'ecran (`position: sticky`, cf. `css/sections/04-shopping.css`) : au magasin, le pouce
 * l'atteint sans avoir a faire defiler jusqu'en bas d'une longue liste.
 *
 * Elle n'existe qu'a partir d'UN article coche — hors d'un retour de courses, elle
 * n'encombre rien. Le compte est annonce sur le bouton lui-meme : c'est le filet de securite
 * retenu par Joel (voir ce qui va partir AVANT d'appuyer), a la place d'une fenetre de
 * confirmation qui ajouterait un clic les mains pleines.
 *
 * @returns {HTMLElement|null} La barre, ou `null` s'il n'y a rien a ranger.
 */
export function renderShoppingDoneBar(nbCoches, handlers) {
  if (nbCoches < 1) return null;
  const { rangerLesAchats } = handlers;
  return h('div', { class: 'shop-done-bar', 'data-testid': 'shop-done-bar' }, [
    h('button', {
      class: 'sdb-btn',
      onclick: () => rangerLesAchats?.()
    }, `🏠 Ranger ${nbCoches} achat${nbCoches > 1 ? 's' : ''}`)
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
    const cat = ing.category || CATEGORIE_PAR_DEFAUT;
    if (!grouped[cat]) grouped[cat] = [];
    // LOT 014, volet G : plus de `type: 'db'`. Ce marqueur ne servait qu'à distinguer un
    // ingrédient d'un « article libre » ; les articles libres ayant été supprimés, la liste
    // de courses n'a plus qu'une seule source.
    grouped[cat].push({ ...ing });
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

  // LOT 020 — la barre de rangement ferme la liste. Le compte reutilise `checkedCount`,
  // deja filtre sur les articles PRESENTS : une coche fantome ne doit pas faire promettre
  // au bouton de ranger un article qui n'est plus la.
  const doneBar = renderShoppingDoneBar(checkedCount, handlers);
  if (doneBar) fragment.appendChild(doneBar);

  containerEl.replaceChildren(fragment);
}
