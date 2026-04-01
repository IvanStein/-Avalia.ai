"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload, BookOpen, CheckCircle, Clock, GraduationCap, Sparkles,
  Database, UserPlus, Plus, Trash2, AlertCircle, Layers, X,
  BarChart2, Users, Lightbulb, FileText, ChevronRight, Edit2,
  ArrowRight, Check, RefreshCw, Copy, Hash
} from "lucide-react";

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Subject       { id: string; name: string; code: string; syllabus?: string; closed?: boolean; }
interface Student       { id: string; name: string; email: string; ra?: string; turma?: string; subjectIds?: string[]; }
interface Activity      { id: string; subjectId: string; title: string; weight: number; description?: string; }
interface Implementacao { id: string; title: string; description: string; status: string; priority: string; createdAt: string; category?: string; imageUrl?: string; }
interface AppConfig     { system_name: string; primary_color: string; institution?: string; professor?: string; }
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
  configs: { system_name: 'Avalia.ai', primary_color: '#6366f1' } 
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');
}

function matchStudentByFilename(filename: string, students: Student[]): { studentId: string; name: string; score: number } {
  const fname = normalize(filename.replace(/\.pdf$/i, ''));
  const fnWords = fname.split(/\s+/).filter(Boolean);

  let best = { studentId: '', name: '', score: 0 };
  for (const s of students) {
    const snWords = normalize(s.name).split(/\s+/).filter(Boolean);
    let hits = 0;
    for (const fw of fnWords) {
      if (snWords.some(sw => sw.startsWith(fw) || fw.startsWith(sw))) hits++;
    }
    const score = snWords.length ? hits / snWords.length : 0;
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

function syllabusChunks(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return raw ? [raw] : []; }
}

// ── COMPONENT ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  type View = 'dashboard'|'subjects'|'students'|'enrollment'|'activities'|'batch'|'implementacoes'|'settings'|'copy'|'reports';
  const [view, setView] = useState<View>('dashboard');
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

  // Reports state
  const [reportType, setReportType] = useState<'activity'|'subject'>('subject');
  const [reportSubjectId, setReportSubjectId] = useState('');
  const [reportActivityId, setReportActivityId] = useState('');

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

  // ── GENERIC CRUD ───────────────────────────────────────────────────────
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

  // ── SUBJECT ACTIONS ────────────────────────────────────────────────────
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

  // ── STUDENT ACTIONS ────────────────────────────────────────────────────
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

  // ── ACTIVITY ACTIONS ───────────────────────────────────────────────────
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
    
    // Regex based on user pattern: • A.A 01 (Date): Title ... Instructions: ... Entrega: ...
    const blocks = actImportText.split(/•\s*A\.A/i).filter(b => b.trim());
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

  // ── IMPLEMENTATION ACTIONS ─────────────────────────────────────────────
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

  // ── SETTINGS ──────────────────────────────────────────────────────────
  const saveSettings = async (configsToSave?: AppConfig) => {
    try {
      await apiPost('configs', configsToSave || tempConfigs);
      alert('Configurações salvas!');
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  // ── SINGLE UPLOAD ──────────────────────────────────────────────────────
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

  // ── BATCH ACTIONS ──────────────────────────────────────────────────────
  const addBatchFiles = (files: FileList) => {
    const entries: BatchEntry[] = Array.from(files).map(file => {
      const match = matchStudentByFilename(file.name, dbData.students);
      const isGoodMatch = match.score >= 0.3; // Limiar reduzido para melhor matching
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
    const valid = batchEntries.filter(e => e.studentId && e.subjectId);
    if (!valid.length) return alert('Configure aluno e matéria para ao menos um item');
    setBatchRunning(true);
    setBatchStep('results');
    setBatchEntries(prev => prev.map(e =>
      e.studentId && e.subjectId ? { ...e, status: 'processing' } : e
    ));
    try {
      // Clear batch state on DB once started processing to fresh restart if needed
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
        if (activity) fd.append(`items[${i}][activity]`, activity.title);
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
      setBatchEntries(prev => prev.map(e => e.status === 'processing' ? { ...e, status: 'error', error: 'Falha na requisição' } : e));
    } finally { setBatchRunning(false); }
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
          sub.studentName === stu.name && sub.subject === subject.name && sub.status === 'graded'
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

  // ── NAV ────────────────────────────────────────────────────────────────
  const NavItem = ({ v, icon: Icon, label }: { v: View; icon: any; label: string }) => (
    <button className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
      <Icon size={16} strokeWidth={1.8} /> {label}
    </button>
  );

  return (
    <div className="app">
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="logo"><GraduationCap size={26} strokeWidth={1.5}/><span>AvalIA</span></div>
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
          <NavItem v="copy"           icon={CheckCircle} label="Lançamento Canvas"/>
          <NavItem v="reports"        icon={BarChart2}   label="Relatórios"/>
          <p className="nav-label">Sistema</p>
          <NavItem v="implementacoes" icon={Lightbulb}   label="Implementações"/>
          <NavItem v="settings"       icon={Database}    label="Configurações"/>
        </nav>
        <div style={{marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 10, color: 'var(--text2)', fontFamily: 'monospace'}}>
          v0.1.0-alpha.1
        </div>
      </aside>


      {/* ══ MAIN ══════════════════════════════════════════════════════ */}
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

        {/* ══ DASHBOARD ══════════════════════════════════════════════════ */}
        {view === 'dashboard' && <>
          <header className="header">
            <div><h1>Painel de Avaliações</h1><p className="subtitle">Visão Geral do Sistema</p></div>
            <button className="btn-primary" onClick={() => setShowUpload(true)}><Upload size={16}/> Novo Trabalho</button>
          </header>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}} className="fade-in">
            <div className="stat-card" style={{background:'var(--surface)',padding:16,borderRadius:12,border:'1px solid var(--border)'}}>
              <h3 style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>Total de Alunos</h3>
              <p style={{fontSize:24,fontWeight:600}}>{dbData.students.length}</p>
            </div>
            <div className="stat-card" style={{background:'var(--surface)',padding:16,borderRadius:12,border:'1px solid var(--border)'}}>
              <h3 style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>Total de Matérias</h3>
              <p style={{fontSize:24,fontWeight:600}}>{dbData.subjects.length}</p>
            </div>
            <div className="stat-card" style={{background:'var(--surface)',padding:16,borderRadius:12,border:'1px solid var(--border)'}}>
              <h3 style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>Total de Avaliações</h3>
              <p style={{fontSize:24,fontWeight:600}}>{dbData.activities.length}</p>
            </div>
            <div className="stat-card" style={{background:'var(--surface)',padding:16,borderRadius:12,border:'1px solid var(--border)'}}>
              <h3 style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>Correções Realizadas</h3>
              <p style={{fontSize:24,fontWeight:600}}>{dbData.submissions.filter(s => s.status === 'graded').length}</p>
            </div>
          </div>

          <h2 style={{fontSize:16, marginBottom:20, display:'flex', alignItems:'center', gap:8}}>
            <Layers size={18} color="var(--accent)"/> Histórico de Correções Agrupadas
          </h2>
          
          <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:28}}>
            {dbData.subjects.filter(sub => dbData.submissions.some(s => s.subject === sub.name)).sort((a,b) => a.name.localeCompare(b.name)).map(subject => {
              const subjectSubs = dbData.submissions.filter(s => s.subject === subject.name);
              
              // Group submissions of this subject by activity
              const activityGroups = subjectSubs.reduce((acc, sub) => {
                const actName = sub.feedback?.split('\n')[0]?.includes('Atividade:') 
                  ? sub.feedback.split('\n')[0].replace('Atividade:', '').trim() 
                  : 'Geral';
                if (!acc[actName]) acc[actName] = [];
                acc[actName].push(sub);
                return acc;
              }, {} as Record<string, Submission[]>);

              return (
                <div key={subject.id} className="card" style={{padding:0, overflow:'hidden', border:'1px solid var(--border)'}}>
                  <div style={{background:'var(--surface2)', padding:'12px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h3 style={{fontSize:14, fontWeight:700, color:'var(--accent)', display:'flex', alignItems:'center', gap:8}}>
                      <BookOpen size={16}/> {subject.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="badge" style={{fontSize:10}}>{subjectSubs.length} correções</span>
                      <button 
                        className="btn-icon-danger" 
                        style={{ padding: '2px 8px', height: 'auto', fontSize: 10, background: '#ef444415' }} 
                        onClick={() => deleteActivityCorrections(subject.name)}
                        title={`Apagar todas as correções de ${subject.name}`}
                      >
                        <Trash2 size={12}/> Limpar Matéria
                      </button>
                    </div>
                  </div>
                  
                  <div style={{padding:'10px 20px 20px'}}>
                    {Object.entries(activityGroups).map(([actTitle, subs]) => (
                      <div key={actTitle} style={{marginTop:16}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                          <h4 style={{fontSize:12, fontWeight:600, color:'var(--text1)', display:'flex', alignItems:'center', gap:6, opacity:0.8}}>
                            <Sparkles size={14} color="#10b981"/> {actTitle}
                          </h4>
                          <button 
                            className="btn-icon-danger" 
                            style={{padding:4, height:'auto', width:'auto'}} 
                            title={`Apagar todas as ${subs.length} correções de ${actTitle}`}
                            onClick={() => deleteActivityCorrections(subject.name, actTitle)}
                          >
                            <Trash2 size={12}/> <span style={{fontSize:10}}>Limpar Atividade</span>
                          </button>
                        </div>
                        <div className="table-wrap" style={{border:'none', borderRadius:8, background:'var(--bg)'}}>
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
                                        <cfg.icon size={11}/> {sub.grade?.toFixed(1) ?? '–'}
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
                      </div>
                    ))}
                  </div>
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

        {/* ══ MATÉRIAS ═══════════════════════════════════════════════════ */}
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

        {/* ══ ALUNOS ═════════════════════════════════════════════════════ */}
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

        {/* ══ ATIVIDADES ════════════════════════════════════════════════= */}
        {view === 'activities' && <>
          <header className="header">
            <div><h1>Atividades</h1><p className="subtitle">{dbData.activities.length} avaliações</p></div>
            <div className="header-actions">
              <button className="btn-ghost" onClick={() => setShowImportActModal(true)}><Sparkles size={16}/> Importar da Ementa</button>
              <button className="btn-primary" onClick={() => openActivityModal()}><Plus size={16}/> Nova Atividade</button>
            </div>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Título</th><th>Matéria</th><th>Peso</th><th>Critério IA</th><th></th></tr></thead>
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

        {/* ══ ENTURMAÇÃO ════════════════════════════════════════════════= */}
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



        {/* ══ CORREÇÃO EM LOTE ══════════════════════════════════════════= */}
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
                          <option value="">Selecionar aluno…</option>
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
                        <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>O sistema usará o novo modelo <b>Gemini 2.0 Flash-Lite</b> para uma análise ultra-rápida e precisa.</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn-ghost" onClick={() => setBatchStep('upload')}>Voltar</button>
                    <button className="btn-primary" onClick={runBatch}>
                      <Sparkles size={16}/> Enviar para Correção
                    </button>
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
                    <h2>Corrigindo Trabalhos...</h2>
                    <p>Aguarde enquanto a IA analisa cada documento baseado na ementa e critérios.</p>
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

        {/* ══ LANÇAMENTO (COPIA E COLA) ══════════════════════════════════════════ */}
        {view === 'copy' && (
          <div className="fade-in">
            <header className="header" style={{ marginBottom: 24 }}>
              <div>
                <h1>Lançamento Canvas</h1>
                <p className="subtitle">Interface de apoio para o sistema da faculdade</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={exportToCanvasCSV} disabled={!copySubjectId || !copyActivityId}>
                  <Upload size={16}/> Exportar CSV para Canvas
                </button>
                <button className="btn-icon" onClick={fetchDB} title="Recarregar Dados">
                  <RefreshCw size={18} className={loading ? 'spin' : ''}/>
                </button>
              </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div className="card" style={{ padding: 24 }}>
                <label className="field-label">1. Selecione a Matéria</label>
                <select className="input" style={{ width: '100%' }} value={copySubjectId} onChange={e => {
                  setCopySubjectId(e.target.value);
                  setCopyActivityId('');
                }}>
                  <option value="">Selecione...</option>
                  {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <label className="field-label">2. Selecione a Atividade</label>
                <select className="input" style={{ width: '100%' }} value={copyActivityId} onChange={e => setCopyActivityId(e.target.value)} disabled={!copySubjectId}>
                  <option value="">Selecione...</option>
                  {dbData.activities.filter(a => a.subjectId === copySubjectId).map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {copySubjectId && copyActivityId && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '250px' }}>Nome do Aluno</th>
                      <th style={{ width: '100px' }}>Nota</th>
                      <th>Conceito / Feedback</th>
                      <th style={{ width: '120px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbData.students
                      .filter(s => (s.subjectIds || []).includes(copySubjectId))
                      .sort((a,b) => a.name.localeCompare(b.name))
                      .map(stu => {
                        const subName = dbData.subjects.find(s => s.id === copySubjectId)?.name;
                        const matchingSubmission = dbData.submissions.find(sub => 
                          sub.studentName === stu.name && sub.subject === subName && sub.status === 'graded'
                        );

                        const gradeValue = matchingSubmission ? matchingSubmission.grade?.toFixed(1) : "0.0";
                        const feedbackText = matchingSubmission 
                          ? matchingSubmission.feedback 
                          : "nota 0 e duas faltas";

                        return (
                          <tr key={stu.id} style={{ 
                            background: matchingSubmission ? 'transparent' : '#ef444408',
                            borderLeft: matchingSubmission ? 'none' : '3px solid var(--red)'
                          }}>
                            <td className="td-name">
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{stu.name}</span>
                                {!matchingSubmission && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 500 }}>AUSENTE</span>}
                              </div>
                            </td>
                            <td>
                              <span style={{ 
                                fontWeight: 700, 
                                fontSize: 14,
                                color: matchingSubmission ? 'var(--green)' : 'var(--red)',
                                background: matchingSubmission ? 'var(--green)15' : 'var(--red)15',
                                padding: '4px 8px',
                                borderRadius: 6,
                                minWidth: 45,
                                textAlign: 'center',
                                display: 'inline-block'
                              }}>
                                {gradeValue}
                              </span>
                            </td>
                            <td style={{ maxWidth: 0, width: '100%' }}>
                              <div style={{ 
                                fontSize: 12, 
                                color: 'var(--text2)', 
                                background: 'var(--surface2)', 
                                padding: '8px 12px', 
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block'
                              }} title={feedbackText}>
                                {feedbackText}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn-icon" style={{ background: 'var(--surface3)' }} title="Copiar Nota" onClick={() => {
                                  navigator.clipboard.writeText(gradeValue || "0.0");
                                }}>
                                  <BarChart2 size={15}/>
                                </button>
                                <button className="btn-icon" style={{ background: 'var(--accent)20', color: 'var(--accent2)' }} title="Copiar Feedback" onClick={() => {
                                  navigator.clipboard.writeText(feedbackText || "");
                                }}>
                                  <Copy size={15}/>
                                </button>
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
        )}

        {/* ══ RELATÓRIOS ══════════════════════════════════════════════════════════ */}
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

            {reportSubjectId && (reportType === 'subject' || reportActivityId) && (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <BarChart2 size={48} color="var(--accent)" style={{ marginBottom: 16, opacity: 0.5 }} />
                <h3>{reportType === 'subject' ? 'Relatório Geral da Matéria' : 'Relatório por Atividade'}</h3>
                <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
                  {reportType === 'subject' 
                    ? 'Lista horizontal com todas as atividades, notas finais e faltas totais.'
                    : 'Lista detalhada com nota, resumo da correção e faltas desta atividade específica.'}
                </p>
                <button className="btn-primary" style={{ padding: '12px 32px' }} onClick={async () => {
                  const { jsPDF } = await import('jspdf');
                  const autoTable = (await import('jspdf-autotable')).default;
                  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
                  const sub = dbData.subjects.find(s => s.id === reportSubjectId);
                  
                  // Header using global settings
                  doc.setFontSize(18);
                  doc.text(dbData.configs.institution || 'Relatório de Notas', 14, 20);
                  doc.setFontSize(11);
                  doc.setTextColor(100);
                  doc.text(`Professor: ${dbData.configs.professor || 'Não informado'}`, 14, 28);
                  doc.text(`Matéria: ${sub?.name} (${sub?.code})`, 14, 34);
                  if (reportType === 'activity') {
                    const act = dbData.activities.find(a => a.id === reportActivityId);
                    doc.text(`Atividade: ${act?.title}`, 14, 40);
                  }
                  doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width - 60, 20);

                  let head: string[][] = [];
                  let body: string[][] = [];

                  if (reportType === 'subject') {
                    const acts = dbData.activities.filter(a => a.subjectId === reportSubjectId);
                    head = [['Aluno', ...acts.flatMap(a => [`${a.title} (N)`, `${a.title} (F)`]), 'Média Final', 'Total Faltas']];
                    body = dbData.students
                      .filter(s => (s.subjectIds || []).includes(reportSubjectId))
                      .sort((a,b) => a.name.localeCompare(b.name))
                      .map(stu => {
                        let totalGrade = 0; let totalAbsences = 0;
                        const row = [stu.name];
                        acts.forEach(a => {
                          const subName = dbData.subjects.find(s => s.id === reportSubjectId)?.name;
                          const submission = dbData.submissions.find(sub => 
                            sub.studentName === stu.name && sub.subject === subName && sub.status === 'graded'
                          );
                          if (submission) {
                            row.push(submission.grade?.toFixed(1) || '0.0'); row.push('0');
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
                    head = [['Aluno', 'Nota', 'Faltas', 'Resumo da Correção']];
                    body = dbData.students
                      .filter(s => (s.subjectIds || []).includes(reportSubjectId))
                      .sort((a,b) => a.name.localeCompare(b.name))
                      .map(stu => {
                        const subName = dbData.subjects.find(s => s.id === reportSubjectId)?.name;
                        const submission = dbData.submissions.find(sub => 
                          sub.studentName === stu.name && sub.subject === subName && sub.status === 'graded'
                        );
                        if (submission) {
                          return [stu.name, submission.grade?.toFixed(1) || '0.0', '0', submission.feedback || 'Sem feedback'];
                        }
                        return [stu.name, '0.0', '2', 'Não entregou / Ausente'];
                      });
                  }

                  autoTable(doc, {
                    head, body, startY: reportType === 'subject' ? 45 : 50,
                    theme: 'grid', styles: { fontSize: reportType === 'subject' ? 7 : 9, cellPadding: 2 },
                    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
                    columnStyles: reportType === 'activity' ? { 3: { cellWidth: 120 } } : undefined
                  });

                  doc.save(`Relatorio_${sub?.code || 'Aura'}_${reportType}.pdf`);
                }}>
                  Gerar PDF ({reportType === 'subject' ? 'Matéria' : 'Atividade'})
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ IMPLEMENTAÇÕES ════════════════════════════════════════════= */}
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

        {/* ══ SETTINGS ═══════════════════════════════════════════════════ */}
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
              <div style={{ fontSize: 12, padding: '10px 16px', background: 'var(--surface2)', borderRadius: 8, color: 'var(--text2)', border: '1px solid var(--border)' }}>
                {dbMode === 'remote' 
                  ? '✓ Modo Nuvem ativo: Sincronização em tempo real e persistência global habilitada.' 
                  : '⚠ Modo Local ativo: Os dados serão salvos apenas no sistema de arquivos deste servidor local.'}
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

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                  <div>
                    <label className="field-label">Nome do Sistema</label>
                    <input className="input" value={tempConfigs.system_name} onChange={e => setTempConfigs({...tempConfigs, system_name: e.target.value})}/>
                  </div>
                  <div>
                    <label className="field-label">Cor Principal</label>
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

      {/* ── DETAIL PANEL (submissions) ────────────────────────────────── */}
      {selected && (
        <aside className="detail-panel">
          <div className="detail-header">
            <div><h2>{selected.studentName}</h2><p className="subtitle">{selected.subject}</p></div>
            <button className="btn-close" onClick={() => setSelected(null)}>✕</button>
          </div>
          {selected.grade != null && (
            <div className="grade-circle"><span className="grade-big">{selected.grade.toFixed(1)}</span><span className="grade-label">/ 10</span></div>
          )}
          {selected.feedback && (
            <div className="feedback-box">
              <p className="feedback-title"><Sparkles size={13}/> Análise AvalIA</p>
              <p className="feedback-text">{selected.feedback}</p>
            </div>
          )}
          <div style={{fontSize:12,color:'var(--text2)',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Fonte</span><span className={`badge badge-${selected.source}`}>{selected.source.toUpperCase()}</span></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Data</span><span>{selected.submittedAt}</span></div>
          </div>
        </aside>
      )}

      {/* ══ MODAL: NOVA MATÉRIA ═══════════════════════════════════════════ */}
      {showSubjectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editingSubject ? 'Editar Matéria' : 'Nova Matéria'}</h2><button className="btn-close" onClick={() => setShowSubjectModal(false)}>✕</button></div>
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

      {/* ══ MODAL: IMPORTAR EMENTA (para matéria existente) ══════════════ */}
      {syllabusTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Importar Ementa</h2>
              <button className="btn-close" onClick={() => setSyllabusTarget(null)}>✕</button>
            </div>
            <p style={{fontSize:13,color:'var(--text2)'}}>Matéria: <b style={{color:'var(--text)'}}>{syllabusTarget.name}</b></p>
            {syllabusChunks(syllabusTarget.syllabus ?? '').length > 0 && (
              <div>
                <p style={{fontSize:11.5,color:'var(--text2)',marginBottom:6}}>Ementa atual ({syllabusChunks(syllabusTarget.syllabus ?? '').length} chunks):</p>
                <div className="syllabus-preview">{syllabusChunks(syllabusTarget.syllabus ?? '')[0]?.slice(0,300)}…</div>
              </div>
            )}
            <label className="drop-zone" onClick={() => document.getElementById('syllabus-imp')?.click()} style={{cursor:'pointer'}}>
              <Upload size={22}/><span>Selecione o PDF da ementa</span>
              <input id="syllabus-imp" type="file" accept=".pdf" style={{display:'none'}}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSyllabusImport(syllabusTarget, f); }}/>
            </label>
            {syllabusUploading && <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text2)'}}><Sparkles size={15} className="spin"/> Processando PDF em chunks…</div>}
            <div className="modal-actions"><button className="btn-ghost" onClick={() => setSyllabusTarget(null)}>Fechar</button></div>
          </div>
        </div>
      )}

      {showStudentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editingStudent ? 'Editar Aluno' : 'Novo Aluno'}</h2><button className="btn-close" onClick={() => setShowStudentModal(false)}>✕</button></div>
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
            <div className="modal-header"><h2>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</h2><button className="btn-close" onClick={() => setShowActivityModal(false)}>✕</button></div>
            <label className="field-label">Matéria</label>
            <select className="input" value={newActData.subjectId} onChange={e => setNewActData({...newActData, subjectId: e.target.value})}>
              <option value="">Selecione…</option>
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
            <div className="modal-header"><h2>{editingImpl ? 'Editar Ideia' : 'Nova Ideia'}</h2><button className="btn-close" onClick={() => setShowImplModal(false)}>✕</button></div>
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
                  <button onClick={() => setNewImpl({...newImpl, imageUrl: ''})} style={{position:'absolute',top:0,right:0,background:'rgba(0,0,0,0.5)',color:'white',border:'none',cursor:'pointer',fontSize:10}}>✕</button>
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

      {/* ══ MODAL: IMPORTAR ATIVIDADES DO TEXTO ══════════════════════════ */}
      {showImportActModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2>Importar Atividades da Ementa</h2>
              <button className="btn-close" onClick={() => setShowImportActModal(false)}>✕</button>
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
              <option value="">Selecione…</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, marginBottom:8}}>
               <label className="field-label" style={{margin:0}}>2. Texto da ementa (Contendo as A.A)</label>
               {newActData.subjectId && dbData.subjects.find(s => s.id === newActData.subjectId)?.syllabus && (
                 <span style={{fontSize:10, color:'#10b981', fontWeight:600}}>✓ Texto carregado automaticamente da ementa PDF</span>
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

      {/* ══ MODAL: UPLOAD INDIVIDUAL ═════════════════════════════════════ */}
      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>Novo Trabalho</h2><button className="btn-close" onClick={() => setShowUpload(false)}>✕</button></div>
            <label className="field-label">Aluno</label>
            <select className="input" value={uploadName} onChange={e => setUploadName(e.target.value)}>
              <option value="">Selecione…</option>
              {dbData.students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="field-label">Matéria</label>
            <select className="input" value={uploadSubject} onChange={e => setUploadSubject(e.target.value)}>
              <option value="">Selecione…</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="drop-zone" style={{cursor:'pointer'}} onClick={() => document.getElementById('file-input')?.click()}>
              <Upload size={22}/><span>{uploading ? 'Processando…' : 'Clique ou arraste o PDF'}</span>
              <input id="file-input" type="file" accept=".pdf" style={{display:'none'}} onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}/>
            </label>
            <div className="modal-actions"><button className="btn-ghost" onClick={() => setShowUpload(false)}>Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
