import { describe, it, expect, beforeEach } from 'vitest';
import { h, sanitize } from '../src/utils/dom.js';
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

  describe('sanitize', () => {
    it('should escape HTML tags', () => {
      expect(sanitize('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });
  });
});
