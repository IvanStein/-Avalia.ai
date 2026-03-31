import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { runSkill } from "@/lib/skill-runner";
import { SKILLS } from "@/lib/skills";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const studentName = formData.get("studentName") as string;
    const subject = formData.get("subject") as string;
    const activityTitle = formData.get("activity") as string || "";
    const mode = (req.nextUrl.searchParams.get("mode") as "local" | "remote") || "local";
    const driveUrl = formData.get("driveUrl") as string | null;
    const file = formData.get("file") as File | null;

    // 1. Contexto Pedagógico — usa ementa em chunks + critérios da atividade
    const [subDetails, actDetails] = await Promise.all([
      db.getSubjectByName(subject, mode),
      db.getActivityByTitle(activityTitle, mode)
    ]);

    // Parse syllabus chunks (store as JSON array) — use first 3 chunks as context
    let syllabusContext = '';
    try {
      const raw = subDetails?.syllabus ?? '';
      const chunks: string[] = raw ? JSON.parse(raw) : [];
      syllabusContext = chunks.slice(0, 3).join('\n---\n');
    } catch { syllabusContext = subDetails?.syllabus ?? ''; }

    const pedagogicalContext = `
      Matéria: ${subDetails?.code || 'N/A'} — ${subDetails?.name || 'N/A'}
      Ementa (trechos):
      ${syllabusContext || 'Sem ementa cadastrada.'}

      Atividade: ${actDetails?.title || 'Dissertação Geral'}
      Critérios de Avaliação: ${(actDetails as any)?.description || 'Avaliar clareza, coesão e domínio técnico dos conceitos.'}
    `;

    // 2. Extração de Texto (Pilar 1)
    let studentText = "";
    if (file) {
      studentText = await extractTextFromPDF(file);
    } else if (driveUrl) {
      studentText = await fetchFromDrive(driveUrl);
    } else {
      return NextResponse.json({ error: "Nenhum arquivo ou URL do Drive fornecido" }, { status: 400 });
    }

    // 4. Executar Skill de Avaliação Dissertativa com Triple Context
    const parsed = await runSkill(SKILLS.GRADE_DISSERTATIVE, {
      student_name: studentName,
      subject,
      student_text: studentText,
      rag_context: pedagogicalContext,
    });

    // 5. Salvar no Banco (Persistência Automática)
    const newSubmission = await db.addSubmission({
      studentName,
      subject,
      status: "graded",
      grade: parsed.grade,
      feedback: parsed.feedback,
      source: file ? "pdf" : "drive",
      submittedAt: new Date().toISOString().split("T")[0]
    }, mode);

    return NextResponse.json(newSubmission);

  } catch (error: any) {
    console.error("Erro na avaliação AvalIA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function fetchFromDrive(url: string): Promise<string> {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("URL do Google Drive inválida");
  const fileId = match[1];
  const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const response = await fetch(exportUrl);
  if (!response.ok) throw new Error("Erro ao buscar no Drive. Verifique se o arquivo está público.");
  return await response.text();
}
