const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('./src/trimmed/mixpanel-trimmed-5.cjs.js', 'utf-8');
const ast = parser.parse(code, {
  sourceType: 'script',
  plugins: ['jsx', 'typescript'],
  errorRecovery: true
});

const resolveFunc = { path: null };

// Find resolve function
traverse(ast, {
  FunctionDeclaration: (path) => {
    if (path.parent.type === 'Program' && path.node.id?.name === 'resolve') {
      resolveFunc.path = path;
      console.log('Found resolve function at line:', path.node.loc.start.line);
    }
  }
});

if (!resolveFunc.path) {
  console.log('resolve function not found');
  process.exit(1);
}

// Now find all identifiers named 'resolve'
let identifierCount = 0;
let relevantRefs = 0;
traverse(ast, {
  Identifier: (path) => {
    if (path.node.name === 'resolve') {
      identifierCount++;
      const binding = path.scope.getBinding('resolve');

      if (binding && binding.path === resolveFunc.path) {
        // This identifier binds to our top-level function
        const isDeclaration = (path === resolveFunc.path.get('id'));

        if (!isDeclaration) {
          relevantRefs++;
          // Find the enclosing function
          let funcParent = path.getFunctionParent();
          const parentFuncName = funcParent?.node?.id?.name || '(anonymous)';

          // Check if this is within resolve's own body
          let current = path;
          let isWithinResolve = false;

          while (current) {
            const pf = current.getFunctionParent();
            if (!pf) break;

            if (pf === resolveFunc.path) {
              isWithinResolve = true;
              break;
            }

            current = pf;
          }

          console.log(`  Line ${path.node.loc.start.line}: resolve in function '${parentFuncName}', within resolve body: ${isWithinResolve}, parent AST type: ${path.parent.type}`);
        }
      } else if (!binding) {
        console.log(`  Line ${path.node.loc.start.line}: resolve with NO binding (property/parameter), parent type: ${path.parent.type}`);
      }
    }
  }
});

console.log(`\nTotal identifiers named 'resolve': ${identifierCount}`);
console.log(`References that bind to top-level resolve: ${relevantRefs}`);
