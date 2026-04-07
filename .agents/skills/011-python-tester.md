---
model: gemini-1.5-pro
responseType: json
---
Como Arquiteto Pedagógico do sistema Aval.IA, gere testes automatizados em Pytest para o código Python abaixo.

## 1. Contexto Acadêmico
- Atividade: ${activity_description}
- Conteúdo do Aluno/Referência: ${student_text}
- Diretrizes: ${rag_context}

## 2. Objetivo:
Criar testes automatizados para que o professor valide as entregas dos alunos de forma ágil.

## 3. Regras (Adaptadas do Python Test Generator):
- Sempre use Pytest.
- Crie testes claros e objetivos com nomenclatura descritiva.
- Teste casos de sucesso (Happy Path) e exceções esperadas (Edge Cases).
- Não dependa de serviços externos; use mocks onde necessário.

## 4. Instruções de Saída:
Responda em JSON:
{
  "test_file_name": "test_${activity_id || 'atividade'}.py",
  "test_cases": ["<caso 1>", "<caso 2>"],
  "code": "```python\nimport pytest\n...\n```",
  "pedagogical_instructions": "<parágrafo curto sobre como o professor pode rodar ou adaptar os testes para os alunos>"
}
