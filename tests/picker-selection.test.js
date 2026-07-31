/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { openEnhancedCartPicker, confirmRecipeToCart } from '../js/app.js';

// LOT 014, volet A — TESTS DE CARACTÉRISATION de la SÉLECTION du sélecteur de courses,
// écrits AVANT le déplacement de la zone vers son module.
//
// `toggleAllPickerItems` et `updatePickerRow` étaient les deux dernières zones aveugles de
// cet écran : aucun test direct, alors que ce sont elles qui décident ce qui part réellement
// dans la liste de courses. `tests/picker-row-editing.test.js` (LOT 012) couvre l'ÉDITION
// d'une ligne, jamais sa sélection.

function setupModalDom() {
    // Reproduit la structure réelle d'index.html:74-80 — et notamment le fait que la case
    // maîtresse vit HORS de la liste. Si elle était dedans, elle entrerait dans le
    // `querySelectorAll` de `toggleAllPickerItems` et décalerait tous les index.
    document.body.innerHTML = `
        <div class="modal-overlay" id="modal-recipe-detail"></div>
        <div class="modal-overlay" id="modal-recipe-to-cart"></div>
        <label><input type="checkbox" id="picker-select-all"></label>
        <div class="picker-list" id="modal-recipe-cart-list"></div>
    `;
}

const recette = (ingredients) => ({ id: 'r1', name: 'Test', people: 2, ingredients });

const lignesMarquees = () =>
    [...document.querySelectorAll('#modal-recipe-cart-list .picker-item')]
        .map(el => el.classList.contains('checked'));

const casesCochees = () =>
    [...document.querySelectorAll('#modal-recipe-cart-list input[type="checkbox"]')]
        .map(c => c.checked);

