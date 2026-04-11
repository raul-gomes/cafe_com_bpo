import sys
import logging
from loguru import logger
from src.core.config import get_settings

settings = get_settings()

def setup_logging():
    # Remove logs padrão do uvicorn/fastapi
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.error").handlers = []
    logging.getLogger("fastapi").handlers = []

    # Configuração central do Loguru - Formato JSON
    handlers = [
        {
            "sink": sys.stdout,
            "format": "{message}",
            "level": "DEBUG" if settings.mode == "development" else "INFO",
            "serialize": True, # Ativa saída em JSON estruturado
        }
    ]

    # Só ativa logs de arquivo se não estivermos em modo de teste
    if settings.mode != "test":
        handlers.append({
            "sink": "logs/server.json",
            "format": "{message}",
            "level": "INFO",
            "rotation": "10 MB",
            "retention": "7 days",
            "compression": "zip",
            "serialize": True,
        })

    config = {"handlers": handlers}

    logger.configure(**config)
    
    # Interceptor para redirecionar logs de bibliotecas padrão
    class InterceptHandler(logging.Handler):
        def emit(self, record):
            try:
                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno

            frame, depth = logging.currentframe(), 2
            while frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1

            logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    
    logger.info("Sistema de Logging estruturado (JSON) inicializado.")

log = logger
