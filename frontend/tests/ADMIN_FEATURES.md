# Filtros de clientes e Lista de espera

## Implementação

- Entrada ativa: `src/main.tsx` → `src/App.tsx`. A versão separada de `AdminPanel.tsx` não é usada e foi preservada.
- `src/App.tsx`: botões entre contador e busca, card Lista de espera logo após Novo agendamento, formulário compartilhado e limpeza após sucesso.
- `src/features/admin/clientFilters.ts`: `pending` e `confirmed` com término posterior ao relógio do painel, incluindo atendimentos em andamento. Exclui cancelados, concluídos, ausências e registros passados. Mantém busca existente por prefixo do nome ou trecho do telefone e ordem pt-BR A–Z. Clicar novamente no filtro selecionado volta a todas as clientes.
- `src/features/admin/WaitingList.tsx`: busca somente em perfis cadastrados, inclusão, FIFO, remoção com confirmação e ação Agendar com cliente preenchida.
- `src/features/admin/useWaitingList.ts`: persistência Supabase, tratamento de erro, atualização após operações, Realtime e recuperação por foco/visibilidade/consulta a cada 30 segundos. Leituras antigas não sobrescrevem uma remoção confirmada.
- `src/features/admin/waitingList.css`: estilos restritos às adições, reutilizando classes atuais.
- `src/features/admin/scheduleBlockConflicts.ts`: regra compartilhada de sobreposição com `schedule_blocks`, utilizada no cálculo de horários, na seleção exibida e na validação antes de salvar.

O formulário é o próprio Novo agendamento, no mesmo componente e com a mesma RPC `admin_create_client_appointment`. Não existe uma segunda implementação de disponibilidade. Cancelar não escreve no banco. A entrada é excluída pelo seu ID somente depois de a RPC retornar um agendamento com ID. Se a exclusão falhar, o formulário fecha e a mensagem informa que o agendamento já foi criado e que se deve apenas remover a entrada manualmente.

## Migration aplicada em produção

`supabase/migrations/20260903000000_admin_waiting_list.sql`

- Tabela `public.waiting_list`: `id uuid`, `client_id uuid`, `created_at timestamptz`.
- Chave primária `id`; chave estrangeira para `client_profiles(id)` com cascade ao excluir o perfil; unicidade de `client_id`; índice de ordenação `(created_at, id)`.
- RLS habilitada. Policies administrativas específicas para SELECT, INSERT e DELETE. Nenhum UPDATE concedido e nenhum acesso anônimo.
- As três policies usam `public.is_admin()`, a mesma autorização da RPC administrativa existente. Não se cria outra função de identificação do Admin nem dependência da configuração de Web Push.
- Publicação em `supabase_realtime`, quando disponível; consultas periódicas recuperam alterações mesmo sem Realtime.
- Acrescenta uma guarda contra `schedule_blocks` à RPC `admin_create_client_appointment`, antes de procurar/alterar/criar o perfil da cliente. Nenhuma policy existente é alterada.

A migration foi aplicada manualmente em produção em 03/09/2026. Foram confirmados waiting_list, colunas, constraints, índice, RLS, policies administrativas, Realtime e a proteção completa da RPC contra schedule_blocks. Consulte supabase/review/20260903-application-report.md. Não executar novamente em produção.

### Proteção aplicada à RPC

O SQL recupera a definição da assinatura exata já existente via `pg_get_functiondef` e insere apenas a guarda na posição revisada, após validar o serviço e antes de escrever dados da cliente. Preserva o restante do corpo, argumentos, defaults, retorno, SECURITY DEFINER, search_path, owner e permissões. Verifica assinatura e posição da inserção; se a definição divergir, interrompe toda a migration para revisão, sem aplicar parcialmente.

A guarda utiliza a duração real `v_service.duration_minutes`, não a duração enviada pelo navegador. Compara o intervalo do atendimento com cada bloqueio por data/hora completas: início do atendimento < fim do bloqueio E fim do atendimento > início do bloqueio. Considera sobreposições parciais, períodos contidos e passagem pela meia-noite. Encostar no limite não é conflito; intervalos de bloqueio vazios não bloqueiam.

