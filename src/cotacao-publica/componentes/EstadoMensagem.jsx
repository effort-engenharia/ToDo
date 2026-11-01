import { useEffect, useRef } from 'react';

// Estado de página inteira (Anexo B.1.5): ícone decorativo, <h1> que recebe o foco, apoio e ação opcional.
const EstadoMensagem = ({ icone, titulo, texto, acao = null }) => {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [titulo]);

  return (
    <main className="cp-pagina cp-estado" role="status">
      {icone && <div className="cp-estado-icone" aria-hidden="true">{icone}</div>}
      <h1 ref={ref} tabIndex={-1} className="cp-estado-titulo">{titulo}</h1>
      {texto && <p className="cp-estado-texto">{texto}</p>}
      {acao}
    </main>
  );
};

export default EstadoMensagem;
