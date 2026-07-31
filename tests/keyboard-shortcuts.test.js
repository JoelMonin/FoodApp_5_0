/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, resetTestState } from './_helpers/dom-helpers.js';
import { initKeyboardShortcuts, openEnhancedCartPicker } from '../js/app.js';

// LOT 014, volet A — TESTS DE CARACTÉRISATION de `initKeyboardShortcuts`, dernière fonction
// de la liste des zones aveugles (§B10 de la phase découverte) à n'avoir AUCUN test.
//
// Elle n'était pas testable jusqu'ici : elle n'est câblée qu'au démarrage, et
// `DOMContentLoaded` ne se déclenche jamais sous Vitest (`document.readyState` vaut déjà
// 'complete' à l'import du module). Elle est donc exportée pour les tests, comme les blocs
// LOT 009/010 avant elle. Exporter ne change aucun comportement.
//
// Ces tests sont écrits AVANT de retirer la branche morte « ajout groupé » : ils prouvent que
// les trois autres raccourcis survivent au retrait.

// La fonction pose un écouteur sur `window` À CHAQUE appel : l'installer une seule fois pour
// tout le fichier, sinon un Enter déclencherait son action autant de fois qu'il y a d'appels.
let installe = false;

function frappe(touche) {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: touche }));
}

function modaleOuverte(id) {
    const el = document.createElement('div');
    el.className = 'modal-overlay open';
    el.id = id;
    document.body.appendChild(el);
    return el;
}

describe('LOT 014 §A — initKeyboardShortcuts (caractérisation)', () => {
    beforeEach(() => {
        setupTestDOM(['add', 'picker', 'pantry']);
        resetTestState(state, shoppingChecked, defaultAiConfig);
        if (!installe) { initKeyboardShortcuts(); installe = true; }
    });

    it('Échap ferme TOUTES les modales ouvertes, pas seulement la dernière', () => {
        const a = modaleOuverte('modal-api-config');
        const b = modaleOuverte('modal-recipe-detail');
        const fermee = modaleOuverte('modal-edit-emoji');
        fermee.classList.remove('open'); // déjà fermée : ne doit pas gêner

        frappe('Escape');

        expect(a.classList.contains('open')).toBe(false);
        expect(b.classList.contains('open')).toBe(false);
    });

    it('Échap sans aucune modale ouverte ne lève pas', () => {
        expect(() => frappe('Escape')).not.toThrow();
    });

    it('Entrée sur la modale « clé API » enregistre la clé saisie', () => {
        const modale = modaleOuverte('modal-api-config');
        const champ = document.createElement('input');
        champ.id = 'api-key-input';
        champ.value = '  CLE_TAPEE_AU_CLAVIER  '; // espaces : doivent être rognés
        modale.appendChild(champ);

        frappe('Enter');

        expect(state.aiConfig.apiKey).toBe('CLE_TAPEE_AU_CLAVIER');
        expect(modale.classList.contains('open')).toBe(false); // la modale se referme
    });

    it('Entrée sur le sélecteur de courses valide la sélection', () => {
        // `inStock: false` : le sélecteur ne pré-coche QUE les manquants
        // (`checked = it.isMissing`) — on n'ajoute pas à sa liste ce qu'on possède déjà.
        state.ingredients = [
            { id: 'i1', name: 'Carotte', emoji: '🥕', category: 'Légumes', inStock: false, inCart: false }
        ];
        const modale = modaleOuverte('modal-recipe-to-cart');
        // Le sélecteur se construit dans #modal-recipe-cart-list, hors de la modale factice :
        // c'est bien ce que fait la vraie page, où la liste vit DANS la modale statique.
        modale.appendChild(document.getElementById('modal-recipe-cart-list'));
        openEnhancedCartPicker({ name: 'Soupe', ingredients: [{ n: 'Carotte', c: 'Légumes' }] });

        frappe('Enter');

        expect(state.ingredients.find(i => i.name === 'Carotte').inCart).toBe(true);
    });

    it('Entrée dans la vue « Ajouter », SANS modale ouverte, valide le formulaire', () => {
        state.currentView = 'add';
        document.getElementById('add-name').value = 'Salsifis';

        frappe('Enter');

        expect(state.ingredients.some(i => i.name === 'Salsifis')).toBe(true);
    });

    it('Entrée dans la vue « Ajouter » est IGNORÉE tant qu\'une modale est ouverte', () => {
        state.currentView = 'add';
        document.getElementById('add-name').value = 'Salsifis';
        modaleOuverte('modal-recipe-detail'); // modale sans action associée

        frappe('Enter');

        // La modale prend la priorité : le formulaire n'est pas validé dans son dos.
        expect(state.ingredients.some(i => i.name === 'Salsifis')).toBe(false);
    });

    it('Entrée hors de la vue « Ajouter » et sans modale ne fait rien', () => {
        state.currentView = 'pantry';
        document.getElementById('add-name').value = 'Salsifis';

        frappe('Enter');

        expect(state.ingredients.some(i => i.name === 'Salsifis')).toBe(false);
    });

    it('une autre touche ne déclenche rien', () => {
        state.currentView = 'add';
        document.getElementById('add-name').value = 'Salsifis';
        const modale = modaleOuverte('modal-api-config');

        frappe('a');

        expect(state.ingredients.some(i => i.name === 'Salsifis')).toBe(false);
        expect(modale.classList.contains('open')).toBe(true);
    });
});
