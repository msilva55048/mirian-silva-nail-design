import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function MonthAgendaView() {
    const {
        addMonthsToAgendaMonth,
        formatAdminDate,
        formatDateForInput,
        isLoading,
        monthlyAgendaAppointments,
        monthlyAgendaDates,
        monthlyAgendaMonthLabel,
        renderAppointmentCard,
        setMonthlyAgendaMonth,
    } = useAdminPanelContext();

    return (
                    <section className="admin-month-agenda">
                        <div className="admin-month-agenda__header">
                            <div>
                                <span>Agenda mensal</span>
                                <strong>{monthlyAgendaMonthLabel}</strong>
                            </div>

                            <div className="admin-month-agenda__nav">
                                <button
                                    type="button"
                                    aria-label="Mês anterior"
                                    onClick={() =>
                                        setMonthlyAgendaMonth((current) =>
                                            addMonthsToAgendaMonth(current, -1),
                                        )
                                    }
                                >
                                    ←
                                </button>

                                <button
                                    className="admin-month-agenda__today"
                                    type="button"
                                    onClick={() =>
                                        setMonthlyAgendaMonth(
                                            formatDateForInput(new Date()).slice(0, 7),
                                        )
                                    }
                                >
                                    Mês atual
                                </button>

                                <button
                                    type="button"
                                    aria-label="Próximo mês"
                                    onClick={() =>
                                        setMonthlyAgendaMonth((current) =>
                                            addMonthsToAgendaMonth(current, 1),
                                        )
                                    }
                                >
                                    →
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="admin-loading">Carregando...</div>
                        ) : monthlyAgendaDates.length ? (
                            <div className="admin-month-agenda__days">
                                {monthlyAgendaDates.map((date) => (
                                    <section className="admin-month-agenda__day" key={date}>
                                        <div className="admin-month-agenda__day-header">
                                            <strong>{formatAdminDate(date)}</strong>
                                        </div>

                                        <div className="admin-card-list">
                                            {monthlyAgendaAppointments
                                                .filter(
                                                    (appointment) =>
                                                        appointment.appointment_date === date,
                                                )
                                                .map(renderAppointmentCard)}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="admin-empty">
                                Nenhum agendamento ativo neste mês.
                            </div>
                        )}
                    </section>
                );
}
