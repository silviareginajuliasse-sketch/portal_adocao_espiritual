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
        const [rows] = await pool.query('SELECT id_colaborador, nome_colaborador, apelido_colaborador FROM colaboradores');
        console.log('Collaborators:', rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkDb();


