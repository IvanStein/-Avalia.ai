"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload, BookOpen, CheckCircle, Clock, GraduationCap, Sparkles,
  Database, UserPlus, Plus, Trash2, AlertCircle, Layers, X,
  BarChart2, Users, Lightbulb, FileText, ChevronRight, ChevronDown, Edit2,
  ArrowRight, Check, RefreshCw, Copy, Hash, PanelLeftClose, PanelLeftOpen, ArrowLeft
} from "lucide-react";

// â”€â”€ TYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { 
  Subject, Student, Activity, Skill, Implementacao, 
  AppConfig, Submission, DBData, View 
} from "@/lib/types";

// Componentes Modulares
import { Sidebar } from "./components/Sidebar";
import { SubjectsView } from "./components/views/SubjectsView";
import { StudentsView } from "./components/views/StudentsView";
import { ActivitiesView } from "./components/views/ActivitiesView";
import { EnrollmentView } from "./components/views/EnrollmentView";
import { DashboardView } from "./components/views/DashboardView";
import { SkillsView } from "./components/views/SkillsView";
import { ImplementacoesView } from "./components/views/ImplementacoesView";
import { ConsolidatedActivityView } from "./components/views/ConsolidatedActivityView";
import { AuditView } from "./components/views/AuditView";
import { BatchView } from "./components/views/BatchView";
import { CanvasAssistantView } from "./components/views/CanvasAssistantView";
import { ManualGradingView } from "./components/views/ManualGradingView";
import { GradeEntryView } from "./components/views/GradeEntryView";
import { CopyActivitiesView } from "./components/views/CopyActivitiesView";
import { ReportsView } from "./components/views/ReportsView";
import { StudentProfileView } from "./components/views/StudentProfileView";
import { SettingsView } from "./components/views/SettingsView";
import { getStatusConfig } from "./components/StatusPill";

export interface BatchEntry {
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
  subjects: [], students: [], activities: [], implementacoes: [], submissions: [], skills: [],
  configs: { theme: 'dark', primary_color: '#6366f1', institution_name: 'Aval.IA' } 
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
  if (!fl.toLowerCase().includes('atividade:')) return null;
  return fl.split(/atividade:/i)[1].trim();
}

function syllabusChunks(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return raw ? [raw] : []; }
}

