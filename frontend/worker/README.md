# Worker outbound

Execute dentro de frontend com Node.js 22+. Playwright e Chromium foram instalados localmente. Copie worker/.env.example para worker/.env. A trava própria WHATSAPP_WEB_SENDING_ENABLED=false não abre navegador nem conecta ao banco. O secret antigo WHATSAPP_SENDING_ENABLED não habilita este worker.

Quando autorizado, npm run worker abre um navegador visível com Chrome instalado e perfil exclusivo worker/.session-worker; WHATSAPP_WEB_PROFILE_DIR pode apontar para outro perfil local. Uma única instância usa o perfil; computador ligado, conectado e sem suspensão. npm run worker -- --once processa no máximo um item elegível. Nunca use esse modo numa fila de produção para escolher um destinatário: ele pega o próximo item.

O backend gera payload.version=2, phone e message completos, com MIRIAN_WHATSAPP_PHONE configurado exclusivamente no gerador. Campos legados template_name/template_language ainda são preenchidos para compatibilidade do esquema não revalidado; não existe envio de template Meta.

## Horários

America/Sao_Paulo: reminder_40h é preparada a partir de agendamento menos 40 horas, mas scheduled_for é 08:00 do dia anterior. Catch-up permitido até a meia-noite que inicia o dia do agendamento, nunca depois (a mensagem diz amanhã). reminder_2h fica agendamento menos 2 horas, com tolerância existente de uma hora; o claim exige o dia do procedimento para preservar hoje. Quando ocioso, o worker consulta a cada 30 segundos.

Antes de habilitar, validar e aplicar no ambiente autorizado as migrations hold_uncertain_whatsapp_sends e whatsapp_dispatch_hours, publicar o gerador queue-only e preparar a fila nova. Nada disso foi aplicado em produção. O claim valida agendamento ativo, telefone, tipo, horário e payload atual; não depende de opt-in. O worker não consulta agenda ou perfis: recebe a fila e transporta o texto pronto.

No navegador só são inspecionados editor, identificadores de saída e a nova mensagem enviada. Sem leitura de recebidas, listeners, respostas automáticas ou acompanhamento dos links. Seletores e confirmação ainda exigem teste controlado na interface real. Sent significa indicador de envio, não leitura pelo destinatário.

Falha ou dúvida fica failed sem retry. Falha ao gravar depois de enviar interrompe o processo e pode deixar processing; recuperação após 15 minutos retém como failed. Nunca redefinir attempts/status automaticamente. Conferência manual é necessária porque envio e banco não formam transação única.

## Primeiro teste real (não executado)

Ambiente isolado com uma única notificação de teste, destinatário autorizado e texto revisado, sem exigir campo de opt-in. Aplicar as migrations apenas nesse ambiente sob autorização. Habilitar WHATSAPP_WEB_SENDING_ENABLED somente ali, entrar via QR e executar --once. Conferir recebimento e sent/provider_message_id. Reexecutar --once para verificar ausência de novo envio e retornar a false. Não usar produção.
