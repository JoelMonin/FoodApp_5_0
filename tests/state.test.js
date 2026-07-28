/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, loadState, saveState, sanitizeGlobalState } from '../src/state';
import { LOCAL_STORAGE_KEY } from '../src/constants';

describe('State Management', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
        clear: vi.fn(() => { store = {}; })
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Reset state before each test
    state.ingredients = [];
  });

  it('should sanitize ingredients correctly', () => {
    state.ingredients = [{ n: 'Pomme', inStock: 1 }]; // Old format
    sanitizeGlobalState();
    expect(state.ingredients[0].name).toBe('Pomme');
    expect(state.ingredients[0].inStock).toBe(true);
    expect(state.ingredients[0].category).toBe('Autres');
  });

  it('should load state from localStorage', () => {
    const mockData = { ingredients: [{ id: '1', name: 'Test' }] };
    window.localStorage.getItem.mockReturnValue(JSON.stringify(mockData));
    
    loadState();
    
    expect(state.ingredients.length).toBe(1);
    expect(state.ingredients[0].name).toBe('Test');
  });

  it('should save state to localStorage', () => {
    state.ingredients = [{ id: '2', name: 'Save Test' }];
    saveState(false);
    
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      LOCAL_STORAGE_KEY,
      expect.stringContaining('Save Test')
    );
  });
});
