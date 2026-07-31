import { state, saveState } from '../state.js';
import { h, toast } from '../utils/dom.js';
import { generateId, normalizeString, areSimilar, debounce } from '../utils/helpers.js';
import { CATEGORIES, DEFAULT_DB } from '../data.js';
import { guessCategoryLocally, sanitizeCategory } from '../utils/categorize.js';
import { escapePromptValue } from '../utils/validate.js';
import { callAI } from '../services/gemini.js';
import { AI_ROLES, GENERIC_EMOJI_FALLBACK } from '../constants.js';

/**
 * FORMULAIRE D'AJOUT — extrait de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change. Le filet a ete pose AVANT
 * (`tests/add-form.test.js`, 18 tests de caracterisation prouves par retrait), conformement
 * a la regle du lot sur les zones aveugles.
 *
 * POURQUOI CE MODULE EXISTE : ses quatre variables d'etat vivaient en tete de `js/app.js`,
 * a 1400 lignes des fonctions qui les lisent, et `selectEmoji` vivait encore 600 lignes plus
 * loin. Rien n'empechait un futur lot d'ecrire dessus depuis n'importe ou. Elles sont
 * desormais PRIVEES : la seule ecriture possible depuis l'exterieur passe par
 * `resetManualCategory()`.
 *
 * DEUX DEFAUTS CONNUS, FIGES TELS QUELS (pare-feu A/B du lot — les corriger serait un
 * changement de comportement, donc une decision de Joel, pas un deplacement) :
 *
 *  1. DOUBLE RESET INCOHERENT. `switchView('add')` ne remet a zero QUE `_isManualCategory`,
 *     alors que `renderAdd` remet les quatre. Dans le parcours normal les deux s'enchainent
 *     (switchView -> saveState -> 'stateUpdated' -> renderCurrentView -> renderAdd), donc le
 *     premier reset est redondant. Il est conserve a l'identique : c'est le seul filet si
 *     `saveState` echoue avant de diffuser l'evenement.
 *
 *  2. DEUX COMPARAISONS DE TEXTE DIFFERENTES DANS LE MEME FORMULAIRE. La liste de resultats
 *     (`handleAddInput`, etape 2) passe par `normalizeString` : insensible aux accents. La
 *     grille d'emojis (`updateEmojiSuggestions`) fait `name.toLowerCase().includes()` :
 *     SENSIBLE aux accents. Taper « epinard » sans accent propose bien « Epinards » dans la
 *     liste mais laisse la grille VIDE. Verrouille par `tests/add-form.test.js`.
 *
 * DEPENDANCE INVERSE : `addIngredient`/`addIngredientFromDb` renvoient Joel a l'inventaire
 * apres un ajout reussi, ce qui demande `switchView` — qui vit dans `js/app.js` et lit
 * lui-meme l'etat de ce module. Cycle reel, resolu par le meme idiome d'injection que
 * `registerSyncUi` (`src/services/sync.js`) : voir `registerAddFormNav`.
 */

// ─── Etat PRIVE du formulaire ────────────────────────────────────────────────────────────
let _isManualCategory = false;
let _localCategoryFill = false; // true = catégorie posée par détection locale faible (IA peut écraser)
let _addSuggestTimer = null;
// Incremente a chaque requete de suggestion IA : seule la derniere lancee a le droit
// d'appliquer sa reponse (cf. handleAddInput).
let _aiSuggestGenId = 0;

// ─── Injection de la navigation ──────────────────────────────────────────────────────────
// `switchView` appartient a `js/app.js` et lit `_isManualCategory` : l'importer ici creerait
// un cycle d'imports. Meme solution que pour le moteur de synchro — un point d'entree que
// l'appelant branche au demarrage, et un defaut inoffensif si personne ne le branche (les
// tests unitaires du formulaire n'ont pas a naviguer).
const _nav = { switchView: () => {} };

export function registerAddFormNav(hooks = {}) {
    for (const cle of Object.keys(_nav)) {
        if (typeof hooks[cle] === 'function') _nav[cle] = hooks[cle];
    }
}

/**
 * Seule ecriture autorisee sur l'etat prive depuis l'exterieur. Appelee par `switchView`
 * a l'entree dans la vue « Ajouter » — voir le defaut connu n°1 ci-dessus.
 */
export function resetManualCategory() {
    _isManualCategory = false;
}

export function renderAdd() {
    _isManualCategory = false;
    _localCategoryFill = false;
    clearTimeout(_addSuggestTimer);
    _aiSuggestGenId++; // invalide une requete IA deja en vol
    const list = document.getElementById('add-results-list');
    if (list) list.replaceChildren();
    const emojiSug = document.getElementById('emoji-suggestions');
    if (emojiSug) emojiSug.replaceChildren();
    showCategoryIndicator(null);
}

