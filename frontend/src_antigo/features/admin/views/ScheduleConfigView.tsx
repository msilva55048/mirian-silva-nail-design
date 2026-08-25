import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function ScheduleConfigView() {
    const {
        addScheduleConfigTime,
        beginEditScheduleConfigTime,
        formatDateForInput,
        isSavingScheduleConfig,
        moveScheduleConfigWeek,
        removeScheduleConfigTime,
        saveEditedScheduleConfigTime,
        scheduleConfigDate,
        scheduleConfigEditedTime,
        scheduleConfigEditingTime,
        scheduleConfigError,
        scheduleConfigNewTime,
        scheduleConfigSuccess,
        scheduleConfigTimes,
        scheduleConfigVisibleWeekDates,
        selectScheduleConfigDate,
        setScheduleConfigEditedTime,
        setScheduleConfigEditingTime,
        setScheduleConfigError,
        setScheduleConfigNewTime,
    } = useAdminPanelContext();

    return (
                    <section className="admin-settings admin-service-manager">
                        <div className="admin-settings__intro">
                            <div>
                                <span className="admin-settings__eyebrow">Configurações do site</span>
                                <h2>Configuração de horários</h2>
                                <p>Adicione, altere ou exclua horários somente na data escolhida.</p>
                            </div>
                        </div>

                        <section className="admin-service-form-card admin-schedule-config-card">
                            <div className="admin-service-form-card__heading">
                                <div>
                                    <span>CONFIGURAÇÃO DE HORÁRIOS</span>
                                    <h3>Horários de uma data específica</h3>
                                    <p>
                                        Selecione o dia abaixo. Depois adicione um novo horário ou toque em um horário disponível para alterar ou excluir somente nessa data.
                                    </p>
                                </div>
                            </div>

                            <div className="admin-manual-week-picker admin-schedule-config-panel">
                                <div className="admin-manual-week-picker__top">
                                    <div className="admin-manual-week-picker__month">
                                        <strong>
                                            {new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </strong>
                                    </div>

                                    <div className="admin-manual-week-picker__navs">
                                        <button
                                            type="button"
                                            aria-label="Semana anterior"
                                            onClick={() => moveScheduleConfigWeek(-1)}
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Próxima semana"
                                            onClick={() => moveScheduleConfigWeek(1)}
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-manual-week-days">
                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                        {scheduleConfigVisibleWeekDates.slice(0, 4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === scheduleConfigDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectScheduleConfigDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                        {scheduleConfigVisibleWeekDates.slice(4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === scheduleConfigDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectScheduleConfigDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <section className="admin-manual-booking__section admin-schedule-config-manual-section">
                                <span className="admin-manual-booking__step">4</span>

                                <div className="admin-manual-booking__content">
                                    <h3>Horário disponível</h3>
                                    <p>
                                        Adicione um novo horário abaixo. Depois ele entra automaticamente na lista de horários disponíveis dessa data.
                                    </p>

                                    <div className="admin-schedule-config-add-inline">
                                        <label>
                                            <span>ADD NOVO HORÁRIO</span>
                                            <input
                                                type="time"
                                                value={scheduleConfigNewTime}
                                                onChange={(event) => setScheduleConfigNewTime(event.target.value)}
                                            />
                                        </label>

                                        <button
                                            type="button"
                                            disabled={isSavingScheduleConfig || !scheduleConfigNewTime}
                                            onClick={() => void addScheduleConfigTime()}
                                        >
                                            {isSavingScheduleConfig ? "Salvando..." : "Salvar horário"}
                                        </button>
                                    </div>

                                    {scheduleConfigError && (
                                        <p className="admin-settings__message admin-settings__message--error">
                                            {scheduleConfigError}
                                        </p>
                                    )}

                                    {scheduleConfigSuccess && (
                                        <p className="admin-settings__message admin-settings__message--success">
                                            {scheduleConfigSuccess}
                                        </p>
                                    )}

                                    <div className="admin-schedule-config-current-date">
                                        <span>DATA SELECIONADA</span>
                                        <strong>
                                            {new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR", {
                                                weekday: "short",
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            })}
                                        </strong>
                                    </div>

                                    {scheduleConfigTimes.length ? (
                                        <div className="admin-manual-times admin-schedule-config-times-grid">
                                            {scheduleConfigTimes.map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    className={scheduleConfigEditingTime === time ? "is-selected" : ""}
                                                    onClick={() => beginEditScheduleConfigTime(time)}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="admin-manual-times__empty">
                                            Nenhum horário disponível nessa data.
                                        </div>
                                    )}

                                    {scheduleConfigEditingTime && (
                                        <div className="admin-schedule-config-editor">
                                            <div className="admin-schedule-config-editor__header">
                                                <span>HORÁRIO SELECIONADO</span>
                                                <strong>{scheduleConfigEditingTime}</strong>
                                            </div>

                                            <div className="admin-schedule-config-editor__actions">
                                                <label>
                                                    <span>NOVO HORÁRIO</span>
                                                    <input
                                                        type="time"
                                                        value={scheduleConfigEditedTime}
                                                        onChange={(event) => setScheduleConfigEditedTime(event.target.value)}
                                                    />
                                                </label>

                                                <button
                                                    type="button"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => void saveEditedScheduleConfigTime()}
                                                >
                                                    Salvar alteração
                                                </button>

                                                <button
                                                    type="button"
                                                    className="is-danger"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => void removeScheduleConfigTime(scheduleConfigEditingTime)}
                                                >
                                                    Excluir horário
                                                </button>

                                                <button
                                                    type="button"
                                                    className="is-secondary"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => {
                                                        setScheduleConfigEditingTime(null);
                                                        setScheduleConfigEditedTime("");
                                                        setScheduleConfigError("");
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </section>
                    </section>
                );
}
