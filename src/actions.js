import { state, saveState, shoppingChecked, sanitizeGlobalState, applyExternalState, defaultAiConfig, awaitSyncQuiescence, replaceShoppingChecked, resetScreenState } from './state.js';
import { generateId, normalizeString, areSimilar } from './utils/helpers.js';
import { toast } from './utils/dom.js';
import { syncPush } from './services/firebase.js';
import { DEFAULT_DB } from './data.js';
import { LOCAL_STORAGE_SYNC_REF_KEY, MAX_PINNED_INGREDIENTS, BACKUP_STATE_KEYS } from './constants.js';
// Gardes d'entrée : SSOT dans src/utils/validate.js (LOT 014, volet C). Les deux portes
// d'import n'ont pas les mêmes exigences — `estUnIngredientPlausible` (nom ET id) pour le
// remplacement total, `aUnNomExploitable`/`estFusionnable` pour la fusion douce.
import { estUnIngredientPlausible, estFusionnable, aUnNomExploitable, estUnObjetSimple } from './utils/validate.js';

export function switchView(view) {
  state.currentView = view;
  saveState();
  window.dispatchEvent(new CustomEvent('viewChanged', { detail: view }));
}

export function toggleStock(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.inStock = !ing.inStock;
    if (ing.inStock) {
      ing.inCart = false;
      // LOT 012, zone C (oracle l.4719) : un article qui redevient en stock n'a plus
      // besoin d'etre achete, donc plus de trace de "pour quelle recette".
      ing.shoppingSource = null;
    }
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
    // LOT 012, zone C (oracle l.4730) — PAS de toast équivalent sur `toggleStock`,
    // vérifié à l'audit : l'oracle n'en affiche jamais sur le retour en stock.
    toast(ing.inCart ? `${ing.emoji} ${ing.name} ajouté à la liste` : `${ing.name} retiré de la liste`);
  }
}

export function deleteIngredient(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (!ing) return;
  if (confirm('Supprimer cet ingrédient ?')) {
    state.ingredients = state.ingredients.filter(i => i.id !== id);
    shoppingChecked.delete(id);
    saveState();
    toast(`🗑️ ${ing.name} supprimé`); // LOT 012, zone C (oracle l.4752)
  }
}

// LOT 014, volet G : le 2ᵉ paramètre `type` a disparu de ces deux fonctions. Il datait de
// l'oracle, où il aiguillait entre `state.ingredients` et les articles libres
// (`foodapp-v5-Joel.html:4821-4832`). Ici il n'était plus lu par aucun corps de fonction, et
// son unique valeur possible était la constante `'db'` fabriquée à la volée par
// `src/ui/shopping.js`. Vérifié : ni l'une ni l'autre n'est exposée sur `window`, donc
// aucun `on*=` d'`index.html` ne peut les appeler avec une autre signature.
export function toggleShoppingCheck(id) {
  if (shoppingChecked.has(id)) shoppingChecked.delete(id);
  else shoppingChecked.add(id);
  saveState();
}

export function removeFromCart(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (ing) {
    ing.inCart = false;
    ing.shoppingSource = null; // LOT 012, zone C (oracle l.4826)
  }
  shoppingChecked.delete(id);
  saveState();
}

