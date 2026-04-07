import React, { useState } from "react";
import {
  Lightbulb, Plus, Edit2, Trash2, Calendar,
  ArrowUpCircle, ArrowRightCircle, CheckCircle2,
  Archive, Filter, LayoutGrid, Columns, Tag
} from "lucide-react";
import { DBData, Implementacao } from "@/lib/types";

interface ImplementacoesViewProps {
  dbData: DBData;
  onOpenModal: (impl?: Implementacao) => void;
  onDelete: (id: string) => void;
  implStatus: Record<string, { label: string; color: string }>;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  alta:  { label: "Alta",  color: "#ef4444", icon: <ArrowUpCircle   size={11} /> },
  media: { label: "Média", color: "#f59e0b", icon: <ArrowRightCircle size={11} /> },
  baixa: { label: "Baixa", color: "#10b981", icon: <ArrowUpCircle   size={11} style={{ transform: "rotate(180deg)" }} /> },
};

const COLUMNS = [
  { key: "backlog",    label: "Backlog",    icon: <Archive size={14} />,       color: "#6b7280" },
  { key: "validating", label: "Validando",  icon: <Filter size={14} />,        color: "#f59e0b" },
  { key: "approved",  label: "Aprovado",   icon: <CheckCircle2 size={14} />,   color: "#6366f1" },
  { key: "done",      label: "Concluído",  icon: <CheckCircle2 size={14} />,   color: "#10b981" },
];

