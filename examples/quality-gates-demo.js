#!/usr/bin/env node

/**
 * RepoChief Quality Gates Demo
 * Shows how AI-generated code is validated through quality gates
 */

const path = require('path');
const chalk = require('chalk');

// Import quality gate integration
const QualityGateIntegration = require('../../repochief-core/src/quality/QualityGateIntegration');

// Sample code snippets to test
const codeExamples = {
    good: {
        name: 'Well-written code',
        code: `
// Calculate factorial with memoization
const memo = {};

function factorial(n) {
    if (n <= 1) return 1;
    
    if (memo[n]) {
        return memo[n];
    }
    
    const result = n * factorial(n - 1);
    memo[n] = result;
    return result;
}

module.exports = { factorial };
`
    },
    
    badStyle: {
        name: 'Code with style issues',
        code: `
var message = "Hello World"  // Missing semicolon, using var
const unused = 42;  // Unused variable

function greet(name,age,country,city,zipcode) {  // Too many parameters
    console.log("Welcome " + name)  // Double quotes, missing semicolon
    
    if(age>18){  // Missing spaces
        return true
    }
    else {
        return false
    }
}
`
    },
    
    security: {
        name: 'Code with security issues',
        code: `
const userInput = process.argv[2];

// Dangerous: Using eval
eval(userInput);

// Dangerous: Direct innerHTML
document.getElementById('output').innerHTML = userInput;

// Dangerous: Dynamic require
const module = require(userInput);

// Command injection risk
const { exec } = require('child_process');
exec(\`ls \${userInput}\`);
`
    },
    
    complex: {
        name: 'Overly complex code',
        code: `
function processData(data, options) {
    if (!data) {
        return null;
    } else if (data.type === 'user') {
        if (data.age > 18) {
            if (data.country === 'US') {
                if (data.state === 'CA') {
                    if (data.city === 'SF') {
                        return 'SF_USER';
                    } else if (data.city === 'LA') {
                        return 'LA_USER';
                    } else {
                        return 'CA_USER';
                    }
                } else if (data.state === 'NY') {
                    return 'NY_USER';
                } else {
                    return 'US_USER';
                }
            } else if (data.country === 'UK') {
                return 'UK_USER';
            } else {
                return 'INTL_USER';
            }
        } else {
            return 'MINOR';
        }
    } else if (data.type === 'admin') {
        return data.super ? 'SUPER_ADMIN' : 'ADMIN';
    } else {
        return 'UNKNOWN';
    }
}
`
    }
};

async function runDemo() {
    console.log(chalk.cyan.bold('\n🔍 RepoChief Quality Gates Demo\n'));
    console.log('This demo shows how AI-generated code is validated.\n');
    
    // Initialize quality gate integration
    const gateIntegration = new QualityGateIntegration();
    
    console.log(chalk.yellow('Available gates:'), gateIntegration.getAvailableGates().join(', '));
    console.log('');
    
    // Test each code example
    for (const [key, example] of Object.entries(codeExamples)) {
        console.log(chalk.blue.bold(`\n📝 Testing: ${example.name}`));
        console.log(chalk.gray('─'.repeat(50)));
        
        // Run all gates
        const results = await gateIntegration.runGates(example.code, {
            gates: ['eslint', 'security', 'complexity'],
            language: 'javascript'
        });
        
        // Display results
        console.log(chalk.yellow('\n📊 Results:'));
        console.log(`   Overall: ${results.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
        console.log(`   Summary: ${chalk.green(results.summary.passed + ' passed')}, ${chalk.red(results.summary.failed + ' failed')}, ${chalk.gray(results.summary.skipped + ' skipped')}`);
        
        // Show details for each gate
        for (const [gateName, result] of Object.entries(results.gates)) {
            console.log(chalk.yellow(`\n   ${gateName}:`));
            
            if (result.status === 'pass') {
                console.log(chalk.green(`     ✅ Passed`));
            } else if (result.status === 'fail') {
                console.log(chalk.red(`     ❌ Failed`));
            } else if (result.status === 'skipped') {
                console.log(chalk.gray(`     ⏭  Skipped: ${result.reason}`));
            } else if (result.status === 'error') {
                console.log(chalk.red(`     ⚠️  Error: ${result.error}`));
            }
            
            // Show issues if any
            if (result.issues && result.issues.length > 0) {
                console.log(chalk.yellow(`     Issues found:`));
                for (const issue of result.issues.slice(0, 3)) {
                    console.log(chalk.gray(`       - Line ${issue.line}: ${issue.message} (${issue.severity})`));
                }
                if (result.issues.length > 3) {
                    console.log(chalk.gray(`       ... and ${result.issues.length - 3} more`));
                }
            }
            
            // Show stats if available
            if (result.stats) {
                console.log(chalk.gray(`     Stats:`, JSON.stringify(result.stats)));
            }
        }
        
        console.log('');
    }
    
    // Demonstrate fixing code
    console.log(chalk.cyan.bold('\n🔧 Auto-fix Demonstration\n'));
    console.log('Some issues can be automatically fixed:\n');
    
    const eslintGate = gateIntegration.getGate('eslint');
    if (eslintGate && eslintGate.fix) {
        const fixResult = await eslintGate.fix(codeExamples.badStyle.code);
        
        if (fixResult.fixed) {
            console.log(chalk.green('✅ Code was automatically fixed!'));
            console.log(chalk.gray('\nFixed code preview:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(fixResult.code.split('\n').slice(0, 10).join('\n'));
            console.log(chalk.gray('...'));
        }
    }
    
    console.log(chalk.cyan.bold('\n✨ Demo Complete!\n'));
    console.log('Quality gates ensure AI-generated code meets your standards.\n');
}

// Run the demo
if (require.main === module) {
    runDemo().catch(console.error);
}