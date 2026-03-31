"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Link, BookOpen, CheckCircle, Clock, ChevronRight, GraduationCap, Sparkles, Database, UserPlus, GraduationCap as SubjectIcon, Plus } from "lucide-react";

interface Submission {
  id: string;
  studentName: string;
  subject: string;
  submittedAt: string;
  status: "pending" | "grading" | "graded" | "error";
  grade?: number;
  feedback?: string;
  source: "pdf" | "drive";
}

const STATUS_CONFIG = {
  pending: { label: "Aguardando", icon: Clock, color: "#f59e0b" },
  grading: { label: "Corrigindo...", icon: Sparkles, color: "#6366f1" },
  graded: { label: "Corrigido", icon: CheckCircle, color: "#10b981" },
  error: { label: "Erro", icon: AlertCircle, color: "#ef4444" },
};

import { AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [view, setView] = useState<"dashboard" | "subjects" | "students" | "activities">("dashboard");
  const [hasMounted, setHasMounted] = useState(false);
  const [dbData, setDbData] = useState<any>({ subjects: [], students: [], activities: [] });
  const [dbMode, setDbMode] = useState<"local" | "remote">("local");
  
  // Modal states
  const [showUpload, setShowUpload] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  // Form states
  const [newSubData, setNewSubData] = useState({ name: "", code: "" });
  const [newStuData, setNewStuData] = useState({ name: "", email: "" });
  const [newActData, setNewActData] = useState({ subjectId: "", title: "", weight: 1 });
  
  const [driveUrl, setDriveUrl] = useState("");
  const [studentName, setStudentName] = useState("");
  const [subject, setSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    fetchDB();
  }, [dbMode]);

  const fetchDB = async () => {
    try {
      const res = await fetch(`/api/db?mode=${dbMode}`);
      const data = await res.json();
      setDbData(data);
    } catch (e) {
      console.error("Erro ao carregar banco:", e);
    }
  };

  const handleAddEntity = async (entity: string, data: any) => {
    try {
      const res = await fetch(`/api/db?mode=${dbMode}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, data })
      });
      if (res.ok) {
        await fetchDB();
        setShowSubjectModal(false); setShowStudentModal(false); setShowActivityModal(false);
        setNewSubData({ name: "", code: "" });
        setNewStuData({ name: "", email: "" });
        setNewActData({ subjectId: "", title: "", weight: 1 });
      }
    } catch (e) {
      alert("Erro ao cadastrar: " + e);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!studentName || !subject) return alert("Selecione aluno e matéria primeiro");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("studentName", studentName);
      formData.append("subject", subject);
      formData.append("file", file);

      const res = await fetch("/api/grading", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newSub: Submission = {
        id: Date.now().toString(),
        studentName,
        subject,
        submittedAt: new Date().toISOString().split("T")[0],
        status: "graded",
        source: "pdf",
        grade: data.grade,
        feedback: data.feedback
      };
      setSubmissions(prev => [newSub, ...prev]);
      setShowUpload(false);
    } catch (err: any) {
      alert("Erro no processamento: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!hasMounted) return null;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <GraduationCap size={28} strokeWidth={1.5} />
          <span>AvalIA</span>
        </div>

        <nav className="nav">
          <p className="nav-label">Visão Geral</p>
          <button className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}><BookOpen size={18} /> Dashboard</button>
          
          <p className="nav-label">Gerenciamento</p>
          <button className={`nav-item ${view === "subjects" ? "active" : ""}`} onClick={() => setView("subjects")}><Link size={18} /> Matérias</button>
          <button className={`nav-item ${view === "students" ? "active" : ""}`} onClick={() => setView("students")}><CheckCircle size={18} /> Alunos</button>
          <button className={`nav-item ${view === "activities" ? "active" : ""}`} onClick={() => setView("activities")}><Clock size={18} /> Atividades</button>
        </nav>

        <div className="db-toggle">
          <p className="nav-label">Base de Dados</p>
          <div className="toggle-group">
            <button className={dbMode === "local" ? "active" : ""} onClick={() => setDbMode("local")}>
              <Database size={12} style={{marginRight: 4}} /> Local
            </button>
            <button className={dbMode === "remote" ? "active" : ""} onClick={() => setDbMode("remote")}>
              ☁️ Nuvem
            </button>
          </div>
          {dbMode === "remote" && <p style={{fontSize: 9, color: '#10b981', marginTop: 4, textAlign: 'center'}}>Supabase Ativo</p>}
        </div>
      </aside>

      <main className="main">
        {view === "dashboard" ? (
          <>
            <header className="header">
              <div>
                <h1>Painel de Avaliações</h1>
                <p className="subtitle">Lendo de: <b style={{color: 'var(--accent)'}}>{dbMode === 'local' ? 'JSON Local' : 'Supabase Postgres'}</b></p>
              </div>
              <button className="btn-primary" onClick={() => setShowUpload(true)}>
                <Upload size={18} /> Novo Trabalho
              </button>
            </header>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Matéria</th>
                    <th>Status</th>
                    <th>Nota</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr><td colSpan={5} style={{textAlign: 'center', padding: 40, color: 'var(--text2)'}}>Nenhuma submissão recente.</td></tr>
                  ) : submissions.map(sub => (
                    <tr key={sub.id} onClick={() => setSelected(sub)} className={selected?.id === sub.id ? "selected" : ""}>
                      <td className="td-name">{sub.studentName}</td>
                      <td><span className="badge-subject">{sub.subject}</span></td>
                      <td>
                        {(() => {
                          const conf = STATUS_CONFIG[sub.status];
                          return <span className="status-pill" style={{ background: conf.color + "15", color: conf.color }}><conf.icon size={14} />{conf.label}</span>
                        })()}
                      </td>
                      <td className="td-grade">{sub.grade ?? "-"}</td>
                      <td className="td-muted">{sub.submittedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : view === "subjects" ? (
          <>
            <header className="header">
              <div><h1>Matérias</h1><p className="subtitle">{dbData.subjects.length} disciplinas configuradas</p></div>
              <button className="btn-primary" onClick={() => setShowSubjectModal(true)}><Plus size={18} /> Nova Matéria</button>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nome</th><th>Código</th></tr></thead>
                <tbody>
                  {dbData.subjects.map((s: any) => (
                    <tr key={s.id}><td className="td-name">{s.name}</td><td className="td-muted">{s.code}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : view === "students" ? (
          <>
            <header className="header">
              <div><h1>Alunos</h1><p className="subtitle">{dbData.students.length} estudantes no banco</p></div>
              <button className="btn-primary" onClick={() => setShowStudentModal(true)}><UserPlus size={18} /> Novo Aluno</button>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nome</th><th>Email</th></tr></thead>
                <tbody>
                  {dbData.students.map((s: any) => (
                    <tr key={s.id}><td className="td-name">{s.name}</td><td className="td-muted">{s.email}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <header className="header">
              <div><h1>Atividades</h1><p className="subtitle">{dbData.activities.length} avaliações planejadas</p></div>
              <button className="btn-primary" onClick={() => setShowActivityModal(true)}><Plus size={18} /> Nova Atividade</button>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Atividade</th><th>Matéria</th><th>Peso</th></tr></thead>
                <tbody>
                  {dbData.activities.map((a: any) => (
                    <tr key={a.id}>
                      <td className="td-name">{a.title}</td>
                      <td><span className="badge-subject">{dbData.subjects.find((s: any) => s.id === a.subjectId)?.name || 'Matéria '+a.subjectId}</span></td>
                      <td className="td-muted">{a.weight}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* DETALHES LATERAL */}
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
              <p className="feedback-title"><Sparkles size={14} /> Análise AvalIA</p>
              <p className="feedback-text">{selected.feedback}</p>
            </div>
          )}
        </aside>
      )}

      {/* MODAIS DE CADASTRO */}
      {showSubjectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Cadastrar Matéria</h2>
            <label className="field-label">Nome</label>
            <input className="input" placeholder="Ex: Cálculo III" value={newSubData.name} onChange={e => setNewSubData({...newSubData, name: e.target.value})} />
            <label className="field-label">Código</label>
            <input className="input" placeholder="Ex: MAT003" value={newSubData.code} onChange={e => setNewSubData({...newSubData, code: e.target.value})} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowSubjectModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleAddEntity('subject', newSubData)}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {showStudentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Cadastrar Aluno</h2>
            <label className="field-label">Nome Completo</label>
            <input className="input" placeholder="Ex: Maria Silva" value={newStuData.name} onChange={e => setNewStuData({...newStuData, name: e.target.value})} />
            <label className="field-label">Email</label>
            <input className="input" placeholder="Ex: maria@email.com" value={newStuData.email} onChange={e => setNewStuData({...newStuData, email: e.target.value})} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowStudentModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleAddEntity('student', newStuData)}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Nova Atividade</h2>
            <label className="field-label">Matéria</label>
            <select className="input" value={newActData.subjectId} onChange={e => setNewActData({...newActData, subjectId: e.target.value})}>
              <option value="">Selecione...</option>
              {dbData.subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="field-label">Título</label>
            <input className="input" placeholder="Ex: Prova 1" value={newActData.title} onChange={e => setNewActData({...newActData, title: e.target.value})} />
            <label className="field-label">Peso</label>
            <input className="input" type="number" step="0.1" value={newActData.weight} onChange={e => setNewActData({...newActData, weight: parseFloat(e.target.value)})} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowActivityModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleAddEntity('activity', newActData)}>Salvar Atividade</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Novo Trabalho</h2>
            <label className="field-label">Aluno</label>
            <select className="input" value={studentName} onChange={e => setStudentName(e.target.value)}>
              <option value="">Selecione...</option>
              {dbData.students.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="field-label">Matéria</label>
            <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">Selecione...</option>
              {dbData.subjects.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div className={`drop-zone ${dragOver ? "drag-over" : ""}`} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }} onClick={() => document.getElementById("file-input")?.click()}>
              <Upload size={24} />
              <p>{uploading ? "Processando..." : "Clique ou arraste o PDF do trabalho"}</p>
              <input id="file-input" type="file" accept=".pdf" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowUpload(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
