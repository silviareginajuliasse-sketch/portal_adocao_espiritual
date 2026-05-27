const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Iniciando migração da tabela arquidioceses...');

        const [columns] = await connection.query('SHOW COLUMNS FROM arquidioceses');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('id_pais')) {
            await connection.query('ALTER TABLE arquidioceses ADD COLUMN id_pais INT DEFAULT 1');
            console.log('Coluna id_pais adicionada.');
        }

        if (!columnNames.includes('id_estado')) {
            await connection.query('ALTER TABLE arquidioceses ADD COLUMN id_estado INT');
            console.log('Coluna id_estado adicionada.');
        }

        if (!columnNames.includes('arcebispo')) {
            await connection.query('ALTER TABLE arquidioceses ADD COLUMN arcebispo VARCHAR(255)');
            console.log('Coluna arcebispo adicionada.');
        }

        console.log('Migração concluída com sucesso.');
    } catch (err) {
        console.error('Erro na migração:', err);
    } finally {
        await connection.end();
    }
}

migrate();
