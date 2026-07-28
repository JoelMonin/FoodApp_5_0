import { normalizeString } from './src/utils/helpers.js';
import { DEFAULT_DB } from './src/data.js';

function guessCategoryLocally(name) {
    if (!name) return null;
    const s = normalizeString(name);
    // Exact match
    const exact = DEFAULT_DB.find(i => normalizeString(i.name) === s);
    if (exact) return { emoji: exact.emoji, category: exact.category };
    // Contains match
    const partial = DEFAULT_DB.find(i => s.includes(normalizeString(i.name)) || normalizeString(i.name).includes(s));
    if (partial) return { emoji: partial.emoji, category: partial.category };
    return null;
}

console.log('cumin:', guessCategoryLocally('cumin'));
console.log('salsifi:', guessCategoryLocally('salsifi'));
console.log('glace:', guessCategoryLocally('glace'));
console.log('tarte au sucre:', guessCategoryLocally('tarte au sucre'));
console.log('empty:', guessCategoryLocally(''));
console.log('space:', guessCategoryLocally(' '));
