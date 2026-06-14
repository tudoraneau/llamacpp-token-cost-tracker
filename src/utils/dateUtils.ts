export class DateUtils {
    static formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }
    
    static getToday(): Date {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }
    
    static getWeekStart(): Date {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day;
        const weekStart = new Date(today.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }
    
    static getMonthStart(): Date {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return monthStart;
    }
}