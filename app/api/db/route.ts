import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") as "local" | "remote" || "local";
  
  const [subjects, students, activities] = await Promise.all([
    db.getSubjects(mode),
    db.getStudents(mode),
    db.getActivities(mode),
  ]);

  return NextResponse.json({
    subjects,
    students,
    activities,
  });
}

export async function POST(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") as "local" | "remote" || "local";
  try {
    const { entity, data } = await req.json();
    let result;

    switch (entity) {
      case 'subject':
        result = await db.addSubject(data.name, data.code, mode);
        break;
      case 'student':
        result = await db.addStudent(data.name, data.email, mode);
        break;
      case 'activity':
        result = await db.addActivity(data.subjectId, data.title, data.weight, mode);
        break;
      default:
        return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
