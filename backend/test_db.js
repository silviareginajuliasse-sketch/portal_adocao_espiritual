const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual'
};

async function checkDb() {
    try {
        const pool = mysql.createPool(dbConfig);
        const [columns] = await pool.query('SHOW COLUMNS FROM paroquias');
        console.log('Columns:', columns.map(c => c.Field));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkDb();
