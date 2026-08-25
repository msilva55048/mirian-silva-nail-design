import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function BlocksView() {
    const {
        adminBlocks,
        blockAvailableTimes,
        blockDate,
        blockError,
        blockReason,
        blockVisibleWeekDates,
        blockWeekMonthLabel,
        deleteScheduleBlock,
        formatDateForInput,
        isSavingBlock,
        moveBlockWeek,
        saveSelectedBlocks,
        selectBlockDate,
        selectedBlockTimes,
        setBlockReason,
        setSelectedBlockTimes,
    } = useAdminPanelContext();

    return (
                    <section className="admin-content-section">
                        <section className="admin-block-manager admin-block-manager--bottom">
                            <div className="admin-block-manager__header">
                                <div>
                                    <h2>Bloquear horários</h2>
                                    <p>Escolha um dia da semana e marque vários horários livres de uma só vez.</p>
                                </div>
                            </div>

                            <div className="admin-manual-week-picker">
                                <div className="admin-manual-week-picker__top">
                                    <div className="admin-manual-week-picker__month">
                                        <strong style={{textTransform: "capitalize"}}>{blockWeekMonthLabel}</strong>
                                    </div>

                                    <div className="admin-manual-week-picker__navs">
                                        <button
                                            type="button"
                                            aria-label="Semana anterior"
                                            onClick={() => moveBlockWeek(-1)}
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Próxima semana"
                                            onClick={() => moveBlockWeek(1)}
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-manual-week-days">
                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                        {blockVisibleWeekDates.slice(0, 4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === blockDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectBlockDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                        {blockVisibleWeekDates.slice(4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === blockDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectBlockDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="admin-block-date-row">
                                <div>
                                    <strong>
                                        Horários livres em {new Date(`${blockDate}T12:00:00`).toLocaleDateString("pt-BR")}
                                    </strong>
                                    <p>Toque nos horários que deseja bloquear. Cada card representa 30 minutos.</p>
                                </div>
                                <div>
                                    <strong>{selectedBlockTimes.length} horário(s) selecionado(s)</strong>
                                </div>
                            </div>

                            <div className="admin-block-times">
                                {blockAvailableTimes.map((time) => (
                                    <button
                                        key={time}
                                        className={`admin-block-time${selectedBlockTimes.includes(time) ? " is-selected" : ""}`}
                                        type="button"
                                        onClick={() =>
                                            setSelectedBlockTimes((current) =>
                                                current.includes(time)
                                                    ? current.filter((item) => item !== time)
                                                    : [...current, time],
                                            )
                                        }
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>

                            {!blockAvailableTimes.length && (
                                <div className="admin-empty">Não há horários livres nesta data.</div>
                            )}

                            <div className="admin-block-submit-row">
                                <input
                                    value={blockReason}
                                    onChange={(event) => setBlockReason(event.target.value)}
                                    placeholder="Motivo opcional"
                                />
                                <button
                                    type="button"
                                    disabled={isSavingBlock || !selectedBlockTimes.length}
                                    onClick={() => void saveSelectedBlocks()}
                                >
                                    {isSavingBlock ? "Bloqueando..." : "Bloquear selecionados"}
                                </button>
                            </div>

                            {blockError && <p className="admin-block-error">{blockError}</p>}

                            <div className="admin-block-list">
                                {adminBlocks
                                    .filter((item) => item.block_date === blockDate)
                                    .map((block) => (
                                        <div className="admin-block-item" key={block.id}>
                                            <div>
                                                <strong>
                                                    {String(block.start_time).slice(0, 5)}–{String(block.end_time).slice(0, 5)}
                                                </strong>
                                                <span>{block.reason || "Horário bloqueado"}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void deleteScheduleBlock(block.id)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    </section>
                );
}
