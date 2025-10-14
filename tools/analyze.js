#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const chalk = require('chalk');
const { program } = require('commander');

class MixpanelAnalyzer {
  constructor(options = {}) {
    this.options = {
      file: options.file || './src/original/mixpanel.cjs.js',
      output: options.output || './reports/analysis.json',
      verbose: options.verbose || false
    };

    this.stats = {
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      functions: [],
      objects: [],
      variables: [],
      fileSize: 0,
      complexity: {
        cyclomatic: 0,
        depth: 0
      }
    };
  }

  async analyze() {
    console.log(chalk.blue('🔍 Analyzing Mixpanel file...'));

    if (!fs.existsSync(this.options.file)) {
      console.log(chalk.red(`File not found: ${this.options.file}`));
      return;
    }

    const code = fs.readFileSync(this.options.file, 'utf-8');
    this.stats.fileSize = Buffer.byteLength(code, 'utf8');

    // Analyze lines
    this.analyzeLines(code);

    // Parse AST and analyze structure
    await this.analyzeStructure(code);

    // Save report
    this.saveReport();

    // Print summary
    this.printSummary();
  }

  analyzeLines(code) {
    const lines = code.split('\n');
    this.stats.totalLines = lines.length;

    lines.forEach(line => {
      const trimmed = line.trim();

      if (trimmed === '') {
        this.stats.blankLines++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        this.stats.commentLines++;
      } else {
        this.stats.codeLines++;
      }
    });
  }

  async analyzeStructure(code) {
    try {
      const ast = parser.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      // Use traverse to analyze the AST
      const traverse = require('@babel/traverse').default;

      let maxDepth = 0;
      let currentDepth = 0;

      traverse(ast, {
        enter(path) {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);

          // Track functions
          if (path.node.type === 'FunctionDeclaration' ||
              path.node.type === 'FunctionExpression' ||
              path.node.type === 'ArrowFunctionExpression') {

            const name = path.node.id?.name || '<anonymous>';
            const params = path.node.params?.length || 0;
            const loc = path.node.loc;

            this.stats.functions.push({
              name,
              params,
              lines: loc ? loc.end.line - loc.start.line + 1 : 0,
              complexity: this.calculateComplexity(path.node)
            });
          }

          // Track objects
          if (path.node.type === 'ObjectExpression') {
            const properties = path.node.properties?.length || 0;
            this.stats.objects.push({
              properties,
              lines: path.node.loc ? path.node.loc.end.line - path.node.loc.start.line + 1 : 0
            });
          }

          // Track variables
          if (path.node.type === 'VariableDeclaration') {
            path.node.declarations.forEach(decl => {
              if (decl.id?.name) {
                this.stats.variables.push({
                  name: decl.id.name,
                  kind: path.node.kind,
                  initialized: !!decl.init
                });
              }
            });
          }
        },
        exit() {
          currentDepth--;
        }
      });

      this.stats.complexity.depth = maxDepth;

    } catch (error) {
      console.log(chalk.red('Error analyzing structure:'), error.message);
    }
  }

  calculateComplexity(node) {
    // Simple cyclomatic complexity calculation
    let complexity = 1;

    const traverse = require('@babel/traverse').default;

    traverse(node, {
      'IfStatement|ConditionalExpression|SwitchCase|WhileStatement|DoWhileStatement|ForStatement|ForInStatement|ForOfStatement': () => {
        complexity++;
      },
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      },
      noScope: true
    });

    return complexity;
  }

  saveReport() {
    const reportDir = path.dirname(this.options.output);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      file: this.options.file,
      stats: this.stats,
      summary: {
        fileSize: this.formatSize(this.stats.fileSize),
        totalLines: this.stats.totalLines,
        codeLines: this.stats.codeLines,
        functionCount: this.stats.functions.length,
        avgFunctionLength: this.stats.functions.length > 0
          ? Math.round(this.stats.functions.reduce((sum, f) => sum + f.lines, 0) / this.stats.functions.length)
          : 0,
        avgComplexity: this.stats.functions.length > 0
          ? (this.stats.functions.reduce((sum, f) => sum + f.complexity, 0) / this.stats.functions.length).toFixed(2)
          : 0
      }
    };

    fs.writeFileSync(this.options.output, JSON.stringify(report, null, 2));
    console.log(chalk.green(`✓ Analysis report saved to: ${this.options.output}`));
  }

  formatSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  printSummary() {
    console.log(chalk.blue('\n📊 Analysis Summary:'));
    console.log(`  • File size: ${this.formatSize(this.stats.fileSize)}`);
    console.log(`  • Total lines: ${this.stats.totalLines}`);
    console.log(`  • Code lines: ${this.stats.codeLines} (${(this.stats.codeLines / this.stats.totalLines * 100).toFixed(1)}%)`);
    console.log(`  • Comment lines: ${this.stats.commentLines}`);
    console.log(`  • Blank lines: ${this.stats.blankLines}`);
    console.log(`  • Functions: ${this.stats.functions.length}`);
    console.log(`  • Objects: ${this.stats.objects.length}`);
    console.log(`  • Variables: ${this.stats.variables.length}`);

    if (this.options.verbose && this.stats.functions.length > 0) {
      console.log(chalk.gray('\nTop 10 largest functions:'));
      this.stats.functions
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 10)
        .forEach(fn => {
          console.log(chalk.gray(`  - ${fn.name}: ${fn.lines} lines (complexity: ${fn.complexity})`));
        });
    }
  }
}

// CLI Interface
program
  .name('mixpanel-analyzer')
  .description('Analyze Mixpanel file structure and metrics')
  .version('1.0.0')
  .option('-f, --file <path>', 'Mixpanel file to analyze', './src/original/mixpanel.cjs.js')
  .option('-o, --output <path>', 'Output report file', './reports/analysis.json')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options) => {
    const analyzer = new MixpanelAnalyzer(options);
    await analyzer.analyze();
  });

program.parse();

module.exports = MixpanelAnalyzer;