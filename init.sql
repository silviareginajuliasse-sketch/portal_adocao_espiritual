-- ============================================
-- Banco de Dados: Adoção Espiritual
-- Script de inicialização
-- ============================================

USE adocao_espiritual;

-- Tabela de Regionais
CREATE TABLE IF NOT EXISTS regionais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    estados TEXT,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Arquidioceses
CREATE TABLE IF NOT EXISTS arquidioceses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    regional_id INT,
    estado VARCHAR(2),
    cidade VARCHAR(255),
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (regional_id) REFERENCES regionais(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Paróquias
CREATE TABLE IF NOT EXISTS paroquias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    arquidiocese_id INT,
    endereco TEXT,
    cidade VARCHAR(255),
    estado VARCHAR(2),
    cep VARCHAR(10),
    telefone VARCHAR(20),
    email VARCHAR(255),
    padre_responsavel VARCHAR(255),
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (arquidiocese_id) REFERENCES arquidioceses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Colaboradores
CREATE TABLE IF NOT EXISTS colaboradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    celular VARCHAR(20),
    cargo VARCHAR(255),
    paroquia_id INT,
    foto LONGBLOB,
    foto_nome VARCHAR(255),
    data_nascimento DATE,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paroquia_id) REFERENCES paroquias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Treinamentos
CREATE TABLE IF NOT EXISTS treinamentos (
    id_treinamento INT AUTO_INCREMENT PRIMARY KEY,
    forma_treinamento ENUM('Presencial', 'On-line') DEFAULT NULL,
    titulo VARCHAR(255) NOT NULL,
    obs_treinamento VARCHAR(150) NOT NULL,
    qualifica_para ENUM('Colaborador Adoção Espiritual', 'Coordenador Paroquial', 'Coordenador Regional') NOT NULL,
    local VARCHAR(255) DEFAULT NULL,
    status ENUM('agendado', 'em_andamento', 'concluido', 'cancelado') DEFAULT 'agendado',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    id_colaborador_atualiza INT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Instrutores de Treinamentos (Agenda)
CREATE TABLE IF NOT EXISTS treinamento_instrutores (
    id_agenda_treinamento INT PRIMARY KEY,
    id_treinamento INT NOT NULL,
    data DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    pauta VARCHAR(100) NOT NULL,
    id_colaborador INT NOT NULL,
    FOREIGN KEY (id_treinamento) REFERENCES treinamentos(id_treinamento) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Participantes de Treinamentos
CREATE TABLE IF NOT EXISTS treinamento_participantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_treinamento INT NOT NULL,
    id_colaborador INT NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    presenca ENUM('Concluído', 'Não concluído', 'Não participou') DEFAULT NULL,
    UNIQUE KEY unique_participante (id_treinamento, id_colaborador),
    FOREIGN KEY (id_treinamento) REFERENCES treinamentos(id_treinamento) ON DELETE CASCADE,
    FOREIGN KEY (id_colaborador) REFERENCES colaboradores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Atividades Realizadas
CREATE TABLE IF NOT EXISTS atividades_realizadas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_atividade DATE,
    paroquia_id INT,
    responsavel_id INT,
    tipo VARCHAR(100),
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paroquia_id) REFERENCES paroquias(id) ON DELETE SET NULL,
    FOREIGN KEY (responsavel_id) REFERENCES colaboradores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Aniversariantes (Banner)
CREATE TABLE IF NOT EXISTS aniversariantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    colaborador_id INT NOT NULL,
    mensagem TEXT,
    exibir_banner BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Usuários do Sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('admin', 'coordenador', 'colaborador') DEFAULT 'colaborador',
    colaborador_id INT,
    ultimo_acesso TIMESTAMP NULL,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Histórico de Liderança de Colaboradores
CREATE TABLE IF NOT EXISTS colaborador_lideranca (
    id_colaborador INT NOT NULL,
    id_movimentacao INT NOT NULL,
    tipo_lideranca ENUM('Colaborador paroquial', 'Coordenador paroquial', 'Coordenador diocesano', 'Coordenador de missão') NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE DEFAULT NULL,
    status ENUM('Ativo', 'Inativo') NOT NULL DEFAULT 'Ativo',
    observacao VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id_colaborador, id_movimentacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pesquisas_satisfacao (
    id_pesquisa INT AUTO_INCREMENT PRIMARY KEY,
    id_colaborador INT NULL,
    funcao VARCHAR(100) NULL,
    frequencia_uso VARCHAR(100) NULL,
    nota_navegacao INT NULL,
    nota_visual INT NULL,
    nota_celular INT NULL,
    satisfacao_colaboradores VARCHAR(50) DEFAULT NULL,
    satisfacao_projetos VARCHAR(50) DEFAULT NULL,
    satisfacao_treinamentos VARCHAR(50) DEFAULT NULL,
    satisfacao_aniversariantes VARCHAR(50) DEFAULT NULL,
    frequencia_erros VARCHAR(100) NULL,
    nps INT NULL,
    observacao VARCHAR(500) DEFAULT NULL,
    recusado TINYINT(1) DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_colaborador) REFERENCES colaboradores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Dados iniciais (seed)
-- ============================================

-- Inserir usuário administrador padrão
INSERT INTO usuarios (nome, email, senha, perfil) VALUES
('Administrador', 'admin@adocaoespiritual.org.br', SHA2('admin123', 256), 'admin');

SELECT 'Banco de dados adocao_espiritual criado com sucesso!' AS mensagem;
