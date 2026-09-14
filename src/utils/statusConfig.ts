// Centralized configuration for order statuses (UI/UX Design System)
export interface StatusConfig {
    label: string;
    bg: string;
    text: string;
    dot?: string;
    pulse?: boolean;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
    pending: {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        dot: "bg-amber-400",
        label: "ממתין",
        pulse: true
    },
    confirmed: {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        dot: "bg-blue-400",
        label: "אושר",
        pulse: false
    },
    on_route: {
        bg: "bg-violet-500/10",
        text: "text-violet-400",
        dot: "bg-violet-400",
        label: "בנסיעה",
        pulse: false
    },
    completed: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        dot: "bg-emerald-400",
        label: "הושלם",
        pulse: false
    },
    waiting_approval: {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        dot: "bg-orange-400",
        label: "ממתין לאישור",
        pulse: true
    },
    cancelled: {
        bg: "bg-red-500/10",
        text: "text-red-400",
        dot: "bg-red-400",
        label: "בוטל",
        pulse: false
    }
};

export const getStatusConfig = (status: string): StatusConfig => {
    return STATUS_CONFIG[status] || {
        label: status,
        bg: "bg-slate-500/10",
        text: "text-slate-400",
        dot: "bg-slate-400",
        pulse: false
    };
};
