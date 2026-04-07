import React from "react";
import { FileText, CheckCircle, BookOpen, Sparkles, RefreshCw, Check, Check as CheckIcon } from "lucide-react";
import { DBData, Submission } from "@/lib/types";

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

export function AuditView({ 
  dbData, 
  auditSubId, 
  setAuditSubId, 
  auditNote, 
  setAuditNote, 
  onSaveAudit, 
  onGenerateReport,
  getActName
}: AuditViewProps) {
  const auditList = dbData.submissions.filter(s => s.status === 'audit_pending').sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));
  const activeAudit = auditList.find(s => s.id === auditSubId) || auditList[0];

  return (
    <div className="fade-in">
      <header className="header">
         <div><h1>Auditoria Pedagógica</h1><p className="subtitle">Análise detalhada e calibração da IA</p></div>
         <div className="header-actions">
           <button className="btn-ghost" onClick={onGenerateReport}>
             <FileText size={16}/> Gerar Histórico de Auditoria
           </button>
         </div>
      </header>

      {auditList.length === 0 ? (
        <div className="empty-state" style={{ height: 400 }}>
          <CheckCircle size={48} color="var(--blue)"/>
          <h3 style={{marginTop:16}}>Fila de Auditoria Vazia</h3>
          <p>Os casos que você marcar para revisão aparecerão aqui.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 24, height: 'calc(100vh - 250px)' }}>
          {/* List */}
          <div className="card" style={{ padding: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', background: 'var(--surface2)', fontSize: 11, fontWeight: 700, color: 'var(--text2)', borderBottom: '1px solid var(--border)', textTransform:'uppercase' }}>
              Pilha de Trabalho ({auditList.length})
            </div>
            {auditList.map(s => {
               const isActive = activeAudit?.id === s.id;
               return (
                <div key={s.id} onClick={() => { setAuditSubId(s.id); setAuditNote(s.auditNotes || ''); }}
                  style={{ padding: 16, cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isActive ? 'var(--accent)10' : 'transparent', borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--text1)' }}>{s.studentName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{s.subject}</div>
                  <div style={{ marginTop: 8, fontSize: 10, display: 'flex', gap: 8 }}>
                     <span className="badge">Nota IA: {s.grade}</span>
                     <span className="badge" style={{ background: '#f59e0b20', color: '#f59e0b' }}>Aguardando</span>
                  </div>
                </div>
               );
            })}
          </div>

          {/* Editor Area */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface2)30', overflow: 'hidden' }}>
            {!activeAudit ? <div className="empty-state"><p>Selecione um caso para iniciar</p></div> : (
              <>
                <div style={{ padding: 32, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                     <div>
                       <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Análise de {activeAudit.studentName}</h2>
                       <p style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>{activeAudit.subject} • {getActName(activeAudit.feedback || '') || 'Geral'}</p>
                       <p style={{ color: 'var(--text2)', fontSize: 11, marginTop: 4 }}>Caso enviado em {activeAudit.submittedAt}</p>
                     </div>
                     <div style={{ textAlign: 'right' }}>
                       <p style={{fontSize:10, color:'var(--text2)', textTransform:'uppercase'}}>Nota IA</p>
                       <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--accent)', lineHeight:1 }}>{activeAudit.grade}</div>
                     </div>
                  </div>
                </div>

                <div style={{ padding: 32, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <div>
                     <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 12, fontWeight: 700 }}>Texto do Aluno / Feedback IA</h4>
                     <div style={{ fontSize: 14, lineHeight: 1.6, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, whiteSpace: 'pre-wrap' }}>
                       {activeAudit.feedback}
                     </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>Parecer de Auditoria (Professor)</h4>
                     <p style={{ fontSize: 11, color: 'var(--text2)' }}>Indique pontos de melhoria na correção. Suas notas serão usadas para calibrar futuras avaliações deste estilo.</p>
                     <textarea 
                       className="textarea" 
                       style={{ minHeight: 180, fontSize: 14, borderRadius: 12, padding: 20 }} 
                       placeholder="Ex: A IA foi excessivamente técnica. Sugiro um feedback mais encorajador e focado no ponto X..."
                       value={auditNote} 
                       onChange={e => setAuditNote(e.target.value)} 
                     />
                  </div>
                </div>

                <div style={{ padding: 24, background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
                   <button className="btn-primary" style={{ flex: 1, height: 56, fontSize: 15 }} onClick={() => onSaveAudit(true)}>
                     <CheckIcon size={20}/> Aprovar e Finalizar Auditoria
                   </button>
                   <button className="btn-ghost" style={{ height: 56, padding: '0 24px' }} onClick={() => onSaveAudit(false)}>
                     <RefreshCw size={20}/> Salvar Apenas Rascunho
                   </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
