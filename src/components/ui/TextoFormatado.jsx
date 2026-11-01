import React, { useMemo } from 'react';

const RE_MARCADOR = /^\s*[-•*]\s+(.*)$/;
const RE_NUMERADO = /^\s*\d+[.)]\s+(.*)$/;

const tipoDaLinha = (linha) => {
  if (RE_MARCADOR.test(linha)) return 'ul';
  if (RE_NUMERADO.test(linha)) return 'ol';
  return 'p';
};

/**
 * Converte o texto em blocos (separados por linha em branco) e, dentro de cada
 * bloco, em grupos consecutivos de mesmo tipo: parágrafo, lista com marcadores
 * ou lista numerada. Só produz dados; a renderização usa elementos React
 * (nenhum HTML do usuário é interpretado).
 */
function analisarTexto(texto) {
  const normalizado = String(texto ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normalizado) return [];

  return normalizado
    .split(/\n[ \t]*\n+/)
    .map((bloco) => {
      const grupos = [];
      bloco
        .split('\n')
        .filter((linha) => linha.trim() !== '')
        .forEach((linha) => {
          const tipo = tipoDaLinha(linha);
          const conteudo =
            tipo === 'ul'
              ? linha.match(RE_MARCADOR)[1]
              : tipo === 'ol'
                ? linha.match(RE_NUMERADO)[1]
                : linha.trim();
          const ultimo = grupos[grupos.length - 1];
          if (ultimo && ultimo.tipo === tipo) ultimo.linhas.push(conteudo);
          else grupos.push({ tipo, linhas: [conteudo] });
        });
      return grupos;
    })
    .filter((grupos) => grupos.length > 0);
}

/**
 * Exibe texto simples preservando parágrafos, listas e quebras de linha.
 * - Padrão: parágrafos, `<ul>`, `<ol>` e `<br/>`.
 * - `compacto`: texto cru com quebras preservadas e limitado a 3 linhas (cards).
 */
export default function TextoFormatado({ texto, className = '', compacto = false }) {
  const blocos = useMemo(() => (compacto ? [] : analisarTexto(texto)), [texto, compacto]);

  if (compacto) {
    const cru = String(texto ?? '').trim();
    if (!cru) return null;
    return <p className={`whitespace-pre-line line-clamp-3 break-words ${className}`}>{cru}</p>;
  }

  if (blocos.length === 0) return null;

  return (
    <div className={`space-y-3 break-words ${className}`}>
      {blocos.map((grupos, i) => (
        <div key={i} className="space-y-1">
          {grupos.map((grupo, j) => {
            if (grupo.tipo === 'ul') {
              return (
                <ul key={j} className="list-disc pl-5 space-y-0.5">
                  {grupo.linhas.map((l, k) => (
                    <li key={k}>{l}</li>
                  ))}
                </ul>
              );
            }
            if (grupo.tipo === 'ol') {
              return (
                <ol key={j} className="list-decimal pl-5 space-y-0.5">
                  {grupo.linhas.map((l, k) => (
                    <li key={k}>{l}</li>
                  ))}
                </ol>
              );
            }
            return (
              <p key={j}>
                {grupo.linhas.map((l, k) => (
                  <React.Fragment key={k}>
                    {k > 0 && <br />}
                    {l}
                  </React.Fragment>
                ))}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}
