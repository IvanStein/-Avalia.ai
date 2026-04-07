import React from "react";
import { ArrowLeft, User, BookOpen, Clock, BarChart2, Star, Sparkles } from "lucide-react";
import { DBData, Student } from "@/lib/types";

interface StudentProfileViewProps {
  student: Student;
  dbData: DBData;
  onBack: () => void;
  onViewSubmission: (sub: any) => void;
}

export function StudentProfileView({
  student,
  dbData,
  onBack,
  onViewSubmission
}: StudentProfileViewProps) {
  const stuSubmissions = dbData.submissions.filter(sub => sub.studentName === student.name && sub.status === 'graded');
  const avg = stuSubmissions.length > 0 
    ? (stuSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / stuSubmissions.length).toFixed(1)
    : '0.0';

  return (
    <div className="fade-in">
      <header className="header">
        <div>
          <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>
            <ArrowLeft size={14}/> Voltar para Relatórios
          </button>
          <h1>Jornada de {student.name}</h1>
          <p className="subtitle">Prontuário Acadêmico Detalhado</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Info */}
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, background: 'var(--accent)15', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', marginBottom: 20, color: 'var(--accent)' }}>
              <User size={40} style={{ margin: '0 auto' }}/>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{student.name}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>RA: {student.ra || 'Não informado'}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <span className="badge badge-blue">Ativo</span>
              <span className="badge">Turma 2024</span>
            </div>
          </div>

          {/* Stats */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 20, fontWeight: 700 }}>Desempenho Geral</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart2 size={16} color="var(--blue)"/> Média</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: parseFloat(avg) >= 7 ? 'var(--blue)' : 'var(--red)' }}>{avg}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} color="var(--accent)"/> Entregas</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{stuSubmissions.length}</span>
              </div>
            </div>
          </div>

          {/* Subjects */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 20, fontWeight: 700 }}>Disciplinas Inscritas</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dbData.subjects.filter(s => (student.subjectIds || []).includes(s.id)).map(s => (
                <span key={s.id} className="badge" style={{ background: 'var(--surface2)', padding: '6px 12px' }}>{s.name}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text2)' }}>
            Linha do Tempo de Avaliações
          </div>
          <div style={{ padding: 24, overflow: 'auto' }}>
            {stuSubmissions.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma avaliação registrada para este aluno.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {stuSubmissions.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt)).map(sub => (
                  <div key={sub.id} className="card-hover" style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => onViewSubmission(sub)}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: (sub.grade || 0) >= 7 ? 'var(--blue)15' : 'var(--red)15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (sub.grade || 0) >= 7 ? 'var(--blue)' : 'var(--red)', fontSize: 18, fontWeight: 800 }}>
                        {sub.grade?.toFixed(1)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 700 }}>{sub.subject}</h4>
                        <p style={{ fontSize: 11, color: 'var(--text2)' }}>Avaliado em {new Date(sub.submittedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 200 }}>
                         {(sub.feedback || '').match(/Atividade: (.*)\n/)?.[1] && <span className="badge" style={{ fontSize: 9 }}>{sub.feedback!.match(/Atividade: (.*)\n/)![1]}</span>}
                      </div>
                      <Sparkles size={16} color="var(--border)"/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
