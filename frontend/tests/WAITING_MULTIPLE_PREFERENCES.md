# Preferências múltiplas da lista de espera

Uma entrada por cliente, com dois conjuntos independentes: preferred_dates e preferred_times.
Seleção por toque alterna somente o item escolhido, preserva meses anteriores e ordena os valores.
O formulário exige cliente, pelo menos uma data futura/atual e um horário. O sucesso limpa as seleções.
O card compartilhado de cliente selecionada, Trocar, FIFO, unicidade e os contadores foram preservados.

## Compatibilidade e migration

20260903020000_waiting_list_multiple_preferences.sql foi aplicada manualmente em produção.
Adiciona date[] e time without time zone[] nullable, sem default. Copia os campos antigos não nulos
para arrays de um elemento. Mantém colunas antigas, PK, FK, UNIQUE, índices, RLS, policies e Realtime.
O frontend prioriza arrays; arrays NULL/ausentes usam os campos antigos. Arrays vazios são conjuntos
vazios explícitos. Novas inserções gravam uma linha com arrays ordenados e sem duplicatas; campos
legados recebem valor somente quando seu conjunto tem um único item.
Não há perda silenciosa de preferências se o banco não tiver os arrays: a inclusão falha sem salvar.
A validação posterior confirmou os arrays nullable, as colunas antigas e as proteções preservadas.
A lista estava vazia durante a aplicação, portanto não havia preferências antigas para copiar.

## Agendamento

Com exatamente uma data e um horário, mantém a pré-seleção, sujeita à disponibilidade.
Com múltiplas opções ou informações parciais, não escolhe uma combinação automaticamente:
data e horário ficam sem seleção, e as preferências completas aparecem junto ao formulário.
A Mirian escolhe no calendário e nos horários válidos do formulário compartilhado.
Cancelamento/falha mantém as preferências; sucesso remove a entrada inteira após a RPC confirmar.
O resumo compartilhado exibe datas como DD/MM; ordenação, calendário e agendamento continuam
usando YYYY-MM-DD, inclusive quando existem datas de anos diferentes.

## Verificação

- node --test tests/waiting-preferences.test.mjs tests/schedule-blocks.test.mjs
- tests/admin-features.mjs com servidor isolado e HTTP/Realtime simulados conforme ADMIN_FEATURES.md.
- npm run build

Cenários: múltiplas seleções, desmarcação, meses diferentes, datas passadas, ordenação, requisitos
mínimos, uma linha por cliente, duplicidade, recarga, Realtime simulado, valores antigos/parciais,
preferências visíveis, ausência de escolha automática, bloqueios/ocupação, falha/cancelamento,
sucesso e remoção. Layout verificado em 375, 390, 430 e 1280 px com seis datas e vários horários.
Os testes automatizados não aplicam SQL nem escrevem em produção. A entrega de eventos Realtime
reais não é verificada por essa suíte.
