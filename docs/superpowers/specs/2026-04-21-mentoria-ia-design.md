# Spec: Mentoria de Trincheira com IA (Café com BPO)

**Data:** 2026-04-21  
**Status:** Design Validado  
**Objetivo:** Adicionar uma camada de inteligência artificial ao Simulador de Precificação para fornecer feedbacks estratégicos, análises de risco e argumentos de venda para os operadores de BPO.

---

## 1. Visão Geral
A funcionalidade **"Mentoria de Trincheira"** atua como um consultor sênior sob demanda. Após realizar uma simulação técnica de preço, o usuário pode solicitar uma análise qualitativa da IA, que avaliará a viabilidade operacional e comercial da proposta.

## 2. Personagem da IA (The Persona)
Para manter o alinhamento com o posicionamento "anti-guru" da plataforma, a IA deve seguir estas diretrizes:
- **Tone:** Direto, honesto, sem "juridiquês" ou promessas vazias.
- **DNA:** Foco na "ética do trabalho real". Valoriza o lucro sustentável e a saúde operacional do BPO.
- **Estilo:** Usa termos do cotidiano do BPO (setup, conciliação, gargalo, churn, onboarding).

## 3. Fluxo de Funcionalidades (User Journey)

### 3.1 Ponto de Entrada (UI)
- No final do formulário do Simulador, abaixo dos resultados técnicos (Preço Sugerido, Margem, etc), haverá o botão: `[Solicitar Mentoria de Trincheira (IA)]`.
- O botão terá um visual premium, com um leve brilho (glow) para indicar que é uma funcionalidade "Pro".

### 3.2 Processamento (Backend)
1. O Frontend envia o estado completo da simulação (`inputs` e `results`).
2. O Backend (FastAPI) utiliza **LangChain** para gerenciar a conversa.
3. O LangChain utiliza a integração `Ollama` para chamar o modelo (ex: `llama3`).
4. O Prompt enviado contém os dados da simulação interpolados em um template de mentoria.

### 3.3 Relatório Final (Output)
A IA retornará um texto em Markdown com três seções fixas:
1.  **Check de Realidade:** Análise se o preço cobre os riscos e o tempo gasto.
2.  **Sinal de Alerta:** Onde a operação pode dar errado (ex: poucas horas para muita complexidade).
3.  **Argumento de Valor:** Como convencer o cliente de que o preço é justo.

## 4. Arquitetura Técnica

### 4.1 Tecnologias
- **Orquestração de IA:** LangChain (Python).
- **LLM:** Ollama (rodando localmente via Docker).
- **Backend:** FastAPI (Python).
- **Frontend:** React + TailwindCSS (ou CSS puro conforme padrão do projeto) + `react-markdown`.

### 4.2 Endpoint de API
`POST /api/ai/mentorship`
- **Request Body:**
```json
{
  "client_data": { "name": "...", "segment": "..." },
  "simulation_results": { "suggested_price": 0, "margin": 0, ... },
  "service_items": [ "item1", "item2" ]
}
```

### 4.3 Prompt Template (Exemplo)
```text
System: Você é o Mentor da Comunidade Café com BPO. Sua missão é impedir que o operador de BPO tenha prejuízo ou se torne escravo do cliente.

Contexto da Proposta:
Cliente: {client_segment}
Serviços: {services}
Preço Final sugerido: {price}
Margem de Lucro: {margin}%

Analise os pontos cegos dessa operação e dê conselhos práticos de quem já está nas trincheiras há anos.
```

## 5. Próximos Passos (Implementação)
1. Configurar o módulo `ai` no backend.
2. Integrar LangChain com o container `ollama`.
3. Criar a interface de resposta no frontend do Simulador.

---
**Spec escrita e pronta para revisão.**
