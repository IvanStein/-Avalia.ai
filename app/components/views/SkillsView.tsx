import React from "react";
import { Sparkles, Edit2, Trash2 } from "lucide-react";
import { Skill } from "@/lib/types";

interface SkillsViewProps {
  skills: Skill[];
  onOpenModal: (s?: Skill) => void;
  onDelete: (id: string) => void;
}

export function SkillsView({ skills, onOpenModal, onDelete }: SkillsViewProps) {
  return (
    <>
      <header className="header">
        <div><h1>Habilidades (AI)</h1><p className="subtitle">{skills.length} prompts cadastrados</p></div>
        <button className="btn-primary" onClick={() => onOpenModal()}><Sparkles size={16}/> Nova Habilidade</button>
      </header>
      <div className="table-wrap fade-in">
        <table className="table">
          <thead><tr><th>Nome</th><th>Descrição</th><th>Modelo</th><th>Tipo</th><th></th></tr></thead>
          <tbody>
            {skills.length === 0
              ? <tr><td colSpan={5}><div className="empty-state"><Sparkles size={40}/><p>Nenhuma habilidade customizada.</p></div></td></tr>
              : skills.map(sk => (
                <tr key={sk.id}>
                  <td className="td-name">{sk.name}</td>
                  <td className="td-muted" style={{maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{sk.description}</td>
                  <td className="td-muted">{sk.model}</td>
                  <td><span className="badge">{sk.responseType}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => onOpenModal(sk)}><Edit2 size={13}/></button>
                      <button className="btn-icon-danger" onClick={() => onDelete(sk.id)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}
