import {useEffect, useMemo, useState} from "react";
import {supabase} from "../../../lib/supabase";
import {
    type Appointment,
    type ScheduleBlock,
    type ScheduleTimeOverride,
    type Service,
    type TimeInterval,
    fallbackServices,
    formatBrazilianPhone,
    formatCurrency,
    formatDateForInput,
    formatDuration,
    getConfiguredClientStartMinutes,
    getFixedAdminManualStartMinutes,
    getFixedClientStartMinutes,
    intervalsOverlap,
    MIRIAN_ADMIN_EMAIL,
    mergeIntervals,
    minutesToTime,
    normalizeBrazilianPhoneDigits,
} from "../../../shared/domain";
import {
    type AdminAppointment,
    type AdminBookingClient,
    type AdminClient,
    type AdminScheduleBlock,
    type AdminServiceSetting,
    type ClientAnamnesisForm,
    type ClientProfile,
    type NailRecord,
    type NailRecordPhoto,
    emptyClientAnamnesis,
} from "../types";
import {
    addDaysToInputDate,
    buildWhatsAppMessage,
    formatAdminDate,
    getAppointmentDateTime,
    getAppointmentEndDateTime,
    getMinutesFromTime,
    getWhatsAppNotificationLabel,
    normalizePhoneForWhatsApp,
    type WhatsAppNotificationType,
} from "../utils";
import {
    adminClientScheduledMetricStyles,
    adminEditDateTimeStyles,
    adminEnhancementStyles,
    adminServiceManagerStyles,
    adminStyles,
} from "../styles";

