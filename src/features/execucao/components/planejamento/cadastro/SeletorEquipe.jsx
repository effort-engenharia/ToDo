import React from 'react';
import { FaStar, FaRegStar, FaTimes } from 'react-icons/fa';
import './cadastro.css';

const iniciais = (nome = '') => nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Equipe da atividade: um líder (responsável) e quantos apoios forem necessários.
// onChange recebe { liderId, apoioIds }.
const SeletorEquipe = ({
  tecnicos,
  liderId,
  apoioIds = [],
  onChange,
  sugerido = 1,
  rotulo = 'Técnicos',
  disabled = false,
  idBase
}) => {
  const porId = new Map(tecnicos.map((t) => [t.id, t]));
  const membros = [liderId, ...apoioIds].filter(Boolean);
  const disponiveis = tecnicos.filter((t) => !membros.includes(t.id));

  const adicionar = (id) => {
    if (!id) return;
    if (!liderId) onChange({ liderId: id, apoioIds });
    else onChange({ liderId, apoioIds: [...apoioIds, id] });
  };

  const remover = (id) => {
    if (id === liderId) {
      const [novoLider = '', ...resto] = apoioIds;
      onChange({ liderId: novoLider, apoioIds: resto });
    } else {
      onChange({ liderId, apoioIds: apoioIds.filter((a) => a !== id) });
    }
  };

  const tornarLider = (id) => {
    if (id === liderId) return;
    onChange({ liderId: id, apoioIds: [liderId, ...apoioIds.filter((a) => a !== id)].filter(Boolean) });
  };

  return (
    <div className="cad-equipe" role="group" aria-label={rotulo}>
      <ul className="cad-equipe-lista">
        {membros.map((id) => {
          const nome = porId.get(id)?.nome_completo || 'Técnico';
          const lider = id === liderId;
          return (
            <li key={id} className={`cad-equipe-chip ${lider ? 'cad-equipe-chip-lider' : ''}`}>
              <button
                type="button"
                className="cad-equipe-estrela"
                onClick={() => tornarLider(id)}
                disabled={disabled}
                aria-pressed={lider}
                aria-label={lider ? `${nome} é o líder` : `Tornar ${nome} o líder`}
                title={lider ? 'Líder' : 'Tornar líder'}
              >
                {lider ? <FaStar size={10} aria-hidden="true" /> : <FaRegStar size={10} aria-hidden="true" />}
              </button>
              <span className="cad-equipe-nome" title={nome}>
                <span className="cad-equipe-iniciais" aria-hidden="true">{iniciais(nome)}</span>
                {nome.split(' ')[0]}
              </span>
              <button
                type="button"
                className="cad-equipe-remover"
                onClick={() => remover(id)}
                disabled={disabled}
                aria-label={`Remover ${nome} da equipe`}
              >
                <FaTimes size={9} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {disponiveis.length > 0 && (
        <select
          id={idBase}
          className="cad-equipe-adicionar"
          value=""
          disabled={disabled}
          onChange={(e) => adicionar(e.target.value)}
          aria-label={membros.length ? `Adicionar técnico (${rotulo})` : `Selecionar ${rotulo.toLowerCase()}`}
        >
          <option value="">{membros.length ? '+ adicionar' : 'Selecione...'}</option>
          {disponiveis.map((t) => (
            <option key={t.id} value={t.id}>{t.nome_completo}</option>
          ))}
        </select>
      )}
      {sugerido > 1 && membros.length < sugerido && (
        <span className="cad-equipe-dica">Sugerido pelo template: {sugerido} técnicos</span>
      )}
    </div>
  );
};

export default SeletorEquipe;
