# Resumo das Atividades e Evoluções Realizadas no Projeto Adoção Espiritual

Este documento consolida o histórico de entregas, melhorias, correções recentes e a infraestrutura implementada no projeto.

---

## 1. Infraestrutura e Automação do Banco de Dados

* **Mapeamento e Identificação do Ambiente:**
  * Banco de Dados: **MySQL 8.0** executando via **Docker Compose**.
  * Serviço de Gerenciamento: **phpMyAdmin** na porta `8080` (`http://localhost:8080`).
  * Backend API: Node.js na porta `3000`.
  * Banco / Schema: `adocao_espiritual`.
  * Credenciais mapeadas no arquivo [docker-compose.yml](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/docker-compose.yml).
* **Criação da Skill de Gestão do Docker:**
  * Criação da skill personalizada em [.agents/skills/gerenciar-banco-docker/SKILL.md](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/.agents/skills/gerenciar-banco-docker/SKILL.md).
  * Criação do script PowerShell em [.agents/skills/gerenciar-banco-docker/scripts/check_and_start.ps1](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/.agents/skills/gerenciar-banco-docker/scripts/check_and_start.ps1) para verificar se o Docker e o container `adocao_espiritual_mysql` estão em execução e, caso contrário, inicializá-los automaticamente com `docker compose up -d`.

---

## 2. Calendário e Exportação (PDF / Excel)

* **Refinamento da Exportação em PDF:**
  * Ajuste do cabeçalho oficial da exportação com suporte a logotipos e layout de cronograma.
  * Formatação adequada da recorrência de atividades no relatório e remoção de títulos generalistas.
  * Inclusão de ícones de formato e conversão automática de estado para sigla (UF) no endereço.
  * Correção de cálculo de fuso horário/timezone na geração das datas e expansão de atividades recorrentes.
  * Remoção da linha de contatos no rodapé da exportação em PDF.
  * Correção do erro `ReferenceError: scopeBadgeText` e do posicionamento/abertura da janela de impressão/PDF.
* **Refinamento da Exportação em Excel:**
  * Alinhamento das colunas da planilha exportada com os coordenadores e dados das atividades.
  * Remoção de colunas desnecessárias (como número de WhatsApp onde não aplicável).
* **Modais e Filtros de Exportação:**
  * Criação e ajuste da opção de **"Listar atividades"** no modal com filtros dinâmicos para atividades Nacionais e por Arquidioceses.
  * Validação de preenchimento obrigatório nos campos com asterisco (`*`) ao disparar a exportação.
  * Flexibilização do campo "Paróquia" (remoção da obrigatoriedade estrita quando o escopo for mais amplo).

---

## 3. Gestão de Atividades, Coordenações e Pesquisa

* **Aba Coordenações e Filtros de Busca:**
  * Implementação de busca insensível a acentos e caracteres especiais para melhor experiência do usuário.
  * Habilitação da edição de datas de atividades e suporte a recorrências.
* **Ajustes de Esquema e Backend:**
  * Sincronização de campos ENUM dinâmicos no [backend/server.js](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/backend/server.js).
  * Novas rotas e ajustes de queries para calendário, aniversariantes e estrutura organizacional.

---

## 4. Header, Navegação e Aniversariantes (Modificações em Andamento)

* **Header Unificado ([assets/js/header.js](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/assets/js/header.js)):**
  * Atualização e sincronização da navegação, perfil de usuário logado e menu responsivo.
* **Banner de Aniversariantes e Formulários:**
  * Ajustes nas páginas [Banner_aniversario.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/Banner_aniversario.html) e [registro_banner_aniversariantes.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_banner_aniversariantes.html).
  * Atualizações nas telas de visualização e registros do calendário ([calendario.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/calendario.html) e [registro_calendario.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_calendario.html)).
  * Pequenos ajustes de identificação em [identificacao.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/identificacao.html).

---

## 5. Controle de Acesso e Gestão Hierárquica (Regionais, Arquidioceses e Divisões)

* **Controle de Permissões por Perfil (`user_id_perfil`):**
  * **Regionais ([lista_regionais.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/lista_regionais.html) e [registro_regional.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_regional.html)):** Ocultação de botões de inclusão, exclusão e edição para usuários não Administradores (`user_id_perfil !== '1'`).
  * **Arquidioceses ([arquidioceses.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/arquidioceses.html) e [registro_arquidiocese.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_arquidiocese.html)):**
    * Filtragem por regional para perfil 3 (`Coordenador Regional`).
    * Filtragem por arquidiocese e inibição do botão de inclusão para perfil 4 (`Coordenador Arquidiocesano`).
    * No cadastro de arquidiocese (`mode === 'new'`), filtragem das opções de regionais de acordo com a coordenação do usuário logado.
    * Limpeza de menções obsoletas de "Coordenador Nacional" nos textos de Ajuda.
  * **Divisão Arquidiocesana ([lista_divisao_arquidiocesana.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/lista_divisao_arquidiocesana.html) e [registro_divisao_arquidiocesana.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_divisao_arquidiocesana.html)):**
    * Filtragem na listagem por regional (perfil 3) e arquidiocese (perfil 4).
    * Restrição em cascata nos campos **Estado**, **Regional** e **Arquidiocese** no cadastro de divisão de acordo com as permissões dos perfis 3 e 4.
    * Inclusão do **Estado** na linha de exibição da lista (`${subdivisao} - ${arquidiocese} - ${regional} - ${estado} - ${status}`), busca e exportação Excel.
    * Remoção da barra de orientações lateral fixa e integração completa do modal popup de **Ajuda** (`? Ajuda`).
    * Backend: atualização da rota `/api/subdivisao_arquidiocesana/detalhes` para incluir `id_regional`.
* **Padronização Visual dos Modais de Ajuda:**
  * Ampliação da largura dos cards `.help-card` para `max-width: 720px; max-height: 85vh; overflow-y: auto;` em todo o projeto.

---

## 6. Resumo dos Arquivos Modificados / Criados

| Arquivo | Descrição |
| :--- | :--- |
| `DOCUMENTACAO_SISTEMA_E_REGRAS.md` | Documentação geral completa, detalhamento de perfis e regras de negócio. |
| `HISTORICO_ATIVIDADES.md` | Documento consolidado com as atividades e histórico de entregas. |
| `.agents/skills/gerenciar-banco-docker/` | Skill criada para monitorar e inicializar os containers Docker. |
| `backend/server.js` | Rotas de API, suporte a datas, esquemas e retorno de campos relacionais. |
| `assets/js/header.js` | Cabeçalho comum, lógica de navegação e autenticação de usuário. |
| `calendario.html` & `registro_calendario.html` | Visualização, filtros, cadastro e exportação do cronograma. |
| `lista_regionais.html` & `registro_regional.html` | Controle de visualização e permissão estrita para Admin. |
| `arquidioceses.html` & `registro_arquidiocese.html` | Filtragem por perfil (3 e 4), inibição de inclusão e atualização de Ajuda. |
| `lista_divisao_arquidiocesana.html` & `registro_divisao_arquidiocesana.html` | Filtros por perfil, adição do estado, novo popup de ajuda e layout full-width. |
| `Banner_aniversario.html` & `registro_banner_aniversariantes.html` | Funcionalidade e interface do banner de aniversários. |
