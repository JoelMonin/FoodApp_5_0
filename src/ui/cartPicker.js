import { state, saveState } from '../state.js';
import { h, toast } from '../utils/dom.js';
import { generateId, areSimilar, autoEmoji } from '../utils/helpers.js';
import { DEFAULT_DB, getCategoryEmoji } from '../data.js';
import { AI_EMOJI_ONLY } from '../constants.js';
import { matchIngredientToStock } from '../utils/stockMatch.js';
// LOT 014, volet A : importe DIRECTEMENT depuis la modale d'edition d'icone, une fois
// celle-ci extraite. Tant qu'elle vivait dans `js/app.js`, il fallait l'injecter — c'est
// la troisieme injection annoncee en en-tete, desormais supprimee. Pas de cycle : la
// modale d'edition ne connait pas le selecteur.
import { buildEmojiEditSuggestions } from './emojiModal.js';

/**
 * SELECTEUR DE COURSES — extrait de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change. Filet pose AVANT
 * (`tests/picker-selection.test.js`, 9 tests prouves par retrait 5/5), en plus de
 * `tests/picker-row-editing.test.js` (LOT 012) qui couvrait deja l'edition d'une ligne.
 *
 * C'est l'ecran qui decide ce qui part reellement dans la liste de courses de Joel : il
 * pre-coche ce qui manque, laisse corriger chaque ligne, puis fusionne avec l'inventaire.
 *
 * PIEGE VERROUILLE PAR LES TESTS : `toggleAllPickerItems` parcourt les cases par POSITION
 * dans le DOM alors que `updatePickerRow` retrouve la ligne `pitem-${i}` par IDENTIFIANT.
 * Les deux ne coincident que pour deux raisons non evidentes — la case maitresse « tout
 * selectionner » vit HORS de la liste (`index.html:76` vs `:80`), et chaque ligne ne contient
 * qu'UNE case a cocher. Deplacer la maitresse dans la liste, ou ajouter une seconde case par
 * ligne, decalerait le marquage visuel en silence.
 *
 * DEUX COUPLAGES INJECTES plutot qu'importes (`registerCartPickerHooks`) — c'est le noeud
 * que la phase decouverte annoncait (§B5). Ils etaient TROIS : le troisieme
 * (`buildEmojiEditSuggestions`) a disparu des que la modale d'edition d'icone est sortie
 * dans son propre module, d'ou il s'importe maintenant directement.
 *  · `openModal`/`closeModal` vivent dans `js/app.js` et ne sont PAS de simples helpers :
 *    `openModal` porte des cas particuliers pour la modale « coller une recette » et pour
 *    les reglages IA. En extraire un socle propre demanderait deux injections de plus.
 *  · `buildEmojiEditSuggestions` appartient a la modale d'edition d'icone. `cycleEmoji` lui
 *    passe TOUJOURS une categorie, donc l'appel est pur de ce cote — mais la fonction lit
 *    `_currentEditingIngId` quand la categorie est omise, ce qui interdit de la rendre pure
 *    sans changer son comportement. Le pare-feu du lot l'interdit : on injecte.
 */

const _hooks = {
    openModal: () => {},
    closeModal: () => {}
};

export function registerCartPickerHooks(hooks = {}) {
    for (const cle of Object.keys(_hooks)) {
        if (typeof hooks[cle] === 'function') _hooks[cle] = hooks[cle];
    }
}

// Etat PRIVE du selecteur : la recette en cours et ses lignes, telles qu'affichees.
let _currentPickerData = [];
let _currentPickerRecipeName = '';

