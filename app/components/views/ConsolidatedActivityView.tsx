import React from "react";
import { BookOpen, ChevronUp, ChevronDown, Clock, ChevronRight, Trash2, Layers } from "lucide-react";
import { DBData, Subject, Activity, Submission } from "@/lib/types";

interface ConsolidatedActivityViewProps {
  dbData: DBData;
  expandedSubjects: Record<string, boolean>;
  setExpandedSubjects: (v: any) => void;
  expandedActivities: Record<string, boolean>;
  setExpandedActivities: (v: any) => void;
  onSelectSubmission: (s: Submission) => void;
  onDeleteSubmission: (id: string) => void;
  onDeleteActivitySubmissions: (subjectId: string, activityTitle: string) => void;
  onNavigateToBatch: () => void;
  getStatusConfig: (status: string) => any;
  getActName: (feedback: string) => string | null;
}

export function ConsolidatedActivityView({
  dbData,
  expandedSubjects,
  setExpandedSubjects,
  expandedActivities,
  setExpandedActivities,
  onSelectSubmission,
  onDeleteSubmission,
  onDeleteActivitySubmissions,
  onNavigateToBatch,
  getStatusConfig,
  getActName
}: ConsolidatedActivityViewProps) {
  return (
    <div style={{marginTop:32}}>
      <header className="header">
        <div><h2 style={{fontSize:18,fontWeight:600}}>Consolidado por Atividade</h2><p className="subtitle">Explore todas as correções enviadas</p></div>
      </header>
      
      {dbData.subjects.map(sub => {
        const studentsInSub = dbData.students.filter(st => (st.subjectIds || []).includes(sub.id));
        const activities = dbData.activities.filter(a => a.subjectId === sub.id);
        if (activities.length === 0) return null;
        
        const isSubExpanded = expandedSubjects[sub.id];

        return (
          <div key={sub.id} className="card" style={{marginBottom:12, padding:0, overflow:'hidden'}}>
            <div 
              style={{padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', background: isSubExpanded ? 'var(--surface2)' : 'transparent'}}
              onClick={() => setExpandedSubjects((prev: any) => ({...prev, [sub.id]: !prev[sub.id]}))}
            >
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <BookOpen size={18} color="var(--accent)"/>
                <span style={{fontWeight:600, fontSize:15}}>{sub.name}</span>
                <span className="badge" style={{fontSize:10}}>{studentsInSub.length} alunos</span>
              </div>
              {isSubExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
            </div>

            {isSubExpanded && (
              <div style={{padding:'4px 12px 16px 12px', borderTop:'1px solid var(--border)'}}>
                {activities.map(a => {
                  const subsForAct = dbData.submissions.filter(s => s.subject === sub.name && (getActName(s.feedback || '') === a.title));
                  const isActExpanded = expandedActivities[a.id];
                  const deliveryRate = studentsInSub.length > 0 ? (subsForAct.length / studentsInSub.length * 100).toFixed(0) : 0;

                  return (
                    <div key={a.id} style={{marginTop:8, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden'}}>
                      <div 
                        style={{padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', background: isActExpanded ? 'var(--surface)' : 'var(--surface2)'}}
                        onClick={() => setExpandedActivities((prev: any) => ({...prev, [a.id]: !prev[a.id]}))}
                      >
                        <div style={{display:'flex', alignItems:'center', gap:12}}>
                          <Clock size={16} style={{opacity:0.5}}/>
                          <div>
                            <p style={{fontSize:13, fontWeight:600}}>{a.title}</p>
                            <div style={{display:'flex', alignItems:'center', gap:12, marginTop:2}}>
                                                              {a.applicationDate && <span style={{fontSize:10, background:'var(--accent)20', color:'var(--accent)', padding:'1px 6px', borderRadius:4, fontWeight:600}}>{a.applicationDate}</span>}
                                <span style={{fontSize:11, color:'var(--text2)'}}>{subsForAct.length} / {studentsInSub.length} entregas</span>

                               <div style={{width:60, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden'}}>
                                  <div style={{width:`${deliveryRate}%`, height:'100%', background:Number(deliveryRate) > 50 ? '#10b981' : '#f59e0b'}}/>
                               </div>
                            </div>
                          </div>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:12}}>
                           {subsForAct.length > 0 && (
                             <button 
                               className="btn-icon-danger" 
                               style={{padding:6}}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (window.confirm(`Deseja apagar TODAS as ${subsForAct.length} avaliações desta atividade?`)) {
                                   onDeleteActivitySubmissions(sub.id, a.title);
                                 }
                               }}
                               title="Apagar todas as avaliações desta atividade"
                             >
                               <Trash2 size={16}/>
                             </button>
                           )}
                           {isActExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                      </div>

                      {isActExpanded && (
                        <div className="table-wrap" style={{border:'none', margin:0, borderRadius:0, borderTop:'1px solid var(--border)'}}>
                          <table className="table" style={{minWidth:'unset'}}>
                            <thead>
                              <tr><th style={{fontSize:10}}>ALUNO</th><th style={{fontSize:10}}>NOTA</th><th style={{fontSize:10}}>DATA</th><th style={{textAlign:'right'}}></th></tr>
                            </thead>
                            <tbody>
                              {subsForAct.map(submission => {
                                const cfg = getStatusConfig(submission.status);
                                return (
                                  <tr key={submission.id} onClick={() => onSelectSubmission(submission)} style={{cursor:'pointer'}}>
                                    <td className="td-name" style={{fontSize:13}}>
                                      {submission.studentName}
                                    </td>
                                    <td>
                                      <span className="status-pill" style={{background:cfg.color+'18',color:cfg.color, fontSize:11, padding:'2px 8px'}}>
                                        <cfg.icon size={11}/> {submission.grade?.toFixed(1) ?? '—'}
                                      </span>
                                    </td>
                                    <td className="td-muted" style={{fontSize:11}}>{submission.submittedAt.split(' ')[0]}</td>
                                    <td>
                                      <div className="actions" onClick={e => e.stopPropagation()} style={{justifyContent:'flex-end'}}>
                                        <button className="btn-icon" onClick={() => onSelectSubmission(submission)} title="Ver Detalhes"><ChevronRight size={14}/></button>
                                        <button className="btn-icon-danger" onClick={() => onDeleteSubmission(submission.id)} title="Excluir"><Trash2 size={14}/></button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
      {dbData.submissions.length === 0 && (
        <div className="empty-state" style={{background:'var(--surface)', borderRadius:12, padding:40, border:'1px dashed var(--border)'}}>
          <Layers size={40} style={{opacity:0.2, marginBottom:16}}/>
          <p>Nenhuma correção registrada no sistema.</p>
          <button className="btn-primary" style={{marginTop:16}} onClick={onNavigateToBatch}>Iniciar Nova Correção</button>
        </div>
      )}
    </div>
  );
}
