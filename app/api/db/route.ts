import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") as "local" | "remote" || "local";

  const [subjects, students, activities, submissions] = await Promise.all([
    db.getSubjects(mode),
    db.getStudents(mode),
    db.getActivities(mode),
    db.getSubmissions(mode),
  ]);

  return NextResponse.json({ subjects, students, activities, submissions });
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
      case 'submission':
        result = await db.addSubmission(data, mode);
        break;
      default:
        return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") as "local" | "remote" || "local";
  try {
    const { entity, id } = await req.json();
    let result;

    switch (entity) {
      case 'subject':
        result = await db.deleteSubject(id, mode);
        break;
      case 'student':
        result = await db.deleteStudent(id, mode);
        break;
      case 'activity':
        result = await db.deleteActivity(id, mode);
        break;
      case 'submission':
        result = await db.deleteSubmission(id, mode);
        break;
      default:
        return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
