/**
 * Crée un élément DOM de manière sécurisée (alternative à innerHTML).
 * @param {string} tag - Le nom de la balise (ex: 'div', 'span')
 * @param {Object} props - Les attributs et événements (ex: { class: 'foo', onclick: fn })
 * @param {Array|string|Node} children - Les enfants (texte ou autres éléments)
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.substring(2).toLowerCase(), value);
    } else if (key === 'class' || key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  const childrenArray = Array.isArray(children) ? children : [children];
  childrenArray.forEach(child => {
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });

  return el;
}


/**
 * Affiche une notification temporaire.
 * @param {string} msg 
 * @param {string} type - 'error', 'success', or ''
 */
export function toast(msg, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = h('div', { id: 'toast-container' });
    document.body.appendChild(container);
  }
  const t = h('div', { class: `toast ${type}` }, msg);
  container.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
