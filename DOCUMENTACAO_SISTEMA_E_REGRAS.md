# Documentação Geral do Sistema e Regras de Negócio Implementadas
## Projeto Adoção Espiritual

---

## 1. Visão Geral da Arquitetura

* **Front-end:** HTML5, CSS3 Customizado (sem Tailwind), JavaScript Vanilla modularizado, FontAwesome e bibliotecas auxiliares de exportação (html2canvas, jsPDF, XLSX).
* **Back-end:** Node.js com Express ([backend/server.js](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/backend/server.js)), conexão via pool assíncrono `mysql2/promise`.
* **Banco de Dados:** MySQL 8.0 rodando em container Docker dedicado (`adocao_espiritual_mysql`), administrável via phpMyAdmin (`http://localhost:8080`) e mapeado em [docker-compose.yml](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/docker-compose.yml).
* **Automação e Skill:** Script de auto-inicialização e diagnóstico em [.agents/skills/gerenciar-banco-docker/](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/.agents/skills/gerenciar-banco-docker/).

---

## 2. Autenticação, Sessão e Header Unificado

### Regras de Negócio e Comportamento:
1. **Identificação do Usuário ([identificacao.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/identificacao.html)):**
   * O colaborador se identifica por CPF / credencial cadastrada.
   * Ao efetuar login, os dados essenciais são persistidos em `localStorage`:
     * `user_nome`: Nome do usuário logado.
     * `user_id_colaborador`: Identificador do colaborador no banco.
     * `user_cod_colaborador`: CPF do colaborador.
     * `adocao_user_photo`: Foto de perfil em base64/URL.
     * `user_id_perfil`: ID do perfil de acesso (1 a 5).
     * `user_nome_perfil`: Nome textual do perfil (`Admin`, `Colaborador`, `Coordenador Regional`, `Coordenador Arquidiocesano`, `Coordenador Paroquial`).
     * `user_id_regional`: Lista/ID dos regionais vinculados ao usuário logado.
     * `user_id_arquidiocese`: Lista/ID das arquidioceses vinculadas ao usuário logado.
     * `user_id_paroquia`: Lista/ID das paróquias vinculadas ao usuário logado.
2. **Mapeamento de Perfis de Acesso (`user_id_perfil`):**
   * `1`: **Admin / Coordenador Geral** — Permissão irrestrita em todas as telas, inclusões, alterações e exclusões.
   * `2`: **Colaborador** — Consulta e operações básicas permitidas.
   * `3`: **Coordenador Regional** — Gestão delimitada aos regionais sob sua coordenação (`user_id_regional`).
   * `4`: **Coordenador Arquidiocesano** — Gestão delimitada às arquidioceses sob sua coordenação (`user_id_arquidiocese`).
   * `5`: **Coordenador Paroquial** — Gestão delimitada às paróquias sob sua coordenação (`user_id_paroquia`).
