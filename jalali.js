/**
 * Jalali (Shamsi) & Hijri (Islamic) calendar conversion utilities.
 */

export const JALALI_MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const JALALI_WEEK_DAYS = [
    'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

export const HIJRI_MONTH_NAMES = [
    'محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی',
    'جمادی‌الاولی', 'جمادی‌الثانیه', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه'
];

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toPersianDigits(str) {
    return str.toString().replace(/\d/g, x => PERSIAN_DIGITS[x]);
}

export function toArabicDigits(str) {
    return str.toString().replace(/\d/g, x => ARABIC_DIGITS[x]);
}

// --- Jalali (Shamsi) Conversion ---

const JALALI_BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
    1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
];

function div(a, b) {
    return Math.trunc(a / b);
}

function mod(a, b) {
    return a - Math.trunc(a / b) * b;
}

function jalCal(jy, withoutLeap = false) {
    const bl = JALALI_BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = JALALI_BREAKS[0];
    let jm, jump, n;

    for (let i = 1; i < bl; i++) {
        jm = JALALI_BREAKS[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
        jp = jm;
    }

    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;

    if (withoutLeap) return { gy, march };

    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;

    return { leap, gy, march };
}

function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5)
        + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
}

function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
    const r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy, false);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;

    if (k >= 0) {
        if (k <= 185) {
            return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
        }
        k -= 186;
    } else {
        jy -= 1;
        k += 179;
        if (r.leap === 1) k += 1;
    }

    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function isLeapJalaaliYear(jy) {
    if (jy < JALALI_BREAKS[0] || jy >= JALALI_BREAKS[JALALI_BREAKS.length - 1]) {
        return false;
    }
    return jalCal(jy, false).leap === 0;
}

export function jalaaliMonthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaaliYear(jy) ? 30 : 29;
}

export function toJalaali(gy, gm, gd) {
    if (gy instanceof Date) {
        gd = gy.getDate();
        gm = gy.getMonth() + 1;
        gy = gy.getFullYear();
    }
    return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
}

// --- Hijri (Islamic) Conversion ---
// Uses Iranian moon-sighting data (1423-1448 AH) from starcal,
// with algorithmic fallback for dates outside the table.

const HIJRI_START_JD = 2452349.5; // Julian Day of 1423/1/1
const HIJRI_MONTHS = [
    [1423, 29, 30, 30, 29, 29, 30, 29, 30, 29, 30, 29, 30],
    [1424, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29],
    [1425, 30, 29, 30, 30, 29, 30, 30, 29, 29, 30, 29, 30],
    [1426, 29, 29, 30, 29, 30, 30, 30, 29, 30, 30, 29, 29],
    [1427, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30, 29, 30],
    [1428, 29, 30, 29, 29, 29, 30, 30, 29, 30, 30, 30, 29],
    [1429, 30, 29, 30, 29, 29, 29, 30, 30, 29, 30, 30, 29],
    [1430, 30, 30, 29, 29, 30, 29, 30, 29, 29, 30, 30, 29],
    [1431, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30, 29],
    [1432, 30, 30, 29, 30, 30, 30, 29, 30, 29, 29, 30, 29],
    [1433, 29, 30, 29, 30, 30, 30, 29, 30, 29, 30, 29, 30],
    [1434, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29],
    [1435, 29, 30, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30],
    [1436, 29, 30, 29, 29, 30, 29, 30, 29, 30, 29, 30, 30],
    [1437, 29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30],
    [1438, 29, 30, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30],
    [1439, 29, 30, 30, 30, 30, 29, 30, 29, 29, 30, 29, 29],
    [1440, 30, 29, 30, 30, 30, 29, 30, 30, 29, 29, 30, 29],
    [1441, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30],
    [1442, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29],
    [1443, 29, 30, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29],
    [1444, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 29],
    [1445, 30, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 29],
    [1446, 30, 30, 30, 29, 30, 30, 29, 30, 29, 29, 29, 30],
    [1447, 29, 30, 30, 29, 30, 30, 30, 29, 30, 29, 29, 29],
    [1448, 30, 29, 30, 29, 30, 30, 30, 29, 30, 29, 30, 29],
];

const HIJRI_TOTAL_DAYS = HIJRI_MONTHS.reduce(
    (sum, row) => sum + row.slice(1).reduce((a, b) => a + b, 0),
    0
);
const HIJRI_END_JD = HIJRI_START_JD + HIJRI_TOTAL_DAYS - 1;
const GREGORIAN_MONTH_OFFSET = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function gregorianToJd(gy, gm, gd) {
    const gy2 = gm > 2 ? gy + 1 : gy;
    return 1721059 + (365 * gy)
        + Math.floor((gy2 + 3) / 4)
        - Math.floor((gy2 + 99) / 100)
        + Math.floor((gy2 + 399) / 400)
        + gd + GREGORIAN_MONTH_OFFSET[gm - 1] - 0.5;
}

function hijriToJdAlgo(iy, im, id) {
    return id
        + Math.ceil(29.5 * (im - 1))
        + (iy - 1) * 354
        + Math.floor((3 + 11 * iy) / 30)
        + 1948438.5;
}

function jdToHijriAlgo(jd) {
    const normalizedJd = Math.floor(jd) + 0.5;
    const iy = Math.floor((30 * (normalizedJd - 1948439.5) + 10646) / 10631);
    const im = Math.min(12, Math.ceil((normalizedJd - (29 + hijriToJdAlgo(iy, 1, 1))) / 29.5) + 1);
    const id = normalizedJd - hijriToJdAlgo(iy, im, 1) + 1;
    return { jy: iy, jm: im, jd: id };
}

function jdToHijriLookup(jd) {
    let dayCount = jd - HIJRI_START_JD + 1;
    for (const row of HIJRI_MONTHS) {
        const iy = row[0];
        for (let im = 1; im < row.length; im++) {
            if (dayCount <= row[im]) {
                return { jy: iy, jm: im, jd: dayCount };
            }
            dayCount -= row[im];
        }
    }
    return jdToHijriAlgo(jd);
}

export function toHijri(date) {
    const jd = gregorianToJd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (jd >= HIJRI_START_JD && jd <= HIJRI_END_JD) {
        return jdToHijriLookup(jd);
    }
    return jdToHijriAlgo(jd);
}
