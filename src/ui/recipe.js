import { h } from '../utils/dom.js';

export function renderRecipeCard(r, index, handlers) {
  const { openRecipeDetail, source = 'ai' } = handlers;
  
  return h('div', {
    class: 'recipe-card',
    onclick: () => openRecipeDetail(index, source)
  }, [
    h('div', { class: 'rc-emoji' }, r.emoji || '🍽️'),
    h('div', { class: 'rc-info' }, [
      h('div', { class: 'rc-name' }, r.name),
      h('div', { class: 'rc-meta' }, `${r.time} · ${r.difficulty || r.diff}`)
    ])
  ]);
}

export function renderRecipeDetail(r, source, handlers) {
  const { 
    closeModal, 
    toggleRecipeFullscreen, 
    changePplScale, 
    saveSuggestionToFav, 
    addSuggestionToCart,
    saveRecipeOnly,
    saveRecipeAndList,
    deleteFav
  } = handlers;

  // Ingredients list
  const ingList = h('ul', { class: 'rd-ingredients' }, 
    (r.ingredients || []).map(ing => h('li', {}, [
      h('span', { class: 'rd-ing-name' }, ing.n || ing.name),
      (ing.q || ing.amount) ? h('span', { class: 'rd-ing-amount' }, ` (${ing.q || ing.amount})`) : null
    ]))
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
            h('button', { class: 'mh-btn', onclick: () => toggleRecipeFullscreen('modal-recipe-detail') }, '⛶')
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
                    h('span', { id: 'rd-ppl-count' }, r.people || r.ppl),
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