export function resetCart() {
  if (confirm('Vider la liste de courses ?')) {
    state.ingredients.forEach(i => i.inCart = false);
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

/**
 * Télécharge une sauvegarde (LOT 015, chantier 10a).
 *
 * PÉRIMÈTRE EXPLICITE (`BACKUP_STATE_KEYS`) : l'export sérialisait `state` en entier,
 * emportant la vue, la recherche, les filtres et les suggestions IA. Restaurer un tel
 * fichier rouvrait l'app filtrée ou vide et changeait d'écran tout seul.
 *
 * Les coches de courses sont ajoutées EXPLICITEMENT : elles vivent hors de `state`.
 * ⚠️ Écart assumé à l'oracle — le monolithe ne les sauvegardait pas non plus (elles
 * étaient un Set séparé chez lui aussi, jamais relu à l'import). C'est une décision
 * produit de Joel, pas une restauration.
 */
export function exportJSON() {
  const stateToExport = {};
  BACKUP_STATE_KEYS.forEach(key => {
    if (state[key] !== undefined) stateToExport[key] = JSON.parse(JSON.stringify(state[key]));
  });
  // Même principe que syncPush (src/services/firebase.js) : la clé API ne quitte
  // jamais l'appareil (LOT 008, chantier 2 — casse C3a).
  if (stateToExport.aiConfig) {
    stateToExport.aiConfig.apiKey = '';
  }
  stateToExport.shoppingChecked = Array.from(shoppingChecked);
  stateToExport.exportedAt = new Date().toISOString(); // l'oracle l'avait (l.6490), l'app l'avait perdu
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

/**
 * Restaure une sauvegarde — REMPLACEMENT TOTAL (LOT 015, chantiers 5 et 10).
 *
 * Quatre durcissements, tous issus de l'audit de la fiche puis de l'audit de spec :
 *  1. GARDE D'ENTRÉE (10d) : `if (data.ingredients)` acceptait `[]` **et une chaîne**.
 *     Avec `"ingredients": "abc"`, `sanitizeGlobalState` faisait `Object.values()` →
 *     `['a','b','c']` → filtré à vide → **reconstruction des 297 par défaut** → envoi au
 *     cloud. On exige donc un tableau NON VIDE.
 *  2. BARRIÈRE DE SYNCHRO (P6) : `importJSON` ne se sérialisait pas avec le moteur,
 *     contrairement à `resetAllData`. Un envoi parti AVANT le clic pouvait aboutir APRÈS
 *     la restauration et y réécraser l'ancien état — l'incident déjà corrigé au LOT 008
 *     sur le chemin du reset. D'où le `reader.onload` asynchrone.
 *  3. COCHES (10b/10c) : extraites AVANT et posées par `replaceShoppingChecked`, jamais
 *     par le `spread` de `setState` (qui en ferait un doublon dans `state`). Elles sont
 *     posées AVANT `applyExternalState` pour que l'état et les coches partent dans le
 *     MÊME document cloud — motif copié du chemin de pull (`js/app.js:407-409`). Elles
 *     sont FILTRÉES : seuls les ids réellement « à acheter » du fichier entrent, sinon on
 *     réintroduirait des ids fantômes invisibles à l'écran mais poussés au cloud (LOT 008,
 *     chantier 7).
 *  4. ÉCRAN NEUTRALISÉ (10a) : recherche, filtres et vue, sur le modèle de `loadState`.
 */
export function importJSON(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Un TABLEAU non vide ne suffit pas : `["Tomate","Oignon"]` franchissait la garde,
      // était filtré à vide par `sanitizeGlobalState`, qui **reconstruisait alors les ~297
      // ingrédients par défaut**, envoyés au cloud dans la foulée — la destruction même que
      // cette garde doit empêcher (audit adversarial du 2026-07-30). Et `[{}]` passait
      // aussi, remplaçant l'inventaire de Joel par un seul ingrédient fantôme.
      //
      // Signature minimale d'un vrai ingrédient pour le REMPLACEMENT TOTAL : un identifiant
      // ET un nom, tous deux non vides. Le prédicat vit dans `src/utils/validate.js`, pour
      // que la porte de la fusion puisse s'appuyer sur la même définition — son enfermement
      // ici est ce qui avait laissé `importStockOnly` sans protection (LOT 014, §C1).
      const ingredientsDuFichier = (Array.isArray(data?.ingredients) ? data.ingredients : [])
        .filter(estUnIngredientPlausible);
      if (ingredientsDuFichier.length === 0) {
        toast('Format non reconnu', 'error');
        return;
      }

      await awaitSyncQuiescence();

      const cartIds = new Set(ingredientsDuFichier.filter(i => i.inCart).map(i => i.id));
      const checkedFromFile = Array.isArray(data.shoppingChecked) ? data.shoppingChecked : [];
      replaceShoppingChecked(checkedFromFile.filter(id => cartIds.has(id)));

      resetScreenState({ resetView: true });
      // Les suggestions IA sont des DONNÉES calculées sur l'inventaire précédent : les
      // garder après un remplacement total ferait proposer des recettes bâties sur un
      // stock qui n'existe plus (même raisonnement qu'à la remise à zéro, l.139-140).
      state.aiSuggestions = null;
      state.currentSuggestionIdx = null;

      // REMPLACEMENT TOTAL, conformément au libellé du bouton. Une clé ABSENTE du fichier
      // retombe sur sa valeur par défaut, JAMAIS sur la valeur locale : c'est la règle déjà
      // tranchée pour le cloud (`src/services/firebase.js`), et sans elle un fichier ancien
      // laissait survivre des données d'aujourd'hui, produisant un état hybride que ni le
      // fichier ni l'appareil n'avaient jamais eu.
      const patch = { ingredients: ingredientsDuFichier };
      BACKUP_STATE_KEYS.filter(key => key !== 'ingredients' && key !== 'aiConfig')
        .forEach(key => {
          patch[key] = Array.isArray(data[key]) ? data[key] : [];
        });
      // Forme TOUJOURS complète, comme `extractSyncedState` : un fichier sans réglages (ou
      // aux réglages partiels) ne doit pas laisser `ppl`, `exclusions` ou les régimes
      // à `undefined`. La clé API locale est réinjectée juste après par applyExternalState.
      // LOT 014, volet C — `data.aiConfig || {}` n'écartait AUCUN type : une chaîne ou un
      // tableau se faisait étaler en clés `0/1/2` dans les réglages IA, puis persister et
      // pousser au cloud. Même famille que le trou d'`importStockOnly`.
      patch.aiConfig = { ...defaultAiConfig(), ...(estUnObjetSimple(data.aiConfig) ? data.aiConfig : {}) };

      // Restauration totale : passe par le point d'entrée unique des données
      // externes, qui préserve la clé API locale (LOT 008, chantier 3 — casse C3b).
      applyExternalState(patch);
      toast('Import réussi !');
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

      // LOT 014, §C1 — LA PORTE JUMELLE, restée ouverte quand le LOT 015 fermait celle de
      // la restauration totale. L'ancienne garde `if (!data.ingredients)` ne testait que la
      // PRÉSENCE de la clé : `{"ingredients": ["Tomate","Oignon"]}` la franchissait, et le
      // `{ ...jsonIng }` de la branche d'ajout (l.371) étalait alors une CHAÎNE en
      // `{0:'T',1:'o',…}`. Ces objets survivent à `sanitizeGlobalState` (ce SONT des objets,
      // `src/state.js:181`, et `name` n'y est jamais garanti, `:197-205`) : des ingrédients
      // fantômes sans nom entraient dans l'inventaire, étaient persistés, puis poussés au
      // cloud. Même incident que celui corrigé à la porte d'à côté, même remède.
      //
      // On filtre au lieu de tout refuser : la fusion est douce par nature, une entrée
      // illisible n'a pas à faire échouer les entrées valides du même fichier.
      const ingredientsDuFichier = (Array.isArray(data?.ingredients) ? data.ingredients : [])
        .filter(estFusionnable);
      if (ingredientsDuFichier.length === 0) {
        toast('Format non reconnu', 'error');
        return;
      }

      let updatedCount = 0;
      let addedCount = 0;

      ingredientsDuFichier.forEach(jsonIng => {
        let target = state.ingredients.find(i => i.id === jsonIng.id);
        if (!target) {
          target = state.ingredients.find(i => areSimilar(i.name, jsonIng.name));
        }

        if (target) {
          target.inStock = !!jsonIng.inStock;
          target.inCart = !!jsonIng.inCart;
          target.pinned = !!jsonIng.pinned;
          target.frozen = !!jsonIng.frozen;
          // LOT 015, §G — ÉCART DE PÉRIMÈTRE autorisé par Joel le 2026-07-30.
          // Ce chemin repassait un article à « plus à acheter » SANS purger le Set des
          // coches : l'id y restait, invisible à l'écran (`src/ui/shopping.js:42`) mais
          // poussé au cloud (`src/services/firebase.js:61`). C'est la porte que le
          // chantier 10c ferme sur la restauration totale, restée ouverte juste à côté.
          if (!target.inCart) shoppingChecked.delete(target.id);
          updatedCount++;
        } else {
          // LOT 014, §C1 — seconde fuite, plus discrète que celle du filtre d'entrée : une
          // entrée dont l'`id` ne correspond à AUCUN ingrédient local et qui n'a pas de nom
          // (`{ "id": "zzz" }`) tombait ici et CRÉAIT un ingrédient sans nom — le fantôme
          // exact que §C1 ferme. Mettre à jour un id connu sans répéter son nom reste permis
          // (branche du dessus) ; en CRÉER un sans nom ne l'est plus.
          if (!aUnNomExploitable(jsonIng)) return;
          // CORRECTIF (LOT 014, trouve par audit adversarial le 2026-07-31) — GARDE DE TYPE.
          // `estFusionnable` laisse passer une entree des qu'elle a un NOM exploitable,
          // meme si son `id` n'est pas une chaine (`{"id":123,"name":"Test"}` : `id` seul ne
          // suffirait pas a fusionner, mais `name` si). `.startsWith` sur un id numerique ou
          // booleen LEVAIT ici, en PLEIN MILIEU de la boucle : les entrees deja traitees
          // avant le crash restaient mutees sur `state.ingredients` (reference live, LOT 014
          // volet B), et le prochain `saveState()` — n'importe quelle action ulterieure de
          // Joel — les persistait et les poussait au cloud sans lien apparent avec l'import
          // rate. `typeof` fait retomber un id non-textuel sur `generateId`, exactement
          // comme un id absent.
          const newId = typeof jsonIng.id === 'string' && jsonIng.id.startsWith('custom_')
            ? jsonIng.id
            // LOT 014, volet D — passe par `generateId`, SSOT des identifiants. Le prefixe
            // reste `custom_` : c'est lui que teste la branche du dessus pour reconnaitre
            // un id deja genere par ce chemin.
            : generateId('custom_restore');
          state.ingredients.push({ ...jsonIng, id: newId });
          // LOT 015, §G — même purge que la branche ci-dessus. Cette branche CONSERVE l'id
          // quand il commence par `custom_` : un id ré-inséré hors panier pouvait donc
          // retrouver une coche fantôme déjà présente dans le Set (venue du cloud), et
          // l'article réapparaissait « déjà coché » le jour où il revenait aux courses.
          if (!jsonIng.inCart) shoppingChecked.delete(newId);
          addedCount++;
        }
      });

      saveState();
      // LOT 015, chantier 8 : le mot « Restauration » entretenait la confusion avec le
      // bouton d'a cote (« Restaurer une sauvegarde »), qui remplace TOUT. Ici c'est une
      // fusion douce -- le libelle doit le dire.
      toast(`🔄 Stock fusionné : ${updatedCount} mis à jour, ${addedCount} ajoutés`);
    } catch (err) {
      toast('Format JSON invalide', 'error');
    }
  };
  reader.readAsText(file);
}
