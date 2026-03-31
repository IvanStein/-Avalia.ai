import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Split text into overlapping chunks */
function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const subjectId = formData.get('subjectId') as string;
    const file = formData.get('file') as File | null;
    const mode = (req.nextUrl.searchParams.get('mode') as 'local' | 'remote') || 'local';

    if (!subjectId || !file) {
      return NextResponse.json({ error: 'subjectId e arquivo PDF são obrigatórios' }, { status: 400 });
    }

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const { text } = await pdfParse(buffer);

    // Chunk the text
    const chunks = chunkText(text.trim());
    const syllabusJson = JSON.stringify(chunks);

    // Persist to DB
    await db.updateSubjectSyllabus(subjectId, syllabusJson, mode);

    return NextResponse.json({
      subjectId,
      chunks: chunks.length,
      totalChars: text.length,
      preview: chunks[0]?.slice(0, 200) ?? '',
    });
  } catch (error: any) {
    console.error('Erro ao importar ementa:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
