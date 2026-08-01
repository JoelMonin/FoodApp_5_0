import { h } from '../utils/dom.js';
import { scaleQty } from '../utils/helpers.js';

/**
 * Carte de résultat IA complète (LOT 011, chantier 1). Structure et règle des couleurs
 * restaurées à l'identique de l'oracle (`renderAIResults`, `foodapp-v5-Joel.html`
 * l.5283-5331) : numéro, méta complète, pitch, tags colorés (max 6), boutons directs.
 *
 * @param {Object} r - Recette (résultat IA).
 * @param {number} index - Position dans la liste (numéro affiché = index + 1).
 * @param {Object} handlers - `openRecipeDetail(index, source)` obligatoire ;
 *   `saveToFavorites()` et `addMissingToCart()` optionnels — les boutons correspondants
 *   ne sont rendus QUE si le handler est fourni, pour rester sûr si un futur appelant
 *   (favoris, LOT 011 chantier 7) réutilise ce composant sans les fournir.
 * @param {Array} tags - Pré-calculés par l'appelant (`buildIngredientTags`,
 *   `js/app.js`) : ce composant ne touche jamais à l'état global (décision D2).
 */
export function renderRecipeCard(r, index, handlers, tags = []) {
  const { openRecipeDetail, saveToFavorites, addMissingToCart, source = 'ai' } = handlers;

  // LOT 019 : le bouton suit les TAGS, et rien d'autre. Il testait aussi `i.s === 'missing'`
  // en second terme d'un OU — depuis que l'inventaire a le dernier mot sur les cas clairs,
  // un `s: 'missing'` périmé (l'IA croit manquant ce que Joel a en stock) aurait fait
  // apparaître « hors stock => courses » sous une rangée de tags tous verts.
  const hasMissing = typeof addMissingToCart === 'function' && tags.some(t => t.cls === 'red');

  return h('div', {
    class: 'recipe-card',
    onclick: () => openRecipeDetail(index, source)
  }, [
    h('div', { class: 'rc-header' }, [
      h('div', { class: 'rc-num' }, String(index + 1)),
      h('div', { class: 'rc-body' }, [
        h('div', { class: 'rc-name' }, r.name || r.title || 'Recette sans titre'),
        h('div', { class: 'rc-meta' }, [
          h('span', {}, `⏱ ${r.time || '?'}`),
          h('span', {}, `${r.difficulty === 'Facile' ? '😊' : r.difficulty === 'Moyen' ? '🧑‍🍳' : '👨‍Chef'} ${r.difficulty || 'Normal'}`),
          h('span', {}, `${(r.people || r.ppl || 2) > 1 ? '👥' : '👤'} ${r.people || r.ppl || 2} pers.`),
          h('span', {}, `🍴 ${r.cuisine || 'Cuisine'}`)
        ]),
        r.description ? h('div', { class: 'rc-pitch' }, r.description) : null,
        h('div', { class: 'rc-tags' }, tags.slice(0, 6).map(t =>
          h('span', { class: `r-tag ${t.cls}`, title: t.tooltip }, (t.isPinned ? '📌 ' : '') + t.name)
        ))
      ].filter(Boolean))
    ]),
    h('div', { class: 'rc-actions' }, [
      h('button', {
        class: 'rc-btn primary',
        onclick: (e) => { e.stopPropagation(); openRecipeDetail(index, source); }
      }, 'Voir la recette →'),
      typeof saveToFavorites === 'function' ? h('button', {
        class: 'rc-btn',
        onclick: (e) => { e.stopPropagation(); saveToFavorites(); }
      }, '⭐ Favoris') : null,
      hasMissing ? h('button', {
        class: 'rc-btn cart-btn',
        onclick: (e) => { e.stopPropagation(); addMissingToCart(); }
      }, '🛍 hors stock => courses') : null
    ].filter(Boolean))
  ]);
}

/**
 * Carte de favori (LOT 011, chantier 7). Composant DÉDIÉ, distinct de `renderRecipeCard`
 * (trouvé par l'audit du sous-lot 11A : les deux vues partageaient la même carte sans lui
 * passer les mêmes handlers). Structure oracle : `renderFavorites`,
 * `foodapp-v5-Joel.html` l.5867-5916 — vignette, extrait, tags (max 8, plafond distinct
 * des cartes IA), boutons Voir/Supprimer.
 *
 * @param {Object} fav - Entrée de favori : `{ id, date, recipe }` (recette structurée) ou
 *   `{ id, date, title, content }` (texte brut collé, cf. arbitrage Joel A1).
 * @param {Object} handlers - `openFav()`, `deleteFavorite()`.
 * @param {Array} tags - Pré-calculés par l'appelant, cf. `renderRecipeCard`.
 */
