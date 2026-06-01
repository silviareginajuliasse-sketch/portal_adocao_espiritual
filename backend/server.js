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
    try {
        pool = mysql.createPool(dbConfig);
        console.log('Conectado ao MySQL!');
    } catch (err) {
        console.error('Erro ao conectar ao MySQL:', err);
        process.exit(1);
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
    try {
        const query = `
             SELECT c.id_colaborador, c.nome_colaborador, c.cidade, c.telefone, c.email,
                    c.foto_colaborador, e.nome_estado, e.sigla_estado, p.nome_pais, c.perfil AS nome_perfil,
                    c.atualizado_em, c.criado_em, c.status, c.perfil AS id_perfil, pa.nome_paroquia
             FROM colaboradores c
             LEFT JOIN estados e ON c.id_estado = e.id_estado
             LEFT JOIN pais p ON e.id_pais = p.id_pais
             LEFT JOIN paroquias pa ON c.id_paroquia = pa.id_paroquia
             ORDER BY c.nome_colaborador ASC
        `;
        const [rows] = await pool.query(query);

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
                   eo.criado_em, eo.atualizado_em, eo.id_colaborador_atualiza
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
                   col_up.apelido_colaborador AS nome_colaborador_atualiza
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

// Generic GET all for a table
app.get('/api/:table', async (req, res) => {
    const { table } = req.params;
    const allowedTables = ['regional', 'arquidiocese', 'paroquia', 'funcao', 'situacao', 'estados', 'pais', 'colaboradores', 'tipos_redes_sociais', 'subdivisao_arquidiocesana', 'subdivisoes_arquidiocesanas', 'divisao_arquidiocesana', 'divisoes_arquidiocesanas', 'divisao_arquidiocesana_lideranca', 'paroquia_lideranca', 'paroquia_coordenadores', 'treinamento_instrutores'];

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
    const { id_arquidiocese, nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza, socialMedia } = req.body;

    try {
        let savedId = id_arquidiocese;
        if (id_arquidiocese) {
            // Update
            await pool.query(
                'UPDATE arquidioceses SET nome_arquidiocese = ?, id_pais = ?, id_estado = ?, id_regional = ?, cidade = ?, arcebispo = ?, status = ?, id_colaborador_atualiza = ?, atualizado_em = NOW() WHERE id_arquidiocese = ?',
                [nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza || null, id_arquidiocese]
            );
        } else {
            // Insert
            const [result] = await pool.query(
                'INSERT INTO arquidioceses (nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [nome_arquidiocese, id_pais, id_estado, id_regional, cidade, arcebispo, status, id_colaborador_atualiza || null]
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

// Specific route to save/update Paroquia
app.post('/api/paroquias/save', async (req, res) => {
    console.log('POST /api/paroquias/save - Body:', req.body);
    const { id_paroquia, nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana, endereco, cidade, id_estado, status, tipo, latitude, longitude, site, observacoes, socialMedia, id_colaborador_atualiza } = req.body;

    try {
        let savedId = id_paroquia;
        const colabId = id_colaborador_atualiza ? parseInt(id_colaborador_atualiza) : null;

        if (id_paroquia) {
            // Update
            await pool.query(
                'UPDATE paroquias SET nome_paroquia = ?, id_arquidiocese = ?, id_divisao_arquidiocesana = ?, endereco = ?, cidade = ?, id_estado = ?, status = ?, tipo = ?, latitude = ?, longitude = ?, site = ?, observacoes = ?, atualizado_em = NOW(), id_colaborador_atualiza = ? WHERE id_paroquia = ?',
                [nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana || null, endereco, cidade, id_estado, status, tipo, latitude, longitude, site || '', observacoes || null, colabId, id_paroquia]
            );
        } else {
            // Insert
            const [result] = await pool.query(
                'INSERT INTO paroquias (nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana, endereco, cidade, id_estado, status, tipo, latitude, longitude, site, observacoes, criado_em, atualizado_em, id_colaborador_atualiza) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, ?)',
                [nome_paroquia, id_arquidiocese, id_divisao_arquidiocesana || null, endereco, cidade, id_estado, status, tipo, latitude, longitude, site || '', observacoes || null, colabId]
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

// Specific route to get Paroquias with details (Country, Regional, State and Arquidiocese names)
app.get('/api/paroquias/detalhes', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id_paroquia,
                p.nome_paroquia,
                p.cidade,
                p.endereco,
                p.status,
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
    console.log('POST /api/estrutura_organizacional/save - Body:', req.body);
    const { id, nome_area, id_colaborador_lider, subordinado_id_area, status, id_colaborador_atualiza } = req.body;

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
            await pool.query(
                `UPDATE estrutura_organizacional 
                 SET nome_area = ?, id_colaborador_lider = ?, subordinado_id_area = ?, status = ?, id_colaborador_atualiza = ?, atualizado_em = NOW()
                 WHERE id_area = ?`,
                [nome_area.trim(), lidId, subId, status, colabUp, id]
            );
        } else {
            // Insert
            const [maxRow] = await pool.query('SELECT COALESCE(MAX(id_area), 0) + 1 AS nextId FROM estrutura_organizacional');
            const nextId = maxRow[0].nextId;

            await pool.query(
                `INSERT INTO estrutura_organizacional (
                    id_area, nome_area, id_colaborador_lider, subordinado_id_area, status, criado_em, atualizado_em, id_colaborador_atualiza
                ) VALUES (?, ?, ?, ?, ?, NOW(), NULL, ?)`,
                [nextId, nome_area.trim(), lidId, subId, status, colabUp]
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
        const [linked] = await pool.query('SELECT id FROM treinamento_participantes WHERE id_treinamento = ? OR id_treinamento IS NULL AND 1=0 LIMIT 1'); // Let's check column name
        // Wait, the table definition in init.sql:
        // CONSTRAINT `treinamento_participantes_ibfk_1` FOREIGN KEY (`treinamento_id`) REFERENCES `treinamentos` (`id_treinamento`)
        // So the column name is 'id_treinamento'. Let's write the query correctly:
        const [linkedParticipants] = await pool.query('SELECT id FROM treinamento_participantes WHERE id_treinamento = ? LIMIT 1', [id]);
        if (linkedParticipants.length > 0) {
            return res.status(400).json({ error: 'Não é possível excluir: existem colaboradores vinculados a este treinamento.' });
        }
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

// Start server
app.listen(port, async () => {
    await connectDB();
    console.log(`Servidor rodando em http://localhost:${port}`);
});
