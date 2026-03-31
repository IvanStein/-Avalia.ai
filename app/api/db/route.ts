import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mode = (req.nextUrl.searchParams.get('mode') as 'local' | 'remote') || 'local';

  try {
    const [subjects, students, activities, implementacoes, submissions, configs] = await Promise.all([
      db.getSubjects(mode),
      db.getStudents(mode),
      db.getActivities(mode),
      db.getImplementacoes(mode),
      db.getSubmissions(mode),
      db.getConfigs(mode),
    ]);

    return NextResponse.json({ subjects, students, activities, turmas: [], implementacoes, submissions, configs });
  } catch (err: any) {
    console.error('API GET DB Error:', err);
    await db.logError(err?.message || 'Erro Desconhecido no GET Inicial', JSON.stringify({ stack: err?.stack, action: 'GET' }), mode);
    return NextResponse.json({ error: err?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const mode = (req.nextUrl.searchParams.get('mode') as 'local' | 'remote') || 'local';
  try {
    const { entity, data } = await req.json();
    let result;

    switch (entity) {
      case 'subject':
        result = await db.addSubject(data.name, data.code, data.syllabus || '', mode);
        break;
      case 'subject-update':
        result = await db.updateSubject(data.id, data.name, data.code, mode);
        break;
      case 'subject-syllabus':
        result = await db.updateSubjectSyllabus(data.id, data.syllabus, mode);
        break;
      case 'subject-closed':
        result = await db.updateSubjectClosed(data.id, data.closed, mode);
        break;
      case 'student':
        result = await db.addStudent(data.name, data.email, data.turma || '', mode);
        break;
      case 'student-update':
        result = await db.updateStudent(data.id, data.name, data.email, data.turma || '', mode);
        break;
      case 'student-subjects':
        result = await db.updateStudentSubjects(data.id, data.subjectIds, mode);
        break;
      case 'activity':
        result = await db.addActivity(data.subjectId, data.title, data.weight, data.description || '', mode);
        break;
      case 'activity-update':
        result = await db.updateActivity(data.id, data.subjectId, data.title, data.weight, data.description || '', mode);
        break;
      case 'implementacao':
        result = await db.addImplementacao(data.title, data.description, data.priority || 'media', data.category || '', data.imageUrl || '', mode);
        break;
      case 'implementacao-update':
        result = await db.updateImplementacao(data.id, data.title, data.description, data.priority, data.category || '', data.imageUrl || '', mode);
        break;
      case 'implementacao-status':
        result = await db.updateImplementacaoStatus(data.id, data.status, mode);
        break;
      case 'submission':
        result = await db.addSubmission(data, mode);
        break;
      case 'configs':
        result = await db.saveConfigs(data, mode);
        break;
      default:
        return NextResponse.json({ error: 'Entidade inválida' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    await db.logError(error?.message || 'Erro Desconhecido no POST', JSON.stringify({ stack: error?.stack, action: 'POST' }), mode);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const mode = (req.nextUrl.searchParams.get('mode') as 'local' | 'remote') || 'local';
  try {
    const { entity, id } = await req.json();
    let result;

    switch (entity) {
      case 'subject':     result = await db.deleteSubject(id, mode);       break;
      case 'student':     result = await db.deleteStudent(id, mode);       break;
      case 'activity':    result = await db.deleteActivity(id, mode);      break;
      case 'implementacao': result = await db.deleteImplementacao(id, mode); break;
      case 'submission':  result = await db.deleteSubmission(id, mode);    break;
      default:
        return NextResponse.json({ error: 'Entidade inválida' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    await db.logError(error?.message || 'Erro Desconhecido no DELETE', JSON.stringify({ stack: error?.stack, action: 'DELETE' }), mode);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
