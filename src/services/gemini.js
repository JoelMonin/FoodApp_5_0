import { AI_ROLES, MESSAGE_CLE_API_MANQUANTE, MAX_EXCEPTIONS_CHARS, MAX_EXCLUSIONS_CHARS, MAX_OUTPUT_TOKENS_IA } from '../constants.js';
import { CATEGORIES } from '../data.js';
import { decouperJsonIA, extraireJsonIA } from '../utils/aiJson.js';
import { creativityLevel, envieActive, consigneLibre, listeSure } from '../utils/helpers.js';

/**
 * SSOT DES CONSIGNES COMMUNES AUX DEUX PROMPTS (LOT 026, chantier E).
 *
 * Jusqu'ici, les règles partagées étaient RECOPIÉES entre `generateRecipes` et
 * `transformRecipeFromText`, avec des formulations qui divergeaient déjà — et le correctif
 * P2 (apostrophes, LOT 025) a dû être appliqué DEUX fois pour cette raison. Chaque règle
 * commune vit désormais ici, en UN exemplaire, consommée par les deux prompts.
 *
 * Arbitrage d'unification (fiche LOT 026, §3.E, validé par Joel) : quand les deux
 * formulations divergeaient, c'est celle de `generateRecipes` qui survit — elle est figée
 * au mot près par `tests/gemini.test.js` (LOT 010) ; celle de la recette collée ne l'était
 * pas, elle s'aligne.
 */

// Guillemets + apostrophes (P2, LOT 025) : protège la lecture du JSON SANS interdire
// l'apostrophe française — l'IA comprenait « guillemets simples interdits » comme
// « apostrophe interdite » et rendait « l eau », « d une cocotte ».
const REGLE_GUILLEMETS = `STRUCTURE JSON : les délimiteurs de chaîne sont OBLIGATOIREMENT des
   guillemets doubles ("). N'utilise JAMAIS le guillemet simple (') pour ouvrir ou fermer une
   valeur : {"name": 'Crêpes'} est INVALIDE, {"name": "Crêpes"} est correct.
   CONTENU DES TEXTES (titre, description, étapes) : n'y place aucun guillemet double —
   reformule ou utilise une apostrophe.
   ATTENTION — l'apostrophe À L'INTÉRIEUR DES MOTS reste OBLIGATOIRE : écris « l'eau »,
   « d'une cocotte », « jaune d'oeuf ». JAMAIS « l eau », « d une cocotte », « jaune d oeuf ».`;

// Catégories officielles (LOT 026, chantier A) : la liste n'était donnée QU'À la recette
// collée — le prompt de génération demandait `"c":"[CATÉGORIE]"` sans jamais dire
// lesquelles, et l'IA inventait des noms de rayon que `sanitizeCategory` rattrapait ou
// reléguait en « Autres ».
const REGLE_CATEGORIES = `Utilise uniquement ${CATEGORIES.join(', ')}.`;

// Qualité des étapes (LOT 026, chantier D — consigne de Joel : « la meilleure qualité tout
// le temps, et un niveau suffisant d'information pour réaliser la recette parfaitement »).
// Une seule exigence pour les deux écrans : avant ce lot, la recette collée demandait un
// repère sensoriel et la génération rien du tout.
const REGLE_QUALITE_ETAPES = `Chaque étape est AUTOSUFFISANTE : indique les durées, les températures et le niveau de feu
   chaque fois qu'ils s'appliquent, le moment où chaque ingrédient entre en jeu, et un repère
   concret de réussite (couleur, texture, consistance). Une personne qui découvre la recette
   doit pouvoir la réussir parfaitement sans rien deviner.`;

