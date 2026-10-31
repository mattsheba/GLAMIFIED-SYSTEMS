#!/usr/bin/env node
/** Generates assets/config.js from data/shop.json so the browser and the
 *  Netlify functions never drift apart on brand, contact or store details. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shop = JSON.parse(readFileSync(join(root, 'data', 'shop.json'), 'utf8'));
const out = `/* GENERATED FILE — edit data/shop.json then run: npm run build:config */
window.SHOP_CONFIG = ${JSON.stringify(shop, null, 2)};
`;
writeFileSync(join(root, 'assets', 'config.js'), out);
console.log('wrote assets/config.js');
