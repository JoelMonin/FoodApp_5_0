// ═══════════════════════════════════════════
// STATIC DATA (CATEGORIES, DEFAULT_DB, etc.)
// ═══════════════════════════════════════════

/**
 * Représentation canonique des catégories : nom + émoji, au même endroit.
 * L'émoji était auparavant redéfini dans une seconde table locale à `renderPantryFilters`
 * (js/app.js), d'où un risque de divergence à chaque ajout de catégorie.
 *
 * `Autres` est la catégorie de repli réellement produite par le code quand aucune
 * catégorie n'est connue (state.js `sanitizeGlobalState`, ajout manuel, recette IA).
 * Elle fait donc partie de la liste : sans elle, les ingrédients qui y atterrissent
 * n'avaient aucune puce de filtre dans l'inventaire.
 */
export const CATEGORIES_WITH_EMOJI = [
  { name: 'Protéines', emoji: '🥩' },
  { name: 'Légumes', emoji: '🥦' },
  { name: 'Fruits', emoji: '🍎' },
  { name: 'Herbes & aromates', emoji: '🌿' },
  { name: 'Épices sèches', emoji: '🫙' },
  { name: 'Produits laitiers', emoji: '🧀' },
  { name: 'Alternatives végétales', emoji: '🥛' },
  { name: 'Pâtes, riz & légumes secs', emoji: '🍝' },
  { name: 'Conserves & bocaux', emoji: '🥫' },
  { name: 'Sauces & condiments', emoji: '🧴' },
  { name: 'Huiles & vinaigres', emoji: '🫒' },
  { name: 'Farines & liants', emoji: '🌾' },
  { name: 'Graines & noix', emoji: '🌰' },
  { name: 'Sucres & sirops', emoji: '🍬' },
  { name: 'Bouillons & bases', emoji: '🍲' },
  { name: 'Plats & Préparations', emoji: '🍱' },
  { name: 'Autres', emoji: '📦' }
];

export const CATEGORIES = CATEGORIES_WITH_EMOJI.map(c => c.name);

/** Émoji d'une catégorie, avec repli sur le carton si la catégorie est inconnue. */
export function getCategoryEmoji(categoryName) {
  return CATEGORIES_WITH_EMOJI.find(c => c.name === categoryName)?.emoji || '📦';
}