export function showCategoryIndicator(type) {
    const el = document.getElementById('category-suggestion-indicator');
    if (!el) return;
    if (!type) {
        el.style.display = 'none';
    } else if (type === 'thinking') {
        el.style.display = 'block';
        el.style.color = 'var(--txt-soft)';
        el.textContent = "✨ Analyse par l'IA...";
    } else if (type === 'local') {
        el.style.display = 'block';
        el.style.color = 'var(--green)';
        el.textContent = '✨ Catégorie auto-détectée';
    } else if (type === 'ai') {
        el.style.display = 'block';
        el.style.color = 'var(--green)';
        el.textContent = '✨ Catégorie suggérée par l\'IA';
    }
}

export function selectEmoji(e) {
    const input = document.getElementById('add-emoji');
    if (input) {
        input.value = e;

        // Smart category pick if not manual
        if (!_isManualCategory) {
            const match = DEFAULT_DB.find(i => i.emoji === e);
            if (match) {
                const catSelect = document.getElementById('add-category');
                if (catSelect) catSelect.value = match.category;
            }
        }

        document.querySelectorAll('.emoji-sug-btn').forEach(b => {
            b.classList.toggle('selected', b.textContent === e);
        });
    }
}

export function updateEmojiSuggestions(val) {
    const container = document.getElementById('emoji-suggestions');
    if (!container) return;
    if (!val) {
        container.replaceChildren(...GENERIC_EMOJI_FALLBACK.map(e => h('span', { class: 'emoji-item emoji-sug-btn', onclick: () => selectEmoji(e) }, e)));
        return;
    }
    // CORRECTIF (LOT 014, decide par Joel le 2026-07-31) — MEME COMPARAISON QUE LA LISTE.
    // Cette grille comparait par `name.toLowerCase().includes()`, donc SENSIBLE aux accents,
    // alors que la liste de resultats du meme formulaire passe par `normalizeString`. Taper
    // « epinard » sans accent proposait « Epinards » dans la liste et laissait la grille
    // VIDE. Les deux moities de l'ecran s'accordent desormais sur la meme comparaison.
    // Mesure faite avant d'appliquer, sur 370 saisies : 68 resultats changent, ZERO perte —
    // le correctif fait toujours trouver PLUS, jamais moins.
    const s = normalizeString(val);
    // `normalizeString` rogne : une saisie faite uniquement d'espaces se reduit a rien, et
    // `includes('')` serait alors vrai pour TOUS les ingredients. Le champ « recherche
    // d'emoji » (index.html:612) appelle cette fonction directement, donc ce cas est bien
    // atteignable. Comportement CONSERVE tel quel : grille vide, comme avant le correctif.
    if (!s) { container.replaceChildren(); return; }
    const matches = DEFAULT_DB.filter(i => normalizeString(i.name).includes(s)).slice(0, 15);
    const emojis = [...new Set(matches.map(i => i.emoji))];
    container.replaceChildren(...emojis.map(e => h('span', { class: 'emoji-item emoji-sug-btn', onclick: () => selectEmoji(e) }, e)));
}

// Balaye les 297 ingredients de la base : temporise sur la frappe, immediat sur un reset.
// ATTENTION : c'est CETTE version, temporisee, qui est publiee sous le nom
// `updateEmojiSuggestions` (`js/app.js`, bloc expose) — pas la fonction brute. Republier la
// brute sous le meme nom supprimerait la temporisation en silence. Verrouille par
// `tests/add-form.test.js`.
export const updateEmojiSuggestionsDebounced = debounce(updateEmojiSuggestions, 200);

