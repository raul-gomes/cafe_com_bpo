"""
LangChain-based LLM Service for AI features.
Wraps ChatOllama with structured output support.
"""

import json
import re
from typing import Optional, Dict, Any

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

from src.core.logger import log


class LLMService:
    """LangChain-based service for interacting with Ollama LLM."""

    def __init__(self, model_name: str = "qwen2.5:7b", base_url: str = "http://ollama:11434"):
        self.model_name = model_name
        self.base_url = base_url
        self._llm: Optional[ChatOllama] = None

    def get_llm(self) -> ChatOllama:
        """Lazy-initialize and return the ChatOllama instance."""
        if self._llm is None:
            self._llm = ChatOllama(
                model=self.model_name,
                base_url=self.base_url,
                temperature=0.7,
            )
        return self._llm

    async def generate(self, prompt: str) -> str:
        """Generate a text response from the LLM."""
        try:
            llm = self.get_llm()
            message = HumanMessage(content=prompt)
            response = await llm.ainvoke([message])
            return response.content
        except Exception as e:
            log.error(f"Erro ao gerar com LangChain/Ollama: {str(e)}")
            return f"Erro ao gerar conteúdo com IA: {str(e)}"

    async def generate_structured(self, prompt: str, schema_description: str) -> Optional[Dict[str, Any]]:
        """Generate a structured JSON response from the LLM.

        Args:
            prompt: The user prompt.
            schema_description: Description of the expected JSON schema.

        Returns:
            Parsed JSON dict, or None if parsing fails.
        """
        system_prompt = (
            f"Você deve responder APENAS com um objeto JSON válido seguindo este schema:\n"
            f"{schema_description}\n\n"
            f"Não inclua explicações, apenas o JSON puro. "
            f"Não use markdown ou code blocks."
        )

        full_prompt = f"{system_prompt}\n\n{prompt}"

        try:
            llm = self.get_llm()
            message = HumanMessage(content=full_prompt)
            response = await llm.ainvoke([message])
            raw = response.content

            # Strip markdown code blocks if present
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
            raw = re.sub(r"\s*```$", "", raw.strip())

            return json.loads(raw)
        except json.JSONDecodeError as e:
            log.error(f"Erro ao parsear JSON da IA: {str(e)}\nResposta: {raw}")
            return None
        except Exception as e:
            log.error(f"Erro ao gerar resposta estruturada: {str(e)}")
            return None
