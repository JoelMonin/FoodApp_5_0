import { state, saveState } from '../state.js';
import { h, toast } from '../utils/dom.js';
import { generateId, areSimilar, autoEmoji, creativityLevel, envieActive } from '../utils/helpers.js';
import { DEFAULT_DB } from '../data.js';
import { MAX_PINNED_INGREDIENTS, MAX_EXTRA_INGREDIENTS, MESSAGE_CLE_API_MANQUANTE } from '../constants.js';
import { generateRecipes } from '../services/gemini.js';
import { buildIngredientTags } from '../utils/stockMatch.js';
import { renderRecipeCard } from './recipe.js';
import { openRecipeDetail } from './recipeModal.js';
import { saveSuggestionToFavDirect } from './favorites.js';
import { openEnhancedCartPicker } from './cartPicker.js';
import { openModal } from './modals.js';
import { togglePin } from '../actions.js';

/**
 * PANNEAU « RECETTES IA » — extrait de `js/app.js` au LOT 017.
 *
 * Deplacement PUR : pas une regle n'a change. Zone deja couverte avant le deplacement — cartes
 * riches, confort de generation, fidelite aux ingredients, zone imposee, message de cle API,
 * lecture d'URL — repartie sur plusieurs fichiers `tests/*.test.js`. (Le mode aleatoire 🎲,
 * present a l'epoque, a ete supprime au LOT 026 sur decision produit.)
 *
 * LE PLAN N'EN CITAIT QUE 9 FONCTIONS ; IL EN FALLAIT 17. Les huit oubliees n'avaient aucun
 * appelant hors de cet ecran — les laisser dans `js/app.js` y aurait fait vivre des orphelines
 * appelees uniquement d'ici :
 *  · `AI_LOADING_TEXTS` et `generationDejaEnCours` (garde partagee par les DEUX points d'entree
 *    de generation) ;
 *  · `updateAiCtaSummary` et `toggleAiSingle`, jumeaux de `toggleAiChip` ;
 *  · le triplet indissociable `renderExtraChips` / `updateAIContextSub` / `refreshImposedZone`,
 *    plus `renderImposedCapHint` et `removeExtraIngredient`.
 *
 * ETAT PRIVE : `_generationInFlight`. Il vivait en tete de `js/app.js`, a 300 lignes de la
 * garde qui le lit.
 *
 * `togglePin` s'importe DIRECTEMENT depuis `src/actions.js` : dans `js/app.js` ce n'etait
 * qu'un alias, donc un crochet aurait ete inutile. AUCUNE INJECTION dans ce module.
 */

// Une generation IA est-elle en cours ? Etat PRIVE : seule `generationDejaEnCours` le lit,
// seule `generateSuggestions` l'ecrit (l'autre ecrivain, le mode 🎲, est parti au LOT 026 —
// commentaire rectifie sur finding de l'audit du diff final).
let _generationInFlight = false;

// Textes d'attente animés pendant la génération (LOT 011, chantier 5 ; oracle
// l.5052-5058, littéraux exacts).
const AI_LOADING_TEXTS = ["Analyse du stock...", "Recherche d'idées...", "Rédaction des recettes..."];

/**
 * Garde anti-generations concurrentes (LOT 014, volet D). Elle protegeait DEUX points
 * d'entree jusqu'au retrait du mode 🎲 (LOT 026) ; il n'en reste qu'un,
 * `generateSuggestions`, et la garde reste indispensable (double-clic sur « Generer »).
 */
function generationDejaEnCours() {
    if (!_generationInFlight) return false;
    toast('Une génération est déjà en cours…', 'error');
    return true;
}

// MÉMOIRE ANTI-RÉPÉTITION (LOT 026, chantier C — décision de Joel : « seulement pour des
// générations en séries, par exemple dans un intervalle donné de 60 minutes »).
//
// Mémoire de SESSION uniquement, et c'est un choix : ni synchronisée, ni sauvegardée — un
// rechargement l'efface. La « série » dont parle Joel (regénérer parce que la fournée ne
// plaît pas) se joue dans la même session ; en faire un état persistant aurait touché le
// périmètre du document cloud (LOT 007) et du fichier de sauvegarde (LOT 015) pour un
// bénéfice nul. État PRIVÉ : seules les trois fonctions ci-dessous y touchent.
const FENETRE_ANTI_REPETITION_MS = 60 * 60 * 1000;
let _suggestionsRecentes = []; // [{ name, at }]

