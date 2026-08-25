import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function FinanceView() {
    const {
        addMonthsToFinanceMonth,
        financeMonth,
        financeMonthLabel,
        financeMonthOptions,
        financePickerYear,
        financeServiceSummary,
        formatCurrency,
        openFinanceMonthPicker,
        selectCurrentFinanceMonth,
        selectFinanceMonth,
        setFinanceMonth,
        setFinancePickerYear,
        showFinanceMonthPicker,
    } = useAdminPanelContext();

    return (
                    <section className="admin-finance">
                        <div className="admin-finance__header">
                            <div>
                                <span className="admin-finance__eyebrow">Controle financeiro</span>
                                <h2>Financeiro mensal</h2>
                                <p>Valores calculados automaticamente a partir dos agendamentos do mês.</p>
                            </div>

                            <div className="admin-finance-month-picker">
                                <div className="admin-finance-month-picker__quick">
                                    <button
                                        type="button"
                                        aria-label="Mês anterior"
                                        onClick={() =>
                                            setFinanceMonth((current) =>
                                                addMonthsToFinanceMonth(current, -1)
                                            )
                                        }
                                    >
                                        ←
                                    </button>

                                    <button
                                        type="button"
                                        className={`admin-finance-month-picker__selected${
                                            showFinanceMonthPicker ? " is-open" : ""
                                        }`}
                                        onClick={openFinanceMonthPicker}
                                    >
                                        <span className="admin-finance-month-picker__icon">📅</span>

                                        <span className="admin-finance-month-picker__selected-text">
                                            <small>Mês selecionado</small>
                                            <strong>{financeMonthLabel}</strong>
                                        </span>

                                        <span className="admin-finance-month-picker__chevron">
                                            {showFinanceMonthPicker ? "⌃" : "⌄"}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        aria-label="Próximo mês"
                                        onClick={() =>
                                            setFinanceMonth((current) =>
                                                addMonthsToFinanceMonth(current, 1)
                                            )
                                        }
                                    >
                                        →
                                    </button>
                                </div>

                                {showFinanceMonthPicker && (
                                    <div className="admin-finance-month-panel">
                                        <div className="admin-finance-month-panel__header">
                                            <button
                                                type="button"
                                                aria-label="Ano anterior"
                                                onClick={() =>
                                                    setFinancePickerYear((current) => current - 1)
                                                }
                                            >
                                                ‹
                                            </button>

                                            <strong>{financePickerYear}</strong>

                                            <button
                                                type="button"
                                                aria-label="Próximo ano"
                                                onClick={() =>
                                                    setFinancePickerYear((current) => current + 1)
                                                }
                                            >
                                                ›
                                            </button>
                                        </div>

                                        <div className="admin-finance-month-panel__grid">
                                            {financeMonthOptions.map((monthName, index) => {
                                                const monthValue =
                                                    `${financePickerYear}-${String(index + 1).padStart(2, "0")}`;

                                                const selected =
                                                    financeMonth === monthValue;

                                                return (
                                                    <button
                                                        key={monthName}
                                                        type="button"
                                                        className={selected ? "is-selected" : ""}
                                                        onClick={() => selectFinanceMonth(index)}
                                                    >
                                                        <span>{monthName.slice(0, 3)}</span>
                                                        <strong>{monthName}</strong>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            className="admin-finance-month-panel__current"
                                            onClick={selectCurrentFinanceMonth}
                                        >
                                            Ir para o mês atual
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="admin-finance__period">
                            <span>Resumo de</span>
                            <strong>{financeMonthLabel}</strong>
                        </div>

                        <section className="admin-finance__services">
                            <div className="admin-finance__services-header">
                                <div>
                                    <h3>Resumo por serviço</h3>
                                    <p>Quantidade e valores de cada serviço no mês selecionado.</p>
                                </div>
                            </div>

                            {financeServiceSummary.length ? (
                                <div className="admin-finance-service-cards">
                                    {financeServiceSummary.map((service) => (
                                        <article
                                            className="admin-finance-service-card"
                                            key={service.serviceName}
                                        >
                                            <div className="admin-finance-service-card__row admin-finance-service-card__row--service">
                                                <span>Serviço</span>
                                                <strong>{service.serviceName}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Atendimentos realizados</span>
                                                <strong>{service.completedCount}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Valor realizado</span>
                                                <strong>
                                                    {formatCurrency(service.completedCents)}
                                                </strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Atendimentos agendados</span>
                                                <strong>{service.scheduledCount}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Valor agendado</span>
                                                <strong>
                                                    {formatCurrency(service.scheduledCents)}
                                                </strong>
                                            </div>

                                            <div className="admin-finance-service-card__row admin-finance-service-card__row--total">
                                                <span>Total previsto</span>
                                                <strong>
                                                    {formatCurrency(
                                                        service.completedCents +
                                                        service.scheduledCents,
                                                    )}
                                                </strong>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-finance__empty">
                                    <strong>Nenhum valor para este mês.</strong>
                                    <span>Os agendamentos confirmados e concluídos aparecerão aqui automaticamente.</span>
                                </div>
                            )}
                        </section>

                        <p className="admin-finance__note">
                            Ao chegar o horário, o agendamento é considerado realizado automaticamente. Cancelados e não comparecimentos não entram nos valores financeiros.
                        </p>
                    </section>
                );
}
