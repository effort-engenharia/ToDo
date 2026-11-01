import React, { useId, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';

// Anonimização LGPD com confirmação dupla (Anexo B.6): o botão só habilita depois de digitar o nome da empresa.
const normaliza = (t) => String(t ?? '').trim().toLowerCase();

const ModalAnonimizar = ({ fornecedor, onClose, onConcluido }) => {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const [passo, setPasso] = useState(1);
  const [empresa, setEmpresa] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const confere = normaliza(empresa) === normaliza(fornecedor.empresa);
  const motivoOk = motivo.trim().length >= 5;

  const anonimizar = async () => {
    setSalvando(true);
    setErro(null);
    const r = await comprasCotacaoService.anonimizarFornecedor(fornecedor.id, motivo.trim());
    setSalvando(false);
    if (!r.success) { setErro(r.message || 'Não foi possível anonimizar.'); return; }
    toast.success('Fornecedor anonimizado');
    onConcluido?.();
    onClose();
  };

  return (
    <Modal titulo={`Anonimizar ${fornecedor.empresa}`} onClose={onClose} tamanho="sm">
      {erro && <div className="cmp-aviso-erro" role="alert">{erro}</div>}
      {passo === 1 ? (
        <>
          <p className="mb-4 text-slate-300">
            Os dados pessoais serão apagados e isto não pode ser desfeito. O histórico de cotações é mantido.
          </p>
          <div className="execucao-modal-footer !px-0 !pb-0">
            <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose}>Cancelar</button>
            <button type="button" className="execucao-btn execucao-btn-danger cmp-btn-toque" onClick={() => setPasso(2)}>Continuar</button>
          </div>
        </>
      ) : (
        <>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor={`${idBase}-motivo`}>Motivo (mínimo 5 caracteres) *</label>
            <input id={`${idBase}-motivo`} type="text" className="execucao-form-input" value={motivo} maxLength={200}
              onChange={(e) => setMotivo(e.target.value)} autoComplete="off" />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor={`${idBase}-empresa`}>Digite “{fornecedor.empresa}” para confirmar *</label>
            <input id={`${idBase}-empresa`} type="text" className="execucao-form-input" value={empresa}
              onChange={(e) => setEmpresa(e.target.value)} autoComplete="off" data-autofocus />
          </div>
          <div className="execucao-modal-footer !px-0 !pb-0">
            <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="button" className="execucao-btn execucao-btn-danger cmp-btn-toque" disabled={!confere || !motivoOk || salvando}
              aria-busy={salvando || undefined} onClick={anonimizar}>
              {salvando ? 'Anonimizando…' : 'Anonimizar definitivamente'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default ModalAnonimizar;
