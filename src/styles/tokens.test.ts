import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Reads the real CSS tokens, so the check cannot drift from what ships. */
const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8');
const tokens: Record<string, string> = {};
for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[match[1]] = match[2];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(tokens[a]), luminance(tokens[b])].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['canvas', 'paper', 'surface-soft'];

describe('colour tokens', () => {
  it('uses the specified base palette', () => {
    expect(tokens).toMatchObject({
      canvas: '#faf9f5',
      paper: '#ffffff',
      ink: '#141413',
      'ink-2': '#5c5b57',
      rule: '#e5e2dc',
      surface: '#e8e6dc',
      terracotta: '#d97757',
      sage: '#788c5d',
    });
  });

  it('body and secondary text meet WCAG AA (4.5:1) on every working surface', () => {
    for (const fg of ['ink', 'ink-2', 'ink-3', 'terracotta-deep', 'sage-deep', 'ochre-deep']) {
      for (const bg of SURFACES) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tinted status backgrounds keep their text readable', () => {
    expect(contrast('terracotta-deep', 'terracotta-wash')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('sage-deep', 'sage-wash')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('ochre-deep', 'ochre-wash')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('ink', 'surface')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('ink-2', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('filled buttons carry light text at AA', () => {
    expect(contrast('paper', 'terracotta-deep')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('canvas', 'ink')).toBeGreaterThanOrEqual(4.5);
  });

  it('the base accent hues are too light for small text, which is why deep variants exist', () => {
    expect(contrast('terracotta', 'paper')).toBeLessThan(4.5);
    expect(contrast('sage', 'paper')).toBeLessThan(4.5);
  });

  it('control borders and chart marks reach 3:1 against the paper', () => {
    expect(contrast('control', 'paper')).toBeGreaterThanOrEqual(3);
    for (const mark of ['chart-focus', 'chart-project', 'chart-skill']) expect(contrast(mark, 'paper')).toBeGreaterThanOrEqual(3);
  });
});