/** Noms proposés il y a moins d'une heure — vide à la première génération d'une session. */
export function nomsSuggestionsRecentes(maintenant = Date.now()) {
    _suggestionsRecentes = _suggestionsRecentes.filter(s => maintenant - s.at < FENETRE_ANTI_REPETITION_MS);
    return _suggestionsRecentes.map(s => s.name);
}

/** À appeler après une génération RÉUSSIE seulement : un échec n'a rien proposé à Joel. */
export function noterSuggestionsProposees(recipes, maintenant = Date.now()) {
    const noms = (recipes || []).map(r => r?.name).filter(Boolean);
    _suggestionsRecentes.push(...noms.map(name => ({ name, at: maintenant })));
}

/** Remise à zéro, pour l'isolation des tests (l'état de module survit entre deux `it`). */
export function viderSuggestionsRecentes() {
    _suggestionsRecentes = [];
}

export async function generateSuggestions() {
  if (generationDejaEnCours()) return;
  const apiKey = state.aiConfig.apiKey;
  if (!apiKey) { toast(MESSAGE_CLE_API_MANQUANTE, 'error'); openModal('modal-api-config'); return; }
  const stockItems = state.ingredients.filter(i => i.inStock);
  if (stockItems.length === 0) { toast('Inventaire vide', 'error'); return; }

  _generationInFlight = true;
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.classList.add('loading');

  // Rotation toutes les 2,5 s dans l'attribut lu par le CSS (`content: attr(data-loading-text)`,
  // déjà câblé). `clearInterval` garanti dans le `finally`, quel que soit le chemin de sortie.
  let loadingTextIdx = 0;
  btn.setAttribute('data-loading-text', AI_LOADING_TEXTS[0]);
  const loadingInterval = setInterval(() => {
    loadingTextIdx = (loadingTextIdx + 1) % AI_LOADING_TEXTS.length;
    btn.setAttribute('data-loading-text', AI_LOADING_TEXTS[loadingTextIdx]);
  }, 2500);

  try {
    const recipes = await generateRecipes(apiKey, stockItems, state.aiConfig, state.ingredients, state.extraIngredients, {
      // LOT 011 : si l'API rejette le niveau d'effort demande et que le repli reussit quand
      // meme, Joel doit le savoir au moment meme (demande explicite) — jamais silencieux.
      onThinkingFallback: () => toast('Recettes générées sans le mode réflexion approfondie (temporairement indisponible).'),
      // LOT 026, chantier C : les noms proposés il y a moins d'une heure partent dans le
      // prompt avec interdiction de les reproposer — liste vide = aucune ligne ajoutée.
      recentNames: nomsSuggestionsRecentes()
    });
    state.aiSuggestions = recipes;
    noterSuggestionsProposees(recipes);
    // renderAIResults(recipes); // No need, saveState() will trigger auto-render
    saveState();

    // Scroll auto vers les résultats sur mobile (LOT 011, chantier 5 ; oracle l.5068-5072).
    setTimeout(() => {
      if (window.innerWidth < 768) {
        document.getElementById('ai-results-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  } catch (e) {
    toast('Erreur IA : ' + e.message, 'error');
  } finally {
    clearInterval(loadingInterval);
    _generationInFlight = false;
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

export function renderAI() {
    restoreAIConfig();
    if (state.aiSuggestions && state.aiSuggestions.length > 0) {
        renderAIResults(state.aiSuggestions);
    }
}

export function renderAIResults(recipes) {
    const grid = document.getElementById('ai-results-list');
    if (!grid) return;
    grid.replaceChildren(...recipes.map((r, i) => {
        const tags = buildIngredientTags(r.ingredients, 'card');
        const handlers = {
            openRecipeDetail,
            saveToFavorites: () => saveSuggestionToFavDirect(r),
            addMissingToCart: () => openEnhancedCartPicker(r)
        };
        return renderRecipeCard(r, i, handlers, tags);
    }));
    document.getElementById('ai-placeholder')?.classList.add('hidden');
    document.getElementById('ai-results-list')?.classList.remove('hidden');
}

const CREATIVITY_LABEL_IDS = {
    classique: 'cr-label-classique',
    equilibre: 'cr-label-equilibre',
    creatif: 'cr-label-creatif'
};

/**
 * Met en évidence le libellé du palier de créativité actif (LOT 023). Seul geste visuel
 * qui manquait depuis toujours : les trois mots sous le curseur (Classique / Équilibrée /
 * Très créatif) étaient statiques, sans jamais indiquer lequel des trois résultats réels
 * était en vigueur — appelée à la fois à la restauration (`restoreAIConfig`) et à chaque
 * geste de l'utilisateur (`saveAiConfigFromUI`, `src/ui/settings.js`).
 * @param {'classique'|'equilibre'|'creatif'} niveau
 */
export function updateCreativityLabels(niveau) {
    Object.entries(CREATIVITY_LABEL_IDS).forEach(([cle, id]) => {
        document.getElementById(id)?.classList.toggle('active', cle === niveau);
    });
}

export function restoreAIConfig() {
    const cfg = state.aiConfig;
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) apiKeyInput.value = cfg.apiKey || '';

    // LOT 028 — rien n'est generique pour les champs TEXTE : sans cette ligne, la consigne
    // resterait ACTIVE dans l'etat (donc dans le message envoye a l'IA) tout en disparaissant
    // de l'ecran au rechargement. Le pire des deux mondes : une exigence invisible.
    document.getElementById('ai-envie') && (document.getElementById('ai-envie').value = cfg.envie || '');
    document.getElementById('ai-exceptions') && (document.getElementById('ai-exceptions').value = cfg.exceptions || '');
    document.getElementById('ai-exclusions') && (document.getElementById('ai-exclusions').value = cfg.exclusions || '');

    // Slider de créativité (LOT 008, chantier 6) : ?? plutôt que || pour ne pas
    // écraser une créativité volontairement réglée à 0 (minimum légitime du slider).
    //
    // LOT 023 — le curseur n'a plus que 3 arrêts fermes (0/50/100, `index.html step="50"`).
    // On affiche donc le CRAN du palier, pas la valeur brute : une ancienne sauvegarde
    // (ex. un tirage 80-100 de l'ancien bouton 🎲, supprimé au LOT 026 mais dont les
    // valeurs persistent dans les données) peut contenir une valeur intermédiaire — le
    // pouce du curseur doit malgré tout se poser sur l'un des trois arrêts, jamais entre
    // deux. `state.aiConfig.creativity` lui-même n'est PAS modifié ici : seul l'affichage
    // est arrondi au palier, la donnée garde sa précision d'origine.
    const niveau = creativityLevel(cfg.creativity ?? 50);
    const creativitySlider = document.getElementById('creativity-slider');
    if (creativitySlider) creativitySlider.value = String({ classique: 0, equilibre: 50, creatif: 100 }[niveau]);
    updateCreativityLabels(niveau);

    // Restore chips active state
    document.querySelectorAll('.ai-settings .chip').forEach(chip => {
        const field = chip.closest('.chips-row').id?.replace('ai-', '').replace('-chips', '');
        if (field && cfg[field]) {
            if (Array.isArray(cfg[field])) {
                chip.classList.toggle('active', cfg[field].includes(chip.dataset.val));
            } else {
                chip.classList.toggle('active', cfg[field] === chip.dataset.val);
            }
        }
    });

    updateAiCtaSummary();
}

/**
 * Rappel des reglages actifs, juste au-dessus du bouton « Obtenir 5 suggestions ».
 *
 * LOT 028 — EXPORTEE (elle etait privee) pour que `saveAiConfigFromUI` (`src/ui/settings.js`)
 * puisse la rafraichir a la frappe. Meme voie que `updateCreativityLabels` : `settings.js`
 * importe `aiPanel.js`, jamais l'inverse — pas de cycle.
 *
 * LA CONSIGNE LIBRE S'Y AFFICHE, et ce n'est pas de la decoration : une envie tapee un mardi
 * puis oubliee continuerait sinon de filtrer toutes les generations des jours suivants sans
 * que rien ne le dise. Le rappel la remet sous les yeux AU MOMENT de generer.
 *
 * Consigne vide → texte strictement inchange (`Plat · 2 pers.`) : la non-regression est
 * verifiee par le test du LOT 022 (`tests/restore-ai-config.test.js`), laisse tel quel.
 */
export function updateAiCtaSummary() {
    const summaryEl = document.getElementById('ai-cta-summary');
    if (!summaryEl) return;

    const base = `${state.aiConfig.meal || 'Plat'} · ${state.aiConfig.ppl || '2'} pers.`;
    const envie = envieActive(state.aiConfig);
    if (!envie) {
        summaryEl.textContent = base;
        return;
    }
    // `h()` et non `innerHTML` : le texte vient de Joel, mais la regle de campagne ne fait
    // pas d'exception (aucun `innerHTML` sur du contenu non fige). Le `<span>` reprend le
    // vert deja prevu par la feuille de style (`.ai-cta-summary span`, jamais utilise
    // jusqu'ici) et porte la troncature — sans elle, une longue consigne casserait la barre.
    summaryEl.replaceChildren(`${base} · `, h('span', {}, `« ${envie} »`));
}

export function toggleAiSingle(field, el) {
    el.closest('.chips-row').querySelectorAll('.chip')
      .forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    state.aiConfig[field] = el.dataset.val;
    saveState(false);
    updateAiCtaSummary();
}

export function toggleAiChip(field, el) {
    el.classList.toggle('active');
    const active = Array.from(el.closest('.chips-row').querySelectorAll('.chip.active'))
        .map(c => c.dataset.val);
    state.aiConfig[field] = active;
    saveState(false);
}

export function addExtraIngredient() {
    const input = document.getElementById('ez-input');
    const val = input?.value?.trim();
    if (!val) return;

    // Plafond des « hors stock », séparé de celui des épinglés (LOT 010 : le 6 en dur
    // est remonté dans la SSOT des plafonds, le message reste celui de l'oracle l.4917).
    if (state.extraIngredients.length >= MAX_EXTRA_INGREDIENTS) {
        toast(`Maximum ${MAX_EXTRA_INGREDIENTS} ingrédients hors stock`, 'error'); return;
    }

    // Check similarity in Inventory
    const similarInStock = state.ingredients.find(ing => ing.inStock && areSimilar(ing.name, val));
    if (similarInStock) {
        if (!confirm(`⚠️ "${similarInStock.name}" est déjà en stock ! Voulez-vous vraiment ajouter "${val}" en hors-stock ?`)) return;
    }

    // Check similarity in existing hors-stock
    const similarInExtra = state.extraIngredients.find(ei => areSimilar(ei.name, val));
    if (similarInExtra) {
        if (!confirm(`ℹ️ "${val}" ressemble beaucoup à "${similarInExtra.name}" déjà présent dans la liste. Ajouter quand même ?`)) return;
    }

    // LOT 012, zone C (oracle l.4933) : emoji devine depuis la base plutot qu'une
    // etoile fixe qui ne renseignait jamais Joel sur ce qu'il venait de taper.
    const emoji = autoEmoji(val, DEFAULT_DB);
    state.extraIngredients.push({ name: val, emoji, id: generateId('extra') });
    input.value = '';
    saveState();
    refreshImposedZone();
}

/**
 * Remplit le libellé des plafonds depuis la SSOT (LOT 010, casse C9).
 * L'interface annonçait « Max 6 ingrédients imposés au total » alors que les deux
 * familles sont plafonnées SÉPARÉMENT — un mensonge visible par l'utilisateur.
 */
export function renderImposedCapHint() {
    const el = document.getElementById('imposed-cap-hint');
    if (el) el.textContent = `Max ${MAX_PINNED_INGREDIENTS} épinglés + ${MAX_EXTRA_INGREDIENTS} hors stock`;
}

/**
 * Zone « Ingrédients imposés » de l'écran IA (LOT 010, casse C10).
 *
 * Remplace l'ancien `renderExtraChips` qui n'affichait QUE les extras, sans emoji,
 * et ne se rafraîchissait qu'au rendu de la vue IA — un épinglé était envoyé à l'IA
 * (`gemini.js`) mais invisible et non retirable ici.
 *
 * Porté depuis l'oracle (`renderImposedZone`, `foodapp-v5-Joel.html` l.4875-4910),
 * en DOM-safe via `h()` plutôt que le `innerHTML` littéral de l'original — même
 * choix de sécurité que pour le panneau système du LOT 009.
 */
export function renderExtraChips() {
    const container = document.getElementById('imposed-chips');
    if (!container) return;

    const pinned = state.ingredients.filter(i => i.pinned);
    const extras = state.extraIngredients || [];

    if (pinned.length === 0 && extras.length === 0) {
        container.replaceChildren(h('span', { class: 'pz-empty' }, 'Aucun ingrédient imposé'));
        return;
    }

    const blocs = [];

    if (pinned.length > 0) {
        blocs.push(h('div', { class: 'pz-label' }, "📍 Dans l'inventaire"));
        blocs.push(h('div', { class: 'pz-chips' }, pinned.map(ing => h('div', { class: 'pz-chip' }, [
            h('span', {}, ing.emoji),
            ` ${ing.name} `,
            h('span', { class: 'pz-chip-del', onclick: () => togglePin(ing.id) }, '✕')
        ]))));
    }

    if (extras.length > 0) {
        blocs.push(h('div', { class: 'ez-label', style: { marginTop: '12px' } }, '🛒 Hors inventaire'));
        blocs.push(h('div', { class: 'pz-chips' }, extras.map(ei => h('div', { class: 'ez-chip' }, [
            h('span', {}, ei.emoji),
            ` ${ei.name} `,
            h('span', { class: 'ez-chip-del', onclick: () => removeExtraIngredient(ei.id) }, '✕')
        ]))));
    }

    container.replaceChildren(...blocs);
}

/**
 * Sous-titre vivant de l'écran IA (LOT 010, casse C10).
 * Porté depuis l'oracle (`updateAIContextSub`, `foodapp-v5-Joel.html` l.4943-4953) :
 * segments « épinglé(s) » et « hors stock » masqués quand leur compteur vaut 0.
 */
export function updateAIContextSub() {
    const el = document.getElementById('ai-context-sub');
    if (!el) return;
    const stock = state.ingredients.filter(i => i.inStock).length;
    const pinned = state.ingredients.filter(i => i.pinned).length;
    const extra = (state.extraIngredients || []).length;
    let s = stock + ' ingrédient' + (stock > 1 ? 's' : '') + ' en stock';
    if (pinned > 0) s += ` · ${pinned} épinglé${pinned > 1 ? 's' : ''}`;
    if (extra > 0) s += ` · ${extra} hors stock`;
    el.textContent = s;
}

/**
 * Rafraîchit la zone imposée ET le sous-titre en un seul appel (LOT 010, casse C10) :
 * dépassement volontaire de l'oracle, assumé et tracé dans la fiche du lot — l'oracle
 * ne rafraîchissait le sous-titre qu'à certains endroits, oubliant l'épinglage.
 */
export function refreshImposedZone() {
    renderExtraChips();
    updateAIContextSub();
}

export function removeExtraIngredient(id) {
    state.extraIngredients = state.extraIngredients.filter(it => it.id !== id);
    saveState();
    refreshImposedZone();
}

// LOT 026, chantier B — `generateRandomWithStock` (le bouton 🎲, restaure au LOT 011
// chantier 4) a ete SUPPRIMEE sur decision produit de Joel du 2026-08-02, confirmee par
// question fermee : son tirage de creativite 80-100 produisait exactement la meme consigne
// que le curseur pousse a fond (tout > 66 = la meme phrase), seuls les filtres vides le
// distinguaient. Fiche du lot, §1 point 2 et §3.B — ce n'est pas une regression, c'est un
// retrait voulu et trace.
