import React from "react";
import { Plus, Sparkles, Clock, Edit2, Trash2 } from "lucide-react";
import { Activity, Subject } from "@/lib/types";

interface ActivitiesViewProps {
  activities: Activity[];
  subjects: Subject[];
  onOpenModal: (a?: Activity) => void;
  onDelete: (id: string) => void;
  onImportFromSyllabus: () => void;
}

export function ActivitiesView({ 
  activities, 
  subjects, 
  onOpenModal, 
  onDelete, 
  onImportFromSyllabus 
}: ActivitiesViewProps) {
  return (
    <>
      <header className="header">
        <div><h1>Atividades</h1><p className="subtitle">{activities.length} avaliações</p></div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={onImportFromSyllabus}><Sparkles size={16}/> Importar da Ementa</button>
          <button className="btn-primary" onClick={() => onOpenModal()}><Plus size={16}/> Nova Atividade</button>
        </div>
      </header>
      <div className="table-wrap fade-in">
        <table className="table" style={{tableLayout:'fixed'}}>
          <thead><tr><th style={{width:'30%'}}>Título</th><th style={{width:'20%'}}>Matéria</th><th style={{width:'15%'}}>Data</th><th style={{width:'8%'}}>Peso</th><th style={{width:'20%'}}>Critério IA</th><th style={{width:'7%', textAlign:'right'}}></th></tr></thead>
          <tbody>
            {activities.length === 0
              ? <tr><td colSpan={6}><div className="empty-state"><Clock size={40}/><p>Nenhuma atividade.</p></div></td></tr>
              : activities.map(a => {
                const sub = subjects.find(s => s.id === a.subjectId);
                return (
                  <tr key={a.id}>
                    <td className="td-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {a.title}
                        {a.type === 'prova' && <span className="badge badge-red" style={{ fontSize: 9, padding: '2px 6px' }}>PROVA</span>}
                      </div>
                    </td>
                    <td><span className="badge-subject">{sub?.name ?? a.subjectId}</span></td>
                    <td className="td-muted" style={{fontSize:12}}>{a.applicationDate || <span style={{opacity:.4}}>Não def.</span>}</td>
                    <td className="td-muted">{a.weight}×</td>
                    <td className="td-desc">{a.description || <span style={{opacity:.4}}>—</span>}</td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon" onClick={() => onOpenModal(a)}><Edit2 size={13}/></button>
                        <button className="btn-icon-danger" onClick={() => onDelete(a.id)}><Trash2 size={14}/></button>
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
