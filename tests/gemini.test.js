import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callAI, generateRecipes, transformRecipeFromText } from '../src/services/gemini.js';
import { defaultAiConfig } from '../src/state.js';
import { CATEGORIES } from '../src/data.js';

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

    it('restaure la consigne des guillemets simples (anti-JSON cassé)', async () => {
      await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

      expect(fetch.mock.calls[0][1].body).toContain('guillemets simples');
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
