const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual',
    charset: 'utf8mb4'
};

async function runTests() {
    console.log('--- STARTING CALENDAR INTEGRATION TESTS ---');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL successfully.');

        // Test 1: Fetch all initial calendar events (should be empty now or have few records)
        console.log('\nTest 1: Fetching calendar events...');
        const [initialRows] = await connection.query(`
            SELECT c.id_calendario, c.nome_evento, cd.data 
            FROM calendario c
            INNER JOIN calendario_datas cd ON c.id_calendario = cd.id_calendario AND c.id_evento = cd.id_evento
        `);
        console.log(`Initial event dates count: ${initialRows.length}`);

        // Test 2: Insert a new calendar event and associated dates
        console.log('\nTest 2: Creating a new calendar event...');
        const [maxRows] = await connection.query('SELECT COALESCE(MAX(id_evento), 0) + 1 AS nextId FROM calendario');
        const nextIdEvento = maxRows[0].nextId;

        const insertQuery = `
            INSERT INTO calendario (id_evento, nome_evento, calendario_religioso, feriado, recorrente, onde, id_paroquia, hora, observacoes, id_colaborador_atualiza, criado_em)
            VALUES (?, 'Reunião de Planejamento Teste', 'Não', 'Não', 'Não', 'Google meeting', null, '10:00:00', 'Obs de teste', 2, CURRENT_TIMESTAMP)
        `;
        const [result] = await connection.query(insertQuery, [nextIdEvento]);
        const testEventId = result.insertId;
        console.log(`Saved test event in 'calendario' table with ID: ${testEventId}`);

        // Insert dates for the test event
        // 2026-06-15 (with year -> 20260615) and 06-20 (without year -> 620)
        console.log('Inserting test dates...');
        const testDates = [20260615, 620];
        const dateValues = testDates.map(d => [testEventId, nextIdEvento, d]);
        await connection.query('INSERT INTO calendario_datas (id_calendario, id_evento, data) VALUES ?', [dateValues]);
        console.log('Dates inserted successfully.');

        // Test 3: Fetch updated list
        console.log('\nTest 3: Verifying join result...');
        const [updatedRows] = await connection.query(`
            SELECT c.id_calendario, c.nome_evento, cd.data 
            FROM calendario c
            INNER JOIN calendario_datas cd ON c.id_calendario = cd.id_calendario AND c.id_evento = cd.id_evento
            WHERE c.id_calendario = ?
            ORDER BY cd.data ASC
        `, [testEventId]);
        
        if (updatedRows.length !== 2) {
            throw new Error(`Expected 2 rows for event, got ${updatedRows.length}`);
        }
        console.log('SUCCESS: Retrieved 2 event instances correctly:');
        updatedRows.forEach(row => {
            console.log(`  - Event ID: ${row.id_calendario}, Date: ${row.data}, Name: ${row.nome_evento}`);
        });

        // Test 4: Delete the test event and its dates
        console.log('\nTest 4: Cleaning up created test records...');
        await connection.query('DELETE FROM calendario_datas WHERE id_calendario = ?', [testEventId]);
        await connection.query('DELETE FROM calendario WHERE id_calendario = ?', [testEventId]);
        console.log('Cleanup completed successfully.');

        console.log('\nALL CALENDAR INTEGRATION TESTS PASSED!');
        process.exit(0);
    } catch (err) {
        console.error('Test suite failed:', err);
        process.exit(1);
    }
}

runTests();
