export interface Subject {
  id: string;
  name: string;
  code: string;
  syllabus?: string;
  closed?: boolean;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  ra?: string;
  turma?: string;
  subjectIds?: string[];
}

export interface Activity {
  id: string;
  subjectId: string;
  title: string;
  weight: number;
  description?: string;
  skillId?: string;
  applicationDate?: string;
}

export interface Submission {
  id: string;
  studentName: string;
  subject: string;
  grade: number;
  feedback?: string;
  submittedAt: string;
  status: 'pending' | 'graded' | 'audit_pending' | 'audited' | 'error';
  auditNotes?: string;
  source?: string; // Added for compatibility
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  model: string;
  responseType: 'text' | 'json';
}

export interface Implementacao {
  id: string;
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baixa';
  status: 'backlog' | 'validating' | 'approved' | 'done';
  category?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface BatchEntry {
  id: string;
  filename: string;
  file?: File;
  studentId: string;
  subjectId: string;
  matchScore: number;
  matchName: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  result?: Submission;
  error?: string;
}

export interface AppConfig {
  theme: 'light' | 'dark' | 'synthwave' | 'nord';
  primary_color: string;
  institution_name: string;
  institution?: string;
  professor?: string;
  pedagogical_style?: string;
  system_name?: string;
}

export type View = 'dashboard' | 'subjects' | 'students' | 'enrollment' | 'activities' | 'batch' | 'audit' | 'reports' | 'implementacoes' | 'settings' | 'skills' | 'manual' | 'canvas' | 'copy' | 'student-profile' | 'grade-entry';

export interface DBData {
  subjects: Subject[];
  students: Student[];
  activities: Activity[];
  implementacoes: Implementacao[];
  submissions: Submission[];
  skills: Skill[];
  configs: AppConfig;
}
