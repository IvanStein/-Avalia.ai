import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

let _pool: Pool | null = null;

function getPool() {
  if (_pool) return _pool;
  let connectionString = process.env.POSTGRES_URL;
  if (connectionString) {
    try {
      const url = new URL(connectionString);
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
    } catch (e) {}
  }
  _pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  return _pool;
}

async function sql(strings: TemplateStringsArray, ...values: any[]) {
  const query = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
  return await getPool().query(query, values);
}

const DB_FILE = path.join(process.cwd(), 'mnt/user-data/db.json');

const INITIAL_DB: any = {
  subjects:        [{ id: '1', name: 'Cálculo I', code: 'MAT101', syllabus: '' }],
  students:        [{ id: 's1', name: 'Ana Souza', email: 'ana@example.com' }],
  activities:      [{ id: 'a1', subjectId: '1', title: 'P1 - Derivadas', weight: 1, description: '' }],
  turmas:          [],
  implementacoes:  [],
  submissions:     [],
};

let initPromise: Promise<void> | null = null;
async function initPostgres() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await sql`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, name TEXT, code TEXT, syllabus TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT, email TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, subject_id TEXT, title TEXT, weight FLOAT, description TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS turmas (id TEXT PRIMARY KEY, name TEXT, student_ids TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS implementacoes (id TEXT PRIMARY KEY, title TEXT, description TEXT, status TEXT, priority TEXT, created_at TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, student_name TEXT, subject TEXT, status TEXT, grade FLOAT, feedback TEXT, source TEXT, submitted_at TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS error_logs (id TEXT PRIMARY KEY, message TEXT, details TEXT, mode TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      
      // Cleanup logs older than 24 hours
      await sql`DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '24 hours'`.catch(() => {});
    } catch (e) {
      console.error('Erro ao inicializar Postgres:', e);
    }
  })();
  return initPromise;
}

function readDB(): any {
  console.log('📂 Lendo de: db.json (Local)');
  if (!fs.existsSync(DB_FILE)) { saveDB(INITIAL_DB); return { ...INITIAL_DB, error_logs: [] }; }
  const stored = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  // Ensure new collections exist for old data files
  
  // Cleanup local logs older than 24 hours
  let logs = stored.error_logs || [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  logs = logs.filter((l: any) => new Date(l.created_at).getTime() > oneDayAgo);
  
  return {
    ...INITIAL_DB,
    ...stored,
    turmas:         stored.turmas         ?? [],
    implementacoes: stored.implementacoes ?? [],
    error_logs:     logs,
  };
}
function saveDB(data: any) { 
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); 
  } catch (e) {
    console.log('Skipping local file save (Vercel Read-Only env)');
  }
}

export const db = {
  // ── SUBJECTS ────────────────────────────────────────────────────────────
  getSubjects: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      console.log('☁️ Acessando: Supabase (Remote)');
      await initPostgres();
      const { rows } = await sql`SELECT * FROM subjects`;
      return rows;
    }
    return readDB().subjects;
  },
  addSubject: async (name: string, code: string, syllabus: string, mode: 'local' | 'remote' = 'local') => {
    const id = Date.now().toString();
    if (mode === 'remote') {
      await sql`INSERT INTO subjects (id, name, code, syllabus) VALUES (${id}, ${name}, ${code}, ${syllabus})`;
      return { id, name, code, syllabus };
    }
    const data = readDB();
    const newSub = { id, name, code, syllabus };
    data.subjects.push(newSub);
    saveDB(data);
    return newSub;
  },
  updateSubjectSyllabus: async (id: string, syllabus: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE subjects SET syllabus = ${syllabus} WHERE id = ${id}`;
      return { id, syllabus };
    }
    const data = readDB();
    const sub = data.subjects.find((s: any) => s.id === id);
    if (sub) sub.syllabus = syllabus;
    saveDB(data);
    return { id, syllabus };
  },
  deleteSubject: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM subjects WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.subjects = data.subjects.filter((s: any) => s.id !== id);
    saveDB(data); return { id };
  },
  getSubjectByName: async (name: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const { rows } = await sql`SELECT * FROM subjects WHERE name = ${name} LIMIT 1`;
      return rows[0];
    }
    return readDB().subjects.find((s: any) => s.name === name);
  },

  // ── STUDENTS ────────────────────────────────────────────────────────────
  getStudents: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const { rows } = await sql`SELECT * FROM students`;
      return rows;
    }
    return readDB().students;
  },
  addStudent: async (name: string, email: string, mode: 'local' | 'remote' = 'local') => {
    const id = 's' + Date.now().toString();
    if (mode === 'remote') {
      await sql`INSERT INTO students (id, name, email) VALUES (${id}, ${name}, ${email})`;
      return { id, name, email };
    }
    const data = readDB();
    const newStudent = { id, name, email };
    data.students.push(newStudent);
    saveDB(data);
    return newStudent;
  },
  deleteStudent: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM students WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.students = data.students.filter((s: any) => s.id !== id);
    saveDB(data); return { id };
  },

  // ── ACTIVITIES ──────────────────────────────────────────────────────────
  getActivities: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const { rows } = await sql`SELECT * FROM activities`;
      return rows.map((r: any) => ({ ...r, subjectId: r.subject_id }));
    }
    return readDB().activities;
  },
  addActivity: async (subjectId: string, title: string, weight: number, description: string, mode: 'local' | 'remote' = 'local') => {
    const id = 'a' + Date.now().toString();
    if (mode === 'remote') {
      await sql`INSERT INTO activities (id, subject_id, title, weight, description) VALUES (${id}, ${subjectId}, ${title}, ${weight}, ${description})`;
      return { id, subjectId, title, weight, description };
    }
    const data = readDB();
    const newAct = { id, subjectId, title, weight, description };
    data.activities.push(newAct);
    saveDB(data);
    return newAct;
  },
  deleteActivity: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM activities WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.activities = data.activities.filter((a: any) => a.id !== id);
    saveDB(data); return { id };
  },
  getActivityByTitle: async (title: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const { rows } = await sql`SELECT * FROM activities WHERE title = ${title} LIMIT 1`;
      return rows[0];
    }
    return readDB().activities.find((a: any) => a.title === title);
  },

  // ── TURMAS ──────────────────────────────────────────────────────────────
  getTurmas: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await initPostgres();
      const { rows } = await sql`SELECT * FROM turmas`;
      return rows.map((r: any) => ({ ...r, studentIds: JSON.parse(r.student_ids || '[]') }));
    }
    return readDB().turmas;
  },
  addTurma: async (name: string, studentIds: string[], mode: 'local' | 'remote' = 'local') => {
    const id = 't' + Date.now().toString();
    if (mode === 'remote') {
      const sids = JSON.stringify(studentIds);
      await sql`INSERT INTO turmas (id, name, student_ids) VALUES (${id}, ${name}, ${sids})`;
      return { id, name, studentIds };
    }
    const data = readDB();
    const newTurma = { id, name, studentIds };
    data.turmas.push(newTurma);
    saveDB(data);
    return newTurma;
  },
  updateTurma: async (id: string, name: string, studentIds: string[], mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const sids = JSON.stringify(studentIds);
      await sql`UPDATE turmas SET name = ${name}, student_ids = ${sids} WHERE id = ${id}`;
      return { id, name, studentIds };
    }
    const data = readDB();
    const turma = data.turmas.find((t: any) => t.id === id);
    if (turma) { turma.name = name; turma.studentIds = studentIds; }
    saveDB(data);
    return { id, name, studentIds };
  },
  deleteTurma: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM turmas WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.turmas = data.turmas.filter((t: any) => t.id !== id);
    saveDB(data); return { id };
  },

  // ── IMPLEMENTAÇÕES ──────────────────────────────────────────────────────
  getImplementacoes: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await initPostgres();
      const { rows } = await sql`SELECT * FROM implementacoes ORDER BY created_at DESC`;
      return rows.map((r: any) => ({ ...r, createdAt: r.created_at }));
    }
    return readDB().implementacoes;
  },
  addImplementacao: async (title: string, description: string, priority: string, mode: 'local' | 'remote' = 'local') => {
    const id = 'imp' + Date.now().toString();
    const createdAt = new Date().toISOString().split('T')[0];
    const status = 'backlog';
    if (mode === 'remote') {
      await sql`INSERT INTO implementacoes (id, title, description, status, priority, created_at) VALUES (${id}, ${title}, ${description}, ${status}, ${priority}, ${createdAt})`;
      return { id, title, description, status, priority, createdAt };
    }
    const data = readDB();
    const newImp = { id, title, description, status, priority, createdAt };
    data.implementacoes.push(newImp);
    saveDB(data);
    return newImp;
  },
  updateImplementacaoStatus: async (id: string, status: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE implementacoes SET status = ${status} WHERE id = ${id}`;
      return { id, status };
    }
    const data = readDB();
    const imp = data.implementacoes.find((i: any) => i.id === id);
    if (imp) imp.status = status;
    saveDB(data);
    return { id, status };
  },
  deleteImplementacao: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM implementacoes WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.implementacoes = data.implementacoes.filter((i: any) => i.id !== id);
    saveDB(data); return { id };
  },

  // ── SUBMISSIONS ─────────────────────────────────────────────────────────
  getSubmissions: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const { rows } = await sql`SELECT * FROM submissions ORDER BY submitted_at DESC`;
      return rows.map((r: any) => ({ ...r, studentName: r.student_name, submittedAt: r.submitted_at }));
    }
    return readDB().submissions;
  },
  addSubmission: async (submission: any, mode: 'local' | 'remote' = 'local') => {
    const id = 'sub' + Date.now().toString();
    if (mode === 'remote') {
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
  deleteSubmission: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM submissions WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.submissions = data.submissions.filter((s: any) => s.id !== id);
    saveDB(data); return { id };
  },

  // ── ERROR LOGS ──────────────────────────────────────────────────────────
  getLogs: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await initPostgres();
      const { rows } = await sql`SELECT * FROM error_logs ORDER BY created_at DESC`;
      return rows;
    }
    return readDB().error_logs;
  },
  logError: async (message: string, details: string, mode: 'local' | 'remote' = 'local') => {
    const id = 'log' + Date.now().toString();
    const createdAt = new Date().toISOString();
    try {
      if (mode === 'remote') {
        await sql`INSERT INTO error_logs (id, message, details, mode, created_at) VALUES (${id}, ${message}, ${details}, 'remote', ${createdAt})`;
      } else {
        const data = readDB();
        data.error_logs.push({ id, message, details, mode: 'local', created_at: createdAt });
        saveDB(data);
      }
    } catch(e) {
      console.error('Falha ao gravar raw log:', e);
    }
  },
};
