#!/usr/bin/env node

/**
 * Dead Code Finder
 * Helps identify potentially unused code patterns in JavaScript files
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const chalk = require('chalk');
const { program } = require('commander');

class DeadCodeFinder {
  constructor(options = {}) {
    this.options = {
      file: options.file || './src/trimmed/mixpanel-trimmed.cjs.js',
      verbose: options.verbose || false,
      showContext: options.showContext || false
    };

    this.definitions = new Map(); // Where things are defined
    this.usages = new Map(); // Where things are used
    this.prototypeAliases = new Map(); // Prototype assignments
    this.exports = new Set(); // Exported items
    this.possiblyDead = new Set();
  }

  async analyze() {
    console.log(chalk.blue('🔍 Searching for dead code patterns...\n'));

    const code = fs.readFileSync(this.options.file, 'utf-8');
    const ast = parser.parse(code, {
      sourceType: 'script',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true
    });

    // First pass: collect all definitions
    this.collectDefinitions(ast);

    // Second pass: collect all usages
    this.collectUsages(ast);

    // Analyze what might be dead
    this.identifyDeadCode();

    // Report findings
    this.report();
  }

  collectDefinitions(ast) {
    traverse(ast, {
      // Function declarations
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name) {
          const loc = path.node.loc;
          this.definitions.set(name, {
            type: 'function',
            line: loc?.start.line,
            column: loc?.start.column
          });
        }
      },

      // Variable declarations
      VariableDeclarator: (path) => {
        const name = path.node.id?.name;
        if (name) {
          const loc = path.node.loc;
          const value = path.node.init;
          let type = 'variable';

          if (value?.type === 'FunctionExpression' ||
              value?.type === 'ArrowFunctionExpression') {
            type = 'function';
          } else if (value?.type === 'ObjectExpression') {
            type = 'object';
          }

          this.definitions.set(name, {
            type,
            line: loc?.start.line,
            column: loc?.start.column
          });
        }
      },

      // Prototype assignments
      AssignmentExpression: (path) => {
        const left = path.node.left;
        const right = path.node.right;

        // Track prototype aliases
        if (left?.type === 'MemberExpression' &&
            right?.type === 'MemberExpression') {

          const leftProp = this.getMemberName(left);
          const rightProp = this.getMemberName(right);

          if (leftProp && rightProp && leftProp.includes('prototype')) {
            const loc = path.node.loc;
            this.prototypeAliases.set(leftProp, {
              source: rightProp,
              line: loc?.start.line
            });
          }
        }

        // Track regular assignments
        if (left?.type === 'MemberExpression') {
          const name = this.getMemberName(left);
          if (name) {
            const loc = path.node.loc;
            this.definitions.set(name, {
              type: 'assignment',
              line: loc?.start.line
            });
          }
        }
      },

      // Object methods
      ObjectMethod: (path) => {
        const key = path.node.key?.name;
        if (key) {
          const loc = path.node.loc;
          this.definitions.set(key, {
            type: 'method',
            line: loc?.start.line
          });
        }
      },

      // Object properties
      ObjectProperty: (path) => {
        const key = path.node.key?.name || path.node.key?.value;
        if (key && path.node.value?.type === 'FunctionExpression') {
          const loc = path.node.loc;
          this.definitions.set(key, {
            type: 'method',
            line: loc?.start.line
          });
        }
      }
    });
  }

  collectUsages(ast) {
    traverse(ast, {
      // Function calls
      CallExpression: (path) => {
        const callee = path.node.callee;

        // Direct function call
        if (callee?.type === 'Identifier') {
          this.addUsage(callee.name, path.node.loc?.start.line);
        }

        // Method call
        if (callee?.type === 'MemberExpression') {
          const name = this.getMemberName(callee);
          if (name) {
            this.addUsage(name, path.node.loc?.start.line);

            // Also mark the object as used
            if (callee.object?.name) {
              this.addUsage(callee.object.name, path.node.loc?.start.line);
            }
          }
        }
      },

      // Variable references
      Identifier: (path) => {
        // Skip if it's a definition context
        if (path.isBindingIdentifier() ||
            path.isReferencedIdentifier() === false) {
          return;
        }

        // Skip property keys
        if (path.parent?.type === 'ObjectProperty' &&
            path.parent.key === path.node) {
          return;
        }

        this.addUsage(path.node.name, path.node.loc?.start.line);
      },

      // Member expressions (property access)
      MemberExpression: (path) => {
        const name = this.getMemberName(path.node);
        if (name) {
          this.addUsage(name, path.node.loc?.start.line);
        }
      },

      // Exports
      ExpressionStatement: (path) => {
        const expr = path.node.expression;
        if (expr?.type === 'AssignmentExpression') {
          const left = expr.left;

          // module.exports or exports
          if (left?.type === 'MemberExpression') {
            const obj = left.object;
            if (obj?.name === 'exports' ||
                (obj?.object?.name === 'module' &&
                 obj?.property?.name === 'exports')) {

              // Track what's being exported
              if (left.property?.name) {
                this.exports.add(left.property.name);
              }

              // Mark the exported value as used
              if (expr.right?.name) {
                this.addUsage(expr.right.name, path.node.loc?.start.line);
              }
            }
          }
        }
      }
    });
  }

  getMemberName(node) {
    if (!node || node.type !== 'MemberExpression') return null;

    let result = '';
    let current = node;

    while (current?.type === 'MemberExpression') {
      const prop = current.property?.name ||
                   current.property?.value ||
                   (current.computed ? '[]' : '');

      result = prop + (result ? '.' + result : '');
      current = current.object;
    }

    if (current?.name) {
      result = current.name + (result ? '.' + result : '');
    }

    return result;
  }

  addUsage(name, line) {
    if (!this.usages.has(name)) {
      this.usages.set(name, []);
    }
    if (line) {
      this.usages.get(name).push(line);
    }
  }

  identifyDeadCode() {
    // Check each definition
    for (const [name, def] of this.definitions) {
      const usageCount = this.usages.get(name)?.length || 0;

      // Skip if it's exported
      if (this.exports.has(name)) continue;

      // Skip if it's the main export
      if (name === 'mixpanel' || name === 'MixpanelLib') continue;

      // Skip built-in methods
      if (['constructor', 'prototype', 'toString', 'valueOf'].includes(name)) continue;

      // If defined but never used
      if (usageCount === 0) {
        this.possiblyDead.add(name);
      }

      // If only used once (might just be the definition)
      if (usageCount === 1 && def.type === 'function') {
        const usageLine = this.usages.get(name)[0];
        if (Math.abs(usageLine - def.line) <= 1) {
          this.possiblyDead.add(name);
        }
      }
    }

    // Check prototype aliases
    for (const [alias, info] of this.prototypeAliases) {
      const sourceName = info.source.split('.').pop();
      if (!this.definitions.has(sourceName) || this.possiblyDead.has(sourceName)) {
        this.possiblyDead.add(alias);
      }
    }
  }

  report() {
    console.log(chalk.yellow('⚠️  Potentially Dead Code:\n'));

    // Group by type
    const byType = {
      function: [],
      variable: [],
      method: [],
      assignment: [],
      object: []
    };

    for (const name of this.possiblyDead) {
      const def = this.definitions.get(name);
      if (def) {
        byType[def.type]?.push({ name, ...def });
      }
    }

    // Report each type
    for (const [type, items] of Object.entries(byType)) {
      if (items.length > 0) {
        console.log(chalk.blue(`\n${type.toUpperCase()}S (${items.length}):`));

        items.sort((a, b) => a.line - b.line).forEach(item => {
          const usageCount = this.usages.get(item.name)?.length || 0;
          console.log(chalk.gray(`  Line ${item.line}:`),
                      chalk.white(item.name),
                      chalk.gray(`(used ${usageCount} times)`));

          if (this.options.showContext && usageCount > 0) {
            const lines = this.usages.get(item.name);
            console.log(chalk.gray(`    Used at lines: ${lines.join(', ')}`));
          }
        });
      }
    }

    // Report prototype aliases
    const deadAliases = [];
    for (const [alias, info] of this.prototypeAliases) {
      if (this.possiblyDead.has(alias)) {
        deadAliases.push({ alias, ...info });
      }
    }

    if (deadAliases.length > 0) {
      console.log(chalk.blue(`\nPROTOTYPE ALIASES (${deadAliases.length}):`));
      deadAliases.forEach(item => {
        console.log(chalk.gray(`  Line ${item.line}:`),
                    chalk.white(item.alias),
                    chalk.gray('->'),
                    chalk.white(item.source));
      });
    }

    // Summary
    console.log(chalk.blue('\n📊 Summary:'));
    console.log(`  Total definitions: ${this.definitions.size}`);
    console.log(`  Potentially dead: ${this.possiblyDead.size}`);
    console.log(`  Percentage: ${((this.possiblyDead.size / this.definitions.size) * 100).toFixed(1)}%`);

    const savings = this.possiblyDead.size * 5; // Rough estimate of lines per item
    console.log(chalk.green(`  Estimated lines to remove: ~${savings}`));

    if (this.options.verbose) {
      console.log(chalk.gray('\nNote: Review each item carefully before removing.'));
      console.log(chalk.gray('Some items may be used dynamically or required internally.'));
    }
  }
}

// CLI
program
  .name('find-dead-code')
  .description('Find potentially dead code in JavaScript files')
  .version('1.0.0')
  .option('-f, --file <path>', 'File to analyze', './src/trimmed/mixpanel-trimmed.cjs.js')
  .option('-v, --verbose', 'Verbose output', false)
  .option('-c, --context', 'Show usage context', false)
  .action(async (options) => {
    const finder = new DeadCodeFinder({
      file: options.file,
      verbose: options.verbose,
      showContext: options.context
    });
    await finder.analyze();
  });

program.parse();

module.exports = DeadCodeFinder;