# Aval.IA — Skills do Projeto

## Visão Geral
Skills são módulos de capacidade do sistema Aval.IA. Cada skill define como o sistema
deve se comportar em uma tarefa específica, com prompt base, parâmetros e exemplos.

---

## SKILL 001 — Correção de Trabalho Dissertativo

**Trigger:** Upload de PDF ou texto com resposta dissertativa  
**Modelo:** Gemini 1.5 Pro  
**RAG:** Sim (busca gabarito + critérios no ChromaDB)

### Prompt Base
```
Você é um professor universitário experiente corrigindo um trabalho acadêmico.

## Critérios de Avaliação (recuperados via RAG):
{rag_context}

## Trabalho do Aluno:
Nome: {student_name}
Matéria: {subject}
Conteúdo:
{student_text}

## Instruções de Correção:
- Avalie de 0 a 10 com uma casa decimal
- Seja justo, construtivo e específico
- Identifique pontos fortes e áreas de melhoria
- Use linguagem acessível ao aluno
- Considere: clareza, profundidade, coerência, uso correto dos conceitos

Responda SOMENTE em JSON:
{
  "grade": <0.0 a 10.0>,
  "feedback": "<feedback geral, máx 300 chars>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>"],
  "improvements": ["<melhoria 1>", "<melhoria 2>"],
  "criteria_scores": {
    "clareza": <0-10>,
    "profundidade": <0-10>,
    "coerencia": <0-10>,
    "conceitos": <0-10>
  }
}
```

### Parâmetros
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `student_name` | string | Nome completo do aluno |
| `subject` | string | Nome da matéria |
| `student_text` | string | Conteúdo do trabalho (máx 8000 chars) |
| `rag_context` | string | Chunks relevantes do ChromaDB |

---

## SKILL 002 — Correção de Questões Objetivas

**Trigger:** Upload com gabarito + respostas do aluno  
**Modelo:** Gemini 1.5 Flash (mais rápido/barato)  
**RAG:** Opcional

### Prompt Base
```
Você está corrigindo um questionário de múltipla escolha.

## Gabarito Oficial:
{answer_key}

## Respostas do Aluno ({student_name}):
{student_answers}

## Instruções:
- Compare cada resposta com o gabarito
- Calcule a nota proporcional (acertos / total * 10)
- Para cada erro, explique brevemente o conceito correto

Responda SOMENTE em JSON:
{
  "grade": <0.0 a 10.0>,
  "total_questions": <número>,
  "correct": <número de acertos>,
  "wrong": <número de erros>,
  "per_question": [
    { "question": 1, "correct": true, "explanation": null },
    { "question": 2, "correct": false, "explanation": "<conceito correto>" }
  ],
  "feedback": "<resumo do desempenho>"
}
```

---

## SKILL 003 — Geração de Feedback Personalizado

**Trigger:** Após correção, gera feedback adaptado ao perfil do aluno  
**Modelo:** Gemini 1.5 Pro  
**RAG:** Sim (histórico de notas anteriores do aluno)

### Prompt Base
```
Você é um tutor educacional empático. Com base no histórico e na última correção,
gere um feedback personalizado e motivador para o aluno.

## Histórico do Aluno ({student_name}):
{student_history}

## Última Correção:
Matéria: {subject}
Nota: {grade}
Pontos fracos: {improvements}

## Instruções:
- Tom encorajador e construtivo
- Compare com desempenho anterior (melhoria ou queda)
- Sugira recursos específicos para os pontos fracos
- Máximo 3 parágrafos

Responda em texto corrido em português, sem JSON.
```

---

## SKILL 004 — Detecção de Similaridade (Anti-Plágio)

**Trigger:** Comparação entre trabalhos da mesma turma  
**Modelo:** Gemini Embeddings (text-embedding-004) + cosine similarity  
**RAG:** Sim (todos os trabalhos da turma no ChromaDB)

### Lógica
```typescript
// Calcular similaridade entre dois textos
async function checkPlagiarism(textA: string, textB: string): Promise<number> {
  const [embA, embB] = await Promise.all([
    embedText(textA),
    embedText(textB),
  ]);
  return cosineSimilarity(embA, embB); // 0.0 a 1.0
}

// Thresholds
// > 0.95 → Plágio provável
// 0.80–0.95 → Similaridade alta (revisar)
// < 0.80 → Normal
```

### Prompt de Análise
```
Dois trabalhos apresentaram similaridade de {similarity_score:.0%}.

Trechos mais similares:
{similar_passages}

Analise se é plágio, coincidência temática ou uso do mesmo material de apoio.
Responda em JSON:
{
  "plagiarism_likely": <true|false>,
  "confidence": <"high"|"medium"|"low">,
  "reason": "<explicação em 1 frase>",
  "recommendation": "<ação sugerida ao professor>"
}
```

---

## SKILL 005 — Ingestão de Documentos de Referência

**Trigger:** Professor faz upload de gabarito, rubrica ou material de apoio  
**Modelo:** Gemini text-embedding-004  
**RAG:** Grava no ChromaDB

