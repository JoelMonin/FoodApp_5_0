import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncPush, syncPull } from '../src/services/firebase';
import { FB_URL } from '../src/constants';

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('syncPush', () => {
    it('should push state and strip API key', async () => {
      const mockState = {
        ingredients: [],
        aiConfig: { apiKey: 'SECRET_KEY' }
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'success' })
      });

      const result = await syncPush(mockState);

      // Depuis le LOT 007 (périmètre §4.1), la clé API n'est plus blanchie mais
      // carrément ABSENTE du document envoyé.
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(FB_URL),
        expect.objectContaining({ method: 'PUT' })
      );
      const sentBody = fetch.mock.calls[0][1].body;
      expect(sentBody).not.toContain('apiKey');
      expect(sentBody).not.toContain('SECRET_KEY');

      // syncPush retourne désormais le document effectivement envoyé — lastSync
      // est une métadonnée locale, jamais dans le document ni le retour (§4.1).
      expect(result).not.toHaveProperty('lastSync');
      expect(result).toHaveProperty('ingredients');
    });

    it('should throw error on fetch failure', async () => {
      fetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
      await expect(syncPush({})).rejects.toThrow('Erreur Firebase Push');
    });

    it('expose le code HTTP sur l\'erreur (le moteur distingue 4xx de 5xx, §4.9)', async () => {
      fetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
      await expect(syncPush({})).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('syncPull', () => {
    it('should pull data correctly', async () => {
      const mockData = { ingredients: [{ id: '1', name: 'Milk' }] };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const result = await syncPull();
      expect(result).toEqual(mockData);
    });

    it('should throw error on pull failure', async () => {
      fetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(syncPull()).rejects.toThrow('Erreur Firebase Pull');
    });

    it('base vide (null) → retourne null sans erreur (§6.1)', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });
      await expect(syncPull()).resolves.toBeNull();
    });

    it('rejet réseau de fetch → erreur remontée, aucune exception non gérée (§6.1)', async () => {
      fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(syncPull()).rejects.toThrow('Failed to fetch');
    });

    it('expiration du délai (15 s) → la requête est interrompue et traitée comme un échec (§4.7)', async () => {
      vi.useFakeTimers();
      try {
        // fetch qui ne répond JAMAIS, mais honore le signal d'interruption —
        // avant le LOT 007, une telle requête bloquait indéfiniment (F9).
        fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')));
        }));

        const pending = syncPull();
        const expectation = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        await vi.advanceTimersByTimeAsync(15000);
        await expectation;
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
