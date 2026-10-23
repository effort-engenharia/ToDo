import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import ModalPausa from './ModalPausa';
import ModalConcluir from './ModalConcluir';
import ModalFaltaMaterial from './ModalFaltaMaterial';
import { iniciarSincronizacao } from '../../offline/sincronizador';
import {
  iniciarAtividade,
  retomarAtividade,
  pausarAtividade,
  concluirAtividade,
  reportarFaltaMaterial
} from './acoesAtividade';

const mensagemDeErro = (resultado) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sem conexão com a internet. Tente novamente quando tiver sinal.';
  }
  return resultado?.message || 'Não foi possível concluir a ação. Tente novamente.';
};

// Estado e modais das ações do técnico (iniciar, retomar, pausar, concluir, falta de material).
// `onAtualizado(atividade, novoStatus)` é chamado após cada ação bem-sucedida.
export function useAcoesAtividade({ usuarioId, onAtualizado }) {
  const { toast } = useExecucaoUI();
  const [ocupadoId, setOcupadoId] = useState(null);
  const [modal, setModal] = useState(null); // { tipo: 'pausa' | 'concluir' | 'material', atividade, erro, salvando }
  const ocupadoRef = useRef(false);
  const onAtualizadoRef = useRef(onAtualizado);
  onAtualizadoRef.current = onAtualizado;

  useEffect(() => { iniciarSincronizacao(); }, []);

  const rodar = useCallback(async (atividade, executar, mensagemOk, novoStatus) => {
    if (ocupadoRef.current) return { ok: false, mensagem: null };
    ocupadoRef.current = true;
    setOcupadoId(atividade.id);
    try {
      const resultado = await executar();
      if (!resultado?.success) return { ok: false, mensagem: mensagemDeErro(resultado) };
      if (resultado.queued) toast.info('Salvo no aparelho. Será enviado quando a conexão voltar.');
      else toast.success(mensagemOk);
      onAtualizadoRef.current?.(atividade, novoStatus);
      return { ok: true };
    } catch (err) {
      console.error('Erro na ação da atividade:', err);
      return { ok: false, mensagem: mensagemDeErro(err) };
    } finally {
      ocupadoRef.current = false;
      setOcupadoId(null);
    }
  }, [toast]);

  const direta = useCallback(async (atividade, executar, mensagemOk, novoStatus) => {
    const r = await rodar(atividade, executar, mensagemOk, novoStatus);
    if (!r.ok && r.mensagem) toast.error(r.mensagem);
  }, [rodar, toast]);

  const iniciar = useCallback(
    (atividade) => direta(atividade, () => iniciarAtividade(atividade.id, usuarioId), 'Atividade iniciada.', 'em_andamento'),
    [direta, usuarioId]
  );
  const retomar = useCallback(
    (atividade) => direta(atividade, () => retomarAtividade(atividade.id, usuarioId), 'Atividade retomada.', 'em_andamento'),
    [direta, usuarioId]
  );

  const abrirPausa = useCallback((atividade) => setModal({ tipo: 'pausa', atividade, erro: '', salvando: false }), []);
  const abrirConclusao = useCallback((atividade) => setModal({ tipo: 'concluir', atividade, erro: '', salvando: false }), []);
  const abrirFaltaMaterial = useCallback((atividade) => setModal({ tipo: 'material', atividade, erro: '', salvando: false }), []);
  const fechar = useCallback(() => setModal(null), []);

  const confirmar = async (executar, mensagemOk, novoStatus) => {
    const { atividade } = modal;
    setModal((m) => (m ? { ...m, salvando: true, erro: '' } : m));
    const r = await rodar(atividade, executar, mensagemOk, novoStatus);
    if (r.ok) setModal(null);
    else setModal((m) => (m ? { ...m, salvando: false, erro: r.mensagem || '' } : m));
  };

  const modais = modal && (
    <>
      {modal.tipo === 'pausa' && (
        <ModalPausa
          atividade={modal.atividade}
          salvando={modal.salvando}
          erro={modal.erro}
          onClose={fechar}
          onConfirmar={(dados) => confirmar(
            () => pausarAtividade(modal.atividade.id, usuarioId, dados),
            'Atividade pausada. O escritório foi avisado.',
            'pausada'
          )}
        />
      )}
      {modal.tipo === 'concluir' && (
        <ModalConcluir
          atividade={modal.atividade}
          salvando={modal.salvando}
          erro={modal.erro}
          onClose={fechar}
          onConfirmar={(dados) => confirmar(
            () => concluirAtividade(modal.atividade.id, usuarioId, dados),
            'Atividade concluída.',
            'concluida'
          )}
        />
      )}
      {modal.tipo === 'material' && (
        <ModalFaltaMaterial
          atividade={modal.atividade}
          salvando={modal.salvando}
          erro={modal.erro}
          onClose={fechar}
          onConfirmar={(dados) => confirmar(
            () => reportarFaltaMaterial(modal.atividade.id, usuarioId, dados),
            dados.pausar ? 'Falta de material avisada e atividade pausada.' : 'Falta de material avisada ao escritório.',
            dados.pausar ? 'pausada' : modal.atividade.status
          )}
        />
      )}
    </>
  );

  return { ocupadoId, iniciar, retomar, abrirPausa, abrirConclusao, abrirFaltaMaterial, modais };
}
