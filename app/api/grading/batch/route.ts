import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { runSkill } from "@/lib/skill-runner";
import { SKILLS } from "@/lib/skills";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface BatchItem {
  studentName: string;
  subject: string;
  activity?: string;
  file?: File;
  driveUrl?: string;
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

async function gradeOne(
  item: BatchItem,
  mode: "local" | "remote"
): Promise<{ ok: true; submission: any } | { ok: false; studentName: string; error: string }> {
  try {
    const [subDetails, actDetails] = await Promise.all([
      db.getSubjectByName(item.subject, mode),
      item.activity ? db.getActivityByTitle(item.activity, mode) : Promise.resolve(null),
    ]);

    const pedagogicalContext = `
    ## 1. Contexto Pedagógico
- Matéria: ${item.subject}
- Ementa da Matéria: ${subDetails?.syllabus || "Não fornecida"}
- Descritivo da Atividade (CONCENTRE-SE AQUI): ${(actDetails as any)?.description || "Não fornecido"}

## 2. Padrões Adicionais de Avaliação (RAG):
Avaliar clareza, coesão e domínio técnico.
    `;

    let studentText = "";
    if (item.file) {
      studentText = await extractTextFromPDF(item.file);
    } else if (item.driveUrl) {
      studentText = await fetchFromDrive(item.driveUrl);
    } else {
      throw new Error("Nenhum arquivo ou URL do Drive fornecido");
    }

    const parsed = await runSkill(SKILLS.GRADE_DISSERTATIVE, {
      student_name: item.studentName,
      subject: item.subject,
      syllabus: subDetails?.syllabus,
      activity_description: (actDetails as any)?.description,
      student_text: studentText,
      rag_context: pedagogicalContext,
    });

    // CRITICAL: Prefix feedback with activity title so dashboard grouping works
    const activityPrefix = item.activity ? `Atividade: ${item.activity}\n` : '';
    const newSubmission = await db.addSubmission(
      {
        studentName: item.studentName,
        subject: item.subject,
        status: "graded",
        grade: parsed.grade,
        feedback: activityPrefix + parsed.feedback,
        source: item.file ? "pdf" : "drive",
        submittedAt: new Date().toISOString().split("T")[0],
      },
      mode
    );

    return { ok: true, submission: newSubmission };
  } catch (err: any) {
    return { ok: false, studentName: item.studentName, error: err.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const mode = (req.nextUrl.searchParams.get("mode") as "local" | "remote") || "local";
    const formData = await req.formData();

    // Parse batch items from formData
    // Expected form fields:
    //   items[0][studentName], items[0][subject], items[0][activity], items[0][file]
    //   items[1][studentName], ...
    const itemMap: Record<number, Partial<BatchItem & { file: File }>> = {};

    // Use Array.from to avoid TypeScript FormDataIterator downlevelIteration error
    for (const [key, value] of Array.from(formData.entries())) {
      const match = key.match(/^items\[(\d+)\]\[(\w+)\]$/);
      if (!match) continue;
      const idx = parseInt(match[1]);
      const field = match[2] as keyof BatchItem;
      if (!itemMap[idx]) itemMap[idx] = {};
      (itemMap[idx] as any)[field] = value;
    }

    const items: BatchItem[] = Object.values(itemMap) as BatchItem[];

    if (items.length === 0) {
      return NextResponse.json({ error: "Nenhum item no lote" }, { status: 400 });
    }

    // Process concurrently (capped at 5 in parallel to avoid rate limits)
    const CONCURRENCY = 5;
    const results: any[] = [];

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map((item) => gradeOne(item, mode)));
      results.push(...chunkResults);
    }

    const succeeded = results.filter((r) => r.ok).map((r) => r.submission);
    const failed = results.filter((r) => !r.ok).map((r) => ({ studentName: r.studentName, error: r.error }));

    return NextResponse.json({
      total: items.length,
      succeeded: succeeded.length,
      failed: failed.length,
      submissions: succeeded,
      errors: failed,
    });
  } catch (error: any) {
    console.error("Erro na correção em lote:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
