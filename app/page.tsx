"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload, BookOpen, CheckCircle, Clock, GraduationCap, Sparkles,
  Database, UserPlus, Plus, Trash2, AlertCircle, Layers, X,
  BarChart2, Users, Lightbulb, FileText, ChevronRight, Edit2,
  ArrowRight, Check, RefreshCw, Copy
} from "lucide-react";

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Subject       { id: string; name: string; code: string; syllabus?: string; closed?: boolean; }
interface Student       { id: string; name: string; email: string; turma?: string; subjectIds?: string[]; }
interface Activity      { id: string; subjectId: string; title: string; weight: number; description?: string; }
interface Implementacao { id: string; title: string; description: string; status: string; priority: string; createdAt: string; category?: string; imageUrl?: string; }
interface AppConfig     { system_name: string; primary_color: string; }
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
  type View = 'dashboard'|'subjects'|'students'|'enrollment'|'activities'|'batch'|'implementacoes'|'settings';
  const [view, setView] = useState<View>('dashboard');
  const [hasMounted, setHasMounted] = useState(false);
  const [dbData, setDbData] = useState<DBData>(EMPTY_DB);
  const [dbMode, setDbMode] = useState<'local'|'remote'>('local');
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

  const [newStuData, setNewStuData] = useState({ name: '', email: '', turma: '' });
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

  // ── FETCH ──────────────────────────────────────────────────────────────
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
    if (s) { setEditingStudent(s); setNewStuData({ name: s.name, email: s.email, turma: s.turma || '' }); }
    else { setEditingStudent(null); setNewStuData({ name: '', email: '', turma: '' }); }
    setShowStudentModal(true);
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
  const saveSettings = async () => {
    try {
      await apiPost('configs', tempConfigs);
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

  const runBatch = async () => {
    const valid = batchEntries.filter(e => e.studentId && e.subjectId);
    if (!valid.length) return alert('Configure aluno e matéria para ao menos um item');
    setBatchRunning(true); setBatchReport(null);
    setBatchEntries(prev => prev.map(e =>
      e.studentId && e.subjectId ? { ...e, status: 'processing' } : e
    ));
    try {
      const fd = new FormData();
      let i = 0;
      for (const e of valid) {
        const stu = dbData.students.find(s => s.id === e.studentId);
        const sub = dbData.subjects.find(s => s.id === e.subjectId);
        if (!stu || !sub) continue;
        fd.append(`items[${i}][studentName]`, stu.name);
        fd.append(`items[${i}][subject]`, sub.name);
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

  if (!hasMounted) return null;

  // ── NAV ────────────────────────────────────────────────────────────────
  const NavItem = ({ v, icon: Icon, label }: { v: View; icon: any; label: string }) => (
    <button className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
      <Icon size={16} strokeWidth={1.8} /> {label}
    </button>
  );

  // ── DB MODE BAR ────────────────────────────────────────────────────────
  const ModeBar = () => (
    <div className={`db-mode-bar ${dbMode === 'local' ? 'db-mode-local' : 'db-mode-remote'}`}>
      {dbMode === 'local' ? '📂 JSON Local' : '☁️ Supabase Remoto'}
    </div>
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
          <NavItem v="batch"          icon={Layers}      label="Correção em Lote"/>
          <p className="nav-label">Sistema</p>
          <NavItem v="implementacoes" icon={Lightbulb}   label="Implementações"/>
        </nav>
        <div className="db-toggle">
          <p className="nav-label" style={{marginBottom:5}}>Base de Dados</p>
          <div className="toggle-group">
            <button className={dbMode === 'local'  ? 'active' : ''} onClick={() => setDbMode('local')}>
              <Database size={11}/> Local
            </button>
            <button className={dbMode === 'remote' ? 'active' : ''} onClick={() => setDbMode('remote')}>
              ☁️ Nuvem
            </button>
          </div>
          <ModeBar/>
        </div>
        <div style={{marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 10, color: 'var(--text2)', fontFamily: 'monospace'}}>
          v0.1.0-alpha.1
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
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
              <h3 style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>Trabalhos Corrigidos</h3>
              <p style={{fontSize:24,fontWeight:600}}>{dbData.submissions.filter(s => s.status === 'graded').length}</p>
            </div>
          </div>

          <h2 style={{fontSize:16,marginBottom:12}}>3 Últimas Atividades Recentes</h2>
          <div className="table-wrap fade-in" style={{marginBottom:32}}>
            <table className="table">
              <thead><tr><th>Título</th><th>Matéria</th><th>Peso</th></tr></thead>
              <tbody>
                {dbData.activities.slice(-3).reverse().map(a => {
                  const sub = dbData.subjects.find(s => s.id === a.subjectId);
                  return (
                    <tr key={a.id}>
                      <td className="td-name">{a.title}</td>
                      <td><span className="badge-subject">{sub?.name ?? a.subjectId}</span></td>
                      <td className="td-muted">{a.weight}×</td>
                    </tr>
                  );
                })}
                {dbData.activities.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><span style={{fontSize:13,color:'var(--text2)'}}>Nenhuma atividade cadastrada.</span></div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{fontSize:16,marginBottom:12}}>Submissões (Corrigidas ou Em Fila)</h2>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Aluno</th><th>Matéria</th><th>Status</th><th>Nota</th><th>Data</th><th></th></tr></thead>
              <tbody>
                {dbData.submissions.length === 0
                  ? <tr><td colSpan={6}><div className="empty-state"><BookOpen size={40}/><p>Nenhuma submissão nesta base.</p></div></td></tr>
                  : dbData.submissions.map(sub => {
                    const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.pending;
                    return (
                      <tr key={sub.id} className={selected?.id === sub.id ? 'selected' : ''} onClick={() => setSelected(sub)}>
                        <td className="td-name">{sub.studentName}</td>
                        <td><span className="badge-subject">{sub.subject}</span></td>
                        <td><span className="status-pill" style={{background:cfg.color+'18',color:cfg.color}}><cfg.icon size={13}/>{cfg.label}</span></td>
                        <td className="td-grade">{sub.grade?.toFixed(1) ?? '–'}</td>
                        <td className="td-muted">{sub.submittedAt}</td>
                        <td><div className="actions"><button className="btn-icon-danger" onClick={e=>{e.stopPropagation();del('submission',sub.id)}}><Trash2 size={14}/></button></div></td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
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
              <label className="btn-ghost" style={{cursor:'pointer', position:'relative', overflow:'hidden'}}>
                <Upload size={16}/> Importar (TXT/CSV)
                <input type="file" accept=".txt,.csv" style={{position:'absolute',opacity:0,width:1,height:1,left:0,top:0}} onChange={handleStudentsImport}/>
              </label>
              <button className="btn-primary" onClick={() => openStudentModal()}><UserPlus size={16}/> Novo Aluno</button>
            </div>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Nome</th><th>Email</th><th>Turma</th><th>Matéria</th><th></th></tr></thead>
              <tbody>
                {dbData.students.length === 0
                  ? <tr><td colSpan={5}><div className="empty-state"><UserPlus size={40}/><p>Nenhum aluno.</p></div></td></tr>
                  : [...dbData.students].sort((a,b) => a.name.localeCompare(b.name)).map(s => {
                    const subId = (s.subjectIds || [])[0];
                    const sub = subId ? dbData.subjects.find(x => x.id === subId) : null;
                    return (
                      <tr key={s.id}>
                        <td className="td-name">{s.name}</td>
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
            <button className="btn-primary" onClick={() => openActivityModal()}><Plus size={16}/> Nova Atividade</button>
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
        {view === 'batch' && <>
          <header className="header">
            <div><h1>Correção em Lote</h1><p className="subtitle">Envie os PDFs — o sistema identifica o aluno pelo nome do arquivo</p></div>
            <div className="header-actions">
              <button className="btn-ghost" onClick={() => { setBatchEntries([]); setBatchReport(null); }}><X size={15}/> Limpar</button>
              <button className="btn-primary" onClick={runBatch} disabled={batchRunning || batchEntries.length === 0}>
                {batchRunning ? <><Sparkles size={16} className="spin"/> Processando…</> : <><BarChart2 size={16}/> Corrigir Lote</>}
              </button>
            </div>
          </header>

          {/* Config bar */}
          <div style={{display:'flex',gap:10,marginBottom:18,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text2)'}}>
              <FileText size={14}/> Matéria padrão:
            </div>
            <select className="input" style={{width:'auto',minWidth:200}} value={batchSubjectId} onChange={e => {
              setBatchSubjectId(e.target.value);
              setBatchEntries(prev => prev.map(en => ({ ...en, subjectId: e.target.value })));
            }}>
              <option value="">Selecione...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="drop-zone drop-zone-sm" style={{cursor:'pointer',flex:1,minWidth:200}}>
              <Upload size={16}/> Arraste PDFs ou clique para selecionar
              <input type="file" accept=".pdf" multiple style={{display:'none'}}
                onChange={e => e.target.files && addBatchFiles(e.target.files)}/>
            </label>
          </div>

          {/* Report bar */}
          {batchReport && (
            <div style={{display:'flex',gap:10,marginBottom:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 16px'}}>
              <span className="badge badge-green"><CheckCircle size={12}/> {batchReport.succeeded} corrigidos</span>
              {batchReport.failed > 0 && <span className="badge badge-red"><AlertCircle size={12}/> {batchReport.failed} erros</span>}
            </div>
          )}

          {batchEntries.length === 0
            ? <div className="empty-state" style={{border:'2px dashed var(--border)',borderRadius:12,height:280}}>
                <Layers size={48}/><p>Selecione os PDFs acima para começar.</p>
                <p style={{fontSize:11.5}}>O sistema tentará associar cada arquivo a um aluno pelo nome do arquivo.</p>
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:8}} className="fade-in">
                {/* Table header */}
                <div style={{display:'grid',gridTemplateColumns:'28px minmax(0,2fr) minmax(0,1.5fr) minmax(0,1.5fr) 80px 32px',gap:8,padding:'6px 12px',fontSize:10.5,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600}}>
                  <span>#</span><span>Arquivo</span><span>Aluno</span><span>Matéria</span><span>Status</span><span></span>
                </div>
                {batchEntries.map((entry, idx) => {
                  const borderColor = entry.status === 'done' ? 'var(--green)' : entry.status === 'error' ? 'var(--red)' : entry.matchScore >= 0.5 ? '#6366f140' : 'var(--border)';
                  return (
                    <div key={entry.id} className="batch-item" style={{
                      gridTemplateColumns:'28px minmax(0,2fr) minmax(0,1.5fr) minmax(0,1.5fr) 80px 32px',
                      borderColor, opacity: entry.status === 'processing' ? .7 : 1,
                    }}>
                      <span style={{fontSize:11,color:'var(--text2)',fontWeight:600}}>#{idx+1}</span>

                      {/* Filename + match badge */}
                      <div style={{overflow:'hidden'}}>
                        <p style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{entry.filename}</p>
                        {entry.matchScore > 0 && entry.status === 'idle' && (
                          <span className="batch-match-tag">{Math.round(entry.matchScore*100)}% {entry.matchName}</span>
                        )}
                      </div>

                      {/* Aluno selector */}
                      <div style={{display:'flex', gap: 4, alignItems: 'center'}}>
                        <select className="input" style={{fontSize:12,padding:'6px 10px',flex:1}}
                          value={entry.studentId} disabled={entry.status !== 'idle'}
                          onChange={e => updateBatch(entry.id, { studentId: e.target.value })}>
                          <option value="">Selecionar aluno…</option>
                          {dbData.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {!entry.studentId && entry.matchName && entry.status === 'idle' && (
                          <button className="btn-ghost" style={{padding:'4px'}} title={`Cadastrar "${entry.matchName}"`} onClick={async () => {
                            try {
                              const s = await apiPost('student', { name: entry.matchName, email: '', turma: '' });
                              await fetchDB();
                              updateBatch(entry.id, { studentId: s.id });
                            } catch (e:any) { alert(e.message); }
                          }}><Plus size={14} style={{color:'var(--accent)'}}/></button>
                        )}
                      </div>

                      {/* Matéria selector */}
                      <select className="input" style={{fontSize:12,padding:'6px 10px'}}
                        value={entry.subjectId} disabled={entry.status !== 'idle'}
                        onChange={e => updateBatch(entry.id, { subjectId: e.target.value })}>
                        <option value="">Matéria…</option>
                        {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>

                      {/* Status */}
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        {entry.status === 'idle'       && <span style={{fontSize:11,color:'var(--text2)'}}>Aguarda</span>}
                        {entry.status === 'processing' && <Sparkles size={15} style={{color:'var(--accent)'}} className="spin"/>}
                        {entry.status === 'done'       && <><CheckCircle size={15} style={{color:'var(--green)'}}/><span style={{fontSize:11,color:'var(--green)',fontFamily:'monospace'}}>{entry.result?.grade?.toFixed(1)}</span></>}
                        {entry.status === 'error'      && <span title={entry.error}><AlertCircle size={15} style={{color:'var(--red)'}}/></span>}
                      </div>

                      {/* Remove */}
                      {entry.status === 'idle' && (
                        <button className="btn-icon-danger" onClick={() => setBatchEntries(prev => prev.filter(e => e.id !== entry.id))}><X size={14}/></button>
                      )}
                    </div>
                  );
                })}

                {/* Results table */}
                {batchEntries.some(e => e.status === 'done') && (
                  <div style={{marginTop:16}}>
                    <p style={{fontSize:11.5,color:'var(--text2)',marginBottom:8}}>Resultados:</p>
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>Aluno</th><th>Matéria</th><th>Nota</th><th>Feedback</th></tr></thead>
                        <tbody>
                          {batchEntries.filter(e => e.status === 'done' && e.result).map(e => (
                            <tr key={e.id}>
                              <td className="td-name">{e.result!.studentName}</td>
                              <td><span className="badge-subject">{e.result!.subject}</span></td>
                              <td className="td-grade">{e.result!.grade?.toFixed(1) ?? '–'}</td>
                              <td className="td-desc">{e.result!.feedback}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
          }
        </>}

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
          <header className="header"><div><h1>Configurações do Sistema</h1><p className="subtitle">Personalize a identidade da sua plataforma</p></div></header>
          <div className="table-wrap fade-in" style={{padding:24,maxWidth:600}}>
            <label className="field-label">Nome do Sistema</label>
            <input className="input" value={tempConfigs.system_name} onChange={e => setTempConfigs({...tempConfigs, system_name: e.target.value})}/>
            <label className="field-label" style={{marginTop:16}}>Cor Primária (HEX)</label>
            <div style={{display:'flex',gap:12}}>
              <input className="input" type="color" style={{width:50,height:40,padding:2}} value={tempConfigs.primary_color} onChange={e => setTempConfigs({...tempConfigs, primary_color: e.target.value})}/>
              <input className="input" placeholder="#6366f1" value={tempConfigs.primary_color} onChange={e => setTempConfigs({...tempConfigs, primary_color: e.target.value})}/>
            </div>
            <button className="btn-primary" style={{marginTop:32,width:'100%'}} onClick={saveSettings}>Salvar Configurações</button>
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
            <label className="field-label">Email</label>
            <input className="input" placeholder="Ex: maria@email.com" value={newStuData.email} onChange={e => setNewStuData({...newStuData, email: e.target.value})}/>
            <label className="field-label">Turma</label>
            <input className="input" placeholder="Turma A" value={newStuData.turma} onChange={e => setNewStuData({...newStuData, turma: e.target.value})}/>
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
