export const START_TIME = Date.now();

let _requestCount = 0;
let _totalResponseTime = 0;

export function incrementMetrics(latencyMs: number) {
    _requestCount++;
    _totalResponseTime += latencyMs;
}

export function getRequestCount(): number {
    return _requestCount;
}

export function getAvgLatency(): number {
    return _requestCount > 0 ? _totalResponseTime / _requestCount : 0;
}
