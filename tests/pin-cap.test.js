/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state } from '../src/state.js';
import { togglePin } from '../src/actions.js';
import { MAX_PINNED_INGREDIENTS, MAX_EXTRA_INGREDIENTS } from '../src/constants.js';
import { renderImposedCapHint, addExtraIngredient } from '../js/app.js';

// LOT 010 — casse C9 : le plafond « max 6 épinglés » avait disparu à la migration,
// alors que l'interface continuait de l'annoncer. Règles exactes issues de l'oracle
// (`foodapp-v5-Joel.html` l.4733-4742) et durcies par l'audit de spec :
// le refus ne porte QUE sur un nouvel épinglage, le désépinglage reste toujours
// autorisé, et les épinglés déjà présents ne sont JAMAIS tronqués d'office.

const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

function ingredient(n, pinned = false) {
    return { id: `ing_${n}`, name: `Ingrédient ${n}`, category: 'Autres', emoji: '🥕', pinned, inStock: true, inCart: false };
}

function peupler(nbEpingles, total = 10) {
    state.ingredients = Array.from({ length: total }, (_, i) => ingredient(i + 1, i < nbEpingles));
}

function compterEpingles() {
    return state.ingredients.filter(i => i.pinned).length;
}

describe('LOT 010 / C9 — plafond des ingrédients épinglés', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        state.ingredients = [];
        state.extraIngredients = [];
    });

    describe('La règle', () => {
        it('épingler reste possible sous le plafond', () => {
            peupler(MAX_PINNED_INGREDIENTS - 1);

            togglePin('ing_10');

            expect(compterEpingles()).toBe(MAX_PINNED_INGREDIENTS);
            expect(state.ingredients.find(i => i.id === 'ing_10').pinned).toBe(true);
        });

        it('épingler un ingrédient de plus AU plafond est refusé', () => {
            peupler(MAX_PINNED_INGREDIENTS);

            togglePin('ing_10');

            expect(state.ingredients.find(i => i.id === 'ing_10').pinned).toBe(false);
            expect(compterEpingles()).toBe(MAX_PINNED_INGREDIENTS);
        });

        it('le refus affiche le message exact de l\'oracle', () => {
            peupler(MAX_PINNED_INGREDIENTS);

            togglePin('ing_10');

            const toastEl = document.querySelector('.toast');
            expect(toastEl?.textContent).toBe(`Maximum ${MAX_PINNED_INGREDIENTS} ingrédients épinglés`);
            expect(toastEl?.className).toContain('error');
        });

        it('les messages de succès reprennent ceux de l\'oracle', () => {
            peupler(0);

            togglePin('ing_1');
            expect(document.querySelector('.toast')?.textContent).toBe('📌 Ingrédient 1 épinglé pour l\'IA');

            document.body.innerHTML = '';
            togglePin('ing_1');
            expect(document.querySelector('.toast')?.textContent).toBe('Ingrédient 1 désépinglé');
        });

        it('un identifiant inconnu ne fait rien et n\'affiche aucun message', () => {
            peupler(2);

            togglePin('ing_inexistant');

            expect(compterEpingles()).toBe(2);
            expect(document.querySelector('.toast')).toBeNull();
        });
    });

    describe('Données déjà au-delà du plafond (le cas soulevé par l\'audit de spec)', () => {
        it('une base contenant déjà 7 épinglés n\'en perd AUCUN', () => {
            peupler(MAX_PINNED_INGREDIENTS + 1);

            // Une simple action d'épinglage ne doit pas déclencher de « normalisation ».
            togglePin('ing_10');

            expect(compterEpingles()).toBe(MAX_PINNED_INGREDIENTS + 1);
        });

        it('au-delà du plafond, le désépinglage reste possible — sans quoi l\'utilisateur ' +
           'serait définitivement coincé', () => {
            peupler(MAX_PINNED_INGREDIENTS + 1);

            togglePin('ing_1');

            expect(state.ingredients.find(i => i.id === 'ing_1').pinned).toBe(false);
            expect(compterEpingles()).toBe(MAX_PINNED_INGREDIENTS);
        });

        it('après être redescendu au plafond, un nouvel épinglage est toujours refusé', () => {
            peupler(MAX_PINNED_INGREDIENTS + 1);

            togglePin('ing_1');   // 7 → 6
            togglePin('ing_10');  // tentative de remontée

            expect(state.ingredients.find(i => i.id === 'ing_10').pinned).toBe(false);
            expect(compterEpingles()).toBe(MAX_PINNED_INGREDIENTS);
        });
    });

    describe('Plafond des « hors stock », séparé', () => {
        it('est bien distinct de celui des épinglés : 6 épinglés n\'empêchent pas un hors stock', () => {
            peupler(MAX_PINNED_INGREDIENTS);
            document.body.innerHTML = '<input id="ez-input" value="gambas">';

            addExtraIngredient();

            expect(state.extraIngredients.length).toBe(1);
        });

        it('refuse au-delà de son propre plafond, avec le message de l\'oracle', () => {
            state.extraIngredients = Array.from({ length: MAX_EXTRA_INGREDIENTS }, (_, i) => ({ id: `x${i}`, name: `Extra ${i}`, emoji: '✨' }));
            document.body.innerHTML = '<input id="ez-input" value="gambas">';

            addExtraIngredient();

            expect(state.extraIngredients.length).toBe(MAX_EXTRA_INGREDIENTS);
            expect(document.querySelector('.toast')?.textContent).toBe(`Maximum ${MAX_EXTRA_INGREDIENTS} ingrédients hors stock`);
        });
    });

    describe('Le libellé de l\'interface ne ment plus', () => {
        it('l\'ancien texte « au total » a disparu du HTML', () => {
            expect(INDEX_HTML).not.toContain('Max 6 ingrédients imposés au total');
        });

        it('aucun chiffre de plafond n\'est écrit en dur dans le HTML : le libellé est ' +
           'généré depuis la SSOT', () => {
            document.body.innerHTML = '<div id="imposed-cap-hint"></div>';

            renderImposedCapHint();

            expect(document.getElementById('imposed-cap-hint').textContent)
                .toBe(`Max ${MAX_PINNED_INGREDIENTS} épinglés + ${MAX_EXTRA_INGREDIENTS} hors stock`);
        });

        it('ne casse pas si la zone est absente de la page', () => {
            document.body.innerHTML = '';
            expect(() => renderImposedCapHint()).not.toThrow();
        });
    });
});