3. **Regras de Permissão por Perfil nos Módulos Geográficos/Hierárquicos:**
   * **Regionais ([lista_regionais.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/lista_regionais.html) e [registro_regional.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_regional.html)):**
     * Se `user_id_perfil !== '1'` (não é Admin):
       * Na listagem, o ícone de inclusão e os ícones de exclusão (lixeira) ficam ocultos.
       * Na tela de registro, na aba *Identificação*, o botão `SALVAR` é ocultado.
       * Na aba *Coordenadores*, os coordenadores já cadastrados são exibidos, mas os botões de adicionar (`+`) e excluir (lixeira) ficam ocultos, além de desabilitar o clique para edição.
   * **Arquidioceses ([arquidioceses.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/arquidioceses.html) e [registro_arquidiocese.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_arquidiocese.html)):**
     * Na listagem:
       * Se `user_id_perfil === '2'` (Colaborador): inibe o ícone de inclusão e os ícones de exclusão (lixeira) de arquidioceses.
        * Se `user_id_perfil === '3'` (Coordenador Regional): exibe apenas arquidioceses onde `id_regional` existe em `user_id_regional`.
       * Se `user_id_perfil === '4'` (Coordenador Arquidiocesano): exibe apenas a sua arquidiocese vinculada a `user_id_arquidiocese` e inibe o botão/ícone de inclusão de arquidioceses.
      * No formulário de cadastro/edição ([registro_arquidiocese.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_arquidiocese.html)):
        * Se `user_id_perfil === '2'` (Colaborador):
          * **Aba IDENTIFICAÇÃO:** Botões `Salvar` e `Excluir` são ocultados.
          * **Aba LIDERANÇA:** O botão de adicionar liderança (`+`), o ícone de exclusão (`lixeira`) e a ação de clique nas linhas para edição são desabilitados/ocultados.
          * **Aba COORDENADORES:** O botão de adicionar coordenador (`+`), o ícone de exclusão (`lixeira`) e a ação de clique nas linhas para edição são desabilitados/ocultados.
      * No formulário de inclusão (`mode === 'new'`), para Coordenador Regional (`user_id_perfil === '3'`), o campo **Regional** exibe apenas as regionais em que o usuário logado é coordenador.
   * **Divisão Arquidiocesana ([lista_divisao_arquidiocesana.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/lista_divisao_arquidiocesana.html) e [registro_divisao_arquidiocesana.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_divisao_arquidiocesana.html)):**
     * Na listagem:
       * Se `user_id_perfil === '3'`: filtra as divisões onde `arquidioceses.id_regional` existe em `user_id_regional`.
       * Se `user_id_perfil === '4'`: filtra as divisões onde `arquidioceses.id_arquidiocese` existe em `user_id_arquidiocese`.
       * Cada linha exibe: `${subdivisao} - ${arquidiocese} - ${regional} - ${estado} - ${status}`.
       * Suporte a busca unificada (incluindo nome/sigla do estado) e exportação para Excel formatada.
       * Modal de **Ajuda** padronizado (`? Ajuda`) descrevendo os acessos por perfil e a busca.
     * No cadastro ([registro_divisao_arquidiocesana.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/registro_divisao_arquidiocesana.html)):
       * Para `user_id_perfil === '3'` (Coordenador Regional):
         * Campo **Estado**: exibe apenas os estados pertencentes às regionais em `user_id_regional`.
         * Campo **Regional**: exibe apenas as regionais em `user_id_regional`.
       * Para `user_id_perfil === '4'` (Coordenador Arquidiocesano):
         * Campo **Estado**: exibe apenas os estados das arquidioceses em `user_id_arquidiocese`.
         * Campo **Regional**: exibe apenas os regionais das arquidioceses em `user_id_arquidiocese`.
         * Campo **(Arqui)Diocese**: exibe apenas as arquidioceses em `user_id_arquidiocese`.
    * **Colaboradores ([colaboradores.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/colaboradores.html)):**
      * **Perfil 2 (Colaborador):**
        * Exibe na lista apenas o registro do próprio colaborador logado (`user_id_colaborador`).
        * Oculta o ícone de lixeira (exclusão).
        * Oculta o ícone no topo da lista que permite a inclusão de novos colaboradores.
      * **Perfil 3 (Coordenador Regional):**
        * Exibe na lista apenas os colaboradores cujo estado (`colaboradores.id_estado`) pertença a um regional vinculado ao usuário logado (`regional_estado.id_regional IN user_id_regional`).
      * **Perfil 4 (Coordenador Arquidiocesano):**
        * Exibe na lista apenas os colaboradores cuja paróquia pertença a uma arquidiocese vinculada ao usuário logado (`paroquias.id_arquidiocese IN user_id_arquidiocese`).
      * **Perfil 5 (Coordenador Paroquial):**
        * Exibe na lista apenas os colaboradores cuja paróquia pertença às paróquias vinculadas ao usuário logado (`colaboradores.id_paroquia IN user_id_paroquia`).
4. **Padrão dos Modais de Ajuda (`.help-card`):**
   * Largura ampliada globalmente para `max-width: 720px; max-height: 85vh; overflow-y: auto;` garantindo leitura confortável e responsiva de orientações detalhadas sem truncamentos.
5. **Componente de Cabeçalho Global ([assets/js/header.js](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/assets/js/header.js)):**
   * **Injeção Dinâmica:** O header e o menu sanduíche são injetados automaticamente em todas as telas que importam o script.
   * **Card do Perfil:** Exibe a foto do colaborador (ou avatar padrão com ícone), nome completo em destaque e CPF formatado (`000.000.000-00`).
   * **Alteração de Foto Rápida:** Ao clicar no avatar ou no badge de câmera, permite upload direto de nova foto atualizando o perfil via API.
   * **Controle de Acesso por Perfil:** Exibe se o usuário é `Administrador`, `Coordenador` ou `Colaborador`. Itens administrativos ou gerenciais só são visíveis de acordo com a permissão.
   * **Botão Sair (Logout):** Limpa as informações de sessão do navegador e redireciona para [identificacao.html](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/identificacao.html).

---

## 3. Módulo de Treinamentos e Capacitação

