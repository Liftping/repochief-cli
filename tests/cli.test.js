/**
 * RepoChief CLI Tests
 */

const { expect } = require('chai');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to CLI executable
const CLI_PATH = path.join(__dirname, '../bin/repochief.js');

/**
 * Run CLI command
 */
function runCLI(args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, MOCK_MODE: 'true' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    child.on('error', reject);
  });
}

describe('RepoChief CLI', () => {
  it('should display help when run without arguments', async () => {
    const { code, stdout } = await runCLI();
    
    expect(code).to.equal(0);
    expect(stdout).to.include('RepoChief');
    expect(stdout).to.include('Commands:');
    expect(stdout).to.include('run');
    expect(stdout).to.include('init');
    expect(stdout).to.include('demo');
  });
  
  it('should display version with --version flag', async () => {
    const { code, stdout } = await runCLI(['--version']);
    const expectedVersion = require('../package.json').version;
    
    expect(code).to.equal(0);
    expect(stdout.trim()).to.equal(expectedVersion);
  });
  
  it('should show error for unknown command', async () => {
    const { code, stderr } = await runCLI(['unknown-command']);
    
    expect(code).to.equal(1);
    expect(stderr).to.include('Unknown command');
  });
  
  it('should list agent profiles', async () => {
    const { code, stdout } = await runCLI(['agents']);
    
    expect(code).to.equal(0);
    expect(stdout).to.include('Available Agent Profiles');
    expect(stdout).to.include('SENIOR_DEVELOPER');
    expect(stdout).to.include('QA_ENGINEER');
  });
  
  it('should output agents in JSON format', async () => {
    const { code, stdout } = await runCLI(['agents', '--json']);
    
    expect(code).to.equal(0);
    const agents = JSON.parse(stdout);
    expect(agents).to.be.an('object');
    expect(agents).to.have.property('SENIOR_DEVELOPER');
    expect(agents.SENIOR_DEVELOPER).to.have.property('role');
    expect(agents.SENIOR_DEVELOPER).to.have.property('model');
  });
  
  it('should show system status', async () => {
    const { code, stdout } = await runCLI(['status']);
    
    expect(code).to.equal(0);
    expect(stdout).to.include('RepoChief System Status');
    expect(stdout).to.include('Environment:');
    expect(stdout).to.include('API Keys:');
    expect(stdout).to.include('Node.js:');
  });
  
  it('should show API key configuration help', async () => {
    const { code, stdout } = await runCLI(['config', '--api-keys']);
    
    // Note: This is interactive, so we just check it starts
    expect(stdout).to.include('API Key Configuration');
  });
});

describe('RepoChief CLI - Task Execution', () => {
  const testTaskFile = path.join(__dirname, 'test-task.json');
  
  before(() => {
    // Create test task file
    const testTask = {
      tasks: [
        {
          id: 'test-task',
          type: 'comprehension',
          objective: 'Test task',
          maxTokens: 1000
        }
      ]
    };
    fs.writeFileSync(testTaskFile, JSON.stringify(testTask));
  });
  
  after(() => {
    // Clean up
    if (fs.existsSync(testTaskFile)) {
      fs.unlinkSync(testTaskFile);
    }
  });
  
  it('should validate task file exists', async () => {
    const { code, stderr } = await runCLI(['run', 'non-existent.json']);
    
    expect(code).to.equal(1);
    expect(stderr).to.include('Task file not found');
  });
  
  it('should validate task file format', async () => {
    const invalidFile = path.join(__dirname, 'invalid.json');
    fs.writeFileSync(invalidFile, 'invalid json');
    
    const { code, stderr } = await runCLI(['run', invalidFile]);
    
    expect(code).to.equal(1);
    expect(stderr).to.include('Invalid JSON');
    
    fs.unlinkSync(invalidFile);
  });
  
  // Note: Full execution test would require mocking repochief-core
  // which is complex for integration tests
});

describe('RepoChief CLI - Commands', () => {
  it('should have all expected commands', () => {
    const { commands } = require('../src/index');
    
    expect(commands).to.have.property('run');
    expect(commands).to.have.property('init');
    expect(commands).to.have.property('agents');
    expect(commands).to.have.property('status');
    
    expect(commands.run).to.be.a('function');
    expect(commands.init).to.be.a('function');
    expect(commands.agents).to.be.a('function');
    expect(commands.status).to.be.a('function');
  });
});