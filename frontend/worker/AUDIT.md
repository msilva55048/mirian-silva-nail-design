# Revisão local do WhatsApp outbound — 08/09/2026

## Limite da auditoria de produção

A nova inspeção do Supabase pelo navegador foi rejeitada pela revisão automática por limite de uso. Não foi tentado contorno. Este relatório distingue o código local inspecionado dos registros da auditoria anterior; não certifica o estado remoto atual nem que todos os consumidores externos foram eliminados.

Na auditoria anterior foram identificados em produção appointments, client_profiles, whatsapp_notifications, claim_due_whatsapp_notifications, get_my_whatsapp_opt_in, accept_whatsapp_reminders, o cron whatsapp-reminders-every-5-minutes e as Edge Functions whatsapp-reminders e whatsapp-webhook mínimo. As migrations históricas locais 20260906000000 e 20260906050000 descrevem os cinco campos do opt-in; é obrigatório conferir novamente sua aplicação e dependências antes da limpeza.

## A — removido do código local

- Texto de autorização na confirmação, estado hasWhatsappOptIn, consulta get_my_whatsapp_opt_in, chamada accept_whatsapp_reminders.
- Consulta de perfis e bloqueio por opt-in no gerador e worker.
- Consulta de agendamentos no worker: validação de consistência fica no claim SQL.
- Janela antiga restrita a um minuto e limite antigo de seis horas para confirmação.
- Referências operacionais de documentação a consentimento e teste com opt-in.
- Transporte Cloud API e implementação inbound já removidos anteriormente; não foram reintroduzidos.

As referências history encontradas no site pertencem à navegação do navegador e ao histórico de agendamentos administrativo, não a conversas WhatsApp. Foram preservadas. Testes citam nomes antigos apenas para verificar ausência de regressões.

## B — preservado, aguardando verificação e implantação autorizada

- Cinco campos whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_in_source, whatsapp_opt_in_version, whatsapp_opt_out_at em client_profiles e as duas RPCs de opt-in.
- Migrations históricas aplicadas ou potencialmente aplicadas: nenhuma foi apagada.
- Webhook mínimo publicado: não removido. Apps, número e ativos Meta: não alterados.
- A versão publicada de whatsapp-reminders precisa ser substituída pela geradora queue-only antes da limpeza do banco. Clientes antigos podem continuar chamando as RPCs: remover os consumidores e conferir logs primeiro.
- template_name/template_language ficam por compatibilidade com o esquema existente, pois sua nulabilidade/defaults remotos não foram revalidados. Não são usados pelo worker. Avaliar remoção posterior sem apagar histórico de notificações.

### Proposta de limpeza

supabase/cleanup/remove_meta_opt_in.proposed.sql fica deliberadamente fora das migrations automáticas. Removeria somente as duas RPCs sem parâmetros e os cinco campos listados. Exige configuração explícita de aprovação, usa transação e lock_timeout, verifica outras funções e usa RESTRICT, nunca CASCADE. Views/policies dependentes impedem a operação. Antes de executar: reauditar schema/consumidores, exportar os cinco campos com id de client_profiles para recuperação, publicar as mudanças sem opt-in, testar e obter autorização específica. Rollback de dados exige essa exportação; não recriar consentimentos como verdadeiros.

### Secrets candidatos a limpeza posterior

WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_API_VERSION: não usados pelo gerador local. O secret remoto WHATSAPP_SENDING_ENABLED deixa de ser usado apenas após publicar o gerador queue-only; não o habilitar. WHATSAPP_VERIFY_TOKEN e eventuais WHATSAPP_APP_SECRET/WABA_ID podem ainda pertencer ao webhook publicado: verificar consumidores antes de remover. A lista é de candidatos, não inventário remoto confirmado. Nenhum secret foi lido em valor, alterado ou removido.

WHATSAPP_REMINDERS_SECRET continua autenticando o cron. SUPABASE_URL e SERVICE_ROLE_KEY continuam necessários. MIRIAN_WHATSAPP_PHONE é configuração do gerador. WHATSAPP_WEB_SENDING_ENABLED=false é a trava local exclusiva do worker; a chave antiga não o habilita.

## C — necessário e preservado

appointments, client_profiles (sem uso de opt-in para envio), whatsapp_notifications, cron existente, os dois tipos, estados, identificador de saída, unicidade, claim e proteção de processing. A migration 20260907010000_hold_uncertain_whatsapp_sends.sql permanece; 20260908000000_whatsapp_dispatch_hours.sql define o claim final. Nenhuma foi aplicada nesta etapa.

O backend prepara 40h ao atingir agendamento menos 40h, agenda para 08:00 do dia anterior e expira no início do dia do procedimento. 2h mantém agendamento menos 2h, tolerância de uma hora e dia do procedimento. O payload versionado impede claim de textos/horários antigos; gerador atualiza apenas notificações ainda não tentadas. Nenhum agendamento é alterado pelo worker.

## Sequência posterior

Revalidar produção em modo leitura; testar em ambiente isolado; implantar o gerador/claim sem opt-in somente após autorização; verificar ausência de consumidores antigos; realizar uma mensagem de teste autorizada; então avaliar a limpeza separadamente. Produção, Meta e envio real permanecem intocados por esta tarefa.
