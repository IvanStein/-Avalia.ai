import React from "react";
import { Users, UserPlus, CheckCircle, Info } from "lucide-react";
import { Student, Subject } from "@/lib/types";

interface EnrollmentViewProps {
  subjects: Subject[];
  students: Student[];
  enrollSubjectId: string;
  setEnrollSubjectId: (id: string) => void;
  onToggleSubjectClosed: (id: string, closed: boolean) => void;
  onToggleStudentEnrollment: (student: Student) => void;
}

export function EnrollmentView({ 
  subjects, 
  students, 
  enrollSubjectId, 
  setEnrollSubjectId, 
  onToggleSubjectClosed, 
  onToggleStudentEnrollment 
}: EnrollmentViewProps) {
  const subject = subjects.find(s => s.id === enrollSubjectId);
  const isClosed = !!subject?.closed;
  
  const inSubject = students
    .filter(s => (s.subjectIds || []).includes(enrollSubjectId))
    .sort((a,b) => a.name.localeCompare(b.name));
    
  const notInSubject = students
    .filter(s => !(s.subjectIds || []).length)
    .sort((a,b) => a.name.localeCompare(b.name));

  const StudentCard = ({ s, onDoubleClick }: { s: Student; onDoubleClick: () => void }) => (
    <div 
      className="kanban-card" 
      style={{
        cursor: isClosed ? 'not-allowed' : 'pointer', 
        userSelect:'none', 
        display:'flex', 
        justifyContent:'space-between', 
        alignItems:'center', 
        opacity: isClosed ? 0.6 : 1
      }}
      onDoubleClick={isClosed ? undefined : onDoubleClick}
      title={isClosed ? 'Matéria fechada para edição' : 'Dê um duplo-clique para mover'}
    >
      <div>
        <p className="kanban-card-title">{s.name}</p>
        <p style={{fontSize:10, color:'var(--text2)'}}>
          {s.turma || 'Livre'}
        </p>
      </div>
      <Users size={14} style={{opacity:0.3}}/>
    </div>
  );

  return (
    <>
      <header className="header" style={{flexDirection:'column', alignItems:'flex-start', gap:16}}>
        <div>
          <h1>Turmas — Junção Aluno × Matéria</h1>
          <p className="subtitle">Vincule cada aluno a uma matéria para que ele apareça nas correções e relatórios.</p>
        </div>
        <div style={{display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px', background:'var(--accent)10', border:'1px solid var(--accent)30', borderRadius:10, maxWidth:680, fontSize:12.5, color:'var(--text2)', lineHeight:1.6}}>
          <Info size={16} style={{flexShrink:0, marginTop:1}} color="var(--accent)"/>
          <div>
            <strong style={{color:'var(--text)'}}>Como usar:</strong>{' '}
            1. Selecione uma <strong>Matéria</strong> no seletor abaixo.{' '}
            2. Na coluna <em>Não Vinculados</em>, <strong>dê dois cliques</strong> no card do aluno para movê-lo para a turma.{' '}
            3. Para remover um aluno da turma, <strong>dê dois cliques</strong> no card dele na coluna da direita.
          </div>
        </div>
        <div style={{display:'flex', gap:16, alignItems:'center', flexWrap:'wrap'}}>
          <select className="input" style={{maxWidth:300, background:'var(--surface)'}} value={enrollSubjectId} onChange={e => setEnrollSubjectId(e.target.value)}>
            <option value="">-- Selecione uma matéria --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code}) {s.closed ? '🔒' : ''}</option>)}
          </select>

          {enrollSubjectId && (
            <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border)'}}>
              <input 
                type="checkbox" 
                checked={isClosed} 
                onChange={() => onToggleSubjectClosed(enrollSubjectId, !isClosed)} 
              />
              <span>Bloquear inscrições (Matéria Fechada)</span>
            </label>
          )}
        </div>
      </header>

      {!enrollSubjectId ? (
        <div className="empty-state"><Users size={40}/><p>Selecione uma matéria acima para vincular alunos à turma.</p></div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}} className="fade-in">
          <div style={{background:'var(--surface)', padding:16, borderRadius:12, border:'1px solid var(--border)', display:'flex', flexDirection:'column'}}>
            <h3 style={{marginBottom:16, display:'flex', alignItems:'center', gap:8}}><UserPlus size={16}/> Sem Turma <span className="badge">{notInSubject.length}</span></h3>
            <div style={{display:'flex', flexDirection:'column', gap:8, flex:1, overflowY:'auto'}}>
              {notInSubject.map(s => <StudentCard key={s.id} s={s} onDoubleClick={() => onToggleStudentEnrollment(s)}/>)}
              {notInSubject.length === 0 && <p style={{fontSize:12, color:'var(--text2)', textAlign:'center', marginTop:20}}>Todos os alunos cadastrados já estão nesta matéria.</p>}
            </div>
          </div>

          <div style={{background:'var(--surface)', padding:16, borderRadius:12, border:'1px dashed var(--accent)', display:'flex', flexDirection:'column'}}>
            <h3 style={{marginBottom:16, display:'flex', alignItems:'center', gap:8}}><CheckCircle size={16} color="var(--accent)"/> Em {subject?.name} <span className="badge badge-blue">{inSubject.length}</span></h3>
            <div style={{display:'flex', flexDirection:'column', gap:8, flex:1, overflowY:'auto'}}>
              {inSubject.map(s => <StudentCard key={s.id} s={s} onDoubleClick={() => onToggleStudentEnrollment(s)}/>)}
              {inSubject.length === 0 && <p style={{fontSize:12, color:'var(--text2)', textAlign:'center', marginTop:20}}>Nenhum aluno associado. Dê 2 cliques num card ao lado.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
