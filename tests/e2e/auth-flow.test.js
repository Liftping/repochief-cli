/**
 * End-to-end test for authentication flow
 * Tests OAuth device flow and PAT authentication
 */

const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runCommand } = require('../helpers/cli-test-utils');

describe('E2E: Authentication Flow', function() {
  this.timeout(30000); // 30 second timeout for E2E tests
  
  let sandbox;
  let configPath;
  let originalEnv;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    originalEnv = { ...process.env };
    
    // Use test config directory
    configPath = path.join(os.tmpdir(), 'repochief-test-' + Date.now());
    process.env.REPOCHIEF_CONFIG_DIR = configPath;
    fs.mkdirSync(configPath, { recursive: true });
    
    // Clear any existing auth
    delete process.env.REPOCHIEF_API_KEY;
    delete process.env.REPOCHIEF_ACCESS_TOKEN;
  });
  
  afterEach(() => {
    sandbox.restore();
    process.env = originalEnv;
    
    // Clean up test config
    try {
      fs.rmSync(configPath, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
  describe('Device OAuth Flow', () => {
    it('should display device code and verification URL', async () => {
      // Mock the device flow API response
      const mockDeviceResponse = {
        device_code: 'TEST-DEVICE-CODE',
        user_code: 'ABCD-1234',
        verification_uri: 'https://repochief.com/device',
        verification_uri_complete: 'https://repochief.com/device?code=ABCD-1234',
        expires_in: 600,
        interval: 5
      };
      
      // Run auth login command
      const result = await runCommand(['auth', 'login'], {
        env: {
          ...process.env,
          REPOCHIEF_API_URL: 'http://localhost:3002',
          REPOCHIEF_MOCK_AUTH: JSON.stringify(mockDeviceResponse)
        }
      });
      
      // Verify output
      expect(result.stdout).to.include('To authenticate, please visit:');
      expect(result.stdout).to.include('https://repochief.com/device');
      expect(result.stdout).to.include('Enter this code: ABCD-1234');
    });
    
    it('should poll for authorization and save tokens', async () => {
      // Mock successful authorization
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 'user123',
          email: 'test@example.com'
        }
      };
      
      // Run auth login with auto-approval
      const result = await runCommand(['auth', 'login'], {
        env: {
          ...process.env,
          REPOCHIEF_API_URL: 'http://localhost:3002',
          REPOCHIEF_MOCK_AUTH: JSON.stringify({
            device_code: 'TEST-DEVICE-CODE',
            user_code: 'ABCD-1234',
            verification_uri: 'https://repochief.com/device',
            expires_in: 600,
            interval: 1
          }),
          REPOCHIEF_MOCK_TOKEN: JSON.stringify(mockTokenResponse),
          REPOCHIEF_AUTO_APPROVE: 'true'
        }
      });
      
      // Verify success
      expect(result.stdout).to.include('Successfully authenticated as test@example.com');
      
      // Verify config was saved
      const authConfig = JSON.parse(
        fs.readFileSync(path.join(configPath, 'auth.json'), 'utf8')
      );
      expect(authConfig.user).to.deep.equal(mockTokenResponse.user);
    });
  });
  
  describe('Personal Access Token (PAT) Flow', () => {
    it('should authenticate with PAT', async () => {
      const testPAT = 'repochief_pat_test123456789';
      
      // Run auth login with PAT
      const result = await runCommand(['auth', 'login', '--token', testPAT], {
        env: {
          ...process.env,
          REPOCHIEF_API_URL: 'http://localhost:3002',
          REPOCHIEF_MOCK_AUTH: JSON.stringify({
            valid: true,
            user: {
              id: 'user123',
              email: 'test@example.com'
            },
            device: {
              id: 'dev123',
              name: 'CI/CD Pipeline'
            }
          })
        }
      });
      
      // Verify success
      expect(result.stdout).to.include('Successfully authenticated with Personal Access Token');
      expect(result.stdout).to.include('Device: CI/CD Pipeline');
      
      // Verify token was saved securely
      const authConfig = JSON.parse(
        fs.readFileSync(path.join(configPath, 'auth.json'), 'utf8')
      );
      expect(authConfig.authType).to.equal('pat');
      expect(authConfig.device).to.deep.equal({
        id: 'dev123',
        name: 'CI/CD Pipeline'
      });
    });
    
    it('should handle invalid PAT', async () => {
      const result = await runCommand(['auth', 'login', '--token', 'invalid-token'], {
        env: {
          ...process.env,
          REPOCHIEF_API_URL: 'http://localhost:3002',
          REPOCHIEF_MOCK_AUTH_ERROR: JSON.stringify({
            status: 401,
            error: 'Invalid token'
          })
        }
      });
      
      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.include('Authentication failed');
    });
  });
  
  describe('Auth Status', () => {
    it('should show authentication status', async () => {
      // Set up authenticated state
      const authData = {
        user: {
          id: 'user123',
          email: 'test@example.com'
        },
        device: {
          id: 'dev123',
          name: 'Test Device'
        },
        authType: 'oauth'
      };
      
      fs.writeFileSync(
        path.join(configPath, 'auth.json'),
        JSON.stringify(authData, null, 2)
      );
      
      // Run auth status
      const result = await runCommand(['auth', 'status']);
      
      expect(result.stdout).to.include('Authenticated as: test@example.com');
      expect(result.stdout).to.include('Device: Test Device');
      expect(result.stdout).to.include('Auth Type: OAuth');
    });
    
    it('should show not authenticated status', async () => {
      const result = await runCommand(['auth', 'status']);
      
      expect(result.stdout).to.include('Not authenticated');
      expect(result.stdout).to.include('Run "repochief auth login" to authenticate');
    });
  });
  
  describe('Auth Logout', () => {
    it('should clear authentication', async () => {
      // Set up authenticated state
      const authData = {
        user: { id: 'user123', email: 'test@example.com' },
        device: { id: 'dev123', name: 'Test Device' }
      };
      
      fs.writeFileSync(
        path.join(configPath, 'auth.json'),
        JSON.stringify(authData, null, 2)
      );
      
      // Run auth logout
      const result = await runCommand(['auth', 'logout']);
      
      expect(result.stdout).to.include('Successfully logged out');
      
      // Verify auth config was removed
      expect(fs.existsSync(path.join(configPath, 'auth.json'))).to.be.false;
    });
  });
  
  describe('Device Management', () => {
    beforeEach(() => {
      // Set up authenticated state
      const authData = {
        user: { id: 'user123', email: 'test@example.com' },
        device: { id: 'dev123', name: 'Test Device' },
        authType: 'oauth',
        accessToken: 'test-token'
      };
      
      fs.writeFileSync(
        path.join(configPath, 'auth.json'),
        JSON.stringify(authData, null, 2)
      );
    });
    
    it('should list devices', async () => {
      const mockDevices = [
        {
          id: 'dev123',
          name: 'Test Device',
          type: 'INTERACTIVE',
          status: 'ACTIVE',
          created_at: Date.now() - 86400000,
          last_seen_at: Date.now() - 3600000
        },
        {
          id: 'dev456',
          name: 'CI Pipeline',
          type: 'SERVICE_ACCOUNT',
          status: 'ACTIVE',
          created_at: Date.now() - 172800000,
          last_seen_at: Date.now() - 7200000
        }
      ];
      
      const result = await runCommand(['devices', 'list'], {
        env: {
          ...process.env,
          REPOCHIEF_MOCK_DEVICES: JSON.stringify({ devices: mockDevices })
        }
      });
      
      expect(result.stdout).to.include('Test Device');
      expect(result.stdout).to.include('CI Pipeline');
      expect(result.stdout).to.include('INTERACTIVE');
      expect(result.stdout).to.include('SERVICE_ACCOUNT');
    });
    
    it('should revoke a device', async () => {
      const result = await runCommand(['devices', 'revoke', 'dev456'], {
        input: 'y\n', // Confirm revocation
        env: {
          ...process.env,
          REPOCHIEF_MOCK_REVOKE: JSON.stringify({ success: true })
        }
      });
      
      expect(result.stdout).to.include('Device successfully revoked');
    });
  });
});