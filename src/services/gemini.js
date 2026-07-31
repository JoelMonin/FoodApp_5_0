import { AI_ROLES, MESSAGE_CLE_API_MANQUANTE } from '../constants.js';
import { CATEGORIES } from '../data.js';
import { decouperJsonIA, extraireJsonIA } from '../utils/aiJson.js';

// Restaurées à l'identique de l'oracle (foodapp-v5-Joel.html l.5219-5224) : sans elles,
// le filtre de sécurité par défaut de Google bloque une part réelle des recettes générées.
const RECIPE_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

/**
 * Appelle l'API Gemini pour générer du contenu.
 * @param {string} prompt - Le message à envoyer.
 * @param {string} apiKey - La clé API de l'utilisateur.
 * @param {string} model - Le modèle à utiliser (voir AI_ROLES dans constants.js).
 * @param {Object} options - Options de génération.
 * @param {string} [options.thinkingLevel] - 'minimal'|'low'|'medium'|'high' (Gemini 3.x —
 *   remplace l'ancien `thinkingBudget` numérique, incompatible avec Gemini 3.x). Facultatif :
 *   n'est envoyé que s'il est fourni.
 * @param {Array} [options.safetySettings] - Cf. RECIPE_SAFETY_SETTINGS.
 * @param {Function} [options.onThinkingFallback] - Appelée UNIQUEMENT si la requête a dû être
 *   rejouée sans `thinkingLevel` après un rejet 400 de l'API, ET que ce second essai a
 *   réussi. Sert à avertir l'utilisateur (toast) que la génération s'est faite sans le
 *   niveau d'effort demandé — jamais silencieux (demande explicite de Joel, LOT 011).
 * @returns {Promise<string>} - La réponse textuelle de l'IA.
 */
export async function callAI(prompt, apiKey, model = AI_ROLES.REASONING, options = {}) {
  if (!apiKey) throw new Error(MESSAGE_CLE_API_MANQUANTE);

  const tokens = options.maxTokens || 4096;
  const isJSON = options.isJSON !== undefined ? options.isJSON : true;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  function buildBody(includeThinking) {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: tokens
      }
    };

    // temperature/topK/topP : dépréciés et ignorés par Gemini 3.x (gemini-3.6-flash,
    // gemini-3.5-flash-lite — les deux seuls modèles utilisés par ce projet), Google
    // recommande explicitement de ne plus les envoyer plutôt que d'imposer un défaut
    // inerte (trouvé lors de l'audit du sous-lot 11A, LOT 011). Envoyés SEULEMENT si le
    // caller les fournit explicitement, pour ne pas changer le comportement des appels
    // hors LOT 011 qui les passent encore (analyse nutrition, suggestion de catégorie).
    if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
    if (options.topK) body.generationConfig.topK = options.topK;
    if (options.topP) body.generationConfig.topP = options.topP;
    if (options.thinkingLevel && includeThinking) {
      body.generationConfig.thinkingConfig = { thinkingLevel: options.thinkingLevel };
    }

    // Utilisation du Response Schema si fourni (mode JSON strict)
    if (options.schema) {
      body.generationConfig.responseMimeType = "application/json";
      body.generationConfig.responseSchema = options.schema;
    }

    if (options.safetySettings) body.safetySettings = options.safetySettings;

    return body;
  }

  async function attempt(includeThinking) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(includeThinking))
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const httpError = new Error(err.error?.message || 'Erreur API IA: ' + res.statusText);
      httpError.status = res.status;
      throw httpError;
    }

    return res.json();
  }

  let data;
  try {
    data = await attempt(true);
  } catch (err) {
    // Motif large : accepte camelCase, snake_case, kebab-case et espaces — un message
    // d'erreur Google réel pourrait citer le champ sous n'importe laquelle de ces formes
    // (durcissement trouvé lors de l'audit du sous-lot 11A).
    const rejetteLeParametre = err.status === 400 && /thinking[\s_-]?(?:config|level)/i.test(err.message || '');
    if (options.thinkingLevel && rejetteLeParametre) {
      data = await attempt(false);
      options.onThinkingFallback?.();
    } else {
      throw err;
    }
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse vide de l'IA");

  if (isJSON && !options.schema) {
    // Extraction pour les modèles sans JSON Mode strict (bloc Markdown, ou JSON noyé dans
    // du bavardage). SSOT du découpage : `src/utils/aiJson.js` (LOT 014). Le contrat de
    // `callAI` ne change pas — on rend une CHAÎNE, et le texte brut si rien n'est trouvé.
    const bloc = decouperJsonIA(text);
    return bloc !== null ? bloc : text.trim();
  }

  return text.trim();
}

