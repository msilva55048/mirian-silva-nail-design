# Configuração do Web Push do Admin

## 1. Gerar as chaves VAPID

Execute localmente (uma única vez):

```sh
npx web-push generate-vapid-keys
```

Guarde a chave privada somente nos secrets do Supabase. A chave pública pode ser usada no frontend.

## 2. Aplicar o SQL

No Supabase Dashboard, abra **SQL Editor > New query**, cole todo o conteúdo de
`supabase/migrations/20260901000000_admin_web_push.sql` e execute.

O SQL interrompe com uma mensagem clara se a conta `mirian201420@gmail.com` não existir em Auth.

## 3. Configurar secrets e publicar a Edge Function

No diretório `frontend`, com o Supabase CLI autenticado e vinculado ao projeto:

```sh
supabase secrets set WEB_PUSH_VAPID_PUBLIC_KEY="CHAVE_PUBLICA" WEB_PUSH_VAPID_PRIVATE_KEY="CHAVE_PRIVADA" WEB_PUSH_VAPID_SUBJECT="mailto:mirian201420@gmail.com" PUSH_WEBHOOK_SECRET="SEGREDO_ALEATORIO_FORTE" SITE_ORIGIN="https://agendamentosmiriansilva.com.br"
supabase functions deploy admin-web-push --no-verify-jwt
```

## 4. Criar o Database Webhook

No Supabase Dashboard, abra **Database > Webhooks > Create webhook**:

- Nome: `appointment-push-events`
- Tabela: `appointment_push_events`
- Evento: somente `INSERT`
- Tipo: Supabase Edge Function
- Função: `admin-web-push`
- Método: `POST`
- Header: `x-push-webhook-secret` com exatamente o mesmo valor de `PUSH_WEBHOOK_SECRET`
- `Content-Type`: `application/json`

## 5. Configurar a Vercel

Adicione em **Project Settings > Environment Variables** para Production e Preview:

```text
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=CHAVE_PUBLICA
```

Depois faça um novo deploy. A chave pública precisa ser a mesma configurada no Supabase.
