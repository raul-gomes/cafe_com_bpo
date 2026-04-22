#!/bin/bash

# Esperar o banco de dados estar pronto (opcional, mas recomendado)
echo "Aguardando migrações do banco de dados..."

# Rodar as migrações do Alembic para criar/atualizar as tabelas
alembic upgrade head

# Iniciar o servidor Uvicorn
echo "Iniciando a API..."
exec uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000