/**
 * Traduit le curseur de créativité (0-100) en consigne textuelle (LOT 011, arbitrage
 * Joel A2). Sur Gemini 3.x, `temperature` est déprécié et purement ignoré : le mécanisme
 * d'origine (créativité -> température) ne produit plus aucun effet. Paliers alignés sur
 * les libellés déjà affichés au-dessus du curseur (`index.html`, `.creativity-labels`).
 */
function creativityInstruction(creativity) {
  if (creativity <= 33) {
    return "Reste CLASSIQUE : des recettes connues et rassurantes, sans prise de risque.";
  }
  if (creativity <= 66) {
    return "Vise un bon ÉQUILIBRE entre recettes connues et touches d'originalité.";
  }
  return "Sois TRÈS CRÉATIF : ose des associations originales et surprenantes.";
}

/**
 * Génère 5 suggestions de recettes basées sur le stock et la config.
 *
 * Prompt restauré à partir de l'oracle (`foodapp-v5-Joel.html` l.5186-5233), mais fusionné
 * avec les formulations figées par les tests du LOT 010 plutôt que copié mot pour mot :
 * ces formulations corrigent un bug de quantités/emojis que Joel a constaté en usage réel
 * et sont donc prioritaires sur le texte de l'oracle (LOT 011, §10-B).
 *
 * @param {Object} [options]
 * @param {Function} [options.onThinkingFallback] - Cf. callAI. Transmis tel quel.
 */
