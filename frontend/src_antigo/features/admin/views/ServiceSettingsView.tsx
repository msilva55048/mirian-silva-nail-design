import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function ServiceSettingsView() {
    const {
        adminServices,
        deleteAdminService,
        deletingServiceId,
        editingServiceId,
        expandedServiceId,
        formatCurrency,
        formatDuration,
        openServiceEditor,
        resetServiceForm,
        saveServiceFromForm,
        savingServiceId,
        serviceFormDuration,
        serviceFormName,
        serviceFormPrice,
        setExpandedServiceId,
        setServiceFormDuration,
        setServiceFormName,
        setServiceFormPrice,
        settingsError,
        settingsSuccess,
    } = useAdminPanelContext();

    return (
                    <section className="admin-settings admin-service-manager">
                        <div className="admin-settings__intro">
                            <div>
                                <span className="admin-settings__eyebrow">Configurações do site</span>
                                <h2>Configuração de serviços</h2>
                                <p>Cadastre, edite ou exclua os serviços. A lista é organizada do maior para o menor valor.</p>
                            </div>
                        </div>

                        {settingsError && (
                            <p className="admin-settings__message admin-settings__message--error">
                                {settingsError}
                            </p>
                        )}

                        {settingsSuccess && (
                            <p className="admin-settings__message admin-settings__message--success">
                                {settingsSuccess}
                            </p>
                        )}


                        <section
                            id="admin-service-form"
                            className="admin-service-form-card"
                        >
                            <div className="admin-service-form-card__heading">
                                <div>
                                    <span>
                                        {editingServiceId !== null
                                            ? "EDITAR SERVIÇO"
                                            : "NOVO SERVIÇO"}
                                    </span>
                                    <h3>
                                        {editingServiceId !== null
                                            ? "Atualize as informações"
                                            : "Adicionar serviço"}
                                    </h3>
                                </div>

                                {editingServiceId !== null && (
                                    <button
                                        type="button"
                                        className="admin-service-form-card__cancel"
                                        onClick={resetServiceForm}
                                    >
                                        Cancelar edição
                                    </button>
                                )}
                            </div>

                            <div className="admin-service-form-fields">
                                <label>
                                    <span>NOME DO SERVIÇO</span>
                                    <input
                                        type="text"
                                        value={serviceFormName}
                                        onChange={(event) =>
                                            setServiceFormName(event.target.value)
                                        }
                                        placeholder="Ex.: Esmaltação em Gel"
                                    />
                                </label>

                                <label>
                                    <span>VALOR DO SERVIÇO</span>
                                    <div className="admin-service-price-field">
                                        <span>R$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={serviceFormPrice}
                                            onChange={(event) =>
                                                setServiceFormPrice(
                                                    event.target.value.replace(
                                                        /[^0-9,.]/g,
                                                        "",
                                                    ),
                                                )
                                            }
                                            placeholder="0,00"
                                        />
                                    </div>
                                </label>

                                <label>
                                    <span>DURAÇÃO DO SERVIÇO</span>
                                    <div className="admin-service-duration-field">
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={serviceFormDuration}
                                            onChange={(event) =>
                                                setServiceFormDuration(event.target.value)
                                            }
                                            placeholder="90"
                                        />
                                        <span>minutos</span>
                                    </div>
                                </label>
                            </div>

                            <button
                                type="button"
                                className="admin-service-form-card__save"
                                disabled={savingServiceId !== null}
                                onClick={() => void saveServiceFromForm()}
                            >
                                {savingServiceId !== null
                                    ? "Salvando..."
                                    : editingServiceId !== null
                                        ? "Salvar alterações"
                                        : "Salvar serviço"}
                            </button>
                        </section>

                        <section className="admin-service-list-section">
                            <div className="admin-service-list-section__heading">
                                <div>
                                    <span>SERVIÇOS CADASTRADOS</span>
                                    <h3>Serviços disponíveis</h3>
                                </div>
                                <strong>{adminServices.length}</strong>
                            </div>

                            <div className="admin-service-cards">
                                {adminServices.map((service) => {
                                    const isExpanded =
                                        expandedServiceId === service.id;

                                    return (
                                        <article
                                            className={`admin-service-summary-card${
                                                isExpanded ? " is-expanded" : ""
                                            }`}
                                            key={service.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                setExpandedServiceId((current) =>
                                                    current === service.id
                                                        ? null
                                                        : service.id,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    setExpandedServiceId((current) =>
                                                        current === service.id
                                                            ? null
                                                            : service.id,
                                                    );
                                                }
                                            }}
                                        >
                                            <div className="admin-service-summary-card__main">
                                                <div className="admin-service-summary-card__icon">
                                                    ✦
                                                </div>

                                                <div className="admin-service-summary-card__content">
                                                    <strong>{service.name}</strong>

                                                    <div className="admin-service-summary-card__details">
                                                        <span>
                                                            <small>Valor</small>
                                                            <b>
                                                                {formatCurrency(
                                                                    service.price_cents,
                                                                )}
                                                            </b>
                                                        </span>

                                                        <span>
                                                            <small>Duração</small>
                                                            <b>
                                                                {formatDuration(
                                                                    service.duration_minutes,
                                                                )}
                                                            </b>
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="admin-service-summary-card__chevron">
                                                    {isExpanded ? "⌃" : "⌄"}
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div
                                                    className="admin-service-summary-card__actions"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className="edit"
                                                        onClick={() =>
                                                            openServiceEditor(service)
                                                        }
                                                    >
                                                        Editar serviço
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="delete"
                                                        disabled={
                                                            deletingServiceId === service.id
                                                        }
                                                        onClick={() =>
                                                            void deleteAdminService(service)
                                                        }
                                                    >
                                                        {deletingServiceId === service.id
                                                            ? "Excluindo..."
                                                            : "Excluir serviço"}
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </section>
                );
}
