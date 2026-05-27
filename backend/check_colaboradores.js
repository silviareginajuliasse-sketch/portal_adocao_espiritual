const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual'
};

async function checkSchema() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [cols] = await connection.query('DESCRIBE `colaboradores`');
        console.log("=== Table: colaboradores ===");
        console.log(cols);
        await connection.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
