import {useEffect, useState} from "react";
import {supabase} from "../../lib/supabase";
import "./ProfilePhoto.css";

type Props = {profileId: string; name: string; path?: string | null; editable?: boolean; onSaved?: (path: string | null) => void; size?: number};

function errorMessage(error: unknown): string {
    const detail = error as {message?: string; status?: number; statusCode?: string | number; code?: string};
    const message = detail?.message ?? "";
    const status = Number(detail?.status ?? detail?.statusCode);
    if (status === 401 || /jwt expired|invalid jwt|token is expired/i.test(message)) return "Sua sessão expirou. Entre novamente e tente salvar a foto.";
    if (status === 403 || detail?.code === "42501" || /row-level security|permission denied|accessdenied/i.test(message)) return "Você não tem permissão para alterar esta foto. Confira sua conta e tente novamente.";
    return message || "Não foi possível atualizar a foto. Tente novamente.";
}

async function prepareImage(file: File, cropX: number, cropY: number): Promise<Blob> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
    if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter até 10 MB.");
    let source: CanvasImageSource;
    let width: number;
    let height: number;
    let release: () => void;
    if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file);
        source = bitmap; width = bitmap.width; height = bitmap.height; release = () => bitmap.close();
    } else {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.src = objectUrl;
        try { await image.decode(); } catch { URL.revokeObjectURL(objectUrl); throw new Error("Não foi possível abrir esta imagem."); }
        source = image; width = image.naturalWidth; height = image.naturalHeight; release = () => URL.revokeObjectURL(objectUrl);
    }
    const cropSize = Math.min(width, height);
    const sx = (width - cropSize) * cropX / 100;
    const sy = (height - cropSize) * cropY / 100;
    const outputSize = Math.min(1200, cropSize);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) {release(); throw new Error("Não foi possível preparar esta imagem.");}
    context.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, outputSize, outputSize);
    release();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível preparar esta imagem.")), "image/jpeg", 0.84));
}

function makeVersionedPhotoPath(profileId: string): string {
    let id = crypto.randomUUID?.();
    if (!id) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
        id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `${profileId}/photo-${id}.jpg`;
}

