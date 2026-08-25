import {usePublicSiteContext} from "../context/PublicSiteContext";

export default function ClientProfileEditorModal() {
    const {
        closeClientProfileEditor,
        formatBrazilianPhone,
        isSavingProfileEdit,
        profileEditEmail,
        profileEditError,
        profileEditName,
        profileEditPassword,
        profileEditPasswordConfirm,
        profileEditPhone,
        profileEditSuccess,
        saveClientProfileChanges,
        setProfileEditEmail,
        setProfileEditName,
        setProfileEditPassword,
        setProfileEditPasswordConfirm,
        setProfileEditPhone,
        setShowProfileEditPassword,
        showProfileEditPassword,
    } = usePublicSiteContext();

    return (
                <div
                    className="client-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeClientProfileEditor();
                        }
                    }}
                >
                    <section className="client-modal client-profile-editor">
                        <button
                            className="client-modal__close"
                            type="button"
                            onClick={closeClientProfileEditor}
                            aria-label="Fechar edição do perfil"
                        >
                            ×
                        </button>

                        <span className="client-modal__eyebrow">Meu perfil</span>
                        <h2>Editar perfil</h2>
                        <p>
                            Atualize seus dados. As alterações são feitas no mesmo
                            cadastro já vinculado à sua conta.
                        </p>

                        <form
                            className="client-profile-editor__form"
                            onSubmit={saveClientProfileChanges}
                        >
                            <label>
                                Nome completo
                                <input
                                    value={profileEditName}
                                    onChange={(event) =>
                                        setProfileEditName(event.target.value)
                                    }
                                    autoComplete="name"
                                    maxLength={80}
                                    required
                                />
                            </label>

                            <label>
                                Telefone / WhatsApp
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    value={profileEditPhone}
                                    onChange={(event) =>
                                        setProfileEditPhone(
                                            formatBrazilianPhone(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
                                    autoComplete="tel"
                                    required
                                />
                            </label>

                            <label>
                                E-mail
                                <input
                                    type="email"
                                    value={profileEditEmail}
                                    onChange={(event) =>
                                        setProfileEditEmail(event.target.value)
                                    }
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Nova senha
                                <small className="client-profile-editor__hint">
                                    Deixe em branco para manter a senha atual.
                                </small>

                                <div className="client-password-field">
                                    <input
                                        type={
                                            showProfileEditPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={profileEditPassword}
                                        onChange={(event) =>
                                            setProfileEditPassword(
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="new-password"
                                        minLength={6}
                                        placeholder="Nova senha"
                                    />

                                    <button
                                        className="client-password-toggle"
                                        type="button"
                                        onClick={() =>
                                            setShowProfileEditPassword(
                                                (current) => !current,
                                            )
                                        }
                                    >
                                        {showProfileEditPassword
                                            ? "Ocultar"
                                            : "Mostrar"}
                                    </button>
                                </div>
                            </label>

                            <label>
                                Confirmar nova senha
                                <input
                                    type={
                                        showProfileEditPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={profileEditPasswordConfirm}
                                    onChange={(event) =>
                                        setProfileEditPasswordConfirm(
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    minLength={6}
                                    placeholder="Repita a nova senha"
                                />
                            </label>

                            {profileEditError && (
                                <p className="client-auth-message is-error">
                                    {profileEditError}
                                </p>
                            )}

                            {profileEditSuccess && (
                                <p className="client-auth-message is-success">
                                    {profileEditSuccess}
                                </p>
                            )}

                            <div className="client-profile-editor__actions">
                                <button
                                    type="submit"
                                    className="client-profile-editor__save"
                                    disabled={isSavingProfileEdit}
                                >
                                    {isSavingProfileEdit
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                </button>

                                <button
                                    type="button"
                                    className="client-profile-editor__cancel"
                                    onClick={closeClientProfileEditor}
                                    disabled={isSavingProfileEdit}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            );
}
