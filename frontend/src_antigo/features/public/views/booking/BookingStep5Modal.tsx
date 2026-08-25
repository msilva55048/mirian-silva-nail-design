import {usePublicSiteContext} from "../../context/PublicSiteContext";

export default function BookingStep5Modal() {
    const {
        clientName,
        clientPhone,
        closeBooking,
        editingClientAppointment,
        formatSelectedDate,
        selectedService,
        selectedTime,
    } = usePublicSiteContext();

    return <div className="booking-modal">
                        <div className="booking-modal__content booking-success">
                            <div className="booking-success__icon">✓</div>
                            <span className="section-label">{editingClientAppointment ? "Agendamento alterado" : "Agendamento realizado"}</span>
                            <h3>
                                {editingClientAppointment
                                    ? "Seu agendamento foi alterado com sucesso!"
                                    : "Seu agendamento foi confirmado com sucesso!"}
                            </h3>
                            <p>
                                {editingClientAppointment
                                    ? "O novo dia e horário já estão reservados para você."
                                    : `Obrigado, ${clientName}. Seu agendamento está confirmado e o horário já foi reservado para você.`}
                            </p>
                            <div className="booking-modal__summary">
                                <div><span>Serviço</span><strong>{selectedService}</strong></div>
                                <div><span>Data</span><strong>{formatSelectedDate()}</strong></div>
                                <div><span>Horário</span><strong>{selectedTime}</strong></div>
                                <div><span>Telefone</span><strong>{clientPhone}</strong></div>
                            </div>
                            <button className="booking-modal__button" type="button" onClick={closeBooking}>Finalizar
                            </button>
                        </div>
                    </div>;
}
