type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
    [key: string]: any;
}

class Logger {
    private isDev = import.meta.env.DEV;

    private log(level: LogLevel, message: string, data?: LogData) {
        if (!this.isDev && level === 'debug') return;

        const timestamp = new Date().toISOString();

        if (this.isDev) {
            const emoji = {
                debug: '🔍',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌'
            }[level];

            console[level === 'debug' ? 'log' : level](
                `${emoji} [${timestamp}] ${message}`,
                data || ''
            );
        } else {
            // In production, we can send logs to a remote server if needed
            if (level === 'error' || level === 'warn') {
                // Example: sendToServer({ level, message, data, timestamp });
            }
        }
    }

    debug(message: string, data?: LogData) {
        this.log('debug', message, data);
    }

    info(message: string, data?: LogData) {
        this.log('info', message, data);
    }

    warn(message: string, data?: LogData) {
        this.log('warn', message, data);
    }

    error(message: string, error?: Error | LogData) {
        const data = error instanceof Error
            ? { error: error.message, stack: error.stack }
            : error;

        this.log('error', message, data);
    }
}

export const logger = new Logger();
