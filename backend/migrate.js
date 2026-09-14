require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    const sql = fs.readFileSync('../database/add_missing_tables.sql', 'utf8');
    const results = await conn.query(sql);
    console.log('✓ Migration successful');
  } catch (err) {
    console.error('✗ Migration error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();
