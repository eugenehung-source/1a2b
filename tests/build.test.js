import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSingleFile } from '../scripts/build.mjs';

describe('buildSingleFile', () => {
  const html = buildSingleFile();

  it('inlines the stylesheet instead of linking it', () => {
    expect(html).toContain('<title>1A2B 每日猜數字</title>');
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    const css = readFileSync('src/style.css', 'utf8');
    expect(html).toContain(`<style>\n${css}</style>`);
  });

  const inlineScript = () => {
    const m = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
    return m ? m[1] : null;
  };

  it('inlines every module into one script with no import/export left', () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    const js = inlineScript();
    expect(js).not.toBeNull();
    expect(js).not.toMatch(/^\s*(import|export)\b/m);
  });

  it('produces a script that parses (no clashing names between modules)', () => {
    const js = inlineScript();
    expect(js).toContain('function score(');
    expect(() => new Function(js)).not.toThrow();
  });

  it('matches the committed index.html (run `npm run build` after editing src/)', () => {
    const committed = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
    expect(committed).toBe(html.replace(/\r\n/g, '\n'));
  });
});
