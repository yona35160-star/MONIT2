import React, { useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Polyline, Tooltip } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Fix Leaflet Default Icon Issue
// ... (omitted for brevity in replacement, but I will keep it)
// I'll actually just provide the top part clearly.

const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// SVG Marker Factory
const createMarkerIcon = (color: string) => L.divIcon({
    html: `
        <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.875 12.5 41 12.5 41S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="${color}"/>
            <circle cx="12.5" cy="12.5" r="5" fill="white" fill-opacity="0.8"/>
        </svg>
    `,
    className: 'custom-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

const redIcon = createMarkerIcon('#ef4444');
const greenIcon = createMarkerIcon('#22c55e');
const blueIcon = createMarkerIcon('#3b82f6');
const orangeIcon = createMarkerIcon('#f97316');
const roseIcon = createMarkerIcon('#fb7185'); // 🌹 Rose - live passenger

const getStatusIcon = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'arrived') return orangeIcon;                         // 🟠 Orange - driver waiting
    if (s === 'in_progress' || s === 'on_route') return blueIcon;   // 🔵 Blue - ride in progress
    if (s === 'completed' || s === 'paid') return greenIcon;        // 🟢 Green - ride completed
    return redIcon; // Default for pending/assigned/broadcasted     // 🔴 Red - unassigned
};

