"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload, FileText, BookOpen, CheckCircle, Clock,
  GraduationCap, Sparkles, Database, UserPlus, Plus,
  Trash2, AlertCircle, Layers, X, ChevronRight, BarChart2
} from "lucide-react";

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

interface BatchEntry {
  id: string;
  studentId: string;
  subjectId: string;
  file: File | null;
  status: "idle" | "processing" | "done" | "error";
  result?: Submission;
  error?: string;
}

const STATUS_CONFIG = {
  pending:  { label: "Aguardando",   icon: Clock,        color: "#f59e0b" },
  grading:  { label: "Corrigindo...",icon: Sparkles,     color: "#6366f1" },
  graded:   { label: "Corrigido",    icon: CheckCircle,  color: "#10b981" },
  error:    { label: "Erro",         icon: AlertCircle,  color: "#ef4444" },
};

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [view, setView] = useState<"dashboard" | "subjects" | "students" | "activities" | "batch">("dashboard");
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

  const [studentName, setStudentName] = useState("");
  const [subject, setSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Batch correction state
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchReport, setBatchReport] = useState<{ succeeded: number; failed: number; errors: { studentName: string; error: string }[] } | null>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasMounted(true);
    fetchDB();
  }, [dbMode]);

  const fetchDB = async () => {
    try {
      const res = await fetch(`/api/db?mode=${dbMode}`);
      const data = await res.json();
      setDbData(data);
      setSubmissions(data.submissions || []);
    } catch (e) {
      console.error("Erro ao carregar banco:", e);
    }
  };

  const handleAddEntity = async (entity: string, data: any) => {
    try {
      const res = await fetch(`/api/db?mode=${dbMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, data }),
      });
      if (res.ok) {
        await fetchDB();
        setShowSubjectModal(false);
        setShowStudentModal(false);
        setShowActivityModal(false);
        setNewSubData({ name: "", code: "" });
        setNewStuData({ name: "", email: "" });
        setNewActData({ subjectId: "", title: "", weight: 1 });
      }
    } catch (e) {
      alert("Erro ao cadastrar: " + e);
    }
  };

  const handleDeleteEntity = async (entity: string, id: string) => {
    if (!confirm("Confirma exclusão?")) return;
    try {
      await fetch(`/api/db?mode=${dbMode}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id }),
      });
      await fetchDB();
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      alert("Erro ao excluir: " + e);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!studentName || !subject) return alert("Selecione aluno e matéria primeiro");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("studentName", studentName);
      formData.append("subject", subject);
      formData.append("activity", "");
      formData.append("file", file);

      const res = await fetch(`/api/grading?mode=${dbMode}`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSubmissions((prev) => [data, ...prev]);
      setShowUpload(false);
    } catch (err: any) {
      alert("Erro no processamento: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── BATCH FUNCTIONS ──────────────────────────────────────────────────────
  const addBatchEntry = () => {
    setBatchEntries((prev) => [
      ...prev,
      { id: Date.now().toString(), studentId: "", subjectId: "", file: null, status: "idle" },
    ]);
  };

  const updateBatchEntry = (id: string, patch: Partial<BatchEntry>) => {
    setBatchEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeBatchEntry = (id: string) => {
    setBatchEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleBatchFileDrop = (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    updateBatchEntry(id, { file: files[0] });
  };

  const runBatchCorrection = async () => {
    const valid = batchEntries.filter((e) => e.studentId && e.subjectId && e.file);
    if (valid.length === 0) return alert("Adicione ao menos um item completo (aluno, matéria e arquivo).");

    setBatchRunning(true);
    setBatchReport(null);
    setBatchEntries((prev) =>
      prev.map((e) =>
        e.studentId && e.subjectId && e.file ? { ...e, status: "processing" } : e
      )
    );

    try {
      const formData = new FormData();
      let idx = 0;
      for (const entry of valid) {
        const student = dbData.students.find((s: any) => s.id === entry.studentId);
        const subj = dbData.subjects.find((s: any) => s.id === entry.subjectId);
        if (!student || !subj) continue;
        formData.append(`items[${idx}][studentName]`, student.name);
        formData.append(`items[${idx}][subject]`, subj.name);
        formData.append(`items[${idx}][file]`, entry.file!);
        idx++;
      }

      const res = await fetch(`/api/grading/batch?mode=${dbMode}`, { method: "POST", body: formData });
      const report = await res.json();

      if (report.error) throw new Error(report.error);

      // Map results back to entries
      setBatchEntries((prev) => {
        const submitted = report.submissions as Submission[];
        const errors: { studentName: string; error: string }[] = report.errors || [];
        return prev.map((entry) => {
          const student = dbData.students.find((s: any) => s.id === entry.studentId);
          if (!entry.file || !student) return entry;
          const found = submitted.find((s) => s.studentName === student.name);
          if (found) return { ...entry, status: "done" as const, result: found };
          const err = errors.find((e) => e.studentName === student.name);
          if (err) return { ...entry, status: "error" as const, error: err.error };
          return entry;
        });
      });

      setBatchReport({
        succeeded: report.succeeded,
        failed: report.failed,
        errors: report.errors || [],
      });

      await fetchDB();
    } catch (err: any) {
      alert("Erro no lote: " + err.message);
      setBatchEntries((prev) => prev.map((e) => (e.status === "processing" ? { ...e, status: "error" as const, error: err.message } : e)));
    } finally {
      setBatchRunning(false);
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
          <button className={`nav-item ${view === "subjects" ? "active" : ""}`} onClick={() => setView("subjects")}><FileText size={18} /> Matérias</button>
          <button className={`nav-item ${view === "students" ? "active" : ""}`} onClick={() => setView("students")}><UserPlus size={18} /> Alunos</button>
          <button className={`nav-item ${view === "activities" ? "active" : ""}`} onClick={() => setView("activities")}><Clock size={18} /> Atividades</button>

          <p className="nav-label">Correção</p>
          <button className={`nav-item ${view === "batch" ? "active" : ""}`} onClick={() => setView("batch")}><Layers size={18} /> Correção em Lote</button>
        </nav>

        <div className="db-toggle">
          <p className="nav-label">Base de Dados</p>
          <div className="toggle-group">
            <button className={dbMode === "local" ? "active" : ""} onClick={() => setDbMode("local")}>
              <Database size={12} style={{ marginRight: 4 }} /> Local
            </button>
            <button className={dbMode === "remote" ? "active" : ""} onClick={() => setDbMode("remote")}>
              ☁️ Nuvem
            </button>
          </div>
          {dbMode === "remote" && <p style={{ fontSize: 9, color: "#10b981", marginTop: 4, textAlign: "center" }}>Supabase Ativo</p>}
        </div>
      </aside>

      <main className="main">
        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {view === "dashboard" && (
          <>
            <header className="header">
              <div>
                <h1>Painel de Avaliações</h1>
                <p className="subtitle">Lendo de: <b style={{ color: "var(--accent)" }}>{dbMode === "local" ? "JSON Local" : "Supabase Postgres"}</b></p>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Nenhuma submissão recente.</td></tr>
                  ) : submissions.map((sub) => (
                    <tr key={sub.id} onClick={() => setSelected(sub)} className={selected?.id === sub.id ? "selected" : ""}>
                      <td className="td-name">{sub.studentName}</td>
                      <td><span className="badge-subject">{sub.subject}</span></td>
                      <td>
                        {(() => {
                          const conf = STATUS_CONFIG[sub.status];
                          return <span className="status-pill" style={{ background: conf.color + "15", color: conf.color }}><conf.icon size={14} />{conf.label}</span>;
                        })()}
                      </td>
                      <td className="td-grade">{sub.grade ?? "-"}</td>
                      <td className="td-muted">{sub.submittedAt}</td>
                      <td>
                        <button className="btn-icon-danger" onClick={(e) => { e.stopPropagation(); handleDeleteEntity("submission", sub.id); }} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── MATÉRIAS ──────────────────────────────────────────────────── */}
        {view === "subjects" && (
          <>
            <header className="header">
              <div><h1>Matérias</h1><p className="subtitle">{dbData.subjects.length} disciplinas configuradas</p></div>
              <button className="btn-primary" onClick={() => setShowSubjectModal(true)}><Plus size={18} /> Nova Matéria</button>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nome</th><th>Código</th><th></th></tr></thead>
                <tbody>
                  {dbData.subjects.map((s: any) => (
                    <tr key={s.id}>
                      <td className="td-name">{s.name}</td>
                      <td className="td-muted">{s.code}</td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => handleDeleteEntity("subject", s.id)} title="Excluir"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── ALUNOS ────────────────────────────────────────────────────── */}
        {view === "students" && (
          <>
            <header className="header">
              <div><h1>Alunos</h1><p className="subtitle">{dbData.students.length} estudantes no banco</p></div>
              <button className="btn-primary" onClick={() => setShowStudentModal(true)}><UserPlus size={18} /> Novo Aluno</button>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nome</th><th>Email</th><th></th></tr></thead>
                <tbody>
                  {dbData.students.map((s: any) => (
                    <tr key={s.id}>
                      <td className="td-name">{s.name}</td>
                      <td className="td-muted">{s.email}</td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => handleDeleteEntity("student", s.id)} title="Excluir"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── ATIVIDADES ────────────────────────────────────────────────── */}
        {view === "activities" && (
          <>
            <header className="header">
              <div><h1>Atividades</h1><p className="subtitle">{dbData.activities.length} avaliações planejadas</p></div>
              <button className="btn-primary" onClick={() => setShowActivityModal(true)}><Plus size={18} /> Nova Atividade</button>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Atividade</th><th>Matéria</th><th>Peso</th><th></th></tr></thead>
                <tbody>
                  {dbData.activities.map((a: any) => (
                    <tr key={a.id}>
                      <td className="td-name">{a.title}</td>
                      <td><span className="badge-subject">{dbData.subjects.find((s: any) => s.id === a.subjectId)?.name || "Matéria " + a.subjectId}</span></td>
                      <td className="td-muted">{a.weight}x</td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => handleDeleteEntity("activity", a.id)} title="Excluir"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── CORREÇÃO EM LOTE ──────────────────────────────────────────── */}
        {view === "batch" && (
          <>
            <header className="header">
              <div>
                <h1>Correção em Lote</h1>
                <p className="subtitle">Processe múltiplos trabalhos de uma vez com IA</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={addBatchEntry}><Plus size={18} /> Adicionar</button>
                <button
                  className="btn-primary"
                  onClick={runBatchCorrection}
                  disabled={batchRunning || batchEntries.length === 0}
                  style={{ opacity: batchRunning ? 0.7 : 1 }}
                >
                  {batchRunning ? <><Sparkles size={18} /> Processando...</> : <><BarChart2 size={18} /> Corrigir Lote</>}
                </button>
              </div>
            </header>

            {/* Batch Report */}
            {batchReport && (
              <div className="batch-report" style={{
                display: "flex", gap: 12, marginBottom: 20,
                background: "var(--surface)", borderRadius: 10, padding: "14px 18px",
                border: "1px solid var(--border)"
              }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{batchReport.succeeded}</p>
                  <p style={{ fontSize: 11, color: "var(--text2)" }}>Corrigidos</p>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{batchReport.failed}</p>
                  <p style={{ fontSize: 11, color: "var(--text2)" }}>Com Erro</p>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{batchReport.succeeded + batchReport.failed}</p>
                  <p style={{ fontSize: 11, color: "var(--text2)" }}>Total</p>
                </div>
              </div>
            )}

            {batchEntries.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: 300, color: "var(--text2)", gap: 12,
                border: "2px dashed var(--border)", borderRadius: 12
              }}>
                <Layers size={48} strokeWidth={1} />
                <p style={{ fontSize: 14 }}>Clique em <b>Adicionar</b> para incluir trabalhos no lote</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {batchEntries.map((entry, idx) => (
                  <div key={entry.id} className="batch-item" style={{
                    display: "grid",
                    gridTemplateColumns: "28px 1fr 1fr 200px 40px",
                    gap: 10, alignItems: "center",
                    background: "var(--surface)", borderRadius: 10, padding: "12px 14px",
                    border: `1px solid ${entry.status === "done" ? "#10b981" : entry.status === "error" ? "#ef4444" : "var(--border)"}`,
                    opacity: entry.status === "processing" ? 0.7 : 1,
                    transition: "border-color 0.3s"
                  }}>
                    {/* Index */}
                    <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>#{idx + 1}</span>

                    {/* Aluno */}
                    <select
                      className="input"
                      style={{ margin: 0 }}
                      value={entry.studentId}
                      onChange={(e) => updateBatchEntry(entry.id, { studentId: e.target.value })}
                      disabled={entry.status === "processing" || entry.status === "done"}
                    >
                      <option value="">Aluno...</option>
                      {dbData.students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    {/* Matéria */}
                    <select
                      className="input"
                      style={{ margin: 0 }}
                      value={entry.subjectId}
                      onChange={(e) => updateBatchEntry(entry.id, { subjectId: e.target.value })}
                      disabled={entry.status === "processing" || entry.status === "done"}
                    >
                      <option value="">Matéria...</option>
                      {dbData.subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    {/* File drop */}
                    <div
                      style={{
                        border: "1px dashed var(--border)", borderRadius: 8, padding: "8px 10px",
                        fontSize: 11, color: "var(--text2)", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, overflow: "hidden",
                        background: entry.file ? "rgba(99,102,241,0.08)" : "transparent"
                      }}
                      onClick={() => {
                        const input = document.getElementById(`batch-file-${entry.id}`) as HTMLInputElement;
                        input?.click();
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleBatchFileDrop(entry.id, e.dataTransfer.files); }}
                    >
                      <Upload size={13} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.file ? entry.file.name : "PDF..."}
                      </span>
                      <input
                        id={`batch-file-${entry.id}`}
                        type="file"
                        accept=".pdf"
                        style={{ display: "none" }}
                        onChange={(e) => handleBatchFileDrop(entry.id, e.target.files)}
                      />
                    </div>

                    {/* Status / remove */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {entry.status === "idle" && (
                        <button className="btn-icon-danger" onClick={() => removeBatchEntry(entry.id)} title="Remover">
                          <X size={14} />
                        </button>
                      )}
                      {entry.status === "processing" && <Sparkles size={16} style={{ color: "#6366f1", animation: "spin 1s linear infinite" }} />}
                      {entry.status === "done" && <CheckCircle size={16} style={{ color: "#10b981" }} />}
                      {entry.status === "error" && (
                        <span title={entry.error} style={{ cursor: "help" }}>
                          <AlertCircle size={16} style={{ color: "#ef4444" }} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Results inline */}
                {batchEntries.some((e) => e.status === "done" && e.result) && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>Resultados:</p>
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>Aluno</th><th>Matéria</th><th>Nota</th><th>Feedback</th></tr></thead>
                        <tbody>
                          {batchEntries.filter((e) => e.status === "done" && e.result).map((e) => (
                            <tr key={e.id}>
                              <td className="td-name">{e.result!.studentName}</td>
                              <td><span className="badge-subject">{e.result!.subject}</span></td>
                              <td className="td-grade">{e.result!.grade?.toFixed(1) ?? "-"}</td>
                              <td className="td-muted" style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.result!.feedback}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── DETAIL PANEL ──────────────────────────────────────────────────── */}
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

      {/* ── MODAL: MATÉRIA ────────────────────────────────────────────────── */}
      {showSubjectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Cadastrar Matéria</h2>
            <label className="field-label">Nome</label>
            <input className="input" placeholder="Ex: Cálculo III" value={newSubData.name} onChange={(e) => setNewSubData({ ...newSubData, name: e.target.value })} />
            <label className="field-label">Código</label>
            <input className="input" placeholder="Ex: MAT003" value={newSubData.code} onChange={(e) => setNewSubData({ ...newSubData, code: e.target.value })} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowSubjectModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleAddEntity("subject", newSubData)}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ALUNO ─────────────────────────────────────────────────── */}
      {showStudentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Cadastrar Aluno</h2>
            <label className="field-label">Nome Completo</label>
            <input className="input" placeholder="Ex: Maria Silva" value={newStuData.name} onChange={(e) => setNewStuData({ ...newStuData, name: e.target.value })} />
            <label className="field-label">Email</label>
            <input className="input" placeholder="Ex: maria@email.com" value={newStuData.email} onChange={(e) => setNewStuData({ ...newStuData, email: e.target.value })} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowStudentModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleAddEntity("student", newStuData)}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ATIVIDADE ─────────────────────────────────────────────── */}
      {showActivityModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Nova Atividade</h2>
            <label className="field-label">Matéria</label>
            <select className="input" value={newActData.subjectId} onChange={(e) => setNewActData({ ...newActData, subjectId: e.target.value })}>
              <option value="">Selecione...</option>
              {dbData.subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="field-label">Título</label>
            <input className="input" placeholder="Ex: Prova 1" value={newActData.title} onChange={(e) => setNewActData({ ...newActData, title: e.target.value })} />
            <label className="field-label">Peso</label>
            <input className="input" type="number" step="0.1" value={newActData.weight} onChange={(e) => setNewActData({ ...newActData, weight: parseFloat(e.target.value) })} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowActivityModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleAddEntity("activity", newActData)}>Salvar Atividade</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: UPLOAD INDIVIDUAL ─────────────────────────────────────── */}
      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Novo Trabalho</h2>
            <label className="field-label">Aluno</label>
            <select className="input" value={studentName} onChange={(e) => setStudentName(e.target.value)}>
              <option value="">Selecione...</option>
              {dbData.students.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="field-label">Matéria</label>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Selecione...</option>
              {dbData.subjects.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload size={24} />
              <p>{uploading ? "Processando..." : "Clique ou arraste o PDF do trabalho"}</p>
              <input id="file-input" type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
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
