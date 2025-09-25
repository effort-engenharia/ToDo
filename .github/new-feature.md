## Resumo
Você deve implementar um sistema de autenticação e administração no site com:
- Ícone de engrenagem para acessar área de administrador
- Login/cadastro centralizado e obrigatório
- Funções de gestão de usuários (adicionar, excluir, liberar, inativar)
- Níveis de acesso vinculados a páginas
- Persistência no Supabase (usar MCP se necessário)
- Registro de logs (email, data, horário, IP)
- Manter estilo visual do site existente

## Etapa 1 – Ícone e Login
- Adicione um ícone de engrenagem no canto inferior direito do site para acesso à área de administrador.  
- A modal de login/cadastro deve ficar no centro da tela.  
- Não deve ser possível acessar nenhuma parte do site sem estar logado.  
- Login e senha do administrador:  
  - **Login:** effort.engenharia.eletrica@gmail.com  
  - **Senha:** !Effort2022  

---

## Etapa 2 – Área de Administrador
Dentro da área de administrador implementar:  
- Liberar um acesso  
- Inativar um acesso  
- Excluir um usuário  
- Adicionar um usuário  

Além disso:  
- Adicionar níveis de acesso e permitir escolher quais páginas estão em quais níveis.  
- Manter o estilo do cabeçalho das demais páginas.  

---

## Etapa 3 – Persistência e Logs
- Utilizar o **Supabase** para persistência dos dados.  
- Caso precise, utilize o **MCP do Supabase**.  
- Implementar dentro da área de administrador uma **tabela de log** com:  
  - Email  
  - Data  
  - Horário  
  - IP de quem fez login no sistema.  

---

⚠️ **Importante:** Não faça nada além do solicitado.