USE adocao_espiritual;

-- Drop table if exists
DROP TABLE IF EXISTS projetos;
DROP TABLE IF EXISTS Projetos;

-- Create projects table
CREATE TABLE IF NOT EXISTS projetos (
    id_projeto INT AUTO_INCREMENT PRIMARY KEY,
    nome_projeto VARCHAR(255) NOT NULL,
    id_area INT NOT NULL,
    data_inicio DATE NULL,
    data_fim DATE NULL,
    status VARCHAR(50) DEFAULT 'INICIADO',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    id_colaborador_atualiza INT NULL,
    FOREIGN KEY (id_area) REFERENCES estrutura_organizacional(id_area) ON DELETE CASCADE,
    FOREIGN KEY (id_colaborador_atualiza) REFERENCES colaboradores(id_colaborador) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Create projects team table
CREATE TABLE IF NOT EXISTS projetos_equipes (
    id_projeto INT NOT NULL,
    id_colaborador INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create projects tasks activities table
CREATE TABLE IF NOT EXISTS projetos_tarefas_atividades (
    id_projeto INT NOT NULL,
    id_tarefa INT NOT NULL,
    id_atividade INT NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    status ENUM('Não iniciado', 'Em andamento', 'Cancelado', 'Encerrado') NOT NULL,
    perc_atingido INT DEFAULT NULL,
    PRIMARY KEY (id_atividade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create projects meetings table
CREATE TABLE IF NOT EXISTS projetos_reunioes (
    id_projeto INT NOT NULL,
    id_reuniao INT NOT NULL,
    data DATE NOT NULL,
    descricao_resolvido VARCHAR(500) NOT NULL,
    participantes VARCHAR(100) NOT NULL,
    FOREIGN KEY (id_projeto) REFERENCES projetos(id_projeto) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
