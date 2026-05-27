const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual',
    charset: 'utf8mb4'
};

async function fix() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado para correção...');

        await connection.query('SET NAMES utf8mb4');

        const estados = [
            [1, 1, 'ACRE', 'AC'],
            [1, 2, 'ALAGOAS', 'AL'],
            [1, 3, 'AMAPÁ', 'AP'],
            [1, 4, 'AMAZONAS', 'AM'],
            [1, 5, 'BAHIA', 'BA'],
            [1, 6, 'CEARÁ', 'CE'],
            [1, 7, 'DISTRITO FEDERAL', 'DF'],
            [1, 8, 'ESPÍRITO SANTO', 'ES'],
            [1, 9, 'GOIÁS', 'GO'],
            [1, 10, 'MARANHÃO', 'MA'],
            [1, 11, 'MATO GROSSO', 'MT'],
            [1, 12, 'MATO GROSSO DO SUL', 'MS'],
            [1, 13, 'MINAS GERAIS', 'MG'],
            [1, 14, 'PARÁ', 'PA'],
            [1, 15, 'PARAÍBA', 'PB'],
            [1, 16, 'PARANÁ', 'PR'],
            [1, 17, 'PERNAMBUCO', 'PE'],
            [1, 18, 'PIAUÍ', 'PI'],
            [1, 19, 'RIO DE JANEIRO', 'RJ'],
            [1, 20, 'RIO GRANDE DO NORTE', 'RN'],
            [1, 21, 'RIO GRANDE DO SUL', 'RS'],
            [1, 22, 'RONDÔNIA', 'RO'],
            [1, 23, 'RORAIMA', 'RR'],
            [1, 24, 'SANTA CATARINA', 'SC'],
            [1, 25, 'SÃO PAULO', 'SP'],
            [1, 26, 'SERGIPE', 'SE'],
            [1, 27, 'TOCANTINS', 'TO']
        ];

        console.log('Limpando tabela estados...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DELETE FROM estados');
        
        console.log('Inserindo estados corretamente...');
        for (const est of estados) {
            await connection.query('INSERT INTO estados (id_pais, id_estado, nome_estado, sigla_estado) VALUES (?, ?, ?, ?)', est);
        }
        
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Correção concluída com sucesso!');

    } catch (err) {
        console.error('Erro na correção:', err);
    } finally {
        if (connection) await connection.end();
    }
}

fix();
