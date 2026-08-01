import { state, saveState } from '../state.js';
import { toast } from '../utils/dom.js';
import { generateId, formatDateFr } from '../utils/helpers.js';
import { AI_ROLES, MESSAGE_CLE_API_MANQUANTE } from '../constants.js';
import { transformRecipeFromText } from '../services/gemini.js';
import { isValidRecipe } from '../utils/validate.js';
import { openModal, closeModal } from './modals.js';
import { openEnhancedCartPicker } from './cartPicker.js';
import { updateBadges } from './topbar.js';

/**
 * MODALE « COLLER UNE RECETTE » — extraite de `js/app.js` au LOT 017.
 *
 * Deplacement PUR : pas une regle n'a change. Zone couverte par `tests/ai-url-fetch.test.js`,
 * `tests/favorites-rich.test.js` et `tests/ai-generation-comfort.test.js`.
 *
 * CE MODULE RECUPERE LES 29 LIGNES QUE LE VOLET A AVAIT MISES DE COTE. La remise a zero de
 * cette fenetre vivait DANS `openModal` : c'est elle qui rendait impossible de sortir le socle
 * des modales proprement, puisqu'elle ECRIT `_lastTransformedRecipe`, l'etat prive de cet
 * ecran. Elle est ici chez elle, et le socle se contente de la declencher par crochet.
 *
 * `_lastTransformedRecipe` EST REMONTEE EN TETE. Dans `js/app.js` elle etait declaree APRES
 * ses trois usages — legal en JavaScript pour un `let` de module lu a l'execution seulement,
 * mais illisible : on croyait lire une variable venue d'ailleurs. Sa position change, pas son
 * comportement.
 *
 * DEUX CHEMINS DE SAUVEGARDE, ET UN PIEGE DE NOMMAGE. `savePastedRecipe` et
 * `savePastedRecipeAndList` sont publiees sur `window` sous les noms `saveRecipeOnly` et
 * `saveRecipeAndList` — qui sont AUSSI les noms de deux fonctions differentes dans
 * `src/ui/favorites.js`. Quatre fonctions, deux noms, deux modules : ne jamais les unifier
 * sans verifier laquelle le HTML appelle reellement.
 *
 * A NOTER, FIGE TEL QUEL (pare-feu A/B) : ces deux fonctions poussent dans `state.favorites`
 * en direct au lieu de passer par `pousserFavori`, la SSOT des favoris. Ce n'est pas un oubli
 * — `buildPastedFavorite` a deja attribue l'identifiant et la date, que `pousserFavori`
 * reattribuerait. Une unification demanderait un changement de comportement, donc un lot dedie.
 */

// Recette structuree renvoyee par l'IA, en attente de sauvegarde. Etat PRIVE : seules
// `buildPastedFavorite` (lecture) et `resetPasteModal`/`transformRecipeAI` (ecriture) y touchent.
let _lastTransformedRecipe = null;

/**
 * Active/désactive les boutons d'enregistrement de la fenêtre « Coller une recette ».
 *
 * BUG RÉEL trouvé par l'audit du sous-lot 11B (Codex Terra + Gemini, convergents) :
 * cette fonction désactivait AUSSI « Sauvegarder tel quel » tant qu'aucune transformation
 * IA n'avait eu lieu — rendant l'arbitrage A1 (restaurer la sauvegarde d'un texte brut
 * SANS IA) inatteignable depuis l'interface réelle, alors même que `buildPastedFavorite`
 * fonctionnait parfaitement une fois appelée directement (ce que les tests faisaient,
 * masquant le bug). Corrigé : « Sauvegarder tel quel » reste TOUJOURS actif — c'est
 * `buildPastedFavorite` qui valide titre/contenu au moment du clic, pas l'état du bouton.
 * Seul « + Liste » (qui suppose des ingrédients structurés) reste conditionné par
 * `enabled` ; sa VISIBILITÉ, elle, est gérée séparément (révélée par `transformRecipeAI`,
 * remise à `none` par la remise à zéro ci-dessous) — plus par cette fonction.
 */
