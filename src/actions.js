import { state, saveState, shoppingChecked, sanitizeGlobalState, applyExternalState, defaultAiConfig, awaitSyncQuiescence } from './state.js';
import { generateId, normalizeString, areSimilar } from './utils/helpers.js';
import { toast } from './utils/dom.js';
import { syncPush } from './services/firebase.js';
import { DEFAULT_DB } from './data.js';
import { LOCAL_STORAGE_SYNC_REF_KEY, MAX_PINNED_INGREDIENTS } from './constants.js';

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

/**
 * Épingle / désépingle un ingrédient pour l'IA (LOT 010, casse C9).
 *
 * Le plafond de l'oracle (`foodapp-v5-Joel.html` l.4733-4742) avait disparu à la
 * migration, alors que l'interface continuait de l'annoncer. Trois règles exactes,
 * confirmées par l'audit de spec :
 *  - le refus porte UNIQUEMENT sur un passage non-épinglé → épinglé ;
 *  - le désépinglage reste TOUJOURS autorisé, même au-delà du plafond : c'est la
 *    seule façon de redescendre pour un utilisateur dont la base en contient déjà
 *    plus de 6 (données existantes, jamais tronquées d'office) ;
 *  - libellés repris mot pour mot de l'oracle.
 */
export function togglePin(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (!ing) return;

  const pinnedCount = state.ingredients.filter(i => i.pinned).length;
  if (!ing.pinned && pinnedCount >= MAX_PINNED_INGREDIENTS) {
    toast(`Maximum ${MAX_PINNED_INGREDIENTS} ingrédients épinglés`, 'error');
    return;
  }

  ing.pinned = !ing.pinned;
  saveState();
  toast(ing.pinned ? `📌 ${ing.name} épinglé pour l'IA` : `${ing.name} désépinglé`);
}

export function toggleCart(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.inCart = !ing.inCart;
    // Sortie du panier : l'id ne doit pas rester coché dans la liste de courses
    // (LOT 008, chantier 7 — sinon la synchro du LOT 007 diffuserait des ids fantômes).
    if (!ing.inCart) shoppingChecked.delete(id);
    saveState();
  }
}

export function deleteIngredient(id) {
  if (confirm('Supprimer cet ingrédient ?')) {
    state.ingredients = state.ingredients.filter(i => i.id !== id);
    shoppingChecked.delete(id);
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
  }
  shoppingChecked.delete(id);
  saveState();
}

export function resetCart() {
  if (confirm('Vider la liste de courses ?')) {
    state.ingredients.forEach(i => i.inCart = false);
    state.customCartItems = [];
    shoppingChecked.clear();
    saveState();
  }
}

/**
 * Réinitialisation complète (LOT 008, chantier 5). Un reset naïf (localStorage.clear
 * + reload) était immédiatement ANNULÉ : au rechargement, le pull cloud du démarrage
 * réappliquait l'ancien inventaire (audit de campagne Codex, 2026-07-29). Le nouvel
 * état par défaut est donc poussé vers le cloud AVANT le rechargement.
 */
