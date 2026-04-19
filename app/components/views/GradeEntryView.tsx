import React, { useState, useEffect, useMemo } from "react";
import { Check, RefreshCw, Filter, Users, BookOpen, Clock, AlertCircle } from "lucide-react";
import { DBData, Student, Activity, Subject, Submission } from "@/lib/types";

interface GradeEntryViewProps {
  dbData: DBData;
  onSaveGrades: (grades: { studentName: string, grade: number, subject: string, activityTitle: string }[]) => Promise<void>;
  getStatusConfig: (status: string) => any;
  getActName: (feedback: string) => string | null;
}

export function GradeEntryView({
  dbData,
  onSaveGrades,
  getStatusConfig,
  getActName
}: GradeEntryViewProps) {
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [selectedActId, setSelectedActId] = useState<string>('');
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filter students by selected subject
  const studentsInSubject = useMemo(() => {
    if (!selectedSubId) return [];
    return dbData.students
      .filter(s => (s.subjectIds || []).includes(selectedSubId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedSubId, dbData.students]);

  // Filter activities by selected subject
  const activitiesInSubject = useMemo(() => {
    if (!selectedSubId) return [];
    return dbData.activities.filter(a => a.subjectId === selectedSubId);
  }, [selectedSubId, dbData.activities]);

  const selectedSubject = useMemo(() => {
    return dbData.subjects.find(s => s.id === selectedSubId);
  }, [selectedSubId, dbData.subjects]);

  const selectedActivity = useMemo(() => {
    return dbData.activities.find(a => a.id === selectedActId);
  }, [selectedActId, dbData.activities]);

  // Initialize grades from existing submissions when selection changes
  useEffect(() => {
    if (selectedSubId && selectedActId) {
      const sub = dbData.subjects.find(s => s.id === selectedSubId);
      const act = dbData.activities.find(a => a.id === selectedActId);
      if (!sub || !act) return;

      const newGrades: Record<string, string> = {};
      studentsInSubject.forEach(student => {
        const existing = dbData.submissions.find(s => 
          s.studentName === student.name && 
          s.subject === sub.name && 
          getActName(s.feedback || '') === act.title
        );
        newGrades[student.id] = existing ? (existing.grade ?? '').toString() : '';
      });
      setGrades(newGrades);
      
      // Focus the first input after a short delay to allow rendering
      setTimeout(() => {
        document.getElementById('input-grade-0')?.focus();
      }, 100);
    } else {
      setGrades({});
    }
    setSaveSuccess(false);
  }, [selectedSubId, selectedActId, dbData.submissions, dbData.subjects, dbData.activities, studentsInSubject, getActName]);

  const handleGradeChange = (studentId: string, value: string) => {
    // Validate value to be between 0 and 10 and numeric
    if (value !== '' && (isNaN(parseFloat(value)) || parseFloat(value) > 10 || parseFloat(value) < 0)) {
       // Optional: could block invalid input, but usually better to just let it be and highlight
    }
    setGrades(prev => ({ ...prev, [studentId]: value.replace(',', '.') }));
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.getElementById(`input-grade-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
        (nextInput as HTMLInputElement).select();
      } else {
        // If last input, maybe trigger save? 
        // User didn't ask for auto-save on last enter, but it's a nice touch.
        // For now, just keep it focusable.
      }
    }
    if (e.key === 'ArrowDown') {
      const nextInput = document.getElementById(`input-grade-${index + 1}`);
      nextInput?.focus();
    }
    if (e.key === 'ArrowUp') {
      const prevInput = document.getElementById(`input-grade-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSave = async () => {
    if (!selectedSubId || !selectedActId) {
      alert("Por favor, selecione uma matéria e uma atividade.");
      return;
    }

    const payload = studentsInSubject
      .filter(s => grades[s.id] !== '')
      .map(s => ({
        studentName: s.name,
        grade: parseFloat(grades[s.id]),
        subject: selectedSubject?.name || '',
        activityTitle: selectedActivity?.title || ''
      }));

    if (payload.length === 0) {
      alert("Nenhuma nota preenchida para salvar.");
      return;
    }

    setIsSaving(true);
    try {
      await onSaveGrades(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <header className="header">
        <div>
          <h1>Correção de Prova</h1>
          <p className="subtitle">Fluxo de lançamento rápido e sequencial (Pressione ENTER para pular para o próximo aluno)</p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 24, padding: '32px 24px', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <BookOpen size={15} color="var(--accent)" /> 
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Matéria</span>
            </label>
            <select 
              className="input" 
              value={selectedSubId} 
              onChange={e => { setSelectedSubId(e.target.value); setSelectedActId(''); }}
              style={{ height: 48, fontSize: '14px' }}
            >
              <option value="">Selecione a Matéria...</option>
              {dbData.subjects.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <Clock size={15} color="var(--accent)" />
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Atividade Sendo Corrigida</span>
            </label>
            <select 
              className="input" 
              value={selectedActId} 
              onChange={e => setSelectedActId(e.target.value)}
              disabled={!selectedSubId}
              style={{ height: 48, fontSize: '14px' }}
            >
              <option value="">Selecione a Avaliação...</option>
              {activitiesInSubject.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedSubId && selectedActId ? (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Users size={18} color="var(--accent)" />
              <span style={{ fontWeight: 600 }}>{studentsInSubject.length} Alunos na Fila</span>
            </div>
            {saveSuccess && (
              <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                <Check size={16} /> Blocos de notas salvos com sucesso!
              </div>
            )}
          </div>

          <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>ALUNO (ORDEM ALFABÉTICA)</th>
                  <th style={{ width: '40%', textAlign: 'center' }}>NOTA FINAL</th>
                </tr>
              </thead>
              <tbody style={{ outline: 'none' }}>
                {studentsInSubject.map((student, index) => {
                  const val = grades[student.id];
                  const gradeValue = parseFloat(val) || 0;
                  const isLowGrade = gradeValue < 6 && val !== '';
                  
                  return (
                    <tr key={student.id} className="grade-row">
                      <td className="td-name">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>{student.name}</span>
                          <span style={{ fontSize: 11, opacity: 0.5 }}>{student.ra ? `RA: ${student.ra}` : student.email}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <input 
                            id={`input-grade-${index}`}
                            type="text" 
                            inputMode="decimal"
                            className="input" 
                            placeholder="0.0"
                            value={val || ''} 
                            onChange={e => handleGradeChange(student.id, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, index)}
                            onFocus={e => e.currentTarget.select()}
                            style={{ 
                              width: 100, 
                              textAlign: 'center', 
                              fontSize: 18, 
                              fontWeight: 800,
                              height: 48,
                              borderRadius: '8px',
                              borderWidth: '2px',
                              borderColor: isLowGrade ? 'var(--red)' : 'var(--border2)',
                              background: isLowGrade ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface2)',
                              color: isLowGrade ? 'var(--red)' : 'var(--text)',
                              outline: 'none',
                              transition: 'all 0.1s'
                            }} 
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '32px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 16 }}>
              <span><kbd style={{ background: 'var(--surface3)', padding: '2px 6px', borderRadius: 4 }}>ENTER</kbd> Próximo</span>
              <span><kbd style={{ background: 'var(--surface3)', padding: '2px 6px', borderRadius: 4 }}>↑↓</kbd> Navegar</span>
            </div>
            <button 
              className="btn-primary" 
              style={{ padding: '0 56px', height: 56, fontSize: '17px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)' }} 
              disabled={isSaving || studentsInSubject.length === 0}
              onClick={handleSave}
            >
              {isSaving ? <RefreshCw className="spin" size={20} /> : <Check size={22} />}
              Confirmar TODAS as Notas
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 80, background: 'var(--surface)', borderRadius: 20, border: '1px dashed var(--border)' }}>
          <div style={{ width: 64, height: 64, background: 'var(--accent)10', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
             <Filter size={32} color="var(--accent)" />
          </div>
          <h3 style={{ fontSize: 20 }}>Inicie o fluxo de correção</h3>
          <p style={{ maxWidth: 400, margin: '10px auto 20px' }}>Selecione a matéria e a prova específica acima para carregar a lista de alunos e começar a lançar as notas sequencialmente.</p>
        </div>
      )}

      <style jsx>{`
        .grade-row:focus-within {
          background: rgba(99, 102, 241, 0.05) !important;
        }
        .grade-row:focus-within .td-name span:first-child {
          color: var(--accent);
        }
        kbd {
          font-family: inherit;
        }
      `}</style>

      {selectedSubId && studentsInSubject.length === 0 && (
        <div className="empty-state" style={{ padding: 60 }}>
          <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: 16 }} />
          <h3>Nenhum aluno encontrado</h3>
          <p>Não há alunos vinculados a esta matéria para correção.</p>
        </div>
      )}
    </div>
  );
}
