import { state, saveState } from '../state.js';
import { h, toast } from '../utils/dom.js';
import { normalizeString } from '../utils/helpers.js';
import { DEFAULT_DB, getCategoryEmoji } from '../data.js';
import { GENERIC_EMOJI_FALLBACK, AI_ROLES, MESSAGE_CLE_API_MANQUANTE } from '../constants.js';
import { callAI } from '../services/gemini.js';

/**
 * MODALE « CHANGER L'ICONE » — extraite de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change. Filet pose AVANT pour la derniere zone aveugle
 * de la liste du lot, `searchEmojiAI` (`tests/emoji-search-ai.test.js`, 10 tests prouves par
 * retrait 6/6), en plus de `tests/emoji-edit.test.js` (LOT 009) qui couvrait le reste.
 *
 * `buildEmojiEditSuggestions` est le seul export utilise HORS de cette modale : le selecteur
 * de courses s'en sert pour son bouton 🎲 (`cycleEmoji`). Il l'importe desormais directement,
 * ce qui a supprime une des trois injections dont il avait besoin quand cette fonction vivait
 * encore dans `js/app.js`.
 *
 * UNE DIVERGENCE RESTE avec son jumeau du formulaire d'ajout (`searchEmojiAddAI`), figee
 * telle quelle par les tests. L'autre a ete CORRIGEE par Joel le 2026-07-31 : sans cle API,
 * cet ecran affichait « Erreur recherche emoji » au lieu de dire qu'il manquait une cle ; il
 * annonce desormais le meme message que les quatre autres ecrans (le jumeau, lui, sort
 * toujours EN SILENCE — c'est une suggestion de fond, pas un geste demande par Joel).
 *  1. La regex d'extraction d'emojis DECOUPE les emojis composites au lieu de les rater :
 *     « 👨‍👩‍👧 » produit 5 tuiles dont 2 INVISIBLES (liaisons de largeur nulle, cliquables),
 *     et « 1️⃣ » se reduit a son seul caractere d'encadrement. La phase decouverte annoncait
 *     l'inverse (« une regex qui rate des emojis ») ; verifie sur piece, fiche corrigee.
 */

// `openModal` / `closeModal` vivent dans `js/app.js` et portent des cas particuliers pour
// d'autres ecrans : meme idiome d'injection que le selecteur de courses et le moteur de
// synchro, plutot qu'un import croise.
const _hooks = { openModal: () => {}, closeModal: () => {} };

export function registerEmojiModalHooks(hooks = {}) {
    for (const cle of Object.keys(_hooks)) {
        if (typeof hooks[cle] === 'function') _hooks[cle] = hooks[cle];
    }
}

// Ingredient dont on edite l'icone. Etat PRIVE : `applyEditedEmoji` est le seul a le lire.
let _currentEditingIngId = null;

export function openEditEmoji(id) {
    _currentEditingIngId = id;
    const ing = state.ingredients.find(i => i.id === id);
    if (!ing) return;
    document.getElementById('edit-emoji-name').textContent = ing.name;
    const searchInput = document.getElementById('emoji-search-input');
    if (searchInput) searchInput.value = '';
    renderEmojiEditGrid(ing.name);
    _hooks.openModal('modal-edit-emoji');
}

/**
 * Suggestions locales pour la grille d'édition d'icône (oracle : monolithe
 * `getEmojiSuggestions`/`EMOJI_MAP`). Construites depuis `DEFAULT_DB` — jamais
 * de table d'emojis dupliquée (SSOT, `GENERIC_EMOJI_FALLBACK` partagé avec
 * `updateEmojiSuggestions`). Complète TOUJOURS avec l'emoji de catégorie puis le
 * socle générique tant qu'il manque des alternatives : un ingrédient dont le nom
 * ne correspond qu'à lui-même (ex. « Banane ») ne doit jamais se retrouver avec
 * une grille à une seule tuile qui ne fait que confirmer l'icône déjà en place
 * (audit Codex, LOT 009 — le « changer en 2 clics » exige un vrai choix).
 *
 * `category` (LOT 012, zone A) : override optionnel de la source d'emoji de
 * catégorie, pour les appelants qui n'éditent pas l'ingrédient en cours
 * (`_currentEditingIngId`) — ex. `cycleEmoji` sur une ligne du sélecteur de
 * recette. Omis, le comportement est strictement identique à avant (SSOT).
 */
