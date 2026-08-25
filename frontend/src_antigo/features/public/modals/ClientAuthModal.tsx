import {usePublicSiteContext} from "../context/PublicSiteContext";

export default function ClientAuthModal() {
    const {
        authEmail,
        authError,
        authFullName,
        authPassword,
        authPhone,
        authSuccess,
        clientAuthMode,
        formatBrazilianPhone,
        isSubmittingAuth,
        openPasswordRecoveryRequest,
        resetAuthMessages,
        setAuthEmail,
        setAuthFullName,
        setAuthPassword,
        setAuthPhone,
        setClientAuthMode,
        setShowAuthPassword,
        setShowClientAuth,
        showAuthPassword,
        submitClientAuth,
    } = usePublicSiteContext();

    return (
                <div className="client-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowClientAuth(false);
                }}>
                    <section className="client-modal">
                        <button className="client-modal__close" type="button" onClick={() => setShowClientAuth(false)}>×</button>
                        <span className="client-modal__eyebrow">Área da cliente</span>
                        <h2>{clientAuthMode === "login" ? "Entrar na sua conta" : "Criar sua conta"}</h2>
                        <p>
                            {clientAuthMode === "login"
                                ? "Acesse seus agendamentos usando seu e-mail e senha."
                                : "Crie sua conta para manter seus agendamentos vinculados ao seu perfil."}
                        </p>

                        <div className="client-auth-tabs">
                            <button
                                className={clientAuthMode === "login" ? "is-active" : ""}
                                type="button"
                                onClick={() => {
                                    setClientAuthMode("login");
                                    setShowAuthPassword(false);
                                    resetAuthMessages();
                                }}
                            >
                                Entrar
                            </button>
                            <button
                                className={clientAuthMode === "signup" ? "is-active" : ""}
                                type="button"
                                onClick={() => {
                                    setClientAuthMode("signup");
                                    setShowAuthPassword(false);
                                    resetAuthMessages();
                                }}
                            >
                                Criar conta
                            </button>
                        </div>

                        <form className="client-auth-form" onSubmit={submitClientAuth}>
                            {clientAuthMode === "signup" && (
                                <>
                                    <label>
                                        Nome completo
                                        <input
                                            value={authFullName}
                                            onChange={(event) => setAuthFullName(event.target.value)}
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
                                            value={authPhone}
                                            onChange={(event) => setAuthPhone(formatBrazilianPhone(event.target.value))}
                                            placeholder="(00) 00000-0000"
                                            maxLength={15}
                                            autoComplete="tel"
                                            required
                                        />
                                    </label>
                                </>
                            )}

                            <label>
                                E-mail
                                <input
                                    type="email"
                                    value={authEmail}
                                    onChange={(event) => setAuthEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Senha
                                <div className="client-password-field">
                                    <input
                                        type={showAuthPassword ? "text" : "password"}
                                        value={authPassword}
                                        onChange={(event) => setAuthPassword(event.target.value)}
                                        autoComplete={clientAuthMode === "login" ? "current-password" : "new-password"}
                                        minLength={6}
                                        required
                                    />
                                    <button
                                        className="client-password-toggle"
                                        type="button"
                                        onClick={() => setShowAuthPassword((current) => !current)}
                                        aria-label={showAuthPassword ? "Ocultar senha" : "Mostrar senha"}
                                    >
                                        {showAuthPassword ? "Ocultar" : "Mostrar"}
                                    </button>
                                </div>
                            </label>

                            {clientAuthMode === "login" && (
                                <button
                                    className="client-forgot-password"
                                    type="button"
                                    onClick={openPasswordRecoveryRequest}
                                >
                                    Esqueci minha senha
                                </button>
                            )}

                            {authError && <p className="client-auth-message is-error">{authError}</p>}
                            {authSuccess && <p className="client-auth-message is-success">{authSuccess}</p>}

                            <button className="client-auth-submit" type="submit" disabled={isSubmittingAuth}>
                                {isSubmittingAuth
                                    ? "Aguarde..."
                                    : clientAuthMode === "login"
                                        ? "Entrar"
                                        : "Criar minha conta"}
                            </button>
                        </form>
                    </section>
                </div>
            );
}
