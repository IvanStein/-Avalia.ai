import React from "react";
import { Plus, Edit2, Upload, Trash2, FileText, CheckCircle } from "lucide-react";
import { Subject } from "@/lib/types";

interface SubjectsViewProps {
  subjects: Subject[];
  onOpenModal: (s?: Subject) => void;
  onDelete: (id: string) => void;
  onSetSyllabusTarget: (s: Subject) => void;
  syllabusChunks: (text: string) => string[];
}

export function SubjectsView({ subjects, onOpenModal, onDelete, onSetSyllabusTarget, syllabusChunks }: SubjectsViewProps) {
  return (
    <>
      <header className="header">
        <div><h1>Matérias</h1><p className="subtitle">{subjects.length} disciplinas</p></div>
        <button className="btn-primary" onClick={() => onOpenModal()}><Plus size={16}/> Nova Matéria</button>
      </header>
      <div className="table-wrap fade-in">
        <table className="table">
          <thead><tr><th>Nome</th><th>Código</th><th>Ementa</th><th></th></tr></thead>
          <tbody>
            {subjects.length === 0
              ? <tr><td colSpan={4}><div className="empty-state"><FileText size={40}/><p>Nenhuma matéria.</p></div></td></tr>
              : subjects.map(s => {
                const chunks = syllabusChunks(s.syllabus ?? '');
                return (
                  <tr key={s.id}>
                    <td className="td-name">{s.name}</td>
                    <td className="td-muted">{s.code}</td>
                    <td>
                      {chunks.length > 0
                        ? <span className="syllabus-chip"><CheckCircle size={11}/> {chunks.length} chunks</span>
                        : <span style={{fontSize:11,color:'var(--text2)'}}>Sem ementa</span>
                      }
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon" onClick={() => onOpenModal(s)}><Edit2 size={13}/></button>
                        <button className="btn-icon" title="Importar ementa" onClick={() => onSetSyllabusTarget(s)}><Upload size={13}/></button>
                        <button className="btn-icon-danger" onClick={() => onDelete(s.id)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </>
  );
}
