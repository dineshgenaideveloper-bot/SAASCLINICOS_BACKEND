// codemod2.js — fixes multi-line ESM imports and multi-line `export default`
const fs = require('fs');

const files = [
  'controllers/tenant/staffAttendanceController.js',
  'controllers/tenant/staffAttendanceRegularizationController.js',
  'controllers/tenant/staffPayslipController.js',
  'routes/tenant/staffAttendanceRoutes.js',
  'models/tenant/StaffAttendanceRegularization.js',
];

function fix(src) {
  let s = src;

  // 1. Multi-line (and single-line) named imports:
  //    import { a, b as c } from 'x';  ->  const { a, b: c } = require('x');
  //    Handles newlines inside the braces.
  s = s.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
    (whole, names, mod) => {
      const cleaned = names.replace(/\s+as\s+/g, ': ');
      return `const {${cleaned}} = require('${mod}');`;
    }
  );

  // 2. Default import:  import X from 'y';  ->  const X = require('y');
  s = s.replace(
    /import\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]+)['"]\s*;?/g,
    (whole, name, mod) => `const ${name} = require('${mod}');`
  );

  // 3. Namespace import: import * as N from 'y';
  s = s.replace(
    /import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]+)['"]\s*;?/g,
    (whole, name, mod) => `const ${name} = require('${mod}');`
  );

  // 4. Side-effect import: import 'y';
  s = s.replace(/import\s+['"]([^'"]+)['"]\s*;?/g, (whole, mod) => `require('${mod}');`);

  // 5. export default  ->  module.exports =   (works for multi-line expressions too,
  //    since we only replace the keyword, leaving the rest of the expression intact)
  s = s.replace(/export\s+default\s+/g, 'module.exports = ');

  return s;
}

for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`SKIP (missing): ${f}`); continue; }
  const before = fs.readFileSync(f, 'utf8');
  const after = fix(before);
  fs.writeFileSync(f, after, 'utf8');
  const changed = before !== after;
  console.log(`${changed ? 'FIXED' : 'no change'}: ${f}`);
}
console.log('\nDone.');