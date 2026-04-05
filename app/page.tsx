"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload, BookOpen, CheckCircle, Clock, GraduationCap, Sparkles,
  Database, UserPlus, Plus, Trash2, AlertCircle, Layers, X,
  BarChart2, Users, Lightbulb, FileText, ChevronRight, ChevronDown, Edit2,
  ArrowRight, Check, RefreshCw, Copy, Hash, PanelLeftClose, PanelLeftOpen, ArrowLeft
} from "lucide-react";

// â”€â”€ TYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Subject       { id: string; name: string; code: string; syllabus?: string; closed?: boolean; }
interface Student       { id: string; name: string; email: string; ra?: string; turma?: string; subjectIds?: string[]; }
interface Activity      { id: string; subjectId: string; title: string; weight: number; description?: string; }
interface Implementacao { id: string; title: string; description: string; status: string; priority: string; createdAt: string; category?: string; imageUrl?: string; }
interface AppConfig     { system_name: string; primary_color: string; theme?: 'light' | 'dark'; institution?: string; professor?: string; pedagogical_style?: string; }
interface Turma         { id: string; name: string; studentIds: string[]; }
interface Implementacao { id: string; title: string; description: string; status: string; priority: string; createdAt: string; }
interface Submission    { id: string; studentName: string; subject: string; submittedAt: string; status: 'pending'|'grading'|'graded'|'error'; grade?: number; feedback?: string; source: 'pdf'|'drive'; }

interface BatchEntry {
  id: string;
  filename: string;
  file: File;
  studentId: string;
  subjectId: string;
  matchScore: number;       // 0-1 confidence from filename
  matchName: string;        // best guessed student name
  status: 'idle'|'processing'|'done'|'error';
  result?: Submission;
  error?: string;
}

interface DBData {
  subjects: Subject[];
  students: Student[];
  activities: Activity[];
  implementacoes: Implementacao[];
  submissions: Submission[];
  configs: AppConfig;
}

const STATUS_CONFIG = {
  pending:  { label: 'Aguardando',    icon: Clock,        color: '#f59e0b' },
  grading:  { label: 'Corrigindo...', icon: Sparkles,     color: '#6366f1' },
  graded:   { label: 'Corrigido',     icon: CheckCircle,  color: '#10b981' },
  error:    { label: 'Erro',          icon: AlertCircle,  color: '#ef4444' },
};

const IMPL_STATUS: Record<string, { label: string; color: string }> = {
  backlog:     { label: 'Backlog',      color: '#8b90a0' },
  validating:  { label: 'Validando',   color: '#f59e0b' },
  approved:    { label: 'Aprovado',    color: '#6366f1' },
  done:        { label: 'Concluído',   color: '#10b981' },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  alta:  { label: '▲ Alta',  cls: 'priority-alta' },
  media: { label: '◆ Média', cls: 'priority-media' },
  baixa: { label: '▼ Baixa', cls: 'priority-baixa' },
};

const EMPTY_DB: DBData = { 
  subjects: [], students: [], activities: [], implementacoes: [], submissions: [], 
  configs: { system_name: 'Aval.IA', primary_color: '#6366f1', theme: 'dark' } 
};

// â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');
}

function matchStudentByFilename(filename: string, students: Student[]): { studentId: string; name: string; score: number } {
  const normFilename = normalize(filename.replace(/\.pdf$/i, ''));
  const compactFilename = normFilename.replace(/\s+/g, '');
  
  let best = { studentId: '', name: '', score: 0 };
  for (const s of students) {
    const sNameNorm = normalize(s.name);
    let score = 0;

    // 1. Prioritize RA Match (Registration ID) - usually a unique number in the filename
    if (s.ra && s.ra.length > 2 && compactFilename.includes(normalize(s.ra).replace(/\s+/g, ''))) {
      score = 2.0; 
    } else {
      // 2. Compact Name Match (handles 'alanayasminzauza' style)
      const sNameCompact = sNameNorm.replace(/\s+/g, '');
      if (sNameCompact.length > 5 && compactFilename.includes(sNameCompact)) {
        score = 1.5;
      } else {
        // 3. Word-based scoring (ignoring small connectors like 'da', 'de', 'e')
        const snWords = sNameNorm.split(/\s+/).filter(w => w.length > 2);
        if (snWords.length > 0) {
          let hits = 0;
          for (const sw of snWords) {
            if (compactFilename.includes(sw)) hits++;
          }
          score = hits / snWords.length;
        }
      }
    }

    if (score > best.score) best = { studentId: s.id, name: s.name, score };
  }
  return best;
}

