#!/usr/bin/env node
/**
 * Apply minimal database migrations for testing
 */

const CloudDatabase = require('./repochief-cloud-api/src/db/sqlite');
const path = require('path');
const fs = require('fs').promises;

async function applyMinimalMigrations() {
  console.log('📋 Applying minimal database migrations...\n');
  
  try {
    // Initialize database
    const dbPath = path.join(__dirname, 'repochief-cloud-api', 'data', 'repochief.db');
    const db = new CloudDatabase({ dbPath: dbPath });
    await db.initialize();
    
    // Create minimal required tables for intents to work FIRST
    console.log('📄 Creating minimal workspace tables...');
    
    const minimalSql = `
      -- Minimal tables for intents to work
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL
      );
      
      -- Insert test data
      INSERT OR IGNORE INTO accounts (id, email) VALUES ('test-account', 'test@example.com');
      INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('test-org', 'Test Organization', 'test-org');
      INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('repochief', 'RepoCHief', 'repochief');
      INSERT OR IGNORE INTO workspaces (id, organization_id, name, slug) VALUES ('test-workspace', 'test-org', 'Test Workspace', 'test');
      INSERT OR IGNORE INTO workspaces (id, organization_id, name, slug) VALUES ('default-workspace', 'repochief', 'Default', 'default');
    `;
    
    await new Promise((resolve, reject) => {
      db.db.exec(minimalSql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Minimal tables created');
    
    // Now apply intents migration
    console.log('\n📄 Applying intents migration...');
    const intentsSql = await fs.readFile(
      path.join(__dirname, 'repochief-cloud-api', 'src', 'db', 'migrations', '002_intents.sql'), 
      'utf8'
    );
    
    await new Promise((resolve, reject) => {
      db.db.exec(intentsSql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Intents migration applied');
    
    console.log('\n🎉 Minimal migrations applied successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

applyMinimalMigrations();