export function renderFavoriteCard(fav, handlers, tags = []) {
  const { openFav, deleteFavorite } = handlers;
  const r = fav.recipe || fav;
  const title = r.name || r.title || 'Recette sans titre';
  const desc = r.description || (r.content ? r.content.slice(0, 100) + '...' : '');

  return h('div', { class: 'fav-card', onclick: () => openFav() }, [
    h('div', { class: 'fav-header' }, [
      h('div', { class: 'fav-title' }, title)
    ]),
    fav.date ? h('div', { class: 'fav-date' }, fav.date) : null,
    desc ? h('div', { class: 'fav-excerpt' }, desc) : null,
    tags.length > 0 ? h('div', { class: 'rc-tags', style: { marginBottom: '12px' } },
      tags.slice(0, 8).map(t => h('span', { class: `r-tag ${t.cls}`, title: t.tooltip },
        (t.isPinned ? '📌 ' : '') + t.name))
    ) : null,
    h('div', { class: 'fav-actions' }, [
      h('button', {
        class: 'fav-btn',
        onclick: (e) => { e.stopPropagation(); openFav(); }
      }, '👁 Voir'),
      h('button', {
        class: 'fav-btn del',
        onclick: (e) => { e.stopPropagation(); deleteFavorite(); }
      }, '🗑 Supprimer')
    ])
  ].filter(Boolean));
}

const DIFFICULTY_EMOJI = { Facile: '😊', Moyen: '🧑‍🍳' };
const NUTRI_SCORE_LETTERS = ['A', 'B', 'C', 'D', 'E'];
// EXPORTÉE (trouvé par audit adversarial, LOT 014, 2026-07-31) : `recipeModal.js` doit
// réafficher EXACTEMENT ce même texte après un échec d'analyse (LOT 011, chantier 2), et le
// recopiait en dur — un commentaire y citait pourtant déjà cette constante comme la source
// de vérité, sans jamais l'importer. Si Joel reformule un jour ce bouton, un seul endroit
// à changer désormais.
export const NUTRI_BTN_LABEL = '🔍 Estimer la valeur nutritionnelle (IA)';

/**
 * Écran de détail de recette complet (LOT 011, chantier 2). Restauré à l'identique de
 * l'oracle (`openRecipeDetail`/`renderRecipeBody`, `foodapp-v5-Joel.html` l.5362,
 * l.5486-5597) : méta complète, pastilles d'état par ingrédient, section « État des
 * stocks », Nutri-Score visuel, étapes cochables, et surtout le cas `r.content` — un
 * favori texte brut (arbitrage Joel A1) affiche TOUJOURS son texte, jamais une fiche
 * vide.
 *
 * **Acquis 009/010 à ne jamais perdre en retouchant cette fonction** (racine
 * `.modal-content` inchangée, `#modal-recipe-detail` ciblé côté `js/app.js`) :
 * bouton 🖨️, plein écran (`.recipe-fullscreen` posée sur ce même `.modal-content`),
 * fermeture par glissement (`initSwipeToClose` cherche `.modal-content` dans l'overlay),
 * recalcul des quantités (`#rd-ppl-count`, `.scale-btn` ×2, dans cet ordre −/+).
 *
 * @param {number} [scale=1] - Facteur d'échelle des quantités (LOT 010, casse C12).
 *   Présentation UNIQUEMENT : ne touche jamais `r.ingredients` (recette, favori,
 *   suggestion IA — tous préservés intacts), recalculé depuis la chaîne d'origine
 *   à chaque rendu. À 1, la chaîne d'origine est rendue telle quelle (aucun
 *   reformatage), ce qui garantit l'aller-retour exact.
 * @param {Array} tags - Tags d'état par ingrédient, pré-calculés par l'appelant
 *   (`buildIngredientTags(r.ingredients, 'detail')`, `js/app.js`) — ce composant ne
 *   touche jamais à l'état global (décision D2). Même ordre que `r.ingredients`.
 */
