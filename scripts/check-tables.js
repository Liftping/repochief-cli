#!/usr/bin/env node
const CloudDatabase = require('./repochief-cloud-api/src/db/sqlite');
const path = require('path');

async function checkTables() {
  try {
    const dbPath = path.join(__dirname, 'repochief-cloud-api', 'data', 'repochief.db');
    const db = new CloudDatabase({ path: dbPath });
    await db.initialize();
    
    // Get all tables
    db.db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      
      console.log('Existing tables:');
      tables.forEach(t => console.log(`  - ${t.name}`));
      
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();