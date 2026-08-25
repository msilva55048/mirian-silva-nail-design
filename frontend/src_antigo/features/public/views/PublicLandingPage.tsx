import {usePublicSiteContext} from "../context/PublicSiteContext";

export default function PublicLandingPage() {
    const {
        openClientAuth,
    } = usePublicSiteContext();

    return (
                <>
                    <section className="hero" id="inicio">
                        <div className="hero__overlay"/>

                        <header className="navbar">
                            <a className="brand" href="#inicio">
                                <span className="brand__symbol">
                                    <img
                                        src="/logo-mirian.png"
                                        alt="Logo Mirian Silva Nail Design"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            borderRadius: "50%",
                                            display: "block",
                                        }}
                                    />
                                </span>
                                <span className="brand__text">
                                    <strong>Mirian Silva</strong>
                                    <small>Nail Design</small>
                                </span>
                            </a>

                            <a className="navbar__button" href="/admin">
                                Login ADM
                            </a>
                        </header>

                        <div className="hero__content">
                            <span className="hero__eyebrow">Beleza em cada detalhe</span>
                            <h1>Mirian Silva<span>Nail Design</span></h1>
                            <p>Cuidados exclusivos para unhas elegantes, saudáveis e cheias de personalidade.</p>

                            <div className="hero__actions">
                                <button
                                    className="button button--primary"
                                    type="button"
                                    onClick={() => openClientAuth("signup")}
                                >
                                    Criar conta / Entrar
                                </button>

                                <a
                                    className="button button--instagram"
                                    href="https://www.instagram.com/nails.mirian.silva/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Instagram
                                </a>

                                <a
                                    className="button button--whatsapp"
                                    href="https://wa.me/5548998074518?text=Olá%2C%20Mirian!%20Gostaria%20de%20mais%20informações%20sobre%20os%20serviços."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    WhatsApp
                                </a>
                            </div>

                            <div
                                style={{
                                    marginTop: "42px",
                                    paddingTop: "26px",
                                    textAlign: "center",
                                }}
                            >
                                <strong
                                    style={{
                                        display: "block",
                                        fontFamily:
                                            '"Cormorant Garamond", Georgia, "Times New Roman", serif',
                                        fontSize:
                                            "clamp(1.75rem, 6.4vw, 3.2rem)",
                                        fontWeight: 500,
                                        fontStyle: "italic",
                                        letterSpacing: "-0.015em",
                                        lineHeight: 1.02,
                                        color: "#c77f91",
                                    }}
                                >
                                    Suas unhas. Sua marca.
                                </strong>

                                <span
                                    style={{
                                        display: "block",
                                        marginTop: "16px",
                                        fontSize:
                                            "clamp(1.18rem, 4.3vw, 1.48rem)",
                                        fontWeight: 800,
                                        letterSpacing: "0.02em",
                                        lineHeight: 1.3,
                                        color: "#6d4a55",
                                    }}
                                >
                                    O detalhe que completa você
                                </span>
                            </div>

                            <div
                                style={{
                                    marginTop: "34px",
                                    paddingTop: "18px",
                                    textAlign: "center",
                                    color: "#000000",
                                    fontSize: "clamp(0.95rem, 3.2vw, 1.08rem)",
                                    fontWeight: 700,
                                    letterSpacing: "0.02em",
                                    lineHeight: 1.3,
                                }}
                            >
                                Desenvolvido por{" "}
                                <a
                                    href="https://www.instagram.com/msilva55048/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: "inherit",
                                        textDecoration: "none",
                                        fontWeight: "inherit",
                                    }}
                                >
                                    @msilva55048
                                </a>
                            </div>
                        </div>

                        <div className="hero__decoration hero__decoration--one"/>
                        <div className="hero__decoration hero__decoration--two"/>
                    </section>
                </>
            );
}
