const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixFK() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Iniciando correção da Foreign Key em arquidioceses...');

        // 1. Remover a constraint antiga que aponta para tabela/coluna errada
        try {
            await connection.query('ALTER TABLE arquidioceses DROP FOREIGN KEY arquidioceses_ibfk_1');
            console.log('Constraint antiga arquidioceses_ibfk_1 removida.');
        } catch (e) {
            console.log('Aviso: Não foi possível remover arquidioceses_ibfk_1 (pode não existir).');
        }

        // 2. Adicionar a nova constraint correta apontando para regional(id_regional)
        await connection.query('ALTER TABLE arquidioceses ADD CONSTRAINT fk_arquidiocese_regional FOREIGN KEY (id_regional) REFERENCES regional(id_regional) ON DELETE SET NULL');
        console.log('Nova constraint fk_arquidiocese_regional adicionada com sucesso.');

        console.log('Correção concluída.');
    } catch (err) {
        console.error('Erro ao corrigir FK:', err);
    } finally {
        await connection.end();
    }
}

fixFK();
