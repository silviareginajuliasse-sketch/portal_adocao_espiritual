---
name: gerenciar-banco-docker
description: >-
  Use this skill whenever the user asks about the database status, wants to verify the MySQL database, or needs to start/ensure Docker containers (MySQL, phpMyAdmin, API) are running for the Projeto Adoção Espiritual.
---

# Gerenciamento do Banco de Dados e Containers Docker

Esta skill orienta e automatiza o processo de verificação, identificação e inicialização do banco de dados MySQL e serviços auxiliares (phpMyAdmin e backend API) gerenciados pelo Docker Compose no projeto **Adoção Espiritual**.

## 1. Identificação do Banco de Dados

* **SGBD:** MySQL 8.0
* **Container:** `adocao_espiritual_mysql`
* **Host:** `localhost` / `127.0.0.1`
* **Porta:** `3306`
* **Database (Schema):** `adocao_espiritual`
* **Usuário da Aplicação:** `adocao_user` | **Senha:** `adocao@2026`
* **Usuário Root:** `root` | **Senha:** `root@2026`
* **Interface Web phpMyAdmin:** [http://localhost:8080](http://localhost:8080)
* **Arquivo Compose:** [docker-compose.yml](../../../docker-compose.yml)
* **Scripts SQL de Criação:** [init.sql](../../../init.sql) e [create_tabelas.sql](../../../create_tabelas.sql)

---

## 2. Procedimento de Verificação e Inicialização

### Passo 1: Executar o script automatizado
Execute o script auxiliar via terminal PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/gerenciar-banco-docker/scripts/check_and_start.ps1
```

### Passo 2: Procedimento Manual (Alternativo)
Caso prefira executar manualmente:

1. **Checar se o container do banco está ativo:**
   ```powershell
   docker ps --filter "name=adocao_espiritual_mysql"
   ```

2. **Se o container não estiver listado (ou estiver parado):**
   Suba o ambiente em segundo plano a partir da raiz do projeto:
   ```powershell
   docker compose up -d
   ```

3. **Verificar a integridade dos logs:**
   ```powershell
   docker logs adocao_espiritual_mysql --tail 20
   ```

4. **Testar conectividade com a porta do MySQL:**
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 3306
   ```
