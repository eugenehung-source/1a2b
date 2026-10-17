// Builds the single-file index.html (CSS and JS inlined) that GitHub Pages
// serves, from the sources in src/. Run: npm run build
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const read = (name) => readFileSync(new URL(name, SRC), 'utf8');

// Only the single-line `import { a, b } from './x.js';` form is used in src/.
const IMPORT = /^import\s+\{[^}]*\}\s+from\s+'\.\/([\w.-]+)';[^\S\n]*\n?/gm;

// Modules in dependency order (dependencies first), starting from the entry.
function collect(name, seen = new Set(), order = []) {
  if (seen.has(name)) return order;
  seen.add(name);
  const code = read(name);
  for (const [, dep] of code.matchAll(IMPORT)) collect(dep, seen, order);
  order.push({ name, code });
  return order;
}

// All modules share one script scope, so top-level names must not clash;
// the build test parses the result to catch that.
function bundle(entry) {
  return collect(entry)
    .map(({ name, code }) => `// ---- ${name} ----\n` + code.replace(IMPORT, '').replace(/^export\s+/gm, ''))
    .join('\n');
}

export function buildSingleFile() {
  const js = bundle('ui.js');
  if (js.includes('</script')) throw new Error('"</script" inside JS would end the inline script early');
  return read('index.html')
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}</style>`)
    .replace('<script type="module" src="ui.js"></script>', () => `<script type="module">\n${js}</script>`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('../index.html', import.meta.url), buildSingleFile());
  console.log('wrote index.html');
}
