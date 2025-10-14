const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('./src/trimmed/mixpanel-trimmed-5.cjs.js', 'utf-8');
const ast = parser.parse(code, {
  sourceType: 'script',
  plugins: ['jsx', 'typescript'],
  errorRecovery: true
});

// Find the declarations
const varDecls = new Map();

traverse(ast, {
  VariableDeclarator: (path) => {
    const varDeclaration = path.findParent((p) => p.isVariableDeclaration());
    if (varDeclaration && varDeclaration.parent.type === 'Program') {
      const name = path.node.id?.name;
      if (name === 'toString' || name === 'hasOwnProperty' || name === 'setImmediate') {
        varDecls.set(name, { path, refs: [] });
        console.log(`Found declaration: ${name} at line ${path.node.loc.start.line}`);
      }
    }
  }
});

// Now find all identifiers
traverse(ast, {
  Identifier: (path) => {
    const name = path.node.name;
    if (varDecls.has(name)) {
      const decl = varDecls.get(name);

      // Skip the declaration itself
      if (path === decl.path.get('id')) {
        return;
      }

      const binding = path.scope.getBinding(name);
      const line = path.node.loc.start.line;
      const parent = path.parent.type;

      // Check if this is a property in a MemberExpression
      const isProperty = path.parent.type === 'MemberExpression' && path.parent.property === path.node;

      console.log(`  Line ${line}: ${name} - parent: ${parent}, isProperty: ${isProperty}, binding: ${binding ? 'found' : 'none'}, binding matches: ${binding && binding.path === decl.path}`);

      if (binding && binding.path === decl.path) {
        decl.refs.push({ line, parent, path, isProperty });
      }
    }
  }
});

console.log('\n=== Summary ===');
for (const [name, info] of varDecls.entries()) {
  console.log(`${name}: ${info.refs.length} references`);
  info.refs.forEach(ref => {
    console.log(`  Line ${ref.line}: parent type = ${ref.parent}`);
  });
}
