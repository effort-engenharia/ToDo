// Mensagem de erro de campo (Anexo B.1.4): prefixo "⚠", ligada ao campo por aria-describedby (id = `${idCampo}-erro`).
const CampoErro = ({ id, mensagem }) => (mensagem
  ? <p id={`${id}-erro`} className="cp-erro">⚠ {mensagem}</p>
  : null);

export default CampoErro;
