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
        console.log('--- STARTING COLLABORATOR LEADERSHIP TESTS ---');

        // Test 1: Get enum types
        console.log('\nTest 1: Getting leadership types...');
        const res1 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/colaborador_lideranca/tipos',
            method: 'GET'
        });
        console.log('Status:', res1.statusCode);
        console.log('Body:', res1.body);
        if (res1.statusCode !== 200 || !Array.isArray(res1.body)) {
            throw new Error('Failed to get leadership types');
        }
        console.log('SUCCESS: Retrieved types list.');

        // Test 2: Create leadership entry
        console.log('\nTest 2: Creating new leadership entry for collaborator 2...');
        const res2 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/colaborador_lideranca/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_colaborador: 2,
            tipo_lideranca: 'Coordenador paroquial',
            data_inicio: '10/01/2026',
            data_fim: '31/12/2026',
            status: 'Ativo',
            observacao: 'Observação de teste inicial'
        });
        console.log('Status:', res2.statusCode);
        console.log('Body:', res2.body);
        if (res2.statusCode !== 200 || !res2.body.success) {
            throw new Error('Failed to create leadership record');
        }
        const createdId = res2.body.id;
        console.log(`SUCCESS: Created leadership record with ID: ${createdId}`);

        // Test 3: List leadership entries
        console.log('\nTest 3: Listing leadership entries for collaborator 2...');
        const res3 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/colaboradores/2/lideranca',
            method: 'GET'
        });
        console.log('Status:', res3.statusCode);
        console.log('Body:', res3.body);
        if (res3.statusCode !== 200 || !Array.isArray(res3.body)) {
            throw new Error('Failed to list leadership records');
        }
        const found = res3.body.find(item => item.id_movimentacao === createdId);
        if (!found) {
            throw new Error('Created leadership record was not returned in list');
        }
        if (found.observacao !== 'Observação de teste inicial') {
            throw new Error('Leadership record observation does not match');
        }
        console.log('SUCCESS: Listed leadership records successfully.');

        // Test 4: Update leadership entry
        console.log(`\nTest 4: Updating leadership record ${createdId}...`);
        const res4 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/colaborador_lideranca/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_colaborador: 2,
            id_movimentacao: createdId,
            tipo_lideranca: 'Coordenador diocesano',
            data_inicio: '10/01/2026',
            data_fim: null,
            status: 'Inativo',
            observacao: 'Observação de teste atualizada'
        });
        console.log('Status:', res4.statusCode);
        console.log('Body:', res4.body);
        if (res4.statusCode !== 200 || !res4.body.success) {
            throw new Error('Failed to update leadership record');
        }

        // Verify Update
        console.log('\nVerify Update: Listing again to check updated observation...');
        const resVerify = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/colaboradores/2/lideranca',
            method: 'GET'
        });
        const foundVerify = resVerify.body.find(item => item.id_movimentacao === createdId);
        if (!foundVerify || foundVerify.observacao !== 'Observação de teste atualizada') {
            throw new Error('Observation was not updated successfully');
        }
        console.log('SUCCESS: Updated leadership record successfully.');

        // Test 5: Delete leadership entry
        console.log(`\nTest 5: Deleting leadership record ${createdId}...`);
        const res5 = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/colaborador_lideranca/${createdId}`,
            method: 'DELETE'
        });
        console.log('Status:', res5.statusCode);
        console.log('Body:', res5.body);
        if (res5.statusCode !== 200 || !res5.body.success) {
            throw new Error('Failed to delete leadership record');
        }
        console.log('SUCCESS: Deleted leadership record successfully.');

        console.log('\nALL COLLABORATOR LEADERSHIP TESTS PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
