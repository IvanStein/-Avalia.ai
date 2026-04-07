import React from "react";
import { Check, RefreshCw } from "lucide-react";
import { DBData } from "@/lib/types";

interface ManualGradingViewProps {
  dbData: DBData;
  manuStu: string;
  setManuStu: (id: string) => void;
  manuSub: string;
  setManuSub: (id: string) => void;
  manuAct: string;
  setManuAct: (id: string) => void;
  manuGrade: string;
  setManuGrade: (grade: string) => void;
  manuFeed: string;
  setManuFeed: (feed: string) => void;
  manuSaving: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

export function ManualGradingView({
  dbData,
  manuStu,
  setManuStu,
  manuSub,
  setManuSub,
  manuAct,
  setManuAct,
  manuGrade,
  setManuGrade,
  manuFeed,
  setManuFeed,
  manuSaving,
  onSave,
  onCancel
}: ManualGradingViewProps) {
  return (
    <div className="fade-in">
      <header className="header">
        <div><h1>Lançamento Manual</h1><p className="subtitle">Ajuste de notas e correções avulsas</p></div>
      </header>

      <div className="card" style={{ padding: 40, maxWidth: 900, margin: '20px auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div>
            <label className="field-label">Aluno</label>
            <select className="input" value={manuStu} onChange={e => setManuStu(e.target.value)} style={{height: 48}}>
              <option value="">Selecione o Aluno...</option>
              {dbData.students.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.ra ? `(${s.ra})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Matéria</label>
            <select className="input" value={manuSub} onChange={e => { setManuSub(e.target.value); setManuAct(''); }} style={{height: 48}}>
              <option value="">Selecione a Matéria...</option>
              {dbData.subjects.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="field-label">Atividade Correspondente (Opcional)</label>
          <select className="input" value={manuAct} onChange={e => setManuAct(e.target.value)} disabled={!manuSub} style={{height: 48}}>
            <option value="">-- Avaliação Geral / Sem Vínculo Específico --</option>
            {dbData.activities.filter(a => a.subjectId === manuSub).map(a => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 32, marginBottom: 32 }}>
          <div>
            <label className="field-label">Nota Final</label>
            <input type="number" step="0.1" min="0" max="10" className="input" value={manuGrade} onChange={e => setManuGrade(e.target.value)} style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', height: 60, color: (parseFloat(manuGrade) || 0) >= 7 ? 'var(--blue)' : 'var(--red)' }} />
          </div>
          <div>
            <label className="field-label">Feedback ou Observações do Professor</label>
            <textarea className="input" rows={6} placeholder="Utilize este espaço para registrar considerações pedagógicas, justificativas de ajuste ou observações sobre a entrega..." value={manuFeed} onChange={e => setManuFeed(e.target.value)} style={{padding: 16}} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <button className="btn-ghost" style={{padding: '0 24px'}} onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '0 40px', height: 48 }} disabled={manuSaving} onClick={onSave}>
            {manuSaving ? <RefreshCw className="spin" size={18}/> : <Check size={18}/>}
            Confirmar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}
