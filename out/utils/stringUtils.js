"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringUtils = void 0;
class StringUtils {
    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    static formatCurrency(amount, currency = 'USD', decimalPlaces = 2) {
        return `${currency} ${amount.toFixed(decimalPlaces)}`;
    }
}
exports.StringUtils = StringUtils;
//# sourceMappingURL=stringUtils.js.map