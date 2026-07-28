import { describe, it, expect } from 'vitest';
import { stripAccents, normalizeString, generateId } from '../src/utils/helpers';

describe('Helpers Utility', () => {
  describe('stripAccents', () => {
    it('should remove accents and lowercase', () => {
      expect(stripAccents('Éléphant')).toBe('elephant');
      expect(stripAccents('À la fête')).toBe('a la fete');
    });

    it('should return empty string for null/undefined', () => {
      expect(stripAccents(null)).toBe('');
      expect(stripAccents(undefined)).toBe('');
    });
  });

  describe('normalizeString', () => {
    it('should normalize complex food names', () => {
      expect(normalizeString('Pommes de terre')).toBe('pommedeterre');
      expect(normalizeString('PDT au four')).toBe('pommedeterre au four');
    });

    it('should remove punctuation', () => {
      expect(normalizeString('Lait (entier), 1L.')).toBe('lait entier 1l');
    });

    it('should handle œ character', () => {
      expect(normalizeString('Bœuf')).toBe('boeuf');
    });
  });

  describe('generateId', () => {
    it('should generate a string starting with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_/);
    });

    it('should be reasonably unique', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });
});
