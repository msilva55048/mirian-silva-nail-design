import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function AgendaWeekView() {
    const {
        addDaysToInputDate,
        adminView,
        agendaAppointments,
        agendaCalendarMonth,
        agendaDate,
        agendaPickerMonthLabel,
        agendaVisibleWeekDates,
        formatAdminDate,
        formatDateForInput,
        getAgendaMonthCalendarCells,
        isLoading,
        moveAgendaPickerWeek,
        openAgendaMonthCalendar,
        renderAppointmentCard,
        selectAgendaPickerDate,
        setAgendaCalendarMonth,
        setAgendaDate,
        setAgendaWeekReferenceDate,
        setShowAgendaDatePicker,
        setShowAgendaMonthCalendar,
        showAgendaDatePicker,
        showAgendaMonthCalendar,
        weekDates,
        weeklyAppointments,
    } = useAdminPanelContext();

    return (
                    <section className="admin-top-agenda">
                        <div className="admin-top-agenda__header">
                            <div>
                                <span>{adminView === "agenda" ? "Atendimentos do dia" : "Atendimentos da semana"}</span>
                                <strong>
                                    {adminView === "agenda"
                                        ? formatAdminDate(agendaDate)
                                        : `${formatAdminDate(weekDates[0])} até ${formatAdminDate(weekDates[6])}`}
                                </strong>
                            </div>
                            <div className="admin-section-date-controls admin-section-date-controls--agenda">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextDate = addDaysToInputDate(
                                            agendaDate,
                                            adminView === "week" ? -7 : -1,
                                        );
                                        setAgendaDate(nextDate);
                                        setAgendaWeekReferenceDate(nextDate);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    ←
                                </button>

                                <div className="admin-agenda-date-picker">
                                    <button
                                        type="button"
                                        className={`admin-agenda-date-picker__trigger${
                                            showAgendaDatePicker ? " is-open" : ""
                                        }`}
                                        onClick={() =>
                                            setShowAgendaDatePicker((current) => {
                                                const nextValue = !current;

                                                if (nextValue) {
                                                    setAgendaWeekReferenceDate(agendaDate);
                                                    setShowAgendaMonthCalendar(false);
                                                }

                                                return nextValue;
                                            })
                                        }
                                    >
                                        <span className="admin-agenda-date-picker__trigger-text">
                                            <small>
                                                {adminView === "agenda"
                                                    ? "Data selecionada"
                                                    : "Semana selecionada"}
                                            </small>
                                            <strong>
                                                {adminView === "agenda"
                                                    ? formatAdminDate(agendaDate)
                                                    : `${formatAdminDate(
                                                          weekDates[0],
                                                      )} até ${formatAdminDate(
                                                          weekDates[6],
                                                      )}`}
                                            </strong>
                                        </span>

                                        <span className="admin-agenda-date-picker__chevron">
                                            {showAgendaDatePicker ? "⌃" : "⌄"}
                                        </span>
                                    </button>

                                    {showAgendaDatePicker && (
                                        <div className="admin-agenda-date-picker__panel">
                                            <div className="admin-agenda-date-picker__panel-header">
                                                <div className="admin-agenda-date-picker__month">
                                                    <strong>{agendaPickerMonthLabel}</strong>

                                                    <button
                                                        type="button"
                                                        onClick={openAgendaMonthCalendar}
                                                        aria-label="Abrir calendário do mês"
                                                    >
                                                        📅
                                                    </button>
                                                </div>

                                                <div className="admin-agenda-date-picker__panel-navs">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveAgendaPickerWeek(-1)}
                                                        aria-label="Semana anterior"
                                                    >
                                                        ‹
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveAgendaPickerWeek(1)}
                                                        aria-label="Próxima semana"
                                                    >
                                                        ›
                                                    </button>
                                                </div>
                                            </div>

                                            {showAgendaMonthCalendar && (
                                                <div className="client-month-calendar">
                                                    <div className="client-month-calendar__header">
                                                        <button
                                                            className="client-week-picker__nav"
                                                            type="button"
                                                            onClick={() =>
                                                                setAgendaCalendarMonth(
                                                                    (current) =>
                                                                        new Date(
                                                                            current.getFullYear(),
                                                                            current.getMonth() - 1,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            aria-label="Mês anterior"
                                                        >
                                                            ‹
                                                        </button>
                                                        <strong>
                                                            {agendaCalendarMonth.toLocaleDateString(
                                                                "pt-BR",
                                                                {
                                                                    month: "long",
                                                                    year: "numeric",
                                                                },
                                                            )}
                                                        </strong>
                                                        <button
                                                            className="client-week-picker__nav"
                                                            type="button"
                                                            onClick={() =>
                                                                setAgendaCalendarMonth(
                                                                    (current) =>
                                                                        new Date(
                                                                            current.getFullYear(),
                                                                            current.getMonth() + 1,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            aria-label="Próximo mês"
                                                        >
                                                            ›
                                                        </button>
                                                    </div>

                                                    <div className="client-month-calendar__weekdays">
                                                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                                                            <span key={day}>{day}</span>
                                                        ))}
                                                    </div>

                                                    <div className="client-month-calendar__grid">
                                                        {getAgendaMonthCalendarCells().map(
                                                            (date, index) => {
                                                                if (!date) {
                                                                    return (
                                                                        <span
                                                                            className="client-month-calendar__day is-empty"
                                                                            key={`agenda-empty-${index}`}
                                                                        />
                                                                    );
                                                                }

                                                                return (
                                                                    <button
                                                                        key={date}
                                                                        type="button"
                                                                        className={[
                                                                            "client-month-calendar__day",
                                                                            date === agendaDate
                                                                                ? "is-selected"
                                                                                : "",
                                                                        ]
                                                                            .filter(Boolean)
                                                                            .join(" ")}
                                                                        onClick={() =>
                                                                            selectAgendaPickerDate(
                                                                                date,
                                                                            )
                                                                        }
                                                                    >
                                                                        {new Date(
                                                                            `${date}T12:00:00`,
                                                                        ).getDate()}
                                                                    </button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="client-week-days admin-agenda-date-picker__week-days">
                                                {[
                                                    {
                                                        dates: agendaVisibleWeekDates.slice(
                                                            0,
                                                            4,
                                                        ),
                                                        rowClass:
                                                            "client-week-days__row--four",
                                                    },
                                                    {
                                                        dates: agendaVisibleWeekDates.slice(
                                                            4,
                                                            7,
                                                        ),
                                                        rowClass:
                                                            "client-week-days__row--three",
                                                    },
                                                ].map((row, rowIndex) => (
                                                    <div
                                                        className={`client-week-days__row ${row.rowClass}`}
                                                        key={`agenda-week-row-${rowIndex}`}
                                                    >
                                                        {row.dates.map((date) => {
                                                            const parsed = new Date(
                                                                `${date}T12:00:00`,
                                                            );

                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    className={[
                                                                        "client-week-day",
                                                                        date === agendaDate
                                                                            ? "is-selected"
                                                                            : "",
                                                                    ]
                                                                        .filter(Boolean)
                                                                        .join(" ")}
                                                                    onClick={() =>
                                                                        selectAgendaPickerDate(
                                                                            date,
                                                                        )
                                                                    }
                                                                >
                                                                    <span>
                                                                        {parsed
                                                                            .toLocaleDateString(
                                                                                "pt-BR",
                                                                                {
                                                                                    weekday:
                                                                                        "short",
                                                                                },
                                                                            )
                                                                            .replace(
                                                                                ".",
                                                                                "",
                                                                            )}
                                                                    </span>
                                                                    <strong>
                                                                        {parsed.toLocaleDateString(
                                                                            "pt-BR",
                                                                            {
                                                                                day: "2-digit",
                                                                                month: "2-digit",
                                                                            },
                                                                        )}
                                                                    </strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextDate = addDaysToInputDate(
                                            agendaDate,
                                            adminView === "week" ? 7 : 1,
                                        );
                                        setAgendaDate(nextDate);
                                        setAgendaWeekReferenceDate(nextDate);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    →
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = formatDateForInput(new Date());
                                        setAgendaDate(today);
                                        setAgendaWeekReferenceDate(today);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    Hoje
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="admin-loading">Carregando...</div>
                        ) : adminView === "agenda" ? (
                            <div className="admin-card-list">
                                {agendaAppointments.length
                                    ? agendaAppointments.map(renderAppointmentCard)
                                    : <div className="admin-empty admin-empty--top">Nenhum agendamento nesta data.</div>}
                            </div>
                        ) : (
                            <div className="admin-card-list">
                                {weeklyAppointments.length
                                    ? weeklyAppointments.map(renderAppointmentCard)
                                    : <div className="admin-empty admin-empty--top">Nenhum agendamento nesta semana.</div>}
                            </div>
                        )}
                    </section>
                );
}
