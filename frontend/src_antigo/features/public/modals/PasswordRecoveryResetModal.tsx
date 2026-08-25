import {usePublicSiteContext} from "../context/PublicSiteContext";

export default function PasswordRecoveryResetModal() {
    const {
        closePasswordRecoveryReset,
        isUpdatingRecoveryPassword,
        recoveryConfirmPassword,
        recoveryNewPassword,
        recoveryResetError,
        recoveryResetSuccess,
        setRecoveryConfirmPassword,
        setRecoveryNewPassword,
        setShowClientAccount,
        setShowRecoveryPassword,
        showRecoveryPassword,
        submitPasswordRecoveryReset,
    } = usePublicSiteContext();

    return (
                <div className="client-modal-backdrop">
                    <section className="client-modal">
                        <span className="client-modal__eyebrow">
                            Nova senha
                        </span>
                        <h2>Crie sua nova senha</h2>
                        <p>
                            Escolha uma nova senha com pelo menos 6 caracteres.
                        </p>

                        <form
                            className="client-auth-form"
                            onSubmit={submitPasswordRecoveryReset}
                        >
                            <label>
                                Nova senha
                                <div className="client-password-field">
                                    <input
                                        type={
                                            showRecoveryPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={recoveryNewPassword}
                                        onChange={(event) =>
                                            setRecoveryNewPassword(
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="new-password"
                                        minLength={6}
                                        required
                                    />
                                    <button
                                        className="client-password-toggle"
                                        type="button"
                                        onClick={() =>
                                            setShowRecoveryPassword(
                                                (current) => !current,
                                            )
                                        }
                                    >
                                        {showRecoveryPassword
                                            ? "Ocultar"
                                            : "Mostrar"}
                                    </button>
                                </div>
                            </label>

                            <label>
                                Confirmar nova senha
                                <input
                                    type={
                                        showRecoveryPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={recoveryConfirmPassword}
                                    onChange={(event) =>
                                        setRecoveryConfirmPassword(
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    minLength={6}
                                    required
                                />
                            </label>

                            {recoveryResetError && (
                                <p className="client-auth-message is-error">
                                    {recoveryResetError}
                                </p>
                            )}

                            {recoveryResetSuccess && (
                                <p className="client-auth-message is-success">
                                    {recoveryResetSuccess}
                                </p>
                            )}

                            {!recoveryResetSuccess ? (
                                <button
                                    className="client-auth-submit"
                                    type="submit"
                                    disabled={isUpdatingRecoveryPassword}
                                >
                                    {isUpdatingRecoveryPassword
                                        ? "Salvando..."
                                        : "Salvar nova senha"}
                                </button>
                            ) : (
                                <div className="client-recovery-success-actions">
                                    <button
                                        className="client-auth-submit"
                                        type="button"
                                        onClick={() => {
                                            closePasswordRecoveryReset();
                                            setShowClientAccount(true);
                                        }}
                                    >
                                        Ir para minha conta
                                    </button>
                                </div>
                            )}
                        </form>
                    </section>
                </div>
            );
}
