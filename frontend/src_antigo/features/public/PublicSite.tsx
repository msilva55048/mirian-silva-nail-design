import {PublicSiteProvider} from "./context/PublicSiteContext";
import PublicSiteContent from "./components/PublicSiteContent";
import {usePublicSiteController} from "./controller/usePublicSiteController";

export default function PublicSite() {
    const controller = usePublicSiteController();

    return (
        <PublicSiteProvider value={controller}>
            <PublicSiteContent/>
        </PublicSiteProvider>
    );
}
