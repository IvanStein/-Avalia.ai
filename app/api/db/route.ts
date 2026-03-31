import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  return NextResponse.json({
    subjects: db.getSubjects(),
    students: db.getStudents(),
    activities: db.getActivities(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { entity, data } = await req.json();
    let result;

    switch (entity) {
      case 'subject':
        result = db.addSubject(data.name, data.code);
        break;
      case 'student':
        result = db.addStudent(data.name, data.email);
        break;
      case 'activity':
        result = db.addActivity(data.subjectId, data.title, data.weight);
        break;
      default:
        return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
