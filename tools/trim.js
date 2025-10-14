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

    // Load methods to keep
    await this.loadMethodsToKeep();

    // Parse .d.ts to find all declared methods
    await this.parseTypeDefinitions();

    // Calculate methods to remove
    this.calculateMethodsToRemove();

    // Read original file
    const originalCode = await this.readOriginalFile();

    // Prettify original and save it to disk
    const prettifiedPath = await this.prettifyOriginal(originalCode);

    // Read the prettified file from disk (ensures exact same formatting)
    const prettifiedCode = fs.readFileSync(prettifiedPath, 'utf-8');
    console.log(chalk.gray(`Reading prettified file from disk: ${prettifiedPath}`));

    // Parse and trim the prettified version
    const trimmedCode = await this.processCode(prettifiedCode);

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

  async parseTypeDefinitions() {
    // Find .d.ts file (same name as input file but with .d.ts extension)
    const dtsFile = this.options.inputFile.replace(/\.cjs\.js$/, '.cjs.d.ts');

    if (!fs.existsSync(dtsFile)) {
      console.log(chalk.yellow(`⚠️  No .d.ts file found at: ${dtsFile}`));
      console.log(chalk.yellow('    Skipping TypeScript-based method detection'));
      return;
    }

    console.log(chalk.gray(`Parsing type definitions from: ${dtsFile}`));

    const dtsContent = fs.readFileSync(dtsFile, 'utf-8');

    try {
      const ast = parser.parse(dtsContent, {
        sourceType: 'module',
        plugins: [['typescript', { dts: true }]],
        errorRecovery: true
      });

      traverse(ast, {
        TSInterfaceDeclaration: (path) => {
          const interfaceName = path.node.id.name;

          // Extract methods from interface Mixpanel and interface People
          if (interfaceName === 'Mixpanel' || interfaceName === 'People') {
            if (this.options.verbose) {
              console.log(chalk.gray(`  Found interface: ${interfaceName}`));
            }

            path.node.body.body.forEach(member => {
              if (member.type === 'TSMethodSignature' || member.type === 'TSPropertySignature') {
                const methodName = member.key?.name || member.key?.value;
                if (methodName) {
                  this.declaredMethods.add(methodName);

                  // Also add with interface prefix for People methods
                  if (interfaceName === 'People') {
                    this.declaredMethods.add(`people.${methodName}`);
                  }

                  if (this.options.verbose) {
                    console.log(chalk.gray(`    - ${methodName}`));
                  }
                }
              }
            });
          }
        }
      });

      console.log(chalk.gray(`Found ${this.declaredMethods.size} methods declared in interfaces`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Error parsing .d.ts file: ${error.message}`));
    }
  }

  calculateMethodsToRemove() {
    // Methods to remove = (declared methods) - (methods to keep)
    this.declaredMethods.forEach(method => {
      if (!this.usedMethods.has(method)) {
        this.methodsToRemove.add(method);
      }
    });

    console.log(chalk.gray(`Calculated ${this.methodsToRemove.size} methods to remove`));

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

  async processCode(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Remove methods marked for removal
      const nodesToRemove = [];

      traverse(ast, {
        // Remove assignments to MixpanelLib.prototype.methodName
        AssignmentExpression: (path) => {
          if (path.node.left?.type === 'MemberExpression') {
            // Check for patterns like:
            // MixpanelLib.prototype.track = function() { ... }
            // _.prototype.track = function() { ... }
            const obj = path.node.left.object;
            const prop = path.node.left.property;

            // Check if this is a prototype assignment
            if (obj?.type === 'MemberExpression' &&
                obj.property?.name === 'prototype') {
              const methodName = prop?.name || prop?.value;

              if (methodName && this.methodsToRemove.has(methodName)) {
                const statement = path.getStatementParent();
                if (statement && !nodesToRemove.includes(statement)) {
                  nodesToRemove.push(statement);
                  this.removedMethods.add(methodName);
                  if (this.options.verbose) {
                    console.log(chalk.gray(`  Removing: ${methodName}`));
                  }
                }
              }
            }
          }
        },

        // Remove object methods in object expressions
        ObjectProperty: (path) => {
          const keyName = path.node.key?.name || path.node.key?.value;

          if (keyName && this.methodsToRemove.has(keyName)) {
            // Check if this is a method (function value)
            if (path.node.value?.type === 'FunctionExpression' ||
                path.node.value?.type === 'ArrowFunctionExpression' ||
                path.node.method) {
              path.remove();
              this.removedMethods.add(keyName);
              if (this.options.verbose) {
                console.log(chalk.gray(`  Removing object method: ${keyName}`));
              }
            }
          }
        },

        ObjectMethod: (path) => {
          const keyName = path.node.key?.name || path.node.key?.value;

          if (keyName && this.methodsToRemove.has(keyName)) {
            path.remove();
            this.removedMethods.add(keyName);
            if (this.options.verbose) {
              console.log(chalk.gray(`  Removing object method: ${keyName}`));
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

      // Generate code with MAXIMUM compactness so Prettier makes all formatting decisions
      const output = generate(ast, {
        sourceMaps: false,
        comments: true,
        shouldPrintComment: () => true,
        compact: false, // Generate as compact as possible (single line)
        concise: false,
        minified: false, // Keep readable identifiers
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

    const codeWithHeader = header + code;

    // Write raw trimmed file to disk first
    console.log(chalk.gray('Writing raw trimmed file to disk...'));
    fs.writeFileSync(this.options.outputFile, codeWithHeader);

    // Now prettify using Prettier CLI (ensures 100% consistent formatting with prettified original)
    console.log(chalk.gray('Prettifying trimmed file...'));
    const { execSync } = require('child_process');
    try {
      execSync(`npx prettier --write "${this.options.outputFile}"`, { stdio: 'pipe' });
      const prettified = fs.readFileSync(this.options.outputFile, 'utf-8');
      this.trimmedSize = Buffer.byteLength(prettified, 'utf8');
      console.log(chalk.green(`✓ Trimmed file saved to: ${this.options.outputFile}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Prettier CLI formatting failed: ${error.message}`));
      // Keep the unprettified version
      this.trimmedSize = Buffer.byteLength(codeWithHeader, 'utf8');
      console.log(chalk.yellow(`✓ Trimmed file saved (unprettified) to: ${this.options.outputFile}`));
    }
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