export function setPasteSaveButtonsEnabled(enabled) {
    const saveBtn = document.getElementById('paste-save-btn');
    if (saveBtn) saveBtn.disabled = false;

    const listBtn = document.getElementById('paste-list-btn');
    if (listBtn) listBtn.disabled = !enabled;
}

/**
 * Ce que cette fenetre doit faire A SON OUVERTURE. Branchee sur `src/ui/modals.js` par
 * `registerModalHooks` (LOT 017) — c'etait auparavant un `if (id === 'modal-paste-recipe')`
 * de 29 lignes loge dans `openModal`.
 */
export function resetPasteModal() {
    // Sans cette remise a zero, la recette transformee lors d'une ouverture
    // precedente survivait : « Sauvegarder tel quel » enregistrait alors la
    // recette d'avant, silencieusement.
    _lastTransformedRecipe = null;
    setPasteSaveButtonsEnabled(false);
    // LOT 011, chantier 5 (oracle openPasteModal, l.5932-5942) : le LOT 006 ne
    // purgeait que _lastTransformedRecipe — titre/contenu/URL survivaient d'une
    // ouverture à l'autre, et le textarea restait verrouillé si la dernière session
    // avait transformé une recette.
    const titleInput = document.getElementById('paste-title');
    const contentInput = document.getElementById('paste-content');
    const urlInput = document.getElementById('paste-url');
    if (titleInput) titleInput.value = '';
    if (contentInput) {
        contentInput.value = '';
        contentInput.disabled = false;
    }
    if (urlInput) urlInput.value = '';
    const aiBtn = document.getElementById('paste-ai-btn');
    if (aiBtn) aiBtn.style.display = '';
    const saveBtn = document.getElementById('paste-save-btn');
    if (saveBtn) saveBtn.textContent = 'Sauvegarder tel quel';
    // « + Liste » repart masqué (état par défaut du HTML) : sans cette ligne, une
    // transformation IA de la session précédente le laissait visible — durcissement
    // signalé par l'audit du sous-lot 11B.
    const listBtn = document.getElementById('paste-list-btn');
    if (listBtn) listBtn.style.display = 'none';
}

/**
 * Construit le favori à partir de la fenêtre « Coller une recette » — recette structurée
 * si transformée par l'IA, texte brut sinon. Restaure un chemin cassé par le LOT 006
 * (arbitrage Joel A1, fiche LOT 011 §12) : `_lastTransformedRecipe` n'existant qu'après
 * passage par l'IA, le bouton grisé jusque-là rendait le texte brut seul INATTEIGNABLE —
 * une recette collée sans transformation ne pouvait plus jamais être sauvegardée. Porte
 * le double chemin de l'oracle (`saveRecipeOnly`/`saveRecipeAndList` l.6036-6058).
 * @returns {Object|null} null si titre/contenu manquants (toast déjà émis).
 */
function buildPastedFavorite() {
    const title = document.getElementById('paste-title')?.value.trim() || '';
    const content = document.getElementById('paste-content')?.value.trim() || '';
    if (!title || (!content && !_lastTransformedRecipe)) {
        toast('Titre et contenu requis', 'error');
        return null;
    }
    const date = formatDateFr();
    return _lastTransformedRecipe
        ? { ..._lastTransformedRecipe, id: generateId('fav'), date }
        : { id: generateId('fav'), title, content, date };
}

export function savePastedRecipe() {
    const fav = buildPastedFavorite();
    if (!fav) return;
    state.favorites.push(fav);
    saveState();
    updateBadges();
    closeModal('modal-paste-recipe');
    toast(`⭐ ${fav.name || fav.title} sauvegardé en favori`);
}

export function savePastedRecipeAndList() {
    const fav = buildPastedFavorite();
    if (!fav) return;
    state.favorites.push(fav);
    saveState();
    updateBadges();
    closeModal('modal-paste-recipe');
    if (fav.ingredients) {
        openEnhancedCartPicker(fav);
    } else {
        // Pas d'ingrédients structurés (texte brut) : rien à proposer pour la liste de
        // courses. Cas déjà inatteignable dans l'oracle lui-même (le bouton « + Liste »
        // n'est révélé qu'après une transformation IA réussie, chantier 5).
        toast(`⭐ ${fav.title} sauvegardé en favori`);
    }
}

