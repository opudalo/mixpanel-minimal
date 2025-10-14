#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const chalk = require('chalk');
const { program } = require('commander');

class MixpanelTrimmer {
  constructor(options = {}) {
    this.options = {
      inputFile: options.inputFile || './src/original/mixpanel.cjs.js',
      outputFile: options.outputFile || './src/trimmed/mixpanel-trimmed.cjs.js',
      methodsFile: options.methodsFile || './methods-to-keep.json',
      keepMethods: options.keepMethods || [],
      aggressive: options.aggressive || false,
      preserveComments: options.preserveComments !== false, // Default to true (preserve comments)
      sourceMap: options.sourceMap || true,
      verbose: options.verbose || false,
      dryRun: options.dryRun || false
    };

    this.usedMethods = new Set(this.options.keepMethods);
    this.removedMethods = new Set();
    this.removedPrototypeAliases = new Set();
    this.removedExports = new Set();
    this.removedLines = 0;
    this.originalSize = 0;
    this.trimmedSize = 0;
  }

  async trim() {
    console.log(chalk.blue('✂️  Starting Mixpanel trimming process...'));

    // Load methods to keep
    await this.loadMethodsToKeep();

    // Read original file
    const originalCode = await this.readOriginalFile();

    // Parse and trim
    const trimmedCode = await this.processCode(originalCode);

    // Save trimmed file
    await this.saveTrimmedFile(trimmedCode);

    // Generate summary
    this.printSummary();
  }

