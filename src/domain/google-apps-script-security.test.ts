import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe, expect, it} from 'vitest';

const script = readFileSync(new URL('../../google-apps-script.js', import.meta.url), 'utf8');
const sandbox: Record<string, unknown> = {};
runInNewContext(`${script}\nthis.__escapeSheetCell = escapeSheetCell;`, sandbox);

const escapeSheetCell = sandbox.__escapeSheetCell as (value: unknown) => unknown;

describe('Google Apps Script spreadsheet boundary', () => {
  it.each(['=SUM(A1:A2)', '+1+1', '-2+3', '@command', '\tformula', '\rformula'])(
    'writes formula-like text as a literal: %j',
    (value) => {
      expect(escapeSheetCell(value)).toBe(`'${value}`);
    },
  );

  it('keeps ordinary text and numeric cells unchanged', () => {
    expect(escapeSheetCell('Table 12')).toBe('Table 12');
    expect(escapeSheetCell(12.5)).toBe(12.5);
  });

  it('applies the literal-text boundary to every appended order cell', () => {
    expect(script).toMatch(/sheet\.appendRow\(\[[\s\S]*?\]\.map\(escapeSheetCell\)\);/);
  });
});
