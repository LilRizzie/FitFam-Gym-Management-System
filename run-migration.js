#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, './backend/.env') });
const mysql = require(path.join(__dirname, './backend/node_modules/mysql2/promise'));
const fs = require('fs');

async function runMigration() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });
    
    const sql = fs.readFileSync('./database/add_missing_tables.sql', 'utf8');
    await connection.query(sql);
    await connection.end();
    
    console.log('✓ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
