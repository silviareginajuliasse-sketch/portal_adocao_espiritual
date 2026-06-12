const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Disable caching for all JSON API routes to ensure fresh data
app.use('/api', (req, res, next) => {
    if (!req.path.endsWith('/foto')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root@2026',
    database: process.env.DB_NAME || 'adocao_espiritual',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function connectDB() {
    const maxRetries = 10;
    const retryDelay = 3000; // 3 seconds
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            pool = mysql.createPool(dbConfig);
            // Executa uma query simples de teste para validar a conexão
            await pool.query('SELECT 1');
            console.log('Conectado ao MySQL!');

            // Check if criado_em in table treinamentos has implicit "on update CURRENT_TIMESTAMP"
            const [columns] = await pool.query(`
                SELECT EXTRA 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'treinamentos' 
                  AND COLUMN_NAME = 'criado_em'
            `);
            if (columns.length > 0 && columns[0].EXTRA.toLowerCase().includes('on update')) {
                console.log('Corrigindo coluna criado_em da tabela treinamentos (removendo ON UPDATE)...');
                await pool.query(`
                    ALTER TABLE treinamentos 
                    MODIFY COLUMN criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                `);
                console.log('Coluna criado_em corrigida com sucesso.');
            }

            // Check if recusado column exists in table pesquisas_satisfacao
            const [psColumns] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'pesquisas_satisfacao' 
                  AND COLUMN_NAME = 'recusado'
            `);
            if (psColumns.length === 0) {
                console.log('Atualizando a tabela pesquisas_satisfacao para suportar recusa e campos nulos...');
                await pool.query(`
                    ALTER TABLE pesquisas_satisfacao 
                    ADD COLUMN recusado TINYINT(1) DEFAULT 0,
                    MODIFY COLUMN funcao VARCHAR(100) NULL,
                    MODIFY COLUMN frequencia_uso VARCHAR(100) NULL,
                    MODIFY COLUMN nota_navegacao INT NULL,
                    MODIFY COLUMN nota_visual INT NULL,
                    MODIFY COLUMN frequencia_erros VARCHAR(100) NULL,
                    MODIFY COLUMN nps INT NULL
                `);
                console.log('Tabela pesquisas_satisfacao atualizada com sucesso.');
            }

            // Migrate table arquidioceses to add endereco, cep, site dynamically
            const [columnsList] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'arquidioceses'
            `);
            const columnNames = columnsList.map(c => c.COLUMN_NAME.toLowerCase());

            if (!columnNames.includes('endereco')) {
                console.log('Adicionando coluna endereco na tabela arquidioceses...');
                await pool.query('ALTER TABLE arquidioceses ADD COLUMN endereco VARCHAR(255) NULL');
            } else {
                console.log('Ajustando coluna endereco na tabela arquidioceses...');
                await pool.query('ALTER TABLE arquidioceses MODIFY COLUMN endereco VARCHAR(255) NULL');
            }

            if (!columnNames.includes('cep')) {
                console.log('Adicionando coluna cep na tabela arquidioceses...');
                await pool.query('ALTER TABLE arquidioceses ADD COLUMN cep VARCHAR(10) NULL');
            }

            if (!columnNames.includes('site')) {
                console.log('Adicionando coluna site na tabela arquidioceses...');
                await pool.query('ALTER TABLE arquidioceses ADD COLUMN site VARCHAR(255) NULL');
            }

            // Seed default addresses for archdioceses if currently empty
            const seedAddresses = [
                { id: 5, endereco: 'Palácio do Carmo – Praça Dom Adauto, s/n, Centro', cep: '58010-670', site: 'arquidiocesepb.org.br' },
                { id: 6, endereco: 'Rua Campo Verde, nº 103 - Bairro Juliana', cep: '31744-513', site: 'arquidiocesebh.org.br' },
                { id: 7, endereco: 'Av. Governador Pedro de Toledo, 969 - Bonfim', cep: '13070-751', site: 'arquidiocesecampinas.com' },
                { id: 8, endereco: 'Rua Sao Pedro de Alcantara, 12 - Centro', cep: '25685-300', site: 'diocesepetropolis.com.br' },
                { id: 9, endereco: 'Rua Ten Benévolo, 201 - Centro', cep: '60160-040', site: 'https://www.arquidiocesedefortaleza.org.br' },
                { id: 10, endereco: 'Praça Dom Germano, 660 - Centro', cep: '75800-035', site: 'http://diocesedejatai.org' }
            ];

            for (const item of seedAddresses) {
                const [checkRows] = await pool.query('SELECT endereco FROM arquidioceses WHERE id_arquidiocese = ?', [item.id]);
                if (checkRows.length > 0) {
                    const currentAddress = checkRows[0].endereco;
                    if (!currentAddress || currentAddress.trim() === '' || currentAddress === 'Endereço não informado') {
                        console.log(`Semeando endereço padrão para arquidiocese ID ${item.id}...`);
                        await pool.query(
                            'UPDATE arquidioceses SET endereco = ?, cep = ?, site = ? WHERE id_arquidiocese = ?',
                            [item.endereco, item.cep, item.site, item.id]
                        );
                    }
                }
            }

            return; // Conectado com sucesso
        } catch (err) {
            attempts++;
            console.error(`Tentativa ${attempts} de ${maxRetries} falhou ao conectar ao MySQL:`, err.message);
            if (pool) {
                try {
                    await pool.end();
                } catch (_) {}
            }
            if (attempts >= maxRetries) {
                console.error('Número máximo de tentativas de conexão com o banco excedido. Encerrando...');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// Routes

// Route to get dynamic menu options ordered by order field
app.get('/api/menu', async (req, res) => {
    try {
        const query = 'SELECT id_menu, nome_menu, icone, pagina, ordem, status FROM menu WHERE status = "A" ORDER BY ordem ASC';
        const [rows] = await pool.query(query);

        const menuItems = rows.map(item => {
            let iconeBase64 = null;
            if (item.icone) {
                iconeBase64 = `data:image/png;base64,${item.icone.toString('base64')}`;
            }
            return {
                id_menu: item.id_menu,
                nome_menu: item.nome_menu,
                icone: iconeBase64,
                pagina: item.pagina,
                ordem: item.ordem,
                status: item.status
            };
        });

        res.json(menuItems);
    } catch (err) {
        console.error('Error fetching menu items:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get dynamic menu gerencial options ordered by order field
app.get('/api/menu_gerencial', async (req, res) => {
    try {
        const query = 'SELECT id_menu, nome_menu, imagem, pagina, ordem, status FROM menu_gerencial WHERE status = "Ativo" ORDER BY ordem ASC';
        const [rows] = await pool.query(query);

        const menuItems = rows.map(item => {
            let imagemBase64 = null;
            if (item.imagem) {
                imagemBase64 = `data:image/png;base64,${item.imagem.toString('base64')}`;
            }
            return {
                id_menu: item.id_menu,
                nome_menu: item.nome_menu,
                imagem: imagemBase64,
                pagina: item.pagina,
                ordem: item.ordem,
                status: item.status
            };
        });

        res.json(menuItems);
    } catch (err) {
        console.error('Error fetching menu_gerencial items:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to search active collaborators by name across all birth months (global lookup)
app.get('/api/colaboradores/aniversariantes/busca', async (req, res) => {
    const { termo } = req.query;
    console.log(`GET /api/colaboradores/aniversariantes/busca - Termo: ${termo}`);
    try {
        const query = `
            SELECT c.nome_colaborador, c.cidade, e.sigla_estado, c.data_nascimento,
                   DAY(c.data_nascimento) AS dia_nascimento, MONTH(c.data_nascimento) AS mes_nascimento
            FROM colaboradores c
            INNER JOIN estados e ON c.id_estado = e.id_estado
            WHERE c.nome_colaborador LIKE ? AND c.status = 'Ativo'
            ORDER BY MONTH(c.data_nascimento) ASC, DAY(c.data_nascimento) ASC
            LIMIT 50
        `;
        const [rows] = await pool.query(query, [`%${termo || ''}%`]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar aniversariantes por termo:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get active collaborators whose birthday is in the specified month
app.get('/api/colaboradores/aniversariantes/:mes', async (req, res) => {
    const { mes } = req.params;
    console.log(`GET /api/colaboradores/aniversariantes/${mes}`);
    try {
        const query = `
            SELECT c.nome_colaborador, c.cidade, e.sigla_estado, c.data_nascimento,
                   DAY(c.data_nascimento) AS dia_nascimento, MONTH(c.data_nascimento) AS mes_nascimento
            FROM colaboradores c
            INNER JOIN estados e ON c.id_estado = e.id_estado
            WHERE MONTH(c.data_nascimento) = ? AND c.status = 'Ativo'
            ORDER BY DAY(c.data_nascimento) ASC
        `;
        const [rows] = await pool.query(query, [parseInt(mes, 10)]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar aniversariantes:', err);
        res.status(500).json({ error: err.message });
    }
});

// Specific route: Regionais with States (must come BEFORE generic route)
app.get('/api/regionais/detalhes', async (req, res) => {
    try {
        const query = `
            SELECT r.id_regional, r.nome_regional, e.nome_estado, p.nome_pais, re.id_estado
            FROM regional r
            LEFT JOIN regional_estado re ON r.id_regional = re.id_regional
            LEFT JOIN estados e ON re.id_estado = e.id_estado
            LEFT JOIN pais p ON r.ID_PAIS = p.id_pais
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get states by country
app.get('/api/estados/pais/:id_pais', async (req, res) => {
    const { id_pais } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM estados WHERE id_pais = ? ORDER BY nome_estado', [id_pais]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get regionals by state
app.get('/api/regionais/estado/:id_estado', async (req, res) => {
    const { id_estado } = req.params;
    try {
        const query = `
            SELECT r.* 
            FROM regional r
            JOIN regional_estado re ON r.id_regional = re.id_regional
            WHERE re.id_estado = ?
            ORDER BY r.nome_regional
        `;
        const [rows] = await pool.query(query, [id_estado]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get arquidioceses by regional (Plural and Singular to avoid errors)
app.get('/api/arquidioceses/regional/:id_regional', async (req, res) => {
    const { id_regional } = req.params;
    console.log(`[API] GET /api/arquidioceses/regional/${id_regional}`);
    try {
        const [rows] = await pool.query('SELECT * FROM arquidioceses WHERE id_regional = ? ORDER BY nome_arquidiocese', [id_regional]);
        console.log(`[API] Found ${rows.length} arquidioceses`);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] /api/arquidioceses/regional:', err);
        res.status(500).json({ error: "Erro no servidor: " + err.message });
    }
});

app.get('/api/arquidiocese/regional/:id_regional', async (req, res) => {
    const { id_regional } = req.params;
    console.log(`[API] GET /api/arquidiocese/regional/${id_regional}`);
    try {
        const [rows] = await pool.query('SELECT * FROM arquidioceses WHERE id_regional = ? ORDER BY nome_arquidiocese', [id_regional]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to list all collaborators with state, country, and profile info
app.get('/api/colaboradores', async (req, res) => {
    const isLight = req.query.light === 'true';
    try {
        const photoField = isLight ? '' : 'c.foto_colaborador,';
        const query = `
             SELECT c.id_colaborador, c.nome_colaborador, c.cidade, c.telefone, c.email,
                    ${photoField} e.nome_estado, e.sigla_estado, p.nome_pais, c.perfil AS nome_perfil,
                    c.atualizado_em, c.criado_em, c.status, c.perfil AS id_perfil, pa.nome_paroquia
             FROM colaboradores c
             LEFT JOIN estados e ON c.id_estado = e.id_estado
             LEFT JOIN pais p ON e.id_pais = p.id_pais
             LEFT JOIN paroquias pa ON c.id_paroquia = pa.id_paroquia
             ORDER BY c.nome_colaborador ASC
        `;
        const [rows] = await pool.query(query);

        if (!isLight) {
            // Convert photo Buffer/Base64 to standard data URL for frontend display
            for (const colaborador of rows) {
                if (colaborador.foto_colaborador && colaborador.foto_colaborador.length > 0) {
                    let fotoBuffer = colaborador.foto_colaborador;
                    if (Buffer.isBuffer(fotoBuffer)) {
                        const prefix = fotoBuffer.subarray(0, 11).toString('utf-8');
                        if (prefix === 'data:image/') {
                            // It is already a base64 Data URL string stored as bytes
                            colaborador.foto_colaborador = fotoBuffer.toString('utf-8').replace(/[\r\n\s]+/g, '');
                        } else {
                            // It is raw binary data, convert it to base64 Data URL
                            const base64 = fotoBuffer.toString('base64');
                            const isPng = fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50;
                            const mime = isPng ? 'image/png' : 'image/jpeg';
                            colaborador.foto_colaborador = `data:${mime};base64,${base64}`;
                        }
                    } else if (typeof fotoBuffer === 'string') {
                        if (!fotoBuffer.startsWith('data:image/')) {
                            // Raw base64 string, wrap it
                            colaborador.foto_colaborador = `data:image/jpeg;base64,${fotoBuffer.replace(/[\r\n\s]+/g, '')}`;
                        } else {
                            colaborador.foto_colaborador = fotoBuffer.replace(/[\r\n\s]+/g, '');
                        }
                    }
                } else {
                    colaborador.foto_colaborador = null;
                }
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar colaboradores:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to list collaborators for a specific paróquia
app.get('/api/colaboradores/paroquia/:id_paroquia', async (req, res) => {
    const { id_paroquia } = req.params;
    try {
        const query = `
            SELECT c.id_colaborador, c.nome_colaborador, c.apelido_colaborador, c.telefone, c.email,
                   c.perfil AS nome_perfil, c.perfil AS id_perfil, c.status
            FROM colaboradores c
            WHERE c.id_paroquia = ?
            ORDER BY c.nome_colaborador ASC
        `;
        const [rows] = await pool.query(query, [id_paroquia]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar colaboradores da paróquia:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to delete a colaborador
app.delete('/api/colaboradores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM colaboradores WHERE id_colaborador = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar colaborador:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to serve collaborator photo as a binary image stream (lightweight for lists)
app.get('/api/colaboradores/:id/foto', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] GET /api/colaboradores/${id}/foto`);
    try {
        const [rows] = await pool.query(
            'SELECT foto_colaborador FROM colaboradores WHERE id_colaborador = ?', [id]
        );
        if (rows.length === 0 || !rows[0].foto_colaborador || rows[0].foto_colaborador.length === 0) {
            console.log(`[API] GET /api/colaboradores/${id}/foto - Not Found`);
            // Serve default image from public folder if it exists, otherwise 404
            return res.status(404).send('Foto não encontrada');
        }
        const fotoRaw = rows[0].foto_colaborador;
        let fotoBuffer;

        if (Buffer.isBuffer(fotoRaw)) {
            // Check if it starts with the string "data:image/"
            const prefix = fotoRaw.subarray(0, 11).toString('utf-8');
            if (prefix === 'data:image/') {
                // It is a base64 Data URL string stored in the buffer
                const fotoStr = fotoRaw.toString('utf-8');
                const base64Data = fotoStr.replace(/^data:image\/\w+;base64,/, '');
                fotoBuffer = Buffer.from(base64Data, 'base64');
            } else {
                // It is raw binary image data
                fotoBuffer = fotoRaw;
            }
        } else if (typeof fotoRaw === 'string') {
            // Armazenado como string Base64 (com ou sem prefixo data URI)
            const base64Data = fotoRaw.replace(/^data:image\/\w+;base64,/, '');
            fotoBuffer = Buffer.from(base64Data, 'base64');
        } else {
            return res.status(404).send('Foto não encontrada');
        }

        // Detect JPEG or PNG by magic bytes
        let contentType = 'image/jpeg';
        if (fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50) {
            contentType = 'image/png';
        }
        res.set('Content-Type', contentType);
        // Cache por colaborador: usa ETag baseado no ID para evitar colisão de cache entre colaboradores
        res.set('ETag', `"foto-colaborador-${id}"`);
        res.set('Cache-Control', 'private, max-age=3600'); // cache privado por 1 hora por colaborador
        res.send(fotoBuffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum values for colaborador perfil
app.get('/api/colaboradores/perfis', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM colaboradores LIKE 'perfil'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Admin','Outro')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter perfis de colaboradores:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get a single colaborador by ID with relational info for edits
app.get('/api/colaboradores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT c.*, c.perfil AS id_perfil, e.id_pais
            FROM colaboradores c
            LEFT JOIN estados e ON c.id_estado = e.id_estado
            WHERE c.id_colaborador = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Colaborador não encontrado' });
        const colaborador = rows[0];
        // Convert photo Buffer/Base64 to standard data URL for frontend display
        if (colaborador.foto_colaborador && colaborador.foto_colaborador.length > 0) {
            let fotoBuffer = colaborador.foto_colaborador;
            if (Buffer.isBuffer(fotoBuffer)) {
                const prefix = fotoBuffer.subarray(0, 11).toString('utf-8');
                if (prefix === 'data:image/') {
                    // It is already a base64 Data URL string stored as bytes
                    colaborador.foto_colaborador = fotoBuffer.toString('utf-8').replace(/[\r\n\s]+/g, '');
                } else {
                    // It is raw binary data, convert it to base64 Data URL
                    const base64 = fotoBuffer.toString('base64');
                    const isPng = fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50;
                    const mime = isPng ? 'image/png' : 'image/jpeg';
                    colaborador.foto_colaborador = `data:${mime};base64,${base64}`;
                }
            } else if (typeof fotoBuffer === 'string') {
                if (!fotoBuffer.startsWith('data:image/')) {
                    // Raw base64 string, wrap it
                    colaborador.foto_colaborador = `data:image/jpeg;base64,${fotoBuffer.replace(/[\r\n\s]+/g, '')}`;
                } else {
                    colaborador.foto_colaborador = fotoBuffer.replace(/[\r\n\s]+/g, '');
                }
            }
        } else {
            colaborador.foto_colaborador = null;
        }
        res.json(colaborador);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to list trainings for a specific collaborator with dates
app.get('/api/colaboradores/:id/treinamentos', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] GET /api/colaboradores/${id}/treinamentos`);
    try {
        const query = `
            SELECT tp.id AS id_participante, tp.presenca, t.id_treinamento, t.titulo, 
                   MIN(ti.data) AS menor_data, 
                   MAX(ti.data) AS maior_data
            FROM treinamento_participantes tp
            INNER JOIN treinamentos t ON tp.id_treinamento = t.id_treinamento
            LEFT JOIN treinamento_instrutores ti ON t.id_treinamento = ti.id_treinamento
            WHERE tp.id_colaborador = ?
            GROUP BY tp.id, t.id_treinamento, t.titulo, tp.presenca
            ORDER BY t.titulo ASC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] GET /api/colaboradores/:id/treinamentos:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to list activities for a specific collaborator
app.get('/api/colaboradores/:id/atividades', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] GET /api/colaboradores/${id}/atividades`);
    try {
        const query = `
            SELECT ar.id_atividade, ar.titulo, ar.data_atividade, p.nome_paroquia
            FROM atividades_realizadas_participantes arp
            INNER JOIN atividades_realizadas ar ON arp.id_atividade = ar.id_atividade
            LEFT JOIN paroquias p ON ar.paroquia_id = p.id_paroquia
            WHERE arp.id_colaborador = ?
            ORDER BY ar.data_atividade DESC, ar.titulo ASC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] GET /api/colaboradores/:id/atividades:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to delete a collaborator's activity participant association
app.delete('/api/atividades_realizadas_participantes/:id_atividade/:id_colaborador', async (req, res) => {
    const { id_atividade, id_colaborador } = req.params;
    console.log(`[API] DELETE /api/atividades_realizadas_participantes/${id_atividade}/${id_colaborador}`);
    try {
        const query = 'DELETE FROM atividades_realizadas_participantes WHERE id_atividade = ? AND id_colaborador = ?';
        await pool.query(query, [id_atividade, id_colaborador]);
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] DELETE /api/atividades_realizadas_participantes:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get participants of a specific activity
app.get('/api/atividades_realizadas/:id/participantes', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT arp.id_colaborador, c.apelido_colaborador, c.cidade
            FROM atividades_realizadas_participantes arp
            INNER JOIN colaboradores c ON arp.id_colaborador = c.id_colaborador
            WHERE arp.id_atividade = ?
            ORDER BY c.apelido_colaborador ASC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar participantes da atividade:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save participants of an activity (without duplicating)
app.post('/api/atividades_realizadas/:id/participantes', async (req, res) => {
    const { id } = req.params;
    const { colaboradores } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'ID da atividade é obrigatório.' });
    }
    if (!colaboradores || !Array.isArray(colaboradores)) {
        return res.status(400).json({ success: false, error: 'Lista de colaboradores é obrigatória.' });
    }

    try {
        for (const colabId of colaboradores) {
            const [exists] = await pool.query(
                'SELECT 1 FROM atividades_realizadas_participantes WHERE id_atividade = ? AND id_colaborador = ?',
                [parseInt(id), parseInt(colabId)]
            );
            if (exists.length === 0) {
                await pool.query(
                    'INSERT INTO atividades_realizadas_participantes (id_atividade, id_colaborador) VALUES (?, ?)',
                    [parseInt(id), parseInt(colabId)]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar participantes da atividade:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// Route to list all trainings (defined before generic :table wildcard to avoid interception)
app.get('/api/treinamentos', async (req, res) => {
    console.log('[API] GET /api/treinamentos');
    try {
        const query = 'SELECT * FROM treinamentos ORDER BY criado_em DESC';
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] GET /api/treinamentos list:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ROTAS PARA ESTRUTURA ORGANIZACIONAL (ESPECÍFICAS - ANTES DA ROTA GENÉRICA) ---

// GET: List all areas
app.get('/api/estrutura_organizacional', async (req, res) => {
    try {
        const query = `
            SELECT eo.id_area, eo.nome_area, eo.status, eo.id_colaborador_lider, eo.subordinado_id_area,
                   c.nome_colaborador AS nome_lider, c.apelido_colaborador AS apelido_lider,
                   c.foto_colaborador AS foto_lider, c.status AS status_lider,
                   eo_parent.nome_area AS nome_area_pai,
                   eo.criado_em, eo.atualizado_em, eo.id_colaborador_atualiza,
                   eo.nome_arquivo_atribuicoes
            FROM estrutura_organizacional eo
            LEFT JOIN colaboradores c ON eo.id_colaborador_lider = c.id_colaborador
            LEFT JOIN estrutura_organizacional eo_parent ON eo.subordinado_id_area = eo_parent.id_area
            ORDER BY eo.nome_area ASC
        `;
        const [rows] = await pool.query(query);

        // Convert photo Buffer to base64 Data URL
        for (const area of rows) {
            if (area.foto_lider && area.foto_lider.length > 0) {
                let fotoBuffer = area.foto_lider;
                if (Buffer.isBuffer(fotoBuffer)) {
                    const prefix = fotoBuffer.subarray(0, 11).toString('utf-8');
                    if (prefix === 'data:image/') {
                        area.foto_lider = fotoBuffer.toString('utf-8').replace(/[\r\n\s]+/g, '');
                    } else {
                        const base64 = fotoBuffer.toString('base64');
                        const isPng = fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50;
                        const mime = isPng ? 'image/png' : 'image/jpeg';
                        area.foto_lider = `data:${mime};base64,${base64}`;
                    }
                } else if (typeof fotoBuffer === 'string') {
                    if (!fotoBuffer.startsWith('data:image/')) {
                        area.foto_lider = `data:image/jpeg;base64,${fotoBuffer.replace(/[\r\n\s]+/g, '')}`;
                    } else {
                        area.foto_lider = fotoBuffer.replace(/[\r\n\s]+/g, '');
                    }
                }
            } else {
                area.foto_lider = null;
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro ao obter estrutura organizacional:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Get specific area details
app.get('/api/estrutura_organizacional/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT eo.id_area, eo.nome_area, eo.status, eo.id_colaborador_lider, eo.subordinado_id_area,
                   c.nome_colaborador AS nome_lider, c.apelido_colaborador AS apelido_lider,
                   c.foto_colaborador AS foto_lider,
                   eo_parent.nome_area AS nome_area_pai,
                   eo.criado_em, eo.atualizado_em, eo.id_colaborador_atualiza,
                   col_up.apelido_colaborador AS nome_colaborador_atualiza,
                   eo.nome_arquivo_atribuicoes
            FROM estrutura_organizacional eo
            LEFT JOIN colaboradores c ON eo.id_colaborador_lider = c.id_colaborador
            LEFT JOIN estrutura_organizacional eo_parent ON eo.subordinado_id_area = eo_parent.id_area
            LEFT JOIN colaboradores col_up ON eo.id_colaborador_atualiza = col_up.id_colaborador
            WHERE eo.id_area = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Área não encontrada' });
        }

        const area = rows[0];
        if (area.foto_lider && area.foto_lider.length > 0) {
            let fotoBuffer = area.foto_lider;
            if (Buffer.isBuffer(fotoBuffer)) {
                const prefix = fotoBuffer.subarray(0, 11).toString('utf-8');
                if (prefix === 'data:image/') {
                    area.foto_lider = fotoBuffer.toString('utf-8').replace(/[\r\n\s]+/g, '');
                } else {
                    const base64 = fotoBuffer.toString('base64');
                    const isPng = fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50;
                    const mime = isPng ? 'image/png' : 'image/jpeg';
                    area.foto_lider = `data:${mime};base64,${base64}`;
                }
            } else if (typeof fotoBuffer === 'string') {
                if (!fotoBuffer.startsWith('data:image/')) {
                    area.foto_lider = `data:image/jpeg;base64,${fotoBuffer.replace(/[\r\n\s]+/g, '')}`;
                } else {
                    area.foto_lider = fotoBuffer.replace(/[\r\n\s]+/g, '');
                }
            }
        } else {
            area.foto_lider = null;
        }

        res.json(area);
    } catch (err) {
        console.error('Erro ao obter detalhe de estrutura organizacional:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Get PDF document for a specific area
app.get('/api/estrutura_organizacional/:id/documento', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT nome_arquivo_atribuicoes, arquivo_atribuicoes FROM estrutura_organizacional WHERE id_area = ?',
            [id]
        );
        if (rows.length === 0 || !rows[0].arquivo_atribuicoes) {
            return res.status(404).send('Documento não encontrado');
        }
        
        const doc = rows[0];
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.nome_arquivo_atribuicoes || 'documento.pdf'}"`);
        res.send(doc.arquivo_atribuicoes);
    } catch (err) {
        console.error('Erro ao buscar documento:', err);
        res.status(500).send('Erro interno do servidor');
    }
});
// Route to get a specific banner aniversariantes
app.get('/api/banner_aniversariantes/:ano/:mes', async (req, res) => {
    const { ano, mes } = req.params;
    console.log(`GET /api/banner_aniversariantes/${ano}/${mes}`);
    try {
        const query = `
            SELECT b.ano, b.mes, b.santo_referencia, b.texto_aniversariantes, b.imagem, b.criado_em, b.atualizado_em, b.id_colaborador_atualiza, c.apelido_colaborador AS nome_colaborador
            FROM banner_aniversariantes b
            LEFT JOIN colaboradores c ON b.id_colaborador_atualiza = c.id_colaborador
            WHERE b.ano = ? AND b.mes = ?
        `;
        const [rows] = await pool.query(query, [parseInt(ano, 10), parseInt(mes, 10)]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Banner não encontrado' });
        }

        const banner = rows[0];
        let imagemBase64 = null;
        if (banner.imagem) {
            imagemBase64 = `data:image/png;base64,${banner.imagem.toString('base64')}`;
        }

        res.json({
            ano: banner.ano,
            mes: banner.mes,
            santo_referencia: banner.santo_referencia,
            texto_aniversariantes: banner.texto_aniversariantes,
            imagem: imagemBase64,
            criado_em: banner.criado_em,
            atualizado_em: banner.atualizado_em,
            id_colaborador_atualiza: banner.id_colaborador_atualiza,
            nome_colaborador: banner.nome_colaborador
        });
    } catch (err) {
        console.error('Erro ao buscar banner:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to list all banner aniversariantes
app.get('/api/banner_aniversariantes', async (req, res) => {
    console.log('GET /api/banner_aniversariantes');
    try {
        const query = 'SELECT ano, mes, santo_referencia FROM banner_aniversariantes ORDER BY mes DESC, ano ASC';
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar banners:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to list all calendar events (joining with calendario_datas)
app.get('/api/calendario', async (req, res) => {
    console.log('GET /api/calendario');
    try {
        const query = `
            SELECT c.id_calendario, c.id_evento, c.nome_evento, c.calendario_religioso, c.feriado, c.recorrente, c.onde, c.id_paroquia, c.hora, c.observacoes, cd.data 
            FROM calendario c
            INNER JOIN calendario_datas cd ON c.id_calendario = cd.id_calendario AND c.id_evento = cd.id_evento
            ORDER BY cd.data ASC, c.hora ASC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar eventos do calendario:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum values for calendario onde
app.get('/api/calendario/onde/valores', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM calendario LIKE 'onde'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Google meeting','Instagram','Paroquia','Não se aplica')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter valores de onde do calendario:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get a single calendar event by id (with its dates)
app.get('/api/calendario/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`GET /api/calendario/${id}`);
    try {
        const eventQuery = `
            SELECT c.*, col.nome_colaborador AS nome_colaborador_atualiza
            FROM calendario c
            LEFT JOIN colaboradores col ON c.id_colaborador_atualiza = col.id_colaborador
            WHERE c.id_calendario = ?
        `;
        const [eventRows] = await pool.query(eventQuery, [parseInt(id, 10)]);
        if (eventRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Evento não encontrado' });
        }
        const event = eventRows[0];

        const datesQuery = 'SELECT data FROM calendario_datas WHERE id_calendario = ?';
        const [dateRows] = await pool.query(datesQuery, [parseInt(id, 10)]);
        
        event.datas = dateRows.map(row => row.data);
        res.json(event);
    } catch (err) {
        console.error(`Erro ao buscar evento ${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save or update calendar events and their dates
app.post('/api/calendario/save', async (req, res) => {
    console.log('POST /api/calendario/save - Body:', req.body);
    const {
        id_calendario,
        nome_evento,
        calendario_religioso,
        feriado,
        recorrente,
        onde,
        id_paroquia,
        hora,
        observacoes,
        id_colaborador_atualiza,
        datas
    } = req.body;

    if (!nome_evento) {
        return res.status(400).json({ success: false, error: 'Nome do evento é obrigatório.' });
    }
    if (!recorrente) {
        return res.status(400).json({ success: false, error: 'Campo Recorrente é obrigatório.' });
    }
    if (!onde) {
        return res.status(400).json({ success: false, error: 'Campo Onde é obrigatório.' });
    }
    if (onde === 'Paroquia' && !id_paroquia) {
        return res.status(400).json({ success: false, error: 'Paróquia é obrigatória quando local é Paróquia.' });
    }
    if (!datas || !Array.isArray(datas) || datas.length === 0) {
        return res.status(400).json({ success: false, error: 'Ao menos uma data deve ser incluída.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let eventId = id_calendario ? parseInt(id_calendario, 10) : null;
        const relVal = (calendario_religioso === 'Sim' || calendario_religioso === true) ? 'Sim' : 'Não';
        const feriadoVal = (feriado === 'Sim' || feriado === true) ? 'Sim' : 'Não';
        const paroquiaId = id_paroquia ? parseInt(id_paroquia, 10) : null;
        const colabId = id_colaborador_atualiza ? parseInt(id_colaborador_atualiza, 10) : 2;

        if (eventId) {
            // Update event
            const updateQuery = `
                UPDATE calendario 
                SET nome_evento = ?, calendario_religioso = ?, feriado = ?, recorrente = ?, onde = ?, id_paroquia = ?, hora = ?, observacoes = ?, id_colaborador_atualiza = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id_calendario = ?
            `;
            await connection.query(updateQuery, [
                nome_evento,
                relVal,
                feriadoVal,
                recorrente,
                onde,
                paroquiaId,
                hora || null,
                observacoes || null,
                colabId,
                eventId
            ]);

            // Delete existing dates
            await connection.query('DELETE FROM calendario_datas WHERE id_calendario = ?', [eventId]);
        } else {
            // Insert event
            const [maxRows] = await connection.query('SELECT COALESCE(MAX(id_evento), 0) + 1 AS nextId FROM calendario');
            const nextIdEvento = maxRows[0].nextId;

            const insertQuery = `
                INSERT INTO calendario (id_evento, nome_evento, calendario_religioso, feriado, recorrente, onde, id_paroquia, hora, observacoes, id_colaborador_atualiza, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            const [result] = await connection.query(insertQuery, [
                nextIdEvento,
                nome_evento,
                relVal,
                feriadoVal,
                recorrente,
                onde,
                paroquiaId,
                hora || null,
                observacoes || null,
                colabId
            ]);
            eventId = result.insertId;
        }

        // Get id_evento
        const [evRows] = await connection.query('SELECT id_evento FROM calendario WHERE id_calendario = ?', [eventId]);
        const idEvento = evRows[0].id_evento;

        // Insert dates
        const dateValues = datas.map(d => [eventId, idEvento, parseInt(d, 10)]);
        await connection.query('INSERT INTO calendario_datas (id_calendario, id_evento, data) VALUES ?', [dateValues]);

        await connection.commit();
        res.json({ success: true, id_calendario: eventId });
    } catch (err) {
        console.error('Erro ao salvar evento no calendario:', err);
        await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }
});

// Route to delete a calendar event and its dates
app.delete('/api/calendario/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/calendario/${id}`);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Delete associated dates
        await connection.query('DELETE FROM calendario_datas WHERE id_calendario = ?', [parseInt(id, 10)]);

        // Delete event
        const [result] = await connection.query('DELETE FROM calendario WHERE id_calendario = ?', [parseInt(id, 10)]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Evento não encontrado' });
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        console.error(`Erro ao deletar evento ${id}:`, err);
        await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }
});

// Route to add a single date to an event
app.post('/api/calendario/:id/data', async (req, res) => {
    const { id } = req.params;
    const { data } = req.body;
    if (!data) {
        return res.status(400).json({ success: false, error: 'Data é obrigatória.' });
    }
    try {
        const [rows] = await pool.query('SELECT id_evento FROM calendario WHERE id_calendario = ?', [parseInt(id, 10)]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Evento não encontrado.' });
        }
        const id_evento = rows[0].id_evento;

        const [existing] = await pool.query(
            'SELECT 1 FROM calendario_datas WHERE id_calendario = ? AND data = ?',
            [parseInt(id, 10), parseInt(data, 10)]
        );
        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO calendario_datas (id_calendario, id_evento, data) VALUES (?, ?, ?)',
                [parseInt(id, 10), id_evento, parseInt(data, 10)]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao adicionar data ao evento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a single date from an event
app.delete('/api/calendario/:id/data/:data', async (req, res) => {
    const { id, data } = req.params;
    try {
        await pool.query(
            'DELETE FROM calendario_datas WHERE id_calendario = ? AND data = ?',
            [parseInt(id, 10), parseInt(data, 10)]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao remover data do evento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to save/update banner aniversariantes
app.post('/api/banner_aniversariantes/save', async (req, res) => {
    console.log('POST /api/banner_aniversariantes/save - Body keys:', Object.keys(req.body));
    const { ano, mes, santo_referencia, texto_aniversariantes, imagem, id_colaborador_atualiza } = req.body;
    
    if (ano === undefined || mes === undefined) {
        return res.status(400).json({ success: false, error: "Ano (mês) e Mês (ano) são obrigatórios." });
    }

    try {
        // Check if record exists for this PRIMARY KEY (ano, mes)
        const checkQuery = 'SELECT 1 FROM banner_aniversariantes WHERE ano = ? AND mes = ?';
        const [existing] = await pool.query(checkQuery, [parseInt(ano, 10), parseInt(mes, 10)]);
        
        let imageBuffer = null;
        if (imagem) {
            const matches = imagem.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                imageBuffer = Buffer.from(matches[2], 'base64');
            } else {
                imageBuffer = Buffer.from(imagem, 'base64');
            }
        }

        if (existing.length > 0) {
            // Update
            console.log(`Atualizando banner_aniversariantes para ano=${ano}, mes=${mes}...`);
            let updateQuery = 'UPDATE banner_aniversariantes SET santo_referencia = ?, texto_aniversariantes = ?, id_colaborador_atualiza = ?, atualizado_em = NOW()';
            const params = [santo_referencia, texto_aniversariantes, parseInt(id_colaborador_atualiza, 10) || 2];
            
            if (imageBuffer) {
                updateQuery += ', imagem = ?';
                params.push(imageBuffer);
            }
            
            updateQuery += ' WHERE ano = ? AND mes = ?';
            params.push(parseInt(ano, 10), parseInt(mes, 10));
            
            await pool.query(updateQuery, params);
            res.json({ success: true, mode: 'update' });
        } else {
            // Insert
            console.log(`Inserindo novo banner_aniversariantes para ano=${ano}, mes=${mes}...`);
            const insertQuery = 'INSERT INTO banner_aniversariantes (ano, mes, santo_referencia, texto_aniversariantes, imagem, id_colaborador_atualiza, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, NOW(), NULL)';
            await pool.query(insertQuery, [
                parseInt(ano, 10), 
                parseInt(mes, 10), 
                santo_referencia, 
                texto_aniversariantes, 
                imageBuffer, 
                parseInt(id_colaborador_atualiza, 10) || 2
            ]);
            res.status(201).json({ success: true, mode: 'insert' });
        }
    } catch (err) {
        console.error('Erro ao salvar banner aniversariantes:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a banner aniversariantes
app.delete('/api/banner_aniversariantes/:ano/:mes', async (req, res) => {
    const { ano, mes } = req.params;
    console.log(`DELETE /api/banner_aniversariantes/${ano}/${mes}`);
    try {
        const query = 'DELETE FROM banner_aniversariantes WHERE ano = ? AND mes = ?';
        await pool.query(query, [parseInt(ano, 10), parseInt(mes, 10)]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao excluir banner:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET: Status enum options for projects table
app.get('/api/projetos/status-options', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? 
              AND TABLE_NAME = 'projetos' 
              AND COLUMN_NAME = 'status'
        `, [process.env.DB_NAME || 'adocao_espiritual']);

        if (rows.length > 0) {
            const columnType = rows[0].COLUMN_TYPE;
            const match = columnType.match(/^enum\((.*)\)$/);
            if (match) {
                const options = match[1]
                    .split(',')
                    .map(val => val.trim().replace(/^'(.*)'$/, '$1').replace(/\\'/g, "'"));
                return res.json(options);
            }
        }
        res.json(['Não iniciado', 'Em andamento', 'Cancelado', 'Encerrado']);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/status-options:', err);
        res.json(['Não iniciado', 'Em andamento', 'Cancelado', 'Encerrado']);
    }
});

// GET: List all projects
app.get('/api/projetos', async (req, res) => {
    try {
        const query = `
            SELECT p.id_projeto, p.nome_projeto, p.id_area, eo.nome_area, p.data_inicio, p.data_fim, p.status
            FROM projetos p
            LEFT JOIN estrutura_organizacional eo ON p.id_area = eo.id_area
            ORDER BY p.nome_projeto ASC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Get specific project details
app.get('/api/projetos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT p.id_projeto, p.nome_projeto, p.id_area, p.objetivo_projeto, p.data_inicio, p.data_fim, p.status, p.observacoes,
                   p.criado_em, p.atualizado_em, p.id_colaborador_atualiza,
                   c.apelido_colaborador AS nome_colaborador_atualiza
            FROM projetos p
            LEFT JOIN colaboradores c ON p.id_colaborador_atualiza = c.id_colaborador
            WHERE p.id_projeto = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Save/Update project
app.post('/api/projetos/save', async (req, res) => {
    console.log('POST /api/projetos/save - Body:', req.body);
    const { id, nome_projeto, id_area, objetivo_projeto, data_inicio, data_fim, status, observacoes, id_colaborador_atualiza } = req.body;

    try {
        // Validation
        if (!nome_projeto || nome_projeto.trim() === '') {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, preencha o Nome do projeto.' });
        }
        if (!id_area) {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, selecione a Área responsável.' });
        }
        if (!status) {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, selecione o Status.' });
        }
        if (!objetivo_projeto || objetivo_projeto.trim() === '') {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, preencha o Objetivo.' });
        }

        const areaId = parseInt(id_area, 10);
        const colabId = id_colaborador_atualiza ? parseInt(id_colaborador_atualiza, 10) : null;
        const dInicio = data_inicio ? data_inicio : null;
        const dFim = data_fim ? data_fim : null;

        if (id) {
            // Edit mode (Alteração)
            // O campo criado_em não deve ser gravado/alterado
            const query = `
                UPDATE projetos 
                SET nome_projeto = ?, id_area = ?, objetivo_projeto = ?, data_inicio = ?, data_fim = ?, status = ?, observacoes = ?, id_colaborador_atualiza = ?, atualizado_em = NOW()
                WHERE id_projeto = ?
            `;
            await pool.query(query, [nome_projeto.trim(), areaId, objetivo_projeto.trim(), dInicio, dFim, status, observacoes ? observacoes.trim() : null, colabId, parseInt(id, 10)]);
            res.json({ success: true, id });
        } else {
            // Creation mode (Inclusão)
            // O campo atualizado_em deve ser gravado como NULL (não atualizado)
            const query = `
                INSERT INTO projetos (nome_projeto, id_area, objetivo_projeto, data_inicio, data_fim, status, observacoes, id_colaborador_atualiza, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)
            `;
            const [result] = await pool.query(query, [nome_projeto.trim(), areaId, objetivo_projeto.trim(), dInicio, dFim, status, observacoes ? observacoes.trim() : null, colabId]);
            res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('[API ERROR] POST /api/projetos/save:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE: Delete project
app.delete('/api/projetos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM projetos WHERE id_projeto = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] DELETE /api/projetos/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ROTAS PARA TAREFAS DE PROJETOS ---

// GET: List tasks for a specific project
app.get('/api/projetos/:id/tarefas', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT pt.id_tarefa, pt.id_projeto, pt.descricao_tarefa, pt.inicio_previsto, pt.fim_previsto, pt.id_colaborador, c.apelido_colaborador, pt.status, pt.perc_atingido, pt.observacoes, pt.descricao_detalhada, pt.criado_em
            FROM projetos_tarefas pt
            LEFT JOIN colaboradores c ON pt.id_colaborador = c.id_colaborador
            WHERE pt.id_projeto = ?
            ORDER BY pt.criado_em ASC, pt.id_tarefa ASC
        `;
        const [tasks] = await pool.query(query, [id]);

        // Fetch all activities for this project
        const [activities] = await pool.query(
            'SELECT id_atividade, id_tarefa, descricao, status, perc_atingido FROM projetos_tarefas_atividades WHERE id_projeto = ? ORDER BY id_atividade ASC',
            [id]
        );

        // Group activities by id_tarefa
        const activitiesByTask = {};
        activities.forEach(act => {
            if (!activitiesByTask[act.id_tarefa]) {
                activitiesByTask[act.id_tarefa] = [];
            }
            activitiesByTask[act.id_tarefa].push(act);
        });

        // Append activities to tasks
        const tasksWithActivities = tasks.map(t => {
            return {
                ...t,
                atividades: activitiesByTask[t.id_tarefa] || []
            };
        });

        res.json(tasksWithActivities);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/:id/tarefas:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Save/Update task
app.post('/api/projetos/tarefas/save', async (req, res) => {
    console.log('POST /api/projetos/tarefas/save - Body:', req.body);
    const { id_tarefa, id_projeto, descricao_tarefa, inicio_previsto, fim_previsto, id_colaborador, status, perc_atingido, observacoes, descricao_detalhada } = req.body;

    try {
        // Validation
        if (!id_projeto) {
            return res.status(400).json({ success: false, error: 'ID do projeto é obrigatório.' });
        }
        if (!descricao_tarefa || descricao_tarefa.trim() === '') {
            return res.status(400).json({ success: false, error: 'Atividade é obrigatória.' });
        }
        if (!descricao_detalhada || descricao_detalhada.trim() === '') {
            return res.status(400).json({ success: false, error: 'Descrição da tarefa é obrigatória.' });
        }
        if (!status) {
            return res.status(400).json({ success: false, error: 'Status é obrigatório.' });
        }

        const projId = parseInt(id_projeto, 10);
        const colabId = id_colaborador ? parseInt(id_colaborador, 10) : null;
        const perc = perc_atingido !== undefined && perc_atingido !== null && perc_atingido !== '' ? parseInt(perc_atingido, 10) : null;

        if (perc === 100 && status !== 'Concluída') {
            return res.status(400).json({ success: false, error: 'Por favor, altere o Status para "Concluída" ou reduza o % Atingido (pois a tarefa está marcada como 100% atingida).' });
        }
        if (status === 'Concluída' && (perc === null || perc < 100)) {
            return res.status(400).json({ success: false, error: 'Uma tarefa concluída deve ter 100% de atingimento. Por favor, ajuste o % Atingido para 100 ou altere o Status.' });
        }

        const dInicio = inicio_previsto ? inicio_previsto : null;
        const dFim = fim_previsto ? fim_previsto : null;
        const obs = observacoes ? observacoes.trim() : null;
        const descDet = descricao_detalhada ? descricao_detalhada.trim() : null;

        if (id_tarefa) {
            // Update
            const query = `
                UPDATE projetos_tarefas
                SET descricao_tarefa = ?, inicio_previsto = ?, fim_previsto = ?, id_colaborador = ?, status = ?, perc_atingido = ?, observacoes = ?, descricao_detalhada = ?
                WHERE id_tarefa = ?
            `;
            await pool.query(query, [descricao_tarefa.trim(), dInicio, dFim, colabId, status, perc, obs, descDet, parseInt(id_tarefa, 10)]);
            res.json({ success: true, id_tarefa });
        } else {
            // Insert - generate id_tarefa manually
            const [rows] = await pool.query('SELECT COALESCE(MAX(id_tarefa), 0) + 1 AS nextId FROM projetos_tarefas');
            const nextId = rows[0].nextId;

            const query = `
                INSERT INTO projetos_tarefas (id_tarefa, id_projeto, descricao_tarefa, inicio_previsto, fim_previsto, id_colaborador, status, perc_atingido, observacoes, descricao_detalhada, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            await pool.query(query, [nextId, projId, descricao_tarefa.trim(), dInicio, dFim, colabId, status, perc, obs, descDet]);
            res.json({ success: true, id_tarefa: nextId });
        }
    } catch (err) {
        console.error('[API ERROR] POST /api/projetos/tarefas/save:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE: Delete task
app.delete('/api/projetos/tarefas/:id_tarefa', async (req, res) => {
    const { id_tarefa } = req.params;
    try {
        await pool.query('DELETE FROM projetos_tarefas WHERE id_tarefa = ?', [id_tarefa]);
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] DELETE /api/projetos/tarefas/:id_tarefa:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST: Save project task activity
app.post('/api/projetos/tarefas/atividades/save', async (req, res) => {
    console.log('POST /api/projetos/tarefas/atividades/save - Body:', req.body);
    const { id_projeto, id_tarefa, id_atividade, descricao, status, perc_atingido } = req.body;

    try {
        if (!id_projeto) {
            return res.status(400).json({ success: false, error: 'ID do projeto é obrigatório.' });
        }
        if (!id_tarefa) {
            return res.status(400).json({ success: false, error: 'ID da tarefa é obrigatório.' });
        }
        if (!descricao || descricao.trim() === '') {
            return res.status(400).json({ success: false, error: 'Descrição é obrigatória.' });
        }
        if (!status) {
            return res.status(400).json({ success: false, error: 'Status é obrigatório.' });
        }

        const projId = parseInt(id_projeto, 10);
        const taskId = parseInt(id_tarefa, 10);
        const perc = perc_atingido !== undefined && perc_atingido !== null && perc_atingido !== '' ? parseInt(perc_atingido, 10) : 0;

        if (id_atividade) {
            // Update
            const query = `
                UPDATE projetos_tarefas_atividades
                SET descricao = ?, status = ?, perc_atingido = ?
                WHERE id_atividade = ?
            `;
            await pool.query(query, [descricao.trim(), status, perc, parseInt(id_atividade, 10)]);
            res.json({ success: true, id_atividade });
        } else {
            // Insert - generate id_atividade manually
            const [rows] = await pool.query('SELECT COALESCE(MAX(id_atividade), 0) + 1 AS nextId FROM projetos_tarefas_atividades');
            const nextId = rows[0].nextId;

            const query = `
                INSERT INTO projetos_tarefas_atividades (id_projeto, id_tarefa, id_atividade, descricao, status, perc_atingido)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await pool.query(query, [projId, taskId, nextId, descricao.trim(), status, perc]);
            res.json({ success: true, id_atividade: nextId });
        }
    } catch (err) {
        console.error('[API ERROR] POST /api/projetos/tarefas/atividades/save:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET: Fetch a single task activity
app.get('/api/projetos/tarefas/atividades/:id_atividade', async (req, res) => {
    const { id_atividade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM projetos_tarefas_atividades WHERE id_atividade = ?', [id_atividade]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Atividade não encontrada' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/tarefas/atividades/:id_atividade:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Delete project task activity
app.delete('/api/projetos/tarefas/atividades/:id_atividade', async (req, res) => {
    const { id_atividade } = req.params;
    try {
        await pool.query('DELETE FROM projetos_tarefas_atividades WHERE id_atividade = ?', [id_atividade]);
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] DELETE /api/projetos/tarefas/atividades/:id_atividade:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- ROTAS PARA REUNIÕES DE PROJETOS ---

// GET: List meetings for a specific project
app.get('/api/projetos/:id/reunioes', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT id_projeto, id_reuniao, data, descricao_resolvido, participantes
            FROM projetos_reunioes
            WHERE id_projeto = ?
            ORDER BY data DESC, id_reuniao DESC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/:id/reunioes:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch details of a single meeting
app.get('/api/projetos/reunioes/:id_reuniao', async (req, res) => {
    const { id_reuniao } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM projetos_reunioes WHERE id_reuniao = ?', [id_reuniao]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Reunião não encontrada' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/reunioes/:id_reuniao:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Save/Update project meeting
app.post('/api/projetos/reunioes/save', async (req, res) => {
    console.log('POST /api/projetos/reunioes/save - Body:', req.body);
    const { id_projeto, id_reuniao, data, descricao_resolvido, participantes } = req.body;

    try {
        if (!id_projeto) {
            return res.status(400).json({ success: false, error: 'ID do projeto é obrigatório.' });
        }
        if (!data) {
            return res.status(400).json({ success: false, error: 'Data da reunião é obrigatória.' });
        }
        if (!descricao_resolvido || descricao_resolvido.trim() === '') {
            return res.status(400).json({ success: false, error: 'O que foi resolvido é obrigatório.' });
        }
        if (!participantes || participantes.trim() === '') {
            return res.status(400).json({ success: false, error: 'Participantes são obrigatórios.' });
        }

        const projId = parseInt(id_projeto, 10);

        if (id_reuniao) {
            // Update
            const query = `
                UPDATE projetos_reunioes
                SET data = ?, descricao_resolvido = ?, participantes = ?
                WHERE id_reuniao = ?
            `;
            await pool.query(query, [data, descricao_resolvido.trim(), participantes.trim(), parseInt(id_reuniao, 10)]);
            res.json({ success: true, id_reuniao });
        } else {
            // Insert - generate id_reuniao manually
            const [rows] = await pool.query('SELECT COALESCE(MAX(id_reuniao), 0) + 1 AS nextId FROM projetos_reunioes');
            const nextId = rows[0].nextId;

            const query = `
                INSERT INTO projetos_reunioes (id_projeto, id_reuniao, data, descricao_resolvido, participantes)
                VALUES (?, ?, ?, ?, ?)
            `;
            await pool.query(query, [projId, nextId, data, descricao_resolvido.trim(), participantes.trim()]);
            res.json({ success: true, id_reuniao: nextId });
        }
    } catch (err) {
        console.error('[API ERROR] POST /api/projetos/reunioes/save:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE: Delete project meeting
app.delete('/api/projetos/reunioes/:id_reuniao', async (req, res) => {
    const { id_reuniao } = req.params;
    try {
        await pool.query('DELETE FROM projetos_reunioes WHERE id_reuniao = ?', [id_reuniao]);
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] DELETE /api/projetos/reunioes/:id_reuniao:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- ROTAS PARA EQUIPE DE PROJETOS ---

// GET: List team members for a specific project
app.get('/api/projetos/:id/equipe', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT pe.id_projeto, pe.id_colaborador, c.nome_colaborador, c.apelido_colaborador, c.email, c.telefone, c.status, c.cidade, e.sigla_estado
            FROM projetos_equipes pe
            LEFT JOIN colaboradores c ON pe.id_colaborador = c.id_colaborador
            LEFT JOIN estados e ON c.id_estado = e.id_estado
            WHERE pe.id_projeto = ?
            ORDER BY c.nome_colaborador ASC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('[API ERROR] GET /api/projetos/:id/equipe:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Save project team members (bulk replacement)
app.post('/api/projetos/:id/equipe', async (req, res) => {
    console.log(`POST /api/projetos/${req.params.id}/equipe - Body:`, req.body);
    const { id } = req.params;
    const { colaboradores } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'ID do projeto é obrigatório.' });
    }
    if (!colaboradores || !Array.isArray(colaboradores)) {
        return res.status(400).json({ success: false, error: 'Lista de colaboradores é obrigatória.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete all existing team members for this project
        await connection.query('DELETE FROM projetos_equipes WHERE id_projeto = ?', [parseInt(id, 10)]);

        // 2. Insert the selected collaborators
        if (colaboradores.length > 0) {
            const values = colaboradores.map(colabId => [parseInt(id, 10), parseInt(colabId, 10)]);
            await connection.query('INSERT INTO projetos_equipes (id_projeto, id_colaborador) VALUES ?', [values]);
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] POST /api/projetos/:id/equipe:', err);
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Delete project team member
app.delete('/api/projetos/equipe/:id_projeto/:id_colaborador', async (req, res) => {
    const { id_projeto, id_colaborador } = req.params;
    try {
        await pool.query('DELETE FROM projetos_equipes WHERE id_projeto = ? AND id_colaborador = ?', [parseInt(id_projeto, 10), parseInt(id_colaborador, 10)]);
        res.json({ success: true });
    } catch (err) {
        console.error('[API ERROR] DELETE /api/projetos/equipe/:id_projeto/:id_colaborador:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Generic GET all for a table
app.get('/api/:table', async (req, res) => {
    const { table } = req.params;
    const allowedTables = ['regional', 'arquidiocese', 'paroquia', 'funcao', 'situacao', 'estados', 'pais', 'colaboradores', 'tipos_redes_sociais', 'subdivisao_arquidiocesana', 'subdivisoes_arquidiocesanas', 'divisao_arquidiocesana', 'divisoes_arquidiocesanas', 'divisao_arquidiocesana_lideranca', 'paroquia_lideranca', 'paroquia_coordenadores', 'treinamento_instrutores', 'colaborador_lideranca'];

    if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Tabela não permitida' });
    }

    let actualTable = table;
    if (table === 'subdivisao_arquidiocesana' || table === 'divisao_arquidiocesana' || table === 'divisoes_arquidiocesanas') {
        actualTable = 'divisao_arquidiocesana';
    }

    try {
        const [rows] = await pool.query(`SELECT * FROM ??`, [actualTable]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Specific route to save/update Regional with States
app.post('/api/regionais/save', async (req, res) => {
    console.log('POST /api/regionais/save - Body:', req.body);
    const { id, nome, states, id_pais, status, observacao, id_colaborador_atualiza } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // --- VALIDAÇÕES (CRÍTICAS) ---

        // 1. Verificar se o país foi preenchido
        if (!id_pais) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: "Crítica: Por favor, selecione um país." });
        }

        // 2. Verificar se o nome da regional foi preenchido
        if (!nome || nome.trim() === "") {
            await connection.rollback();
            return res.status(400).json({ success: false, error: "Crítica: Por favor, preencha o Nome da Regional." });
        }

        // 3. Verificar se o nome da regional já existe (se for nova ou se mudou o nome)
        const [existingName] = await connection.query(
            'SELECT id_regional FROM regional WHERE nome_regional = ? AND id_regional != ?',
            [nome, id || 0]
        );
        if (existingName.length > 0) {
            console.warn(`Crítica: Nome duplicado (${nome})`);
            await connection.rollback();
            return res.status(400).json({ success: false, error: `Crítica: Já existe uma regional cadastrada com o nome "${nome}".` });
        }

        // 4. Verificar se ao menos um estado foi selecionado
        if (!states || states.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: "Crítica: Por favor, selecione ao menos um estado para esta regional." });
        }

        // --- EXECUÇÃO ---

        let regionalId = id;

        if (id) {
            // Update existing
            console.log(`Atualizando regional ID ${id}...`);
            await connection.query(
                'UPDATE regional SET nome_regional = ?, ID_PAIS = ?, obs_regional = ?, status = ?, id_colaborador_atualiza = ?, criado_em = NOW(), atualizado_em = DATE_FORMAT(NOW(), "%Y-%m-%d") WHERE id_regional = ?',
                [nome, id_pais || 1, observacao || '', status || 'Ativo', id_colaborador_atualiza || null, id]
            );
            // Clear existing states
            await connection.query('DELETE FROM regional_estado WHERE id_regional = ?', [id]);
        } else {
            // Create new
            console.log(`Inserindo nova regional: ${nome}...`);
            const [result] = await connection.query(
                'INSERT INTO regional (nome_regional, ID_PAIS, obs_regional, status, id_colaborador_atualiza, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [nome, id_pais || 1, observacao || '', status || 'Ativo', id_colaborador_atualiza || null]
            );
            regionalId = result.insertId;
        }

        // Insert new states
        if (states && states.length > 0) {
            console.log(`Vinculando ${states.length} estados à regional ${regionalId}...`);
            const values = states.map(stateId => [regionalId, stateId]);
            await connection.query('INSERT INTO regional_estado (id_regional, id_estado) VALUES ?', [values]);
        }

        await connection.commit();
        console.log('Sucesso ao salvar regional!');
        res.json({ success: true, id: regionalId });
    } catch (err) {
        console.error('Erro fatal ao salvar regional:', err);
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, error: "Erro interno: " + err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Specific route to save/update Arquidiocese
app.post('/api/arquidioceses/save', async (req, res) => {
    console.log('POST /api/arquidioceses/save - Body:', req.body);
    const { id_arquidiocese, nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza, socialMedia, endereco, cep, site } = req.body;

    try {
        let savedId = id_arquidiocese;
        if (id_arquidiocese) {
            // Update
            await pool.query(
                'UPDATE arquidioceses SET nome_arquidiocese = ?, id_pais = ?, id_estado = ?, id_regional = ?, cidade = ?, arcebispo = ?, status = ?, id_colaborador_atualiza = ?, atualizado_em = NOW(), endereco = ?, cep = ?, site = ? WHERE id_arquidiocese = ?',
                [nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza || null, endereco || null, cep || null, site || null, id_arquidiocese]
            );
        } else {
            // Insert
            const [result] = await pool.query(
                'INSERT INTO arquidioceses (nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza, criado_em, endereco, cep, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)',
                [nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza || null, endereco || null, cep || null, site || null]
            );
            savedId = result.insertId;
        }

        // Save social media links to arquidiocese_midias
        if (socialMedia) {
            await pool.query('DELETE FROM arquidiocese_midias WHERE id_arquidiocese = ?', [savedId]);
            for (const [idSocial, handle] of Object.entries(socialMedia)) {
                if (handle && handle.trim() !== '') {
                    await pool.query(
                        'INSERT INTO arquidiocese_midias (id_arquidiocese, id_rede_social, nome_midia_arquidiocese) VALUES (?, ?, ?)',
                        [savedId, parseInt(idSocial), handle.trim()]
                    );
                }
            }
        }

        res.json({ success: true, id: savedId });
    } catch (err) {
        console.error('Erro ao salvar arquidiocese:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Specific route to get Arquidioceses with details (Country, Regional and State names)
app.get('/api/arquidioceses/detalhes', async (req, res) => {
    try {
        const query = `
            SELECT a.*, p.nome_pais, e.nome_estado, r.nome_regional
            FROM arquidioceses a
            LEFT JOIN pais p ON a.id_pais = p.id_pais
            LEFT JOIN estados e ON a.id_estado = e.id_estado
            LEFT JOIN regional r ON a.id_regional = r.id_regional
            ORDER BY a.criado_em DESC
        `;
        const [rows] = await pool.query(query);

        // Fetch all leadership records
        const [liderancas] = await pool.query('SELECT * FROM arquidiocese_lideranca');

        // Map leadership and addresses to each archdiocese
        for (const arq of rows) {
            const arqLiderancas = liderancas.filter(l => l.id_arquidiocese === arq.id_arquidiocese);
            
            // Extract leader names
            const names = arqLiderancas.map(l => l.nome_lider).filter(Boolean);
            if (names.length > 0) {
                arq.lideres = names.join(', ');
            } else {
                arq.lideres = arq.arcebispo || 'Nenhum líder registrado';
            }

            // Extract leader's address as fallback (do not overwrite arq.endereco)
            const firstAddress = arqLiderancas.map(l => l.endereco_completo).find(addr => addr && addr.trim().length > 0);
            arq.endereco_lider = firstAddress || 'Endereço não informado';
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum types of paroquias
app.get('/api/paroquias/tipos', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM paroquias LIKE 'tipo'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Paróquia','Comunidade')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter tipos de paróquia:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum partners of paroquias
app.get('/api/paroquias/parceiras', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM paroquias LIKE 'parceira'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Sim','Não','Em prospecção')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter opções de parceira:', err);
        res.status(500).json({ error: err.message });
    }
});

// Specific route to save/update Paroquia
app.post('/api/paroquias/save', async (req, res) => {
    console.log('POST /api/paroquias/save - Body:', req.body);
    const { id_paroquia, nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana, endereco, cidade, id_estado, status, tipo, parceira, latitude, longitude, site, observacoes, socialMedia, id_colaborador_atualiza } = req.body;

    try {
        let savedId = id_paroquia;
        const colabId = id_colaborador_atualiza ? parseInt(id_colaborador_atualiza) : null;
        const partnerVal = parceira || 'Não';

        if (id_paroquia) {
            // Update
            await pool.query(
                'UPDATE paroquias SET nome_paroquia = ?, id_arquidiocese = ?, id_divisao_arquidiocesana = ?, endereco = ?, cidade = ?, id_estado = ?, status = ?, tipo = ?, parceira = ?, latitude = ?, longitude = ?, site = ?, observacoes = ?, atualizado_em = NOW(), id_colaborador_atualiza = ? WHERE id_paroquia = ?',
                [nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana || null, endereco, cidade, id_estado, status, tipo, partnerVal, latitude, longitude, site || '', observacoes || null, colabId, id_paroquia]
            );
        } else {
            // Insert
            const [result] = await pool.query(
                'INSERT INTO paroquias (nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana, endereco, cidade, id_estado, status, tipo, parceira, latitude, longitude, site, observacoes, criado_em, atualizado_em, id_colaborador_atualiza) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, ?)',
                [nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana || null, endereco, cidade, id_estado, status, tipo, partnerVal, latitude, longitude, site || '', observacoes || null, colabId]
            );
            savedId = result.insertId;
        }

        // Save social media links to paroquias_midia
        if (socialMedia) {
            await pool.query('DELETE FROM paroquias_midia WHERE id_paroquia = ?', [savedId]);
            for (const [idSocial, handle] of Object.entries(socialMedia)) {
                if (handle && handle.trim() !== '') {
                    await pool.query(
                        'INSERT INTO paroquias_midia (id_paroquia, id_rede_social, nome_midia_paroquia) VALUES (?, ?, ?)',
                        [savedId, parseInt(idSocial), handle.trim()]
                    );
                }
            }
        }

        if (id_paroquia) {
            res.json({ success: true, id: savedId });
        } else {
            res.status(201).json({ success: true, id: savedId });
        }
    } catch (err) {
        console.error('Erro ao salvar paróquia:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Specific route to delete Paroquia
app.delete('/api/paroquias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM paroquias WHERE id_paroquia = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Paróquia não encontrada.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao excluir paróquia:', err);
        res.status(500).json({ error: 'Erro ao excluir paróquia no banco de dados.' });
    }
});

// Specific route to get Paroquias with details (Country, Regional, State and Archdiocese names)
app.get('/api/paroquias/detalhes', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id_paroquia,
                p.nome_paroquia,
                p.cidade,
                p.endereco,
                p.status,
                p.tipo,
                p.parceira,
                p.latitude,
                p.longitude,
                p.criado_em,
                p.atualizado_em,
                a.nome_arquidiocese,
                r.nome_regional,
                e.sigla_estado,
                pa.nome_pais
            FROM paroquias p
            LEFT JOIN arquidioceses a ON p.id_arquidiocese = a.id_arquidiocese
            LEFT JOIN regional r ON a.id_regional = r.id_regional
            LEFT JOIN estados e ON p.id_estado = e.id_estado
            LEFT JOIN pais pa ON a.id_pais = pa.id_pais
            ORDER BY p.criado_em DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Specific route to get Atividades Realizadas with details (Parish and Archdiocese names)
app.get('/api/atividades/detalhes', async (req, res) => {
    try {
        const query = `
            SELECT 
                ar.id_atividade,
                ar.data_atividade,
                a.nome_arquidiocese,
                p.nome_paroquia,
                ar.titulo
            FROM atividades_realizadas ar
            LEFT JOIN paroquias p ON ar.id_paroquia = p.id_paroquia
            LEFT JOIN arquidioceses a ON p.id_arquidiocese = a.id_arquidiocese
            ORDER BY ar.data_atividade DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete an activity if no participants are present
app.delete('/api/atividades_realizadas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if there are participants registered
        const [participants] = await pool.query(
            'SELECT COUNT(*) as count FROM atividades_realizadas_participantes WHERE id_atividade = ?',
            [id]
        );
        if (participants[0].count > 0) {
            return res.status(400).json({ error: 'Não é possível excluir a atividade pois ela possui participantes vinculados.' });
        }

        await pool.query('DELETE FROM atividades_realizadas WHERE id_atividade = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir atividade no banco de dados.' });
    }
});

// Route to get a single paroquia by ID with relational info for edits
app.get('/api/paroquias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                p.*,
                a.id_regional,
                a.id_pais,
                c.apelido_colaborador
            FROM paroquias p
            LEFT JOIN arquidioceses a ON p.id_arquidiocese = a.id_arquidiocese
            LEFT JOIN colaboradores c ON p.id_colaborador_atualiza = c.id_colaborador
            WHERE p.id_paroquia = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Paróquia não encontrada' });
        const paroquia = rows[0];

        // Fetch midias
        const [midias] = await pool.query(
            'SELECT id_rede_social, nome_midia_paroquia FROM paroquias_midia WHERE id_paroquia = ?',
            [id]
        );
        paroquia.midias = midias;

        res.json(paroquia);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get paróquias by arquidiocese
app.get('/api/paroquias/arquidiocese/:id_arquidiocese', async (req, res) => {
    const { id_arquidiocese } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM paroquias WHERE id_arquidiocese = ? ORDER BY nome_paroquia', [id_arquidiocese]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get a single Atividade Realizada by ID with relational info for edits
app.get('/api/atividades_realizadas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                ar.*,
                p.id_arquidiocese,
                a.id_regional
            FROM atividades_realizadas ar
            LEFT JOIN paroquias p ON ar.id_paroquia = p.id_paroquia
            LEFT JOIN arquidioceses a ON p.id_arquidiocese = a.id_arquidiocese
            WHERE ar.id_atividade = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Atividade não encontrada' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao obter atividade realizada:', err);
        res.status(500).json({ error: err.message });
    }
});

// Specific route to save/update Atividade Realizada
app.post('/api/atividades_realizadas/save', async (req, res) => {
    const {
        id_atividade,
        status,
        titulo,
        data_atividade,
        hora_atividade,
        formato,
        id_estado,
        id_paroquia,
        tipo,
        recorrente,
        observacoes,
        id_colaborador_atualiza
    } = req.body;

    try {
        if (id_atividade) {
            // Update
            await pool.query(
                `UPDATE atividades_realizadas SET 
                    status = ?, 
                    titulo = ?, 
                    data_atividade = ?, 
                    hora_atividade = ?, 
                    formato = ?, 
                    id_estado = ?, 
                    id_paroquia = ?, 
                    tipo = ?, 
                    recorrente = ?, 
                    observacoes = ?, 
                    id_colaborador_atualiza = ?, 
                    atualizado_em = NOW() 
                 WHERE id_atividade = ?`,
                [status, titulo, data_atividade, hora_atividade, formato, id_estado, id_paroquia, tipo, recorrente, observacoes || null, id_colaborador_atualiza, id_atividade]
            );
            res.json({ success: true, id: id_atividade });
        } else {
            // Insert
            const [result] = await pool.query(
                `INSERT INTO atividades_realizadas (
                    status, 
                    titulo, 
                    data_atividade, 
                    hora_atividade, 
                    formato, 
                    id_estado, 
                    id_paroquia, 
                    tipo, 
                    recorrente, 
                    observacoes, 
                    id_colaborador_atualiza, 
                    criado_em,
                    atualizado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)`,
                [status, titulo, data_atividade, hora_atividade, formato, id_estado, id_paroquia, tipo, recorrente, observacoes || null, id_colaborador_atualiza]
            );
            res.status(201).json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Erro ao salvar atividade realizada:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to get a single arquidiocese by ID
app.get('/api/arquidioceses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM arquidioceses WHERE id_arquidiocese = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Arquidiocese não encontrada' });
        }
        const arq = rows[0];
        // Fetch midias
        const [midias] = await pool.query('SELECT id_rede_social, nome_midia_arquidiocese FROM arquidiocese_midias WHERE id_arquidiocese = ?', [id]);
        arq.midias = midias;
        res.json(arq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get leadership for a specific arquidiocese
app.get('/api/arquidioceses/:id/lideranca', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM arquidiocese_lideranca WHERE id_arquidiocese = ?', [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get all enum titles for arquidiocese leadership
app.get('/api/arquidiocese_lideranca/titulos', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM arquidiocese_lideranca LIKE 'titulo'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Arcebispo','Bispo Auxiliar','Bispo','Bispo emérito')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter títulos de liderança:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save/update arquidiocese leadership
app.post('/api/arquidiocese_lideranca/save', async (req, res) => {
    const {
        id_arquidiocese,
        id_lideranca_arquidiocese,
        titulo,
        nome_lider,
        data_inicio_lider,
        data_fim_lider,
        endereco_completo,
        cep,
        telefone_lider,
        email_lider,
        data_aniv_natalicio,
        data_aniv_sacerdotal,
        data_aniv_episcopal
    } = req.body;

    if (!id_arquidiocese || !titulo || !nome_lider) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
    }

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return null;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }
        }
        return dateStr;
    };

    const formattedInicio = formatDate(data_inicio_lider);
    const formattedFim = formatDate(data_fim_lider);
    const formattedNatalicio = formatDate(data_aniv_natalicio);
    const formattedSacerdotal = formatDate(data_aniv_sacerdotal);
    const formattedEpiscopal = formatDate(data_aniv_episcopal);

    try {
        if (id_lideranca_arquidiocese) {
            // Update
            const query = `
                UPDATE arquidiocese_lideranca SET
                    titulo = ?,
                    nome_lider = ?,
                    data_inicio_lider = ?,
                    data_fim_lider = ?,
                    endereco_completo = ?,
                    cep = ?,
                    telefone_lider = ?,
                    email_lider = ?,
                    data_aniv_natalicio = ?,
                    data_aniv_sacerdotal = ?,
                    data_aniv_episcopal = ?
                WHERE id_lideranca_arquidiocese = ? AND id_arquidiocese = ?
            `;
            await pool.query(query, [
                titulo,
                nome_lider,
                formattedInicio,
                formattedFim,
                endereco_completo || null,
                cep || null,
                telefone_lider || null,
                email_lider || null,
                formattedNatalicio,
                formattedSacerdotal,
                formattedEpiscopal,
                id_lideranca_arquidiocese,
                id_arquidiocese
            ]);
            res.json({ success: true, id: id_lideranca_arquidiocese });
        } else {
            // Insert
            const query = `
                INSERT INTO arquidiocese_lideranca (
                    id_arquidiocese,
                    titulo,
                    nome_lider,
                    data_inicio_lider,
                    data_fim_lider,
                    endereco_completo,
                    cep,
                    telefone_lider,
                    email_lider,
                    data_aniv_natalicio,
                    data_aniv_sacerdotal,
                    data_aniv_episcopal
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await pool.query(query, [
                id_arquidiocese,
                titulo,
                nome_lider,
                formattedInicio,
                formattedFim,
                endereco_completo || null,
                cep || null,
                telefone_lider || null,
                email_lider || null,
                formattedNatalicio,
                formattedSacerdotal,
                formattedEpiscopal
            ]);
            res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Erro ao salvar liderança:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a leadership member
app.delete('/api/arquidiocese_lideranca/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM arquidiocese_lideranca WHERE id_lideranca_arquidiocese = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// --- Parish Leadership Routes ---

// Route to get leadership for a specific parish
app.get('/api/paroquias/:id/lideranca', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM paroquia_lideranca WHERE id_paroquia = ?', [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum titles for parish leadership
app.get('/api/paroquia_lideranca/titulos', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM paroquia_lideranca LIKE 'titulo'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Diacono','Monsenhor','Padre')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter títulos de liderança da paróquia:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save/update parish leadership
app.post('/api/paroquia_lideranca/save', async (req, res) => {
    const {
        id_paroquia,
        id_lideranca_paroquia,
        titulo,
        nome_lider,
        data_inicio_lider,
        data_fim_lider,
        endereco_completo,
        cep,
        telefone_lider,
        e_mail_lider,
        data_aniv_natalicio,
        data_aniv_sacerdotal,
        data_aniv_episcopal
    } = req.body;

    if (!id_paroquia || !titulo || !nome_lider) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
    }

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return null;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }
        }
        return dateStr;
    };

    const formattedInicio = formatDate(data_inicio_lider);
    const formattedFim = formatDate(data_fim_lider);
    const formattedNatalicio = formatDate(data_aniv_natalicio);
    const formattedSacerdotal = formatDate(data_aniv_sacerdotal);
    const formattedEpiscopal = formatDate(data_aniv_episcopal);

    try {
        if (id_lideranca_paroquia) {
            // Update
            const query = `
                UPDATE paroquia_lideranca SET
                    titulo = ?,
                    nome_lider = ?,
                    data_inicio_lider = ?,
                    data_fim_lider = ?,
                    endereco_completo = ?,
                    cep = ?,
                    telefone_lider = ?,
                    e_mail_lider = ?,
                    data_aniv_natalicio = ?,
                    data_aniv_sacerdotal = ?,
                    data_aniv_episcopal = ?
                WHERE id_lideranca_paroquia = ? AND id_paroquia = ?
            `;
            await pool.query(query, [
                titulo,
                nome_lider,
                formattedInicio,
                formattedFim,
                endereco_completo || '',
                cep || '',
                telefone_lider || '',
                e_mail_lider || '',
                formattedNatalicio,
                formattedSacerdotal,
                formattedEpiscopal,
                id_lideranca_paroquia,
                id_paroquia
            ]);
            res.json({ success: true, id: id_lideranca_paroquia });
        } else {
            // Insert - generate next ID
            const [maxRows] = await pool.query('SELECT COALESCE(MAX(id_lideranca_paroquia), 0) + 1 AS nextId FROM paroquia_lideranca');
            const nextId = maxRows[0].nextId;

            const query = `
                INSERT INTO paroquia_lideranca (
                    id_paroquia,
                    id_lideranca_paroquia,
                    titulo,
                    nome_lider,
                    data_inicio_lider,
                    data_fim_lider,
                    endereco_completo,
                    cep,
                    telefone_lider,
                    e_mail_lider,
                    data_aniv_natalicio,
                    data_aniv_sacerdotal,
                    data_aniv_episcopal
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await pool.query(query, [
                id_paroquia,
                nextId,
                titulo,
                nome_lider,
                formattedInicio,
                formattedFim,
                endereco_completo || '',
                cep || '',
                telefone_lider || '',
                e_mail_lider || '',
                formattedNatalicio,
                formattedSacerdotal,
                formattedEpiscopal
            ]);
            res.json({ success: true, id: nextId });
        }
    } catch (err) {
        console.error('Erro ao salvar liderança da paróquia:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a parish leadership member
app.delete('/api/paroquia_lideranca/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM paroquia_lideranca WHERE id_lideranca_paroquia = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to get relationship history for a specific parish
app.get('/api/paroquias/:id/historico', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT phr.id_paroquia, phr.data, phr.canal, phr.detalhes, phr.data_inclusao, c.apelido_colaborador
            FROM paroquias_historico_relacionamento phr
            LEFT JOIN colaboradores c ON phr.id_colaborador_atualiza = c.id_colaborador
            WHERE phr.id_paroquia = ?
            ORDER BY phr.data DESC, phr.data_inclusao DESC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar histórico de relacionamento:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get single relationship history detail by parish and timestamp
app.get('/api/paroquias/historico/detail', async (req, res) => {
    const { id_paroquia, data_inclusao } = req.query;
    if (!id_paroquia || !data_inclusao) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }
    try {
        const query = `
            SELECT phr.data, phr.canal, phr.detalhes, phr.data_inclusao, phr.id_paroquia
            FROM paroquias_historico_relacionamento phr
            WHERE phr.id_paroquia = ? AND phr.data_inclusao = ?
        `;
        const parsedDate = new Date(data_inclusao);
        const [rows] = await pool.query(query, [parseInt(id_paroquia), isNaN(parsedDate.getTime()) ? data_inclusao : parsedDate]);
        if (rows.length === 0) return res.status(404).json({ error: 'Registro não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao obter detalhes do histórico:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save/update relationship history for a specific parish
app.post('/api/paroquias/historico/save', async (req, res) => {
    const { id_paroquia, data, canal, detalhes, id_colaborador_atualiza, data_inclusao } = req.body;

    if (!id_paroquia || !data || !canal || !detalhes || !id_colaborador_atualiza) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
    }

    try {
        // Convert DD/MM/YYYY to YYYY-MM-DD
        const dateParts = data.split('/');
        if (dateParts.length !== 3) {
            return res.status(400).json({ success: false, error: 'Formato de data inválido. Use DD/MM/YYYY.' });
        }
        const mysqlDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

        if (data_inclusao) {
            // Update
            const query = `
                UPDATE paroquias_historico_relacionamento 
                SET data = ?, canal = ?, detalhes = ?, id_colaborador_atualiza = ?
                WHERE id_paroquia = ? AND data_inclusao = ?
            `;
            const parsedDate = new Date(data_inclusao);
            await pool.query(query, [mysqlDate, canal, detalhes, parseInt(id_colaborador_atualiza), parseInt(id_paroquia), isNaN(parsedDate.getTime()) ? data_inclusao : parsedDate]);
            res.json({ success: true });
        } else {
            // Insert
            const query = `
                INSERT INTO paroquias_historico_relacionamento 
                (id_paroquia, data, canal, detalhes, id_colaborador_atualiza, data_inclusao)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            await pool.query(query, [parseInt(id_paroquia), mysqlDate, canal, detalhes, parseInt(id_colaborador_atualiza)]);
            res.json({ success: true });
        }
    } catch (err) {
        console.error('Erro ao salvar histórico de relacionamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a relationship history record
app.delete('/api/paroquias/historico/delete', async (req, res) => {
    const { id_paroquia, data_inclusao } = req.query;
    if (!id_paroquia || !data_inclusao) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
    }
    try {
        const query = `
            DELETE FROM paroquias_historico_relacionamento 
            WHERE id_paroquia = ? AND data_inclusao = ?
        `;
        const parsedDate = new Date(data_inclusao);
        await pool.query(query, [parseInt(id_paroquia), isNaN(parsedDate.getTime()) ? data_inclusao : parsedDate]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao excluir histórico de relacionamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});



// --- Parish Coordinator Routes ---

// Route to get coordinators for a specific parish
app.get('/api/paroquias/:id/coordenadores', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT c.id_colaborador, c.nome_colaborador, c.apelido_colaborador, c.telefone, c.email, c.status
            FROM paroquia_coordenadores pc
            INNER JOIN colaboradores c ON pc.id_colaborador = c.id_colaborador
            WHERE pc.id_paroquia = ?
            ORDER BY c.nome_colaborador ASC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar coordenadores da paróquia:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save parish coordinators (links)
app.post('/api/paroquia_coordenadores/save', async (req, res) => {
    const { id_paroquia, coordenadores } = req.body;
    if (!id_paroquia) {
        return res.status(400).json({ success: false, error: 'ID da paróquia ausente' });
    }
    try {
        // Delete existing links for this parish
        await pool.query('DELETE FROM paroquia_coordenadores WHERE id_paroquia = ?', [id_paroquia]);

        // Insert new ones
        if (coordenadores && coordenadores.length > 0) {
            for (const id_colab of coordenadores) {
                await pool.query('INSERT INTO paroquia_coordenadores (id_paroquia, id_colaborador) VALUES (?, ?)', [id_paroquia, id_colab]);
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar coordenadores da paróquia:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// --- Division Leadership Routes ---

// Route to get leadership for a specific division (subdivision)
app.get('/api/subdivisao_arquidiocesana/:id/lideranca', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM divisao_arquidiocesana_lideranca WHERE id_divisao_arquidiocesana = ?', [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/divisao_arquidiocesana/:id/lideranca', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM divisao_arquidiocesana_lideranca WHERE id_divisao_arquidiocesana = ?', [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum titles for division leadership
app.get('/api/divisao_arquidiocesana_lideranca/titulos', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM divisao_arquidiocesana_lideranca LIKE 'titulo'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Bispo referencial','Padre referencial')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter títulos de liderança da divisão:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save/update division leadership
app.post('/api/divisao_arquidiocesana_lideranca/save', async (req, res) => {
    const {
        id_divisao_arquidiocesana,
        id_lideranca_arquidiocesana,
        titulo,
        nome_lider,
        data_inicio_lider,
        data_fim_lider,
        e_mail_lider,
        telefone_lider,
        data_aniv_natalicio,
        data_aniv_sacerdotal,
        data_aniv_episcopal,
        endereco_completo,
        cep
    } = req.body;

    if (!id_divisao_arquidiocesana || !titulo || !nome_lider) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
    }

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return null;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }
        }
        return dateStr;
    };

    const formattedInicio = formatDate(data_inicio_lider);
    const formattedFim = formatDate(data_fim_lider);
    const formattedNatalicio = formatDate(data_aniv_natalicio);
    const formattedSacerdotal = formatDate(data_aniv_sacerdotal);
    const formattedEpiscopal = formatDate(data_aniv_episcopal);

    try {
        if (id_lideranca_arquidiocesana) {
            // Update
            const query = `
                UPDATE divisao_arquidiocesana_lideranca SET
                    titulo = ?,
                    nome_lider = ?,
                    data_inicio_lider = ?,
                    data_fim_lider = ?,
                    e_mail_lider = ?,
                    telefone_lider = ?,
                    data_aniv_natalicio = ?,
                    data_aniv_sacerdotal = ?,
                    data_aniv_episcopal = ?,
                    endereco_completo = ?,
                    cep = ?
                WHERE id_lideranca_arquidiocesana = ? AND id_divisao_arquidiocesana = ?
            `;
            await pool.query(query, [
                titulo,
                nome_lider,
                formattedInicio,
                formattedFim,
                e_mail_lider || null,
                telefone_lider || null,
                formattedNatalicio,
                formattedSacerdotal,
                formattedEpiscopal,
                endereco_completo || null,
                cep || null,
                id_lideranca_arquidiocesana,
                id_divisao_arquidiocesana
            ]);
            res.json({ success: true, id: id_lideranca_arquidiocesana });
        } else {
            // Insert
            const query = `
                INSERT INTO divisao_arquidiocesana_lideranca (
                    id_divisao_arquidiocesana,
                    titulo,
                    nome_lider,
                    data_inicio_lider,
                    data_fim_lider,
                    e_mail_lider,
                    telefone_lider,
                    data_aniv_natalicio,
                    data_aniv_sacerdotal,
                    data_aniv_episcopal,
                    endereco_completo,
                    cep
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await pool.query(query, [
                id_divisao_arquidiocesana,
                titulo,
                nome_lider,
                formattedInicio,
                formattedFim,
                e_mail_lider || null,
                telefone_lider || null,
                formattedNatalicio,
                formattedSacerdotal,
                formattedEpiscopal,
                endereco_completo || null,
                cep || null
            ]);
            res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Erro ao salvar liderança da divisão:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a division leadership member
app.delete('/api/divisao_arquidiocesana_lideranca/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM divisao_arquidiocesana_lideranca WHERE id_lideranca_arquidiocesana = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});



// Route to delete Arquidiocese
app.delete('/api/arquidioceses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check for linked paroquias
        const [paroquias] = await pool.query('SELECT id_paroquia FROM paroquias WHERE id_arquidiocese = ? LIMIT 1', [id]);
        if (paroquias.length > 0) {
            return res.status(400).json({ error: 'Não é possível excluir: existem paróquias vinculadas a esta arquidiocese.' });
        }

        // Delete associated leadership first
        await pool.query('DELETE FROM arquidiocese_lideranca WHERE id_arquidiocese = ?', [id]);

        const [result] = await pool.query('DELETE FROM arquidioceses WHERE id_arquidiocese = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Arquidiocese não encontrada' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao excluir arquidiocese:', err);
        res.status(500).json({ error: err.message });
    }
});

// Specific routes for Subdivisão/Divisão Arquidiocesana
app.get('/api/subdivisao_arquidiocesana/detalhes', async (req, res) => {
    try {
        const query = `
            SELECT d.*, 
                   d.id_divisao_arquidiocesana AS id_subdivisao, 
                   d.nome_divisao_arquidiocesana AS nome_subdivisao, 
                   a.nome_arquidiocese, r.nome_regional, p.nome_pais, e.nome_estado
            FROM divisao_arquidiocesana d
            LEFT JOIN arquidioceses a ON d.id_arquidiocese = a.id_arquidiocese
            LEFT JOIN regional r ON a.id_regional = r.id_regional
            LEFT JOIN pais p ON a.id_pais = p.id_pais
            LEFT JOIN estados e ON a.id_estado = e.id_estado
            ORDER BY d.criado_em DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/subdivisoes_arquidiocesanas/detalhes', async (req, res) => {
    res.redirect('/api/subdivisao_arquidiocesana/detalhes');
});

app.get('/api/divisao_arquidiocesana/detalhes', async (req, res) => {
    res.redirect('/api/subdivisao_arquidiocesana/detalhes');
});

app.get('/api/divisao_arquidiocesana/arquidiocese/:id_arquidiocese', async (req, res) => {
    const { id_arquidiocese } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT id_divisao_arquidiocesana, nome_divisao_arquidiocesana FROM divisao_arquidiocesana WHERE id_arquidiocese = ? AND status = "ativo" ORDER BY nome_divisao_arquidiocesana ASC',
            [id_arquidiocese]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const getDivisaoById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT *, id_divisao_arquidiocesana AS id_subdivisao, nome_divisao_arquidiocesana AS nome_subdivisao FROM divisao_arquidiocesana WHERE id_divisao_arquidiocesana = ?',
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Divisão não encontrada' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/subdivisao_arquidiocesana/:id', getDivisaoById);
app.get('/api/subdivisoes_arquidiocesanas/:id', getDivisaoById);
app.get('/api/divisao_arquidiocesana/:id', getDivisaoById);

const saveDivisao = async (req, res) => {
    const { id_subdivisao, nome_subdivisao, id_arquidiocese, status, id_colaborador_atualiza } = req.body;

    if (!nome_subdivisao || !id_arquidiocese) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
    }

    try {
        let savedId = id_subdivisao;
        if (id_subdivisao) {
            // Update
            await pool.query(
                `UPDATE divisao_arquidiocesana SET 
                    id_arquidiocese = ?, 
                    nome_divisao_arquidiocesana = ?, 
                    status = ?, 
                    id_colaborador_atualiza = ?, 
                    atualizado_em = NOW() 
                 WHERE id_divisao_arquidiocesana = ?`,
                [id_arquidiocese, nome_subdivisao, status || 'ativo', id_colaborador_atualiza || null, id_subdivisao]
            );
        } else {
            // Insert
            // Generate sequential id_divisao_arquidiocesana
            const [maxRow] = await pool.query('SELECT COALESCE(MAX(id_divisao_arquidiocesana), 0) + 1 AS nextId FROM divisao_arquidiocesana');
            const nextId = maxRow[0].nextId;

            await pool.query(
                `INSERT INTO divisao_arquidiocesana (
                    id_arquidiocese, 
                    id_divisao_arquidiocesana, 
                    nome_divisao_arquidiocesana, 
                    cidade, 
                    endereco_completo, 
                    cep, 
                    status, 
                    criado_em, 
                    atualizado_em, 
                    id_colaborador_atualiza
                ) VALUES (?, ?, ?, '', '', '', ?, NOW(), NOW(), ?)`,
                [id_arquidiocese, nextId, nome_subdivisao, status || 'ativo', id_colaborador_atualiza || null]
            );
            savedId = nextId;
        }
        res.json({ success: true, id: savedId });
    } catch (err) {
        console.error('Erro ao salvar divisão arquidiocesana:', err);
        if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry')) {
            return res.status(400).json({ success: false, error: 'Já existe uma divisão cadastrada para esta Arquidiocese.' });
        }
        res.status(500).json({ success: false, error: err.message });
    }
};

app.post('/api/subdivisao_arquidiocesana/save', saveDivisao);
app.post('/api/subdivisoes_arquidiocesanas/save', saveDivisao);
app.post('/api/divisao_arquidiocesana/save', saveDivisao);

const deleteDivisao = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM divisao_arquidiocesana WHERE id_divisao_arquidiocesana = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Divisão não encontrada' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

app.delete('/api/subdivisao_arquidiocesana/:id', deleteDivisao);
app.delete('/api/subdivisoes_arquidiocesanas/:id', deleteDivisao);
app.delete('/api/divisao_arquidiocesana/:id', deleteDivisao);

// --- ROTAS PARA ESTRUTURA ORGANIZACIONAL ---

// POST: Save/Update area
app.post('/api/estrutura_organizacional/save', async (req, res) => {
    console.log('POST /api/estrutura_organizacional/save - Body keys:', Object.keys(req.body));
    const { id, nome_area, id_colaborador_lider, subordinado_id_area, status, id_colaborador_atualiza, nome_arquivo_atribuicoes, arquivo_atribuicoes_base64 } = req.body;

    try {
        // Validation
        if (!nome_area || nome_area.trim() === '') {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, preencha o Nome da Área.' });
        }
        if (!id_colaborador_lider) {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, selecione o Líder.' });
        }
        if (!status) {
            return res.status(400).json({ success: false, error: 'Crítica: Por favor, selecione o Status.' });
        }

        // Check duplicate name
        const [existingName] = await pool.query(
            'SELECT id_area FROM estrutura_organizacional WHERE nome_area = ? AND id_area != ?',
            [nome_area.trim(), id || 0]
        );
        if (existingName.length > 0) {
            return res.status(400).json({ success: false, error: `Crítica: Já existe uma área cadastrada com o nome "${nome_area}".` });
        }

        let savedId = id;
        const subId = subordinado_id_area ? parseInt(subordinado_id_area) : null;
        const lidId = parseInt(id_colaborador_lider);
        const colabUp = id_colaborador_atualiza ? parseInt(id_colaborador_atualiza) : null;

        if (id) {
            // Update
            let queryParams = [nome_area.trim(), lidId, subId, status, colabUp];
            let fileUpdateSql = "";
            
            if (arquivo_atribuicoes_base64) {
                const fileBuffer = Buffer.from(arquivo_atribuicoes_base64, 'base64');
                fileUpdateSql = ", nome_arquivo_atribuicoes = ?, arquivo_atribuicoes = ?";
                queryParams.push(nome_arquivo_atribuicoes, fileBuffer);
            } else if (nome_arquivo_atribuicoes === null || nome_arquivo_atribuicoes === '') {
                fileUpdateSql = ", nome_arquivo_atribuicoes = NULL, arquivo_atribuicoes = NULL";
            }
            
            queryParams.push(id);

            await pool.query(
                `UPDATE estrutura_organizacional 
                 SET nome_area = ?, id_colaborador_lider = ?, subordinado_id_area = ?, status = ?, id_colaborador_atualiza = ?, atualizado_em = NOW() ${fileUpdateSql}
                 WHERE id_area = ?`,
                queryParams
            );
        } else {
            // Insert
            const [maxRow] = await pool.query('SELECT COALESCE(MAX(id_area), 0) + 1 AS nextId FROM estrutura_organizacional');
            const nextId = maxRow[0].nextId;

            const fileBuffer = arquivo_atribuicoes_base64 ? Buffer.from(arquivo_atribuicoes_base64, 'base64') : null;
            const fileName = nome_arquivo_atribuicoes || null;

            await pool.query(
                `INSERT INTO estrutura_organizacional (
                    id_area, nome_area, id_colaborador_lider, subordinado_id_area, status, criado_em, atualizado_em, id_colaborador_atualiza, nome_arquivo_atribuicoes, arquivo_atribuicoes
                ) VALUES (?, ?, ?, ?, ?, NOW(), NULL, ?, ?, ?)`,
                [nextId, nome_area.trim(), lidId, subId, status, colabUp, fileName, fileBuffer]
            );
            savedId = nextId;
        }

        res.json({ success: true, id: savedId });
    } catch (err) {
        console.error('Erro ao salvar área de estrutura organizacional:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE: Delete area
app.delete('/api/estrutura_organizacional/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if there are other areas subordinated to this one
        const [subordinated] = await pool.query(
            'SELECT id_area FROM estrutura_organizacional WHERE subordinado_id_area = ?',
            [id]
        );
        if (subordinated.length > 0) {
            return res.status(400).json({ success: false, error: 'Crítica: Não é possível excluir esta área pois existem outras áreas subordinadas a ela.' });
        }

        const [result] = await pool.query('DELETE FROM estrutura_organizacional WHERE id_area = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Área não encontrada' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao excluir área de estrutura organizacional:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Specific route to delete Regional
app.delete('/api/regionais/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Delete links first
        await connection.query('DELETE FROM regional_estado WHERE id_regional = ?', [id]);
        // Delete regional
        await connection.query('DELETE FROM regional WHERE id_regional = ?', [id]);

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Rota de Login/Autenticação de Colaborador
app.post('/api/login', async (req, res) => {
    const { colaborador, senha } = req.body;
    console.log(`[API] POST /api/login - Colaborador: ${colaborador}`);

    if (!colaborador) {
        return res.status(400).json({ success: false, error: 'Colaborador não encontrado!' });
    }

    try {
        const cleanedColab = colaborador.trim();
        const digitsOnly = cleanedColab.replace(/\D/g, '');

        let query = `
            SELECT c.*, c.perfil AS nome_perfil, c.perfil AS id_perfil
            FROM colaboradores c
            WHERE c.email = ? OR c.telefone = ?
        `;
        let params = [cleanedColab, cleanedColab];

        if (digitsOnly.length > 0) {
            query += ` OR REPLACE(REPLACE(REPLACE(REPLACE(c.telefone, '(', ''), ')', ''), ' ', ''), '-', '') = ?`;
            params.push(digitsOnly);
        }

        const isNumeric = /^\d+$/.test(cleanedColab);
        if (isNumeric) {
            const parsedId = parseInt(cleanedColab, 10);
            query += ` OR c.id_colaborador = ?`;
            params.push(parsedId);
        }

        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Colaborador não encontrado!' });
        }

        const user = rows[0];

        if (!user.senha) {
            return res.status(401).json({ success: false, error: 'Senha inválida!' });
        }

        const passwordMatch = await bcrypt.compare(senha || '', user.senha);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, error: 'Senha inválida!' });
        }

        // Increment access count and update last access timestamp
        try {
            await pool.query(
                'UPDATE colaboradores SET qtd_acesso = COALESCE(qtd_acesso, 0) + 1, dt_ultimo_acesso = NOW() WHERE id_colaborador = ?',
                [user.id_colaborador]
            );
        } catch (dbErr) {
            console.error('[API ERROR] Failed to increment access count for collaborator:', dbErr);
        }

        let fotoDataUrl = null;
        if (user.foto_colaborador && user.foto_colaborador.length > 0) {
            let fotoBuffer = user.foto_colaborador;
            if (Buffer.isBuffer(fotoBuffer)) {
                const prefix = fotoBuffer.subarray(0, 11).toString('utf-8');
                if (prefix === 'data:image/') {
                    fotoDataUrl = fotoBuffer.toString('utf-8');
                } else {
                    const base64 = fotoBuffer.toString('base64');
                    const isPng = fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50;
                    const mime = isPng ? 'image/png' : 'image/jpeg';
                    fotoDataUrl = `data:${mime};base64,${base64}`;
                }
            } else if (typeof fotoBuffer === 'string') {
                if (fotoBuffer.startsWith('data:image/')) {
                    fotoDataUrl = fotoBuffer;
                } else {
                    fotoDataUrl = `data:image/jpeg;base64,${fotoBuffer}`;
                }
            }
        }

        res.json({
            success: true,
            colaborador: {
                id_colaborador: user.id_colaborador,
                nome_colaborador: user.nome_colaborador,
                apelido_colaborador: user.apelido_colaborador || user.nome_colaborador,
                email: user.email,
                telefone: user.telefone,
                foto_colaborador: fotoDataUrl,
                id_perfil: user.id_perfil,
                nome_perfil: user.nome_perfil
            }
        });
    } catch (err) {
        console.error('Erro na autenticação:', err);
        res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
    }
});

// Post example
app.post('/api/:table', async (req, res) => {
    const { table } = req.params;
    const data = req.body;

    try {
        const [result] = await pool.query(`INSERT INTO ?? SET ?`, [table, data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Training Routes ---

// Route to get a single training by ID with details of updating collaborator
app.get('/api/treinamentos/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] GET /api/treinamentos/${id}`);
    try {
        const query = `
            SELECT t.*, c.apelido_colaborador AS nome_atualizador
            FROM treinamentos t
            LEFT JOIN colaboradores c ON t.id_colaborador_atualiza = c.id_colaborador
            WHERE t.id_treinamento = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Treinamento não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[API ERROR] GET /api/treinamentos:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save/update training
app.post('/api/treinamentos/save', async (req, res) => {
    console.log('POST /api/treinamentos/save - Body:', req.body);
    const {
        id_treinamento,
        forma_treinamento,
        titulo,
        obs_treinamento,
        qualifica_para,
        local,
        status,
        id_colaborador_atualiza
    } = req.body;

    // Validation
    if (!titulo || titulo.trim() === "") {
        return res.status(400).json({ success: false, error: 'O Nome do treinamento é obrigatório.' });
    }
    if (!forma_treinamento || forma_treinamento.trim() === "") {
        return res.status(400).json({ success: false, error: 'A Forma de treinamento é obrigatória.' });
    }
    if (!qualifica_para || qualifica_para.trim() === "") {
        return res.status(400).json({ success: false, error: 'O campo Qualifica para é obrigatório.' });
    }
    if (forma_treinamento === 'Presencial' && (!local || local.trim() === "")) {
        return res.status(400).json({ success: false, error: 'O campo Local do treinamento é obrigatório para treinamentos presenciais.' });
    }

    try {
        if (id_treinamento) {
            // Update (Alteração)
            // criado_em must not change. atualizado_em gets current date/time.
            const query = `UPDATE treinamentos SET 
                forma_treinamento = ?, 
                titulo = ?, 
                obs_treinamento = ?, 
                qualifica_para = ?, 
                local = ?, 
                status = ?,
                id_colaborador_atualiza = ?, 
                atualizado_em = NOW() 
                WHERE id_treinamento = ?`;

            await pool.query(query, [
                forma_treinamento,
                titulo,
                obs_treinamento || '',
                qualifica_para,
                forma_treinamento === 'Presencial' ? local : null,
                status || 'agendado',
                id_colaborador_atualiza ? parseInt(id_colaborador_atualiza) : null,
                id_treinamento
            ]);
            res.json({ success: true, id: id_treinamento });
        } else {
            // Insert (Inclusão)
            // criado_em gets current date/time. atualizado_em must not be set (remains NULL).
            const query = `INSERT INTO treinamentos (
                forma_treinamento, 
                titulo, 
                obs_treinamento, 
                qualifica_para, 
                local, 
                status,
                id_colaborador_atualiza, 
                criado_em, 
                atualizado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NULL)`;

            const [result] = await pool.query(query, [
                forma_treinamento,
                titulo,
                obs_treinamento || '',
                qualifica_para,
                forma_treinamento === 'Presencial' ? local : null,
                status || 'agendado',
                id_colaborador_atualiza ? parseInt(id_colaborador_atualiza) : null
            ]);
            res.status(201).json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Erro ao salvar treinamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to save/insert training instructor agenda
// Route to save/insert training instructor agenda
app.post('/api/treinamento_instrutores/save', async (req, res) => {
    console.log('POST /api/treinamento_instrutores/save - Body:', req.body);
    const {
        id_agenda_treinamento,
        id_treinamento,
        data,
        hora_inicio,
        hora_fim,
        pauta,
        id_colaborador
    } = req.body;

    // Validation
    if (!id_treinamento) {
        return res.status(400).json({ success: false, error: 'O ID do treinamento é obrigatório.' });
    }

    try {
        // Check if the collaborator is already a participant
        const [participants] = await pool.query(
            'SELECT 1 FROM treinamento_participantes WHERE id_treinamento = ? AND id_colaborador = ?',
            [parseInt(id_treinamento), parseInt(id_colaborador)]
        );
        if (participants.length > 0) {
            const [colabNameRows] = await pool.query(
                'SELECT nome_colaborador FROM colaboradores WHERE id_colaborador = ?',
                [parseInt(id_colaborador)]
            );
            const colabName = colabNameRows.length > 0 ? colabNameRows[0].nome_colaborador : id_colaborador;
            return res.status(400).json({
                success: false,
                error: `O colaborador "${colabName}" já está cadastrado como PARTICIPANTE neste treinamento e não pode ser adicionado como INSTRUTOR.`
            });
        }
    } catch (err) {
        console.error('Erro ao validar conflito de participante/instrutor:', err);
        return res.status(500).json({ success: false, error: err.message });
    }

    if (!data || data.trim() === "") {
        return res.status(400).json({ success: false, error: 'A data do treinamento é obrigatória.' });
    }
    if (!hora_inicio || hora_inicio.trim() === "") {
        return res.status(400).json({ success: false, error: 'O horário de início é obrigatório.' });
    }
    if (!hora_fim || hora_fim.trim() === "") {
        return res.status(400).json({ success: false, error: 'O horário de fim é obrigatório.' });
    }
    if (!pauta || pauta.trim() === "") {
        return res.status(400).json({ success: false, error: 'A pauta é obrigatória.' });
    }
    if (!id_colaborador) {
        return res.status(400).json({ success: false, error: 'O instrutor é obrigatório.' });
    }

    // Convert DD/MM/YYYY to YYYY-MM-DD
    let formattedDate = null;
    if (data.includes('/')) {
        const parts = data.split('/');
        if (parts.length === 3) {
            formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    } else {
        formattedDate = data;
    }

    try {
        if (id_agenda_treinamento) {
            // Update
            const query = `
                UPDATE treinamento_instrutores SET
                    id_treinamento = ?,
                    data = ?,
                    hora_inicio = ?,
                    hora_fim = ?,
                    pauta = ?,
                    id_colaborador = ?
                WHERE id_agenda_treinamento = ?
            `;
            await pool.query(query, [
                parseInt(id_treinamento),
                formattedDate,
                hora_inicio,
                hora_fim,
                pauta.substring(0, 100),
                parseInt(id_colaborador),
                parseInt(id_agenda_treinamento)
            ]);
            res.json({ success: true, id: id_agenda_treinamento });
        } else {
            // Insert
            const [maxRows] = await pool.query('SELECT COALESCE(MAX(id_agenda_treinamento), 0) + 1 AS nextId FROM treinamento_instrutores');
            const nextId = maxRows[0].nextId;

            const query = `
                INSERT INTO treinamento_instrutores (
                    id_agenda_treinamento,
                    id_treinamento,
                    data,
                    hora_inicio,
                    hora_fim,
                    pauta,
                    id_colaborador
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            await pool.query(query, [
                nextId,
                parseInt(id_treinamento),
                formattedDate,
                hora_inicio,
                hora_fim,
                pauta.substring(0, 100),
                parseInt(id_colaborador)
            ]);

            res.json({ success: true, id: nextId });
        }
    } catch (err) {
        console.error('Erro ao salvar instrutor de treinamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to get a single training instructor agenda record
app.get('/api/treinamento_instrutores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM treinamento_instrutores WHERE id_agenda_treinamento = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Registro de agenda não encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao buscar registro de agenda:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get list of instructors/agenda for a training
app.get('/api/treinamentos/:id/instrutores', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT ti.*, c.nome_colaborador, c.foto_colaborador
            FROM treinamento_instrutores ti
            INNER JOIN colaboradores c ON ti.id_colaborador = c.id_colaborador
            WHERE ti.id_treinamento = ?
            ORDER BY ti.data ASC, ti.hora_inicio ASC
        `;
        const [rows] = await pool.query(query, [id]);

        // Convert photo Buffer/Base64 to standard data URL for frontend display
        for (const row of rows) {
            if (row.foto_colaborador && row.foto_colaborador.length > 0) {
                let fotoBuffer = row.foto_colaborador;
                if (Buffer.isBuffer(fotoBuffer)) {
                    const prefix = fotoBuffer.subarray(0, 11).toString('utf-8');
                    if (prefix === 'data:image/') {
                        row.foto_colaborador = fotoBuffer.toString('utf-8');
                    } else {
                        const base64 = fotoBuffer.toString('base64');
                        const isPng = fotoBuffer.length >= 2 && fotoBuffer[0] === 0x89 && fotoBuffer[1] === 0x50;
                        const mime = isPng ? 'image/png' : 'image/jpeg';
                        row.foto_colaborador = `data:${mime};base64,${base64}`;
                    }
                } else if (typeof fotoBuffer === 'string') {
                    if (!fotoBuffer.startsWith('data:image/')) {
                        row.foto_colaborador = `data:image/jpeg;base64,${fotoBuffer}`;
                    }
                }
            } else {
                row.foto_colaborador = null;
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar instrutores do treinamento:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to delete a training instructor agenda record
app.delete('/api/treinamento_instrutores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM treinamento_instrutores WHERE id_agenda_treinamento = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar instrutor de treinamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to get participants of a training
app.get('/api/treinamentos/:id/participantes', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT tp.id, tp.id_treinamento, tp.id_colaborador AS colaborador_id, tp.id_colaborador, tp.presenca, c.apelido_colaborador, c.cidade
            FROM treinamento_participantes tp
            INNER JOIN colaboradores c ON tp.id_colaborador = c.id_colaborador
            WHERE tp.id_treinamento = ?
            ORDER BY c.apelido_colaborador ASC
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar participantes do treinamento:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to update presence of a participant
app.post('/api/treinamento_participantes/:id/presenca', async (req, res) => {
    const { id } = req.params;
    const { presenca } = req.body;
    try {
        await pool.query('UPDATE treinamento_participantes SET presenca = ? WHERE id = ?', [presenca, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar presença:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to save participants of a training (append checked items)
app.post('/api/treinamentos/:id/participantes', async (req, res) => {
    const { id } = req.params;
    const { colaboradores } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'ID do treinamento é obrigatório.' });
    }
    if (!colaboradores || !Array.isArray(colaboradores)) {
        return res.status(400).json({ success: false, error: 'Lista de colaboradores é obrigatória.' });
    }

    try {
        // Get all instructors for this training
        const [instructors] = await pool.query(
            'SELECT DISTINCT id_colaborador FROM treinamento_instrutores WHERE id_treinamento = ?',
            [parseInt(id)]
        );
        const instructorIds = instructors.map(ti => ti.id_colaborador);

        // Check if any collaborator to be added is already an instructor
        for (const colabId of colaboradores) {
            if (instructorIds.includes(parseInt(colabId))) {
                const [colabNameRows] = await pool.query(
                    'SELECT nome_colaborador FROM colaboradores WHERE id_colaborador = ?',
                    [parseInt(colabId)]
                );
                const colabName = colabNameRows.length > 0 ? colabNameRows[0].nome_colaborador : colabId;
                return res.status(400).json({
                    success: false,
                    error: `O colaborador "${colabName}" já está cadastrado como INSTRUTOR neste treinamento e não pode ser adicionado como PARTICIPANTE.`
                });
            }
        }

        for (const colabId of colaboradores) {
            await pool.query(
                'INSERT IGNORE INTO treinamento_participantes (id_treinamento, id_colaborador) VALUES (?, ?)',
                [parseInt(id), parseInt(colabId)]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar participantes do treinamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a participant from a training
app.delete('/api/treinamento_participantes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM treinamento_participantes WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar participante do treinamento:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// Route to delete a training
app.delete('/api/treinamentos/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] DELETE /api/treinamentos/${id}`);
    try {
        // Validate if there are participants registered
        const [linkedParticipants] = await pool.query('SELECT id FROM treinamento_participantes WHERE id_treinamento = ? LIMIT 1', [id]);
        if (linkedParticipants.length > 0) {
            return res.status(400).json({ error: 'Não é possível excluir: existem colaboradores vinculados a este treinamento.' });
        }
        // First delete any registered sessions / instructors for this training
        await pool.query('DELETE FROM treinamento_instrutores WHERE id_treinamento = ?', [id]);

        // Then delete the training
        await pool.query('DELETE FROM treinamentos WHERE id_treinamento = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao excluir treinamento:', err);
        res.status(500).json({ error: err.message });
    }
});

// Specific route to save/update Colaborador
app.post('/api/colaboradores/save', async (req, res) => {
    const { foto_base64, ...logBody } = req.body;
    console.log('POST /api/colaboradores/save - Body:', { ...logBody, foto_base64: foto_base64 ? '[BASE64_IMAGE]' : null });
    const {
        id_colaborador,
        nome_colaborador,
        apelido_colaborador,
        sexo,
        email,
        telefone,
        id_perfil,
        data_nascimento,
        endereco,
        cidade,
        id_estado,
        senha,
        status,
        cep,
        talentos_colaborador,
        motivou_AE,
        obs_colaborador,
        id_colaborador_atualiza
    } = req.body;
    // Convert DD/MM/YYYY to YYYY-MM-DD and validate calendar values
    let formattedDate = null;
    if (data_nascimento) {
        let isValid = false;
        if (data_nascimento.includes('/')) {
            const parts = data_nascimento.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);

                if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
                    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
                    const daysInMonth = [31, (isLeap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    if (day >= 1 && day <= daysInMonth[month - 1]) {
                        formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        isValid = true;
                    }
                }
            }
        } else {
            // Check if it's already YYYY-MM-DD
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            if (regex.test(data_nascimento)) {
                formattedDate = data_nascimento;
                isValid = true;
            }
        }

        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Data de nascimento inválida.' });
        }
    }

    try {
        if (id_colaborador) {
            // Update
            let query = `UPDATE colaboradores SET 
                nome_colaborador = ?, 
                apelido_colaborador = ?, 
                sexo = ?, 
                email = ?, 
                telefone = ?, 
                perfil = ?, 
                data_nascimento = ?, 
                endereco = ?, 
                cidade = ?, 
                cep = ?,
                id_estado = ?, 
                status = ?,
                talentos_colaborador = ?,
                motivou_AE = ?,
                obs_colaborador = ?,
                id_colaborador_atualiza = ?`;

            const params = [
                nome_colaborador,
                apelido_colaborador,
                sexo,
                email,
                telefone,
                id_perfil,
                formattedDate,
                endereco,
                cidade,
                cep,
                id_estado,
                status || 'Ativo',
                talentos_colaborador || '',
                motivou_AE || '',
                obs_colaborador || '',
                parseInt(id_colaborador_atualiza) || 2
            ];

            // Add photo if provided
            if (foto_base64) {
                query += `, foto_colaborador = ?`;
                params.push(foto_base64);
            }

            if (senha && senha.trim() !== '') {
                // Hashing password with bcrypt
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(senha, salt);
                query += `, senha = ?`;
                params.push(hashedPassword);
            }

            query += ` WHERE id_colaborador = ?`;
            params.push(id_colaborador);

            await pool.query(query, params);
            res.json({ success: true, id: id_colaborador });
        } else {
            // Insert
            let hashedPassword = '';
            if (senha && senha.trim() !== '') {
                // Hashing password with bcrypt
                const salt = await bcrypt.genSalt(10);
                hashedPassword = await bcrypt.hash(senha, salt);
            }

            const [result] = await pool.query(
                `INSERT INTO colaboradores (
                    nome_colaborador, 
                    apelido_colaborador, 
                    sexo, 
                    email, 
                    telefone, 
                    perfil, 
                    data_nascimento, 
                    endereco, 
                    cidade, 
                    cep,
                    id_estado, 
                    senha, 
                    status,
                    talentos_colaborador,
                    motivou_AE,
                    obs_colaborador,
                    foto_colaborador,
                    id_colaborador_atualiza,
                    criado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    nome_colaborador,
                    apelido_colaborador,
                    sexo,
                    email,
                    telefone,
                    id_perfil,
                    formattedDate,
                    endereco,
                    cidade,
                    cep,
                    id_estado,
                    hashedPassword,
                    status || 'Ativo',
                    talentos_colaborador || '',
                    motivou_AE || '',
                    obs_colaborador || '',
                    foto_base64 || null,
                    parseInt(id_colaborador_atualiza) || 2
                ]
            );
            res.status(201).json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Erro ao salvar colaborador:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// --- Collaborator Leadership Routes ---

// Route to get leadership history for a specific collaborator
app.get('/api/colaboradores/:id/lideranca', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM colaborador_lideranca WHERE id_colaborador = ? ORDER BY data_inicio DESC', [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get enum values for tipo_lideranca
app.get('/api/colaborador_lideranca/tipos', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW COLUMNS FROM colaborador_lideranca LIKE 'tipo_lideranca'");
        if (rows.length > 0) {
            const type = rows[0].Type; // e.g. enum('Colaborador paroquial','Coordenador paroquial','Coordenador diocesano','Coordenador de missão')
            const match = type.match(/^enum\((.*)\)$/i);
            if (match) {
                const values = match[1].split(',').map(v => v.replace(/^'(.*)'$/, '$1'));
                return res.json(values);
            }
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao obter tipos de liderança de colaboradores:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to save/update collaborator leadership
app.post('/api/colaborador_lideranca/save', async (req, res) => {
    const {
        id_colaborador,
        id_movimentacao,
        tipo_lideranca,
        data_inicio,
        data_fim,
        status,
        observacao
    } = req.body;

    if (!id_colaborador || !tipo_lideranca || !data_inicio || !status) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
    }

    const formatDateToMySQL = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return null;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }
        }
        return dateStr;
    };

    const formattedInicio = formatDateToMySQL(data_inicio);
    const formattedFim = formatDateToMySQL(data_fim);

    try {
        if (id_movimentacao) {
            // Update
            const query = `
                UPDATE colaborador_lideranca SET
                    tipo_lideranca = ?,
                    data_inicio = ?,
                    data_fim = ?,
                    status = ?,
                    observacao = ?
                WHERE id_movimentacao = ? AND id_colaborador = ?
            `;
            await pool.query(query, [
                tipo_lideranca,
                formattedInicio,
                formattedFim,
                status,
                observacao || null,
                id_movimentacao,
                id_colaborador
            ]);
            res.json({ success: true, id: id_movimentacao });
        } else {
            // Insert - generate next ID
            const [maxRows] = await pool.query('SELECT COALESCE(MAX(id_movimentacao), 0) + 1 AS nextId FROM colaborador_lideranca');
            const nextId = maxRows[0].nextId;

            const query = `
                INSERT INTO colaborador_lideranca (
                    id_colaborador,
                    id_movimentacao,
                    tipo_lideranca,
                    data_inicio,
                    data_fim,
                    status,
                    observacao
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await pool.query(query, [
                id_colaborador,
                nextId,
                tipo_lideranca,
                formattedInicio,
                formattedFim,
                status,
                observacao || null
            ]);
            res.json({ success: true, id: nextId });
        }
    } catch (err) {
        console.error('Erro ao salvar liderança do colaborador:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to delete a collaborator leadership record
app.delete('/api/colaborador_lideranca/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM colaborador_lideranca WHERE id_movimentacao = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// --- User Satisfaction Survey (Pesquisa de Satisfação) Routes ---

// Route to save survey responses
// Route to save survey responses
app.post('/api/pesquisa_satisfacao/save', async (req, res) => {
    const {
        id_colaborador,
        funcao,
        frequencia_uso,
        nota_navegacao,
        nota_visual,
        nota_celular,
        satisfacao_colaboradores,
        satisfacao_projetos,
        satisfacao_treinamentos,
        satisfacao_aniversariantes,
        frequencia_erros,
        nps,
        observacao,
        recusado
    } = req.body;

    if (!id_colaborador) {
        return res.status(400).json({ success: false, error: 'Identificação do colaborador é obrigatória. Pesquisas anônimas não são permitidas.' });
    }

    // Handle opt-out (user does not wish to respond)
    if (recusado) {
        try {
            const query = `
                INSERT INTO pesquisas_satisfacao (id_colaborador, recusado) 
                VALUES (?, 1)
            `;
            const [result] = await pool.query(query, [parseInt(id_colaborador)]);
            return res.json({ success: true, id: result.insertId });
        } catch (err) {
            console.error('Erro ao salvar recusa da pesquisa de satisfação:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    if (!funcao || !frequencia_uso || !nota_navegacao || !nota_visual || !frequencia_erros || nps === undefined) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
    }

    try {
        const query = `
            INSERT INTO pesquisas_satisfacao (
                id_colaborador,
                funcao,
                frequencia_uso,
                nota_navegacao,
                nota_visual,
                nota_celular,
                satisfacao_colaboradores,
                satisfacao_projetos,
                satisfacao_treinamentos,
                satisfacao_aniversariantes,
                frequencia_erros,
                nps,
                observacao,
                recusado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;
        const [result] = await pool.query(query, [
            parseInt(id_colaborador),
            funcao,
            frequencia_uso,
            parseInt(nota_navegacao),
            parseInt(nota_visual),
            nota_celular ? parseInt(nota_celular) : null,
            satisfacao_colaboradores || null,
            satisfacao_projetos || null,
            satisfacao_treinamentos || null,
            satisfacao_aniversariantes || null,
            frequencia_erros,
            parseInt(nps),
            observacao || null
        ]);

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Erro ao salvar pesquisa de satisfação:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route to get survey stats (averages, NPS, feature ratings)
app.get('/api/pesquisa_satisfacao/stats', async (req, res) => {
    try {
        // 1. Total responses count (excluding opt-outs)
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM pesquisas_satisfacao WHERE recusado = 0');

        if (total === 0) {
            return res.json({
                total: 0,
                avgNavegacao: 0,
                avgVisual: 0,
                avgCelular: 0,
                npsScore: 0,
                promotersPerc: 0,
                passivesPerc: 0,
                detractorsPerc: 0,
                features: {}
            });
        }

        // 2. Average scores (excluding opt-outs)
        const [[averages]] = await pool.query(`
            SELECT 
                AVG(nota_navegacao) AS avgNavegacao,
                AVG(nota_visual) AS avgVisual,
                AVG(nota_celular) AS avgCelular
            FROM pesquisas_satisfacao
            WHERE recusado = 0
        `);

        // 3. NPS distribution (excluding opt-outs)
        const [[npsCounts]] = await pool.query(`
            SELECT 
                COUNT(CASE WHEN nps >= 9 THEN 1 END) AS promoters,
                COUNT(CASE WHEN nps >= 7 AND nps <= 8 THEN 1 END) AS passives,
                COUNT(CASE WHEN nps <= 6 THEN 1 END) AS detractors
            FROM pesquisas_satisfacao
            WHERE recusado = 0
        `);

        const promotersPerc = Math.round((npsCounts.promoters / total) * 100);
        const passivesPerc = Math.round((npsCounts.passives / total) * 100);
        const detractorsPerc = Math.round((npsCounts.detractors / total) * 100);
        const npsScore = promotersPerc - detractorsPerc;

        // 4. Feature satisfaction stats (excluding opt-outs)
        const getFeatureStats = async (column) => {
            const [rows] = await pool.query(`
                SELECT ${column} AS rating, COUNT(*) AS count 
                FROM pesquisas_satisfacao 
                WHERE ${column} IS NOT NULL AND recusado = 0
                GROUP BY ${column}
            `);
            const stats = {};
            rows.forEach(r => stats[r.rating] = r.count);
            return stats;
        };

        const features = {
            colaboradores: await getFeatureStats('satisfacao_colaboradores'),
            projetos: await getFeatureStats('satisfacao_projetos'),
            treinamentos: await getFeatureStats('satisfacao_treinamentos'),
            aniversariantes: await getFeatureStats('satisfacao_aniversariantes')
        };

        res.json({
            total,
            avgNavegacao: parseFloat(averages.avgNavegacao || 0).toFixed(1),
            avgVisual: parseFloat(averages.avgVisual || 0).toFixed(1),
            avgCelular: parseFloat(averages.avgCelular || 0).toFixed(1),
            npsScore,
            promotersPerc,
            passivesPerc,
            detractorsPerc,
            features
        });
    } catch (err) {
        console.error('Erro ao calcular estatísticas da pesquisa:', err);
        res.status(500).json({ error: err.message });
    }
});

// Route to get list of responses and comments (excluding opt-outs)
app.get('/api/pesquisa_satisfacao/list', async (req, res) => {
    try {
        const query = `
            SELECT p.*, c.nome_colaborador 
            FROM pesquisas_satisfacao p
            LEFT JOIN colaboradores c ON p.id_colaborador = c.id_colaborador
            WHERE p.recusado = 0
            ORDER BY p.criado_em DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar lista de pesquisas:', err);
        res.status(500).json({ error: err.message });
    }
});// Route to check if a collaborator has already responded
app.get('/api/pesquisa_satisfacao/status/:id_colaborador', async (req, res) => {
    const { id_colaborador } = req.params;
    if (!id_colaborador) {
        return res.status(400).json({ success: false, error: 'ID do colaborador ausente.' });
    }
    
    if (id_colaborador === 'null' || id_colaborador === 'undefined' || id_colaborador === '') {
        return res.json({ success: true, responded: false });
    }

    try {
        const [rows] = await pool.query(
            'SELECT COUNT(*) AS count FROM pesquisas_satisfacao WHERE id_colaborador = ?',
            [parseInt(id_colaborador)]
        );
        const responded = rows[0].count > 0;
        res.json({ success: true, responded });
    } catch (err) {
        console.error('Erro ao verificar status da pesquisa:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// Start server
app.listen(port, async () => {
    await connectDB();
    console.log(`Servidor rodando em http://localhost:${port}`);
});
