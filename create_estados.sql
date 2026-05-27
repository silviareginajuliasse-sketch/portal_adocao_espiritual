USE adocao_espiritual;

CREATE TABLE IF NOT EXISTS estados (
    id_pais INT NOT NULL,
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nome_estado VARCHAR(255) NOT NULL,
    sigla_estado VARCHAR(2) NOT NULL,
    FOREIGN KEY (id_pais) REFERENCES pais(id_pais)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

SELECT * FROM estados;
