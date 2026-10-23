import { dataLocalISO, formatarDataBR } from '../../utils/datas';

// As bibliotecas de exportação são pesadas: só são carregadas quando o usuário exporta.
export const exportarEtapasExcel = async (etapas) => {
  const XLSX = await import('xlsx');

  const dados = etapas.map((e) => ({
    'Cliente': e.cliente,
    'Cidade': e.cidade || '',
    'Etapa': e.nome,
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
    { wch: 30 }, { wch: 15 }, { wch: 35 }, { wch: 12 },
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
    e.tipo || '',
    formatarDataBR(e.data_inicio),
    formatarDataBR(e.data_fim),
    `${e.progresso || 0}%`,
    e.status || 'pendente'
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Cliente', 'Etapa', 'Tipo', 'Início', 'Fim', 'Progresso', 'Status']],
    body: dados,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 60 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 }
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
