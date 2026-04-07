import React from "react";
import { UserPlus, Hash, Upload, Edit2, Trash2 } from "lucide-react";
import { Student, Subject } from "@/lib/types";

interface StudentsViewProps {
  students: Student[];
  subjects: Subject[];
  onOpenModal: (s?: Student) => void;
  onDelete: (id: string) => void;
  onExtractRA: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function StudentsView({ 
  students, 
  subjects, 
  onOpenModal, 
  onDelete, 
  onExtractRA, 
  onImport 
}: StudentsViewProps) {
  return (
    <>
      <header className="header">
        <div><h1>Alunos</h1><p className="subtitle">{students.length} estudantes</p></div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={onExtractRA} title="Extrai o número após o '-' do nome e coloca no campo RA">
            <Hash size={16}/> Extrair RA do Nome
          </button>
          <label className="btn-ghost" style={{cursor:'pointer', position:'relative', overflow:'hidden'}}>
            <Upload size={16}/> Importar (TXT/CSV)
            <input type="file" accept=".txt,.csv" style={{position:'absolute',opacity:0,width:1,height:1,left:0,top:0}} onChange={onImport}/>
          </label>
          <button className="btn-primary" onClick={() => onOpenModal()}><UserPlus size={16}/> Novo Aluno</button>
        </div>
      </header>
      <div className="table-wrap fade-in">
        <table className="table">
          <thead><tr><th>Nome</th><th>RA</th><th>Email</th><th>Turma</th><th>Matéria</th><th></th></tr></thead>
          <tbody>
            {students.length === 0
              ? <tr><td colSpan={6}><div className="empty-state"><UserPlus size={40}/><p>Nenhum aluno.</p></div></td></tr>
              : [...students].sort((a,b) => a.name.localeCompare(b.name)).map(s => {
                const subId = (s.subjectIds || [])[0];
                const sub = subId ? subjects.find(x => x.id === subId) : null;
                return (
                  <tr key={s.id}>
                    <td className="td-name">{s.name}</td>
                    <td style={{fontSize:12, fontWeight:600}}>{s.ra || <span style={{opacity:0.3}}>—</span>}</td>
                    <td className="td-muted">{s.email}</td>
                    <td>{!s.turma ? <span style={{fontSize:11,color:'var(--text2)'}}>Sem turma</span> : <span className="badge badge-blue">{s.turma}</span>}</td>
                    <td>{sub ? <span className="badge-subject">{sub.name}</span> : <span style={{fontSize:11,color:'var(--text2)'}}>Livre</span>}</td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon" onClick={() => onOpenModal(s)}><Edit2 size={13}/></button>
                        <button className="btn-icon-danger" onClick={() => onDelete(s.id)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