export async function generateRecipes(apiKey, stockItems, aiConfig, allIngredients, extraIngredients, options = {}) {
  const creativity = aiConfig.creativity ?? 50;

  const stockList = stockItems.map(i => i.name).join(', ');
  const pinnedIngredients = allIngredients.filter(i => i.pinned);

  const dietStr = (aiConfig.diet || []).join(', ');
  const hasCuisineFilter = (aiConfig.cuisines || []).length > 0;
  const cuisineStr = hasCuisineFilter ? (aiConfig.cuisines || []).join(', ') : 'Libre';
  let cfgEquip = (aiConfig.equip || []);
  if (cfgEquip.includes('Poêles')) cfgEquip = cfgEquip.map(e => e === 'Poêles' ? 'Poêles & Casseroles (plaques de cuisson)' : e);
  const equipStr = cfgEquip.length > 0 ? cfgEquip.join(', ') : 'Tous équipements';
  const timeStr = aiConfig.time === 'libre' ? 'Sans limite' : aiConfig.time + ' minutes max';
  const diffStr = aiConfig.diff === 'indifferent' ? 'Toutes difficultés' : aiConfig.diff;
  const mealStr = aiConfig.meal === 'indifferent' ? 'Tous types' : aiConfig.meal;

  const allImposed = [
    ...pinnedIngredients.map(i => `${i.name} (en stock)`),
    ...extraIngredients.map(i => `${i.name} (hors stock)`)
  ];

  const imposedPrompt = allImposed.length > 0
    ? `3. INGRÉDIENTS IMPOSÉS : Chaque recette DOIT obligatoirement inclure TOUS ces ingrédients : ${allImposed.join(', ')}. C'est une obligation stricte.`
    : `3. INGRÉDIENTS IMPOSÉS : Aucune contrainte spécifique (liberté totale).`;

  const prompt = `Tu es une IA culinaire experte. TA MISSION : générer EXACTEMENT 5 recettes différentes.

🚨 CONTRAINTES (à appliquer sur chaque recette) :
1. TYPE DE PLAT : Obligatoire -> ${mealStr}.
2. CUISINE : ${cuisineStr}${hasCuisineFilter ? ' — respect STRICT de ce choix, aucune autre origine culinaire.' : ' (aucune contrainte, choisis librement).'}
${imposedPrompt}
4. NOMBRE DE PERSONNES : Exactement ${aiConfig.ppl} personnes. Aligne les quantités en conséquence.
5. MATÉRIEL PRIORITAIRE : ${equipStr}.
6. RÉGIMES & EXCLUSIONS : ${dietStr || 'Aucun régime'}. Exclure formellement : ${aiConfig.exclusions || 'rien'}.
   ⚠️ RÈGLE D'OR : Si un ingrédient est "IMPOSÉ" (ex: Riz), il A PRIORITÉ et annule toute contrainte de régime qui l'interdirait (ex: Sans Céréales).
7. TEMPS & DIFFICULTÉ : Max ${timeStr}, niveau ${diffStr}.
8. CRÉATIVITÉ : ${creativityInstruction(creativity)}
🛒 STOCK DISPONIBLE (à privilégier) : ${stockList}

📋 RÈGLES DE DONNÉES ET FORMATAGE :
1. "s" (source) : "pinned" (imposé déjà en stock), "missing" (imposé hors stock, ou tout ajout hors stock), "stock" (provenant du stock disponible).
2. quantités jamais vides ; "q" contient TOUJOURS la quantité ET l'unité ensemble (ex: "200 g",
   "2 pièces"), jamais l'un sans l'autre ; "e" contient UN SEUL emoji, jamais du texte.
   Interdits : ingrédients "Aucun" ou "N/A".
3. Utilise UNIQUEMENT des guillemets simples (') dans les textes (titre, description, étapes).
   Aucun guillemet double (") dans les valeurs de texte.
4. Tu NE DOIS retourner QUE du code JSON (encadré ou non par des balises \`\`\`json). AUCUN texte explicatif.

Format JSON uniquement:
[{"name":"...","description":"...","time":"...","difficulty":"...","people":${aiConfig.ppl},"cuisine":"...","ingredients":[{"n":"[NOM]","q":"[QUANTITÉ+UNITÉ]","e":"[1 EMOJI]","c":"[CATÉGORIE]","s":"[stock|pinned|missing]"}],"steps":["[ÉTAPE 1]"]}]`;

  const model = aiConfig.models?.recipeGeneration || AI_ROLES.REASONING;

  const rawText = await callAI(prompt, apiKey, model, {
    maxTokens: 8192,
    isJSON: false,
    thinkingLevel: 'high',
    safetySettings: RECIPE_SAFETY_SETTINGS,
    onThinkingFallback: options.onThinkingFallback
  });

  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Sauvetage manuel si le JSON est malformé ou tronqué
    let cleanStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    let results = [];
    let depth = 0;
    let inStr = false;
    let objStart = -1;

    for (let i = 0; i < cleanStr.length; i++) {
      if (cleanStr[i] === '"' && cleanStr[i - 1] !== '\\') inStr = !inStr;
      if (!inStr) {
        if (cleanStr[i] === '{') {
          if (depth === 0) objStart = i;
          depth++;
        } else if (cleanStr[i] === '}') {
          depth--;
          if (depth === 0 && objStart !== -1) {
            try {
              let p = JSON.parse(cleanStr.substring(objStart, i + 1));
              // `p.ingredients` obligatoire (trouvé par l'audit du sous-lot 11B) : la
              // condition précédente acceptait un objet avec SEULEMENT `steps`, sans
              // ingrédients — ni une vraie recette, ni un favori texte brut valide côté
              // rendu (chantier 2). `p.steps`, lui, reste optionnel ici : une troncature
              // peut couper juste avant/pendant les étapes sans invalider le reste ; le
              // rendu (src/ui/recipe.js) sait déjà afficher une recette sans étapes.
              if (p.name && p.ingredients && p.ingredients.length > 0) results.push(p);
            } catch (err) { }
          }
        }
      }
    }
    if (results.length > 0) return results;
    throw e;
  }
}