### Regras de Negócio Implementadas:
1. **Regra de Exclusão Mútua (Instrutor vs Participante):**
   * Um colaborador **NÃO PODE** ser instrutor e participante no mesmo treinamento.
   * Ao tentar vincular um participante que já está escalado como instrutor em qualquer agenda daquele treinamento, o backend rejeita com erro `400 Bad Request`.
   * Da mesma forma, ao cadastrar um instrutor para uma pauta/agenda, o sistema valida se ele já está matriculado como participante e bloqueia se for o caso.
2. **Integridade de Datas de Auditoria (`criado_em` e `atualizado_em`):**
   * O campo `criado_em` é imutável: permanece estritamente fixo na data de inserção original.
   * O campo `atualizado_em` é atualizado a cada alteração ou reagendamento, registrando quem foi o colaborador responsável (`id_colaborador_atualiza`).
3. **Formas e Status do Treinamento:**
   * Modalidade: `Presencial` ou `Online`.
   * Status: `agendado`, `em_andamento`, `concluido`, `cancelado`.
   * Qualificação: Define o papel para o qual o treinamento capacita (ex: *Colaborador Adoção Espiritual*, *Coordenador*, etc.).

---

## 4. Módulo de Gestão de Projetos, Tarefas e Atividades

### Regras de Negócio Implementadas:
1. **Consistência de Status e Progresso de Tarefas:**
   * Se a tarefa tem **Percentual = 100%**, o status obrigatoriamente **não pode** permanecer como `Em andamento` ou `Não iniciado`.
   * Se o status for marcado como `Concluída`, o progresso percentual obrigatoriamente deve ser `100%`. Se for inferior a 100%, o backend rejeita a gravação com código `400`.
2. **Hierarquia e Cascata:**
   * **Projeto** $\rightarrow$ **Tarefas** $\rightarrow$ **Atividades da Tarefa**.
   * Ao listar as tarefas de um projeto (`/api/projetos/:id/tarefas`), o backend aninha o array de sub-atividades correspondentes (`atividades: [...]`).
   * Deleções e atualizações de atividades mantêm vínculo com a tarefa e o projeto original.
