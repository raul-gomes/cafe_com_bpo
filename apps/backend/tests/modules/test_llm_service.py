"""
LangChain LLM Service Tests — TDD Approach
RED phase: tests written BEFORE implementation.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.modules.ai.llm_service import LLMService


class TestLLMServiceInit:
    """Tests for LLMService initialization and configuration."""

    def test_create_llm_service_with_default_model(self):
        """Should initialize with qwen2.5:7b as default model."""
        service = LLMService()
        assert service.model_name == "qwen2.5:7b"

    def test_create_llm_service_with_custom_model(self):
        """Should accept custom model name."""
        service = LLMService(model_name="llama3.2:3b")
        assert service.model_name == "llama3.2:3b"

    def test_llm_instance_is_lazy(self):
        """LLM instance should not be created until first use."""
        service = LLMService()
        assert service._llm is None

    def test_get_llm_returns_cached_instance(self):
        """Should return the same LLM instance on subsequent calls."""
        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_chat.return_value = MagicMock()
            service = LLMService()
            llm1 = service.get_llm()
            llm2 = service.get_llm()
            assert llm1 is llm2
            mock_chat.assert_called_once()


class TestLLMServiceGenerate:
    """Tests for LLMService generate method."""

    async def test_generate_returns_string(self):
        """Should return a string response from the LLM."""
        mock_response = MagicMock()
        mock_response.content = "Hello, BPO world!"

        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_chat.return_value = mock_llm

            service = LLMService()
            result = await service.generate("Tell me about BPO")

            assert isinstance(result, str)
            assert "Hello, BPO world!" in result

    async def test_generate_passes_correct_prompt_to_llm(self):
        """Should pass the user's prompt to the LLM correctly."""
        mock_response = MagicMock()
        mock_response.content = "Response"

        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_chat.return_value = mock_llm

            service = LLMService()
            await service.generate("What is fiscal closing?")

            call_args = mock_llm.ainvoke.call_args[0][0]
            assert len(call_args) == 1
            assert "What is fiscal closing?" in call_args[0].content

    async def test_generate_handles_error_gracefully(self):
        """Should return error message when LLM fails."""
        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(side_effect=Exception("Connection refused"))
            mock_chat.return_value = mock_llm

            service = LLMService()
            result = await service.generate("Test prompt")

            assert "Erro" in result or "Error" in result


class TestLLMServiceGenerateStructured:
    """Tests for structured JSON output from LLM."""

    async def test_generate_structured_returns_parsed_json(self):
        """Should parse JSON response from LLM."""
        mock_response = MagicMock()
        mock_response.content = '{"priority": "high", "reasoning": "Urgent deadline"}'

        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_chat.return_value = mock_llm

            service = LLMService()
            result = await service.generate_structured(
                prompt="Analyze this task",
                schema_description='{"priority": "string (low|medium|high)", "reasoning": "string"}'
            )

            assert result["priority"] == "high"
            assert result["reasoning"] == "Urgent deadline"

    async def test_generate_structured_handles_invalid_json(self):
        """Should return None when LLM returns invalid JSON."""
        mock_response = MagicMock()
        mock_response.content = "This is not JSON at all"

        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_chat.return_value = mock_llm

            service = LLMService()
            result = await service.generate_structured(
                prompt="Test",
                schema_description="{}"
            )

            assert result is None

    async def test_generate_structured_handles_json_with_markdown(self):
        """Should strip markdown code blocks from JSON response."""
        mock_response = MagicMock()
        mock_response.content = '```json\n{"priority": "medium"}\n```'

        with patch("src.modules.ai.llm_service.ChatOllama") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_chat.return_value = mock_llm

            service = LLMService()
            result = await service.generate_structured(
                prompt="Test",
                schema_description="{}"
            )

            assert result is not None
            assert result["priority"] == "medium"
