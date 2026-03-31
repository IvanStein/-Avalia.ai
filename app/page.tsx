"use client";

import Head from "next/head";

import { useState, useEffect } from "react";
import { Upload, FileText, Link, BookOpen, CheckCircle, Clock, AlertCircle, ChevronRight, GraduationCap, Sparkles } from "lucide-react";

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

const MOCK_SUBMISSIONS: Submission[] = [
  { id: "1", studentName: "Ana Souza", subject: "Cálculo I", submittedAt: "2024-03-15", status: "graded", grade: 8.5, feedback: "Bom domínio dos conceitos de derivadas. Revisar integração por partes.", source: "pdf" },
  { id: "2", studentName: "Bruno Lima", subject: "Física II", submittedAt: "2024-03-15", status: "graded", grade: 7.0, feedback: "Correto na teoria, mas cometeu erros de cálculo nas questões 3 e 4.", source: "drive" },
  { id: "3", studentName: "Carla Mendes", subject: "Cálculo I", submittedAt: "2024-03-16", status: "grading", source: "pdf" },
  { id: "4", studentName: "Diego Rocha", subject: "Física II", submittedAt: "2024-03-16", status: "pending", source: "drive" },
  { id: "5", studentName: "Elena Costa", subject: "Cálculo I", submittedAt: "2024-03-16", status: "graded", grade: 9.2, feedback: "Excelente resolução. Demonstra compreensão profunda do tema.", source: "pdf" },
  { id: "6", studentName: "Felipe Nunes", subject: "Física II", submittedAt: "2024-03-17", status: "error", source: "pdf" },
];

