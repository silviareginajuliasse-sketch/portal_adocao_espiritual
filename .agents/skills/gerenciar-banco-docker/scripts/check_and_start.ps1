# Script de verificação e inicialização do ambiente Docker e Banco de Dados MySQL
$ComposeFile = Join-Path $PSScriptRoot "..\..\docker-compose.yml"
$ProjectDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Write-Host "Verificando se o serviço do Docker está em execução..." -ForegroundColor Cyan

try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker daemon não está respondendo. Certifique-se de que o Docker Desktop está aberto." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erro ao executar o comando 'docker'. Verifique se o Docker está instalado e no PATH." -ForegroundColor Red
    exit 1
}

# Verifica se o container adocao_espiritual_mysql está em execução
$running = docker ps --filter "name=adocao_espiritual_mysql" --filter "status=running" -q

if ($running) {
    Write-Host "O container do banco de dados (adocao_espiritual_mysql) já está em execução!" -ForegroundColor Green
} else {
    Write-Host "O container do banco de dados não está rodando. Subindo serviços via docker compose..." -ForegroundColor Yellow
    Push-Location $ProjectDir
    try {
        docker compose up -d
        Write-Host "Containers iniciados com sucesso!" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# Exibe o status atual dos containers do projeto
docker ps --filter "name=adocao_espiritual"