function ImplCard({
  impl,
  onEdit,
  onDelete,
}: {
  impl: Implementacao;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pri = PRIORITY_CONFIG[impl.priority] || PRIORITY_CONFIG.media;

  return (
    <div
      className="card"
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: "default",
        transition: "transform 0.15s, box-shadow 0.15s",
        borderTop: `3px solid ${pri.color}`,
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
      {/* Image */}
      {impl.imageUrl && (
        <img
          src={impl.imageUrl}
          alt={impl.title}
          style={{ width: "100%", height: 120, objectFit: "cover" }}
        />
      )}

      <div style={{ padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {/* Category + actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {impl.category && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px",
                borderRadius: 20, background: "var(--surface2)",
                color: "var(--text2)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 4
              }}>
                <Tag size={9} /> {impl.category}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              className="btn-icon"
              onClick={onEdit}
              title="Editar"
              style={{ width: 26, height: 26 }}
            >
              <Edit2 size={12} />
            </button>
            <button
              className="btn-icon-danger"
              onClick={onDelete}
              title="Excluir"
              style={{ width: 26, height: 26 }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.3, color: "var(--text)" }}>
          {impl.title}
        </h3>

        {/* Description */}
        {impl.description && (
          <p style={{
            fontSize: 12, color: "var(--text2)", lineHeight: 1.6, margin: 0,
            display: "-webkit-box", WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical", overflow: "hidden"
          }}>
            {impl.description}
          </p>
        )}

        {/* Footer */}
        <div style={{
          marginTop: "auto", paddingTop: 10,
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontSize: 10, color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={10} />
            {impl.createdAt?.split("T")[0]}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: pri.color,
            background: `${pri.color}18`,
            padding: "2px 8px", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 3
          }}>
            {pri.icon} {pri.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ImplementacoesView({ dbData, onOpenModal, onDelete, implStatus }: ImplementacoesViewProps) {
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [viewMode, setViewMode]  = useState<"kanban" | "grid">("kanban");

  const impls = dbData.implementacoes || [];

  // Unique categories
  const categories = Array.from(
    new Set(impls.map(i => i.category).filter(Boolean))
  ) as string[];

  const filtered = impls.filter(i => {
    if (filterPriority !== "all" && i.priority !== filterPriority) return false;
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    return true;
  });

  const total     = impls.length;
  const totalDone = impls.filter(i => i.status === "done").length;
  const progress  = total > 0 ? Math.round((totalDone / total) * 100) : 0;

  return (
    <>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="header" style={{ marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            background: "var(--accent)20", borderRadius: 12,
            padding: 10, display: "flex", alignItems: "center"
          }}>
            <Lightbulb size={22} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ margin: 0 }}>Implementações</h1>
            <p className="subtitle" style={{ margin: 0 }}>
              Gestão de demandas e roadmap do projeto
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Progress pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 14px", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 20, fontSize: 12
          }}>
            <div style={{
              width: 60, height: 5, background: "var(--surface2)",
              borderRadius: 4, overflow: "hidden"
            }}>
              <div style={{
                width: `${progress}%`, height: "100%",
                background: "var(--accent)", borderRadius: 4,
                transition: "width 0.5s ease"
              }} />
            </div>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{progress}%</span>
            <span style={{ color: "var(--text2)" }}>{totalDone}/{total} concluídos</span>
          </div>

          {/* View toggle */}
          <div className="toggle-group" style={{ marginTop: 0 }}>
            <button
              className={viewMode === "kanban" ? "active" : ""}
              onClick={() => setViewMode("kanban")}
              title="Kanban"
            >
              <Columns size={14} />
            </button>
            <button
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              title="Grade"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          <button className="btn-primary" onClick={() => onOpenModal()}>
            <Plus size={16} /> Nova Demanda
          </button>
        </div>
      </header>

      {/* ── FILTER BAR ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        marginBottom: 20, flexWrap: "wrap"
      }}>
        <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>Filtrar:</span>

        {/* Priority filter */}
        {[
          { key: "all",   label: "Todas" },
          { key: "alta",  label: "Alta" },
          { key: "media", label: "Média" },
          { key: "baixa", label: "Baixa" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterPriority(f.key)}
            style={{
              fontSize: 11, fontWeight: 600, padding: "4px 12px",
              borderRadius: 20, border: "1px solid var(--border)",
              cursor: "pointer",
              background: filterPriority === f.key ? "var(--accent)" : "var(--surface)",
              color: filterPriority === f.key ? "#fff" : "var(--text2)",
              transition: "all 0.15s"
            }}
          >
            {f.key !== "all" && PRIORITY_CONFIG[f.key]?.icon}{" "}{f.label}
          </button>
        ))}

        {categories.length > 0 && (
          <>
            <span style={{ color: "var(--border)", fontSize: 16 }}>|</span>
            <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <Tag size={11} /> Categoria:
            </span>
            <button
              onClick={() => setFilterCategory("all")}
              style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px",
                borderRadius: 20, border: "1px solid var(--border)",
                cursor: "pointer",
                background: filterCategory === "all" ? "var(--accent)" : "var(--surface)",
                color: filterCategory === "all" ? "#fff" : "var(--text2)",
              }}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px",
                  borderRadius: 20, border: "1px solid var(--border)",
                  cursor: "pointer",
                  background: filterCategory === cat ? "var(--accent)" : "var(--surface)",
                  color: filterCategory === cat ? "#fff" : "var(--text2)",
                }}
              >
                {cat}
              </button>
            ))}
          </>
        )}

        {filtered.length !== impls.length && (
          <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 4 }}>
            ({filtered.length} de {impls.length})
          </span>
        )}
      </div>

      {/* ── EMPTY STATE ─────────────────────────────────────────── */}
      {impls.length === 0 && (
        <div className="empty-state card" style={{ height: 360, flexDirection: "column" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--accent)15",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16
          }}>
            <Lightbulb size={28} color="var(--accent)" />
          </div>
          <h3>Nenhuma demanda cadastrada</h3>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 8 }}>
            Crie sua primeira ideia ou funcionalidade para o roadmap.
          </p>
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => onOpenModal()}>
            <Plus size={15} /> Nova Demanda
          </button>
        </div>
      )}

      {/* ── KANBAN VIEW ─────────────────────────────────────────── */}
      {viewMode === "kanban" && impls.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(230px, 1fr))`,
          gap: 16,
          alignItems: "start",
          overflowX: "auto",
          paddingBottom: 8
        }} className="fade-in">
          {COLUMNS.map(col => {
            const colItems = filtered.filter(i => i.status === col.key);
            return (
              <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {/* Column header */}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "10px 10px 0 0",
                  background: `${col.color}18`,
                  border: `1px solid ${col.color}30`,
                  borderBottom: "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: col.color, fontWeight: 700, fontSize: 13 }}>
                    {col.icon} {col.label}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: `${col.color}25`, color: col.color,
                    padding: "1px 8px", borderRadius: 10
                  }}>{colItems.length}</span>
                </div>

                {/* Cards */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 10,
                  padding: 10,
                  background: "var(--surface2)",
                  border: `1px solid ${col.color}25`,
                  borderRadius: "0 0 10px 10px",
                  minHeight: 120
                }}>
                  {colItems.length === 0 ? (
                    <div style={{
                      padding: "24px 12px", textAlign: "center",
                      fontSize: 11, color: "var(--text3)",
                      border: "1px dashed var(--border)", borderRadius: 8
                    }}>
                      Vazio
                    </div>
                  ) : (
                    colItems.map(impl => (
                      <ImplCard
                        key={impl.id}
                        impl={impl}
                        onEdit={() => onOpenModal(impl)}
                        onDelete={() => onDelete(impl.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GRID VIEW ───────────────────────────────────────────── */}
      {viewMode === "grid" && impls.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16
        }} className="fade-in">
          {filtered.map(impl => (
            <ImplCard
              key={impl.id}
              impl={impl}
              onEdit={() => onOpenModal(impl)}
              onDelete={() => onDelete(impl.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
