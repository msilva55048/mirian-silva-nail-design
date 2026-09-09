# Worker WhatsApp no Windows

A tarefa `Mirian WhatsApp Worker` inicia `start-worker-windows.cmd` no login do Windows. O script usa o Node instalado em `C:\Program Files\nodejs`, trabalha em `frontend` e carrega somente `worker/.env`. A sessão do Chrome é exclusivamente `worker/.session-worker`.

## Operação

- Verificar: Task Scheduler → `Mirian WhatsApp Worker` ou `worker/logs/worker.log`.
- Parar: Task Scheduler → tarefa → **End**.
- Iniciar: Task Scheduler → tarefa → **Run**.
- Reiniciar: **End**, aguardar o processo Node e o Chrome fecharem, depois **Run**.

O worker mantém `worker/.worker.lock` e `worker/.worker.pid` durante a execução. Uma segunda instância encerra sem abrir outro Chrome; locks obsoletos são removidos com segurança. Esses arquivos, o perfil persistente e os logs são locais e não devem ser versionados.

O log registra inicialização, sessão carregada, polling, processamento confirmado, falhas e encerramento. Não registra secrets, cookies ou tokens.
