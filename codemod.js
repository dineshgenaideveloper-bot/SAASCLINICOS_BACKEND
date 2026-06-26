// codemod.js — converts a fixed list of ESM files to CommonJS
const fs = require('fs');
const path = require('path');

const files = [
  'config/tenantDb.js',
  'controllers/tenant/staffAttendanceController.js',
  'controllers/tenant/staffAttendanceRegularizationController.js',
  'controllers/tenant/staffAttendanceShared.js',
  'controllers/tenant/staffPayslipController.js',
  'models/tenant/StaffAttendance.js',
  'models/tenant/StaffAttendanceConfig.js',
  'models/tenant/StaffAttendanceRegularization.js',
  'routes/tenant/staffAttendanceRoutes.js',
  'routes/tenant/staffPayslipRoutes.js',
];

function convert(src) {
  const lines = src.split('\n');
  const out = [];
  const namedExports = [];
  let hasDefaultExport = false;
  let defaultExportInline = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Strip the createRequire shim lines entirely
    if (/createRequire\s*\(\s*import\.meta\.url\s*\)/.test(line)) continue;
    if (/^import\s+\{\s*createRequire\s*\}\s+from\s+['"]module['"];?\s*$/.test(line)) continue;

    // import defaultName from 'x'
    let m = line.match(/^import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?\s*$/);
    if (m) { out.push(`const ${m[1]} = require('${m[2]}');`); continue; }

    // import { a, b as c } from 'x'  (single-line)
    m = line.match(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/);
    if (m) {
      const names = m[1].replace(/\s+as\s+/g, ': ').trim();
      out.push(`const { ${names} } = require('${m[2]}');`);
      continue;
    }

    // import defaultName, { a, b } from 'x'
    m = line.match(/^import\s+([A-Za-z0-9_$]+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/);
    if (m) {
      const names = m[2].replace(/\s+as\s+/g, ': ').trim();
      out.push(`const ${m[1]} = require('${m[3]}');`);
      out.push(`const { ${names} } = require('${m[3]}');`);
      continue;
    }

    // import * as ns from 'x'
    m = line.match(/^import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?\s*$/);
    if (m) { out.push(`const ${m[1]} = require('${m[2]}');`); continue; }

    // bare side-effect import 'x'
    m = line.match(/^import\s+['"]([^'"]+)['"];?\s*$/);
    if (m) { out.push(`require('${m[1]}');`); continue; }

    // export default <expression>  (capture name if it's an identifier)
    m = line.match(/^export\s+default\s+(.*)$/);
    if (m) {
      hasDefaultExport = true;
      defaultExportInline = m[1].replace(/;?\s*$/, '');
      out.push(`module.exports = ${defaultExportInline}`.replace(/;?$/, ';'));
      continue;
    }

    // export const/let/var NAME
    m = line.match(/^export\s+(const|let|var)\s+([A-Za-z0-9_$]+)/);
    if (m) { namedExports.push(m[2]); out.push(line.replace(/^export\s+/, '')); continue; }

    // export function NAME / export async function NAME
    m = line.match(/^export\s+(async\s+)?function\s+([A-Za-z0-9_$]+)/);
    if (m) { namedExports.push(m[2]); out.push(line.replace(/^export\s+/, '')); continue; }

    // export class NAME
    m = line.match(/^export\s+class\s+([A-Za-z0-9_$]+)/);
    if (m) { namedExports.push(m[1]); out.push(line.replace(/^export\s+/, '')); continue; }

    // export { a, b as c }  (named export list, no 'from')
    m = line.match(/^export\s+\{([^}]+)\};?\s*$/);
    if (m) {
      m[1].split(',').forEach((part) => {
        const seg = part.trim();
        if (!seg) return;
        const asMatch = seg.match(/(.+)\s+as\s+(.+)/);
        if (asMatch) namedExports.push(`${asMatch[2].trim()}: ${asMatch[1].trim()}`);
        else namedExports.push(seg);
      });
      continue; // drop the line; we emit module.exports at the end
    }

    out.push(line);
  }

  let result = out.join('\n');

  if (namedExports.length) {
    const body = namedExports.map((n) => `  ${n},`).join('\n');
    result += `\n\nmodule.exports = {\n${body}\n};\n`;
  }

  return { result, namedExports, hasDefaultExport, defaultExportInline };
}

let anyManual = false;
for (const rel of files) {
  const full = path.resolve(rel);
  if (!fs.existsSync(full)) { console.log(`SKIP (missing): ${rel}`); continue; }
  const src = fs.readFileSync(full, 'utf8');
  const { result, namedExports, hasDefaultExport } = convert(src);
  fs.writeFileSync(full, result, 'utf8');

  // Warn if a file has BOTH default and named exports (needs manual review)
  const flag = hasDefaultExport && namedExports.length ? '  ⚠️  HAS BOTH default+named — REVIEW' : '';
  console.log(`OK: ${rel}  (named: ${namedExports.length}, default: ${hasDefaultExport})${flag}`);
  if (flag) anyManual = true;
}

console.log('\nDone.');
if (anyManual) console.log('Some files had both default and named exports — review those manually.');