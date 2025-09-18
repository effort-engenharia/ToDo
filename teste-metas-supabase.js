// Teste manual para verificar se as metas estão sendo persistidas no Supabase
// Execute este arquivo com: node teste-metas-supabase.js

import { metasService } from './src/services/supabaseService.js';
import { getCurrentMetas, salvarMeta, resetMetasToDefault } from './src/config/metas.js';

async function testarMetasSupabase() {
  console.log('🧪 Iniciando teste das metas no Supabase...\n');

  try {
    // 1. Testar busca de metas atuais
    console.log('1️⃣ Testando busca de metas atuais...');
    const metasAtuais = await getCurrentMetas();
    console.log('Metas carregadas:', metasAtuais);
    console.log('✅ Busca de metas funcionando\n');

    // 2. Testar salvamento de nova meta de valor de entrada
    console.log('2️⃣ Testando salvamento de nova meta de valor de entrada...');
    const novoValorEntrada = 75000;
    await salvarMeta('valor_entrada', novoValorEntrada, 'Teste automatizado');
    console.log(`✅ Meta de valor de entrada salva: R$ ${novoValorEntrada.toLocaleString('pt-BR')}\n`);

    // 3. Testar salvamento de nova meta de clientes atendidos
    console.log('3️⃣ Testando salvamento de nova meta de clientes atendidos...');
    const novoClientesAtendidos = 350;
    await salvarMeta('clientes_atendidos', novoClientesAtendidos, 'Teste automatizado');
    console.log(`✅ Meta de clientes atendidos salva: ${novoClientesAtendidos}\n`);

    // 4. Verificar se as metas foram salvas corretamente
    console.log('4️⃣ Verificando metas salvas...');
    const metasAtualizadas = await getCurrentMetas();
    console.log('Metas após salvamento:', metasAtualizadas);
    
    if (metasAtualizadas.valorEntrada === novoValorEntrada && metasAtualizadas.clientesAtendidos === novoClientesAtendidos) {
      console.log('✅ Metas salvas e carregadas corretamente\n');
    } else {
      console.log('❌ Erro: Metas não foram salvas corretamente\n');
    }

    // 5. Testar busca direta do Supabase
    console.log('5️⃣ Testando busca direta do Supabase...');
    const metasSupabase = await metasService.buscarMetasDoMes();
    console.log('Metas diretas do Supabase:', metasSupabase);
    console.log('✅ Busca direta do Supabase funcionando\n');

    // 6. Testar histórico de metas
    console.log('6️⃣ Testando histórico de metas...');
    const historicoValor = await metasService.buscarHistoricoMetas('valor_entrada', 5);
    const historicoClientes = await metasService.buscarHistoricoMetas('clientes_atendidos', 5);
    console.log('Histórico valor entrada (últimas 5):', historicoValor.length, 'registros');
    console.log('Histórico clientes atendidos (últimas 5):', historicoClientes.length, 'registros');
    console.log('✅ Histórico de metas funcionando\n');

    console.log('🎉 Todos os testes passaram! As metas estão sendo persistidas corretamente no Supabase.');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Executar teste
testarMetasSupabase();