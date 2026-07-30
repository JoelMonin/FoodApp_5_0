/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import {
    renderExtraChips,
    updateAIContextSub,
    refreshImposedZone,
    removeExtraIngredient,
    addExtraIngredient
} from '../js/app.js';

// LOT 010 — casse C10 : un ingrédient épinglé était envoyé à l'IA mais invisible et
// non retirable depuis l'écran Recettes IA ; le sous-titre restait figé. Porté depuis
// l'oracle (`renderImposedZone`, `updateAIContextSub`, foodapp-v5-Joel.html
// l.4875-4953), avec un dépassement volontaire assumé (rafraîchi aussi après
// épinglage — l'oracle l'oubliait, cf. fiche LOT 010 §3).

function ingredient(id, name, pinned = false) {
    return { id, name, emoji: '🥕', category: 'Autres', pinned, inStock: true, inCart: false };
}

describe('LOT 010 / C10 — zone « Ingrédients imposés » + sous-titre vivant', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="pz-chips" id="imposed-chips"></div>
            <div class="ai-box-sub" id="ai-context-sub"></div>
            <input id="ez-input" value="">
        `;
        state.ingredients = [];
        state.extraIngredients = [];
    });

    describe('renderExtraChips (zone)', () => {
        it('affiche le message vide quand rien n\'est imposé', () => {
            renderExtraChips();
            expect(document.querySelector('.pz-empty')?.textContent).toBe('Aucun ingrédient imposé');
        });

        it('affiche les épinglés dans « Dans l\'inventaire », avec emoji et croix', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];

            renderExtraChips();

            expect(document.querySelector('.pz-label')?.textContent).toBe("📍 Dans l'inventaire");
            const chip = document.querySelector('.pz-chip');
            expect(chip?.textContent).toContain('🥕');
            expect(chip?.textContent).toContain('Tomate');
            expect(document.querySelector('.pz-chip-del')).not.toBeNull();
        });

        it('affiche les extras dans « Hors inventaire »', () => {
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];

            renderExtraChips();

            expect(document.querySelector('.ez-label')?.textContent).toBe('🛒 Hors inventaire');
            expect(document.querySelector('.ez-chip')?.textContent).toContain('Gambas');
        });

        it('affiche les deux sections simultanément — le cas que l\'ancien code ne savait pas faire', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];

            renderExtraChips();

            expect(document.querySelectorAll('.pz-chip').length).toBe(1);
            expect(document.querySelectorAll('.ez-chip').length).toBe(1);
        });

        it('la croix d\'un épinglé le désépingle réellement (pas seulement visuel)', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            renderExtraChips();

            document.querySelector('.pz-chip-del').click();

            expect(state.ingredients[0].pinned).toBe(false);
        });

        it('la croix d\'un extra le retire de la liste', () => {
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];
            renderExtraChips();

            document.querySelector('.ez-chip-del').click();

            expect(state.extraIngredients).toHaveLength(0);
        });

        it('ne produit AUCUNE puce `.chip` — le sélecteur générique `.ai-settings .chip` de ' +
           'restoreAIConfig ne doit plus jamais la capter (bug préexistant confirmé par ' +
           'l\'audit du 2026-07-30, corrigé en passant par ce chantier)', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];

            renderExtraChips();

            expect(document.querySelectorAll('.chip').length).toBe(0);
        });

        it('ne casse pas si le conteneur est absent de la page', () => {
            document.body.innerHTML = '';
            expect(() => renderExtraChips()).not.toThrow();
        });
    });

    describe('updateAIContextSub (sous-titre vivant)', () => {
        it('affiche le stock seul quand rien n\'est épinglé ni hors stock', () => {
            state.ingredients = [ingredient('i1', 'Tomate'), ingredient('i2', 'Pomme')];
            state.ingredients.forEach(i => i.inStock = true);

            updateAIContextSub();

            expect(document.getElementById('ai-context-sub').textContent).toBe('2 ingrédients en stock');
        });

        it('masque le segment épinglé(s) quand son compteur vaut 0 (règle exacte de l\'oracle)', () => {
            state.ingredients = [ingredient('i1', 'Tomate')];
            state.ingredients[0].inStock = true;
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];

            updateAIContextSub();

            const text = document.getElementById('ai-context-sub').textContent;
            expect(text).not.toContain('épinglé');
            expect(text).toContain('1 hors stock');
        });

        it('affiche les trois segments avec les pluriels exacts au-delà de 1', () => {
            state.ingredients = [
                ingredient('i1', 'Tomate', true), ingredient('i2', 'Pomme', true),
                ingredient('i3', 'Poire')
            ];
            state.ingredients.forEach(i => i.inStock = true);
            state.extraIngredients = [
                { id: 'e1', name: 'Gambas', emoji: '🦐' },
                { id: 'e2', name: 'Basilic', emoji: '🌿' }
            ];

            updateAIContextSub();

            expect(document.getElementById('ai-context-sub').textContent)
                .toBe('3 ingrédients en stock · 2 épinglés · 2 hors stock');
        });

        it('singulier exact à 1 sur chaque segment', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            state.ingredients[0].inStock = true;
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];

            updateAIContextSub();

            expect(document.getElementById('ai-context-sub').textContent)
                .toBe('1 ingrédient en stock · 1 épinglé · 1 hors stock');
        });

        it('ne casse pas si le sous-titre est absent de la page', () => {
            document.body.innerHTML = '';
            expect(() => updateAIContextSub()).not.toThrow();
        });
    });

    describe('Rafraîchissement après action — le cœur de la casse C10', () => {
        it('ajouter un extra rafraîchit ET la zone ET le sous-titre dans le même geste ' +
           '(dépassement volontaire de l\'oracle, assumé dans la fiche du lot)', () => {
            document.getElementById('ez-input').value = 'Gambas';

            addExtraIngredient();

            expect(document.querySelector('.ez-chip')?.textContent).toContain('Gambas');
            expect(document.getElementById('ai-context-sub').textContent).toContain('1 hors stock');
        });

        it('retirer un extra fait disparaître la puce ET met à jour le sous-titre', () => {
            state.extraIngredients = [{ id: 'e1', name: 'Gambas', emoji: '🦐' }];
            refreshImposedZone();
            expect(document.getElementById('ai-context-sub').textContent).toContain('1 hors stock');

            removeExtraIngredient('e1');

            expect(document.querySelectorAll('.ez-chip').length).toBe(0);
            expect(document.getElementById('ai-context-sub').textContent).not.toContain('hors stock');
        });

        it('supprimer un ingrédient épinglé de l\'état (hors zone) puis rafraîchir ne le ' +
           'montre plus — la zone lit toujours l\'état vivant, jamais une copie', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            refreshImposedZone();
            expect(document.querySelector('.pz-chip')).not.toBeNull();

            state.ingredients = state.ingredients.filter(i => i.id !== 'i1');
            refreshImposedZone();

            expect(document.querySelector('.pz-chip')).toBeNull();
            expect(document.getElementById('ai-context-sub').textContent).not.toContain('épinglé');
        });

        it('chemin complet réel : cliquer la croix d\'un épinglé sur la vue IA active fait ' +
           'disparaître la puce ET met à jour le sous-titre — pas seulement le booléen d\'état ' +
           '(durcissement demandé par l\'audit Codex Terra du 2026-07-30)', () => {
            state.currentView = 'ai';
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            refreshImposedZone();
            expect(document.querySelector('.pz-chip')).not.toBeNull();
            expect(document.getElementById('ai-context-sub').textContent).toContain('épinglé');

            document.querySelector('.pz-chip-del').click();

            expect(document.querySelector('.pz-chip')).toBeNull();
            expect(document.getElementById('ai-context-sub').textContent).not.toContain('épinglé');
        });

        it('un épinglé seul, sans aucun extra, n\'affiche PAS le segment « hors stock » ' +
           '(durcissement Codex Terra : cas symétrique au précédent, non couvert)', () => {
            state.ingredients = [ingredient('i1', 'Tomate', true)];
            state.extraIngredients = [];

            refreshImposedZone();

            const text = document.getElementById('ai-context-sub').textContent;
            expect(text).toContain('épinglé');
            expect(text).not.toContain('hors stock');
        });
    });
});