export function renderRecipeDetail(r, source, handlers, scale = 1, tags = []) {
  const {
    closeModal,
    toggleRecipeFullscreen,
    changePplScale,
    saveSuggestionToFav,
    addSuggestionToCart,
    saveRecipeOnly,
    saveRecipeAndList,
    deleteFav,
    printRecipe
  } = handlers;

  const title = r.name || r.title || 'Recette';
  // Bascule inspirée de l'oracle (l.5486 : `if (r.steps) {...} else {...}`), DURCIE par
  // l'audit du sous-lot 11B : `r.steps` seul peut être absent sur une vraie recette IA
  // dont la réponse a été tronquée juste avant les étapes (le sauvetage de JSON,
  // `src/services/gemini.js`, exige `ingredients` mais pas `steps`, précisément pour ne
  // pas jeter une recette par ailleurs valide). `r.ingredients` sert de second signal :
  // un favori texte brut collé (arbitrage A1) n'a NI l'un NI l'autre. Une recette IA
  // structurée mais sans étapes tombe donc ici, et affiche « Aucune étape » plus bas —
  // jamais un écran totalement vide.
  const isStructured = !!(r.steps || r.ingredients);

  const header = h('div', { class: 'modal-header' }, [
    h('div', { class: 'mh-left' }, [
      h('button', { class: 'mh-btn', 'data-testid': 'rd-close', onclick: () => closeModal('modal-recipe-detail') }, '✕'),
      h('div', { class: 'mh-title' }, title)
    ]),
    h('div', { class: 'mh-right' }, [
      h('button', { class: 'mh-btn', 'data-testid': 'rd-print', onclick: () => printRecipe(), title: 'Imprimer' }, '🖨️'),
      h('button', { class: 'mh-btn', 'data-testid': 'rd-fullscreen', onclick: () => toggleRecipeFullscreen('modal-recipe-detail'), title: 'Plein écran' }, '⛶')
    ])
  ]);

  // Bouton panier masqué sur un favori texte brut : rien de structuré à y mettre
  // (oracle l.5597 : `rd-cart-btn.style.display = 'none'` dans ce cas).
  const footer = h('div', { class: 'modal-footer' },
    source === 'ai' ? [
      h('button', { class: 'tb-btn', onclick: () => saveSuggestionToFav() }, '⭐ Favoris'),
      isStructured ? h('button', { class: 'tb-btn primary', onclick: () => addSuggestionToCart() }, '🛒 Liste de courses') : null
    ].filter(Boolean) : source === 'fav' ? [
      h('button', { class: 'tb-btn del', onclick: () => { deleteFav(); closeModal('modal-recipe-detail'); } }, '🗑️ Supprimer'),
      isStructured ? h('button', { class: 'tb-btn primary', onclick: () => addSuggestionToCart() }, '🛒 Liste de courses') : null
    ].filter(Boolean) : [
      h('button', { class: 'tb-btn', onclick: () => saveRecipeOnly() }, '💾 Sauver'),
      h('button', { class: 'tb-btn primary', onclick: () => saveRecipeAndList() }, '🛒 + Liste')
    ]
  );

  if (!isStructured) {
    return h('div', { class: 'modal-content' }, [
      header,
      h('div', { class: 'modal-body' }, [
        h('div', { class: 'rd-raw-content', style: { whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: '1.7', color: 'var(--txt-mid)', padding: '10px 0' } },
          r.content || '')
      ]),
      footer
    ]);
  }

  const originalPpl = parseInt(r.people || r.ppl) || 2;
  const displayedPpl = Math.round(originalPpl * scale);

  const difficultyEmoji = DIFFICULTY_EMOJI[r.difficulty] || '👨‍Chef';

  // « 👨‍🍳 Ingrédients & Quantités » — pastille colorée + emoji + nom + quantité mise
  // à l'échelle (oracle l.5499-5509).
  const ingList = h('div', { class: 'recipe-ing-qty-list' },
    (r.ingredients || []).map((ing, i) => {
      const tag = tags[i];
      const dotColor = !tag ? 'var(--txt-soft)' : tag.cls === 'green' ? 'var(--green)' : tag.cls === 'orange' ? '#ef6c00' : '#d63031';
      const qty = scaleQty(ing.q || ing.amount, scale);
      return h('div', { class: 'rd-ing-row' }, [
        h('span', {}, [
          h('span', { style: { color: dotColor } }, '● '),
          (tag?.emoji ? tag.emoji + ' ' : ''),
          h('b', {}, ing.n || ing.name)
        ]),
        qty ? h('span', { class: 'rd-ing-amount' }, qty) : null
      ].filter(Boolean));
    })
  );

  // « 📋 État des stocks » — série complète (SANS limite, contrairement aux cartes).
  const stockTags = h('div', { class: 'recipe-ing-list' },
    tags.map(t => h('span', { class: `r-tag ${t.cls}`, title: t.tooltip }, (t.isPinned ? '📌 ' : '') + t.name))
  );

  // « 🔥 Préparation Détaillée » — étapes cochables, PUREMENT visuel (décision D4,
  // vérifié dans l'oracle : `this.classList.toggle('done')`, aucune persistance).
  const steps = r.steps || [];
  const instList = steps.length > 0
    ? h('ol', { class: 'recipe-steps' },
        steps.map(step => h('li', { onclick: (e) => e.currentTarget.classList.toggle('done') }, step)))
    : h('div', { style: { fontSize: '13.5px', color: 'var(--txt-soft)', fontStyle: 'italic' } },
        'Aucune étape de préparation détaillée.');

  // Nutri-Score visuel si déjà analysé, bouton d'estimation sinon (oracle l.5541-5567).
  const nutrition = r.nutrition
    ? h('div', {}, [
        h('div', { class: 'recipe-detail-section' }, '📊 Profil Nutritionnel'),
        h('div', { style: { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '12px' } }, [
          h('div', { class: 'nutri-score-logo', title: `Est. IA Nutri-Score: ${r.nutrition.score}` }, [
            h('div', { class: 'ns-brand' }, 'NUTRI-SCORE'),
            h('div', { class: 'ns-bars' }, NUTRI_SCORE_LETTERS.map(letter =>
              h('div', { class: `ns-bar ns-${letter}${r.nutrition.score === letter ? ' active' : ''}` },
                r.nutrition.score === letter ? letter : '')
            ))
          ]),
          h('span', { class: 'nutri-kcal' }, `🔥 ~${r.nutrition.kcal} kcal / pers.`)
        ]),
        (r.nutrition.tags || []).length > 0 ? h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' } },
          r.nutrition.tags.map(t => h('span', { class: 'r-tag blue' }, `✨ ${t}`))
        ) : null
      ].filter(Boolean))
    : h('div', { style: { marginBottom: '18px' } }, [
        h('button', { id: 'rd-nutri-btn', class: 'tb-btn small', onclick: () => handlers.analyzeNutrition() }, NUTRI_BTN_LABEL)
      ]);

  return h('div', { class: 'modal-content' }, [
    header,
    h('div', { class: 'modal-body' }, [
        h('div', { class: 'rd-top' }, [
            h('div', { class: 'rd-emoji' }, r.emoji || '🍽️'),
            h('div', { class: 'rd-meta-row' }, [
                h('span', { class: 'rd-meta-badge' }, `⏱ ${r.time || '?'}`),
                h('span', { class: 'rd-meta-badge' }, `${difficultyEmoji} ${r.difficulty || r.diff || 'Normal'}`),
                h('span', { class: 'rd-meta-badge' }, [
                    h('button', { class: 'scale-btn', 'data-testid': 'rd-scale-minus', onclick: () => changePplScale(-1) }, '−'),
                    h('span', { id: 'rd-ppl-count' }, displayedPpl),
                    ' pers.',
                    h('button', { class: 'scale-btn', 'data-testid': 'rd-scale-plus', onclick: () => changePplScale(1) }, '+')
                ]),
                h('span', { class: 'rd-meta-badge' }, `🍴 ${r.cuisine || 'Française'}`)
            ])
        ]),
        r.description ? h('p', { style: { fontSize: '13.5px', color: 'var(--txt-mid)', lineHeight: '1.6', marginBottom: '18px', fontStyle: 'italic' } },
          `"${r.description}"`) : null,
        nutrition,
        h('div', { class: 'recipe-detail-section' }, '👨‍🍳 Ingrédients & Quantités'),
        ingList,
        h('div', { class: 'recipe-detail-section' }, '📋 État des stocks'),
        stockTags,
        h('div', { class: 'recipe-detail-section' }, '🔥 Préparation Détaillée'),
        instList
    ].filter(Boolean)),
    footer
  ]);
}
