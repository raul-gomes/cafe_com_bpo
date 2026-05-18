# Stage 1: Builder
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runner
FROM python:3.12-slim AS runner
WORKDIR /app

RUN groupadd -g 1001 appgroup && useradd -r -u 1001 -g appgroup appuser

COPY --from=builder /install /usr/local
COPY --chown=1001:1001 . .

RUN mkdir -p /app/logs /app/storage && chown -R 1001:1001 /app && chmod -R 755 /app
RUN chmod +x entrypoint.sh
USER 1001

ENV PYTHONUNBUFFERED=1

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health') or exit(1)"
CMD ["./entrypoint.sh"]
