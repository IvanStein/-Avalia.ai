import os

file_path = r'd:\prog\Avalia.ai\app\page.tsx'

with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

# Try to find the block using raw strings and flexible markers
target_start_marker = "{view === 'copy' && ("
target_end_marker = "{view === 'reports' && ("

start_pos = text.find(target_start_marker)
end_pos = text.find(target_end_marker)

if start_pos != -1 and end_pos != -1:
    # Go back to find the comment line before the start
    comment_pos = text.rfind("{/*", 0, start_pos)
    if comment_pos != -1 and (start_pos - comment_pos) < 200:
        actual_start = comment_pos
    else:
        actual_start = start_pos
        
    replacement = """{/* ── COPIA DE ATIVIDADES ─────────────────────────────────────────────────── */}
        {view === 'copy' && <>
          <header className="header">
            <div><h1>Copia de Atividades</h1><p className="subtitle">Clonar rotinas e avaliações entre matérias</p></div>
            <div className="header-actions">
               <button className="btn-ghost" onClick={() => {
                 setCopySubjectId(''); setCopyDestSubjectId(''); setCopySelectedActs([]); setNewSubjectName('');
               }}><RefreshCw size={14}/> Limpar Tudo</button>
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(380px, 1.2fr)', gap: 24 }} className="fade-in">
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                <Clock size={16} /> 1. Selecionar Origem
              </h3>
              <div>
                <label className="field-label">Matéria de Origem</label>
                <select className="input" value={copySubjectId} onChange={e => {
                  setCopySubjectId(e.target.value);
                  setCopySelectedActs([]);
                }}>
                  <option value="">Selecione a matéria...</option>
                  {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {copySubjectId && (
                <div className="fade-in" style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="field-label" style={{ margin: 0 }}>Atividades disponíveis ({dbData.activities.filter(a => a.subjectId === copySubjectId).length})</label>
                    <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => {
                      const allIds = dbData.activities.filter(a => a.subjectId === copySubjectId).map(a => a.id);
                      setCopySelectedActs(copySelectedActs.length === allIds.length ? [] : allIds);
                    }}>
                      {copySelectedActs.length === dbData.activities.filter(a => a.subjectId === copySubjectId).length ? 'Limpar Seleção' : 'Selecionar Todas'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {dbData.activities.filter(a => a.subjectId === copySubjectId).map(act => (
                       <label key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', border: '1px solid transparent', background: copySelectedActs.includes(act.id) ? 'var(--accent)08' : 'transparent', borderRadius: 8, transition: 'all .2s' }}>
                        <input type="checkbox" checked={copySelectedActs.includes(act.id)} onChange={() => {
                          setCopySelectedActs(prev => prev.includes(act.id) ? prev.filter(i => i !== act.id) : [...prev, act.id]);
                        }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: copySelectedActs.includes(act.id) ? 'var(--accent)' : 'var(--text1)' }}>{act.title}</p>
                          <p style={{ fontSize: 11, color: 'var(--text2)', opacity: 0.7 }}>Peso: {act.weight}×</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="card" style={{ padding: 24, border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                  <Plus size={16} /> 2. Configurar Destino
                </h3>
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="field-label">Matéria de Destino</label>
                    <select className="input" value={copyDestSubjectId} onChange={e => {
                      setCopyDestSubjectId(e.target.value);
                      if (e.target.value) setNewSubjectName('');
                    }}>
                      <option value="">-- CRIAR NOVA MATÉRIA --</option>
                      {dbData.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </select>
                  </div>

                  {!copyDestSubjectId && (
                    <div className="fade-in" style={{ padding: '16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <label className="field-label">Nome da Nova Matéria</label>
                      <input className="input" placeholder="Ex: Cálculo III (Copy)" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} />
                    </div>
                  )}

                  <div style={{ padding: '20px', background: 'var(--accent)', color: '#fff', borderRadius: 12, marginTop: 10, opacity: (copySubjectId && copySelectedActs.length > 0 && (copyDestSubjectId || newSubjectName)) ? 1 : 0.4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Layers size={24} />
                      <div>
                        <p style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>Pronto para copiar</p>
                        <p style={{ fontSize: 15, fontWeight: 700 }}>{copySelectedActs.length} atividades selecionadas</p>
                      </div>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', marginTop: 20, background: '#fff', color: 'var(--accent)', fontWeight: 800, height: 46 }}
                      onClick={handleCopyActivities}
                      disabled={copyProcessing || !copySubjectId || copySelectedActs.length === 0 || (!copyDestSubjectId && !newSubjectName)}
                    >
                      {copyProcessing ? <Sparkles className="spin" size={18} /> : <Check size={18} />} 
                      {copyDestSubjectId ? 'Clonar nas Atividades Atuais' : 'Criar Nova com Atividades'}
                    </button>
                  </div>
                </div>
              </div>

              {copyDestSubjectId && (
                <div className="card fade-in" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Conteúdo Existente no Destino</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dbData.activities.filter(a => a.subjectId === copyDestSubjectId).map(act => (
                      <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{act.title}</span>
                        <button className="btn-icon-danger" onClick={() => del('activity', act.id)}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
        
        """
    
    new_text = text[:actual_start] + replacement + text[end_pos:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print(f"Successfully replaced block. start_pos: {actual_start}, end_pos: {end_pos}")
else:
    print(f"FAILED to find markers. start_pos: {start_pos}, end_pos: {end_pos}")
