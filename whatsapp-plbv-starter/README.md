# Starter: Embedded Signup + PLBV (Graph API)

Referências oficiais:

- [Embedded Signup — Implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/)
- [Partner-led Business Verification](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/partner-led-business-verification/)
- [Website optional / PARTNER_CLIENT_CERTIFICATION_NEEDED](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/website-optional/)

## O que este projeto faz

1. **Página** (`public/`): carrega o JS SDK da Meta, executa `FB.login` com `config_id` do Embedded Signup, escuta `postMessage` (`WA_EMBEDDED_SIGNUP`), envia o `code` ao servidor para trocar por **access token** da sessão de signup.
2. **Servidor** (`server/index.js`): troca `code` → token, expõe `GET /api/waba/:id` com o token do cliente para obter `owner_business_info` / `business_verification_status`, e `POST /api/plbv/submit` que chama `POST /{PARTNER_BUSINESS_PORTFOLIO_ID}/self_certify_whatsapp_business` com **System User** (documentos multipart, até 3 ficheiros).
3. **Webhook** `GET|POST /webhook`: verificação Meta e log de eventos `PARTNER_CLIENT_CERTIFICATION_*`.

## Configuração

```bash
cd whatsapp-plbv-starter
cp .env.example .env
# Edite .env com App ID, secret, CONFIG_ID do Embedded Signup, portfolio do parceiro e token de System User
npm install
npm start
```

Abra `http://localhost:3000`. No Meta Developer App: adicione `http://localhost:3000` aos domínios da app e configure o webhook `https://<seu-host>/webhook` com o mesmo `WEBHOOK_VERIFY_TOKEN`.

## Notas

- O **token** devolvido pela troca do `code` é o da integração de signup; use-o nas chamadas à WABA do **cliente**. O **PLBV** no servidor usa sempre `PARTNER_SYSTEM_USER_ACCESS_TOKEN`.
- Se a troca de `code` falhar, experimente definir `META_OAUTH_REDIRECT_URI` exatamente como no painel OAuth da app.
- Os `extras` do `FB.login` podem ter de alinhar com a versão do Embedded Signup (v3/v4); ajuste conforme a doc da Meta para o seu `config_id`.
