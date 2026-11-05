import {useState} from "react";
import {createRoot} from "react-dom/client";
import ProfilePhoto from "../../src/features/shared/ProfilePhoto";

const params = new URLSearchParams(window.location.search);
const profileId = params.get("profileId") ?? "11111111-1111-4111-8111-111111111111";
const storageKey = `test-profile-photo:${profileId}`;

function Harness() {
    const [expanded, setExpanded] = useState(true);
    const [path, setPath] = useState(() => params.get("path") ?? localStorage.getItem(storageKey));

    return <main className="admin-page" style={{maxWidth: 760, margin: "32px auto", padding: 20}}>
        <article
            id="client-card"
            className={`admin-client-card admin-client-card--collapsible${expanded ? " is-expanded" : ""}`}
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded((current) => !current);
                }
            }}
        >
            <h2>Perfil de teste</h2>
            {expanded ? <ProfilePhoto
                profileId={profileId}
                name="Cliente de teste"
                path={path}
                editable
                onSaved={(nextPath) => {
                    if (nextPath) localStorage.setItem(storageKey, nextPath);
                    else localStorage.removeItem(storageKey);
                    setPath(nextPath);
                }}
            /> : <div id="collapsed-card">Cartão recolhido</div>}
        </article>
        <output id="profile-path" data-testid="profile-path">{path ?? "sem foto"}</output>
    </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
