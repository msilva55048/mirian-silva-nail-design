type Block = {block_date: string; start_time: string; end_time: string};

// UTC é usado somente como escala de comparação de data/hora civil, sem depender
// do fuso do aparelho. Equivale aos timestamps sem fuso usados pela RPC.
function civilTime(date: string, time: string) {
    return Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
}

export function hasScheduleBlockConflict(
    blocks: Block[], date: string, time: string, durationMinutes: number,
) {
    const start = civilTime(date, time);
    const end = start + Math.max(1, Number(durationMinutes) || 1) * 60_000;
    return blocks.some((block) => {
        const blockStart = civilTime(block.block_date, block.start_time);
        let blockEnd = civilTime(block.block_date, block.end_time);
        if (blockEnd < blockStart) blockEnd += 86_400_000;
        // Intervalos [início, fim): terminar exatamente no início do bloqueio é permitido.
        return blockEnd > blockStart && start < blockEnd && end > blockStart;
    });
}
