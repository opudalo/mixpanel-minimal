#!/usr/bin/env node

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const chalk = require('chalk');

console.log(chalk.blue('🔍 Extracting all prototype methods from Mixpanel...'));

const inputFile = './src/original/mixpanel.cjs.js';
const outputFile = './trim-config.json';

if (!fs.existsSync(inputFile)) {
  console.log(chalk.red(`Error: ${inputFile} not found`));
  process.exit(1);
}

const code = fs.readFileSync(inputFile, 'utf-8');

console.log(chalk.gray('Parsing code...'));
const ast = parser.parse(code, {
  sourceType: 'script',
  plugins: ['jsx', 'typescript'],
  errorRecovery: true
});

const classMethods = {};

console.log(chalk.gray('Scanning for prototype methods...'));

traverse(ast, {
  // Find patterns like: MixpanelLib.prototype.method = function() { ... }
  AssignmentExpression: (path) => {
    if (path.node.left?.type === 'MemberExpression') {
      const obj = path.node.left.object;
      const prop = path.node.left.property;

      // Check if this is a prototype assignment
      if (obj?.type === 'MemberExpression' && obj.property?.name === 'prototype') {
        const className = obj.object?.name;
        const methodName = prop?.name || prop?.value;

        if (className && methodName) {
          // Skip private methods (starting with _)
          if (methodName.startsWith('_')) {
            return;
          }

          // Initialize class object if doesn't exist
          if (!classMethods[className]) {
            classMethods[className] = {};
          }

          // Add method with default true
          classMethods[className][methodName] = true;
        }
      }
    }
  }
});

// Sort classes and methods alphabetically
const sortedConfig = {};
Object.keys(classMethods).sort().forEach(className => {
  sortedConfig[className] = {};
  Object.keys(classMethods[className]).sort().forEach(methodName => {
    sortedConfig[className][methodName] = true;
  });
});

const totalMethods = Object.values(sortedConfig).reduce((sum, methods) => sum + Object.keys(methods).length, 0);

const config = {
  description: 'Manual control for each prototype method. Set to false to remove.',
  methods: sortedConfig
};

fs.writeFileSync(outputFile, JSON.stringify(config, null, 2));

console.log(chalk.green(`✓ Extracted ${totalMethods} prototype methods from ${Object.keys(sortedConfig).length} classes`));
console.log(chalk.green(`✓ Saved to: ${outputFile}`));
console.log(chalk.gray('\nNow edit trim-config.json and set keep:false for methods you want to remove.'));