export default function ProfilePhoto({profileId, name, path, editable = false, onSaved, size = 56}: Props) {
    const [photo, setPhoto] = useState<{path: string; url: string} | null>(null);
    const [preview, setPreview] = useState("");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [cropX, setCropX] = useState(50);
    const [cropY, setCropY] = useState(50);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    useEffect(() => () => {if (preview) URL.revokeObjectURL(preview);}, [preview]);
    useEffect(() => {
        let alive = true;
        if (path) void supabase.storage.from("client-profile-photos").createSignedUrl(path, 3600).then(({data, error}) => {
            if (!alive) return;
            if (data?.signedUrl) setPhoto({path, url: data.signedUrl});
            if (error) setMessage(errorMessage(error));
        }).catch((error: unknown) => {if (alive) setMessage(errorMessage(error));});
        return () => {alive = false;};
    }, [path]);
    async function save(file?: File) {
        if (!file && !path) return;
        setBusy(true); setMessage("");
        let uploadedPath: string | null = null;
        let fileUploaded = false;
        let profilePathUpdated = false;
        let profilePathUpdateUncertain = false;
        try {
            if (file) {
                const {data: {session}, error: sessionError} = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!session) throw new Error("Sua sessão expirou. Entre novamente e tente salvar a foto.");
                const blob = await prepareImage(file, cropX, cropY);
                uploadedPath = makeVersionedPhotoPath(profileId);
                const {error} = await supabase.storage.from("client-profile-photos").upload(uploadedPath, blob, {contentType: "image/jpeg", cacheControl: "0"});
                if (error) throw error;
                fileUploaded = true;
                const {data: signed, error: signedError} = await supabase.storage.from("client-profile-photos").createSignedUrl(uploadedPath, 3600);
                if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Não foi possível verificar a leitura da foto enviada.");
                const {error: pathError, status: pathStatus} = await supabase.rpc("set_client_profile_photo_path", {p_client_id: profileId, p_photo_path: uploadedPath});
                if (pathError) {
                    if (pathStatus === 0) {
                        profilePathUpdateUncertain = true;
                        throw new Error("Não foi possível confirmar se a foto foi salva. Atualize a página antes de tentar novamente.");
                    }
                    throw pathError;
                }
                profilePathUpdated = true;
                onSaved?.(uploadedPath);
                setPhoto({path: uploadedPath, url: signed.signedUrl});
                setPreview(""); setPendingFile(null);
                if (path && path !== uploadedPath) {
                    const {error: removeError} = await supabase.storage.from("client-profile-photos").remove([path]);
                    if (removeError) {
                        console.error("A nova foto foi salva, mas o arquivo anterior não foi removido:", removeError);
                        setMessage("Foto atualizada, mas não foi possível remover o arquivo anterior.");
                        return;
                    }
                }
            } else {
                const {data: {session}, error: sessionError} = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!session) throw new Error("Sua sessão expirou. Entre novamente e tente remover a foto.");
                const {error: pathError} = await supabase.rpc("set_client_profile_photo_path", {p_client_id: profileId, p_photo_path: null});
                if (pathError) throw pathError;
                setPhoto(null);
                onSaved?.(null);
                const {error} = await supabase.storage.from("client-profile-photos").remove([path!]);
                if (error) {
                    console.error("A referência da foto foi removida, mas o arquivo não pôde ser excluído:", error);
                    setMessage("Foto removida do perfil, mas não foi possível excluir o arquivo armazenado.");
                    return;
                }
            }
            setPreview(""); setPendingFile(null); setMessage("Foto atualizada.");
        } catch (error) {
            let cleanupFailed = false;
            if (uploadedPath && fileUploaded && !profilePathUpdated && !profilePathUpdateUncertain) {
                const {error: cleanupError} = await supabase.storage.from("client-profile-photos").remove([uploadedPath]);
                if (cleanupError) {
                    cleanupFailed = true;
                    console.error("Não foi possível limpar o arquivo de foto que falhou:", cleanupError);
                }
            }
            setPreview(""); setPendingFile(null);
            setMessage(`${errorMessage(error)}${cleanupFailed ? " A foto anterior foi mantida, mas o arquivo temporário não foi removido." : ""}`);
        }
        finally { setBusy(false); }
    }
    return <section className="profile-photo" style={{"--profile-photo-size": `${size}px`} as React.CSSProperties}>
        {preview || (path && photo?.path === path && photo.url) ? <img src={preview || photo?.url || ""} alt={`Foto de ${name}`} style={preview ? {objectPosition: `${cropX}% ${cropY}%`} : undefined} /> : <span aria-hidden="true" />}
        {editable && <section className="profile-photo__controls" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><label>{pendingFile ? "Escolher outra" : path ? "Alterar foto" : "Adicionar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {const file = event.target.files?.[0]; if (!file) return; setMessage(""); setCropX(50); setCropY(50); setPendingFile(file); setPreview(URL.createObjectURL(file)); event.currentTarget.value = "";}} /></label>{pendingFile && <><label className="profile-photo__crop">Horizontal<input aria-label="Ajustar enquadramento horizontal" type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} /></label><label className="profile-photo__crop">Vertical<input aria-label="Ajustar enquadramento vertical" type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} /></label><button type="button" disabled={busy} onClick={() => void save(pendingFile)}>{busy ? "Enviando…" : "Salvar foto"}</button><button type="button" disabled={busy} onClick={() => {setPendingFile(null); setPreview("");}}>Cancelar</button></>}{path && !pendingFile && <button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Removendo…" : "Remover"}</button>}</section>}
        {message && <small role="status">{message}</small>}
    </section>;
}