function cleanFilenameForName(filename: string) {
  let clean = filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  clean = clean.replace(/\b(atividade|trabalho|avalia[cç][aã]o|tarefa|prova|teste|\d+)\b/gi, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getActName(feedback: string) {
  const fl = (feedback ?? '').split('\n')[0];
  return fl.includes('Atividade:') ? fl.replace('Atividade:', '').trim() : null;
}

function syllabusChunks(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return raw ? [raw] : []; }
}

// â”€â”€ COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Dashboard() {
  type View = 'dashboard'|'subjects'|'students'|'enrollment'|'activities'|'batch'|'implementacoes'|'settings'|'copy'|'reports'|'student-profile';
  const [view, setView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [dbData, setDbData] = useState<DBData>(EMPTY_DB);
  const [dbMode, setDbMode] = useState<'local'|'remote'>('remote');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);

  // Modals visibility
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showImplModal, setShowImplModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Edit states
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingImpl, setEditingImpl] = useState<Implementacao | null>(null);

  // Forms
  const [newSubData, setNewSubData] = useState({ name: '', code: '' });
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusUploading, setSyllabusUploading] = useState(false);
  const [syllabusTarget, setSyllabusTarget] = useState<Subject | null>(null);

  const [newStuData, setNewStuData] = useState({ name: '', email: '', ra: '', turma: '' });
  const [newActData, setNewActData] = useState({ subjectId: '', title: '', weight: 1, description: '' });
  const [newImpl, setNewImpl] = useState({ title: '', description: '', priority: 'media', category: '', imageUrl: '' });
  const [tempConfigs, setTempConfigs] = useState<AppConfig>(EMPTY_DB.configs);

  // Upload (single)
  const [uploadName, setUploadName] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploading, setUploading] = useState(false);

  // Enrollment
  const [enrollSubjectId, setEnrollSubjectId] = useState('');

  // Batch
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchReport, setBatchReport] = useState<{ succeeded: number; failed: number } | null>(null);
  const [batchSubjectId, setBatchSubjectId] = useState('');
  const [batchActivityId, setBatchActivityId] = useState('');
  const [batchStep, setBatchStep] = useState<'upload'|'validate'|'results'>('upload');
  
  // Activity Import from Text
  const [showImportActModal, setShowImportActModal] = useState(false);
  const [actImportText, setActImportText] = useState('');
  const [parsedActs, setParsedActs] = useState<Partial<Activity>[]>([]);

  const [copySubjectId, setCopySubjectId] = useState('');
  const [copyActivityId, setCopyActivityId] = useState('');
  const [copyDestSubjectId, setCopyDestSubjectId] = useState('');
  const [copySelectedActs, setCopySelectedActs] = useState<string[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [copyProcessing, setCopyProcessing] = useState(false);

  // Reports state
  const [reportType, setReportType] = useState<'activity'|'subject'>('subject');
  const [reportSubjectId, setReportSubjectId] = useState('');
  const [reportActivityId, setReportActivityId] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const reportPreviewData = useMemo(() => {
    if (!reportSubjectId) return null;
    if (reportType === 'activity' && !reportActivityId) return null;
    const sub = dbData.subjects.find(s => s.id === reportSubjectId);
    
    let head: string[] = [];
    let body: any[] = [];
    let acts: Activity[] = [];
    let act: Activity | undefined;

    if (reportType === 'subject') {
      const allActs = dbData.activities.filter(a => a.subjectId === reportSubjectId);
      acts = allActs.filter(a => dbData.submissions.some(subm => 
        subm.subject === sub?.name && subm.status === 'graded' &&
        (getActName(subm.feedback || '') === a.title)
      ));

      head = ['Aluno', ...acts.flatMap(a => {
          const short = (a.title || '').split('-')[0].trim();
          return [`${short}`, `Faltas`];
      }), 'Média', 'Total Faltas'];

      body = dbData.students
        .filter(s => (s.subjectIds || []).includes(reportSubjectId))
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(stu => {
          let totalGrade = 0; let totalAbsences = 0;
          const row = [stu.name];
          acts.forEach(a => {
            const submission = dbData.submissions.find(subm => 
              subm.studentName === stu.name && subm.subject === sub?.name && subm.status === 'graded' &&
              (getActName(subm.feedback || '') === a.title)
            );
            if (submission) {
              row.push((submission.grade || 0).toFixed(1)); row.push('0');
              totalGrade += submission.grade || 0;
            } else {
              row.push('0.0'); row.push('2');
              totalAbsences += 2;
            }
          });
          row.push((totalGrade / (acts.length || 1)).toFixed(1));
          row.push(totalAbsences.toString());
          return row;
        });
    } else {
      act = dbData.activities.find(a => a.id === reportActivityId);
      head = ['Aluno', 'Nota', 'Faltas', 'Feedback'];
      body = dbData.students
        .filter(s => (s.subjectIds || []).includes(reportSubjectId))
        .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
        .map(stu => {
          const submission = dbData.submissions.find(subm => 
            subm.studentName === stu.name && subm.subject === sub?.name && subm.status === 'graded' &&
            (getActName(subm.feedback || '') === act?.title)
          );
          if (submission) {
            return [stu.name, (submission.grade || 0).toFixed(1), '0', submission.feedback || 'Sem feedback'];
          }
          return [stu.name, '0.0', '2', 'Não entregou / Ausente'];
        });
    }

    const gradedSubmissions = dbData.submissions.filter(subm => 
      subm.subject === sub?.name && subm.status === 'graded' &&
      (reportType === 'activity' ? getActName(subm.feedback || '') === act?.title : true)
    );
    
    const stats = {
      totalGraded: gradedSubmissions.length,
      classAvg: gradedSubmissions.length > 0 
        ? (gradedSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / gradedSubmissions.length).toFixed(1)
        : '0.0',
      participation: dbData.students.filter(s => (s.subjectIds || []).includes(reportSubjectId)).length > 0
        ? ((new Set(gradedSubmissions.map(gs => gs.studentName)).size / dbData.students.filter(s => (s.subjectIds || []).includes(reportSubjectId)).length) * 100).toFixed(0)
        : '0'
    };

    return { head, body, title: reportType === 'subject' ? sub?.name : `${sub?.name} - ${act?.title}`, isMatrix: reportType === 'subject', stats };
  }, [reportSubjectId, reportType, reportActivityId, dbData.subjects, dbData.activities, dbData.submissions, dbData.students]);

  const fetchDB = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setDbData(EMPTY_DB); // clear before fetch to avoid cross-mode bleed
    try {
      const res = await fetch(`/api/db?mode=${dbMode}`);
      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setDbData({
        subjects:        data.subjects        ?? [],
        students:        data.students        ?? [],
        activities:      data.activities      ?? [],
        implementacoes:  data.implementacoes  ?? [],
        submissions:     data.submissions     ?? [],
        configs:         data.configs         ?? EMPTY_DB.configs,
      });
      
      // Batch state handling
      try {
        const batchRes = await fetch(`/api/db?mode=${dbMode}&action=batch-state-get`);
        if (batchRes.ok) {
            const bState = await batchRes.json();
            if (bState) {
              setBatchEntries(bState.entries || []);
              setBatchStep(bState.step || 'upload');
              setBatchSubjectId(bState.subjectId || '');
              setBatchActivityId(bState.activityId || '');
            }
        }
      } catch(e) { console.error("Failed to load batch state", e); }
      
      setTempConfigs(data.configs ?? EMPTY_DB.configs);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dbMode]);

  useEffect(() => { setHasMounted(true); }, []);
  useEffect(() => { if (hasMounted) fetchDB(); }, [dbMode, hasMounted]);

  // Apply theme to DOM
  useEffect(() => {
    if (dbData.configs?.theme) {
      document.documentElement.setAttribute('data-theme', dbData.configs.theme);
    }
  }, [dbData.configs?.theme]);

  useEffect(() => {
    // Dynamic Accent Color
    if (dbData.configs?.primary_color) {
      document.documentElement.style.setProperty('--accent', dbData.configs.primary_color);
      // Generate a slightly lighter version for accent2 if it is not provided
      // For now we just use the same or let the CSS handle it
    }
  }, [dbData.configs?.primary_color]);

  // â”€â”€ GENERIC CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const apiPost = async (entity: string, data: any) => {
    const res = await fetch(`/api/db?mode=${dbMode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, data }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const apiDelete = async (entity: string, id: string) => {
    const res = await fetch(`/api/db?mode=${dbMode}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, id }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const del = async (entity: string, id: string) => {
    // Validações antes da exclusão
    if (entity === 'subject') {
      const hasActs = dbData.activities.some(a => a.subjectId === id);
      if (hasActs) return alert('Não é possível excluir: existem atividades vinculadas a esta matéria.');
    }
    if (entity === 'student') {
      const studentName = dbData.students.find(s => s.id === id)?.name;
      const hasSubs = dbData.submissions.some(s => s.studentName === studentName);
      if (hasSubs) return alert('Não é possível excluir: o aluno possui avaliações/submissões cadastradas.');
    }
    
    if (!confirm('Confirma a exclusão?')) return;
    try { await apiDelete(entity, id); await fetchDB(); if (selected?.id === id) setSelected(null); }
    catch (e: any) { alert('Erro: ' + e.message); }
  };

  const deleteActivityCorrections = async (subjectName: string, activityName?: string) => {
    const msg = activityName 
      ? `Deseja apagar TODAS as correções da atividade "${activityName}" na matéria "${subjectName}"? Esta ação é irreversível.`
      : `Deseja apagar TODAS as correções de TODAS as atividades da matéria "${subjectName}"? Isso removerá ${dbData.submissions.filter(s => s.subject === subjectName).length} registros. Esta ação é irreversível.`;
    
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      const subsToRemove = dbData.submissions.filter(s => s.subject === subjectName && (
        !activityName || // If no activity, remove all for subject
        (s.feedback?.split('\n')[0]?.includes('Atividade:') && s.feedback.split('\n')[0].replace('Atividade:', '').trim() === activityName) ||
        (activityName === 'Geral' && !s.feedback?.split('\n')[0]?.includes('Atividade:'))
      ));
      
      for (const sub of subsToRemove) {
        await apiDelete('submission', sub.id);
      }
      alert(`${subsToRemove.length} correções foram apagadas.`);
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setLoading(false); }
  };

  // â”€â”€ SUBJECT ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openSubjectModal = (s?: Subject) => {
    if (s) { setEditingSubject(s); setNewSubData({ name: s.name, code: s.code }); }
    else { setEditingSubject(null); setNewSubData({ name: '', code: '' }); }
    setShowSubjectModal(true);
  };
  const saveSubject = async () => {
    if (!newSubData.name || !newSubData.code) return alert('Preencha nome e código');
    try {
      if (editingSubject) {
        await apiPost('subject-update', { id: editingSubject.id, ...newSubData });
      } else {
        const sub = await apiPost('subject', { ...newSubData, syllabus: '' });
        if (syllabusFile) await uploadSyllabus(sub.id, syllabusFile);
      }
      setShowSubjectModal(false); setSyllabusFile(null); await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  const uploadSyllabus = async (subjectId: string, file: File) => {
    setSyllabusUploading(true);
    try {
      const fd = new FormData();
      fd.append('subjectId', subjectId);
      fd.append('file', file);
      const res = await fetch(`/api/syllabus?mode=${dbMode}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } finally {
      setSyllabusUploading(false);
    }
  };

  const handleSyllabusImport = async (subject: Subject, file: File) => {
    try {
      await uploadSyllabus(subject.id, file);
      await fetchDB();
      setSyllabusTarget(null);
      alert(`Ementa importada com sucesso para "${subject.name}"!`);
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  // â”€â”€ STUDENT ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openStudentModal = (s?: Student) => {
    if (s) { setEditingStudent(s); setNewStuData({ name: s.name, email: s.email, ra: s.ra || '', turma: s.turma || '' }); }
    else { setEditingStudent(null); setNewStuData({ name: '', email: '', ra: '', turma: '' }); }
    setShowStudentModal(true);
  };

  const extractRAFromName = async () => {
    if (!confirm('Deseja analisar os nomes dos alunos para extrair o RA (ex: Nome - 12345)? Isso atualizará os cadastros.')) return;
    setLoading(true);
    let count = 0;
    try {
      for (const s of dbData.students) {
        if (s.name.includes(' - ')) {
          const [name, ra] = s.name.split(' - ').map(p => p.trim());
          if (ra && /^\d+$/.test(ra)) {
            await apiPost('student-update', { ...s, name, ra });
            count++;
          }
        }
      }
      alert(`${count} alunos foram atualizados com sucesso!`);
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleImplPaste = (e: React.ClipboardEvent) => {
    const item = e.clipboardData.items[0];
    if (item?.type.includes('image')) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setNewImpl(prev => ({ ...prev, imageUrl: event.target?.result as string }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const toggleStudentEnrollment = async (student: Student) => {
    if (!enrollSubjectId) return;
    const subject = dbData.subjects.find(s => s.id === enrollSubjectId);
    if (subject?.closed) {
      alert(`A matéria "${subject.name}" está fechada. Não é possível alterar a enturmação.`);
      return;
    }

    const currentSubId = (student.subjectIds || [])[0];
    if (currentSubId && currentSubId !== enrollSubjectId) {
       const currentSub = dbData.subjects.find(s => s.id === currentSubId);
       if (currentSub?.closed) {
         alert(`O aluno está associado à matéria "${currentSub.name}" que já foi fechada.`);
         return;
       }
    }

    const currentIds = student.subjectIds || [];
    const hasIt = currentIds.includes(enrollSubjectId);
    
    // One student -> One Subject enforcement
    const newIds = hasIt ? [] : [enrollSubjectId];

    setDbData(prev => ({
      ...prev,
      students: prev.students.map(s => s.id === student.id ? { ...s, subjectIds: newIds } : s)
    }));
    try {
      await apiPost('student-subjects', { id: student.id, subjectIds: newIds });
    } catch (e: any) {
      alert('Erro: ' + e.message);
      await fetchDB();
    }
  };
  const handleStudentsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let count = 0;
      for (const line of lines) {
        const parts = line.split(/[,;]/).map(s => s.trim());
        const name = parts[0];
        const email = parts[1] || '';
        const turma = parts[2] || '';
        if (name && name.toLowerCase() !== 'nome' && name.toLowerCase() !== 'name') {
          await apiPost('student', { name, email, turma });
          count++;
        }
      }
      alert(`Foram importados ${count} alunos com sucesso!`);
      await fetchDB();
    } catch (err: any) {
      alert('Erro na importação: ' + err.message);
    }
    e.target.value = '';
  };

  const saveStudent = async () => {
    if (!newStuData.name) return alert('Preencha o nome');
    try {
      if (editingStudent) {
        await apiPost('student-update', { id: editingStudent.id, ...newStuData });
      } else {
        await apiPost('student', newStuData);
      }
      setShowStudentModal(false); await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  // â”€â”€ ACTIVITY ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openActivityModal = (a?: Activity) => {
    if (a) { setEditingActivity(a); setNewActData({ subjectId: a.subjectId, title: a.title, weight: a.weight, description: a.description || '' }); }
    else { setEditingActivity(null); setNewActData({ subjectId: '', title: '', weight: 1, description: '' }); }
    setShowActivityModal(true);
  };
  const saveActivity = async () => {
    if (!newActData.title || !newActData.subjectId) return alert('Preencha título e matéria');
    try {
      if (editingActivity) {
        await apiPost('activity-update', { id: editingActivity.id, ...newActData });
      } else {
        await apiPost('activity', newActData);
      }
      setShowActivityModal(false); await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  const parseActivitiesFromText = () => {
    if (!actImportText.trim()) return;
    
    // Regex based on user pattern: â€¢ A.A 01 (Date): Title ... Instructions: ... Entrega: ...
    const blocks = actImportText.split(/â€¢\s*A\.A/i).filter(b => b.trim());
    const results: Partial<Activity>[] = blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Extract title: it's on the first line after A.A (which was sliced)
      // Example: " 01 (26/02/2026): Introdução ao Empreendedorismo"
      const firstLine = lines[0];
      const titleMatch = firstLine.match(/\s*\d+\s*(?:\([^)]*\))?:\s*(.*)/i) || firstLine.match(/\s*(\d+.*)/);
      const title = titleMatch ? `A.A ${titleMatch[1]}` : `A.A ${firstLine}`;
      
      // Extract everything as description (the instructions)
      // We look for key terms like "Instruções", "Leitura", etc.
      const description = lines.slice(1).join('\n');
      
      return { title, description, weight: 1 };
    });
    
    setParsedActs(results);
  };

  const importParsedActivities = async () => {
    const selectedSubId = newActData.subjectId;
    if (!selectedSubId) return alert('Selecione a matéria para a qual deseja importar as atividades.');
    if (!parsedActs.length) return alert('Nenhuma atividade processada.');
    
    setLoading(true);
    try {
      for (const act of parsedActs) {
        await apiPost('activity', { ...act, subjectId: selectedSubId });
      }
      alert(`${parsedActs.length} atividades importadas com sucesso!`);
      setShowImportActModal(false);
      setParsedActs([]);
      setActImportText('');
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setLoading(false); }
  };

  // â”€â”€ IMPLEMENTATION ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openImplModal = (i?: Implementacao) => {
    if (i) { setEditingImpl(i); setNewImpl({ title: i.title, description: i.description, priority: i.priority, category: i.category || '', imageUrl: i.imageUrl || '' }); }
    else { setEditingImpl(null); setNewImpl({ title: '', description: '', priority: 'media', category: '', imageUrl: '' }); }
    setShowImplModal(true);
  };
  const saveImpl = async () => {
    if (!newImpl.title) return alert('Informe o título');
    try {
      if (editingImpl) {
        await apiPost('implementacao-update', { id: editingImpl.id, ...newImpl });
      } else {
        await apiPost('implementacao', newImpl);
      }
      setShowImplModal(false); await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };
  const cycleStatus = async (imp: Implementacao, back: boolean = false) => {
    const order = ['backlog', 'validating', 'approved', 'done'];
    const idx = order.indexOf(imp.status);
    const nextIdx = back ? (idx - 1 + order.length) % order.length : (idx + 1) % order.length;
    const next = order[nextIdx];
    try { await apiPost('implementacao-status', { id: imp.id, status: next }); await fetchDB(); }
    catch (e: any) { alert('Erro: ' + e.message); }
  };

  // â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveSettings = async (configsToSave?: AppConfig) => {
    try {
      await apiPost('configs', configsToSave || tempConfigs);
      alert('Configurações salvas!');
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  // â”€â”€ SINGLE UPLOAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFileUpload = async (file: File) => {
    if (!uploadName || !uploadSubject) return alert('Selecione aluno e matéria');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('studentName', uploadName); fd.append('subject', uploadSubject);
      fd.append('activity', ''); fd.append('file', file);
      const res = await fetch(`/api/grading?mode=${dbMode}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDbData(prev => ({ ...prev, submissions: [data, ...prev.submissions] }));
      setShowUpload(false);
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setUploading(false); }
  };

  // â”€â”€ BATCH ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const addBatchFiles = (files: FileList) => {
    const entries: BatchEntry[] = Array.from(files).map(file => {
      const match = matchStudentByFilename(file.name, dbData.students);
      const isGoodMatch = match.score >= 0.3;
      return {
        id: `${Date.now()}-${Math.random()}`,
        filename: file.name,
        file,
        studentId: isGoodMatch ? match.studentId : '',
        subjectId: batchSubjectId,
        matchScore: match.score,
        matchName: isGoodMatch ? match.name : cleanFilenameForName(file.name),
        status: 'idle',
      };
    });
    setBatchEntries(prev => [...prev, ...entries]);
  };

  const updateBatch = (id: string, patch: Partial<BatchEntry>) =>
    setBatchEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const saveBatchAndExit = async () => {
    try {
      await apiPost('batch-state', {
          entries: batchEntries,
          step: batchStep,
          subjectId: batchSubjectId,
          activityId: batchActivityId
      });
      alert('Sessão salva! Você pode continuar de onde parou depois.');
      setView('dashboard');
    } catch (e:any) { alert(e.message); }
  };

  const runBatch = async () => {
    if (!batchActivityId) {
      if (!confirm('\u26a0\ufe0f Nenhuma atividade selecionada! As corre\u00e7\u00f5es ir\u00e3o para o grupo "Geral" e n\u00e3o ter\u00e3o crit\u00e9rios espec\u00edficos. Deseja continuar mesmo assim?')) return;
    }
    const valid = batchEntries.filter(e => e.studentId && e.subjectId);
    if (!valid.length) return alert('Configure aluno e mat\u00e9ria para ao menos um item');
    setBatchRunning(true);
    setBatchStep('results');
    setBatchEntries(prev => prev.map(e =>
      e.studentId && e.subjectId ? { ...e, status: 'processing' } : e
    ));
    try {
      await apiPost('batch-state', null); 

      const fd = new FormData();
      let i = 0;
      const activity = dbData.activities.find(a => a.id === batchActivityId);
      
      for (const e of valid) {
        const stu = dbData.students.find(s => s.id === e.studentId);
        const sub = dbData.subjects.find(s => s.id === e.subjectId);
        if (!stu || !sub) continue;
        fd.append(`items[${i}][studentName]`, stu.name);
        fd.append(`items[${i}][subject]`, sub.name);
        // Send BOTH activityId and activityTitle for reliable server-side lookup
        if (activity) {
          fd.append(`items[${i}][activityId]`, activity.id);
          fd.append(`items[${i}][activity]`, activity.title);
        }
        fd.append(`items[${i}][file]`, e.file);
        i++;
      }
      const res = await fetch(`/api/grading/batch?mode=${dbMode}`, { method: 'POST', body: fd });
      const report = await res.json();
      if (report.error) throw new Error(report.error);

      setBatchEntries(prev => prev.map(entry => {
        if (entry.status !== 'processing') return entry;
        const stu = dbData.students.find(s => s.id === entry.studentId);
        const found = (report.submissions as Submission[]).find(s => s.studentName === stu?.name);
        if (found) return { ...entry, status: 'done', result: found };
        const err = (report.errors as any[]).find(e => e.studentName === stu?.name);
        return { ...entry, status: 'error', error: err?.error ?? 'Erro desconhecido' };
      }));
      setBatchReport({ succeeded: report.succeeded, failed: report.failed });
      await fetchDB();
    } catch (e: any) {
      alert('Erro: ' + e.message);
      setBatchEntries(prev => prev.map(e => e.status === 'processing' ? { ...e, status: 'error', error: 'Falha na requ\u0131si\u00e7\u00e3o' } : e));
    } finally { setBatchRunning(false); }
  };

  const handleCopyActivities = async () => {
    if (!copySubjectId || (!copyDestSubjectId && !newSubjectName)) {
      return alert('Selecione a matéria de origem e o destino (ou nome da nova matéria).');
    }
    if (copySelectedActs.length === 0) return alert('Selecione ao menos uma atividade para copiar.');

    setCopyProcessing(true);
    try {
      let destId = copyDestSubjectId;
      if (!destId && newSubjectName) {
        const sourceSub = dbData.subjects.find(s => s.id === copySubjectId);
        const res = await apiPost('subject', { 
          name: newSubjectName, 
          code: (sourceSub?.code || '') + '-COPY',
          syllabus: sourceSub?.syllabus || ''
        });
        if (!res?.id) throw new Error('Falha ao criar nova matéria.');
        destId = res.id;
      }
      const actsToCopy = dbData.activities.filter(a => copySelectedActs.includes(a.id));
      for (const act of actsToCopy) {
        await apiPost('activity', {
          subjectId: destId,
          title: act.title,
          weight: act.weight,
          description: act.description
        });
      }
      alert(`${actsToCopy.length} atividades copiadas com sucesso!`);
      await fetchDB();
      setCopySelectedActs([]);
      setNewSubjectName('');
      setCopyDestSubjectId(destId);
    } catch (e: any) { alert('Erro na cópia: ' + e.message); }
    finally { setCopyProcessing(false); }
  };

  const exportToCanvasCSV = () => {
    if (!copySubjectId || !copyActivityId) return alert('Selecione matéria e atividade primeiro.');
    
    const subject = dbData.subjects.find(s => s.id === copySubjectId);
    const activity = dbData.activities.find(a => a.id === copyActivityId);
    if (!subject || !activity) return;

    // Canvas CSV Header based on user sample
    const activityHeader = `${activity.title} (${Math.floor(Math.random() * 1000)})`;
    const headers = ["Student", "ID", "SIS User ID", "SIS Login ID", "Section", activityHeader];
    
    const rows = dbData.students
      .filter(stu => (stu.subjectIds || []).includes(copySubjectId))
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(stu => {
        const submission = dbData.submissions.find(sub => 
          sub.studentName === stu.name && 
          sub.subject === subject.name && 
          sub.status === 'graded' &&
          getActName(sub.feedback || '') === activity.title
        );
        
        const gradeValue = submission ? (submission.grade?.toFixed(2).replace('.', ',')) : "0,00";
        
        return [
          `"${stu.name}"`,
          stu.id.slice(0, 8),
          stu.ra || stu.email || "", 
          stu.email || "",
          `"${subject.name}"`,
          gradeValue
        ];
      });

    const csvContent = [
      headers.join(","),
      ["Points Possible", "", "", "", "", "0,00"].join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Notas_Canvas_${subject.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasMounted) return null;

  // â”€â”€ NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const NavItem = ({ v, icon: Icon, label }: { v: View; icon: any; label: string }) => (
    <button className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
      <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
    </button>
  );

  return (
    <div className="app">
      {/* â”€â”€ SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="logo"><GraduationCap size={26} strokeWidth={1.5}/><span>Aval.IA</span></div>
          <button className="btn-icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}
          </button>
        </div>
        <nav className="nav">
          <p className="nav-label">Visão Geral</p>
          <NavItem v="dashboard"      icon={BookOpen}    label="Dashboard"/>
          <p className="nav-label">Entidades</p>
          <NavItem v="subjects"       icon={FileText}    label="Matérias"/>
          <NavItem v="students"       icon={UserPlus}    label="Alunos"/>
          <NavItem v="enrollment"     icon={Users}       label="Enturmação"/>
          <NavItem v="activities"     icon={Clock}       label="Atividades"/>
          <p className="nav-label">Trabalho</p>
          <NavItem v="batch"          icon={Layers}      label="Correção"/>
          <NavItem v="copy"           icon={Layers}      label="Copia de Atividades"/>
          <NavItem v="reports"        icon={BarChart2}   label="Relatórios"/>
          <p className="nav-label">Sistema</p>
          <NavItem v="implementacoes" icon={Lightbulb}   label="Implementações"/>
          <NavItem v="settings"       icon={Database}    label="Configurações"/>
        </nav>
        <div className="sidebar-footer-text" style={{marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 10, color: 'var(--text2)', fontFamily: 'monospace'}}>
          v0.1.0-alpha.1
        </div>
      </aside>


      {/* â•â• MAIN â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <main className="main">
        {loading && (
          <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--text2)',marginBottom:20,fontSize:13}}>
            <RefreshCw size={14} className="spin"/> Carregando dados...
          </div>
        )}
        {loadError && (
          <div style={{background:'#ef444415',border:'1px solid #ef444430',borderRadius:8,padding:'10px 14px',color:'#ef9999',fontSize:12.5,marginBottom:20,display:'flex',gap:8,alignItems:'center'}}>
            <AlertCircle size={14}/> {loadError}
          </div>
        )}

        {/* â•â• DASHBOARD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'dashboard' && <>
          <header className="header">
            <div><h1>Painel de Avaliações</h1><p className="subtitle">Visão Geral do Sistema</p></div>
            <button className="btn-primary" onClick={() => setShowUpload(true)}><Upload size={16}/> Novo Trabalho</button>
          </header>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}} className="fade-in">
            <div style={{background:'var(--surface2)',padding:'20px 24px',borderRadius:14,border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:12,color:'var(--text2)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em'}}>Total de Alunos</h3>
                <div style={{background:'#6366f120',borderRadius:8,padding:6}}><Users size={15} color="#6366f1"/></div>
              </div>
              <p style={{fontSize:32,fontWeight:700,lineHeight:1}}>{dbData.students.length}</p>
            </div>
            <div style={{background:'var(--surface2)',padding:'20px 24px',borderRadius:14,border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:12,color:'var(--text2)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em'}}>Total de Matérias</h3>
                <div style={{background:'#10b98120',borderRadius:8,padding:6}}><BookOpen size={15} color="#10b981"/></div>
              </div>
              <p style={{fontSize:32,fontWeight:700,lineHeight:1}}>{dbData.subjects.length}</p>
            </div>
            <div style={{background:'var(--surface2)',padding:'20px 24px',borderRadius:14,border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:12,color:'var(--text2)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em'}}>Total de Avaliações</h3>
                <div style={{background:'#f59e0b20',borderRadius:8,padding:6}}><Layers size={15} color="#f59e0b"/></div>
              </div>
              <p style={{fontSize:32,fontWeight:700,lineHeight:1}}>{dbData.activities.length}</p>
            </div>
            <div style={{background:'var(--surface2)',padding:'20px 24px',borderRadius:14,border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:12,color:'var(--text2)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em'}}>Correções Realizadas</h3>
                <div style={{background:'#10b98120',borderRadius:8,padding:6}}><CheckCircle size={15} color="#10b981"/></div>
              </div>
              <p style={{fontSize:32,fontWeight:700,lineHeight:1}}>{dbData.submissions.filter(s => s.status === 'graded').length}</p>
            </div>
          </div>

          <h2 style={{fontSize:16, marginBottom:20, display:'flex', alignItems:'center', gap:8}}>
            <Layers size={18} color="var(--accent)"/> Histórico de Correções Agrupadas
          </h2>
          
          <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:28}}>
            {dbData.subjects.filter(sub => dbData.submissions.some(s => s.subject === sub.name)).sort((a,b) => b.name.localeCompare(a.name)).map(subject => {
              const subjectSubs = dbData.submissions.filter(s => s.subject === subject.name);
              const isSubExpanded = !!expandedSubjects[subject.id];
              
              // Group submissions of this subject by activity
              const activityGroups = subjectSubs.reduce((acc, sub) => {
                const firstLine = sub.feedback?.split('\n')[0] || '';
                const actName = firstLine.includes('Atividade:') 
                  ? firstLine.replace('Atividade:', '').trim() 
                  : 'Geral';
                if (!acc[actName]) acc[actName] = [];
                acc[actName].push(sub);
                return acc;
              }, {} as Record<string, Submission[]>);

              return (
                <div key={subject.id} className="card" style={{padding:0, overflow:'hidden', border:'1px solid var(--border)'}}>
                  <div 
                    style={{background:'var(--surface2)', padding:'12px 20px', borderBottom: isSubExpanded ? '1px solid var(--border)' : 'none', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer'}}
                    onClick={() => setExpandedSubjects(prev => ({...prev, [subject.id]: !prev[subject.id]}))}
                  >
                    <h3 style={{fontSize:14, fontWeight:700, color:'var(--accent)', display:'flex', alignItems:'center', gap:8}}>
                      {isSubExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      <BookOpen size={16}/> {subject.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="badge" style={{fontSize:10}}>{subjectSubs.length} correções</span>
                      <button 
                        className="btn-icon-danger" 
                        style={{ padding: '2px 8px', height: 'auto', fontSize: 10, background: '#ef444415' }} 
                        onClick={(e) => { e.stopPropagation(); deleteActivityCorrections(subject.name); }}
                        title={`Apagar todas as correções de ${subject.name}`}
                      >
                        <Trash2 size={12}/> Limpar Matéria
                      </button>
                    </div>
                  </div>
                  
                  {isSubExpanded && (
                    <div style={{padding:'10px 20px 20px'}}>
                      {Object.entries(activityGroups)
                        .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true, sensitivity: 'base' }))
                        .map(([actTitle, subs]) => {
                        const actId = `${subject.id}-${actTitle}`;
                        const isActExpanded = !!expandedActivities[actId];
                        return (
                          <div key={actTitle} style={{marginTop:16}}>
                            <div 
                              style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, cursor:'pointer'}}
                              onClick={() => setExpandedActivities(prev => ({...prev, [actId]: !prev[actId]}))}
                            >
                              <h4 style={{fontSize:12, fontWeight:600, color:'var(--text1)', display:'flex', alignItems:'center', gap:6, opacity:0.8}}>
                                {isActExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                <Sparkles size={14} color="#10b981"/> {actTitle}
                              </h4>
                              <button 
                                className="btn-icon-danger" 
                                style={{padding:4, height:'auto', width:'auto'}} 
                                title={`Apagar todas as ${subs.length} correções de ${actTitle}`}
                                onClick={(e) => { e.stopPropagation(); deleteActivityCorrections(subject.name, actTitle); }}
                              >
                                <Trash2 size={12}/> <span style={{fontSize:10}}>Limpar Atividade</span>
                              </button>
                            </div>
                            
                            {isActExpanded && (
                              <div className="table-wrap fade-in" style={{border:'none', borderRadius:8, background:'var(--bg)'}}>
                                <table className="table table-sm">
                                  <thead>
                                    <tr><th>Aluno</th><th>Nota</th><th>Data</th><th style={{textAlign:'right'}}>Ações</th></tr>
                                  </thead>
                                  <tbody>
                                    {subs.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt)).map(sub => {
                                      const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.pending;
                                      return (
                                        <tr key={sub.id} className={selected?.id === sub.id ? 'selected' : ''} onClick={() => setSelected(sub)} style={{cursor:'pointer'}}>
                                          <td className="td-name" style={{fontSize:13}}>
                                            {sub.studentName}
                                          </td>
                                          <td>
                                            <span className="status-pill" style={{background:cfg.color+'18',color:cfg.color, fontSize:11, padding:'2px 8px'}}>
                                              <cfg.icon size={11}/> {sub.grade?.toFixed(1) ?? '—'}
                                            </span>
                                          </td>
                                          <td className="td-muted" style={{fontSize:11}}>{sub.submittedAt.split(' ')[0]}</td>
                                          <td>
                                            <div className="actions" onClick={e => e.stopPropagation()} style={{justifyContent:'flex-end'}}>
                                              <button className="btn-icon" onClick={() => setSelected(sub)} title="Ver Detalhes"><ChevronRight size={14}/></button>
                                              <button className="btn-icon-danger" onClick={() => del('submission', sub.id)} title="Excluir"><Trash2 size={14}/></button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {dbData.submissions.length === 0 && (
              <div className="empty-state" style={{background:'var(--surface)', borderRadius:12, padding:40, border:'1px dashed var(--border)'}}>
                <Layers size={40} style={{opacity:0.2, marginBottom:16}}/>
                <p>Nenhuma correção registrada no sistema.</p>
                <button className="btn-primary" style={{marginTop:16}} onClick={() => setView('batch')}>Iniciar Nova Correção</button>
              </div>
            )}
          </div>
        </>}

        {/* â•â• RELATÓRIOS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}


        {/* â•â• MATÉRIAS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'subjects' && <>
          <header className="header">
            <div><h1>Matérias</h1><p className="subtitle">{dbData.subjects.length} disciplinas</p></div>
            <button className="btn-primary" onClick={() => openSubjectModal()}><Plus size={16}/> Nova Matéria</button>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Nome</th><th>Código</th><th>Ementa</th><th></th></tr></thead>
              <tbody>
                {dbData.subjects.length === 0
                  ? <tr><td colSpan={4}><div className="empty-state"><FileText size={40}/><p>Nenhuma matéria.</p></div></td></tr>
                  : dbData.subjects.map(s => {
                    const chunks = syllabusChunks(s.syllabus ?? '');
                    return (
                      <tr key={s.id}>
                        <td className="td-name">{s.name}</td>
                        <td className="td-muted">{s.code}</td>
                        <td>
                          {chunks.length > 0
                            ? <span className="syllabus-chip"><CheckCircle size={11}/> {chunks.length} chunks</span>
                            : <span style={{fontSize:11,color:'var(--text2)'}}>Sem ementa</span>
                          }
                        </td>
                        <td>
                          <div className="actions">
                            <button className="btn-icon" onClick={() => openSubjectModal(s)}><Edit2 size={13}/></button>
                            <button className="btn-icon" title="Importar ementa" onClick={() => setSyllabusTarget(s)}><Upload size={13}/></button>
                            <button className="btn-icon-danger" onClick={() => del('subject', s.id)}><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </>}

        {/* â•â• ALUNOS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'students' && <>
          <header className="header">
            <div><h1>Alunos</h1><p className="subtitle">{dbData.students.length} estudantes</p></div>
            <div className="header-actions">
              <button className="btn-ghost" onClick={extractRAFromName} title="Extrai o número após o '-' do nome e coloca no campo RA">
                <Hash size={16}/> Extrair RA do Nome
              </button>
              <label className="btn-ghost" style={{cursor:'pointer', position:'relative', overflow:'hidden'}}>
                <Upload size={16}/> Importar (TXT/CSV)
                <input type="file" accept=".txt,.csv" style={{position:'absolute',opacity:0,width:1,height:1,left:0,top:0}} onChange={handleStudentsImport}/>
              </label>
              <button className="btn-primary" onClick={() => openStudentModal()}><UserPlus size={16}/> Novo Aluno</button>
            </div>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Nome</th><th>RA</th><th>Email</th><th>Turma</th><th>Matéria</th><th></th></tr></thead>
              <tbody>
                {dbData.students.length === 0
                  ? <tr><td colSpan={5}><div className="empty-state"><UserPlus size={40}/><p>Nenhum aluno.</p></div></td></tr>
                  : [...dbData.students].sort((a,b) => a.name.localeCompare(b.name)).map(s => {
                    const subId = (s.subjectIds || [])[0];
                    const sub = subId ? dbData.subjects.find(x => x.id === subId) : null;
                    return (
                      <tr key={s.id}>
                        <td className="td-name">{s.name}</td>
                        <td style={{fontSize:12, fontWeight:600}}>{s.ra || <span style={{opacity:0.3}}>—</span>}</td>
                        <td className="td-muted">{s.email}</td>
                        <td>{!s.turma ? <span style={{fontSize:11,color:'var(--text2)'}}>Sem turma</span> : <span className="badge badge-blue">{s.turma}</span>}</td>
                        <td>{sub ? <span className="badge-subject">{sub.name}</span> : <span style={{fontSize:11,color:'var(--text2)'}}>Livre</span>}</td>
                        <td>
                          <div className="actions">
                            <button className="btn-icon" onClick={() => openStudentModal(s)}><Edit2 size={13}/></button>
                            <button className="btn-icon-danger" onClick={() => del('student', s.id)}><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>}

        {/* â•â• ATIVIDADES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'activities' && <>
          <header className="header">
            <div><h1>Atividades</h1><p className="subtitle">{dbData.activities.length} avaliações</p></div>
            <div className="header-actions">
              <button className="btn-ghost" onClick={() => setShowImportActModal(true)}><Sparkles size={16}/> Importar da Ementa</button>
              <button className="btn-primary" onClick={() => openActivityModal()}><Plus size={16}/> Nova Atividade</button>
            </div>
          </header>
          <div className="table-wrap fade-in">
            <table className="table" style={{tableLayout:'fixed'}}>
              <thead><tr><th style={{width:'35%'}}>Título</th><th style={{width:'25%'}}>Matéria</th><th style={{width:'8%'}}>Peso</th><th style={{width:'25%'}}>Critério IA</th><th style={{width:'7%', textAlign:'right'}}></th></tr></thead>
              <tbody>
                {dbData.activities.length === 0
                  ? <tr><td colSpan={5}><div className="empty-state"><Clock size={40}/><p>Nenhuma atividade.</p></div></td></tr>
                  : dbData.activities.map(a => {
                    const sub = dbData.subjects.find(s => s.id === a.subjectId);
                    return (
                      <tr key={a.id}>
                        <td className="td-name">{a.title}</td>
                        <td><span className="badge-subject">{sub?.name ?? a.subjectId}</span></td>
                        <td className="td-muted">{a.weight}×</td>
                        <td className="td-desc">{a.description || <span style={{opacity:.4}}>—</span>}</td>
                        <td>
                          <div className="actions">
                            <button className="btn-icon" onClick={() => openActivityModal(a)}><Edit2 size={13}/></button>
                            <button className="btn-icon-danger" onClick={() => del('activity', a.id)}><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </>}

        {/* â•â• ENTURMAÇÃO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'enrollment' && <>
          <header className="header" style={{flexDirection:'column', alignItems:'flex-start', gap:16}}>
            <div><h1>Enturmação</h1><p className="subtitle">Associe alunos a matérias clicando duas vezes sobre o card.</p></div>
            <div style={{display:'flex', gap:16, alignItems:'center', flexWrap:'wrap'}}>
              <select className="input" style={{maxWidth:300, background:'var(--surface)'}} value={enrollSubjectId} onChange={e => setEnrollSubjectId(e.target.value)}>
                <option value="">-- Selecione uma matéria --</option>
                {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code}) {s.closed ? '🔒' : ''}</option>)}
              </select>

              {enrollSubjectId && (() => {
                const sub = dbData.subjects.find(s => s.id === enrollSubjectId);
                return (
                  <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border)'}}>
                    <input type="checkbox" checked={!!sub?.closed} onChange={async () => {
                      if (!sub) return;
                      const newClosed = !sub.closed;
                      setDbData(prev => ({ ...prev, subjects: prev.subjects.map(s => s.id === sub.id ? { ...s, closed: newClosed } : s) }));
                      try { await apiPost('subject-closed', { id: sub.id, closed: newClosed }); } 
                      catch(e:any) { alert(e.message); await fetchDB(); }
                    }} />
                    <span>Bloquear Enturmação (Matéria Fechada)</span>
                  </label>
                );
              })()}
            </div>
          </header>

          {!enrollSubjectId ? (
            <div className="empty-state"><Users size={40}/><p>Selecione uma matéria acima para começar a enturmar.</p></div>
          ) : (() => {
            const subject = dbData.subjects.find(s => s.id === enrollSubjectId);
            const isClosed = !!subject?.closed;
            const inSubject = dbData.students.filter(s => (s.subjectIds||[]).includes(enrollSubjectId)).sort((a,b) => a.name.localeCompare(b.name));
            const notInSubject = dbData.students.filter(s => !(s.subjectIds||[]).length).sort((a,b) => a.name.localeCompare(b.name)); // ONLY those with NO subject

            const StudentCard = ({ s, onDoubleClick }: { s: Student; onDoubleClick: () => void }) => {
              return (
                <div 
                  className="kanban-card" 
                  style={{cursor: isClosed ? 'not-allowed' : 'pointer', userSelect:'none', display:'flex', justifyContent:'space-between', alignItems:'center', opacity: isClosed ? 0.6 : 1}}
                  onDoubleClick={isClosed ? undefined : onDoubleClick}
                  title={isClosed ? 'Matéria fechada para edição' : 'Dê um duplo-clique para mover'}
                >
                  <div>
                    <p className="kanban-card-title">{s.name}</p>
                    <p style={{fontSize:10, color:'var(--text2)'}}>
                      {s.turma || 'Livre'}
                    </p>
                  </div>
                  <Users size={14} style={{opacity:0.3}}/>
                </div>
              );
            };

            return (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}} className="fade-in">
                <div style={{background:'var(--surface)', padding:16, borderRadius:12, border:'1px solid var(--border)', display:'flex', flexDirection:'column'}}>
                  <h3 style={{marginBottom:16, display:'flex', alignItems:'center', gap:8}}><UserPlus size={16}/> Não Enturmados <span className="badge">{notInSubject.length}</span></h3>
                  <div style={{display:'flex', flexDirection:'column', gap:8, flex:1, overflowY:'auto'}}>
                    {notInSubject.map(s => <StudentCard key={s.id} s={s} onDoubleClick={() => toggleStudentEnrollment(s)}/>)}
                    {notInSubject.length === 0 && <p style={{fontSize:12, color:'var(--text2)', textAlign:'center', marginTop:20}}>Todos os alunos cadastrados já estão nesta matéria.</p>}
                  </div>
                </div>

                <div style={{background:'var(--surface)', padding:16, borderRadius:12, border:'1px dashed var(--accent)', display:'flex', flexDirection:'column'}}>
                  <h3 style={{marginBottom:16, display:'flex', alignItems:'center', gap:8}}><CheckCircle size={16} color="var(--accent)"/> Em {subject?.name} <span className="badge badge-blue">{inSubject.length}</span></h3>
                  <div style={{display:'flex', flexDirection:'column', gap:8, flex:1, overflowY:'auto'}}>
                    {inSubject.map(s => <StudentCard key={s.id} s={s} onDoubleClick={() => toggleStudentEnrollment(s)}/>)}
                    {inSubject.length === 0 && <p style={{fontSize:12, color:'var(--text2)', textAlign:'center', marginTop:20}}>Nenhum aluno associado. Dê 2 cliques num card ao lado.</p>}
                  </div>
                </div>
              </div>
            );
          })()}
        </>}



        {/* â•â• CORREÇÃO EM LOTE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'batch' && (
          <div className="fade-in">
            <header className="header" style={{ marginBottom: 24 }}>
              <div>
                <h1>Correção</h1>
                <p className="subtitle">
                  {batchStep === 'upload' && "Fase 1: Upload e Identificação"}
                  {batchStep === 'validate' && "Fase 2: Validação de Contexto"}
                  {batchStep === 'results' && "Fase 3: Resultados e Feedbacks"}
                </p>
              </div>
              <div className="header-actions">
                <button className="btn-ghost" onClick={saveBatchAndExit} title="Salva o progresso e volta para a dashboard">
                  <RefreshCw size={15}/> Salvar e Sair
                </button>
                {batchStep === 'upload' && (
                  <>
                    <button className="btn-ghost" onClick={() => { setBatchEntries([]); setBatchReport(null); apiPost('batch-state', null); }}><X size={15}/> Limpar</button>
                    <button className="btn-primary" 
                      disabled={batchEntries.length === 0 || !batchSubjectId}
                      onClick={() => setBatchStep('validate')}>
                      Próximo Passo <ChevronRight size={16}/>
                    </button>
                  </>
                )}
              </div>
            </header>

            {/* STEP 1: UPLOAD & MATCHING */}
            {batchStep === 'upload' && (
              <div className="fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                      <BookOpen size={16} color="var(--accent)"/> 1. Selecione a Matéria
                    </label>
                    <select className="input" style={{ width: '100%' }} value={batchSubjectId} onChange={e => {
                      setBatchSubjectId(e.target.value);
                      setBatchEntries(prev => prev.map(en => ({ ...en, subjectId: e.target.value })));
                    }}>
                      <option value="">Selecione a disciplina...</option>
                      {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </select>
                  </div>
                  <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                      <Upload size={16} color="var(--accent)"/> 2. Envie os PDFs
                    </label>
                    <label className="drop-zone drop-zone-sm" style={{ 
                      cursor: 'pointer', 
                      height: 48, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 13,
                      borderStyle: 'dashed'
                    }}>
                      Clique para selecionar os arquivos
                      <input type="file" accept=".pdf" multiple style={{ display: 'none' }}
                        onChange={e => e.target.files && addBatchFiles(e.target.files)}/>
                    </label>
                  </div>
                </div>

                {batchEntries.length > 0 && (
                  <div className="table-wrap">
                    <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,2fr) minmax(0,1.5fr) 40px', gap: 12, padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase' }}>
                      <span>#</span><span>Arquivo</span><span>Aluno Identificado</span><span></span>
                    </div>
                    {batchEntries.map((entry, idx) => (
                      <div key={entry.id} className="batch-item" style={{ gridTemplateColumns: '28px minmax(0,2fr) minmax(0,1.5fr) 40px', padding: '10px 16px', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{idx+1}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.filename}</span>
                        <select className="input" style={{ fontSize: 12, padding: '5px 10px' }}
                          value={entry.studentId}
                          onChange={e => updateBatch(entry.id, { studentId: e.target.value })}>
                          <option value="">Selecionar aluno...</option>
                          {dbData.students
                            .filter(s => !batchSubjectId || (s.subjectIds || []).includes(batchSubjectId))
                            .sort((a,b) => a.name.localeCompare(b.name))
                            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button className="btn-icon-danger" onClick={() => setBatchEntries(prev => prev.filter(en => en.id !== entry.id))}><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button className="btn-ghost" onClick={() => { setBatchEntries([]); setBatchReport(null); apiPost('batch-state', null); }}><X size={15}/> Limpar Tudo</button>
                  <button className="btn-primary" 
                    disabled={batchEntries.length === 0 || !batchSubjectId}
                    onClick={() => setBatchStep('validate')}>
                    Próximo Passo <ChevronRight size={16}/>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: VALIDATION */}
            {batchStep === 'validate' && (() => {
              const sub = dbData.subjects.find(s => s.id === batchSubjectId);
              const syllabus = syllabusChunks(sub?.syllabus ?? '');
              return (
                <div className="fade-in">
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 24, alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--accent)', flex: 1 }}>
                        <h3 style={{ fontSize: 13, color:'var(--text1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <BookOpen size={16} color="var(--accent)"/> Orientações da Matéria
                        </h3>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{sub?.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>{sub?.code}</p>
                        <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', padding: 10, borderRadius: 8, maxHeight: 150, overflow: 'auto', border: '1px solid var(--border)' }}>
                          {syllabus.length > 0 ? syllabus[0].slice(0, 800) + '...' : 'Sem ementa cadastrada.'}
                        </div>
                      </div>

                      <div className="card" style={{ padding: 20, borderLeft: '4px solid #10b981', flex: 1 }}>
                        <h3 style={{ fontSize: 13, color:'var(--text1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Sparkles size={16} color="#10b981"/> Orientações da Atividade
                        </h3>
                        <label className="field-label">Vincular a uma Atividade Existente</label>
                        <select className="input" value={batchActivityId} onChange={e => setBatchActivityId(e.target.value)}>
                          <option value="">-- Avaliação Geral (Sem Critério Específico) --</option>
                          {dbData.activities.filter(a => a.subjectId === batchSubjectId).map(a => (
                            <option key={a.id} value={a.id}>{a.title}</option>
                          ))}
                        </select>
                        {batchActivityId && (() => {
                          const act = dbData.activities.find(a => a.id === batchActivityId);
                          return (
                            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                              <b>Critérios:</b><br/>{act?.description || 'Nenhum critério detalhado.'}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontSize: 13, color:'var(--text1)', marginBottom: 16 }}>Resumo do Lote</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'auto', maxHeight: 350 }}>
                        {batchEntries.map((e, i) => {
                          const stu = dbData.students.find(s => s.id === e.studentId);
                          return (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>{i+1}. {e.filename}</span>
                              <span style={{ fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{stu?.name || 'Não associado'}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 20, padding: 16, background: 'var(--accent)10', borderRadius: 8, border: '1px solid var(--accent)30' }}>
                        <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Pronto para processar?</p>
                        <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>O sistema realizará uma análise completa e detalhada baseada nos critérios pedagógicos.</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      {!batchActivityId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f59e0b', background: '#f59e0b15', padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b40' }}>
                          <AlertCircle size={14}/>
                          <span><strong>Atividade não selecionada.</strong> As correções irão para o grupo "Geral".</span>
                        </div>
                      )}
                      {batchActivityId && (() => {
                        const act = dbData.activities.find(a => a.id === batchActivityId);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#10b981', background: '#10b98115', padding: '8px 14px', borderRadius: 8, border: '1px solid #10b98140' }}>
                            <CheckCircle size={14}/>
                            <span>Atividade vinculada: <strong>{act?.title}</strong></span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn-ghost" onClick={() => setBatchStep('upload')}>Voltar</button>
                      <button className="btn-primary" onClick={runBatch}>
                        <Sparkles size={16}/> Enviar para Correção
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* STEP 3: RESULTS */}
            {batchStep === 'results' && (
              <div className="fade-in">
                {batchRunning ? (
                  <div className="empty-state" style={{ height: 400 }}>
                    <div className="spin" style={{ marginBottom: 20 }}><RefreshCw size={48} color="var(--accent)"/></div>
                    <h2>Analisando Trabalhos...</h2>
                    <p>Aguarde enquanto o sistema processa cada documento baseado na ementa e critérios pedagógicos.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                      <div className="stat-card" style={{ flex: 1, borderTop: '4px solid var(--green)' }}>
                        <h3>Sucesso</h3>
                        <p>{batchReport?.succeeded || 0} corrigidos</p>
                      </div>
                      <div className="stat-card" style={{ flex: 1, borderTop: '4px solid var(--red)' }}>
                        <h3>Erros</h3>
                        <p>{batchReport?.failed || 0} falhas</p>
                      </div>
                    </div>

                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Aluno</th>
                            <th>Status/Nota</th>
                            <th>Feedback / Erro</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchEntries.map(e => (
                            <tr key={e.id}>
                              <td className="td-name">
                                {dbData.students.find(s => s.id === e.studentId)?.name || 'Aluno'}
                                <br/><span style={{ fontSize: 10, color: 'var(--text2)' }}>{e.filename}</span>
                              </td>
                              <td>
                                {e.status === 'done' ? (
                                  <span className="badge badge-green" style={{ fontSize: 14 }}>{e.result?.grade?.toFixed(1)}</span>
                                ) : (
                                  <span className="badge badge-red">ERRO</span>
                                )}
                              </td>
                              <td style={{ maxWidth: 400 }}>
                                <p style={{ fontSize: 12, lineHeight: 1.4 }} className={e.status === 'error' ? 'text-red' : ''}>
                                  {e.status === 'done' ? e.result?.feedback?.slice(0, 150) + '...' : e.error}
                                </p>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  {e.status === 'done' && (
                                    <>
                                      <button className="btn-icon" onClick={() => setSelected(e.result!)} title="Ver Detalhes">
                                        <ChevronRight size={14}/>
                                      </button>
                                      <button className="btn-icon-danger" onClick={() => del('submission', e.result!.id)} title="Excluir Correção">
                                        <Trash2 size={14}/>
                                      </button>
                                    </>
                                  )}
                                  {e.status === 'error' && (
                                    <button className="btn-icon-danger" onClick={() => setBatchEntries(prev => prev.filter(x => x.id !== e.id))}>
                                      <Trash2 size={14}/>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                      <button className="btn-primary" onClick={async () => { 
                        setBatchStep('upload'); 
                        setBatchEntries([]); 
                        setBatchReport(null); 
                        await apiPost('batch-state', null);
                        await fetchDB();
                      }}>
                        Nova Correção
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* â•â• LANÇAMENTO (COPIA E COLA) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* ── COPIA DE ATIVIDADES ─────────────────────────────────────────────────── */}
        {view === 'copy' && <>
          <header className="header">
            <div><h1>Copia de Atividades</h1><p className="subtitle">Clonar rotinas e avaliações entre matérias</p></div>
            <div className="header-actions">
               <button className="btn-ghost" onClick={() => {
                 setCopySubjectId(''); setCopyDestSubjectId(''); setCopySelectedActs([]); setNewSubjectName('');
               }}><RefreshCw size={14}/> Limpar Tudo</button>
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(380px, 1.2fr)', gap: 24 }} className="fade-in">
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                <Clock size={16} /> 1. Selecionar Origem
              </h3>
              <div>
                <label className="field-label">Matéria de Origem</label>
                <select className="input" value={copySubjectId} onChange={e => {
                  setCopySubjectId(e.target.value);
                  setCopySelectedActs([]);
                }}>
                  <option value="">Selecione a matéria...</option>
                  {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {copySubjectId && (
                <div className="fade-in" style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="field-label" style={{ margin: 0 }}>Atividades disponíveis</label>
                    <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => {
                      const allIds = dbData.activities.filter(a => a.subjectId === copySubjectId).map(a => a.id);
                      setCopySelectedActs(copySelectedActs.length === allIds.length ? [] : allIds);
                    }}>{copySelectedActs.length === dbData.activities.filter(a => a.subjectId === copySubjectId).length ? 'Limpar Seleção' : 'Selecionar Todas'}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {dbData.activities.filter(a => a.subjectId === copySubjectId).map(act => (
                      <label key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'all .2s' }}>
                        <input type="checkbox" checked={copySelectedActs.includes(act.id)} onChange={() => {
                          setCopySelectedActs(prev => prev.includes(act.id) ? prev.filter(i => i !== act.id) : [...prev, act.id]);
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{act.title}</p>
                          <p style={{ fontSize: 10, color: 'var(--text2)' }}>Peso: {act.weight}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="card" style={{ padding: 24, border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                  <Plus size={16} /> 2. Configurar Destino
                </h3>
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="field-label">Matéria de Destino</label>
                    <select className="input" value={copyDestSubjectId} onChange={e => setCopyDestSubjectId(e.target.value)}>
                      <option value="">-- CRIAR NOVA MATÉRIA --</option>
                      {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </select>
                  </div>

                  {!copyDestSubjectId && (
                    <div className="fade-in">
                      <label className="field-label">Nome da Nova Matéria</label>
                      <input className="input" placeholder="Ex: Cálculo III (Copy)" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} />
                    </div>
                  )}

                  <div style={{ padding: '20px', background: 'var(--accent)', color: '#fff', borderRadius: 12, marginTop: 10, opacity: (copySubjectId && copySelectedActs.length > 0 && (copyDestSubjectId || newSubjectName)) ? 1 : 0.4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Layers size={22} />
                      <div>
                        <p style={{ fontSize: 11, opacity: 0.8 }}>Pronto para copiar</p>
                        <p style={{ fontSize: 14, fontWeight: 700 }}>{copySelectedActs.length} {copySelectedActs.length === 1 ? 'atividade' : 'atividades'}</p>
                      </div>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', marginTop: 16, background: '#fff', color: 'var(--accent)', fontWeight: 800, height: 42 }}
                      onClick={handleCopyActivities}
                      disabled={copyProcessing || !copySubjectId || copySelectedActs.length === 0 || (!copyDestSubjectId && !newSubjectName)}
                    >
                      {copyProcessing ? <Sparkles className="spin" size={16} /> : <Check size={16} />} 
                      {copyDestSubjectId ? 'Clonar nas Atividades Atuais' : 'Criar Nova com Atividades'}
                    </button>
                  </div>
                </div>
              </div>

              {copyDestSubjectId && (
                <div className="card fade-in" style={{ padding: 24, background: 'var(--surface2)30' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Conteúdo Atual no Destino</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dbData.activities.filter(a => a.subjectId === copyDestSubjectId).map(act => (
                      <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12 }}>{act.title}</span>
                        <button className="btn-icon-danger" style={{ width: 26, height: 26 }} onClick={() => del('activity', act.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>}

        {/* â•â• RELATÓRIOS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'reports' && (
          <div className="fade-in">
            <header className="header" style={{ marginBottom: 24 }}>
              <div>
                <h1>Relatórios Acadêmicos</h1>
                <p className="subtitle">Gere pautas de notas e faltas em PDF</p>
              </div>
              <button className="btn-icon" onClick={fetchDB} title="Recarregar Dados">
                <RefreshCw size={18} className={loading ? 'spin' : ''}/>
              </button>
            </header>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label className="field-label">Tipo de Relatório</label>
                  <div className="toggle-group" style={{ marginTop: 0 }}>
                    <button className={reportType === 'subject' ? 'active' : ''} onClick={() => setReportType('subject')}>Por Matéria</button>
                    <button className={reportType === 'activity' ? 'active' : ''} onClick={() => setReportType('activity')}>Por Atividade</button>
                  </div>
                </div>
                <div>
                  <label className="field-label">Matéria</label>
                  <select className="input" value={reportSubjectId} onChange={e => {
                    setReportSubjectId(e.target.value);
                    setReportActivityId('');
                  }}>
                    <option value="">Selecione...</option>
                    {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                {reportType === 'activity' && (
                  <div>
                    <label className="field-label">Atividade</label>
                    <select className="input" value={reportActivityId} onChange={e => setReportActivityId(e.target.value)} disabled={!reportSubjectId}>
                      <option value="">Selecione...</option>
                      {dbData.activities.filter(a => a.subjectId === reportSubjectId).map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {reportPreviewData && (
              <div className="fade-in">
                <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>Prévisualização do Relatório</h3>
                      <p style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {reportPreviewData.title} • {reportPreviewData.body.length} alunos identificados
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn-ghost" onClick={() => { setView('batch'); setBatchSubjectId(reportSubjectId); }}>
                        <Layers size={14}/> Ir para Correção
                      </button>
                      <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={async () => {
                        const { jsPDF } = await import('jspdf');
                        const autoTable = (await import('jspdf-autotable')).default;
                        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
                        
                        doc.setFontSize(18);
                        doc.text(dbData.configs.institution || 'Aura AI - Relatório', 14, 20);
                        doc.setFontSize(11);
                        doc.setTextColor(100);
                        doc.text(`Professor: ${dbData.configs.professor || 'Não informado'}`, 14, 28);
                        doc.text(`Matéria: ${reportPreviewData.title}`, 14, 34);
                        doc.text(`Data: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width - 60, 20);

                        autoTable(doc, {
                          head: [reportPreviewData.head],
                          body: reportPreviewData.body,
                          startY: 45,
                          theme: 'grid',
                          styles: { fontSize: reportPreviewData.isMatrix ? 7 : 9, cellPadding: 2 },
                          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
                          columnStyles: !reportPreviewData.isMatrix ? { 3: { cellWidth: 100 } } : undefined
                        });
                        doc.save(`Relatorio_${reportPreviewData.title.replace(/\s+/g, '_')}.pdf`);
                      }}>
                        <BarChart2 size={16}/> Gerar PDF Final
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Atividades Corrigidas</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent2)' }}>{reportPreviewData.stats.totalGraded}</span>
                    </div>
                    <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Média Geral da Turma</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: parseFloat(reportPreviewData.stats.classAvg) >= 7 ? 'var(--blue)' : 'var(--red)' }}>{reportPreviewData.stats.classAvg}</span>
                    </div>
                    <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Taxa de Entrega</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{reportPreviewData.stats.participation}%</span>
                    </div>
                    <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Alunos Ativos</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                        {dbData.students.filter(s => (s.subjectIds || []).includes(reportSubjectId)).length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="table-wrap" style={{ maxHeight: 500, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <table className="table" style={{ fontSize: 11, borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface2)' }}>
                        <tr>
                          {reportPreviewData.head.map((h, i) => (
                            <th key={i} style={{ 
                              whiteSpace: 'nowrap', 
                              background: 'var(--surface2)', 
                              borderBottom: '2px solid var(--border)',
                              padding: '12px 16px',
                              textAlign: 'left'
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportPreviewData.body.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => {
                              const isMatrixGrade = reportPreviewData.isMatrix && (j > 0 && j < (reportPreviewData.head.length - 2) && j % 2 !== 0);
                              const isMatrixAvg = reportPreviewData.isMatrix && j === (reportPreviewData.head.length - 2);
                              const isActivityGrade = !reportPreviewData.isMatrix && j === 1;
                              const isAnyGradeCol = isMatrixGrade || isMatrixAvg || isActivityGrade;
                              
                              let customColor = (j === 0 ? 'var(--text1)' : 'var(--text2)');
                              if (isAnyGradeCol) {
                                const val = parseFloat(cell);
                                customColor = val >= 7 ? 'var(--blue)' : 'var(--red)';
                              }

                              return (
                                <td key={j} style={{ 
                                  padding: '10px 16px',
                                  borderBottom: '1px solid var(--border)',
                                  fontWeight: (j === 0 || isAnyGradeCol) ? 600 : 400,
                                  color: customColor,
                                }}>
                                  {j === 0 ? (
                                    <span className="td-name-link" onClick={() => {
                                      const stu = dbData.students.find(s => s.name === cell);
                                      if (stu) {
                                        setSelectedStudentId(stu.id);
                                        setView('student-profile');
                                      }
                                    }}>
                                      {cell}
                                    </span>
                                  ) : j === 3 && !reportPreviewData.isMatrix ? (
                                    <div style={{ maxWidth: 400, maxHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                      {cell}
                                    </div>
                                  ) : (
                                    cell
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* â• â•  STUDENT PROFILE â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â•  */}
        {view === 'student-profile' && selectedStudentId && (() => {
          const stu = dbData.students.find(s => s.id === selectedStudentId);
          if (!stu) return null;
          const stuSubmissions = dbData.submissions.filter(sub => sub.studentName === stu.name && sub.status === 'graded');
          const avg = stuSubmissions.length > 0 
            ? (stuSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / stuSubmissions.length).toFixed(1)
            : '0.0';

          return (
            <div className="fade-in">
              <header className="header">
                <div>
                  <button className="btn-ghost" onClick={() => setView('reports')} style={{ marginBottom: 12 }}>
                    <ArrowLeft size={14}/> Voltar para Relatórios
                  </button>
                  <h1>Jornada de {stu.name}</h1>
                  <p className="subtitle">Prontuário Acadêmico Detalhado</p>
                </div>
              </header>

              <div className="student-profile-header">
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#fff' }}>
                    <div style={{ margin: 'auto' }}>{stu.name.charAt(0)}</div>
                  </div>
                  <div>
                    <h2 style={{ fontSize: 24, marginBottom: 4 }}>{stu.name}</h2>
                    <div style={{ display: 'flex', gap: 12 }}>
                       <span className="badge badge-gray">RA: {stu.ra || 'N/A'}</span>
                       <span className="badge badge-blue">{stuSubmissions.length} Atividades Realizadas</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="student-stat-card">
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text2)' }}>Média Geral</span>
                    <span style={{ fontSize: 28, fontWeight: 700, color: parseFloat(avg) >= 7 ? 'var(--blue)' : 'var(--red)' }}>{avg}</span>
                  </div>
                  <div className="student-stat-card">
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text2)' }}>Total Faltas</span>
                    <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--yellow)' }}>
                      {(dbData.activities.filter(a => (stu.subjectIds || []).includes(a.subjectId)).length * 2) - (stuSubmissions.length * 2)}
                    </span>
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Linha do Tempo de Atividades</h3>
              <div className="activity-feed">
                {stuSubmissions.length === 0 && (
                  <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
                    Nenhuma atividade avaliada encontrada para este aluno.
                  </div>
                )}
                {stuSubmissions.sort((a,b) => (b.id > a.id ? 1 : -1)).map(sub => {
                  const subDate = sub.submittedAt ? new Date(sub.submittedAt.includes('T') ? sub.submittedAt : parseInt(sub.submittedAt)) : (sub.id && !isNaN(parseInt(sub.id.split('-').pop() || '')) ? new Date(parseInt(sub.id.split('-').pop() || '0')) : new Date());
                  return (
                    <div key={sub.id} className="activity-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent2)', textTransform: 'uppercase' }}>{sub.subject}</span>
                          <h4 style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{getActName(sub.feedback || '') || 'Atividade'}</h4>
                          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                            Avaliado em {subDate.toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: (sub.grade || 0) >= 7 ? 'var(--blue)' : 'var(--red)' }}>
                            {sub.grade?.toFixed(1)}
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text2)' }}>Nota</span>
                        </div>
                      </div>
                      <div className="feedback-box">
                        <div className="feedback-title"><CheckCircle size={12}/> Comentário do Professor</div>
                        <p className="feedback-text">{sub.feedback}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* â•â• IMPLEMENTAÇÃ•ES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'implementacoes' && <>
          <header className="header">
            <div><h1>Implementações</h1><p className="subtitle">Gestão de ideias e categorias</p></div>
            <button className="btn-primary" onClick={() => openImplModal()}><Plus size={16}/> Nova Ideia</button>
          </header>

          <div className="kanban fade-in">
            {(['backlog','validating','approved','done'] as const).map(status => {
              const cfg = IMPL_STATUS[status];
              const cards = dbData.implementacoes.filter(i => i.status === status);
              return (
                <div key={status} className="kanban-col">
                  <div className="kanban-col-header">
                    <span style={{width:8,height:8,borderRadius:'50%',background:cfg.color,display:'inline-block'}}/>
                    {cfg.label}
                    <span style={{marginLeft:'auto',background:'var(--surface2)',borderRadius:20,padding:'1px 7px',fontSize:10}}>{cards.length}</span>
                  </div>
                  <div className="kanban-col-body">
                    {cards.map(imp => (
                      <div key={imp.id} className="kanban-card">
                        {imp.imageUrl && <img src={imp.imageUrl} style={{width:'100%',borderRadius:6,marginBottom:8,height:80,objectFit:'cover'}} alt=""/>}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:4}}>
                          <div>
                            {imp.category && <span style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.05em',color:'var(--text2)',display:'block',marginBottom:2}}>{imp.category}</span>}
                            <p className="kanban-card-title">{imp.title}</p>
                          </div>
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn-icon" onClick={() => openImplModal(imp)}><Edit2 size={12}/></button>
                            <button className="btn-icon-danger" onClick={e => del('implementacao', imp.id)}><Trash2 size={12}/></button>
                          </div>
                        </div>
                        {imp.description && <p className="kanban-card-desc">{imp.description}</p>}
                        <div className="kanban-card-footer">
                          <span className={`badge ${PRIORITY_CONFIG[imp.priority]?.cls}`}>{PRIORITY_CONFIG[imp.priority]?.label}</span>
                        </div>
                        <div style={{display:'flex',gap:8,marginTop:10}}>
                          <button style={{flex:1,fontSize:9}} className="btn-ghost" onClick={() => cycleStatus(imp, true)}>Voltar</button>
                          <button style={{flex:1,fontSize:9}} className="btn-primary" onClick={() => cycleStatus(imp)}>Próximo</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* â•â• SETTINGS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'settings' && <>
          <header className="header">
            <div>
              <h1>Configurações do Sistema</h1>
              <p className="subtitle">Gestão global e personalização da plataforma</p>
            </div>
          </header>
          
          <div className="fade-in" style={{ padding: '0 4px', maxWidth: 1000 }}>
            {/* Database Selection Card */}
            <div className="card" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ background: 'var(--accent)20', padding: 12, borderRadius: 12 }}>
                  <Database size={24} color="var(--accent)"/>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Fonte de Dados</h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)' }}>Determine onde as informações do sistema são armazenadas e lidas.</p>
                </div>
                <div className="toggle-group" style={{ marginTop: 0, minWidth: 260 }}>
                  <button className={dbMode === 'local' ? 'active' : ''} onClick={() => setDbMode('local')}>
                    📂 JSON Local
                  </button>
                  <button className={dbMode === 'remote' ? 'active' : ''} onClick={() => setDbMode('remote')}>
                    â˜ï¸ Supabase Cloud
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, padding: '10px 16px', background: 'var(--surface2)', borderRadius: 8, color: 'var(--text2)', border: '1px solid var(--border)' }}>
                {dbMode === 'remote' 
                  ? '✅ Modo Nuvem ativo: Sincronização em tempo real e persistência global habilitada.' 
                  : '⚠️ Modo Local ativo: Os dados serão salvos apenas no sistema de arquivos deste servidor local.'}
              </div>
            </div>

            {/* Copia de Atividades Quick Access Card */}
            <div className="card" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--border)', background: 'var(--accent)05' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ background: 'var(--accent)20', padding: 12, borderRadius: 12 }}>
                  <Layers size={24} color="var(--accent)"/>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Copia de Atividades</h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)' }}>Clone rotinas pedagógicas e avaliações entre diferentes matérias ou crie novas.</p>
                </div>
                <button className="btn-primary" onClick={() => setView('copy')} style={{ padding: '10px 20px' }}>
                  <Sparkles size={16}/> Iniciar Rotina de Cópia
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Institution & Identity Card */}
              <div className="card" style={{ padding: 24, border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GraduationCap size={18} color="var(--accent)"/> Identidade Institucional
                </h3>
                
                <div style={{ marginBottom: 20 }}>
                  <label className="field-label">Instituição</label>
                  <input className="input" placeholder="Ex: Universidade Aura" value={tempConfigs.institution || ''} onChange={e => setTempConfigs({...tempConfigs, institution: e.target.value})}/>
                </div>
                
                <div style={{ marginBottom: 20 }}>
                  <label className="field-label">Nome do Professor</label>
                  <input className="input" placeholder="Seu Nome completo" value={tempConfigs.professor || ''} onChange={e => setTempConfigs({...tempConfigs, professor: e.target.value})}/>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="field-label">Estilo Pedagógico (O que a IA deve aprender com você?)</label>
                  <textarea 
                    className="input" 
                    rows={4}
                    placeholder="Ex: 'Seja rigoroso com a gramática', 'Foque em citações ABNT', 'Use um tom mais informal e próximo', 'Não dê notas acima de 9 sem mérito excepcional'..." 
                    value={tempConfigs.pedagogical_style || ''} 
                    onChange={e => setTempConfigs({...tempConfigs, pedagogical_style: e.target.value})}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                  <div>
                    <label className="field-label">Nome do Sistema</label>
                    <input className="input" value={tempConfigs.system_name} onChange={e => setTempConfigs({...tempConfigs, system_name: e.target.value})}/>
                  </div>
                  <div>
                    <label className="field-label">Tema Visual</label>
                    <div className="toggle-group">
                      <button className={tempConfigs.theme === 'light' ? 'active' : ''} onClick={() => setTempConfigs({...tempConfigs, theme: 'light'})}>Claro</button>
                      <button className={tempConfigs.theme !== 'light' ? 'active' : ''} onClick={() => setTempConfigs({...tempConfigs, theme: 'dark'})}>Escuro</button>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Cor Principal (Acento)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" className="input" style={{ width: 44, height: 40, padding: 4 }} value={tempConfigs.primary_color} onChange={e => setTempConfigs({...tempConfigs, primary_color: e.target.value})}/>
                      <code style={{ fontSize: 10, color: 'var(--text2)' }}>{tempConfigs.primary_color.toUpperCase()}</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips & Extras Card */}
              <div className="card" style={{ padding: 24, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="var(--accent)"/> Informações Adicionais
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
                  As alterações feitas aqui afetam como o sistema se apresenta para você e nos cabeçalhos dos relatórios PDF gerados.
                </p>
                <div style={{ flex: 1, padding: 16, background: 'var(--surface2)', borderRadius: 12, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text2)' }}>
                  <p style={{ marginBottom: 8, fontWeight: 500, color: 'var(--text)' }}>Dica de Identidade:</p>
                  Use cores com bom contraste para garantir a legibilidade dos menus e botões principais.
                </div>
                
                <div style={{ marginTop: 24 }}>
                  <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => saveSettings(tempConfigs)}>
                    <Check size={18}/> Salvar Todas as Preferências
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>}
      </main>

      {/* â”€â”€ DETAIL PANEL (submissions) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selected && (
        <aside className="detail-panel">
          <div className="detail-header">
            <div><h2>{selected.studentName}</h2><p className="subtitle">{selected.subject}</p></div>
            <button className="btn-close" onClick={() => setSelected(null)}>×</button>
          </div>
          {selected.grade != null && (
            <div className="grade-circle"><span className="grade-big">{selected.grade.toFixed(1)}</span><span className="grade-label">/ 10</span></div>
          )}
          {selected.feedback && (
            <div className="feedback-box">
              <p className="feedback-title"><CheckCircle size={13}/> Comentário do Professor</p>
              <p className="feedback-text">{selected.feedback}</p>
            </div>
          )}
          <div style={{fontSize:12,color:'var(--text2)',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Fonte</span><span className={`badge badge-${selected.source}`}>{selected.source.toUpperCase()}</span></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Data</span><span>{selected.submittedAt}</span></div>
          </div>
        </aside>
      )}

      {/* â•â• MODAL: NOVA MATÉRIA â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showSubjectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editingSubject ? 'Editar Matéria' : 'Nova Matéria'}</h2><button className="btn-close" onClick={() => setShowSubjectModal(false)}>×</button></div>
            <label className="field-label">Nome da disciplina</label>
            <input className="input" placeholder="Ex: Cálculo III" value={newSubData.name} onChange={e => setNewSubData({...newSubData, name: e.target.value})}/>
            <label className="field-label">Código</label>
            <input className="input" placeholder="Ex: MAT303" value={newSubData.code} onChange={e => setNewSubData({...newSubData, code: e.target.value})}/>
            {!editingSubject && <>
              <label className="field-label">Ementa (PDF)</label>
              <input type="file" accept=".pdf" className="input" onChange={e => e.target.files?.[0] && setSyllabusFile(e.target.files[0])}/>
            </>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowSubjectModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveSubject}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* â•â• MODAL: IMPORTAR EMENTA (para matéria existente) â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {syllabusTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Importar Ementa</h2>
              <button className="btn-close" onClick={() => setSyllabusTarget(null)}>×</button>
            </div>
            <p style={{fontSize:13,color:'var(--text2)'}}>Matéria: <b style={{color:'var(--text)'}}>{syllabusTarget.name}</b></p>
            {syllabusChunks(syllabusTarget.syllabus ?? '').length > 0 && (
              <div>
                <p style={{fontSize:11.5,color:'var(--text2)',marginBottom:6}}>Ementa atual ({syllabusChunks(syllabusTarget.syllabus ?? '').length} chunks):</p>
                <div className="syllabus-preview">{syllabusChunks(syllabusTarget.syllabus ?? '')[0]?.slice(0,300)}...</div>
              </div>
            )}
            <label className="drop-zone" onClick={() => document.getElementById('syllabus-imp')?.click()} style={{cursor:'pointer'}}>
              <Upload size={22}/><span>Selecione o PDF da ementa</span>
              <input id="syllabus-imp" type="file" accept=".pdf" style={{display:'none'}}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSyllabusImport(syllabusTarget, f); }}/>
            </label>
            {syllabusUploading && <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text2)'}}><Sparkles size={15} className="spin"/> Processando PDF em chunks...</div>}
            <div className="modal-actions"><button className="btn-ghost" onClick={() => setSyllabusTarget(null)}>Fechar</button></div>
          </div>
        </div>
      )}

      {showStudentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editingStudent ? 'Editar Aluno' : 'Novo Aluno'}</h2><button className="btn-close" onClick={() => setShowStudentModal(false)}>×</button></div>
            <label className="field-label">Nome completo</label>
            <input className="input" placeholder="Ex: MariaSilva" value={newStuData.name} onChange={e => setNewStuData({...newStuData, name: e.target.value})}/>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div>
                <label className="field-label">RA</label>
                <input className="input" placeholder="Ex: 12345" value={newStuData.ra} onChange={e => setNewStuData({...newStuData, ra: e.target.value})}/>
              </div>
              <div>
                <label className="field-label">Turma</label>
                <input className="input" placeholder="Turma A" value={newStuData.turma} onChange={e => setNewStuData({...newStuData, turma: e.target.value})}/>
              </div>
            </div>
            <label className="field-label">Email</label>
            <input className="input" placeholder="Ex: maria@email.com" value={newStuData.email} onChange={e => setNewStuData({...newStuData, email: e.target.value})}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowStudentModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveStudent}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</h2><button className="btn-close" onClick={() => setShowActivityModal(false)}>×</button></div>
            <label className="field-label">Matéria</label>
            <select className="input" value={newActData.subjectId} onChange={e => setNewActData({...newActData, subjectId: e.target.value})}>
              <option value="">Selecione...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="field-label">Título</label>
            <input className="input" value={newActData.title} onChange={e => setNewActData({...newActData, title: e.target.value})}/>
            <label className="field-label">Peso</label>
            <input className="input" type="number" step="0.1" value={newActData.weight} onChange={e => setNewActData({...newActData, weight: parseFloat(e.target.value)})}/>
            <label className="field-label">Critérios IA</label>
            <textarea className="textarea" placeholder="Descreva os critérios..." value={newActData.description} onChange={e => setNewActData({...newActData, description: e.target.value})}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowActivityModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveActivity}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {showImplModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editingImpl ? 'Editar Ideia' : 'Nova Ideia'}</h2><button className="btn-close" onClick={() => setShowImplModal(false)}>âœ•</button></div>
            <label className="field-label">Título</label>
            <input className="input" value={newImpl.title} onChange={e => setNewImpl({...newImpl, title: e.target.value})}/>
            <label className="field-label">Categoria</label>
            <input className="input" placeholder="Ex: UX, Bug, Funcionalidade" value={newImpl.category} onChange={e => setNewImpl({...newImpl, category: e.target.value})}/>
            <label className="field-label">Descrição</label>
            <textarea className="textarea" placeholder="Descreva a ideia..." value={newImpl.description} onChange={e => setNewImpl({...newImpl, description: e.target.value})} onPaste={handleImplPaste}/>
            
            <label className="field-label">Imagem da Ideia (URL ou cole um print)</label>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <input className="input" placeholder="https://... ou cole aqui" value={newImpl.imageUrl.startsWith('data:') ? '[Imagem Colada]' : newImpl.imageUrl} 
                onChange={e => setNewImpl({...newImpl, imageUrl: e.target.value})}
                onPaste={handleImplPaste}/>
              {newImpl.imageUrl && (
                <div style={{position:'relative',width:50,height:50,borderRadius:4,overflow:'hidden',border:'1px solid var(--surface2)'}}>
                  <img src={newImpl.imageUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                  <button onClick={() => setNewImpl({...newImpl, imageUrl: ''})} style={{position:'absolute',top:0,right:0,background:'rgba(0,0,0,0.5)',color:'white',border:'none',cursor:'pointer',fontSize:10}}>×</button>
                </div>
              )}
            </div>
            <p style={{fontSize:10,color:'var(--text2)',marginTop:4}}>Dica: Você pode copiar um print (Ctrl+C) e colar (Ctrl+V) em qualquer campo acima.</p>

            <label className="field-label">Prioridade</label>
            <select className="input" value={newImpl.priority} onChange={e => setNewImpl({...newImpl, priority: e.target.value})}>
              <option value="alta">▲ Alta</option>
              <option value="media">◆ Média</option>
              <option value="baixa">▼ Baixa</option>
            </select>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowImplModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveImpl}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* â•â• MODAL: IMPORTAR ATIVIDADES DO TEXTO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showImportActModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2>Importar Atividades da Ementa</h2>
              <button className="btn-close" onClick={() => setShowImportActModal(false)}>×</button>
            </div>
            
            <label className="field-label">1. Selecione a Matéria de destino</label>
            <select className="input" value={newActData.subjectId} onChange={e => {
              const sid = e.target.value;
              setNewActData({...newActData, subjectId: sid});
              // Auto-fill from syllabus if exists
              const sub = dbData.subjects.find(s => s.id === sid);
              if (sub?.syllabus) {
                const chunks = syllabusChunks(sub.syllabus);
                if (chunks.length > 0) {
                  setActImportText(chunks.join('\n\n'));
                  // We don't auto-parse to allow user to see text first
                }
              }
            }}>
              <option value="">Selecione...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, marginBottom:8}}>
               <label className="field-label" style={{margin:0}}>2. Texto da ementa (Contendo as A.A)</label>
               {newActData.subjectId && dbData.subjects.find(s => s.id === newActData.subjectId)?.syllabus && (
                 <span style={{fontSize:10, color:'#10b981', fontWeight:600}}>✅ Texto carregado automaticamente da ementa PDF</span>
               )}
            </div>
            <textarea 
              className="textarea" 
              style={{height: 150, fontSize:12}} 
              placeholder="Cole aqui o texto da ementa..." 
              value={actImportText}
              onChange={e => setActImportText(e.target.value)}
            />
            
            <button className="btn-ghost" style={{marginTop:12, width:'100%'}} onClick={parseActivitiesFromText}>
              <Sparkles size={14}/> Analisar Texto
            </button>

            {parsedActs.length > 0 && (
              <div style={{marginTop:20}}>
                <label className="field-label">3. Revise as atividades extraídas ({parsedActs.length})</label>
                <div style={{maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg)'}}>
                  {parsedActs.map((act, idx) => (
                    <div key={idx} style={{marginBottom:12, paddingBottom:12, borderBottom: idx === parsedActs.length-1 ? 'none' : '1px solid var(--border)'}}>
                      <div style={{display:'flex', gap:8, marginBottom:4}}>
                        <input className="input" style={{flex:1, fontWeight:600}} value={act.title} onChange={e => {
                          const next = [...parsedActs];
                          next[idx].title = e.target.value;
                          setParsedActs(next);
                        }}/>
                        <button className="btn-icon-danger" onClick={() => setParsedActs(parsedActs.filter((_,i) => i !== idx))}><Trash2 size={12}/></button>
                      </div>
                      <textarea className="textarea" style={{height: 80, fontSize:11}} value={act.description} onChange={e => {
                        const next = [...parsedActs];
                        next[idx].description = e.target.value;
                        setParsedActs(next);
                      }}/>
                    </div>
                  ))}
                </div>
                <div className="modal-actions" style={{marginTop:20}}>
                  <button className="btn-ghost" onClick={() => { setParsedActs([]); setActImportText(''); }}>Limpar</button>
                  <button className="btn-primary" onClick={importParsedActivities}>Importar {parsedActs.length} Atividades</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* â•â• MODAL: UPLOAD INDIVIDUAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>Novo Trabalho</h2><button className="btn-close" onClick={() => setShowUpload(false)}>âœ•</button></div>
            <label className="field-label">Aluno</label>
            <select className="input" value={uploadName} onChange={e => setUploadName(e.target.value)}>
              <option value="">Selecione...</option>
              {dbData.students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="field-label">Matéria</label>
            <select className="input" value={uploadSubject} onChange={e => setUploadSubject(e.target.value)}>
              <option value="">Selecione...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="drop-zone" style={{cursor:'pointer'}} onClick={() => document.getElementById('file-input')?.click()}>
              <Upload size={22}/><span>{uploading ? 'Processando...' : 'Clique ou arraste o PDF'}</span>
              <input id="file-input" type="file" accept=".pdf" style={{display:'none'}} onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}/>
            </label>
            <div className="modal-actions"><button className="btn-ghost" onClick={() => setShowUpload(false)}>Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
