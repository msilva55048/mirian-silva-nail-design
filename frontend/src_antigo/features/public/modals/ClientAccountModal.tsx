import {usePublicSiteContext} from "../context/PublicSiteContext";

export default function ClientAccountModal() {
    const {
        clientAppointments,
        clientProfile,
        clientUserEmail,
        formatBrazilianPhone,
        getClientAppointmentStatusLabel,
        isClientAppointmentEditable,
        isLoadingClientAccount,
        logoutClient,
        openClientProfileEditor,
        openEditClientAppointment,
        setShowClientAccount,
    } = usePublicSiteContext();

    return (
                <div className="client-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowClientAccount(false);
                }}>
                    <section className="client-modal client-modal--account">
                        <button className="client-modal__close" type="button" onClick={() => setShowClientAccount(false)}>×</button>
                        <span className="client-modal__eyebrow">Minha conta</span>
                        <h2>{clientProfile ? `Olá, ${clientProfile.full_name.split(/\s+/)[0]}!` : "Sua conta"}</h2>
                        <p>Consulte seus dados e os agendamentos vinculados ao seu perfil.</p>

                        {isLoadingClientAccount ? (
                            <div className="client-account__empty">Carregando sua conta...</div>
                        ) : clientProfile ? (
                            <>
                                <div className="client-account__profile">
                                    <div><span>Nome</span><strong>{clientProfile.full_name}</strong></div>
                                    <div><span>Telefone</span><strong>{formatBrazilianPhone(clientProfile.phone)}</strong></div>
                                    <div><span>E-mail</span><strong>{clientProfile.email || clientUserEmail}</strong></div>
                                </div>

                                <div className="client-account__actions">
                                    <button
                                        className="client-account__edit-profile"
                                        type="button"
                                        onClick={openClientProfileEditor}
                                    >
                                        <span className="client-account__edit-profile-icon">✎</span>
                                        <span>
                                            <strong>Editar perfil</strong>
                                            <small>Nome, telefone, e-mail e senha</small>
                                        </span>
                                        <span className="client-account__edit-profile-arrow">›</span>
                                    </button>

                                    <button
                                        className="client-account__logout"
                                        type="button"
                                        onClick={() => void logoutClient()}
                                    >
                                        Sair da conta
                                    </button>
                                </div>

                                <section className="client-account__section" id="client-account-appointments">
                                    <h3>Meus agendamentos</h3>
                                    {clientAppointments.length > 0 ? (
                                        <div className="client-account__appointments">
                                            {clientAppointments.map((appointment) => (
                                                <button
                                                    className={
                                                        isClientAppointmentEditable(appointment)
                                                            ? "client-account__appointment is-editable"
                                                            : "client-account__appointment"
                                                    }
                                                    key={appointment.id}
                                                    type="button"
                                                    disabled={!isClientAppointmentEditable(appointment)}
                                                    onClick={() => openEditClientAppointment(appointment)}
                                                >
                                                    <div>
                                                        <strong>{appointment.service_name}</strong>
                                                        <span>
                                                            {new Date(`${appointment.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                                            {" às "}
                                                            {String(appointment.start_time).slice(0, 5)}
                                                        </span>
                                                        {isClientAppointmentEditable(appointment) && (
                                                            <span className="client-account__appointment-hint">
                                                                Toque para alterar dia, horário ou cancelar
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="client-account__status">
                                                        {getClientAppointmentStatusLabel(appointment.status)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="client-account__empty">
                                            Você ainda não possui agendamentos vinculados a esta conta.
                                        </div>
                                    )}
                                </section>
                            </>
                        ) : (
                            <div className="client-account__empty">
                                Sua conta está autenticada, mas o perfil ainda não foi vinculado. Saia e entre novamente; se continuar, fale com a Mirian.
                            </div>
                        )}
                    </section>
                </div>
            );
}