// â”€â”€ COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Dashboard() {
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
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Edit states
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editingImpl, setEditingImpl] = useState<Implementacao | null>(null);

  // Forms
  const [newSubData, setNewSubData] = useState({ name: '', code: '' });
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusUploading, setSyllabusUploading] = useState(false);
  const [syllabusTarget, setSyllabusTarget] = useState<Subject | null>(null);

  const [newStuData, setNewStuData] = useState({ name: '', email: '', ra: '', turma: '' });
  const [newActData, setNewActData] = useState({ subjectId: '', title: '', weight: 1, description: '', skillId: '', applicationDate: '', type: 'atividade' as 'atividade' | 'prova' });
  const [newSkillData, setNewSkillData] = useState({ name: '', description: '', promptTemplate: '', model: 'gemini-1.5-flash', responseType: 'text' });
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

    // Filtra submissões válidas (corrigidas e da matéria em questão)
    const rawGradedSubmissions = dbData.submissions.filter(subm => 
      subm.subject === sub?.name && subm.status === 'graded'
    );

    // Garante unicidade por (aluno, atividade) para bater com a lógica exibida na tabela
    const uniqueMap = new Map<string, Submission>();
    rawGradedSubmissions.forEach(subm => {
       const aTitle = getActName(subm.feedback || '') || 'Geral';
       // Se o relatório for de atividade específica, ignora as outras
       if (reportType === 'activity' && aTitle !== act?.title) return;
       
       const key = `${subm.studentName}-${aTitle}`;
       // Mantém apenas a primeira encontrada (padrão do .find() usado na tabela)
       if (!uniqueMap.has(key)) uniqueMap.set(key, subm);
    });

    const gradedSubmissions = Array.from(uniqueMap.values());
    const subjectStudents = dbData.students.filter(s => (s.subjectIds || []).includes(reportSubjectId));

    // Taxa de entrega: (pares aluno-atividade c/ entrega) / (alunos × atividades)
    // Para relatório de atividade: alunos que entregaram / total de alunos
    const numStudents = subjectStudents.length;
    let participation = '0';
    if (numStudents > 0) {
      if (reportType === 'activity') {
        const studentsWithDelivery = new Set(gradedSubmissions.map(gs => gs.studentName));
        participation = ((studentsWithDelivery.size / numStudents) * 100).toFixed(0);
      } else {
        // Modo matéria: conta pares únicos (aluno × atividade) c/ entrega
        const numActs = acts.length;
        if (numActs > 0) {
          const totalPossible = numStudents * numActs;
          participation = ((gradedSubmissions.length / totalPossible) * 100).toFixed(0);
        } else {
          participation = '0';
        }
      }
    }
    
    const stats = {
      totalGraded: gradedSubmissions.length,
      classAvg: gradedSubmissions.length > 0 
        ? (gradedSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / gradedSubmissions.length).toFixed(1)
        : '0.0',
      participation
    };

    return { 
      head, 
      body, 
      title: reportType === 'subject' ? sub?.name : `${sub?.name} - ${act?.title}`, 
      isMatrix: reportType === 'subject', 
      stats,
      applicationDate: act?.applicationDate
    };
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
        skills:          data.skills          ?? [],
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

  // Canvas Helper States
  const [canvSubId, setCanvSubId] = useState('');
  const [canvActTitle, setCanvActTitle] = useState('');
  const [canvActiveSubId, setCanvActiveSubId] = useState<string | null>(null);

  // Audit States
  const [auditSubId, setAuditSubId] = useState<string | null>(null);
  const [auditNote, setAuditNote] = useState('');

  // Manual Lançamento States
  const [manuStu, setManuStu] = useState('');
  const [manuSub, setManuSub] = useState('');
  const [manuAct, setManuAct] = useState('');
  const [manuGrade, setManuGrade] = useState('0.0');
  const [manuFeed, setManuFeed] = useState('');
  const [manuSaving, setManuSaving] = useState(false);

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

  const toggleSubjectClosed = async (id: string, closed: boolean) => {
    setDbData(prev => ({ ...prev, subjects: prev.subjects.map(s => s.id === id ? { ...s, closed: closed } : s) }));
    try { await apiPost('subject-closed', { id, closed }); } 
    catch(e:any) { alert(e.message); await fetchDB(); }
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
    if (a) { 
      setEditingActivity(a); 
      setNewActData({ 
        subjectId: a.subjectId, 
        title: a.title, 
        weight: a.weight, 
        description: a.description || '', 
        skillId: a.skillId || '',
        applicationDate: a.applicationDate || '',
        type: a.type || 'atividade'
      }); 
    }
    else { 
      setEditingActivity(null); 
      setNewActData({ 
        subjectId: '', 
        title: '', 
        weight: 1, 
        description: '', 
        skillId: '',
        applicationDate: '',
        type: 'atividade'
      }); 
    }
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

  // ── SKILL ACTIONS ──────────────────────────────────────────────────────────
  const openSkillModal = (s?: Skill) => {
    if (s) { 
      setEditingSkill(s); 
      setNewSkillData({ 
        name: s.name, 
        description: s.description, 
        promptTemplate: s.promptTemplate, 
        model: s.model, 
        responseType: s.responseType 
      }); 
    }
    else { 
      setEditingSkill(null); 
      setNewSkillData({ 
        name: '', 
        description: '', 
        promptTemplate: '', 
        model: 'gemini-1.5-flash', 
        responseType: 'text' 
      }); 
    }
    setShowSkillModal(true);
  };
  const saveSkill = async () => {
    if (!newSkillData.name || !newSkillData.promptTemplate) return alert('Preencha nome e template do prompt');
    try {
      if (editingSkill) {
        await apiPost('skill-update', { id: editingSkill.id, ...newSkillData });
      } else {
        await apiPost('skill', newSkillData);
      }
      setShowSkillModal(false); await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  const parseActivitiesFromText = () => {
    if (!actImportText.trim()) return;
    
    // Regex based on user pattern: â€¢ A.A 01 (Date): Title ... Instructions: ... Entrega: ...
    const blocks = actImportText.split(/â€¢\s*A\.A/i).filter(b => b.trim());
    const results: Partial<Activity>[] = blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      
      const firstLine = lines[0];
      // Matches pattern "01 (26/02/2026): Title"
      const dateMatch = firstLine.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
      const applicationDate = dateMatch ? dateMatch[1] : '';
      
      const titleMatch = firstLine.match(/\s*\d+\s*(?:\([^)]*\))?:\s*(.*)/i) || firstLine.match(/\s*(\d+.*)/);
      const title = titleMatch ? `A.A ${titleMatch[1]}` : `A.A ${firstLine}`;
      
      const description = lines.slice(1).join('\n');
      
      return { title, description, weight: 1, applicationDate };
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

  const retryBatchEntry = async (entryId: string) => {
    const entry = batchEntries.find(e => e.id === entryId);
    if (!entry || !entry.studentId || !entry.subjectId) return;
    
    setBatchEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: 'processing', error: undefined } : e));
    setBatchRunning(true);
    
    try {
      const stu = dbData.students.find(s => s.id === entry.studentId);
      const sub = dbData.subjects.find(s => s.id === entry.subjectId);
      const activity = dbData.activities.find(a => a.id === batchActivityId);
      if (!stu || !sub) throw new Error('Dados não encontrados');

      const fd = new FormData();
      fd.append('items[0][studentName]', stu.name);
      fd.append('items[0][subject]', sub.name);
      if (activity) {
        fd.append('items[0][activityId]', activity.id);
        fd.append('items[0][activity]', activity.title);
      }
      fd.append('items[0][file]', entry.file);

      const res = await fetch(`/api/grading/batch?mode=${dbMode}`, { method: 'POST', body: fd });
      const report = await res.json();
      if (report.error) throw new Error(report.error);

      setBatchEntries(prev => prev.map(e => {
        if (e.id !== entryId) return e;
        const found = (report.submissions as Submission[]).find(s => s.studentName === stu.name);
        if (found) return { ...e, status: 'done', result: found };
        const err = (report.errors as any[]).find(er => er.studentName === stu.name);
        return { ...e, status: 'error', error: err?.error ?? 'Erro desconhecido' };
      }));
      
      if (report.succeeded > 0) {
        setBatchReport(prev => prev ? { succeeded: prev.succeeded + 1, failed: Math.max(0, prev.failed - 1) } : null);
      }
      await fetchDB();
    } catch (catchErr: any) {
      setBatchEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: 'error', error: catchErr.message } : e));
    } finally {
      setBatchRunning(false);
    }
  };

  const goToManualForEntry = (e: BatchEntry) => {
    setManuStu(e.studentId);
    setManuSub(e.subjectId);
    setManuAct(batchActivityId);
    setView('manual');
  };

  const handleManualSave = async () => {
    if (!manuStu || !manuSub) return alert('Selecione aluno e matéria');
    setManuSaving(true);
    try {
      const stu = dbData.students.find(s => s.id === manuStu);
      const sub = dbData.subjects.find(s => s.id === manuSub);
      const act = dbData.activities.find(a => a.id === manuAct);
      if (!stu || !sub) throw new Error('Dados inválidos');

      const activityPrefix = act ? `Atividade: ${act.title}\n` : '';
      await apiPost('submission', {
        studentName: stu.name,
        subject: sub.name,
        status: "graded",
        grade: parseFloat(manuGrade),
        feedback: activityPrefix + manuFeed,
        source: "pdf", 
        submittedAt: new Date().toISOString().split("T")[0],
      });
      alert('Nota lançada com sucesso!');
      setManuGrade('0.0'); setManuFeed('');
      fetchDB();
      setView('dashboard');
    } catch (e:any) { alert(e.message); }
    setManuSaving(false);
  };
  
  const handleSaveBulkGrades = async (bulkGrades: { studentName: string, grade: number, subject: string, activityTitle: string }[]) => {
    try {
      for (const entry of bulkGrades) {
        const existing = dbData.submissions.find(s => 
          s.studentName === entry.studentName && 
          s.subject === entry.subject && 
          getActName(s.feedback || '') === entry.activityTitle
        );

        const activityPrefix = `Atividade: ${entry.activityTitle}\n`;
        const payload = {
          studentName: entry.studentName,
          subject: entry.subject,
          status: "graded" as const,
          grade: entry.grade,
          feedback: activityPrefix + "Lançamento manual de nota.",
          source: "manual",
          submittedAt: new Date().toISOString().split("T")[0],
        };

        if (existing) {
          await apiPost('submission-update', { id: existing.id, ...payload });
        } else {
          await apiPost('submission', payload);
        }
      }
      await fetchDB();
    } catch (e: any) {
      throw e;
    }
  };

  const handleAuditRequest = async (id: string) => {
    try {
      await apiPost('submission-update', { id, status: 'audit_pending' });
      alert('Solicitação de auditoria enviada com sucesso! O trabalho agora está na fila pedagógica.');
      fetchDB();
    } catch (e: any) { alert(e.message); }
  };

  const handleCopyCloudToLocal = async () => {
    if (!confirm('Esta ação irá SOBRESCREVER sua base LOCAL com os dados da NUVEM. Deseja continuar?')) return;
    try {
      setLoading(true);
      const remoteRes = await fetch('/api/db?mode=remote');
      if (!remoteRes.ok) throw new Error('Falha ao buscar dados remotos');
      const remoteData = await remoteRes.json();
      const res = await apiPost('sync-cloud-to-local', remoteData);
      if (res.error) throw new Error(res.error);
      setDbMode('local');
      fetchDB();
      alert('Base de dados sincronizada com sucesso!');
    } catch (e: any) { alert(`Erro na sincronização: ${e.message}`); }
    finally { setLoading(false); }
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

  const generateAuditReport = () => {
    const audited = dbData.submissions.filter(s => s.status === 'audited');
    if (audited.length === 0) return alert('Nenhum caso auditado para relatório.');
    let csv = "\ufeffAluno;Materia;Nota;Feedback IA;Observações Auditoria;Data\n";
    audited.forEach(s => {
      csv += `"${s.studentName}";"${s.subject}";"${s.grade}";"${(s.feedback || '').replace(/"/g,'""')}";"${(s.auditNotes || '').replace(/"/g,'""')}";"${s.submittedAt}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatónio_Auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const sendToAudit = async (id: string) => {
    if (id.startsWith('missing-')) {
       alert('Não é possível auditar um aluno que não realizou a entrega.');
       return;
    }
    try {
       await apiPost('submission-update', { id, status: 'audit_pending' });
       alert('Enviado para auditoria! Você poderá analisar os casos na tela de Auditoria.');
       await fetchDB();
    } catch (e: any) {
       alert('Erro: ' + e.message);
    }
  };

  const deleteActivitySubmissions = async (subjectId: string, activityTitle: string) => {
    const sub = dbData.subjects.find(s => s.id === subjectId);
    if (!sub) return;
    const toDelete = dbData.submissions.filter(s => s.subject === sub.name && getActName(s.feedback || '') === activityTitle);
    if (toDelete.length === 0) return;
    
    try {
      setLoading(true);
      for (const s of toDelete) {
        await apiDelete('submission', s.id);
      }
      await fetchDB();
    } catch (e: any) { alert("Erro ao apagar: " + e.message); }
    finally { setLoading(false); }
  };

  if (!hasMounted) return null;


  return (
    <div className="app">
      <Sidebar 
        view={view} 
        setView={setView} 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
      />


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
        {view === 'dashboard' && (
          <>
            <DashboardView 
              dbData={dbData}
              onSetView={setView}
              onOpenUpload={() => setShowUpload(true)}
              onOpenStudentModal={() => openStudentModal()}
              onSelectSubmission={setSelected}
              getStatusConfig={getStatusConfig}
              getActName={getActName}
            />
            <ConsolidatedActivityView 
              dbData={dbData}
              expandedSubjects={expandedSubjects}
              setExpandedSubjects={setExpandedSubjects}
              expandedActivities={expandedActivities}
              setExpandedActivities={setExpandedActivities}
              onSelectSubmission={setSelected}
              onDeleteSubmission={(id) => del('submission', id)}
              onDeleteActivitySubmissions={deleteActivitySubmissions}
              onNavigateToBatch={() => setView('batch')}
              getStatusConfig={getStatusConfig}
              getActName={getActName}
            />
          </>
        )}

        {/* â•â• RELATÓRIOS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}


        {/* â•â• MATÉRIAS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'subjects' && (
          <SubjectsView 
            subjects={dbData.subjects}
            onOpenModal={openSubjectModal}
            onDelete={(id) => del('subject', id)}
            onSetSyllabusTarget={setSyllabusTarget}
            syllabusChunks={syllabusChunks}
          />
        )}

        {/* â•â• ALUNOS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {view === 'students' && (
          <StudentsView 
            students={dbData.students}
            subjects={dbData.subjects}
            onOpenModal={openStudentModal}
            onDelete={(id) => del('student', id)}
            onExtractRA={extractRAFromName}
            onImport={handleStudentsImport}
          />
        )}

        {/* â•â• ATIVIDADES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'activities' && (
          <ActivitiesView 
            activities={dbData.activities}
            subjects={dbData.subjects}
            onOpenModal={openActivityModal}
            onDelete={(id) => del('activity', id)}
            onImportFromSyllabus={() => setShowImportActModal(true)}
          />
        )}

        {/* â•â• ENTURMAÇÃO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'enrollment' && (
          <EnrollmentView 
            subjects={dbData.subjects}
            students={dbData.students}
            enrollSubjectId={enrollSubjectId}
            setEnrollSubjectId={setEnrollSubjectId}
            onToggleSubjectClosed={toggleSubjectClosed}
            onToggleStudentEnrollment={toggleStudentEnrollment}
          />
        )}



        {/* â•â• CORREÇÃO EM LOTE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'batch' && (
          <BatchView
            dbData={dbData}
            batchStep={batchStep}
            setBatchStep={setBatchStep}
            batchEntries={batchEntries}
            setBatchEntries={setBatchEntries}
            batchSubjectId={batchSubjectId}
            setBatchSubjectId={setBatchSubjectId}
            batchActivityId={batchActivityId}
            setBatchActivityId={setBatchActivityId}
            batchRunning={batchRunning}
            batchReport={batchReport}
            setBatchReport={setBatchReport}
            onSaveAndExit={saveBatchAndExit}
            onAddFiles={addBatchFiles}
            onUpdateEntry={updateBatch}
            onRunBatch={runBatch}
            onRetryEntry={retryBatchEntry}
            onGoToManual={goToManualForEntry}
            onDeleteSubmission={(id) => del('submission', id)}
            onViewDetails={setSelected}
            onReset={async () => {
              setBatchEntries([]);
              setBatchReport(null);
              setBatchSubjectId('');
              setBatchActivityId('');
              setBatchStep('upload');
              await apiPost('batch-state', null);
            }}
            syllabusChunks={syllabusChunks}
            onAuditRequest={handleAuditRequest}
          />
        )}

        {/* ── ASSISTENTE CANVAS ──────────────────────────────────────────────────────── */}
        {view === 'canvas' && (
          <CanvasAssistantView
            dbData={dbData}
            loading={loading}
            onFetchDB={fetchDB}
            canvSubId={canvSubId}
            setCanvSubId={setCanvSubId}
            canvActTitle={canvActTitle}
            setCanvActTitle={setCanvActTitle}
            canvActiveSubId={canvActiveSubId}
            setCanvActiveSubId={setCanvActiveSubId}
            displayEntries={dbData.students
              .filter(stu => (stu.subjectIds || []).includes(canvSubId))
              .map(stu => {
                 const realSub = dbData.submissions.find(s => 
                   s.studentName === stu.name && 
                   s.subject === dbData.subjects.find(sub => sub.id === canvSubId)?.name && 
                   (canvActTitle ? getActName(s.feedback || '') === canvActTitle : !getActName(s.feedback || ''))
                 );
                 const currentActTitle = canvActTitle || (realSub ? getActName(realSub.feedback || '') : '');
                 const activity = dbData.activities.find(a => a.subjectId === canvSubId && a.title === currentActTitle);
                 
                 return {
                    ...(realSub || {
                      id: `missing-${stu.id}`,
                      studentName: stu.name,
                      subject: dbData.subjects.find(sub => sub.id === canvSubId)?.name || '',
                      grade: 0.0,
                      feedback: canvActTitle ? `Atividade: ${canvActTitle}\nNota 0 e duas faltas` : "Nenhuma avaliação geral encontrada",
                      isMissing: true,
                      status: 'graded' as const
                    }),
                    applicationDate: activity?.applicationDate
                  };
              })
              .sort((a,b) => a.studentName.localeCompare(b.studentName))}
            onSendToAudit={sendToAudit}
            getActName={getActName}
          />
        )}

        {view === 'manual' && (
          <ManualGradingView
            dbData={dbData}
            manuStu={manuStu}
            setManuStu={setManuStu}
            manuSub={manuSub}
            setManuSub={setManuSub}
            manuAct={manuAct}
            setManuAct={setManuAct}
            manuGrade={manuGrade}
            setManuGrade={setManuGrade}
            manuFeed={manuFeed}
            setManuFeed={setManuFeed}
            manuSaving={manuSaving}
            onSave={handleManualSave}
            onCancel={() => setView('dashboard')}
          />
        )}

        {view === 'grade-entry' && (
          <GradeEntryView 
            dbData={dbData}
            onSaveGrades={handleSaveBulkGrades}
            getStatusConfig={getStatusConfig}
            getActName={getActName}
          />
        )}

        {/* â•â• LANÇAMENTO (COPIA E COLA) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* ── LANÇAMENTO (COPIA E COLA) ────────────────────────────────────────── */}
        {view === 'copy' && (
          <CopyActivitiesView
            dbData={dbData}
            copySubjectId={copySubjectId}
            setCopySubjectId={setCopySubjectId}
            copyDestSubjectId={copyDestSubjectId}
            setCopyDestSubjectId={setCopyDestSubjectId}
            copySelectedActs={copySelectedActs}
            setCopySelectedActs={setCopySelectedActs}
            newSubjectName={newSubjectName}
            setNewSubjectName={setNewSubjectName}
            copyProcessing={copyProcessing}
            onCopy={handleCopyActivities}
            onDelete={del}
            onReset={() => {
              setCopySubjectId(''); setCopyDestSubjectId(''); setCopySelectedActs([]); setNewSubjectName('');
            }}
          />
        )}

        {/* ── RELATÓRIOS ────────────────────────────────────────────────────────── */}
        {view === 'reports' && (
          <ReportsView
            dbData={dbData}
            loading={loading}
            onFetchDB={fetchDB}
            reportType={reportType}
            setReportType={setReportType}
            reportSubjectId={reportSubjectId}
            setReportSubjectId={setReportSubjectId}
            reportActivityId={reportActivityId}
            setReportActivityId={setReportActivityId}
            reportPreviewData={reportPreviewData}
            onGoToBatch={(subId) => { setView('batch'); setBatchSubjectId(subId); }}
            onGeneratePDF={async (data) => {
               const { jsPDF } = await import('jspdf');
               const autoTable = (await import('jspdf-autotable')).default;
               const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
               doc.setFontSize(18);
               doc.text(dbData.configs.institution_name || 'Aval.IA - Relatório', 14, 20);
               doc.setFontSize(11);
               doc.setTextColor(100);
                doc.text(`Professor: ${dbData.configs.professor || 'Não informado'}`, 14, 28);
                doc.text(`Matéria: ${data.title}`, 14, 34);
                if (data.applicationDate) {
                  doc.text(`Data de Aplicação: ${data.applicationDate}`, 14, 40);
                }
                doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width - 60, 20);
               autoTable(doc, {
                 head: [data.head],
                 body: data.body,
                 startY: 45,
                 theme: 'grid',
                 styles: { fontSize: data.isMatrix ? 7 : 9, cellPadding: 2 },
                 headStyles: { fillColor: [99, 102, 241], textColor: 255 },
                 columnStyles: !data.isMatrix ? { 3: { cellWidth: 100 } } : undefined
               });
               doc.save(`Relatorio_${data.title.replace(/\s+/g, '_')}.pdf`);
            }}
            onOpenStudentProfile={(id) => { setSelectedStudentId(id); setView('student-profile'); }}
          />
        )}

        {view === 'audit' && (
          <AuditView
            dbData={dbData}
            auditSubId={auditSubId}
            setAuditSubId={setAuditSubId}
            auditNote={auditNote}
            setAuditNote={setAuditNote}
            onSaveAudit={async (finish) => {
              const pendingList = dbData.submissions.filter(s => s.status === 'audit_pending');
              const activeAudit = pendingList.find(s => s.id === auditSubId) || pendingList[0];
              if (!activeAudit) return;
              try {
                await apiPost('submission-update', { 
                  id: activeAudit.id, 
                  auditNotes: auditNote,
                  status: finish ? 'audited' : 'audit_pending'
                });
                if (finish) {
                  // Avança para o próximo caso da fila (excluindo o atual)
                  const remaining = pendingList.filter(s => s.id !== activeAudit.id);
                  const nextId = remaining.length > 0 ? remaining[0].id : null;
                  setAuditSubId(nextId);
                  setAuditNote('');
                }
                alert(finish ? 'Auditoria finalizada! Avançando para o próximo caso.' : 'Observação salva com sucesso.');
                fetchDB();
              } catch (e: any) { alert(e.message); }
            }}
            onGenerateReport={generateAuditReport}
            getActName={getActName}
          />
        )}
        {view === 'student-profile' && selectedStudentId && (() => {
          const stu = dbData.students.find(s => s.id === selectedStudentId);
          if (!stu) return null;
          return (
            <StudentProfileView
              student={stu}
              dbData={dbData}
              onBack={() => setView('reports')}
              onViewSubmission={setSelected}
            />
          );
        })()}

        {/* â•â• IMPLEMENTAÇÃ•ES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•= */}
        {view === 'implementacoes' && (
          <ImplementacoesView 
            dbData={dbData}
            onOpenModal={openImplModal}
            onDelete={(id) => del('implementacao', id)}
            implStatus={IMPL_STATUS}
          />
        )}

        {view === 'skills' && (
          <SkillsView 
            skills={dbData.skills}
            onOpenModal={openSkillModal}
            onDelete={(id) => del('skill', id)}
          />
        )}

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
                    ☁️ Supabase Cloud
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, color: 'var(--text2)', border: '1px solid var(--border)' }}>
                <div>
                  {dbMode === 'remote' 
                    ? '✅ Modo Nuvem ativo: Sincronização em tempo real e persistência global habilitada.' 
                    : '⚠️ Modo Local ativo: Os dados serão salvos apenas no sistema de arquivos deste servidor local.'}
                </div>
                {dbMode === 'local' && (
                  <button className="btn-ghost" style={{ background: 'var(--surface1)', padding: '6px 12px', height: 'auto', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }} 
                    disabled={loading} onClick={handleCopyCloudToLocal}>
                    {loading ? <RefreshCw className="spin" size={12}/> : <RefreshCw size={12}/>}
                    Baixar Base da Nuvem
                  </button>
                )}
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
            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12}}>
              <div>
                <label className="field-label">Título</label>
                <input className="input" value={newActData.title} onChange={e => setNewActData({...newActData, title: e.target.value})}/>
              </div>
              <div>
                <label className="field-label">Data de Aplicação</label>
                <input className="input" placeholder="dd/mm/aaaa" value={newActData.applicationDate} onChange={e => setNewActData({...newActData, applicationDate: e.target.value})}/>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div>
                <label className="field-label">Peso</label>
                <input className="input" type="number" step="0.1" value={newActData.weight} onChange={e => setNewActData({...newActData, weight: parseFloat(e.target.value)})}/>
              </div>
              <div>
                <label className="field-label">Tipo de Avaliação</label>
                <select className="input" value={newActData.type} onChange={e => setNewActData({...newActData, type: e.target.value as 'atividade' | 'prova'})}>
                  <option value="atividade">Atividade Normal</option>
                  <option value="prova">Prova (Direta)</option>
                </select>
              </div>
            </div>
            <label className="field-label">Habilidade AI de Correção</label>
            <select className="input" value={newActData.skillId} onChange={e => setNewActData({...newActData, skillId: e.target.value})}>
              <option value="">Padrão (Dissertativa)</option>
              {dbData.skills.map(sk => <option key={sk.id} value={sk.id}>{sk.name}</option>)}
              <option value="divider" disabled>──────────</option>
              <option value="001">Sistema: Dissertativa</option>
              <option value="002">Sistema: Objetiva (Gabarito)</option>
              <option value="divider2" disabled>──────────</option>
              <option value="010">Sistema: Code Reviewer (Python)</option>
              <option value="011">Sistema: Test Generator (Pytest)</option>
              <option value="012">Sistema: Modular Architect (Skeleton)</option>
              <option value="013">Sistema: Google Bridge (Sheets/Drive)</option>
            </select>
            <label className="field-label">Diretrizes Pedagógicas</label>
            <textarea className="textarea" placeholder="Descreva os critérios de avaliação e o estilo esperado..." value={newActData.description} onChange={e => setNewActData({...newActData, description: e.target.value})}/>
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
      {/* ── MODAL: NOVA HABILIDADE ─────────────────────────────────────────── */}
      {showSkillModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>{editingSkill ? 'Editar Habilidade' : 'Nova Habilidade de IA'}</h2>
              <button className="btn-close" onClick={() => setShowSkillModal(false)}>×</button>
            </div>

            <label className="field-label">Nome da Habilidade</label>
            <input
              className="input"
              placeholder="Ex: Correção de Relatório Técnico"
              value={newSkillData.name}
              onChange={e => setNewSkillData({ ...newSkillData, name: e.target.value })}
            />

            <label className="field-label">Descrição (opcional)</label>
            <input
              className="input"
              placeholder="Ex: Avalia relatórios com foco em estrutura e ABNT"
              value={newSkillData.description}
              onChange={e => setNewSkillData({ ...newSkillData, description: e.target.value })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="field-label">Modelo de IA</label>
                <select className="input" value={newSkillData.model} onChange={e => setNewSkillData({ ...newSkillData, model: e.target.value })}>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Mais rápido)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Mais potente)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Tipo de Resposta</label>
                <select className="input" value={newSkillData.responseType} onChange={e => setNewSkillData({ ...newSkillData, responseType: e.target.value })}>
                  <option value="json">⚙ JSON (Estruturado)</option>
                  <option value="text">📝 Texto (Livre)</option>
                </select>
              </div>
            </div>

            <label className="field-label">Template do Prompt *</label>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>
              Use <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>{'${student_name}'}</code>,{' '}
              <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>{'${subject}'}</code>,{' '}
              <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>{'${student_text}'}</code>{' '}
              para substituição automática.
            </p>
            <textarea
              className="textarea"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              placeholder={'Você é um avaliador pedagógico...\n\nAvalie o texto de ${student_name} na matéria ${subject}:\n\n${student_text}\n\nRetorne um JSON com { grade: number, feedback: string }.'}
              value={newSkillData.promptTemplate}
              onChange={e => setNewSkillData({ ...newSkillData, promptTemplate: e.target.value })}
            />

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowSkillModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveSkill}>
                <Sparkles size={15} /> {editingSkill ? 'Salvar Alterações' : 'Criar Habilidade'}
              </button>
            </div>
          </div>
        </div>
      )}

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
