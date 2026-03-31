"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload, BookOpen, CheckCircle, Clock, GraduationCap, Sparkles,
  Database, UserPlus, Plus, Trash2, AlertCircle, Layers, X,
  BarChart2, Users, Lightbulb, FileText, ChevronRight, Edit2,
  ArrowRight, Check, RefreshCw,
} from "lucide-react";

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Subject       { id: string; name: string; code: string; syllabus?: string; }
interface Student       { id: string; name: string; email: string; }
interface Activity      { id: string; subjectId: string; title: string; weight: number; description?: string; }
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
  turmas: Turma[];
  implementacoes: Implementacao[];
  submissions: Submission[];
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

const EMPTY_DB: DBData = { subjects: [], students: [], activities: [], turmas: [], implementacoes: [], submissions: [] };

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

function syllabusChunks(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return raw ? [raw] : []; }
}

// ── COMPONENT ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  type View = 'dashboard'|'subjects'|'students'|'activities'|'turmas'|'batch'|'implementacoes';
  const [view, setView] = useState<View>('dashboard');
  const [hasMounted, setHasMounted] = useState(false);
  const [dbData, setDbData] = useState<DBData>(EMPTY_DB);
  const [dbMode, setDbMode] = useState<'local'|'remote'>('local');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);

  // Subject modals
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubData, setNewSubData] = useState({ name: '', code: '' });
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusUploading, setSyllabusUploading] = useState(false);
  const [syllabusTarget, setSyllabusTarget] = useState<Subject | null>(null);

  // Student modal
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [newStuData, setNewStuData] = useState({ name: '', email: '' });

  // Activity modal
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [newActData, setNewActData] = useState({ subjectId: '', title: '', weight: 1, description: '' });

  // Turma modal
  const [showTurmaModal, setShowTurmaModal] = useState(false);
  const [editTurma, setEditTurma] = useState<Turma | null>(null);
  const [newTurmaName, setNewTurmaName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Implementation modal
  const [showImplModal, setShowImplModal] = useState(false);
  const [newImpl, setNewImpl] = useState({ title: '', description: '', priority: 'media' });

  // Upload (single)
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploading, setUploading] = useState(false);

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
        turmas:          data.turmas          ?? [],
        implementacoes:  data.implementacoes  ?? [],
        submissions:     data.submissions     ?? [],
      });
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
    if (!confirm('Confirma a exclusão?')) return;
    try { await apiDelete(entity, id); await fetchDB(); if (selected?.id === id) setSelected(null); }
    catch (e: any) { alert('Erro: ' + e.message); }
  };

  // ── SUBJECT ACTIONS ────────────────────────────────────────────────────
  const saveSubject = async () => {
    if (!newSubData.name || !newSubData.code) return alert('Preencha nome e código');
    try {
      const sub = await apiPost('subject', { ...newSubData, syllabus: '' });
      // if file selected, upload syllabus right after
      if (syllabusFile) await uploadSyllabus(sub.id, syllabusFile);
      setShowSubjectModal(false);
      setNewSubData({ name: '', code: '' });
      setSyllabusFile(null);
      await fetchDB();
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

  // ── ACTIVITY ACTIONS ───────────────────────────────────────────────────
  const saveActivity = async () => {
    if (!newActData.title || !newActData.subjectId) return alert('Preencha título e matéria');
    try {
      await apiPost('activity', newActData);
      setShowActivityModal(false);
      setNewActData({ subjectId: '', title: '', weight: 1, description: '' });
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  // ── TURMA ACTIONS ──────────────────────────────────────────────────────
  const openNewTurma = () => {
    setEditTurma(null); setNewTurmaName(''); setSelectedStudentIds([]);
    setShowTurmaModal(true);
  };
  const openEditTurma = (t: Turma) => {
    setEditTurma(t); setNewTurmaName(t.name); setSelectedStudentIds([...t.studentIds]);
    setShowTurmaModal(true);
  };
  const saveTurma = async () => {
    if (!newTurmaName) return alert('Informe o nome da turma');
    try {
      if (editTurma) {
        await apiPost('turma-update', { id: editTurma.id, name: newTurmaName, studentIds: selectedStudentIds });
      } else {
        await apiPost('turma', { name: newTurmaName, studentIds: selectedStudentIds });
      }
      setShowTurmaModal(false); await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };
  const toggleStudentInTurma = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ── IMPLEMENTATION ACTIONS ─────────────────────────────────────────────
  const saveImpl = async () => {
    if (!newImpl.title) return alert('Informe o título');
    try {
      await apiPost('implementacao', newImpl);
      setShowImplModal(false); setNewImpl({ title: '', description: '', priority: 'media' });
      await fetchDB();
    } catch (e: any) { alert('Erro: ' + e.message); }
  };
  const cycleStatus = async (imp: Implementacao) => {
    const order = ['backlog', 'validating', 'approved', 'done'];
    const next = order[(order.indexOf(imp.status) + 1) % order.length];
    try { await apiPost('implementacao-status', { id: imp.id, status: next }); await fetchDB(); }
    catch (e: any) { alert('Erro: ' + e.message); }
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
      return {
        id: `${Date.now()}-${Math.random()}`,
        filename: file.name,
        file,
        studentId: match.score >= 0.5 ? match.studentId : '',
        subjectId: batchSubjectId,
        matchScore: match.score,
        matchName: match.name,
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
          <NavItem v="activities"     icon={Clock}       label="Atividades"/>
          <NavItem v="turmas"         icon={Users}       label="Turmas"/>
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
            <div><h1>Painel de Avaliações</h1><p className="subtitle">Base: <b>{dbMode === 'local' ? 'JSON Local' : 'Supabase'}</b> · {dbData.submissions.length} submissões</p></div>
            <button className="btn-primary" onClick={() => setShowUpload(true)}><Upload size={16}/> Novo Trabalho</button>
          </header>
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
            <div><h1>Matérias</h1><p className="subtitle">{dbData.subjects.length} disciplinas · {dbMode === 'local' ? 'Local' : 'Nuvem'}</p></div>
            <button className="btn-primary" onClick={() => setShowSubjectModal(true)}><Plus size={16}/> Nova Matéria</button>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Nome</th><th>Código</th><th>Ementa</th><th></th></tr></thead>
              <tbody>
                {dbData.subjects.length === 0
                  ? <tr><td colSpan={4}><div className="empty-state"><FileText size={40}/><p>Nenhuma matéria nesta base.</p></div></td></tr>
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
                            <button className="btn-icon" title="Importar ementa PDF" onClick={() => setSyllabusTarget(s)}><Upload size={13}/></button>
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
            <div><h1>Alunos</h1><p className="subtitle">{dbData.students.length} estudantes · {dbMode === 'local' ? 'Local' : 'Nuvem'}</p></div>
            <button className="btn-primary" onClick={() => setShowStudentModal(true)}><UserPlus size={16}/> Novo Aluno</button>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Nome</th><th>Email</th><th>Turmas</th><th></th></tr></thead>
              <tbody>
                {dbData.students.length === 0
                  ? <tr><td colSpan={4}><div className="empty-state"><UserPlus size={40}/><p>Nenhum aluno nesta base.</p></div></td></tr>
                  : dbData.students.map(s => {
                    const turmas = dbData.turmas.filter(t => t.studentIds.includes(s.id));
                    return (
                      <tr key={s.id}>
                        <td className="td-name">{s.name}</td>
                        <td className="td-muted">{s.email}</td>
                        <td>
                          {turmas.length === 0
                            ? <span style={{fontSize:11,color:'var(--text2)'}}>Sem turma</span>
                            : turmas.map(t => <span key={t.id} className="badge badge-blue" style={{marginRight:4}}>{t.name}</span>)
                          }
                        </td>
                        <td><div className="actions"><button className="btn-icon-danger" onClick={() => del('student', s.id)}><Trash2 size={14}/></button></div></td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </>}

        {/* ══ ATIVIDADES ════════════════════════════════════════════════= */}
        {view === 'activities' && <>
          <header className="header">
            <div><h1>Atividades</h1><p className="subtitle">{dbData.activities.length} avaliações · {dbMode === 'local' ? 'Local' : 'Nuvem'}</p></div>
            <button className="btn-primary" onClick={() => setShowActivityModal(true)}><Plus size={16}/> Nova Atividade</button>
          </header>
          <div className="table-wrap fade-in">
            <table className="table">
              <thead><tr><th>Título</th><th>Matéria</th><th>Peso</th><th>Critério IA</th><th></th></tr></thead>
              <tbody>
                {dbData.activities.length === 0
                  ? <tr><td colSpan={5}><div className="empty-state"><Clock size={40}/><p>Nenhuma atividade nesta base.</p></div></td></tr>
                  : dbData.activities.map(a => {
                    const sub = dbData.subjects.find(s => s.id === a.subjectId);
                    return (
                      <tr key={a.id}>
                        <td className="td-name">{a.title}</td>
                        <td><span className="badge-subject">{sub?.name ?? a.subjectId}</span></td>
                        <td className="td-muted">{a.weight}×</td>
                        <td className="td-desc">{a.description || <span style={{opacity:.4}}>—</span>}</td>
                        <td><div className="actions"><button className="btn-icon-danger" onClick={() => del('activity', a.id)}><Trash2 size={14}/></button></div></td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </>}

        {/* ══ TURMAS ════════════════════════════════════════════════════= */}
        {view === 'turmas' && <>
          <header className="header">
            <div><h1>Turmas</h1><p className="subtitle">{dbData.turmas.length} turmas · {dbMode === 'local' ? 'Local' : 'Nuvem'}</p></div>
            <button className="btn-primary" onClick={openNewTurma}><Plus size={16}/> Nova Turma</button>
          </header>

          {dbData.turmas.length === 0
            ? <div className="empty-state" style={{border:'2px dashed var(--border)',borderRadius:12,height:300}}><Users size={48}/><p>Nenhuma turma. Clique em <b>Nova Turma</b> para começar.</p></div>
            : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}} className="fade-in">
                {dbData.turmas.map(t => {
                  const members = dbData.students.filter(s => t.studentIds.includes(s.id));
                  return (
                    <div key={t.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:18}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                        <div>
                          <p style={{fontWeight:600,fontSize:15}}>{t.name}</p>
                          <p style={{fontSize:11.5,color:'var(--text2)',marginTop:2}}>{members.length} aluno{members.length !== 1 ? 's':''}</p>
                        </div>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn-icon" onClick={() => openEditTurma(t)}><Edit2 size={14}/></button>
                          <button className="btn-icon-danger" onClick={() => del('turma', t.id)}><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div className="turma-avatars">
                        {members.length === 0
                          ? <span style={{fontSize:11.5,color:'var(--text2)'}}>Sem alunos associados</span>
                          : members.map(s => <span key={s.id} className="turma-avatar">{s.name}</span>)
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
          }
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
                      <select className="input" style={{fontSize:12,padding:'6px 10px'}}
                        value={entry.studentId} disabled={entry.status !== 'idle'}
                        onChange={e => updateBatch(entry.id, { studentId: e.target.value })}>
                        <option value="">Selecionar aluno…</option>
                        {dbData.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>

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
            <div><h1>Implementações</h1><p className="subtitle">Gestão de ideias, validações e melhorias do sistema</p></div>
            <button className="btn-primary" onClick={() => setShowImplModal(true)}><Plus size={16}/> Nova Ideia</button>
          </header>

          {/* Kanban columns */}
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
                    {cards.length === 0 && <p style={{fontSize:11.5,color:'var(--text2)',textAlign:'center',padding:'12px 0'}}>Vazio</p>}
                    {cards.map(imp => (
                      <div key={imp.id} className="kanban-card" onClick={() => cycleStatus(imp)}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:4}}>
                          <p className="kanban-card-title">{imp.title}</p>
                          <button className="btn-icon-danger" style={{flexShrink:0}} onClick={e => { e.stopPropagation(); del('implementacao', imp.id); }}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                        {imp.description && <p className="kanban-card-desc">{imp.description}</p>}
                        <div className="kanban-card-footer">
                          <span className={`badge ${PRIORITY_CONFIG[imp.priority]?.cls}`}>
                            {PRIORITY_CONFIG[imp.priority]?.label}
                          </span>
                          <span style={{fontSize:10,color:'var(--text2)'}}>{imp.createdAt}</span>
                        </div>
                        <p style={{fontSize:9.5,color:'var(--text2)',marginTop:6,display:'flex',alignItems:'center',gap:4}}>
                          Clique para avançar <ArrowRight size={10}/>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
            <div className="modal-header"><h2>Nova Matéria</h2><button className="btn-close" onClick={() => setShowSubjectModal(false)}>✕</button></div>
            <label className="field-label">Nome da disciplina</label>
            <input className="input" placeholder="Ex: Cálculo III" value={newSubData.name} onChange={e => setNewSubData({...newSubData, name: e.target.value})}/>
            <label className="field-label">Código</label>
            <input className="input" placeholder="Ex: MAT303" value={newSubData.code} onChange={e => setNewSubData({...newSubData, code: e.target.value})}/>
            <label className="field-label">Ementa (PDF — opcional, pode importar depois)</label>
            <div className="drop-zone drop-zone-sm" onClick={() => document.getElementById('syllabus-new')?.click()} style={{cursor:'pointer'}}>
              <Upload size={18}/><span>{syllabusFile ? syllabusFile.name : 'Arraste o PDF da ementa ou clique'}</span>
              <input id="syllabus-new" type="file" accept=".pdf" style={{display:'none'}} onChange={e => e.target.files?.[0] && setSyllabusFile(e.target.files[0])}/>
            </div>
            {syllabusFile && <span className="syllabus-chip"><CheckCircle size={11}/> {syllabusFile.name}</span>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowSubjectModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveSubject} disabled={syllabusUploading}>
                {syllabusUploading ? <><Sparkles size={14} className="spin"/> Importando…</> : 'Salvar'}
              </button>
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

      {/* ══ MODAL: NOVO ALUNO ════════════════════════════════════════════ */}
      {showStudentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>Novo Aluno</h2><button className="btn-close" onClick={() => setShowStudentModal(false)}>✕</button></div>
            <label className="field-label">Nome completo</label>
            <input className="input" placeholder="Ex: Maria Silva" value={newStuData.name} onChange={e => setNewStuData({...newStuData, name: e.target.value})}/>
            <label className="field-label">Email</label>
            <input className="input" placeholder="Ex: maria@email.com" value={newStuData.email} onChange={e => setNewStuData({...newStuData, email: e.target.value})}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowStudentModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={async () => {
                if (!newStuData.name) return;
                try { await apiPost('student', newStuData); setShowStudentModal(false); setNewStuData({name:'',email:''}); await fetchDB(); }
                catch (e: any) { alert(e.message); }
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: NOVA ATIVIDADE ════════════════════════════════════════ */}
      {showActivityModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>Nova Atividade</h2><button className="btn-close" onClick={() => setShowActivityModal(false)}>✕</button></div>
            <label className="field-label">Matéria</label>
            <select className="input" value={newActData.subjectId} onChange={e => setNewActData({...newActData, subjectId: e.target.value})}>
              <option value="">Selecione…</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="field-label">Título da avaliação</label>
            <input className="input" placeholder="Ex: Prova Bimestral 1" value={newActData.title} onChange={e => setNewActData({...newActData, title: e.target.value})}/>
            <label className="field-label">Peso</label>
            <input className="input" type="number" step="0.1" min="0.1" value={newActData.weight} onChange={e => setNewActData({...newActData, weight: parseFloat(e.target.value)})}/>
            <label className="field-label">Critérios de correção para a IA (descrição completa)</label>
            <textarea className="textarea" style={{minHeight:120}} placeholder={`Descreva em detalhes o que a IA deve avaliar:\n• Estrutura do texto\n• Domínio dos conceitos\n• Exemplos exigidos\n• Nota máxima por critério…`}
              value={newActData.description}
              onChange={e => setNewActData({...newActData, description: e.target.value})}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowActivityModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveActivity}>Salvar Atividade</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: TURMA ═════════════════════════════════════════════════ */}
      {showTurmaModal && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <div className="modal-header">
              <h2>{editTurma ? 'Editar Turma' : 'Nova Turma'}</h2>
              <button className="btn-close" onClick={() => setShowTurmaModal(false)}>✕</button>
            </div>
            <label className="field-label">Nome da turma</label>
            <input className="input" placeholder="Ex: Turma A · 2025.1" value={newTurmaName} onChange={e => setNewTurmaName(e.target.value)}/>
            
            <label className="field-label">
              Alunos associados ({selectedStudentIds.length}/{dbData.students.length} selecionados)
            </label>
            {dbData.students.length === 0
              ? <p style={{fontSize:12.5,color:'var(--text2)',padding:'12px 0'}}>Nenhum aluno cadastrado. Cadastre alunos primeiro.</p>
              : <div className="student-grid">
                  {dbData.students.map(s => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    return (
                      <div key={s.id} className={`student-chip ${isSelected ? 'selected' : ''}`} onClick={() => toggleStudentInTurma(s.id)}>
                        <div className="student-chip-check">
                          {isSelected && <Check size={10} color="#fff"/>}
                        </div>
                        <div style={{overflow:'hidden'}}>
                          <p style={{fontSize:12.5,fontWeight:isSelected?500:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</p>
                          <p style={{fontSize:10.5,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.email}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
              <button className="btn-ghost" style={{fontSize:11.5,padding:'6px 12px'}} onClick={() => setSelectedStudentIds(dbData.students.map(s => s.id))}>Selecionar todos</button>
              <button className="btn-ghost" style={{fontSize:11.5,padding:'6px 12px'}} onClick={() => setSelectedStudentIds([])}>Limpar seleção</button>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowTurmaModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveTurma}>{editTurma ? 'Salvar Alterações' : 'Criar Turma'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: NOVA IMPLEMENTAÇÃO ════════════════════════════════════ */}
      {showImplModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>Nova Ideia / Implementação</h2><button className="btn-close" onClick={() => setShowImplModal(false)}>✕</button></div>
            <label className="field-label">Título</label>
            <input className="input" placeholder="Ex: Autenticação SSO via Google" value={newImpl.title} onChange={e => setNewImpl({...newImpl, title: e.target.value})}/>
            <label className="field-label">Descrição detalhada</label>
            <textarea className="textarea" style={{minHeight:100}} placeholder="Descreva a ideia, o problema que resolve, e como validar..."
              value={newImpl.description} onChange={e => setNewImpl({...newImpl, description: e.target.value})}/>
            <label className="field-label">Prioridade</label>
            <select className="input" value={newImpl.priority} onChange={e => setNewImpl({...newImpl, priority: e.target.value})}>
              <option value="alta">▲ Alta</option>
              <option value="media">◆ Média</option>
              <option value="baixa">▼ Baixa</option>
            </select>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowImplModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveImpl}>Registrar</button>
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
