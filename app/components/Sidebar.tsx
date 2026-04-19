"use client";

import React from "react";
import { View } from "@/lib/types";
import { 
  GraduationCap, 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  FileText, 
  Layers, 
  BarChart2, 
  Lightbulb, 
  Sparkles, 
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardCheck,
  UsersRound,
  Copy,
  Edit3,
  CheckSquare
} from "lucide-react";

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

export function Sidebar({ view, setView, collapsed, setCollapsed }: SidebarProps) {
  const NavItem = ({ v, icon: Icon, label }: { v: any; icon: any; label: string }) => (
    <button className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
      <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
    </button>
  );

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="logo"><GraduationCap size={26} strokeWidth={1.5}/><span>Aval.IA</span></div>
        <button className="btn-icon" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}
        </button>
      </div>

      <nav className="nav">
        <p className="nav-label">Pedagógico</p>
        <NavItem v="dashboard"      icon={LayoutDashboard} label="Dashboard"/>
        <NavItem v="subjects"       icon={BookOpen}        label="Matérias"/>
        <NavItem v="students"       icon={Users}           label="Alunos"/>
        <NavItem v="enrollment"     icon={UsersRound}      label="Turmas"/>
        <NavItem v="activities"     icon={ClipboardCheck}  label="Atividades"/>
        
        <p className="nav-label">Avaliação</p>
        <NavItem v="grade-entry"    icon={Edit3}           label="Correção de Prova"/>
        <NavItem v="batch"          icon={Layers}          label="Correção Lote"/>
        <NavItem v="canvas"         icon={Copy}            label="Lançamento (Canvas)"/>
        <NavItem v="grade-closing"  icon={CheckSquare}     label="Fechamento Bimestre"/>
        <NavItem v="audit"          icon={FileText}        label="Auditoria"/>
        <NavItem v="reports"        icon={BarChart2}       label="Relatórios"/>
        
        <p className="nav-label">Sistema</p>
        <NavItem v="implementacoes" icon={Lightbulb}       label="Implementações"/>
        <NavItem v="skills"         icon={Sparkles}        label="Habilidades (AI)"/>
        <NavItem v="settings"       icon={Database}        label="Configurações"/>
      </nav>
      
      <div className="sidebar-footer-text" style={{marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 10, color: 'var(--text2)', fontFamily: 'monospace'}}>
        {collapsed ? 'v1.4' : 'v1.4 Enterprise'}
      </div>
    </aside>
  );
}
