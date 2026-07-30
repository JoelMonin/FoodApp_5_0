import { AI_ROLES } from '../constants.js';

/**
 * Appelle l'API Gemini pour générer du contenu.
 * @param {string} prompt - Le message à envoyer.
 * @param {string} apiKey - La clé API de l'utilisateur.
 * @param {string} model - Le modèle à utiliser (voir AI_ROLES dans constants.js).
 * @param {Object} options - Options de génération (température, maxTokens, etc.)
 * @returns {Promise<string>} - La réponse textuelle de l'IA.
 */
export async function callAI(prompt, apiKey, model = AI_ROLES.REASONING, options = {}) {
  if (!apiKey) throw new Error("Clé API manquante.");

  const temp = options.temperature !== undefined ? options.temperature : 0.1;
  const tokens = options.maxTokens || 4096;
  const isJSON = options.isJSON !== undefined ? options.isJSON : true;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: temp,
      maxOutputTokens: tokens
    }
  };

  if (options.topK) body.generationConfig.topK = options.topK;
  if (options.topP) body.generationConfig.topP = options.topP;
  
  // Utilisation du Response Schema si fourni (mode JSON strict)
  if (options.schema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = options.schema;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erreur API IA: ' + res.statusText);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse vide de l'IA");

  if (isJSON && !options.schema) {
    // Extraction robuste pour les modèles sans JSON Mode strict (Markdown blocks)
    // Utilise un regex non-greedy pour éviter de capturer trop si plusieurs blocs existent
    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*?\}/) || text.match(/\[[\s\S]*?\]/);
    return match ? (match[1] || match[0]).trim() : text.trim();
  }
  
  return text.trim();
}

/**
 * Génère 5 suggestions de recettes basées sur le stock et la config.
 */
export async function generateRecipes(apiKey, stockItems, aiConfig, allIngredients, extraIngredients) {
  const creativity = aiConfig.creativity || 50;
  const temp = 0.2 + (creativity / 100) * 1.0; 

  const stockList = stockItems.map(i => i.name).join(', ');
  const pinnedIngredients = allIngredients.filter(i => i.pinned);
  
  const dietStr = (aiConfig.diet || []).join(', ');
  const cuisineStr = (aiConfig.cuisines || []).length > 0 ? (aiConfig.cuisines || []).join(', ') : 'Libre';
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
    ? `3. INGRÉDIENTS IMPOSÉS : Chaque recette DOIT obligatoirement inclure TOUS ces ingrédients : ${allImposed.join(', ')}.`
    : `3. INGRÉDIENTS IMPOSÉS : Aucune contrainte spécifique.`;

  const prompt = `Tu es une IA culinaire experte. Génère EXACTEMENT 5 recettes.
TYPE : ${mealStr} | CUISINE : ${cuisineStr} | PERSONNES : ${aiConfig.ppl}
${imposedPrompt}
MATÉRIEL : ${equipStr} | RÉGIMES : ${dietStr} | EXCLUSIONS : ${aiConfig.exclusions || 'rien'}
TEMPS : ${timeStr} | DIFF : ${diffStr}
STOCK DISPONIBLE : ${stockList}

RÈGLES DE DONNÉES : quantités jamais vides ; "q" contient TOUJOURS la quantité ET
l'unité ensemble (ex: "200 g", "2 pièces"), jamais l'un sans l'autre ; "e" contient
UN SEUL emoji, jamais du texte.

Format JSON uniquement:
[{"name":"...","description":"...","time":"...","difficulty":"...","people":${aiConfig.ppl},"cuisine":"...","ingredients":[{"n":"[NOM]","q":"[QUANTITÉ+UNITÉ]","e":"[1 EMOJI]","c":"[CATÉGORIE]","s":"stock|pinned|missing"}],"steps":["..."]}]`;

  const model = aiConfig.models?.recipeGeneration || AI_ROLES.REASONING;
  
  const rawText = await callAI(prompt, apiKey, model, {
    temperature: temp,
    maxTokens: 8192,
    isJSON: false
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
              if (p.name && (p.ingredients || p.steps)) results.push(p);
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
 */
export async function transformRecipeFromText(text, apiKey, model = AI_ROLES.REASONING) {
  const prompt = `Tu es un expert culinaire. Tu reçois un texte brut (éventuellement du HTML) d'une recette.
Extrais les informations pour créer un objet JSON structuré.
Si le texte contient des scories HTML, ignore-les et concentre-toi sur le contenu culinaire.

Format JSON attendu :
{
  "name": "Titre de la recette",
  "time": "ex: 45 min",
  "difficulty": "Facile|Moyen|Expert",
  "people": 2,
  "ingredients": [{"n": "nom", "q": "quantité", "e": "emoji", "c": "catégorie"}],
  "steps": ["étape 1", "étape 2"]
}

TEXTE À TRAITER :
${text}`;

  const rawText = await callAI(prompt, apiKey, model, { temperature: 0.1, isJSON: false });
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Basic fallback if JSON is wrapped in markdown
    const match = rawText.match(/```json\s*([\s\S]*?)```/) || rawText.match(/\{[\s\S]*?\}/);
    if (match) return JSON.parse((match[1] || match[0]).trim());
    throw e;
  }
}
