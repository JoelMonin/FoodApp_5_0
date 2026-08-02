import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h, toast } from '../src/utils/dom.js';
import { JSDOM } from 'jsdom';

describe('DOM Utility', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.Node = dom.window.Node;
  });

  describe('h (hyperscript)', () => {
    it('should create a simple element', () => {
      const el = h('div', { class: 'test' }, 'Hello');
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('test');
      expect(el.textContent).toBe('Hello');
    });

    it('should NOT interpret HTML in text children (Security Fix)', () => {
      const el = h('div', {}, '<img src=x onerror=alert(1)>');
      expect(el.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
      expect(el.querySelector('img')).toBeNull();
    });

    it('should handle event listeners', () => {
      let clicked = false;
      const el = h('button', { onclick: () => clicked = true });
      el.click();
      expect(clicked).toBe(true);
    });
  });

  // LOT 026 — constat de Joel en essai réel : un message d'ERREUR disparu en 3 s n'a pas
  // le temps d'être lu (« j'ai pas compris et le message a disparu vite »). Les erreurs
  // restent 6 s ; les confirmations gardent leur rythme de 3 s.
  describe('toast — durée d\'affichage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    function toastVisible() {
      const t = document.querySelector('#toast-container .toast');
      return !!t && t.classList.contains('show');
    }

    it('une ERREUR reste affichée à 4 s (elle aurait déjà disparu au rythme normal)', () => {
      toast('Erreur IA : réponse incomplète', 'error');
      vi.advanceTimersByTime(4000);

      expect(toastVisible()).toBe(true);

      vi.advanceTimersByTime(2001);
      expect(toastVisible()).toBe(false);
      vi.useRealTimers();
    });

    it('une confirmation garde son rythme : partie après 3 s', () => {
      toast('Recette structurée !');
      vi.advanceTimersByTime(3001);

      expect(toastVisible()).toBe(false);
      vi.useRealTimers();
    });
  });

});
