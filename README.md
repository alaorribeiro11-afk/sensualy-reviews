# 💄 Sensualy Reviews — Sistema de Avaliações

Sistema completo de avaliação de produtos para a **Sensualy Shop** (Loja Integrada).

---

## Estrutura do projeto

```
Depoimentos/
├── server.js              ← Servidor principal
├── db.js                  ← Banco de dados SQLite
├── package.json
├── .env.example           ← Copie para .env e configure
├── routes/
│   ├── reviews.js         ← API pública de avaliações
│   └── admin.js           ← API do painel admin
├── public/
│   ├── admin/index.html   ← Painel de moderação
│   └── widget/
│       ├── product-reviews.js   ← Widget da página de produto
│       └── category-stars.js   ← Widget da página de categoria
├── data/
│   └── reviews.db         ← Banco SQLite (criado automaticamente)
└── uploads/               ← Fotos enviadas pelos clientes (criado automaticamente)
```

---

## 1. Instalação no servidor

```bash
# Instalar dependências
npm install

# Copiar e editar variáveis de ambiente
cp .env.example .env
nano .env

# Iniciar servidor
npm start

# OU com PM2 (recomendado para produção)
pm2 start server.js --name sensualy-reviews
pm2 save
```

### Variáveis de ambiente (`.env`)

| Variável         | Descrição                                          | Exemplo                              |
|------------------|----------------------------------------------------|--------------------------------------|
| `PORT`           | Porta do servidor                                  | `3000`                               |
| `ADMIN_PASSWORD` | Senha do painel admin                              | `MinhaS3nhaForte!`                   |
| `BASE_URL`       | URL pública do servidor (sem barra no final)       | `https://reviews.seudominio.com.br`  |

### Nginx (proxy reverso — recomendado)

```nginx
server {
    listen 80;
    server_name reviews.seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 6M;
    }
}
```

---

## 2. Snippets para a Loja Integrada

> **Atenção:** Substitua `https://reviews.seudominio.com.br` pela URL real do seu servidor em todos os snippets abaixo.

---

### 2a. Página de Produto — Widget completo (formulário + avaliações)

Cole no template da **página de produto** da Loja Integrada, onde quiser que apareçam as avaliações:

```html
<!-- Container do widget -->
<div id="sensualy-reviews-widget"></div>

<!-- Configuração e carregamento do widget -->
<script>
  window.SensualyReviews = {
    apiBase: 'https://reviews.seudominio.com.br',

    // Pega o ID do produto automaticamente da URL da Loja Integrada
    // Exemplo de URL: /produto/123/nome-do-produto
    productId: (function() {
      var match = window.location.pathname.match(/\/produto\/(\d+)/);
      return match ? match[1] : window.location.pathname;
    })()
  };
</script>
<script src="https://reviews.seudominio.com.br/widget/product-reviews.js"></script>
```

> **Dica Loja Integrada:** Se a plataforma expõe uma variável com o ID do produto (ex: `{{product.id}}`), use diretamente:
> ```html
> productId: '{{product.id}}'
> ```

---

### 2b. Página de Categoria — Média de estrelas por produto

Cole no template da **página de categoria**, dentro do bloco que se repete para cada produto. Adicione o atributo `data-sr-product-id` no elemento onde as estrelas devem aparecer:

```html
<!-- Dentro do loop de produtos da categoria -->
<div
  data-sr-product-id="{{product.id}}"
  style="margin-top: 4px;"
></div>
```

E adicione **uma vez** no rodapé do template de categoria:

```html
<script>
  window.SensualyCategory = {
    apiBase: 'https://reviews.seudominio.com.br'
  };
</script>
<script src="https://reviews.seudominio.com.br/widget/category-stars.js"></script>
```

O script buscará automaticamente a nota de todos os produtos visíveis na página em uma única requisição.

---

## 3. Painel Admin

Acesse em: `https://reviews.seudominio.com.br/admin`

- Faça login com a senha definida em `ADMIN_PASSWORD`
- **Aguardando**: avaliações novas para moderar
- **Aprovar** → avaliação fica visível para clientes
- **Rejeitar** → avaliação é excluída (e foto removida)
- Painel exibe estatísticas gerais, nota média e paginação

---

## 4. Fluxo completo

```
Cliente acessa produto
  → vê widget com estrelas e depoimentos
  → preenche nome, nota, depoimento e (opcionalmente) foto
  → clica "Enviar Avaliação"
  → mensagem: "aguardando aprovação"

Você acessa /admin
  → vê avaliação pendente
  → aprova ou rejeita

Cliente recarrega a página do produto
  → avaliação aparece publicada
  → página de categoria mostra nova média
```

---

## 5. Observações de segurança

- Rate limit: máximo de **5 envios por hora** por IP
- Fotos aceitas: JPG, PNG, WEBP, GIF — máximo **5 MB**
- Todas as avaliações ficam **pendentes por padrão** até você aprovar
- O token de admin expira em **7 dias**
- Altere `ADMIN_PASSWORD` para uma senha forte antes de colocar em produção
