import React from "react";
import { RefreshCw, Copy, AlertCircle } from "lucide-react";
import { DBData, Submission } from "@/lib/types";

interface CanvasAssistantViewProps {
  dbData: DBData;
  loading: boolean;
  onFetchDB: () => void;
  canvSubId: string;
  setCanvSubId: (id: string) => void;
  canvActTitle: string;
  setCanvActTitle: (title: string) => void;
  canvActiveSubId: string | null;
  setCanvActiveSubId: (id: string | null) => void;
  displayEntries: any[];
  onSendToAudit: (id: string) => void;
  getActName: (feedback: string) => string;
}

export function CanvasAssistantView({
  dbData,
  loading,
  onFetchDB,
  canvSubId,
  setCanvSubId,
  canvActTitle,
  setCanvActTitle,
  canvActiveSubId,
  setCanvActiveSubId,
  displayEntries,
  onSendToAudit,
  getActName
}: CanvasAssistantViewProps) {
  const activeSub = displayEntries.find(s => s.id === canvActiveSubId) || displayEntries[0];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const cleanFeedback = (text: string = '') => {
    if (!text) return '';
    let clean = text.replace(/Atividade: .*\n/, '');
    if (activeSub?.studentName) {
      const nameParts = activeSub.studentName.split(' ');
      const firstName = nameParts[0];
      const namePattern = new RegExp(`^(${activeSub.studentName}|${firstName})[,.:!]?\\s*`, 'i');
      clean = clean.replace(namePattern, '');
    }
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const getSummary = (text: string = '') => {
    const clean = cleanFeedback(text);
    const sentences = clean.split(/[.!?]\s/);
    if (sentences.length <= 2) return clean;
    return sentences.slice(0, 2).join('. ') + '.';
  };

  return (
    <div className="fade-in">
      <header className="header">
        <div><h1>Assistente de Lançamento (Canvas)</h1><p className="subtitle">Facilite o "copia e cola" para o SpeedGrader</p></div>
        <button className="btn-ghost" onClick={onFetchDB} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''}/> Atualizar Avaliações
        </button>
      </header>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label">Selecione a Matéria no Aval.IA</label>
            <select className="input" value={canvSubId} onChange={e => { setCanvSubId(e.target.value); setCanvActTitle(''); setCanvActiveSubId(null); }}>
              <option value="">Selecione...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Filtrar por Atividade</label>
            <select className="input" value={canvActTitle} onChange={e => { setCanvActTitle(e.target.value); setCanvActiveSubId(null); }} disabled={!canvSubId}>
              <option value="">Todas as Avaliações</option>
              {dbData.activities.filter(a => a.subjectId === canvSubId).map(a => <option key={a.id} value={a.title}>{a.title}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!canvSubId ? (
        <div className="empty-state" style={{ height: 300 }}>
          <Copy size={48} color="var(--border)" style={{ marginBottom: 16 }}/>
          <p>Selecione uma matéria para iniciar o assistente de lançamento.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, height: 'calc(100vh - 350px)', minHeight: 500 }}>
          {/* Student List Sidebar */}
          <div className="card" style={{ padding: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text2)' }}>
              Alunos ({displayEntries.length})
            </div>
            {displayEntries.map(s => {
              const isActive = (canvActiveSubId === s.id) || (!canvActiveSubId && displayEntries[0]?.id === s.id);
              return (
                <div 
                  key={s.id} 
                  onClick={() => setCanvActiveSubId(s.id)}
                  style={{ 
                    padding: '12px 16px', 
                    cursor: 'pointer', 
                    borderBottom: '1px solid var(--border)',
                    background: isActive ? 'var(--accent)10' : 'transparent',
                    borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: s.isMissing ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text1)' }}>{s.studentName}</span>
                    {s.isMissing && <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 600 }}>Ausente</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.isMissing ? 'var(--red)' : ((s.grade || 0) >= 7 ? 'var(--blue)' : 'var(--red)') }}>{s.grade?.toFixed(1)}</span>
                </div>
              );
            })}
          </div>

          {/* High-Action Clipboard Area */}
          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 32, background: 'var(--surface2)30' }}>
            {!activeSub ? (
               <div className="empty-state"><p>Selecione um aluno na lista</p></div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{activeSub.studentName}</h2>
                    <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>{activeSub.subject} • {getActName(activeSub.feedback || '') || 'Geral'}</p>
                    {activeSub.isMissing && <div className="badge badge-red" style={{ marginTop: 8 }}>Entrega não identificada</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Nota para o Canvas</p>
                    <div style={{ fontSize: 48, fontWeight: 900, color: (activeSub.grade || 0) >= 7 ? 'var(--blue)' : 'var(--red)', lineHeight: 1 }}>{activeSub.grade?.toFixed(1)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                  {/* Column 1: Grade Action */}
                  <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, border: activeSub.isMissing ? '2px solid var(--red)30' : '2px solid var(--accent)30' }}>
                     <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Campo "Nota de 0"</div>
                     <button className={activeSub.isMissing ? "btn-danger" : "btn-primary"} style={{ width: '100%', height: 60, fontSize: 18 }} onClick={() => copyToClipboard(activeSub.grade?.toFixed(1) || '0.0')}>
                       <Copy size={20}/> Copiar Nota: <b>{activeSub.grade?.toFixed(1)}</b>
                     </button>
                     <p style={{ fontSize: 10, color: 'var(--text2)' }}>Clique para copiar e cole no Canvas</p>
                     
                     {!activeSub.isMissing && (
                       <button className="btn-ghost" style={{ marginTop: 12, fontSize: 11, height: 'auto', padding: '6px 12px' }} onClick={() => onSendToAudit(activeSub.id)}>
                         <AlertCircle size={14}/> Solicitar Auditoria
                       </button>
                     )}
                  </div>

                  {/* Column 2: Feedback Summary Action */}
                  <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, border: activeSub.isMissing ? '2px solid var(--red)30' : '2px solid var(--accent)30' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Campo "Comentários" (Resumo)</div>
                       <button className="btn-ghost" style={{ padding: '4px 10px', height: 'auto', fontSize: 11 }} onClick={() => copyToClipboard(getSummary(activeSub.feedback))}>
                         <Copy size={12}/> Copiar Resumo
                       </button>
                     </div>
                     <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, color: activeSub.isMissing ? 'var(--red)' : 'var(--text1)', minHeight: 80, lineHeight: 1.5, fontWeight: activeSub.isMissing ? 600 : 400 }}>
                       {getSummary(activeSub.feedback)}
                     </div>
                  </div>
                </div>

                {/* Full Feedback Column */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Feedback Completo (Referência)</div>
                    <button className="btn-ghost" style={{ padding: '4px 10px', height: 'auto', fontSize: 11 }} onClick={() => copyToClipboard(activeSub.feedback || '')}>
                       <Copy size={12}/> Copiar Tudo
                    </button>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, fontSize: 13, color: 'var(--text2)', maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
                    {cleanFeedback(activeSub.feedback)}
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
