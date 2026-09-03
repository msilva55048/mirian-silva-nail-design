# Aplicação em produção — 20260903000000

Executada uma única vez em 03/09/2026, aproximadamente 17:36 (America/Sao_Paulo), pelo SQL Editor do projeto gnayogtvonxzbmtpabbc.
Resultado: Success. No rows returned. Nenhum warning ou erro SQL exibido.
Lógica da migration preservada; comentário atualizado para registrar a aplicação em produção.

## Validação somente de leitura

- waiting_list: id uuid NOT NULL DEFAULT gen_random_uuid(), client_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now().
- PK id; FK client_id -> client_profiles(id) ON DELETE CASCADE; UNIQUE(client_id).
- Índice waiting_list_created_at_idx em (created_at, id).
- RLS habilitada. Exatamente três policies: waiting_list_admin_select, waiting_list_admin_insert, waiting_list_admin_delete, todas authenticated e condicionadas a is_admin(). Sem policy pública ou de cliente comum.
- ACL: authenticated SELECT/INSERT/DELETE; anon sem privilégios; postgres e service_role mantêm privilégios administrativos.
- Realtime: waiting_list adicionada; schedule_time_overrides preservada com mesmas colunas e sem filtro.
- Definição completa da RPC comparada antes/depois: única diferença é o guard exato previsto na migration (normalização de quebras de linha na comparação).
- Assinatura, defaults, retorno, owner, ACL e search_path preservados.
- Guard usa v_service.duration_minutes, verifica sobreposição e lança P0001 antes das gravações, com mensagem clara.
- Fingerprints de todos os triggers públicos não internos, demais funções públicas, policies de outros recursos, colunas e constraints de schedule_blocks/schedule_time_overrides permaneceram idênticos.
- MD5 prosrc RPC: antes 00c8ec7af867cb045f077b6185e30613; depois b917b87da7ba90ae39df02e371b32239.

Snapshot temporário da definição anterior removido após revisão; os fingerprints acima registram a comparação realizada.
Não houve chamada funcional da RPC nem teste com gravações. Nenhum cliente, agendamento ou registro de espera foi inserido, modificado ou removido por esta execução.
Nenhum commit, push ou deploy.
