import {usePublicSiteContext} from "../../context/PublicSiteContext";

export default function BookingStep2Modal() {
    const {
        availableTimes,
        bookingError,
        calendarMonth,
        cancelEditingClientAppointment,
        editingClientAppointment,
        getMonthCalendarCells,
        isCancellingClientAppointment,
        isLoadingAppointments,
        moveBookingWeek,
        moveCalendarMonth,
        openMonthCalendar,
        parseLocalDate,
        selectBookingDate,
        selectedDate,
        selectedTime,
        setBookingError,
        setBookingStep,
        setSelectedTime,
        setShowMonthCalendar,
        showMonthCalendar,
        today,
        visibleWeekDates,
        weekReferenceDate,
    } = usePublicSiteContext();

    return <div className="booking-modal">
                        <div className="booking-modal__content">
                            <button
                                className="booking-modal__close"
                                type="button"
                                onClick={() => {
                                    setBookingError("");
                                    setShowMonthCalendar(false);
                                    setBookingStep(1);
                                }}
                                aria-label="Fechar agenda"
                            >
                                ×
                            </button>

                            <span className="section-label">
                            {editingClientAppointment ? "Editar agendamento" : "Escolha data e horário"}
                        </span>
                            <h3>
                                {editingClientAppointment ? "Escolha o novo dia e horário" : "Quando fica melhor para você?"}
                            </h3>
                            <p>
                                Toque em qualquer dia da semana para ver os horários disponíveis sem precisar voltar.
                            </p>

                            {editingClientAppointment && (
                                <div className="client-edit-current">
                                    <span>Agendamento atual</span>
                                    <strong>
                                        {new Date(`${editingClientAppointment.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                        {" às "}
                                        {String(editingClientAppointment.start_time).slice(0, 5)}
                                    </strong>
                                </div>
                            )}

                            <div className="client-week-picker">
                                <div className="client-week-picker__top">
                                    <div className="client-week-picker__month">
                                        <strong>
                                            {parseLocalDate(selectedDate || weekReferenceDate).toLocaleDateString("pt-BR", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </strong>
                                        <button
                                            className="client-week-picker__calendar-button"
                                            type="button"
                                            onClick={openMonthCalendar}
                                            aria-label="Abrir calendário do mês"
                                        >
                                            📅
                                        </button>
                                    </div>

                                    <div className="client-week-picker__navs">
                                        <button
                                            className="client-week-picker__nav"
                                            type="button"
                                            onClick={() => moveBookingWeek(-1)}
                                            aria-label="Semana anterior"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            className="client-week-picker__nav"
                                            type="button"
                                            onClick={() => moveBookingWeek(1)}
                                            aria-label="Próxima semana"
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                {showMonthCalendar && (
                                    <div className="client-month-calendar">
                                        <div className="client-month-calendar__header">
                                            <button
                                                className="client-week-picker__nav"
                                                type="button"
                                                onClick={() => moveCalendarMonth(-1)}
                                                aria-label="Mês anterior"
                                            >
                                                ‹
                                            </button>
                                            <strong>
                                                {calendarMonth.toLocaleDateString("pt-BR", {
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </strong>
                                            <button
                                                className="client-week-picker__nav"
                                                type="button"
                                                onClick={() => moveCalendarMonth(1)}
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
                                            {getMonthCalendarCells().map((date, index) => {
                                                if (!date) {
                                                    return <span className="client-month-calendar__day is-empty" key={`empty-${index}`}/>;
                                                }

                                                const isPast = date < today;

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        className={[
                                                            "client-month-calendar__day",
                                                            date === selectedDate ? "is-selected" : "",
                                                            isPast ? "is-past" : "",
                                                        ].filter(Boolean).join(" ")}
                                                        onClick={() => selectBookingDate(date)}
                                                    >
                                                        {parseLocalDate(date).getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="client-week-days">
                                    {[
                                        {dates: visibleWeekDates.slice(0, 4), rowClass: "client-week-days__row--four"},
                                        {dates: visibleWeekDates.slice(4, 7), rowClass: "client-week-days__row--three"},
                                    ].map((row, rowIndex) => (
                                        <div
                                            className={`client-week-days__row ${row.rowClass}`}
                                            key={`week-row-${rowIndex}`}
                                        >
                                            {row.dates.map((date) => {
                                                const parsed = parseLocalDate(date);
                                                const isPast = date < today;

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        className={[
                                                            "client-week-day",
                                                            date === selectedDate ? "is-selected" : "",
                                                            isPast ? "is-past" : "",
                                                        ].filter(Boolean).join(" ")}
                                                        onClick={() => selectBookingDate(date)}
                                                    >
                                                    <span>
                                                        {parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}
                                                    </span>
                                                        <strong>
                                                            {parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}
                                                        </strong>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                <div className="client-week-times">
                                    <p className="client-week-times__title">
                                        {selectedDate
                                            ? `Horários disponíveis em ${parseLocalDate(selectedDate).toLocaleDateString("pt-BR")}`
                                            : "Escolha um dia"}
                                    </p>

                                    {bookingError && <p className="booking-modal__error">{bookingError}</p>}

                                    {isLoadingAppointments ? (
                                        <p>Carregando horários disponíveis...</p>
                                    ) : selectedDate && availableTimes.length > 0 ? (
                                        <div className="booking-times">
                                            {availableTimes.map((time) => (
                                                <button
                                                    key={time}
                                                    className={
                                                        selectedTime === time
                                                            ? "booking-time booking-time--selected"
                                                            : "booking-time"
                                                    }
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedTime(time);
                                                        setBookingError("");
                                                    }}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : selectedDate ? (
                                        <div className="booking-times__empty">
                                            <strong>Nenhum horário disponível neste dia.</strong>
                                            <span>Toque em outro dia da semana para consultar os horários.</span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="client-edit-actions">
                                    <button
                                        className="booking-modal__button"
                                        type="button"
                                        disabled={!selectedDate || !selectedTime}
                                        onClick={() => {
                                            setBookingError("");
                                            setBookingStep(4);
                                        }}
                                    >
                                        Revisar agendamento
                                    </button>

                                    {editingClientAppointment && (
                                        <button
                                            className="client-edit-cancel"
                                            type="button"
                                            disabled={isCancellingClientAppointment}
                                            onClick={() => void cancelEditingClientAppointment()}
                                        >
                                            {isCancellingClientAppointment ? "Cancelando..." : "Cancelar agendamento"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>;
}
