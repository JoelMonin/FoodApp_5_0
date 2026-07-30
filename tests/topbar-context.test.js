/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../src/state.js';
import {
    renderTopbar,
    updateBadges,
    addIngredient,
    addIngredientFromDb,
    addExtraIngredient,
    saveApiKey,
    openEnhancedCartPicker,
    confirmRecipeToCart
} from '../js/app.js';
import { toggleStock, toggleCart, deleteIngredient, removeFromCart } from '../src/actions.js';

// LOT 012, zone C — la zone la plus sensible : barre supérieure contextuelle restaurée
// (oracle `updateTopbar`, l.4520-4579) SANS écraser le voyant de synchro mobile posé
// par le LOT 007 (mise à jour chirurgicale, jamais un `innerHTML=` en bloc comme
// l'oracle). Plus : retour auto après ajout, compteur de la barre latérale, resets de
// `shoppingSource`, toasts panier/suppression, suppression de clé API possible.

function setupTopbarDom() {
    document.body.innerHTML = `
        <div id="topbar-title"></div>
        <div class="tb-search" id="tb-search-wrap"><input id="search-input"></div>
        <div class="header-actions"><div id="top-action-btn"></div></div>
        <div class="mh-sub" id="mh-subtitle"></div>
        <div class="mh-icons">
            <div id="sync-indicator-mobile" class="sync-indicator">
                <span class="sync-label">Cloud Sync</span>
            </div>
            <div class="mh-icon" id="mh-context-icon" style="display:none"></div>
        </div>
        <div id="sb-label-principal"></div>
        <div id="mobile-search"></div>
    `;
}

function ingredient(over = {}) {
    return { id: 'i1', name: 'Tomate', category: 'Légumes', emoji: '🍅', inStock: false, inCart: false, ...over };
}

describe('LOT 012 / zone C — barre supérieure contextuelle', () => {
    beforeEach(() => {
        setupTopbarDom();
        state.ingredients = [];
        state.favorites = [];
        state.search = '';
    });

    it('titres et sous-titres exacts de l\'oracle par vue', () => {
        state.ingredients = [ingredient({ inStock: true }), ingredient({ id: 'i2', inStock: false })];
        renderTopbar('pantry');
        expect(document.getElementById('topbar-title').textContent).toBe('Inventaire1 en stock');

        state.ingredients = [ingredient({ inCart: true })];
        renderTopbar('shopping');
        expect(document.getElementById('topbar-title').textContent).toBe('Liste de courses1 article');

        state.favorites = [{ id: 'f1' }, { id: 'f2' }];
        renderTopbar('favorites');
        expect(document.getElementById('topbar-title').textContent).toBe('Recettes favorites2 recettes');
    });

    it('sous-titre "ai" : espace correctement placé pour 1 ingrédient (typo oracle corrigée)', () => {
        state.ingredients = [ingredient({ inStock: true })];
        renderTopbar('ai');
        expect(document.getElementById('topbar-title').textContent).toBe('Recettes IAbasé sur 1 ingrédient en stock');
    });

    it('barre de recherche desktop visible seulement sur l\'inventaire', () => {
        renderTopbar('pantry');
        expect(document.getElementById('tb-search-wrap').style.display).toBe('flex');
        renderTopbar('shopping');
        expect(document.getElementById('tb-search-wrap').style.display).toBe('none');
    });

    it('bouton d\'action contextuel : un seul bouton ＋ sur l\'inventaire, pas de doublon', () => {
        renderTopbar('pantry');
        const btns = document.querySelectorAll('#top-action-btn button');
        expect(btns.length).toBe(1);
        expect(btns[0].textContent).toBe('＋');
        expect(btns[0].className).toContain('tb-btn-add');
    });

    it('bouton d\'action contextuel : Copier + Vider sur la liste de courses', () => {
        renderTopbar('shopping');
        const btns = [...document.querySelectorAll('#top-action-btn button')];
        expect(btns.map(b => b.textContent)).toEqual(['📋 Copier', '🗑️ Vider']);
    });

    it('bouton d\'action contextuel vide hors pantry/shopping/ai/favorites', () => {
        renderTopbar('export');
        expect(document.getElementById('top-action-btn').children.length).toBe(0);
    });

    it('clic sur le ＋ contextuel change bien de vue (switchView)', () => {
        renderTopbar('pantry');
        document.querySelector('#top-action-btn button').click();
        expect(state.currentView).toBe('add');
    });

    it("ne recrée JAMAIS #sync-indicator-mobile — protège l'état du LOT 007 à travers plusieurs rendus", () => {
        const syncEl = document.getElementById('sync-indicator-mobile');
        syncEl.classList.add('thinking'); // simule une synchro en cours

        renderTopbar('pantry');
        renderTopbar('ai');
        renderTopbar('favorites');
        renderTopbar('shopping');

        expect(document.getElementById('sync-indicator-mobile')).toBe(syncEl); // même nœud
        expect(syncEl.classList.contains('thinking')).toBe(true); // jamais réinitialisé
    });

    it("icône mobile contextuelle : visible et pertinente sur pantry/ai/favorites, masquée ailleurs", () => {
        renderTopbar('pantry');
        expect(document.getElementById('mh-context-icon').textContent).toBe('+');
        expect(document.getElementById('mh-context-icon').style.display).not.toBe('none');

        renderTopbar('shopping');
        expect(document.getElementById('mh-context-icon').style.display).toBe('none');

        renderTopbar('ai');
        expect(document.getElementById('mh-context-icon').textContent).toBe('⚙️');
    });

    it('compteur "Principal (N ingrédients)" de la barre latérale mis à jour', () => {
        state.ingredients = [ingredient(), ingredient({ id: 'i2' }), ingredient({ id: 'i3' })];
        updateBadges();
        expect(document.getElementById('sb-label-principal').textContent).toBe('Principal (3 ingrédients)');
    });
});

