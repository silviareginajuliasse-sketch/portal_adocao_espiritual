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
        console.log('--- STARTING MUTUAL EXCLUSION INTEGRATION TESTS ---');

        // 1. Create a test training
        console.log('\nStep 1: Creating test training...');
        const createTrainingRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/treinamentos/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            forma_treinamento: 'Presencial',
            titulo: 'Test Mutual Exclusion ' + Date.now(),
            obs_treinamento: 'Integration test for instructor/participant mutual exclusion',
            qualifica_para: 'Colaborador Adoção Espiritual',
            local: 'Auditório',
            status: 'agendado',
            id_colaborador_atualiza: 2
        });

        if (!createTrainingRes.body.success) {
            throw new Error('Failed to create test training');
        }
        const trainingId = createTrainingRes.body.id;
        console.log(`Test training created with ID: ${trainingId}`);

        // 2. Add collaborator ID 2 as a participant
        console.log('\nStep 2: Adding collaborator ID 2 as a participant...');
        const addPartRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/treinamentos/${trainingId}/participantes`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            colaboradores: [2]
        });

        if (!addPartRes.body.success) {
            throw new Error('Failed to add participant');
        }
        console.log('Participant added successfully.');

        // Get the participant record ID to allow cleanup later
        const listPartRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/treinamentos/${trainingId}/participantes`,
            method: 'GET'
        });
        const participantRecordId = listPartRes.body[0].id;
        console.log(`Participant record database ID is: ${participantRecordId}`);

        // 3. Attempt to add collaborator ID 2 as an instructor (Should Fail)
        console.log('\nStep 3: Attempting to add collaborator ID 2 as an instructor (should fail)...');
        const addInstFailRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/treinamento_instrutores/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_treinamento: trainingId,
            data: '2026-06-10',
            hora_inicio: '14:00',
            hora_fim: '16:00',
            pauta: 'Mutual exclusion test pauta',
            id_colaborador: 2
        });

        console.log(`Response status: ${addInstFailRes.statusCode}`);
        console.log('Response body:', addInstFailRes.body);

        if (addInstFailRes.statusCode !== 400 || addInstFailRes.body.success === true) {
            throw new Error('Expected 400 Bad Request, but request succeeded or returned wrong status');
        }
        console.log('SUCCESS: Prevented adding participant as instructor.');

        // 4. Remove participant
        console.log('\nStep 4: Removing participant for vice-versa test...');
        const deletePartRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/treinamento_participantes/${participantRecordId}`,
            method: 'DELETE'
        });
        if (!deletePartRes.body.success) {
            throw new Error('Failed to delete participant');
        }
        console.log('Participant removed successfully.');

        // 5. Add collaborator ID 2 as an instructor
        console.log('\nStep 5: Adding collaborator ID 2 as an instructor...');
        const addInstRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/treinamento_instrutores/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_treinamento: trainingId,
            data: '2026-06-10',
            hora_inicio: '14:00',
            hora_fim: '16:00',
            pauta: 'Mutual exclusion test pauta',
            id_colaborador: 2
        });

        if (!addInstRes.body.success) {
            throw new Error('Failed to add instructor: ' + JSON.stringify(addInstRes.body));
        }
        const agendaId = addInstRes.body.id;
        console.log(`Instructor added successfully with agenda ID: ${agendaId}`);

        // 6. Attempt to add collaborator ID 2 as a participant (Should Fail)
        console.log('\nStep 6: Attempting to add collaborator ID 2 as a participant (should fail)...');
        const addPartFailRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/treinamentos/${trainingId}/participantes`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            colaboradores: [2]
        });

        console.log(`Response status: ${addPartFailRes.statusCode}`);
        console.log('Response body:', addPartFailRes.body);

        if (addPartFailRes.statusCode !== 400 || addPartFailRes.body.success === true) {
            throw new Error('Expected 400 Bad Request, but request succeeded or returned wrong status');
        }
        console.log('SUCCESS: Prevented adding instructor as participant.');

        // 7. Cleanup
        console.log('\nStep 7: Cleaning up test training and records...');
        const cleanupRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/treinamentos/${trainingId}`,
            method: 'DELETE'
        });
        if (!cleanupRes.body.success) {
            throw new Error('Failed to delete test training during cleanup');
        }
        console.log('Cleanup completed successfully.');

        console.log('\nALL MUTUAL EXCLUSION INTEGRITY TESTS PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