export async function fetchRecipeFromUrl() {
    const urlInput = document.getElementById('paste-url');
    const url = (urlInput?.value || '').trim();
    if (!url) { toast('Veuillez entrer une adresse URL', 'error'); return; }
    if (!url.startsWith('http')) { toast('L\'adresse doit commencer par http:// ou https://', 'error'); return; }

    const btn = document.getElementById('paste-fetch-btn');
    btn.disabled = true;
    btn.textContent = 'Lecture...';

    // Delai d'expiration : sans lui, un service tiers bloque laisserait le bouton
    // en "Lecture..." indefiniment (durcissement post-audit, LOT 011 §10-D).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        // Jina Reader (l.5944-5974 de l'oracle) : contourne le CORS et extrait le texte
        // principal. Arbitrage Joel (LOT 011 §9 Q2) : AUCUN repli sur un autre service —
        // remplace l'ancien allorigins, ne le garde pas en secours.
        const res = await fetch(`https://r.jina.ai/${url}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Impossible de lire la page');
        const text = await res.text();
        if (!text || !text.trim()) throw new Error('Page vide');

        document.getElementById('paste-content').value = text;
        const mainTitle = text.split('\n')[0].replace(/^#+\s*/, '').trim();
        if (mainTitle) document.getElementById('paste-title').value = mainTitle;

        toast('Page lue ! Cliquez sur Transformer avec l\'IA.');
    } catch (e) {
        toast('Erreur de lecture. Vérifiez l\'URL ou copiez le texte manuellement.', 'error');
    } finally {
        clearTimeout(timeoutId);
        btn.disabled = false;
        btn.textContent = '🌍 Lire la page';
    }
}

export async function transformRecipeAI() {
    const title = document.getElementById('paste-title')?.value || '';
    const content = document.getElementById('paste-content')?.value;
    if (!content) return;
    if (!state.aiConfig.apiKey) { toast(MESSAGE_CLE_API_MANQUANTE, 'error'); openModal('modal-api-config'); return; }

    const btn = document.getElementById('paste-ai-btn');
    btn.disabled = true;
    btn.textContent = 'Transformation...';
    try {
        const stockItems = state.ingredients.filter(i => i.inStock);
        const model = state.aiConfig.models?.smartPaste || AI_ROLES.REASONING;
        const recipe = await transformRecipeFromText(title, content, stockItems, state.aiConfig.apiKey, model, {
            onThinkingFallback: () => toast('Recette transformée sans le mode réflexion approfondie (temporairement indisponible).')
        });
        // LOT 014, volet C — la réponse de l'IA était lue À L'AVEUGLE : `recipe.name` était
        // écrit dans le champ sans qu'on sache si `recipe` était bien une recette. Une
        // réponse déraillée (objet sans nom, `steps` qui n'est pas une liste, titre d'un
        // paragraphe entier) était acceptée, verrouillait le texte source de Joel et
        // devenait sauvegardable en favori.
        if (!isValidRecipe(recipe)) {
            toast('Réponse de l\'IA inexploitable — votre texte est intact', 'error');
            return; // le `finally` réarme le bouton : Joel peut relancer
        }
        _lastTransformedRecipe = recipe;
        document.getElementById('paste-title').value = recipe.name;
        // LOT 011, chantier 5 (oracle l.6019-6025) : verrouille le texte source et affiche
        // un aperçu — après transformation, c'est la recette structurée qui sera
        // sauvegardée, plus le texte brut, qui n'a donc plus de raison d'être modifiable.
        document.getElementById('paste-content').value = "✅ Recette analysée et formatée par l'IA.\n\n" + (recipe.description || '');
        document.getElementById('paste-content').disabled = true;
        document.getElementById('paste-ai-btn').style.display = 'none';
        document.getElementById('paste-save-btn').textContent = 'Sauvegarder en favoris';
        document.getElementById('paste-list-btn').style.display = '';
        setPasteSaveButtonsEnabled(true);
        toast('Recette structurée !');
    } catch (e) {
        toast('Erreur transformation IA', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Transformer avec l\'IA ✨';
    }
}
