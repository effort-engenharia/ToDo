import React, { useId, useRef, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import {
  documentoValido, emailValido, mascaraDocumento, mascaraWhatsapp, whatsappParaSalvar, whatsappValido
} from './formatos';

// Criar/editar fornecedor (Anexo B.6). `onSalvo(id)` deixa a página recarregar (ou o assistente já selecionar).
const ModalFornecedor = ({ fornecedor = null, onClose, onSalvo, onVerExistente = null }) => {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const [f, setF] = useState(() => ({
    nome_contato: fornecedor?.nome_contato ?? '',
    empresa: fornecedor?.empresa ?? '',
    whatsapp: fornecedor?.whatsapp ? mascaraWhatsapp(fornecedor.whatsapp) : '',
    documento: fornecedor?.documento ? mascaraDocumento(fornecedor.documento) : '',
    email: fornecedor?.email ?? '',
    categorias: fornecedor?.categorias ?? [],
    observacao: fornecedor?.observacao ?? '',
  }));
  const [novaCategoria, setNovaCategoria] = useState('');
  const [erros, setErros] = useState({});
  const [erroEnvio, setErroEnvio] = useState(null);
  const [duplicado, setDuplicado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const refs = useRef({});
  const id = (c) => `${idBase}-${c}`;

  const set = (campo, valor) => { setF((x) => ({ ...x, [campo]: valor })); setErros((e) => ({ ...e, [campo]: undefined })); setDuplicado(false); };

  const addCategoria = () => {
    const c = novaCategoria.trim();
    if (c && !f.categorias.some((x) => x.toLowerCase() === c.toLowerCase())) set('categorias', [...f.categorias, c.slice(0, 40)]);
    setNovaCategoria('');
  };
  const teclaCategoria = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCategoria(); }
    else if (e.key === 'Backspace' && !novaCategoria && f.categorias.length) set('categorias', f.categorias.slice(0, -1));
  };

  const validar = () => {
    const e = {};
    if (f.nome_contato.trim().length < 2) e.nome_contato = 'Informe o nome do contato';
    if (f.empresa.trim().length < 2) e.empresa = 'Informe a empresa';
    if (!whatsappValido(f.whatsapp)) e.whatsapp = 'Número inválido. Use DDD + número (10 ou 11 dígitos)';
    if (!documentoValido(f.documento)) e.documento = 'Documento com formato inválido (CPF 11 ou CNPJ 14 dígitos)';
    if (!emailValido(f.email)) e.email = 'E-mail inválido';
    if (f.observacao.length > 500) e.observacao = 'A observação pode ter até 500 caracteres';
    return e;
  };

  const salvar = async (ev) => {
    ev.preventDefault();
    const e = validar();
    setErros(e);
    const primeiro = Object.keys(e)[0];
    if (primeiro) { refs.current[primeiro]?.focus(); return; }
    const categorias = novaCategoria.trim() ? [...f.categorias, novaCategoria.trim()] : f.categorias;
    setSalvando(true);
    setErroEnvio(null);
    const r = await comprasCotacaoService.salvarFornecedor(fornecedor?.id ?? null, {
      nome_contato: f.nome_contato.trim(),
      empresa: f.empresa.trim(),
      whatsapp: whatsappParaSalvar(f.whatsapp),
      documento: f.documento.trim() || null,
      email: f.email.trim() || null,
      categorias,
      observacao: f.observacao.trim() || null,
    });
    setSalvando(false);
    if (!r.success) {
      if (/já existe fornecedor com este whatsapp/i.test(r.message || '')) {
        setDuplicado(true);
        setErros({ whatsapp: 'Este WhatsApp já está cadastrado para esta empresa' });
        refs.current.whatsapp?.focus();
      } else {
        setErroEnvio(r.message || 'Não foi possível salvar o fornecedor.');
      }
      return;
    }
    toast.success('Fornecedor salvo');
    onSalvo?.(r.data);
    onClose();
  };

  const campo = (chave, extra = {}) => ({
    id: id(chave), ref: (el) => { refs.current[chave] = el; },
    value: f[chave], onChange: (e) => set(chave, e.target.value),
    'aria-invalid': erros[chave] ? true : undefined, 'aria-describedby': erros[chave] ? `${id(chave)}-erro` : undefined,
    ...extra,
  });
  const erroDe = (chave) => (erros[chave] ? <p id={`${id(chave)}-erro`} className="cmp-erro-campo" role="alert">{erros[chave]}</p> : null);

  return (
    <Modal titulo={fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={onClose} variante="cheia">
      <form onSubmit={salvar} noValidate aria-busy={salvando || undefined}>
        {erroEnvio && <div className="cmp-aviso-erro" role="alert">{erroEnvio}</div>}

        <div className="execucao-form-group">
          <label className="execucao-form-label" htmlFor={id('nome_contato')}>Nome do contato *</label>
          <input {...campo('nome_contato')} type="text" maxLength={120} autoComplete="off" className="execucao-form-input" aria-required="true" />
          {erroDe('nome_contato')}
        </div>
        <div className="execucao-form-group">
          <label className="execucao-form-label" htmlFor={id('empresa')}>Empresa *</label>
          <input {...campo('empresa')} type="text" maxLength={160} autoComplete="off" className="execucao-form-input" aria-required="true" />
          {erroDe('empresa')}
        </div>
        <div className="execucao-form-group">
          <label className="execucao-form-label" htmlFor={id('whatsapp')}>WhatsApp *</label>
          <input
            {...campo('whatsapp', {
              onChange: (e) => set('whatsapp', mascaraWhatsapp(e.target.value)),
              'aria-describedby': [erros.whatsapp && `${id('whatsapp')}-erro`, `${id('whatsapp')}-dica`].filter(Boolean).join(' '),
            })}
            type="tel" inputMode="tel" autoComplete="off" placeholder="(41) 99999-9999" className="execucao-form-input" aria-required="true"
          />
          <p id={`${id('whatsapp')}-dica`} className="text-xs text-slate-400 mt-1">Com DDD. Ex.: (41) 99999-9999</p>
          {erroDe('whatsapp')}
          {duplicado && onVerExistente && (
            <button type="button" className="cmp-link text-sm" onClick={onVerExistente}>Ver cadastro existente</button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor={id('documento')}>Documento (CNPJ/CPF)</label>
            <input {...campo('documento', { onChange: (e) => set('documento', mascaraDocumento(e.target.value)) })}
              type="text" inputMode="numeric" autoComplete="off" className="execucao-form-input" />
            {erroDe('documento')}
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor={id('email')}>E-mail</label>
            <input {...campo('email')} type="email" maxLength={200} autoComplete="off" className="execucao-form-input" />
            {erroDe('email')}
          </div>
        </div>

        <div className="execucao-form-group">
          <label className="execucao-form-label" htmlFor={id('categoria')}>Categorias</label>
          {f.categorias.length > 0 && (
            <ul className="flex flex-wrap gap-2 mb-2" aria-label="Categorias do fornecedor">
              {f.categorias.map((c) => (
                <li key={c} className="cmp-selo cmp-tom-azul">
                  {c}
                  <button type="button" className="ml-1 px-1" aria-label={`Remover categoria ${c}`}
                    onClick={() => set('categorias', f.categorias.filter((x) => x !== c))}>×</button>
                </li>
              ))}
            </ul>
          )}
          <input
            id={id('categoria')} type="text" maxLength={40} autoComplete="off" className="execucao-form-input" value={novaCategoria}
            placeholder="Ex.: Elétrica (Enter para adicionar)" onChange={(e) => setNovaCategoria(e.target.value)}
            onKeyDown={teclaCategoria} onBlur={addCategoria}
          />
        </div>

        <div className="execucao-form-group">
          <label className="execucao-form-label" htmlFor={id('observacao')}>Observação</label>
          <textarea {...campo('observacao')} rows={3} maxLength={500} className="execucao-form-textarea" />
          <p className="text-xs text-slate-400 mt-1">{f.observacao.length}/500</p>
          {erroDe('observacao')}
        </div>

        <div className="execucao-modal-footer !px-0 !pb-0">
          <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary cmp-btn-toque" disabled={salvando} aria-busy={salvando || undefined}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ModalFornecedor;
