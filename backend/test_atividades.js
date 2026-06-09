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
        console.log('--- TEST: TASK ACTIVITIES CRUD INTEGRATION ---');
        
        let id_projeto = 1;
        let id_tarefa = 1002; // We previously found this task ID

        // 1. Save new activity
        console.log('\nStep 1: Save new activity...');
        const savePayload = {
            id_projeto: id_projeto,
            id_tarefa: id_tarefa,
            descricao: 'Initial Activity Description',
            status: 'Não iniciado',
            perc_atingido: 15
        };
        const saveRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/tarefas/atividades/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, savePayload);

        console.log('Save Status:', saveRes.statusCode);
        console.log('Save Body:', saveRes.body);

        if (saveRes.statusCode !== 200 || !saveRes.body.success) {
            throw new Error('Save activity failed.');
        }

        const idAtividade = saveRes.body.id_atividade;
        console.log(`Saved activity ID: ${idAtividade}`);

        // 2. Fetch single activity
        console.log('\nStep 2: Fetch single activity...');
        const fetchRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/tarefas/atividades/${idAtividade}`,
            method: 'GET'
        });

        console.log('Fetch Status:', fetchRes.statusCode);
        console.log('Fetch Body:', fetchRes.body);

        if (fetchRes.statusCode !== 200 || fetchRes.body.descricao !== 'Initial Activity Description') {
            throw new Error('Fetch activity failed or returned incorrect description.');
        }

        // 3. Update activity
        console.log('\nStep 3: Update activity...');
        const updatePayload = {
            id_projeto: id_projeto,
            id_tarefa: id_tarefa,
            id_atividade: idAtividade,
            descricao: 'Updated Activity Description',
            status: 'Em andamento',
            perc_atingido: 35
        };
        const updateRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/tarefas/atividades/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, updatePayload);

        console.log('Update Status:', updateRes.statusCode);
        console.log('Update Body:', updateRes.body);

        if (updateRes.statusCode !== 200 || !updateRes.body.success) {
            throw new Error('Update activity failed.');
        }

        // 4. Fetch task list and verify activities are nested
        console.log('\nStep 4: Fetch tasks and verify activities nesting...');
        const tasksRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/${id_projeto}/tarefas`,
            method: 'GET'
        });

        if (tasksRes.statusCode !== 200) {
            throw new Error('Fetching project tasks failed.');
        }

        const task = tasksRes.body.find(t => t.id_tarefa === id_tarefa);
        if (!task) {
            throw new Error(`Task with ID ${id_tarefa} not found in projects response.`);
        }

        console.log('Task activities array length:', task.atividades ? task.atividades.length : 0);
        console.log('Task activities:', task.atividades);

        const nestedActivity = (task.atividades || []).find(a => a.id_atividade === idAtividade);
        if (!nestedActivity || nestedActivity.descricao !== 'Updated Activity Description') {
            throw new Error('Nested activity details verify failed.');
        }

        // 5. Delete activity
        console.log('\nStep 5: Delete activity...');
        const deleteRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/tarefas/atividades/${idAtividade}`,
            method: 'DELETE'
        });

        console.log('Delete Status:', deleteRes.statusCode);
        console.log('Delete Body:', deleteRes.body);

        if (deleteRes.statusCode !== 200 || !deleteRes.body.success) {
            throw new Error('Delete activity failed.');
        }

        // 6. Verify deleted
        console.log('\nStep 6: Verify deletion in tasks list...');
        const tasksResAfterDelete = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projetos/${id_projeto}/tarefas`,
            method: 'GET'
        });

        const taskAfterDelete = tasksResAfterDelete.body.find(t => t.id_tarefa === id_tarefa);
        const deletedActivityFound = (taskAfterDelete.atividades || []).find(a => a.id_atividade === idAtividade);
        if (deletedActivityFound) {
            throw new Error('Activity was NOT deleted.');
        }

        console.log('\nALL CRUD OPERATIONS VERIFIED SUCCESSFULLY!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed with error:', e);
        process.exit(1);
    }
}

runTest();