Um lock SHARE em `schedule_blocks` impede alterações concorrentes nessa tabela entre a verificação e o término da transação do agendamento. Leituras continuam permitidas. O custo é serializar temporariamente gravações de bloqueios enquanto a RPC termina; revisar também esse comportamento em homologação. Uma exceção `P0001` informa claramente o conflito e aborta a chamada, sem criar agendamento ou modificar parcialmente o perfil. Não se alteram triggers, notificações, indicações ou regras de conflito entre agendamentos.

A lógica SQL aplicada foi preservada e sua definição foi validada em produção por consultas somente de leitura.

## Validação executada

- `npm run build`: passou; aviso existente de bundle maior que 500 kB.
- ESLint na nova regra de bloqueios: passou.
- Comparação de ESLint de `App.tsx` com HEAD: mesmos 5 erros e 9 warnings anteriores, sem novos diagnósticos. O lint global permanece com problemas preexistentes fora do escopo.
- `git diff --check`: passou.
- `tests/admin-features.mjs`: navegador Edge headless, com todas as chamadas externas interceptadas, sem acesso ao Supabase real.

Casos aprovados no navegador:

1. Ativos `pending`/`confirmed`, sem agendamento, cancelados, concluídos, ausência, histórico vencido, cliente com múltiplos agendamentos sem duplicação, A–Z, busca por nome/telefone dentro do filtro e nenhuma consulta causada pelo filtro.
2. Inclusão, rejeição de duplicidade pelo backend simulado, persistência após recarregar, ordem de entrada, remoção manual sem apagar perfil.
3. Agendar com cliente preenchida e bloqueada para troca, cancelamento sem criação/remoção, seleção de serviço e data, duração enviada à RPC, horários ocupados indisponíveis e igualdade de horários com Novo agendamento.
4. Falha da RPC mantém a cliente; sucesso cria antes de remover; falha da remoção mantém a entrada e orienta a não reagendar.
5. Layout em 375, 390, 430 e 1280 px: sem overflow horizontal ou controles novos fora da tela. Inspeção visual do formulário mobile. Capturas locais em `node_modules/.cache/admin-features/`.
6. Bloqueio completo, parcial, duração que invade bloqueio, horários nos limites, duração menor que volta a caber, agendamento existente e igualdade de disponibilidade entre Novo Agendamento e Lista de espera.
7. Um horário previamente selecionado deixa de aparecer ao criar um bloqueio pelo painel simulado; tentar salvá-lo é recusado antes da RPC. Trocar para um serviço mais longo também invalida uma seleção que invadiria o bloqueio.

`node --test tests/schedule-blocks.test.mjs`: 15 testes aprovados (14 casos de intervalos e 1 inspeção estrutural da migration). Inclui datas diferentes, múltiplos bloqueios, precisão de segundos e passagem pela meia-noite. Não executa SQL.

Para repetir com Playwright disponível, use um servidor de teste isolado. No PowerShell, na pasta `frontend`, primeiro:

```powershell
$env:VITE_SUPABASE_URL='https://mock.supabase.test'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='mock-test-only'
npm run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

Em outro terminal:

```powershell
$env:ADMIN_TEST_URL='http://127.0.0.1:5190'
$env:ADMIN_TEST_SUPABASE_URL='https://mock.supabase.test'
node tests/admin-features.mjs [caminho/para/playwright/index.mjs]
```

As variáveis acima valem apenas para os respectivos processos/terminais; nenhum `.env` é alterado. O navegador intercepta as chamadas externas, bloqueia WebSockets e service workers. O teste não usa o Supabase real.

## Situação atual e alcance da validação

O bug de bloqueios foi corrigido localmente: `manualAvailableTimes` considera os bloqueios e recalcula quando mudam; `manualDisplayedTimes` não reinsere uma seleção bloqueada; `manualAppointmentConflicts` recusa o período antes da RPC. Novo Agendamento e Lista de espera continuam usando o mesmo formulário. A proteção no banco já está aplicada e validada em produção.

Os testes locais foram aprovados. A validação estrutural confirmou os requisitos em produção. Os testes simulados não equivalem a testes de concorrência e de permissões com diferentes contas no banco real. Não foram criados registros fictícios para validar a publicação.

Os arquivos locais de supabase/.temp/ ficam fora do versionamento.
