// Entrada da página pública de cotação (/cotacao/#token). Bundle separado do app autenticado (plano §9.1):
// NÃO importe AuthContext, App.jsx, echarts nem `@supabase/supabase-js` aqui (a F-04 usa fetch direto, ver api.js).
import { createRoot } from 'react-dom/client';
import CotacaoPublica from './CotacaoPublica.jsx';
import './cotacao-publica.css';

createRoot(document.getElementById('root')).render(<CotacaoPublica />);