describe('LOT 014 §A — sélection du sélecteur de courses (caractérisation)', () => {
    beforeEach(() => {
        setupModalDom();
        state.ingredients = [];
    });

    describe('updatePickerRow — le marquage visuel suit la case', () => {
        it('cocher une case marque SA ligne, et elle seule', () => {
            state.ingredients = [
                { id: 'i1', name: 'Tomate', emoji: '🍅', category: 'Légumes', inStock: true, inCart: false }
            ];
            // Tomate est en stock → sa ligne part DÉCOCHÉE ; Salsifis est inconnu → cochée.
            openEnhancedCartPicker(recette([
                { n: 'Tomate', c: 'Légumes' },
                { n: 'Salsifis', c: 'Légumes' }
            ]));
            expect(lignesMarquees()).toEqual([false, true]);

            document.getElementById('pick-0').checked = true;
            document.getElementById('pick-0').dispatchEvent(new window.Event('change'));

            expect(lignesMarquees()).toEqual([true, true]);
        });

        it('décocher une case retire le marquage de SA ligne', () => {
            openEnhancedCartPicker(recette([{ n: 'Salsifis', c: 'Légumes' }]));
            expect(lignesMarquees()).toEqual([true]);

            document.getElementById('pick-0').checked = false;
            document.getElementById('pick-0').dispatchEvent(new window.Event('change'));

            expect(lignesMarquees()).toEqual([false]);
        });
    });

    describe('toggleAllPickerItems — la case maîtresse', () => {
        beforeEach(() => {
            state.ingredients = [
                { id: 'i1', name: 'Tomate', emoji: '🍅', category: 'Légumes', inStock: true, inCart: false }
            ];
            openEnhancedCartPicker(recette([
                { n: 'Tomate', c: 'Légumes' },     // en stock → décochée au départ
                { n: 'Salsifis', c: 'Légumes' },   // manquant → cochée
                { n: 'Topinambour', c: 'Légumes' } // manquant → cochée
            ]));
        });

        it('l\'état de départ n\'est PAS uniforme — le cas teste bien quelque chose', () => {
            expect(casesCochees()).toEqual([false, true, true]);
        });

        it('tout cocher coche les cases ET marque les lignes correspondantes', () => {
            window.toggleAllPickerItems(true);
            expect(casesCochees()).toEqual([true, true, true]);
            expect(lignesMarquees()).toEqual([true, true, true]);
        });

        it('tout décocher décoche les cases ET démarque les lignes', () => {
            window.toggleAllPickerItems(false);
            expect(casesCochees()).toEqual([false, false, false]);
            expect(lignesMarquees()).toEqual([false, false, false]);
        });

        // C'est LE piège de cette fonction : elle parcourt les cases par POSITION dans le
        // DOM (`forEach((chk, i) => updatePickerRow(i))`) alors que `updatePickerRow` va
        // chercher `pitem-${i}` par IDENTIFIANT. Les deux ne coïncident que parce que la case
        // maîtresse vit hors de la liste et que chaque ligne n'a qu'UNE case.
        it('position dans le DOM et identifiant de ligne restent alignés', () => {
            window.toggleAllPickerItems(true);
            // Si l'alignement se rompait, la 1re ligne (la seule initialement décochée)
            // resterait non marquée alors que sa case est cochée.
            expect(document.getElementById('pick-0').checked).toBe(true);
            expect(document.getElementById('pitem-0').classList.contains('checked')).toBe(true);
        });

        it('la case maîtresse elle-même n\'est jamais comptée comme une ligne', () => {
            const maitresse = document.getElementById('picker-select-all');
            maitresse.checked = false;
            window.toggleAllPickerItems(true);
            // 3 lignes cochées, et la maîtresse n'a PAS été touchée par la boucle
            expect(casesCochees()).toEqual([true, true, true]);
            expect(maitresse.checked).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TROU TROUVÉ PAR MUTATION (LOT 014 §A) : débrancher l'ouverture ou la fermeture de la
    // modale ne cassait AUCUN des 54 tests de la zone. Autrement dit, rien ne prouvait que
    // cet écran s'affiche. Si ce câblage lâchait, Joel cliquerait « envoyer vers la liste de
    // courses » et il ne se passerait STRICTEMENT rien, sans le moindre message.
    // ─────────────────────────────────────────────────────────────────────────────
    describe('ouverture et fermeture de la modale', () => {
        it('ouvrir le sélecteur AFFICHE sa modale', () => {
            openEnhancedCartPicker(recette([{ n: 'Salsifis', c: 'Légumes' }]));
            expect(document.getElementById('modal-recipe-to-cart').classList.contains('open')).toBe(true);
        });

        it('ouvrir le sélecteur FERME le détail de recette dont il vient', () => {
            document.getElementById('modal-recipe-detail').classList.add('open');
            openEnhancedCartPicker(recette([{ n: 'Salsifis', c: 'Légumes' }]));
            // Sans ça, les deux modales se superposeraient.
            expect(document.getElementById('modal-recipe-detail').classList.contains('open')).toBe(false);
        });

        it('valider la sélection REFERME la modale', () => {
            openEnhancedCartPicker(recette([{ n: 'Salsifis', c: 'Légumes' }]));
            expect(document.getElementById('modal-recipe-to-cart').classList.contains('open')).toBe(true);

            confirmRecipeToCart();

            expect(document.getElementById('modal-recipe-to-cart').classList.contains('open')).toBe(false);
            expect(state.ingredients.some(i => i.name === 'Salsifis' && i.inCart)).toBe(true);
        });
    });

    it('sans liste dans la page, toggleAllPickerItems ne lève pas', () => {
        document.getElementById('modal-recipe-cart-list').remove();
        expect(() => window.toggleAllPickerItems(true)).not.toThrow();
    });

    // La case maîtresse REFLÈTE l'état réel à l'ouverture plutôt que de rester cochée
    // (comportement voulu, commenté dans le code).
    it('à l\'ouverture, la case maîtresse reflète l\'état réel des lignes', () => {
        state.ingredients = [
            { id: 'i1', name: 'Tomate', emoji: '🍅', category: 'Légumes', inStock: true, inCart: false }
        ];
        openEnhancedCartPicker(recette([{ n: 'Tomate', c: 'Légumes' }, { n: 'Salsifis', c: 'Légumes' }]));
        // Une ligne au moins est en stock → pas « tout manquant » → maîtresse décochée.
        expect(document.getElementById('picker-select-all').checked).toBe(false);

        openEnhancedCartPicker(recette([{ n: 'Salsifis', c: 'Légumes' }]));
        // Tout est manquant → maîtresse cochée.
        expect(document.getElementById('picker-select-all').checked).toBe(true);
    });
});