describe('LOT 012 / zone C — retour auto, emoji deviné, clé API', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="add-name" value="Poireau">
            <input id="add-emoji" value="">
            <select id="add-category"><option value="Légumes" selected>Légumes</option></select>
            <input type="checkbox" id="add-frozen">
            <div id="add-results-list"></div>
            <input id="api-key-input" value="">
        `;
        state.ingredients = [];
        state.extraIngredients = [];
        state.currentView = 'add';
    });

    it("retour automatique à l'inventaire 500 ms après un ajout réussi", () => {
        vi.useFakeTimers();
        try {
            addIngredient();
            expect(state.currentView).toBe('add'); // pas encore
            vi.advanceTimersByTime(500);
            expect(state.currentView).toBe('pantry');
        } finally {
            vi.useRealTimers();
        }
    });

    it("retour automatique aussi depuis l'ajout par suggestion d'autocomplétion " +
       "(addIngredientFromDb) — même geste qu'un ajout manuel du point de vue de Joel, " +
       "trouvé par l'audit du diff final", () => {
        vi.useFakeTimers();
        try {
            addIngredientFromDb({ name: 'Céleri', emoji: '🥬', category: 'Légumes' });
            expect(state.currentView).toBe('add'); // pas encore
            vi.advanceTimersByTime(500);
            expect(state.currentView).toBe('pantry');
        } finally {
            vi.useRealTimers();
        }
    });

    it("l'ingrédient hors stock reçoit un emoji deviné, plus jamais l'étoile fixe", () => {
        document.body.innerHTML = `<input id="ez-input" value="Basilic">`;
        state.extraIngredients = [];

        addExtraIngredient();

        const added = state.extraIngredients.find(e => e.name === 'Basilic');
        expect(added.emoji).not.toBe('✨');
        expect(added.emoji).toBeTruthy();
    });

    it("vider le champ clé API puis Sauver efface la clé (l'oracle l'acceptait, l'ancien code le refusait)", () => {
        state.aiConfig = { apiKey: 'ancienne-cle' };
        document.getElementById('api-key-input').value = '   ';

        saveApiKey();

        expect(state.aiConfig.apiKey).toBe('');
        expect(document.querySelector('.toast')?.textContent).toBe('Clé API supprimée');
    });

    it('une vraie clé API se sauvegarde toujours normalement', () => {
        state.aiConfig = { apiKey: '' };
        document.getElementById('api-key-input').value = 'nouvelle-cle';

        saveApiKey();

        expect(state.aiConfig.apiKey).toBe('nouvelle-cle');
        expect(document.querySelector('.toast')?.textContent).toBe('Clé API sauvegardée ✓');
    });
});

describe('LOT 012 / zone C — shoppingSource et toasts (src/actions.js)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        state.ingredients = [];
    });

    it('toggleStock remet shoppingSource à zéro quand un article redevient en stock', () => {
        state.ingredients = [ingredient({ inStock: false, inCart: true, shoppingSource: 'Ma Recette' })];
        toggleStock('i1');
        expect(state.ingredients[0].shoppingSource).toBeNull();
    });

    it('toggleStock ne toaste jamais (vérifié à l\'audit : l\'oracle non plus)', () => {
        state.ingredients = [ingredient()];
        toggleStock('i1');
        expect(document.querySelector('.toast')).toBeNull();
    });

    it('toggleCart toaste ajout ET retrait', () => {
        state.ingredients = [ingredient({ inCart: false })];
        toggleCart('i1');
        expect(document.querySelector('.toast')?.textContent).toBe('🍅 Tomate ajouté à la liste');

        document.body.innerHTML = '';
        toggleCart('i1');
        expect(document.querySelector('.toast')?.textContent).toBe('Tomate retiré de la liste');
    });

    it('deleteIngredient toaste la suppression', () => {
        state.ingredients = [ingredient()];
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        deleteIngredient('i1');

        expect(document.querySelector('.toast')?.textContent).toBe('🗑️ Tomate supprimé');
        vi.restoreAllMocks();
    });

    it('removeFromCart remet shoppingSource à zéro', () => {
        state.ingredients = [ingredient({ inCart: true, shoppingSource: 'Ma Recette' })];
        removeFromCart('i1', 'db');
        expect(state.ingredients[0].shoppingSource).toBeNull();
    });
});