// Restaurées à l'identique de l'oracle (foodapp-v5-Joel.html l.5219-5224) : sans elles,
// le filtre de sécurité par défaut de Google bloque une part réelle des recettes générées.
// SSOT du message « réponse coupée » (LOT 029, findings D et F-07). Deux chemins très
// éloignés le lèvent — la coupure TOTALE, où il ne reste aucun texte, et la coupure PARTIELLE
// que le sauvetage n'a pas su rattraper. Les deux décrivent la même panne : les écrire deux
// fois, c'est se condamner à n'en corriger qu'un le jour où la formulation changera.
const MESSAGE_REPONSE_COUPEE =
  "La réponse de l'IA a été coupée : la demande produit trop de texte. "
  + 'Essayez une envie du moment plus courte, ou moins de contraintes à la fois.';

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
 *
 * LOT 021 — LES SIX OPTIONS CI-DESSOUS N'ÉTAIENT PAS DOCUMENTÉES. Le vérificateur de types
 * les a toutes exhumées d'un coup : le corps de la fonction les lisait, le contrat d'entrée
 * les passait sous silence. Aucun test ne pouvait signaler ça — c'est exactement le genre
 * d'écart entre ce qu'un code FAIT et ce qu'il ANNONCE que seule une relecture outillée voit.
 *
 * @param {number} [options.maxTokens=4096] - Plafond de longueur de la réponse.
 * @param {boolean} [options.isJSON=true] - Exige une réponse en JSON strict. Le défaut est
 *   VRAI : la quasi-totalité des appels de l'app attendent une structure, pas de la prose.
 * @param {number} [options.temperature] - Créativité du modèle. N'est envoyé que si fourni.
 * @param {number} [options.topK] - Diversité du vocabulaire. N'est envoyé que si fourni.
 * @param {number} [options.topP] - Idem, par masse de probabilité. Envoyé si fourni.
 * @param {Object} [options.schema] - Structure JSON imposée à la réponse.
 * @param {string} [options.thinkingLevel] - 'minimal'|'low'|'medium'|'high' (Gemini 3.x —
 *   remplace l'ancien `thinkingBudget` numérique, incompatible avec Gemini 3.x). Facultatif :
 *   n'est envoyé que s'il est fourni.
 * @param {Array} [options.safetySettings] - Cf. RECIPE_SAFETY_SETTINGS.
 * @param {Function} [options.onTruncated] - Appelée quand Google signale `finishReason:
 *   'MAX_TOKENS'`, c'est-à-dire une réponse COUPÉE au plafond (LOT 029, chantier D). Permet à
 *   l'appelant de distinguer « tronquée » d'« illisible » — deux pannes qui appellent des
 *   messages opposés : réessayer ne sert à rien face à une troncature.
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

    // temperature/topK/topP : dépréciés et ignorés par TOUTE la génération Gemini 3.x — donc
    // par les deux modèles de ce projet, quels qu'ils soient (SSOT `AI_ROLES`). LOT 029 : les
    // noms étaient écrits ici en dur, et sont devenus faux le jour du passage à
    // `gemini-3.7-flash`. Un commentaire qui nomme une valeur mouvante coûte plus cher qu'un
    // commentaire absent, le jour où quelqu'un le croit. Google
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

  // LOT 029, chantier D — LIRE LE MOTIF D'ARRÊT. Google dit explicitement pourquoi il s'est
  // trouvé : `MAX_TOKENS` = la réponse a été COUPÉE au plafond, elle n'est pas illisible.
  // L'app ne regardait jamais ce champ : toute réponse tronquée était donc traitée comme du
  // charabia, et Joel se voyait conseiller « réessayez » alors qu'un nouvel essai identique
  // reproduisait la même coupure — la cause étant structurelle, pas aléatoire. Panne réelle
  // remontée par Joel le 2026-08-03 : « j'ai quand même ce message la plupart du temps avec
  // les envies du moment ».
  if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') options.onTruncated?.();


  // LOT 029, chantier D bis — LIRE **TOUTES** LES PARTIES DE LA RÉPONSE, pas seulement la
  // première. Le code ne lisait que `parts[0]`, ce qui suppose que Google répond toujours en
  // UN seul morceau. Ce n'est pas garanti : une réponse longue peut arriver découpée, et les
  // modèles à réflexion peuvent intercaler une partie « pensée ». Si le JSON commence
  // ailleurs qu'au premier morceau, tout ce qui suit est perdu et la réponse paraît
  // ILLISIBLE — le message exact que Joel voit, sans qu'aucune troncature soit en cause.
  // Les parties marquées `thought` sont écartées : ce sont les notes de réflexion du modèle,
  // jamais la réponse demandée.
  const parties = data.candidates?.[0]?.content?.parts || [];
  const text = parties
    .filter(p => typeof p?.text === 'string' && !p.thought)
    .map(p => p.text)
    .join('');
  // LOT 029 (finding F-07 de l'audit Codex) — UNE COUPURE TOTALE RESTE UNE COUPURE. Quand le
  // plafond est atteint pendant la réflexion, il ne reste AUCUNE partie visible : le drapeau
  // de troncature était bien levé, mais `generateRecipes` n'avait jamais l'occasion de s'en
  // servir, car cette ligne levait « Réponse vide » d'abord. Joel lisait donc le message le
  // moins utile des deux, dans le cas le plus caractéristique de la panne.
  if (!text && data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new Error(MESSAGE_REPONSE_COUPEE);
  }
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
 * les libellés affichés sous le curseur (`index.html`, `.creativity-labels`).
 *
 * LOT 023 — le seuillage lui-même vit désormais dans `creativityLevel` (SSOT partagée avec
 * la mise en évidence du libellé actif, `src/ui/aiPanel.js`). Les TROIS PHRASES ci-dessous
 * sont INCHANGÉES au mot près : ce lot corrige le curseur, pas ce que l'IA reçoit.
 */
function creativityInstruction(creativity) {
  const niveau = creativityLevel(creativity);
  if (niveau === 'classique') {
    return "Reste CLASSIQUE : des recettes connues et rassurantes, sans prise de risque.";
  }
  if (niveau === 'equilibre') {
    return "Vise un bon ÉQUILIBRE entre recettes connues et touches d'originalité.";
  }
  return "Sois TRÈS CRÉATIF : ose des associations originales et surprenantes.";
}

/**
 * CONTRAT DE SORTIE de `generateRecipes` : un TABLEAU de recettes, toujours (LOT 029, finding
 * F-01 de l'audit Codex).
 *
 * L'écran des résultats fait `recipes.map(...)` sans se poser de question — et il a raison,
 * c'est le contrat annoncé. Mais une réponse d'IA n'est pas une donnée de confiance : le
 * modèle rend parfois UNE recette seule au lieu du tableau demandé. Ce JSON-là est
 * parfaitement valide ; il est simplement à la mauvaise forme.
 *
 * On la remet dans le contrat plutôt que de la perdre — c'est exactement ce que le sauvetage
 * d'urgence faisait, sans que personne l'ait écrit noir sur blanc. Toute autre racine
 * (nombre, chaîne, objet sans nom) rend `null` : le sauvetage prendra la main.
 *
 * @param {unknown} valeur - Ce que `JSON.parse` a rendu.
 * @returns {any[] | null} Un tableau exploitable, ou `null` si la racine ne l'est pas.
 */
function normaliserRecettes(valeur) {
  if (Array.isArray(valeur)) return valeur;
  // `name` sert de signature minimale d'une recette. Le passage par un objet indexable est
  // ce que le vérificateur de types exige pour lire une propriété sur une valeur inconnue —
  // et il a raison de le demander : rien ne garantit la forme d'une réponse d'IA.
  const candidat = /** @type {Record<string, unknown>} */ (valeur);
  if (candidat && typeof candidat === 'object' && candidat.name) return [candidat];
  return null;
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
 * @param {string[]} [options.recentNames] - Noms proposés il y a moins d'une heure (LOT 026,
 *   chantier C — mémoire de session de `src/ui/aiPanel.js`). Non vide → une ligne d'interdiction
 *   de reproposer s'ajoute aux contraintes ; vide ou absent → le message est identique à avant.
 */
export async function generateRecipes(apiKey, stockItems, aiConfig, allIngredients, extraIngredients, options = {}) {
  const creativity = aiConfig.creativity ?? 50;

  const stockList = stockItems.map(i => i.name).join(', ');
  const pinnedIngredients = allIngredients.filter(i => i.pinned);

  // LOT 029 (finding F-012) — `exclusions` rejoint `envie` et `exceptions` : garde de type et
  // borne dure, par la MÊME fonction. Le `maxlength="80"` de la page ne protège que le
  // clavier ; cette valeur arrive aussi par le cloud et par une sauvegarde restaurée, qui ne
  // connaissent aucune borne. Le repli « rien » est conservé tel quel — c'est le mot que le
  // modèle lit depuis l'origine, il n'a aucune raison de changer.
  const exclusionsStr = consigneLibre(aiConfig.exclusions, MAX_EXCLUSIONS_CHARS);

  const dietStr = listeSure(aiConfig.diet).join(', ');
  const hasCuisineFilter = listeSure(aiConfig.cuisines).length > 0;
  const cuisineStr = hasCuisineFilter ? listeSure(aiConfig.cuisines).join(', ') : 'Libre';
  let cfgEquip = listeSure(aiConfig.equip);
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

  // LOT 026, chantier C — anti-répétition EN SÉRIE seulement (décision de Joel) : les noms
  // proposés dans l'heure arrivent par `options.recentNames` (mémoire de session,
  // `src/ui/aiPanel.js`). Liste vide → AUCUNE ligne : pas un jeton pour rien, et la
  // première génération d'une session reste strictement identique à avant.
  const recentNames = (options.recentNames || []).filter(Boolean);
  const antiRepetePrompt = recentNames.length > 0
    ? `\n9. DÉJÀ PROPOSÉES RÉCEMMENT (moins d'une heure) : ${recentNames.join(', ')}. N'en repropose AUCUNE, ni de variante quasi identique.`
    : '';

  // LOT 028 — CONSIGNE LIBRE (« Envie du moment »), demande de Joel : « je veux pouvoir dire
  // "chili con carne" et n'avoir QUE des propositions de chili con carne ». C'est donc une
  // EXIGENCE, pas une inspiration — d'où la formulation « les 5 recettes doivent TOUTES y
  // répondre », qui ferme la lecture « 5 plats variés dont un chili ».
  //
  // Même patron que `antiRepetePrompt` ci-dessus : vide → chaîne vide → le message reste
  // IDENTIQUE À CELUI D'AVANT CE LOT, octet pour octet (verrouillé par un test de
  // non-régression), et pas un jeton n'est dépensé pour une consigne absente.
  //
  // Placée AVANT la liste des contraintes, et non en fin de liste : c'est le geste le plus
  // précis et le plus récent de l'utilisateur, il se lit en premier. LA HIÉRARCHIE EST
  // ÉCRITE ICI — plutôt que dans la RÈGLE D'OR de la contrainte 6, qui n'a aucune raison de
  // bouger et que `tests/gemini.test.js` fige au mot près.
  const envie = envieActive(aiConfig);
  const enviePrompt = envie
    ? `\n🎯 DEMANDE EXPRESSE DE L'UTILISATEUR : « ${envie} »
   Les 5 recettes doivent TOUTES y répondre : 5 variantes de cette demande, JAMAIS 5 plats différents dont un seul correspondrait.
   Cette demande PRIME sur les contraintes 1 (TYPE DE PLAT) et 2 (CUISINE) si elles la contredisent.
   Elle ne prime JAMAIS sur la contrainte 3 (INGRÉDIENTS IMPOSÉS), qui reste au-dessus de tout.\n`
    : '';

  // LOT 028 — « Exceptions autorisées » (`aiConfig.exceptions`) ENFIN BRANCHÉ. Ce champ était
  // saisi, enregistré, synchronisé au cloud et restauré depuis l'origine du projet, mais
  // n'était lu par AUCUN prompt — pas même dans le monolithe d'origine
  // (`foodapp-v5-Joel.html:5207-5228`, vérifié). Joel s'en était déjà servi (« Riz » dans sa
  // sauvegarde du 2026-07-29) en croyant que l'IA en tenait compte.
  //
  // Sous-ligne de la contrainte 6, car une exception ne se comprend que par rapport au régime
  // qu'elle assouplit. Le libellé « 6. RÉGIMES & EXCLUSIONS : … » lui-même n'est pas touché.
  // GARDE DE TYPE + BORNE (findings F1/F2, audit Codex du 2026-08-02). La version d'origine
  // de ce lot faisait `(aiConfig.exceptions || '').trim()` : une valeur non textuelle venue
  // d'un cloud ou d'une sauvegarde corrompue (`{nom:'Riz'}`) plantait sur `.trim`, et Joel
  // voyait « Erreur IA » sans aucune recette. C'est MOI qui ai créé cette exposition en
  // branchant ce champ au prompt — il n'était jamais lu auparavant. Même SSOT que la consigne
  // « Envie du moment », qui portait déjà cette garde.
  const exceptionsStr = consigneLibre(aiConfig.exceptions, MAX_EXCEPTIONS_CHARS);
  const exceptionsPrompt = exceptionsStr
    ? `\n   ✅ EXCEPTIONS AUTORISÉES malgré les régimes ci-dessus : ${exceptionsStr}.`
    : '';

  const prompt = `Tu es une IA culinaire experte. TA MISSION : générer EXACTEMENT 5 recettes différentes.
${enviePrompt}
🚨 CONTRAINTES (à appliquer sur chaque recette) :
1. TYPE DE PLAT : Obligatoire -> ${mealStr}.
2. CUISINE : ${cuisineStr}${hasCuisineFilter ? ' — respect STRICT de ce choix, aucune autre origine culinaire.' : ' (aucune contrainte, choisis librement).'}
${imposedPrompt}
4. NOMBRE DE PERSONNES : Exactement ${aiConfig.ppl} personnes. Aligne les quantités en conséquence.
5. MATÉRIEL PRIORITAIRE : ${equipStr}.
6. RÉGIMES & EXCLUSIONS : ${dietStr || 'Aucun régime'}. Exclure formellement : ${exclusionsStr || 'rien'}.${exceptionsPrompt}
   ⚠️ RÈGLE D'OR : Si un ingrédient est "IMPOSÉ" (ex: Riz), il A PRIORITÉ et annule toute contrainte de régime qui l'interdirait (ex: Sans Céréales).
7. TEMPS & DIFFICULTÉ : Max ${timeStr}, niveau ${diffStr}.
8. CRÉATIVITÉ : ${creativityInstruction(creativity)}${antiRepetePrompt}
🛒 STOCK DISPONIBLE (à privilégier) : ${stockList}

📋 RÈGLES DE DONNÉES ET FORMATAGE :
1. "s" (source) : "pinned" (imposé déjà en stock), "missing" (imposé hors stock, ou tout ajout hors stock), "stock" (provenant du stock disponible).
2. quantités jamais vides ; "q" contient TOUJOURS la quantité ET l'unité ensemble (ex: "200 g",
   "2 pièces"), jamais l'un sans l'autre ; "e" contient UN SEUL emoji, jamais du texte.
   Interdits : ingrédients "Aucun" ou "N/A".
3. "c" (catégorie) : ${REGLE_CATEGORIES}
4. ÉTAPES : ${REGLE_QUALITE_ETAPES}
5. ${REGLE_GUILLEMETS}
6. Tu NE DOIS retourner QUE du code JSON (encadré ou non par des balises \`\`\`json). AUCUN texte explicatif.

Format JSON uniquement:
[{"name":"...","description":"...","time":"...","difficulty":"...","people":${aiConfig.ppl},"cuisine":"...","ingredients":[{"n":"[NOM]","q":"[QUANTITÉ+UNITÉ]","e":"[1 EMOJI]","c":"[CATÉGORIE]","s":"[stock|pinned|missing]"}],"steps":["[ÉTAPE 1]"]}]`;

  const model = aiConfig.models?.recipeGeneration || AI_ROLES.REASONING;

  // LOT 029, chantier D — la réponse a-t-elle été COUPÉE au plafond ? Google le dit
  // (`finishReason: 'MAX_TOKENS'`), l'app ne le lisait pas. Ce drapeau ne sert QU'À choisir
  // le bon message d'échec : une réponse tronquée et une réponse illisible se réparent de
  // deux façons opposées, et conseiller « réessayez » sur une troncature envoie Joel
  // reproduire la même panne.
  let reponseTronquee = false;

  const rawText = await callAI(prompt, apiKey, model, {
    // Plafond : cf. `MAX_OUTPUT_TOKENS_IA` (SSOT `src/constants.js`), qui porte l'historique
    // des DEUX sous-estimations successives — 8 192 au LOT 026, 16 384 au LOT 029 — et la
    // raison de fond : ce plafond est PARTAGÉ avec les jetons de réflexion.
    maxTokens: MAX_OUTPUT_TOKENS_IA,
    isJSON: false,
    thinkingLevel: 'high',
    safetySettings: RECIPE_SAFETY_SETTINGS,
    onThinkingFallback: options.onThinkingFallback,
    onTruncated: () => { reponseTronquee = true; }
  });

  // LOT 029 — DEUX LECTURES STRICTES AVANT LE SAUVETAGE, chacune passée au CONTRAT DE SORTIE.
  //
  // (1) la réponse telle quelle ; (2) la même, débarrassée de ses balises Markdown — mesuré
  // dans le navigateur de Joel le 2026-08-03 : le modèle enveloppe sa réponse dans un bloc
  // ```json environ UNE FOIS SUR DEUX. Ces réponses sont valides, seules les balises gênent,
  // et elles partaient pourtant au sauvetage d'urgence — un chemin qui ne récolte que les
  // objets ayant un nom ET des ingrédients, et jette le reste EN SILENCE.
  //
  // ⚠️ LE PASSAGE PAR `normaliserRecettes` EST LA PARTIE QUI COMPTE (finding F-01 de l'audit
  // Codex du 2026-08-03, CRITIQUE et justifié). Ma première version rendait directement le
  // résultat de `JSON.parse` : une réponse au JSON parfaitement valide mais dont la racine
  // n'est PAS un tableau (le modèle rend parfois UNE recette seule) traversait alors tout,
  // et l'écran plantait plus loin sur `recipes.map is not a function`. Le sauvetage, lui,
  // normalisait toujours en tableau — j'avais donc introduit une régression en croyant
  // durcir. Le défaut existait DÉJÀ sur la première lecture, hors balises : les deux sont
  // fermées ici, pas seulement celle que j'ai ouverte.
  const cleanStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

  for (const candidat of [rawText.trim(), cleanStr]) {
    let valeur;
    try { valeur = JSON.parse(candidat); } catch { continue; }
    const recettes = normaliserRecettes(valeur);
    if (recettes) return recettes;
  }

  {
    // Sauvetage manuel si le JSON est malformé ou tronqué
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
    // LOT 026, correctif post-essai réel : `throw e` faisait remonter jusqu'au toast le
    // message technique anglais du parseur (« Unexpected token 'e', …"en poudre"… is not
    // valid JSON ») — illisible pour Joel, et disparu avant d'être compris. L'erreur dit
    // désormais en français ce qui s'est passé et quoi faire.
    //
    // LOT 029, chantier D — DEUX PANNES, DEUX MESSAGES. Le message unique conseillait
    // « réessayez » dans TOUS les cas. Sur une troncature, ce conseil est faux : la coupure
    // vient de la longueur demandée, elle se reproduira à l'identique. Le bon geste est de
    // réduire la demande, pas de la relancer.
    if (reponseTronquee) throw new Error(MESSAGE_REPONSE_COUPEE);
    throw new Error('Réponse incomplète ou illisible. Réessayez — une seconde tentative suffit souvent.');
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
   - ÉTAPES : ${REGLE_QUALITE_ETAPES}
     Complète les précisions techniques manquantes selon les règles de l'art, sans JAMAIS
     contredire le texte source.
   - STYLE : Évite les formulations vagues ou marketing.
2. ANALYSE : Analyse TOUS les ingrédients avec leurs QUANTITÉS précises.
3. CATÉGORIES : ${REGLE_CATEGORIES}
4. GUILLEMETS : ${REGLE_GUILLEMETS}
5. RÉPONSE : Réponds UNIQUEMENT avec l'objet JSON suivant, sans texte explicatif :
{"name":"titre","description":"phrase d'accroche","time":"X min","difficulty":"Facile|Moyen|Expert","people":2,"cuisine":"française","ingredients":[{"n":"nom","q":"[QUANTITÉ+UNITÉ]","e":"emoji","c":"catégorie officielle","s":"stock|pinned|missing"}],"steps":["étape détaillée..."]}`;

  const rawText = await callAI(prompt, apiKey, model, {
    // 8192 → 16384 (LOT 026) : même raison que `generateRecipes` — le chantier D allonge
    // les étapes et le plafond est partagé avec la réflexion. Une seule recette ici, mais
    // la coupe en plein vol produirait le même échec, en pire : rien à sauver.
    maxTokens: MAX_OUTPUT_TOKENS_IA,
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
