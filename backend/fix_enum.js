const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual',
    charset: 'utf8mb4'
};

async function run() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado ao banco de dados para alteração do enum...');
        
        // 1. Temporarily update the rows to matching values to prevent truncation errors
        console.log('Atualizando registros para evitar erros de truncamento...');
        await connection.query("UPDATE arquidiocese_lideranca SET titulo = 'Bispo emérito' WHERE id_lideranca_arquidiocese = 2");

        // 2. Alter column to correct enum set
        console.log('Alterando a coluna titulo da tabela arquidiocese_lideranca...');
        await connection.query("ALTER TABLE arquidiocese_lideranca MODIFY COLUMN titulo ENUM('Arcebispo', 'Bispo Auxiliar', 'Bispo', 'Bispo emérito') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL");
        
        console.log('Enum de liderança corrigido com sucesso!');
    } catch (err) {
        console.error('Erro ao corrigir enum:', err);
    } finally {
        if (connection) await connection.end();
    }
}

run();
