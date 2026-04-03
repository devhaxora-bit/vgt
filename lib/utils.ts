import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function numberToWords(num: number): string {
    if (num === 0) return 'Zero Rupees Only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(n: number): string {
        let res = '';
        if (n >= 100) {
            res += units[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            res += tens[Math.floor(n / 10)] + ' ';
            n %= 10;
        }
        if (n > 0) {
            res += units[n] + ' ';
        }
        return res.trim();
    }

    let whole = Math.floor(num);
    let paise = Math.round((num - whole) * 100);

    let res = '';
    if (whole >= 10000000) { // Crores
        res += convertGroup(Math.floor(whole / 10000000)) + ' Crore ';
        whole %= 10000000;
    }
    if (whole >= 100000) { // Lakhs
        res += convertGroup(Math.floor(whole / 100000)) + ' Lakh ';
        whole %= 100000;
    }
    if (whole >= 1000) { // Thousands
        res += convertGroup(Math.floor(whole / 1000)) + ' Thousand ';
        whole %= 1000;
    }
    if (whole > 0) {
        res += convertGroup(whole);
    }

    res = res.trim() ? 'Rupees ' + res.trim() : '';

    if (paise > 0) {
        res += (res ? ' and ' : '') + convertGroup(paise) + ' Paise';
    }

    return res + ' Only';
}
