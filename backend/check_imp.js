const mysql = require('mysql2/promise');

async function checkParoquiasDates() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'adocao_espiritual'
        });

        const [rows] = await connection.query(`
            SELECT 
                p.id_paroquia, 
                p.nome_paroquia, 
                p.cidade,
                e.sigla_estado,
                p.implantada, 
                p.parceira, 
                p.data_implantacao, 
                p.criado_em 
            FROM paroquias p
            LEFT JOIN estados e ON p.id_estado = e.id_estado
            WHERE p.data_implantacao IS NOT NULL AND p.data_implantacao != ''
            ORDER BY p.data_implantacao ASC
        `);

        console.log('=== PARÓQUIAS IMPLANTADAS (data_implantacao IS NOT NULL) ===');
        console.log(`TOTAL IMPLANTADAS: ${rows.length}`);
        console.log(JSON.stringify(rows, null, 2));

        const [allRows] = await connection.query(`
            SELECT 
                p.id_paroquia, 
                p.nome_paroquia, 
                p.cidade,
                e.sigla_estado,
                p.implantada, 
                p.parceira, 
                p.data_implantacao, 
                p.criado_em 
            FROM paroquias p
            LEFT JOIN estados e ON p.id_estado = e.id_estado
            ORDER BY p.id_paroquia ASC
        `);

        console.log('\n=== TODAS AS PARÓQUIAS DA BASE ===');
        console.log(`TOTAL REGISTROS: ${allRows.length}`);
        console.log(JSON.stringify(allRows, null, 2));

        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkParoquiasDates();