export function handleAddInput(val) {
    const list = document.getElementById('add-results-list');
    const emojiInput = document.getElementById('add-emoji');
    const catSelect = document.getElementById('add-category');

    // 1. Champ vide → tout réinitialiser
    if (!val || val.trim().length === 0) {
        _isManualCategory = false;
        _localCategoryFill = false;
        clearTimeout(_addSuggestTimer);
        _aiSuggestGenId++; // invalide une requete IA deja en vol
        if (list) list.replaceChildren();
        if (emojiInput) emojiInput.value = '';
        if (catSelect) catSelect.value = '';
        updateEmojiSuggestionsDebounced.cancel();
        updateEmojiSuggestions('');
        showCategoryIndicator(null);
        return;
    }

    // 2. Autocomplétion DB (instantané)
    if (list) {
        const s = normalizeString(val);
        const results = DEFAULT_DB.filter(i => normalizeString(i.name).includes(s)).slice(0, 5);
        list.replaceChildren(...results.map(i => h('div', {
            class: 'add-res-item',
            onclick: () => addIngredientFromDb(i)
        }, [i.emoji + ' ', i.name])));
    }

    // 3. Grille d'emojis (temporisee, depuis DB)
    updateEmojiSuggestionsDebounced(val);

    // Si l'utilisateur a choisi manuellement la catégorie, on s'arrête là
    if (_isManualCategory) return;

    // 4. Détection locale conservative (exact match ou règles par mot)
    const localCat = guessCategoryLocally(val);
    if (localCat) {
        catSelect.value = localCat;
        _localCategoryFill = true;
        showCategoryIndicator('local');
        // Exact match DB → on prend aussi l'emoji et on n'appelle pas l'IA
        const exactEntry = DEFAULT_DB.find(i => normalizeString(i.name) === normalizeString(val));
        if (exactEntry) {
            if (emojiInput && !emojiInput.value) selectEmoji(exactEntry.emoji);
            clearTimeout(_addSuggestTimer);
            _aiSuggestGenId++; // invalide une requete IA deja en vol
            return;
        }
    } else if (val.length >= 3 && state.aiConfig?.apiKey) {
        showCategoryIndicator('thinking');
    }

    // 5. Suggestion IA (différée, écrase toujours la détection locale)
    if (val.length < 3) return;
    clearTimeout(_addSuggestTimer);
    _addSuggestTimer = setTimeout(async () => {
        const apiKey = state.aiConfig?.apiKey;
        if (!apiKey || _isManualCategory) return;

        // Jeton de generation : `clearTimeout` annule une requete PAS ENCORE partie,
        // mais rien ne peut rappeler une requete deja en vol. Sans ce jeton, taper
        // « salsifi » puis effacer et taper « tomate » laisse la reponse la plus lente
        // ecraser la plus recente. On ignore donc toute reponse peremee.
        const myGenId = ++_aiSuggestGenId;

        try {
            // LOT 014, volet C — la saisie de Joel est interpolee ENTRE GUILLEMETS dans une
            // consigne qui decrit elle-meme du JSON a guillemets doubles. Un `"` tape casse
            // la consigne ; un texte construit expres peut la reecrire. `escapePromptValue`
            // n'est applique QU'ICI, a la valeur du prompt — jamais a la donnee elle-meme.
            const prompt = `Tu es un assistant culinaire. Pour l'ingrédient "${escapePromptValue(val)}", réponds en JSON UNIQUEMENT: {"category":"Légumes","emojis":["🥕","🌿","🥦"]}. Catégories possibles: ${CATEGORIES.join(', ')}. Propose 3-5 emojis pertinents.`;
            const model = state.aiConfig.models?.categorySuggest || AI_ROLES.FAST;
            const raw = await callAI(prompt, apiKey, model, { isJSON: false, temperature: 0.1 });
            if (myGenId !== _aiSuggestGenId) return; // saisie modifiee entre-temps
            const match = raw.match(/\{[\s\S]*?\}/);
            if (!match) { showCategoryIndicator(null); return; }
            const data = JSON.parse(match[0]);

            // Catégorie : l'IA écrase toujours la détection locale (jamais le choix manuel)
            if (data.category && !_isManualCategory) {
                const finalCat = sanitizeCategory(data.category, val);
                if (finalCat) {
                    catSelect.value = finalCat;
                    _localCategoryFill = false;
                    showCategoryIndicator('ai');
                }
            }

            // Emojis : ajout dans la grille + auto-sélection si rien de choisi
            if (data.emojis && data.emojis.length > 0) {
                const container = document.getElementById('emoji-suggestions');
                if (container) {
                    data.emojis.forEach(e => {
                        if (!container.querySelector(`[data-emoji="${e}"]`)) {
                            container.appendChild(h('span', {
                                class: 'emoji-item emoji-sug-btn',
                                'data-emoji': e,
                                onclick: () => selectEmoji(e)
                            }, e));
                        }
                    });
                }
                if (emojiInput && !emojiInput.value && data.emojis[0]) {
                    selectEmoji(data.emojis[0]);
                }
            }
        } catch (e) {
            if (myGenId !== _aiSuggestGenId) return;
            showCategoryIndicator(null);
            console.warn('[AI Suggest]', e.message);
        }
    }, 800);
}

// Called from HTML when user manually changes the category dropdown
export function onManualCategoryChange() {
    _isManualCategory = true;
    _localCategoryFill = false;
    showCategoryIndicator(null);
}

