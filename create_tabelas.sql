USE adocao_espiritual;

-- ============================================
-- Tabela PAIS
-- ============================================
CREATE TABLE IF NOT EXISTS pais (
    id_pais INT AUTO_INCREMENT PRIMARY KEY,
    nome_pais VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pais (id_pais, nome_pais) VALUES (1, 'BRASIL'), (2, 'PORTUGAL');

-- ============================================
-- Tabela REGIONAL
-- ============================================
CREATE TABLE IF NOT EXISTS regional (
    id_regional INT AUTO_INCREMENT PRIMARY KEY,
    nome_regional VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela REGIONAL_ESTADO (relacionamento Regional x Estado)
-- ============================================
CREATE TABLE IF NOT EXISTS regional_estado (
    id_regional INT NOT NULL,
    id_estado INT NOT NULL,
    PRIMARY KEY (id_regional, id_estado),
    FOREIGN KEY (id_regional) REFERENCES regional(id_regional),
    FOREIGN KEY (id_estado) REFERENCES estados(id_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela SITUACAO
-- ============================================
CREATE TABLE IF NOT EXISTS situacao (
    id_situacao INT AUTO_INCREMENT PRIMARY KEY,
    nome_situacao VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO situacao (id_situacao, nome_situacao) VALUES
(1, 'ATIVO'),
(2, 'INATIVO');

-- ============================================
-- Tabela ARQUIDIOCESE
-- ============================================
CREATE TABLE IF NOT EXISTS arquidiocese (
    id_arquidiocese INT AUTO_INCREMENT PRIMARY KEY,
    nome_arquidiocese VARCHAR(255) NOT NULL,
    id_estado INT,
    id_situacao INT DEFAULT 1,
    FOREIGN KEY (id_estado) REFERENCES estados(id_estado),
    FOREIGN KEY (id_situacao) REFERENCES situacao(id_situacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela PAROQUIA
-- ============================================
CREATE TABLE IF NOT EXISTS paroquia (
    id_paroquia INT AUTO_INCREMENT PRIMARY KEY,
    nome_paroquia VARCHAR(255) NOT NULL,
    id_arquidiocese INT,
    endereco VARCHAR(500),
    cidade VARCHAR(255),
    id_estado INT,
    cep VARCHAR(10),
    telefone VARCHAR(20),
    id_situacao INT DEFAULT 1,
    FOREIGN KEY (id_arquidiocese) REFERENCES arquidiocese(id_arquidiocese),
    FOREIGN KEY (id_estado) REFERENCES estados(id_estado),
    FOREIGN KEY (id_situacao) REFERENCES situacao(id_situacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela FUNCAO (FU...)
-- ============================================
CREATE TABLE IF NOT EXISTS funcao (
    id_funcao INT AUTO_INCREMENT PRIMARY KEY,
    nome_funcao VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Verificação final
-- ============================================
SELECT 'TABELAS CRIADAS:' AS info;
SHOW TABLES;
