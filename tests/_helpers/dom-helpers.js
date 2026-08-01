// LOT 013 — Filet de tests UI.
//
// Ce fichier ne CRÉE quasiment rien : il FACTORISE ce que 21 fichiers de tests réécrivaient
// déjà, chacun à sa façon (découverte du LOT 013, 2026-07-30). Voir la fiche du lot,
// section « L'infrastructure §C est à FACTORISER, pas à inventer » pour le détail des
// duplications constatées et leur provenance exacte.
//
// Import EXPLICITE requis dans chaque fichier de test — pas de `setupFiles` global
// (écart 2 refusé par Joel : ça sortirait du périmètre sans nécessité réelle).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';
import { CATEGORIES } from '../../src/data.js';

// ─────────────────────────────────────────────────────────────────────────
// Le vrai index.html, pour le garde-fou et pour la lecture DOM parsée.
// `import.meta.url` est servi en http:// sous jsdom — on passe par la racine du projet
// (piège déjà consigné par tests/settings-labels.test.js avant ce lot).
// ─────────────────────────────────────────────────────────────────────────

let _indexHtmlCache = null;

function indexHtmlSource() {
    if (_indexHtmlCache === null) {
        _indexHtmlCache = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    }
    return _indexHtmlCache;
}

/** Le vrai `index.html`, parsé en Document. Pour les tests qui lisent la page telle quelle
 *  (ex. tests/settings-labels.test.js) plutôt que de monter un squelette réduit. */
export function parseIndexHtml() {
    return new DOMParser().parseFromString(indexHtmlSource(), 'text/html');
}

// ─────────────────────────────────────────────────────────────────────────
// setupTestDOM — squelettes par zone, VÉRIFIÉS contre le vrai index.html.
//
// Le point que la découverte a signalé comme le vrai manque : aucun des 21 squelettes
// existants n'est vérifié contre index.html — un id peut dériver en silence. Le garde-fou
// ci-dessous casse fort et tôt si un squelette cite un id qui n'existe plus.
// ─────────────────────────────────────────────────────────────────────────

const ZONES = {
    // Formulaire d'ajout (js/app.js:2078 handleAddInput, :2295 searchEmojiAddAI).
    // Ids requis par les gardes P2/P3 de la fiche (js/app.js:2081, :2117, :2158) —
    // sans eux, un TypeError immédiat, pas un échec de test lisible.
    add: `
        <input id="add-name">
        <div id="add-results-list"></div>
        <input id="add-emoji-search">
        <button id="add-emoji-search-btn"></button>
        <div id="emoji-suggestions"></div>
        <input id="add-emoji">
        <select id="add-category">
            <option value=""></option>
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <!-- display:none reproduit index.html:668 : dans la vraie page l'indicateur part
             CACHE. Sans cet attribut, un test qui verifie qu'il reste masque passerait sur un
             artefact du harnais (chaine vide) au lieu du comportement reel. -->
        <p id="category-suggestion-indicator" style="display:none"></p>
        <input type="checkbox" id="add-frozen">
    `,
    // Inventaire.
    pantry: `
        <div id="pantry-filters"></div>
        <div id="ing-grid"></div>
        <div id="ing-empty" class="hidden"></div>
    `,
    // Liste de courses.
    shopping: `
        <div id="shopping-scroll"></div>
    `,
    // Réglages IA (restoreAIConfig, js/app.js:979) — piège P5 : `.closest('.chips-row')`
    // exige que chaque `.chip` ait bien un ANCÊTRE `.chips-row[id]`, pas un frère.
    aiSettings: `
        <input id="api-key-input">
        <div class="ai-settings">
            <div class="chips-row" id="ai-meal-chips">
                <div class="chip" data-val="rapide"></div>
                <div class="chip" data-val="mijote"></div>
            </div>
            <div class="chips-row" id="ai-diet-chips">
                <div class="chip" data-val="vegetarien"></div>
            </div>
            <textarea id="ai-exceptions"></textarea>
            <div class="chips-row" id="ai-cuisines-chips">
                <div class="chip" data-val="italienne"></div>
                <div class="chip" data-val="japonaise"></div>
            </div>
            <div class="chips-row" id="ai-equip-chips">
                <div class="chip" data-val="four"></div>
            </div>
            <input type="range" id="creativity-slider">
            <div class="creativity-labels">
                <span id="cr-label-classique"></span>
                <span id="cr-label-equilibre"></span>
                <span id="cr-label-creatif"></span>
            </div>
            <textarea id="ai-exclusions"></textarea>
        </div>
        <div id="ai-cta-summary"></div>
    `,
    // Panneau Informations Système (updateSystemInfo, js/app.js:1729).
    systemInfo: `
        <div id="info-api-key"></div>
        <div id="info-fb-user"></div>
        <div id="info-storage"></div>
        <div id="info-last-sync"></div>
        <div id="info-network"></div>
    `,
    // Voyants de synchro (LOT 007/012).
    syncIndicators: `
        <div id="sync-indicator-desktop"><span class="sync-label"></span></div>
        <div id="sync-indicator-mobile"><span class="sync-label"></span></div>
    `,
    // Détail de recette (renderRecipeDetail, src/ui/recipe.js:129). Le bouton d'analyse
    // nutritionnelle porte ici son libellé initial réel (src/ui/recipe.js:104,
    // NUTRI_BTN_LABEL — constante privée, non exportée) : analyzeNutrition (js/app.js:1111)
    // doit le restituer À L'IDENTIQUE après un échec (LOT 011, chantier 2).
    recipeDetail: `
        <div id="modal-recipe-detail">
            <button id="rd-nutri-btn">🔍 Estimer la valeur nutritionnelle (IA)</button>
        </div>
    `,
    // Sélecteur d'articles vers la liste de courses (confirmRecipeToCart, js/app.js:1384).
    picker: `
        <input type="checkbox" id="picker-select-all">
        <div id="modal-recipe-cart-list"></div>
    `,
    // Édition d'emoji (openEditEmoji, js/app.js).
    editEmoji: `
        <div id="edit-emoji-title"></div>
        <span id="edit-emoji-name"></span>
        <input id="emoji-search-input">
        <button id="emoji-search-btn"></button>
        <div id="edit-emoji-grid"></div>
    `,
    // Barre supérieure / en-tête mobile (renderTopbar, js/app.js:661).
    topbar: `
        <div id="topbar"><div id="topbar-title"></div><div id="topbar-sub"></div></div>
        <div id="tb-search-wrap"><input id="search-input"></div>
        <input id="mobile-search">
        <div id="top-action-btn"></div>
        <div id="mh-context-icon"></div>
        <div id="mh-subtitle"></div>
    `,
    // Générateur de recettes IA (generateSuggestions, js/app.js).
    aiResults: `
        <div id="ai-placeholder"></div>
        <div id="ai-results-col"></div>
        <div id="ai-results-list"></div>
        <button id="generate-btn"></button>
    `,
    // Favoris.
    favorites: `<div id="fav-list"></div>`,
    // Modale « coller une recette ».
    pasteRecipe: `
        <input id="paste-url">
        <input id="paste-title">
        <textarea id="paste-content"></textarea>
        <button id="paste-fetch-btn"></button>
        <button id="paste-ai-btn"></button>
        <button id="paste-save-btn"></button>
        <button id="paste-list-btn" style="display:none"></button>
        <div id="paste-modal-footer"></div>
    `
};

