const fs = require('fs');
const path = require('path');

console.log('✅ Frontend File Verification\n');
console.log('='.repeat(70));

const files = [
  'src/pages/StudentDepartmentChangeRequestPage.jsx',
  'src/pages/AdminDepartmentRequestsPage.jsx'
];

function extractImports(content) {
  const importRegex = /import\s+(?:{[^}]*}|\w+(?:\s*,\s*{[^}]*})?)\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function checkFileExists(importPath, currentDir) {
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(currentDir, importPath);
    // Try with and without extensions
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
    for (const ext of extensions) {
      if (fs.existsSync(resolved + ext)) return { exists: true, path: resolved + ext };
      if (fs.existsSync(resolved)) return { exists: true, path: resolved };
    }
    return { exists: false, path: resolved };
  }
  
  // Node modules
  try {
    require.resolve(importPath);
    return { exists: true, path: importPath };
  } catch {
    return { exists: false, path: importPath };
  }
}

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`\n❌ File not found: ${file}`);
    return;
  }

  console.log(`\n📄 Checking: ${file}`);
  console.log('-'.repeat(70));

  const content = fs.readFileSync(file, 'utf-8');
  const imports = extractImports(content);

  console.log(`   Found ${imports.length} imports:`);
  
  const currentDir = path.dirname(file);
  let allValid = true;

  imports.forEach((importPath, idx) => {
    const result = checkFileExists(importPath, currentDir);
    const status = result.exists ? '✓' : '❌';
    console.log(`   ${status} ${importPath}`);
    if (!result.exists) allValid = false;
  });

  // Check for basic syntax errors
  console.log('\n   Syntax check:');
  try {
    // Basic JSX validation - check for unmatched brackets
    const braceCount = (content.match(/{/g) || []).length - (content.match(/}/g) || []).length;
    const parenCount = (content.match(/\(/g) || []).length - (content.match(/\)/g) || []).length;
    const bracketCount = (content.match(/\[/g) || []).length - (content.match(/\]/g) || []).length;

    if (braceCount === 0 && parenCount === 0 && bracketCount === 0) {
      console.log('   ✓ Bracket/brace/parenthesis matching looks good');
    } else {
      console.log(`   ⚠️  Potential bracket mismatch detected`);
      if (braceCount !== 0) console.log(`      Braces: ${braceCount}`);
      if (parenCount !== 0) console.log(`      Parentheses: ${parenCount}`);
      if (bracketCount !== 0) console.log(`      Brackets: ${bracketCount}`);
    }

    // Check for common issues
    const hasDefaultExport = content.includes('export default');
    console.log(`   ✓ Has default export: ${hasDefaultExport}`);

  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    allValid = false;
  }

  console.log(`\n   Overall: ${allValid ? '✓ All imports resolved' : '❌ Some imports missing'}`);
});

console.log('\n' + '='.repeat(70));
