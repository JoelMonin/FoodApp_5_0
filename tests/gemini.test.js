import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callAI } from '../src/services/gemini';

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
});
