"use client";
import React, { useState } from "react";
import { ArrowLeft, User, BarChart2, Clock, ChevronDown, ChevronUp, Printer, Star, BookOpen, Download } from "lucide-react";
import { DBData, Student } from "@/lib/types";

interface StudentProfileViewProps {
  student: Student;
  dbData: DBData;
  onBack: () => void;
  onViewSubmission: (sub: any) => void;
}

function getActTitle(feedback: string = "") {
  return feedback.match(/Atividade: (.*)\n/)?.[1] || "";
}

function cleanFeedback(text: string = "") {
  return text.replace(/Atividade: .*\n/, "").trim();
}

export function StudentProfileView({
  student,
  dbData,
  onBack,
  onViewSubmission,
}: StudentProfileViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stuSubmissions = dbData.submissions
    .filter((sub) => sub.studentName === student.name && sub.status === "graded")
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const avg =
    stuSubmissions.length > 0
      ? (
          stuSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) /
          stuSubmissions.length
        ).toFixed(1)
      : "0.0";

  const handlePrintAll = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    
    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Prontuário – ${student.name}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; line-height: 1.6; }
          .cover { text-align: center; margin-bottom: 60px; padding-bottom: 40px; border-bottom: 2px solid #e2e8f0; }
          .cover h1 { font-size: 32px; margin-bottom: 8px; color: #0f172a; }
          .cover p { color: #64748b; font-size: 14px; }
          
          .evaluation { padding: 40px 0; border-bottom: 1px dashed #cbd5e1; page-break-after: always; }
          .evaluation:last-child { border-bottom: none; page-break-after: auto; }
          
          .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
          .grade-box { background: #f1f5f9; padding: 16px 24px; border-radius: 12px; text-align: center; min-width: 100px; }
          .grade-val { font-size: 32px; font-weight: 900; color: #4f46e5; display: block; line-height: 1; }
          .grade-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-top: 4px; display: block; }
          
          .sub-info h2 { font-size: 18px; margin: 0 0 4px 0; color: #0f172a; }
          .sub-info p { font-size: 13px; color: #64748b; margin: 0; }
          
          .act-tag { display: inline-block; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: 700; padding: 4px 12px; borderRadius: 20px; margin-bottom: 16px; border: 1px solid #c7d2fe; }
          
          .feedback-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 12px; letter-spacing: 0.05em; }
          .feedback-content { background: #ffffff; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; font-size: 14px; white-space: pre-wrap; color: #334155; }
          
          .footer { margin-top: 60px; font-size: 10px; color: #94a3b8; text-align: center; }
          
          @media print { 
            body { margin: 20px; } 
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="cover">
          <h1>Jornada de Aprendizagem</h1>
          <h2>${student.name}</h2>
          <p>RA: ${student.ra || "Não informado"} · Emitido em ${new Date().toLocaleDateString("pt-BR")}</p>
          <div style="margin-top: 24px; display: flex; justify-content: center; gap: 40px;">
            <div><span style="display:block; font-size:24px; font-weight:800;">${avg}</span><span style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Média Geral</span></div>
            <div><span style="display:block; font-size:24px; font-weight:800;">${stuSubmissions.length}</span><span style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Avaliações</span></div>
          </div>
        </div>
    `;

    stuSubmissions.forEach(sub => {
      const actTitle = getActTitle(sub.feedback || "");
      const content = cleanFeedback(sub.feedback || "");
      html += `
        <div class="evaluation">
          <div class="header-row">
            <div class="sub-info">
              <h2>${sub.subject}</h2>
              <p>Avaliado em ${new Date(sub.submittedAt).toLocaleDateString("pt-BR")}</p>
            </div>
            <div class="grade-box">
              <span class="grade-val">${(sub.grade || 0).toFixed(1)}</span>
              <span class="grade-label">Nota Final</span>
            </div>
          </div>
          
          ${actTitle ? `<div class="act-tag">${actTitle}</div>` : ""}
          
          <div class="feedback-label">Parecer Pedagógico</div>
          <div class="feedback-content">${content.replace(/\n/g, "<br/>")}</div>
        </div>
      `;
    });

    html += `
        <div class="footer">Gerado automaticamente por Aval.IA – Sistema de Inteligência Pedagógica</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  };

  const handlePrint = (sub: any) => {
    const actTitle = getActTitle(sub.feedback || "");
    const content = cleanFeedback(sub.feedback || "");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Avaliação – ${student.name}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; max-width: 720px; margin: 40px auto; color: #1a1a2e; line-height: 1.7; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .meta { color: #64748b; font-size: 13px; margin-bottom: 32px; }
          .grade-badge { display: inline-block; background: ${(sub.grade || 0) >= 7 ? '#eff6ff' : '#fef2f2'}; color: ${(sub.grade || 0) >= 7 ? '#1e40af' : '#dc2626'}; font-size: 28px; font-weight: 900; padding: 12px 28px; border-radius: 12px; margin-bottom: 24px; }
          .activity-label { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; font-weight: 700; margin-bottom: 8px; }
          .activity-title { font-size: 16px; font-weight: 700; margin-bottom: 24px; color: #4f46e5; }
          .feedback-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; font-size: 14px; white-space: pre-wrap; }
          .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          @media print { body { margin: 24px; } }
        </style>
      </head>
      <body>
        <h1>${student.name}</h1>
        <p class="meta">RA: ${student.ra || "Não informado"} · Avaliado em ${new Date(sub.submittedAt).toLocaleDateString("pt-BR")}</p>
        <div class="grade-badge">${(sub.grade || 0).toFixed(1)} / 10</div>
        ${actTitle ? `<p class="activity-label">Atividade Avaliada</p><p class="activity-title">${actTitle}</p>` : ""}
        <div class="activity-label">Feedback da Avaliação</div>
        <div class="feedback-box">${content.replace(/\n/g, "<br/>")}</div>
        <div class="footer">Gerado por Aval.IA · ${sub.subject}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fade-in">
      <header className="header">
        <div>
          <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>
            <ArrowLeft size={14} /> Voltar para Relatórios
          </button>
          <h1>Jornada de {student.name}</h1>
          <p className="subtitle">Prontuário Acadêmico Detalhado</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 320px) 1fr", gap: 24 }}>

        {/* ── COLUNA ESQUERDA ──────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, background: "var(--accent)15", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <User size={36} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{student.name}</h2>
            <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 16 }}>RA: {student.ra || "Não informado"}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <span className="badge badge-blue">Ativo</span>
              <span className="badge">{student.turma || "Turma 2024"}</span>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text2)", marginBottom: 20, fontWeight: 700, letterSpacing: "0.07em" }}>Desempenho Geral</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <BarChart2 size={16} color="var(--blue)" /> Média
                </span>
                <span style={{ fontSize: 28, fontWeight: 900, color: parseFloat(avg) >= 7 ? "var(--blue)" : "var(--red)" }}>{avg}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={16} color="var(--accent)" /> Entregas
                </span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{stuSubmissions.length}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text2)", marginBottom: 16, fontWeight: 700, letterSpacing: "0.07em" }}>Disciplinas Inscritas</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dbData.subjects.filter((s) => (student.subjectIds || []).includes(s.id)).map((s) => (
                <span key={s.id} className="badge" style={{ background: "var(--surface2)", padding: "6px 12px", fontSize: 12 }}>
                   <BookOpen size={11} style={{ display: "inline", marginRight: 5 }} />{s.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── COLUNA DIREITA ────────────────────────────────── */}
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text2)" }}>
              Linha do Tempo de Avaliações
            </span>
            <button 
              className="btn-ghost" 
              onClick={handlePrintAll} 
              disabled={stuSubmissions.length === 0}
              style={{ padding: "4px 12px", height: "auto", fontSize: 11, gap: 6, opacity: stuSubmissions.length === 0 ? 0.5 : 1 }}
            >
              <Printer size={12}/> Imprimir Prontuário Completo
            </button>
          </div>

          <div style={{ padding: "16px 20px", overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {stuSubmissions.length === 0 ? (
              <div className="empty-state" style={{ height: 200 }}>
                <p>Nenhuma avaliação registrada para este aluno.</p>
              </div>
            ) : (
              stuSubmissions.map((sub) => {
                const isOpen = expandedId === sub.id;
                const actTitle = getActTitle(sub.feedback || "");
                const feedback = cleanFeedback(sub.feedback || "");
                const gradeColor = (sub.grade || 0) >= 7 ? "var(--blue)" : "var(--red)";

                return (
                  <div
                    key={sub.id}
                    style={{
                      border: `1px solid ${isOpen ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      transition: "border-color 0.2s",
                    }}
                  >
                    {/* ── Linha clicável ── */}
                    <div
                      onClick={() => setExpandedId(isOpen ? null : sub.id)}
                      style={{
                        padding: "16px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        background: isOpen ? "var(--accent)08" : "transparent",
                        transition: "background 0.15s",
                        gap: 16,
                      }}
                    >
                      {/* Grade badge */}
                      <div style={{
                        width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                        background: `${gradeColor}18`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: gradeColor, fontSize: 20, fontWeight: 900,
                      }}>
                        {sub.grade?.toFixed(1)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 2 }}>{sub.subject}</h4>
                        <p style={{ fontSize: 11, color: "var(--text2)", margin: 0 }}>
                          Avaliado em {new Date(sub.submittedAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>

                      {/* Activity badge */}
                      {actTitle && (
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          background: "var(--accent)12", color: "var(--accent)",
                          padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                          maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          <Star size={9} style={{ display: "inline", marginRight: 4 }} />
                          {actTitle}
                        </span>
                      )}

                      {/* Chevron */}
                      <div style={{ color: isOpen ? "var(--accent)" : "var(--text3)", flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(0deg)" }}>
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* ── Painel expandido ── */}
                    {isOpen && (
                      <div
                        className="fade-in"
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "20px 24px",
                          background: "var(--surface2)",
                        }}
                      >
                        {actTitle && (
                          <div style={{ marginBottom: 16 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text2)" }}>Atividade Avaliada</span>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", margin: "4px 0 0" }}>{actTitle}</p>
                          </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text2)" }}>Feedback da Avaliação</span>
                          <div style={{
                            marginTop: 8,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "14px 18px",
                            fontSize: 13,
                            lineHeight: 1.75,
                            color: "var(--text)",
                            whiteSpace: "pre-wrap",
                            maxHeight: 360,
                            overflowY: "auto",
                          }}>
                            {feedback || <em style={{ color: "var(--text3)" }}>Sem feedback registrado.</em>}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                          <button
                            className="btn-ghost"
                            style={{ height: 38, padding: "0 18px", fontSize: 13, gap: 8 }}
                            onClick={() => handlePrint(sub)}
                          >
                            <Printer size={15} /> Imprimir Esta Avaliação
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
