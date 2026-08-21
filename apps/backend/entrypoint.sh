#!/bin/bash

# Esperar o banco de dados estar pronto (opcional, mas recomendado)
echo "Aguardando migrações do banco de dados..."

# Rodar as migrações do Alembic para criar/atualizar as tabelas
alembic upgrade head

# Iniciar o servidor Uvicorn
# Em desenvolvimento (MODE != production) usamos --reload para hot-reload do código
# montado por volume; em produção o servidor sobe sem reload.
echo "Iniciando a API..."
if [ "$MODE" = "production" ]; then
  exec uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000
else
  exec uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000 --reload
fi

