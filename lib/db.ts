import fs from 'fs';
import path from 'path';
import { sql } from '@vercel/postgres';

const DB_FILE = path.join(process.cwd(), 'mnt/user-data/db.json');
const isPostgres = !!process.env.POSTGRES_URL;

// Ensure local directory exists for JSON fallback
if (!isPostgres) {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const INITIAL_DB = {
  subjects: [{ id: '1', name: 'Cálculo I', code: 'MAT101' }],
  students: [{ id: 's1', name: 'Ana Souza', email: 'ana@example.com' }],
  activities: [{ id: 'a1', subjectId: '1', title: 'P1 - Derivadas', weight: 1 }],
  submissions: []
};

// Help in the cloud to create tables
async function initPostgres() {
  await sql`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, name TEXT, code TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT, email TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, subject_id TEXT, title TEXT, weight FLOAT)`;
  await sql`CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, student_name TEXT, subject TEXT, status TEXT, grade FLOAT, feedback TEXT, source TEXT, submitted_at TEXT)`;
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) { saveDB(INITIAL_DB); return INITIAL_DB; }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(data: any) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

export const db = {
  getSubjects: async () => {
    if (isPostgres) {
      await initPostgres();
      const { rows } = await sql`SELECT * FROM subjects`;
      return rows;
    }
    return readDB().subjects;
  },
  addSubject: async (name: string, code: string) => {
    const id = Date.now().toString();
    if (isPostgres) {
      await sql`INSERT INTO subjects (id, name, code) VALUES (${id}, ${name}, ${code})`;
      return { id, name, code };
    }
    const data = readDB();
    const newSub = { id, name, code };
    data.subjects.push(newSub);
    saveDB(data);
    return newSub;
  },
  
  getStudents: async () => {
    if (isPostgres) {
      const { rows } = await sql`SELECT * FROM students`;
      return rows;
    }
    return readDB().students;
  },
  addStudent: async (name: string, email: string) => {
    const id = 's' + Date.now().toString();
    if (isPostgres) {
      await sql`INSERT INTO students (id, name, email) VALUES (${id}, ${name}, ${email})`;
      return { id, name, email };
    }
    const data = readDB();
    const newStudent = { id, name, email };
    data.students.push(newStudent);
    saveDB(data);
    return newStudent;
  },

  getActivities: async () => {
    if (isPostgres) {
      const { rows } = await sql`SELECT * FROM activities`;
      return rows.map(r => ({ ...r, subjectId: r.subject_id }));
    }
    return readDB().activities;
  },
  addActivity: async (subjectId: string, title: string, weight: number) => {
    const id = 'a' + Date.now().toString();
    if (isPostgres) {
      await sql`INSERT INTO activities (id, subject_id, title, weight) VALUES (${id}, ${subjectId}, ${title}, ${weight})`;
      return { id, subjectId, title, weight };
    }
    const data = readDB();
    const newAct = { id, subjectId, title, weight };
    data.activities.push(newAct);
    saveDB(data);
    return newAct;
  }
};
