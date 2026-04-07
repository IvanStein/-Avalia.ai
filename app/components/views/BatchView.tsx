import React from "react";
import { RefreshCw, X, ChevronRight, BookOpen, Upload, Sparkles, AlertCircle, CheckCircle, Trash2, Edit2 } from "lucide-react";
import { DBData, BatchEntry } from "@/lib/types";

interface BatchViewProps {
  dbData: DBData;
  batchStep: 'upload' | 'validate' | 'results';
  setBatchStep: (step: 'upload' | 'validate' | 'results') => void;
  batchEntries: BatchEntry[];
  setBatchEntries: React.Dispatch<React.SetStateAction<BatchEntry[]>>;
  batchSubjectId: string;
  setBatchSubjectId: (id: string) => void;
  batchActivityId: string;
  setBatchActivityId: (id: string) => void;
  batchRunning: boolean;
  batchReport: { succeeded: number; failed: number } | null;
  setBatchReport: (report: { succeeded: number; failed: number } | null) => void;
  onSaveAndExit: () => void;
  onAddFiles: (files: FileList) => void;
  onUpdateEntry: (id: string, data: Partial<BatchEntry>) => void;
  onRunBatch: () => void;
  onRetryEntry: (id: string) => void;
  onGoToManual: (entry: BatchEntry) => void;
  onDeleteSubmission: (id: string) => void;
  onViewDetails: (submission: any) => void;
  onReset: () => void;
  syllabusChunks: (text: string) => string[];
  onAuditRequest: (id: string) => void;
}

