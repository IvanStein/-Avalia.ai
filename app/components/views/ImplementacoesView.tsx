import React from "react";
import { Lightbulb, Plus, Edit2, Trash2, Calendar, Target, Clock, ArrowRight } from "lucide-react";
import { DBData, Implementacao } from "@/lib/types";

interface ImplementacoesViewProps {
  dbData: DBData;
  onOpenModal: (impl?: Implementacao) => void;
  onDelete: (id: string) => void;
  implStatus: Record<string, { label: string; color: string }>;
}

export function ImplementacoesView({ dbData, onOpenModal, onDelete, implStatus }: ImplementacoesViewProps) {
  return (
    <>
      <header className="header">
        <div><h1>Implementações</h1><p className="subtitle">Gestão de Demandas do Projeto</p></div>
        <button className="btn-primary" onClick={() => onOpenModal()}><Plus size={16}/> Nova Demanda</button>
      </header>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:20}} className="fade-in">
        {dbData.implementacoes.length === 0
          ? <div className="empty-state" style={{gridColumn:'1/-1'}}><Lightbulb size={40}/><p>Sem ideias no backlog.</p></div>
          : dbData.implementacoes.map(impl => (
            <div key={impl.id} className="card" style={{padding:20, display:'flex', flexDirection:'column', gap:12}}>
               <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                  <span className="badge" style={{background:implStatus[impl.status]?.color+'20', color:implStatus[impl.status]?.color}}>
                    {implStatus[impl.status]?.label}
                  </span>
                  <div className="actions">
                    <button className="btn-icon" onClick={() => onOpenModal(impl)}><Edit2 size={13}/></button>
                    <button className="btn-icon-danger" onClick={() => onDelete(impl.id)}><Trash2 size={14}/></button>
                  </div>
               </div>
               
               {impl.imageUrl && <img src={impl.imageUrl} style={{width:'100%', height:140, objectFit:'cover', borderRadius:10}}/>}

               <div>
                 <h3 style={{fontSize:16,fontWeight:700,marginBottom:8}}>{impl.title}</h3>
                 <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{impl.description}</p>
               </div>

               <div style={{marginTop:'auto', paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text2)'}}>
                   <Calendar size={12}/> {impl.createdAt.split('T')[0]}
                 </div>
                 <span className={`badge ${impl.priority==='alta'?'badge-red':impl.priority==='media'?'badge-yellow':'badge-green'}`} style={{fontSize:10}}>
                   {impl.priority.toUpperCase()}
                 </span>
               </div>
            </div>
          ))
        }
      </div>
    </>
  );
}
