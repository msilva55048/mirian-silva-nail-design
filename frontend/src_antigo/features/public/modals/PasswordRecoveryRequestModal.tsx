import {usePublicSiteContext} from "../context/PublicSiteContext";

export default function PasswordRecoveryRequestModal() {
    const {
        closePasswordRecoveryRequest,
        isSendingRecoveryEmail,
        openClientAuth,
        recoveryEmail,
        recoveryRequestError,
        recoveryRequestSuccess,
        setRecoveryEmail,
        submitPasswordRecoveryRequest,
    } = usePublicSiteContext();

    return (
                <div
                    className="client-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closePasswordRecoveryRequest();
                        }
                    }}
                >
                    <section className="client-modal">
                        <button
                            className="client-modal__close"
                            type="button"
                            onClick={closePasswordRecoveryRequest}
                            disabled={isSendingRecoveryEmail}
                        >
                            ×
                        </button>

                        <span className="client-modal__eyebrow">
                            Recuperar senha
                        </span>
                        <h2>Esqueceu sua senha?</h2>
                        <p>
                            Informe o mesmo e-mail usado no cadastro. Enviaremos
                            um link para você criar uma nova senha.
                        </p>

                        <form
                            className="client-auth-form"
                            onSubmit={submitPasswordRecoveryRequest}
                        >
                            <label>
                                E-mail
                                <input
                                    type="email"
                                    value={recoveryEmail}
                                    onChange={(event) =>
                                        setRecoveryEmail(event.target.value)
                                    }
                                    autoComplete="email"
                                    required
                                    autoFocus
                                />
                            </label>

                            {recoveryRequestError && (
                                <p className="client-auth-message is-error">
                                    {recoveryRequestError}
                                </p>
                            )}

                            {recoveryRequestSuccess && (
                                <p className="client-auth-message is-success">
                                    {recoveryRequestSuccess}
                                </p>
                            )}

                            <div className="client-recovery-actions">
                                <button
                                    className="client-auth-submit"
                                    type="submit"
                                    disabled={isSendingRecoveryEmail}
                                >
                                    {isSendingRecoveryEmail
                                        ? "Enviando..."
                                        : "Enviar link de recuperação"}
                                </button>

                                <button
                                    className="client-recovery-secondary"
                                    type="button"
                                    disabled={isSendingRecoveryEmail}
                                    onClick={() => {
                                        closePasswordRecoveryRequest();
                                        openClientAuth("login");
                                    }}
                                >
                                    Voltar para o login
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            );
}