3. **Reuniões do Projeto ([test_reunioes.js](file:///c:/Users/ASUS/Desktop/Projeto%20Ado%C3%A7%C3%A3o%20Espiritual/backend/test_reunioes.js)):**
   * Cada reunião registra data, pauta resolvida e a lista textual ou IDs dos participantes envolvidos.
   * Vínculo estrito com o `id_projeto`.

---

## 5. Módulo de Calendário, Feriados e Cronograma de Eventos

### Estrutura de Banco de Dados Atual vs Legada:
* **Tabela Atual de Feriados (`calendario_feriados`):**
  Armazena feriados nacionais, municipais e datas santas da Igreja. Os campos incluem `nome_evento`, `calendario_religioso`, `feriado`, `data` (armazenada de forma direta, ex: `'25/12'` ou `'17/02/2026'`) e `observacoes`.
* **Tabela Atual de Cronograma Pastoral (`atividades_calendario`):**
  Tabela principal para todas as atividades programadas, encontros, reuniões e missas pastorais da Adoção Espiritual, com controle de status, recorrência, coordenadores e vinculação paroquial/arquidiocesana.
* **Histórico / Migração Legada:**
  A tabela intermediária `calendario_datas` e a antiga `calendario` foram descontinuadas e refatoradas no banco de dados ativo, unificando a gestão de datas diretamente em `calendario_feriados` e `atividades_calendario`.

### Regras de Negócio e Exportação:
1. **Tipos de Eventos e Recorrência:**
   * Distinção clara entre feriados civis, datas religiosas e atividades operacionais/pastorais.
   * Suporte a recorrências semanais, mensais e anuais no cronograma de atividades.
2. **Busca e Filtragem:**
   * Busca insensível a acentuação e caracteres especiais em nomes de eventos, atividades e locais.
   * Filtros por abrangência: **Nacional** (sem arquidiocese específica), por **Arquidiocese** ou por **Paróquia**.
3. **Exportação Oficial em PDF:**
   * **Layout de Cronograma:** Gera cabeçalho institucional contendo o logotipo oficial e título formatado.
   * **Sigla UF Automática:** Converte o nome por extenso do estado para sua sigla correspondente (ex: "São Paulo" $\rightarrow$ "SP").
   * **Ícones de Formato:** Renderiza ícones indicativos do formato da atividade (Online, Presencial, Híbrido).
   * **Remoção de Rodapés Redundantes:** O rodapé com dados de contato foi suprimido a pedido da identidade visual.
   * **Validação de Formulário no Modal:** Os campos sinalizados com asterisco (`*`) barram a emissão caso não sejam preenchidos.
   * **Flexibilidade da Paróquia:** O campo Paróquia não é obrigatório quando a consulta é de escopo geral ou arquidiocesano.
4. **Exportação em Planilha (Excel / XLSX):**
   * Estruturação das colunas com informações do evento, data/hora, coordenadores responsáveis e local, sem colunas sobressalentes desnecessárias.

---

## 6. Módulo de Colaboradores e Histórico de Liderança

### Regras de Negócio Implementadas:
1. **Movimentações de Liderança:**
   * Registro histórico de cargos e lideranças na tabela `colaborador_lideranca`.
   * Tipos suportados via ENUM dinâmico: *Coordenador paroquial*, *Coordenador diocesano*, *Coordenador regional*, *Liderança nacional*, etc.
   * Período de vigência: `data_inicio` e `data_fim` (podendo ser nula para funções ativas).
   * Status: `Ativo` ou `Inativo`.
2. **Dados Cadastrais e Endereçamento:**
   * Associação geográfica hierárquica: Regional $\rightarrow$ Arquidiocese/Diocese $\rightarrow$ Paróquia.
   * Validação de unicidade e formato de CPF e e-mail.
3. **Regras de Visualização e Permissões por Perfil (`colaboradores.html` e `registro_colaboradores.html`):**
   * **Admin (`user_id_perfil = 1`):** Acesso irrestrito a todos os colaboradores, estados, paróquias, inclusão, alteração e exclusão.
   * **Colaborador (`user_id_perfil = 2`):**
     * Na listagem (`colaboradores.html`): visualiza apenas o seu próprio registro cadastral, sem ícone de exclusão e sem o botão de incluir novo colaborador.
     * No formulário (`registro_colaboradores.html`):
       * Aba *Dados Pessoais*: botão 'Excluir' ocultado.
       * Aba *Talentos e Observações*: botão 'Excluir' ocultado.
       * Abas *Coordenações*, *Treinamentos* e *Certificados*: desabilitadas quaisquer funções ou botões de inclusão, alteração e exclusão de dados (somente leitura).
   * **Coordenador Regional (`user_id_perfil = 3`):**
     * Na listagem (`colaboradores.html`): lista apenas colaboradores cujo estado de residência (`colaboradores.id_estado`) pertença à regional gerenciada por ele (`regional_estado.id_regional = user_id_regional`).
     * No formulário (`registro_colaboradores.html`):
       * Aba *Dados Pessoais*: campo de seleção de Estado restrito apenas aos Estados pertencentes à sua regional vinculada (`user_id_regional`).
   * **Coordenador Arquidiocesano (`user_id_perfil = 4`):**
     * Na listagem (`colaboradores.html`): lista apenas colaboradores pertencentes a paróquias sob sua arquidiocese vinculada (`paroquias.id_arquidiocese = user_id_arquidiocese`).
     * No formulário (`registro_colaboradores.html`):
       * Aba *Dados Pessoais*: campo Estado lista apenas os Estados das arquidioceses vinculadas a `user_id_arquidiocese`; campo Paróquia lista estritamente paróquias pertencentes à sua arquidiocese (`paroquias.id_arquidiocese = user_id_arquidiocese`).
   * **Coordenador Paroquial (`user_id_perfil = 5`):**
     * Na listagem (`colaboradores.html`): lista apenas colaboradores da paróquia que coordena (`colaboradores.id_paroquia = user_id_paroquia`).
     * No formulário (`registro_colaboradores.html`):
       * Aba *Dados Pessoais*: campo Estado restrito ao Estado da sua paróquia; campo Paróquia lista estritamente a paróquia que coordena (`id_paroquia = user_id_paroquia`).
       * Abas *Coordenações*, *Treinamentos* e *Certificados*: desabilitadas quaisquer funções ou botões de inclusão, alteração e exclusão de dados (somente leitura).

4. **Regras de Visualização e Permissões de Treinamentos (`treinamentos.html`):**
   * **Admin (`user_id_perfil = 1`):** Acesso irrestrito com visibilidade total do ícone de inclusão de novos treinamentos, ícones de exclusão (lixeira) e permissão de clique sobre a linha para editar o treinamento.
   * **Demais Perfis (`user_id_perfil <> 1`):**
     * O ícone de inclusão no cabeçalho (ao lado do título "Lista de Treinamentos") é ocultado e a ação de clique no título desabilitada.
     * Os ícones de exclusão (lixeira) em todas as linhas da lista de treinamentos são ocultados.
     * O clique sobre a linha da listagem é desabilitado (cursor padrão `default` e sem ação de redirecionamento para edição).

---

## 7. Módulo de Pesquisa de Satisfação dos Usuários

### Regras de Negócio Implementadas:
1. **Identificação Obrigatória (Não Anônima):**
   * Submissões sem `id_colaborador` válido são rejeitadas pelo backend com status `400 Bad Request`.
2. **Tratamento de Recusa / Opt-out:**
   * Caso o colaborador opte por não responder à pesquisa no momento, registra-se um registro com `recusado = 1`.
   * Registros com `recusado = 1` são ignorados nas listagens de respostas ativas e relatórios qualitativos, mas servem para o sistema não insistir com o popup de pesquisa na sessão do usuário.
3. **Métricas e NPS (Net Promoter Score):**
   * Avaliação de notas numéricas de navegação, visual e uso em dispositivos móveis.
   * Pergunta NPS (0 a 10):
     * **Promotores:** Notas 9 e 10.
     * **Neutros/Passivos:** Notas 7 e 8.
     * **Detratores:** Notas 0 a 6.
   * O endpoint `/api/pesquisa_satisfacao/stats` calcula e retorna automaticamente a distribuição percentual e índice consolidado.

---

## 8. Módulo de Banner e Aniversariantes

### Regras de Negócio Implementadas:
1. **Cálculo Automático de Aniversariantes:**
   * Filtra aniversariantes do dia ou do mês corrente a partir da data de nascimento dos colaboradores ativos.
2. **Customização do Banner:**
   * Permite cadastrar mensagens comemorativas, imagens personalizadas e períodos de exibição no menu principal.

---

## 9. Lista Consolidada de Endpoints da API

| Módulo | Método | Rota | Descrição |
| :--- | :---: | :--- | :--- |
| **Colaboradores** | `GET` | `/api/colaboradores` | Lista colaboradores cadastrados |
| | `POST` | `/api/colaboradores/save` | Cria ou atualiza colaborador |
| | `GET` | `/api/colaboradores/:id/lideranca` | Lista histórico de liderança do colaborador |
| | `POST` | `/api/colaborador_lideranca/save` | Salva registro de liderança |
| **Treinamentos** | `POST` | `/api/treinamentos/save` | Cria/atualiza treinamento com auditoria |
| | `POST` | `/api/treinamentos/:id/participantes`| Adiciona participante (com exclusão mútua) |
| | `POST` | `/api/treinamento_instrutores/save` | Agenda instrutor (com exclusão mútua) |
| **Projetos** | `POST` | `/api/projetos/save` | Cria/atualiza projeto |
| | `POST` | `/api/projetos/tarefas/save` | Salva tarefa (com validação % vs status) |
| | `POST` | `/api/projetos/tarefas/atividades/save`| Salva sub-atividade vinculada à tarefa |
| | `POST` | `/api/projetos/reunioes/save` | Registra reunião e pauta |
| **Calendário (Feriados)** | `GET` | `/api/calendario_feriados` | Lista feriados e datas religiosas |
| | `POST` | `/api/calendario_feriados/save` | Salva feriado ou data religiosa |
| | `DELETE` | `/api/calendario_feriados/:id` | Remove data de feriado/religiosa |
| **Atividades / Cronograma** | `GET` | `/api/atividades_calendario` | Lista atividades e eventos pastorais |
| | `POST` | `/api/atividades_calendario/save` | Salva evento do cronograma e recorrência |
| | `DELETE` | `/api/atividades_calendario/:id` | Exclui evento pastoral |
| **Satisfação** | `GET` | `/api/pesquisa_satisfacao/stats` | Retorna métricas consolidadas e NPS |
| | `POST` | `/api/pesquisa_satisfacao/save` | Salva resposta identificada ou recusa |
| **Regionais** | `GET` | `/api/regionais/detalhes` | Lista regionais com estados e países vinculados |
| | `GET` | `/api/regionais/estado/:id_estado` | Lista regionais de determinado estado |
| **Arquidioceses** | `GET` | `/api/arquidioceses/detalhes` | Lista arquidioceses com país, regional e estado |
| | `GET` | `/api/arquidioceses/regional/:id_regional` | Lista arquidioceses vinculadas a um regional |
| **Divisões Arquidiocesanas** | `GET` | `/api/divisao_arquidiocesana/detalhes` | Lista divisões arquidiocesanas com arquidiocese, regional e estado |
| | `GET` | `/api/divisao_arquidiocesana/:id` | Retorna detalhes de uma divisão específica |
| | `DELETE` | `/api/divisao_arquidiocesana/:id` | Exclui registro de divisão arquidiocesana |
