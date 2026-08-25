import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function ClientEditModal() {
    const {
        clientAnamnesis,
        clientEditError,
        editClientEmail,
        editClientMusicTaste,
        editClientName,
        editClientPhone,
        formatBrazilianPhone,
        isLoadingClientAnamnesis,
        isSavingClient,
        saveClientChanges,
        setEditClientEmail,
        setEditClientMusicTaste,
        setEditClientName,
        setEditClientPhone,
        setEditingClient,
        updateClientAnamnesisField,
    } = useAdminPanelContext();

    return (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setEditingClient(null);}}>
                        <section className="admin-client-editor">
                            <button className="admin-modal__close" type="button" onClick={() => setEditingClient(null)}>×</button>
                            <h2>Editar cadastro</h2>
                            <label>Nome<input value={editClientName} onChange={(event) => setEditClientName(event.target.value)}/></label>
                            <label>Telefone<input value={editClientPhone} onChange={(event) => setEditClientPhone(formatBrazilianPhone(event.target.value))} maxLength={15} inputMode="numeric"/></label>
                            <label>E-mail<input type="email" value={editClientEmail} onChange={(event) => setEditClientEmail(event.target.value)}/></label>
                            <label>
                                Gosto musical
                                <textarea
                                    value={editClientMusicTaste}
                                    onChange={(event) => setEditClientMusicTaste(event.target.value)}
                                    placeholder="Ex.: pagode, sertanejo, pop, anos 80..."
                                    rows={3}
                                    maxLength={500}
                                />
                            </label>

                            <section className="admin-anamnesis-card">
                                <div className="admin-anamnesis-card__header">
                                    <div>
                                        <span>Saúde e cuidados</span>
                                        <h3>Ficha de anamnese</h3>
                                    </div>
                                </div>

                                {isLoadingClientAnamnesis ? (
                                    <p className="admin-anamnesis-card__loading">
                                        Carregando ficha...
                                    </p>
                                ) : (
                                    <div className="admin-anamnesis-card__questions">
                                        <label>
                                            <span>1. Data de nascimento</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={clientAnamnesis.birthDate}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "birthDate",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: 15/08/1990"
                                                maxLength={10}
                                            />
                                        </label>

                                        <label>
                                            <span>2. Indicação</span>
                                            <input
                                                value={clientAnamnesis.referral}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "referral",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Digite a resposta"
                                            />
                                        </label>

                                        <label>
                                            <span>3. É gestante?</span>
                                            <input
                                                value={clientAnamnesis.pregnant}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "pregnant",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>4. Tem diabetes?</span>
                                            <input
                                                value={clientAnamnesis.diabetes}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "diabetes",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>5. É bariátrica?</span>
                                            <input
                                                value={clientAnamnesis.bariatric}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "bariatric",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>6. Faz quimioterapia?</span>
                                            <input
                                                value={clientAnamnesis.chemotherapy}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "chemotherapy",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>7. Tireoide</span>
                                            <input
                                                value={clientAnamnesis.thyroid}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "thyroid",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Digite a resposta"
                                            />
                                        </label>

                                        <label>
                                            <span>8. Tem o hábito de roer as unhas?</span>
                                            <input
                                                value={clientAnamnesis.nailBiting}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "nailBiting",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>9. Tem alergias?</span>
                                            <input
                                                value={clientAnamnesis.allergies}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "allergies",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Informe quais, se houver"
                                            />
                                        </label>

                                        <label>
                                            <span>10. Tem micose?</span>
                                            <input
                                                value={clientAnamnesis.mycosis}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "mycosis",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>11. Usa medicamentos contínuos?</span>
                                            <input
                                                value={clientAnamnesis.continuousMedication}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "continuousMedication",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Informe quais, se houver"
                                            />
                                        </label>

                                        <label>
                                            <span>12. Usa materiais de limpeza?</span>
                                            <input
                                                value={clientAnamnesis.cleaningProducts}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "cleaningProducts",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>
                                    </div>
                                )}
                            </section>

                            {clientEditError && <p className="admin-reschedule__message">{clientEditError}</p>}
                            <button className="admin-primary-button" type="button" disabled={isSavingClient} onClick={() => void saveClientChanges()}>{isSavingClient ? "Salvando..." : "Salvar cadastro"}</button>
                        </section>
                    </div>
                );
}
