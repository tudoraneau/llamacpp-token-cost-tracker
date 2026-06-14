export class StringUtils {
    static formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    static formatCurrency(amount: number, currency: string = 'USD', decimalPlaces: number = 2): string {
        return `${currency} ${amount.toFixed(decimalPlaces)}`;
    }
}