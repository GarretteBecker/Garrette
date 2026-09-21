/**
 * Lets plain `node` load this project's TypeScript the way Next does.
 *
 * Two things Node's built-in type stripping does not do on its own:
 * the "@/" path alias from tsconfig, and extensionless imports that
 * resolve to .ts or .tsx. Both are project conventions worth keeping in
 * the source, so the test runner adapts instead of the code.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

function firstThatExists(base) {
  if (existsSync(fileURLToPath(base))) return base.href;
  for (const ext of EXTENSIONS) {
    const candidate = new URL(base.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const hit = firstThatExists(new URL(specifier.slice(2), ROOT));
    if (hit) return { url: hit, shortCircuit: true };
  }

  if (specifier.startsWith('.') && context.parentURL) {
    const hit = firstThatExists(new URL(specifier, context.parentURL));
    if (hit) return { url: hit, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
