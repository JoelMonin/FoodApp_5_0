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

describe('LOT 010 / C12 — filet de sécurité emoji ingrédient', () => {
    beforeEach(() => {
        setupModalDom();
        state.ingredients = [];
    });

    it('un vrai emoji renvoyé par l\'IA est conservé tel quel', () => {
        openEnhancedCartPicker(recette([{ n: 'Saumon', q: '200 g', e: '🐟', c: 'Poissons' }]));

        expect(document.getElementById('modal-recipe-cart-list').textContent).toContain('🐟');
    });

    it('une UNITÉ renvoyée par erreur dans le champ emoji ("g") n\'est JAMAIS affichée ' +
       'à l\'écran — c\'est exactement le défaut constaté par Joel', () => {
        openEnhancedCartPicker(recette([{ n: 'Saumon (fumé)', q: '200', e: 'g', c: 'Poissons' }]));

        const texte = document.getElementById('modal-recipe-cart-list').textContent;
        expect(texte).not.toMatch(/^g\s|>\s*g\s/); // pas de "g" orphelin en tête de ligne
        expect(texte).toContain('Saumon (fumé)');
    });

    it('« pièce » dans le champ emoji retombe sur la déduction automatique, pas sur le texte brut', () => {
        openEnhancedCartPicker(recette([{ n: 'Oignon', q: '2', e: 'pièce', c: 'Légumes' }]));

        const texte = document.getElementById('modal-recipe-cart-list').textContent;
        expect(texte).not.toContain('pièce Oignon');
        expect(texte).toContain('Oignon');
    });

    it('« ml », « brins » et autres unités textuelles sont pareillement filtrées', () => {
        openEnhancedCartPicker(recette([
            { n: 'Crème', q: '200', e: 'ml', c: 'Crèmerie' },
            { n: 'Thym', q: '4', e: 'brins', c: 'Herbes' }
        ]));

        const texte = document.getElementById('modal-recipe-cart-list').textContent;
        expect(texte).not.toContain('ml Crème');
        expect(texte).not.toContain('brins Thym');
    });

    it('emoji absent : reprend la déduction automatique existante (comportement inchangé)', () => {
        state.ingredients = [];
        openEnhancedCartPicker(recette([{ n: 'Tomate', q: '3', c: 'Légumes' }]));

        // Pas de crash, un emoji quelconque est rendu (déduit par autoEmoji/catégorie).
        expect(document.getElementById('modal-recipe-cart-list').textContent).toContain('Tomate');
    });
});
