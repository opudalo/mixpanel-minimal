#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const chalk = require('chalk');
const { program } = require('commander');
const prettier = require('prettier');

class MixpanelTrimmer {
  constructor(options = {}) {
    this.options = {
      inputFile: options.inputFile || './src/original/mixpanel.cjs.js',
      outputFile: options.outputFile || './src/trimmed/mixpanel-trimmed.cjs.js',
      methodsFile: options.methodsFile || './methods-to-keep.json',
      keepMethods: options.keepMethods || [],
      aggressive: options.aggressive || false,
      preserveComments: options.preserveComments !== false,
      sourceMap: options.sourceMap || true,
      verbose: options.verbose || false,
      dryRun: options.dryRun || false
    };

    // Shared Prettier config to ensure consistent formatting
    this.prettierConfig = {
      parser: 'babel',
      singleQuote: true,
      trailingComma: 'all',
      tabWidth: 2,
      semi: true,
      printWidth: 80,
      arrowParens: 'always',
      bracketSpacing: true,
      endOfLine: 'lf'
    };

    this.usedMethods = new Set(this.options.keepMethods);
    this.methodsToRemove = new Set(); // Methods explicitly marked for removal
    this.declaredMethods = new Set(); // All methods declared in .d.ts interfaces
    this.removedMethods = new Set();
    this.removedPrototypeAliases = new Set();
    this.removedExports = new Set();
    this.removedLines = 0;
    this.originalSize = 0;
    this.trimmedSize = 0;
  }

  async trim() {
    console.log(chalk.blue('✂️  Starting Mixpanel trimming process...'));

    // Load trim config (manual method control)
    await this.loadTrimConfig();

    // Read original file
    const originalCode = await this.readOriginalFile();

    // Prettify original and save it to disk
    const prettifiedPath = await this.prettifyOriginal(originalCode);

    // Read the prettified file from disk (ensures exact same formatting)
    const prettifiedCode = fs.readFileSync(prettifiedPath, 'utf-8');
    console.log(chalk.gray(`Reading prettified file from disk: ${prettifiedPath}`));

    // PASS 0: Remove unused code from _init and reset methods (explicit, surgical removals first)
    console.log(chalk.blue('\n📍 Pass 0: Removing unused code from _init and reset methods'));
    const pass0Code = await this.removeUnusedInitCode(prettifiedCode);
    await this.saveTrimmedFile(pass0Code, 0);

    // PASS 1: Remove all comments early (cleaner code for subsequent passes)
    console.log(chalk.blue('\n📍 Pass 1: Removing all comments'));
    const pass1Code = await this.removeAllComments(pass0Code);
    await this.saveTrimmedFile(pass1Code, 1);

    // PASS 2: Remove self-assignments, unused assignments, and modernize underscore
    console.log(chalk.blue('\n📍 Pass 2: Removing redundant self-assignments and modernizing underscore'));
    let pass2Code = await this.removeSelfAssignments(pass1Code);
    pass2Code = await this.removeUnusedAssignments(pass2Code);
    pass2Code = await this.replacePromisePolyfill(pass2Code);
    pass2Code = await this.modernizeUnderscore(pass2Code);
    await this.saveTrimmedFile(pass2Code, 2);

    // PASS 3: Remove methods (without comment removal since already stripped)
    console.log(chalk.blue('\n📍 Pass 3: Removing methods'));
    const pass3Code = await this.processCode(pass2Code, { removeComments: false, pass: 3 });
    await this.saveTrimmedFile(pass3Code, 3);

    // PASS 4: Remove unused private methods (recursive)
    console.log(chalk.blue('\n📍 Pass 4: Removing unused private methods (recursive)'));
    const recursivePass4 = await this.makePassRecursive('Pass 4', this.removeUnusedPrivateMethods.bind(this));
    const pass4Code = await recursivePass4(pass3Code);
    await this.saveTrimmedFile(pass4Code, 4);

    // PASS 5: Remove unused variables, functions, and write-only variables (recursive)
    console.log(chalk.blue('\n📍 Pass 5: Removing unused variables, functions, and write-only variables (recursive)'));
    const recursivePass5 = await this.makePassRecursive('Pass 5', this.removeUnusedAndWriteOnlyVariablesOnce.bind(this));
    const pass5Code = await recursivePass5(pass4Code);
    await this.saveTrimmedFile(pass5Code, 5);

    // PASS 6: Remove unused constructor functions and standalone functions (recursive)
    console.log(chalk.blue('\n📍 Pass 6: Removing unused constructor functions (recursive)'));
    const recursivePass6 = await this.makePassRecursive('Pass 6', async (code, iteration) => {
      const result = await this.removeUnusedConstructors(code, iteration);
      console.log(chalk.gray(`  Iteration ${iteration}: Removed ${result.removedCount} items`));
      return result.code;
    });
    const pass6Code = await recursivePass6(pass5Code);
    await this.saveTrimmedFile(pass6Code, 6);

    // PASS 7: Remove unused variables, functions, and write-only variables again (recursive cleanup after Pass 6)
    console.log(chalk.blue('\n📍 Pass 7: Removing unused variables, functions, and write-only variables (recursive cleanup)'));
    const recursivePass7 = await this.makePassRecursive('Pass 7', this.removeUnusedAndWriteOnlyVariablesOnce.bind(this));
    const pass7Code = await recursivePass7(pass6Code);
    await this.saveTrimmedFile(pass7Code, 7);

    // Generate summary
    this.printSummary();
  }

  async loadTrimConfig() {
    const configFile = './trim-config.json';

    if (!fs.existsSync(configFile)) {
      console.log(chalk.red(`❌ ${configFile} not found!`));
      console.log(chalk.yellow('Run: node tools/extract-methods.js to generate it'));
      process.exit(1);
    }

    // Read file and strip comments (// style)
    let fileContent = fs.readFileSync(configFile, 'utf-8');

    // Strip single-line comments but preserve the content
    fileContent = fileContent.split('\n').map(line => {
      // If line contains //, remove everything after it (but keep the line for parsing context)
      const commentIndex = line.indexOf('//');
      if (commentIndex !== -1) {
        return line.substring(0, commentIndex);
      }
      return line;
    }).join('\n');

    const config = JSON.parse(fileContent);

    if (!config.methods) {
      console.log(chalk.red('❌ Invalid config format'));
      process.exit(1);
    }

    // First, extract all methods from the actual code to know what exists
    const allMethodsInCode = new Set();
    const originalCode = fs.readFileSync(this.options.inputFile, 'utf-8');
    const ast = parser.parse(originalCode, {
      sourceType: 'script',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true
    });

    traverse(ast, {
      AssignmentExpression: (path) => {
        if (path.node.left?.type === 'MemberExpression') {
          const obj = path.node.left.object;
          const prop = path.node.left.property;

          if (obj?.type === 'MemberExpression' && obj.property?.name === 'prototype') {
            const className = obj.object?.name;
            const methodName = prop?.name || prop?.value;

            if (className && methodName && !methodName.startsWith('_')) {
              const fullMethodName = `${className}.prototype.${methodName}`;
              allMethodsInCode.add(fullMethodName);
            }
          }
        }
      }
    });

    // Build methodsToRemove list:
    // 1. Methods set to false explicitly
    // 2. Methods that exist in code but are missing from config (commented out)
    const methodsInConfig = new Set();

    Object.entries(config.methods).forEach(([className, methods]) => {
      Object.entries(methods).forEach(([methodName, shouldKeep]) => {
        const fullMethodName = `${className}.prototype.${methodName}`;
        methodsInConfig.add(fullMethodName);

        if (shouldKeep === false) {
          this.methodsToRemove.add(fullMethodName);
        }
      });
    });

    // Methods that exist in code but not in config = commented out = remove
    allMethodsInCode.forEach(fullMethodName => {
      if (!methodsInConfig.has(fullMethodName)) {
        this.methodsToRemove.add(fullMethodName);
      }
    });

    const totalMethods = allMethodsInCode.size;
    const keepCount = totalMethods - this.methodsToRemove.size;

    console.log(chalk.gray(`Loaded config: ${keepCount} methods to keep, ${this.methodsToRemove.size} to remove (of ${totalMethods} total)`));

    if (this.options.verbose && this.methodsToRemove.size > 0) {
      console.log(chalk.gray('Methods to remove:'));
      Array.from(this.methodsToRemove).sort().forEach(method => {
        console.log(chalk.gray(`  - ${method}`));
      });
    }
  }

