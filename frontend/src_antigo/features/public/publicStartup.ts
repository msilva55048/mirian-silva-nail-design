export {};

declare global {
    interface Navigator {
        standalone?: boolean;
    }
}

const IS_PUBLIC_ROUTE =
    typeof window !== "undefined" &&
    !window.location.pathname.toLowerCase().startsWith("/admin");

const IS_BROWSER_SHORTCUT_MODE =
    typeof window !== "undefined" &&
    (
        window.matchMedia?.("(display-mode: standalone)").matches === true ||
        window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
        window.navigator.standalone === true
    );

if (IS_PUBLIC_ROUTE && typeof document !== "undefined") {
    /*
     * Executa no carregamento do módulo, antes da primeira renderização do React.
     * Evita que Android Chrome e iOS Safari restaurem uma viewport/rolagem antiga
     * por alguns frames quando o site é aberto ou atualizado pelo atalho.
     */
    try {
        window.history.scrollRestoration = "manual";
    } catch {
        // Alguns WebViews podem não permitir alterar scrollRestoration.
    }

    const startupStyleId = "mirian-public-startup-stability";

    if (!document.getElementById(startupStyleId)) {
        const startupStyle = document.createElement("style");
        startupStyle.id = startupStyleId;
        startupStyle.textContent = `
            html.mirian-public-starting,
            html.mirian-public-starting body {
                overflow: hidden !important;
                overscroll-behavior: none;
            }

            html,
            body,
            #root {
                margin: 0;
                width: 100%;
                max-width: 100%;
                min-height: 100%;
                overflow-x: hidden;
            }

            @supports (overflow: clip) {
                html,
                body,
                #root {
                    overflow-x: clip;
                }
            }

            @media (max-width: 700px) {
                .home {
                    width: 100%;
                    max-width: 100%;
                    min-height: 100%;
                    overflow-x: hidden;
                }

                .home > .hero {
                    min-height: auto !important;
                    height: auto !important;
                    padding-bottom: 28px !important;
                    margin-bottom: 0 !important;
                    box-sizing: border-box;
                }

                .home > .hero,
                .home > .hero *,
                .home > .hero *::before,
                .home > .hero *::after {
                    animation: none !important;
                    animation-delay: 0s !important;
                }
            }

            @media (display-mode: standalone), (display-mode: fullscreen) {
                html,
                body,
                #root,
                .home {
                    min-height: 100%;
                }

                body {
                    padding-top: env(safe-area-inset-top, 0px);
                    padding-right: env(safe-area-inset-right, 0px);
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                    padding-left: env(safe-area-inset-left, 0px);
                    box-sizing: border-box;
                }
            }
        `;
        document.head.appendChild(startupStyle);
    }

    document.documentElement.classList.add("mirian-public-starting");

    const finishPublicStartup = () => {
        window.scrollTo({top: 0, left: 0, behavior: "auto"});

        window.requestAnimationFrame(() => {
            window.scrollTo({top: 0, left: 0, behavior: "auto"});

            window.requestAnimationFrame(() => {
                window.scrollTo({top: 0, left: 0, behavior: "auto"});
                document.documentElement.classList.remove("mirian-public-starting");
            });
        });
    };

    /*
     * pageshow cobre inclusive restauração de página do Safari/iOS e Chrome.
     * O primeiro requestAnimationFrame cobre carregamento normal e refresh.
     */
    window.addEventListener("pageshow", finishPublicStartup, {once: true});
    window.requestAnimationFrame(finishPublicStartup);

    if (IS_BROWSER_SHORTCUT_MODE) {
        /*
         * Em modo atalho/standalone, reforça somente durante a inicialização.
         * Não mexemos na rolagem depois que a pessoa começa a usar o site.
         */
        window.setTimeout(() => {
            if (document.documentElement.classList.contains("mirian-public-starting")) {
                finishPublicStartup();
            }
        }, 120);
    }
}
