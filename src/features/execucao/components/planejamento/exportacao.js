import { dataLocalISO, formatarDataBR } from '../../utils/datas';

// As bibliotecas de exportação são pesadas: só são carregadas quando o usuário exporta.
export const exportarEtapasExcel = async (etapas) => {
  const XLSX = await import('xlsx');

  const dados = etapas.map((e) => ({
    'Cliente': e.cliente,
    'Cidade': e.cidade || '',
    'Etapa': e.nome,
    'Responsável': e.responsavel?.nome_completo || '',
    'Tipo': e.tipo,
    'Data Início': formatarDataBR(e.data_inicio),
    'Data Fim': formatarDataBR(e.data_fim),
    'Progresso (%)': e.progresso || 0,
    'Status': e.status || 'pendente'
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Etapas');

  // Ajustar largura das colunas
  ws['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 35 }, { wch: 25 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
  ];

  XLSX.writeFile(wb, `planejamento_etapas_${dataLocalISO()}.xlsx`);
};

export const exportarEtapasPDF = async (etapas, periodoLabel) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF('l', 'mm', 'a4'); // landscape

  doc.setFontSize(16);
  doc.setTextColor(51, 51, 51);
  doc.text('Relatório de Planejamento - Etapas', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 22);
  doc.text(`Período: ${periodoLabel}`, 14, 27);

  const dados = etapas.map((e) => [
    e.cliente?.substring(0, 25) || '',
    e.nome?.substring(0, 30) || '',
    e.responsavel?.nome_completo?.substring(0, 25) || '',
    e.tipo || '',
    formatarDataBR(e.data_inicio),
    formatarDataBR(e.data_fim),
    `${e.progresso || 0}%`,
    e.status || 'pendente'
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Cliente', 'Etapa', 'Responsável', 'Tipo', 'Início', 'Fim', 'Progresso', 'Status']],
    body: dados,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 55 },
      2: { cellWidth: 40 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 20 },
      7: { cellWidth: 25 }
    }
  });

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
  }

  doc.save(`planejamento_etapas_${dataLocalISO()}.pdf`);
};

// ---------------------------------------------------
// Pauta da reunião semanal (item 2.8): problemas, o que começa/termina, agenda por técnico, carga e semana passada
// ---------------------------------------------------
const minutosParaTexto = (minutos) => {
  const total = Math.round(Number(minutos) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m}min` : `${h}h${m ? String(m).padStart(2, '0') : ''}`;
};

const dataCurta = (valor) => {
  const [ano, mes, dia] = String(valor ?? '').slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}` : '-';
};

const COR_SAUDE_PDF = { atrasada: [220, 38, 38], em_risco: [234, 88, 12], pendencia: [161, 98, 7] };

