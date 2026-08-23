import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { callAI, generateRecipes, transformRecipeFromText } from '../src/services/gemini.js';
import { defaultAiConfig } from '../src/state.js';
import { CATEGORIES } from '../src/data.js';
import { MAX_OUTPUT_TOKENS_IA } from '../src/constants.js';

describe('Gemini Service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('callAI', () => {
    it('should call Gemini API with correct format', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"result": "ok"}' }] } }]
        })
      });

      const response = await callAI('Hello', 'MOCK_KEY', 'gemini-test', { isJSON: true });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-test'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello')
        })
      );
      expect(response).toBe('{"result": "ok"}');
    });

    it('should extract JSON from markdown blocks', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Voici le JSON : ```json\n{"data": 123}\n```' }] } }]
        })
      });

      const response = await callAI('Get JSON', 'MOCK_KEY', 'gemini-test', { isJSON: true });
      expect(response).toBe('{"data": 123}');
    });

    it('sur plusieurs blocs, retient le PREMIER (titre corrigé au LOT 014 : il annonçait un '
       + '« motif non gourmand », c\'est-à-dire le MOYEN — et un moyen qui coupait les objets '
       + 'imbriqués. La règle voulue, elle, n\'a pas changé : le premier bloc)', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Bla { "a": 1 } blo { "b": 2 }' }] } }]
        })
      });

      const response = await callAI('Get JSON', 'MOCK_KEY', 'gemini-test', { isJSON: true });
      expect(response).toBe('{ "a": 1 }');
    });

    it('LOT 014 — ne coupe plus un objet IMBRIQUÉ en deux (le contrat reste une CHAÎNE, '
       + 'ce sont les appelants qui la parsent)', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Voici : {"score":"A","detail":{"kcal":420}} .' }] } }]
        })
      });

      const response = await callAI('Get JSON', 'MOCK_KEY', 'gemini-test', { isJSON: true });
      expect(response).toBe('{"score":"A","detail":{"kcal":420}}');
      expect(JSON.parse(response)).toEqual({ score: 'A', detail: { kcal: 420 } });
    });

    it('rend le texte brut quand il n\'y a aucun JSON à découper (repli inchangé)', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '  Désolé, je ne peux pas.  ' }] } }]
        })
      });

      const response = await callAI('Get JSON', 'MOCK_KEY', 'gemini-test', { isJSON: true });
      expect(response).toBe('Désolé, je ne peux pas.');
    });

    it('should throw error on API failure', async () => {
      fetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: { message: 'Invalid Key' } })
      });

      await expect(callAI('Hi', 'WRONG_KEY')).rejects.toThrow('Invalid Key');
    });

    // LOT 013 — 3 réponses "réussies" côté HTTP (ok:true) mais dégradées côté contenu :
    // aucune des 3 n'était testée avant ce lot. Les 3 mènent au MÊME comportement
    // (`src/services/gemini.js:102-103` : un seul `throw`), donc 3 preuves pour 1 garde.
    it('should throw "Réponse vide de l\'IA" when candidates is missing entirely', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await expect(callAI('Hi', 'KEY')).rejects.toThrow("Réponse vide de l'IA");
    });

    it('should throw "Réponse vide de l\'IA" when parts is an empty array', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [] } }] })
      });
      await expect(callAI('Hi', 'KEY')).rejects.toThrow("Réponse vide de l'IA");
    });

    it('should throw "Réponse vide de l\'IA" when text is missing from parts', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{}] } }] })
      });
      await expect(callAI('Hi', 'KEY')).rejects.toThrow("Réponse vide de l'IA");
    });
  });

  // LOT 010 (casse C12) — Joel a constaté en usage réel des quantités sans unité
  // ("(200)" au lieu de "(200 g)") et des emojis d'ingrédient remplacés par du texte
  // ("g", "pièce", "ml"). Cause racine : le prompt modulaire avait perdu les
  // indications de format que l'oracle donnait explicitement à l'IA
  // (`foodapp-v5-Joel.html` l.5214 : "q":"[QUANTITÉ+UNITÉ]", "e":"[1 EMOJI]"). Ces
  // tests figent leur présence pour empêcher toute régression silencieuse future.
  describe('generateRecipes — fidélité du schéma d\'ingrédients (LOT 010)', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[]' }] } }]
        })
      });
    });

    it('demande explicitement QUANTITÉ+UNITÉ ensemble dans le champ "q"', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('[QUANTITÉ+UNITÉ]');
    });

    it('demande explicitement UN SEUL EMOJI dans le champ "e", pas du texte', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('[1 EMOJI]');
    });

    it('interdit explicitement les quantités vides', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = fetch.mock.calls[0][1].body;
      expect(body.toLowerCase()).toContain('jamais vide');
    });
  });

  // LOT 011, chantier 3 — le prompt de generateRecipes est une FUSION assumée (fiche
  // LOT 011 §10-B) : structure et contraintes de l'oracle (foodapp-v5-Joel.html
  // l.5186-5233), mais les formulations figées ci-dessus (LOT 010) priment sur le texte
  // de l'oracle partout où les deux divergent — elles corrigent un bug réel constaté par
  // Joel en usage réel, l'oracle ne les corrige pas.
  describe('generateRecipes — protections re-blindées (LOT 011)', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[]' }] } }]
        })
      });
    });

    it('restaure la RÈGLE D\'OR (les ingrédients imposés priment sur le régime)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      expect(fetch.mock.calls[0][1].body).toContain("RÈGLE D'OR");
    });

    // LOT 029 — CETTE CONSIGNE A ÉTÉ RETOURNÉE, APRÈS AVOIR CAUSÉ LA PANNE QU'ELLE DEVAIT
    // ÉVITER. Elle disait « Utilise UNIQUEMENT des guillemets simples dans les textes » : la
    // phrase voulait dire « pas de guillemet double DANS LE CONTENU », mais le modèle la
    // comprenait par moments comme « délimite tes chaînes avec des guillemets simples » — et
    // rendait alors {"name": 'Crêpes'}, du JSON INVALIDE. Observé sur pièce dans le navigateur
    // de Joel le 2026-08-03 : 1 génération sur 4, réponse pourtant COMPLÈTE (motif STOP).
    // D'où le caractère intermittent, et l'échec de mon premier diagnostic (troncature).
    // Le message doit désormais exiger explicitement le guillemet DOUBLE comme délimiteur.
    it('exige le guillemet DOUBLE comme délimiteur de chaîne (anti-JSON cassé)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const corps = fetch.mock.calls[0][1].body;
      expect(corps).toContain('guillemets doubles');
      // La contre-épreuve : l'ancienne formulation, celle qui produisait le défaut, ne doit
      // plus jamais réapparaître dans le message.
      expect(corps).not.toContain('UNIQUEMENT des guillemets simples');
    });

    // LOT 025, correctif P2 — DÉFAUT VU SUR PIÈCE par Joel le 2026-08-02, capture à l'appui :
    // « Tajine d agneau aux pruneaux », « l oignon », « l huile d olive », « d amandes ».
    // Le titre lui-même était amputé. La consigne anti-guillemets-doubles (rédigée pour
    // protéger la lecture du JSON) était comprise par l'IA comme une interdiction du
    // caractère `'` — or en français c'est l'apostrophe. La protection JSON est CONSERVÉE
    // telle quelle (test ci-dessus), on ne fait qu'exclure explicitement l'apostrophe
    // interne aux mots. Vérifié : aucun code du projet ne retire ces apostrophes, la cause
    // était bien dans le message envoyé.
    it('P2 — exige explicitement l\'apostrophe à l\'intérieur des mots', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('apostrophe');
      expect(body).toContain("l'eau");
    });
  });

  // LOT 026 — les décisions de Joel du 2026-08-02 après l'audit des prompts (fiche du lot,
  // §1). Chaque test verrouille UN chantier ; le chantier B (retrait du 🎲) n'a pas de test
  // ici — sa preuve est l'absence : `tests/ai-random-mode.test.js` supprimé avec lui.
  describe('generateRecipes — améliorations du LOT 026', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[]' }] } }]
        })
      });
    });

    // Chantier A — l'IA devait DEVINER les catégories : le squelette exigeait
    // `"c":"[CATÉGORIE]"` sans jamais donner la liste, qui n'était injectée que dans le
    // prompt de la recette collée. Les noms inventés finissaient en « Autres » — articles
    // mal rangés dans la liste de courses.
    it('A — donne la liste EXACTE des catégories officielles (SSOT CATEGORIES)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      expect(fetch.mock.calls[0][1].body).toContain(CATEGORIES.join(', '));
    });

    // Chantier C — anti-répétition en SÉRIE seulement (décision de Joel).
    it('C — les noms récents partent avec l\'interdiction de les reproposer', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [], {
        recentNames: ['Risotto aux champignons', 'Quiche lorraine']
      });

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('DÉJÀ PROPOSÉES RÉCEMMENT');
      expect(body).toContain('Risotto aux champignons, Quiche lorraine');
      expect(body).toContain('AUCUNE');
    });

    it('C — mémoire vide : AUCUNE ligne anti-répétition (pas un jeton pour rien, ' +
       'et la première génération d\'une session reste identique à avant)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      expect(fetch.mock.calls[0][1].body).not.toContain('DÉJÀ PROPOSÉES');
    });

    // Chantier D — « la meilleure qualité tout le temps » (consigne de Joel) : des étapes
    // qu'on peut suivre sans rien deviner.
    it('D — exige des étapes autosuffisantes (durées, températures, repère de réussite)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('AUTOSUFFISANTE');
      expect(body).toContain('rien deviner');
    });

    // CORRECTIF POST-ESSAI RÉEL (Joel, 2026-08-02) : avec le chantier D, la réponse coupait
    // au milieu du JSON (« Unexpected token 'e', …"en poudre"… ») — le plafond de sortie,
    // PARTAGÉ avec les jetons de réflexion, était resté à 8192 pendant que l'exigence
    // d'étapes détaillées allongeait 5 recettes. Le plafond suit désormais l'exigence.
    // LOT 029 — CE TEST A ROUGI, ET C'ÉTAIT SON TRAVAIL : il figeait `16384` au chiffre près,
    // et le chantier D a relevé le plafond. ⚠️ Ce relèvement est une PRÉVENTION : contrairement
    // à celui du LOT 026, il ne répare aucune panne observée — la panne de Joel du 2026-08-03
    // n'était pas une troncature (cf. `tests/json-reponse-ia.test.js`). Réécrit sur la SSOT,
    // ce test vérifie ce qui compte — que le service n'invente pas son propre plafond — et
    // survivra au prochain relèvement. La vérification qui MORD vraiment (aucun nombre écrit
    // en dur dans le service) vit dans `tests/reponse-tronquee.test.js`.
    it('le plafond de sortie vient de la SSOT, jamais d\'un nombre écrit dans le service', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.generationConfig.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_IA);
    });

    it('correctif — une réponse tronquée IRRÉCUPÉRABLE lève une erreur en FRANÇAIS, plus le ' +
       'message technique anglais du parseur', async () => {
      // Coupée au milieu de la PREMIÈRE recette : le sauvetage ne trouve aucun objet complet.
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[{"name":"Tarte","ingredients":[{"n":"Sucre en pou' }] } }]
        })
      });

      await expect(generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []))
        .rejects.toThrow('Réponse incomplète ou illisible');
    });
  });

  // Suite des protections re-blindées (LOT 011) — describe rouvert après l'insertion du
  // bloc LOT 026 ci-dessus, avec le MÊME socle de mock qu'avant.
  describe('generateRecipes — protections re-blindées (LOT 011), suite', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[]' }] } }]
        })
      });
    });

    it('restaure le filtre de sécurité BLOCK_NONE sur les 4 catégories', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.safetySettings).toEqual([
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]);
    });

    it('demande un niveau d\'effort de réflexion élevé (thinkingLevel, pas thinkingBudget — Gemini 3.x)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('high');
      expect(body.generationConfig.thinkingBudget).toBeUndefined();
    });

    it('n\'envoie plus topK/topP/temperature comme leviers de créativité (dépréciés et ignorés par ' +
       'Gemini 3.x — trouvé lors de l\'audit du sous-lot 11A : ce test ne vérifiait que topK/topP, ' +
       'pas temperature, alors que son titre le prétendait)', async () => {
      await generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), creativity: 95 }, [], []);

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.generationConfig.temperature).toBeUndefined();
      expect(body.generationConfig.topK).toBeUndefined();
      expect(body.generationConfig.topP).toBeUndefined();
    });

    it.each([
      [10, 'CLASSIQUE'],
      [50, 'ÉQUILIBRE'],
      [95, 'TRÈS CRÉATIF']
    ])('créativité %i -> consigne textuelle contenant « %s » (arbitrage Joel §12-A2 : la ' +
      'créativité agit désormais par une phrase, plus par un réglage technique ignoré)',
      async (creativity, motAttendu) => {
        await generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), creativity }, [], []);

        expect(fetch.mock.calls[0][1].body).toContain(motAttendu);
      });

    it('le sauvetage de JSON tronqué exige des ingrédients — un objet avec SEULEMENT des ' +
       'étapes est rejeté (trouvé par l\'audit du sous-lot 11B : accepté avant, il n\'avait ' +
       'rien à montrer ni dans les ingrédients ni, en aval, dans le détail rendu)', async () => {
      const brut = 'Voici : {"name":"Recette A","ingredients":[{"n":"Pomme"}],"steps":["Étape"]} ' +
        'puis {"name":"Recette B","steps":["Étape seule, sans ingrédients"]}';
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: brut }] } }] })
      });

      const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      expect(recettes).toHaveLength(1);
      expect(recettes[0].name).toBe('Recette A');
    });

    it('le sauvetage de JSON tronqué accepte une recette avec ingrédients mais SANS étapes ' +
       '(une troncature peut couper juste avant les étapes sans invalider le reste — c\'est ' +
       'au rendu, pas ici, de rester robuste à leur absence)', async () => {
      const brut = 'Voici : {"name":"Recette tronquée","ingredients":[{"n":"Pomme"}]}';
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: brut }] } }] })
      });

      const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      expect(recettes).toHaveLength(1);
      expect(recettes[0].name).toBe('Recette tronquée');
    });

    it('si l\'API rejette le niveau d\'effort (400), rejoue sans lui et prévient l\'appelant ' +
       '(demande explicite de Joel : jamais silencieux)', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            error: { message: 'Invalid JSON payload received. Unknown name "thinkingConfig"' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
        });
      const onThinkingFallback = vi.fn();

      const recipes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [], { onThinkingFallback });

      expect(recipes).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(onThinkingFallback).toHaveBeenCalledTimes(1);
      const secondBody = JSON.parse(fetch.mock.calls[1][1].body);
      expect(secondBody.generationConfig.thinkingConfig).toBeUndefined();
    });

    it('un 400 pour une autre raison n\'est PAS rejoué : l\'erreur remonte telle quelle', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: 'API key not valid' } })
      });
      const onThinkingFallback = vi.fn();

      await expect(
        generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [], { onThinkingFallback })
      ).rejects.toThrow('API key not valid');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(onThinkingFallback).not.toHaveBeenCalled();
    });

    it('si le second essai (sans thinkingLevel) échoue aussi, l\'erreur remonte proprement ' +
       'et aucun toast de repli réussi n\'est déclenché (comportement déjà correct, figé par ' +
       'l\'audit du sous-lot 11A)', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: { message: 'Unknown name "thinkingConfig"' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Internal error' } })
        });
      const onThinkingFallback = vi.fn();

      await expect(
        generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [], { onThinkingFallback })
      ).rejects.toThrow('Internal error');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(onThinkingFallback).not.toHaveBeenCalled();
    });

    it('reconnaît aussi le rejet sous forme snake_case/kebab-case/espacée (durcissement, ' +
       'audit du sous-lot 11A)', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: { message: 'Unknown field: thinking_level' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
        });
      const onThinkingFallback = vi.fn();

      const recipes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [], { onThinkingFallback });

      expect(recipes).toEqual([]);
      expect(onThinkingFallback).toHaveBeenCalledTimes(1);
    });
  });

  // LOT 011, chantier 3 — transformRecipeFromText (nom oracle exact : `transformRecipeAI`,
  // l.5976-6015) recevait seulement le texte collé : ni le titre saisi, ni l'inventaire, ni
  // les catégories officielles n'atteignaient l'IA. Nouvelle signature (fiche LOT 011 §10-H).
  describe('transformRecipeFromText — contrat restauré (LOT 011)', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"name":"Test"}' }] } }]
        })
      });
    });

    // LOT 025, volet 0 — ANGLE MORT COMBLÉ. Les six tests ci-dessous inspectent tous le
    // corps HTTP, mais AUCUN ne vérifiait que le paramètre le plus important — le texte
    // collé par Joel — y arrivait. On pouvait supprimer entièrement le contenu du message
    // envoyé à l'IA sans faire rougir un seul test. Ce trou devait être bouché AVANT de
    // toucher au nettoyage de la page (volet B), sinon la preuve du volet B aurait été vide.
    it('envoie réellement le texte collé dans le corps de la requête (volet 0)', async () => {
      await transformRecipeFromText('', 'Zébrez la chair des aubergines au couteau', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body).toContain('Zébrez la chair des aubergines au couteau');
    });

    // LOT 025, correctif P2 — le MÊME défaut vivait dans les DEUX prompts, avec la même
    // formulation. Ne corriger que celui-ci aurait laissé l'écran « Recettes IA » manger
    // ses apostrophes : un défaut ne se corrige pas sur l'écran où on l'a vu, mais partout
    // où sa cause est recopiée.
    it('P2 — exige explicitement l\'apostrophe à l\'intérieur des mots', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('apostrophe');
      expect(body).toContain("l'eau");
    });

    // LOT 026, chantier D — la même exigence de qualité que la génération, PLUS la garde
    // de fidélité : la recette collée a un texte source, la génération n'en a pas. Leçon
    // du volet C du LOT 025 (rapport de fidélité) : c'est l'écart au source qui est le
    // vrai grief, pas le manque de détail.
    it('D — porte la MÊME exigence de qualité d\'étapes que la génération', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('AUTOSUFFISANTE');
      expect(body).toContain('rien deviner');
    });

    it('D — garde de fidélité : complète les manques sans JAMAIS contredire le texte source', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body).toContain('contredire le texte source');
    });
  });

  // LOT 026, chantier E — SSOT des consignes communes. P2 a payé le prix de la duplication
  // (deux corrections pour un défaut) ; ces tests verrouillent que les règles partagées
  // apparaissent À L'IDENTIQUE dans les deux messages. Si un prompt « redivergeait » (sa
  // formulation réécrite localement), le fragment canonique disparaîtrait de son corps.
  describe('SSOT des consignes communes aux deux prompts (LOT 026)', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[]' }] } }]
        })
      });
    });

    async function lesDeuxCorps() {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');
      return [fetch.mock.calls[0][1].body, fetch.mock.calls[1][1].body];
    }

    it('la règle des guillemets/apostrophes est IDENTIQUE dans les deux messages', async () => {
      const [gen, transfo] = await lesDeuxCorps();

      // LOT 029 — phrase canonique mise à jour avec la consigne retournée (cf. le test
      // « exige le guillemet DOUBLE » plus haut). Ce test-ci ne juge pas la formulation : il
      // vérifie que les DEUX messages portent EXACTEMENT la même, ce qui reste son seul rôle.
      const canon = 'les délimiteurs de chaîne sont OBLIGATOIREMENT des';
      const canonP2 = "l'apostrophe À L'INTÉRIEUR DES MOTS reste OBLIGATOIRE : écris « l'eau »,";
      for (const corps of [gen, transfo]) {
        expect(corps).toContain(canon);
        expect(corps).toContain(canonP2);
      }
    });

    it('la liste des catégories est IDENTIQUE dans les deux messages', async () => {
      const [gen, transfo] = await lesDeuxCorps();

      const canon = `Utilise uniquement ${CATEGORIES.join(', ')}.`;
      expect(gen).toContain(canon);
      expect(transfo).toContain(canon);
    });

    it('la règle de qualité des étapes est IDENTIQUE dans les deux messages', async () => {
      const [gen, transfo] = await lesDeuxCorps();

      const canon = 'Chaque étape est AUTOSUFFISANTE : indique les durées, les températures et le niveau de feu';
      expect(gen).toContain(canon);
      expect(transfo).toContain(canon);
    });

    // FINDING 1 DE L'AUDIT CODEX DU DIFF FINAL (2026-08-02), contre-vérifié et CONFIRMÉ :
    // les trois tests ci-dessus comparent les MESSAGES envoyés — si un prompt recopiait
    // LOCALEMENT une règle à l'identique, ils resteraient verts. Contenu commun prouvé,
    // SSOT non prouvée. Ce verrou-ci regarde donc le CODE SOURCE, sur le modèle du verrou
    // `api-key-message-ssot` (LOT 014) : chaque règle partagée ne s'écrit qu'UNE fois dans
    // le code de production (sa constante), et une copie — même parfaitement identique —
    // fait rougir ce test. Le `toBe(1)` sert aussi de garde anti-vide : une constante
    // renommée ou supprimée ferait tomber le compte à 0.
    it('verrou de SOURCE — chaque règle partagée ne s\'écrit qu\'UNE fois dans le code de production', () => {
      const RACINE = process.cwd();
      const fichiers = [];
      (function collecter(dossier) {
        for (const entree of readdirSync(dossier, { withFileTypes: true })) {
          const chemin = join(dossier, entree.name);
          if (entree.isDirectory()) collecter(chemin);
          else if (entree.name.endsWith('.js')) fichiers.push(chemin);
        }
      })(resolve(RACINE, 'src'));
      fichiers.push(resolve(RACINE, 'js', 'app.js'));
      const sources = fichiers.map(f => readFileSync(f, 'utf8')).join('\n');

      const fragments = [
        "apostrophe À L'INTÉRIEUR DES MOTS",       // REGLE_GUILLEMETS (partie P2)
        'Chaque étape est AUTOSUFFISANTE',          // REGLE_QUALITE_ETAPES
        'Utilise uniquement ${CATEGORIES.join('    // REGLE_CATEGORIES (texte SOURCE, avant interpolation)
      ];
      for (const fragment of fragments) {
        const occurrences = sources.split(fragment).length - 1;
        expect(occurrences, `« ${fragment} » doit exister en UN exemplaire (sa constante SSOT) — trouvé ${occurrences} fois`).toBe(1);
      }
    });
  });

  // Suite du contrat de transformRecipeFromText (LOT 011) — describe rouvert après
  // l'insertion du bloc SSOT du LOT 026 ci-dessus, avec le MÊME socle de mock qu'avant.
  describe('transformRecipeFromText — contrat restauré (LOT 011), suite', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"name":"Test"}' }] } }]
        })
      });
    });

    it('injecte l\'inventaire en stock dans le prompt', async () => {
      await transformRecipeFromText('', 'du texte', [{ name: 'Tomate' }, { name: 'Basilic' }], 'MOCK_KEY');

      const body = fetch.mock.calls[0][1].body;
      expect(body).toContain('Tomate');
      expect(body).toContain('Basilic');
    });

    it('contraint aux catégories officielles (SSOT `CATEGORIES`)', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body).toContain(CATEGORIES[0]);
    });

    it('utilise le titre saisi par l\'utilisateur quand il existe', async () => {
      await transformRecipeFromText('Ma recette de mamie', 'du texte', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body).toContain('Ma recette de mamie');
    });

    it('retombe sur « Sans titre » quand le titre est vide', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body).toContain('Sans titre');
    });

    it('demande de respecter le nombre de personnes du texte source (ajout hors oracle ' +
       'validé par Joel, fiche LOT 011 §9 Q1)', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body.toLowerCase()).toContain('nombre de personnes');
    });

    it('restaure le champ "s" (stock|pinned|missing), absent de la version appauvrie', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      expect(fetch.mock.calls[0][1].body).toContain('stock|pinned|missing');
    });

    it('utilise le même niveau d\'effort élevé que la génération de recettes', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('high');
    });

    // LOT 029 — même réécriture que pour la génération (cf. son jumeau plus haut) : la
    // recette collée partage la MÊME SSOT de plafond, et doit continuer à la suivre.
    it('le plafond de sortie vient de la SSOT ici aussi — les deux prompts la partagent', async () => {
      await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.generationConfig.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_IA);
    });

    // LOT 014 — cette fonction portait la BONNE méthode (essayer de lire la réponse telle
    // quelle avant d'aller la chercher dans le texte) ; c'est elle qui a été généralisée aux
    // quatre appelants. Ces tests figent ce qu'elle sait lire, et ce qu'elle doit refuser.
    it('lit une recette imbriquée sans la couper (le repli précédent s\'arrêtait au premier '
       + '« } » : une recette avec un sous-objet était perdue)', async () => {
      const brut = 'Voici : {"name":"Tarte","meta":{"src":"blog"},"ingredients":[{"n":"Pomme"}]} — bon appétit.';
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: brut }] } }] })
      });

      const recette = await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY');

      expect(recette).toEqual({ name: 'Tarte', meta: { src: 'blog' }, ingredients: [{ n: 'Pomme' }] });
    });

    it('lit aussi une recette encadrée par un bloc Markdown', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '```json\n{"name":"Tarte"}\n```' }] } }]
        })
      });

      expect(await transformRecipeFromText('', 'du texte', [], 'MOCK_KEY')).toEqual({ name: 'Tarte' });
    });

    it('lève franchement quand la réponse ne contient aucun JSON exploitable — l\'appelant '
       + 'affiche « Erreur transformation IA » et le texte de Joel reste intact', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Désolé, je ne comprends pas cette recette.' }] } }]
        })
      });

      await expect(transformRecipeFromText('', 'du texte', [], 'MOCK_KEY'))
        .rejects.toThrow('Réponse IA illisible');
    });
  });
});
