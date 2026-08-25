import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function AppointmentDetailsModal() {
    const {
        adminServices,
        appointmentEditError,
        cancelAppointment,
        editAppointmentAvailableTimes,
        editAppointmentDate,
        editAppointmentEmail,
        editAppointmentMusicTaste,
        editAppointmentName,
        editAppointmentPhone,
        editAppointmentService,
        editAppointmentTime,
        editCalendarMonth,
        editSelectedService,
        editVisibleWeekDates,
        editWeekReferenceDate,
        formatAdminDate,
        formatDateForInput,
        getEditAppointmentMonthCells,
        isSavingAppointment,
        moveEditAppointmentWeek,
        openEditAppointmentMonthCalendar,
        saveAppointmentChanges,
        selectEditAppointmentDate,
        selectedAdminAppointment,
        setAppointmentEditError,
        setEditAppointmentEmail,
        setEditAppointmentMusicTaste,
        setEditAppointmentName,
        setEditAppointmentPhone,
        setEditAppointmentService,
        setEditAppointmentTime,
        setEditCalendarMonth,
        setSelectedAdminAppointment,
        setShowEditDateTimePicker,
        showEditDateTimePicker,
        showEditMonthCalendar,
    } = useAdminPanelContext();

    return (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setSelectedAdminAppointment(null);}}>
                        <section className="admin-modal">
                            <div className="admin-modal__header"><div><h2>Editar agendamento</h2><p>Altere os dados ou cancele o agendamento.</p></div><button className="admin-modal__close" type="button" onClick={() => setSelectedAdminAppointment(null)}>×</button></div>
                            <div className="admin-modal__body">
                                <div className="admin-edit-form">
                                    <label>Nome da cliente<input value={editAppointmentName} onChange={(event) => setEditAppointmentName(event.target.value)}/></label>
                                    <label>Telefone<input value={editAppointmentPhone} onChange={(event) => setEditAppointmentPhone(event.target.value)}/></label>

                                    <label className="admin-edit-form__full">
                                        Gosto musical
                                        <textarea
                                            value={editAppointmentMusicTaste}
                                            onChange={(event) => setEditAppointmentMusicTaste(event.target.value)}
                                            placeholder="Ex.: pagode, sertanejo, pop, anos 80..."
                                            rows={3}
                                            maxLength={500}
                                        />
                                    </label>

                                    <label className="admin-edit-form__full">E-mail<input type="email" value={editAppointmentEmail} onChange={(event) => setEditAppointmentEmail(event.target.value)}/></label>

                                    <label className="admin-edit-form__full">
                                        Serviço
                                        <select
                                            value={editAppointmentService}
                                            onChange={(event) => {
                                                setEditAppointmentService(event.target.value);
                                                setEditAppointmentTime("");
                                                setAppointmentEditError("");
                                            }}
                                        >
                                            {adminServices.map((service) => (
                                                <option key={service.id} value={service.name}>
                                                    {service.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="admin-edit-date-time admin-edit-form__full">
                                        <span className="admin-edit-date-time__label">Data e hora</span>

                                        <button
                                            type="button"
                                            className={`admin-edit-date-time__toggle${
                                                showEditDateTimePicker ? " is-open" : ""
                                            }`}
                                            onClick={() => {
                                                setShowEditDateTimePicker((current) => !current);
                                                setAppointmentEditError("");
                                            }}
                                        >
                                            <span className="admin-edit-date-time__icon" aria-hidden="true">
                                                📅
                                            </span>

                                            <div className="admin-edit-date-time__selected">
                                                <small>Data selecionada</small>
                                                <strong>
                                                    {editAppointmentDate
                                                        ? formatAdminDate(editAppointmentDate)
                                                        : "Escolha uma data"}
                                                </strong>

                                                <span className="admin-edit-date-time__time">
                                                    {editAppointmentTime
                                                        ? editAppointmentTime
                                                        : "Escolha o horário"}
                                                </span>
                                            </div>

                                            <span
                                                className="admin-edit-date-time__chevron"
                                                aria-hidden="true"
                                            >
                                                {showEditDateTimePicker ? "⌃" : "⌄"}
                                            </span>
                                        </button>

                                        {showEditDateTimePicker && (
                                            <div className="admin-edit-date-time__picker">
                                                <div className="admin-manual-week-picker">
                                                    <div className="admin-manual-week-picker__top">
                                                        <div className="admin-manual-week-picker__month">
                                                            <button
                                                                type="button"
                                                                onClick={openEditAppointmentMonthCalendar}
                                                                aria-label="Abrir calendário mensal"
                                                            >
                                                                📅
                                                            </button>

                                                            <strong>
                                                                {new Date(
                                                                    `${editWeekReferenceDate}T12:00:00`,
                                                                ).toLocaleDateString(
                                                                    "pt-BR",
                                                                    {
                                                                        month: "long",
                                                                        year: "numeric",
                                                                    },
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="admin-manual-week-picker__navs">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    moveEditAppointmentWeek(-1)
                                                                }
                                                                aria-label="Semana anterior"
                                                            >
                                                                ‹
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    moveEditAppointmentWeek(1)
                                                                }
                                                                aria-label="Próxima semana"
                                                            >
                                                                ›
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="admin-manual-week-days">
                                                        <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                                            {editVisibleWeekDates
                                                                .slice(0, 4)
                                                                .map((date) => {
                                                                    const parsed =
                                                                        new Date(
                                                                            `${date}T12:00:00`,
                                                                        );
                                                                    const isPast =
                                                                        date <
                                                                        formatDateForInput(
                                                                            new Date(),
                                                                        );

                                                                    return (
                                                                        <button
                                                                            key={date}
                                                                            type="button"
                                                                            disabled={isPast}
                                                                            className={`admin-manual-week-day${
                                                                                editAppointmentDate ===
                                                                                date
                                                                                    ? " is-selected"
                                                                                    : ""
                                                                            }${
                                                                                isPast
                                                                                    ? " is-past"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                selectEditAppointmentDate(
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
                                                                                {String(
                                                                                    parsed.getDate(),
                                                                                ).padStart(
                                                                                    2,
                                                                                    "0",
                                                                                )}
                                                                            </strong>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>

                                                        <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                                            {editVisibleWeekDates
                                                                .slice(4)
                                                                .map((date) => {
                                                                    const parsed =
                                                                        new Date(
                                                                            `${date}T12:00:00`,
                                                                        );
                                                                    const isPast =
                                                                        date <
                                                                        formatDateForInput(
                                                                            new Date(),
                                                                        );

                                                                    return (
                                                                        <button
                                                                            key={date}
                                                                            type="button"
                                                                            disabled={isPast}
                                                                            className={`admin-manual-week-day${
                                                                                editAppointmentDate ===
                                                                                date
                                                                                    ? " is-selected"
                                                                                    : ""
                                                                            }${
                                                                                isPast
                                                                                    ? " is-past"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                selectEditAppointmentDate(
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
                                                                                {String(
                                                                                    parsed.getDate(),
                                                                                ).padStart(
                                                                                    2,
                                                                                    "0",
                                                                                )}
                                                                            </strong>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>

                                                    {showEditMonthCalendar && (
                                                        <div className="admin-manual-month-calendar">
                                                            <div className="admin-manual-month-calendar__header">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditCalendarMonth(
                                                                            (current) =>
                                                                                new Date(
                                                                                    current.getFullYear(),
                                                                                    current.getMonth() -
                                                                                        1,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ‹
                                                                </button>

                                                                <strong>
                                                                    {editCalendarMonth.toLocaleDateString(
                                                                        "pt-BR",
                                                                        {
                                                                            month: "long",
                                                                            year: "numeric",
                                                                        },
                                                                    )}
                                                                </strong>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditCalendarMonth(
                                                                            (current) =>
                                                                                new Date(
                                                                                    current.getFullYear(),
                                                                                    current.getMonth() +
                                                                                        1,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ›
                                                                </button>
                                                            </div>

                                                            <div className="admin-manual-month-calendar__weekdays">
                                                                {[
                                                                    "SEG",
                                                                    "TER",
                                                                    "QUA",
                                                                    "QUI",
                                                                    "SEX",
                                                                    "SÁB",
                                                                    "DOM",
                                                                ].map((day) => (
                                                                    <span key={day}>
                                                                        {day}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <div className="admin-manual-month-calendar__grid">
                                                                {getEditAppointmentMonthCells().map(
                                                                    (date, index) => {
                                                                        if (!date) {
                                                                            return (
                                                                                <span
                                                                                    className="is-empty"
                                                                                    key={`edit-empty-${index}`}
                                                                                />
                                                                            );
                                                                        }

                                                                        const isPast =
                                                                            date <
                                                                            formatDateForInput(
                                                                                new Date(),
                                                                            );

                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={date}
                                                                                disabled={isPast}
                                                                                className={`${
                                                                                    editAppointmentDate ===
                                                                                    date
                                                                                        ? "is-selected"
                                                                                        : ""
                                                                                }${
                                                                                    isPast
                                                                                        ? " is-past"
                                                                                        : ""
                                                                                }`}
                                                                                onClick={() =>
                                                                                    selectEditAppointmentDate(
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
                                                </div>

                                                <div className="admin-edit-date-time__times">
                                                    <div className="admin-edit-date-time__times-heading">
                                                        <strong>Horários disponíveis</strong>
                                                        <span>
                                                            {editSelectedService
                                                                ? `${editSelectedService.duration_minutes} min`
                                                                : ""}
                                                        </span>
                                                    </div>

                                                    <div className="admin-manual-times">
                                                        {editAppointmentAvailableTimes.map(
                                                            (time) => (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    className={
                                                                        editAppointmentTime ===
                                                                        time
                                                                            ? "is-selected"
                                                                            : ""
                                                                    }
                                                                    onClick={() => {
                                                                        setEditAppointmentTime(
                                                                            time,
                                                                        );
                                                                        setAppointmentEditError(
                                                                            "",
                                                                        );
                                                                    }}
                                                                >
                                                                    {time}
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>

                                                    {!editAppointmentAvailableTimes.length && (
                                                        <div className="admin-manual-times__empty">
                                                            Nenhum horário disponível
                                                            para este serviço neste dia.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {appointmentEditError && <p className="admin-reschedule__message admin-edit-form__full">{appointmentEditError}</p>}
                                    <div className="admin-edit-actions">
                                        <button className="save" type="button" disabled={isSavingAppointment} onClick={() => void saveAppointmentChanges()}>{isSavingAppointment ? "Salvando..." : "Salvar alterações"}</button>
                                        <button className="cancel" type="button" onClick={() => void cancelAppointment(selectedAdminAppointment)}>Cancelar agendamento</button>
                                        <button className="close" type="button" onClick={() => setSelectedAdminAppointment(null)}>Fechar</button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                );
}