// Ids posés par du JS au RENDU (jamais présents dans le index.html statique) — le garde-fou
// de fraîcheur ne doit PAS les réclamer là. Ex. rd-nutri-btn : injecté par
// src/ui/recipe.js:246 à chaque ouverture du détail de recette, absent du fichier au repos.
const IDS_DYNAMIQUES = new Set(['rd-nutri-btn']);

/** Tous les ids STATIQUES que setupTestDOM peut poser, pour le garde-fou de fraîcheur
 *  ci-dessous (exclut les ids injectés dynamiquement, cf. IDS_DYNAMIQUES). */
function idsDeclares(fragmentHtml) {
    const re = /\bid="([^"]+)"/g;
    const ids = [];
    let m;
    while ((m = re.exec(fragmentHtml))) if (!IDS_DYNAMIQUES.has(m[1])) ids.push(m[1]);
    return ids;
}

/**
 * Monte un squelette DOM minimal pour une ou plusieurs zones nommées.
 * @param {string|string[]} zones - une ou plusieurs clés de ZONES ci-dessus
 * @returns {HTMLElement} le conteneur monté dans document.body
 */
export function setupTestDOM(zones) {
    const liste = Array.isArray(zones) ? zones : [zones];
    document.body.innerHTML = liste.map(z => {
        if (!ZONES[z]) throw new Error(`setupTestDOM: zone inconnue "${z}" (zones dispo : ${Object.keys(ZONES).join(', ')})`);
        return ZONES[z];
    }).join('\n');
    return document.body;
}

/**
 * Garde-fou de fraîcheur : vérifie qu'un id posé par setupTestDOM existe encore dans le VRAI
 * index.html. À appeler une fois par zone dans un test dédié (pas à chaque beforeEach —
 * coûteux et redondant). C'est le manque que la découverte du LOT 013 a relevé : aucun des
 * squelettes ad hoc précédents n'avait ce filet, donc un id pouvait dériver en silence.
 */
export function idsEncoreValides(zone) {
    const html = indexHtmlSource();
    const manquants = idsDeclares(ZONES[zone]).filter(id => !html.includes(`id="${id}"`));
    return manquants;
}

/** Vide le DOM ET les traces que les tests précédents auraient pu laisser derrière eux
 *  (P7/P9 de la fiche : `#toast-container` n'est jamais retiré par le code applicatif lui-même
 *  — src/utils/dom.js:56 le recrée s'il est absent, mais rien ne le nettoie). */
