import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../services/supabase/config';

// O login libera usuários com e-mail não confirmado sem sessão no Supabase; nesse caso o servidor
// recusa as consultas do módulo. Em vez de telas vazias e erros, orienta o usuário.
const AvisoSessao = () => {
  const [semSessao, setSemSessao] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo && !data?.session && navigator.onLine !== false) setSemSessao(true);
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!semSessao) return null;
  return (
    <div role="alert" className="execucao-card" style={{ borderColor: '#f59e0b', marginBottom: '1rem' }}>
      <strong>Sua sessão não está ativa.</strong>{' '}
      Os dados do módulo não serão carregados. Saia e entre novamente; se persistir, peça ao administrador para confirmar o seu e-mail.
    </div>
  );
};

export default AvisoSessao;
