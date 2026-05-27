SET NAMES utf8mb4;
USE adocao_espiritual;

DELETE FROM regional_estado; -- Temporariamente remover relações para evitar erro de FK ao deletar estados
DELETE FROM estados;

INSERT INTO estados (id_pais, id_estado, nome_estado, sigla_estado) VALUES
(1, 1, 'ACRE', 'AC'),
(1, 2, 'ALAGOAS', 'AL'),
(1, 3, 'AMAPÁ', 'AP'),
(1, 4, 'AMAZONAS', 'AM'),
(1, 5, 'BAHIA', 'BA'),
(1, 6, 'CEARÁ', 'CE'),
(1, 7, 'DISTRITO FEDERAL', 'DF'),
(1, 8, 'ESPÍRITO SANTO', 'ES'),
(1, 9, 'GOIÁS', 'GO'),
(1, 10, 'MARANHÃO', 'MA'),
(1, 11, 'MATO GROSSO', 'MT'),
(1, 12, 'MATO GROSSO DO SUL', 'MS'),
(1, 13, 'MINAS GERAIS', 'MG'),
(1, 14, 'PARÁ', 'PA'),
(1, 15, 'PARAÍBA', 'PB'),
(1, 16, 'PARANÁ', 'PR'),
(1, 17, 'PERNAMBUCO', 'PE'),
(1, 18, 'PIAUÍ', 'PI'),
(1, 19, 'RIO DE JANEIRO', 'RJ'),
(1, 20, 'RIO GRANDE DO NORTE', 'RN'),
(1, 21, 'RIO GRANDE DO SUL', 'RS'),
(1, 22, 'RONDÔNIA', 'RO'),
(1, 23, 'RORAIMA', 'RR'),
(1, 24, 'SANTA CATARINA', 'SC'),
(1, 25, 'SÃO PAULO', 'SP'),
(1, 26, 'SERGIPE', 'SE'),
(1, 27, 'TOCANTINS', 'TO');

-- Restaurar relações (Baseado no mock anterior que vimos no DB)
INSERT INTO regional_estado (id_regional, id_estado) VALUES
(1, 4), (1, 23),
(2, 3), (2, 14),
(3, 11), (3, 14), (3, 27),
(4, 6),
(5, 2), (5, 15), (5, 17), (5, 20),
(6, 5), (6, 26);
