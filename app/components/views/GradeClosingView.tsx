import React, { useState, useMemo } from "react";
import { BookOpen, Calculator, CheckCircle, AlertCircle, Printer } from "lucide-react";
import { DBData, Activity } from "@/lib/types";

interface GradeClosingViewProps {
  dbData: DBData;
  getActName: (feedback: string) => string | null;
}

export function GradeClosingView({ dbData, getActName }: GradeClosingViewProps) {
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  const selectedSubject = useMemo(() => dbData.subjects.find(s => s.id === selectedSubId), [selectedSubId, dbData.subjects]);

  const studentsInSubject = useMemo(() => {
    if (!selectedSubId) return [];
    return dbData.students
      .filter(s => (s.subjectIds || []).includes(selectedSubId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedSubId, dbData.students]);

  const activitiesInSubject = useMemo(() => {
    return dbData.activities.filter(a => a.subjectId === selectedSubId);
  }, [selectedSubId, dbData.activities]);

  // Configurations
  const provaActivities = activitiesInSubject.filter(a => a.type === 'prova');
  const [selectedProvaId, setSelectedProvaId] = useState<string>('');
  
  // Try to autoselect the first prova
  React.useEffect(() => {
    if (provaActivities.length > 0 && !selectedProvaId) {
      setSelectedProvaId(provaActivities[0].id);
    }
  }, [provaActivities, selectedProvaId]);

  // Try to auto-select base async activities (A.A 01 to A.A 06)
  const [selectedBaseActIds, setSelectedBaseActIds] = useState<string[]>([]);
  const [selectedExtraActIds, setSelectedExtraActIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (selectedSubId) {
      const base: string[] = [];
      const extra: string[] = [];
      activitiesInSubject.forEach(a => {
        if (a.type !== 'prova') {
          // Check if it matches A.A 01 to 06
          const isBase = [1,2,3,4,5,6].some(num => a.title.includes(`A.A 0${num}`) || a.title.includes(`A.A ${num}`));
          if (isBase) base.push(a.id);
          else extra.push(a.id);
        }
      });
      setSelectedBaseActIds(base);
      setSelectedExtraActIds(extra);
    }
  }, [selectedSubId, activitiesInSubject]);

  const toggleBaseAct = (id: string) => {
    if (selectedBaseActIds.includes(id)) {
      setSelectedBaseActIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedBaseActIds(prev => [...prev, id]);
      setSelectedExtraActIds(prev => prev.filter(x => x !== id)); // Remove da outra listagem
    }
  };

  const toggleExtraAct = (id: string) => {
    if (selectedExtraActIds.includes(id)) {
      setSelectedExtraActIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedExtraActIds(prev => [...prev, id]);
      setSelectedBaseActIds(prev => prev.filter(x => x !== id)); // Remove da outra listagem
    }
  };

  // Calculate closure row for each student
  const closureData = useMemo(() => {
    if (!selectedSubId || !selectedSubject) return [];
    
    const provaTitle = dbData.activities.find(a => a.id === selectedProvaId)?.title;
    const baseTitles = selectedBaseActIds.map(id => dbData.activities.find(a => a.id === id)?.title).filter(Boolean) as string[];
    const extraTitles = selectedExtraActIds.map(id => dbData.activities.find(a => a.id === id)?.title).filter(Boolean) as string[];

    return studentsInSubject.map(stu => {
      // Find Prova submission
      const provaSubm = dbData.submissions.find(subm => 
        subm.studentName === stu.name && subm.subject === selectedSubject.name && subm.status === 'graded' &&
        (getActName(subm.feedback || '') === provaTitle)
      );
      const provaRawGrade = provaSubm?.grade || 0;
      // Normalize grade (in case it was entered as 0-100 instead of 0-10)
      const normalizedProvaGrade = provaRawGrade > 10 ? provaRawGrade / 10 : provaRawGrade;
      const provaContribution = normalizedProvaGrade * 0.7; // 70% da Prova (Multiplicado por 0.7)

      // Find Base Deliveries
      let baseDelivered = 0;
      baseTitles.forEach(t => {
        const subm = dbData.submissions.find(subm => 
          subm.studentName === stu.name && subm.subject === selectedSubject.name && subm.status === 'graded' &&
          (getActName(subm.feedback || '') === t)
        );
        if (subm) baseDelivered++; // Counts as delivered
      });
      const maxBase = baseTitles.length || 1; // Prevent division by zero
      const baseContribution = baseTitles.length > 0 ? (baseDelivered / maxBase) * 1.5 : 0; // Proporcional a 1.5

      // Find Extra Deliveries
      let extraDelivered = 0;
      extraTitles.forEach(t => {
        const subm = dbData.submissions.find(subm => 
          subm.studentName === stu.name && subm.subject === selectedSubject.name && subm.status === 'graded' &&
          (getActName(subm.feedback || '') === t)
        );
        if (subm) extraDelivered++;
      });
      const extraContribution = extraDelivered > 0 ? 1.5 : 0; // Quem entregou ganha 1.5

      const rawFinal = Math.min(10.0, provaContribution + baseContribution + extraContribution);
      const finalGrade = Math.round(rawFinal * 2) / 2; // Arredonda para o 0.5 mais próximo

      return {
        student: stu.name,
        provaRawGrade,
        provaContribution,
        baseDelivered,
        baseTotal: baseTitles.length,
        baseContribution,
        extraDelivered,
        extraContribution,
        finalGrade
      };
    });
  }, [selectedSubId, selectedSubject, studentsInSubject, dbData.activities, dbData.submissions, selectedProvaId, selectedBaseActIds, selectedExtraActIds, getActName]);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    
    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Fechamento – ${selectedSubject?.name}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 40px; color: #111827; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: normal; color: #4B5563; margin-top: 0; margin-bottom: 30px; border-bottom: 1px solid #E5E7EB; padding-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #E5E7EB; }
          th { background: #F9FAFB; font-weight: 600; color: #374151; }
          .right { text-align: right; }
          .center { text-align: center; }
          .final { font-weight: bold; font-size: 15px; }
          .pass { color: #059669; }
          .fail { color: #DC2626; }
          .footer { margin-top: 40px; font-size: 11px; color: #6B7280; text-align: center; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>Relatório de Fechamento de Notas</h1>
        <h2>Matéria: ${selectedSubject?.name || 'Não Selecionada'} | Gerado em: ${new Date().toLocaleDateString("pt-BR")}</h2>
        
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th class="center">Prova (Bruto)</th>
              <th class="center">Parte Prova</th>
              <th class="center">Assíncronas</th>
              <th class="center">Extras</th>
              <th class="right">Média Final</th>
            </tr>
          </thead>
          <tbody>
    `;

    closureData.forEach(row => {
      html += `
        <tr>
          <td>${row.student}</td>
          <td class="center">${row.provaRawGrade.toFixed(1)}</td>
          <td class="center">+${row.provaContribution.toFixed(2)}</td>
          <td class="center">${row.baseDelivered}/${row.baseTotal} (+${row.baseContribution.toFixed(2)})</td>
          <td class="center">${row.extraDelivered} (+${row.extraContribution.toFixed(2)})</td>
          <td class="right final ${row.finalGrade >= 6.0 ? 'pass' : 'fail'}">${row.finalGrade.toFixed(1)}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <div class="footer">Gerado por Aval.IA</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="fade-in">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Fechamento do Bimestre</h1>
          <p className="subtitle">Conferência e cálculo de médias usando o método de pesos fixos</p>
        </div>
        {selectedSubId && closureData.length > 0 && (
          <button className="btn" onClick={handlePrint}>
            <Printer size={16} /> Imprimir em PDF
          </button>
        )}
      </header>

      <div className="card" style={{ marginBottom: 24, padding: '24px', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 32 }}>
          <div>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookOpen size={15} color="var(--accent)" /> 
              <span style={{ fontWeight: 600 }}>Matéria</span>
            </label>
            <select 
              className="input" 
              value={selectedSubId} 
              onChange={e => setSelectedSubId(e.target.value)}
              style={{ fontSize: '14px' }}
            >
              <option value="">Selecione a Matéria...</option>
              {dbData.subjects.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
              ))}
            </select>
          </div>
          {selectedSubId && (
            <div>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                 <AlertCircle size={15} color="var(--accent)" />
                 <span style={{ fontWeight: 600 }}>Prova Principal (Máx 7.0 pts contri.)</span>
              </label>
              <select 
                className="input" 
                value={selectedProvaId} 
                onChange={e => setSelectedProvaId(e.target.value)}
                style={{ fontSize: '14px' }}
              >
                <option value="">Nenhuma Prova Selecionada</option>
                {activitiesInSubject.filter(a => a.type === 'prova').map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedSubId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <div>
               <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Atividades Assíncronas (Máx 1.5 pts)</h4>
               <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>Será descontado proporcional a cada não entregue.</p>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                 {activitiesInSubject.filter(a => a.type !== 'prova' && !selectedExtraActIds.includes(a.id)).map(a => (
                   <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                     <input type="checkbox" checked={selectedBaseActIds.includes(a.id)} onChange={() => toggleBaseAct(a.id)} />
                     {a.title}
                   </label>
                 ))}
                 {activitiesInSubject.filter(a => a.type !== 'prova' && !selectedExtraActIds.includes(a.id)).length === 0 && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Nenhuma atividade</span>}
               </div>
            </div>
            <div>
               <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Atividades Extras (1.5 pts caso entregue alguma)</h4>
               <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>Qualquer entrega nessas atividades concederá +1.5 na média.</p>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                 {activitiesInSubject.filter(a => a.type !== 'prova' && !selectedBaseActIds.includes(a.id)).map(a => (
                   <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                     <input type="checkbox" checked={selectedExtraActIds.includes(a.id)} onChange={() => toggleExtraAct(a.id)} />
                     {a.title}
                   </label>
                 ))}
                 {activitiesInSubject.filter(a => a.type !== 'prova' && !selectedBaseActIds.includes(a.id)).length === 0 && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Nenhuma atividade</span>}
               </div>
            </div>
          </div>
        )}
      </div>

      {selectedSubId && studentsInSubject.length > 0 && (
        <div className="table-wrap fade-in">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Aluno</th>
                <th style={{ width: '15%' }}>Prova (10.0)<br/><span style={{fontSize:9, opacity:0.6}}>Valor Bruto</span></th>
                <th style={{ width: '15%' }}>Parte Prova<br/><span style={{fontSize:9, opacity:0.6}}> Bruto × 0.7</span></th>
                <th style={{ width: '15%' }}>Assíncronas<br/><span style={{fontSize:9, opacity:0.6}}>Entregas ({selectedBaseActIds.length})</span></th>
                <th style={{ width: '15%' }}>Extras<br/><span style={{fontSize:9, opacity:0.6}}>+{selectedExtraActIds.length ? '1.5' : '0.0'} se &gt; 0</span></th>
                <th style={{ width: '15%', textAlign: 'right' }}>Média Final<br/><span style={{fontSize:9, opacity:0.6}}>Max 10.0</span></th>
              </tr>
            </thead>
            <tbody>
              {closureData.map((row, idx) => (
                <tr key={idx}>
                  <td className="td-name">{row.student}</td>
                  <td>{row.provaRawGrade.toFixed(1)}</td>
                  <td><span className="badge badge-accent">+{row.provaContribution.toFixed(2)} pts</span></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                       <span style={{ fontSize: 13 }}>{row.baseDelivered} / {row.baseTotal} ent.</span>
                       <span className="badge badge-accent" style={{ width: 'fit-content', fontSize: 10 }}>+{row.baseContribution.toFixed(2)} pts</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                       <span style={{ fontSize: 13 }}>{row.extraDelivered} ent.</span>
                       <span className="badge badge-accent" style={{ width: 'fit-content', fontSize: 10 }}>+{row.extraContribution.toFixed(2)} pts</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: row.finalGrade >= 6.0 ? 'var(--neon)' : 'var(--error)' }}>
                      {row.finalGrade.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSubId && closureData.length > 0 && (
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={handlePrint}>
            <Printer size={16} /> Imprimir Relatório Final em PDF
          </button>
        </div>
      )}
    </div>
  );
}
