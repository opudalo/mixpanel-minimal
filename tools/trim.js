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

    // PASS 1: Remove methods
    console.log(chalk.blue('\n📍 Pass 1: Removing methods'));
    const pass1Code = await this.processCode(prettifiedCode, { removeComments: false, pass: 1 });
    await this.saveTrimmedFile(pass1Code, 1);

    // PASS 2: Remove comments before removed methods
    console.log(chalk.blue('\n📍 Pass 2: Removing comments before removed methods'));
    // Re-parse the original to detect comments
    const pass2Code = await this.processCode(prettifiedCode, { removeComments: true, pass: 2 });
    await this.saveTrimmedFile(pass2Code, 2);

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
    const { removeComments = false, pass = 1 } = options;
    const commentLinesToRemove = new Set(); // Track comment line numbers to remove

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
                  // Track leading comments for removal if requested
                    if (removeComments && statement.node.leadingComments) {
                      statement.node.leadingComments.forEach(comment => {
                        // Track by line number and content
                        commentLinesToRemove.add(`${comment.loc.start.line}-${comment.value}`);
                      });
                      if (this.options.verbose) {
                        console.log(chalk.gray(`  Marking ${statement.node.leadingComments.length} comment(s) for removal before: ${fullMethodName}`));
                      }
                    }

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

      // Generate code
      const output = generate(ast, {
        sourceMaps: false,
        comments: true,
        shouldPrintComment: (commentValue) => {
          // In Pass 2, filter out comments we marked for removal
          if (removeComments) {
            // Check all tracked comment signatures
            for (const sig of commentLinesToRemove) {
              if (sig.includes(commentValue)) {
                return false; // Don't print this comment
              }
            }
          }
          return true;
        },
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
