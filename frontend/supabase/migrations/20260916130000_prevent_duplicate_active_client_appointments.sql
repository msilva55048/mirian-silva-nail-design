-- Prevents two active appointments for the same client and exact slot.
-- This is intentionally narrower than the existing overlap rules: it does not
-- change duration-based availability for different clients or adjacent slots.
create unique index if not exists appointments_active_client_slot_unique
    on public.appointments (client_id, appointment_date, start_time)
    where status in ('pending', 'confirmed');

