import React from "react";
import { RefreshCw, Clock, Plus, Layers, Sparkles, Check, Trash2 } from "lucide-react";
import { DBData } from "@/lib/types";

interface CopyActivitiesViewProps {
  dbData: DBData;
  copySubjectId: string;
  setCopySubjectId: (id: string) => void;
  copyDestSubjectId: string;
  setCopyDestSubjectId: (id: string) => void;
  copySelectedActs: string[];
  setCopySelectedActs: (ids: string[]) => void;
  newSubjectName: string;
  setNewSubjectName: (name: string) => void;
  copyProcessing: boolean;
  onCopy: () => Promise<void>;
  onDelete: (type: 'activity', id: string) => void;
  onReset: () => void;
}

export function CopyActivitiesView({
  dbData,
  copySubjectId,
  setCopySubjectId,
  copyDestSubjectId,
  setCopyDestSubjectId,
  copySelectedActs,
  setCopySelectedActs,
  newSubjectName,
  setNewSubjectName,
  copyProcessing,
  onCopy,
  onDelete,
  onReset
}: CopyActivitiesViewProps) {
  return (
    <div className="fade-in">
      <header className="header">
        <div><h1>Copia de Atividades</h1><p className="subtitle">Clonar rotinas e avaliações entre matérias</p></div>
        <div className="header-actions">
           <button className="btn-ghost" onClick={onReset}><RefreshCw size={14}/> Limpar Tudo</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(380px, 1.2fr)', gap: 24 }} className="fade-in">
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
            <Clock size={16} /> 1. Selecionar Origem
          </h3>
          <div>
            <label className="field-label">Matéria de Origem</label>
            <select className="input" value={copySubjectId} onChange={e => {
              setCopySubjectId(e.target.value);
              setCopySelectedActs([]);
            }}>
              <option value="">Selecione a matéria...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>

          {copySubjectId && (
            <div className="fade-in" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="field-label" style={{ margin: 0 }}>Atividades disponíveis</label>
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => {
                  const allIds = dbData.activities.filter(a => a.subjectId === copySubjectId).map(a => a.id);
                  setCopySelectedActs(copySelectedActs.length === allIds.length ? [] : allIds);
                }}>{copySelectedActs.length === dbData.activities.filter(a => a.subjectId === copySubjectId).length ? 'Limpar Seleção' : 'Selecionar Todas'}</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                {dbData.activities.filter(a => a.subjectId === copySubjectId).map(act => (
                  <label key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'all .2s' }}>
                    <input type="checkbox" checked={copySelectedActs.includes(act.id)} onChange={() => {
                      const newIds = copySelectedActs.includes(act.id) ? copySelectedActs.filter(i => i !== act.id) : [...copySelectedActs, act.id];
                      setCopySelectedActs(newIds);
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{act.title}</p>
                      <p style={{ fontSize: 10, color: 'var(--text2)' }}>Peso: {act.weight}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
              <Plus size={16} /> 2. Configurar Destino
            </h3>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Matéria de Destino</label>
                <select className="input" value={copyDestSubjectId} onChange={e => setCopyDestSubjectId(e.target.value)}>
                  <option value="">-- CRIAR NOVA MATÉRIA --</option>
                  {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {!copyDestSubjectId && (
                <div className="fade-in">
                  <label className="field-label">Nome da Nova Matéria</label>
                  <input className="input" placeholder="Ex: Cálculo III (Copy)" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} />
                </div>
              )}

              <div style={{ padding: '20px', background: 'var(--accent)', color: '#fff', borderRadius: 12, marginTop: 10, opacity: (copySubjectId && copySelectedActs.length > 0 && (copyDestSubjectId || newSubjectName)) ? 1 : 0.4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Layers size={22} />
                  <div>
                    <p style={{ fontSize: 11, opacity: 0.8 }}>Pronto para copiar</p>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{copySelectedActs.length} {copySelectedActs.length === 1 ? 'atividade' : 'atividades'}</p>
                  </div>
                </div>
                <button 
                  className="btn-primary" 
                  style={{ width: '100%', marginTop: 16, background: '#fff', color: 'var(--accent)', fontWeight: 800, height: 42 }}
                  onClick={onCopy}
                  disabled={copyProcessing || !copySubjectId || copySelectedActs.length === 0 || (!copyDestSubjectId && !newSubjectName)}
                >
                  {copyProcessing ? <Sparkles className="spin" size={16} /> : <Check size={16} />} 
                  {copyDestSubjectId ? 'Clonar nas Atividades Atuais' : 'Criar Nova com Atividades'}
                </button>
              </div>
            </div>
          </div>

          {copyDestSubjectId && (
            <div className="card fade-in" style={{ padding: 24, background: 'var(--surface2)30' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Conteúdo Atual no Destino</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dbData.activities.filter(a => a.subjectId === copyDestSubjectId).map(act => (
                  <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12 }}>{act.title}</span>
                    <button className="btn-icon-danger" style={{ width: 26, height: 26 }} onClick={() => onDelete('activity', act.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
