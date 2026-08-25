import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function ClientsView() {
    const {
        adminNow,
        clientSearch,
        clients,
        deleteClient,
        deletingClientKey,
        filteredClients,
        formatAdminDate,
        getAppointmentEndDateTime,
        normalizePhoneForWhatsApp,
        openClientEditor,
        openClientHistory,
        openNailRecordForClient,
        setClientSearch,
    } = useAdminPanelContext();

    return (
                    <section className="admin-clients">
                        <div className="admin-clients__header"><div><span className="admin-clients__eyebrow">Clientes</span><h2>Cadastros das clientes</h2><p>Consulte histórico, edite ou exclua um cadastro.</p></div><div className="admin-clients__count"><strong>{clients.length}</strong><span>clientes cadastradas</span></div></div>
                        <div className="admin-clients__search"><label>Buscar cliente<input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nome ou telefone"/></label></div>
                        <div className="admin-clients__grid">
                            {filteredClients.map((client) => {
                                const realized = client.appointments.filter(
                                    (item) =>
                                        item.status !== "cancelled" &&
                                        item.status !== "no-show" &&
                                        (
                                            item.status === "completed" ||
                                            getAppointmentEndDateTime(item).getTime() <=
                                                adminNow.getTime()
                                        ),
                                ).length;

                                const scheduled = client.appointments.filter(
                                    (item) =>
                                        item.status !== "cancelled" &&
                                        item.status !== "no-show" &&
                                        item.status !== "completed" &&
                                        getAppointmentEndDateTime(item).getTime() >
                                            adminNow.getTime(),
                                ).length;

                                const cancelled = client.appointments.filter(
                                    (item) => item.status === "cancelled",
                                ).length;

                                return (
                                    <article className="admin-client-card" key={client.key}>
                                        <div className="admin-client-card__top"><div className="admin-client-card__avatar">{client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div><h3>{client.name}</h3><a href={`https://wa.me/${normalizePhoneForWhatsApp(client.phone)}`} target="_blank" rel="noopener noreferrer">{client.phone}</a><span>{client.email || "E-mail não informado"}</span></div></div>
                                        <div className="admin-client-card__metrics">
                                            <div>
                                                <span>Atendimentos realizados</span>
                                                <strong>{realized}</strong>
                                            </div>
                                            <div>
                                                <span>Atendimentos agendados</span>
                                                <strong>{scheduled}</strong>
                                            </div>
                                            <div>
                                                <span>Atendimentos cancelados</span>
                                                <strong>{cancelled}</strong>
                                            </div>
                                        </div>
                                        {client.nextAppointment && <div className="admin-client-card__next"><span>Próximo</span><strong>{formatAdminDate(client.nextAppointment.appointment_date)} às {String(client.nextAppointment.start_time).slice(0, 5)}</strong></div>}
                                        <div className="admin-client-card__actions">
                                            <button type="button" onClick={() => openClientHistory(client)}>Ver histórico</button>
                                            <button type="button" className="is-nail-record" onClick={() => openNailRecordForClient(client)}>📷 Registrar estado da unha</button>
                                            <button type="button" className="is-secondary" onClick={() => openClientEditor(client)}>Editar cadastro</button>
                                            <button type="button" className="is-danger" disabled={deletingClientKey === client.key} onClick={() => void deleteClient(client)}>{deletingClientKey === client.key ? "Excluindo..." : "Remover da lista"}</button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                );
}
