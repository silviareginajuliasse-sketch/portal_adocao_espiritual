const http = require('http');

function request(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTest() {
    try {
        console.log('--- STARTING USER SATISFACTION SURVEY TESTS ---');

        // Test 1: Fetch initial stats
        console.log('\nTest 1: Fetching initial survey stats...');
        const resStats1 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pesquisa_satisfacao/stats',
            method: 'GET'
        });
        console.log('Status:', resStats1.statusCode);
        console.log('Body:', resStats1.body);
        if (resStats1.statusCode !== 200) {
            throw new Error('Failed to fetch initial stats');
        }
        const initialTotal = resStats1.body.total;
        console.log(`SUCCESS: Initial responses count is ${initialTotal}`);

        // Test 2: Create a promoter response (NPS = 10, identified)
        console.log('\nTest 2: Creating a promoter response (identified)...');
        const resSave1 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pesquisa_satisfacao/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_colaborador: 2,
            funcao: 'Coordenador Paroquial',
            frequencia_uso: 'Diariamente',
            nota_navegacao: 5,
            nota_visual: 5,
            nota_celular: 4,
            satisfacao_colaboradores: 'Muito Satisfeito',
            satisfacao_projetos: 'Satisfeito',
            satisfacao_treinamentos: 'Muito Satisfeito',
            satisfacao_aniversariantes: 'Satisfeito',
            frequencia_erros: 'Nunca',
            nps: 10,
            observacao: 'Interface excelente, agilizou muito nosso trabalho!'
        });
        console.log('Status:', resSave1.statusCode);
        console.log('Body:', resSave1.body);
        if (resSave1.statusCode !== 200 || !resSave1.body.success) {
            throw new Error('Failed to save survey response 1');
        }
        const savedId1 = resSave1.body.id;
        console.log(`SUCCESS: Saved survey response 1 with ID: ${savedId1}`);

        // Test 3: Create a response without id_colaborador (should fail with 400)
        console.log('\nTest 3: Testing block on anonymous response...');
        const resSave2 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pesquisa_satisfacao/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_colaborador: null,
            funcao: 'Colaborador de Equipe',
            frequencia_uso: 'Uma vez por semana',
            nota_navegacao: 3,
            nota_visual: 2,
            nota_celular: 1,
            satisfacao_colaboradores: 'Passivo',
            satisfacao_projetos: 'Insatisfeito',
            satisfacao_treinamentos: 'Não Utilizo',
            satisfacao_aniversariantes: 'Passivo',
            frequencia_erros: 'Às vezes',
            nps: 5,
            observacao: 'Faltam alguns ajustes na navegação mobile.'
        });
        console.log('Status:', resSave2.statusCode);
        console.log('Body:', resSave2.body);
        if (resSave2.statusCode !== 400 || resSave2.body.success) {
            throw new Error('Allowed anonymous submission when it should be blocked');
        }
        console.log('SUCCESS: Anonymous submission blocked with 400.');

        // Test 3.5: Create a refusal response (recusado = 1)
        console.log('\nTest 3.5: Creating a refusal/opt-out response...');
        const resRefusal = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pesquisa_satisfacao/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_colaborador: 2,
            recusado: true
        });
        console.log('Status:', resRefusal.statusCode);
        console.log('Body:', resRefusal.body);
        if (resRefusal.statusCode !== 200 || !resRefusal.body.success) {
            throw new Error('Failed to save refusal');
        }
        const savedRefusalId = resRefusal.body.id;
        console.log(`SUCCESS: Saved refusal response with ID: ${savedRefusalId}`);

        // Test 4: Fetch updated stats and check NPS calculation
        console.log('\nTest 4: Fetching updated stats...');
        const resStats2 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pesquisa_satisfacao/stats',
            method: 'GET'
        });
        console.log('Status:', resStats2.statusCode);
        console.log('Body:', resStats2.body);
        if (resStats2.statusCode !== 200) {
            throw new Error('Failed to fetch updated stats');
        }
        if (resStats2.body.total !== initialTotal + 1) {
            throw new Error(`Expected total responses to be ${initialTotal + 1}, but got ${resStats2.body.total}`);
        }
        console.log('SUCCESS: Total response count updated correctly.');

        // Test 5: Fetch list and verify refusal is not returned
        console.log('\nTest 5: Fetching responses list...');
        const resList = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pesquisa_satisfacao/list',
            method: 'GET'
        });
        console.log('Status:', resList.statusCode);
        console.log('List count:', resList.body.length);
        if (resList.statusCode !== 200 || !Array.isArray(resList.body)) {
            throw new Error('Failed to fetch responses list');
        }

        const item1 = resList.body.find(item => item.id_pesquisa === savedId1);
        const itemRefusal = resList.body.find(item => item.id_pesquisa === savedRefusalId);

        if (!item1) {
            throw new Error('Created survey response is missing in listing');
        }
        if (itemRefusal) {
            throw new Error('Refusal survey response should NOT be returned in listing');
        }

        if (item1.id_colaborador !== 2 || !item1.nome_colaborador) {
            throw new Error('Expected response 1 to be linked with collaborator 2 and have their name');
        }

        console.log('SUCCESS: Identified response verified and refusal correctly filtered.');

        // Clean up test data
        console.log('\nCleaning up created test records...');
        const mysql = require('mysql2/promise');
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root@2026',
            database: process.env.DB_NAME || 'adocao_espiritual',
            charset: 'utf8mb4'
        };
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('DELETE FROM pesquisas_satisfacao WHERE id_pesquisa IN (?, ?)', [savedId1, savedRefusalId]);
        await connection.end();
        console.log('SUCCESS: Cleanup completed.');

        console.log('\nALL USER SATISFACTION SURVEY TESTS PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