const STATUS_CONFIG = {
  pending: { label: "Aguardando", icon: Clock, color: "#f59e0b" },
  grading: { label: "Corrigindo...", icon: Sparkles, color: "#6366f1" },
  graded: { label: "Corrigido", icon: CheckCircle, color: "#10b981" },
  error: { label: "Erro", icon: AlertCircle, color: "#ef4444" },
};

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>(MOCK_SUBMISSIONS);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [activeSubject, setActiveSubject] = useState<string>("Todos");
  const [view, setView] = useState<"dashboard" | "subjects" | "students" | "activities">("dashboard");
  const [dbData, setDbData] = useState<any>({ subjects: [], students: [], activities: [] });
  const [showUpload, setShowUpload] = useState(false);
  
  useEffect(() => {
    fetch('/api/db').then(r => r.json()).then(setDbData);
  }, []);
  const [driveUrl, setDriveUrl] = useState("");
  const [studentName, setStudentName] = useState("");
  const [subject, setSubject] = useState("Cálculo I");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const subjectsList = ["Todos", ...dbData.subjects.map((s: any) => s.name)];
  const filtered = activeSubject === "Todos" ? submissions : submissions.filter(s => s.subject === activeSubject);

  const stats = {
    total: submissions.length,
    graded: submissions.filter(s => s.status === "graded").length,
    pending: submissions.filter(s => s.status === "pending").length,
    avg: submissions.filter(s => s.grade).reduce((a, b) => a + (b.grade || 0), 0) / submissions.filter(s => s.grade).length,
  };

  const handleDriveSubmit = async () => {
    if (!driveUrl || !studentName) return;
    setUploading(true);
    await new Promise(r => setTimeout(r, 1500));
    const newSub: Submission = {
      id: Date.now().toString(),
      studentName,
      subject,
      submittedAt: new Date().toISOString().split("T")[0],
      status: "pending",
      source: "drive",
    };
    setSubmissions(prev => [newSub, ...prev]);
    setDriveUrl(""); setStudentName(""); setUploading(false); setShowUpload(false);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <GraduationCap size={28} strokeWidth={1.5} />
          <span>AvalIA</span>
        </div>

        <nav className="nav">
          <p className="nav-label">Visão Geral</p>
          <button className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
            <Clock size={15} /> Dashboard
          </button>
          
          <p className="nav-label" style={{ marginTop: '16px' }}>Gestão</p>
          <button className={`nav-item ${view === "subjects" ? "active" : ""}`} onClick={() => setView("subjects")}>
            <BookOpen size={15} /> Matérias
          </button>
          <button className={`nav-item ${view === "students" ? "active" : ""}`} onClick={() => setView("students")}>
            <GraduationCap size={15} /> Alunos
          </button>
          <button className={`nav-item ${view === "activities" ? "active" : ""}`} onClick={() => setView("activities")}>
            <FileText size={15} /> Atividades
          </button>
        </nav>

        <div className="sidebar-stats">
          <div className="stat-card">
            <span className="stat-num">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-card">
            <span className="stat-num" style={{ color: "#10b981" }}>{stats.graded}</span>
            <span className="stat-label">Corrigidos</span>
          </div>
          <div className="stat-card">
            <span className="stat-num" style={{ color: "#f59e0b" }}>{stats.pending}</span>
            <span className="stat-label">Pendentes</span>
          </div>
          <div className="stat-card">
            <span className="stat-num" style={{ color: "#6366f1" }}>{stats.avg?.toFixed(1) || "—"}</span>
            <span className="stat-label">Média</span>
          </div>
        </div>
      </aside>

      <main className="main">
        {view === "dashboard" ? (
          <>
            <header className="header">
              <div>
                <h1>Avaliações</h1>
                <p className="subtitle">{filtered.length} trabalhos · {activeSubject}</p>
              </div>
              <button className="btn-primary" onClick={() => setShowUpload(true)}>
                <Upload size={16} /> Enviar Trabalho
              </button>
            </header>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Matéria</th>
                    <th>Envio</th>
                    <th>Fonte</th>
                    <th>Status</th>
                    <th>Nota</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sub => {
                    const cfg = STATUS_CONFIG[sub.status];
                    const Icon = cfg.icon;
                    return (
                      <tr key={sub.id} className={selected?.id === sub.id ? "selected" : ""} onClick={() => setSelected(sub)}>
                        <td className="td-name">{sub.studentName}</td>
                        <td><span className="badge-subject">{sub.subject}</span></td>
                        <td className="td-muted">{sub.submittedAt}</td>
                        <td>
                          {sub.source === "pdf"
                            ? <span className="badge-source pdf"><FileText size={11} /> PDF</span>
                            : <span className="badge-source drive"><Link size={11} /> Drive</span>
                          }
                        </td>
                        <td>
                          <span className="status-pill" style={{ color: cfg.color, background: cfg.color + "18" }}>
                            <Icon size={12} className={sub.status === "grading" ? "spin" : ""} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="td-grade">
                          {sub.grade != null ? <span className="grade">{sub.grade.toFixed(1)}</span> : <span className="td-muted">—</span>}
                        </td>
                        <td><ChevronRight size={15} className="td-muted" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : view === "subjects" ? (
          <>
            <header className="header">
               <div>
                <h1>Gestão de Matérias</h1>
                <p className="subtitle">{dbData.subjects.length} matérias cadastradas</p>
               </div>
               <button className="btn-primary" onClick={() => {
                 const name = prompt("Nome da Matéria:");
                 const code = prompt("Código (ex: MAT101):");
                 if (name && code) {
                    fetch('/api/db', { method: 'POST', body: JSON.stringify({ entity: 'subject', data: { name, code }}) })
                    .then(r => r.json()).then(res => setDbData({ ...dbData, subjects: [...dbData.subjects, res] }));
                 }
               }}>
                 <Sparkles size={16} /> Nova Matéria
               </button>
            </header>
            <div className="table-wrap">
               <table className="table">
                  <thead><tr><th>ID</th><th>Nome</th><th>Código</th></tr></thead>
                  <tbody>{dbData.subjects.map((sub: any) => (<tr key={sub.id}><td>{sub.id}</td><td>{sub.name}</td><td>{sub.code}</td></tr>))}</tbody>
               </table>
            </div>
          </>
        ) : view === "students" ? (
          <>
            <header className="header">
               <div>
                <h1>Gestão de Alunos</h1>
                <p className="subtitle">{dbData.students.length} alunos cadastrados</p>
               </div>
               <button className="btn-primary" onClick={() => {
                 const name = prompt("Nome completo:");
                 const email = prompt("Email:");
                 if (name && email) {
                    fetch('/api/db', { method: 'POST', body: JSON.stringify({ entity: 'student', data: { name, email }}) })
                    .then(r => r.json()).then(res => setDbData({ ...dbData, students: [...dbData.students, res] }));
                 }
               }}>
                 <Sparkles size={16} /> Novo Aluno
               </button>
            </header>
            <div className="table-wrap">
               <table className="table">
                  <thead><tr><th>ID</th><th>Nome</th><th>Email</th></tr></thead>
                  <tbody>{dbData.students.map((stu: any) => (<tr key={stu.id}><td>{stu.id}</td><td>{stu.name}</td><td>{stu.email}</td></tr>))}</tbody>
               </table>
            </div>
          </>
        ) : (
          <>
            <header className="header">
               <div>
                <h1>Gestão de Atividades</h1>
                <p className="subtitle">{dbData.activities.length} atividades cadastradas</p>
               </div>
               <button className="btn-primary" onClick={() => {
                 const subjectId = prompt("ID da Matéria para esta atividade:");
                 const title = prompt("Título da Atividade:");
                 const weight = prompt("Peso (ex: 1.0 ou 0.5):");
                 if (subjectId && title && weight) {
                    fetch('/api/db', { method: 'POST', body: JSON.stringify({ entity: 'activity', data: { subjectId, title, weight: parseFloat(weight) }}) })
                    .then(r => r.json()).then(res => setDbData({ ...dbData, activities: [...dbData.activities, res] }));
                 }
               }}>
                 <Sparkles size={16} /> Nova Atividade
               </button>
            </header>
            <div className="table-wrap">
               <table className="table">
                  <thead><tr><th>Matéria ID</th><th>Título</th><th>Peso</th></tr></thead>
                  <tbody>{dbData.activities.map((act: any) => (<tr key={act.id}><td>{act.subjectId}</td><td>{act.title}</td><td>{act.weight}</td></tr>))}</tbody>
               </table>
            </div>
          </>
        )}
      </main>

      {selected && (
        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <h2>{selected.studentName}</h2>
              <p className="subtitle">{selected.subject}</p>
            </div>
            <button className="btn-close" onClick={() => setSelected(null)}>✕</button>
          </div>

          {selected.grade != null && (
            <div className="grade-circle">
              <span className="grade-big">{selected.grade.toFixed(1)}</span>
              <span className="grade-label">/ 10</span>
            </div>
          )}

          {selected.feedback && (
            <div className="feedback-box">
              <p className="feedback-title"><Sparkles size={14} /> Análise AvalIA</p>
              <p className="feedback-text">{selected.feedback}</p>
            </div>
          )}

          <div className="detail-meta">
            <div className="meta-row"><span>Enviado em</span><span>{selected.submittedAt}</span></div>
            <div className="meta-row"><span>Fonte</span><span>{selected.source === "pdf" ? "PDF Upload" : "Google Drive"}</span></div>
            <div className="meta-row"><span>Status</span>
              <span style={{ color: STATUS_CONFIG[selected.status].color }}>{STATUS_CONFIG[selected.status].label}</span>
            </div>
          </div>

          {selected.status === "pending" && (
            <button className="btn-primary full" onClick={() => {
              setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, status: "grading" } : s));
              setSelected(prev => prev ? { ...prev, status: "grading" } : prev);
              setTimeout(() => {
                const grade = +(7 + Math.random() * 3).toFixed(1);
                setSubmissions(prev => prev.map(s => s.id === selected!.id ? { ...s, status: "graded", grade, feedback: "Análise pedagógica gerada pela AvalIA com suporte RAG." } : s));
                setSelected(prev => prev ? { ...prev, status: "graded", grade, feedback: "Análise pedagógica gerada pela AvalIA com suporte RAG." } : prev);
              }, 2500);
            }}>
              <Sparkles size={15} /> Avaliar com Inteligência
            </button>
          )}
        </aside>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="modal">
            <h2>Enviar Trabalho</h2>

            <label className="field-label">Nome do Aluno</label>
            <input className="input" placeholder="Ex: Ana Souza" value={studentName} onChange={e => setStudentName(e.target.value)} />

            <label className="field-label">Matéria</label>
            <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
              <option>Cálculo I</option>
              <option>Física II</option>
            </select>

            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); }}
            >
              <Upload size={24} />
              <p>Arraste um PDF aqui ou clique para selecionar</p>
              <input type="file" accept=".pdf" style={{ display: "none" }} />
            </div>

            <div className="divider"><span>ou via Google Drive</span></div>

            <label className="field-label">Link do Google Drive</label>
            <input className="input" placeholder="https://drive.google.com/file/d/..." value={driveUrl} onChange={e => setDriveUrl(e.target.value)} />

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowUpload(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleDriveSubmit} disabled={uploading || !studentName}>
                {uploading ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0d0f14;
          --surface: #13161e;
          --surface2: #1a1e2a;
          --border: #ffffff0f;
          --border2: #ffffff18;
          --text: #e8eaf0;
          --text2: #8b90a0;
          --accent: #6366f1;
          --accent2: #818cf8;
          --radius: 12px;
        }

        body { background: var(--bg); color: var(--text); font-family: 'Sora', sans-serif; }

        .app { display: flex; min-height: 100vh; }

        .sidebar {
          width: 220px; min-height: 100vh; background: var(--surface);
          border-right: 1px solid var(--border); padding: 28px 16px;
          display: flex; flex-direction: column; gap: 28px; position: sticky; top: 0;
        }

        .logo { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; color: var(--text); padding: 0 4px; }
        .logo svg { color: var(--accent2); }

        .nav { display: flex; flex-direction: column; gap: 2px; }
        .nav-label { font-size: 10px; font-weight: 600; color: var(--text2); letter-spacing: .1em; text-transform: uppercase; padding: 0 8px; margin-bottom: 6px; }
        .nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: none; background: none; color: var(--text2); font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: all .15s; text-align: left; }
        .nav-item:hover { background: var(--surface2); color: var(--text); }
        .nav-item.active { background: var(--accent)22; color: var(--accent2); }

        .sidebar-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto; }
        .stat-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 10px; text-align: center; }
        .stat-num { display: block; font-size: 20px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
        .stat-label { font-size: 10px; color: var(--text2); }

        .main { flex: 1; padding: 32px; min-width: 0; }

        .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        h1 { font-size: 24px; font-weight: 600; }
        .subtitle { font-size: 13px; color: var(--text2); margin-top: 2px; }

        .btn-primary { display: flex; align-items: center; gap: 7px; padding: 9px 18px; background: var(--accent); color: #fff; border: none; border-radius: 9px; font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s; white-space: nowrap; }
        .btn-primary:hover { background: var(--accent2); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .btn-primary.full { width: 100%; justify-content: center; margin-top: 8px; }

        .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid var(--border); }
        .table td { padding: 13px 16px; border-bottom: 1px solid var(--border); }
        .table tr:last-child td { border-bottom: none; }
        .table tbody tr { cursor: pointer; transition: background .1s; }
        .table tbody tr:hover { background: var(--surface2); }
        .table tbody tr.selected { background: var(--accent)11; }

        .td-name { font-weight: 500; }
        .td-muted { color: var(--text2); font-size: 12.5px; }
        .td-grade { font-family: 'JetBrains Mono', monospace; font-weight: 500; }

        .badge-subject { background: var(--surface2); border: 1px solid var(--border2); padding: 3px 9px; border-radius: 6px; font-size: 12px; color: var(--text2); }
        .badge-source { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; }
        .badge-source.pdf { background: #f59e0b18; color: #f59e0b; }
        .badge-source.drive { background: #3b82f618; color: #60a5fa; }

        .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .grade { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 600; color: var(--text); }

        .detail-panel {
          width: 300px; min-height: 100vh; background: var(--surface);
          border-left: 1px solid var(--border); padding: 28px 20px;
          display: flex; flex-direction: column; gap: 20px; position: sticky; top: 0;
        }
        .detail-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .detail-header h2 { font-size: 17px; font-weight: 600; }
        .btn-close { background: var(--surface2); border: 1px solid var(--border2); color: var(--text2); width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }

        .grade-circle { display: flex; align-items: baseline; gap: 4px; padding: 20px; background: var(--surface2); border-radius: var(--radius); border: 1px solid var(--border); justify-content: center; }
        .grade-big { font-size: 48px; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: #10b981; }
        .grade-label { font-size: 18px; color: var(--text2); }

        .feedback-box { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
        .feedback-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--accent2); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em; }
        .feedback-text { font-size: 13px; color: var(--text2); line-height: 1.6; }

        .detail-meta { display: flex; flex-direction: column; gap: 10px; }
        .meta-row { display: flex; justify-content: space-between; font-size: 13px; }
        .meta-row span:first-child { color: var(--text2); }

        .modal-overlay { position: fixed; inset: 0; background: #00000080; backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: var(--surface); border: 1px solid var(--border2); border-radius: 16px; padding: 28px; width: 460px; display: flex; flex-direction: column; gap: 14px; }
        .modal h2 { font-size: 18px; font-weight: 600; }

        .field-label { font-size: 12px; font-weight: 500; color: var(--text2); }
        .input { width: 100%; padding: 10px 13px; background: var(--surface2); border: 1px solid var(--border2); border-radius: 9px; color: var(--text); font-family: 'Sora', sans-serif; font-size: 13.5px; outline: none; transition: border .15s; }
        .input:focus { border-color: var(--accent); }
        select.input option { background: var(--surface2); }

        .drop-zone { border: 1.5px dashed var(--border2); border-radius: var(--radius); padding: 28px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all .15s; color: var(--text2); font-size: 13px; text-align: center; }
        .drop-zone:hover, .drop-zone.drag-over { border-color: var(--accent); background: var(--accent)0a; color: var(--text); }

        .divider { display: flex; align-items: center; gap: 10px; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border2); }
        .divider span { font-size: 11px; color: var(--text2); white-space: nowrap; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .btn-ghost { padding: 9px 16px; background: none; border: 1px solid var(--border2); border-radius: 9px; color: var(--text2); font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; }
        .btn-ghost:hover { background: var(--surface2); }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
