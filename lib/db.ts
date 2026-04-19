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
  students:        [{ id: 's1', name: 'Ana Souza', email: 'ana@example.com', turma: 'Turma A' }],
  activities:      [{ id: 'a1', subjectId: '1', title: 'P1 - Derivadas', weight: 1, description: '', applicationDate: '' }],
  implementacoes:  [],
  submissions:     [],
  skills:          [],
  configs:         { system_name: 'Aval.IA', primary_color: '#6366f1' },
  batch_state:     null,
};

let initPromise: Promise<void> | null = null;
async function initPostgres() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await sql`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, name TEXT, code TEXT, syllabus TEXT, closed BOOLEAN DEFAULT FALSE)`;
      try { await sql`ALTER TABLE subjects ADD COLUMN closed BOOLEAN DEFAULT FALSE`; } catch(e){}
      await sql`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT, email TEXT, turma TEXT, subject_ids TEXT)`;
      try { await sql`ALTER TABLE students ADD COLUMN subject_ids TEXT`; } catch(e){}
      await sql`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, subject_id TEXT, title TEXT, weight FLOAT, description TEXT, skill_id TEXT, application_date TEXT)`;
      try { await sql`ALTER TABLE activities ADD COLUMN skill_id TEXT`; } catch(e){}
      try { await sql`ALTER TABLE activities ADD COLUMN application_date TEXT`; } catch(e){}
      try { await sql`ALTER TABLE activities ADD COLUMN type TEXT`; } catch(e){}
      await sql`CREATE TABLE IF NOT EXISTS implementacoes (id TEXT PRIMARY KEY, title TEXT, description TEXT, status TEXT, priority TEXT, created_at TEXT, category TEXT, image_url TEXT)`;
      try { await sql`ALTER TABLE implementacoes ADD COLUMN category TEXT`; } catch(e){}
      try { await sql`ALTER TABLE implementacoes ADD COLUMN image_url TEXT`; } catch(e){}
      await sql`CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, student_name TEXT, subject TEXT, status TEXT, grade FLOAT, feedback TEXT, source TEXT, submitted_at TEXT, audit_notes TEXT)`;
      try { await sql`ALTER TABLE submissions ADD COLUMN audit_notes TEXT`; } catch(e){}
      await sql`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, description TEXT, prompt_template TEXT, model TEXT, response_type TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS configs (id TEXT PRIMARY KEY, data TEXT)`;
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
    turmas:         [], 
    implementacoes: stored.implementacoes ?? [],
    configs:        stored.configs        ?? INITIAL_DB.configs,
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
  updateSubject: async (id: string, name: string, code: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE subjects SET name = ${name}, code = ${code} WHERE id = ${id}`;
      return { id, name, code };
    }
    const data = readDB();
    const sub = data.subjects.find((s: any) => s.id === id);
    if (sub) { sub.name = name; sub.code = code; }
    saveDB(data);
    return { id, name, code };
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
  updateSubjectClosed: async (id: string, closed: boolean, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE subjects SET closed = ${closed} WHERE id = ${id}`;
      return { id, closed };
    }
    const data = readDB();
    const sub = data.subjects.find((s: any) => s.id === id);
    if (sub) sub.closed = closed;
    saveDB(data);
    return { id, closed };
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
      return rows.map(r => ({ ...r, subjectIds: r.subject_ids ? JSON.parse(r.subject_ids) : [] }));
    }
    const data = readDB().students || [];
    return data.map((s: any) => ({ ...s, subjectIds: s.subjectIds || [] }));
  },
  addStudent: async (name: string, email: string, turma: string = '', mode: 'local' | 'remote' = 'local') => {
    const id = 's' + Date.now().toString();
    const subjectIds: string[] = [];
    if (mode === 'remote') {
      await sql`INSERT INTO students (id, name, email, turma, subject_ids) VALUES (${id}, ${name}, ${email}, ${turma}, ${JSON.stringify(subjectIds)})`;
      return { id, name, email, turma, subjectIds };
    }
    const data = readDB();
    const newStudent = { id, name, email, turma, subjectIds };
    data.students.push(newStudent);
    saveDB(data);
    return newStudent;
  },
  updateStudent: async (id: string, name: string, email: string, turma: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE students SET name = ${name}, email = ${email}, turma = ${turma} WHERE id = ${id}`;
      return { id, name, email, turma };
    }
    const data = readDB();
    const stu = data.students.find((s: any) => s.id === id);
    if (stu) { stu.name = name; stu.email = email; stu.turma = turma; }
    saveDB(data);
    return stu || { id, name, email, turma };
  },
  updateStudentSubjects: async (id: string, subjectIds: string[], mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const jsonStr = JSON.stringify(subjectIds);
      await sql`UPDATE students SET subject_ids = ${jsonStr} WHERE id = ${id}`;
      return { id, subjectIds };
    }
    const data = readDB();
    const stu = data.students.find((s: any) => s.id === id);
    if (stu) { stu.subjectIds = subjectIds; }
    saveDB(data);
    return stu;
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
      console.log('☁️ Buscando atividades (Remote)');
      await initPostgres();
      const { rows } = await sql`SELECT * FROM activities`;
      return rows.map((r: any) => ({ 
        ...r, 
        subjectId: r.subject_id, 
        skillId: r.skill_id,
        applicationDate: r.application_date 
      }));
    }
    return readDB().activities;
  },
  addActivity: async (subjectId: string, title: string, weight: number, description: string, skillId: string = '', applicationDate: string = '', type: 'atividade' | 'prova' = 'atividade', mode: 'local' | 'remote' = 'local') => {
    const id = 'a' + Date.now().toString();
    if (mode === 'remote') {
      await sql`INSERT INTO activities (id, subject_id, title, weight, description, skill_id, application_date, type) VALUES (${id}, ${subjectId}, ${title}, ${weight}, ${description}, ${skillId}, ${applicationDate}, ${type})`;
      return { id, subjectId, title, weight, description, skillId, applicationDate, type };
    }
    const data = readDB();
    const newAct = { id, subjectId, title, weight, description, skillId, applicationDate, type };
    data.activities.push(newAct);
    saveDB(data);
    return newAct;
  },
  updateActivity: async (id: string, subjectId: string, title: string, weight: number, description: string, skillId: string = '', applicationDate: string = '', type: 'atividade' | 'prova' = 'atividade', mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE activities SET subject_id = ${subjectId}, title = ${title}, weight = ${weight}, description = ${description}, skill_id = ${skillId}, application_date = ${applicationDate}, type = ${type} WHERE id = ${id}`;
      return { id, subjectId, title, weight, description, skillId, applicationDate, type };
    }
    const data = readDB();
    const act = data.activities.find((a: any) => a.id === id);
    if (act) { 
      act.subjectId = subjectId; 
      act.title = title; 
      act.weight = weight; 
      act.description = description; 
      act.skillId = skillId; 
      act.applicationDate = applicationDate;
      act.type = type;
    }
    saveDB(data);
    return { id, subjectId, title, weight, description, skillId, applicationDate, type };
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

  // ── TURMAS (REMOVED) ────────────────────────────────────────────────────


  // ── IMPLEMENTAÇÕES ──────────────────────────────────────────────────────
  getImplementacoes: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await initPostgres();
      const { rows } = await sql`SELECT * FROM implementacoes ORDER BY created_at DESC`;
      return rows.map((r: any) => ({ ...r, createdAt: r.created_at }));
    }
    return readDB().implementacoes;
  },
  addImplementacao: async (title: string, description: string, priority: string, category: string = '', imageUrl: string = '', mode: 'local' | 'remote' = 'local') => {
    const id = 'imp' + Date.now().toString();
    const createdAt = new Date().toISOString().split('T')[0];
    const status = 'backlog';
    if (mode === 'remote') {
      await sql`INSERT INTO implementacoes (id, title, description, status, priority, created_at, category, image_url) VALUES (${id}, ${title}, ${description}, ${status}, ${priority}, ${createdAt}, ${category}, ${imageUrl})`;
      return { id, title, description, status, priority, createdAt, category, imageUrl };
    }
    const data = readDB();
    const newImp = { id, title, description, status, priority, createdAt, category, imageUrl };
    data.implementacoes.push(newImp);
    saveDB(data);
    return newImp;
  },
  updateImplementacao: async (id: string, title: string, description: string, priority: string, category: string, imageUrl: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE implementacoes SET title = ${title}, description = ${description}, priority = ${priority}, category = ${category}, image_url = ${imageUrl} WHERE id = ${id}`;
      return { id, title, description, priority, category, imageUrl };
    }
    const data = readDB();
    const imp = data.implementacoes.find((i: any) => i.id === id);
    if (imp) { imp.title = title; imp.description = description; imp.priority = priority; imp.category = category; imp.imageUrl = imageUrl; }
    saveDB(data);
    return { id, title, description, priority, category, imageUrl };
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
  updateSubmission: async (id: string, updates: any, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const { status, auditNotes, feedback, grade } = updates;
      // Convert to snake_case for Postgres if needed, but the current schema uses student_name, submitted_at.
      // Wait, let's check schema again.
      // status, grade, feedback are columns.
      // auditNotes is NOT in schema!
      await sql`UPDATE submissions SET 
                status = COALESCE(${status || null}, status),
                grade = COALESCE(${grade || null}, grade),
                feedback = COALESCE(${feedback || null}, feedback),
                audit_notes = COALESCE(${auditNotes || null}, audit_notes)
                WHERE id = ${id}`;
      return { id, ...updates };
    }
    const data = readDB();
    const sub = data.submissions.find((s: any) => s.id === id);
    if (sub) {
      if (updates.status !== undefined) sub.status = updates.status;
      if (updates.auditNotes !== undefined) sub.auditNotes = updates.auditNotes;
      if (updates.grade !== undefined) sub.grade = updates.grade;
      if (updates.feedback !== undefined) sub.feedback = updates.feedback;
    }
    saveDB(data);
    return sub || { id, ...updates };
  },

  // ── CONFIGS ─────────────────────────────────────────────────────────────
  getConfigs: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await initPostgres();
      const { rows } = await sql`SELECT data FROM configs WHERE id = 'main' LIMIT 1`;
      return rows[0] ? JSON.parse(rows[0].data) : INITIAL_DB.configs;
    }
    return readDB().configs;
  },
  saveConfigs: async (configs: any, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const dataStr = JSON.stringify(configs);
      await sql`INSERT INTO configs (id, data) VALUES ('main', ${dataStr}) ON CONFLICT (id) DO UPDATE SET data = ${dataStr}`;
      return configs;
    }
    const data = readDB();
    data.configs = configs;
    saveDB(data);
    return configs;
  },
  // ── BATCH STATE ────────────────────────────────────────────────────────
  getBatchState: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
       await initPostgres();
       const { rows } = await sql`SELECT data FROM configs WHERE id = 'batch' LIMIT 1`;
       return rows[0] ? JSON.parse(rows[0].data) : null;
    }
    return readDB().batch_state || null;
  },
  saveBatchState: async (state: any, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      const dataStr = JSON.stringify(state);
      await sql`INSERT INTO configs (id, data) VALUES ('batch', ${dataStr}) ON CONFLICT (id) DO UPDATE SET data = ${dataStr}`;
      return state;
    }
    const data = readDB();
    data.batch_state = state;
    saveDB(data);
    return state;
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
  // ── SKILLS ─────────────────────────────────────────────────────────────
  getSkills: async (mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await initPostgres();
      const { rows } = await sql`SELECT * FROM skills`;
      return rows.map(r => ({ ...r, promptTemplate: r.prompt_template, responseType: r.response_type }));
    }
    return readDB().skills || [];
  },
  addSkill: async (name: string, description: string, promptTemplate: string, model: string, responseType: string, mode: 'local' | 'remote' = 'local') => {
    const id = 'sk' + Date.now().toString();
    if (mode === 'remote') {
      await sql`INSERT INTO skills (id, name, description, prompt_template, model, response_type) VALUES (${id}, ${name}, ${description}, ${promptTemplate}, ${model}, ${responseType})`;
      return { id, name, description, promptTemplate, model, responseType };
    }
    const data = readDB();
    const newSkill = { id, name, description, promptTemplate, model, responseType };
    if (!data.skills) data.skills = [];
    data.skills.push(newSkill);
    saveDB(data);
    return newSkill;
  },
  updateSkill: async (id: string, name: string, description: string, promptTemplate: string, model: string, responseType: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') {
      await sql`UPDATE skills SET name = ${name}, description = ${description}, prompt_template = ${promptTemplate}, model = ${model}, response_type = ${responseType} WHERE id = ${id}`;
      return { id, name, description, promptTemplate, model, responseType };
    }
    const data = readDB();
    const skill = data.skills.find((s: any) => s.id === id);
    if (skill) {
      skill.name = name;
      skill.description = description;
      skill.promptTemplate = promptTemplate;
      skill.model = model;
      skill.responseType = responseType;
    }
    saveDB(data);
    return skill || { id, name, description, promptTemplate, model, responseType };
  },
  deleteSkill: async (id: string, mode: 'local' | 'remote' = 'local') => {
    if (mode === 'remote') { await sql`DELETE FROM skills WHERE id = ${id}`; return { id }; }
    const data = readDB();
    data.skills = data.skills.filter((s: any) => s.id !== id);
    saveDB(data); return { id };
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
  syncCloudToLocal: async (fullData: any) => {
    saveDB(fullData);
    return { success: true };
  },
};
