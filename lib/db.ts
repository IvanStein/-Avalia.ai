import fs from 'fs';
import path from 'path';
import { sql } from '@vercel/postgres';

const DB_FILE = path.join(process.cwd(), 'mnt/user-data/db.json');

// Ensure local directory exists
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const INITIAL_DB = {
  subjects: [{ id: '1', name: 'Cálculo I', code: 'MAT101' }],
  students: [{ id: 's1', name: 'Ana Souza', email: 'ana@example.com' }],
  activities: [{ id: 'a1', subjectId: '1', title: 'P1 - Derivadas', weight: 1 }],
  submissions: []
};

async function initPostgres() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, name TEXT, code TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT, email TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, subject_id TEXT, title TEXT, weight FLOAT)`;
    await sql`CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, student_name TEXT, subject TEXT, status TEXT, grade FLOAT, feedback TEXT, source TEXT, submitted_at TEXT)`;
  } catch (e) {
    console.error("Erro ao inicializar Postgres:", e);
  }
}

function readDB() {
  console.log("📂 Lendo de: db.json (Local)");
  if (!fs.existsSync(DB_FILE)) { saveDB(INITIAL_DB); return INITIAL_DB; }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(data: any) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

export const db = {
  getSubjects: async (mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      console.log("☁️ Acessando: Supabase (Remote)");
      await initPostgres();
      const { rows } = await sql`SELECT * FROM subjects`;
      return rows;
    }
    return readDB().subjects;
  },
  addSubject: async (name: string, code: string, mode: "local" | "remote" = "local") => {
    const id = Date.now().toString();
    if (mode === "remote") {
      console.log("☁️ Gravando em: Supabase (Remote)");
      await sql`INSERT INTO subjects (id, name, code) VALUES (${id}, ${name}, ${code})`;
      return { id, name, code };
    }
    const data = readDB();
    const newSub = { id, name, code };
    data.subjects.push(newSub);
    saveDB(data);
    return newSub;
  },
  
  getStudents: async (mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      console.log("☁️ Acessando: Supabase (Remote)");
      const { rows } = await sql`SELECT * FROM students`;
      return rows;
    }
    return readDB().students;
  },
  addStudent: async (name: string, email: string, mode: "local" | "remote" = "local") => {
    const id = 's' + Date.now().toString();
    if (mode === "remote") {
      console.log("☁️ Gravando em: Supabase (Remote)");
      await sql`INSERT INTO students (id, name, email) VALUES (${id}, ${name}, ${email})`;
      return { id, name, email };
    }
    const data = readDB();
    const newStudent = { id, name, email };
    data.students.push(newStudent);
    saveDB(data);
    return newStudent;
  },

  getActivities: async (mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      console.log("☁️ Acessando: Supabase (Remote)");
      const { rows } = await sql`SELECT * FROM activities`;
      return rows.map(r => ({ ...r, subjectId: r.subject_id }));
    }
    return readDB().activities;
  },
  addActivity: async (subjectId: string, title: string, weight: number, mode: "local" | "remote" = "local") => {
    const id = 'a' + Date.now().toString();
    if (mode === "remote") {
      console.log("☁️ Gravando em: Supabase (Remote)");
      await sql`INSERT INTO activities (id, subject_id, title, weight) VALUES (${id}, ${subjectId}, ${title}, ${weight})`;
      return { id, subjectId, title, weight };
    }
    const data = readDB();
    const newAct = { id, subjectId, title, weight };
    data.activities.push(newAct);
    saveDB(data);
    return newAct;
  },

  // Context Retrieval
  getSubjectByName: async (name: string, mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      const { rows } = await sql`SELECT * FROM subjects WHERE name = ${name} LIMIT 1`;
      return rows[0];
    }
    return readDB().subjects.find((s: any) => s.name === name);
  },
  getActivityByTitle: async (title: string, mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      const { rows } = await sql`SELECT * FROM activities WHERE title = ${title} LIMIT 1`;
      return rows[0];
    }
    return readDB().activities.find((a: any) => a.title === title);
  },

  // Submissions
  getSubmissions: async (mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      const { rows } = await sql`SELECT * FROM submissions ORDER BY submitted_at DESC`;
      return rows.map(r => ({ ...r, studentName: r.student_name, submittedAt: r.submitted_at }));
    }
    return readDB().submissions;
  },
  addSubmission: async (submission: any, mode: "local" | "remote" = "local") => {
    const id = 'sub' + Date.now().toString();
    if (mode === "remote") {
      await sql`INSERT INTO submissions (id, student_name, subject, status, grade, feedback, source, submitted_at) 
                 VALUES (${id}, ${submission.studentName}, ${submission.subject}, ${submission.status}, ${submission.grade}, ${submission.feedback}, ${submission.source}, ${submission.submittedAt})`;
      return { ...submission, id };
    }
    const data = readDB();
    const newSub = { ...submission, id };
    data.submissions.push(newSub);
    saveDB(data);
    return newSub;
  },

  // ── DELETE ──────────────────────────────────────────────────────────────
  deleteSubject: async (id: string, mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      await sql`DELETE FROM subjects WHERE id = ${id}`;
      return { id };
    }
    const data = readDB();
    data.subjects = data.subjects.filter((s: any) => s.id !== id);
    saveDB(data);
    return { id };
  },
  deleteStudent: async (id: string, mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      await sql`DELETE FROM students WHERE id = ${id}`;
      return { id };
    }
    const data = readDB();
    data.students = data.students.filter((s: any) => s.id !== id);
    saveDB(data);
    return { id };
  },
  deleteActivity: async (id: string, mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      await sql`DELETE FROM activities WHERE id = ${id}`;
      return { id };
    }
    const data = readDB();
    data.activities = data.activities.filter((a: any) => a.id !== id);
    saveDB(data);
    return { id };
  },
  deleteSubmission: async (id: string, mode: "local" | "remote" = "local") => {
    if (mode === "remote") {
      await sql`DELETE FROM submissions WHERE id = ${id}`;
      return { id };
    }
    const data = readDB();
    data.submissions = data.submissions.filter((s: any) => s.id !== id);
    saveDB(data);
    return { id };
  },
};