export function buildEmojiEditSuggestions(seed, category) {
    // CORRECTIF (LOT 014, decide par Joel le 2026-07-31) — MEME COMPARAISON QUE LE RESTE DE
    // L'APP. Cette grille comparait en minuscules brutes, donc SENSIBLE aux accents : un
    // ingredient nomme « Boeuf (hache) » sans accent ne retrouvait pas l'emoji de la base et
    // tombait sur le socle generique. C'est le meme defaut que celui corrige dans le
    // formulaire d'ajout, sur l'ecran d'edition d'icone.
    // Mesure faite avant d'appliquer, sur 365 graines : 67 grilles changent, et la seule
    // correspondance perdue est le FRAGMENT « de terre » seul (`normalizeString` recolle
    // « pommes de terre » en un mot). Ce n'est pas une regression introduite ici : toutes les
    // autres recherches de l'app echouent DEJA sur ce fragment. Le nom complet, lui,
    // fonctionne toujours — et « pdt » trouve desormais la pomme de terre.
    const s = normalizeString(seed);
    const matches = s ? DEFAULT_DB.filter(i => normalizeString(i.name).includes(s)) : [];
    const fromMatches = matches.map(i => i.emoji);
    let categoryEmoji;
    if (category) {
        categoryEmoji = getCategoryEmoji(category);
    } else {
        const ing = state.ingredients.find(i => i.id === _currentEditingIngId);
        categoryEmoji = ing ? getCategoryEmoji(ing.category) : null;
    }
    const emojis = [...new Set([...fromMatches, categoryEmoji, ...GENERIC_EMOJI_FALLBACK].filter(Boolean))];
    return emojis.slice(0, 15);
}

/**
 * SSOT de la tuile d'emoji (LOT 014, volet D) : la meme construction etait ecrite dans les
 * deux remplisseurs de la grille — les suggestions locales et la recherche par IA. La
 * classe `emoji-edit-btn` porte du CSS reel : la dupliquer, c'est risquer qu'une des deux
 * grilles cesse d'etre stylee sans que rien ne le signale.
 */
function tuileEmoji(e) {
    return h('button', { class: 'emoji-edit-btn', onclick: () => applyEditedEmoji(e) }, e);
}

export function renderEmojiEditGrid(seed) {
    const grid = document.getElementById('edit-emoji-grid');
    if (!grid) return;
    grid.replaceChildren(...buildEmojiEditSuggestions(seed).map(tuileEmoji));
}

/** Applique l'emoji choisi, sauvegarde, ferme — contrat du `updateEmoji` du
 * monolithe : pas d'étape intermédiaire, aucun input libre à valider. */
export function applyEditedEmoji(emoji) {
    const ing = state.ingredients.find(i => i.id === _currentEditingIngId);
    if (ing) {
        ing.emoji = emoji;
        saveState(); // 'stateUpdated' relance le rendu : pas d'appel manuel.
    }
    _hooks.closeModal('modal-edit-emoji');
}

export async function searchEmojiAI() {
    const input = document.getElementById('emoji-search-input');
    const btn = document.getElementById('emoji-search-btn');
    if (!input || !btn) return;
    const query = input.value.trim();
    if (!query) return;

    // CORRECTIF (LOT 014, decide par Joel le 2026-07-31). Sans cle, cet ecran laissait
    // `callAI` lever et affichait « Erreur recherche emoji » : un message d'echec generique
    // la ou il ne manquait qu'un reglage. Il dit desormais la meme chose que les quatre
    // autres ecrans. L'ACTION reste propre a celui-ci : on previent sans ouvrir les
    // Reglages, qui masqueraient la fenetre d'icone ouverte par-dessus.
    // La garde est posee APRES le test du champ vide : inutile de reclamer une cle a
    // quelqu'un qui n'a encore rien tape.
    if (!state.aiConfig.apiKey) { toast(MESSAGE_CLE_API_MANQUANTE, 'error'); return; }

    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<div class="spinner-small" style="margin:0"></div>';

    try {
        const prompt = `Suggère 15 emojis pour: ${query}. Réponds uniquement par les emojis.`;
        const model = state.aiConfig.models?.emojiSearch || AI_ROLES.FAST;
        const res = await callAI(prompt, state.aiConfig.apiKey, model, { isJSON: false });
        if (res) {
            const emojis = res.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g) || [];
            const grid = document.getElementById('edit-emoji-grid');
            if (grid) {
                grid.replaceChildren(...emojis.map(tuileEmoji));
            }
        }
    } catch (e) {
        console.error(e);
        toast('Erreur recherche emoji', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}
