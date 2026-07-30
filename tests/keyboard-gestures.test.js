/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../src/state.js';
import {
    initFieldEnterShortcuts,
    initChipsRowTouchScroll,
    initSearchAutofillGuard,
    clearSearch
} from '../js/app.js';

// LOT 012, zone B — clavier et gestes. Oracle : Entrée sur #ez-input (l.6744) et
// #paste-title (l.6746), touchmove passif sur .chips-row (l.6790-6793), anti-autofill
// (l.6773-6781). Zéro test clavier ne préexistait dans le dépôt (phase découverte).

describe('LOT 012 / zone B — clavier et gestes', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        state.ingredients = [];
        state.extraIngredients = [];
        state.search = '';
    });

    it("Entrée dans #ez-input ajoute l'ingrédient hors stock", () => {
        document.body.innerHTML = `<input id="ez-input" value="Basilic">`;
        initFieldEnterShortcuts();

        document.getElementById('ez-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(state.extraIngredients.some(e => e.name === 'Basilic')).toBe(true);
    });

    it("une autre touche que Entrée dans #ez-input n'ajoute rien", () => {
        document.body.innerHTML = `<input id="ez-input" value="Basilic">`;
        initFieldEnterShortcuts();

        document.getElementById('ez-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

        expect(state.extraIngredients.length).toBe(0);
    });

    it('Entrée dans #paste-title met le focus sur #paste-content', () => {
        document.body.innerHTML = `
            <input id="paste-title">
            <textarea id="paste-content"></textarea>
        `;
        initFieldEnterShortcuts();

        document.getElementById('paste-title').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(document.activeElement).toBe(document.getElementById('paste-content'));
    });

    it('touchmove sur .chips-row stoppe la propagation — le scroll horizontal des filtres ' +
       'ne remonte plus faire défiler toute la page (mobile)', () => {
        document.body.innerHTML = `
            <div class="outer">
                <div class="chips-row"><button>Chip</button></div>
            </div>
        `;
        let bubbledToOuter = false;
        document.querySelector('.outer').addEventListener('touchmove', () => { bubbledToOuter = true; });

        initChipsRowTouchScroll();
        document.querySelector('.chips-row').dispatchEvent(new Event('touchmove', { bubbles: true }));

        expect(bubbledToOuter).toBe(false);
    });

    it("vide les barres de recherche ~100ms après le démarrage (anti-autofill du navigateur)", () => {
        document.body.innerHTML = `
            <input id="search-input" value="pré-rempli">
            <input id="mobile-search" value="pré-rempli">
        `;
        state.search = 'pré-rempli';

        vi.useFakeTimers();
        try {
            initSearchAutofillGuard();
            expect(document.getElementById('search-input').value).toBe('pré-rempli'); // pas encore

            vi.advanceTimersByTime(100);

            expect(document.getElementById('search-input').value).toBe('');
            expect(document.getElementById('mobile-search').value).toBe('');
            expect(state.search).toBe('');
        } finally {
            vi.useRealTimers();
        }
    });
});
