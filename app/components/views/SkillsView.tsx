"use client";
import React, { useState } from "react";
import {
  Sparkles, Plus, Edit2, Trash2, Code2, FileText,
  Cpu, ChevronDown, ChevronUp, Info, Zap, BookOpen,
  CheckCircle2, Copy, Check
} from "lucide-react";
import { Skill } from "@/lib/types";

interface SkillsViewProps {
  skills: Skill[];
  onOpenModal: (s?: Skill) => void;
  onDelete: (id: string) => void;
}

const MODEL_CONFIG: Record<string, { label: string; color: string; speed: string }> = {
  "gemini-2.5-flash-lite": { label: "Gemini 2.5 Flash Lite", color: "#06b6d4", speed: "Mais rápido" },
  "gemini-1.5-flash":      { label: "Gemini 1.5 Flash",      color: "#8b5cf6", speed: "Rápido" },
  "gemini-1.5-pro":        { label: "Gemini 1.5 Pro",        color: "#f59e0b", speed: "Mais potente" },
};

const SYSTEM_SKILLS = [
  { id: "001", name: "Dissertativa (Padrão)",   icon: <FileText size={16} />,   desc: "Correção de textos dissertativos com feedback em parágrafo único, humano e direto.", model: "gemini-2.5-flash-lite", responseType: "json" },
  { id: "002", name: "Objetiva (Gabarito)",      icon: <CheckCircle2 size={16}/>, desc: "Corrige questionários de múltipla escolha comparando com um gabarito oficial.",          model: "gemini-2.5-flash-lite", responseType: "json" },
  { id: "010", name: "Code Reviewer (Python)",   icon: <Code2 size={16}/>,       desc: "Revisa código Python com foco em boas práticas, legibilidade e eficiência algorítmica.", model: "gemini-1.5-flash",      responseType: "json" },
  { id: "011", name: "Test Generator (Pytest)",  icon: <Zap size={16}/>,         desc: "Gera suíte de testes automatizados em Pytest para o código entregue pelo aluno.",         model: "gemini-1.5-flash",      responseType: "text" },
  { id: "012", name: "Modular Architect",        icon: <Cpu size={16}/>,         desc: "Analisa e propõe refatoração modular do código do aluno em um esqueleto de projeto.",      model: "gemini-1.5-pro",        responseType: "text" },
  { id: "013", name: "Google Bridge",            icon: <BookOpen size={16}/>,    desc: "Exporta e sincroniza notas e feedbacks com Google Sheets e Google Drive do professor.",    model: "gemini-1.5-flash",      responseType: "json" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handle}
      title="Copiar template"
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: copied ? "var(--accent)" : "var(--text2)",
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 11, padding: "2px 6px", borderRadius: 6,
        transition: "color 0.2s"
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function SkillCard({ skill, onEdit, onDelete }: { skill: Skill; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const modelCfg = MODEL_CONFIG[skill.model] || { label: skill.model, color: "#6b7280", speed: "" };

  return (
    <div className="card" style={{
      padding: 0, overflow: "hidden",
      borderLeft: `3px solid ${modelCfg.color}`,
      transition: "transform 0.15s, box-shadow 0.15s"
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
      }}
    >
      <div style={{ padding: "16px 18px" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${modelCfg.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: modelCfg.color
              }}>
                <Sparkles size={15} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                {skill.name}
              </h3>
            </div>
            <p style={{
              fontSize: 12, color: "var(--text2)", margin: 0,
              lineHeight: 1.5, display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}>
              {skill.description || "Sem descrição."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button className="btn-icon" onClick={onEdit} title="Editar" style={{ width: 28, height: 28 }}>
              <Edit2 size={12} />
            </button>
            <button className="btn-icon-danger" onClick={onDelete} title="Excluir" style={{ width: 28, height: 28 }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
            background: `${modelCfg.color}18`, color: modelCfg.color,
            border: `1px solid ${modelCfg.color}30`,
            display: "flex", alignItems: "center", gap: 4
          }}>
            <Cpu size={9} /> {modelCfg.label}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 10,
            background: skill.responseType === "json" ? "#6366f118" : "#10b98118",
            color: skill.responseType === "json" ? "#6366f1" : "#10b981",
          }}>
            {skill.responseType === "json" ? "⚙ JSON" : "📝 Texto"}
          </span>
          <span style={{
            fontSize: 10, color: "var(--text2)", padding: "3px 8px", borderRadius: 10,
            background: "var(--surface2)", border: "1px solid var(--border)"
          }}>
            {modelCfg.speed}
          </span>
        </div>
      </div>

      {/* Prompt preview toggle */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: "100%", padding: "8px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: expanded ? "var(--surface2)" : "transparent",
            border: "none", cursor: "pointer",
            fontSize: 11, color: "var(--text2)", fontWeight: 600,
            transition: "background 0.15s"
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Code2 size={12} /> Ver Prompt Template
          </span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {expanded && (
          <div style={{ padding: "0 18px 14px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <CopyButton text={skill.promptTemplate} />
            </div>
            <pre style={{
              margin: 0, fontSize: 11, lineHeight: 1.7,
              color: "var(--text2)", fontFamily: "monospace",
              background: "var(--surface2)", borderRadius: 8,
              padding: "12px 14px", whiteSpace: "pre-wrap",
              wordBreak: "break-word", maxHeight: 220,
              overflowY: "auto", border: "1px solid var(--border)"
            }}>
              {skill.promptTemplate || <em>Sem template definido.</em>}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function SystemSkillCard({ sk }: { sk: typeof SYSTEM_SKILLS[0] }) {
  const modelCfg = MODEL_CONFIG[sk.model] || { label: sk.model, color: "#6b7280", speed: "" };
  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      display: "flex", gap: 12, alignItems: "flex-start",
      opacity: 0.85
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${modelCfg.color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: modelCfg.color
      }}>
        {sk.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{sk.name}</div>
        <p style={{ fontSize: 11, color: "var(--text2)", margin: 0, lineHeight: 1.5 }}>{sk.desc}</p>
        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 8,
            background: `${modelCfg.color}18`, color: modelCfg.color
          }}>{modelCfg.label}</span>
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 8,
            background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)"
          }}>ID: {sk.id}</span>
        </div>
      </div>
    </div>
  );
}

export function SkillsView({ skills, onOpenModal, onDelete }: SkillsViewProps) {
  const [showSystem, setShowSystem] = useState(false);

  return (
    <>
      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="header" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            background: "var(--accent)20", borderRadius: 12,
            padding: 10, display: "flex", alignItems: "center"
          }}>
            <Sparkles size={22} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ margin: 0 }}>Habilidades de IA</h1>
            <p className="subtitle" style={{ margin: 0 }}>
              Prompts customizados que ensinam a IA a corrigir seus tipos de trabalho
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => onOpenModal()}>
          <Plus size={16} /> Nova Habilidade
        </button>
      </header>

      {/* ── HOW IT WORKS BANNER ──────────────────────────────── */}
      <div style={{
        display: "flex", gap: 14, padding: "14px 18px",
        background: "var(--accent)08", border: "1px solid var(--accent)25",
        borderRadius: 12, marginBottom: 24,
        alignItems: "flex-start"
      }}>
        <Info size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text2)" }}>
          <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>
            O que são Habilidades de IA?
          </strong>
          Cada habilidade é um <strong>prompt customizado</strong> que define <em>como</em> a IA vai corrigir um tipo específico de trabalho.
          Ao criar uma Atividade, você pode vincular uma habilidade a ela — assim a IA usa seu critério,
          tom e rubrica, em vez do padrão genérico. O sistema já vem com <strong>6 habilidades nativas</strong> (base),
          e você pode criar quantas quiser com seu próprio template.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

        {/* ── CUSTOM SKILLS ────────────────────────────────────── */}
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 14
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                background: "var(--accent)20", color: "var(--accent)",
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10
              }}>{skills.length}</span>
              Habilidades Customizadas
            </h2>
          </div>

          {skills.length === 0 ? (
            <div className="card" style={{
              padding: "48px 32px", textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center"
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "var(--accent)12",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16
              }}>
                <Sparkles size={28} color="var(--accent)" />
              </div>
              <h3 style={{ marginBottom: 8, fontSize: 16 }}>Nenhuma habilidade criada ainda</h3>
              <p style={{ color: "var(--text2)", fontSize: 13, maxWidth: 380, lineHeight: 1.6, marginBottom: 20 }}>
                Crie prompts personalizados para ensinar a IA a corrigir seus tipos específicos de trabalho —
                redações, relatórios técnicos, projetos práticos, etc.
              </p>
              <button className="btn-primary" onClick={() => onOpenModal()}>
                <Plus size={15} /> Criar Primeira Habilidade
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className="fade-in">
              {skills.map(sk => (
                <SkillCard
                  key={sk.id}
                  skill={sk}
                  onEdit={() => onOpenModal(sk)}
                  onDelete={() => onDelete(sk.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── SIDEBAR: SYSTEM SKILLS ───────────────────────────── */}
        <div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "var(--surface2)"
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                <Cpu size={13} color="var(--accent)" /> Habilidades do Sistema
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: "var(--accent)15", color: "var(--accent)",
                padding: "2px 8px", borderRadius: 10
              }}>{SYSTEM_SKILLS.length} nativas</span>
            </div>

            <div style={{ padding: "12px 12px 4px" }}>
              <p style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.6, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                Estas habilidades estão <strong>sempre disponíveis</strong> e são selecionadas nas configurações
                de cada Atividade pelo ID indicado.
              </p>

              {(showSystem ? SYSTEM_SKILLS : SYSTEM_SKILLS.slice(0, 3)).map(sk => (
                <div key={sk.id} style={{ marginBottom: 8 }}>
                  <SystemSkillCard sk={sk} />
                </div>
              ))}

              {!showSystem && (
                <button
                  onClick={() => setShowSystem(true)}
                  style={{
                    width: "100%", padding: "8px", marginBottom: 8,
                    background: "var(--surface2)", border: "1px dashed var(--border)",
                    borderRadius: 8, cursor: "pointer",
                    fontSize: 11, color: "var(--text2)", fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5
                  }}
                >
                  <ChevronDown size={13} /> Ver mais {SYSTEM_SKILLS.length - 3} habilidades
                </button>
              )}
            </div>
          </div>

          {/* Quick tip */}
          <div style={{
            marginTop: 12, padding: "12px 14px",
            background: "var(--surface2)", borderRadius: 10,
            border: "1px solid var(--border)", fontSize: 11,
            color: "var(--text2)", lineHeight: 1.6
          }}>
            <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>
              💡 Dica de template
            </strong>
            Use variáveis como{" "}
            <code style={{ fontSize: 10, background: "var(--surface)", padding: "1px 4px", borderRadius: 4 }}>{"${student_name}"}</code>,{" "}
            <code style={{ fontSize: 10, background: "var(--surface)", padding: "1px 4px", borderRadius: 4 }}>{"${subject}"}</code>,{" "}
            <code style={{ fontSize: 10, background: "var(--surface)", padding: "1px 4px", borderRadius: 4 }}>{"${student_text}"}</code>{" "}
            no seu template para que o sistema substitua automaticamente ao corrigir.
          </div>
        </div>
      </div>
    </>
  );
}
