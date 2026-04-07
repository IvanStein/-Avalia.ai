import React from "react";
import {
  Database, GraduationCap, Sparkles, Layers, Check, RefreshCw
} from "lucide-react";
import { AppConfig, DBData } from "@/lib/types";

interface SettingsViewProps {
  dbData: DBData;
  dbMode: 'local' | 'remote';
  setDbMode: (m: 'local' | 'remote') => void;
  loading: boolean;
  tempConfigs: AppConfig;
  setTempConfigs: (c: AppConfig) => void;
  onSaveSettings: (c?: AppConfig) => void;
  onCopyCloudToLocal: () => void;
  onNavigateToCopy: () => void;
}

export function SettingsView({
  dbMode,
  setDbMode,
  loading,
  tempConfigs,
  setTempConfigs,
  onSaveSettings,
  onCopyCloudToLocal,
  onNavigateToCopy,
}: SettingsViewProps) {
  return (
    <>
      <header className="header">
        <div>
          <h1>Configurações do Sistema</h1>
          <p className="subtitle">Gestão global e personalização da plataforma</p>
        </div>
      </header>

      <div className="fade-in" style={{ padding: '0 4px', maxWidth: 1000 }}>
        {/* Database Selection Card */}
        <div className="card" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ background: 'var(--accent)20', padding: 12, borderRadius: 12 }}>
              <Database size={24} color="var(--accent)"/>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Fonte de Dados</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Determine onde as informações do sistema são armazenadas e lidas.</p>
            </div>
            <div className="toggle-group" style={{ marginTop: 0, minWidth: 260 }}>
              <button className={dbMode === 'local' ? 'active' : ''} onClick={() => setDbMode('local')}>
                📂 JSON Local
              </button>
              <button className={dbMode === 'remote' ? 'active' : ''} onClick={() => setDbMode('remote')}>
                ☁️ Supabase Cloud
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, color: 'var(--text2)', border: '1px solid var(--border)' }}>
            <div>
              {dbMode === 'remote'
                ? '✅ Modo Nuvem ativo: Sincronização em tempo real e persistência global habilitada.'
                : '⚠️ Modo Local ativo: Os dados serão salvos apenas no sistema de arquivos deste servidor local.'}
            </div>
            {dbMode === 'local' && (
              <button
                className="btn-ghost"
                style={{ background: 'var(--surface1)', padding: '6px 12px', height: 'auto', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={loading}
                onClick={onCopyCloudToLocal}
              >
                {loading ? <RefreshCw className="spin" size={12}/> : <RefreshCw size={12}/>}
                Baixar Base da Nuvem
              </button>
            )}
          </div>
        </div>

        {/* Copia de Atividades Quick Access Card */}
        <div className="card" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--border)', background: 'var(--accent)05' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--accent)20', padding: 12, borderRadius: 12 }}>
              <Layers size={24} color="var(--accent)"/>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Cópia de Atividades</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Clone rotinas pedagógicas e avaliações entre diferentes matérias ou crie novas.</p>
            </div>
            <button className="btn-primary" onClick={onNavigateToCopy} style={{ padding: '10px 20px' }}>
              <Sparkles size={16}/> Iniciar Rotina de Cópia
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Institution & Identity Card */}
          <div className="card" style={{ padding: 24, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={18} color="var(--accent)"/> Identidade Institucional
            </h3>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Instituição</label>
              <input className="input" placeholder="Ex: Universidade Aura" value={tempConfigs.institution || ''} onChange={e => setTempConfigs({...tempConfigs, institution: e.target.value})}/>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Nome do Professor</label>
              <input className="input" placeholder="Seu Nome completo" value={tempConfigs.professor || ''} onChange={e => setTempConfigs({...tempConfigs, professor: e.target.value})}/>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Estilo Pedagógico (O que a IA deve aprender com você?)</label>
              <textarea
                className="input"
                rows={4}
                placeholder="Ex: 'Seja rigoroso com a gramática', 'Foque em citações ABNT', 'Use um tom mais informal e próximo'..."
                value={tempConfigs.pedagogical_style || ''}
                onChange={e => setTempConfigs({...tempConfigs, pedagogical_style: e.target.value})}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                <label className="field-label">Nome do Sistema</label>
                <input className="input" value={tempConfigs.system_name} onChange={e => setTempConfigs({...tempConfigs, system_name: e.target.value})}/>
              </div>
              <div>
                <label className="field-label">Tema Visual</label>
                <div className="toggle-group">
                  <button className={tempConfigs.theme === 'light' ? 'active' : ''} onClick={() => setTempConfigs({...tempConfigs, theme: 'light'})}>Claro</button>
                  <button className={tempConfigs.theme !== 'light' ? 'active' : ''} onClick={() => setTempConfigs({...tempConfigs, theme: 'dark'})}>Escuro</button>
                </div>
              </div>
              <div>
                <label className="field-label">Cor Principal (Acento)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" className="input" style={{ width: 44, height: 40, padding: 4 }} value={tempConfigs.primary_color} onChange={e => setTempConfigs({...tempConfigs, primary_color: e.target.value})}/>
                  <code style={{ fontSize: 10, color: 'var(--text2)' }}>{tempConfigs.primary_color.toUpperCase()}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Tips & Extras Card */}
          <div className="card" style={{ padding: 24, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="var(--accent)"/> Informações Adicionais
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              As alterações feitas aqui afetam como o sistema se apresenta para você e nos cabeçalhos dos relatórios PDF gerados.
            </p>
            <div style={{ flex: 1, padding: 16, background: 'var(--surface2)', borderRadius: 12, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text2)' }}>
              <p style={{ marginBottom: 8, fontWeight: 500, color: 'var(--text)' }}>Dica de Identidade:</p>
              Use cores com bom contraste para garantir a legibilidade dos menus e botões principais.
            </div>

            <div style={{ marginTop: 24 }}>
              <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => onSaveSettings(tempConfigs)}>
                <Check size={18}/> Salvar Todas as Preferências
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
