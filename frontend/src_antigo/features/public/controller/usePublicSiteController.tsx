import {useEffect, useMemo, useState} from "react";
import {supabase} from "../../../lib/supabase";
import {
    type Appointment,
    type ScheduleBlock,
    type ScheduleTimeOverride,
    type Service,
    fallbackServices,
    formatBrazilianPhone,
    formatCurrency,
    formatDateForInput,
    formatDuration,
    getConfiguredClientStartMinutes,
    intervalsOverlap,
    MIRIAN_ADMIN_EMAIL,
    mergeIntervals,
    minutesToTime,
    timeToMinutes,
} from "../../../shared/domain";
import {type PublicClientAppointment, type PublicClientProfile} from "../types";
import {clientAccountStyles} from "../styles";

export function usePublicSiteController() {
const [bookingStep, setBookingStep] = useState(1);
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [selectedService, setSelectedService] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [bookingError, setBookingError] = useState("");
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
    const [scheduleTimeOverrides, setScheduleTimeOverrides] = useState<ScheduleTimeOverride[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
    const [services, setServices] = useState<Service[]>(fallbackServices);
    const [clientUserId, setClientUserId] = useState<string | null>(null);
    const [clientUserEmail, setClientUserEmail] = useState("");
    const [clientProfile, setClientProfile] = useState<PublicClientProfile | null>(null);
    const [clientAppointments, setClientAppointments] = useState<PublicClientAppointment[]>([]);
    const [, setIsCheckingClientSession] = useState(true);
    const [isLoadingClientAccount, setIsLoadingClientAccount] = useState(false);
    const [showClientAuth, setShowClientAuth] = useState(false);
    const [showClientAccount, setShowClientAccount] = useState(false);
    const [showClientProfileEditor, setShowClientProfileEditor] = useState(false);
    const [profileEditName, setProfileEditName] = useState("");
    const [profileEditPhone, setProfileEditPhone] = useState("");
    const [profileEditEmail, setProfileEditEmail] = useState("");
    const [profileEditPassword, setProfileEditPassword] = useState("");
    const [profileEditPasswordConfirm, setProfileEditPasswordConfirm] = useState("");
    const [showProfileEditPassword, setShowProfileEditPassword] = useState(false);
    const [profileEditError, setProfileEditError] = useState("");
    const [profileEditSuccess, setProfileEditSuccess] = useState("");
    const [isSavingProfileEdit, setIsSavingProfileEdit] = useState(false);
    const [, setFocusClientAppointments] = useState(false);
    const [clientAuthMode, setClientAuthMode] = useState<"login" | "signup">("login");
    const [authFullName, setAuthFullName] = useState("");
    const [authPhone, setAuthPhone] = useState("");
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [showAuthPassword, setShowAuthPassword] = useState(false);
    const [authError, setAuthError] = useState("");
    const [authSuccess, setAuthSuccess] = useState("");
    const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

    const [showPasswordRecoveryRequest, setShowPasswordRecoveryRequest] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState("");
    const [recoveryRequestError, setRecoveryRequestError] = useState("");
    const [recoveryRequestSuccess, setRecoveryRequestSuccess] = useState("");
    const [isSendingRecoveryEmail, setIsSendingRecoveryEmail] = useState(false);

    const [showPasswordRecoveryReset, setShowPasswordRecoveryReset] = useState(false);
    const [recoverySessionUserId, setRecoverySessionUserId] = useState<string | null>(null);
    const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
    const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
    const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
    const [recoveryResetError, setRecoveryResetError] = useState("");
    const [recoveryResetSuccess, setRecoveryResetSuccess] = useState("");
    const [isUpdatingRecoveryPassword, setIsUpdatingRecoveryPassword] = useState(false);
    const [editingClientAppointment, setEditingClientAppointment] = useState<PublicClientAppointment | null>(null);
    const [isCancellingClientAppointment, setIsCancellingClientAppointment] = useState(false);
    const [weekReferenceDate, setWeekReferenceDate] = useState(() => formatDateForInput(new Date()));
    const [showMonthCalendar, setShowMonthCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    function normalizeRpcRow<T>(data: T | T[] | null): T | null {
        if (!data) return null;
        return Array.isArray(data) ? (data[0] ?? null) : data;
    }

    async function loadClientAppointments(profileId: string) {
        const {data, error} = await supabase.rpc("get_my_client_appointments");

        if (error) {
            console.error("Erro ao carregar agendamentos da cliente:", error);
            setClientAppointments([]);
            return;
        }

        const loaded = ((data ?? []) as PublicClientAppointment[])
            .filter((appointment) => appointment.client_id === profileId)
            .sort((a, b) => {
                const first = new Date(`${a.appointment_date}T${String(a.start_time).slice(0, 5)}:00`).getTime();
                const second = new Date(`${b.appointment_date}T${String(b.start_time).slice(0, 5)}:00`).getTime();
                return second - first;
            });

        setClientAppointments(loaded);
    }

    async function resolveClientProfile(user: {id: string; email?: string | null; user_metadata?: Record<string, unknown>}) {
        const {data: profileData, error: profileError} = await supabase.rpc("get_my_client_profile");

        if (profileError) {
            console.error("Erro ao carregar perfil da cliente:", profileError);
        }

        let profile = normalizeRpcRow<PublicClientProfile>(profileData as PublicClientProfile[] | PublicClientProfile | null);

        if (!profile) {
            const metadata = user.user_metadata ?? {};
            const metadataName = typeof metadata.full_name === "string" ? metadata.full_name : "";
            const metadataPhone = typeof metadata.phone === "string" ? metadata.phone : "";

            if (metadataName && metadataPhone) {
                const {data: claimedData, error: claimError} = await supabase.rpc("claim_client_profile", {
                    p_full_name: metadataName,
                    p_phone: metadataPhone,
                    p_email: user.email ?? null,
                });

                if (claimError) {
                    console.error("Erro ao vincular perfil da cliente:", claimError);
                    setAuthError("Sua conta foi autenticada, mas não foi possível vincular o perfil. Fale com a Mirian.");
                } else {
                    profile = normalizeRpcRow<PublicClientProfile>(claimedData as PublicClientProfile[] | PublicClientProfile | null);
                }
            }
        }

        setClientProfile(profile);

        if (profile) {
            setClientName(profile.full_name);
            setClientPhone(formatBrazilianPhone(profile.phone));
            await loadClientAppointments(profile.id);
        } else {
            setClientAppointments([]);
        }

        return profile;
    }

    async function loadAuthenticatedClient(user: {id: string; email?: string | null; user_metadata?: Record<string, unknown>}) {
        setIsLoadingClientAccount(true);
        setClientUserId(user.id);
        setClientUserEmail(user.email ?? "");
        await resolveClientProfile(user);
        setIsLoadingClientAccount(false);
    }

    useEffect(() => {
        let mounted = true;

        async function initializeClientSession() {
            const {data: {session}} = await supabase.auth.getSession();

            if (!mounted) return;

            if (session?.user) {
                await loadAuthenticatedClient(session.user);
            } else {
                setClientUserId(null);
                setClientUserEmail("");
                setClientProfile(null);
                setClientAppointments([]);
            }

            if (mounted) setIsCheckingClientSession(false);
        }

        void initializeClientSession();

        const {data: authListener} = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                setRecoverySessionUserId(session?.user?.id ?? null);
                setShowClientAuth(false);
                setShowClientAccount(false);
                setShowPasswordRecoveryRequest(false);
                setRecoveryNewPassword("");
                setRecoveryConfirmPassword("");
                setShowRecoveryPassword(false);
                setRecoveryResetError("");
                setRecoveryResetSuccess("");
                setShowPasswordRecoveryReset(true);
            }

            window.setTimeout(() => {
                if (!mounted) return;

                if (session?.user) {
                    void loadAuthenticatedClient(session.user);
                } else {
                    setClientUserId(null);
                    setClientUserEmail("");
                    setClientProfile(null);
                    setClientAppointments([]);
                    setShowClientAccount(false);
                }

                setIsCheckingClientSession(false);
            }, 0);
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    function resetAuthMessages() {
        setAuthError("");
        setAuthSuccess("");
    }

    function openClientAuth(mode: "login" | "signup") {
        setClientAuthMode(mode);
        setShowAuthPassword(false);
        resetAuthMessages();
        setShowClientAuth(true);
    }

    function openPasswordRecoveryRequest() {
        setRecoveryEmail(authEmail.trim().toLowerCase());
        setRecoveryRequestError("");
        setRecoveryRequestSuccess("");
        setShowClientAuth(false);
        setShowPasswordRecoveryRequest(true);
    }

    function closePasswordRecoveryRequest() {
        if (isSendingRecoveryEmail) return;

        setShowPasswordRecoveryRequest(false);
        setRecoveryRequestError("");
        setRecoveryRequestSuccess("");
    }

    async function submitPasswordRecoveryRequest(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const email = recoveryEmail.trim().toLowerCase();

        setRecoveryRequestError("");
        setRecoveryRequestSuccess("");

        if (!email) {
            setRecoveryRequestError("Informe o e-mail usado no cadastro.");
            return;
        }

        setIsSendingRecoveryEmail(true);

        try {
            const redirectTo = `${window.location.origin}/?password-recovery=1`;

            const {error} = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
            });

            if (error) {
                console.error("Erro ao solicitar recuperação de senha:", error);
                throw error;
            }

            setRecoveryRequestSuccess(
                "Se existir uma conta com esse e-mail, você receberá um link para criar uma nova senha. Confira também a pasta de spam.",
            );
        } catch (error) {
            console.error("Erro na recuperação de senha:", error);
            setRecoveryRequestError(
                "Não foi possível enviar o e-mail de recuperação agora. Tente novamente em alguns minutos.",
            );
        } finally {
            setIsSendingRecoveryEmail(false);
        }
    }

    function closePasswordRecoveryReset() {
        if (isUpdatingRecoveryPassword) return;

        setShowPasswordRecoveryReset(false);
        setRecoverySessionUserId(null);
        setRecoveryNewPassword("");
        setRecoveryConfirmPassword("");
        setShowRecoveryPassword(false);
        setRecoveryResetError("");
        setRecoveryResetSuccess("");

        const cleanUrl = `${window.location.pathname}${window.location.search
            .replace(/[?&]password-recovery=1(&|$)/, "$1")
            .replace(/[?&]$/, "")}`;

        window.history.replaceState(
            {},
            document.title,
            cleanUrl || "/",
        );
    }

    async function ensurePasswordRecoverySession() {
        const {
            data: {session},
            error,
        } = await supabase.auth.getSession();

        if (error) {
            console.error("Erro ao verificar sessão de recuperação:", error);
            return null;
        }

        if (!session?.user) {
            return null;
        }

        if (
            recoverySessionUserId &&
            session.user.id !== recoverySessionUserId
        ) {
            console.error(
                "A sessão atual não corresponde ao usuário que abriu o link de recuperação.",
            );
            return null;
        }

        setRecoverySessionUserId(session.user.id);
        return session;
    }

    async function submitPasswordRecoveryReset(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setRecoveryResetError("");
        setRecoveryResetSuccess("");

        if (recoveryNewPassword.length < 6) {
            setRecoveryResetError(
                "A nova senha precisa ter pelo menos 6 caracteres.",
            );
            return;
        }

        if (recoveryNewPassword !== recoveryConfirmPassword) {
            setRecoveryResetError("As duas senhas precisam ser iguais.");
            return;
        }

        setIsUpdatingRecoveryPassword(true);

        try {
            const recoverySession = await ensurePasswordRecoverySession();

            if (!recoverySession?.user) {
                setRecoveryResetError(
                    "O link de recuperação não criou uma sessão válida. Solicite um novo link, abra o e-mail mais recente e faça a troca nesse mesmo navegador.",
                );
                return;
            }

            const {error} = await supabase.auth.updateUser({
                password: recoveryNewPassword,
            });

            if (error) {
                console.error("Erro ao atualizar senha:", error);
                throw error;
            }

            setRecoverySessionUserId(recoverySession.user.id);
            setRecoveryNewPassword("");
            setRecoveryConfirmPassword("");
            setRecoveryResetSuccess(
                "Senha alterada com sucesso. Sua conta já está pronta para usar.",
            );

            window.history.replaceState(
                {},
                document.title,
                window.location.pathname || "/",
            );
        } catch (error) {
            console.error("Erro ao salvar nova senha:", error);

            const originalMessage =
                error instanceof Error
                    ? error.message
                    : "Não foi possível alterar a senha.";

            const message = originalMessage.toLowerCase();

            if (
                message.includes("different from the old password") ||
                message.includes("same password") ||
                message.includes("new password should be different")
            ) {
                setRecoveryResetError(
                    "A nova senha precisa ser diferente da senha anterior.",
                );
            } else if (
                message.includes("session") ||
                message.includes("jwt") ||
                message.includes("token") ||
                message.includes("auth session missing")
            ) {
                setRecoveryResetError(
                    "A sessão de recuperação não está válida. Solicite um novo link e abra somente o e-mail mais recente.",
                );
            } else if (
                message.includes("password") &&
                message.includes("characters")
            ) {
                setRecoveryResetError(
                    "A senha não atende aos requisitos do Supabase. Escolha outra senha com pelo menos 6 caracteres.",
                );
            } else {
                setRecoveryResetError(
                    `Não foi possível alterar a senha: ${originalMessage}`,
                );
            }
        } finally {
            setIsUpdatingRecoveryPassword(false);
        }
    }

    async function submitClientAuth(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        resetAuthMessages();

        const email = authEmail.trim().toLowerCase();
        const password = authPassword;
        const phoneDigits = authPhone.replace(/\D/g, "");
        const fullName = authFullName.trim().replace(/\s+/g, " ");

        if (!email || !password) {
            setAuthError("Informe e-mail e senha.");
            return;
        }

        if (password.length < 6) {
            setAuthError("A senha precisa ter pelo menos 6 caracteres.");
            return;
        }

        if (clientAuthMode === "signup") {
            if (fullName.length < 3) {
                setAuthError("Informe seu nome completo.");
                return;
            }

            if (phoneDigits.length < 10 || phoneDigits.length > 11) {
                setAuthError("Informe um telefone válido com DDD.");
                return;
            }
        }

        setIsSubmittingAuth(true);

        try {
            if (clientAuthMode === "signup") {
                const formattedPhone = formatBrazilianPhone(phoneDigits);

                // A Mirian já possui uma conta no Supabase Auth usada pelo painel ADM.
                // Em vez de tentar criar um segundo usuário com o mesmo e-mail,
                // autenticamos a conta existente e vinculamos também um perfil de cliente.
                if (email === MIRIAN_ADMIN_EMAIL) {
                    const {data: adminClientData, error: adminClientError} =
                        await supabase.auth.signInWithPassword({
                            email,
                            password,
                        });

                    if (adminClientError || !adminClientData.user) {
                        setAuthError(
                            "Para cadastrar a Mirian como cliente, informe a mesma senha usada no acesso ADM.",
                        );
                        return;
                    }

                    const {error: claimError} = await supabase.rpc("claim_client_profile", {
                        p_full_name: fullName,
                        p_phone: formattedPhone,
                        p_email: email,
                    });

                    if (claimError) {
                        console.error("Erro ao criar/vincular o perfil de cliente da Mirian:", claimError);
                        throw claimError;
                    }

                    await loadAuthenticatedClient(adminClientData.user);
                    setShowClientAuth(false);
                    setShowClientAccount(false);
                    setShowAuthPassword(false);
                    setAuthPassword("");
                    return;
                }

                const {data, error} = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            phone: formattedPhone,
                        },
                    },
                });

                if (error) throw error;

                if (data.session?.user) {
                    await loadAuthenticatedClient(data.session.user);
                    setShowClientAuth(false);
                    setShowClientAccount(false);
                    setShowAuthPassword(false);
                    setAuthPassword("");
                } else {
                    setAuthSuccess("Conta criada. Confira seu e-mail para confirmar o cadastro e depois faça login.");
                    setAuthPassword("");
                }
            } else {
                const {data, error} = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                if (data.user) {
                    await loadAuthenticatedClient(data.user);
                }

                setShowClientAuth(false);
                setShowClientAccount(false);
                setShowAuthPassword(false);
                setAuthPassword("");
            }
        } catch (error) {
            console.error("Erro na autenticação da cliente:", error);
            setAuthError(
                clientAuthMode === "signup"
                    ? "Não foi possível criar a conta. Verifique os dados ou tente outro e-mail."
                    : "E-mail ou senha inválidos.",
            );
        } finally {
            setIsSubmittingAuth(false);
        }
    }

    function openClientProfileEditor() {
        if (!clientProfile) return;

        setProfileEditName(clientProfile.full_name);
        setProfileEditPhone(formatBrazilianPhone(clientProfile.phone));
        setProfileEditEmail(clientProfile.email || clientUserEmail);
        setProfileEditPassword("");
        setProfileEditPasswordConfirm("");
        setShowProfileEditPassword(false);
        setProfileEditError("");
        setProfileEditSuccess("");
        setShowClientProfileEditor(true);
    }

    function closeClientProfileEditor() {
        if (isSavingProfileEdit) return;

        setShowClientProfileEditor(false);
        setProfileEditPassword("");
        setProfileEditPasswordConfirm("");
        setProfileEditError("");
        setProfileEditSuccess("");
    }

    async function saveClientProfileChanges(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!clientProfile || !clientUserId) return;

        setProfileEditError("");
        setProfileEditSuccess("");

        const fullName = profileEditName.trim().replace(/\s+/g, " ");
        const phone = formatBrazilianPhone(profileEditPhone);
        const phoneDigits = phone.replace(/\D/g, "");
        const email = profileEditEmail.trim().toLowerCase();
        const newPassword = profileEditPassword;

        if (fullName.length < 3) {
            setProfileEditError("Informe seu nome completo.");
            return;
        }

        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
            setProfileEditError("Informe um telefone válido com DDD.");
            return;
        }

        if (!email || !email.includes("@")) {
            setProfileEditError("Informe um e-mail válido.");
            return;
        }

        if (newPassword && newPassword.length < 6) {
            setProfileEditError("A nova senha precisa ter pelo menos 6 caracteres.");
            return;
        }

        if (newPassword !== profileEditPasswordConfirm) {
            setProfileEditError("A confirmação da nova senha não confere.");
            return;
        }

        setIsSavingProfileEdit(true);

        try {
            const {data: profileData, error: profileError} = await supabase.rpc(
                "update_my_client_profile",
                {
                    p_full_name: fullName,
                    p_phone: phone,
                    p_email: email,
                },
            );

            if (profileError) {
                throw profileError;
            }

            const updatedProfile = normalizeRpcRow<PublicClientProfile>(
                profileData as
                    | PublicClientProfile[]
                    | PublicClientProfile
                    | null,
            );

            if (!updatedProfile) {
                throw new Error("O perfil atualizado não foi retornado.");
            }

            const authUpdates: {
                email?: string;
                password?: string;
                data: {
                    full_name: string;
                    phone: string;
                };
            } = {
                data: {
                    full_name: fullName,
                    phone,
                },
            };

            if (email !== clientUserEmail.trim().toLowerCase()) {
                authUpdates.email = email;
            }

            if (newPassword) {
                authUpdates.password = newPassword;
            }

            const {data: authData, error: authError} =
                await supabase.auth.updateUser(authUpdates);

            if (authError) {
                throw authError;
            }

            setClientProfile(updatedProfile);
            setClientName(updatedProfile.full_name);
            setClientPhone(formatBrazilianPhone(updatedProfile.phone));
            setClientUserEmail(
                authData.user?.email ?? updatedProfile.email ?? email,
            );

            await loadClientAppointments(updatedProfile.id);

            setProfileEditPassword("");
            setProfileEditPasswordConfirm("");

            const emailChanged =
                email !== clientUserEmail.trim().toLowerCase();

            setProfileEditSuccess(
                emailChanged
                    ? "Perfil atualizado. Se o Supabase solicitar confirmação do novo e-mail, confirme pelo link recebido."
                    : "Perfil atualizado com sucesso.",
            );
        } catch (error) {
            console.error("Erro ao atualizar perfil da cliente:", error);

            const message =
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar o perfil.";

            if (
                message.toLowerCase().includes("duplicate") ||
                message.toLowerCase().includes("already") ||
                message.toLowerCase().includes("unique")
            ) {
                setProfileEditError(
                    "Este telefone ou e-mail já está vinculado a outra conta.",
                );
            } else {
                setProfileEditError(
                    "Não foi possível atualizar o perfil. Confira os dados e tente novamente.",
                );
            }
        } finally {
            setIsSavingProfileEdit(false);
        }
    }

    async function logoutClient() {
        await supabase.auth.signOut();
        setShowClientAccount(false);
        setShowClientProfileEditor(false);
        setClientProfile(null);
        setClientAppointments([]);
        setClientUserId(null);
        setClientUserEmail("");
        setClientName("");
        setClientPhone("");
    }

    function isClientAppointmentEditable(appointment: PublicClientAppointment) {
        if (appointment.status !== "confirmed" && appointment.status !== "pending") {
            return false;
        }

        const appointmentMoment = new Date(
            `${appointment.appointment_date}T${String(appointment.start_time).slice(0, 5)}:00`,
        );

        return appointmentMoment.getTime() > Date.now();
    }

    function openEditClientAppointment(appointment: PublicClientAppointment) {
        if (!isClientAppointmentEditable(appointment)) return;

        setEditingClientAppointment(appointment);
        setSelectedService(appointment.service_name);
        setSelectedDate(appointment.appointment_date);
        setWeekReferenceDate(appointment.appointment_date);
        setSelectedTime("");
        setBookingError("");
        setClientName(clientProfile?.full_name ?? "");
        setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
        setShowClientAccount(false);
        setBookingStep(2);
    }

    async function cancelEditingClientAppointment() {
        if (!editingClientAppointment || !clientProfile) return;

        const confirmed = window.confirm(
            "Deseja realmente cancelar este agendamento? O horário ficará disponível para outra cliente.",
        );

        if (!confirmed) return;

        setIsCancellingClientAppointment(true);
        setBookingError("");

        try {
            const {error} = await supabase.rpc("cancel_my_appointment", {
                p_appointment_id: editingClientAppointment.id,
            });

            if (error) throw error;

            await loadClientAppointments(clientProfile.id);
            setEditingClientAppointment(null);
            setSelectedService("");
            setSelectedDate("");
            setSelectedTime("");
            setBookingStep(1);
            setShowClientAccount(true);
        } catch (error) {
            console.error("Erro ao cancelar agendamento:", error);
            setBookingError("Não foi possível cancelar o agendamento. Tente novamente.");
        } finally {
            setIsCancellingClientAppointment(false);
        }
    }

    function openClientAppointments() {
        setFocusClientAppointments(true);
        setShowClientAccount(true);

        window.setTimeout(() => {
            document.getElementById("client-account-appointments")?.scrollIntoView({
                behavior: "auto",
                block: "start",
            });
        }, 0);
    }


    function getClientAppointmentStatusLabel(status: PublicClientAppointment["status"]) {
        if (status === "confirmed") return "Confirmado";
        if (status === "completed") return "Concluído";
        if (status === "cancelled") return "Cancelado";
        if (status === "no-show") return "Não compareceu";
        return "Pendente";
    }

    useEffect(() => {
        async function loadPublicSettings() {
            const {data: serviceData, error: serviceError} = await supabase
                .from("services")
                .select("id, name, description, duration_minutes, price_cents, display_order")
                .eq("is_active", true)
                .order("price_cents", {ascending: false})
                .order("name", {ascending: true});

            if (!serviceError && serviceData?.length) {
                setServices(
                    serviceData.map((service) => ({
                        name: service.name,
                        description: service.description ?? "",
                        duration: formatDuration(service.duration_minutes),
                        durationMinutes: service.duration_minutes,
                        price: formatCurrency(service.price_cents),
                        priceCents: service.price_cents,
                    })),
                );
            }
        }

        void loadPublicSettings();
    }, []);


    useEffect(() => {
        async function loadAppointments() {
            setIsLoadingAppointments(true);

            const [
                {data: appointmentData, error: appointmentError},
                {data: blockData, error: blockError},
                {data: overrideData, error: overrideError},
            ] = await Promise.all([
                supabase
                    .from("occupied_appointments")
                    .select(
                        "id, appointment_date, start_time, duration_minutes, status",
                    )
                    .neq("status", "cancelled"),
                supabase
                    .from("schedule_blocks")
                    .select("id, block_date, start_time, end_time, reason"),
                supabase
                    .from("schedule_time_overrides")
                    .select("id, override_date, start_time, is_available, created_at, updated_at"),
            ]);

            if (overrideError) {
                console.warn("Exceções de horário ainda não disponíveis:", overrideError);
            }

            if (appointmentError || blockError) {
                console.error(
                    "Erro ao carregar horários:",
                    appointmentError || blockError,
                );
                setBookingError(
                    "Não foi possível carregar os horários ocupados. Atualize a página e tente novamente.",
                );
                setIsLoadingAppointments(false);
                return;
            }

            const loadedAppointments: Appointment[] = (
                appointmentData ?? []
            ).map((appointment) => ({
                id: appointment.id,
                clientName: "",
                clientPhone: "",
                clientEmail: "",
                serviceName: "",
                date: appointment.appointment_date,
                startTime: String(appointment.start_time).slice(0, 5),
                durationMinutes: appointment.duration_minutes,
                status: appointment.status as Appointment["status"],
            }));

            const loadedBlocks: ScheduleBlock[] = (blockData ?? []).map(
                (block) => ({
                    id: block.id,
                    date: block.block_date,
                    startTime: String(block.start_time).slice(0, 5),
                    endTime: String(block.end_time).slice(0, 5),
                    reason: block.reason || "",
                }),
            );

            const loadedOverrides: ScheduleTimeOverride[] = (overrideData ?? []).map(
                (item) => ({
                    id: item.id,
                    override_date: item.override_date,
                    start_time: String(item.start_time).slice(0, 5),
                    is_available: Boolean(item.is_available),
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }),
            );

            setAppointments(loadedAppointments);
            setScheduleBlocks(loadedBlocks);
            setScheduleTimeOverrides(loadedOverrides);
            setIsLoadingAppointments(false);
        }

        void loadAppointments();

        const appointmentsChannel = supabase
            .channel("public-appointments-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "appointments",
                },
                () => {
                    void loadAppointments();
                },
            )
            .subscribe();

        const blocksChannel = supabase
            .channel("public-schedule-blocks-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "schedule_blocks",
                },
                () => {
                    void loadAppointments();
                },
            )
            .subscribe();

        const scheduleOverridesChannel = supabase
            .channel("public-schedule-time-overrides-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "schedule_time_overrides",
                },
                () => {
                    void loadAppointments();
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(appointmentsChannel);
            void supabase.removeChannel(blocksChannel);
            void supabase.removeChannel(scheduleOverridesChannel);
        };
    }, []);

    const todayDate = new Date();
    const today = formatDateForInput(todayDate);

    const selectedServiceInformation = services.find(
        (service) => service.name === selectedService,
    );

    function parseLocalDate(date: string) {
        return new Date(`${date}T12:00:00`);
    }

    function addDays(date: Date, amount: number) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function startOfCalendarWeek(date: Date) {
        const result = new Date(date);
        const day = result.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        result.setDate(result.getDate() + diffToMonday);
        return result;
    }

    function getWeekDates(referenceDate: string) {
        const start = startOfCalendarWeek(parseLocalDate(referenceDate));
        return Array.from({length: 7}, (_, index) => formatDateForInput(addDays(start, index)));
    }

    function selectBookingDate(date: string) {
        if (date < today) return;

        setSelectedDate(date);
        setWeekReferenceDate(date);
        setSelectedTime("");
        setBookingError("");
        setShowMonthCalendar(false);
    }

    function moveBookingWeek(amount: number) {
        const currentStart = startOfCalendarWeek(parseLocalDate(weekReferenceDate));
        const nextReference = formatDateForInput(addDays(currentStart, amount * 7));
        setWeekReferenceDate(nextReference);

        const nextWeek = getWeekDates(nextReference);
        const firstSelectable = nextWeek.find((date) => date >= today);

        if (firstSelectable) {
            setSelectedDate(firstSelectable);
            setSelectedTime("");
            setBookingError("");
        }
    }

    function openMonthCalendar() {
        const reference = selectedDate || weekReferenceDate || today;
        const parsed = parseLocalDate(reference);
        setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        setShowMonthCalendar((current) => !current);
    }

    function moveCalendarMonth(amount: number) {
        setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    }

    function getMonthCalendarCells() {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Grade começa na segunda-feira.
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({length: leadingEmpty}, () => null),
            ...Array.from({length: daysInMonth}, (_, index) => {
                const date = new Date(year, month, index + 1);
                return formatDateForInput(date);
            }),
        ];
    }

    const visibleWeekDates = useMemo(
        () => getWeekDates(weekReferenceDate),
        [weekReferenceDate],
    );

    function getOccupiedIntervals(date: string) {
        const appointmentIntervals = appointments
            .filter(
                (appointment) =>
                    appointment.date === date &&
                    appointment.id !== editingClientAppointment?.id &&
                    appointment.status !== "cancelled" &&
                    appointment.status !== "no-show",
            )
            .map((appointment) => {
                const start = timeToMinutes(appointment.startTime);
                return {start, end: start + appointment.durationMinutes};
            });

        const blockedIntervals = scheduleBlocks
            .filter((block) => block.date === date)
            .map((block) => ({
                start: timeToMinutes(block.startTime),
                end: timeToMinutes(block.endTime),
            }));

        return mergeIntervals([...appointmentIntervals, ...blockedIntervals]);
    }

    function isPastTime(date: string, startMinutes: number) {
        if (date !== today) return false;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        return startMinutes <= currentMinutes;
    }

    function getConfiguredPublicStartMinutes(date: string) {
        return getConfiguredClientStartMinutes(date, scheduleTimeOverrides);
    }

    function getAvailableTimes(date: string, serviceDurationMinutes: number) {
        if (!date) return [];

        const occupiedIntervals = getOccupiedIntervals(date);
        const generatedTimes = getConfiguredPublicStartMinutes(date);

        return generatedTimes
            .filter((start) => {
                const end = start + serviceDurationMinutes;

                const hasConflict = occupiedIntervals.some((interval) =>
                    intervalsOverlap(start, end, interval.start, interval.end),
                );

                return !hasConflict && !isPastTime(date, start);
            })
            .map(minutesToTime);
    }

    const availableTimes = useMemo(() => {
        if (!selectedServiceInformation || !selectedDate) return [];

        return getAvailableTimes(
            selectedDate,
            selectedServiceInformation.durationMinutes,
        );
    }, [
        appointments,
        scheduleBlocks,
        scheduleTimeOverrides,
        selectedDate,
        selectedServiceInformation,
        editingClientAppointment,
    ]);

    function formatSelectedDate() {
        if (!selectedDate) return "";

        return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    }

    function selectService(serviceName: string) {
        setSelectedService(serviceName);
        setSelectedDate("");
        setSelectedTime("");
        setBookingError("");
    }

    function closeBooking() {
        setBookingStep(1);
        setClientName(clientProfile?.full_name ?? "");
        setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
        setSelectedService("");
        setSelectedDate("");
        setSelectedTime("");
        setWeekReferenceDate(formatDateForInput(new Date()));
        setShowMonthCalendar(false);
        setEditingClientAppointment(null);
        setBookingError("");
    }

    async function confirmBooking() {
        setBookingError("");

        if (!selectedServiceInformation || !selectedDate || !selectedTime) {
            setBookingError("Revise o serviço, a data e o horário selecionados.");
            return;
        }

        setIsConfirmingBooking(true);

        try {
            const [
                {data: latestAppointments, error: appointmentLoadError},
                {data: latestBlocks, error: blockLoadError},
                {data: latestOverrides, error: overrideLoadError},
            ] = await Promise.all([
                supabase
                    .from("occupied_appointments")
                    .select(
                        "id, appointment_date, start_time, duration_minutes, status",
                    )
                    .eq("appointment_date", selectedDate)
                    .neq("status", "cancelled"),
                supabase
                    .from("schedule_blocks")
                    .select("id, block_date, start_time, end_time, reason")
                    .eq("block_date", selectedDate),
                supabase
                    .from("schedule_time_overrides")
                    .select("id, override_date, start_time, is_available, created_at, updated_at")
                    .eq("override_date", selectedDate),
            ]);

            if (overrideLoadError) {
                console.warn("Não foi possível revalidar exceções de horário:", overrideLoadError);
            }

            if (appointmentLoadError || blockLoadError) {
                throw appointmentLoadError || blockLoadError;
            }

            const appointmentsForSelectedDate: Appointment[] = (
                latestAppointments ?? []
            ).map((appointment) => ({
                id: appointment.id,
                clientName: "",
                clientPhone: "",
                clientEmail: "",
                serviceName: "",
                date: appointment.appointment_date,
                startTime: String(appointment.start_time).slice(0, 5),
                durationMinutes: appointment.duration_minutes,
                status: appointment.status as Appointment["status"],
            }));

            const blocksForSelectedDate: ScheduleBlock[] = (
                latestBlocks ?? []
            ).map((block) => ({
                id: block.id,
                date: block.block_date,
                startTime: String(block.start_time).slice(0, 5),
                endTime: String(block.end_time).slice(0, 5),
                reason: block.reason || "",
            }));

            const latestDateOverrides: ScheduleTimeOverride[] = (latestOverrides ?? []).map(
                (item) => ({
                    id: item.id,
                    override_date: item.override_date,
                    start_time: String(item.start_time).slice(0, 5),
                    is_available: Boolean(item.is_available),
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }),
            );

            if (!overrideLoadError) {
                setScheduleTimeOverrides((current) => [
                    ...current.filter((item) => item.override_date !== selectedDate),
                    ...latestDateOverrides,
                ]);
            }

            const selectedStart = timeToMinutes(selectedTime);
            const selectedEnd =
                selectedStart + selectedServiceInformation.durationMinutes;

            const allowedPublicStarts = overrideLoadError
                ? getConfiguredPublicStartMinutes(selectedDate)
                : getConfiguredClientStartMinutes(selectedDate, latestDateOverrides);

            if (!allowedPublicStarts.includes(selectedStart)) {
                setSelectedTime("");
                setBookingStep(3);
                setBookingError(
                    "Este horário não faz parte da agenda disponível da Mirian. Escolha outro horário.",
                );
                return;
            }

            const hasAppointmentConflict =
                appointmentsForSelectedDate.some((appointment) => {
                    if (appointment.id === editingClientAppointment?.id) {
                        return false;
                    }

                    const appointmentStart = timeToMinutes(
                        appointment.startTime,
                    );
                    const appointmentEnd =
                        appointmentStart + appointment.durationMinutes;

                    return intervalsOverlap(
                        selectedStart,
                        selectedEnd,
                        appointmentStart,
                        appointmentEnd,
                    );
                });

            const hasBlockConflict = blocksForSelectedDate.some((block) =>
                intervalsOverlap(
                    selectedStart,
                    selectedEnd,
                    timeToMinutes(block.startTime),
                    timeToMinutes(block.endTime),
                ),
            );

            if (hasAppointmentConflict || hasBlockConflict) {
                setAppointments((currentAppointments) => [
                    ...currentAppointments.filter(
                        (appointment) => appointment.date !== selectedDate,
                    ),
                    ...appointmentsForSelectedDate,
                ]);
                setScheduleBlocks((currentBlocks) => [
                    ...currentBlocks.filter(
                        (block) => block.date !== selectedDate,
                    ),
                    ...blocksForSelectedDate,
                ]);
                setSelectedTime("");
                setBookingStep(3);
                setBookingError(
                    "Este horário acabou de ficar indisponível. Escolha outro horário.",
                );
                return;
            }

            if (editingClientAppointment) {
                const {error: rescheduleError} = await supabase.rpc("reschedule_my_appointment", {
                    p_appointment_id: editingClientAppointment.id,
                    p_new_date: selectedDate,
                    p_new_time: selectedTime,
                });

                if (rescheduleError) {
                    throw rescheduleError;
                }
            } else {
                const {error: insertError} = await supabase
                    .from("appointments")
                    .insert({
                        client_name: clientName.trim(),
                        client_phone: clientPhone.trim(),
                        client_email: (clientProfile?.email ?? clientUserEmail) || null,
                        client_id: clientProfile?.id ?? null,
                        service_name: selectedServiceInformation.name,
                        appointment_date: selectedDate,
                        start_time: selectedTime,
                        duration_minutes:
                        selectedServiceInformation.durationMinutes,
                        price_cents: selectedServiceInformation.priceCents,
                        status: "confirmed",
                    });

                if (insertError) {
                    throw insertError;
                }
            }

            if (!editingClientAppointment) {
                const newAppointment: Appointment = {
                    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    clientName: clientName.trim(),
                    clientPhone: clientPhone.trim(),
                    clientEmail: clientProfile?.email ?? clientUserEmail,
                    serviceName: selectedServiceInformation.name,
                    date: selectedDate,
                    startTime: selectedTime,
                    durationMinutes: selectedServiceInformation.durationMinutes,
                    status: "confirmed",
                };

                setAppointments((currentAppointments) => [
                    ...currentAppointments,
                    newAppointment,
                ]);
            }

            if (clientProfile) {
                await loadClientAppointments(clientProfile.id);
            }

            setBookingStep(5);
        } catch (error) {
            console.error("Erro ao confirmar agendamento:", error);
            setBookingError(
                "Não foi possível salvar o agendamento online. Verifique sua conexão e tente novamente.",
            );
        } finally {
            setIsConfirmingBooking(false);
        }
    }

    return {
        bookingStep,
        setBookingStep,
        clientName,
        setClientName,
        clientPhone,
        setClientPhone,
        selectedService,
        setSelectedService,
        selectedDate,
        setSelectedDate,
        selectedTime,
        setSelectedTime,
        bookingError,
        setBookingError,
        appointments,
        setAppointments,
        scheduleBlocks,
        setScheduleBlocks,
        scheduleTimeOverrides,
        setScheduleTimeOverrides,
        isLoadingAppointments,
        setIsLoadingAppointments,
        isConfirmingBooking,
        setIsConfirmingBooking,
        services,
        setServices,
        clientUserId,
        setClientUserId,
        clientUserEmail,
        setClientUserEmail,
        clientProfile,
        setClientProfile,
        clientAppointments,
        setClientAppointments,
        setIsCheckingClientSession,
        isLoadingClientAccount,
        setIsLoadingClientAccount,
        showClientAuth,
        setShowClientAuth,
        showClientAccount,
        setShowClientAccount,
        showClientProfileEditor,
        setShowClientProfileEditor,
        profileEditName,
        setProfileEditName,
        profileEditPhone,
        setProfileEditPhone,
        profileEditEmail,
        setProfileEditEmail,
        profileEditPassword,
        setProfileEditPassword,
        profileEditPasswordConfirm,
        setProfileEditPasswordConfirm,
        showProfileEditPassword,
        setShowProfileEditPassword,
        profileEditError,
        setProfileEditError,
        profileEditSuccess,
        setProfileEditSuccess,
        isSavingProfileEdit,
        setIsSavingProfileEdit,
        setFocusClientAppointments,
        clientAuthMode,
        setClientAuthMode,
        authFullName,
        setAuthFullName,
        authPhone,
        setAuthPhone,
        authEmail,
        setAuthEmail,
        authPassword,
        setAuthPassword,
        showAuthPassword,
        setShowAuthPassword,
        authError,
        setAuthError,
        authSuccess,
        setAuthSuccess,
        isSubmittingAuth,
        setIsSubmittingAuth,
        showPasswordRecoveryRequest,
        setShowPasswordRecoveryRequest,
        recoveryEmail,
        setRecoveryEmail,
        recoveryRequestError,
        setRecoveryRequestError,
        recoveryRequestSuccess,
        setRecoveryRequestSuccess,
        isSendingRecoveryEmail,
        setIsSendingRecoveryEmail,
        showPasswordRecoveryReset,
        setShowPasswordRecoveryReset,
        recoverySessionUserId,
        setRecoverySessionUserId,
        recoveryNewPassword,
        setRecoveryNewPassword,
        recoveryConfirmPassword,
        setRecoveryConfirmPassword,
        showRecoveryPassword,
        setShowRecoveryPassword,
        recoveryResetError,
        setRecoveryResetError,
        recoveryResetSuccess,
        setRecoveryResetSuccess,
        isUpdatingRecoveryPassword,
        setIsUpdatingRecoveryPassword,
        editingClientAppointment,
        setEditingClientAppointment,
        isCancellingClientAppointment,
        setIsCancellingClientAppointment,
        weekReferenceDate,
        setWeekReferenceDate,
        showMonthCalendar,
        setShowMonthCalendar,
        calendarMonth,
        setCalendarMonth,
        normalizeRpcRow,
        loadClientAppointments,
        resolveClientProfile,
        loadAuthenticatedClient,
        resetAuthMessages,
        openClientAuth,
        openPasswordRecoveryRequest,
        closePasswordRecoveryRequest,
        submitPasswordRecoveryRequest,
        closePasswordRecoveryReset,
        ensurePasswordRecoverySession,
        submitPasswordRecoveryReset,
        submitClientAuth,
        openClientProfileEditor,
        closeClientProfileEditor,
        saveClientProfileChanges,
        logoutClient,
        isClientAppointmentEditable,
        openEditClientAppointment,
        cancelEditingClientAppointment,
        openClientAppointments,
        getClientAppointmentStatusLabel,
        todayDate,
        today,
        selectedServiceInformation,
        parseLocalDate,
        addDays,
        startOfCalendarWeek,
        getWeekDates,
        selectBookingDate,
        moveBookingWeek,
        openMonthCalendar,
        moveCalendarMonth,
        getMonthCalendarCells,
        visibleWeekDates,
        getOccupiedIntervals,
        isPastTime,
        getConfiguredPublicStartMinutes,
        getAvailableTimes,
        availableTimes,
        formatSelectedDate,
        selectService,
        closeBooking,
        confirmBooking,
        supabase,
        fallbackServices,
        formatBrazilianPhone,
        formatCurrency,
        formatDateForInput,
        formatDuration,
        getConfiguredClientStartMinutes,
        intervalsOverlap,
        MIRIAN_ADMIN_EMAIL,
        mergeIntervals,
        minutesToTime,
        timeToMinutes,
        clientAccountStyles,
    };
}

export type PublicSiteController = ReturnType<typeof usePublicSiteController>;
