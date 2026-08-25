import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function ClientHistoryModal() {
    const {
        clearCancelledAppointmentFromHistory,
        clearingCancelledAppointmentId,
        closeClientHistory,
        deleteConfirmedAppointmentFromHistory,
        deleteNailRecord,
        deletingConfirmedAppointmentId,
        deletingNailRecordId,
        formatAdminDate,
        getAppointmentStatusLabel,
        handleNailCameraSelection,
        isLoadingNailRecords,
        isSavingNailRecord,
        nailRecordError,
        nailRecordFilePreviews,
        nailRecordNotes,
        nailRecordSuccess,
        nailRecords,
        removeNailRecordFile,
        resetNailRecordForm,
        saveNailRecord,
        selectedClient,
        setNailRecordError,
        setNailRecordNotes,
        setNailRecordSuccess,
        setShowNailRecordForm,
        showNailRecordForm,
    } = useAdminPanelContext();

    return (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) closeClientHistory();}}>
                        <section className="admin-client-history">
                            <button className="admin-modal__close" type="button" onClick={closeClientHistory}>×</button>
                            <h2>Histórico de {selectedClient.name}</h2>
                            <p>{selectedClient.phone} • {selectedClient.email || "E-mail não informado"}</p>

                            <section className="admin-client-history__section">
                                <div className="admin-client-history__section-header">
                                    <div>
                                        <h3>Registros das unhas</h3>
                                        <p>Fotos e observações ficam vinculadas ao perfil da cliente com data e hora do registro.</p>
                                    </div>
                                    <button
                                        className="admin-nail-record__new-button"
                                        type="button"
                                        onClick={() => {
                                            setShowNailRecordForm((current) => !current);
                                            setNailRecordError("");
                                            setNailRecordSuccess("");
                                        }}
                                    >
                                        {showNailRecordForm ? "Fechar registro" : "Registrar estado da unha"}
                                    </button>
                                </div>

                                {showNailRecordForm && (
                                    <div className="admin-nail-form">
                                        <div className="admin-nail-form__camera-actions">
                                            <label className="admin-nail-form__file-button is-camera">
                                                📷 Abrir câmera
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    onChange={handleNailCameraSelection}
                                                />
                                            </label>

                                            <label className="admin-nail-form__file-button">
                                                Escolher da galeria
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={handleNailCameraSelection}
                                                />
                                            </label>
                                        </div>

                                        <p className="admin-nail-form__hint">
                                            Você pode adicionar até 6 fotos por registro. No celular, “Abrir câmera” solicita a câmera traseira quando o navegador oferece suporte.
                                        </p>

                                        {nailRecordFilePreviews.length > 0 && (
                                            <div className="admin-nail-form__previews">
                                                {nailRecordFilePreviews.map((preview, index) => (
                                                    <div className="admin-nail-form__preview" key={`${preview.file.name}-${preview.file.lastModified}-${index}`}>
                                                        <img src={preview.url} alt={`Foto selecionada ${index + 1}`}/>
                                                        <button
                                                            type="button"
                                                            aria-label={`Remover foto ${index + 1}`}
                                                            onClick={() => removeNailRecordFile(index)}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label>
                                            <strong>Observação sobre a unha</strong>
                                            <textarea
                                                value={nailRecordNotes}
                                                onChange={(event) => setNailRecordNotes(event.target.value)}
                                                placeholder="Ex.: pequena fissura no indicador direito, unha fragilizada, descolamento pré-existente..."
                                                maxLength={1500}
                                            />
                                        </label>

                                        {nailRecordError && (
                                            <p className="admin-nail-form__message is-error">{nailRecordError}</p>
                                        )}

                                        <div className="admin-nail-form__actions">
                                            <button
                                                className="save"
                                                type="button"
                                                disabled={isSavingNailRecord}
                                                onClick={() => void saveNailRecord()}
                                            >
                                                {isSavingNailRecord ? "Salvando registro..." : "Salvar registro"}
                                            </button>
                                            <button
                                                className="cancel"
                                                type="button"
                                                disabled={isSavingNailRecord}
                                                onClick={resetNailRecordForm}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {nailRecordSuccess && (
                                    <p className="admin-nail-form__message is-success">{nailRecordSuccess}</p>
                                )}

                                {isLoadingNailRecords ? (
                                    <div className="admin-nail-records__loading">Carregando registros das unhas...</div>
                                ) : nailRecords.length ? (
                                    <div className="admin-nail-records">
                                        {nailRecords.map((record) => (
                                            <article className="admin-nail-record" key={record.id}>
                                                <div className="admin-nail-record__top">
                                                    <strong>Registro fotográfico</strong>
                                                    <div className="admin-nail-record__top-actions">
                                                        <span>
                                                            {new Date(record.created_at).toLocaleString("pt-BR", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="admin-nail-record__delete"
                                                            disabled={deletingNailRecordId === record.id}
                                                            onClick={() => void deleteNailRecord(record)}
                                                        >
                                                            {deletingNailRecordId === record.id ? "Excluindo..." : "Excluir"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <p className="admin-nail-record__notes">
                                                    {record.notes || "Sem observação informada."}
                                                </p>

                                                {record.photos.length > 0 && (
                                                    <div className="admin-nail-record__photos">
                                                        {record.photos.map((photo, index) =>
                                                            photo.signedUrl ? (
                                                                <a
                                                                    key={photo.id}
                                                                    href={photo.signedUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Abrir foto em tamanho maior"
                                                                >
                                                                    <img
                                                                        src={photo.signedUrl}
                                                                        alt={`Registro da unha ${index + 1}`}
                                                                    />
                                                                </a>
                                                            ) : null,
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="admin-nail-records__empty">
                                        Nenhum registro da unha salvo para esta cliente.
                                    </div>
                                )}
                            </section>

                            <section className="admin-client-history__section">
                                <div className="admin-client-history__section-header">
                                    <div>
                                        <h3>Histórico de atendimentos</h3>
                                        <p>Agendamentos registrados para esta cliente.</p>
                                    </div>
                                </div>

                                <div className="admin-client-history__list">
                                    {selectedClient.appointments.map((appointment) => {
                                        const canClearCancelled =
                                            appointment.status === "cancelled";
                                        const canDeleteConfirmed =
                                            appointment.status === "confirmed";

                                        const isClearing =
                                            clearingCancelledAppointmentId ===
                                            appointment.id;
                                        const isDeletingConfirmed =
                                            deletingConfirmedAppointmentId ===
                                            appointment.id;

                                        const isInteractive =
                                            canClearCancelled ||
                                            canDeleteConfirmed;

                                        return (
                                            <article
                                                key={appointment.id}
                                                className={[
                                                    canClearCancelled
                                                        ? "is-cancelled-cleanable"
                                                        : "",
                                                    canDeleteConfirmed
                                                        ? "is-confirmed-deletable"
                                                        : "",
                                                    isClearing ||
                                                    isDeletingConfirmed
                                                        ? "is-clearing"
                                                        : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                role={
                                                    isInteractive
                                                        ? "button"
                                                        : undefined
                                                }
                                                tabIndex={
                                                    isInteractive
                                                        ? 0
                                                        : undefined
                                                }
                                                onClick={() => {
                                                    if (canClearCancelled) {
                                                        void clearCancelledAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                        return;
                                                    }

                                                    if (canDeleteConfirmed) {
                                                        void deleteConfirmedAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                    }
                                                }}
                                                onKeyDown={(event) => {
                                                    if (
                                                        !isInteractive ||
                                                        (event.key !== "Enter" &&
                                                            event.key !== " ")
                                                    ) {
                                                        return;
                                                    }

                                                    event.preventDefault();

                                                    if (canClearCancelled) {
                                                        void clearCancelledAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                        return;
                                                    }

                                                    if (canDeleteConfirmed) {
                                                        void deleteConfirmedAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                    }
                                                }}
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            appointment.service_name
                                                        }
                                                    </strong>
                                                    <span>
                                                        {formatAdminDate(
                                                            appointment.appointment_date,
                                                        )}{" "}
                                                        às{" "}
                                                        {String(
                                                            appointment.start_time,
                                                        ).slice(0, 5)}
                                                    </span>
                                                </div>

                                                {canClearCancelled ? (
                                                    <div className="admin-client-history__cancelled-action">
                                                        <strong>
                                                            {isClearing
                                                                ? "Limpando..."
                                                                : "Cancelado"}
                                                        </strong>
                                                        <small>
                                                            Toque para limpar
                                                        </small>
                                                    </div>
                                                ) : canDeleteConfirmed ? (
                                                    <div className="admin-client-history__confirmed-action">
                                                        <strong>
                                                            {isDeletingConfirmed
                                                                ? "Excluindo..."
                                                                : "Confirmado"}
                                                        </strong>
                                                        <small>
                                                            Toque para excluir
                                                        </small>
                                                    </div>
                                                ) : (
                                                    <span>
                                                        {getAppointmentStatusLabel(
                                                            appointment.status,
                                                        )}
                                                    </span>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        </section>
                    </div>
                );
}