  async loadMethodsToKeep() {
    if (fs.existsSync(this.options.methodsFile)) {
      const config = JSON.parse(fs.readFileSync(this.options.methodsFile, 'utf-8'));

      // Add main methods
      if (config.methods) {
        config.methods.forEach(method => this.usedMethods.add(method));
      }

      // Add people methods (these will be properties under 'people' object)
      if (config.peopleMethods) {
        config.peopleMethods.forEach(method => {
          this.usedMethods.add(method);
          this.usedMethods.add(`people.${method}`);
        });
      }

      // Always keep 'people' object itself if we have people methods
      if (config.peopleMethods && config.peopleMethods.length > 0) {
        this.usedMethods.add('people');
      }

      console.log(chalk.gray(`Loaded ${this.usedMethods.size} methods to keep from config`));
    } else {
      console.log(chalk.yellow('⚠️  No methods config found. Using default essential methods.'));
      // Add default essential methods
      ['init', 'track', 'identify', 'reset'].forEach(m => this.usedMethods.add(m));
    }

    // Add any additional methods from command line
    if (this.options.keepMethods && this.options.keepMethods.length > 0) {
      this.options.keepMethods.forEach(method => this.usedMethods.add(method));
    }

    if (this.options.verbose) {
      console.log(chalk.gray('Keeping methods:'), Array.from(this.usedMethods).join(', '));
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

  async processCode(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true,
        attachComment: this.options.preserveComments
      });

      // Pre-scan: Collect ALL references to identifiers to avoid removing used functions
      const referencedIdentifiers = new Set();
      traverse(ast, {
        // Collect all identifier references (except declarations)
        Identifier: (path) => {
          // Skip if this is a declaration (function name, variable name, etc.)
          if (path.isBindingIdentifier()) return;
          if (path.isFunctionDeclaration()) return;

          // Skip property keys in member expressions (the .method part)
          if (path.parent?.type === 'MemberExpression' &&
              path.parent.property === path.node &&
              !path.parent.computed) {
            return;
          }

          // Skip keys in object properties
          if (path.parent?.type === 'ObjectProperty' &&
              path.parent.key === path.node &&
              !path.parent.computed) {
            return;
          }

          // This is a reference to an identifier - mark it as used
          referencedIdentifiers.add(path.node.name);
        },

        // Also collect string literals used in bracket notation that might reference functions
        MemberExpression: (path) => {
          if (path.node.computed &&
              (path.node.property?.type === 'StringLiteral' ||
               path.node.property?.type === 'Literal')) {
            const name = path.node.property.value;
            if (typeof name === 'string') {
              referencedIdentifiers.add(name);
            }
          }
        },

        // Collect function names passed as arguments
        CallExpression: (path) => {
          path.node.arguments?.forEach(arg => {
            if (arg.type === 'Identifier') {
              referencedIdentifiers.add(arg.name);
            }
          });
        },

        // Collect right-hand side of assignments
        AssignmentExpression: (path) => {
          if (path.node.right?.type === 'Identifier') {
            referencedIdentifiers.add(path.node.right.name);
          }
        }
      });

      // Log referenced identifiers if verbose
      if (this.options.verbose) {
        console.log(chalk.blue(`\nFound ${referencedIdentifiers.size} referenced identifiers`));
        if (referencedIdentifiers.size < 100) {
          console.log(chalk.gray('Referenced:', Array.from(referencedIdentifiers).sort().join(', ')));
        }
      }

      // Track what to remove
      const nodesToRemove = [];
      const methodDependencies = new Map();

      // First pass: identify all methods and their dependencies
      traverse(ast, {
        // Function declarations
        FunctionDeclaration: (path) => {
          const name = path.node.id?.name;
          if (name && !this.isMethodUsed(name) && !referencedIdentifiers.has(name)) {
            nodesToRemove.push(path);
            this.removedMethods.add(name);
            this.trackDependencies(path, methodDependencies);
            if (this.options.verbose) {
              console.log(chalk.gray(`  Marking for removal: function ${name}`));
            }
          } else if (name && referencedIdentifiers.has(name) && this.options.verbose) {
            console.log(chalk.green(`  Keeping: function ${name} (referenced)`));
          }
        },

        // Variable declarations with function expressions
        VariableDeclaration: (path) => {
          path.node.declarations.forEach((declarator, index) => {
            const name = declarator.id?.name;
            if (name &&
                (declarator.init?.type === 'FunctionExpression' ||
                 declarator.init?.type === 'ArrowFunctionExpression') &&
                !this.isMethodUsed(name) &&
                !referencedIdentifiers.has(name)) {

              if (path.node.declarations.length === 1) {
                nodesToRemove.push(path);
              } else {
                // Remove only this declarator
                path.node.declarations.splice(index, 1);
              }
              this.removedMethods.add(name);
              if (this.options.verbose) {
                console.log(chalk.gray(`  Marking for removal: var/const ${name}`));
              }
            } else if (name && referencedIdentifiers.has(name) && this.options.verbose &&
                       (declarator.init?.type === 'FunctionExpression' ||
                        declarator.init?.type === 'ArrowFunctionExpression')) {
              console.log(chalk.green(`  Keeping: var/const ${name} (referenced)`));
            }
          });
        },

        // Object methods and properties
        ObjectExpression: (path) => {
          const properties = path.node.properties.filter(prop => {
            const key = prop.key?.name || prop.key?.value;

            if (!key) return true;

            // Check if this is a method that should be removed
            if ((prop.value?.type === 'FunctionExpression' ||
                 prop.value?.type === 'ArrowFunctionExpression' ||
                 prop.method) &&
                typeof key === 'string' &&
                !this.isMethodUsed(key) &&
                !referencedIdentifiers.has(key)) {
              this.removedMethods.add(key);
              if (this.options.verbose) {
                console.log(chalk.gray(`  Marking for removal: object method ${key}`));
              }
              return false; // Remove this property
            }

            return true; // Keep this property
          });

          path.node.properties = properties;
        },

        // Assignment expressions (prototype methods, etc.)
        AssignmentExpression: (path) => {
          if (path.node.left?.type === 'MemberExpression') {
            const property = path.node.left.property?.name || path.node.left.property?.value;

            // Don't remove if the right side is referenced elsewhere
            if (path.node.right?.type === 'Identifier' &&
                referencedIdentifiers.has(path.node.right.name)) {
              if (this.options.verbose) {
                console.log(chalk.green(`  Keeping assignment: ${path.node.right.name} is referenced`));
              }
              return;
            }

            if (property && typeof property === 'string' &&
                !this.isMethodUsed(property) && !referencedIdentifiers.has(property)) {
              const parent = path.getFunctionParent() || path.getStatementParent();
              if (parent) {
                nodesToRemove.push(parent);
                this.removedMethods.add(property);
                if (this.options.verbose) {
                  console.log(chalk.gray(`  Marking for removal: assignment to ${property}`));
                }
              }
            }
          }
        },

        // Remove unused IIFE (Immediately Invoked Function Expressions)
        CallExpression: (path) => {
          if (this.options.aggressive) {
            if (path.node.callee?.type === 'FunctionExpression' ||
                path.node.callee?.type === 'ArrowFunctionExpression') {
              // Check if this IIFE contains only unused methods
              const hasUsedMethods = this.containsUsedMethods(path.node.callee.body);
              if (!hasUsedMethods) {
                nodesToRemove.push(path.getStatementParent());
              }
            }
          }
        }
      });

      // Second pass: Remove prototype assignments and aliases for removed methods
      traverse(ast, {
        AssignmentExpression: (path) => {
          // Pattern: MixpanelLib.prototype['method'] = MixpanelLib.prototype.method
          const left = path.node.left;
          const right = path.node.right;

          if (left?.type === 'MemberExpression' && right?.type === 'MemberExpression') {
            // Check if this is a prototype assignment
            if (left.object?.property?.name === 'prototype' ||
                left.object?.type === 'MemberExpression' && left.object.property?.name === 'prototype') {

              // Get the method name from either side
              let methodName = null;

              // From left side (bracket notation)
              if (left.property?.type === 'Literal' || left.property?.type === 'StringLiteral') {
                methodName = left.property.value;
              }
              // From right side (dot notation)
              else if (right.property?.name) {
                methodName = right.property.name;
              }
              // From right side (bracket notation)
              else if (right.property?.type === 'Literal' || right.property?.type === 'StringLiteral') {
                methodName = right.property.value;
              }

              // If this method was removed, remove this assignment too
              if (methodName && typeof methodName === 'string' && this.removedMethods.has(methodName)) {
                this.removedPrototypeAliases.add(methodName);
                const parent = path.getStatementParent();
                if (parent && !nodesToRemove.includes(parent)) {
                  nodesToRemove.push(parent);
                  if (this.options.verbose || this.options.dryRun) {
                    console.log(chalk.gray(`  Removing prototype alias for: ${methodName}`));
                  }
                }
              }
            }
          }

          // Also handle pattern: something = removed_function
          if (right?.type === 'Identifier' && this.removedMethods.has(right.name)) {
            const parent = path.getStatementParent();
            if (parent && !nodesToRemove.includes(parent)) {
              nodesToRemove.push(parent);
            }
          }
        },

        // Remove references in arrays and objects to removed methods
        ObjectProperty: (path) => {
          if (path.node.value?.type === 'Identifier' &&
              this.removedMethods.has(path.node.value.name)) {
            path.remove();
          }
        },

        ArrayExpression: (path) => {
          path.node.elements = path.node.elements?.filter(element => {
            if (element?.type === 'Identifier') {
              return !this.removedMethods.has(element.name);
            }
            return true;
          });
        },

        // Handle module.exports and exports assignments
        MemberExpression: (path) => {
          if (path.parent?.type === 'AssignmentExpression' &&
              path.parent.left === path.node) {
            // Check for module.exports.removedMethod or exports.removedMethod
            if ((path.node.object?.name === 'exports' ||
                 (path.node.object?.object?.name === 'module' &&
                  path.node.object?.property?.name === 'exports')) &&
                path.node.property?.name &&
                this.removedMethods.has(path.node.property.name)) {
              const statement = path.getStatementParent();
              if (statement && !nodesToRemove.includes(statement)) {
                nodesToRemove.push(statement);
                this.removedExports.add(path.node.property.name);
                if (this.options.verbose || this.options.dryRun) {
                  console.log(chalk.gray(`  Removing export for: ${path.node.property.name}`));
                }
              }
            }
          }
        },

        // Remove empty var/let/const declarations after removing functions
        VariableDeclaration: (path) => {
          if (path.node.declarations.length === 0) {
            path.remove();
          }
        }
      });

      // Remove marked nodes
      nodesToRemove.forEach(path => {
        try {
          if (path.node) {
            this.removedLines += this.countLines(generate(path.node).code);
            path.remove();
          }
        } catch (err) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`Warning: Could not remove node: ${err.message}`));
          }
        }
      });

      // Generate trimmed code
      const output = generate(ast, {
        sourceMaps: this.options.sourceMap,
        comments: this.options.preserveComments,
        compact: false,
        concise: false,
        minified: false,
        retainLines: true, // Preserve line structure
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

  isMethodUsed(methodName) {
    // Ensure methodName is a string
    if (typeof methodName !== 'string') return false;

    // Check if method is in used set or matches patterns
    if (this.usedMethods.has(methodName)) return true;

    // Check for people.* methods
    if (this.usedMethods.has(`people.${methodName}`)) return true;

    // Check if this is a people method and we're keeping the people object
    if (this.usedMethods.has('people')) {
      // Check if this specific people method is in our list
      const peopleMethods = ['set', 'set_once', 'unset', 'increment', 'append',
                             'union', 'track_charge', 'clear_charges', 'delete_user'];
      if (peopleMethods.includes(methodName)) {
        return this.usedMethods.has(methodName) || this.usedMethods.has(`people.${methodName}`);
      }
    }

    return false;
  }

  containsUsedMethods(node) {
    let hasUsed = false;

    traverse(node, {
      FunctionDeclaration: (path) => {
        if (this.isMethodUsed(path.node.id?.name)) {
          hasUsed = true;
          path.stop();
        }
      },
      ObjectMethod: (path) => {
        if (this.isMethodUsed(path.node.key?.name)) {
          hasUsed = true;
          path.stop();
        }
      },
      noScope: true
    });

    return hasUsed;
  }

  trackDependencies(path, dependencies) {
    // Track which methods this function calls
    const methodName = path.node.id?.name || path.node.key?.name;
    if (!methodName) return;

    const calls = new Set();

    traverse(path.node, {
      CallExpression: (callPath) => {
        if (callPath.node.callee?.name) {
          calls.add(callPath.node.callee.name);
        } else if (callPath.node.callee?.property?.name) {
          calls.add(callPath.node.callee.property.name);
        }
      },
      noScope: true
    });

    dependencies.set(methodName, calls);
  }

  countLines(code) {
    return code.split('\n').length;
  }

  async saveTrimmedFile(code) {
    if (this.options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN MODE - No files will be modified'));
      this.trimmedSize = Buffer.byteLength(code, 'utf8');
      return;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(this.options.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Add header comment
    const header = `/**
 * Mixpanel Minimal - Trimmed Version
 * Generated: ${new Date().toISOString()}
 * Original size: ${this.formatSize(this.originalSize)}
 * Removed ${this.removedMethods.size} unused methods
 * Removed ${this.removedPrototypeAliases.size} prototype aliases
 * Removed ${this.removedExports.size} exports
 *
 * Kept methods: ${Array.from(this.usedMethods).join(', ')}
 */

`;

    const finalCode = header + code;
    fs.writeFileSync(this.options.outputFile, finalCode);

    this.trimmedSize = Buffer.byteLength(finalCode, 'utf8');
    console.log(chalk.green(`✓ Trimmed file saved to: ${this.options.outputFile}`));
  }

  formatSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  printSummary() {
    const reduction = ((this.originalSize - this.trimmedSize) / this.originalSize * 100).toFixed(2);

    console.log(chalk.blue('\n📊 Trimming Summary:'));
    console.log(`  • Original size: ${this.formatSize(this.originalSize)}`);
    console.log(`  • Trimmed size: ${this.formatSize(this.trimmedSize)}`);
    console.log(`  • Size reduction: ${reduction}% (${this.formatSize(this.originalSize - this.trimmedSize)})`);
    console.log(`  • Methods removed: ${this.removedMethods.size}`);
    console.log(`  • Prototype aliases removed: ${this.removedPrototypeAliases.size}`);
    console.log(`  • Export statements removed: ${this.removedExports.size}`);
    console.log(`  • Methods kept: ${this.usedMethods.size}`);
    console.log(`  • Lines removed: ~${this.removedLines}`);

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

    if (this.removedPrototypeAliases.size > 0 && this.options.verbose) {
      console.log(chalk.gray('\nRemoved prototype aliases:'));
      Array.from(this.removedPrototypeAliases).sort().forEach(method => {
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