import { state, saveState } from '../state.js';
import { toast } from '../utils/dom.js';
import { AI_ROLES, MESSAGE_CLE_API_MANQUANTE } from '../constants.js';
import { callAI } from '../services/gemini.js';
import { extraireJsonIA } from '../utils/aiJson.js';
import { renderRecipeDetail, NUTRI_BTN_LABEL } from './recipe.js';
import { buildIngredientTags } from '../utils/stockMatch.js';

/**
 * MODALE « DETAIL DE RECETTE » — extraite de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change. Cette zone etait deja bien couverte
 * (`recipe-detail-rich`, `analyze-nutrition`, `recipe-scaling`, `recipe-fullscreen`) : aucune
 * de ses fonctions ne figurait sur la liste des zones aveugles du lot.
 *
 * OU PASSE LA FRONTIERE, ET POURQUOI LA. `buildRecipeHandlers` reste dans `js/app.js` : c'est
 * du CABLAGE pur, qui mappe six fonctions de la zone favoris (sauver, ajouter aux courses,
 * supprimer, imprimer...) vers l'objet attendu par le composant de rendu. Le deplacer ici
 * aurait exige SIX injections au lieu de deux — signe que la frontiere aurait ete au mauvais
 * endroit. Un module qui a besoin de six crochets pour vivre n'est pas un module.
 *
 * ETAT PRIVE : la recette affichee, sa provenance (`ai`/`fav`), l'identifiant du favori, et
 * l'echelle de portions. `renderRecipeModal` est le point d'entree UNIQUE du rendu — ses trois
 * appelants (ouverture, changement d'echelle, analyse nutritionnelle) passent tous par lui,
 * jamais par un remplacement direct du contenu.
 */

// `openModal` porte des cas particuliers pour d'autres ecrans et `buildRecipeHandlers` cable
// la zone favoris : les deux vivent dans `js/app.js`. Meme idiome d'injection que le selecteur
// de courses, la modale d'icone et le moteur de synchro.
const _hooks = { openModal: () => {}, buildRecipeHandlers: () => ({}) };

export function registerRecipeModalHooks(hooks = {}) {
    for (const cle of Object.keys(_hooks)) {
        if (typeof hooks[cle] === 'function') _hooks[cle] = hooks[cle];
    }
}

// LOT 010 (casse C12) — état du modal recette ouvert, module-level comme dans l'oracle
// (`_originalPpl`/`_currentScale`, `foodapp-v5-Joel.html` l.5357-5359). `_originalPpl`
// est LA référence : `_currentScale` en est toujours dérivé, jamais accumulé, ce qui
// évite toute dérive d'arrondi d'un changement à l'autre.
let _currentRecipeDetail = null;
let _currentRecipeSource = 'ai';
let _currentRecipeFavId = null;
let _originalPpl = 2;
let _currentScale = 1;

/**
 * Re-rend le modal recette avec l'échelle courante (LOT 010, casse C12).
 * Point d'entrée UNIQUE du rendu du modal : `openRecipeDetail` (nouvelle ouverture,
 * échelle réinitialisée), `changePplScale` (échelle changée) et `analyzeNutrition`
 * (échelle PRÉSERVÉE — l'analyse ne doit jamais remettre à 1 un choix déjà fait) s'y
 * appellent tous, jamais un `replaceChildren` direct.
 */
export function renderRecipeModal() {
    const modal = document.getElementById('modal-recipe-detail');
    if (!modal || !_currentRecipeDetail) return;
    const tags = buildIngredientTags(_currentRecipeDetail.ingredients, 'detail');
    modal.replaceChildren(renderRecipeDetail(
        _currentRecipeDetail,
        _currentRecipeSource,
        _hooks.buildRecipeHandlers(_currentRecipeDetail, _currentRecipeSource, _currentRecipeFavId),
        _currentScale,
        tags
    ));
}

export function openRecipeDetail(idx, source = 'ai') {
    let r = null;
    let favId = null;
    if (source === 'ai') {
        r = state.aiSuggestions[idx];
    } else if (source === 'fav') {
        const fav = state.favorites.find(f => f.id === idx);
        if (fav) {
            r = fav.recipe || fav;
            favId = fav.id;
        }
    }

    if (!r) return;

    _currentRecipeDetail = r;
    _currentRecipeSource = source;
    _currentRecipeFavId = favId;
    _originalPpl = parseInt(r.people || r.ppl) || 2;
    _currentScale = 1;

    renderRecipeModal();
    _hooks.openModal('modal-recipe-detail');
}