export async function resetAllData() {
  const confirmed = confirm(
    `⚠️ Repart de l'inventaire par défaut (${DEFAULT_DB.length} ingrédients, tout décoché), ` +
    'ici ET dans le cloud. Vos favoris et réglages IA seront effacés. Votre clé API est ' +
    'conservée. Continuer ?'
  );
  if (!confirmed) return;

  // CONTRE-VÉRIFICATION AUDIT SOL (C3) : sérialise la remise à zéro avec le moteur
  // de synchro — annule tout envoi temporisé et ATTEND la fin d'un envoi en vol.
  // Sans cela, un PUT parti AVANT le clic pouvait aboutir APRÈS le PUT du reset et
  // restaurer l'ancien état dans le cloud.
  await awaitSyncQuiescence();

  const preservedApiKey = state.aiConfig?.apiKey || '';

  localStorage.clear();
  shoppingChecked.clear();

  state.ingredients = [];
  state.customCartItems = [];
  state.favorites = [];
  state.extraIngredients = [];
  state.aiConfig = { ...defaultAiConfig(), apiKey: preservedApiKey };
  // Les suggestions IA sont des DONNÉES, pas juste un réglage : les oublier ici les
  // laissait survivre au reset (et se republier sur le cloud juste après) — trouvaille
  // d'audit Codex. Oracle : monolithe l.6581-6582 (`aiSuggestions = null` + retour à
  // l'inventaire).
  state.aiSuggestions = null;
  state.currentSuggestionIdx = null;

  // Reconstruit l'inventaire par défaut (chantier 4) et le persiste immédiatement —
  // on ne compte pas sur le rechargement pour ça.
  // CORRECTION AUDIT SOL (C3) : ne PAS passer par switchView ici — sa sauvegarde
  // normale levait le drapeau « en attente » et programmait un envoi ; après le
  // rechargement, ce drapeau résiduel déclenchait un SECOND envoi fantôme du reset,
  // capable d'écraser une écriture concurrente d'un autre appareil. Sauvegarde
  // locale SANS planification : le push explicite ci-dessous est le SEUL envoi.
  sanitizeGlobalState();
  state.currentView = 'pantry'; // oracle l.6581-6582 : retour à l'inventaire
  saveState(true, false);

  try {
    // Chemin EXPLICITE de vidange volontaire (LOT 007, §4.9.1) : syncPush applique le
    // périmètre du document (les coches — vides après reset — partent aussi) sans
    // passer par le garde-fou anti-vidange du moteur, puisque cette vidange est voulue.
    const sentDoc = await syncPush(state, Array.from(shoppingChecked));
    // Aligne la référence « dernier cloud connu » sur ce qui vient d'être envoyé :
    // au redémarrage, aucune sauvegarde (navigation comprise) ne pourra confondre
    // l'état du reset avec une modification restant à envoyer (audit Sol C1/C3).
    try {
      localStorage.setItem(LOCAL_STORAGE_SYNC_REF_KEY, JSON.stringify(sentDoc));
    } catch { /* affichage seulement : sans référence, le pire est un envoi identique */ }
  } catch (e) {
    console.error('[Reset] Push cloud échoué', e);
    toast(
      "Réinitialisation locale seulement — l'ancien contenu du cloud peut revenir à la " +
      'prochaine synchronisation',
      'error'
    );
    // Laisse le temps de lire le message avant le rechargement qui l'efface.
    await new Promise(resolve => setTimeout(resolve, 1800));
  }

  window.location.reload();
}

export function saveApiKey(key) {
  state.aiConfig.apiKey = key;
  saveState();
}

export function exportJSON() {
  // Même principe que syncPush (src/services/firebase.js) : la clé API ne quitte
  // jamais l'appareil (LOT 008, chantier 2 — casse C3a).
  const stateToExport = JSON.parse(JSON.stringify(state));
  if (stateToExport.aiConfig) {
    stateToExport.aiConfig.apiKey = '';
  }
  const data = JSON.stringify(stateToExport, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foodapp-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('💾 Export téléchargé');
}

export function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.ingredients) {
        // Restauration totale : passe par le point d'entrée unique des données
        // externes, qui préserve la clé API locale (LOT 008, chantier 3 — casse C3b).
        applyExternalState(data);
        toast('Import réussi !');
      } else {
        toast('Format non reconnu', 'error');
      }
    } catch (err) {
      toast('Erreur lors de l\'import : ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/**
 * Fusionne un fichier restauré dans l'inventaire SANS toucher aux favoris ni à la
 * configuration IA (LOT 008, chantier 1 — casse C2). Correspondance par id, puis par
 * nom approché (`areSimilar`) ; seuls les statuts de stock sont mis à jour, les
 * ingrédients inconnus du fichier sont ajoutés.
 */
export function importStockOnly(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.ingredients) {
        toast('Format non reconnu', 'error');
        return;
      }

      let updatedCount = 0;
      let addedCount = 0;

      data.ingredients.forEach(jsonIng => {
        let target = state.ingredients.find(i => i.id === jsonIng.id);
        if (!target) {
          target = state.ingredients.find(i => areSimilar(i.name, jsonIng.name));
        }

        if (target) {
          target.inStock = !!jsonIng.inStock;
          target.inCart = !!jsonIng.inCart;
          target.pinned = !!jsonIng.pinned;
          target.frozen = !!jsonIng.frozen;
          updatedCount++;
        } else {
          const newId = jsonIng.id && jsonIng.id.startsWith('custom_')
            ? jsonIng.id
            : 'custom_restore_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          state.ingredients.push({ ...jsonIng, id: newId });
          addedCount++;
        }
      });

      saveState();
      toast(`📥 Restauration : ${updatedCount} mis à jour, ${addedCount} ajoutés`);
    } catch (err) {
      toast('Format JSON invalide', 'error');
    }
  };
  reader.readAsText(file);
}
