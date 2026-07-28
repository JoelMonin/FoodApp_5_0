import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncPush, syncPull } from '../src/services/firebase';
import { FB_URL, FB_USER } from '../src/constants';

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

      // Check fetch call
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(FB_URL),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"apiKey":""') // Verify stripping
        })
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(FB_URL),
        expect.not.objectContaining({
          body: expect.stringContaining('SECRET_KEY') // Double check
        })
      );
      
      expect(result.lastSync).toBeDefined();
    });

    it('should throw error on fetch failure', async () => {
      fetch.mockResolvedValue({ ok: false, statusText: 'Unauthorized' });
      await expect(syncPush({})).rejects.toThrow('Erreur Firebase Push');
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
      fetch.mockResolvedValue({ ok: false, statusText: 'Not Found' });
      await expect(syncPull()).rejects.toThrow('Erreur Firebase Pull');
    });
  });
});
