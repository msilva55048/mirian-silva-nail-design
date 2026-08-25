import {usePublicSiteContext} from "../context/PublicSiteContext";
import BookingStep2Modal from "./booking/BookingStep2Modal";
import BookingStep4Modal from "./booking/BookingStep4Modal";
import BookingStep5Modal from "./booking/BookingStep5Modal";

export default function ClientLoggedPage() {
    const {
        bookingStep,
        clientProfile,
        formatBrazilianPhone,
        formatDateForInput,
        openClientAppointments,
        selectService,
        services,
        setBookingStep,
        setClientName,
        setClientPhone,
        setEditingClientAppointment,
        setSelectedDate,
        setWeekReferenceDate,
    } = usePublicSiteContext();

    return (
                <div className="client-logged-page">

                    <style>{`
                .client-logged-page {
                    min-height: 100vh;
                    background: #fff8fa;
                    padding: 24px 0 64px;
                }
                .client-logged-header {
                    width: min(1160px, calc(100% - 32px));
                    margin: 0 auto 22px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 16px;
                    border: 1px solid rgba(125, 78, 91, .12);
                    border-radius: 18px;
                    background: #fff;
                    box-shadow: 0 10px 28px rgba(83, 48, 58, .06);
                }
                .client-logged-header__brand {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }
                .client-logged-header__brand img {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .client-logged-header__brand strong,
                .client-logged-header__brand span {
                    display: block;
                }
                .client-logged-header__brand strong {
                    color: #4d363e;
                    font-size: .98rem;
                }
                .client-logged-header__brand span {
                    margin-top: 2px;
                    color: #8a7078;
                    font-size: .76rem;
                }
                .client-logged-header__actions {
                    display: flex;
                    width: min(440px, 100%);
                    flex: 1;
                }
                .client-logged-header__actions button {
                    width: 100%;
                    border: 0;
                    border-radius: 14px;
                    padding: 16px 18px;
                    font: inherit;
                    font-size: 1.02rem;
                    font-weight: 850;
                    cursor: pointer;
                }
                .client-logged-header__appointments {
                    background: #6d3445;
                    color: #fff;
                }
                .client-logged-page .services {
                    padding-top: 4px;
                }
                .client-logged-page .services__grid {
                    gap: 18px;
                }
                .client-logged-page .service-card {
                    padding: 28px 24px;
                    min-height: unset;
                }
                .client-logged-page .service-card__button {
                    width: 100%;
                    box-sizing: border-box;
                    cursor: pointer;
                    font: inherit;
                }
                @media (max-width: 700px) {
                    .client-logged-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    .client-logged-header__actions {
                        width: 100%;
                    }
                    .client-logged-header__actions button {
                        width: 100%;
                    }
                }
            `}</style>

                    <header className="client-logged-header">
                        <div className="client-logged-header__brand">
                            <img src="/logo-mirian.png" alt="Mirian Silva Nail Design" />
                            <div>
                                <strong>Mirian Silva Nail Design</strong>
                                <span>Olá, {clientProfile?.full_name.split(/\s+/)[0]}</span>
                            </div>
                        </div>

                        <div className="client-logged-header__actions">
                            <button
                                className="client-logged-header__appointments"
                                type="button"
                                onClick={openClientAppointments}
                            >
                                Meus agendamentos
                            </button>
                        </div>
                    </header>


                    <section className="services" id="servicos">
                        <div className="services__grid">
                            {services.map((service, index) => (
                                <article className="service-card" key={service.name}>
                                    <span className="service-card__number">{String(index + 1).padStart(2, "0")}</span>
                                    <div className="service-card__content"><h3>{service.name}</h3><p>{service.description}</p>
                                    </div>
                                    <div className="service-card__footer">
                                        <div><span>Duração</span><strong>{service.duration}</strong></div>
                                        <div><span>Valor</span><strong>{service.price}</strong></div>
                                    </div>
                                    <button
                                        type="button"
                                        className="service-card__button"
                                        onClick={() => {
                                            setEditingClientAppointment(null);
                                            selectService(service.name);
                                            const initialDate = formatDateForInput(new Date());
                                            setSelectedDate(initialDate);
                                            setWeekReferenceDate(initialDate);
                                            setClientName(clientProfile?.full_name ?? "");
                                            setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
                                            setBookingStep(2);
                                        }}
                                    >
                                        Escolher este serviço
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>


                    {bookingStep === 2 && <BookingStep2Modal/>} 


                    {bookingStep === 4 && <BookingStep4Modal/>} 


                    {bookingStep === 5 && <BookingStep5Modal/>} 
                </div>

            );
}
