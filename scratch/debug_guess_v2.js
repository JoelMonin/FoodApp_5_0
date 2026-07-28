const DEFAULT_DB = [
  { id: 'ing_cf7b9c61', name: 'Agneau (brochettes)', emoji: '🐏', category: 'Protéines', frozen: false },
  { id: 'ing_2a9863eb', name: 'Agneau (côtelettes)', emoji: '🐏', category: 'Protéines', frozen: false },
  { id: 'ing_718d0f06', name: 'Agneau (haché)', emoji: '🐏', category: 'Protéines', frozen: false },
  { id: 'l1', name: 'Ail', emoji: '🧄', category: 'Légumes', frozen: false },
];

function normalizeString(str) {
  if (!str) return '';
  let n = str.toLowerCase().trim();
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(/[.,\#!$%\^&\*;:{}=\-_`~()'"\/]/g, " ");
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

function guessCategoryLocally(name) {
    if (!name) return null;
    const s = normalizeString(name);
    if (!s) return null; // CRITICAL FIX?
    
    const exact = DEFAULT_DB.find(i => normalizeString(i.name) === s);
    if (exact) return { emoji: exact.emoji, category: exact.category };
    
    const partial = DEFAULT_DB.find(i => s.includes(normalizeString(i.name)) || normalizeString(i.name).includes(s));
    if (partial) return { emoji: partial.emoji, category: partial.category };
    return null;
}

console.log('cumin:', guessCategoryLocally('cumin'));
console.log('salsifi:', guessCategoryLocally('salsifi'));
console.log('space:', guessCategoryLocally(' '));
console.log('short a:', guessCategoryLocally('a'));
