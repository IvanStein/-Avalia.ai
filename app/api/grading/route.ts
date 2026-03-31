import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";
import { runSkill } from "@/lib/skill-runner";
import { SKILLS } from "@/lib/skills";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chroma = new ChromaClient({ path: process.env.CHROMA_URL || "http://localhost:8000" });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const studentName = formData.get("studentName") as string;
    const subject = formData.get("subject") as string;
    const driveUrl = formData.get("driveUrl") as string | null;
    const file = formData.get("file") as File | null;

    // 1. Extrair texto (Poderia usar SKILL.EXTRACT_WORK futuramente para metadados)
    let studentText = "";
    if (file) {
      studentText = await extractTextFromPDF(file);
    } else if (driveUrl) {
      studentText = await fetchFromDrive(driveUrl);
    } else {
      return NextResponse.json({ error: "Nenhum arquivo ou URL do Drive fornecido" }, { status: 400 });
    }

    // 2. RAG: Buscar referências no ChromaDB (Opcional)
    let referenceContext = "Nenhum material de referência disponível (ChromaDB offline).";
    try {
      const collection = await chroma.getOrCreateCollection({ name: `subject_${subject.replace(/\s/g, "_").toLowerCase()}` });
      const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
      
      const embeddingResult = await embeddingModel.embedContent(studentText.slice(0, 2000));
      const queryEmbedding = embeddingResult.embedding.values;

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
      });

      if (results.documents[0]?.length > 0) {
        referenceContext = results.documents[0].join("\n\n");
      }
    } catch (e) {
      console.warn("ChromaDB connection failed, proceeding without RAG context.");
    }

    // 3. Executar Skill de Avaliação Dissertativa
    const parsed = await runSkill(SKILLS.GRADE_DISSERTATIVE, {
      student_name: studentName,
      subject,
      student_text: studentText,
      rag_context: referenceContext,
    });

    return NextResponse.json({
      studentName,
      subject,
      grade: parsed.grade,
      feedback: parsed.feedback,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      criteria_scores: parsed.criteria_scores,
      gradedAt: new Date().toISOString(),
    });

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
