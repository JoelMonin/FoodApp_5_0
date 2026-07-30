import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callAI, generateRecipes } from '../src/services/gemini';
import { defaultAiConfig } from '../src/state.js';

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

    it('should use non-greedy matching for JSON blocks', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Bla { "a": 1 } blo { "b": 2 }' }] } }]
        })
      });

      const response = await callAI('Get JSON', 'MOCK_KEY', 'gemini-test', { isJSON: true });
      expect(response).toBe('{ "a": 1 }');
    });

    it('should throw error on API failure', async () => {
      fetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: { message: 'Invalid Key' } })
      });

      await expect(callAI('Hi', 'WRONG_KEY')).rejects.toThrow('Invalid Key');
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
});
