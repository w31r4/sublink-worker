import { ServiceError } from './errors.js';

export async function isSubscriptionAdmin(request, token) {
    if (!token) return false;
    const supplied = request.header('Authorization') || '';
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [actual, expected] = await Promise.all([digest(supplied), digest(`Bearer ${token}`)]);
    return actual.reduce((difference, byte, index) => difference | (byte ^ expected[index]), 0) === 0;
}

export async function requireSubscriptionAdmin(request, token) {
    if (!token) throw new ServiceError('Configure SUBLINK_ADMIN_TOKEN to enable subscription management', 503);
    if (!await isSubscriptionAdmin(request, token)) throw new ServiceError('Invalid subscription management token', 401);
}
