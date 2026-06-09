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
        console.log('--- TEST: MEETINGS CRUD INTEGRATION ---');
        
        let id_projeto = 1;

        // 1. Save new meeting
        console.log('\nStep 1: Save new meeting...');
        const savePayload = {
            id_projeto: id_projeto,
            data: '2026-06-04',
            descricao_resolvido: 'Pauta inicial resolvida',
            participantes: 'Silvia Juliasse, Dom Tiago'
        };
        const saveRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/reunioes/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, savePayload);

        console.log('Save Status:', saveRes.statusCode);
        console.log('Save Body:', saveRes.body);

        if (saveRes.statusCode !== 200 || !saveRes.body.success) {
            throw new Error('Save meeting failed.');
        }

        const idReuniao = saveRes.body.id_reuniao;
        console.log(`Saved meeting ID: ${idReuniao}`);

        // 2. Fetch single meeting details
        console.log('\nStep 2: Fetch single meeting...');
        const fetchRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/reunioes/${idReuniao}`,
            method: 'GET'
        });

        console.log('Fetch Status:', fetchRes.statusCode);
        console.log('Fetch Body:', fetchRes.body);

        if (fetchRes.statusCode !== 200 || fetchRes.body.descricao_resolvido !== 'Pauta inicial resolvida') {
            throw new Error('Fetch details failed or returned incorrect content.');
        }

        // 3. Update meeting
        console.log('\nStep 3: Update meeting...');
        const updatePayload = {
            id_projeto: id_projeto,
            id_reuniao: idReuniao,
            data: '2026-06-05',
            descricao_resolvido: 'Pauta atualizada e encerrada',
            participantes: 'Silvia Juliasse, Dom Tiago, Vânia'
        };
        const updateRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/reunioes/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, updatePayload);

        console.log('Update Status:', updateRes.statusCode);
        console.log('Update Body:', updateRes.body);

        if (updateRes.statusCode !== 200 || !updateRes.body.success) {
            throw new Error('Update meeting failed.');
        }

        // 4. Fetch list of meetings for project and verify updates
        console.log('\nStep 4: Fetch project meetings and verify update...');
        const listRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/${id_projeto}/reunioes`,
            method: 'GET'
        });

        if (listRes.statusCode !== 200) {
            throw new Error('Listing project meetings failed.');
        }

        console.log('Project meetings list length:', listRes.body.length);
        const nestedMeeting = listRes.body.find(m => m.id_reuniao === idReuniao);
        if (!nestedMeeting) {
            throw new Error(`Meeting with ID ${idReuniao} not found in project meetings list.`);
        }

        console.log('Meeting in list:', nestedMeeting);
        if (nestedMeeting.descricao_resolvido !== 'Pauta atualizada e encerrada' || nestedMeeting.participantes !== 'Silvia Juliasse, Dom Tiago, Vânia') {
            throw new Error('Meeting list details verification failed.');
        }

        // 5. Delete meeting
        console.log('\nStep 5: Delete meeting...');
        const deleteRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/reunioes/${idReuniao}`,
            method: 'DELETE'
        });

        console.log('Delete Status:', deleteRes.statusCode);
        console.log('Delete Body:', deleteRes.body);

        if (deleteRes.statusCode !== 200 || !deleteRes.body.success) {
            throw new Error('Delete meeting failed.');
        }

        // 6. Verify deleted from list
        console.log('\nStep 6: Verify deletion in list...');
        const listResAfterDelete = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/${id_projeto}/reunioes`,
            method: 'GET'
        });

        const deletedMeetingFound = listResAfterDelete.body.find(m => m.id_reuniao === idReuniao);
        if (deletedMeetingFound) {
            throw new Error('Meeting was NOT deleted.');
        }

        console.log('\nALL CRUD OPERATIONS FOR MEETINGS VERIFIED SUCCESSFULLY!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed with error:', e);
        process.exit(1);
    }
}

runTest();