export async function analyzeNutrition(r, source, favId) {
    if (!r || !r.ingredients) return;
    const apiKey = state.aiConfig.apiKey;
    // Message unique (LOT 014, `MESSAGE_CLE_API_MANQUANTE`) ; l'action, elle, reste propre à
    // cet écran : on prévient sans ouvrir les Réglages, pour ne pas fermer la recette ouverte.
    if (!apiKey) { toast(MESSAGE_CLE_API_MANQUANTE, 'error'); return; }

    const btn = document.getElementById('rd-nutri-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Analyse...';
    }

    try {
        const ingList = (r.ingredients || []).map(i => (i.q || i.amount || '') + ' ' + (i.n || i.name)).join(', ');
        const prompt = `Tu es un nutritionniste expert. Analyse cette recette:\nNom: ${r.name}\nIngrédients: ${ingList}\nInstructions: ${(r.steps || r.instructions || []).join(' ')}\n\nEstime le Nutri-Score (A à E) et le nombre de kilocalories (kcal) pour UNE portion (la recette est pour ${r.people || r.ppl || 1} pers.), et propose 2 tags courts. Réponds UNIQUEMENT en JSON: {"score": "A", "kcal": 450, "tags": ["Sain", "Léger"]}`;

        const model = state.aiConfig.models?.nutrition || AI_ROLES.REASONING;
        const raw = await callAI(prompt, apiKey, model, { isJSON: false, temperature: 0.1 });
        // QUATRIÈME extracteur de JSON de l'app — il n'était pas dans l'inventaire des trois
        // remonté par l'audit, trouvé en câblant les autres. Même motif, même défaut : il
        // aurait cassé sur une estimation imbriquée (`{"nutrition":{"score":"A"}}`).
        const nutrition = extraireJsonIA(raw);
        if (!nutrition) throw new Error("Réponse IA invalide");
        r.nutrition = nutrition;

        saveState();
        // LOT 010 (casse C12) : re-rend via le point d'entrée unique, qui PRÉSERVE
        // l'échelle courante — une analyse ne doit jamais remettre le nombre de
        // personnes à sa valeur d'origine si l'utilisateur l'avait déjà changé.
        renderRecipeModal();
        toast('Analyse nutritionnelle terminée !');
    } catch (e) {
        console.error(e);
        toast("Erreur analyse nutrition", 'error');
        if (btn) {
            btn.disabled = false;
            // LOT 011 (chantier 2) : même libellé qu'à l'affichage initial du bouton — sans
            // ce rappel, un échec laissait un texte plus court que la première fois. SSOT
            // (LOT 014, audit adversarial) : importée depuis `recipe.js` plutôt que recopiée
            // en dur, comme ce commentaire le prétendait déjà sans le faire.
            btn.textContent = NUTRI_BTN_LABEL;
        }
    }
}

/**
 * Vrai plein écran d'appareil (LOT 009, casse C6) : la classe CSS
 * `recipe-fullscreen` assure le repli visuel même si l'API navigateur refuse
 * (contexte non interactif, permission absente) — la classe est posée AVANT
 * l'appel API et ne dépend jamais de sa réussite.
 */
export function isDocumentFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement);
}

export function requestElementFullscreen(el) {
    const request = el.requestFullscreen || el.webkitRequestFullscreen ||
        el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!request) return Promise.reject(new Error('Fullscreen API indisponible'));
    return request.call(el);
}

/**
 * SSOT de la sortie de plein ecran (LOT 014, volet D) : la combinaison « verifier PUIS
 * sortir en avalant l'echec » etait ecrite ici ET dans `closeModal` de `js/app.js`.
 * L'echec est volontairement ignore : le navigateur refuse parfois de sortir du plein
 * ecran hors d'un geste utilisateur, et ce refus ne doit pas casser la fermeture.
 *
 * REND `true` si le plein ecran NAVIGATEUR etait actif. Ce retour n'est pas cosmetique :
 * `toggleRecipeFullscreen` en a besoin pour son repli CSS. Quand le navigateur n'est PAS
 * en plein ecran (il a refuse la demande, ou l'appareil ne le propose pas), c'est la
 * classe `recipe-fullscreen` seule qui fait l'effet — il faut donc la retirer a la main.
 * Un helper sans retour aurait supprime ce repli EN SILENCE.
 */
export function quitterPleinEcranSiBesoin() {
    if (!isDocumentFullscreen()) return false;
    exitDocumentFullscreen().catch(() => {});
    return true;
}

export function exitDocumentFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen ||
        document.mozCancelFullScreen || document.msExitFullscreen;
    if (!exit) return Promise.resolve();
    return exit.call(document);
}

export function toggleRecipeFullscreen(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    if (el.classList.contains('recipe-fullscreen')) {
        if (!quitterPleinEcranSiBesoin()) el.classList.remove('recipe-fullscreen');
    } else {
        el.classList.add('recipe-fullscreen');
        requestElementFullscreen(el).catch(() => { /* repli CSS pur, cf. commentaire ci-dessus */ });
    }
}

export function syncRecipeFullscreenClass() {
    const el = document.getElementById('modal-recipe-detail');
    if (el && !isDocumentFullscreen()) el.classList.remove('recipe-fullscreen');
}

export function initRecipeFullscreenListeners() {
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
        .forEach(evt => document.addEventListener(evt, syncRecipeFullscreenClass));
}

/**
 * Recalcule les quantités affichées selon le nombre de personnes (LOT 010, casse
 * C12). Porté depuis l'oracle (`foodapp-v5-Joel.html` l.5467-5472) : la nouvelle
 * échelle se calcule TOUJOURS depuis `_originalPpl`, jamais en cumulant sur la
 * précédente — c'est ce qui garantit l'absence de dérive d'arrondi. Bornes 1-20 :
 * au-delà, le clic est sans effet.
 */
export function changePplScale(delta) {
    const newPpl = (_originalPpl * _currentScale) + delta;
    if (newPpl < 1 || newPpl > 20) return;
    _currentScale = newPpl / _originalPpl;
    renderRecipeModal();
}
