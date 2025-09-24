import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = 'https://cadrulmppoxhsfjizcfy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZHJ1bG1wcG94aHNmaml6Y2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMjI1MDAsImV4cCI6MjA3MzY5ODUwMH0.ojYd2pUsjh35mXx2Iy_MShRPb70rh1t0dC6dkB4XvC4';

// Criar cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Exportar cliente para compatibilidade
export default supabase;