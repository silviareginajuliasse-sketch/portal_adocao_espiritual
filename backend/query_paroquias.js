const mysql = require('mysql2/promise');

async function main() {
    try {
        const c = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'adocao_espiritual'
        });
        const [rows] = await c.query(`
            SELECT id_paroquia, nome_paroquia, implantada, parceira, data_implantacao, criado_em 
            FROM paroquias
        `);
        console.log('=== DADOS DE PAROQUIAS NO BANCO DE DADOS ===');
        console.log(JSON.stringify(rows, null, 2));
        await c.end();
    } catch (e) {
        console.error('DATABASE ERROR:', e);
    }
}

main();