export function cleanupTestDOM() {
    document.body.innerHTML = '';
}

// ─────────────────────────────────────────────────────────────────────────
// Mocks fetch — extraits de 13 sites dans 10 fichiers (gemini.test.js en tête, 10 copies
// de l'enveloppe Gemini {ok:true, json:...candidates...}).
// ─────────────────────────────────────────────────────────────────────────

/** Enveloppe une réponse fetch réussie. Sans argument : réponse Gemini "happy path" minimale. */
export function mockFetchResponse(body = { candidates: [{ content: { parts: [{ text: '{}' }] } }] }, status = 200) {
    const fn = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : String(status),
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

/** Réponse fetch en échec HTTP (401/404/500...). Ne lève pas — c'est `ok: false` qui le porte,
 *  fidèle au patron de tests/firebase.test.js. */
export function mockFetchError(status = 500, statusText = 'Internal Server Error') {
    const fn = vi.fn().mockResolvedValue({
        ok: false, status, statusText,
        json: () => Promise.reject(new Error('pas de corps JSON sur une erreur HTTP')),
        text: () => Promise.resolve(statusText)
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

/** fetch qui ne répond jamais tant que l'AbortSignal fourni n'est pas déclenché — le patron
 *  exact de tests/firebase.test.js:83-85 et tests/ai-url-fetch.test.js:110-112, généralisé. */
export function mockFetchTimeout() {
    const fn = vi.fn((url, options) => new Promise((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
    }));
    vi.stubGlobal('fetch', fn);
    return fn;
}

/** Réponse réseau qui échoue avant même d'atteindre le serveur (panne, DNS, offline). */
export function mockFetchNetworkError(message = 'Failed to fetch') {
    const fn = vi.fn().mockRejectedValue(new TypeError(message));
    vi.stubGlobal('fetch', fn);
    return fn;
}

// ─────────────────────────────────────────────────────────────────────────
// localStorage — le faux magasin par clé le plus complet du dépôt
// (tests/backup-restore.test.js:67-76), généralisé.
// ─────────────────────────────────────────────────────────────────────────

export function mockLocalStorage() {
    const store = {};
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: vi.fn(k => store[k] ?? null),
            setItem: vi.fn((k, v) => { store[k] = String(v); }),
            removeItem: vi.fn(k => { delete store[k]; }),
            clear: vi.fn(() => { for (const k in store) delete store[k]; })
        },
        configurable: true
    });
    return store;
}

// ─────────────────────────────────────────────────────────────────────────
// Reset de l'état singleton — 6 copies quasi identiques absorbées.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Remet `state` à une ardoise vierge et vide `shoppingChecked`. `state` est un singleton de
 * module partagé entre tous les tests d'un même fichier — un reset partiel laisse fuir
 * filtres, favoris ou config d'un test à l'autre (leçon consignée dans tests/state.test.js
 * avant ce lot).
 * @param {object} state - l'export `state` de src/state.js
 * @param {Set} shoppingChecked - l'export `shoppingChecked` de src/state.js
 * @param {object} defaultAiConfig - la fonction `defaultAiConfig` de src/state.js
 * @param {object} overrides - champs à écraser après le reset
 */
export function resetTestState(state, shoppingChecked, defaultAiConfig, overrides = {}) {
    Object.assign(state, {
        ingredients: [], favorites: [], extraIngredients: [],
        currentView: 'pantry', filter: 'all', search: '',
        aiSuggestions: null, currentSuggestionIdx: null, lastSync: null,
        showInStockOnly: false, showInCartOnly: false,
        aiConfig: defaultAiConfig(),
        ...overrides
    });
    delete state.shoppingChecked; // garde-fou anti-pollution du LOT 015 (src/state.js:179)
    shoppingChecked.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// Fabriques d'objets métier — 4+4+2+5 copies absorbées en 2 fonctions.
// ─────────────────────────────────────────────────────────────────────────

let _seq = 0;

export function makeIngredient(overrides = {}) {
    _seq += 1;
    return {
        id: `ing_test_${_seq}`, name: 'Tomate', emoji: '🍅', category: 'Légumes',
        inStock: false, inCart: false, pinned: false, frozen: false,
        shoppingSource: null,
        ...overrides
    };
}

export function makeRecipe(overrides = {}) {
    return {
        name: 'Recette de test', time: '20 min', difficulty: 'Facile', ppl: '2',
        cuisine: 'Française', pitch: 'Une recette pour les tests.',
        ingredients: [{ name: 'Tomate', amount: '2' }],
        steps: ['Étape 1'],
        ...overrides
    };
}

// ─────────────────────────────────────────────────────────────────────────
// Lecture des toasts — 2 copies identiques absorbées.
// ─────────────────────────────────────────────────────────────────────────

export function readToasts() {
    return [...document.querySelectorAll('.toast')].map(t => t.textContent);
}

export function lastToast() {
    const t = readToasts();
    return t.length ? t[t.length - 1] : null;
}
