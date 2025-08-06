#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('./repochief-cloud-api/node_modules/sqlite3').verbose();

async function checkTables() {
  try {
    const dbPath = path.join(__dirname, 'repochief-cloud-api', 'data', 'repochief.db');
    console.log('Checking database:', dbPath);
    const database = new sqlite3.Database(dbPath);
    
    // Get all tables
    database.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      
      console.log('\nExisting tables:');
      tables.forEach(t => console.log(`  - ${t.name}`));
      
      database.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();