  async readOriginalFile() {
    if (!fs.existsSync(this.options.inputFile)) {
      throw new Error(`Input file not found: ${this.options.inputFile}`);
    }

    const code = fs.readFileSync(this.options.inputFile, 'utf-8');
    this.originalSize = Buffer.byteLength(code, 'utf8');

    console.log(chalk.gray(`Original file size: ${this.formatSize(this.originalSize)}`));
    return code;
  }

  async prettifyOriginal(code) {
    console.log(chalk.gray('Prettifying original file...'));

    const prettifiedPath = this.options.inputFile.replace(/\.cjs\.js$/, '-prettified.cjs.js');

    // Parse and regenerate through Babel first (same as trimmed file will go through)
    console.log(chalk.gray('  Running original through Babel parse/generate...'));
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      const output = generate(ast, {
        sourceMaps: false,
        comments: true,
        shouldPrintComment: () => true,
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      code = output.code;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Babel processing failed: ${error.message}`));
      console.log(chalk.yellow('  Using original code without Babel processing...'));
    }

    if (!this.options.dryRun) {
      // Write Babel-processed code first
      fs.writeFileSync(prettifiedPath, code);

      // Use Prettier CLI to format it (ensures 100% consistent formatting)
      const { execSync } = require('child_process');
      try {
        execSync(`npx prettier --write "${prettifiedPath}"`, { stdio: 'pipe' });
        console.log(chalk.green(`✓ Prettified original saved to: ${prettifiedPath}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Prettier CLI formatting failed: ${error.message}`));
      }
    } else {
      console.log(chalk.gray(`  Would save prettified to: ${prettifiedPath}`));
      // In dry-run, write to a temp location
      const tempPath = prettifiedPath + '.tmp';
      fs.writeFileSync(tempPath, code);
      try {
        const { execSync } = require('child_process');
        execSync(`npx prettier --write "${tempPath}"`, { stdio: 'pipe' });
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Prettier CLI formatting failed: ${error.message}`));
      }
      return tempPath;
    }

    return prettifiedPath;
  }

  async processCode(code, options = {}) {
    const { pass = 1 } = options;

    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Remove methods marked for removal
      const nodesToRemove = [];

      traverse(ast, {
        // Remove assignments to ClassName.prototype.methodName
        AssignmentExpression: (path) => {
          if (path.node.left?.type === 'MemberExpression') {
            const obj = path.node.left.object;
            const prop = path.node.left.property;

            // Check if this is a prototype assignment
            if (obj?.type === 'MemberExpression' &&
                obj.property?.name === 'prototype') {
              const className = obj.object?.name;
              const methodName = prop?.name || prop?.value;

              if (className && methodName) {
                const fullMethodName = `${className}.prototype.${methodName}`;

                if (this.methodsToRemove.has(fullMethodName)) {
                  const statement = path.getStatementParent();
                  if (statement && !nodesToRemove.includes(statement)) {
                    nodesToRemove.push(statement);
                    this.removedMethods.add(fullMethodName);
                    if (this.options.verbose) {
                      console.log(chalk.gray(`  Removing: ${fullMethodName}`));
                    }
                  }
                }
              }
            }
          }
        },

        // Remove object methods ONLY in specific contexts (MixpanelPeople, exports, etc.)
        ObjectProperty: (path) => {
          const keyName = path.node.key?.name || path.node.key?.value;

          if (keyName && this.methodsToRemove.has(keyName)) {
            // Check if this is a method (function value)
            if (path.node.value?.type === 'FunctionExpression' ||
                path.node.value?.type === 'ArrowFunctionExpression' ||
                path.node.method) {

              // Only remove if this is in a MixpanelPeople or similar public API object
              // Check if parent is an object that looks like it's defining public API
              const parent = path.parentPath;
              if (parent && parent.node.type === 'ObjectExpression') {
                // Check if this object is being assigned to something
                const grandParent = parent.parentPath;
                if (grandParent && grandParent.node.type === 'VariableDeclarator') {
                  const varName = grandParent.node.id?.name;
                  // Only remove if it's clearly a public API object
                  if (varName && (varName.includes('People') || varName.includes('Group'))) {
                    path.remove();
                    this.removedMethods.add(keyName);
                    if (this.options.verbose) {
                      console.log(chalk.gray(`  Removing object method: ${keyName} from ${varName}`));
                    }
                  }
                }
              }
            }
          }
        },

        ObjectMethod: (path) => {
          const keyName = path.node.key?.name || path.node.key?.value;

          if (keyName && this.methodsToRemove.has(keyName)) {
            // Only remove if this is in a public API object context
            const parent = path.parentPath;
            if (parent && parent.node.type === 'ObjectExpression') {
              const grandParent = parent.parentPath;
              if (grandParent && grandParent.node.type === 'VariableDeclarator') {
                const varName = grandParent.node.id?.name;
                if (varName && (varName.includes('People') || varName.includes('Group'))) {
                  path.remove();
                  this.removedMethods.add(keyName);
                  if (this.options.verbose) {
                    console.log(chalk.gray(`  Removing object method: ${keyName} from ${varName}`));
                  }
                }
              }
            }
          }
        }
      });

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped in Pass 1
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return output.code;
    } catch (error) {
      console.log(chalk.red('Error processing code:'), error.message);
      throw error;
    }
  }

  async removeUnusedPrivateMethods(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Step 1: Find all private method declarations
      const privateMethods = new Map(); // Map<fullMethodName, { className, methodName, path }>
      const nodesToRemove = [];

      traverse(ast, {
        AssignmentExpression: (path) => {
          if (path.node.left?.type === 'MemberExpression') {
            const obj = path.node.left.object;
            const prop = path.node.left.property;

            if (obj?.type === 'MemberExpression' && obj.property?.name === 'prototype') {
              const className = obj.object?.name;
              const methodName = prop?.name || prop?.value;

              // Only track private methods (starting with _)
              if (className && methodName && methodName.startsWith('_')) {
                const fullMethodName = `${className}.prototype.${methodName}`;
                privateMethods.set(fullMethodName, {
                  className,
                  methodName,
                  path: path.getStatementParent(),
                  references: 0
                });
              }
            }
          }
        }
      });

      console.log(chalk.gray(`  Found ${privateMethods.size} private methods`));

      // Step 2: Count references to each private method
      // We need to search for:
      // - this._methodName()
      // - someVar._methodName()
      // - _.methodName (direct references)

      traverse(ast, {
        MemberExpression: (path) => {
          const prop = path.node.property;
          const methodName = prop?.name || prop?.value;

          if (methodName && typeof methodName === 'string' && methodName.startsWith('_')) {
            // Check if this matches any of our private methods
            for (const [fullMethodName, methodInfo] of privateMethods.entries()) {
              if (methodInfo.methodName === methodName) {
                // Don't count the declaration itself
                const statement = path.getStatementParent();
                if (statement !== methodInfo.path) {
                  methodInfo.references++;
                }
              }
            }
          }
        },

        // Also check for string references (e.g., methods called via bracket notation)
        StringLiteral: (path) => {
          const value = path.node.value;
          if (value && typeof value === 'string' && value.startsWith('_')) {
            for (const [fullMethodName, methodInfo] of privateMethods.entries()) {
              if (methodInfo.methodName === value) {
                methodInfo.references++;
              }
            }
          }
        }
      });

      // Step 3: Remove methods with 0 references
      const unusedPrivateMethods = new Set();

      for (const [fullMethodName, methodInfo] of privateMethods.entries()) {
        if (methodInfo.references === 0) {
          unusedPrivateMethods.add(fullMethodName);
          nodesToRemove.push(methodInfo.path);
          if (this.options.verbose) {
            console.log(chalk.gray(`  Removing unused: ${fullMethodName}`));
          }
        } else if (this.options.verbose) {
          console.log(chalk.gray(`  Keeping ${fullMethodName} (${methodInfo.references} references)`));
        }
      }

      console.log(chalk.gray(`  Removing ${unusedPrivateMethods.size} unused private methods`));
      console.log(chalk.gray(`  Keeping ${privateMethods.size - unusedPrivateMethods.size} used private methods`));

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return output.code;
    } catch (error) {
      console.log(chalk.red('Error removing unused private methods:'), error.message);
      throw error;
    }
  }

  async removeUnusedVariablesAndFunctions(code, iteration = 1) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Step 1: Find all top-level declarations
      const declarations = new Map(); // Map<name, { type, path, references }>
      const nodesToRemove = [];

      // Collect all top-level function and variable declarations
      traverse(ast, {
        // Top-level function declarations
        FunctionDeclaration: (path) => {
          // Only process top-level functions (parent is Program)
          if (path.parent.type === 'Program') {
            const name = path.node.id?.name;
            if (name) {
              declarations.set(name, {
                type: 'function',
                path: path,
                references: 0,
                name: name
              });
            }
          }
        },

        // Variable declarations (var, let, const)
        VariableDeclarator: (path) => {
          // Check if this is a top-level variable
          const varDeclaration = path.findParent((p) => p.isVariableDeclaration());
          if (varDeclaration && varDeclaration.parent.type === 'Program') {
            const name = path.node.id?.name;
            if (name) {
              // Check if it's a function expression
              const isFunction = path.node.init?.type === 'FunctionExpression' ||
                                path.node.init?.type === 'ArrowFunctionExpression';

              declarations.set(name, {
                type: isFunction ? 'function-var' : 'variable',
                path: path,
                varDeclarationPath: varDeclaration,
                references: 0,
                name: name
              });
            }
          }
        }
      });

      if (this.options.verbose || iteration === 1) {
        console.log(chalk.gray(`    Found ${declarations.size} top-level declarations`));
      }

      // Step 2: Count references to each declaration
      traverse(ast, {
        Identifier: (path) => {
          const name = path.node.name;

          if (declarations.has(name)) {
            const decl = declarations.get(name);

            // Don't count the declaration itself
            if (path !== decl.path.get('id') &&
                path.getStatementParent() !== decl.path.getStatementParent()) {

              // Don't count if this identifier is on the LEFT side of an assignment
              // (e.g., schedulingQueue = ... doesn't count as a use)
              if (path.parent.type === 'AssignmentExpression' && path.parent.left === path.node) {
                return; // This is an assignment target, not a use
              }

              // Don't count if this is a property name in a NON-COMPUTED MemberExpression
              // (e.g., obj.toString or obj.hasOwnProperty are NOT references to the variable)
              // BUT obj[CONFIG_VAR] IS a reference because it's computed (bracket notation)
              if (path.parent.type === 'MemberExpression' &&
                  path.parent.property === path.node &&
                  !path.parent.computed) {
                return; // This is a property name in dot notation, not a variable reference
              }

              // Check if this is a binding (declaration) or reference (usage)
              const binding = path.scope.getBinding(name);

              // If there's no binding, this might be a property name (e.g., .toString in obj.toString())
              // Only count if the binding exists AND points to our declaration
              if (!binding || binding.path !== decl.path) {
                // No binding = property name or other non-reference
                // Wrong binding = shadowed variable
                return;
              }

              // Don't count if this identifier is in the declaration itself
              if (decl.type === 'function' && path.getFunctionParent() === decl.path) {
                return; // Inside the function body
              }

              if (decl.type === 'function-var' || decl.type === 'variable') {
                // Check if we're inside the initializer
                const parentVar = path.findParent((p) => p === decl.path);
                if (parentVar) {
                  return; // Inside the variable initializer
                }
              }

              decl.references++;
            } else if (path.getStatementParent() === decl.path.getStatementParent()) {
              // Special case: This reference is in the same statement as the declaration
              // Check if it's in a sibling declarator's initializer (like ArrayProto used by slice)
              const parentDeclarator = path.findParent((p) => p.isVariableDeclarator());
              if (parentDeclarator && parentDeclarator !== decl.path) {
                // This is a reference from a sibling declarator in the same var statement
                // Count it as a real reference to track dependencies
                decl.references++;
              }
            }
          }
        },

        // Also check for string references
        StringLiteral: (path) => {
          const name = path.node.value;
          if (declarations.has(name)) {
            const decl = declarations.get(name);

            // Don't count string literals in the same statement as the declaration
            if (path.getStatementParent() !== decl.path.getStatementParent()) {
              decl.references++;
            }
          }
        }
      });

      // Step 3: Identify unused declarations (but be conservative)
      const unusedDeclarations = new Set();

      // Reserved names that should never be removed (common patterns)
      const reservedNames = new Set([
        'module', 'exports', 'window', 'document', 'console',
        'MixpanelLib', 'Mixpanel', 'mixpanel', 'init_type'
      ]);

      for (const [name, decl] of declarations.entries()) {
        // Skip reserved names
        if (reservedNames.has(name)) {
          if (this.options.verbose) {
            console.log(chalk.gray(`  Keeping reserved: ${name}`));
          }
          continue;
        }

        // Skip PascalCase names ONLY if they have references (likely used constructors)
        // Examples: MixpanelLib, Config, NpoPromise
        // But DO remove unused PascalCase constructors (e.g., RageClickTracker with no prototype methods)
        // And DO check ALL_CAPS constants as they may be unused
        if (/^[A-Z]/.test(name) && /[a-z]/.test(name) && decl.references > 0) {
          if (this.options.verbose) {
            console.log(chalk.gray(`    Keeping (used constructor): ${name} (${decl.references} refs)`));
          }
          continue;
        }

        // Remove only if no references at all
        const shouldRemove = decl.references === 0;

        if (shouldRemove) {
          unusedDeclarations.add(name);

          if (decl.type === 'function') {
            nodesToRemove.push(decl.path);
          } else if (decl.type === 'function-var' || decl.type === 'variable') {
            // For variables, we need to check if it's the only declarator
            const varDecl = decl.varDeclarationPath;
            if (varDecl.node.declarations.length === 1) {
              // Remove the entire variable declaration
              nodesToRemove.push(varDecl);
            } else {
              // Remove just this declarator
              nodesToRemove.push(decl.path);
            }
          }

          if (this.options.verbose) {
            console.log(chalk.gray(`    Removing unused ${decl.type}: ${name}`));
          }
        } else if (this.options.verbose) {
          console.log(chalk.gray(`    Keeping ${name} (${decl.references} refs)`));
        }
      }

      // Step 4: Also remove standalone assignment statements to unused variables
      // e.g., schedulingQueue = function() {...}() when schedulingQueue is unused
      traverse(ast, {
        ExpressionStatement: (path) => {
          const expr = path.node.expression;
          if (expr?.type === 'AssignmentExpression' &&
              expr.left?.type === 'Identifier') {
            const varName = expr.left.name;
            if (unusedDeclarations.has(varName)) {
              if (!nodesToRemove.includes(path)) {
                nodesToRemove.push(path);
                if (this.options.verbose) {
                  console.log(chalk.gray(`    Removing assignment statement for unused variable: ${varName}`));
                }
              }
            }
          }
        }
      });

      if (this.options.verbose || iteration === 1) {
        console.log(chalk.gray(`    Removing ${unusedDeclarations.size} unused declarations`));
        console.log(chalk.gray(`    Keeping ${declarations.size - unusedDeclarations.size} used declarations`));
      }

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return {
        code: output.code,
        removedCount: unusedDeclarations.size
      };
    } catch (error) {
      console.log(chalk.red('Error removing unused variables and functions:'), error.message);
      throw error;
    }
  }

  // Generic helper to make any pass recursive by comparing code before/after
  async makePassRecursive(passName, passFunction) {
    return async (code) => {
      let resultCode = code;
      let iteration = 0;

      while (true) {
        iteration++;
        const previousCode = resultCode;
        resultCode = await passFunction(resultCode, iteration);

        // Compare code - if no change, we've reached fixed point
        if (resultCode === previousCode) {
          console.log(chalk.green(`  ✓ Fixed point reached after ${iteration} iteration(s)`));
          break;
        }

        // Safety check to prevent infinite loops
        if (iteration > 10) {
          console.log(chalk.yellow(`  ⚠️  Stopped after 10 iterations (safety limit)`));
          break;
        }
      }

      return resultCode;
    };
  }

  // Single iteration of removing unused variables/functions and write-only variables
  async removeUnusedAndWriteOnlyVariablesOnce(code, iteration = 1) {
    const unusedResult = await this.removeUnusedVariablesAndFunctions(code, iteration);
    const writeOnlyResult = await this.removeWriteOnlyVariables(unusedResult.code, iteration);

    const totalRemoved = unusedResult.removedCount + writeOnlyResult.removedCount;
    console.log(chalk.gray(`  Iteration ${iteration}: Removed ${unusedResult.removedCount} unused + ${writeOnlyResult.removedCount} write-only = ${totalRemoved} total`));

    return writeOnlyResult.code;
  }

  async removeAllComments(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      console.log(chalk.gray('  Stripping all comments from code...'));

      // Generate code without any comments
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Don't include any comments
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      console.log(chalk.gray('  All comments removed'));
      return output.code;
    } catch (error) {
      console.log(chalk.red('Error removing comments:'), error.message);
      throw error;
    }
  }

  async removeUnusedConstructors(code, iteration = 1) {
    try {
      if (iteration === 1) {
        console.log(chalk.gray('  Finding unused constructor functions...'));
      }

      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Step 1: Find all PascalCase function declarations and var assignments
      const constructors = new Map(); // Map<name, { path, type, hasNew, hasPrototype }>

      traverse(ast, {
        // Function declarations
        FunctionDeclaration: (path) => {
          if (path.parent.type === 'Program') {
            const name = path.node.id?.name;
            // Check if it's PascalCase (likely a constructor)
            if (name && /^[A-Z]/.test(name) && /[a-z]/.test(name)) {
              constructors.set(name, {
                path: path,
                type: 'function',
                hasNew: false,
                hasPrototype: false
              });
            }
          }
        },

        // Var declarations (e.g., var RequestBatcher = function() {...})
        VariableDeclarator: (path) => {
          const varDeclaration = path.findParent((p) => p.isVariableDeclaration());
          if (varDeclaration && varDeclaration.parent.type === 'Program') {
            const name = path.node.id?.name;
            const init = path.node.init;

            // Check if it's a function expression and PascalCase
            if (name && /^[A-Z]/.test(name) && /[a-z]/.test(name) &&
                (init?.type === 'FunctionExpression' || init?.type === 'ArrowFunctionExpression')) {
              constructors.set(name, {
                path: path,
                varDeclarationPath: varDeclaration,
                type: 'var-function',
                hasNew: false,
                hasPrototype: false
              });
            }
          }
        }
      });

      // Step 2: Check for 'new ConstructorName' usage and prototype assignments
      traverse(ast, {
        NewExpression: (path) => {
          const name = path.node.callee?.name;
          if (name && constructors.has(name)) {
            constructors.get(name).hasNew = true;
          }
        },

        AssignmentExpression: (path) => {
          // Check for Constructor.prototype.method = ...
          const left = path.node.left;
          if (left?.type === 'MemberExpression' &&
              left.object?.type === 'MemberExpression' &&
              left.object.property?.name === 'prototype') {
            const constructorName = left.object.object?.name;
            if (constructorName && constructors.has(constructorName)) {
              constructors.get(constructorName).hasPrototype = true;
            }
          }
        }
      });

      // Step 3: Also find standalone functions that are never called
      const standaloneFunctions = new Map();

      traverse(ast, {
        FunctionDeclaration: (path) => {
          if (path.parent.type === 'Program') {
            const name = path.node.id?.name;
            // Check if it's camelCase (not PascalCase, not _private)
            if (name && /^[a-z]/.test(name) && !name.startsWith('_')) {
              standaloneFunctions.set(name, {
                path: path,
                called: false
              });
            }
          }
        }
      });

      // Step 4: Check if standalone functions are called or referenced
      traverse(ast, {
        Identifier: (path) => {
          const name = path.node.name;
          if (name && standaloneFunctions.has(name)) {
            const func = standaloneFunctions.get(name);

            // Don't count the function's own declaration
            if (path !== func.path.get('id')) {
              // Skip if this is a property name in a NON-COMPUTED MemberExpression (like chain.resolve)
              // These are NOT references to the top-level function
              // BUT obj[funcName] IS a reference because it's computed (bracket notation)
              if (path.parent.type === 'MemberExpression' &&
                  path.parent.property === path.node &&
                  !path.parent.computed) {
                return; // This is just a property name in dot notation, not a function reference
              }

              // Use Babel's scope binding to check if this identifier actually refers to our function
              const binding = path.scope.getBinding(name);

              // Only count if the binding points to our top-level function
              if (binding && binding.path === func.path) {
                // Check if this identifier is anywhere within the function's own body (including nested functions)
                // Walk up the tree to find all ancestor functions
                let current = path;
                let isWithinOwnFunction = false;

                while (current) {
                  const parentFunc = current.getFunctionParent();
                  if (!parentFunc) break;

                  // Check if this parent function is the function we're analyzing
                  if (parentFunc === func.path) {
                    isWithinOwnFunction = true;
                    break;
                  }

                  // Move up to check next level
                  current = parentFunc;
                }

                // Only mark as called if it's NOT within its own function body
                if (!isWithinOwnFunction) {
                  func.called = true;
                }
              }
            }
          }
        }
      });

      // Step 5: Remove unused constructors and functions
      const nodesToRemove = [];
      let removedCount = 0;

      // Remove constructors never instantiated with 'new' (regardless of prototype methods)
      for (const [name, info] of constructors.entries()) {
        if (!info.hasNew) {
          if (info.type === 'function') {
            nodesToRemove.push(info.path);
          } else if (info.type === 'var-function') {
            // Check if it's the only declarator
            if (info.varDeclarationPath.node.declarations.length === 1) {
              nodesToRemove.push(info.varDeclarationPath);
            } else {
              nodesToRemove.push(info.path);
            }
          }
          console.log(chalk.gray(`    Removing unused constructor: ${name}`));
          removedCount++;
        }
      }

      // Remove standalone functions never called
      for (const [name, info] of standaloneFunctions.entries()) {
        if (!info.called) {
          nodesToRemove.push(info.path);
          console.log(chalk.gray(`    Removing unused function: ${name}`));
          removedCount++;
        }
      }

      // Step 6: Also remove any prototype methods for removed constructors
      const removedConstructorNames = new Set();
      for (const [name, info] of constructors.entries()) {
        if (!info.hasNew) {
          removedConstructorNames.add(name);
        }
      }

      if (removedConstructorNames.size > 0) {
        traverse(ast, {
          ExpressionStatement: (path) => {
            const expr = path.node.expression;

            // Remove prototype method assignments: Constructor.prototype.method = ...
            if (expr?.type === 'AssignmentExpression' &&
                expr.left?.type === 'MemberExpression' &&
                expr.left.object?.type === 'MemberExpression' &&
                expr.left.object.property?.name === 'prototype') {
              const constructorName = expr.left.object.object?.name;
              if (constructorName && removedConstructorNames.has(constructorName)) {
                if (!nodesToRemove.includes(path)) {
                  nodesToRemove.push(path);
                  const methodName = expr.left.property?.name || expr.left.property?.value;
                  console.log(chalk.gray(`    Removing orphaned prototype method: ${constructorName}.prototype.${methodName}`));
                  removedCount++;
                }
              }
            }

            // Remove safewrapClass(Constructor) calls
            if (expr?.type === 'CallExpression' &&
                expr.callee?.name === 'safewrapClass' &&
                expr.arguments?.length === 1) {
              const argName = expr.arguments[0]?.name;
              if (argName && removedConstructorNames.has(argName)) {
                if (!nodesToRemove.includes(path)) {
                  nodesToRemove.push(path);
                  console.log(chalk.gray(`    Removing safewrapClass call: safewrapClass(${argName})`));
                  removedCount++;
                }
              }
            }

            // Remove _.inherit(Child, Parent) calls where either is removed
            if (expr?.type === 'CallExpression' &&
                expr.callee?.type === 'MemberExpression' &&
                expr.callee.object?.name === '_' &&
                expr.callee.property?.name === 'inherit' &&
                expr.arguments?.length === 2) {
              const child = expr.arguments[0]?.name;
              const parent = expr.arguments[1]?.name;
              if ((child && removedConstructorNames.has(child)) ||
                  (parent && removedConstructorNames.has(parent))) {
                if (!nodesToRemove.includes(path)) {
                  nodesToRemove.push(path);
                  console.log(chalk.gray(`    Removing inherit call: _.inherit(${child}, ${parent})`));
                  removedCount++;
                }
              }
            }

            // Remove _.extend(Constructor.prototype, ...) calls
            if (expr?.type === 'CallExpression' &&
                expr.callee?.type === 'MemberExpression' &&
                expr.callee.object?.name === '_' &&
                expr.callee.property?.name === 'extend' &&
                expr.arguments?.length >= 1) {
              const firstArg = expr.arguments[0];
              // Check if first argument is Constructor.prototype
              if (firstArg?.type === 'MemberExpression' &&
                  firstArg.property?.name === 'prototype') {
                const constructorName = firstArg.object?.name;
                if (constructorName && removedConstructorNames.has(constructorName)) {
                  if (!nodesToRemove.includes(path)) {
                    nodesToRemove.push(path);
                    console.log(chalk.gray(`    Removing extend call: _.extend(${constructorName}.prototype, ...)`));
                    removedCount++;
                  }
                }
              }
            }
          }
        });
      }

      if (iteration === 1 || this.options.verbose) {
        console.log(chalk.gray(`  Removed ${removedCount} unused constructors/functions`));
      }

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Keep comments stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return {
        code: output.code,
        removedCount: removedCount
      };
    } catch (error) {
      console.log(chalk.red('Error removing unused constructors:'), error.message);
      throw error;
    }
  }

  async removeSelfAssignments(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      const nodesToRemove = [];
      let removedCount = 0;

      traverse(ast, {
        AssignmentExpression: (path) => {
          const left = path.node.left;
          const right = path.node.right;

          // Check for patterns like _['info'] = _.info or _['JSONEncode'] = _.JSONEncode
          if (left?.type === 'MemberExpression' && right?.type === 'MemberExpression') {
            // Get left side: _['info'] or _.info
            const leftObj = left.object?.name;
            const leftProp = left.property?.name || left.property?.value;

            // Get right side: _.info
            const rightObj = right.object?.name;
            const rightProp = right.property?.name || right.property?.value;

            // Check if it's a self-assignment: same object and same property
            if (leftObj && rightObj && leftObj === rightObj &&
                leftProp && rightProp && leftProp === rightProp) {

              const statement = path.getStatementParent();
              if (statement && !nodesToRemove.includes(statement)) {
                nodesToRemove.push(statement);
                removedCount++;
                if (this.options.verbose) {
                  console.log(chalk.gray(`  Removing self-assignment: ${leftObj}['${leftProp}'] = ${rightObj}.${rightProp}`));
                }
              }
            }

            // Also check for nested patterns like _['info']['browser'] = _.info.browser
            if (left.object?.type === 'MemberExpression' && right.object?.type === 'MemberExpression') {
              const leftBaseObj = left.object.object?.name;
              const leftBaseProp = left.object.property?.name || left.object.property?.value;
              const leftNestedProp = left.property?.name || left.property?.value;

              const rightBaseObj = right.object.object?.name;
              const rightBaseProp = right.object.property?.name || right.object.property?.value;
              const rightNestedProp = right.property?.name || right.property?.value;

              if (leftBaseObj && rightBaseObj && leftBaseObj === rightBaseObj &&
                  leftBaseProp && rightBaseProp && leftBaseProp === rightBaseProp &&
                  leftNestedProp && rightNestedProp && leftNestedProp === rightNestedProp) {

                const statement = path.getStatementParent();
                if (statement && !nodesToRemove.includes(statement)) {
                  nodesToRemove.push(statement);
                  removedCount++;
                  if (this.options.verbose) {
                    console.log(chalk.gray(`  Removing nested self-assignment: ${leftBaseObj}['${leftBaseProp}']['${leftNestedProp}']`));
                  }
                }
              }
            }
          }
        }
      });

      console.log(chalk.gray(`  Removed ${removedCount} self-assignments`));

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return output.code;
    } catch (error) {
      console.log(chalk.red('Error removing self-assignments:'), error.message);
      throw error;
    }
  }

  async removeUnusedAssignments(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      const nodesToRemove = [];
      let removedCount = 0;

      // List of unused assignments to remove (extensible for future additions)
      const unusedAssignments = ['NPO', 'NpoPromise', 'PromisePrototype'];

      traverse(ast, {
        AssignmentExpression: (path) => {
          const left = path.node.left;

          // Check for assignments to _ object like _['NPO'] = ...
          if (left?.type === 'MemberExpression' && left.object?.name === '_') {
            const leftProp = left.property?.name || left.property?.value;

            if (leftProp && unusedAssignments.includes(leftProp)) {
              const statement = path.getStatementParent();
              if (statement && !nodesToRemove.includes(statement)) {
                nodesToRemove.push(statement);
                removedCount++;
                if (this.options.verbose) {
                  console.log(chalk.gray(`  Removing unused assignment: _['${leftProp}']`));
                }
              }
            }
          }
        },

        // Also handle variable declarations for NpoPromise, PromisePrototype, etc.
        VariableDeclarator: (path) => {
          const name = path.node.id?.name;

          if (name && unusedAssignments.includes(name)) {
            // Check if this is a top-level declaration or close to top-level
            const varDeclaration = path.findParent((p) => p.isVariableDeclaration());
            if (varDeclaration) {
              // If it's the only declarator, remove the entire statement
              if (varDeclaration.node.declarations.length === 1) {
                if (!nodesToRemove.includes(varDeclaration)) {
                  nodesToRemove.push(varDeclaration);
                  removedCount++;
                  if (this.options.verbose) {
                    console.log(chalk.gray(`  Removing unused variable: ${name}`));
                  }
                }
              } else {
                // Multiple declarators, just remove this one
                if (!nodesToRemove.includes(path)) {
                  nodesToRemove.push(path);
                  removedCount++;
                  if (this.options.verbose) {
                    console.log(chalk.gray(`  Removing unused variable: ${name}`));
                  }
                }
              }
            }
          }
        },

        // Also handle function declarations
        FunctionDeclaration: (path) => {
          const name = path.node.id?.name;

          if (name && unusedAssignments.includes(name)) {
            if (!nodesToRemove.includes(path)) {
              nodesToRemove.push(path);
              removedCount++;
              if (this.options.verbose) {
                console.log(chalk.gray(`  Removing unused function: ${name}`));
              }
            }
          }
        }
      });

      console.log(chalk.gray(`  Removed ${removedCount} unused assignments`));

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return output.code;
    } catch (error) {
      console.log(chalk.red('Error removing unused assignments:'), error.message);
      throw error;
    }
  }

  async replacePromisePolyfill(code) {
    try {
      console.log(chalk.gray('  Replacing Promise polyfill with native Promise...'));

      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      let replaced = false;
      const nodesToRemove = [];
      let npoPromiseRemoved = 0;

      traverse(ast, {

        // Remove PromisePrototype variable and all statements that reference NpoPromise
        VariableDeclaration: (path) => {
          // Remove PromisePrototype declaration
          if (path.node.declarations.some(d => d.id?.name === 'PromisePrototype')) {
            nodesToRemove.push(path);
            npoPromiseRemoved++;
            return;
          }

          // Note: We don't remove builtInProp, cycle, schedulingQueue, timer here
          // because they're still used in the code. Pass 4 will remove them naturally
          // once all NpoPromise-related functions are removed.

          // Look for: var PromisePolyfill;
          if (path.node.declarations.length === 1) {
            const decl = path.node.declarations[0];
            if (decl.id?.name === 'PromisePolyfill' && !decl.init) {
              // Found the declaration, now look for the if statement right after it
              const nextSibling = path.getSibling(path.key + 1);

              if (nextSibling && nextSibling.node?.type === 'IfStatement') {
                const test = nextSibling.node.test;

                // Check if this is the Promise polyfill check
                if (test?.type === 'LogicalExpression' &&
                    test.operator === '&&') {

                  // Check if it mentions Promise and native code
                  const codeStr = generate(nextSibling.node).code;
                  if (codeStr.includes('Promise') && codeStr.includes('native code')) {
                    // Replace both the declaration and the if statement with a simple assignment
                    const newDeclaration = t.variableDeclaration('var', [
                      t.variableDeclarator(
                        t.identifier('PromisePolyfill'),
                        t.identifier('Promise')
                      )
                    ]);

                    // Remove the if statement
                    nextSibling.remove();

                    // Replace the declaration
                    path.replaceWith(newDeclaration);

                    replaced = true;
                    console.log(chalk.gray('    Replaced Promise polyfill check with: var PromisePolyfill = Promise'));
                  }
                }
              }
            }
          }
        },

        // Remove all statements that reference NpoPromise (like NpoPromise.prototype = ...)
        ExpressionStatement: (path) => {
          const codeStr = generate(path.node).code;
          if (codeStr.includes('NpoPromise') || codeStr.includes('PromisePrototype')) {
            nodesToRemove.push(path);
            npoPromiseRemoved++;
          }
        },

        // Remove the builtInProp try-catch block (was used by NpoPromise)
        TryStatement: (path) => {
          const codeStr = generate(path.node).code;
          if (codeStr.includes('builtInProp') && codeStr.includes('Object.defineProperty')) {
            nodesToRemove.push(path);
            npoPromiseRemoved++;
          }
        }
      });

      // Remove all collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
        }
      });

      if (!replaced) {
        console.log(chalk.yellow('    Warning: Promise polyfill pattern not found'));
      }

      if (npoPromiseRemoved > 0) {
        console.log(chalk.gray(`    Removed ${npoPromiseRemoved} NpoPromise-related statements`));
      }

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return output.code;
    } catch (error) {
      console.log(chalk.red('Error replacing Promise polyfill:'), error.message);
      throw error;
    }
  }

  async modernizeUnderscore(code) {
    try {
      console.log(chalk.gray('  Modernizing underscore utility...'));

      // Read modern _ utility from tools/_.js to get the list of methods we're replacing
      const modernUnderscorePath = path.join(__dirname, '_.js');
      const modernUnderscore = fs.readFileSync(modernUnderscorePath, 'utf-8');

      // Extract method names from modern implementation
      const modernMethods = new Set();
      // Match both function methods and object properties (like cookie)
      const methodMatches = modernUnderscore.matchAll(/^\s+(\w+):\s*(?:function|\{)/gm);
      for (const match of methodMatches) {
        modernMethods.add(match[1]);
      }

      // Also add isArray which is assigned directly
      modernMethods.add('isArray');

      if (this.options.verbose) {
        console.log(chalk.gray(`    Replacing ${modernMethods.size} methods: ${Array.from(modernMethods).join(', ')}`));
      }

      // Parse the code to find and remove old method implementations
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      const nodesToRemove = [];
      const commentsToRemove = new Set();
      let removedCount = 0;

      traverse(ast, {
        // Find assignments like _.methodName = function...
        AssignmentExpression: (path) => {
          const left = path.node.left;

          if (left?.type === 'MemberExpression' &&
              left.object?.name === '_' &&
              left.property?.name) {

            const methodName = left.property.name;

            // Only remove if this is a method we're replacing (not localStorage, sessionStorage, info, etc.)
            if (modernMethods.has(methodName)) {
              const statement = path.getStatementParent();
              if (statement && !nodesToRemove.includes(statement)) {
                // Track comments to remove
                if (statement.node.leadingComments) {
                  statement.node.leadingComments.forEach(comment => {
                    commentsToRemove.add(comment);
                  });
                }
                nodesToRemove.push(statement);
                removedCount++;
                if (this.options.verbose) {
                  console.log(chalk.gray(`    Removing old _.${methodName} and its comments`));
                }
              }
            }
          }
        },

        // Also handle the initial "var _ = { trim: ... }" object
        VariableDeclarator: (path) => {
          if (path.node.id?.name === '_' &&
              path.node.init?.type === 'ObjectExpression') {

            // Remove properties that we're replacing
            const propsToRemove = [];
            path.node.init.properties.forEach((prop) => {
              const propName = prop.key?.name || prop.key?.value;
              if (propName && modernMethods.has(propName)) {
                propsToRemove.push(prop);
                if (this.options.verbose) {
                  console.log(chalk.gray(`    Removing old _.${propName} from initial object`));
                }
              }
            });

            // Remove the properties
            path.node.init.properties = path.node.init.properties.filter(
              prop => !propsToRemove.includes(prop)
            );

            removedCount += propsToRemove.length;
          }
        }
      });

      console.log(chalk.gray(`    Removed ${removedCount} old method implementations`));

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code with old methods removed (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      // Now replace the empty "var _ = {};" with the full modern implementation
      const codeLines = output.code.split('\n');

      // Find "var _ = " which might be formatted as "var _ = {}" or "var _ = { }"
      let underscoreLineIdx = codeLines.findIndex(line => /var\s+_\s*=\s*\{/.test(line.trim()));

      if (underscoreLineIdx === -1) {
        throw new Error('Could not find "var _ = {" declaration');
      }

      // Find the closing }; of the _ object
      let underscoreEndIdx = underscoreLineIdx;
      let braceCount = 0;
      for (let i = underscoreLineIdx; i < codeLines.length; i++) {
        const line = codeLines[i];
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        if (braceCount === 0 && i > underscoreLineIdx) {
          underscoreEndIdx = i;
          break;
        }
      }

      // Extract the full modern underscore implementation from tools/_.js
      const modernUnderscoreLines = modernUnderscore.split('\n');
      // Skip the comment on line 1, keep from "var _ = {" to the end
      const modernImpl = modernUnderscoreLines.slice(1).join('\n');

      // Replace the old _ declaration with the modern one
      const newCodeLines = [
        ...codeLines.slice(0, underscoreLineIdx), // Everything before "var _ = {"
        modernImpl,                                // Modern implementation
        ...codeLines.slice(underscoreEndIdx + 1)   // Everything after closing };
      ];

      const finalCode = newCodeLines.join('\n');

      console.log(chalk.gray(`    Replaced _ declaration with ${modernMethods.size} modern methods`));

      // Parse and regenerate through Babel to ensure consistent formatting
      console.log(chalk.gray(`    Running through Babel for consistent formatting...`));
      const finalAst = parser.parse(finalCode, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      const finalOutput = generate(finalAst, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return finalOutput.code;
    } catch (error) {
      console.log(chalk.red('Error modernizing underscore:'), error.message);
      throw error;
    }
  }

  async removeUnusedInitCode(code) {
    try {
      console.log(chalk.gray('  Removing unused code from _init and reset methods...'));

      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      let removedCount = 0;

      traverse(ast, {
        AssignmentExpression: (path) => {
          const isInitMethod = path.node.left?.type === 'MemberExpression' &&
              path.node.left.object?.type === 'MemberExpression' &&
              path.node.left.object.object?.name === 'MixpanelLib' &&
              path.node.left.object.property?.name === 'prototype' &&
              path.node.left.property?.name === '_init';

          const isResetMethod = path.node.left?.type === 'MemberExpression' &&
              path.node.left.object?.type === 'MemberExpression' &&
              path.node.left.object.object?.name === 'MixpanelLib' &&
              path.node.left.object.property?.name === 'prototype' &&
              path.node.left.property?.name === 'reset';

          // Find MixpanelLib.prototype._init = function() { ... }
          if (isInitMethod) {

            // Get the function body
            const funcBody = path.node.right?.body?.body;
            if (!funcBody || !Array.isArray(funcBody)) {
              return;
            }

            const nodesToRemove = [];

            // Traverse through function body statements
            for (let i = 0; i < funcBody.length; i++) {
              const statement = funcBody[i];

              // 1. Remove: this._batch_requests = this.get_config('batch_requests');
              if (statement.type === 'ExpressionStatement' &&
                  statement.expression?.type === 'AssignmentExpression') {
                const left = statement.expression.left;
                if (left?.object?.type === 'ThisExpression' &&
                    left?.property?.name === '_batch_requests') {
                  nodesToRemove.push(i);
                  console.log(chalk.gray('    Removing: this._batch_requests assignment'));
                  removedCount++;
                  continue;
                }
              }

              // 2. Remove: if (this._batch_requests) { ... }
              if (statement.type === 'IfStatement' &&
                  statement.test?.type === 'MemberExpression' &&
                  statement.test.object?.type === 'ThisExpression' &&
                  statement.test.property?.name === '_batch_requests') {
                nodesToRemove.push(i);
                console.log(chalk.gray('    Removing: if (this._batch_requests) block'));
                removedCount++;
                continue;
              }

              // 3. Remove: this._gdpr_init();
              if (statement.type === 'ExpressionStatement' &&
                  statement.expression?.type === 'CallExpression' &&
                  statement.expression.callee?.type === 'MemberExpression' &&
                  statement.expression.callee.object?.type === 'ThisExpression' &&
                  statement.expression.callee.property?.name === '_gdpr_init') {
                nodesToRemove.push(i);
                console.log(chalk.gray('    Removing: this._gdpr_init() call'));
                removedCount++;
                continue;
              }

              // 4. Remove flags block: this.flags = new FeatureFlagManager(...)
              if (statement.type === 'ExpressionStatement' &&
                  statement.expression?.type === 'AssignmentExpression') {
                const left = statement.expression.left;
                const right = statement.expression.right;

                if (left?.object?.type === 'ThisExpression' &&
                    left?.property?.name === 'flags' &&
                    right?.type === 'NewExpression' &&
                    right.callee?.name === 'FeatureFlagManager') {
                  nodesToRemove.push(i);
                  console.log(chalk.gray('    Removing: this.flags = new FeatureFlagManager(...)'));
                  removedCount++;
                  // Continue removing statements until we hit autocapture.init()
                  for (let j = i + 1; j < funcBody.length; j++) {
                    const nextStmt = funcBody[j];
                    nodesToRemove.push(j);
                    removedCount++;

                    // Check if this is autocapture.init()
                    if (nextStmt.type === 'ExpressionStatement' &&
                        nextStmt.expression?.type === 'CallExpression' &&
                        nextStmt.expression.callee?.type === 'MemberExpression' &&
                        nextStmt.expression.callee.object?.type === 'MemberExpression' &&
                        nextStmt.expression.callee.object.object?.type === 'ThisExpression' &&
                        nextStmt.expression.callee.object.property?.name === 'autocapture' &&
                        nextStmt.expression.callee.property?.name === 'init') {
                      console.log(chalk.gray('    Removed through: this.autocapture.init()'));
                      i = j; // Skip ahead
                      break;
                    }
                  }
                  continue;
                }
              }

              // 5. Remove: this._check_and_start_session_recording();
              if (statement.type === 'ExpressionStatement' &&
                  statement.expression?.type === 'CallExpression' &&
                  statement.expression.callee?.type === 'MemberExpression' &&
                  statement.expression.callee.object?.type === 'ThisExpression' &&
                  statement.expression.callee.property?.name === '_check_and_start_session_recording') {
                nodesToRemove.push(i);
                console.log(chalk.gray('    Removing: this._check_and_start_session_recording() call'));
                removedCount++;
                continue;
              }
            }

            // Remove statements in reverse order to maintain correct indices
            nodesToRemove.sort((a, b) => b - a).forEach(index => {
              funcBody.splice(index, 1);
            });
          }

          // Find MixpanelLib.prototype.reset = function() { ... }
          if (isResetMethod) {
            // Get the function body
            const funcBody = path.node.right?.body?.body;
            if (!funcBody || !Array.isArray(funcBody)) {
              return;
            }

            const nodesToRemove = [];

            // Traverse through function body statements
            for (let i = 0; i < funcBody.length; i++) {
              const statement = funcBody[i];

              // Remove: this.stop_session_recording();
              // Remove: this._check_and_start_session_recording();
              if (statement.type === 'ExpressionStatement' &&
                  statement.expression?.type === 'CallExpression' &&
                  statement.expression.callee?.type === 'MemberExpression' &&
                  statement.expression.callee.object?.type === 'ThisExpression' &&
                  (statement.expression.callee.property?.name === 'stop_session_recording' ||
                   statement.expression.callee.property?.name === '_check_and_start_session_recording')) {
                nodesToRemove.push(i);
                console.log(chalk.gray(`    Removing from reset: this.${statement.expression.callee.property.name}() call`));
                removedCount++;
                continue;
              }
            }

            // Remove statements in reverse order to maintain correct indices
            nodesToRemove.sort((a, b) => b - a).forEach(index => {
              funcBody.splice(index, 1);
            });
          }

          // Find MixpanelLib.prototype.track and replace get_session_recording_properties() call
          const isTrackMethod = path.node.left?.type === 'MemberExpression' &&
              path.node.left.object?.type === 'MemberExpression' &&
              path.node.left.object.object?.name === 'MixpanelLib' &&
              path.node.left.object.property?.name === 'prototype' &&
              path.node.left.property?.name === 'track';

          if (isTrackMethod) {
            // Traverse the entire function body to find the get_session_recording_properties call
            traverse(path.node.right, {
              CallExpression(callPath) {
                // Look for this.get_session_recording_properties()
                if (callPath.node.callee?.type === 'MemberExpression' &&
                    callPath.node.callee.object?.type === 'ThisExpression' &&
                    callPath.node.callee.property?.name === 'get_session_recording_properties') {

                  // Replace the call with an empty object literal: {}
                  callPath.replaceWith(t.objectExpression([]));
                  console.log(chalk.gray('    Replacing: this.get_session_recording_properties() with {}'));
                  removedCount++;
                }
              }
            }, path.scope);
          }

          // Find MixpanelLib.prototype.identify and remove this.flags.fetchFlags() call
          const isIdentifyMethod = path.node.left?.type === 'MemberExpression' &&
              path.node.left.object?.type === 'MemberExpression' &&
              path.node.left.object.object?.name === 'MixpanelLib' &&
              path.node.left.object.property?.name === 'prototype' &&
              path.node.left.property?.name === 'identify';

          if (isIdentifyMethod) {
            // Get the function body
            const funcBody = path.node.right?.body?.body;
            if (funcBody && Array.isArray(funcBody)) {
              const nodesToRemove = [];

              // Find if (new_distinct_id !== previous_distinct_id) { this.flags.fetchFlags(); }
              for (let i = 0; i < funcBody.length; i++) {
                const statement = funcBody[i];

                if (statement.type === 'IfStatement' &&
                    statement.test?.type === 'BinaryExpression' &&
                    statement.test.operator === '!==' &&
                    statement.consequent?.type === 'BlockStatement') {

                  // Check if the block contains this.flags.fetchFlags()
                  const block = statement.consequent.body;
                  for (let j = 0; j < block.length; j++) {
                    const blockStmt = block[j];
                    if (blockStmt.type === 'ExpressionStatement' &&
                        blockStmt.expression?.type === 'CallExpression' &&
                        blockStmt.expression.callee?.type === 'MemberExpression' &&
                        blockStmt.expression.callee.object?.type === 'MemberExpression' &&
                        blockStmt.expression.callee.object.object?.type === 'ThisExpression' &&
                        blockStmt.expression.callee.object.property?.name === 'flags' &&
                        blockStmt.expression.callee.property?.name === 'fetchFlags') {

                      // Remove just this statement from the block
                      block.splice(j, 1);
                      console.log(chalk.gray('    Removing from identify: this.flags.fetchFlags() call'));
                      removedCount++;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      });

      console.log(chalk.gray(`  Removed ${removedCount} statements from _init and reset methods`));

      // Generate code
      const output = generate(ast, {
        sourceMaps: false,
        comments: true,
        shouldPrintComment: () => true,
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return output.code;
    } catch (error) {
      console.log(chalk.red('Error removing unused init code:'), error.message);
      throw error;
    }
  }

  async removeWriteOnlyVariables(code, iteration = 1) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Step 1: Find all top-level variable declarations
      const variables = new Map(); // Map<name, { path, varDeclarationPath, isWritten, isRead }>

      traverse(ast, {
        VariableDeclarator: (path) => {
          const varDeclaration = path.findParent((p) => p.isVariableDeclaration());
          if (varDeclaration && varDeclaration.parent.type === 'Program') {
            const name = path.node.id?.name;
            if (name) {
              variables.set(name, {
                path: path,
                varDeclarationPath: varDeclaration,
                isWritten: false,
                isRead: false,
                name: name
              });
            }
          }
        }
      });

      if (this.options.verbose || iteration === 1) {
        console.log(chalk.gray(`    Checking ${variables.size} top-level variables for write-only pattern`));
      }

      // Step 2: Analyze usage patterns
      traverse(ast, {
        Identifier: (path) => {
          const name = path.node.name;

          if (variables.has(name)) {
            const varInfo = variables.get(name);

            // Skip the declaration itself
            if (path === varInfo.path.get('id')) {
              return;
            }

            // Check if this identifier has a binding to our variable
            const binding = path.scope.getBinding(name);
            if (!binding || binding.path !== varInfo.path) {
              return; // Not our variable
            }

            // Check if this is on the LEFT side of a member expression assignment
            // Example: CONFIG_DEFAULTS$1[key] = value
            const parent = path.parent;
            if (parent.type === 'MemberExpression' && parent.object === path.node) {
              // This variable is the object in a member expression
              const grandParent = path.parentPath.parent;

              if (grandParent?.type === 'AssignmentExpression' && grandParent.left === parent) {
                // This is: variable[key] = value (write operation)
                varInfo.isWritten = true;
              } else {
                // This is a read operation: x = variable[key] or variable[key].method()
                varInfo.isRead = true;
              }
            } else if (parent.type === 'AssignmentExpression' && parent.left === path.node) {
              // This is: variable = value (write operation)
              varInfo.isWritten = true;
            } else {
              // Any other usage is a read operation
              varInfo.isRead = true;
            }
          }
        }
      });

      // Step 3: Find variables that are only written to, never read
      const writeOnlyVariables = new Set();
      const nodesToRemove = [];

      for (const [name, varInfo] of variables.entries()) {
        if (varInfo.isWritten && !varInfo.isRead) {
          writeOnlyVariables.add(name);

          // Remove the variable declaration
          const varDecl = varInfo.varDeclarationPath;
          if (varDecl.node.declarations.length === 1) {
            nodesToRemove.push(varDecl);
          } else {
            nodesToRemove.push(varInfo.path);
          }

          if (this.options.verbose) {
            console.log(chalk.gray(`    Found write-only variable: ${name}`));
          }
        }
      }

      if (this.options.verbose || iteration === 1) {
        console.log(chalk.gray(`    Found ${writeOnlyVariables.size} write-only variables`));
      }

      // Step 4: Remove all property assignments to these write-only variables
      // Example: CONFIG_DEFAULTS$1[CONFIG_ALLOW_SELECTORS] = [];
      traverse(ast, {
        ExpressionStatement: (path) => {
          const expr = path.node.expression;

          // Check for: variable[key] = value
          if (expr?.type === 'AssignmentExpression' &&
              expr.left?.type === 'MemberExpression' &&
              expr.left.object?.type === 'Identifier') {

            const varName = expr.left.object.name;
            if (writeOnlyVariables.has(varName)) {
              if (!nodesToRemove.includes(path)) {
                nodesToRemove.push(path);
                if (this.options.verbose) {
                  console.log(chalk.gray(`    Removing property assignment: ${varName}[...] = ...`));
                }
              }
            }
          }
        }
      });

      // Remove collected nodes
      nodesToRemove.forEach(path => {
        try {
          if (path && path.node) {
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate code (comments already removed in Pass 1)
      const output = generate(ast, {
        sourceMaps: false,
        comments: false, // Comments already stripped
        compact: false,
        concise: false,
        minified: false,
        retainLines: false,
        jsescOption: {
          minimal: true
        }
      });

      return {
        code: output.code,
        removedCount: writeOnlyVariables.size
      };
    } catch (error) {
      console.log(chalk.red('Error removing write-only variables:'), error.message);
      throw error;
    }
  }

  async saveTrimmedFile(code, pass = 1) {
    if (this.options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN MODE - No files will be modified'));
      this.trimmedSize = Buffer.byteLength(code, 'utf8');
      return;
    }

    // Create output filename with pass number
    const outputFile = this.options.outputFile.replace(/\.cjs\.js$/, `-${pass}.cjs.js`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Add header comment
    const header = `/**
 * Mixpanel Minimal - Trimmed Version (Pass ${pass})
 * Generated: ${new Date().toISOString()}
 * Original size: ${this.formatSize(this.originalSize)}
 * Removed ${this.removedMethods.size} unused methods
 * Removed ${this.removedPrototypeAliases.size} prototype aliases
 * Removed ${this.removedExports.size} exports
 *
 * Kept methods: ${Array.from(this.usedMethods).join(', ')}
 */

`;

    const codeWithHeader = header + code;

    // Write raw trimmed file to disk first
    console.log(chalk.gray(`Writing pass ${pass} to disk...`));
    fs.writeFileSync(outputFile, codeWithHeader);

    // Now prettify using Prettier CLI (ensures 100% consistent formatting with prettified original)
    console.log(chalk.gray(`Prettifying pass ${pass} file...`));
    const { execSync } = require('child_process');
    try {
      execSync(`npx prettier --write "${outputFile}"`, { stdio: 'pipe' });
      const prettified = fs.readFileSync(outputFile, 'utf-8');
      this.trimmedSize = Buffer.byteLength(prettified, 'utf8');
      console.log(chalk.green(`✓ Pass ${pass} saved to: ${outputFile}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Prettier CLI formatting failed: ${error.message}`));
      // Keep the unprettified version
      this.trimmedSize = Buffer.byteLength(codeWithHeader, 'utf8');
      console.log(chalk.yellow(`✓ Pass ${pass} saved (unprettified) to: ${outputFile}`));
    }
  }

  formatSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  printSummary() {
    const reduction = ((this.originalSize - this.trimmedSize) / this.originalSize * 100).toFixed(2);

    // Calculate lines removed
    const originalPath = this.options.inputFile.replace(/\.cjs\.js$/, '-prettified.cjs.js');
    const trimmedPath = this.options.outputFile.replace(/\.cjs\.js$/, '-7.cjs.js');

    let linesRemoved = 0;
    if (fs.existsSync(originalPath) && fs.existsSync(trimmedPath)) {
      const originalLines = fs.readFileSync(originalPath, 'utf-8').split('\n').length;
      const trimmedLines = fs.readFileSync(trimmedPath, 'utf-8').split('\n').length;
      linesRemoved = originalLines - trimmedLines;
    }

    console.log(chalk.blue('\n📊 Trimming Summary:'));
    console.log(`  • Original size: ${this.formatSize(this.originalSize)}`);
    console.log(`  • Trimmed size: ${this.formatSize(this.trimmedSize)}`);
    console.log(`  • Size reduction: ${reduction}% (${this.formatSize(this.originalSize - this.trimmedSize)})`);
    console.log(`  • Methods removed: ${this.removedMethods.size}`);
    console.log(`  • Lines removed: ~${linesRemoved}`);

    if (this.options.dryRun) {
      console.log(chalk.yellow('\n⚠️  This was a dry run - no files were modified'));
      console.log(chalk.yellow('Run without --dry-run to actually trim the file'));
    }

    if (this.removedMethods.size > 0 && this.options.verbose) {
      console.log(chalk.gray('\nRemoved methods:'));
      Array.from(this.removedMethods).sort().forEach(method => {
        console.log(chalk.gray(`  - ${method}`));
      });
    }
  }
}

// CLI Interface
program
  .name('mixpanel-trim')
  .description('Trim unused methods from Mixpanel library based on methods-to-keep.json')
  .version('1.0.0')
  .option('-i, --input <file>', 'Input Mixpanel file', './src/original/mixpanel.cjs.js')
  .option('-o, --output <file>', 'Output trimmed file', './src/trimmed/mixpanel-trimmed.cjs.js')
  .option('-m, --methods <file>', 'Methods config file', './methods-to-keep.json')
  .option('-k, --keep <methods>', 'Additional methods to keep (comma-separated)', (val) => val.split(','))
  .option('-a, --aggressive', 'Aggressive trimming (removes more code)', false)
  .option('--no-comments', 'Strip comments (comments are preserved by default)', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('-d, --dry-run', 'Preview what would be removed without modifying files', false)
  .option('--no-sourcemap', 'Disable source map generation')
  .action(async (options) => {
    try {
      const trimmer = new MixpanelTrimmer({
        inputFile: options.input,
        outputFile: options.output,
        methodsFile: options.methods,
        keepMethods: options.keep || [],
        aggressive: options.aggressive,
        preserveComments: options.comments,
        sourceMap: options.sourcemap !== false,
        verbose: options.verbose,
        dryRun: options.dryRun
      });

      await trimmer.trim();
    } catch (error) {
      console.log(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();

module.exports = MixpanelTrimmer;
