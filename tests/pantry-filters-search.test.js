/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { getFilteredIngredients } from '../js/app.js';
import { CATEGORIES } from '../src/data.js';
import { setupTestDOM } from './_helpers/dom-helpers.js';

// LOT 013 — getFilteredIngredients (js/app.js:838) n'avait que son TRI de couvert
// (tests/pantry-sort.test.js, LOT 010/C11). Ce fichier couvre le reste : la recherche
// texte, les toggles indépendants ET LEUR CUMUL, et les filtres exclusifs pinned/frozen.

function ing(over = {}) {
    return {
        id: 'i_' + Math.random(), name: 'Tomate', category: 'Légumes', emoji: '🍅',
        inStock: false, inCart: false, pinned: false, frozen: false,
        ...over
    };
}

describe('LOT 013 — getFilteredIngredients : recherche, toggles, filtres exclusifs', () => {
    beforeEach(() => {
        state.ingredients = [];
        state.filter = 'all';
        state.search = '';
        state.showInStockOnly = false;
        state.showInCartOnly = false;
    });

    describe('recherche texte', () => {
        it('filtre par sous-chaîne du nom, insensible à la casse', () => {
            state.ingredients = [ing({ id: '1', name: 'Tomate' }), ing({ id: '2', name: 'Carotte' })];
            state.search = 'TOM';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        // FAUX VERROU FV-2 (audit adversarial du 2026-07-31, mutation M27) : le titre
        // ci-dessus annonce « sous-chaîne », mais les 5 cas d'origine cherchaient tous par
        // le DÉBUT du mot. Remplacer `.includes(s)` par `.startsWith(s)` (js/app.js:855)
        // les laissait TOUS verts. Ce test est le seul qui distingue les deux.
        it('trouve une correspondance au MILIEU du nom, pas seulement au début', () => {
            state.ingredients = [ing({ id: '1', name: 'Tomate' }), ing({ id: '2', name: 'Carotte' })];
            state.search = 'mat';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('trouve une correspondance en FIN de nom', () => {
            state.ingredients = [ing({ id: '1', name: 'Tomate' }), ing({ id: '2', name: 'Carotte' })];
            state.search = 'otte';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['2']);
        });

        it('ignore les accents (normalizeString)', () => {
            state.ingredients = [ing({ id: '1', name: 'Épinard' }), ing({ id: '2', name: 'Carotte' })];
            state.search = 'epinard';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('recherche vide : ne filtre rien', () => {
            state.ingredients = [ing({ id: '1' }), ing({ id: '2', name: 'Carotte' })];
            state.search = '';
            expect(getFilteredIngredients().length).toBe(2);
        });

        it('aucune correspondance : liste vide, pas d\'exception', () => {
            state.ingredients = [ing({ name: 'Tomate' })];
            state.search = 'zzzzz';
            expect(getFilteredIngredients()).toEqual([]);
        });

        it('nom undefined ne fait pas planter la recherche', () => {
            state.ingredients = [{ id: '1', name: undefined, category: 'Autres' }, ing({ id: '2', name: 'Carotte' })];
            state.search = 'car';
            expect(() => getFilteredIngredients()).not.toThrow();
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['2']);
        });
    });

    describe('toggles indépendants — showInStockOnly / showInCartOnly', () => {
        it('showInStockOnly : ne garde que les ingrédients en stock', () => {
            state.ingredients = [ing({ id: '1', inStock: true }), ing({ id: '2', inStock: false })];
            state.showInStockOnly = true;
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('showInCartOnly : ne garde que les ingrédients au panier', () => {
            state.ingredients = [ing({ id: '1', inCart: true }), ing({ id: '2', inCart: false })];
            state.showInCartOnly = true;
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('CUMUL des deux toggles : un ingrédient doit satisfaire les DEUX conditions', () => {
            state.ingredients = [
                ing({ id: 'les-deux', inStock: true, inCart: true }),
                ing({ id: 'stock-seul', inStock: true, inCart: false }),
                ing({ id: 'panier-seul', inStock: false, inCart: true })
            ];
            state.showInStockOnly = true;
            state.showInCartOnly = true;
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['les-deux']);
        });
    });

    describe('filtres exclusifs — pinned / frozen (remplacent la catégorie)', () => {
        it('filter="pinned" : ne garde que les épinglés, quelle que soit leur catégorie', () => {
            state.ingredients = [
                ing({ id: '1', pinned: true, category: 'Fruits' }),
                ing({ id: '2', pinned: false, category: 'Légumes' })
            ];
            state.filter = 'pinned';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('filter="frozen" : ne garde que les surgelés', () => {
            state.ingredients = [
                ing({ id: '1', frozen: true }),
                ing({ id: '2', frozen: false })
            ];
            state.filter = 'frozen';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('un filtre de CATÉGORIE classique reste inchangé (non-régression)', () => {
            state.ingredients = [
                ing({ id: '1', category: 'Fruits' }),
                ing({ id: '2', category: 'Légumes' })
            ];
            state.filter = 'Fruits';
            expect(getFilteredIngredients().map(i => i.id)).toEqual(['1']);
        });

        it('liste vide : ne plante pas, renvoie []', () => {
            state.ingredients = [];
            expect(getFilteredIngredients()).toEqual([]);
        });
    });

    // LOT 013 — audit adversarial du diff : la matrice de couverture citait un test de
    // debounce GÉNÉRIQUE (helpers.test.js) et un test SANS RAPPORT (anti-autofill,
    // keyboard-gestures.test.js) pour l'acquis LOT 005 « la recherche ne filtre qu'après
    // 200 ms » — `_renderPantryDebounced` (js/app.js:867) n'était en réalité exercé par
    // AUCUN test. Comblé ici, directement sur le mécanisme réel.
    describe('la grille attend 200 ms avant de refléter la recherche (LOT 005, debounce réel)', () => {
        beforeEach(() => {
            setupTestDOM('pantry');
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('ne filtre PAS immédiatement, filtre après 200 ms', () => {
            state.ingredients = [ing({ id: '1', name: 'Tomate' }), ing({ id: '2', name: 'Carotte' })];
            // Rendu initial synchrone (les DEUX ingrédients), pour avoir un état de départ
            // observable AVANT que le debounce de la recherche n'entre en jeu.
            window.switchView('pantry');
            expect(document.querySelectorAll('#ing-grid [data-ing-id]').length).toBe(2);

            window.handleSearch('tomate');
            // Pas encore : la grille reflète toujours les DEUX ingrédients.
            expect(document.querySelectorAll('#ing-grid [data-ing-id]').length).toBe(2);

            vi.advanceTimersByTime(200);
            expect(document.querySelectorAll('#ing-grid [data-ing-id]').length).toBe(1);
            expect(document.querySelector('#ing-grid [data-ing-id]').dataset.ingId).toBe('1');
        });
    });

    // FAUX VERROU FV-9 (audit adversarial du 2026-07-31, mutation M39) : `renderPantryFilters`
    // (js/app.js:763-817) n'était référencé par AUCUN test — `grep "filter-chip\|data-filter"
    // tests/` renvoyait 0 résultat. Les ancres `data-testid="filter-chip"` / `data-filter`
    // avaient pourtant été posées dans le code de production au titre de l'ÉCART 1 du LOT 013,
    // autorisé par Joel : la dérogation avait été prise pour une couverture jamais écrite.
    // Ce bloc consomme enfin ces ancres et fige le comportement des puces.
    //
    // La fonction n'est ni exportée ni exposée : on l'atteint par son vrai chemin d'appel,
    // `switchView('pantry')` → stateUpdated → renderCurrentView → renderPantry.
    describe('puces de filtre de l\'inventaire (renderPantryFilters)', () => {
        beforeEach(() => {
            setupTestDOM('pantry');
            state.ingredients = [ing({ id: '1', name: 'Tomate' })];
        });

        function puces() {
            return [...document.querySelectorAll('#pantry-filters [data-testid="filter-chip"]')];
        }
        function puce(filtre) {
            return puces().find(p => p.dataset.filter === filtre);
        }

        it('affiche « Tous », les 2 toggles, les 2 filtres exclusifs et toutes les catégories', () => {
            window.switchView('pantry');

            expect(puce('all')).toBeTruthy();
            expect(puce('showInStockOnly')).toBeTruthy();
            expect(puce('showInCartOnly')).toBeTruthy();
            expect(puce('pinned')).toBeTruthy();
            expect(puce('frozen')).toBeTruthy();
            // Une puce par catégorie, sans doublon ni manque (SSOT src/data.js).
            const categories = puces().map(p => p.dataset.filter);
            CATEGORIES.forEach(cat => expect(categories).toContain(cat));
            expect(puces().length).toBe(5 + CATEGORIES.length);
        });

        it('« Tous » est allumée quand aucun filtre n\'est actif', () => {
            window.switchView('pantry');
            expect(puce('all').className).toContain('active');
        });

        // LE CŒUR DE FV-9 : la mutation M39 retirait `&& !showInStockOnly && !showInCartOnly`
        // de la condition (js/app.js:785). « Tous » restait alors allumée alors qu'un toggle
        // était actif — un voyant menteur — et aucun test ne bronchait.
        it('« Tous » s\'ÉTEINT dès qu\'un toggle est actif, même si la catégorie reste « all »', () => {
            state.filter = 'all';
            state.showInStockOnly = true;
            window.switchView('pantry');

            expect(puce('all').className).not.toContain('active');
            expect(puce('showInStockOnly').className).toContain('active');
        });

        it('« Tous » s\'éteint aussi sur le toggle liste de courses', () => {
            state.filter = 'all';
            state.showInCartOnly = true;
            window.switchView('pantry');

            expect(puce('all').className).not.toContain('active');
            expect(puce('showInCartOnly').className).toContain('active');
        });

        it('un filtre exclusif allume sa propre puce et éteint « Tous »', () => {
            state.filter = 'pinned';
            window.switchView('pantry');

            expect(puce('pinned').className).toContain('active');
            expect(puce('all').className).not.toContain('active');
            expect(puce('frozen').className).not.toContain('active');
        });

        it('une catégorie sélectionnée allume sa puce, et elle seule', () => {
            state.filter = 'Fruits';
            window.switchView('pantry');

            expect(puce('Fruits').className).toContain('active');
            expect(puces().filter(p => p.className.includes('active')).length).toBe(1);
        });
    });
});
