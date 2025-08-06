#!/usr/bin/env node
/**
 * Apply database migrations
 */

const CloudDatabase = require('./repochief-cloud-api/src/db/sqlite');
const path = require('path');
const fs = require('fs').promises;

async function applyMigrations() {
  console.log('📋 Applying database migrations...\n');
  
  try {
    // Initialize database
    const dbPath = path.join(__dirname, 'repochief-cloud-api', 'data', 'repochief.db');
    const db = new CloudDatabase({ path: dbPath });
    await db.initialize();
    
    // Find migration files
    const migrationDir = path.join(__dirname, 'repochief-cloud-api', 'src', 'db', 'migrations');
    const files = await fs.readdir(migrationDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    console.log(`Found ${sqlFiles.length} migration files`);
    
    // Apply each migration
    for (const file of sqlFiles) {
      console.log(`\n📄 Applying ${file}...`);
      const sql = await fs.readFile(path.join(migrationDir, file), 'utf8');
      
      // Execute migration
      await new Promise((resolve, reject) => {
        db.db.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log(`✅ Applied ${file}`);
    }
    
    console.log('\n🎉 All migrations applied successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

applyMigrations();