export function useAdminPanelController() {
const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [adminNow, setAdminNow] = useState(() => new Date());
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showAdminBackToTop, setShowAdminBackToTop] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
    const [adminBlocks, setAdminBlocks] = useState<AdminScheduleBlock[]>([]);
    const [adminServices, setAdminServices] = useState<AdminServiceSetting[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [panelError, setPanelError] = useState("");
    const [notificationClock, setNotificationClock] = useState(() => Date.now());
    const [openedWhatsAppNotifications, setOpenedWhatsAppNotifications] = useState<Record<string, boolean>>(() => {
        try {
            const saved = window.localStorage.getItem("mirian-whatsapp-notifications-opened");
            return saved ? JSON.parse(saved) as Record<string, boolean> : {};
        } catch {
            return {};
        }
    });

    const [adminView, setAdminView] = useState<
        "agenda" | "week" | "month" | "new" | "clients" | "finance" | "schedule" | "settings" | "blocks"
    >("agenda");
    const [agendaDate, setAgendaDate] = useState(formatDateForInput(new Date()));
    const [monthlyAgendaMonth, setMonthlyAgendaMonth] = useState(() =>
        formatDateForInput(new Date()).slice(0, 7),
    );
    const [agendaWeekReferenceDate, setAgendaWeekReferenceDate] = useState(
        formatDateForInput(new Date()),
    );
    const [showAgendaDatePicker, setShowAgendaDatePicker] = useState(false);
    const [showAgendaMonthCalendar, setShowAgendaMonthCalendar] = useState(false);
    const [agendaCalendarMonth, setAgendaCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [financeMonth, setFinanceMonth] = useState(() => formatDateForInput(new Date()).slice(0, 7));
    const [showFinanceMonthPicker, setShowFinanceMonthPicker] = useState(false);
    const [financePickerYear, setFinancePickerYear] = useState(() => new Date().getFullYear());

    const [showManualForm, setShowManualForm] = useState(false);
    const [adminClientProfiles, setAdminClientProfiles] = useState<ClientProfile[]>([]);
    const [manualClientSearch, setManualClientSearch] = useState("");
    const [selectedManualClient, setSelectedManualClient] = useState<AdminBookingClient | null>(null);
    const [manualServiceName, setManualServiceName] = useState(fallbackServices[0].name);
    const [manualDate, setManualDate] = useState(formatDateForInput(new Date()));
    const [manualWeekReferenceDate, setManualWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [manualTime, setManualTime] = useState("");
    const [showManualMonthCalendar, setShowManualMonthCalendar] = useState(false);
    const [manualCalendarMonth, setManualCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [manualError, setManualError] = useState("");
    const [manualSuccess, setManualSuccess] = useState("");
    const [isSavingManualAppointment, setIsSavingManualAppointment] = useState(false);

    const [selectedAdminAppointment, setSelectedAdminAppointment] = useState<AdminAppointment | null>(null);
    const [editAppointmentName, setEditAppointmentName] = useState("");
    const [editAppointmentPhone, setEditAppointmentPhone] = useState("");
    const [editAppointmentEmail, setEditAppointmentEmail] = useState("");
    const [editAppointmentMusicTaste, setEditAppointmentMusicTaste] = useState("");
    const [editAppointmentService, setEditAppointmentService] = useState("");
    const [editAppointmentDate, setEditAppointmentDate] = useState("");
    const [editAppointmentTime, setEditAppointmentTime] = useState("");
    const [showEditDateTimePicker, setShowEditDateTimePicker] = useState(false);
    const [editWeekReferenceDate, setEditWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [showEditMonthCalendar, setShowEditMonthCalendar] = useState(false);
    const [editCalendarMonth, setEditCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [appointmentEditError, setAppointmentEditError] = useState("");
    const [isSavingAppointment, setIsSavingAppointment] = useState(false);

    const [clientSearch, setClientSearch] = useState("");
    const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
    const [editingClient, setEditingClient] = useState<AdminClient | null>(null);
    const [editClientName, setEditClientName] = useState("");
    const [editClientPhone, setEditClientPhone] = useState("");
    const [editClientEmail, setEditClientEmail] = useState("");
    const [editClientMusicTaste, setEditClientMusicTaste] = useState("");
    const [clientAnamnesis, setClientAnamnesis] =
        useState<ClientAnamnesisForm>(emptyClientAnamnesis);
    const [isLoadingClientAnamnesis, setIsLoadingClientAnamnesis] = useState(false);
    const [clientEditError, setClientEditError] = useState("");
    const [isSavingClient, setIsSavingClient] = useState(false);
    const [deletingClientKey, setDeletingClientKey] = useState("");
    const [clearingCancelledAppointmentId, setClearingCancelledAppointmentId] =
        useState<string | null>(null);
    const [deletingConfirmedAppointmentId, setDeletingConfirmedAppointmentId] =
        useState<string | null>(null);

    const [nailRecords, setNailRecords] = useState<NailRecord[]>([]);
    const [isLoadingNailRecords, setIsLoadingNailRecords] = useState(false);
    const [showNailRecordForm, setShowNailRecordForm] = useState(false);
    const [nailRecordNotes, setNailRecordNotes] = useState("");
    const [nailRecordFiles, setNailRecordFiles] = useState<File[]>([]);
    const [nailRecordError, setNailRecordError] = useState("");
    const [nailRecordSuccess, setNailRecordSuccess] = useState("");
    const [isSavingNailRecord, setIsSavingNailRecord] = useState(false);
    const [deletingNailRecordId, setDeletingNailRecordId] = useState<string | null>(null);

    const nailRecordFilePreviews = useMemo(
        () => nailRecordFiles.map((file) => ({
            file,
            url: URL.createObjectURL(file),
        })),
        [nailRecordFiles],
    );

    useEffect(() => {
        return () => {
            nailRecordFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [nailRecordFilePreviews]);

    const [adminTimeOverrides, setAdminTimeOverrides] = useState<ScheduleTimeOverride[]>([]);

    const [scheduleConfigDate, setScheduleConfigDate] = useState(formatDateForInput(new Date()));
    const [scheduleConfigWeekReferenceDate, setScheduleConfigWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [scheduleConfigNewTime, setScheduleConfigNewTime] = useState("");
    const [scheduleConfigEditingTime, setScheduleConfigEditingTime] = useState<string | null>(null);
    const [scheduleConfigEditedTime, setScheduleConfigEditedTime] = useState("");
    const [scheduleConfigError, setScheduleConfigError] = useState("");
    const [scheduleConfigSuccess, setScheduleConfigSuccess] = useState("");
    const [isSavingScheduleConfig, setIsSavingScheduleConfig] = useState(false);

    const [blockDate, setBlockDate] = useState(formatDateForInput(new Date()));
    const [blockWeekReferenceDate, setBlockWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [selectedBlockTimes, setSelectedBlockTimes] = useState<string[]>([]);
    const [blockReason, setBlockReason] = useState("");
    const [blockError, setBlockError] = useState("");
    const [isSavingBlock, setIsSavingBlock] = useState(false);

    const [settingsError, setSettingsError] = useState("");
    const [settingsSuccess, setSettingsSuccess] = useState("");
    const [savingServiceId, setSavingServiceId] = useState<number | null>(null);
    const [serviceFormName, setServiceFormName] = useState("");
    const [serviceFormPrice, setServiceFormPrice] = useState("");
    const [serviceFormDuration, setServiceFormDuration] = useState("");
    const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
    const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);
    const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setNotificationClock(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const clock = window.setInterval(() => {
            setAdminNow(new Date());
        }, 30000);

        return () => window.clearInterval(clock);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !appointments.length) return;

        const completedIds = appointments
            .filter(
                (appointment) =>
                    (appointment.status === "confirmed" ||
                        appointment.status === "pending") &&
                    getAppointmentEndDateTime(appointment).getTime() <=
                        adminNow.getTime(),
            )
            .map((appointment) => appointment.id);

        if (!completedIds.length) return;

        let cancelled = false;

        async function markFinishedAppointmentsAsCompleted() {
            const {error} = await supabase
                .from("appointments")
                .update({status: "completed"})
                .in("id", completedIds);

            if (error) {
                console.error(
                    "Erro ao concluir atendimentos automaticamente:",
                    error,
                );
                return;
            }

            if (cancelled) return;

            setAppointments((current) =>
                current.map((appointment) =>
                    completedIds.includes(appointment.id)
                        ? {...appointment, status: "completed"}
                        : appointment,
                ),
            );
        }

        void markFinishedAppointmentsAsCompleted();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, appointments, adminNow]);


    useEffect(() => {
        try {
            window.localStorage.setItem(
                "mirian-whatsapp-notifications-opened",
                JSON.stringify(openedWhatsAppNotifications),
            );
        } catch {
            // O painel continua funcionando mesmo se o navegador bloquear o armazenamento local.
        }
    }, [openedWhatsAppNotifications]);

    useEffect(() => {
        function updateBackToTopVisibility() {
            setShowAdminBackToTop(window.scrollY > 320);
        }

        updateBackToTopVisibility();

        window.addEventListener("scroll", updateBackToTopVisibility, {
            passive: true,
        });

        return () => {
            window.removeEventListener("scroll", updateBackToTopVisibility);
        };
    }, []);

    useEffect(() => {
        function sessionIsMirianAdmin(session: {user?: {email?: string | null}} | null) {
            return session?.user?.email?.trim().toLowerCase() === MIRIAN_ADMIN_EMAIL;
        }

        async function checkSession() {
            const {data: {session}} = await supabase.auth.getSession();
            setIsAuthenticated(sessionIsMirianAdmin(session));
            setIsCheckingSession(false);
        }

        void checkSession();

        const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(sessionIsMirianAdmin(session));
            setIsCheckingSession(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            setAppointments([]);
            setAdminClientProfiles([]);
            return;
        }

        async function loadAdminData() {
            setIsLoading(true);
            setPanelError("");
            const [
                {data: appointmentData, error: appointmentError},
                {data: blockData, error: blockLoadError},
                {data: serviceData, error: serviceLoadError},
                {data: clientProfileData, error: clientProfileLoadError},
                {data: timeOverrideData, error: timeOverrideLoadError},
            ] = await Promise.all([
                supabase.from("appointments")
                    .select("id, client_id, client_name, client_phone, client_email, musical_taste, service_name, appointment_date, start_time, duration_minutes, price_cents, client_hidden, status, created_at")
                    .order("appointment_date", {ascending: true})
                    .order("start_time", {ascending: true}),
                supabase.from("schedule_blocks")
                    .select("id, block_date, start_time, end_time, reason, created_at")
                    .order("block_date", {ascending: true})
                    .order("start_time", {ascending: true}),
                supabase.from("services")
                    .select("id, name, description, duration_minutes, price_cents, display_order")
                    .order("price_cents", {ascending: false})
                    .order("name", {ascending: true}),
                supabase.from("client_profiles")
                    .select("id, full_name, phone, email, musical_taste, phone_digits, user_id, created_at, updated_at")
                    .order("full_name", {ascending: true}),
                supabase.from("schedule_time_overrides")
                    .select("id, override_date, start_time, is_available, created_at, updated_at")
                    .order("override_date", {ascending: true})
                    .order("start_time", {ascending: true}),
            ]);

            if (timeOverrideLoadError) {
                console.warn("Exceções de horário ainda não disponíveis no ADM:", timeOverrideLoadError);
            }

            if (appointmentError || blockLoadError || serviceLoadError || clientProfileLoadError) {
                console.error("Erro ao carregar painel:", appointmentError || blockLoadError || serviceLoadError || clientProfileLoadError);
                setPanelError("Não foi possível carregar os dados do painel. Atualize a página.");
                setIsLoading(false);
                return;
            }

            setAppointments((appointmentData ?? []) as AdminAppointment[]);
            setAdminBlocks((blockData ?? []) as AdminScheduleBlock[]);
            setAdminServices((serviceData ?? []) as AdminServiceSetting[]);
            setAdminClientProfiles((clientProfileData ?? []) as ClientProfile[]);
            setAdminTimeOverrides(
                ((timeOverrideData ?? []) as ScheduleTimeOverride[]).map((item) => ({
                    ...item,
                    start_time: String(item.start_time).slice(0, 5),
                })),
            );
            if (serviceData?.length) setManualServiceName(serviceData[0].name);
            setIsLoading(false);
        }

        void loadAdminData();
        const appointmentsChannel = supabase.channel("admin-appointments-updates")
            .on("postgres_changes", {event: "*", schema: "public", table: "appointments"}, () => void loadAdminData())
            .subscribe();
        const blocksChannel = supabase.channel("admin-schedule-blocks-updates")
            .on("postgres_changes", {event: "*", schema: "public", table: "schedule_blocks"}, () => void loadAdminData())
            .subscribe();

        const clientProfilesChannel = supabase.channel("admin-client-profiles-updates")
            .on(
                "postgres_changes",
                {event: "*", schema: "public", table: "client_profiles"},
                () => void loadAdminData(),
            )
            .subscribe();

        const timeOverridesChannel = supabase.channel("admin-schedule-time-overrides-updates")
            .on(
                "postgres_changes",
                {event: "*", schema: "public", table: "schedule_time_overrides"},
                () => void loadAdminData(),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(appointmentsChannel);
            void supabase.removeChannel(blocksChannel);
            void supabase.removeChannel(clientProfilesChannel);
            void supabase.removeChannel(timeOverridesChannel);
        };
    }, [isAuthenticated]);

    async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);

        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail !== MIRIAN_ADMIN_EMAIL) {
            setLoginError("Esta conta não possui acesso ao painel administrativo.");
            setIsLoggingIn(false);
            return;
        }

        const {data, error} = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        });

        if (error || data.user?.email?.trim().toLowerCase() !== MIRIAN_ADMIN_EMAIL) {
            if (data.session) {
                await supabase.auth.signOut();
            }

            setLoginError("E-mail ou senha incorretos.");
            setIsLoggingIn(false);
            return;
        }

        setPassword("");
        setIsAuthenticated(true);
        setIsLoggingIn(false);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
    }

    function scrollAdminToTop() {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function appointmentConflicts(
        appointmentId: string,
        date: string,
        time: string,
        durationMinutes: number,
    ) {
        const start = getMinutesFromTime(time);
        const end = start + durationMinutes;
        const conflictsAppointment = appointments.some((appointment) => {
            if (appointment.id === appointmentId || appointment.status === "cancelled" || appointment.appointment_date !== date) return false;
            const existingStart = getMinutesFromTime(appointment.start_time);
            return intervalsOverlap(start, end, existingStart, existingStart + appointment.duration_minutes);
        });
        const conflictsBlock = adminBlocks.some((block) =>
            block.block_date === date &&
            intervalsOverlap(start, end, getMinutesFromTime(block.start_time), getMinutesFromTime(block.end_time)),
        );
        return conflictsAppointment || conflictsBlock;
    }

    async function createManualAppointment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setManualError("");
        setManualSuccess("");

        if (!selectedManualClient) {
            setManualError("Busque e selecione uma cliente cadastrada.");
            return;
        }

        if (!manualDate || !manualTime) {
            setManualError("Escolha a data e o horário.");
            return;
        }

        const now = new Date();
        const selectedDateTime = new Date(`${manualDate}T${manualTime}:00`);

        if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime.getTime() <= now.getTime()) {
            setManualError("Não é possível criar um agendamento em uma data ou horário que já passou.");
            return;
        }

        const service = adminServices.find((item) => item.name === manualServiceName);

        if (!service) {
            setManualError("Escolha um serviço válido.");
            return;
        }

        if (appointmentConflicts("", manualDate, manualTime, service.duration_minutes)) {
            setManualError("Este período entra em conflito com outro agendamento ou bloqueio.");
            return;
        }

        setIsSavingManualAppointment(true);

        try {
            const {data: createdData, error: createError} = await supabase.rpc(
                "admin_create_client_appointment",
                {
                    p_client_profile_id: selectedManualClient.profileId,
                    p_client_name: selectedManualClient.name,
                    p_client_phone: selectedManualClient.phone,
                    p_client_email: selectedManualClient.email || null,
                    p_service_name: service.name,
                    p_appointment_date: manualDate,
                    p_start_time: manualTime,
                    p_duration_minutes: service.duration_minutes,
                    p_price_cents: service.price_cents,
                },
            );

            if (createError) {
                console.error("Erro detalhado ao criar agendamento administrativo:", createError);

                const details = [
                    createError.message,
                    createError.details,
                    createError.hint,
                    createError.code ? `Código ${createError.code}` : "",
                ].filter(Boolean).join(" • ");

                throw new Error(details || "O Supabase recusou a criação do agendamento.");
            }

            const createdRow = Array.isArray(createdData)
                ? createdData[0]
                : createdData;

            if (!createdRow?.id) {
                console.error("Retorno inesperado da função administrativa:", createdData);
                throw new Error("O agendamento não retornou os dados esperados.");
            }

            const createdAppointment = createdRow as AdminAppointment;

            setAppointments((current) => [
                ...current.filter((item) => item.id !== createdAppointment.id),
                createdAppointment,
            ]);

            if (createdRow.client_id) {
                setAdminClientProfiles((current) => {
                    if (current.some((profile) => profile.id === createdRow.client_id)) {
                        return current;
                    }

                    return [
                        ...current,
                        {
                            id: createdRow.client_id,
                            full_name: createdRow.client_name,
                            phone: createdRow.client_phone,
                            email: createdRow.client_email,
                        } as ClientProfile,
                    ].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
                });
            }

            setManualSuccess(
                `Agendamento de ${createdRow.client_name} criado com sucesso e vinculado ao perfil da cliente.`,
            );
            setAgendaDate(manualDate);
            setManualTime("");
        } catch (error) {
            console.error("Erro ao criar agendamento:", error);

            const message =
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido retornado pelo Supabase.";

            setManualError(`Não foi possível criar o agendamento: ${message}`);
        } finally {
            setIsSavingManualAppointment(false);
        }
    }

    function openAppointmentDetails(appointment: AdminAppointment) {
        setSelectedAdminAppointment(appointment);
        setEditAppointmentName(appointment.client_name);
        setEditAppointmentPhone(appointment.client_phone);
        setEditAppointmentEmail(appointment.client_email ?? "");
        setEditAppointmentMusicTaste(appointment.musical_taste ?? "");
        setEditAppointmentService(appointment.service_name);
        setEditAppointmentDate(appointment.appointment_date);
        setEditAppointmentTime(String(appointment.start_time).slice(0, 5));
        setEditWeekReferenceDate(appointment.appointment_date);

        const appointmentDate = new Date(`${appointment.appointment_date}T12:00:00`);
        setEditCalendarMonth(
            new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), 1),
        );

        setShowEditDateTimePicker(false);
        setShowEditMonthCalendar(false);
        setAppointmentEditError("");
    }

    const editVisibleWeekDates = useMemo(
        () => getManualWeekDates(editWeekReferenceDate),
        [editWeekReferenceDate],
    );

    function selectEditAppointmentDate(date: string) {
        const today = formatDateForInput(new Date());

        if (date < today) return;

        setEditAppointmentDate(date);
        setEditWeekReferenceDate(date);
        setEditAppointmentTime("");
        setAppointmentEditError("");
        setShowEditMonthCalendar(false);
    }

    function moveEditAppointmentWeek(amount: number) {
        const currentWeek = getManualWeekDates(editWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setEditWeekReferenceDate(nextReference);
        setEditAppointmentTime("");
        setAppointmentEditError("");

        if (firstSelectable) {
            setEditAppointmentDate(firstSelectable);
        }
    }

    function openEditAppointmentMonthCalendar() {
        const reference = new Date(
            `${editAppointmentDate || editWeekReferenceDate}T12:00:00`,
        );

        setEditCalendarMonth(
            new Date(reference.getFullYear(), reference.getMonth(), 1),
        );
        setShowEditMonthCalendar((current) => !current);
    }

    function getEditAppointmentMonthCells() {
        const year = editCalendarMonth.getFullYear();
        const month = editCalendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({length: leadingEmpty}, () => null),
            ...Array.from({length: daysInMonth}, (_, index) =>
                formatDateForInput(new Date(year, month, index + 1)),
            ),
        ];
    }

    const editSelectedService = adminServices.find(
        (service) => service.name === editAppointmentService,
    );

    const editAppointmentAvailableTimes = useMemo(() => {
        if (
            !selectedAdminAppointment ||
            !editAppointmentDate ||
            !editSelectedService
        ) {
            return [] as string[];
        }

        const candidateStarts =
            getFixedAdminManualStartMinutes(editAppointmentDate);

        const occupied: TimeInterval[] = [
            ...appointments
                .filter(
                    (appointment) =>
                        appointment.id !== selectedAdminAppointment.id &&
                        appointment.appointment_date === editAppointmentDate &&
                        appointment.status !== "cancelled" &&
                        appointment.status !== "no-show",
                )
                .map((appointment) => {
                    const start = getMinutesFromTime(appointment.start_time);

                    return {
                        start,
                        end: start + appointment.duration_minutes,
                    };
                }),
            ...adminBlocks
                .filter((block) => block.block_date === editAppointmentDate)
                .map((block) => ({
                    start: getMinutesFromTime(block.start_time),
                    end: getMinutesFromTime(block.end_time),
                })),
        ];

        const merged = mergeIntervals(occupied);
        const now = new Date();
        const today = formatDateForInput(now);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return candidateStarts
            .filter((start) => {
                const end = start + editSelectedService.duration_minutes;
                const isPastToday =
                    editAppointmentDate === today &&
                    start <= currentMinutes;

                const hasConflict = merged.some((interval) =>
                    intervalsOverlap(
                        start,
                        end,
                        interval.start,
                        interval.end,
                    ),
                );

                return !isPastToday && !hasConflict;
            })
            .map(minutesToTime);
    }, [
        selectedAdminAppointment,
        editAppointmentDate,
        editSelectedService,
        appointments,
        adminBlocks,
    ]);

    async function saveAppointmentChanges() {
        if (!selectedAdminAppointment) return;
        const service = adminServices.find((item) => item.name === editAppointmentService);
        if (!service) {
            setAppointmentEditError("Escolha um serviço válido.");
            return;
        }

        if (!editAppointmentDate || !editAppointmentTime) {
            setAppointmentEditError("Escolha a nova data e o horário.");
            return;
        }
        if (editAppointmentName.trim().length < 3 || editAppointmentPhone.replace(/\D/g, "").length < 10) {
            setAppointmentEditError("Informe nome completo e telefone válido.");
            return;
        }
        if (appointmentConflicts(selectedAdminAppointment.id, editAppointmentDate, editAppointmentTime, service.duration_minutes)) {
            setAppointmentEditError("O novo período entra em conflito com outro agendamento ou bloqueio.");
            return;
        }

        setIsSavingAppointment(true);
        const updates = {
            client_name: editAppointmentName.trim(),
            client_phone: formatBrazilianPhone(editAppointmentPhone),
            client_email: editAppointmentEmail.trim() || null,
            musical_taste: editAppointmentMusicTaste.trim() || null,
            service_name: service.name,
            appointment_date: editAppointmentDate,
            start_time: editAppointmentTime,
            duration_minutes: service.duration_minutes,
        };
        const {error} = await supabase.from("appointments").update(updates).eq("id", selectedAdminAppointment.id);
        if (error) {
            console.error("Erro ao editar agendamento:", error);
            setAppointmentEditError("Não foi possível salvar as alterações.");
            setIsSavingAppointment(false);
            return;
        }

        const updated = {...selectedAdminAppointment, ...updates};
        setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
        setSelectedAdminAppointment(updated);
        setAgendaDate(editAppointmentDate);
        setIsSavingAppointment(false);
        setAppointmentEditError("");
    }

    async function cancelAppointment(appointment: AdminAppointment) {
        if (!window.confirm(`Cancelar o agendamento de ${appointment.client_name}?`)) return;
        const {error} = await supabase.from("appointments").update({status: "cancelled"}).eq("id", appointment.id);
        if (error) {
            setPanelError("Não foi possível cancelar o agendamento.");
            return;
        }
        setAppointments((current) => current.map((item) => item.id === appointment.id ? {...item, status: "cancelled"} : item));
        setSelectedAdminAppointment(null);
    }

    async function clearCancelledAppointmentFromHistory(
        appointment: AdminAppointment,
    ) {
        if (appointment.status !== "cancelled") return;

        const confirmed = window.confirm(
            `Limpar do histórico o agendamento cancelado de ${formatAdminDate(
                appointment.appointment_date,
            )} às ${String(appointment.start_time).slice(0, 5)}?`,
        );

        if (!confirmed) return;

        setClearingCancelledAppointmentId(appointment.id);
        setPanelError("");

        try {
            const {error} = await supabase
                .from("appointments")
                .delete()
                .eq("id", appointment.id)
                .eq("status", "cancelled");

            if (error) {
                throw error;
            }

            setAppointments((current) =>
                current.filter((item) => item.id !== appointment.id),
            );

            setSelectedClient((current) =>
                current
                    ? {
                          ...current,
                          appointments: current.appointments.filter(
                              (item) => item.id !== appointment.id,
                          ),
                      }
                    : current,
            );
        } catch (error) {
            console.error(
                "Erro ao limpar agendamento cancelado do histórico:",
                error,
            );
            setPanelError(
                "Não foi possível limpar o agendamento cancelado do histórico.",
            );
        } finally {
            setClearingCancelledAppointmentId(null);
        }
    }

    async function deleteConfirmedAppointmentFromHistory(
        appointment: AdminAppointment,
    ) {
        if (appointment.status !== "confirmed") return;

        const confirmed = window.confirm(
            `Excluir definitivamente o agendamento confirmado de ${formatAdminDate(
                appointment.appointment_date,
            )} às ${String(appointment.start_time).slice(0, 5)}?\n\nEsse agendamento será removido e NÃO ficará no histórico como cancelado.`,
        );

        if (!confirmed) return;

        setDeletingConfirmedAppointmentId(appointment.id);
        setPanelError("");

        try {
            const {error} = await supabase
                .from("appointments")
                .delete()
                .eq("id", appointment.id)
                .eq("status", "confirmed");

            if (error) {
                throw error;
            }

            setAppointments((current) =>
                current.filter((item) => item.id !== appointment.id),
            );

            setSelectedClient((current) =>
                current
                    ? {
                          ...current,
                          appointments: current.appointments.filter(
                              (item) => item.id !== appointment.id,
                          ),
                          nextAppointment:
                              current.nextAppointment?.id === appointment.id
                                  ? null
                                  : current.nextAppointment,
                      }
                    : current,
            );
        } catch (error) {
            console.error(
                "Erro ao excluir agendamento confirmado pelo ADM:",
                error,
            );
            setPanelError(
                "Não foi possível excluir o agendamento confirmado.",
            );
        } finally {
            setDeletingConfirmedAppointmentId(null);
        }
    }

    function normalizeClientPhone(value: string) {
        return normalizeBrazilianPhoneDigits(value);
    }

    function resetNailRecordForm() {
        setShowNailRecordForm(false);
        setNailRecordNotes("");
        setNailRecordFiles([]);
        setNailRecordError("");
        setNailRecordSuccess("");
    }

    function openClientHistory(client: AdminClient) {
        resetNailRecordForm();
        setNailRecords([]);
        setSelectedClient(client);
    }

    function openNailRecordForClient(client: AdminClient) {
        resetNailRecordForm();
        setNailRecords([]);
        setSelectedClient(client);
        setShowNailRecordForm(true);
    }

    function closeClientHistory() {
        resetNailRecordForm();
        setNailRecords([]);
        setSelectedClient(null);
    }

    async function findClientProfile(client: AdminClient): Promise<ClientProfile | null> {
        const {data, error} = await supabase
            .from("client_profiles")
            .select("id, full_name, phone, email, musical_taste, created_at, updated_at");

        if (error) {
            throw error;
        }

        const clientPhoneDigits = normalizeClientPhone(client.phone);

        if (clientPhoneDigits) {
            const matchedByPhone =
                (data ?? []).find(
                    (profile) =>
                        normalizeClientPhone(profile.phone ?? "") === clientPhoneDigits,
                ) ?? null;

            if (matchedByPhone) {
                return matchedByPhone;
            }
        }

        return null;
    }

    async function ensureClientProfile(client: AdminClient): Promise<ClientProfile> {
        const existingProfile = await findClientProfile(client);

        if (existingProfile) {
            const updates = {
                full_name: client.name.trim(),
                phone: client.phone.trim(),
                email: client.email.trim() || null,
                musical_taste: client.musicalTaste.trim() || null,
                updated_at: new Date().toISOString(),
            };

            const {data: updatedProfile, error: updateError} = await supabase
                .from("client_profiles")
                .update(updates)
                .eq("id", existingProfile.id)
                .select("id, full_name, phone, email, musical_taste, created_at, updated_at")
                .single();

            if (updateError) {
                throw updateError;
            }

            return updatedProfile as ClientProfile;
        }

        const {data, error} = await supabase
            .from("client_profiles")
            .insert({
                full_name: client.name.trim(),
                phone: client.phone.trim(),
                email: client.email.trim() || null,
                musical_taste: client.musicalTaste.trim() || null,
            })
            .select("id, full_name, phone, email, musical_taste, created_at, updated_at")
            .single();

        if (error) {
            throw error;
        }

        return data as ClientProfile;
    }

    async function loadNailRecordsForClient(client: AdminClient) {
        setIsLoadingNailRecords(true);
        setNailRecordError("");

        try {
            const profile = await findClientProfile(client);

            if (!profile) {
                setNailRecords([]);
                return;
            }

            const {data: recordData, error: recordError} = await supabase
                .from("nail_records")
                .select("id, client_id, notes, created_at")
                .eq("client_id", profile.id)
                .order("created_at", {ascending: false});

            if (recordError) {
                throw recordError;
            }

            const records = (recordData ?? []) as Omit<NailRecord, "photos">[];

            if (!records.length) {
                setNailRecords([]);
                return;
            }

            const recordIds = records.map((record) => record.id);

            const {data: photoData, error: photoError} = await supabase
                .from("nail_record_photos")
                .select("id, nail_record_id, photo_path, created_at")
                .in("nail_record_id", recordIds)
                .order("created_at", {ascending: true});

            if (photoError) {
                throw photoError;
            }

            const photosWithSignedUrls = await Promise.all(
                ((photoData ?? []) as NailRecordPhoto[]).map(async (photo) => {
                    const {data: signedData, error: signedError} = await supabase
                        .storage
                        .from("nail-records")
                        .createSignedUrl(photo.photo_path, 60 * 60);

                    if (signedError) {
                        console.error("Erro ao gerar URL temporária da foto:", signedError);
                        return photo;
                    }

                    return {
                        ...photo,
                        signedUrl: signedData.signedUrl,
                    };
                }),
            );

            setNailRecords(
                records.map((record) => ({
                    ...record,
                    photos: photosWithSignedUrls.filter(
                        (photo) => photo.nail_record_id === record.id,
                    ),
                })),
            );
        } catch (error) {
            console.error("Erro ao carregar registros das unhas:", error);
            setNailRecordError("Não foi possível carregar os registros das unhas.");
            setNailRecords([]);
        } finally {
            setIsLoadingNailRecords(false);
        }
    }

    function handleNailCameraSelection(event: React.ChangeEvent<HTMLInputElement>) {
        const selectedFiles = Array.from(event.target.files ?? [])
            .filter((file) => file.type.startsWith("image/"));

        if (!selectedFiles.length) {
            event.currentTarget.value = "";
            return;
        }

        const oversizedFile = selectedFiles.find(
            (file) => file.size > 12 * 1024 * 1024,
        );

        if (oversizedFile) {
            setNailRecordError("Cada foto pode ter no máximo 12 MB.");
            event.currentTarget.value = "";
            return;
        }

        setNailRecordError("");
        setNailRecordSuccess("");
        setNailRecordFiles((current) => [...current, ...selectedFiles].slice(0, 6));
        event.currentTarget.value = "";
    }

    function removeNailRecordFile(index: number) {
        setNailRecordFiles((current) =>
            current.filter((_, currentIndex) => currentIndex !== index),
        );
    }

    async function saveNailRecord() {
        if (!selectedClient) {
            return;
        }

        setNailRecordError("");
        setNailRecordSuccess("");

        if (!nailRecordFiles.length) {
            setNailRecordError("Tire pelo menos uma foto da unha antes de salvar.");
            return;
        }

        setIsSavingNailRecord(true);

        let createdRecordId: string | null = null;
        const uploadedPaths: string[] = [];

        try {
            const profile = await ensureClientProfile(selectedClient);

            const {data: recordData, error: recordError} = await supabase
                .from("nail_records")
                .insert({
                    client_id: profile.id,
                    notes: nailRecordNotes.trim() || null,
                })
                .select("id, client_id, notes, created_at")
                .single();

            if (recordError || !recordData) {
                throw recordError ?? new Error("Não foi possível criar o registro.");
            }

            createdRecordId = recordData.id;

            const photoRows: Array<{
                nail_record_id: string;
                photo_path: string;
            }> = [];

            for (let index = 0; index < nailRecordFiles.length; index += 1) {
                const file = nailRecordFiles[index];
                const originalExtension = file.name.includes(".")
                    ? file.name.split(".").pop()?.toLowerCase()
                    : "";
                const safeExtension = originalExtension?.replace(/[^a-z0-9]/g, "") || "jpg";
                const uniqueId =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;

                const photoPath =
                    `${profile.id}/${recordData.id}/${uniqueId}.${safeExtension}`;

                const {error: uploadError} = await supabase
                    .storage
                    .from("nail-records")
                    .upload(photoPath, file, {
                        cacheControl: "3600",
                        upsert: false,
                        contentType: file.type || "image/jpeg",
                    });

                if (uploadError) {
                    throw uploadError;
                }

                uploadedPaths.push(photoPath);
                photoRows.push({
                    nail_record_id: recordData.id,
                    photo_path: photoPath,
                });
            }

            const {error: photoInsertError} = await supabase
                .from("nail_record_photos")
                .insert(photoRows);

            if (photoInsertError) {
                throw photoInsertError;
            }

            setNailRecordNotes("");
            setNailRecordFiles([]);
            setShowNailRecordForm(false);
            setNailRecordSuccess("Registro da unha salvo com sucesso.");

            await loadNailRecordsForClient(selectedClient);
        } catch (error) {
            console.error("Erro ao salvar registro da unha:", error);

            if (uploadedPaths.length) {
                await supabase.storage.from("nail-records").remove(uploadedPaths);
            }

            if (createdRecordId) {
                await supabase
                    .from("nail_records")
                    .delete()
                    .eq("id", createdRecordId);
            }

            setNailRecordError(
                "Não foi possível salvar o registro. Confira a conexão e tente novamente.",
            );
        } finally {
            setIsSavingNailRecord(false);
        }
    }

    async function deleteNailRecord(record: NailRecord) {
        if (!selectedClient || deletingNailRecordId) {
            return;
        }

        const confirmed = window.confirm(
            "Deseja realmente excluir este registro da unha? As fotos e observações deste registro serão apagadas permanentemente.",
        );

        if (!confirmed) {
            return;
        }

        setDeletingNailRecordId(record.id);
        setNailRecordError("");
        setNailRecordSuccess("");

        try {
            const photoPaths = record.photos
                .map((photo) => photo.photo_path)
                .filter(Boolean);

            if (photoPaths.length) {
                const {error: storageError} = await supabase
                    .storage
                    .from("nail-records")
                    .remove(photoPaths);

                if (storageError) {
                    throw storageError;
                }
            }

            const {error: photoDeleteError} = await supabase
                .from("nail_record_photos")
                .delete()
                .eq("nail_record_id", record.id);

            if (photoDeleteError) {
                throw photoDeleteError;
            }

            const {error: recordDeleteError} = await supabase
                .from("nail_records")
                .delete()
                .eq("id", record.id);

            if (recordDeleteError) {
                throw recordDeleteError;
            }

            setNailRecords((current) =>
                current.filter((item) => item.id !== record.id),
            );
            setNailRecordSuccess("Registro da unha excluído com sucesso.");
        } catch (error) {
            console.error("Erro ao excluir registro da unha:", error);
            setNailRecordError(
                "Não foi possível excluir o registro da unha. Tente novamente.",
            );
        } finally {
            setDeletingNailRecordId(null);
        }
    }

    useEffect(() => {
        if (!isAuthenticated || !selectedClient) {
            setNailRecords([]);
            setIsLoadingNailRecords(false);
            return;
        }

        void loadNailRecordsForClient(selectedClient);
    }, [isAuthenticated, selectedClient?.key]);

    const clients = useMemo<AdminClient[]>(() => {
        type ClientGroup = {
            key: string;
            profile: ClientProfile | null;
            appointments: AdminAppointment[];
        };

        const groups = new Map<string, ClientGroup>();
        const profileIdToKey = new Map<string, string>();
        const phoneToKey = new Map<string, string>();

        /*
         * client_profiles é a fonte principal da lista.
         * Assim, uma cliente aparece no painel imediatamente após criar a conta,
         * mesmo que ainda não tenha nenhum agendamento.
         */
        adminClientProfiles.forEach((profile) => {
            const digits = normalizeClientPhone(profile.phone ?? "");
            const key = `profile:${profile.id}`;

            groups.set(key, {
                key,
                profile,
                appointments: [],
            });

            profileIdToKey.set(profile.id, key);

            if (digits) {
                phoneToKey.set(digits, key);
            }
        });

        /*
         * Os agendamentos são anexados ao perfil existente pelo client_id.
         * Para registros antigos sem client_id, usamos o telefone como fallback.
         * Só criamos um grupo legado quando realmente não existe perfil correspondente.
         */
        appointments.forEach((appointment) => {
            const digits = normalizeClientPhone(appointment.client_phone);
            const profileKey = appointment.client_id
                ? profileIdToKey.get(appointment.client_id)
                : undefined;
            const phoneKey = digits ? phoneToKey.get(digits) : undefined;
            const key =
                profileKey ??
                phoneKey ??
                `legacy:${digits || appointment.id}`;

            const existing = groups.get(key);

            if (existing) {
                existing.appointments.push(appointment);
                return;
            }

            groups.set(key, {
                key,
                profile: null,
                appointments: [appointment],
            });

            if (digits) {
                phoneToKey.set(digits, key);
            }
        });

        return Array.from(groups.values())
            .map((group): AdminClient | null => {
                /*
                 * Preserva a função "Remover da lista":
                 * se a cliente possui agendamentos e todos foram marcados como ocultos,
                 * ela continua escondida. Perfil recém-cadastrado, sem agendamentos,
                 * aparece normalmente.
                 */
                const visibleAppointments = group.appointments.filter(
                    (appointment) => !appointment.client_hidden,
                );

                if (
                    group.appointments.length > 0 &&
                    visibleAppointments.length === 0
                ) {
                    return null;
                }

                const ordered = [...visibleAppointments].sort(
                    (a, b) =>
                        getAppointmentDateTime(b).getTime() -
                        getAppointmentDateTime(a).getTime(),
                );

                const reference = ordered[0] ?? null;

                const completed = ordered.filter(
                    (item) =>
                        item.status !== "cancelled" &&
                        item.status !== "no-show" &&
                        (
                            item.status === "completed" ||
                            getAppointmentEndDateTime(item).getTime() <=
                                adminNow.getTime()
                        ),
                );

                const upcoming = ordered
                    .filter(
                        (item) =>
                            item.status !== "cancelled" &&
                            item.status !== "no-show" &&
                            item.status !== "completed" &&
                            getAppointmentEndDateTime(item).getTime() >
                                adminNow.getTime(),
                    )
                    .sort(
                        (a, b) =>
                            getAppointmentDateTime(a).getTime() -
                            getAppointmentDateTime(b).getTime(),
                    );

                const profile = group.profile;

                return {
                    key: group.key,
                    name:
                        profile?.full_name ??
                        reference?.client_name ??
                        "Cliente",
                    phone:
                        profile?.phone ??
                        reference?.client_phone ??
                        "",
                    email:
                        profile?.email ??
                        reference?.client_email ??
                        "",
                    musicalTaste:
                        profile?.musical_taste ??
                        reference?.musical_taste ??
                        "",
                    appointments: ordered,
                    lastAppointment: completed[0] ?? null,
                    nextAppointment: upcoming[0] ?? null,
                };
            })
            .filter((client): client is AdminClient => client !== null)
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [appointments, adminClientProfiles, adminNow]);

    const filteredClients = useMemo(() => {
        const query = clientSearch
            .trim()
            .toLocaleLowerCase("pt-BR");
        const digits = clientSearch.replace(/\D/g, "");

        if (!query) return clients;

        return clients.filter((client) => {
            const normalizedName = client.name
                .trim()
                .toLocaleLowerCase("pt-BR");

            const clientPhoneDigits = client.phone.replace(/\D/g, "");

            const matchesName = normalizedName.startsWith(query);
            const matchesPhone =
                Boolean(digits) &&
                clientPhoneDigits.includes(digits);

            return matchesName || matchesPhone;
        });
    }, [clients, clientSearch]);

    const manualBookingClients = useMemo<AdminBookingClient[]>(() => {
        const byPhone = new Map<string, AdminBookingClient>();

        adminClientProfiles.forEach((profile) => {
            const digits = normalizeClientPhone(profile.phone ?? "");
            const key = digits || `profile:${profile.id}`;
            byPhone.set(key, {
                key,
                profileId: profile.id,
                name: profile.full_name,
                phone: profile.phone,
                email: profile.email ?? "",
                userId: profile.user_id ?? null,
            });
        });

        clients.forEach((client) => {
            const digits = normalizeClientPhone(client.phone);
            const key = digits || `client:${client.key}`;
            if (!byPhone.has(key)) {
                byPhone.set(key, {
                    key,
                    profileId: null,
                    name: client.name,
                    phone: client.phone,
                    email: client.email,
                });
            }
        });

        return Array.from(byPhone.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [adminClientProfiles, clients]);

    const filteredManualBookingClients = useMemo(() => {
        const query = manualClientSearch
            .trim()
            .toLocaleLowerCase("pt-BR");
        const digits = manualClientSearch.replace(/\D/g, "");

        if (!query) return [] as AdminBookingClient[];

        return manualBookingClients
            .filter((client) => {
                const normalizedName = client.name
                    .trim()
                    .toLocaleLowerCase("pt-BR");

                const clientPhoneDigits = client.phone.replace(/\D/g, "");

                const matchesName = normalizedName.startsWith(query);
                const matchesPhone =
                    Boolean(digits) &&
                    clientPhoneDigits.includes(digits);

                return matchesName || matchesPhone;
            })
            .slice(0, 8);
    }, [manualBookingClients, manualClientSearch]);

    function getManualWeekDates(referenceDate: string) {
        const reference = new Date(`${referenceDate}T12:00:00`);
        const day = reference.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        reference.setDate(reference.getDate() + diffToMonday);

        return Array.from({length: 7}, (_, index) => {
            const date = new Date(reference);
            date.setDate(reference.getDate() + index);
            return formatDateForInput(date);
        });
    }

    const manualVisibleWeekDates = useMemo(
        () => getManualWeekDates(manualWeekReferenceDate),
        [manualWeekReferenceDate],
    );

    function selectManualBookingDate(date: string) {
        const today = formatDateForInput(new Date());
        if (date < today) return;

        setManualDate(date);
        setManualWeekReferenceDate(date);
        setManualTime("");
        setManualError("");
        setShowManualMonthCalendar(false);
    }

    function moveManualBookingWeek(amount: number) {
        const currentWeek = getManualWeekDates(manualWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setManualWeekReferenceDate(nextReference);
        setManualTime("");
        setManualError("");

        if (firstSelectable) {
            setManualDate(firstSelectable);
        }
    }

    function openManualMonthCalendar() {
        const reference = new Date(`${manualDate || manualWeekReferenceDate}T12:00:00`);
        setManualCalendarMonth(new Date(reference.getFullYear(), reference.getMonth(), 1));
        setShowManualMonthCalendar((current) => !current);
    }

    function getManualMonthCalendarCells() {
        const year = manualCalendarMonth.getFullYear();
        const month = manualCalendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({length: leadingEmpty}, () => null),
            ...Array.from({length: daysInMonth}, (_, index) =>
                formatDateForInput(new Date(year, month, index + 1)),
            ),
        ];
    }

    const manualSelectedService = adminServices.find((service) => service.name === manualServiceName);

    const manualAvailableTimes = useMemo(() => {
        if (!manualDate || !manualSelectedService) return [] as string[];

        const candidateStarts = getFixedAdminManualStartMinutes(manualDate);

        const occupied: TimeInterval[] = [
            ...appointments
                .filter((appointment) =>
                    appointment.appointment_date === manualDate &&
                    appointment.status !== "cancelled" &&
                    appointment.status !== "no-show",
                )
                .map((appointment) => {
                    const start = getMinutesFromTime(appointment.start_time);
                    return {start, end: start + appointment.duration_minutes};
                }),
            ...adminBlocks
                .filter((block) => block.block_date === manualDate)
                .map((block) => ({
                    start: getMinutesFromTime(block.start_time),
                    end: getMinutesFromTime(block.end_time),
                })),
        ];

        const merged = mergeIntervals(occupied);
        const now = new Date();
        const today = formatDateForInput(now);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return candidateStarts
            .filter((start) => {
                const end = start + manualSelectedService.duration_minutes;
                const isPastToday = manualDate === today && start <= currentMinutes;
                const hasConflict = merged.some((occupiedInterval) =>
                    intervalsOverlap(
                        start,
                        end,
                        occupiedInterval.start,
                        occupiedInterval.end,
                    ),
                );

                return !isPastToday && !hasConflict;
            })
            .map(minutesToTime);
    }, [
        manualDate,
        manualSelectedService,
        appointments,
        adminBlocks,
    ]);

    function formatBirthDateForDisplay(value: string | null | undefined) {
        if (!value) return "";

        const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!isoMatch) return value;

        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    function formatBirthDateForDatabase(value: string) {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        }

        return trimmed;
    }

    function updateClientAnamnesisField(
        field: keyof ClientAnamnesisForm,
        value: string,
    ) {
        setClientAnamnesis((current) => ({
            ...current,
            [field]: value,
        }));
    }

    async function loadClientAnamnesis(profileId: string) {
        setIsLoadingClientAnamnesis(true);

        const {data, error} = await supabase
            .from("client_anamnesis")
            .select(
                "birth_date, referral, pregnant, diabetes, bariatric, chemotherapy, thyroid, nail_biting, allergies, mycosis, continuous_medication, cleaning_products",
            )
            .eq("client_id", profileId)
            .maybeSingle();

        if (error) {
            console.error("Erro ao carregar ficha de anamnese:", error);
            setClientAnamnesis(emptyClientAnamnesis);
            setIsLoadingClientAnamnesis(false);
            return;
        }

        setClientAnamnesis({
            birthDate: formatBirthDateForDisplay(data?.birth_date),
            referral: data?.referral ?? "",
            pregnant: data?.pregnant ?? "",
            diabetes: data?.diabetes ?? "",
            bariatric: data?.bariatric ?? "",
            chemotherapy: data?.chemotherapy ?? "",
            thyroid: data?.thyroid ?? "",
            nailBiting: data?.nail_biting ?? "",
            allergies: data?.allergies ?? "",
            mycosis: data?.mycosis ?? "",
            continuousMedication: data?.continuous_medication ?? "",
            cleaningProducts: data?.cleaning_products ?? "",
        });

        setIsLoadingClientAnamnesis(false);
    }

    async function openClientEditor(client: AdminClient) {
        setEditingClient(client);
        setEditClientName(client.name);
        setEditClientPhone(client.phone);
        setEditClientEmail(client.email);
        setClientAnamnesis(emptyClientAnamnesis);

        const phoneDigits = normalizeClientPhone(client.phone);
        const profile = adminClientProfiles.find(
            (item) => normalizeClientPhone(item.phone ?? "") === phoneDigits,
        );

        setEditClientMusicTaste(
            profile?.musical_taste ?? client.musicalTaste ?? "",
        );
        setClientEditError("");

        if (profile?.id) {
            await loadClientAnamnesis(profile.id);
        }
    }

    async function saveClientChanges() {
        if (!editingClient) return;

        if (
            editClientName.trim().length < 3 ||
            editClientPhone.replace(/\D/g, "").length < 10
        ) {
            setClientEditError("Informe nome completo e telefone válido.");
            return;
        }

        setIsSavingClient(true);
        setClientEditError("");

        const ids = editingClient.appointments.map((item) => item.id);
        const normalizedPhone = formatBrazilianPhone(editClientPhone);
        const musicalTaste = editClientMusicTaste.trim() || null;

        try {
            if (ids.length) {
                const {error: appointmentError} = await supabase
                    .from("appointments")
                    .update({
                        client_name: editClientName.trim(),
                        client_phone: normalizedPhone,
                        client_email: editClientEmail.trim() || null,
                        musical_taste: musicalTaste,
                    })
                    .in("id", ids);

                if (appointmentError) throw appointmentError;
            }

            const existingProfile = await findClientProfile(editingClient);

            if (existingProfile) {
                const {data: updatedProfile, error: profileError} = await supabase
                    .from("client_profiles")
                    .update({
                        full_name: editClientName.trim(),
                        phone: normalizedPhone,
                        email: editClientEmail.trim() || null,
                        musical_taste: musicalTaste,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingProfile.id)
                    .select(
                        "id, full_name, phone, email, musical_taste, phone_digits, user_id, created_at, updated_at",
                    )
                    .single();

                if (profileError) throw profileError;

                setAdminClientProfiles((current) =>
                    current.map((profile) =>
                        profile.id === existingProfile.id
                            ? updatedProfile as ClientProfile
                            : profile,
                    ),
                );
            }

            if (existingProfile) {
                const {error: anamnesisError} = await supabase
                    .from("client_anamnesis")
                    .upsert(
                        {
                            client_id: existingProfile.id,
                            birth_date: formatBirthDateForDatabase(
                                clientAnamnesis.birthDate,
                            ),
                            referral: clientAnamnesis.referral.trim() || null,
                            pregnant: clientAnamnesis.pregnant.trim() || null,
                            diabetes: clientAnamnesis.diabetes.trim() || null,
                            bariatric: clientAnamnesis.bariatric.trim() || null,
                            chemotherapy: clientAnamnesis.chemotherapy.trim() || null,
                            thyroid: clientAnamnesis.thyroid.trim() || null,
                            nail_biting: clientAnamnesis.nailBiting.trim() || null,
                            allergies: clientAnamnesis.allergies.trim() || null,
                            mycosis: clientAnamnesis.mycosis.trim() || null,
                            continuous_medication:
                                clientAnamnesis.continuousMedication.trim() || null,
                            cleaning_products:
                                clientAnamnesis.cleaningProducts.trim() || null,
                            updated_at: new Date().toISOString(),
                        },
                        {
                            onConflict: "client_id",
                        },
                    );

                if (anamnesisError) {
                    throw anamnesisError;
                }
            }

            setAppointments((current) =>
                current.map((item) =>
                    ids.includes(item.id)
                        ? {
                            ...item,
                            client_name: editClientName.trim(),
                            client_phone: normalizedPhone,
                            client_email: editClientEmail.trim() || null,
                            musical_taste: musicalTaste,
                        }
                        : item,
                ),
            );

            setEditingClient(null);
        } catch (error) {
            console.error("Erro ao atualizar cadastro da cliente:", error);
            setClientEditError("Não foi possível atualizar o cadastro.");
        } finally {
            setIsSavingClient(false);
        }
    }

    async function deleteClient(client: AdminClient) {
        if (!window.confirm(`Remover ${client.name} da lista de clientes? O histórico financeiro e os agendamentos serão preservados.`)) return;

        const appointmentIds = client.appointments.map((appointment) => appointment.id);

        if (!appointmentIds.length) {
            setSelectedClient(null);
            return;
        }

        setDeletingClientKey(client.key);
        setPanelError("");

        try {
            const {error} = await supabase
                .from("appointments")
                .update({client_hidden: true})
                .in("id", appointmentIds);

            if (error) {
                throw error;
            }

            setAppointments((current) =>
                current.map((appointment) =>
                    appointmentIds.includes(appointment.id)
                        ? {...appointment, client_hidden: true}
                        : appointment,
                ),
            );

            setSelectedClient(null);
        } catch (error) {
            console.error("Erro ao remover cliente da lista:", error);
            setPanelError("Não foi possível remover a cliente da lista.");
        } finally {
            setDeletingClientKey("");
        }
    }

    const weekDates = useMemo(() => {
        const selected = new Date(`${agendaDate}T12:00:00`);
        const mondayOffset = selected.getDay() === 0 ? -6 : 1 - selected.getDay();
        const monday = addDaysToInputDate(agendaDate, mondayOffset);
        return Array.from({length: 7}, (_, index) => addDaysToInputDate(monday, index));
    }, [agendaDate]);

    const agendaVisibleWeekDates = useMemo(
        () => getManualWeekDates(agendaWeekReferenceDate),
        [agendaWeekReferenceDate],
    );

    function selectAgendaPickerDate(date: string) {
        setAgendaDate(date);
        setAgendaWeekReferenceDate(date);
        setShowAgendaMonthCalendar(false);
        setShowAgendaDatePicker(false);
    }

    function moveAgendaPickerWeek(amount: number) {
        const currentWeek = getManualWeekDates(agendaWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);

        setAgendaWeekReferenceDate(nextReference);
        setShowAgendaMonthCalendar(false);
    }

    function openAgendaMonthCalendar() {
        const reference = new Date(`${agendaDate || agendaWeekReferenceDate}T12:00:00`);
        setAgendaCalendarMonth(
            new Date(reference.getFullYear(), reference.getMonth(), 1),
        );
        setShowAgendaMonthCalendar((current) => !current);
    }

    function getAgendaMonthCalendarCells() {
        const year = agendaCalendarMonth.getFullYear();
        const month = agendaCalendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({ length: leadingEmpty }, () => null),
            ...Array.from({ length: daysInMonth }, (_, index) =>
                formatDateForInput(new Date(year, month, index + 1)),
            ),
        ];
    }

    const agendaPickerMonthLabel = useMemo(() => {
        const reference = new Date(`${agendaWeekReferenceDate}T12:00:00`);
        return reference.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [agendaWeekReferenceDate]);

    function shouldShowAppointmentInAdminAgenda(appointment: AdminAppointment) {
        if (
            appointment.status === "cancelled" ||
            appointment.status === "completed" ||
            appointment.status === "no-show"
        ) {
            return false;
        }

        return getAppointmentDateTime(appointment).getTime() > adminNow.getTime();
    }

    const agendaAppointments = useMemo(() =>
            appointments
                .filter(
                    (item) =>
                        item.appointment_date === agendaDate &&
                        shouldShowAppointmentInAdminAgenda(item),
                )
                .sort((a, b) => getMinutesFromTime(a.start_time) - getMinutesFromTime(b.start_time)),
        [appointments, agendaDate, adminNow]);

    const weeklyAppointments = useMemo(() =>
            appointments
                .filter(
                    (item) =>
                        weekDates.includes(item.appointment_date) &&
                        shouldShowAppointmentInAdminAgenda(item),
                )
                .sort((a, b) => `${a.appointment_date}${String(a.start_time).slice(0, 5)}`.localeCompare(`${b.appointment_date}${String(b.start_time).slice(0, 5)}`)),
        [appointments, weekDates, adminNow]);

    function addMonthsToAgendaMonth(monthValue: string, amount: number) {
        const [year, month] = monthValue.split("-").map(Number);
        const date = new Date(year, month - 1 + amount, 1, 12, 0, 0);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    const monthlyAgendaMonthLabel = useMemo(() => {
        const [year, month] = monthlyAgendaMonth.split("-").map(Number);
        return new Date(year, month - 1, 1, 12, 0, 0).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [monthlyAgendaMonth]);

    const monthlyAgendaAppointments = useMemo(
        () =>
            appointments
                .filter(
                    (item) =>
                        item.appointment_date.startsWith(monthlyAgendaMonth) &&
                        shouldShowAppointmentInAdminAgenda(item),
                )
                .sort((a, b) =>
                    `${a.appointment_date}${String(a.start_time).slice(0, 5)}`.localeCompare(
                        `${b.appointment_date}${String(b.start_time).slice(0, 5)}`,
                    ),
                ),
        [appointments, monthlyAgendaMonth, adminNow],
    );

    const monthlyAgendaDates = useMemo(
        () =>
            Array.from(
                new Set(
                    monthlyAgendaAppointments.map(
                        (appointment) => appointment.appointment_date,
                    ),
                ),
            ),
        [monthlyAgendaAppointments],
    );

    function addMonthsToFinanceMonth(monthValue: string, amount: number) {
        const [year, month] = monthValue.split("-").map(Number);
        const date = new Date(year, month - 1 + amount, 1, 12, 0, 0);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    const financeMonthLabel = useMemo(() => {
        const [year, month] = financeMonth.split("-").map(Number);
        return new Date(year, month - 1, 1, 12, 0, 0).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [financeMonth]);

    const financeMonthOptions = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ];

    function selectFinanceMonth(monthIndex: number) {
        const month = String(monthIndex + 1).padStart(2, "0");
        setFinanceMonth(`${financePickerYear}-${month}`);
        setShowFinanceMonthPicker(false);
    }

    function openFinanceMonthPicker() {
        const [year] = financeMonth.split("-").map(Number);
        setFinancePickerYear(year);
        setShowFinanceMonthPicker((current) => !current);
    }

    function selectCurrentFinanceMonth() {
        const now = new Date();
        setFinanceMonth(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        );
        setFinancePickerYear(now.getFullYear());
        setShowFinanceMonthPicker(false);
    }

    const financeAppointments = useMemo(
        () => appointments.filter((appointment) => appointment.appointment_date.startsWith(financeMonth)),
        [appointments, financeMonth],
    );

    const completedFinanceAppointments = useMemo(
        () => financeAppointments.filter(
            (appointment) =>
                appointment.status !== "cancelled" &&
                appointment.status !== "no-show" &&
                (
                    appointment.status === "completed" ||
                    getAppointmentDateTime(appointment).getTime() <= adminNow.getTime()
                ),
        ),
        [financeAppointments, adminNow],
    );

    const scheduledFinanceAppointments = useMemo(
        () => financeAppointments.filter(
            (appointment) =>
                appointment.status !== "cancelled" &&
                appointment.status !== "no-show" &&
                appointment.status !== "completed" &&
                getAppointmentDateTime(appointment).getTime() > adminNow.getTime(),
        ),
        [financeAppointments, adminNow],
    );

    const financeServiceSummary = useMemo(() => {
        const summary = new Map<string, {
            serviceName: string;
            completedCount: number;
            completedCents: number;
            scheduledCount: number;
            scheduledCents: number;
        }>();

        [...completedFinanceAppointments, ...scheduledFinanceAppointments].forEach((appointment) => {
            const current = summary.get(appointment.service_name) ?? {
                serviceName: appointment.service_name,
                completedCount: 0,
                completedCents: 0,
                scheduledCount: 0,
                scheduledCents: 0,
            };

            const isAutomaticallyCompleted =
                appointment.status === "completed" ||
                getAppointmentDateTime(appointment).getTime() <= adminNow.getTime();

            if (isAutomaticallyCompleted) {
                current.completedCount += 1;
                current.completedCents += appointment.price_cents ?? 0;
            } else {
                current.scheduledCount += 1;
                current.scheduledCents += appointment.price_cents ?? 0;
            }

            summary.set(appointment.service_name, current);
        });

        return Array.from(summary.values()).sort(
            (a, b) => (b.completedCents + b.scheduledCents) - (a.completedCents + a.scheduledCents),
        );
    }, [completedFinanceAppointments, scheduledFinanceAppointments, adminNow]);

    function getNotificationKey(appointmentId: string, type: WhatsAppNotificationType) {
        return `${appointmentId}:${type}`;
    }

    function markWhatsAppNotificationOpened(
        appointment: AdminAppointment,
        type: WhatsAppNotificationType,
    ) {
        const key = getNotificationKey(appointment.id, type);
        setOpenedWhatsAppNotifications((current) => ({...current, [key]: true}));
    }

    function getWhatsAppUrl(
        appointment: AdminAppointment,
        type: WhatsAppNotificationType,
    ) {
        const phone = normalizePhoneForWhatsApp(appointment.client_phone);
        const message = buildWhatsAppMessage(appointment, type);
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }

    function getDueNotificationTypes(appointment: AdminAppointment) {
        if (appointment.status === "cancelled") return [] as WhatsAppNotificationType[];

        const appointmentTime = getAppointmentDateTime(appointment).getTime();
        const difference = appointmentTime - notificationClock;
        const hour = 60 * 60 * 1000;
        const types: WhatsAppNotificationType[] = [];

        if (difference > 2 * hour && difference <= 24 * hour) {
            types.push("attendance-confirmation");
        }

        // A segunda mensagem automática, que aparecia quando faltavam
        // até 2 horas para o atendimento, foi desativada por enquanto.
        return types;
    }

    const pendingWhatsAppNotifications = useMemo(() => {
        return appointments
            .flatMap((appointment) =>
                getDueNotificationTypes(appointment).map((type) => ({
                    appointment,
                    type,
                    key: getNotificationKey(appointment.id, type),
                })),
            )
            .filter((notification) => !openedWhatsAppNotifications[notification.key])
            .sort(
                (first, second) =>
                    getAppointmentDateTime(first.appointment).getTime() -
                    getAppointmentDateTime(second.appointment).getTime(),
            );
    }, [appointments, notificationClock, openedWhatsAppNotifications]);


    const scheduleConfigVisibleWeekDates = useMemo(
        () => getManualWeekDates(scheduleConfigWeekReferenceDate),
        [scheduleConfigWeekReferenceDate],
    );

    const scheduleConfigTimes = useMemo(
        () =>
            getConfiguredClientStartMinutes(
                scheduleConfigDate,
                adminTimeOverrides,
            ).map(minutesToTime),
        [scheduleConfigDate, adminTimeOverrides],
    );

    function selectScheduleConfigDate(date: string) {
        const today = formatDateForInput(new Date());
        if (date < today) return;

        setScheduleConfigDate(date);
        setScheduleConfigWeekReferenceDate(date);
        setScheduleConfigEditingTime(null);
        setScheduleConfigEditedTime("");
        setScheduleConfigNewTime("");
        setScheduleConfigError("");
        setScheduleConfigSuccess("");
    }

    function moveScheduleConfigWeek(amount: number) {
        const currentWeek = getManualWeekDates(scheduleConfigWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setScheduleConfigWeekReferenceDate(nextReference);
        setScheduleConfigEditingTime(null);
        setScheduleConfigEditedTime("");
        setScheduleConfigError("");
        setScheduleConfigSuccess("");

        if (firstSelectable) {
            setScheduleConfigDate(firstSelectable);
        }
    }

    function normalizeScheduleConfigTime(value: string) {
        const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;

        const hours = Number(match[1]);
        const minutes = Number(match[2]);

        if (
            !Number.isInteger(hours) ||
            !Number.isInteger(minutes) ||
            hours < 0 ||
            hours > 23 ||
            minutes < 0 ||
            minutes > 59
        ) {
            return null;
        }

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function mergeSavedTimeOverrides(rows: ScheduleTimeOverride[]) {
        setAdminTimeOverrides((current) => {
            const savedKeys = new Set(
                rows.map(
                    (item) =>
                        `${item.override_date}|${String(item.start_time).slice(0, 5)}`,
                ),
            );

            return [
                ...current.filter(
                    (item) =>
                        !savedKeys.has(
                            `${item.override_date}|${String(item.start_time).slice(0, 5)}`,
                        ),
                ),
                ...rows.map((item) => ({
                    ...item,
                    start_time: String(item.start_time).slice(0, 5),
                })),
            ];
        });
    }

    async function saveScheduleTimeOverride(
        time: string,
        isAvailable: boolean,
    ) {
        const normalizedTime = normalizeScheduleConfigTime(time);

        if (!normalizedTime) {
            throw new Error("Informe um horário válido.");
        }

        const {data, error} = await supabase
            .from("schedule_time_overrides")
            .upsert(
                {
                    override_date: scheduleConfigDate,
                    start_time: normalizedTime,
                    is_available: isAvailable,
                    updated_at: new Date().toISOString(),
                },
                {onConflict: "override_date,start_time"},
            )
            .select("id, override_date, start_time, is_available, created_at, updated_at");

        if (error) throw error;

        mergeSavedTimeOverrides((data ?? []) as ScheduleTimeOverride[]);
    }

    async function addScheduleConfigTime() {
        setScheduleConfigError("");
        setScheduleConfigSuccess("");

        const normalizedTime = normalizeScheduleConfigTime(scheduleConfigNewTime);

        if (!normalizedTime) {
            setScheduleConfigError("Informe um horário válido.");
            return;
        }

        if (scheduleConfigTimes.includes(normalizedTime)) {
            setScheduleConfigError("Esse horário já está disponível nessa data.");
            return;
        }

        setIsSavingScheduleConfig(true);

        try {
            await saveScheduleTimeOverride(normalizedTime, true);
            setScheduleConfigNewTime("");
            setScheduleConfigSuccess(
                `Horário ${normalizedTime} adicionado somente em ${new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR")}.`,
            );
        } catch (error) {
            console.error("Erro ao adicionar exceção de horário:", error);
            setScheduleConfigError("Não foi possível adicionar esse horário.");
        } finally {
            setIsSavingScheduleConfig(false);
        }
    }

    async function removeScheduleConfigTime(time: string) {
        const confirmed = window.confirm(
            `Remover ${time} somente de ${new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR")}?`,
        );

        if (!confirmed) return;

        setScheduleConfigError("");
        setScheduleConfigSuccess("");
        setIsSavingScheduleConfig(true);

        try {
            await saveScheduleTimeOverride(time, false);
            setScheduleConfigEditingTime(null);
            setScheduleConfigEditedTime("");
            setScheduleConfigSuccess(
                `Horário ${time} removido somente dessa data.`,
            );
        } catch (error) {
            console.error("Erro ao remover exceção de horário:", error);
            setScheduleConfigError("Não foi possível remover esse horário.");
        } finally {
            setIsSavingScheduleConfig(false);
        }
    }

    function beginEditScheduleConfigTime(time: string) {
        setScheduleConfigEditingTime(time);
        setScheduleConfigEditedTime(time);
        setScheduleConfigError("");
        setScheduleConfigSuccess("");
    }

    async function saveEditedScheduleConfigTime() {
        if (!scheduleConfigEditingTime) return;

        const normalizedNewTime = normalizeScheduleConfigTime(
            scheduleConfigEditedTime,
        );

        if (!normalizedNewTime) {
            setScheduleConfigError("Informe um novo horário válido.");
            return;
        }

        if (normalizedNewTime === scheduleConfigEditingTime) {
            setScheduleConfigEditingTime(null);
            setScheduleConfigEditedTime("");
            return;
        }

        if (scheduleConfigTimes.includes(normalizedNewTime)) {
            setScheduleConfigError("O novo horário já existe nessa data.");
            return;
        }

        setScheduleConfigError("");
        setScheduleConfigSuccess("");
        setIsSavingScheduleConfig(true);

        try {
            const {data, error} = await supabase
                .from("schedule_time_overrides")
                .upsert(
                    [
                        {
                            override_date: scheduleConfigDate,
                            start_time: scheduleConfigEditingTime,
                            is_available: false,
                            updated_at: new Date().toISOString(),
                        },
                        {
                            override_date: scheduleConfigDate,
                            start_time: normalizedNewTime,
                            is_available: true,
                            updated_at: new Date().toISOString(),
                        },
                    ],
                    {onConflict: "override_date,start_time"},
                )
                .select("id, override_date, start_time, is_available, created_at, updated_at");

            if (error) throw error;

            mergeSavedTimeOverrides((data ?? []) as ScheduleTimeOverride[]);
            setScheduleConfigEditingTime(null);
            setScheduleConfigEditedTime("");
            setScheduleConfigSuccess(
                `Horário alterado de ${scheduleConfigEditingTime} para ${normalizedNewTime} somente nessa data.`,
            );
        } catch (error) {
            console.error("Erro ao alterar exceção de horário:", error);
            setScheduleConfigError("Não foi possível alterar esse horário.");
        } finally {
            setIsSavingScheduleConfig(false);
        }
    }

    const blockVisibleWeekDates = useMemo(
        () => getManualWeekDates(blockWeekReferenceDate),
        [blockWeekReferenceDate],
    );

    function selectBlockDate(date: string) {
        const today = formatDateForInput(new Date());
        if (date < today) return;

        setBlockDate(date);
        setBlockWeekReferenceDate(date);
        setSelectedBlockTimes([]);
        setBlockError("");
    }

    function moveBlockWeek(amount: number) {
        const currentWeek = getManualWeekDates(blockWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setBlockWeekReferenceDate(nextReference);
        setSelectedBlockTimes([]);
        setBlockError("");

        if (firstSelectable) {
            setBlockDate(firstSelectable);
        }
    }

    const blockWeekMonthLabel = useMemo(() => {
        const reference = new Date(`${blockDate}T12:00:00`);
        return reference.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [blockDate]);

    const blockAvailableTimes = useMemo(() => {
        const candidateStarts = getFixedClientStartMinutes(blockDate);

        const occupied = appointments
            .filter(
                (item) =>
                    item.appointment_date === blockDate &&
                    item.status !== "cancelled",
            )
            .map((item) => {
                const start = getMinutesFromTime(item.start_time);
                return {start, end: start + item.duration_minutes};
            });

        const blocked = adminBlocks
            .filter((item) => item.block_date === blockDate)
            .map((item) => ({
                start: getMinutesFromTime(item.start_time),
                end: getMinutesFromTime(item.end_time),
            }));

        return candidateStarts
            .filter((start) => {
                const isOccupied = [...occupied, ...blocked].some((item) =>
                    intervalsOverlap(start, start + 30, item.start, item.end),
                );

                return !isOccupied;
            })
            .map(minutesToTime);
    }, [appointments, adminBlocks, blockDate]);

    useEffect(() => {
        setSelectedBlockTimes((current) => current.filter((time) => blockAvailableTimes.includes(time)));
    }, [blockAvailableTimes]);

    async function saveSelectedBlocks() {
        if (!selectedBlockTimes.length) {
            setBlockError("Selecione pelo menos um horário.");
            return;
        }
        setIsSavingBlock(true);
        setBlockError("");
        const rows = selectedBlockTimes.map((time) => ({
            block_date: blockDate,
            start_time: time,
            end_time: minutesToTime(getMinutesFromTime(time) + 30),
            reason: blockReason.trim() || null,
        }));
        const {data, error} = await supabase.from("schedule_blocks").insert(rows)
            .select("id, block_date, start_time, end_time, reason, created_at");
        if (error) {
            console.error("Erro ao bloquear horários:", error);
            setBlockError("Não foi possível bloquear os horários selecionados.");
            setIsSavingBlock(false);
            return;
        }
        setAdminBlocks((current) => [...current, ...((data ?? []) as AdminScheduleBlock[])]);
        setSelectedBlockTimes([]);
        setBlockReason("");
        setIsSavingBlock(false);
    }

    async function deleteScheduleBlock(blockId: string) {
        const {error} = await supabase.from("schedule_blocks").delete().eq("id", blockId);
        if (error) {
            setBlockError("Não foi possível remover o bloqueio.");
            return;
        }
        setAdminBlocks((current) => current.filter((item) => item.id !== blockId));
    }

    function resetServiceForm() {
        setServiceFormName("");
        setServiceFormPrice("");
        setServiceFormDuration("");
        setEditingServiceId(null);
    }

    function openServiceEditor(service: AdminServiceSetting) {
        setServiceFormName(service.name);
        setServiceFormPrice((service.price_cents / 100).toFixed(2).replace(".", ","));
        setServiceFormDuration(String(service.duration_minutes));
        setEditingServiceId(service.id);
        setExpandedServiceId(service.id);
        setSettingsError("");
        setSettingsSuccess("");

        window.setTimeout(() => {
            document.getElementById("admin-service-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 50);
    }

    async function saveServiceFromForm() {
        setSettingsError("");
        setSettingsSuccess("");

        const name = serviceFormName.trim();
        const normalizedPrice = serviceFormPrice.replace(",", ".").trim();
        const priceValue = Number(normalizedPrice);
        const durationValue = Number(serviceFormDuration);

        if (
            name.length < 2 ||
            !Number.isFinite(priceValue) ||
            priceValue < 0 ||
            !Number.isFinite(durationValue) ||
            durationValue <= 0
        ) {
            setSettingsError("Confira o nome, o valor e a duração do serviço.");
            return;
        }

        const priceCents = Math.round(priceValue * 100);
        const durationMinutes = Math.round(durationValue);

        if (editingServiceId !== null) {
            setSavingServiceId(editingServiceId);

            const {data, error} = await supabase
                .from("services")
                .update({
                    name,
                    price_cents: priceCents,
                    duration_minutes: durationMinutes,
                })
                .eq("id", editingServiceId)
                .select("id, name, description, duration_minutes, price_cents, display_order")
                .single();

            if (error || !data) {
                console.error("Erro ao editar serviço:", error);
                setSettingsError(
                    error?.message?.includes("services_name_unique")
                        ? "Já existe um serviço com esse nome."
                        : "Não foi possível atualizar o serviço.",
                );
                setSavingServiceId(null);
                return;
            }

            setAdminServices((current) =>
                current
                    .map((service) =>
                        service.id === editingServiceId
                            ? data as AdminServiceSetting
                            : service,
                    )
                    .sort(
                        (first, second) =>
                            second.price_cents - first.price_cents ||
                            first.name.localeCompare(second.name, "pt-BR"),
                    ),
            );

            setSettingsSuccess(`Serviço “${name}” atualizado com sucesso.`);
            setSavingServiceId(null);
            resetServiceForm();
            return;
        }

        setSavingServiceId(-1);

        const {data, error} = await supabase
            .from("services")
            .insert({
                name,
                description: "",
                price_cents: priceCents,
                duration_minutes: durationMinutes,
                is_active: true,
                display_order: 0,
            })
            .select("id, name, description, duration_minutes, price_cents, display_order")
            .single();

        if (error || !data) {
            console.error("Erro ao adicionar serviço:", error);
            setSettingsError(
                error?.message?.includes("services_name_unique")
                    ? "Já existe um serviço com esse nome."
                    : "Não foi possível adicionar o serviço.",
            );
            setSavingServiceId(null);
            return;
        }

        setAdminServices((current) =>
            [
                data as AdminServiceSetting,
                ...current,
            ].sort(
                (first, second) =>
                    second.price_cents - first.price_cents ||
                    first.name.localeCompare(second.name, "pt-BR"),
            ),
        );

        setSettingsSuccess(`Serviço “${name}” adicionado com sucesso.`);
        setSavingServiceId(null);
        resetServiceForm();
    }

    async function deleteAdminService(service: AdminServiceSetting) {
        const confirmed = window.confirm(
            `Excluir o serviço “${service.name}”? Ele deixará de aparecer para as clientes.`,
        );

        if (!confirmed) return;

        setSettingsError("");
        setSettingsSuccess("");
        setDeletingServiceId(service.id);

        const {error} = await supabase
            .from("services")
            .delete()
            .eq("id", service.id);

        if (error) {
            console.error("Erro ao excluir serviço:", error);
            setSettingsError("Não foi possível excluir o serviço.");
            setDeletingServiceId(null);
            return;
        }

        setAdminServices((current) =>
            current.filter((item) => item.id !== service.id),
        );

        if (editingServiceId === service.id) {
            resetServiceForm();
        }

        if (expandedServiceId === service.id) {
            setExpandedServiceId(null);
        }

        setSettingsSuccess(`Serviço “${service.name}” excluído.`);
        setDeletingServiceId(null);
    }

    function getAppointmentStatusLabel(status: AdminAppointment["status"]) {
        if (status === "completed") return "Concluído";
        if (status === "cancelled") return "Cancelado";
        if (status === "no-show") return "Não compareceu";
        if (status === "pending") return "Pendente";
        return "Confirmado";
    }

    type AdminDashboardView =
        | "agenda"
        | "week"
        | "month"
        | "new"
        | "clients"
        | "finance"
        | "schedule"
        | "settings"
        | "blocks";

    function openAdminDashboardView(view: AdminDashboardView) {
        setAdminView(view);

        if (view === "new") {
            setShowManualForm(true);
            setManualError("");
            setManualSuccess("");
        }

        window.setTimeout(() => {
            document
                .getElementById("admin-active-content")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        }, 40);
    }

    const renderAppointmentCard = (appointment: AdminAppointment) => {
        const dueTypes = getDueNotificationTypes(appointment);

        return (
            <article
                key={appointment.id}
                className={`admin-booking-card${appointment.status === "cancelled" ? " is-cancelled" : ""}`}
                onClick={() => openAppointmentDetails(appointment)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openAppointmentDetails(appointment);
                }}
            >
                <div className="admin-booking-card__top">
                    <div>
                        <span className="admin-booking-card__time">{String(appointment.start_time).slice(0, 5)}</span>
                        <h3>{appointment.client_name}</h3>
                    </div>
                    <span className={`admin-status admin-status--${appointment.status}`}>{getAppointmentStatusLabel(appointment.status)}</span>
                </div>
                <div className="admin-booking-card__details">
                    <div><span>Data</span><strong>{formatAdminDate(appointment.appointment_date)}</strong></div>
                    <div><span>Serviço</span><strong>{appointment.service_name}</strong></div>
                    <div><span>Duração</span><strong>{appointment.duration_minutes} min</strong></div>
                    <div><span>Telefone</span><strong>{appointment.client_phone}</strong></div>
                    <div className="admin-booking-card__music">
                        <span>Gosto musical</span>
                        <strong>{appointment.musical_taste?.trim() || "Não informado"}</strong>
                    </div>
                </div>
                <div className="admin-booking-card__footer" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => openAppointmentDetails(appointment)}>Editar detalhes</button>
                    <button type="button" onClick={() => void cancelAppointment(appointment)}>Cancelar</button>
                    {dueTypes.map((type) => {
                        const key = getNotificationKey(appointment.id, type);
                        const wasOpened = Boolean(openedWhatsAppNotifications[key]);

                        return (
                            <a
                                key={type}
                                className={`is-due${wasOpened ? " is-opened" : ""}`.trim()}
                                href={getWhatsAppUrl(appointment, type)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markWhatsAppNotificationOpened(appointment, type)}
                            >
                                {wasOpened ? "Abrir novamente" : getWhatsAppNotificationLabel(type)}
                            </a>
                        );
                    })}
                </div>
            </article>
        );
    };

    return {
        isCheckingSession,
        setIsCheckingSession,
        adminNow,
        setAdminNow,
        isAuthenticated,
        setIsAuthenticated,
        showAdminBackToTop,
        setShowAdminBackToTop,
        email,
        setEmail,
        password,
        setPassword,
        loginError,
        setLoginError,
        isLoggingIn,
        setIsLoggingIn,
        appointments,
        setAppointments,
        adminBlocks,
        setAdminBlocks,
        adminServices,
        setAdminServices,
        isLoading,
        setIsLoading,
        panelError,
        setPanelError,
        notificationClock,
        setNotificationClock,
        openedWhatsAppNotifications,
        setOpenedWhatsAppNotifications,
        adminView,
        setAdminView,
        agendaDate,
        setAgendaDate,
        monthlyAgendaMonth,
        setMonthlyAgendaMonth,
        agendaWeekReferenceDate,
        setAgendaWeekReferenceDate,
        showAgendaDatePicker,
        setShowAgendaDatePicker,
        showAgendaMonthCalendar,
        setShowAgendaMonthCalendar,
        agendaCalendarMonth,
        setAgendaCalendarMonth,
        financeMonth,
        setFinanceMonth,
        showFinanceMonthPicker,
        setShowFinanceMonthPicker,
        financePickerYear,
        setFinancePickerYear,
        showManualForm,
        setShowManualForm,
        adminClientProfiles,
        setAdminClientProfiles,
        manualClientSearch,
        setManualClientSearch,
        selectedManualClient,
        setSelectedManualClient,
        manualServiceName,
        setManualServiceName,
        manualDate,
        setManualDate,
        manualWeekReferenceDate,
        setManualWeekReferenceDate,
        manualTime,
        setManualTime,
        showManualMonthCalendar,
        setShowManualMonthCalendar,
        manualCalendarMonth,
        setManualCalendarMonth,
        manualError,
        setManualError,
        manualSuccess,
        setManualSuccess,
        isSavingManualAppointment,
        setIsSavingManualAppointment,
        selectedAdminAppointment,
        setSelectedAdminAppointment,
        editAppointmentName,
        setEditAppointmentName,
        editAppointmentPhone,
        setEditAppointmentPhone,
        editAppointmentEmail,
        setEditAppointmentEmail,
        editAppointmentMusicTaste,
        setEditAppointmentMusicTaste,
        editAppointmentService,
        setEditAppointmentService,
        editAppointmentDate,
        setEditAppointmentDate,
        editAppointmentTime,
        setEditAppointmentTime,
        showEditDateTimePicker,
        setShowEditDateTimePicker,
        editWeekReferenceDate,
        setEditWeekReferenceDate,
        showEditMonthCalendar,
        setShowEditMonthCalendar,
        editCalendarMonth,
        setEditCalendarMonth,
        appointmentEditError,
        setAppointmentEditError,
        isSavingAppointment,
        setIsSavingAppointment,
        clientSearch,
        setClientSearch,
        selectedClient,
        setSelectedClient,
        editingClient,
        setEditingClient,
        editClientName,
        setEditClientName,
        editClientPhone,
        setEditClientPhone,
        editClientEmail,
        setEditClientEmail,
        editClientMusicTaste,
        setEditClientMusicTaste,
        clientAnamnesis,
        setClientAnamnesis,
        isLoadingClientAnamnesis,
        setIsLoadingClientAnamnesis,
        clientEditError,
        setClientEditError,
        isSavingClient,
        setIsSavingClient,
        deletingClientKey,
        setDeletingClientKey,
        clearingCancelledAppointmentId,
        setClearingCancelledAppointmentId,
        deletingConfirmedAppointmentId,
        setDeletingConfirmedAppointmentId,
        nailRecords,
        setNailRecords,
        isLoadingNailRecords,
        setIsLoadingNailRecords,
        showNailRecordForm,
        setShowNailRecordForm,
        nailRecordNotes,
        setNailRecordNotes,
        nailRecordFiles,
        setNailRecordFiles,
        nailRecordError,
        setNailRecordError,
        nailRecordSuccess,
        setNailRecordSuccess,
        isSavingNailRecord,
        setIsSavingNailRecord,
        deletingNailRecordId,
        setDeletingNailRecordId,
        nailRecordFilePreviews,
        adminTimeOverrides,
        setAdminTimeOverrides,
        scheduleConfigDate,
        setScheduleConfigDate,
        scheduleConfigWeekReferenceDate,
        setScheduleConfigWeekReferenceDate,
        scheduleConfigNewTime,
        setScheduleConfigNewTime,
        scheduleConfigEditingTime,
        setScheduleConfigEditingTime,
        scheduleConfigEditedTime,
        setScheduleConfigEditedTime,
        scheduleConfigError,
        setScheduleConfigError,
        scheduleConfigSuccess,
        setScheduleConfigSuccess,
        isSavingScheduleConfig,
        setIsSavingScheduleConfig,
        blockDate,
        setBlockDate,
        blockWeekReferenceDate,
        setBlockWeekReferenceDate,
        selectedBlockTimes,
        setSelectedBlockTimes,
        blockReason,
        setBlockReason,
        blockError,
        setBlockError,
        isSavingBlock,
        setIsSavingBlock,
        settingsError,
        setSettingsError,
        settingsSuccess,
        setSettingsSuccess,
        savingServiceId,
        setSavingServiceId,
        serviceFormName,
        setServiceFormName,
        serviceFormPrice,
        setServiceFormPrice,
        serviceFormDuration,
        setServiceFormDuration,
        editingServiceId,
        setEditingServiceId,
        expandedServiceId,
        setExpandedServiceId,
        deletingServiceId,
        setDeletingServiceId,
        handleLogin,
        handleLogout,
        scrollAdminToTop,
        appointmentConflicts,
        createManualAppointment,
        openAppointmentDetails,
        editVisibleWeekDates,
        selectEditAppointmentDate,
        moveEditAppointmentWeek,
        openEditAppointmentMonthCalendar,
        getEditAppointmentMonthCells,
        editSelectedService,
        editAppointmentAvailableTimes,
        saveAppointmentChanges,
        cancelAppointment,
        clearCancelledAppointmentFromHistory,
        deleteConfirmedAppointmentFromHistory,
        normalizeClientPhone,
        resetNailRecordForm,
        openClientHistory,
        openNailRecordForClient,
        closeClientHistory,
        findClientProfile,
        ensureClientProfile,
        loadNailRecordsForClient,
        handleNailCameraSelection,
        removeNailRecordFile,
        saveNailRecord,
        deleteNailRecord,
        clients,
        filteredClients,
        manualBookingClients,
        filteredManualBookingClients,
        getManualWeekDates,
        manualVisibleWeekDates,
        selectManualBookingDate,
        moveManualBookingWeek,
        openManualMonthCalendar,
        getManualMonthCalendarCells,
        manualSelectedService,
        manualAvailableTimes,
        formatBirthDateForDisplay,
        formatBirthDateForDatabase,
        updateClientAnamnesisField,
        loadClientAnamnesis,
        openClientEditor,
        saveClientChanges,
        deleteClient,
        weekDates,
        agendaVisibleWeekDates,
        selectAgendaPickerDate,
        moveAgendaPickerWeek,
        openAgendaMonthCalendar,
        getAgendaMonthCalendarCells,
        agendaPickerMonthLabel,
        shouldShowAppointmentInAdminAgenda,
        agendaAppointments,
        weeklyAppointments,
        addMonthsToAgendaMonth,
        monthlyAgendaMonthLabel,
        monthlyAgendaAppointments,
        monthlyAgendaDates,
        addMonthsToFinanceMonth,
        financeMonthLabel,
        financeMonthOptions,
        selectFinanceMonth,
        openFinanceMonthPicker,
        selectCurrentFinanceMonth,
        financeAppointments,
        completedFinanceAppointments,
        scheduledFinanceAppointments,
        financeServiceSummary,
        getNotificationKey,
        markWhatsAppNotificationOpened,
        getWhatsAppUrl,
        getDueNotificationTypes,
        pendingWhatsAppNotifications,
        scheduleConfigVisibleWeekDates,
        scheduleConfigTimes,
        selectScheduleConfigDate,
        moveScheduleConfigWeek,
        normalizeScheduleConfigTime,
        mergeSavedTimeOverrides,
        saveScheduleTimeOverride,
        addScheduleConfigTime,
        removeScheduleConfigTime,
        beginEditScheduleConfigTime,
        saveEditedScheduleConfigTime,
        blockVisibleWeekDates,
        selectBlockDate,
        moveBlockWeek,
        blockWeekMonthLabel,
        blockAvailableTimes,
        saveSelectedBlocks,
        deleteScheduleBlock,
        resetServiceForm,
        openServiceEditor,
        saveServiceFromForm,
        deleteAdminService,
        getAppointmentStatusLabel,
        openAdminDashboardView,
        renderAppointmentCard,
        supabase,
        fallbackServices,
        formatBrazilianPhone,
        formatCurrency,
        formatDateForInput,
        formatDuration,
        getConfiguredClientStartMinutes,
        getFixedAdminManualStartMinutes,
        getFixedClientStartMinutes,
        intervalsOverlap,
        MIRIAN_ADMIN_EMAIL,
        mergeIntervals,
        minutesToTime,
        normalizeBrazilianPhoneDigits,
        emptyClientAnamnesis,
        addDaysToInputDate,
        buildWhatsAppMessage,
        formatAdminDate,
        getAppointmentDateTime,
        getAppointmentEndDateTime,
        getMinutesFromTime,
        getWhatsAppNotificationLabel,
        normalizePhoneForWhatsApp,
        adminClientScheduledMetricStyles,
        adminEditDateTimeStyles,
        adminEnhancementStyles,
        adminServiceManagerStyles,
        adminStyles,
    };
}

export type AdminPanelController = ReturnType<typeof useAdminPanelController>;
