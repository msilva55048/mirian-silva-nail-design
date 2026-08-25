export type PublicClientProfile = {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    phone_digits: string;
    user_id: string;
};

export type PublicClientAppointment = {
    id: string;
    client_id: string | null;
    service_name: string;
    appointment_date: string;
    start_time: string;
    duration_minutes: number;
    price_cents: number | null;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
    created_at: string;
};
