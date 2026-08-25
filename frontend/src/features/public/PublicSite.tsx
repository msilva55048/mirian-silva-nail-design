import {useEffect, useMemo, useState} from "react";
import {supabase} from "../../lib/supabase";
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
} from "../../shared/domain";
import {type PublicClientAppointment, type PublicClientProfile} from "./types";
import {clientAccountStyles} from "./styles";

export default function PublicSite() {
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

            const authMessage =
                error instanceof Error
                    ? error.message
                    : String(error ?? "");
            const normalizedAuthMessage = authMessage.toLowerCase();

            if (clientAuthMode === "signup") {
                setAuthError(
                    "Não foi possível criar a conta. Verifique os dados ou tente outro e-mail.",
                );
            } else if (
                normalizedAuthMessage.includes("invalid login credentials") ||
                normalizedAuthMessage.includes("invalid credentials")
            ) {
                setAuthError(
                    "E-mail ou senha inválidos. Se esta conta já funcionava antes, use ‘Esqueci minha senha’ para definir uma nova senha.",
                );
            } else if (
                normalizedAuthMessage.includes("email not confirmed") ||
                normalizedAuthMessage.includes("email_not_confirmed")
            ) {
                setAuthError(
                    "Seu e-mail ainda não foi confirmado. Confira sua caixa de entrada antes de entrar.",
                );
            } else if (
                normalizedAuthMessage.includes("rate limit") ||
                normalizedAuthMessage.includes("too many requests")
            ) {
                setAuthError(
                    "Foram feitas muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
                );
            } else {
                setAuthError(
                    authMessage
                        ? `Não foi possível entrar: ${authMessage}`
                        : "Não foi possível entrar. Tente novamente.",
                );
            }
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

            {clientUserId && clientProfile ? (
                <div className="client-logged-page">

                    <style>{`
                .client-logged-page {
                    min-height: 100vh;
                    background: #fff8fa;
                    padding: 24px 0 64px;
                }
                .client-logged-header {
                    width: min(1160px, calc(100% - 32px));
                    margin: 0 auto 22px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 16px;
                    border: 1px solid rgba(125, 78, 91, .12);
                    border-radius: 18px;
                    background: #fff;
                    box-shadow: 0 10px 28px rgba(83, 48, 58, .06);
                }
                .client-logged-header__brand {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }
                .client-logged-header__brand img {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .client-logged-header__brand strong,
                .client-logged-header__brand span {
                    display: block;
                }
                .client-logged-header__brand strong {
                    color: #4d363e;
                    font-size: .98rem;
                }
                .client-logged-header__brand span {
                    margin-top: 2px;
                    color: #8a7078;
                    font-size: .76rem;
                }
                .client-logged-header__actions {
                    display: flex;
                    width: min(440px, 100%);
                    flex: 1;
                }
                .client-logged-header__actions button {
                    width: 100%;
                    border: 0;
                    border-radius: 14px;
                    padding: 16px 18px;
                    font: inherit;
                    font-size: 1.02rem;
                    font-weight: 850;
                    cursor: pointer;
                }
                .client-logged-header__appointments {
                    background: #6d3445;
                    color: #fff;
                }
                .client-logged-page .services {
                    padding-top: 4px;
                }
                .client-logged-page .services__grid {
                    gap: 18px;
                }
                .client-logged-page .service-card {
                    padding: 28px 24px;
                    min-height: unset;
                }
                .client-logged-page .service-card__button {
                    width: 100%;
                    box-sizing: border-box;
                    cursor: pointer;
                    font: inherit;
                }
                @media (max-width: 700px) {
                    .client-logged-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    .client-logged-header__actions {
                        width: 100%;
                    }
                    .client-logged-header__actions button {
                        width: 100%;
                    }
                }
            `}</style>

                    <header className="client-logged-header">
                        <div className="client-logged-header__brand">
                            <img src="/logo-mirian.png" alt="Mirian Silva Nail Design" />
                            <div>
                                <strong>Mirian Silva Nail Design</strong>
                                <span>Olá, {clientProfile?.full_name.split(/\s+/)[0]}</span>
                            </div>
                        </div>

                        <div className="client-logged-header__actions">
                            <button
                                className="client-logged-header__appointments"
                                type="button"
                                onClick={openClientAppointments}
                            >
                                Meus agendamentos
                            </button>
                        </div>
                    </header>


                    <section className="services" id="servicos">
                        <div className="services__grid">
                            {services.map((service, index) => (
                                <article className="service-card" key={service.name}>
                                    <span className="service-card__number">{String(index + 1).padStart(2, "0")}</span>
                                    <div className="service-card__content"><h3>{service.name}</h3><p>{service.description}</p>
                                    </div>
                                    <div className="service-card__footer">
                                        <div><span>Duração</span><strong>{service.duration}</strong></div>
                                        <div><span>Valor</span><strong>{service.price}</strong></div>
                                    </div>
                                    <button
                                        type="button"
                                        className="service-card__button"
                                        onClick={() => {
                                            setEditingClientAppointment(null);
                                            selectService(service.name);
                                            const initialDate = formatDateForInput(new Date());
                                            setSelectedDate(initialDate);
                                            setWeekReferenceDate(initialDate);
                                            setClientName(clientProfile?.full_name ?? "");
                                            setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
                                            setBookingStep(2);
                                        }}
                                    >
                                        Escolher este serviço
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>


                    {bookingStep === 2 && <div className="booking-modal">
                        <div className="booking-modal__content">
                            <button
                                className="booking-modal__close"
                                type="button"
                                onClick={() => {
                                    setBookingError("");
                                    setShowMonthCalendar(false);
                                    setBookingStep(1);
                                }}
                                aria-label="Fechar agenda"
                            >
                                ×
                            </button>

                            <span className="section-label">
                            {editingClientAppointment ? "Editar agendamento" : "Escolha data e horário"}
                        </span>
                            <h3>
                                {editingClientAppointment ? "Escolha o novo dia e horário" : "Quando fica melhor para você?"}
                            </h3>
                            <p>
                                Toque em qualquer dia da semana para ver os horários disponíveis sem precisar voltar.
                            </p>

                            {editingClientAppointment && (
                                <div className="client-edit-current">
                                    <span>Agendamento atual</span>
                                    <strong>
                                        {new Date(`${editingClientAppointment.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                        {" às "}
                                        {String(editingClientAppointment.start_time).slice(0, 5)}
                                    </strong>
                                </div>
                            )}

                            <div className="client-week-picker">
                                <div className="client-week-picker__top">
                                    <div className="client-week-picker__month">
                                        <strong>
                                            {parseLocalDate(selectedDate || weekReferenceDate).toLocaleDateString("pt-BR", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </strong>
                                        <button
                                            className="client-week-picker__calendar-button"
                                            type="button"
                                            onClick={openMonthCalendar}
                                            aria-label="Abrir calendário do mês"
                                        >
                                            📅
                                        </button>
                                    </div>

                                    <div className="client-week-picker__navs">
                                        <button
                                            className="client-week-picker__nav"
                                            type="button"
                                            onClick={() => moveBookingWeek(-1)}
                                            aria-label="Semana anterior"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            className="client-week-picker__nav"
                                            type="button"
                                            onClick={() => moveBookingWeek(1)}
                                            aria-label="Próxima semana"
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                {showMonthCalendar && (
                                    <div className="client-month-calendar">
                                        <div className="client-month-calendar__header">
                                            <button
                                                className="client-week-picker__nav"
                                                type="button"
                                                onClick={() => moveCalendarMonth(-1)}
                                                aria-label="Mês anterior"
                                            >
                                                ‹
                                            </button>
                                            <strong>
                                                {calendarMonth.toLocaleDateString("pt-BR", {
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </strong>
                                            <button
                                                className="client-week-picker__nav"
                                                type="button"
                                                onClick={() => moveCalendarMonth(1)}
                                                aria-label="Próximo mês"
                                            >
                                                ›
                                            </button>
                                        </div>

                                        <div className="client-month-calendar__weekdays">
                                            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                                                <span key={day}>{day}</span>
                                            ))}
                                        </div>

                                        <div className="client-month-calendar__grid">
                                            {getMonthCalendarCells().map((date, index) => {
                                                if (!date) {
                                                    return <span className="client-month-calendar__day is-empty" key={`empty-${index}`}/>;
                                                }

                                                const isPast = date < today;

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        className={[
                                                            "client-month-calendar__day",
                                                            date === selectedDate ? "is-selected" : "",
                                                            isPast ? "is-past" : "",
                                                        ].filter(Boolean).join(" ")}
                                                        onClick={() => selectBookingDate(date)}
                                                    >
                                                        {parseLocalDate(date).getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="client-week-days">
                                    {[
                                        {dates: visibleWeekDates.slice(0, 4), rowClass: "client-week-days__row--four"},
                                        {dates: visibleWeekDates.slice(4, 7), rowClass: "client-week-days__row--three"},
                                    ].map((row, rowIndex) => (
                                        <div
                                            className={`client-week-days__row ${row.rowClass}`}
                                            key={`week-row-${rowIndex}`}
                                        >
                                            {row.dates.map((date) => {
                                                const parsed = parseLocalDate(date);
                                                const isPast = date < today;

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        className={[
                                                            "client-week-day",
                                                            date === selectedDate ? "is-selected" : "",
                                                            isPast ? "is-past" : "",
                                                        ].filter(Boolean).join(" ")}
                                                        onClick={() => selectBookingDate(date)}
                                                    >
                                                    <span>
                                                        {parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}
                                                    </span>
                                                        <strong>
                                                            {parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}
                                                        </strong>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                <div className="client-week-times">
                                    <p className="client-week-times__title">
                                        {selectedDate
                                            ? `Horários disponíveis em ${parseLocalDate(selectedDate).toLocaleDateString("pt-BR")}`
                                            : "Escolha um dia"}
                                    </p>

                                    {bookingError && <p className="booking-modal__error">{bookingError}</p>}

                                    {isLoadingAppointments ? (
                                        <p>Carregando horários disponíveis...</p>
                                    ) : selectedDate && availableTimes.length > 0 ? (
                                        <div className="booking-times">
                                            {availableTimes.map((time) => (
                                                <button
                                                    key={time}
                                                    className={
                                                        selectedTime === time
                                                            ? "booking-time booking-time--selected"
                                                            : "booking-time"
                                                    }
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedTime(time);
                                                        setBookingError("");
                                                    }}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : selectedDate ? (
                                        <div className="booking-times__empty">
                                            <strong>Nenhum horário disponível neste dia.</strong>
                                            <span>Toque em outro dia da semana para consultar os horários.</span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="client-edit-actions">
                                    <button
                                        className="booking-modal__button"
                                        type="button"
                                        disabled={!selectedDate || !selectedTime}
                                        onClick={() => {
                                            setBookingError("");
                                            setBookingStep(4);
                                        }}
                                    >
                                        Revisar agendamento
                                    </button>

                                    {editingClientAppointment && (
                                        <button
                                            className="client-edit-cancel"
                                            type="button"
                                            disabled={isCancellingClientAppointment}
                                            onClick={() => void cancelEditingClientAppointment()}
                                        >
                                            {isCancellingClientAppointment ? "Cancelando..." : "Cancelar agendamento"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>}


                    {bookingStep === 4 && <div className="booking-modal">
                        <div className="booking-modal__content">
                            <button className="booking-modal__close" type="button" onClick={() => {
                                setBookingError("");
                                setBookingStep(2);
                            }} aria-label="Voltar para data e horários">←
                            </button>
                            <span className="section-label">{editingClientAppointment ? "Confirmar alteração" : "Confirmação"}</span>
                            <h3>{editingClientAppointment ? "Revise o novo dia e horário" : "Revise seu agendamento"}</h3>
                            <p>
                                {editingClientAppointment
                                    ? "Confira as novas informações antes de salvar a alteração."
                                    : "Confira as informações antes de confirmar a solicitação."}
                            </p>
                            <div className="booking-modal__summary">
                                <div><span>Cliente</span><strong>{clientName}</strong></div>
                                <div><span>Telefone</span><strong>{clientPhone}</strong></div>
                                <div><span>Serviço</span><strong>{selectedService}</strong></div>
                                <div><span>Data</span><strong>{formatSelectedDate()}</strong></div>
                                <div><span>Horário</span><strong>{selectedTime}</strong></div>
                                <div><span>Valor</span><strong>{selectedServiceInformation?.price ?? ""}</strong></div>
                            </div>
                            {bookingError && <p className="booking-modal__error">{bookingError}</p>}
                            <button className="booking-modal__button" type="button" disabled={isConfirmingBooking}
                                    onClick={confirmBooking}>
                                {isConfirmingBooking
                                    ? "Salvando..."
                                    : editingClientAppointment
                                        ? "Salvar novo dia e horário"
                                        : "Confirmar agendamento"}
                            </button>
                        </div>
                    </div>}


                    {bookingStep === 5 && <div className="booking-modal">
                        <div className="booking-modal__content booking-success">
                            <div className="booking-success__icon">✓</div>
                            <span className="section-label">{editingClientAppointment ? "Agendamento alterado" : "Agendamento realizado"}</span>
                            <h3>
                                {editingClientAppointment
                                    ? "Seu agendamento foi alterado com sucesso!"
                                    : "Seu agendamento foi confirmado com sucesso!"}
                            </h3>
                            <p>
                                {editingClientAppointment
                                    ? "O novo dia e horário já estão reservados para você."
                                    : `Obrigado, ${clientName}. Seu agendamento está confirmado e o horário já foi reservado para você.`}
                            </p>
                            <div className="booking-modal__summary">
                                <div><span>Serviço</span><strong>{selectedService}</strong></div>
                                <div><span>Data</span><strong>{formatSelectedDate()}</strong></div>
                                <div><span>Horário</span><strong>{selectedTime}</strong></div>
                                <div><span>Telefone</span><strong>{clientPhone}</strong></div>
                            </div>
                            <button className="booking-modal__button" type="button" onClick={closeBooking}>Finalizar
                            </button>
                        </div>
                    </div>}
                </div>

            ) : (
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
            )}


            {showClientAuth && (
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
            )}

            {showPasswordRecoveryRequest && (
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
            )}

            {showPasswordRecoveryReset && (
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
            )}

            {showClientAccount && clientUserId && (
                <div className="client-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowClientAccount(false);
                }}>
                    <section className="client-modal client-modal--account">
                        <button className="client-modal__close" type="button" onClick={() => setShowClientAccount(false)}>×</button>
                        <span className="client-modal__eyebrow">Minha conta</span>
                        <h2>{clientProfile ? `Olá, ${clientProfile.full_name.split(/\s+/)[0]}!` : "Sua conta"}</h2>
                        <p>Consulte seus dados e os agendamentos vinculados ao seu perfil.</p>

                        {isLoadingClientAccount ? (
                            <div className="client-account__empty">Carregando sua conta...</div>
                        ) : clientProfile ? (
                            <>
                                <div className="client-account__profile">
                                    <div><span>Nome</span><strong>{clientProfile.full_name}</strong></div>
                                    <div><span>Telefone</span><strong>{formatBrazilianPhone(clientProfile.phone)}</strong></div>
                                    <div><span>E-mail</span><strong>{clientProfile.email || clientUserEmail}</strong></div>
                                </div>

                                <div className="client-account__actions">
                                    <button
                                        className="client-account__edit-profile"
                                        type="button"
                                        onClick={openClientProfileEditor}
                                    >
                                        <span className="client-account__edit-profile-icon">✎</span>
                                        <span>
                                            <strong>Editar perfil</strong>
                                            <small>Nome, telefone, e-mail e senha</small>
                                        </span>
                                        <span className="client-account__edit-profile-arrow">›</span>
                                    </button>

                                    <button
                                        className="client-account__logout"
                                        type="button"
                                        onClick={() => void logoutClient()}
                                    >
                                        Sair da conta
                                    </button>
                                </div>

                                <section className="client-account__section" id="client-account-appointments">
                                    <h3>Meus agendamentos</h3>
                                    {clientAppointments.length > 0 ? (
                                        <div className="client-account__appointments">
                                            {clientAppointments.map((appointment) => (
                                                <button
                                                    className={
                                                        isClientAppointmentEditable(appointment)
                                                            ? "client-account__appointment is-editable"
                                                            : "client-account__appointment"
                                                    }
                                                    key={appointment.id}
                                                    type="button"
                                                    disabled={!isClientAppointmentEditable(appointment)}
                                                    onClick={() => openEditClientAppointment(appointment)}
                                                >
                                                    <div>
                                                        <strong>{appointment.service_name}</strong>
                                                        <span>
                                                            {new Date(`${appointment.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                                            {" às "}
                                                            {String(appointment.start_time).slice(0, 5)}
                                                        </span>
                                                        {isClientAppointmentEditable(appointment) && (
                                                            <span className="client-account__appointment-hint">
                                                                Toque para alterar dia, horário ou cancelar
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="client-account__status">
                                                        {getClientAppointmentStatusLabel(appointment.status)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="client-account__empty">
                                            Você ainda não possui agendamentos vinculados a esta conta.
                                        </div>
                                    )}
                                </section>
                            </>
                        ) : (
                            <div className="client-account__empty">
                                Sua conta está autenticada, mas o perfil ainda não foi vinculado. Saia e entre novamente; se continuar, fale com a Mirian.
                            </div>
                        )}
                    </section>
                </div>
            )}

            {showClientProfileEditor && clientProfile && (
                <div
                    className="client-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeClientProfileEditor();
                        }
                    }}
                >
                    <section className="client-modal client-profile-editor">
                        <button
                            className="client-modal__close"
                            type="button"
                            onClick={closeClientProfileEditor}
                            aria-label="Fechar edição do perfil"
                        >
                            ×
                        </button>

                        <span className="client-modal__eyebrow">Meu perfil</span>
                        <h2>Editar perfil</h2>
                        <p>
                            Atualize seus dados. As alterações são feitas no mesmo
                            cadastro já vinculado à sua conta.
                        </p>

                        <form
                            className="client-profile-editor__form"
                            onSubmit={saveClientProfileChanges}
                        >
                            <label>
                                Nome completo
                                <input
                                    value={profileEditName}
                                    onChange={(event) =>
                                        setProfileEditName(event.target.value)
                                    }
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
                                    value={profileEditPhone}
                                    onChange={(event) =>
                                        setProfileEditPhone(
                                            formatBrazilianPhone(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
                                    autoComplete="tel"
                                    required
                                />
                            </label>

                            <label>
                                E-mail
                                <input
                                    type="email"
                                    value={profileEditEmail}
                                    onChange={(event) =>
                                        setProfileEditEmail(event.target.value)
                                    }
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Nova senha
                                <small className="client-profile-editor__hint">
                                    Deixe em branco para manter a senha atual.
                                </small>

                                <div className="client-password-field">
                                    <input
                                        type={
                                            showProfileEditPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={profileEditPassword}
                                        onChange={(event) =>
                                            setProfileEditPassword(
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="new-password"
                                        minLength={6}
                                        placeholder="Nova senha"
                                    />

                                    <button
                                        className="client-password-toggle"
                                        type="button"
                                        onClick={() =>
                                            setShowProfileEditPassword(
                                                (current) => !current,
                                            )
                                        }
                                    >
                                        {showProfileEditPassword
                                            ? "Ocultar"
                                            : "Mostrar"}
                                    </button>
                                </div>
                            </label>

                            <label>
                                Confirmar nova senha
                                <input
                                    type={
                                        showProfileEditPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={profileEditPasswordConfirm}
                                    onChange={(event) =>
                                        setProfileEditPasswordConfirm(
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    minLength={6}
                                    placeholder="Repita a nova senha"
                                />
                            </label>

                            {profileEditError && (
                                <p className="client-auth-message is-error">
                                    {profileEditError}
                                </p>
                            )}

                            {profileEditSuccess && (
                                <p className="client-auth-message is-success">
                                    {profileEditSuccess}
                                </p>
                            )}

                            <div className="client-profile-editor__actions">
                                <button
                                    type="submit"
                                    className="client-profile-editor__save"
                                    disabled={isSavingProfileEdit}
                                >
                                    {isSavingProfileEdit
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                </button>

                                <button
                                    type="button"
                                    className="client-profile-editor__cancel"
                                    onClick={closeClientProfileEditor}
                                    disabled={isSavingProfileEdit}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}