export function BatchView({
  dbData,
  batchStep,
  setBatchStep,
  batchEntries,
  setBatchEntries,
  batchSubjectId,
  setBatchSubjectId,
  batchActivityId,
  setBatchActivityId,
  batchRunning,
  batchReport,
  setBatchReport,
  onSaveAndExit,
  onAddFiles,
  onUpdateEntry,
  onRunBatch,
  onRetryEntry,
  onGoToManual,
  onDeleteSubmission,
  onViewDetails,
  onReset,
  syllabusChunks,
  onAuditRequest
}: BatchViewProps) {
  return (
    <div className="fade-in">
      <header className="header" style={{ marginBottom: 24 }}>
        <div>
          <h1>Correção</h1>
          <p className="subtitle">
            {batchStep === 'upload' && "Fase 1: Upload e Identificação"}
            {batchStep === 'validate' && "Fase 2: Validação de Contexto"}
            {batchStep === 'results' && "Fase 3: Resultados e Feedbacks"}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={onSaveAndExit} title="Salva o progresso e volta para a dashboard">
            <RefreshCw size={15}/> Salvar e Sair
          </button>
          {batchStep === 'upload' && (
            <>
              <button className="btn-ghost" onClick={onReset}><X size={15}/> Limpar</button>
              <button className="btn-primary" 
                disabled={batchEntries.length === 0 || !batchSubjectId}
                onClick={() => setBatchStep('validate')}>
                Próximo Passo <ChevronRight size={16}/>
              </button>
            </>
          )}
        </div>
      </header>

      {/* STEP 1: UPLOAD & MATCHING */}
      {batchStep === 'upload' && (
        <div className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                <BookOpen size={16} color="var(--accent)"/> 1. Matéria
              </label>
              <select className="input" style={{ width: '100%' }} value={batchSubjectId} onChange={e => {
                setBatchSubjectId(e.target.value);
                setBatchActivityId('');
                setBatchEntries(prev => prev.map(en => ({ ...en, subjectId: e.target.value })));
              }}>
                <option value="">Selecione...</option>
                {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                <Sparkles size={16} color="#10b981"/> 2. Atividade
              </label>
              <select className="input" value={batchActivityId} onChange={e => setBatchActivityId(e.target.value)} disabled={!batchSubjectId}>
                <option value="">-- Avaliação Geral --</option>
                {dbData.activities.filter(a => a.subjectId === batchSubjectId).map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>

            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                <Upload size={16} color="var(--accent)"/> 3. PDFs
              </label>
              <label className="drop-zone drop-zone-sm" style={{ 
                cursor: 'pointer', 
                height: 48, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: 13,
                borderStyle: 'dashed'
              }}>
                Selecionar arquivos
                <input type="file" accept=".pdf" multiple style={{ display: 'none' }}
                  onChange={e => e.target.files && onAddFiles(e.target.files)}/>
              </label>
            </div>
          </div>

          {batchEntries.length > 0 && (
            <div className="table-wrap">
              <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,2fr) minmax(0,1.5fr) 40px', gap: 12, padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase' }}>
                <span>#</span><span>Arquivo</span><span>Aluno Identificado</span><span></span>
              </div>
              {batchEntries.map((entry, idx) => (
                <div key={entry.id} className="batch-item" style={{ gridTemplateColumns: '28px minmax(0,2fr) minmax(0,1.5fr) 40px', padding: '10px 16px', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{idx+1}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.filename}</span>
                  <select className="input" style={{ fontSize: 12, padding: '5px 10px' }}
                    value={entry.studentId}
                    onChange={e => onUpdateEntry(entry.id, { studentId: e.target.value })}>
                    <option value="">Selecionar aluno...</option>
                    {dbData.students
                      .filter(s => !batchSubjectId || (s.subjectIds || []).includes(batchSubjectId))
                      .sort((a,b) => a.name.localeCompare(b.name))
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className="btn-icon-danger" onClick={() => setBatchEntries(prev => prev.filter(en => en.id !== entry.id))}><X size={14}/></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn-ghost" onClick={onReset}><X size={15}/> Limpar Tudo</button>
            <button className="btn-primary" 
              disabled={batchEntries.length === 0 || !batchSubjectId}
              onClick={() => setBatchStep('validate')}>
              Próximo Passo <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: VALIDATION */}
      {batchStep === 'validate' && (() => {
        const sub = dbData.subjects.find(s => s.id === batchSubjectId);
        const syllabus = syllabusChunks(sub?.syllabus ?? '');
        return (
          <div className="fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 24, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--accent)', flex: 1 }}>
                  <h3 style={{ fontSize: 13, color:'var(--text1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} color="var(--accent)"/> Orientações da Matéria
                  </h3>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{sub?.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>{sub?.code}</p>
                  <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', padding: 10, borderRadius: 8, maxHeight: 150, overflow: 'auto', border: '1px solid var(--border)' }}>
                    {syllabus.length > 0 ? syllabus[0].slice(0, 800) + '...' : 'Sem ementa cadastrada.'}
                  </div>
                </div>

                <div className="card" style={{ padding: 20, borderLeft: '4px solid #10b981', flex: 1 }}>
                  <h3 style={{ fontSize: 13, color:'var(--text1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="#10b981"/> Contexto de Atividade
                  </h3>
                  <div style={{ padding: 12, background: 'var(--surface1)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      {batchActivityId ? dbData.activities.find(a => a.id === batchActivityId)?.title : 'Avaliação Geral'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
                      {batchActivityId ? dbData.activities.find(a => a.id === batchActivityId)?.description : 'Análise baseada apenas na ementa da matéria.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: 13, color:'var(--text1)', marginBottom: 16 }}>Resumo do Lote</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'auto', maxHeight: 350 }}>
                  {batchEntries.map((e, i) => {
                    const stu = dbData.students.find(s => s.id === e.studentId);
                    return (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>{i+1}. {e.filename}</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{stu?.name || 'Não associado'}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 20, padding: 16, background: 'var(--accent)10', borderRadius: 8, border: '1px solid var(--accent)30' }}>
                  <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Pronto para processar?</p>
                  <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>O sistema realizará uma análise completa e detalhada baseada nos critérios pedagógicos.</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                {!batchActivityId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f59e0b', background: '#f59e0b15', padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b40' }}>
                    <AlertCircle size={14}/>
                    <span><strong>Atividade não selecionada.</strong> As correções irão para o grupo "Geral".</span>
                  </div>
                )}
                {batchActivityId && (() => {
                  const act = dbData.activities.find(a => a.id === batchActivityId);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#10b981', background: '#10b98115', padding: '8px 14px', borderRadius: 8, border: '1px solid #10b98140' }}>
                      <CheckCircle size={14}/>
                      <span>Atividade vinculada: <strong>{act?.title}</strong></span>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-ghost" onClick={() => setBatchStep('upload')}>Voltar</button>
                <button className="btn-primary" onClick={onRunBatch}>
                  <Sparkles size={16}/> Enviar para Correção
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 3: RESULTS */}
      {batchStep === 'results' && (
        <div className="fade-in">
          {batchRunning ? (
            <div className="empty-state" style={{ height: 400 }}>
              <div className="spin" style={{ marginBottom: 20 }}><RefreshCw size={48} color="var(--accent)"/></div>
              <h2>Analisando Trabalhos...</h2>
              <p>Aguarde enquanto o sistema processa cada documento baseado na ementa e critérios pedagógicos.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <div className="stat-card" style={{ flex: 1, borderTop: '4px solid var(--green)' }}>
                  <h3>Sucesso</h3>
                  <p>{batchReport?.succeeded || 0} corrigidos</p>
                </div>
                <div className="stat-card" style={{ flex: 1, borderTop: '4px solid var(--red)' }}>
                  <h3>Erros</h3>
                  <p>{batchReport?.failed || 0} falhas</p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Status/Nota</th>
                      <th>Feedback / Erro</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchEntries.map(e => (
                      <tr key={e.id}>
                        <td className="td-name">
                          {dbData.students.find(s => s.id === e.studentId)?.name || 'Aluno'}
                          <br/><span style={{ fontSize: 10, color: 'var(--text2)' }}>{e.filename}</span>
                        </td>
                        <td>
                          {e.status === 'done' ? (
                            <span className="badge badge-green" style={{ fontSize: 14 }}>{e.result?.grade?.toFixed(1)}</span>
                          ) : (
                            <span className="badge badge-red">ERRO</span>
                          )}
                        </td>
                        <td style={{ maxWidth: 400 }}>
                          <p style={{ fontSize: 12, lineHeight: 1.4 }} className={e.status === 'error' ? 'text-red' : ''}>
                            {e.status === 'done' ? e.result?.feedback?.slice(0, 150) + '...' : (
                              <span><strong>Falha:</strong> {e.error}</span>
                            )}
                          </p>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {e.status === 'processing' && (
                              <div className="spin"><RefreshCw size={14}/></div>
                            )}
                            {e.status === 'done' && (
                              <>
                                <button className="btn-ghost" style={{ padding: '4px 10px', height: 'auto', fontSize: 11, border: '1px solid var(--accent)' }} 
                                  onClick={() => onAuditRequest(e.result!.id)} title="Solicitar Auditoria">
                                  Auditoria
                                </button>
                                <button className="btn-icon" onClick={() => onViewDetails(e.result!)} title="Ver Detalhes">
                                  <ChevronRight size={14}/>
                                </button>
                                <button className="btn-icon-danger" onClick={() => onDeleteSubmission(e.result!.id)} title="Excluir Correção">
                                  <Trash2 size={14}/>
                                </button>
                              </>
                            )}
                            {e.status === 'error' && (
                              <>
                                <button className="btn-ghost" style={{ padding: '4px 10px', height: 'auto', fontSize: 11, border: '1px solid var(--accent)' }} 
                                  onClick={() => onRetryEntry(e.id)} title="Tentar Novamente">
                                  <RefreshCw size={12}/> Retentar
                                </button>
                                <button className="btn-ghost" style={{ padding: '4px 10px', height: 'auto', fontSize: 11, border: '1px solid #10b981' }} 
                                  onClick={() => onGoToManual(e)} title="Lançar Manualmente">
                                  <Edit2 size={12}/> Manual
                                </button>
                                <button className="btn-icon-danger" onClick={() => setBatchEntries(prev => prev.filter(x => x.id !== e.id))} title="Remover da Lista">
                                  <Trash2 size={14}/></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn-primary" onClick={onReset}>
                  Nova Correção
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
