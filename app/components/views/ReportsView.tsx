import React from "react";
import { RefreshCw, Layers, BarChart2 } from "lucide-react";
import { DBData } from "@/lib/types";

interface ReportsViewProps {
  dbData: DBData;
  loading: boolean;
  onFetchDB: () => void;
  reportType: 'subject' | 'activity';
  setReportType: (type: 'subject' | 'activity') => void;
  reportSubjectId: string;
  setReportSubjectId: (id: string) => void;
  reportActivityId: string;
  setReportActivityId: (id: string) => void;
  reportPreviewData: any;
  onGoToBatch: (subjectId: string) => void;
  onGeneratePDF: (data: any) => Promise<void>;
  onOpenStudentProfile: (id: string) => void;
}

export function ReportsView({
  dbData,
  loading,
  onFetchDB,
  reportType,
  setReportType,
  reportSubjectId,
  setReportSubjectId,
  reportActivityId,
  setReportActivityId,
  reportPreviewData,
  onGoToBatch,
  onGeneratePDF,
  onOpenStudentProfile
}: ReportsViewProps) {
  return (
    <div className="fade-in">
      <header className="header" style={{ marginBottom: 24 }}>
        <div>
          <h1>Relatórios Acadêmicos</h1>
          <p className="subtitle">Gere pautas de notas e faltas em PDF</p>
        </div>
        <button className="btn-icon" onClick={onFetchDB} title="Recarregar Dados">
          <RefreshCw size={18} className={loading ? 'spin' : ''}/>
        </button>
      </header>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label">Tipo de Relatório</label>
            <div className="toggle-group" style={{ marginTop: 0 }}>
              <button className={reportType === 'subject' ? 'active' : ''} onClick={() => setReportType('subject')}>Por Matéria</button>
              <button className={reportType === 'activity' ? 'active' : ''} onClick={() => setReportType('activity')}>Por Atividade</button>
            </div>
          </div>
          <div>
            <label className="field-label">Matéria</label>
            <select className="input" value={reportSubjectId} onChange={e => {
              setReportSubjectId(e.target.value);
              setReportActivityId('');
            }}>
              <option value="">Selecione...</option>
              {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          {reportType === 'activity' && (
            <div>
              <label className="field-label">Atividade</label>
              <select className="input" value={reportActivityId} onChange={e => setReportActivityId(e.target.value)} disabled={!reportSubjectId}>
                <option value="">Selecione...</option>
                {dbData.activities.filter(a => a.subjectId === reportSubjectId).map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {reportPreviewData && (
        <div className="fade-in">
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Prévisualização do Relatório</h3>
                <p style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {reportPreviewData.title} 
                  {reportPreviewData.applicationDate && <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 6 }}>• Aplicado em: {reportPreviewData.applicationDate}</span>}
                  • {reportPreviewData.body.length} alunos identificados
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-ghost" onClick={() => onGoToBatch(reportSubjectId)}>
                  <Layers size={14}/> Ir para Correção
                </button>
                <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={() => onGeneratePDF(reportPreviewData)}>
                  <BarChart2 size={16}/> Gerar PDF Final
                </button>
              </div>
            </div>

            {/* Summary Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: reportPreviewData.applicationDate ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Atividades Corrigidas</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent2)' }}>{reportPreviewData.stats.totalGraded}</span>
              </div>
              {reportPreviewData.applicationDate && (
                <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Data da Aplicação</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{reportPreviewData.applicationDate}</span>
                </div>
              )}
              <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Média Geral da Turma</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: parseFloat(reportPreviewData.stats.classAvg) >= 7 ? 'var(--blue)' : 'var(--red)' }}>{reportPreviewData.stats.classAvg}</span>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Taxa de Entrega</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{reportPreviewData.stats.participation}%</span>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, letterSpacing: '0.05em' }}>Alunos Ativos</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                  {dbData.students.filter(s => (s.subjectIds || []).includes(reportSubjectId)).length}
                </span>
              </div>
            </div>
            
            <div className="table-wrap" style={{ maxHeight: 500, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              <table className="table" style={{ fontSize: 11, borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface2)' }}>
                  <tr>
                    {reportPreviewData.head.map((h: string, i: number) => (
                      <th key={i} style={{ 
                        whiteSpace: 'nowrap', 
                        background: 'var(--surface2)', 
                        borderBottom: '2px solid var(--border)',
                        padding: '12px 16px',
                        textAlign: 'left'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportPreviewData.body.map((row: any[], i: number) => (
                    <tr key={i}>
                      {row.map((cell: any, j: number) => {
                        const isMatrixGrade = reportPreviewData.isMatrix && (j > 0 && j < (reportPreviewData.head.length - 2) && j % 2 !== 0);
                        const isMatrixAvg = reportPreviewData.isMatrix && j === (reportPreviewData.head.length - 2);
                        const isActivityGrade = !reportPreviewData.isMatrix && j === 1;
                        const isAnyGradeCol = isMatrixGrade || isMatrixAvg || isActivityGrade;
                        
                        let customColor = (j === 0 ? 'var(--text1)' : 'var(--text2)');
                        if (isAnyGradeCol) {
                          const val = parseFloat(cell);
                          customColor = val >= 7 ? 'var(--blue)' : 'var(--red)';
                        }

                        return (
                          <td key={j} style={{ 
                            padding: '10px 16px',
                            borderBottom: '1px solid var(--border)',
                            fontWeight: (j === 0 || isAnyGradeCol) ? 600 : 400,
                            color: customColor,
                          }}>
                            {j === 0 ? (
                              <span className="td-name-link" onClick={() => {
                                const stu = dbData.students.find(s => s.name === cell);
                                if (stu) onOpenStudentProfile(stu.id);
                              }}>
                                {cell}
                              </span>
                            ) : j === 3 && !reportPreviewData.isMatrix ? (
                              <div style={{ maxWidth: 400, maxHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {cell}
                              </div>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
