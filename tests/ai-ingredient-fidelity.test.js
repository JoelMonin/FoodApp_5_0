/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { openEnhancedCartPicker } from '../js/app.js';

// LOT 010 (casse C12) — constat de Joel en usage réel (2026-07-30) : dans la liste
// de courses issue d'une recette IA, certaines lignes affichaient une UNITÉ ("g",
// "pièce", "ml", "brins") à la place de l'emoji, sans le nom en clair. Cause racine
// corrigée dans src/services/gemini.js (indications de format restaurées). Ce
// fichier fige le FILET DE SÉCURITÉ côté rendu : même si l'IA dévie à nouveau du
// format demandé, aucun texte parasite ne doit plus jamais s'afficher à la place
// d'un emoji.

function setupModalDom() {
    document.body.innerHTML = `
        <div class="modal-overlay" id="modal-recipe-detail"></div>
        <div class="modal-overlay" id="modal-recipe-to-cart"></div>
        <div class="picker-list" id="modal-recipe-cart-list"></div>
        <input type="checkbox" id="picker-select-all">
    `;
}

function recette(ingredients) {
    return { id: 'r1', name: 'Test', people: 2, ingredients };
}

// LOT 012, zone A : le nom et l'émoji sont désormais des valeurs d'input éditables
// (`pick-name-*`/`pick-emoji-*`), plus des nœuds texte bruts — `.textContent` ne les
// contient plus. On relit les `.value` des inputs rendus à la place.
function pickerEmojis() {
    return [...document.querySelectorAll('#modal-recipe-cart-list .picker-emoji-inp')].map(i => i.value);
}
function pickerNames() {
    return [...document.querySelectorAll('#modal-recipe-cart-list .picker-name-inp')].map(i => i.value);
}

describe('LOT 010 / C12 — filet de sécurité emoji ingrédient', () => {
    beforeEach(() => {
        setupModalDom();
        state.ingredients = [];
    });

    it('un vrai emoji renvoyé par l\'IA est conservé tel quel', () => {
        openEnhancedCartPicker(recette([{ n: 'Saumon', q: '200 g', e: '🐟', c: 'Poissons' }]));

        expect(pickerEmojis()).toContain('🐟');
    });

    it('une UNITÉ renvoyée par erreur dans le champ emoji ("g") n\'est JAMAIS affichée ' +
       'à l\'écran — c\'est exactement le défaut constaté par Joel', () => {
        openEnhancedCartPicker(recette([{ n: 'Saumon (fumé)', q: '200', e: 'g', c: 'Poissons' }]));

        expect(pickerEmojis()).not.toContain('g');
        expect(pickerNames()).toContain('Saumon (fumé)');
    });

    it('« pièce » dans le champ emoji retombe sur la déduction automatique, pas sur le texte brut', () => {
        openEnhancedCartPicker(recette([{ n: 'Oignon', q: '2', e: 'pièce', c: 'Légumes' }]));

        expect(pickerEmojis()).not.toContain('pièce');
        expect(pickerNames()).toContain('Oignon');
    });

    it('« ml », « brins » et autres unités textuelles sont pareillement filtrées', () => {
        openEnhancedCartPicker(recette([
            { n: 'Crème', q: '200', e: 'ml', c: 'Crèmerie' },
            { n: 'Thym', q: '4', e: 'brins', c: 'Herbes' }
        ]));

        expect(pickerEmojis()).not.toContain('ml');
        expect(pickerEmojis()).not.toContain('brins');
        expect(pickerNames()).toEqual(['Crème', 'Thym']);
    });

    it('emoji absent : reprend la déduction automatique existante (comportement inchangé)', () => {
        state.ingredients = [];
        openEnhancedCartPicker(recette([{ n: 'Tomate', q: '3', c: 'Légumes' }]));

        // Pas de crash, un emoji quelconque est rendu (déduit par autoEmoji/catégorie).
        expect(pickerNames()).toContain('Tomate');
        expect(pickerEmojis()[0]).toBeTruthy();
    });

    // Durcissement post-audit Codex Terra (2026-07-30) : le premier filet vérifiait
    // seulement qu'un emoji apparaissait QUELQUE PART dans la chaîne (`.test()` sans
    // ancrage), pas que la chaîne entière EN ÉTAIT un.
    it('une valeur MIXTE ("g🐟") est rejetée en bloc — le premier filet la laissait ' +
       'passer avec la lettre toujours collée devant l\'emoji', () => {
        openEnhancedCartPicker(recette([{ n: 'Saumon (fumé)', q: '200', e: 'g🐟', c: 'Poissons' }]));

        expect(pickerEmojis()).not.toContain('g🐟');
        expect(pickerNames()).toContain('Saumon (fumé)');
    });

    it('un emoji à présentation texte par défaut, explicitement forcé en emoji (❤️), ' +
       'est accepté — le premier filet le rejetait à tort', () => {
        openEnhancedCartPicker(recette([{ n: 'Bonbon coeur', q: '1', e: '❤️', c: 'Autres' }]));

        expect(pickerEmojis()).toContain('❤️');
    });
});
