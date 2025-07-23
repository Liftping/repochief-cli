const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const keytar = require('keytar');
const axios = require('axios');

// Mock modules
const mockKeytar = {
  setPassword: sinon.stub().resolves(),
  getPassword: sinon.stub().resolves(null),
  deletePassword: sinon.stub().resolves()
};

const mockAxios = {
  create: sinon.stub().returns({
    get: sinon.stub(),
    post: sinon.stub(),
    interceptors: {
      request: { use: sinon.stub() },
      response: { use: sinon.stub() }
    }
  })
};

// Test helpers
const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'repochief-test-' + Date.now());

describe('RepoChief CLI - Authentication', function() {
  let deviceUtils;
  let oauthUtils;
  let APIClient;
  
  before(function() {
    // Mock dependencies
    sinon.stub(keytar, 'setPassword').callsFake(mockKeytar.setPassword);
    sinon.stub(keytar, 'getPassword').callsFake(mockKeytar.getPassword);
    sinon.stub(keytar, 'deletePassword').callsFake(mockKeytar.deletePassword);
    
    // Set test config directory
    process.env.HOME = path.dirname(TEST_CONFIG_DIR);
    
    // Load modules after mocking
    deviceUtils = require('../src/utils/device');
    oauthUtils = require('../src/utils/oauth');
    APIClient = require('../src/utils/api-client').APIClient;
  });
  
  after(async function() {
    // Restore mocks
    sinon.restore();
    
    // Clean up test directory
    try {
      await fs.rmdir(TEST_CONFIG_DIR, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  beforeEach(function() {
    // Reset stubs
    mockKeytar.setPassword.resetHistory();
    mockKeytar.getPassword.resetHistory();
    mockKeytar.deletePassword.resetHistory();
  });
  
  describe('Device Management', function() {
    it('should create a new device ID if none exists', async function() {
      const deviceId = await deviceUtils.getOrCreateDeviceId();
      
      expect(deviceId).to.be.a('string');
      expect(deviceId).to.match(/^dev_[a-f0-9]{32}$/);
      
      // Check device file was created
      const deviceInfo = await deviceUtils.getDeviceInfo();
      expect(deviceInfo).to.have.property('deviceId', deviceId);
      expect(deviceInfo).to.have.property('deviceName');
      expect(deviceInfo).to.have.property('createdAt');
      expect(deviceInfo.metadata).to.have.property('os');
      expect(deviceInfo.metadata).to.have.property('arch');
    });
    
    it('should return existing device ID if already created', async function() {
      const firstId = await deviceUtils.getOrCreateDeviceId();
      const secondId = await deviceUtils.getOrCreateDeviceId();
      
      expect(firstId).to.equal(secondId);
    });
    
    it('should store token securely using keychain', async function() {
      const deviceId = 'dev_test123';
      const token = 'test_token_abc123';
      
      await deviceUtils.storeToken(deviceId, token);
      
      expect(mockKeytar.setPassword).to.have.been.calledWith('repochief', deviceId, token);
    });
    
    it('should retrieve token from keychain', async function() {
      const deviceId = 'dev_test123';
      const token = 'test_token_abc123';
      
      mockKeytar.getPassword.resolves(token);
      
      const retrieved = await deviceUtils.getToken(deviceId);
      
      expect(retrieved).to.equal(token);
      expect(mockKeytar.getPassword).to.have.been.calledWith('repochief', deviceId);
    });
    
    it('should remove token from storage', async function() {
      const deviceId = 'dev_test123';
      
      await deviceUtils.removeToken(deviceId);
      
      expect(mockKeytar.deletePassword).to.have.been.calledWith('repochief', deviceId);
    });
  });
  
  describe('OAuth Flow', function() {
    let apiClient;
    
    beforeEach(function() {
      // Create a mock API client
      apiClient = {
        post: sinon.stub()
      };
    });
    
    it('should handle device code request', async function() {
      const mockResponse = {
        device_code: 'abc123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://app.repochief.com/device',
        verification_uri_complete: 'https://app.repochief.com/device?user_code=ABCD-1234',
        expires_in: 600,
        interval: 5
      };
      
      apiClient.post.resolves(mockResponse);
      
      // Mock the APIClient constructor
      sinon.stub(APIClient.prototype, 'post').resolves(mockResponse);
      
      const result = await oauthUtils.deviceFlow();
      
      expect(result).to.have.property('device_code', 'abc123');
      expect(result).to.have.property('user_code', 'ABCD-1234');
      expect(result).to.have.property('verification_uri');
      expect(result).to.have.property('pollForToken').that.is.a('function');
      
      APIClient.prototype.post.restore();
    });
  });
  
  describe('API Client', function() {
    it('should create client with default configuration', function() {
      const client = new APIClient();
      
      expect(client).to.have.property('axios');
      expect(client).to.have.property('token', null);
    });
    
    it('should create client with provided token', function() {
      const token = 'test_token_123';
      const client = new APIClient(token);
      
      expect(client).to.have.property('token', token);
    });
    
    it('should handle API errors gracefully', async function() {
      const client = new APIClient();
      
      // Mock axios to reject
      const error = new Error('Network error');
      error.response = { status: 500, data: { message: 'Server error' } };
      
      sinon.stub(client.axios, 'get').rejects(error);
      
      try {
        await client.getStatus();
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err).to.be.an('error');
      }
    });
  });
  
  describe('Auth Commands', function() {
    it('should export auth command', function() {
      const authCommand = require('../src/commands/auth');
      expect(authCommand).to.be.a('function');
      
      const command = authCommand();
      expect(command.name()).to.equal('auth');
      expect(command.description()).to.include('authentication');
    });
    
    it('should have login subcommand', function() {
      const authCommand = require('../src/commands/auth');
      const command = authCommand();
      
      const loginCmd = command.commands.find(cmd => cmd.name() === 'login');
      expect(loginCmd).to.exist;
      expect(loginCmd.description()).to.include('Authenticate');
    });
    
    it('should have logout subcommand', function() {
      const authCommand = require('../src/commands/auth');
      const command = authCommand();
      
      const logoutCmd = command.commands.find(cmd => cmd.name() === 'logout');
      expect(logoutCmd).to.exist;
      expect(logoutCmd.description()).to.include('Log out');
    });
    
    it('should have status subcommand', function() {
      const authCommand = require('../src/commands/auth');
      const command = authCommand();
      
      const statusCmd = command.commands.find(cmd => cmd.name() === 'status');
      expect(statusCmd).to.exist;
      expect(statusCmd.description()).to.include('Check authentication');
    });
  });
});