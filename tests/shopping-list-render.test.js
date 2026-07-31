/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderShoppingList, renderShoppingItem } from '../src/ui/shopping.js';
import { setupTestDOM, makeIngredient } from './_helpers/dom-helpers.js';

// LOT 013 — `renderShoppingList`/`renderShoppingItem` (src/ui/shopping.js) n'avaient AUCUN
// test avant ce lot, alors que la fonction qui les appelle (`renderShopping`, js/app.js) est
// au cœur du constat de découverte sur les articles libres (voir la fiche du lot, arbitrage
// dédié — non traité ici, non traité par ces tests).
//
// Asymétrie à ne pas perdre : CONTRAIREMENT à renderPantryGrid (qui restitue l'ordre reçu tel
// quel), renderShoppingList TRIE lui-même par rayon puis par nom (`localeCompare('fr')`,
// src/ui/shopping.js:82,86) — c'est la fonction qui appelle qui décide, pas une règle unique.

function handlers(over = {}) {
    return { toggleShoppingCheck: vi.fn(), removeFromCart: vi.fn(), ...over };
}

function cartItem(over = {}) {
    return { ...makeIngredient(), ...over };
}

describe('LOT 013 — renderShoppingList', () => {
    beforeEach(() => {
        setupTestDOM('shopping');
    });

    it('liste vide : message "Liste vide", pas de barre de progression', () => {
        renderShoppingList(document.getElementById('shopping-scroll'), [], new Set(), handlers());
        const scroll = document.getElementById('shopping-scroll');
        expect(scroll.textContent).toContain('Liste vide');
        expect(scroll.querySelector('.shop-progress-bar')).toBeNull();
    });

    it('containerEl absent : ne lève pas', () => {
        expect(() => renderShoppingList(null, [cartItem()], new Set(), handlers())).not.toThrow();
    });

    it('barre de progression : compte les cochés parmi les items PRÉSENTS uniquement', () => {
        const a = cartItem({ id: 'a' });
        const b = cartItem({ id: 'b' });
        // 'fantome' est coché mais n'est plus dans la liste : ne doit pas gonfler le compte.
        const checked = new Set(['a', 'fantome']);
        renderShoppingList(document.getElementById('shopping-scroll'), [a, b], checked, handlers());
        const scroll = document.getElementById('shopping-scroll');
        expect(scroll.querySelector('.spb-count').textContent).toBe('1 / 2 cochés');
        expect(scroll.querySelector('.spb-fill').style.width).toBe('50%');
    });

    it('regroupe par rayon puis trie par nom, en français (accents inclus)', () => {
        const items = [
            cartItem({ id: '1', name: 'Zeste', category: 'Fruits' }),
            cartItem({ id: '2', name: 'Épinard', category: 'Légumes' }),
            cartItem({ id: '3', name: 'Abricot', category: 'Fruits' }),
            cartItem({ id: '4', name: 'Ananas', category: 'Légumes' })
        ];
        renderShoppingList(document.getElementById('shopping-scroll'), items, new Set(), handlers());
        const rubriques = [...document.querySelectorAll('.section-label')].map(el => el.textContent);
        // "Fruits" avant "Légumes" (ordre alphabétique français des catégories)
        expect(rubriques).toEqual(['Fruits', 'Légumes']);
        const noms = [...document.querySelectorAll('[data-testid="shop-item"] .si-name')].map(el => el.textContent);
        expect(noms).toEqual(['Abricot', 'Zeste', 'Ananas', 'Épinard']);
    });

    it('un rayon absent (category undefined) tombe dans "Autres"', () => {
        renderShoppingList(
            document.getElementById('shopping-scroll'),
            [cartItem({ id: '1', category: undefined })], new Set(), handlers()
        );
        expect(document.querySelector('.section-label').textContent).toBe('Autres');
    });
});

describe('LOT 013 — renderShoppingItem', () => {
    it('cliquer la ligne appelle toggleShoppingCheck(id)', () => {
        const h = handlers();
        const item = renderShoppingItem(cartItem({ id: 'x1' }), false, h);
        document.body.appendChild(item);
        item.click();
        expect(h.toggleShoppingCheck).toHaveBeenCalledWith('x1'); // volet G : le 2e param mort a disparu
    });

    it('cliquer la croix retire l\'article SANS cocher (stopPropagation)', () => {
        const h = handlers();
        const item = renderShoppingItem(cartItem({ id: 'x2' }), false, h);
        document.body.appendChild(item);
        item.querySelector('.si-del').click();
        expect(h.removeFromCart).toHaveBeenCalledWith('x2'); // volet G : idem
        expect(h.toggleShoppingCheck).not.toHaveBeenCalled();
    });

    it('coché : porte la classe "checked" et le marqueur ".si-check.done"', () => {
        const item = renderShoppingItem(cartItem(), true, handlers());
        expect(item.className).toContain('checked');
        expect(item.querySelector('.si-check').className).toContain('done');
    });

    it('source "ai-extra" affiche le tag bleu "🛍 hors stock"', () => {
        const item = renderShoppingItem(cartItem({ source: 'ai-extra' }), false, handlers());
        const tag = item.querySelector('.si-tag');
        expect(tag.className).toContain('blue');
        expect(tag.textContent).toContain('hors stock');
    });

    it('source "ai" affiche le tag doré "✨ IA"', () => {
        const item = renderShoppingItem(cartItem({ source: 'ai' }), false, handlers());
        const tag = item.querySelector('.si-tag');
        expect(tag.className).toContain('gold');
        expect(tag.textContent).toContain('IA');
    });

    it('sans source reconnue : aucun tag', () => {
        const item = renderShoppingItem(cartItem({ source: undefined }), false, handlers());
        expect(item.querySelector('.si-tag')).toBeNull();
    });

    it('shoppingSource affiche "🛒 Pour : X" ; sans shoppingSource, rien', () => {
        const avec = renderShoppingItem(cartItem({ shoppingSource: 'Poulet rôti' }), false, handlers());
        expect(avec.querySelector('.si-source').textContent).toContain('Poulet rôti');

        const sans = renderShoppingItem(cartItem({ shoppingSource: null }), false, handlers());
        expect(sans.querySelector('.si-source')).toBeNull();
    });

    it('porte data-testid="shop-item" et data-item-id (ancre posée par le LOT 013)', () => {
        const item = renderShoppingItem(cartItem({ id: 'ancre_1' }), false, handlers());
        expect(item.dataset.testid).toBe('shop-item');
        expect(item.dataset.itemId).toBe('ancre_1');
    });
});
