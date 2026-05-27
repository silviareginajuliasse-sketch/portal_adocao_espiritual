const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado para migração...');

        // Verificar se a coluna ID_PAIS existe na tabela regional
        const [columns] = await connection.query('SHOW COLUMNS FROM regional LIKE "ID_PAIS"');
        
        if (columns.length === 0) {
            console.log('Adicionando coluna ID_PAIS à tabela regional...');
            await connection.query('ALTER TABLE regional ADD COLUMN ID_PAIS INT DEFAULT 1');
            await connection.query('ALTER TABLE regional ADD CONSTRAINT fk_regional_pais FOREIGN KEY (ID_PAIS) REFERENCES pais(id_pais)');
            console.log('Coluna ID_PAIS adicionada com sucesso!');
        } else {
            console.log('Coluna ID_PAIS já existe na tabela regional.');
        }

    } catch (err) {
        console.error('Erro na migração:', err);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