/**
 * Transforme un texte brut ou du HTML de recette en objet JSON structuré.
 *
 * Contrat restauré à partir de l'oracle (`foodapp-v5-Joel.html` l.5976-6015) : contrairement
 * à la version appauvrie précédente, le prompt reçoit désormais le titre saisi par
 * l'utilisateur et l'inventaire en stock (aucun des deux n'était transmis).
 * Ajout hors oracle validé par Joel (LOT 011, §9 Q1) : consigne de respecter le nombre de
 * personnes du texte source au lieu de retomber systématiquement sur 2.
 *
 * @param {string} title - Titre saisi par l'utilisateur (peut être vide).
 * @param {string} content - Texte brut de la recette à transformer.
 * @param {Array} stockItems - Ingrédients actuellement en stock (`{ name }`).
 * @param {string} apiKey
 * @param {string} [model]
 * @param {Object} [options]
 * @param {Function} [options.onThinkingFallback] - Cf. callAI.
 */
export async function transformRecipeFromText(title, content, stockItems, apiKey, model = AI_ROLES.REASONING, options = {}) {
  const stockList = (stockItems || []).map(i => i.name).join(', ');

  const prompt = `Tu es un rédacteur culinaire expert. Tu développes des fiches recettes précises, fiables et cohérentes. Ta mission est de convertir la recette brute suivante en JSON structuré. Priorise la justesse technique et la lisibilité au détriment de l'originalité marketing ou du vocabulaire flou.
Inventaire disponible (en stock) : ${stockList}

Données brutes :
Titre : ${title || 'Sans titre'}
Contenu : ${content}

Instructions :
1. RÈGLES DE COHÉRENCE :
   - LE TITRE : Doit être techniquement exact. Ne pas mentionner un ingrédient absent de la liste.
   - LE TEMPS : Doit inclure toute étape obligatoire (préparation, cuisson, repos).
   - LE NOMBRE DE PERSONNES : Si le texte source l'indique explicitement, le reprendre tel quel.
     Sinon, 2 par défaut.
   - INGRÉDIENTS & QUANTITÉS : Spécifie des quantités réalistes, précises et cohérentes
     (ex: "500g", "20cl"), jamais vides. Chaque ingrédient listé doit être utilisé dans les
     étapes. Utilise des intitulés propres sans préfixes parasites.
   - EMOJIS : Le champ "e" doit obligatoirement être UN SEUL CARACTÈRE emoji, jamais du texte.
   - ÉTAPES : Reste court mais inclus au moins un repère sensoriel (couleur, texture, réduction).
   - STYLE : Évite les formulations vagues ou marketing.
2. ANALYSE : Analyse TOUS les ingrédients avec leurs QUANTITÉS précises.
3. CATÉGORIES : Utilise uniquement ${CATEGORIES.join(', ')}.
4. GUILLEMETS : Utilise UNIQUEMENT des guillemets simples (') dans les textes. Aucun guillemet
   double (") dans les valeurs.
5. RÉPONSE : Réponds UNIQUEMENT avec l'objet JSON suivant, sans texte explicatif :
{"name":"titre","description":"phrase d'accroche","time":"X min","difficulty":"Facile|Moyen|Expert","people":2,"cuisine":"française","ingredients":[{"n":"nom","q":"[QUANTITÉ+UNITÉ]","e":"emoji","c":"catégorie officielle","s":"stock|pinned|missing"}],"steps":["étape détaillée..."]}`;

  const rawText = await callAI(prompt, apiKey, model, {
    maxTokens: 8192,
    isJSON: false,
    thinkingLevel: 'high',
    safetySettings: RECIPE_SAFETY_SETTINGS,
    onThinkingFallback: options.onThinkingFallback
  });

  // SSOT de la lecture (LOT 014, `src/utils/aiJson.js`), partagée par les quatre appelants.
  // L'appelant (`transformRecipeAI`) revalide ensuite la FORME avec `isValidRecipe` : lire
  // du JSON ne prouve pas que c'est une recette.
  const recette = extraireJsonIA(rawText);
  if (!recette) throw new Error("Réponse IA illisible : aucun JSON exploitable");
  return recette;
}
