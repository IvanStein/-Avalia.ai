import { GoogleGenerativeAI } from "@google/generative-ai";
import { SKILLS, SkillId } from "./skills";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface SkillPrompts {
  [key: string]: {
    prompt: (params: any) => string;
    model: "gemini-1.5-pro" | "gemini-1.5-flash";
    responseType: "json" | "text";
  }
}

const PROMPTS: SkillPrompts = {
  [SKILLS.GRADE_DISSERTATIVE]: {
    model: "gemini-1.5-pro",
    responseType: "json",
    prompt: (p) => `
Você é um professor universitário experiente corrigindo um trabalho acadêmico.

## 1. Contexto Pedagógico
- Matéria: ${p.subject}
- Ementa da Matéria: ${p.syllabus || "Não fornecida"}
- Descritivo da Atividade: ${p.activity_description || "Não fornecido"}
- Critérios de Avaliação (Padrões definidos):
${p.rag_context}

## 2. Trabalho do Aluno
- Nome: ${p.student_name}
- Conteúdo:
${p.student_text}

## 3. Instruções de Correção:
- Avalie de 0 a 10 com uma casa decimal baseando-se rigorosamente no Contexto Pedagógico.
- Escreva EXATAMENTE 1 parágrafo denso e bem estruturado contendo: Um resumo do entregável, os pontos fortes e os pontos de melhoria. Seja objetivo, encorajador e específico.
- Avalie as métricas base.

Responda SOMENTE em JSON:
{
  "grade": <0.0 a 10.0>,
  "feedback": "<1 parágrafo unificado com resumo + pontos fortes + melhorias>",
  "criteria_scores": {
    "clareza": <0-10>,
    "profundidade": <0-10>,
    "coerencia": <0-10>,
    "conceitos": <0-10>
  }
}
    `.trim()
  },
  [SKILLS.GRADE_OBJECTIVE]: {
    model: "gemini-1.5-flash",
    responseType: "json",
    prompt: (p) => `
Você está corrigindo um questionário de múltipla escolha.

## Gabarito Oficial:
${p.answer_key}

## Respostas do Aluno (${p.student_name}):
${p.student_answers}

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
    `.trim()
  },
  [SKILLS.PERSONALIZED_FEEDBACK]: {
    model: "gemini-1.5-pro",
    responseType: "text",
    prompt: (p) => `
Você é um tutor educacional empático. Com base no histórico e na última correção,
gere um feedback personalizado e motivador para o aluno.

## Histórico do Aluno (${p.student_name}):
${p.student_history}

## Última Correção:
Matéria: ${p.subject}
Nota: ${p.grade}
Pontos fracos: ${p.improvements}

## Instruções:
- Tom encorajador e construtivo
- Compare com desempenho anterior (melhoria ou queda)
- Sugira recursos específicos para os pontos fracos
- Máximo 3 parágrafos

Responda em texto corrido em português, sem JSON.
    `.trim()
  },
  [SKILLS.EXTRACT_WORK]: {
    model: "gemini-1.5-flash",
    responseType: "json",
    prompt: (p) => `
Extraia as informações estruturadas do trabalho acadêmico abaixo.

## Trabalho:
${p.raw_text}

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
    `.trim()
  },
  [SKILLS.CLASS_SUMMARY]: {
    model: "gemini-1.5-pro",
    responseType: "json",
    prompt: (p) => `
Analise o desempenho geral da turma abaixo e gere um relatório para o professor.

## Dados da Turma:
Matéria: ${p.subject}
Total de alunos: ${p.total_students}
Notas: ${p.grades_list}
Média: ${p.average}
Desvio padrão: ${p.std_dev}

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
    `.trim()
  },
  [SKILLS.CRUD_AI]: {
    model: "gemini-1.5-flash",
    responseType: "json",
    prompt: (p) => `
Você é um assistente administrativo escolar. Converta o comando abaixo em uma operação de banco de dados.

## Entidades Existentes:
Materias: ${p.existing_subjects}
Alunos: ${p.existing_students}
Atividades: ${p.existing_activities}

## Comando do Usuário:
"${p.user_command}"

## Instruções:
1. Identifique a operação: "CREATE", "READ", "UPDATE" ou "DELETE".
2. Identifique a entidade: "student", "subject" ou "activity".
3. Resolva chaves estrangeiras: se o usuário disser "na matéria Cálculo", procure o ID correspondente.
4. Validação: se faltar dados obrigatórios (ex: nome do aluno), retorne um erro em "error".

Responda SOMENTE em JSON:
{
  "operation": "CREATE" | "READ" | "UPDATE" | "DELETE",
  "entity": "student" | "subject" | "activity",
  "data": { ... },
  "error": null | "mensagem explicativa"
}
    `.trim()
  },
  [SKILLS.GRADE_BATCH]: {
    model: "gemini-1.5-pro",
    responseType: "json",
    prompt: (p) => `
Você é um professor universitário sênior responsável por corrigir um lote de trabalhos acadêmicos simultaneamente.

## 1. Contexto Pedagógico (Aplicável a todos os trabalhos)
- Matéria: ${p.subject}
- Ementa da Matéria: ${p.syllabus || "Não fornecida"}
- Descritivo da Atividade: ${p.activity_description || "Não fornecido"}
- Critérios de Avaliação (Padrões definidos):
${p.rag_context}

## 2. Trabalhos dos Alunos
Abaixo está uma lista (JSON) contendo o nome do aluno e seu respectivo trabalho:
${JSON.stringify(p.students_works)}

## 3. Instruções de Correção
Para CADA aluno, analise o trabalho com base no Contexto Pedagógico e retorne a correção.
- Dê uma nota final (0.0 a 10.0).
- Escreva EXATAMENTE 1 parágrafo denso contendo: Um breve resumo do que o aluno entregou, os pontos fortes do trabalho e onde ele precisa melhorar. Seja objetivo mas encorajador.

Retorne SOMENTE um JSON válido com a seguinte estrutura:
{
  "corrections": [
    {
      "student_name": "Nome do Aluno",
      "grade": <Nota de 0.0 a 10.0>,
      "feedback": "<1 parágrafo unificado contendo o resumo + pontos fortes + melhorias>"
    }
  ]
}
    `.trim()
  }
};

export async function runSkill(skillId: SkillId, params: any) {
  const config = PROMPTS[skillId];
  if (!config) throw new Error(`Skill ${skillId} not implemented`);

  const model = genAI.getGenerativeModel({ model: config.model });
  const prompt = config.prompt(params);

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  if (config.responseType === "json") {
    try {
      return JSON.parse(response.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("Failed to parse Skill JSON response:", response);
      throw new Error(`Invalid JSON from Skill ${skillId}`);
    }
  }

  return response;
}
