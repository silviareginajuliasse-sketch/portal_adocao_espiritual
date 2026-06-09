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
        console.log('--- TEST: CREATE NEW PROJECT ---');
        const createPayload = {
            nome_projeto: 'Test Project ' + Date.now(),
            id_area: 4,
            objetivo_projeto: 'Check creation and update dates integrity',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            status: 'Não iniciado',
            observacoes: 'Test notes',
            id_colaborador_atualiza: 2
        };

        const createRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, createPayload);

        console.log('Create Response:', createRes);
        if (!createRes.body.success) {
            throw new Error('Failed to create project');
        }

        const projectId = createRes.body.id;

        console.log('\n--- TEST: GET CREATED PROJECT ---');
        const getRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/' + projectId,
            method: 'GET'
        });
        console.log('Get Created Response:', getRes.body);

        const originalCriadoEm = getRes.body.criado_em;
        const originalAtualizadoEm = getRes.body.atualizado_em;

        console.log('Original criado_em:', originalCriadoEm);
        console.log('Original atualizado_em:', originalAtualizadoEm);

        // Sleep 2 seconds to make sure timestamps would differ if updated
        await new Promise(r => setTimeout(r, 2000));

        console.log('\n--- TEST: UPDATE PROJECT ---');
        const updatePayload = {
            id: projectId,
            nome_projeto: 'Updated Test Project ' + Date.now(),
            id_area: 4,
            objetivo_projeto: 'Check creation and update dates integrity - UPDATED',
            data_inicio: '2026-06-02',
            data_fim: '2026-07-15',
            status: 'Em andamento',
            observacoes: 'Updated test notes',
            id_colaborador_atualiza: 4
        };

        const updateRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, updatePayload);

        console.log('Update Response:', updateRes);

        console.log('\n--- TEST: GET UPDATED PROJECT ---');
        const getRes2 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/' + projectId,
            method: 'GET'
        });
        console.log('Get Updated Response:', getRes2.body);

        const newCriadoEm = getRes2.body.criado_em;
        const newAtualizadoEm = getRes2.body.atualizado_em;

        console.log('New criado_em:', newCriadoEm);
        console.log('New atualizado_em:', newAtualizadoEm);

        if (originalCriadoEm !== newCriadoEm) {
            console.error('ERROR: criado_em was modified during update!');
            process.exit(1);
        } else {
            console.log('SUCCESS: criado_em remained identical.');
        }

        if (originalAtualizadoEm === newAtualizadoEm) {
            console.error('ERROR: atualizado_em was NOT modified during update!');
            process.exit(1);
        } else {
            console.log('SUCCESS: atualizado_em was updated.');
        }

        console.log('\n--- TEST: CLEANUP (DELETE PROJECT) ---');
        const deleteRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/' + projectId,
            method: 'DELETE'
        });
        console.log('Delete Response:', deleteRes.body);

        console.log('\nALL INTEGRITY TESTS PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
