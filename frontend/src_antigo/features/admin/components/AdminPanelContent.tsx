import {useAdminPanelContext} from "../context/AdminPanelContext";
import AgendaWeekView from "../views/AgendaWeekView";
import MonthAgendaView from "../views/MonthAgendaView";
import FinanceView from "../views/FinanceView";
import ScheduleConfigView from "../views/ScheduleConfigView";
import ServiceSettingsView from "../views/ServiceSettingsView";
import ClientsView from "../views/ClientsView";
import NewAppointmentView from "../views/NewAppointmentView";
import BlocksView from "../views/BlocksView";
import AdminBackToTop from "./AdminBackToTop";
import AppointmentDetailsModal from "../modals/AppointmentDetailsModal";
import ClientHistoryModal from "../modals/ClientHistoryModal";
import ClientEditModal from "../modals/ClientEditModal";

export default function AdminPanelContent() {
    const {
        adminClientScheduledMetricStyles,
        adminEditDateTimeStyles,
        adminEnhancementStyles,
        adminServiceManagerStyles,
        adminStyles,
        adminView,
        editingClient,
        email,
        formatAdminDate,
        getWhatsAppNotificationLabel,
        getWhatsAppUrl,
        handleLogin,
        handleLogout,
        isAuthenticated,
        isCheckingSession,
        isLoggingIn,
        loginError,
        markWhatsAppNotificationOpened,
        openAdminDashboardView,
        panelError,
        password,
        pendingWhatsAppNotifications,
        selectedAdminAppointment,
        selectedClient,
        setEmail,
        setPassword,
        showAdminBackToTop,
    } = useAdminPanelContext();
if (isCheckingSession) {
        return <main className="admin-page"><style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style><div className="admin-login"><div className="admin-loading">Verificando acesso...</div></div></main>;
    }

    if (!isAuthenticated) {
        return (
            <main className="admin-page">
                <style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style>
                <div className="admin-login">
                    <form className="admin-login__card" onSubmit={handleLogin}>
                        <div className="admin-login__brand"><img className="admin-login__logo" src="/logo-mirian.png" alt="Logo Mirian Silva Nail Design"/><div><strong>Mirian Silva</strong><span>Painel administrativo</span></div></div>
                        <h1>Acesso da Mirian</h1>
                        <p>Entre com o e-mail e a senha cadastrados no Supabase.</p>
                        {loginError && <p className="admin-login__error">{loginError}</p>}
                        <div className="admin-field"><label htmlFor="admin-email">E-mail</label><input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></div>
                        <div className="admin-field"><label htmlFor="admin-password">Senha</label><input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required/></div>
                        <button className="admin-primary-button" type="submit" disabled={isLoggingIn}>{isLoggingIn ? "Entrando..." : "Entrar no painel"}</button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="admin-page">
            <style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style>
            <section className="admin-panel">
                <header className="admin-header">
                    <div><h1>Painel da Mirian</h1><p>Gerencie os agendamentos recebidos pelo site.</p></div>
                    <button className="admin-secondary-button" type="button" onClick={handleLogout}>Sair</button>
                </header>

                <div className="admin-dashboard-cards">
                    <button className={`admin-dashboard-card${adminView === "agenda" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("agenda")}><strong>Agenda do dia</strong><span>Veja todos os atendimentos do dia.</span></button>
                    <button className={`admin-dashboard-card${adminView === "week" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("week")}><strong>Agenda semanal</strong><span>Atendimentos em ordem de dia e horário.</span></button>
                    <button className={`admin-dashboard-card${adminView === "month" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("month")}><strong>Agenda mensal</strong><span>Veja os atendimentos organizados ao longo do mês.</span></button>
                    <button
                        className={`admin-dashboard-card${adminView === "new" ? " is-active" : ""}`}
                        type="button"
                        onClick={() => openAdminDashboardView("new")}
                    >
                        <strong>Novo agendamento</strong>
                        <span>Cadastre um novo atendimento para uma cliente.</span>
                    </button>
                    <button className={`admin-dashboard-card${adminView === "clients" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("clients")}><strong>Clientes</strong><span>Cadastros, histórico e indicadores.</span></button>
                    <button className={`admin-dashboard-card${adminView === "finance" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("finance")}><strong>Financeiro</strong><span>Faturamento e previsão mensal.</span></button>
                    <button className={`admin-dashboard-card${adminView === "schedule" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("schedule")}><strong>Configuração de horários</strong><span>Adicione, altere ou remova horários de uma data específica.</span></button>
                    <button className={`admin-dashboard-card${adminView === "settings" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("settings")}><strong>Configuração de serviços</strong><span>Cadastre, edite e exclua serviços.</span></button>
                    <button className={`admin-dashboard-card${adminView === "blocks" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("blocks")}><strong>Bloquear horários</strong><span>Bloqueie horários livres em uma data específica.</span></button>
                </div>

                <section className="admin-message-center">
                    <div className="admin-message-center__header">
                        <div>
                            <h2>Mensagens pendentes</h2>
                            <p>Abra o WhatsApp com a mensagem pronta e toque em enviar.</p>
                        </div>
                        <span className="admin-message-center__count">{pendingWhatsAppNotifications.length}</span>
                    </div>

                    {pendingWhatsAppNotifications.length ? (
                        <div className="admin-message-center__list">
                            {pendingWhatsAppNotifications.slice(0, 10).map(({appointment, type, key}) => (
                                <article className="admin-message-item" key={key}>
                                    <div>
                                        <strong>{getWhatsAppNotificationLabel(type)} — {appointment.client_name}</strong>
                                        <span>{formatAdminDate(appointment.appointment_date)} às {String(appointment.start_time).slice(0, 5)} · {appointment.service_name}</span>
                                    </div>
                                    <a
                                        href={getWhatsAppUrl(appointment, type)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => markWhatsAppNotificationOpened(appointment, type)}
                                    >
                                        Abrir WhatsApp
                                    </a>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="admin-message-center__empty">Nenhuma mensagem pendente neste momento.</p>
                    )}
                </section>

                <div
                    id="admin-active-content"
                    className="admin-active-content-anchor"
                    aria-hidden="true"
                />

                {(adminView === "agenda" || adminView === "week") && <AgendaWeekView/>}

                {panelError && <p className="admin-panel__error">{panelError}</p>}

                {adminView === "month" && <MonthAgendaView/>} 
                {adminView === "finance" && <FinanceView/>} 
                {adminView === "schedule" && <ScheduleConfigView/>} 
                {adminView === "settings" && <ServiceSettingsView/>} 
                {adminView === "clients" && <ClientsView/>} 
                {adminView === "new" && <NewAppointmentView/>} 
                {adminView === "blocks" && <BlocksView/>} 

                {showAdminBackToTop && <AdminBackToTop/>} 

                {selectedAdminAppointment && <AppointmentDetailsModal/>} 

                {selectedClient && <ClientHistoryModal/>} 

                {editingClient && <ClientEditModal/>} 
            </section>
        </main>
    );
}
