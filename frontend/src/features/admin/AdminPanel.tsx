import {useEffect, useMemo, useState} from "react";
import {supabase} from "../../lib/supabase";
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
} from "../../shared/domain";
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
} from "./types";
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
} from "./utils";
import {
    adminClientScheduledMetricStyles,
    adminEditDateTimeStyles,
    adminEnhancementStyles,
    adminServiceManagerStyles,
    adminStyles,
} from "./styles";

export default function AdminPanel() {
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

        const candidateStarts = getFixedAdminManualStartMinutes(manualDate)
            .filter((start) => start <= 19 * 60);

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

    if (isCheckingSession) {
        return <main className="admin-page"><style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style><div className="admin-login"><div className="admin-loading">Verificando acesso...</div></div></main>;
    }

    if (!isAuthenticated) {
        return (
            <main className="admin-page">
                <style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style>
                <div className="admin-login">
                    <form className="admin-login__card" onSubmit={handleLogin}>
                        <div className="admin-login__brand"><img className="admin-login__logo" src="/logo-mirian.png" alt="Logo Mirian Silva Nail Design"/><div><strong>Mirian Silva</strong><span>Painel administrativo</span></div></div>
                        <h1>Acesso da Mirian</h1>
                        <p>Entre com o e-mail e a senha cadastrados no Supabase.</p>
                        {loginError && <p className="admin-login__error">{loginError}</p>}
                        <div className="admin-field"><label htmlFor="admin-email">E-mail</label><input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></div>
                        <div className="admin-field"><label htmlFor="admin-password">Senha</label><input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required/></div>
                        <button className="admin-primary-button" type="submit" disabled={isLoggingIn}>{isLoggingIn ? "Entrando..." : "Entrar no painel"}</button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="admin-page">
            <style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style>
            <section className="admin-panel">
                <header className="admin-header">
                    <div><h1>Painel da Mirian</h1><p>Gerencie os agendamentos recebidos pelo site.</p></div>
                    <button className="admin-secondary-button" type="button" onClick={handleLogout}>Sair</button>
                </header>

                <div className="admin-dashboard-cards">
                    <button className={`admin-dashboard-card${adminView === "agenda" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("agenda")}><strong>Agenda do dia</strong><span>Veja todos os atendimentos do dia.</span></button>
                    <button className={`admin-dashboard-card${adminView === "week" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("week")}><strong>Agenda semanal</strong><span>Atendimentos em ordem de dia e horário.</span></button>
                    <button className={`admin-dashboard-card${adminView === "month" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("month")}><strong>Agenda mensal</strong><span>Veja os atendimentos organizados ao longo do mês.</span></button>
                    <button
                        className={`admin-dashboard-card${adminView === "new" ? " is-active" : ""}`}
                        type="button"
                        onClick={() => openAdminDashboardView("new")}
                    >
                        <strong>Novo agendamento</strong>
                        <span>Cadastre um novo atendimento para uma cliente.</span>
                    </button>
                    <button className={`admin-dashboard-card${adminView === "clients" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("clients")}><strong>Clientes</strong><span>Cadastros, histórico e indicadores.</span></button>
                    <button className={`admin-dashboard-card${adminView === "finance" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("finance")}><strong>Financeiro</strong><span>Faturamento e previsão mensal.</span></button>
                    <button className={`admin-dashboard-card${adminView === "schedule" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("schedule")}><strong>Configuração de horários</strong><span>Adicione, altere ou remova horários de uma data específica.</span></button>
                    <button className={`admin-dashboard-card${adminView === "settings" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("settings")}><strong>Configuração de serviços</strong><span>Cadastre, edite e exclua serviços.</span></button>
                    <button className={`admin-dashboard-card${adminView === "blocks" ? " is-active" : ""}`} type="button" onClick={() => openAdminDashboardView("blocks")}><strong>Bloquear horários</strong><span>Bloqueie horários livres em uma data específica.</span></button>
                </div>

                <section className="admin-message-center">
                    <div className="admin-message-center__header">
                        <div>
                            <h2>Mensagens pendentes</h2>
                            <p>Abra o WhatsApp com a mensagem pronta e toque em enviar.</p>
                        </div>
                        <span className="admin-message-center__count">{pendingWhatsAppNotifications.length}</span>
                    </div>

                    {pendingWhatsAppNotifications.length ? (
                        <div className="admin-message-center__list">
                            {pendingWhatsAppNotifications.slice(0, 10).map(({appointment, type, key}) => (
                                <article className="admin-message-item" key={key}>
                                    <div>
                                        <strong>{getWhatsAppNotificationLabel(type)} — {appointment.client_name}</strong>
                                        <span>{formatAdminDate(appointment.appointment_date)} às {String(appointment.start_time).slice(0, 5)} · {appointment.service_name}</span>
                                    </div>
                                    <a
                                        href={getWhatsAppUrl(appointment, type)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => markWhatsAppNotificationOpened(appointment, type)}
                                    >
                                        Abrir WhatsApp
                                    </a>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="admin-message-center__empty">Nenhuma mensagem pendente neste momento.</p>
                    )}
                </section>

                <div
                    id="admin-active-content"
                    className="admin-active-content-anchor"
                    aria-hidden="true"
                />

                {(adminView === "agenda" || adminView === "week") && (
                    <section className="admin-top-agenda">
                        <div className="admin-top-agenda__header">
                            <div>
                                <span>{adminView === "agenda" ? "Atendimentos do dia" : "Atendimentos da semana"}</span>
                                <strong>
                                    {adminView === "agenda"
                                        ? formatAdminDate(agendaDate)
                                        : `${formatAdminDate(weekDates[0])} até ${formatAdminDate(weekDates[6])}`}
                                </strong>
                            </div>
                            <div className="admin-section-date-controls admin-section-date-controls--agenda">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextDate = addDaysToInputDate(
                                            agendaDate,
                                            adminView === "week" ? -7 : -1,
                                        );
                                        setAgendaDate(nextDate);
                                        setAgendaWeekReferenceDate(nextDate);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    ←
                                </button>

                                <div className="admin-agenda-date-picker">
                                    <button
                                        type="button"
                                        className={`admin-agenda-date-picker__trigger${
                                            showAgendaDatePicker ? " is-open" : ""
                                        }`}
                                        onClick={() =>
                                            setShowAgendaDatePicker((current) => {
                                                const nextValue = !current;

                                                if (nextValue) {
                                                    setAgendaWeekReferenceDate(agendaDate);
                                                    setShowAgendaMonthCalendar(false);
                                                }

                                                return nextValue;
                                            })
                                        }
                                    >
                                        <span className="admin-agenda-date-picker__trigger-text">
                                            <small>
                                                {adminView === "agenda"
                                                    ? "Data selecionada"
                                                    : "Semana selecionada"}
                                            </small>
                                            <strong>
                                                {adminView === "agenda"
                                                    ? formatAdminDate(agendaDate)
                                                    : `${formatAdminDate(
                                                          weekDates[0],
                                                      )} até ${formatAdminDate(
                                                          weekDates[6],
                                                      )}`}
                                            </strong>
                                        </span>

                                        <span className="admin-agenda-date-picker__chevron">
                                            {showAgendaDatePicker ? "⌃" : "⌄"}
                                        </span>
                                    </button>

                                    {showAgendaDatePicker && (
                                        <div className="admin-agenda-date-picker__panel">
                                            <div className="admin-agenda-date-picker__panel-header">
                                                <div className="admin-agenda-date-picker__month">
                                                    <strong>{agendaPickerMonthLabel}</strong>

                                                    <button
                                                        type="button"
                                                        onClick={openAgendaMonthCalendar}
                                                        aria-label="Abrir calendário do mês"
                                                    >
                                                        📅
                                                    </button>
                                                </div>

                                                <div className="admin-agenda-date-picker__panel-navs">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveAgendaPickerWeek(-1)}
                                                        aria-label="Semana anterior"
                                                    >
                                                        ‹
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveAgendaPickerWeek(1)}
                                                        aria-label="Próxima semana"
                                                    >
                                                        ›
                                                    </button>
                                                </div>
                                            </div>

                                            {showAgendaMonthCalendar && (
                                                <div className="client-month-calendar">
                                                    <div className="client-month-calendar__header">
                                                        <button
                                                            className="client-week-picker__nav"
                                                            type="button"
                                                            onClick={() =>
                                                                setAgendaCalendarMonth(
                                                                    (current) =>
                                                                        new Date(
                                                                            current.getFullYear(),
                                                                            current.getMonth() - 1,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            aria-label="Mês anterior"
                                                        >
                                                            ‹
                                                        </button>
                                                        <strong>
                                                            {agendaCalendarMonth.toLocaleDateString(
                                                                "pt-BR",
                                                                {
                                                                    month: "long",
                                                                    year: "numeric",
                                                                },
                                                            )}
                                                        </strong>
                                                        <button
                                                            className="client-week-picker__nav"
                                                            type="button"
                                                            onClick={() =>
                                                                setAgendaCalendarMonth(
                                                                    (current) =>
                                                                        new Date(
                                                                            current.getFullYear(),
                                                                            current.getMonth() + 1,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
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
                                                        {getAgendaMonthCalendarCells().map(
                                                            (date, index) => {
                                                                if (!date) {
                                                                    return (
                                                                        <span
                                                                            className="client-month-calendar__day is-empty"
                                                                            key={`agenda-empty-${index}`}
                                                                        />
                                                                    );
                                                                }

                                                                return (
                                                                    <button
                                                                        key={date}
                                                                        type="button"
                                                                        className={[
                                                                            "client-month-calendar__day",
                                                                            date === agendaDate
                                                                                ? "is-selected"
                                                                                : "",
                                                                        ]
                                                                            .filter(Boolean)
                                                                            .join(" ")}
                                                                        onClick={() =>
                                                                            selectAgendaPickerDate(
                                                                                date,
                                                                            )
                                                                        }
                                                                    >
                                                                        {new Date(
                                                                            `${date}T12:00:00`,
                                                                        ).getDate()}
                                                                    </button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="client-week-days admin-agenda-date-picker__week-days">
                                                {[
                                                    {
                                                        dates: agendaVisibleWeekDates.slice(
                                                            0,
                                                            4,
                                                        ),
                                                        rowClass:
                                                            "client-week-days__row--four",
                                                    },
                                                    {
                                                        dates: agendaVisibleWeekDates.slice(
                                                            4,
                                                            7,
                                                        ),
                                                        rowClass:
                                                            "client-week-days__row--three",
                                                    },
                                                ].map((row, rowIndex) => (
                                                    <div
                                                        className={`client-week-days__row ${row.rowClass}`}
                                                        key={`agenda-week-row-${rowIndex}`}
                                                    >
                                                        {row.dates.map((date) => {
                                                            const parsed = new Date(
                                                                `${date}T12:00:00`,
                                                            );

                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    className={[
                                                                        "client-week-day",
                                                                        date === agendaDate
                                                                            ? "is-selected"
                                                                            : "",
                                                                    ]
                                                                        .filter(Boolean)
                                                                        .join(" ")}
                                                                    onClick={() =>
                                                                        selectAgendaPickerDate(
                                                                            date,
                                                                        )
                                                                    }
                                                                >
                                                                    <span>
                                                                        {parsed
                                                                            .toLocaleDateString(
                                                                                "pt-BR",
                                                                                {
                                                                                    weekday:
                                                                                        "short",
                                                                                },
                                                                            )
                                                                            .replace(
                                                                                ".",
                                                                                "",
                                                                            )}
                                                                    </span>
                                                                    <strong>
                                                                        {parsed.toLocaleDateString(
                                                                            "pt-BR",
                                                                            {
                                                                                day: "2-digit",
                                                                                month: "2-digit",
                                                                            },
                                                                        )}
                                                                    </strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextDate = addDaysToInputDate(
                                            agendaDate,
                                            adminView === "week" ? 7 : 1,
                                        );
                                        setAgendaDate(nextDate);
                                        setAgendaWeekReferenceDate(nextDate);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    →
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = formatDateForInput(new Date());
                                        setAgendaDate(today);
                                        setAgendaWeekReferenceDate(today);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    Hoje
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="admin-loading">Carregando...</div>
                        ) : adminView === "agenda" ? (
                            <div className="admin-card-list">
                                {agendaAppointments.length
                                    ? agendaAppointments.map(renderAppointmentCard)
                                    : <div className="admin-empty admin-empty--top">Nenhum agendamento nesta data.</div>}
                            </div>
                        ) : (
                            <div className="admin-card-list">
                                {weeklyAppointments.length
                                    ? weeklyAppointments.map(renderAppointmentCard)
                                    : <div className="admin-empty admin-empty--top">Nenhum agendamento nesta semana.</div>}
                            </div>
                        )}
                    </section>
                )}

                {panelError && <p className="admin-panel__error">{panelError}</p>}

                {adminView === "month" ? (
                    <section className="admin-month-agenda">
                        <div className="admin-month-agenda__header">
                            <div>
                                <span>Agenda mensal</span>
                                <strong>{monthlyAgendaMonthLabel}</strong>
                            </div>

                            <div className="admin-month-agenda__nav">
                                <button
                                    type="button"
                                    aria-label="Mês anterior"
                                    onClick={() =>
                                        setMonthlyAgendaMonth((current) =>
                                            addMonthsToAgendaMonth(current, -1),
                                        )
                                    }
                                >
                                    ←
                                </button>

                                <button
                                    className="admin-month-agenda__today"
                                    type="button"
                                    onClick={() =>
                                        setMonthlyAgendaMonth(
                                            formatDateForInput(new Date()).slice(0, 7),
                                        )
                                    }
                                >
                                    Mês atual
                                </button>

                                <button
                                    type="button"
                                    aria-label="Próximo mês"
                                    onClick={() =>
                                        setMonthlyAgendaMonth((current) =>
                                            addMonthsToAgendaMonth(current, 1),
                                        )
                                    }
                                >
                                    →
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="admin-loading">Carregando...</div>
                        ) : monthlyAgendaDates.length ? (
                            <div className="admin-month-agenda__days">
                                {monthlyAgendaDates.map((date) => (
                                    <section className="admin-month-agenda__day" key={date}>
                                        <div className="admin-month-agenda__day-header">
                                            <strong>{formatAdminDate(date)}</strong>
                                        </div>

                                        <div className="admin-card-list">
                                            {monthlyAgendaAppointments
                                                .filter(
                                                    (appointment) =>
                                                        appointment.appointment_date === date,
                                                )
                                                .map(renderAppointmentCard)}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="admin-empty">
                                Nenhum agendamento ativo neste mês.
                            </div>
                        )}
                    </section>
                ) : adminView === "finance" ? (
                    <section className="admin-finance">
                        <div className="admin-finance__header">
                            <div>
                                <span className="admin-finance__eyebrow">Controle financeiro</span>
                                <h2>Financeiro mensal</h2>
                                <p>Valores calculados automaticamente a partir dos agendamentos do mês.</p>
                            </div>

                            <div className="admin-finance-month-picker">
                                <div className="admin-finance-month-picker__quick">
                                    <button
                                        type="button"
                                        aria-label="Mês anterior"
                                        onClick={() =>
                                            setFinanceMonth((current) =>
                                                addMonthsToFinanceMonth(current, -1)
                                            )
                                        }
                                    >
                                        ←
                                    </button>

                                    <button
                                        type="button"
                                        className={`admin-finance-month-picker__selected${
                                            showFinanceMonthPicker ? " is-open" : ""
                                        }`}
                                        onClick={openFinanceMonthPicker}
                                    >
                                        <span className="admin-finance-month-picker__icon">📅</span>

                                        <span className="admin-finance-month-picker__selected-text">
                                            <small>Mês selecionado</small>
                                            <strong>{financeMonthLabel}</strong>
                                        </span>

                                        <span className="admin-finance-month-picker__chevron">
                                            {showFinanceMonthPicker ? "⌃" : "⌄"}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        aria-label="Próximo mês"
                                        onClick={() =>
                                            setFinanceMonth((current) =>
                                                addMonthsToFinanceMonth(current, 1)
                                            )
                                        }
                                    >
                                        →
                                    </button>
                                </div>

                                {showFinanceMonthPicker && (
                                    <div className="admin-finance-month-panel">
                                        <div className="admin-finance-month-panel__header">
                                            <button
                                                type="button"
                                                aria-label="Ano anterior"
                                                onClick={() =>
                                                    setFinancePickerYear((current) => current - 1)
                                                }
                                            >
                                                ‹
                                            </button>

                                            <strong>{financePickerYear}</strong>

                                            <button
                                                type="button"
                                                aria-label="Próximo ano"
                                                onClick={() =>
                                                    setFinancePickerYear((current) => current + 1)
                                                }
                                            >
                                                ›
                                            </button>
                                        </div>

                                        <div className="admin-finance-month-panel__grid">
                                            {financeMonthOptions.map((monthName, index) => {
                                                const monthValue =
                                                    `${financePickerYear}-${String(index + 1).padStart(2, "0")}`;

                                                const selected =
                                                    financeMonth === monthValue;

                                                return (
                                                    <button
                                                        key={monthName}
                                                        type="button"
                                                        className={selected ? "is-selected" : ""}
                                                        onClick={() => selectFinanceMonth(index)}
                                                    >
                                                        <span>{monthName.slice(0, 3)}</span>
                                                        <strong>{monthName}</strong>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            className="admin-finance-month-panel__current"
                                            onClick={selectCurrentFinanceMonth}
                                        >
                                            Ir para o mês atual
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="admin-finance__period">
                            <span>Resumo de</span>
                            <strong>{financeMonthLabel}</strong>
                        </div>

                        <section className="admin-finance__services">
                            <div className="admin-finance__services-header">
                                <div>
                                    <h3>Resumo por serviço</h3>
                                    <p>Quantidade e valores de cada serviço no mês selecionado.</p>
                                </div>
                            </div>

                            {financeServiceSummary.length ? (
                                <div className="admin-finance-service-cards">
                                    {financeServiceSummary.map((service) => (
                                        <article
                                            className="admin-finance-service-card"
                                            key={service.serviceName}
                                        >
                                            <div className="admin-finance-service-card__row admin-finance-service-card__row--service">
                                                <span>Serviço</span>
                                                <strong>{service.serviceName}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Atendimentos realizados</span>
                                                <strong>{service.completedCount}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Valor realizado</span>
                                                <strong>
                                                    {formatCurrency(service.completedCents)}
                                                </strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Atendimentos agendados</span>
                                                <strong>{service.scheduledCount}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Valor agendado</span>
                                                <strong>
                                                    {formatCurrency(service.scheduledCents)}
                                                </strong>
                                            </div>

                                            <div className="admin-finance-service-card__row admin-finance-service-card__row--total">
                                                <span>Total previsto</span>
                                                <strong>
                                                    {formatCurrency(
                                                        service.completedCents +
                                                        service.scheduledCents,
                                                    )}
                                                </strong>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-finance__empty">
                                    <strong>Nenhum valor para este mês.</strong>
                                    <span>Os agendamentos confirmados e concluídos aparecerão aqui automaticamente.</span>
                                </div>
                            )}
                        </section>

                        <p className="admin-finance__note">
                            Ao chegar o horário, o agendamento é considerado realizado automaticamente. Cancelados e não comparecimentos não entram nos valores financeiros.
                        </p>
                    </section>
                ) : adminView === "schedule" ? (
                    <section className="admin-settings admin-service-manager">
                        <div className="admin-settings__intro">
                            <div>
                                <span className="admin-settings__eyebrow">Configurações do site</span>
                                <h2>Configuração de horários</h2>
                                <p>Adicione, altere ou exclua horários somente na data escolhida.</p>
                            </div>
                        </div>

                        <section className="admin-service-form-card admin-schedule-config-card">
                            <div className="admin-service-form-card__heading">
                                <div>
                                    <span>CONFIGURAÇÃO DE HORÁRIOS</span>
                                    <h3>Horários de uma data específica</h3>
                                    <p>
                                        Selecione o dia abaixo. Depois adicione um novo horário ou toque em um horário disponível para alterar ou excluir somente nessa data.
                                    </p>
                                </div>
                            </div>

                            <div className="admin-manual-week-picker admin-schedule-config-panel">
                                <div className="admin-manual-week-picker__top">
                                    <div className="admin-manual-week-picker__month">
                                        <strong>
                                            {new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </strong>
                                    </div>

                                    <div className="admin-manual-week-picker__navs">
                                        <button
                                            type="button"
                                            aria-label="Semana anterior"
                                            onClick={() => moveScheduleConfigWeek(-1)}
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Próxima semana"
                                            onClick={() => moveScheduleConfigWeek(1)}
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-manual-week-days">
                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                        {scheduleConfigVisibleWeekDates.slice(0, 4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === scheduleConfigDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectScheduleConfigDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                        {scheduleConfigVisibleWeekDates.slice(4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === scheduleConfigDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectScheduleConfigDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <section className="admin-manual-booking__section admin-schedule-config-manual-section">
                                <span className="admin-manual-booking__step">4</span>

                                <div className="admin-manual-booking__content">
                                    <h3>Horário disponível</h3>
                                    <p>
                                        Adicione um novo horário abaixo. Depois ele entra automaticamente na lista de horários disponíveis dessa data.
                                    </p>

                                    <div className="admin-schedule-config-add-inline">
                                        <label>
                                            <span>ADD NOVO HORÁRIO</span>
                                            <input
                                                type="time"
                                                value={scheduleConfigNewTime}
                                                onChange={(event) => setScheduleConfigNewTime(event.target.value)}
                                            />
                                        </label>

                                        <button
                                            type="button"
                                            disabled={isSavingScheduleConfig || !scheduleConfigNewTime}
                                            onClick={() => void addScheduleConfigTime()}
                                        >
                                            {isSavingScheduleConfig ? "Salvando..." : "Salvar horário"}
                                        </button>
                                    </div>

                                    {scheduleConfigError && (
                                        <p className="admin-settings__message admin-settings__message--error">
                                            {scheduleConfigError}
                                        </p>
                                    )}

                                    {scheduleConfigSuccess && (
                                        <p className="admin-settings__message admin-settings__message--success">
                                            {scheduleConfigSuccess}
                                        </p>
                                    )}

                                    <div className="admin-schedule-config-current-date">
                                        <span>DATA SELECIONADA</span>
                                        <strong>
                                            {new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR", {
                                                weekday: "short",
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            })}
                                        </strong>
                                    </div>

                                    {scheduleConfigTimes.length ? (
                                        <div className="admin-manual-times admin-schedule-config-times-grid">
                                            {scheduleConfigTimes.map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    className={scheduleConfigEditingTime === time ? "is-selected" : ""}
                                                    onClick={() => beginEditScheduleConfigTime(time)}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="admin-manual-times__empty">
                                            Nenhum horário disponível nessa data.
                                        </div>
                                    )}

                                    {scheduleConfigEditingTime && (
                                        <div className="admin-schedule-config-editor">
                                            <div className="admin-schedule-config-editor__header">
                                                <span>HORÁRIO SELECIONADO</span>
                                                <strong>{scheduleConfigEditingTime}</strong>
                                            </div>

                                            <div className="admin-schedule-config-editor__actions">
                                                <label>
                                                    <span>NOVO HORÁRIO</span>
                                                    <input
                                                        type="time"
                                                        value={scheduleConfigEditedTime}
                                                        onChange={(event) => setScheduleConfigEditedTime(event.target.value)}
                                                    />
                                                </label>

                                                <button
                                                    type="button"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => void saveEditedScheduleConfigTime()}
                                                >
                                                    Salvar alteração
                                                </button>

                                                <button
                                                    type="button"
                                                    className="is-danger"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => void removeScheduleConfigTime(scheduleConfigEditingTime)}
                                                >
                                                    Excluir horário
                                                </button>

                                                <button
                                                    type="button"
                                                    className="is-secondary"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => {
                                                        setScheduleConfigEditingTime(null);
                                                        setScheduleConfigEditedTime("");
                                                        setScheduleConfigError("");
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </section>
                    </section>
                ) : adminView === "settings" ? (
                    <section className="admin-settings admin-service-manager">
                        <div className="admin-settings__intro">
                            <div>
                                <span className="admin-settings__eyebrow">Configurações do site</span>
                                <h2>Configuração de serviços</h2>
                                <p>Cadastre, edite ou exclua os serviços. A lista é organizada do maior para o menor valor.</p>
                            </div>
                        </div>

                        {settingsError && (
                            <p className="admin-settings__message admin-settings__message--error">
                                {settingsError}
                            </p>
                        )}

                        {settingsSuccess && (
                            <p className="admin-settings__message admin-settings__message--success">
                                {settingsSuccess}
                            </p>
                        )}


                        <section
                            id="admin-service-form"
                            className="admin-service-form-card"
                        >
                            <div className="admin-service-form-card__heading">
                                <div>
                                    <span>
                                        {editingServiceId !== null
                                            ? "EDITAR SERVIÇO"
                                            : "NOVO SERVIÇO"}
                                    </span>
                                    <h3>
                                        {editingServiceId !== null
                                            ? "Atualize as informações"
                                            : "Adicionar serviço"}
                                    </h3>
                                </div>

                                {editingServiceId !== null && (
                                    <button
                                        type="button"
                                        className="admin-service-form-card__cancel"
                                        onClick={resetServiceForm}
                                    >
                                        Cancelar edição
                                    </button>
                                )}
                            </div>

                            <div className="admin-service-form-fields">
                                <label>
                                    <span>NOME DO SERVIÇO</span>
                                    <input
                                        type="text"
                                        value={serviceFormName}
                                        onChange={(event) =>
                                            setServiceFormName(event.target.value)
                                        }
                                        placeholder="Ex.: Esmaltação em Gel"
                                    />
                                </label>

                                <label>
                                    <span>VALOR DO SERVIÇO</span>
                                    <div className="admin-service-price-field">
                                        <span>R$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={serviceFormPrice}
                                            onChange={(event) =>
                                                setServiceFormPrice(
                                                    event.target.value.replace(
                                                        /[^0-9,.]/g,
                                                        "",
                                                    ),
                                                )
                                            }
                                            placeholder="0,00"
                                        />
                                    </div>
                                </label>

                                <label>
                                    <span>DURAÇÃO DO SERVIÇO</span>
                                    <div className="admin-service-duration-field">
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={serviceFormDuration}
                                            onChange={(event) =>
                                                setServiceFormDuration(event.target.value)
                                            }
                                            placeholder="90"
                                        />
                                        <span>minutos</span>
                                    </div>
                                </label>
                            </div>

                            <button
                                type="button"
                                className="admin-service-form-card__save"
                                disabled={savingServiceId !== null}
                                onClick={() => void saveServiceFromForm()}
                            >
                                {savingServiceId !== null
                                    ? "Salvando..."
                                    : editingServiceId !== null
                                        ? "Salvar alterações"
                                        : "Salvar serviço"}
                            </button>
                        </section>

                        <section className="admin-service-list-section">
                            <div className="admin-service-list-section__heading">
                                <div>
                                    <span>SERVIÇOS CADASTRADOS</span>
                                    <h3>Serviços disponíveis</h3>
                                </div>
                                <strong>{adminServices.length}</strong>
                            </div>

                            <div className="admin-service-cards">
                                {adminServices.map((service) => {
                                    const isExpanded =
                                        expandedServiceId === service.id;

                                    return (
                                        <article
                                            className={`admin-service-summary-card${
                                                isExpanded ? " is-expanded" : ""
                                            }`}
                                            key={service.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                setExpandedServiceId((current) =>
                                                    current === service.id
                                                        ? null
                                                        : service.id,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    setExpandedServiceId((current) =>
                                                        current === service.id
                                                            ? null
                                                            : service.id,
                                                    );
                                                }
                                            }}
                                        >
                                            <div className="admin-service-summary-card__main">
                                                <div className="admin-service-summary-card__icon">
                                                    ✦
                                                </div>

                                                <div className="admin-service-summary-card__content">
                                                    <strong>{service.name}</strong>

                                                    <div className="admin-service-summary-card__details">
                                                        <span>
                                                            <small>Valor</small>
                                                            <b>
                                                                {formatCurrency(
                                                                    service.price_cents,
                                                                )}
                                                            </b>
                                                        </span>

                                                        <span>
                                                            <small>Duração</small>
                                                            <b>
                                                                {formatDuration(
                                                                    service.duration_minutes,
                                                                )}
                                                            </b>
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="admin-service-summary-card__chevron">
                                                    {isExpanded ? "⌃" : "⌄"}
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div
                                                    className="admin-service-summary-card__actions"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className="edit"
                                                        onClick={() =>
                                                            openServiceEditor(service)
                                                        }
                                                    >
                                                        Editar serviço
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="delete"
                                                        disabled={
                                                            deletingServiceId === service.id
                                                        }
                                                        onClick={() =>
                                                            void deleteAdminService(service)
                                                        }
                                                    >
                                                        {deletingServiceId === service.id
                                                            ? "Excluindo..."
                                                            : "Excluir serviço"}
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </section>
                ) : adminView === "clients" ? (
                    <section className="admin-clients">
                        <div className="admin-clients__header"><div><span className="admin-clients__eyebrow">Clientes</span><h2>Cadastros das clientes</h2><p>Consulte histórico, edite ou exclua um cadastro.</p></div><div className="admin-clients__count"><strong>{clients.length}</strong><span>clientes cadastradas</span></div></div>
                        <div className="admin-clients__search"><label>Buscar cliente<input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nome ou telefone"/></label></div>
                        <div className="admin-clients__grid">
                            {filteredClients.map((client) => {
                                const realized = client.appointments.filter(
                                    (item) =>
                                        item.status !== "cancelled" &&
                                        item.status !== "no-show" &&
                                        (
                                            item.status === "completed" ||
                                            getAppointmentEndDateTime(item).getTime() <=
                                                adminNow.getTime()
                                        ),
                                ).length;

                                const scheduled = client.appointments.filter(
                                    (item) =>
                                        item.status !== "cancelled" &&
                                        item.status !== "no-show" &&
                                        item.status !== "completed" &&
                                        getAppointmentEndDateTime(item).getTime() >
                                            adminNow.getTime(),
                                ).length;

                                const cancelled = client.appointments.filter(
                                    (item) => item.status === "cancelled",
                                ).length;

                                return (
                                    <article className="admin-client-card" key={client.key}>
                                        <div className="admin-client-card__top"><div className="admin-client-card__avatar">{client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div><h3>{client.name}</h3><a href={`https://wa.me/${normalizePhoneForWhatsApp(client.phone)}`} target="_blank" rel="noopener noreferrer">{client.phone}</a><span>{client.email || "E-mail não informado"}</span></div></div>
                                        <div className="admin-client-card__metrics">
                                            <div>
                                                <span>Atendimentos realizados</span>
                                                <strong>{realized}</strong>
                                            </div>
                                            <div>
                                                <span>Atendimentos agendados</span>
                                                <strong>{scheduled}</strong>
                                            </div>
                                            <div>
                                                <span>Atendimentos cancelados</span>
                                                <strong>{cancelled}</strong>
                                            </div>
                                        </div>
                                        {client.nextAppointment && <div className="admin-client-card__next"><span>Próximo</span><strong>{formatAdminDate(client.nextAppointment.appointment_date)} às {String(client.nextAppointment.start_time).slice(0, 5)}</strong></div>}
                                        <div className="admin-client-card__actions">
                                            <button type="button" onClick={() => openClientHistory(client)}>Ver histórico</button>
                                            <button type="button" className="is-nail-record" onClick={() => openNailRecordForClient(client)}>📷 Registrar estado da unha</button>
                                            <button type="button" className="is-secondary" onClick={() => openClientEditor(client)}>Editar cadastro</button>
                                            <button type="button" className="is-danger" disabled={deletingClientKey === client.key} onClick={() => void deleteClient(client)}>{deletingClientKey === client.key ? "Excluindo..." : "Remover da lista"}</button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                ) : adminView === "new" ? (
                    <section className="admin-content-section">
                        <section className="admin-new-appointment">
                            <div className="admin-new-appointment__header">
                                <div>
                                    <h2>Novo agendamento</h2>
                                    <p>Busque a cliente cadastrada e escolha serviço, dia e horário no mesmo padrão do agendamento da cliente.</p>
                                </div>
                                <button
                                    className="admin-new-appointment__toggle"
                                    type="button"
                                    onClick={() => {
                                        setShowManualForm((current) => !current);
                                        setManualError("");
                                        setManualSuccess("");
                                    }}
                                >
                                    {showManualForm ? "Fechar" : "+ Adicionar"}
                                </button>
                            </div>

                            {showManualForm && (
                                <form className="admin-manual-booking" onSubmit={createManualAppointment}>
                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">1</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Buscar cliente</h3>
                                            <p>Digite o nome ou telefone e selecione uma cliente cadastrada.</p>

                                            <div className="admin-client-picker">
                                                <input
                                                    value={manualClientSearch}
                                                    onChange={(event) => {
                                                        setManualClientSearch(event.target.value);
                                                        setSelectedManualClient(null);
                                                        setManualError("");
                                                    }}
                                                    placeholder="Buscar por nome ou telefone"
                                                    autoComplete="off"
                                                />

                                                {manualClientSearch.trim() && !selectedManualClient && (
                                                    <div className="admin-client-picker__results">
                                                        {filteredManualBookingClients.length ? (
                                                            filteredManualBookingClients.map((client) => (
                                                                <button
                                                                    type="button"
                                                                    key={client.key}
                                                                    onClick={() => {
                                                                        setSelectedManualClient(client);
                                                                        setManualClientSearch(client.name);
                                                                        setManualError("");
                                                                    }}
                                                                >
                                                                    <span className="admin-client-picker__avatar">
                                                                        {client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                                                                    </span>
                                                                    <span>
                                                                        <strong>{client.name}</strong>
                                                                        <small>{client.phone}{client.email ? ` • ${client.email}` : ""}</small>
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="admin-client-picker__empty">Nenhuma cliente encontrada.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {selectedManualClient && (
                                                <div className="admin-selected-client">
                                                    <div>
                                                        <span>Cliente selecionada</span>
                                                        <strong>{selectedManualClient.name}</strong>
                                                        <small>{selectedManualClient.phone}{selectedManualClient.email ? ` • ${selectedManualClient.email}` : ""}</small>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedManualClient(null);
                                                            setManualClientSearch("");
                                                        }}
                                                    >
                                                        Trocar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">2</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Serviço</h3>
                                            <select
                                                className="admin-manual-booking__service"
                                                value={manualServiceName}
                                                onChange={(event) => {
                                                    setManualServiceName(event.target.value);
                                                    setManualTime("");
                                                    setManualError("");
                                                }}
                                            >
                                                {adminServices.map((service) => (
                                                    <option key={service.id} value={service.name}>
                                                        {service.name} — {service.duration_minutes} min — {formatCurrency(service.price_cents)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">3</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Dia</h3>

                                            <div className="admin-manual-week-picker">
                                                <div className="admin-manual-week-picker__top">
                                                    <div className="admin-manual-week-picker__month">
                                                        <button type="button" onClick={openManualMonthCalendar}>📅</button>
                                                        <strong>
                                                            {new Date(`${manualWeekReferenceDate}T12:00:00`).toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}
                                                        </strong>
                                                    </div>

                                                    <div className="admin-manual-week-picker__navs">
                                                        <button type="button" onClick={() => moveManualBookingWeek(-1)}>‹</button>
                                                        <button type="button" onClick={() => moveManualBookingWeek(1)}>›</button>
                                                    </div>
                                                </div>

                                                <div className="admin-manual-week-days">
                                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                                        {manualVisibleWeekDates.slice(0, 4).map((date) => {
                                                            const parsed = new Date(`${date}T12:00:00`);
                                                            const isPast = date < formatDateForInput(new Date());
                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    className={`admin-manual-week-day${manualDate === date ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                    onClick={() => selectManualBookingDate(date)}
                                                                >
                                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                                    <strong>{String(parsed.getDate()).padStart(2, "0")}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                                        {manualVisibleWeekDates.slice(4).map((date) => {
                                                            const parsed = new Date(`${date}T12:00:00`);
                                                            const isPast = date < formatDateForInput(new Date());
                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    className={`admin-manual-week-day${manualDate === date ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                    onClick={() => selectManualBookingDate(date)}
                                                                >
                                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                                    <strong>{String(parsed.getDate()).padStart(2, "0")}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {showManualMonthCalendar && (
                                                    <div className="admin-manual-month-calendar">
                                                        <div className="admin-manual-month-calendar__header">
                                                            <button type="button" onClick={() => setManualCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
                                                            <strong>{manualCalendarMonth.toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}</strong>
                                                            <button type="button" onClick={() => setManualCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
                                                        </div>

                                                        <div className="admin-manual-month-calendar__weekdays">
                                                            {['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map((day) => <span key={day}>{day}</span>)}
                                                        </div>

                                                        <div className="admin-manual-month-calendar__grid">
                                                            {getManualMonthCalendarCells().map((date, index) => {
                                                                if (!date) return <span className="is-empty" key={`empty-${index}`}/>;
                                                                const isPast = date < formatDateForInput(new Date());
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={date}
                                                                        disabled={isPast}
                                                                        className={`${manualDate === date ? "is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                        onClick={() => selectManualBookingDate(date)}
                                                                    >
                                                                        {new Date(`${date}T12:00:00`).getDate()}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">4</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Horário disponível</h3>
                                            <p>{manualSelectedService ? `Duração do serviço: ${manualSelectedService.duration_minutes} min.` : ""}</p>

                                            <div className="admin-manual-times">
                                                {manualAvailableTimes.map((time) => (
                                                    <button
                                                        key={time}
                                                        type="button"
                                                        className={manualTime === time ? "is-selected" : ""}
                                                        onClick={() => {
                                                            setManualTime(time);
                                                            setManualError("");
                                                        }}
                                                    >
                                                        {time}
                                                    </button>
                                                ))}
                                            </div>

                                            {!manualAvailableTimes.length && (
                                                <div className="admin-manual-times__empty">Nenhum horário disponível para este serviço neste dia.</div>
                                            )}
                                        </div>
                                    </section>

                                    <div className="admin-manual-booking__summary">
                                        <div><span>Cliente</span><strong>{selectedManualClient?.name || "Selecione a cliente"}</strong></div>
                                        <div><span>Serviço</span><strong>{manualServiceName || "Selecione o serviço"}</strong></div>
                                        <div><span>Data</span><strong>{manualDate ? formatAdminDate(manualDate) : "Selecione o dia"}</strong></div>
                                        <div><span>Horário</span><strong>{manualTime || "Selecione o horário"}</strong></div>
                                    </div>

                                    <div className="admin-manual-booking__actions">
                                        <button
                                            className="admin-manual-form__save"
                                            type="submit"
                                            disabled={isSavingManualAppointment || !selectedManualClient || !manualTime}
                                        >
                                            {isSavingManualAppointment ? "Criando..." : "Salvar agendamento"}
                                        </button>
                                        <button
                                            className="admin-manual-form__cancel"
                                            type="button"
                                            onClick={() => setShowManualForm(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>

                                    {manualError && <p className="admin-manual-form__error">{manualError}</p>}
                                    {manualSuccess && <p className="admin-manual-form__success">{manualSuccess}</p>}
                                </form>
                            )}
                        </section>

                        
                    </section>
                ) : adminView === "blocks" ? (
                    <section className="admin-content-section">
                        <section className="admin-block-manager admin-block-manager--bottom">
                            <div className="admin-block-manager__header">
                                <div>
                                    <h2>Bloquear horários</h2>
                                    <p>Escolha um dia da semana e marque vários horários livres de uma só vez.</p>
                                </div>
                            </div>

                            <div className="admin-manual-week-picker">
                                <div className="admin-manual-week-picker__top">
                                    <div className="admin-manual-week-picker__month">
                                        <strong style={{textTransform: "capitalize"}}>{blockWeekMonthLabel}</strong>
                                    </div>

                                    <div className="admin-manual-week-picker__navs">
                                        <button
                                            type="button"
                                            aria-label="Semana anterior"
                                            onClick={() => moveBlockWeek(-1)}
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Próxima semana"
                                            onClick={() => moveBlockWeek(1)}
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-manual-week-days">
                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                        {blockVisibleWeekDates.slice(0, 4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === blockDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectBlockDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                        {blockVisibleWeekDates.slice(4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === blockDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectBlockDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="admin-block-date-row">
                                <div>
                                    <strong>
                                        Horários livres em {new Date(`${blockDate}T12:00:00`).toLocaleDateString("pt-BR")}
                                    </strong>
                                    <p>Toque nos horários que deseja bloquear. Cada card representa 30 minutos.</p>
                                </div>
                                <div>
                                    <strong>{selectedBlockTimes.length} horário(s) selecionado(s)</strong>
                                </div>
                            </div>

                            <div className="admin-block-times">
                                {blockAvailableTimes.map((time) => (
                                    <button
                                        key={time}
                                        className={`admin-block-time${selectedBlockTimes.includes(time) ? " is-selected" : ""}`}
                                        type="button"
                                        onClick={() =>
                                            setSelectedBlockTimes((current) =>
                                                current.includes(time)
                                                    ? current.filter((item) => item !== time)
                                                    : [...current, time],
                                            )
                                        }
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>

                            {!blockAvailableTimes.length && (
                                <div className="admin-empty">Não há horários livres nesta data.</div>
                            )}

                            <div className="admin-block-submit-row">
                                <input
                                    value={blockReason}
                                    onChange={(event) => setBlockReason(event.target.value)}
                                    placeholder="Motivo opcional"
                                />
                                <button
                                    type="button"
                                    disabled={isSavingBlock || !selectedBlockTimes.length}
                                    onClick={() => void saveSelectedBlocks()}
                                >
                                    {isSavingBlock ? "Bloqueando..." : "Bloquear selecionados"}
                                </button>
                            </div>

                            {blockError && <p className="admin-block-error">{blockError}</p>}

                            <div className="admin-block-list">
                                {adminBlocks
                                    .filter((item) => item.block_date === blockDate)
                                    .map((block) => (
                                        <div className="admin-block-item" key={block.id}>
                                            <div>
                                                <strong>
                                                    {String(block.start_time).slice(0, 5)}–{String(block.end_time).slice(0, 5)}
                                                </strong>
                                                <span>{block.reason || "Horário bloqueado"}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void deleteScheduleBlock(block.id)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    </section>
                ) : null}

                {showAdminBackToTop && (
                    <button
                        className="admin-back-to-top"
                        type="button"
                        onClick={scrollAdminToTop}
                        aria-label="Voltar ao topo do painel"
                        title="Voltar ao topo"
                    >
                        ↑
                    </button>
                )}

                {selectedAdminAppointment && (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setSelectedAdminAppointment(null);}}>
                        <section className="admin-modal">
                            <div className="admin-modal__header"><div><h2>Editar agendamento</h2><p>Altere os dados ou cancele o agendamento.</p></div><button className="admin-modal__close" type="button" onClick={() => setSelectedAdminAppointment(null)}>×</button></div>
                            <div className="admin-modal__body">
                                <div className="admin-edit-form">
                                    <label>Nome da cliente<input value={editAppointmentName} onChange={(event) => setEditAppointmentName(event.target.value)}/></label>
                                    <label>Telefone<input value={editAppointmentPhone} onChange={(event) => setEditAppointmentPhone(event.target.value)}/></label>

                                    <label className="admin-edit-form__full">
                                        Gosto musical
                                        <textarea
                                            value={editAppointmentMusicTaste}
                                            onChange={(event) => setEditAppointmentMusicTaste(event.target.value)}
                                            placeholder="Ex.: pagode, sertanejo, pop, anos 80..."
                                            rows={3}
                                            maxLength={500}
                                        />
                                    </label>

                                    <label className="admin-edit-form__full">E-mail<input type="email" value={editAppointmentEmail} onChange={(event) => setEditAppointmentEmail(event.target.value)}/></label>

                                    <label className="admin-edit-form__full">
                                        Serviço
                                        <select
                                            value={editAppointmentService}
                                            onChange={(event) => {
                                                setEditAppointmentService(event.target.value);
                                                setEditAppointmentTime("");
                                                setAppointmentEditError("");
                                            }}
                                        >
                                            {adminServices.map((service) => (
                                                <option key={service.id} value={service.name}>
                                                    {service.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="admin-edit-date-time admin-edit-form__full">
                                        <span className="admin-edit-date-time__label">Data e hora</span>

                                        <button
                                            type="button"
                                            className={`admin-edit-date-time__toggle${
                                                showEditDateTimePicker ? " is-open" : ""
                                            }`}
                                            onClick={() => {
                                                setShowEditDateTimePicker((current) => !current);
                                                setAppointmentEditError("");
                                            }}
                                        >
                                            <span className="admin-edit-date-time__icon" aria-hidden="true">
                                                📅
                                            </span>

                                            <div className="admin-edit-date-time__selected">
                                                <small>Data selecionada</small>
                                                <strong>
                                                    {editAppointmentDate
                                                        ? formatAdminDate(editAppointmentDate)
                                                        : "Escolha uma data"}
                                                </strong>

                                                <span className="admin-edit-date-time__time">
                                                    {editAppointmentTime
                                                        ? editAppointmentTime
                                                        : "Escolha o horário"}
                                                </span>
                                            </div>

                                            <span
                                                className="admin-edit-date-time__chevron"
                                                aria-hidden="true"
                                            >
                                                {showEditDateTimePicker ? "⌃" : "⌄"}
                                            </span>
                                        </button>

                                        {showEditDateTimePicker && (
                                            <div className="admin-edit-date-time__picker">
                                                <div className="admin-manual-week-picker">
                                                    <div className="admin-manual-week-picker__top">
                                                        <div className="admin-manual-week-picker__month">
                                                            <button
                                                                type="button"
                                                                onClick={openEditAppointmentMonthCalendar}
                                                                aria-label="Abrir calendário mensal"
                                                            >
                                                                📅
                                                            </button>

                                                            <strong>
                                                                {new Date(
                                                                    `${editWeekReferenceDate}T12:00:00`,
                                                                ).toLocaleDateString(
                                                                    "pt-BR",
                                                                    {
                                                                        month: "long",
                                                                        year: "numeric",
                                                                    },
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="admin-manual-week-picker__navs">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    moveEditAppointmentWeek(-1)
                                                                }
                                                                aria-label="Semana anterior"
                                                            >
                                                                ‹
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    moveEditAppointmentWeek(1)
                                                                }
                                                                aria-label="Próxima semana"
                                                            >
                                                                ›
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="admin-manual-week-days">
                                                        <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                                            {editVisibleWeekDates
                                                                .slice(0, 4)
                                                                .map((date) => {
                                                                    const parsed =
                                                                        new Date(
                                                                            `${date}T12:00:00`,
                                                                        );
                                                                    const isPast =
                                                                        date <
                                                                        formatDateForInput(
                                                                            new Date(),
                                                                        );

                                                                    return (
                                                                        <button
                                                                            key={date}
                                                                            type="button"
                                                                            disabled={isPast}
                                                                            className={`admin-manual-week-day${
                                                                                editAppointmentDate ===
                                                                                date
                                                                                    ? " is-selected"
                                                                                    : ""
                                                                            }${
                                                                                isPast
                                                                                    ? " is-past"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                selectEditAppointmentDate(
                                                                                    date,
                                                                                )
                                                                            }
                                                                        >
                                                                            <span>
                                                                                {parsed
                                                                                    .toLocaleDateString(
                                                                                        "pt-BR",
                                                                                        {
                                                                                            weekday:
                                                                                                "short",
                                                                                        },
                                                                                    )
                                                                                    .replace(
                                                                                        ".",
                                                                                        "",
                                                                                    )}
                                                                            </span>
                                                                            <strong>
                                                                                {String(
                                                                                    parsed.getDate(),
                                                                                ).padStart(
                                                                                    2,
                                                                                    "0",
                                                                                )}
                                                                            </strong>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>

                                                        <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                                            {editVisibleWeekDates
                                                                .slice(4)
                                                                .map((date) => {
                                                                    const parsed =
                                                                        new Date(
                                                                            `${date}T12:00:00`,
                                                                        );
                                                                    const isPast =
                                                                        date <
                                                                        formatDateForInput(
                                                                            new Date(),
                                                                        );

                                                                    return (
                                                                        <button
                                                                            key={date}
                                                                            type="button"
                                                                            disabled={isPast}
                                                                            className={`admin-manual-week-day${
                                                                                editAppointmentDate ===
                                                                                date
                                                                                    ? " is-selected"
                                                                                    : ""
                                                                            }${
                                                                                isPast
                                                                                    ? " is-past"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                selectEditAppointmentDate(
                                                                                    date,
                                                                                )
                                                                            }
                                                                        >
                                                                            <span>
                                                                                {parsed
                                                                                    .toLocaleDateString(
                                                                                        "pt-BR",
                                                                                        {
                                                                                            weekday:
                                                                                                "short",
                                                                                        },
                                                                                    )
                                                                                    .replace(
                                                                                        ".",
                                                                                        "",
                                                                                    )}
                                                                            </span>
                                                                            <strong>
                                                                                {String(
                                                                                    parsed.getDate(),
                                                                                ).padStart(
                                                                                    2,
                                                                                    "0",
                                                                                )}
                                                                            </strong>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>

                                                    {showEditMonthCalendar && (
                                                        <div className="admin-manual-month-calendar">
                                                            <div className="admin-manual-month-calendar__header">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditCalendarMonth(
                                                                            (current) =>
                                                                                new Date(
                                                                                    current.getFullYear(),
                                                                                    current.getMonth() -
                                                                                        1,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ‹
                                                                </button>

                                                                <strong>
                                                                    {editCalendarMonth.toLocaleDateString(
                                                                        "pt-BR",
                                                                        {
                                                                            month: "long",
                                                                            year: "numeric",
                                                                        },
                                                                    )}
                                                                </strong>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditCalendarMonth(
                                                                            (current) =>
                                                                                new Date(
                                                                                    current.getFullYear(),
                                                                                    current.getMonth() +
                                                                                        1,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ›
                                                                </button>
                                                            </div>

                                                            <div className="admin-manual-month-calendar__weekdays">
                                                                {[
                                                                    "SEG",
                                                                    "TER",
                                                                    "QUA",
                                                                    "QUI",
                                                                    "SEX",
                                                                    "SÁB",
                                                                    "DOM",
                                                                ].map((day) => (
                                                                    <span key={day}>
                                                                        {day}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <div className="admin-manual-month-calendar__grid">
                                                                {getEditAppointmentMonthCells().map(
                                                                    (date, index) => {
                                                                        if (!date) {
                                                                            return (
                                                                                <span
                                                                                    className="is-empty"
                                                                                    key={`edit-empty-${index}`}
                                                                                />
                                                                            );
                                                                        }

                                                                        const isPast =
                                                                            date <
                                                                            formatDateForInput(
                                                                                new Date(),
                                                                            );

                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={date}
                                                                                disabled={isPast}
                                                                                className={`${
                                                                                    editAppointmentDate ===
                                                                                    date
                                                                                        ? "is-selected"
                                                                                        : ""
                                                                                }${
                                                                                    isPast
                                                                                        ? " is-past"
                                                                                        : ""
                                                                                }`}
                                                                                onClick={() =>
                                                                                    selectEditAppointmentDate(
                                                                                        date,
                                                                                    )
                                                                                }
                                                                            >
                                                                                {new Date(
                                                                                    `${date}T12:00:00`,
                                                                                ).getDate()}
                                                                            </button>
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="admin-edit-date-time__times">
                                                    <div className="admin-edit-date-time__times-heading">
                                                        <strong>Horários disponíveis</strong>
                                                        <span>
                                                            {editSelectedService
                                                                ? `${editSelectedService.duration_minutes} min`
                                                                : ""}
                                                        </span>
                                                    </div>

                                                    <div className="admin-manual-times">
                                                        {editAppointmentAvailableTimes.map(
                                                            (time) => (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    className={
                                                                        editAppointmentTime ===
                                                                        time
                                                                            ? "is-selected"
                                                                            : ""
                                                                    }
                                                                    onClick={() => {
                                                                        setEditAppointmentTime(
                                                                            time,
                                                                        );
                                                                        setAppointmentEditError(
                                                                            "",
                                                                        );
                                                                    }}
                                                                >
                                                                    {time}
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>

                                                    {!editAppointmentAvailableTimes.length && (
                                                        <div className="admin-manual-times__empty">
                                                            Nenhum horário disponível
                                                            para este serviço neste dia.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {appointmentEditError && <p className="admin-reschedule__message admin-edit-form__full">{appointmentEditError}</p>}
                                    <div className="admin-edit-actions">
                                        <button className="save" type="button" disabled={isSavingAppointment} onClick={() => void saveAppointmentChanges()}>{isSavingAppointment ? "Salvando..." : "Salvar alterações"}</button>
                                        <button className="cancel" type="button" onClick={() => void cancelAppointment(selectedAdminAppointment)}>Cancelar agendamento</button>
                                        <button className="close" type="button" onClick={() => setSelectedAdminAppointment(null)}>Fechar</button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {selectedClient && (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) closeClientHistory();}}>
                        <section className="admin-client-history">
                            <button className="admin-modal__close" type="button" onClick={closeClientHistory}>×</button>
                            <h2>Histórico de {selectedClient.name}</h2>
                            <p>{selectedClient.phone} • {selectedClient.email || "E-mail não informado"}</p>

                            <section className="admin-client-history__section">
                                <div className="admin-client-history__section-header">
                                    <div>
                                        <h3>Registros das unhas</h3>
                                        <p>Fotos e observações ficam vinculadas ao perfil da cliente com data e hora do registro.</p>
                                    </div>
                                    <button
                                        className="admin-nail-record__new-button"
                                        type="button"
                                        onClick={() => {
                                            setShowNailRecordForm((current) => !current);
                                            setNailRecordError("");
                                            setNailRecordSuccess("");
                                        }}
                                    >
                                        {showNailRecordForm ? "Fechar registro" : "Registrar estado da unha"}
                                    </button>
                                </div>

                                {showNailRecordForm && (
                                    <div className="admin-nail-form">
                                        <div className="admin-nail-form__camera-actions">
                                            <label className="admin-nail-form__file-button is-camera">
                                                📷 Abrir câmera
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    onChange={handleNailCameraSelection}
                                                />
                                            </label>

                                            <label className="admin-nail-form__file-button">
                                                Escolher da galeria
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={handleNailCameraSelection}
                                                />
                                            </label>
                                        </div>

                                        <p className="admin-nail-form__hint">
                                            Você pode adicionar até 6 fotos por registro. No celular, “Abrir câmera” solicita a câmera traseira quando o navegador oferece suporte.
                                        </p>

                                        {nailRecordFilePreviews.length > 0 && (
                                            <div className="admin-nail-form__previews">
                                                {nailRecordFilePreviews.map((preview, index) => (
                                                    <div className="admin-nail-form__preview" key={`${preview.file.name}-${preview.file.lastModified}-${index}`}>
                                                        <img src={preview.url} alt={`Foto selecionada ${index + 1}`}/>
                                                        <button
                                                            type="button"
                                                            aria-label={`Remover foto ${index + 1}`}
                                                            onClick={() => removeNailRecordFile(index)}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label>
                                            <strong>Observação sobre a unha</strong>
                                            <textarea
                                                value={nailRecordNotes}
                                                onChange={(event) => setNailRecordNotes(event.target.value)}
                                                placeholder="Ex.: pequena fissura no indicador direito, unha fragilizada, descolamento pré-existente..."
                                                maxLength={1500}
                                            />
                                        </label>

                                        {nailRecordError && (
                                            <p className="admin-nail-form__message is-error">{nailRecordError}</p>
                                        )}

                                        <div className="admin-nail-form__actions">
                                            <button
                                                className="save"
                                                type="button"
                                                disabled={isSavingNailRecord}
                                                onClick={() => void saveNailRecord()}
                                            >
                                                {isSavingNailRecord ? "Salvando registro..." : "Salvar registro"}
                                            </button>
                                            <button
                                                className="cancel"
                                                type="button"
                                                disabled={isSavingNailRecord}
                                                onClick={resetNailRecordForm}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {nailRecordSuccess && (
                                    <p className="admin-nail-form__message is-success">{nailRecordSuccess}</p>
                                )}

                                {isLoadingNailRecords ? (
                                    <div className="admin-nail-records__loading">Carregando registros das unhas...</div>
                                ) : nailRecords.length ? (
                                    <div className="admin-nail-records">
                                        {nailRecords.map((record) => (
                                            <article className="admin-nail-record" key={record.id}>
                                                <div className="admin-nail-record__top">
                                                    <strong>Registro fotográfico</strong>
                                                    <div className="admin-nail-record__top-actions">
                                                        <span>
                                                            {new Date(record.created_at).toLocaleString("pt-BR", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="admin-nail-record__delete"
                                                            disabled={deletingNailRecordId === record.id}
                                                            onClick={() => void deleteNailRecord(record)}
                                                        >
                                                            {deletingNailRecordId === record.id ? "Excluindo..." : "Excluir"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <p className="admin-nail-record__notes">
                                                    {record.notes || "Sem observação informada."}
                                                </p>

                                                {record.photos.length > 0 && (
                                                    <div className="admin-nail-record__photos">
                                                        {record.photos.map((photo, index) =>
                                                            photo.signedUrl ? (
                                                                <a
                                                                    key={photo.id}
                                                                    href={photo.signedUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Abrir foto em tamanho maior"
                                                                >
                                                                    <img
                                                                        src={photo.signedUrl}
                                                                        alt={`Registro da unha ${index + 1}`}
                                                                    />
                                                                </a>
                                                            ) : null,
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="admin-nail-records__empty">
                                        Nenhum registro da unha salvo para esta cliente.
                                    </div>
                                )}
                            </section>

                            <section className="admin-client-history__section">
                                <div className="admin-client-history__section-header">
                                    <div>
                                        <h3>Histórico de atendimentos</h3>
                                        <p>Agendamentos registrados para esta cliente.</p>
                                    </div>
                                </div>

                                <div className="admin-client-history__list">
                                    {selectedClient.appointments.map((appointment) => {
                                        const canClearCancelled =
                                            appointment.status === "cancelled";
                                        const canDeleteConfirmed =
                                            appointment.status === "confirmed";

                                        const isClearing =
                                            clearingCancelledAppointmentId ===
                                            appointment.id;
                                        const isDeletingConfirmed =
                                            deletingConfirmedAppointmentId ===
                                            appointment.id;

                                        const isInteractive =
                                            canClearCancelled ||
                                            canDeleteConfirmed;

                                        return (
                                            <article
                                                key={appointment.id}
                                                className={[
                                                    canClearCancelled
                                                        ? "is-cancelled-cleanable"
                                                        : "",
                                                    canDeleteConfirmed
                                                        ? "is-confirmed-deletable"
                                                        : "",
                                                    isClearing ||
                                                    isDeletingConfirmed
                                                        ? "is-clearing"
                                                        : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                role={
                                                    isInteractive
                                                        ? "button"
                                                        : undefined
                                                }
                                                tabIndex={
                                                    isInteractive
                                                        ? 0
                                                        : undefined
                                                }
                                                onClick={() => {
                                                    if (canClearCancelled) {
                                                        void clearCancelledAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                        return;
                                                    }

                                                    if (canDeleteConfirmed) {
                                                        void deleteConfirmedAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                    }
                                                }}
                                                onKeyDown={(event) => {
                                                    if (
                                                        !isInteractive ||
                                                        (event.key !== "Enter" &&
                                                            event.key !== " ")
                                                    ) {
                                                        return;
                                                    }

                                                    event.preventDefault();

                                                    if (canClearCancelled) {
                                                        void clearCancelledAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                        return;
                                                    }

                                                    if (canDeleteConfirmed) {
                                                        void deleteConfirmedAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                    }
                                                }}
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            appointment.service_name
                                                        }
                                                    </strong>
                                                    <span>
                                                        {formatAdminDate(
                                                            appointment.appointment_date,
                                                        )}{" "}
                                                        às{" "}
                                                        {String(
                                                            appointment.start_time,
                                                        ).slice(0, 5)}
                                                    </span>
                                                </div>

                                                {canClearCancelled ? (
                                                    <div className="admin-client-history__cancelled-action">
                                                        <strong>
                                                            {isClearing
                                                                ? "Limpando..."
                                                                : "Cancelado"}
                                                        </strong>
                                                        <small>
                                                            Toque para limpar
                                                        </small>
                                                    </div>
                                                ) : canDeleteConfirmed ? (
                                                    <div className="admin-client-history__confirmed-action">
                                                        <strong>
                                                            {isDeletingConfirmed
                                                                ? "Excluindo..."
                                                                : "Confirmado"}
                                                        </strong>
                                                        <small>
                                                            Toque para excluir
                                                        </small>
                                                    </div>
                                                ) : (
                                                    <span>
                                                        {getAppointmentStatusLabel(
                                                            appointment.status,
                                                        )}
                                                    </span>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        </section>
                    </div>
                )}

                {editingClient && (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setEditingClient(null);}}>
                        <section className="admin-client-editor">
                            <button className="admin-modal__close" type="button" onClick={() => setEditingClient(null)}>×</button>
                            <h2>Editar cadastro</h2>
                            <label>Nome<input value={editClientName} onChange={(event) => setEditClientName(event.target.value)}/></label>
                            <label>Telefone<input value={editClientPhone} onChange={(event) => setEditClientPhone(formatBrazilianPhone(event.target.value))} maxLength={15} inputMode="numeric"/></label>
                            <label>E-mail<input type="email" value={editClientEmail} onChange={(event) => setEditClientEmail(event.target.value)}/></label>
                            <label>
                                Gosto musical
                                <textarea
                                    value={editClientMusicTaste}
                                    onChange={(event) => setEditClientMusicTaste(event.target.value)}
                                    placeholder="Ex.: pagode, sertanejo, pop, anos 80..."
                                    rows={3}
                                    maxLength={500}
                                />
                            </label>

                            <section className="admin-anamnesis-card">
                                <div className="admin-anamnesis-card__header">
                                    <div>
                                        <span>Saúde e cuidados</span>
                                        <h3>Ficha de anamnese</h3>
                                    </div>
                                </div>

                                {isLoadingClientAnamnesis ? (
                                    <p className="admin-anamnesis-card__loading">
                                        Carregando ficha...
                                    </p>
                                ) : (
                                    <div className="admin-anamnesis-card__questions">
                                        <label>
                                            <span>1. Data de nascimento</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={clientAnamnesis.birthDate}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "birthDate",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: 15/08/1990"
                                                maxLength={10}
                                            />
                                        </label>

                                        <label>
                                            <span>2. Indicação</span>
                                            <input
                                                value={clientAnamnesis.referral}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "referral",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Digite a resposta"
                                            />
                                        </label>

                                        <label>
                                            <span>3. É gestante?</span>
                                            <input
                                                value={clientAnamnesis.pregnant}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "pregnant",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>4. Tem diabetes?</span>
                                            <input
                                                value={clientAnamnesis.diabetes}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "diabetes",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>5. É bariátrica?</span>
                                            <input
                                                value={clientAnamnesis.bariatric}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "bariatric",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>6. Faz quimioterapia?</span>
                                            <input
                                                value={clientAnamnesis.chemotherapy}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "chemotherapy",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>7. Tireoide</span>
                                            <input
                                                value={clientAnamnesis.thyroid}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "thyroid",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Digite a resposta"
                                            />
                                        </label>

                                        <label>
                                            <span>8. Tem o hábito de roer as unhas?</span>
                                            <input
                                                value={clientAnamnesis.nailBiting}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "nailBiting",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>9. Tem alergias?</span>
                                            <input
                                                value={clientAnamnesis.allergies}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "allergies",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Informe quais, se houver"
                                            />
                                        </label>

                                        <label>
                                            <span>10. Tem micose?</span>
                                            <input
                                                value={clientAnamnesis.mycosis}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "mycosis",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>11. Usa medicamentos contínuos?</span>
                                            <input
                                                value={clientAnamnesis.continuousMedication}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "continuousMedication",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Informe quais, se houver"
                                            />
                                        </label>

                                        <label>
                                            <span>12. Usa materiais de limpeza?</span>
                                            <input
                                                value={clientAnamnesis.cleaningProducts}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "cleaningProducts",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>
                                    </div>
                                )}
                            </section>

                            {clientEditError && <p className="admin-reschedule__message">{clientEditError}</p>}
                            <button className="admin-primary-button" type="button" disabled={isSavingClient} onClick={() => void saveClientChanges()}>{isSavingClient ? "Salvando..." : "Salvar cadastro"}</button>
                        </section>
                    </div>
                )}
            </section>
        </main>
    );
}


