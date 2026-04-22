# Stage 1: Builder
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runner
FROM python:3.12-slim AS runner
WORKDIR /app

RUN useradd -r -u 1001 appuser
COPY --from=builder /install /usr/local
COPY . .

RUN mkdir -p logs storage && chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "src.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
