/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state';
import { openEditEmoji, buildEmojiEditSuggestions, applyEditedEmoji } from '../js/app.js';
import { DEFAULT_DB } from '../src/data';

// LOT 009 — casse C1 : cliquer l'emoji d'une carte d'inventaire plantait avant
// d'ouvrir la fenêtre (écriture dans #edit-emoji-input, id inexistant). Ces tests
// verrouillent le nouveau contrat (oracle monolithe `updateEmoji`) : ouverture =
// grille immédiatement peuplée, clic sur une tuile = applique + sauvegarde + ferme,
// sans étape intermédiaire ni input libre.

function makeIngredient(overrides = {}) {
  return {
    id: 'ing_1', name: 'Pomme', emoji: '🍎', category: 'Fruits',
    inStock: false, inCart: false, pinned: false, frozen: false,
    shoppingSource: null, ...overrides
  };
}

describe('Édition d\'icône d\'ingrédient (LOT 009, casse C1)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div class="modal-overlay" id="modal-edit-emoji">
        <strong id="edit-emoji-name"></strong>
        <input id="emoji-search-input">
        <div id="edit-emoji-grid"></div>
      </div>
    `;
    Object.assign(state, {
      ingredients: [makeIngredient()],
      favorites: [], extraIngredients: [],
      currentView: 'pantry', filter: 'all', search: '',
      aiSuggestions: null, currentSuggestionIdx: null, lastSync: null,
      showInStockOnly: false, showInCartOnly: false,
      aiConfig: defaultAiConfig()
    });
    shoppingChecked.clear();
  });

  it('n\'a AUCUNE référence à edit-emoji-input : l\'ouverture ne plante pas sur un DOM qui ne le contient pas', () => {
    expect(document.getElementById('edit-emoji-input')).toBeNull();
    expect(() => openEditEmoji('ing_1')).not.toThrow();
  });

  it('ouvrir un ingrédient remplit IMMÉDIATEMENT la grille et ouvre le modal (pas d\'étape intermédiaire)', () => {
    openEditEmoji('ing_1');
    expect(document.getElementById('edit-emoji-name').textContent).toBe('Pomme');
    expect(document.getElementById('modal-edit-emoji').classList.contains('open')).toBe(true);
    expect(document.getElementById('edit-emoji-grid').children.length).toBeGreaterThan(0);
  });

  it('les tuiles émettent la classe emoji-edit-btn (CSS migré, plus jamais emoji-btn fantôme)', () => {
    openEditEmoji('ing_1');
    const tiles = [...document.getElementById('edit-emoji-grid').children];
    expect(tiles.length).toBeGreaterThan(0);
    tiles.forEach(btn => expect(btn.classList.contains('emoji-edit-btn')).toBe(true));
  });

  it('clic sur une tuile applique l\'emoji, sauvegarde et ferme (contrat updateEmoji de l\'oracle)', () => {
    openEditEmoji('ing_1');
    const tile = document.getElementById('edit-emoji-grid').children[0];
    const chosen = tile.textContent;
    tile.click();
    expect(state.ingredients[0].emoji).toBe(chosen);
    expect(document.getElementById('modal-edit-emoji').classList.contains('open')).toBe(false);
  });

  it('applyEditedEmoji ignore un id d\'édition inconnu sans planter (modal quand même fermé)', () => {
    expect(() => applyEditedEmoji('🥕')).not.toThrow();
    expect(document.getElementById('modal-edit-emoji').classList.contains('open')).toBe(false);
  });

  it('construit les suggestions depuis DEFAULT_DB — jamais de table d\'emojis dupliquée', () => {
    const known = DEFAULT_DB[0];
    const suggestions = buildEmojiEditSuggestions(known.name);
    expect(suggestions).toContain(known.emoji);
    expect(suggestions.length).toBeLessThanOrEqual(15);
  });

  it('un nom sans aucune correspondance retombe sur un repli non vide (jamais de grille vide)', () => {
    openEditEmoji('ing_1'); // fixe l'ingrédient en cours d'édition (catégorie Fruits)
    const suggestions = buildEmojiEditSuggestions('xyzIntrouvableDansLeCatalogue123');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain('🍎'); // emoji de la catégorie Fruits (getCategoryEmoji)
  });

  it('un ingrédient qui ne correspond QU\'À LUI-MÊME offre quand même PLUSIEURS alternatives ' +
     '(audit Codex : « Banane » n\'avait qu\'1 tuile, sa propre icône — aucun vrai choix)', () => {
    const banane = DEFAULT_DB.find(i => i.name === 'Banane');
    expect(banane).toBeTruthy(); // l'hypothèse du test : un seul match canonique attendu
    Object.assign(state.ingredients[0], { id: 'ing_1', name: banane.name, category: banane.category });
    openEditEmoji('ing_1');
    const suggestions = buildEmojiEditSuggestions(banane.name);
    expect(suggestions).toContain(banane.emoji); // son icône actuelle reste proposée...
    expect(suggestions.length).toBeGreaterThan(1); // ...mais jamais SEULE : un vrai choix existe
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // LOT 014 — CORRECTIF décidé par Joel le 2026-07-31, dans la foulée de celui du formulaire
  // d'ajout : cette grille comparait en minuscules brutes (SENSIBLE aux accents) alors que
  // tout le reste de l'application passe par `normalizeString`. Un ingrédient nommé sans
  // accent ne retrouvait pas l'emoji de la base et tombait sur le socle générique.
  // ─────────────────────────────────────────────────────────────────────────────

  it('CORRIGÉ : un nom saisi SANS accent retrouve l\'emoji du catalogue', () => {
    const accentue = DEFAULT_DB.find(i => /[éèêàûôç]/i.test(i.name));
    expect(accentue).toBeTruthy();
    const sansAccent = accentue.name.normalize('NFD').replace(/[̀-ͯ]/g, '');
    expect(sansAccent).not.toBe(accentue.name); // le cas teste bien quelque chose

    expect(buildEmojiEditSuggestions(sansAccent)).toContain(accentue.emoji);
  });

  it('CORRIGÉ : la grille d\'édition et le formulaire d\'ajout cherchent enfin PAREIL', () => {
    // « pdt » est le raccourci que `normalizeString` traduit en « pommes de terre » — il
    // fonctionnait partout ailleurs, jamais ici.
    const pdt = DEFAULT_DB.find(i => i.name === 'Pommes de terre');
    expect(pdt).toBeTruthy();
    expect(buildEmojiEditSuggestions('pdt')).toContain(pdt.emoji);
  });

  it('le correctif n\'est pas trop large : un nom introuvable ne ramène toujours aucun match', () => {
    openEditEmoji('ing_1');
    const suggestions = buildEmojiEditSuggestions('xyzIntrouvableDansLeCatalogue123');
    // Rien du catalogue : uniquement l'emoji de catégorie + le socle générique (9 au plus).
    expect(suggestions.length).toBeLessThanOrEqual(9);
  });

  it('une graine faite uniquement d\'espaces ne propose PAS tout le catalogue', () => {
    // `normalizeString` rogne : sans la garde `s ?`, `includes('')` serait vrai pour les 297
    // ingrédients et la grille se remplirait d'emojis sans rapport.
    openEditEmoji('ing_1');
    const suggestions = buildEmojiEditSuggestions('   ');
    expect(suggestions.length).toBeLessThanOrEqual(9);
  });

  it('le socle générique de repli est un SEUL et même tableau, jamais dupliqué (SSOT, audit Codex)', () => {
    // buildEmojiEditSuggestions sans aucune correspondance DOIT au moins contenir TOUT le
    // socle générique partagé — pas une seconde copie divergente qui aurait dérivé.
    openEditEmoji('ing_1');
    const suggestions = buildEmojiEditSuggestions('xyzIntrouvableDansLeCatalogue123');
    const generic = ['🧂', '🧅', '🧄', '🥦', '🥩', '🍎', '🥚', '🥛'];
    generic.forEach(e => expect(suggestions).toContain(e));
  });
});
