import {usePublicSiteContext} from "../context/PublicSiteContext";
import ClientLoggedPage from "../views/ClientLoggedPage";
import PublicLandingPage from "../views/PublicLandingPage";
import ClientAuthModal from "../modals/ClientAuthModal";
import PasswordRecoveryRequestModal from "../modals/PasswordRecoveryRequestModal";
import PasswordRecoveryResetModal from "../modals/PasswordRecoveryResetModal";
import ClientAccountModal from "../modals/ClientAccountModal";
import ClientProfileEditorModal from "../modals/ClientProfileEditorModal";

export default function PublicSiteContent() {
    const {
        clientAccountStyles,
        clientProfile,
        clientUserId,
        showClientAccount,
        showClientAuth,
        showClientProfileEditor,
        showPasswordRecoveryRequest,
        showPasswordRecoveryReset,
    } = usePublicSiteContext();
return (
        <main className="home">
            <style>{clientAccountStyles}</style>
            <style>{`
                @media (max-width: 700px) {
                    .home {
                        min-height: 100%;
                        width: 100%;
                        max-width: 100%;
                        overflow-x: hidden;
                    }

                    @supports (height: 100svh) {
                        .home {
                            min-height: 100svh;
                        }
                    }

                    @media (display-mode: standalone), (display-mode: fullscreen) {
                        .home {
                            min-height: 100%;
                        }
                    }

                    html,
                    body,
                    #root {
                        width: 100%;
                        max-width: 100%;
                        overflow-x: hidden;
                    }

                    .home,
                    .home > * {
                        max-width: 100%;
                        box-sizing: border-box;
                    }

                    .home > .hero,
                    .home > .hero *,
                    .home > .hero *::before,
                    .home > .hero *::after {
                        animation: none !important;
                        animation-delay: 0s !important;
                    }

                    .home > .hero {
                        min-height: auto !important;
                        height: auto !important;
                        padding-bottom: 28px !important;
                        margin-bottom: 0 !important;
                        box-sizing: border-box;
                    }

                    .home > .hero .hero__content {
                        padding-bottom: 0 !important;
                        margin-bottom: 0 !important;
                    }

                    .home > .hero .hero__content > div:last-of-type {
                        margin-bottom: 0 !important;
                    }
                }
            `}</style>

            {clientUserId && clientProfile ? <ClientLoggedPage/> : <PublicLandingPage/>}


            {showClientAuth && <ClientAuthModal/>} 

            {showPasswordRecoveryRequest && <PasswordRecoveryRequestModal/>} 

            {showPasswordRecoveryReset && <PasswordRecoveryResetModal/>} 

            {showClientAccount && clientUserId && <ClientAccountModal/>} 

            {showClientProfileEditor && clientProfile && <ClientProfileEditorModal/>} 
        </main>
    );
}
