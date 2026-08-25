export type AdminAppointment = {
    id: string;
    client_id?: string | null;
    client_name: string;
    client_phone: string;
    client_email: string | null;
    musical_taste: string | null;
    service_name: string;
    appointment_date: string;
    start_time: string;
    duration_minutes: number;
    price_cents: number | null;
    client_hidden: boolean;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
    created_at: string;
};

export type AdminScheduleBlock = {
    id: string;
    block_date: string;
    start_time: string;
    end_time: string;
    reason: string | null;
    created_at: string;
};

export type AdminServiceSetting = {
    id: number;
    name: string;
    description: string;
    duration_minutes: number;
    price_cents: number;
    display_order: number;
};


export type AdminClient = {
    key: string;
    name: string;
    phone: string;
    email: string;
    musicalTaste: string;
    appointments: AdminAppointment[];
    lastAppointment: AdminAppointment | null;
    nextAppointment: AdminAppointment | null;
};

export type ClientAnamnesisForm = {
    birthDate: string;
    referral: string;
    pregnant: string;
    diabetes: string;
    bariatric: string;
    chemotherapy: string;
    thyroid: string;
    nailBiting: string;
    allergies: string;
    mycosis: string;
    continuousMedication: string;
    cleaningProducts: string;
};

export const emptyClientAnamnesis: ClientAnamnesisForm = {
    birthDate: "",
    referral: "",
    pregnant: "",
    diabetes: "",
    bariatric: "",
    chemotherapy: "",
    thyroid: "",
    nailBiting: "",
    allergies: "",
    mycosis: "",
    continuousMedication: "",
    cleaningProducts: "",
};

export type ClientProfile = {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    musical_taste?: string | null;
    phone_digits?: string;
    user_id?: string | null;
    created_at?: string;
    updated_at?: string;
};

export type AdminBookingClient = {
    key: string;
    profileId: string | null;
    name: string;
    phone: string;
    email: string;
    userId?: string | null;
};

export type NailRecordPhoto = {
    id: string;
    nail_record_id: string;
    photo_path: string;
    created_at: string;
    signedUrl?: string;
};

export type NailRecord = {
    id: string;
    client_id: string;
    notes: string | null;
    created_at: string;
    photos: NailRecordPhoto[];
};