export function addIngredient() {
    const name = document.getElementById('add-name')?.value;
    if (!name) { toast('Nom requis', 'error'); return; }

    const emoji = document.getElementById('add-emoji')?.value || '🛒';
    const category = document.getElementById('add-category')?.value || 'Autres';
    const frozen = document.getElementById('add-frozen')?.checked || false;

    // Check duplicate/similarity
    const similar = state.ingredients.find(i => areSimilar(i.name, name));
    if (similar) {
        const type = normalizeString(similar.name) === normalizeString(name) ? 'existe déjà' : 'ressemble beaucoup';
        if (!confirm(`ℹ️ "${name}" ${type} à "${similar.name}" (${similar.category}).\nVoulez-vous quand même l'ajouter ?`)) return;
    }

    const id = generateId('ing');
    state.ingredients.push({
        id, name, emoji, category, frozen,
        inStock: true, inCart: false, pinned: false
    });

    saveState(); // 'stateUpdated' relance le rendu de la vue courante : pas d'appel manuel.

    // Reset form
    document.getElementById('add-name').value = '';
    document.getElementById('add-emoji').value = '';
    document.getElementById('add-category').value = '';
    document.getElementById('add-frozen').checked = false;
    _isManualCategory = false;
    renderAdd();
    toast(`"${name}" ajouté ✓`);
    // LOT 012, zone C (oracle l.6458) : retour a l'inventaire apres un ajout reussi,
    // pour ne pas laisser Joel sur un formulaire vide sans lien evident avec ce qu'il
    // vient de faire. Le formulaire s'est deja reinitialise juste au-dessus (LOT 006) :
    // un enchainement de plusieurs ajouts reste possible avant l'echeance des 500 ms.
    setTimeout(() => _nav.switchView('pantry'), 500);
}

export function addIngredientFromDb(dbItem) {
    // Check duplicate/similarity
    const similar = state.ingredients.find(i => areSimilar(i.name, dbItem.name));
    if (similar) {
        const type = normalizeString(similar.name) === normalizeString(dbItem.name) ? 'existe déjà' : 'ressemble beaucoup';
        if (!confirm(`ℹ️ "${dbItem.name}" ${type} à "${similar.name}" (${similar.category}).\nVoulez-vous quand même l'ajouter ?`)) return;
    }

    const id = generateId('ing');
    state.ingredients.push({ ...dbItem, id, inStock: true, inCart: false, pinned: false });

    saveState(); // 'stateUpdated' relance le rendu de la vue courante : pas d'appel manuel.

    // Reset form
    document.getElementById('add-name').value = '';
    document.getElementById('add-emoji').value = '';
    document.getElementById('add-category').value = '';
    document.getElementById('add-frozen').checked = false;
    _isManualCategory = false;
    renderAdd();

    toast(`${dbItem.name} ajouté !`);
    // LOT 012, zone C — trouvé par l'audit du diff final (Codex Terra) : ce chemin
    // d'ajout (clic sur une suggestion d'autocomplétion, absent de l'oracle) ajoute
    // vraiment un ingrédient au même titre que `addIngredient` — même retour auto pour
    // que les deux parcours se comportent pareil du point de vue de Joel.
    setTimeout(() => _nav.switchView('pantry'), 500);
}

export async function searchEmojiAddAI() {
    const searchVal = document.getElementById('add-emoji-search')?.value?.trim();
    const nameVal = document.getElementById('add-name')?.value?.trim();
    const target = searchVal || nameVal;
    if (!target || !state.aiConfig.apiKey) return;

    const btn = document.getElementById('add-emoji-search-btn');
    if (btn) btn.textContent = '...';

    try {
        // LOT 014, volet C — meme formulaire d'ajout que `handleAddInput`, meme traitement :
        // la valeur vient de `#add-emoji-search` ou, a defaut, de `#add-name`.
        const prompt = `Trouve 12 emojis pertinents pour l'ingrédient "${escapePromptValue(target)}". Réponds uniquement par les emojis séparés par des espaces.`;
        const model = state.aiConfig.models?.emojiSearch || AI_ROLES.FAST;
        const res = await callAI(prompt, state.aiConfig.apiKey, model, { isJSON: false });
        if (res) {
            // Robust emoji detection using modern regex
            const allEmojis = res.match(/\p{Emoji_Presentation}/gu) || res.match(/\p{Emoji}/gu) || [];
            const uniqueEmojis = [...new Set(allEmojis)];

            const grid = document.getElementById('emoji-suggestions');
            if (grid) {
                grid.replaceChildren(...uniqueEmojis.map(e => h('span', {
                    class: 'emoji-item emoji-sug-btn',
                    onclick: () => selectEmoji(e)
                }, e)));

                // Auto-select first emoji if currently empty
                const currentEmoji = document.getElementById('add-emoji');
                if (currentEmoji && (!currentEmoji.value || !currentEmoji.value.trim()) && uniqueEmojis.length > 0) {
                    selectEmoji(uniqueEmojis[0]);
                }
            }
        }
    } catch(e) {
        console.error('[searchEmojiAddAI]', e);
        toast(`Erreur emoji : ${e.message}`, 'error');
    } finally {
        if (btn) btn.textContent = '✨';
    }
}
