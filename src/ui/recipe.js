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

  const hasMissing = typeof addMissingToCart === 'function'
    && (tags.some(t => t.cls === 'red') || (r.ingredients || []).some(i => i.s === 'missing'));

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

/**
 * @param {number} [scale=1] - Facteur d'échelle des quantités (LOT 010, casse C12).
 *   Présentation UNIQUEMENT : ne touche jamais `r.ingredients` (recette, favori,
 *   suggestion IA — tous préservés intacts), recalculé depuis la chaîne d'origine
 *   à chaque rendu. À 1, la chaîne d'origine est rendue telle quelle (aucun
 *   reformatage), ce qui garantit l'aller-retour exact.
 */
export function renderRecipeDetail(r, source, handlers, scale = 1) {
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

  const originalPpl = parseInt(r.people || r.ppl) || 2;
  const displayedPpl = Math.round(originalPpl * scale);

  // Ingredients list
  const ingList = h('ul', { class: 'rd-ingredients' },
    (r.ingredients || []).map(ing => {
      const qty = scaleQty(ing.q || ing.amount, scale);
      return h('li', {}, [
        h('span', { class: 'rd-ing-name' }, ing.n || ing.name),
        qty ? h('span', { class: 'rd-ing-amount' }, ` (${qty})`) : null
      ]);
    })
  );

  // Instructions list
  const instList = h('ol', { class: 'rd-instructions' },
    (r.steps || r.instructions || []).map(step => h('li', {}, step))
  );

  // Nutrition chips
  const nutrition = r.nutrition ? h('div', { class: 'rd-nutrition' }, [
    h('div', { class: 'rd-nut-item' }, [h('span', { class: 'rd-nut-val' }, r.nutrition.kcal || r.nutrition.calories || '?'), ' kcal']),
    h('div', { class: 'rd-nut-item' }, [h('span', { class: 'rd-nut-val' }, r.nutrition.score || '?'), ' score']),
    h('div', { class: 'rd-nut-item' }, [h('span', { class: 'rd-nut-val' }, (r.nutrition.tags || []).join(', ') || 'N/A')])
  ]) : h('div', { class: 'rd-nutrition' }, [
      h('button', { id: 'rd-nutri-btn', class: 'tb-btn small', onclick: () => handlers.analyzeNutrition() }, '✨ Analyse Nutri')
  ]);

  const footer = h('div', { class: 'modal-footer' }, 
    source === 'ai' ? [
      h('button', { class: 'tb-btn', onclick: () => saveSuggestionToFav() }, '⭐ Favoris'),
      h('button', { class: 'tb-btn primary', onclick: () => addSuggestionToCart() }, '🛒 Liste de courses')
    ] : source === 'fav' ? [
      h('button', { class: 'tb-btn del', onclick: () => { deleteFav(); closeModal('modal-recipe-detail'); } }, '🗑️ Supprimer'),
      h('button', { class: 'tb-btn primary', onclick: () => addSuggestionToCart() }, '🛒 Liste de courses')
    ] : [
      h('button', { class: 'tb-btn', onclick: () => saveRecipeOnly() }, '💾 Sauver'),
      h('button', { class: 'tb-btn primary', onclick: () => saveRecipeAndList() }, '🛒 + Liste')
    ]
  );

  return h('div', { class: 'modal-content' }, [
    h('div', { class: 'modal-header' }, [
        h('div', { class: 'mh-left' }, [
            h('button', { class: 'mh-btn', onclick: () => closeModal('modal-recipe-detail') }, '✕'),
            h('div', { class: 'mh-title' }, r.name)
        ]),
        h('div', { class: 'mh-right' }, [
            h('button', { class: 'mh-btn', onclick: () => printRecipe(), title: 'Imprimer' }, '🖨️'),
            h('button', { class: 'mh-btn', onclick: () => toggleRecipeFullscreen('modal-recipe-detail'), title: 'Plein écran' }, '⛶')
        ])
    ]),
    h('div', { class: 'modal-body' }, [
        h('div', { class: 'rd-top' }, [
            h('div', { class: 'rd-emoji' }, r.emoji || '🍽️'),
            h('div', { class: 'rd-meta-row' }, [
                h('span', { class: 'rd-meta-badge' }, r.time),
                h('span', { class: 'rd-meta-badge' }, r.difficulty || r.diff),
                h('span', { class: 'rd-meta-badge' }, [
                    h('button', { class: 'scale-btn', onclick: () => changePplScale(-1) }, '−'),
                    h('span', { id: 'rd-ppl-count' }, displayedPpl),
                    ' pers.',
                    h('button', { class: 'scale-btn', onclick: () => changePplScale(1) }, '+')
                ])
            ])
        ]),
        h('div', { class: 'rd-section-title' }, 'Ingrédients'),
        ingList,
        h('div', { class: 'rd-section-title' }, 'Préparation'),
        instList,
        h('div', { class: 'rd-section-title' }, 'Nutrition (estimée)'),
        nutrition
    ]),
    footer
  ]);
}
