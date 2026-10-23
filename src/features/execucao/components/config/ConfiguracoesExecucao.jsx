import React, { useState } from 'react';
import { isAdminExecucao } from '../../utils/permissoes';
import { EstadoVazio } from '../ui/Estados';
import AbaFeriados from './AbaFeriados';
import AbaCidades from './AbaCidades';
import AbaJornadas from './AbaJornadas';
import AbaColaboradores from './AbaColaboradores';
import AbaAusencias from './AbaAusencias';
import AbaCalibrarTemplates from './AbaCalibrarTemplates';
import AbaTiposServico from './AbaTiposServico';
import './config.css';

const ABAS = [
  { id: 'feriados', rotulo: 'Feriados', Componente: AbaFeriados },
  { id: 'cidades', rotulo: 'Cidades', Componente: AbaCidades },
  { id: 'jornadas', rotulo: 'Jornadas e descontos', Componente: AbaJornadas },
  { id: 'colaboradores', rotulo: 'Jornada por colaborador', Componente: AbaColaboradores },
  { id: 'ausencias', rotulo: 'Ausências e férias', Componente: AbaAusencias },
  { id: 'calibrar', rotulo: 'Calibrar templates', Componente: AbaCalibrarTemplates },
  { id: 'tipos', rotulo: 'Tipos de serviço', Componente: AbaTiposServico },
];

const ConfiguracoesExecucao = ({ usuario }) => {
  const [abaId, setAbaId] = useState('feriados');

  if (!isAdminExecucao(usuario)) {
    return <EstadoVazio titulo="Acesso restrito" texto="As configurações são exclusivas dos administradores da Execução." />;
  }

  const aba = ABAS.find((a) => a.id === abaId) ?? ABAS[0];
  const { Componente } = aba;

  const aoTeclar = (e) => {
    const indice = ABAS.findIndex((a) => a.id === abaId);
    let proximo = null;
    if (e.key === 'ArrowRight') proximo = (indice + 1) % ABAS.length;
    if (e.key === 'ArrowLeft') proximo = (indice - 1 + ABAS.length) % ABAS.length;
    if (proximo === null) return;
    e.preventDefault();
    setAbaId(ABAS[proximo].id);
    document.getElementById(`cfg-tab-${ABAS[proximo].id}`)?.focus();
  };

  return (
    <div className="execucao-animate-fade-in">
      <div className="cfg-tabs" role="tablist" aria-label="Configurações da Execução" onKeyDown={aoTeclar}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            id={`cfg-tab-${a.id}`}
            type="button"
            role="tab"
            className="cfg-tab"
            aria-selected={a.id === aba.id}
            aria-controls="cfg-painel"
            tabIndex={a.id === aba.id ? 0 : -1}
            onClick={() => setAbaId(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div id="cfg-painel" role="tabpanel" aria-labelledby={`cfg-tab-${aba.id}`}>
        <Componente usuario={usuario} />
      </div>
    </div>
  );
};

export default ConfiguracoesExecucao;
