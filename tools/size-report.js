#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const chalk = require('chalk');

class SizeReporter {
  constructor() {
    this.files = [
      { name: 'Original', path: './src/original/mixpanel.cjs.js' },
      { name: 'Trimmed', path: './src/trimmed/mixpanel-trimmed.cjs.js' },
      { name: 'Minified', path: './dist/mixpanel-minimal.min.js' },
      { name: 'ES Module', path: './dist/mixpanel-minimal.esm.js' }
    ];
  }

  async generateReport() {
    console.log(chalk.blue('📏 Size Comparison Report\n'));
    console.log(chalk.gray('═'.repeat(80)));

    const results = [];

    for (const file of this.files) {
      if (fs.existsSync(file.path)) {
        const stats = await this.getFileStats(file.path);
        results.push({ ...file, ...stats });

        console.log(chalk.white(`\n${file.name}:`));
        console.log(chalk.gray(`  Path: ${file.path}`));
        console.log(`  Raw size:     ${this.formatSize(stats.size)}`);
        console.log(`  Gzip size:    ${this.formatSize(stats.gzip)} ${chalk.green(`(${stats.gzipRatio}% compression)`)}`);
        console.log(`  Brotli size:  ${this.formatSize(stats.brotli)} ${chalk.green(`(${stats.brotliRatio}% compression)`)}`);
      } else {
        console.log(chalk.yellow(`\n${file.name}: Not found (${file.path})`));
      }
    }

    console.log(chalk.gray('\n' + '═'.repeat(80)));

    // Calculate savings if both original and trimmed exist
    const original = results.find(r => r.name === 'Original');
    const trimmed = results.find(r => r.name === 'Trimmed');

    if (original && trimmed) {
      console.log(chalk.blue('\n💰 Size Savings:\n'));

      const savings = {
        raw: original.size - trimmed.size,
        gzip: original.gzip - trimmed.gzip,
        brotli: original.brotli - trimmed.brotli
      };

      const percentage = {
        raw: ((savings.raw / original.size) * 100).toFixed(1),
        gzip: ((savings.gzip / original.gzip) * 100).toFixed(1),
        brotli: ((savings.brotli / original.brotli) * 100).toFixed(1)
      };

      console.log(`  Raw:     ${chalk.green(`-${this.formatSize(savings.raw)}`)} (${percentage.raw}% reduction)`);
      console.log(`  Gzip:    ${chalk.green(`-${this.formatSize(savings.gzip)}`)} (${percentage.gzip}% reduction)`);
      console.log(`  Brotli:  ${chalk.green(`-${this.formatSize(savings.brotli)}`)} (${percentage.brotli}% reduction)`);
    }

    // Generate table
    this.printTable(results);

    // Save JSON report
    this.saveJsonReport(results);
  }

  async getFileStats(filePath) {
    const content = fs.readFileSync(filePath);
    const size = content.length;

    const gzipBuffer = await new Promise((resolve, reject) => {
      zlib.gzip(content, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const brotliBuffer = await new Promise((resolve, reject) => {
      zlib.brotliCompress(content, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    return {
      size,
      gzip: gzipBuffer.length,
      brotli: brotliBuffer.length,
      gzipRatio: ((1 - gzipBuffer.length / size) * 100).toFixed(1),
      brotliRatio: ((1 - brotliBuffer.length / size) * 100).toFixed(1)
    };
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, index)).toFixed(2);

    return `${size} ${units[index]}`;
  }

  printTable(results) {
    if (results.length === 0) return;

    console.log(chalk.blue('\n📊 Comparison Table:\n'));

    // Header
    const header = ['File', 'Raw Size', 'Gzip', 'Brotli'].map(h => chalk.bold(h));
    const widths = [20, 12, 12, 12];

    console.log(
      header.map((h, i) => h.padEnd(widths[i])).join(' | ')
    );
    console.log(chalk.gray('-'.repeat(widths.reduce((a, b) => a + b + 3, 0))));

    // Rows
    results.forEach(file => {
      const row = [
        file.name.padEnd(widths[0]),
        this.formatSize(file.size).padEnd(widths[1]),
        this.formatSize(file.gzip).padEnd(widths[2]),
        this.formatSize(file.brotli).padEnd(widths[3])
      ];
      console.log(row.join(' | '));
    });
  }

  saveJsonReport(results) {
    const reportDir = './reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      files: results.map(r => ({
        name: r.name,
        path: r.path,
        size: {
          raw: r.size,
          gzip: r.gzip,
          brotli: r.brotli,
          formatted: {
            raw: this.formatSize(r.size),
            gzip: this.formatSize(r.gzip),
            brotli: this.formatSize(r.brotli)
          }
        },
        compression: {
          gzip: `${r.gzipRatio}%`,
          brotli: `${r.brotliRatio}%`
        }
      }))
    };

    fs.writeFileSync(
      path.join(reportDir, 'size-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log(chalk.gray(`\nReport saved to: ${path.join(reportDir, 'size-report.json')}`));
  }
}

// Run the reporter
const reporter = new SizeReporter();
reporter.generateReport().catch(console.error);