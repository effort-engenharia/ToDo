# 🗺️ Configuração do Google Maps API para Autocomplete de Endereços

## Como Obter e Configurar a Chave da API

### 1. Acessar o Google Cloud Console
- Acesse: https://console.cloud.google.com/
- Faça login com sua conta Google

### 2. Criar ou Selecionar um Projeto
- Clique em "Selecionar projeto" no topo da página
- Clique em "NOVO PROJETO" se não tiver um projeto
- Dê um nome ao projeto (ex: "Dashboard Comercial")

### 3. Habilitar as APIs Necessárias
- No menu lateral, vá em "APIs e serviços" > "Biblioteca"
- Procure e habilite estas APIs:
  - **Places API** (para autocomplete mais preciso)
  - **Geocoding API** (para busca de endereços)

### 4. Criar Credenciais
- Vá em "APIs e serviços" > "Credenciais"
- Clique em "+ CRIAR CREDENCIAIS" > "Chave de API"
- Copie a chave gerada

### 5. Configurar Restrições (Recomendado)
- Clique na chave criada para editá-la
- Em "Restrições da aplicação":
  - Selecione "Referenciadores HTTP (sites da web)"
  - Adicione seu domínio (ex: `localhost:5174/*` para desenvolvimento)
- Em "Restrições de API":
  - Selecione "Restringir chave"
  - Marque "Places API" e "Geocoding API"

### 6. Configurar no Projeto

#### Criar arquivo .env:
```bash
# Copie o arquivo .env.example para .env
cp .env.example .env
```

#### Editar o arquivo .env:
```env
VITE_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

**⚠️ IMPORTANTE:** 
- Substitua `SUA_CHAVE_AQUI` pela chave real que você copiou
- Nunca commite o arquivo `.env` no Git (já está no .gitignore)

## 💰 Custos

### Cota Gratuita (por mês):
- **Places API Autocomplete**: 2.500 requisições gratuitas
- **Geocoding API**: 40.000 requisições gratuitas

### Preços após cota gratuita:
- **Places API Autocomplete**: $17.00 por 1.000 requisições
- **Geocoding API**: $5.00 por 1.000 requisições

Para uso normal do dashboard, raramente ultrapassará a cota gratuita.

## 🔧 Funcionamento

### Com API Configurada:
- ✅ Autocomplete dinâmico usando Google Maps JavaScript API
- ✅ AutocompleteService oficial (sem problemas de CORS)
- ✅ Bairros corretos baseados no endereço digitado
- ✅ Sugestões em tempo real do Google Maps
- ✅ Carregamento dinâmico da biblioteca

### Sem API (Fallback):
- ⚡ Sistema mockado melhorado automaticamente
- ⚡ Sugestões baseadas em database local
- ⚡ Funciona offline mas menos preciso
- ⚡ Sem erros de CORS ou dependências externas

## 🚀 Como Testar

1. Configure a chave no `.env`
2. Reinicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Acesse o Arsenal de Guerra > Roteiro de Viagem
4. Digite um endereço nos campos e veja o autocomplete em ação!

## 🛠️ Troubleshooting

### Erro: "API key not found"
- Verifique se o arquivo `.env` existe
- Verifique se a variável está com o nome correto: `VITE_GOOGLE_MAPS_API_KEY`

### Erro: "This API project is not authorized"
- Verifique se as APIs estão habilitadas no Google Cloud Console
- Verifique as restrições da chave de API

### Autocomplete não funciona
- Abra o console do navegador (F12) e veja se há erros
- Verifique se a chave está correta
- Teste temporariamente sem restrições de domínio

## 📞 Suporte

Se tiver problemas:
1. Verifique o console do navegador (F12)
2. O sistema automaticamente usa fallback se a API falhar
3. O autocomplete ainda funcionará, mas com menos precisão