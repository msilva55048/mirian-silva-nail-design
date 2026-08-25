import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function NewAppointmentView() {
    const {
        adminServices,
        createManualAppointment,
        filteredManualBookingClients,
        formatAdminDate,
        formatCurrency,
        formatDateForInput,
        getManualMonthCalendarCells,
        isSavingManualAppointment,
        manualAvailableTimes,
        manualCalendarMonth,
        manualClientSearch,
        manualDate,
        manualError,
        manualSelectedService,
        manualServiceName,
        manualSuccess,
        manualTime,
        manualVisibleWeekDates,
        manualWeekReferenceDate,
        moveManualBookingWeek,
        openManualMonthCalendar,
        selectManualBookingDate,
        selectedManualClient,
        setManualCalendarMonth,
        setManualClientSearch,
        setManualError,
        setManualServiceName,
        setManualSuccess,
        setManualTime,
        setSelectedManualClient,
        setShowManualForm,
        showManualForm,
        showManualMonthCalendar,
    } = useAdminPanelContext();

    return (
                    <section className="admin-content-section">
                        <section className="admin-new-appointment">
                            <div className="admin-new-appointment__header">
                                <div>
                                    <h2>Novo agendamento</h2>
                                    <p>Busque a cliente cadastrada e escolha serviço, dia e horário no mesmo padrão do agendamento da cliente.</p>
                                </div>
                                <button
                                    className="admin-new-appointment__toggle"
                                    type="button"
                                    onClick={() => {
                                        setShowManualForm((current) => !current);
                                        setManualError("");
                                        setManualSuccess("");
                                    }}
                                >
                                    {showManualForm ? "Fechar" : "+ Adicionar"}
                                </button>
                            </div>

                            {showManualForm && (
                                <form className="admin-manual-booking" onSubmit={createManualAppointment}>
                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">1</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Buscar cliente</h3>
                                            <p>Digite o nome ou telefone e selecione uma cliente cadastrada.</p>

                                            <div className="admin-client-picker">
                                                <input
                                                    value={manualClientSearch}
                                                    onChange={(event) => {
                                                        setManualClientSearch(event.target.value);
                                                        setSelectedManualClient(null);
                                                        setManualError("");
                                                    }}
                                                    placeholder="Buscar por nome ou telefone"
                                                    autoComplete="off"
                                                />

                                                {manualClientSearch.trim() && !selectedManualClient && (
                                                    <div className="admin-client-picker__results">
                                                        {filteredManualBookingClients.length ? (
                                                            filteredManualBookingClients.map((client) => (
                                                                <button
                                                                    type="button"
                                                                    key={client.key}
                                                                    onClick={() => {
                                                                        setSelectedManualClient(client);
                                                                        setManualClientSearch(client.name);
                                                                        setManualError("");
                                                                    }}
                                                                >
                                                                    <span className="admin-client-picker__avatar">
                                                                        {client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                                                                    </span>
                                                                    <span>
                                                                        <strong>{client.name}</strong>
                                                                        <small>{client.phone}{client.email ? ` • ${client.email}` : ""}</small>
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="admin-client-picker__empty">Nenhuma cliente encontrada.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {selectedManualClient && (
                                                <div className="admin-selected-client">
                                                    <div>
                                                        <span>Cliente selecionada</span>
                                                        <strong>{selectedManualClient.name}</strong>
                                                        <small>{selectedManualClient.phone}{selectedManualClient.email ? ` • ${selectedManualClient.email}` : ""}</small>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedManualClient(null);
                                                            setManualClientSearch("");
                                                        }}
                                                    >
                                                        Trocar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">2</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Serviço</h3>
                                            <select
                                                className="admin-manual-booking__service"
                                                value={manualServiceName}
                                                onChange={(event) => {
                                                    setManualServiceName(event.target.value);
                                                    setManualTime("");
                                                    setManualError("");
                                                }}
                                            >
                                                {adminServices.map((service) => (
                                                    <option key={service.id} value={service.name}>
                                                        {service.name} — {service.duration_minutes} min — {formatCurrency(service.price_cents)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">3</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Dia</h3>

                                            <div className="admin-manual-week-picker">
                                                <div className="admin-manual-week-picker__top">
                                                    <div className="admin-manual-week-picker__month">
                                                        <button type="button" onClick={openManualMonthCalendar}>📅</button>
                                                        <strong>
                                                            {new Date(`${manualWeekReferenceDate}T12:00:00`).toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}
                                                        </strong>
                                                    </div>

                                                    <div className="admin-manual-week-picker__navs">
                                                        <button type="button" onClick={() => moveManualBookingWeek(-1)}>‹</button>
                                                        <button type="button" onClick={() => moveManualBookingWeek(1)}>›</button>
                                                    </div>
                                                </div>

                                                <div className="admin-manual-week-days">
                                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                                        {manualVisibleWeekDates.slice(0, 4).map((date) => {
                                                            const parsed = new Date(`${date}T12:00:00`);
                                                            const isPast = date < formatDateForInput(new Date());
                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    className={`admin-manual-week-day${manualDate === date ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                    onClick={() => selectManualBookingDate(date)}
                                                                >
                                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                                    <strong>{String(parsed.getDate()).padStart(2, "0")}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                                        {manualVisibleWeekDates.slice(4).map((date) => {
                                                            const parsed = new Date(`${date}T12:00:00`);
                                                            const isPast = date < formatDateForInput(new Date());
                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    className={`admin-manual-week-day${manualDate === date ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                    onClick={() => selectManualBookingDate(date)}
                                                                >
                                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                                    <strong>{String(parsed.getDate()).padStart(2, "0")}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {showManualMonthCalendar && (
                                                    <div className="admin-manual-month-calendar">
                                                        <div className="admin-manual-month-calendar__header">
                                                            <button type="button" onClick={() => setManualCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
                                                            <strong>{manualCalendarMonth.toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}</strong>
                                                            <button type="button" onClick={() => setManualCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
                                                        </div>

                                                        <div className="admin-manual-month-calendar__weekdays">
                                                            {['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map((day) => <span key={day}>{day}</span>)}
                                                        </div>

                                                        <div className="admin-manual-month-calendar__grid">
                                                            {getManualMonthCalendarCells().map((date, index) => {
                                                                if (!date) return <span className="is-empty" key={`empty-${index}`}/>;
                                                                const isPast = date < formatDateForInput(new Date());
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={date}
                                                                        disabled={isPast}
                                                                        className={`${manualDate === date ? "is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                        onClick={() => selectManualBookingDate(date)}
                                                                    >
                                                                        {new Date(`${date}T12:00:00`).getDate()}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">4</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Horário disponível</h3>
                                            <p>{manualSelectedService ? `Duração do serviço: ${manualSelectedService.duration_minutes} min.` : ""}</p>

                                            <div className="admin-manual-times">
                                                {manualAvailableTimes.map((time) => (
                                                    <button
                                                        key={time}
                                                        type="button"
                                                        className={manualTime === time ? "is-selected" : ""}
                                                        onClick={() => {
                                                            setManualTime(time);
                                                            setManualError("");
                                                        }}
                                                    >
                                                        {time}
                                                    </button>
                                                ))}
                                            </div>

                                            {!manualAvailableTimes.length && (
                                                <div className="admin-manual-times__empty">Nenhum horário disponível para este serviço neste dia.</div>
                                            )}
                                        </div>
                                    </section>

                                    <div className="admin-manual-booking__summary">
                                        <div><span>Cliente</span><strong>{selectedManualClient?.name || "Selecione a cliente"}</strong></div>
                                        <div><span>Serviço</span><strong>{manualServiceName || "Selecione o serviço"}</strong></div>
                                        <div><span>Data</span><strong>{manualDate ? formatAdminDate(manualDate) : "Selecione o dia"}</strong></div>
                                        <div><span>Horário</span><strong>{manualTime || "Selecione o horário"}</strong></div>
                                    </div>

                                    <div className="admin-manual-booking__actions">
                                        <button
                                            className="admin-manual-form__save"
                                            type="submit"
                                            disabled={isSavingManualAppointment || !selectedManualClient || !manualTime}
                                        >
                                            {isSavingManualAppointment ? "Criando..." : "Salvar agendamento"}
                                        </button>
                                        <button
                                            className="admin-manual-form__cancel"
                                            type="button"
                                            onClick={() => setShowManualForm(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>

                                    {manualError && <p className="admin-manual-form__error">{manualError}</p>}
                                    {manualSuccess && <p className="admin-manual-form__success">{manualSuccess}</p>}
                                </form>
                            )}
                        </section>

                        
                    </section>
                );
}