export function openEnhancedCartPicker(recipe) {
    _hooks.closeModal('modal-recipe-detail');
    _currentPickerRecipeName = recipe.name || 'Recette';
    _currentPickerData = (recipe.ingredients || []).map(i => {
        const name = i.n || i.name;
        const category = i.c || i.category || 'Autres';
        const status = matchIngredientToStock(i);
        // Filet de sécurité emoji : cf. la constante module-level `AI_EMOJI_ONLY`
        // (LOT 010, casse C12 ; remontée au niveau module par le LOT 011, chantier 2,
        // pour rester SSOT avec le détail de recette).
        const aiEmoji = i.e && AI_EMOJI_ONLY.test(i.e.trim()) ? i.e : null;
        return {
            name,
            category,
            // Emoji : celui de l'IA (validé), sinon celui de la base d'ingredients,
            // sinon celui de la categorie.
            emoji: aiEmoji || i.emoji || autoEmoji(name, DEFAULT_DB, getCategoryEmoji(category)),
            isMissing: !status.inStock,
            matchedName: status.matchedName,
            isExact: status.isExact
        };
    });

    const listEl = document.getElementById('modal-recipe-cart-list');
    if (listEl) {
        listEl.replaceChildren(..._currentPickerData.map((it, idx) => {
            // Coche par defaut ce qui manque uniquement : ce que Joel a deja en stock
            // n'a pas a retourner dans la liste de courses.
            const checked = it.isMissing;
            // Correspondance approximative (ex. « Tomates cerises » vs « Tomate ») :
            // signalee visuellement, car la deduction peut se tromper.
            const softMatch = !!it.matchedName && !it.isExact;

            // Edition par ligne (LOT 012, zone A) : pas de <label> autour du contenu
            // (contrairement à l'ancien rendu) — fidèle à la structure de l'oracle, et
            // ça évite tout risque de double-déclenchement de la case au clic sur les
            // champs édités désormais imbriqués. Seule la case à cocher coche/décoche.
            const contentChildren = [
                h('input', { class: 'picker-name-inp', id: `pick-name-${idx}` , value: it.name }),
                h('div', { class: 'picker-cat-label' }, it.category)
            ];
            if (it.matchedName) {
                contentChildren.push(h('div', { class: 'picker-match-info' },
                    it.isMissing
                        ? `Correspond à « ${it.matchedName} », pas en stock`
                        : `Déjà en stock : « ${it.matchedName} »`));
            }
            contentChildren.push(h('input', { type: 'hidden', id: `pick-cat-${idx}`, value: it.category }));

            // `h()` pose les props via setAttribute : pour un booleen HTML comme "checked",
            // la seule PRESENCE de l'attribut coche la case, meme passe `false` (defaut
            // preexistant du LOT 006, trouve par les tests de non-regression de ce chantier
            // — un seul point d'appel dans toute la base, corrige ici). Affectation directe
            // de la propriete IDL pour un rendu initial fidele a `it.isMissing`.
            const checkboxEl = h('input', {
                id: `pick-${idx}`,
                type: 'checkbox',
                onchange: () => updatePickerRow(idx)
            });
            checkboxEl.checked = checked;

            return h('div', {
                class: `picker-item ${checked ? 'checked' : ''} ${softMatch ? 'soft-match' : ''}`,
                id: `pitem-${idx}`
            }, [
                checkboxEl,
                h('div', { class: 'picker-emoji-wrap' }, [
                    h('input', { class: 'picker-emoji-inp', id: `pick-emoji-${idx}`, value: it.emoji, readonly: true }),
                    h('button', { class: 'picker-magic-btn', title: "Changer l'émoji", onclick: () => cycleEmoji(idx) }, '🎲')
                ]),
                h('div', { class: 'picker-content' }, contentChildren),
                it.isMissing ? null : h('span', { class: 'picker-badge' }, 'En stock')
            ].filter(Boolean));
        }));
    }

    // La case maitresse reflete l'etat reel des lignes plutot que de rester cochee.
    const selectAll = document.getElementById('picker-select-all');
    if (selectAll) selectAll.checked = _currentPickerData.every(it => it.isMissing);

    _hooks.openModal('modal-recipe-to-cart');
}

export function confirmRecipeToCart() {
    const list = document.getElementById('modal-recipe-cart-list');
    if (!list) return;
    const checks = list.querySelectorAll('input[type="checkbox"]');
    checks.forEach((chk, i) => {
        if (!chk.checked) return;
        const original = _currentPickerData[i];
        const nameInp = document.getElementById(`pick-name-${i}`);
        const emojiInp = document.getElementById(`pick-emoji-${i}`);
        const catInp = document.getElementById(`pick-cat-${i}`);
        // Lit les valeurs EDITEES (LOT 012, zone A) plutot que l'original. Distinction
        // (audit Codex) entre "input absent" (repli defensif sur l'original, ne devrait
        // pas arriver) et "nom vide par un input present" (Joel a efface le champ :
        // refus propre de cette ligne, jamais de repli silencieux sur l'ancien nom).
        if (nameInp && !nameInp.value.trim()) return;
        const name = nameInp ? nameInp.value.trim() : original.name;
        const emoji = (emojiInp ? emojiInp.value.trim() : '') || original.emoji;
        const category = catInp ? catInp.value : original.category;

        const existing = state.ingredients.find(ing => areSimilar(ing.name, name));
        if (existing) {
            existing.inCart = true;
            existing.shoppingSource = _currentPickerRecipeName;
        } else {
            const id = generateId('ing');
            state.ingredients.push({
                name, category, emoji, id,
                inStock: false, inCart: true,
                shoppingSource: _currentPickerRecipeName
            });
        }
    });
    saveState();
    _hooks.closeModal('modal-recipe-to-cart');
    toast('Course ajoutée !');
}

/**
 * Fait défiler l'émoji d'une ligne du sélecteur d'articles (LOT 012, zone A ;
 * oracle `cycleEmoji`, cycle circulaire). Relit le NOM ÉDITÉ à chaque appel
 * (pas `_currentPickerData[idx].name`) : une correction de nom faite avant de
 * cliquer 🎲 influence les suggestions. Réutilise `buildEmojiEditSuggestions` —
 * jamais de table d'emojis dupliquée (SSOT).
 */
export function cycleEmoji(idx) {
    const emojiInp = document.getElementById(`pick-emoji-${idx}`);
    const nameInp = document.getElementById(`pick-name-${idx}`);
    if (!emojiInp || !nameInp) return;
    const category = _currentPickerData[idx]?.category;
    const suggestions = buildEmojiEditSuggestions(nameInp.value, category);
    const at = suggestions.indexOf(emojiInp.value);
    emojiInp.value = suggestions[(at + 1) % suggestions.length];
}

export function updatePickerRow(idx) {
    const row = document.getElementById(`pitem-${idx}`);
    const chk = document.getElementById(`pick-${idx}`);
    if (row && chk) {
        if (chk.checked) row.classList.add('checked');
        else row.classList.remove('checked');
    }
}

export function toggleAllPickerItems(checked) {
    const list = document.getElementById('modal-recipe-cart-list');
    if (!list) return;
    const checks = list.querySelectorAll('input[type="checkbox"]');
    checks.forEach((chk, i) => {
        chk.checked = checked;
        updatePickerRow(i);
    });
}