export const exportarPautaSemanal = async (pauta) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF('p', 'mm', 'a4');
  const margem = 14;
  const larguraPagina = doc.internal.pageSize.width;
  const alturaPagina = doc.internal.pageSize.height;
  let y = 16;

  const agora = new Date();
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(`PAUTA DA SEMANA - ${pauta.periodo}`, margem, y);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, larguraPagina - margem, y, { align: 'right' });
  y += 8;

  const titulo = (texto) => {
    if (y > alturaPagina - 40) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(texto, margem, y);
    y += 3;
  };

  const vazio = (texto) => {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(texto, margem, y + 3);
    y += 10;
  };

  const tabela = (cabecalho, linhas, opcoes = {}) => {
    autoTable(doc, {
      startY: y,
      head: [cabecalho],
      body: linhas,
      theme: 'grid',
      margin: { left: margem, right: margem },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak' },
      ...opcoes
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  titulo('1. PROBLEMAS (decidir hoje)');
  if (pauta.problemas.length === 0 && pauta.pedidos.length === 0) {
    vazio('Nenhuma obra atrasada, em risco ou com pendência.');
  } else {
    tabela(
      ['Obra', 'Situação', 'Motivos'],
      [
        ...pauta.problemas.map((p) => [
          p.obra,
          p.saude === 'atrasada' && p.diasAtraso > 0 ? `${p.rotulo} (${p.diasAtraso}d)` : p.rotulo,
          p.motivos.join('; ') || '-'
        ]),
        ...pauta.pedidos.map((p) => [p.obra, 'Pedido de replanejamento', `${p.tecnico} - ${p.atividade}${p.motivo ? `: "${p.motivo}"` : ''}`])
      ],
      {
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 38 } },
        didParseCell: (dados) => {
          if (dados.section === 'body' && dados.column.index === 1) {
            const problema = pauta.problemas[dados.row.index];
            const cor = COR_SAUDE_PDF[problema?.saude] ?? COR_SAUDE_PDF.pendencia;
            dados.cell.styles.textColor = cor;
            dados.cell.styles.fontStyle = 'bold';
          }
        }
      }
    );
  }

  titulo('2. O QUE COMEÇA ESTA SEMANA (conferir material e equipe)');
  if (pauta.comecam.length === 0) vazio('Nenhuma etapa começa nesta semana.');
  else {
    tabela(
      ['Início', 'Obra', 'Etapa', 'Responsável'],
      pauta.comecam.map((c) => [dataCurta(c.data), c.obra, c.etapa, c.semResponsavel ? 'SEM RESPONSÁVEL' : (c.responsavel || '-')]),
      {
        columnStyles: { 0: { cellWidth: 16 } },
        didParseCell: (dados) => {
          if (dados.section === 'body' && dados.column.index === 3 && pauta.comecam[dados.row.index]?.semResponsavel) {
            dados.cell.styles.textColor = [220, 38, 38];
            dados.cell.styles.fontStyle = 'bold';
          }
        }
      }
    );
  }

  titulo('3. O QUE TERMINA ESTA SEMANA (confirmar entrega/faturamento)');
  if (pauta.terminam.length === 0) vazio('Nenhum término previsto nesta semana.');
  else {
    tabela(
      ['Data', 'Obra', 'O que termina'],
      pauta.terminam.map((t) => [dataCurta(t.data), t.obra, t.descricao]),
      { columnStyles: { 0: { cellWidth: 16 } } }
    );
  }

  titulo('4. AGENDA POR TÉCNICO');
  if (pauta.porTecnico.length === 0) vazio('Nenhuma atividade agendada na semana.');
  else {
    pauta.porTecnico.forEach((grupo) => {
      if (y > alturaPagina - 35) {
        doc.addPage();
        y = 16;
      }
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`${grupo.nome} (${grupo.itens.length})`, margem, y + 3);
      y += 4;
      tabela(
        ['Data', 'Hora', 'Atividade', 'Obra', 'Situação'],
        grupo.itens.map((i) => [
          i.dataFim && i.dataFim !== i.data ? `${dataCurta(i.data)} a ${dataCurta(i.dataFim)}` : dataCurta(i.data),
          i.hora || '-',
          i.titulo,
          i.obra || '-',
          i.status
        ]),
        { headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 8 }, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 14 }, 4: { cellWidth: 24 } } }
      );
      y -= 3;
    });
    y += 3;
  }

  titulo('5. CARGA DA EQUIPE');
  if (pauta.carga.tecnicos.length === 0 && pauta.carga.semTecnicoMin === 0) vazio('Sem horas alocadas na semana.');
  else {
    tabela(
      ['Técnico', 'Horas previstas', 'Horas disponíveis', 'Ocupação'],
      [
        ...pauta.carga.tecnicos.map((t) => [
          t.nome,
          minutosParaTexto(t.previstoMin),
          minutosParaTexto(t.disponivelMin),
          t.percentual === null ? 'sem jornada' : `${t.percentual}%${t.percentual > 100 ? ' (acima da jornada)' : ''}`
        ]),
        ...(pauta.carga.semTecnicoMin > 0 ? [['Sem técnico', minutosParaTexto(pauta.carga.semTecnicoMin), '-', 'a distribuir']] : [])
      ],
      {
        didParseCell: (dados) => {
          if (dados.section === 'body' && dados.column.index === 3 && /acima|sem jornada|distribuir/.test(String(dados.cell.raw))) {
            dados.cell.styles.textColor = [180, 83, 9];
            dados.cell.styles.fontStyle = 'bold';
          }
        }
      }
    );
  }

  titulo('6. NÚMEROS DA SEMANA PASSADA');
  if (!pauta.semanaPassada) vazio('Indicadores indisponíveis.');
  else {
    const n = pauta.semanaPassada;
    const pontualidade = n.concluidas > 0 ? `${Math.round((n.noPrazo / n.concluidas) * 100)}% (${n.noPrazo} de ${n.concluidas})` : 'sem atividades concluídas';
    const pausas = n.pausasTotal > 0
      ? `${n.pausasTotal} (${n.pausasPorMotivo.map((p) => `${p.total} ${p.motivo}`).join(', ')})`
      : 'nenhuma';
    tabela(['Indicador', 'Resultado'], [['Atividades concluídas no prazo', pontualidade], ['Pausas', pausas]], { columnStyles: { 0: { cellWidth: 60 } } });
  }

  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${paginas}`, larguraPagina - margem, alturaPagina - 8, { align: 'right' });
  }

  doc.save(`pauta_semanal_${pauta.inicio}.pdf`);
};
