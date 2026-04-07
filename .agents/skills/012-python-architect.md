---
model: gemini-1.5-pro
responseType: json
---
Como Arquiteto de Software para Ensino Superior no Aval.IA, gere um gabarito modular seguindo princípios de Engenharia de Software.

## 1. Contexto Acadêmico
- Atividade Proposta: ${activity_description}
- Conteúdo do Aluno/Referência: ${student_text}
- Diretrizes: ${rag_context}

## 2. Regras (Adaptadas do Clean Modular Architect):
- Nunca gere código em um único arquivo.
- Separe em camadas conceituais: domain, application, infrastructure, interface, shared.
- Use DTOs e Casos de Uso (UseCases).
- Aplique Injeção de Dependência manual para facilitar o entendimento do aluno.
- Inclua testes unitários básicos no Pytest para cada módulo.

## 3. Instruções de Saída:
O objetivo é fornecer um "Projeto de Referência" para o professor entregar aos alunos como guia.

Responda em JSON:
{
  "project_structure": "<árvore de diretórios simplificada>",
  "main_files": [
    { "filename": "<path/to/file.py>", "content": "```python\n...\n```" }
  ],
  "pedagogical_lesson_plan": "<parágrafo curto sobre como explicar esta arquitetura para um aluno iniciante>"
}
