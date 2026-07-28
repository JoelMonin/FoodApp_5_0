import { state, saveState, shoppingChecked, setState } from './state.js';
import { generateId, normalizeString } from './utils/helpers.js';
import { syncPush, syncPull } from './services/firebase.js';
import { toast } from './utils/dom.js';

export function switchView(view) {
  state.currentView = view;
  saveState();
  window.dispatchEvent(new CustomEvent('viewChanged', { detail: view }));
}

export function toggleStock(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.inStock = !ing.inStock;
    if (ing.inStock) ing.inCart = false;
    saveState();
  }
}

export function togglePin(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.pinned = !ing.pinned;
    saveState();
  }
}

export function toggleCart(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.inCart = !ing.inCart;
    saveState();
  }
}

export function deleteIngredient(id) {
  if (confirm('Supprimer cet ingrédient ?')) {
    state.ingredients = state.ingredients.filter(i => i.id !== id);
    saveState();
  }
}

export function toggleShoppingCheck(id, type) {
  if (shoppingChecked.has(id)) shoppingChecked.delete(id);
  else shoppingChecked.add(id);
  saveState();
}

export function removeFromCart(id, type) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.inCart = false;
    saveState();
  }
}

export function resetCart() {
  if (confirm('Vider la liste de courses ?')) {
    state.ingredients.forEach(i => i.inCart = false);
    saveState();
  }
}

export function resetAllData() {
  if (confirm('⚠️ Attention : Cela va effacer TOUTES vos données locales (Inventaire + Courses). Continuer ?')) {
    localStorage.clear();
    window.location.reload();
  }
}

export function saveApiKey(key) {
  state.aiConfig.apiKey = key;
  saveState();
}

export function exportJSON() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foodapp-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

export function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.ingredients) {
        setState(data);
        saveState();
        toast('Import réussi !');
      }
    } catch (err) {
      toast('Erreur lors de l\'import : ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}
