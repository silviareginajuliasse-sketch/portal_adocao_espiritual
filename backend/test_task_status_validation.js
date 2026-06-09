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
        console.log('--- STARTING TASK STATUS VALIDATION TESTS ---');

        // Test Case 1: Attempt to save task with progress = 100 but status = 'Em andamento'
        console.log('\nCase 1: Attempting to save task with progress=100 and status="Em andamento"...');
        const res1 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/tarefas/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_projeto: 1,
            descricao_tarefa: 'Test task 1',
            status: 'Em andamento',
            perc_atingido: 100,
            descricao_detalhada: 'Test details'
        });

        console.log(`Response status: ${res1.statusCode}`);
        console.log('Response body:', res1.body);

        if (res1.statusCode !== 400 || res1.body.success === true) {
            throw new Error('Expected 400 Bad Request, but request succeeded');
        }
        console.log('SUCCESS: Blocked inconsistent task with 100% progress and status="Em andamento".');

        // Test Case 2: Attempt to save task with status = 'Concluída' but progress = 80
        console.log('\nCase 2: Attempting to save task with status="Concluída" and progress=80...');
        const res2 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/tarefas/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_projeto: 1,
            descricao_tarefa: 'Test task 2',
            status: 'Concluída',
            perc_atingido: 80,
            descricao_detalhada: 'Test details'
        });

        console.log(`Response status: ${res2.statusCode}`);
        console.log('Response body:', res2.body);

        if (res2.statusCode !== 400 || res2.body.success === true) {
            throw new Error('Expected 400 Bad Request, but request succeeded');
        }
        console.log('SUCCESS: Blocked inconsistent task with status="Concluída" and progress < 100.');

        // Test Case 3: Save task with status = 'Concluída' and progress = 100 (Should Succeed)
        console.log('\nCase 3: Attempting to save task with status="Concluída" and progress=100...');
        const res3 = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projetos/tarefas/save',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id_projeto: 1,
            descricao_tarefa: 'Test task 3 ' + Date.now(),
            status: 'Concluída',
            perc_atingido: 100,
            descricao_detalhada: 'Test details'
        });

        console.log(`Response status: ${res3.statusCode}`);
        console.log('Response body:', res3.body);

        if (res3.statusCode !== 200 || res3.body.success !== true) {
            throw new Error('Expected 200 OK, but request failed');
        }
        console.log('SUCCESS: Allowed consistent task.');

        // Cleanup
        const createdTaskId = res3.body.id_tarefa;
        if (createdTaskId) {
            console.log(`\nCleaning up created task with ID: ${createdTaskId}`);
            // We can run cleanup via DB query or similar if needed.
        }

        console.log('\nALL TASK STATUS VALIDATION TESTS PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
