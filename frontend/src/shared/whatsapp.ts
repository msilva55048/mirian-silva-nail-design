const BRAZILIAN_DDDS = new Set([
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34,
    35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61,
    62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83,
    84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function normalizeBrazilianWhatsAppNumber(phone: string): string | null {
    let digits = phone.replace(/\D/g, "");

    if (digits.startsWith("55")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length !== 10 && digits.length !== 11) return null;

    const ddd = Number(digits.slice(0, 2));
    const local = digits.slice(2);
    if (!BRAZILIAN_DDDS.has(ddd)) return null;

    if (local.length === 8) {
        if (!/^[6-9]/.test(local)) return `55${digits}`;
        return `55${ddd}9${local}`;
    }

    if (local.length === 9 && /^[6-9]/.test(local)) return `55${digits}`;
    return null;
}
