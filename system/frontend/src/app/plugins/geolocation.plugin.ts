// Layer 1: wrapper of @capacitor/geolocation (frontend rule 5; FR-DTR-04).
// A punch never waits for a location that cannot come. Denied permission, no position, and a timeout all
// give null, and the punch is saved without a location (QR-SF-05).
import { InjectionToken } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Location {
  lat: number;
  lng: number;
  accuracyM: number;
}

export interface GeolocationPort {
  currentLocation(): Promise<Location | null>;
}

/** The time limit of one location request. The time-in confirmation must stay fast (QR-PE-01). */
export const LOCATION_TIMEOUT_MS = 8_000;

/** A recent position is good enough for a punch. */
const MAX_POSITION_AGE_MS = 60_000;

export const GEOLOCATION = new InjectionToken<GeolocationPort>('GEOLOCATION', {
  providedIn: 'root',
  factory: () => ({
    async currentLocation(): Promise<Location | null> {
      try {
        let state = (await Geolocation.checkPermissions()).location;
        if (state === 'prompt' || state === 'prompt-with-rationale') {
          state = (await Geolocation.requestPermissions({ permissions: ['location'] })).location;
        }
        if (state !== 'granted') {
          return null;
        }
        const p = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: LOCATION_TIMEOUT_MS,
          maximumAge: MAX_POSITION_AGE_MS,
        });
        return { lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy };
      } catch {
        return null;
      }
    },
  }),
});