// Passenger Person Icon
const createPassengerIcon = () => L.divIcon({
    html: `
    <div class="passenger-pulse">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fb7185" stroke="#1E293B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
    <style>
      .passenger-pulse {
        animation: pulse-rose 2s infinite;
      }
      @keyframes pulse-rose {
        0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(251, 113, 133, 0.7)); }
        70% { transform: scale(1.1); filter: drop-shadow(0 0 10px rgba(251, 113, 133, 0)); }
        100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(251, 113, 133, 0)); }
      }
    </style>
    `,
    className: 'passenger-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

// Car Icon for Driver
const createCarIcon = (heading: number) => L.divIcon({
    html: `
    <div style="transform: rotate(${heading}deg); transition: transform 0.5s ease;">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#FBBF24" stroke="#1E293B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    </div>
    `,
    className: 'driver-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

interface Location {
    lat: number;
    lng: number;
    address?: string;
}

interface LiveMapProps {
    // Single Trip Mode
    pickup?: Location;
    destination?: Location;
    driver?: Location & { heading?: number };
    status?: string; // New prop for dynamic icons

    // Global Mode (Admin)
    orders?: any[];
    drivers?: any[];
    passengers?: any[];
    apiKey?: string; // Kept for compatibility but unused by Leaflet

    heatmapData?: number[][];
    showHeatmap?: boolean;

    globalMode?: boolean;
    className?: string;
    onSmartAssignClick?: (orderId: string) => void;
}

// Heatmap Layer Component for Leaflet
const HeatmapLayer: React.FC<{ data: number[][] }> = ({ data }) => {
    const map = useMap();

    useEffect(() => {
        if (!data || data.length === 0) return;

        // @ts-ignore - leaflet.heat adds this method to L
        const heatLayer = (L as any).heatLayer(data, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
        }).addTo(map);

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [data, map]);

    return null;
};

const MapController: React.FC<{ bounds: L.LatLngBoundsExpression | null }> = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }, [bounds, map]);
    return null;
};

export const LiveMapComponent: React.FC<LiveMapProps> = ({ pickup, destination, driver, status, orders, drivers, passengers, heatmapData, showHeatmap, className, onSmartAssignClick }) => {
    const bounds = React.useMemo(() => {
        const points: L.LatLngExpression[] = [];

        // Global Mode Heatmap bounds
        if (showHeatmap && heatmapData && heatmapData.length > 0) {
            heatmapData.forEach(p => points.push([p[0], p[1]]));
        }

        // Single Trip points
        if (pickup && pickup.lat && pickup.lng) points.push([pickup.lat, pickup.lng]);
        if (destination && destination.lat && destination.lng) points.push([destination.lat, destination.lng]);
        if (driver && driver.lat && driver.lng) points.push([driver.lat, driver.lng]);

        // Global Mode points
        if (orders) {
            orders.forEach(o => {
                if (o.pickupLat && o.pickupLng) points.push([Number(o.pickupLat), Number(o.pickupLng)]);
                if (o.destinationLat && o.destinationLng && (o.status === 'assigned' || o.status === 'arrived' || o.status === 'in_progress' || o.status === 'on_route')) {
                    points.push([Number(o.destinationLat), Number(o.destinationLng)]);
                }
            });
        }
        if (drivers) {
            drivers.forEach(d => {
                if (d.lat && d.lng) points.push([Number(d.lat), Number(d.lng)]);
            });
        }
        if (passengers) {
            passengers.forEach(p => {
                if (p.lat && p.lng) points.push([Number(p.lat), Number(p.lng)]);
            });
        }

        if (points.length === 0) return null;
        return L.latLngBounds(points);
    }, [pickup, destination, driver, orders, drivers, heatmapData, showHeatmap]);

    // Calculate center fallback
    const center: L.LatLngExpression = (pickup && pickup.lat) ? [pickup.lat, pickup.lng] : [32.0853, 34.7818];

    return (
        <div className={`w-full h-full rounded-2xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] border border-white/5 bg-[#0F172A] ${className} relative z-0`}>
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', background: '#0F172A' }} zoomControl={false}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* Heatmap Layer */}
                {showHeatmap && heatmapData && <HeatmapLayer data={heatmapData} />}

                {/* Single Trip Markers */}
                {(!showHeatmap) && pickup && pickup.lat && (
                    <Marker position={[pickup.lat, pickup.lng]} icon={getStatusIcon(status)}>
                        <Popup>Pickup: {pickup.address}</Popup>
                    </Marker>
                )}
                {(!showHeatmap) && destination && destination.lat && (
                    <Marker position={[destination.lat, destination.lng]} icon={status === 'completed' || status === 'paid' ? greenIcon : redIcon}>
                        <Popup>Destination: {destination.address}</Popup>
                    </Marker>
                )}
                {driver && driver.lat && (
                    <Marker position={[driver.lat, driver.lng]} icon={createCarIcon(driver.heading || 0)}>
                        <Popup>Driver</Popup>
                        <Tooltip permanent direction="top" offset={[0, -20]}>
                            <div className="font-black text-[10px] bg-[#1E293B] px-3 py-1.5 rounded-xl shadow-2xl border border-white/5 text-amber-400 uppercase tracking-widest">
                                {driver.address || 'נהג בדרך'}
                            </div>
                        </Tooltip>
                    </Marker>
                )}

                {/* Global Mode Markers */}
                {(!showHeatmap) && orders?.map((o, idx) => (
                    <React.Fragment key={`order-group-${idx}`}>
                        {o.pickupLat && (
                            <Marker
                                position={[Number(o.pickupLat), Number(o.pickupLng)]}
                                icon={getStatusIcon(o.status)}
                            >
                                <Popup>
                                    <div className="text-right font-sans" dir="rtl">
                                        <strong className="text-slate-800 block mb-1">נוסע: {o.customerName || 'לקוח מזדמן'}</strong>
                                        <div className="text-xs text-slate-500 mb-2">{o.pickupAddress}</div>
                                        <div className="text-xs mb-3">סטטוס: <b>{o.status}</b></div>
                                        {(o.status === 'pending' || o.status === 'waiting_assignment') && onSmartAssignClick && (
                                            <button
                                                onClick={() => onSmartAssignClick(o.orderId)}
                                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg w-full text-xs font-bold shadow hover:bg-indigo-700 transition-colors"
                                            >
                                                שיבוץ נהג חכם 🚀
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                        {/* Destination Marker */}
                        {o.destinationLat && (o.status === 'assigned' || o.status === 'arrived' || o.status === 'in_progress' || o.status === 'on_route' || o.status === 'completed' || o.status === 'paid') && (
                            <Marker
                                position={[Number(o.destinationLat), Number(o.destinationLng)]}
                                icon={o.status === 'completed' || o.status === 'paid' ? greenIcon : redIcon}
                            >
                                <Popup>
                                    <strong>Order #{o.orderId} (Dest)</strong><br />
                                    {o.destinationAddress}<br />
                                    Status: {o.status}
                                </Popup>
                            </Marker>
                        )}
                        {/* Path for Active/Recently Completed Rides */}
                        {o.pickupLat && o.destinationLat && (o.status === 'assigned' || o.status === 'arrived' || o.status === 'in_progress' || o.status === 'on_route' || o.status === 'completed' || o.status === 'paid') && (
                            <Polyline
                                positions={[
                                    [Number(o.pickupLat), Number(o.pickupLng)],
                                    [Number(o.destinationLat), Number(o.destinationLng)]
                                ]}
                                color={o.status === 'completed' || o.status === 'paid' ? "#22c55e" : "#3b82f6"}
                                weight={2}
                                opacity={0.6}
                                dashArray="5, 10"
                            />
                        )}
                    </React.Fragment>
                ))}

                {drivers?.map((d, idx) => {
                    const isOnline = d.status === 'online' || d.status === 'in_progress';
                    return d.lat && (
                        <Marker key={`driver-${idx}`} position={[Number(d.lat), Number(d.lng)]} icon={createCarIcon(d.heading || 0)}>
                            <Popup>
                                <div className="text-right font-sans min-w-[120px]" dir="rtl">
                                    <strong className="text-slate-800 text-sm block mb-1">{d.driverName}</strong>
                                    <div className="flex items-center gap-2 text-xs mb-1">
                                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                        <span className="text-slate-600">{d.status === 'online' ? 'פנוי' : d.status === 'in_progress' ? 'בנסיעה' : 'לא זמין'}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-2" dir="ltr">{d.phone}</div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}

                {passengers?.map((p, idx) => (
                    <Marker key={`passenger-${idx}`} position={[Number(p.lat), Number(p.lng)]} icon={createPassengerIcon()}>
                        <Popup>
                            <div className="text-right font-sans" dir="rtl">
                                <strong className="text-slate-800 text-sm block mb-1">נוסע בזמן אמת</strong>
                                <div className="text-[10px] text-slate-400 font-mono mb-2" dir="ltr">{p.phone}</div>
                                <div className="text-xs text-rose-500 font-bold">משתף מיקום בוואטסאפ</div>
                                <div className="text-[10px] text-slate-400 mt-2">עודכן: {new Date(p.timestamp).toLocaleTimeString('he-IL')}</div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <MapController bounds={bounds} />
            </MapContainer>

            <div className="absolute bottom-4 left-4 text-[9px] font-mono text-slate-500 bg-[#0F172A]/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 z-[1000] tracking-widest uppercase">
                &copy; OpenStreetMap | CartoDB Dark
            </div>
        </div>
    );
};

export const LiveMap = React.memo(LiveMapComponent, (prevProps, nextProps) => {
    // We only care about rendering if map data (orders, drivers, etc.) or single mode props changed.
    return isEqual(prevProps.orders, nextProps.orders) &&
           isEqual(prevProps.drivers, nextProps.drivers) &&
           isEqual(prevProps.passengers, nextProps.passengers) &&
           isEqual(prevProps.driver, nextProps.driver) &&
           isEqual(prevProps.pickup, nextProps.pickup) &&
           isEqual(prevProps.destination, nextProps.destination) &&
           prevProps.status === nextProps.status &&
           prevProps.showHeatmap === nextProps.showHeatmap &&
           isEqual(prevProps.heatmapData, nextProps.heatmapData) &&
           prevProps.globalMode === nextProps.globalMode;
});