### Pipeline
```
PDF/DOCX/TXT
     ↓
Extração de texto (pdf-parse / mammoth)
     ↓
Chunking (1500 chars, overlap 200)
     ↓
Embedding (text-embedding-004)
     ↓
ChromaDB collection: subject_{nome_materia}
     ↓
Metadados: { subject, docName, chunkIndex, docType }
```

### Tipos de documento suportados
| Tipo | `docType` | Uso no RAG |
|---|---|---|
| Gabarito oficial | `answer_key` | Correção objetiva |
| Rubrica de avaliação | `rubric` | Correção dissertativa |
| Material de apoio | `reference` | Contexto adicional |
| Trabalho anterior (exemplo A+) | `exemplar` | Comparação qualitativa |

---

## SKILL 006 — Sumarização de Turma

**Trigger:** Professor solicita relatório geral de uma turma/matéria  
**Modelo:** Gemini 1.5 Pro  
**RAG:** Não (usa dados estruturados do banco)

### Prompt Base
```
Analise o desempenho geral da turma abaixo e gere um relatório para o professor.

## Dados da Turma:
Matéria: {subject}
Total de alunos: {total_students}
Notas: {grades_list}
Média: {average}
Desvio padrão: {std_dev}

## Instruções:
- Identifique padrões (tópicos mais errados, distribuição de notas)
- Sugira ajustes pedagógicos se necessário
- Destaque alunos em risco (nota < 5) e em destaque (nota > 9)
- Tom profissional e objetivo

Responda em JSON:
{
  "summary": "<parágrafo resumo>",
  "at_risk_students": ["<nome>"],
  "top_students": ["<nome>"],
  "common_weaknesses": ["<tópico 1>", "<tópico 2>"],
  "pedagogical_suggestions": ["<sugestão 1>"]
}
```

---

## SKILL 007 — Extração Estruturada de Trabalho

**Trigger:** Qualquer upload de trabalho antes da correção  
**Modelo:** Gemini 1.5 Flash  
**RAG:** Não

### Objetivo
Normalizar o trabalho do aluno antes de enviar para correção,
extraindo seções relevantes e metadados.

### Prompt Base
```
Extraia as informações estruturadas do trabalho acadêmico abaixo.

## Trabalho:
{raw_text}

Responda SOMENTE em JSON:
{
  "title": "<título do trabalho ou null>",
  "student_name": "<nome encontrado no documento ou null>",
  "date": "<data encontrada ou null>",
  "word_count": <número de palavras>,
  "sections": ["<seção 1>", "<seção 2>"],
  "main_content": "<texto principal limpo, sem cabeçalhos>",
  "language": "<pt|en|es>",
  "has_bibliography": <true|false>
}
```

---

## SKILL 008 — Processamento de Cadastro (CRUD AI)

**Trigger:** Comando de voz ou texto livre do professor para gerenciar turmas/alunos  
**Modelo:** Gemini 1.5 Flash  
**RAG:** Sim (busca IDs de nomes existentes no Chroma/DB)

### Prompt Base
```
Você é um assistente administrativo escolar. Sua tarefa é converter um comando em linguagem natural em uma operação de banco de dados estruturada.

## Entidades Existentes (IDs e Nomes):
Materias: {existing_subjects}
Alunos: {existing_students}
Atividades: {existing_activities}

## Comando do Usuário:
"{user_command}"

## Instruções:
1. Identifique a operação: "CREATE", "READ", "UPDATE" ou "DELETE".
2. Identifique a entidade: "student", "subject" ou "activity".
3. Resolva chaves estrangeiras: se o usuário disser "na matéria Cálculo", procure o ID correspondente.
4. Validação: se faltar dados obrigatórios, avise em "error".

Responda SOMENTE em JSON:
{
  "operation": <op>,
  "entity": <entity>,
  "data": { ... },
  "error": <null ou "mensagem de erro">
}
```

---

## Configuração de Skills no Projeto

```typescript
// lib/skills.ts
export const SKILLS = {
  GRADE_DISSERTATIVE: "001",
  GRADE_OBJECTIVE:    "002",
  PERSONALIZED_FEEDBACK: "003",
  PLAGIARISM_CHECK:   "004",
  INGEST_DOCS:        "005",
  CLASS_SUMMARY:      "006",
  EXTRACT_WORK:       "007",
} as const;

export type SkillId = typeof SKILLS[keyof typeof SKILLS];

// Usar uma skill
import { runSkill } from "@/lib/skill-runner";

const result = await runSkill(SKILLS.GRADE_DISSERTATIVE, {
  student_name: "Ana Souza",
  subject: "Cálculo I",
  student_text: "...",
  rag_context: "...",
});
```

---

## Ordem de Execução Recomendada

```
Upload do trabalho
       ↓
  SKILL 007 — Extração Estruturada
       ↓
  SKILL 004 — Checar Plágio (paralelo)
       ↓
  SKILL 001 ou 002 — Correção
       ↓
  SKILL 003 — Feedback Personalizado
       ↓
  SKILL 006 — Relatório da Turma (quando todos corrigidos)
```
