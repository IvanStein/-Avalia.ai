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
        newGrades[student.id] = existing ? existing.grade.toString() : '';
      });
      setGrades(newGrades);
    } else {
      setGrades({});
    }
    setSaveSuccess(false);
  }, [selectedSubId, selectedActId, dbData.submissions, dbData.subjects, dbData.activities, studentsInSubject, getActName]);

  const handleGradeChange = (studentId: string, value: string) => {
    setGrades(prev => ({ ...prev, [studentId]: value }));
    if (saveSuccess) setSaveSuccess(false);
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
      alert("Nenhuma nota para salvar.");
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
          <h1>Lançamento de Notas</h1>
          <p className="subtitle">Lançamento rápido em lote por turma e atividade</p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 24, padding: '32px 24px' }}>
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
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Atividade / Prova</span>
            </label>
            <select 
              className="input" 
              value={selectedActId} 
              onChange={e => setSelectedActId(e.target.value)}
              disabled={!selectedSubId}
              style={{ height: 48, fontSize: '14px' }}
            >
              <option value="">Selecione a Atividade...</option>
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
              <span style={{ fontWeight: 600 }}>{studentsInSubject.length} Alunos Encontrados</span>
            </div>
            {saveSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                <Check size={16} /> Notas salvas com sucesso!
              </div>
            )}
          </div>

          <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>ALUNO</th>
                  <th style={{ width: '40%', textAlign: 'center' }}>NOTA (0.0 - 10.0)</th>
                </tr>
              </thead>
              <tbody>
                {studentsInSubject.map(student => {
                  const gradeValue = parseFloat(grades[student.id]) || 0;
                  const isLowGrade = gradeValue < 6 && grades[student.id] !== '';
                  
                  return (
                    <tr key={student.id}>
                      <td className="td-name">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{student.name}</span>
                          <span style={{ fontSize: 11, opacity: 0.6 }}>{student.ra ? student.ra : student.email}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0" 
                            max="10" 
                            className="input" 
                            placeholder="—"
                            value={grades[student.id] || ''} 
                            onChange={e => handleGradeChange(student.id, e.target.value)}
                            style={{ 
                              width: 100, 
                              textAlign: 'center', 
                              fontSize: 18, 
                              fontWeight: 700,
                              height: 44,
                              borderColor: isLowGrade ? 'rgba(239, 68, 68, 0.4)' : 'var(--border)',
                              background: isLowGrade ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                              color: isLowGrade ? '#ef4444' : 'inherit'
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

          <div style={{ padding: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--surface2)' }}>
            <button 
              className="btn-primary" 
              style={{ padding: '0 48px', height: 54, fontSize: 16 }} 
              disabled={isSaving || studentsInSubject.length === 0}
              onClick={handleSave}
            >
              {isSaving ? <RefreshCw className="spin" size={20} /> : <Check size={20} />}
              Salvar Todas as Notas
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 60, opacity: 0.8 }}>
          <Filter size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
          <h3>Selecione a matéria e atividade</h3>
          <p>Selecione os filtros acima para listar os alunos e lançar as notas.</p>
        </div>
      )}

      {selectedSubId && studentsInSubject.length === 0 && (
        <div className="empty-state" style={{ padding: 60 }}>
          <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: 16 }} />
          <h3>Nenhum aluno enturmado</h3>
          <p>Esta matéria ainda não possui alunos vinculados.</p>
        </div>
      )}
    </div>
  );
}
