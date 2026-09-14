import React from 'react';

interface DriverMapProps {
  apiKey?: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  showUserLocation?: boolean;
  className?: string;
}

/**
 * Lightweight map preview used in AcceptRide flow.
 * Uses Google Maps embed URL and gracefully falls back when coordinates are missing.
 */
export const DriverMap: React.FC<DriverMapProps> = ({
  pickupLat,
  pickupLng,
  destLat,
  destLng,
  className = 'h-44 w-full'
}) => {
  const hasPickup = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);
  const hasDest = Number.isFinite(destLat) && Number.isFinite(destLng);

  if (!hasPickup) {
    return (
      <div className={`${className} w-full bg-slate-100 flex items-center justify-center text-sm text-slate-500`}>
        מיקום הנסיעה יוצג כאן
      </div>
    );
  }

  const origin = `${pickupLat},${pickupLng}`;
  const destination = hasDest ? `${destLat},${destLng}` : origin;
  const mapsUrl = `https://www.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&output=embed`;

  return (
    <iframe
      title="driver-map-preview"
      src={mapsUrl}
      className={`${className} w-full border-0`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
};
