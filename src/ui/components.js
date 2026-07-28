import { h } from '../utils/dom.js';

export function Badge(icon, className = '') {
  return h('span', { class: `ing-top-badge ${className}` }, icon);
}

export function ActionButton(icon, onClick, className = '', title = '') {
  return h('button', {
    class: `ing-btn ${className}`,
    onclick: (e) => {
      e.stopPropagation();
      onClick(e);
    },
    title
  }, icon);
}

export function SectionLabel(text) {
  return h('div', { class: 'section-label' }, text);
}
