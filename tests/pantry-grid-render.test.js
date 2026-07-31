/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderPantryGrid, renderIngCard } from '../src/ui/pantry.js';
import { setupTestDOM, makeIngredient } from './_helpers/dom-helpers.js';

// LOT 013 — `renderPantryGrid`/`renderIngCard` (src/ui/pantry.js) n'avaient AUCUN test avant
// ce lot. Deux points cruciaux : (1) le renderer NE TRIE PAS — c'est `getFilteredIngredients`
// (js/app.js) qui trie, l'audit Codex a explicitement demandé de ne pas dupliquer le tri ici ;
// (2) chaque tuile porte maintenant `data-testid="ing-card"` + `data-ing-id` (ancre posée par
// ce lot) — sans ça, une tuile n'était adressable que par sa position, fragile au tri du
// LOT 010.

function handlers(over = {}) {
    return {
        toggleStock: vi.fn(),
        togglePin: vi.fn(),
        toggleCart: vi.fn(),
        deleteIngredient: vi.fn(),
        openEditEmoji: vi.fn(),
        ...over
    };
}

describe('LOT 013 — renderPantryGrid', () => {
    beforeEach(() => {
        setupTestDOM('pantry');
    });

    it('grille vide : bascule sur le message vide, aucune tuile', () => {
        renderPantryGrid(document.getElementById('ing-grid'), document.getElementById('ing-empty'), [], handlers());
        const grid = document.getElementById('ing-grid');
        const empty = document.getElementById('ing-empty');
        expect(grid.classList.contains('hidden')).toBe(true);
        expect(empty.classList.contains('hidden')).toBe(false);
        expect(grid.children.length).toBe(0);
    });

    it('grille pleine : les tuiles s\'affichent, le message vide se cache', () => {
        renderPantryGrid(
            document.getElementById('ing-grid'), document.getElementById('ing-empty'),
            [makeIngredient(), makeIngredient()], handlers()
        );
        const grid = document.getElementById('ing-grid');
        const empty = document.getElementById('ing-empty');
        expect(grid.classList.contains('hidden')).toBe(false);
        expect(empty.classList.contains('hidden')).toBe(true);
        expect(grid.querySelectorAll('[data-testid="ing-card"]').length).toBe(2);
    });

    it('ne trie JAMAIS : restitue l\'ordre reçu tel quel (exigence de l\'audit Codex)', () => {
        const zebre = makeIngredient({ id: 'z', name: 'Zebre' });
        const abricot = makeIngredient({ id: 'a', name: 'Abricot' });
        // Ordre volontairement "à l'envers" par rapport à l'alphabet : si le renderer triait,
        // ce test échouerait — le tri est la responsabilité de getFilteredIngredients.
        renderPantryGrid(
            document.getElementById('ing-grid'), document.getElementById('ing-empty'),
            [zebre, abricot], handlers()
        );
        const ids = [...document.querySelectorAll('[data-ing-id]')].map(el => el.dataset.ingId);
        expect(ids).toEqual(['z', 'a']);
    });

    it('gridEl absent : ne lève pas, ne touche à rien', () => {
        expect(() => renderPantryGrid(null, document.getElementById('ing-empty'), [makeIngredient()], handlers()))
            .not.toThrow();
    });

    it('emptyEl absent : ne lève pas (accès optionnel)', () => {
        expect(() => renderPantryGrid(document.getElementById('ing-grid'), null, [], handlers()))
            .not.toThrow();
    });
});

describe('LOT 013 — renderIngCard', () => {
    it('porte les classes d\'état : épinglé, dans le panier, en stock', () => {
        const card = renderIngCard(makeIngredient({ pinned: true, inCart: true, inStock: true }), handlers());
        expect(card.className).toContain('pinned');
        expect(card.className).toContain('in-cart');
        expect(card.className).toContain('in-stock');
        expect(card.className).not.toContain('out-of-stock');
    });

    it('ni en stock ni au panier : classe "out-of-stock"', () => {
        const card = renderIngCard(makeIngredient({ inStock: false, inCart: false }), handlers());
        expect(card.className).toContain('out-of-stock');
    });

    it('affiche les badges ❄️🛒📌 (bandeau du haut) seulement quand l\'état le justifie '
       + '— distincts des boutons d\'action, toujours présents en bas de la tuile', () => {
        const badges = (card) => card.querySelector('.ing-top-badges').textContent;

        const carteComplete = renderIngCard(makeIngredient({ frozen: true, inCart: true, pinned: true }), handlers());
        expect(badges(carteComplete)).toContain('❄️');
        expect(badges(carteComplete)).toContain('🛒');
        expect(badges(carteComplete)).toContain('📌');

        const carteNue = renderIngCard(makeIngredient({ frozen: false, inCart: false, pinned: false }), handlers());
        expect(badges(carteNue)).not.toContain('❄️');
        expect(badges(carteNue)).not.toContain('🛒');
        expect(badges(carteNue)).not.toContain('📌');

        // Les 3 boutons d'action, eux, sont TOUJOURS là — quel que soit l'état.
        expect(carteNue.querySelectorAll('.ing-btn').length).toBe(3);
    });

    it('cliquer la tuile appelle toggleStock avec SON id', () => {
        const h = handlers();
        const card = renderIngCard(makeIngredient({ id: 'ing_42' }), h);
        document.body.appendChild(card);
        card.click();
        expect(h.toggleStock).toHaveBeenCalledWith('ing_42');
    });

    it('cliquer l\'emoji ouvre l\'édition SANS déclencher toggleStock (stopPropagation)', () => {
        const h = handlers();
        const card = renderIngCard(makeIngredient({ id: 'ing_7' }), h);
        document.body.appendChild(card);
        card.querySelector('.ing-emoji').click();
        expect(h.openEditEmoji).toHaveBeenCalledWith('ing_7');
        expect(h.toggleStock).not.toHaveBeenCalled();
    });

    it('les 3 boutons d\'action appellent leur handler avec l\'id, sans déclencher toggleStock', () => {
        const h = handlers();
        const card = renderIngCard(makeIngredient({ id: 'ing_9' }), h);
        document.body.appendChild(card);
        const boutons = card.querySelectorAll('.ing-btn');
        expect(boutons.length).toBe(3);
        boutons[0].click(); // 📌
        boutons[1].click(); // 🛒
        boutons[2].click(); // 🗑️
        expect(h.togglePin).toHaveBeenCalledWith('ing_9');
        expect(h.toggleCart).toHaveBeenCalledWith('ing_9');
        expect(h.deleteIngredient).toHaveBeenCalledWith('ing_9');
        expect(h.toggleStock).not.toHaveBeenCalled();
    });

    it('porte data-testid="ing-card" et data-ing-id (ancre posée par le LOT 013)', () => {
        const card = renderIngCard(makeIngredient({ id: 'ing_ancre' }), handlers());
        expect(card.dataset.testid).toBe('ing-card');
        expect(card.dataset.ingId).toBe('ing_ancre');
    });
});
