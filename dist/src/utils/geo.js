import { Prisma } from '@prisma/client';
export const decimalToNumber = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return value.toNumber();
};
export const toDecimalInput = (value) => value === null || value === undefined ? undefined : new Prisma.Decimal(value);
export const calculateDistanceKm = (first, second) => {
    if (first.latitude === null ||
        first.latitude === undefined ||
        first.longitude === null ||
        first.longitude === undefined ||
        second.latitude === null ||
        second.latitude === undefined ||
        second.longitude === null ||
        second.longitude === undefined) {
        return null;
    }
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(second.latitude - first.latitude);
    const deltaLon = toRadians(second.longitude - first.longitude);
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(toRadians(first.latitude)) *
            Math.cos(toRadians(second.latitude)) *
            Math.sin(deltaLon / 2) *
            Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusKm * c * 100) / 100;
};
export const isWithinRadiusKm = (distanceKm, radiusKm) => {
    if (distanceKm === null || radiusKm === null || radiusKm === undefined) {
        return null;
    }
    return distanceKm <= radiusKm;
};
