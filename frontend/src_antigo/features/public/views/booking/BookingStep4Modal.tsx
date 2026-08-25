import {usePublicSiteContext} from "../../context/PublicSiteContext";

export default function BookingStep4Modal() {
    const {
        bookingError,
        clientName,
        clientPhone,
        confirmBooking,
        editingClientAppointment,
        formatSelectedDate,
        isConfirmingBooking,
        selectedService,
        selectedServiceInformation,
        selectedTime,
        setBookingError,
        setBookingStep,
    } = usePublicSiteContext();

    return <div className="booking-modal">
                        <div className="booking-modal__content">
                            <button className="booking-modal__close" type="button" onClick={() => {
                                setBookingError("");
                                setBookingStep(2);
                            }} aria-label="Voltar para data e horários">←
                            </button>
                            <span className="section-label">{editingClientAppointment ? "Confirmar alteração" : "Confirmação"}</span>
                            <h3>{editingClientAppointment ? "Revise o novo dia e horário" : "Revise seu agendamento"}</h3>
                            <p>
                                {editingClientAppointment
                                    ? "Confira as novas informações antes de salvar a alteração."
                                    : "Confira as informações antes de confirmar a solicitação."}
                            </p>
                            <div className="booking-modal__summary">
                                <div><span>Cliente</span><strong>{clientName}</strong></div>
                                <div><span>Telefone</span><strong>{clientPhone}</strong></div>
                                <div><span>Serviço</span><strong>{selectedService}</strong></div>
                                <div><span>Data</span><strong>{formatSelectedDate()}</strong></div>
                                <div><span>Horário</span><strong>{selectedTime}</strong></div>
                                <div><span>Valor</span><strong>{selectedServiceInformation?.price ?? ""}</strong></div>
                            </div>
                            {bookingError && <p className="booking-modal__error">{bookingError}</p>}
                            <button className="booking-modal__button" type="button" disabled={isConfirmingBooking}
                                    onClick={confirmBooking}>
                                {isConfirmingBooking
                                    ? "Salvando..."
                                    : editingClientAppointment
                                        ? "Salvar novo dia e horário"
                                        : "Confirmar agendamento"}
                            </button>
                        </div>
                    </div>;
}