export const DEFAULT_DB = [
  // PROTÉINES
  { id: 'ing_cf7b9c61', name: 'Agneau (brochettes)', emoji: '🐏', category: 'Protéines', frozen: false },
  { id: 'ing_2a9863eb', name: 'Agneau (côtelettes)', emoji: '🐏', category: 'Protéines', frozen: false },
  { id: 'ing_718d0f06', name: 'Agneau (haché)', emoji: '🐏', category: 'Protéines', frozen: false },
  { id: 'ing_75093324', name: 'Bœuf (steak)', emoji: '🐂', category: 'Protéines', frozen: false },
  { id: 'ing_dfc3861f', name: 'Bœuf (steaks hachés)', emoji: '🐂', category: 'Protéines', frozen: false },
  { id: 'p2', name: 'Bœuf (haché)', emoji: '🐂', category: 'Protéines', frozen: false },
  { id: 'p6', name: 'Crevettes', emoji: '🦐', category: 'Protéines', frozen: false },
  { id: 'p8', name: 'Dinde', emoji: '🦃', category: 'Protéines', frozen: false },
  { id: 'ing_3af61cd7', name: 'Jambon (cru)', emoji: '🍖', category: 'Protéines', frozen: false },
  { id: 'ing_e54e90d6', name: 'Jambon (cuit)', emoji: '🍖', category: 'Protéines', frozen: false },
  { id: 'ing_4318228f', name: 'Porc (côtes)', emoji: '🐖', category: 'Protéines', frozen: false },
  { id: 'ing_ff989a00', name: 'Porc (saucisses)', emoji: '🐖', category: 'Protéines', frozen: false },
  { id: 'p4', name: 'Poulet (blanc)', emoji: '🍗', category: 'Protéines', frozen: false },
  { id: 'p5', name: 'Poulet (cuisses)', emoji: '🍗', category: 'Protéines', frozen: false },
  { id: 'p1', name: 'Saumon', emoji: '🐟', category: 'Protéines', frozen: false },
  { id: 'ing_6b0d9e84', name: 'Tofu (fumé)', emoji: '🥛', category: 'Protéines', frozen: false },
  { id: 'p10', name: 'Tofu (nature)', emoji: '🥛', category: 'Protéines', frozen: false },
  { id: 'p3', name: 'Œufs', emoji: '🥚', category: 'Protéines', frozen: false },

  // LÉGUMES
  { id: 'l1', name: 'Ail', emoji: '🧄', category: 'Légumes', frozen: false },
  { id: 'ing_267425ba', name: 'Asperges', emoji: '🎋', category: 'Légumes', frozen: false },
  { id: 'ing_7e3a967f', name: 'Aubergine', emoji: '🍆', category: 'Légumes', frozen: false },
  { id: 'l10', name: 'Avocat', emoji: '🥑', category: 'Légumes', frozen: false },
  { id: 'l5', name: 'Brocoli', emoji: '🥦', category: 'Légumes', frozen: false },
  { id: 'l2', name: 'Carotte', emoji: '🥕', category: 'Légumes', frozen: false },
  { id: 'ing_3d9e8c71', name: 'Champignons', emoji: '🍄', category: 'Légumes', frozen: false },
  { id: 'l8', name: 'Chou-fleur', emoji: '🥦', category: 'Légumes', frozen: false },
  { id: 'ing_88c42a5d', name: 'Concombre', emoji: '🥒', category: 'Légumes', frozen: false },
  { id: 'l4', name: 'Courgette', emoji: '🥒', category: 'Légumes', frozen: false },
  { id: 'ing_3a2b4c5d', name: 'Échalote', emoji: '🧅', category: 'Légumes', frozen: false },
  { id: 'l7', name: 'Épinards', emoji: '🍃', category: 'Légumes', frozen: false },
  { id: 'ing_5e7d8f9a', name: 'Haricots verts', emoji: '🌿', category: 'Légumes', frozen: false },
  { id: 'l11', name: 'Navet', emoji: '🍠', category: 'Légumes', frozen: false },
  { id: 'l3', name: 'Oignon (jaune)', emoji: '🧅', category: 'Légumes', frozen: false },
  { id: 'ing_1b2c3d4e', name: 'Oignon (rouge)', emoji: '🧅', category: 'Légumes', frozen: false },
  { id: 'ing_a1b2c3d4', name: 'Patate douce', emoji: '🍠', category: 'Légumes', frozen: false },
  { id: 'l13', name: 'Petit pois', emoji: '🍏', category: 'Légumes', frozen: false },
  { id: 'l6', name: 'Poivron', emoji: '🫑', category: 'Légumes', frozen: false },
  { id: 'l12', name: 'Poireau', emoji: '🌿', category: 'Légumes', frozen: false },
  { id: 'l9', name: 'Pomme de terre', emoji: '🥔', category: 'Légumes', frozen: false },
  { id: 'ing_4d5e6f7a', name: 'Radis', emoji: '🏮', category: 'Légumes', frozen: false },
  { id: 'ing_8c7d6e5f', name: 'Salade (laitue)', emoji: '🥬', category: 'Légumes', frozen: false },
  { id: 'ing_12345678', name: 'Tomate', emoji: '🍅', category: 'Légumes', frozen: false },

  // FRUITS
  { id: 'ing_f1a2b3c4', name: 'Banane', emoji: '🍌', category: 'Fruits', frozen: false },
  { id: 'ing_e2d3c4b5', name: 'Citron', emoji: '🍋', category: 'Fruits', frozen: false },
  { id: 'ing_d3c4b5a6', name: 'Fraise', emoji: '🍓', category: 'Fruits', frozen: false },
  { id: 'ing_c4b5a697', name: 'Framboise', emoji: '🍇', category: 'Fruits', frozen: false },
  { id: 'ing_b5a69788', name: 'Pomme', emoji: '🍎', category: 'Fruits', frozen: false },

  // ÉPICES SÈCHES
  { id: 'ing_a1b2c3d5', name: 'Cannelle', emoji: '🫙', category: 'Épices sèches', frozen: false },
  { id: 'ing_b2c3d4e6', name: 'Curcuma', emoji: '🫙', category: 'Épices sèches', frozen: false },
  { id: 'ing_c3d4e5f7', name: 'Curry (poudre)', emoji: '🫙', category: 'Épices sèches', frozen: false },
  { id: 'ing_d4e5f6g8', name: 'Paprika', emoji: '🫙', category: 'Épices sèches', frozen: false },
  { id: 'ing_e5f6g7h9', name: 'Piment', emoji: '🌶️', category: 'Épices sèches', frozen: false },
  { id: 'ing_f6g7h8i0', name: 'Poivre', emoji: '🫙', category: 'Épices sèches', frozen: false },
  { id: 'ing_g7h8i9j1', name: 'Sel', emoji: '🧂', category: 'Épices sèches', frozen: false },

  // PRODUITS LAITIERS / ALTERNATIVES
  { id: 'ing_h8i9j0k2', name: 'Beurre', emoji: '🧈', category: 'Produits laitiers', frozen: false },
  { id: 'ing_i9j0k1l3', name: 'Crème fraîche', emoji: '🥛', category: 'Produits laitiers', frozen: false },
  { id: 'ing_j0k1l2m4', name: 'Emmental (râpé)', emoji: '🧀', category: 'Produits laitiers', frozen: false },
  { id: 'ing_k1l2m3n5', name: 'Lait', emoji: '🥛', category: 'Produits laitiers', frozen: false },
  { id: 'ing_l2m3n4o6', name: 'Mozzarella', emoji: '🧀', category: 'Produits laitiers', frozen: false },
  { id: 'ing_m3n4o5p7', name: 'Parmesan', emoji: '🧀', category: 'Produits laitiers', frozen: false },
  { id: 'ing_n4o5p6q8', name: 'Yaourt nature', emoji: '🍦', category: 'Produits laitiers', frozen: false },

  // PÂTES, RIZ & LÉGUMES SECS
  { id: 'ing_o5p6q7r9', name: 'Lentilles (vertes)', emoji: '🥘', category: 'Pâtes, riz & légumes secs', frozen: false },
  { id: 'ing_p6q7r8s0', name: 'Pâtes (penne)', emoji: '🍝', category: 'Pâtes, riz & légumes secs', frozen: false },
  { id: 'ing_q7r8s9t1', name: 'Pâtes (spaghetti)', emoji: '🍝', category: 'Pâtes, riz & légumes secs', frozen: false },
  { id: 'ing_r8s9t0u2', name: 'Riz (basmati)', emoji: '🍚', category: 'Pâtes, riz & légumes secs', frozen: false },
  { id: 'ing_s9t0u1v3', name: 'Quinoa', emoji: '🥣', category: 'Pâtes, riz & légumes secs', frozen: false }
];
