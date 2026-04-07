import React from "react";
import {
  FileText, CheckCircle, RefreshCw, Check,
  AlertTriangle, Clock, BookOpen, MessageSquare,
  Star, ChevronRight, Gavel
} from "lucide-react";
import { DBData } from "@/lib/types";

interface AuditViewProps {
  dbData: DBData;
  auditSubId: string | null;
  setAuditSubId: (id: string | null) => void;
  auditNote: string;
  setAuditNote: (note: string) => void;
  onSaveAudit: (finish: boolean) => Promise<void>;
  onGenerateReport: () => void;
  getActName: (feedback: string) => string;
}

function GradeRing({ grade }: { grade: number }) {
  const pct = Math.min(Math.max(grade / 10, 0), 1);
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = grade >= 7 ? "var(--accent)" : grade >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
      <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="var(--surface2)" strokeWidth={7} />
        <circle
          cx={40} cy={40} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 0
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{grade}</span>
        <span style={{ fontSize: 9, color: "var(--text2)", fontWeight: 600 }}>/ 10</span>
      </div>
    </div>
  );
}

export function AuditView({
  dbData,
  auditSubId,
  setAuditSubId,
  auditNote,
  setAuditNote,
  onSaveAudit,
  onGenerateReport,
  getActName,
}: AuditViewProps) {
  const auditList = dbData.submissions
    .filter((s) => s.status === "audit_pending")
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const doneList = dbData.submissions
    .filter((s) => s.status === "audited")
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const activeAudit =
    auditList.find((s) => s.id === auditSubId) || auditList[0];

  const avgGrade =
    auditList.length > 0
      ? (auditList.reduce((acc, s) => acc + (s.grade || 0), 0) / auditList.length).toFixed(1)
      : "—";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="header" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            background: "var(--accent)20", borderRadius: 12,
            padding: 10, display: "flex", alignItems: "center"
          }}>
            <Gavel size={22} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ margin: 0 }}>Auditoria Pedagógica</h1>
            <p className="subtitle" style={{ margin: 0 }}>Revisão de casos e calibração da IA avaliadora</p>
          </div>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Stats pills */}
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "6px 14px", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 20, fontSize: 12
          }}>
            <Clock size={13} color="#f59e0b" />
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>{auditList.length}</span>
            <span style={{ color: "var(--text2)" }}>pendentes</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <CheckCircle size={13} color="var(--accent)" />
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{doneList.length}</span>
            <span style={{ color: "var(--text2)" }}>concluídos</span>
          </div>
          <button className="btn-ghost" onClick={onGenerateReport} style={{ gap: 8 }}>
            <FileText size={15} /> Exportar Histórico
          </button>
        </div>
      </header>

      {auditList.length === 0 ? (
        <div className="empty-state card" style={{ height: 400, flexDirection: "column" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--accent)15",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16
          }}>
            <CheckCircle size={36} color="var(--accent)" />
          </div>
          <h3 style={{ marginBottom: 8, fontSize: 18 }}>Fila de Auditoria Vazia</h3>
          <p style={{ color: "var(--text2)", fontSize: 13, maxWidth: 360, textAlign: "center" }}>
            Os casos marcados para revisão nas correções em lote ou no assistente Canvas aparecerão aqui.
          </p>
          {doneList.length > 0 && (
            <div style={{ marginTop: 20, fontSize: 12, color: "var(--accent)" }}>
              <CheckCircle size={12} style={{ display: "inline", marginRight: 4 }} />
              {doneList.length} caso(s) já auditado(s) — exporte o histórico acima.
            </div>
          )}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 320px) 1fr",
          gap: 20,
          flex: 1,
          minHeight: 0,
          height: "calc(100vh - 220px)"
        }}>

          {/* ── FILA DE TRABALHO ─────────────────────────────────── */}
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Queue header */}
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface2)",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Fila de Trabalho
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{
                  background: "#f59e0b20", color: "#f59e0b",
                  fontSize: 11, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 20
                }}>{auditList.length}</span>
                <span style={{ fontSize: 10, color: "var(--text2)" }}>· Ø {avgGrade}</span>
              </div>
            </div>

            {/* Queue items */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {auditList.map((s, idx) => {
                const isActive = activeAudit?.id === s.id;
                const actName = getActName(s.feedback || "");
                const gradeColor = (s.grade || 0) >= 7 ? "var(--accent)" : (s.grade || 0) >= 5 ? "#f59e0b" : "#ef4444";
                return (
                  <div
                    key={s.id}
                    onClick={() => { setAuditSubId(s.id); setAuditNote(s.auditNotes || ""); }}
                    style={{
                      padding: "14px 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                      background: isActive ? "var(--accent)0d" : "transparent",
                      borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                      transition: "background 0.15s",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start"
                    }}
                  >
                    {/* Index circle */}
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: isActive ? "var(--accent)" : "var(--surface2)",
                      color: isActive ? "#fff" : "var(--text2)",
                      fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1
                    }}>{idx + 1}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13,
                        color: isActive ? "var(--accent)" : "var(--text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                      }}>{s.studentName}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.subject}{actName ? ` · ${actName}` : ""}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: gradeColor,
                          background: `${gradeColor}18`,
                          padding: "2px 8px", borderRadius: 10
                        }}>
                          <Star size={9} style={{ display: "inline", marginRight: 3 }} />
                          {s.grade}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          background: "#f59e0b15", color: "#f59e0b",
                          padding: "2px 8px", borderRadius: 10
                        }}>
                          <Clock size={9} style={{ display: "inline", marginRight: 3 }} />
                          Pendente
                        </span>
                      </div>
                    </div>
                    {isActive && <ChevronRight size={14} color="var(--accent)" style={{ marginTop: 4, flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>

            {/* Audit done summary */}
            {doneList.length > 0 && (
              <div style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border)",
                fontSize: 11,
                color: "var(--text2)",
                background: "var(--surface2)",
                display: "flex", alignItems: "center", gap: 6
              }}>
                <CheckCircle size={12} color="var(--accent)" />
                {doneList.length} caso(s) auditado(s) nesta sessão
              </div>
            )}
          </div>

          {/* ── PAINEL DE ANÁLISE ─────────────────────────────────── */}
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!activeAudit ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <MessageSquare size={32} color="var(--text3)" />
                <p style={{ marginTop: 12, color: "var(--text2)" }}>Selecione um caso na fila para iniciar a análise</p>
              </div>
            ) : (
              <>
                {/* Case header */}
                <div style={{
                  padding: "24px 28px",
                  borderBottom: "1px solid var(--border)",
                  background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.08em", color: "var(--text2)",
                          background: "var(--surface2)", padding: "3px 8px", borderRadius: 6,
                          border: "1px solid var(--border)"
                        }}>Análise</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: "#f59e0b15", color: "#f59e0b",
                          padding: "3px 8px", borderRadius: 6
                        }}>Aguardando revisão</span>
                      </div>
                      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                        {activeAudit.studentName}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <BookOpen size={13} color="var(--accent)" />
                        <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                          {activeAudit.subject}
                        </span>
                        {getActName(activeAudit.feedback || "") && (
                          <>
                            <span style={{ color: "var(--text3)" }}>·</span>
                            <span style={{ fontSize: 12, color: "var(--text2)" }}>
                              {getActName(activeAudit.feedback || "")}
                            </span>
                          </>
                        )}
                      </div>
                      <p style={{ color: "var(--text2)", fontSize: 11, marginTop: 6 }}>
                        Submetido em {activeAudit.submittedAt}
                        {activeAudit.auditNotes && (
                          <span style={{ marginLeft: 10, color: "var(--accent)", fontWeight: 600 }}>
                            · Rascunho salvo
                          </span>
                        )}
                      </p>
                    </div>
                    <GradeRing grade={activeAudit.grade || 0} />
                  </div>
                </div>

                {/* Content area — two cols */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: 0, flex: 1, overflow: "hidden"
                }}>
                  {/* Feedback IA */}
                  <div style={{
                    padding: "20px 24px",
                    borderRight: "1px solid var(--border)",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden"
                  }}>
                    <h4 style={{
                      fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em",
                      color: "var(--text2)", fontWeight: 700, marginBottom: 12,
                      display: "flex", alignItems: "center", gap: 6
                    }}>
                      <MessageSquare size={13} /> Feedback da IA
                    </h4>
                    <div style={{
                      fontSize: 13, lineHeight: 1.7,
                      padding: "16px", background: "var(--surface2)",
                      border: "1px solid var(--border)", borderRadius: 10,
                      whiteSpace: "pre-wrap", overflowY: "auto", flex: 1,
                      color: "var(--text)"
                    }}>
                      {activeAudit.feedback || <em style={{ color: "var(--text3)" }}>Sem feedback registrado.</em>}
                    </div>
                  </div>

                  {/* Parecer professor */}
                  <div style={{
                    padding: "20px 24px",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden"
                  }}>
                    <h4 style={{
                      fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em",
                      color: "var(--accent)", fontWeight: 700, marginBottom: 6,
                      display: "flex", alignItems: "center", gap: 6
                    }}>
                      <Gavel size={13} /> Seu Parecer Pedagógico
                    </h4>
                    <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 10, lineHeight: 1.5 }}>
                      Aponte pontos de melhoria. Suas anotações calibram futuras avaliações deste perfil.
                    </p>
                    <textarea
                      className="textarea"
                      style={{
                        flex: 1, fontSize: 13, borderRadius: 10,
                        padding: 16, resize: "none", lineHeight: 1.7,
                        border: "1.5px solid var(--accent)40",
                        background: "var(--accent)05"
                      }}
                      placeholder={"Ex: A IA foi excessivamente técnica. Sugiro um feedback mais encorajador e focado no ponto X..."}
                      value={auditNote}
                      onChange={(e) => setAuditNote(e.target.value)}
                    />
                  </div>
                </div>

                {/* Action bar */}
                <div style={{
                  padding: "16px 24px",
                  background: "var(--surface)",
                  borderTop: "1px solid var(--border)",
                  display: "flex", gap: 12, alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <p style={{ fontSize: 11, color: "var(--text2)", margin: 0 }}>
                    {auditList.indexOf(activeAudit) + 1} de {auditList.length} casos pendentes
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn-ghost"
                      style={{ height: 44, padding: "0 20px", fontSize: 13 }}
                      onClick={() => onSaveAudit(false)}
                    >
                      <RefreshCw size={15} /> Salvar Rascunho
                    </button>
                    <button
                      className="btn-primary"
                      style={{ height: 44, padding: "0 28px", fontSize: 14, fontWeight: 700 }}
                      onClick={() => onSaveAudit(true)}
                    >
                      <Check size={16} /> Finalizar Auditoria
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
