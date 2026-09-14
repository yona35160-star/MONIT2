import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export interface LocationPoint {
  lat?: number | string;
  lng?: number | string;
}

export const PredictiveHeatmap: React.FC<{ active: boolean; points?: LocationPoint[] }> = ({ active, points = [] }) => {
  const mappedPoints = useMemo(() => {
    if (!active) return [];
    
    // Filter valid numeric points
    const valid = points
      .filter(p => p.lat !== undefined && p.lng !== undefined)
      .map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lng));

    if (valid.length === 0) {
      // Fallback: If no rides, just show 2 generic blobs in center to keep it alive
      return [
        { x: 40, y: 50, size: 100, delay: 0 },
        { x: 60, y: 40, size: 80, delay: 1 }
      ];
    }

    let minLat = valid[0].lat;
    let maxLat = valid[0].lat;
    let minLng = valid[0].lng;
    let maxLng = valid[0].lng;

    valid.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    const latSpan = maxLat - minLat || 0.01;
    const lngSpan = maxLng - minLng || 0.01;

    return valid.map(p => {
      // Map correctly to 10% - 90% bounds
      const xPercent = ((p.lng - minLng) / lngSpan) * 80 + 10; 
      const yPercent = 100 - (((p.lat - minLat) / latSpan) * 80 + 10); // Inverse for Lat
      
      return {
        x: xPercent,
        y: yPercent,
        size: 60 + Math.random() * 80,
        delay: Math.random() * 2,
      };
    });
  }, [active, points]);

  if (!active || mappedPoints.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
      {mappedPoints.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-gradient-to-r from-orange-500/50 to-red-500/50 blur-xl mix-blend-screen"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            marginLeft: -(p.size / 2),
            marginTop: -(p.size / 2),
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut"
          }}
        />
      ))}
      <div className="absolute top-3 left-3 bg-black/70 text-orange-400 text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md border border-orange-500/40 flex items-center gap-2 pointer-events-auto" dir="rtl">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
        זיהוי אזורי ביקוש מותאם
      </div>
    </div>
  );
};
