import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chroma = new ChromaClient({ path: process.env.CHROMA_URL || "http://localhost:8000" });

// Chunk text into ~500 token pieces
function chunkText(text: string, chunkSize = 1500): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const subject = formData.get("subject") as string;
    const docName = formData.get("docName") as string;
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;

    if (!subject || !docName) {
      return NextResponse.json({ error: "subject and docName are required" }, { status: 400 });
    }

    // Extract text
    let content = "";
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      content = data.text;
    } else if (text) {
      content = text;
    } else {
      return NextResponse.json({ error: "Provide file or text" }, { status: 400 });
    }

    // Chunk the document
    const chunks = chunkText(content);

    // Generate embeddings with Gemini
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const result = await embeddingModel.embedContent(chunk);
      embeddings.push(result.embedding.values);
    }

    // Store in ChromaDB
    const collectionName = `subject_${subject.replace(/\s/g, "_").toLowerCase()}`;
    const collection = await chroma.getOrCreateCollection({ name: collectionName });

    const ids = chunks.map((_, i) => `${docName}_chunk_${i}_${Date.now()}`);
    const metadatas = chunks.map((_, i) => ({ subject, docName, chunkIndex: i }));

    await collection.add({ ids, embeddings, documents: chunks, metadatas });

    return NextResponse.json({
      success: true,
      collection: collectionName,
      chunksAdded: chunks.length,
      docName,
      subject,
    });

  } catch (error: any) {
    console.error("Ingest error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // List all collections (subjects) with document counts
  try {
    const collections = await chroma.listCollections();
    const details = await Promise.all(
      collections.map(async (col) => {
        const c = await chroma.getCollection({ name: col.name });
        const count = await c.count();
        return { name: col.name, count };
      })
    );
    return NextResponse.json({ collections: details });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
