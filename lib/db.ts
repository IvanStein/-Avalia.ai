import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'mnt/user-data/db.json');

// Ensure the directory exists
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Initial state
const INITIAL_DB = {
  subjects: [
    { id: '1', name: 'Cálculo I', code: 'MAT101' },
    { id: '2', name: 'Física II', code: 'FIS201' }
  ],
  students: [
    { id: 's1', name: 'Ana Souza', email: 'ana@example.com' },
    { id: 's2', name: 'Bruno Lima', email: 'bruno@example.com' }
  ],
  activities: [
    { id: 'a1', subjectId: '1', title: 'P1 - Derivadas', weight: 1 },
    { id: 'a2', subjectId: '2', title: 'Lab 1 - Termodinâmica', weight: 0.5 }
  ],
  submissions: []
};

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    saveDB(INITIAL_DB);
    return INITIAL_DB;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  // Subjects
  getSubjects: () => readDB().subjects,
  addSubject: (name: string, code: string) => {
    const data = readDB();
    const newSub = { id: Date.now().toString(), name, code };
    data.subjects.push(newSub);
    saveDB(data);
    return newSub;
  },
  
  // Students
  getStudents: () => readDB().students,
  addStudent: (name: string, email: string) => {
    const data = readDB();
    const newStudent = { id: 's' + Date.now().toString(), name, email };
    data.students.push(newStudent);
    saveDB(data);
    return newStudent;
  },

  // Activities (Linked to Subject)
  getActivities: () => readDB().activities,
  addActivity: (subjectId: string, title: string, weight: number) => {
    const data = readDB();
    const newAct = { id: 'a' + Date.now().toString(), subjectId, title, weight };
    data.activities.push(newAct);
    saveDB(data);
    return newAct;
  }
};
