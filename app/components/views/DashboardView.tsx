import React from "react";
import { 
  Upload, Users, BookOpen, CheckCircle, Clock, 
  ArrowRight, ChevronRight, Layers, BarChart2, Database, UserPlus 
} from "lucide-react";
import { DBData, Submission, View } from "@/lib/types";

interface DashboardViewProps {
  dbData: DBData;
  onSetView: (v: View) => void;
  onOpenUpload: () => void;
  onOpenStudentModal: () => void;
  onSelectSubmission: (s: Submission) => void;
  getStatusConfig: (status: string) => any;
  getActName: (feedback: string) => string | null;
}

export function DashboardView({ 
  dbData, 
  onSetView, 
  onOpenUpload, 
  onOpenStudentModal, 
  onSelectSubmission,
  getStatusConfig,
  getActName
}: DashboardViewProps) {
  return (
    <>
      <header className="header">
        <div><h1>Painel de Avaliações</h1><p className="subtitle">Visão Geral do Sistema</p></div>
        <button className="btn-primary" onClick={onOpenUpload}><Upload size={16}/> Novo Trabalho</button>
      </header>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}} className="fade-in">
        <StatsCard label="Total de Alunos" value={dbData.students.length} icon={Users} color="#6366f1" trend="+12%"/>
        <StatsCard label="Matérias Ativas" value={dbData.subjects.length} icon={BookOpen} color="#10b981" subtitle="Ativas hoje"/>
        <StatsCard 
          label="Atividades Corrigidas" 
          value={(() => {
            const graded = dbData.submissions.filter(s => s.status === 'graded');
            const unique = new Set(graded.map(s => `${s.studentName}-${getActName(s.feedback || '') || 'Geral'}`));
            return unique.size;
          })()} 
          icon={CheckCircle} 
          color="#f59e0b" 
          subtitle="do total planejado"
        />
        <StatsCard label="Tempo Médio" value="3.4" icon={Clock} color="#6366f1" subtitle="segundos / aluno"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:24}}>
        <div style={{background:'var(--surface)',padding:24,borderRadius:16,border:'1px solid var(--border)'}}>
          <h2 style={{fontSize:15,fontWeight:600,marginBottom:20,display:'flex',alignItems:'center',gap:8}}><CheckCircle size={18} color="var(--accent)"/> Resumo das Submissões</h2>
          <div className="table-wrap" style={{border:'none',margin:0}}>
            <table className="table" style={{minWidth:'unset'}}>
              <thead>
                <tr><th style={{fontSize:10}}>ALUNO</th><th style={{fontSize:10}}>NOTA</th><th style={{fontSize:10}}>DATA</th><th style={{textAlign:'right'}}></th></tr>
              </thead>
              <tbody>
                {dbData.submissions.slice(0, 10).map(s => {
                  const cfg = getStatusConfig(s.status);
                  return (
                    <tr key={s.id} onClick={() => onSelectSubmission(s)} style={{cursor:'pointer'}}>
                      <td className="td-name" style={{fontSize:13}}>{s.studentName}</td>
                      <td>
                        <span className="status-pill" style={{background:cfg.color+'15',color:cfg.color,fontSize:11,padding:'2px 8px'}}>
                          <cfg.icon size={11}/> {s.grade?.toFixed(1) ?? '—'}
                        </span>
                      </td>
                      <td className="td-muted" style={{fontSize:11}}>{s.submittedAt.split(' ')[0]}</td>
                      <td><div className="actions" style={{justifyContent:'flex-end'}}><ChevronRight size={14}/></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:'var(--surface)',padding:24,borderRadius:16,border:'1px solid var(--border)',flex:1}}>
            <h2 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Ações Rápidas</h2>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <QuickAction icon={Layers} label="Lote de Atividades" onClick={() => onSetView('batch')}/>
              <QuickAction icon={UserPlus} label="Adicionar Aluno" onClick={onOpenStudentModal}/>
              <QuickAction icon={BarChart2} label="Gerar Relatório" onClick={() => onSetView('reports')}/>
              <QuickAction icon={Database} label="Banco de Dados" onClick={() => onSetView('settings')}/>
            </div>
          </div>

          <div style={{background:'var(--surface)',padding:24,borderRadius:16,border:'1px solid var(--border)',flex:1}}>
            <h2 style={{fontSize:15,fontWeight:600,marginBottom:12}}>Status da Turma</h2>
            <p style={{fontSize:12,color:'var(--text2)',marginBottom:16}}>Desempenho consolidado das últimas 48h.</p>
            <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
              {[40,70,50,90,30,80,95,60,40,70].map((h,i) => <div key={i} style={{flex:1,background:'linear-gradient(to top, var(--accent), var(--accent2))',height:`${h}%`,borderRadius:'4px 4px 0 0',opacity:0.3+ (h/200)}} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatsCard({ label, value, icon: Icon, color, trend, subtitle }: any) {
  return (
    <div style={{background:'var(--surface2)',padding:'20px 24px',borderRadius:14,border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{fontSize:12,color:'var(--text2)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</h3>
        <div style={{background:color+'20',borderRadius:8,padding:6}}><Icon size={15} color={color}/></div>
      </div>
      <div style={{display:'flex',alignItems:'baseline',gap:8}}>
        <span style={{fontSize:28,fontWeight:700,letterSpacing:'-0.02em'}}>{value}</span>
        {trend && <span style={{fontSize:12,color:'#10b981',fontWeight:600,display:'flex',alignItems:'center'}}><ArrowRight size={10} style={{transform:'rotate(-45deg)'}}/> {trend}</span>}
        {subtitle && <span style={{fontSize:11,color:'var(--text2)'}}>{subtitle}</span>}
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: any) {
  return (
    <button className="btn-ghost" style={{justifyContent:'flex-start',padding:'12px 16px'}} onClick={onClick}>
      <Icon size={16}/> {label}
    </button>
  );
}
