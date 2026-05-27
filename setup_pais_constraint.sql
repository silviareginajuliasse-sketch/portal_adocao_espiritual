-- ============================================
-- Script para criar tabela PAIS e vincular com ESTADOS
-- ============================================

USE adocao_espiritual;

-- 1. Criar tabela PAIS
CREATE TABLE IF NOT EXISTS pais (
    id_pais INT AUTO_INCREMENT PRIMARY KEY,
    nome_pais VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Inserir dados iniciais se estiver vazia
INSERT IGNORE INTO pais (id_pais, nome_pais) VALUES (1, 'BRASIL');
INSERT IGNORE INTO pais (id_pais, nome_pais) VALUES (2, 'PORTUGAL');

-- 3. Garantir que a coluna id_pais existe na tabela estados
-- Se não existir, você deve criá-la:
-- ALTER TABLE estados ADD COLUMN id_pais INT NOT NULL DEFAULT 1;

-- 4. Criar a CONSTRAINT de chave estrangeira
-- Primeiro removemos se já existir para evitar erro de duplicidade
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE estados DROP FOREIGN KEY IF EXISTS fk_estados_pais;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE estados 
ADD CONSTRAINT fk_estados_pais 
FOREIGN KEY (id_pais) REFERENCES pais(id_pais)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Verificação
SELECT 'Tabela PAIS e Constraint criadas com sucesso!' AS info;
SHOW CREATE TABLE estados;
