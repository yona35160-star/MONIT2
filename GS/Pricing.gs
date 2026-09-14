/**
 * Pricing Service
 * Calculates ride prices with Google Maps/GraphHopper integration
 * 
 * Dependencies: Utils.gs, Config.gs (Schema)
 */

const PricingService = {
  searchAddress: (payload, settings) => {
    const query = String(payload.q || '').trim();
    if (query.length < 2) return Utils.json({ ok: true, data: [] });
    
    const sanitized = query.replace(/[<>\"']/g, '').substring(0, 200);
    const cache = CacheService.getScriptCache();
    // Cache Key with version to bypass stale empty results
    const cacheKey = `search_v3_${Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sanitized))}`;
    
    const cached = cache.get(cacheKey);
    if (cached && !payload.force) return Utils.json({ ok: true, data: JSON.parse(cached), cached: true });

    Utils.log("DEBUG", "Live Address Search", { query: sanitized });

    try {
      // 1. Try GraphHopper Geocode (if key exists)
      const ghKey = settings['GH_API_KEY'];
      const isPlaceholder = !ghKey || ghKey === '[HIDDEN]' || ghKey === '[SECURELY_STORED_IN_PROPS]';
      if (!isPlaceholder && ghKey.length > 5) {
          try {
              const url = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(sanitized)}&locale=he&limit=5&key=${encodeURIComponent(ghKey)}`;
              const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
              if (resp.getResponseCode() === 200) {
                  const json = JSON.parse(resp.getContentText());
                  if (json.hits && json.hits.length > 0) {
                      const mapped = json.hits.map(h => ({
                          display_name: h.name + (h.city ? `, ${h.city}` : '') + (h.street ? ` ${h.street}` : ''),
                          name: h.name,
                          full_address: h.name + (h.city ? `, ${h.city}` : ''),
                          lat: h.point.lat,
                          lng: h.point.lng
                      }));
                      cache.put(cacheKey, JSON.stringify(mapped), 21600 * 4);
                      return Utils.json({ ok: true, data: mapped, provider: "GraphHopper" });
                  }
              } else {
                  Utils.log("WARN", "GH Search Error", { code: resp.getResponseCode(), body: resp.getContentText().substring(0, 100) });
              }
          } catch (e) { Utils.log("ERROR", "GH Search Exception", e.toString()); }
      }

      // 2. Try Google Places Autocomplete (if key exists)
      const googleKey = settings['GOOGLE_MAPS_API_KEY'];
      if (googleKey && googleKey.length > 5 && !googleKey.includes('...')) {
           try {
               const encodedQuery = encodeURIComponent(query);
               const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}&key=${googleKey}&language=he&components=country:il`;
               
               const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
               if (resp.getResponseCode() === 200) {
                    const json = JSON.parse(resp.getContentText());
                    if (json.predictions && json.predictions.length > 0) {
                        const mapped = json.predictions.map(p => ({
                            display_name: p.description,
                            name: p.structured_formatting.main_text,
                            full_address: p.description,
                            place_id: p.place_id
                        }));
                        
                        cache.put(cacheKey, JSON.stringify(mapped), 21600 * 4);
                        return Utils.json({ ok: true, data: mapped, provider: "GooglePlaces" });
                    } else if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
                        Utils.log("WARN", "Google Places Search Status", { status: json.status, msg: json.error_message });
                    }
               }
           } catch (e) { Utils.log("ERROR", "Google Places Search Exception", e.toString()); }
      }

      // 3. Last Resort: Built-in Geocoder
      Utils.log("DEBUG", "Falling back to Built-in Geocoder", { query: sanitized });
      const results = Maps.newGeocoder().setLanguage('iw').geocode(sanitized);
      if (results.status === 'OK') {
        const mapped = results.results.slice(0, 5).map(r => ({
          display_name: r.formatted_address,
          name: r.formatted_address.split(',')[0],
          full_address: r.formatted_address,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng
        }));
        cache.put(cacheKey, JSON.stringify(mapped), 21600 * 4); 
        return Utils.json({ ok: true, data: mapped, provider: "GoogleGeocoder" });
      }
      
      Utils.log("WARN", "No address results found", { query: sanitized, status: results.status });
      return Utils.json({ ok: true, data: [] });
    } catch (e) {
      Utils.log("ERROR", "searchAddress Critical Failure", e.toString());
      return Utils.error('שגיאה בחיפוש כתובת: ' + e.toString());
    }
  },


  calculate: (payload, settings) => {
    let { 
        pickupAddress, pickupExactAddress, 
        destinationAddress, destinationExactAddress, 
        pickupLat, pickupLng, destLat, destLng 
    } = payload;
    
    // COMPREHENSIVE FIX: Construct Full Address for Geocoding
    // We treat 'pickupAddress' as the City/Region (from locations.ts)
    // We treat 'pickupExactAddress' as the Street/Number
    
    const fullPickup = [pickupAddress, pickupExactAddress].filter(x => x && x.trim()).join(', ');
    const fullDest = [destinationAddress, destinationExactAddress].filter(x => x && x.trim()).join(', ');
    
    // Use full addresses for Geocoding to get best accuracy
    
    const ghKey = settings['GH_API_KEY'];
    
    let distanceKm = 5; // Safe fallback distance when routing providers fail
    let durationStr = "לא ידוע";
    let start = null, end = null;
    let geocodeMethod = "None";
    
    try {
        const geocodeFallback = (addr) => {
             if (!addr) return null;
             let result = null;

              // 1. Try GraphHopper Geocode API (PRIORITY - usually more accurate for our routing)
              const isGhPlaceholder = !ghKey || ghKey === '[HIDDEN]' || ghKey === '[SECURELY_STORED_IN_PROPS]';
              if (!isGhPlaceholder && ghKey.length > 5) {
                 try {
                     const url = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(addr)}&locale=he&limit=1&key=${encodeURIComponent(ghKey)}`;
                     const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
                     if (resp.getResponseCode() === 200) {
                         const json = JSON.parse(resp.getContentText());
                         if (json.hits && json.hits.length > 0) {
                             const hit = json.hits[0];
                             geocodeMethod = "GraphHopper";
                             return { lat: hit.point.lat, lng: hit.point.lng };
                         }
                     } else {
                         Utils.log("WARN", "GH Geocode API Error", { address: addr, code: resp.getResponseCode() });
                     }
                 } catch (e) { Utils.log("WARN", "GH Geocode Exception", e.toString()); }
             }

             // 2. Try Google Maps (Built-in)
             try {
                 const geo = Maps.newGeocoder().setLanguage('iw').geocode(addr);
                 if (geo.status === 'OK') {
                     geocodeMethod = "Google";
                     return geo.results[0].geometry.location;
                 }
                 Utils.log("WARN", "Google Geocode Status", { address: addr, status: geo.status });
             } catch (e) { Utils.log("WARN", "Google Geocode Exception", e.toString()); }
             
             return null;
        };

        const pickupFull = [pickupAddress, pickupExactAddress].filter(x => x && x.trim()).join(', ');
        const destFull = [destinationAddress, destinationExactAddress].filter(x => x && x.trim()).join(', ');

        Utils.log("INFO", "Pricing: Geocoding Step", { pickup: pickupFull, dest: destFull, hasGhKey: !!ghKey });
        
        if (pickupLat && pickupLng) {
            start = { lat: pickupLat, lng: pickupLng };
            geocodeMethod = "Coordinates (Payload)";
        } else if (pickupFull) {
            start = geocodeFallback(pickupFull) || geocodeFallback(pickupAddress);
        }
        
        if (destLat && destLng) {
            end = { lat: destLat, lng: destLng };
        } else if (destFull) {
            end = geocodeFallback(destFull) || geocodeFallback(destinationAddress);
        }

        if (!start || !end) {
            Utils.log("ERROR", "Geocoding Failed completely", { 
                startFound: !!start, 
                endFound: !!end, 
                pickup: pickupFull, 
                dest: destFull 
            });
            return Utils.error("לא הצלחנו לאתר את אחת הכתובות. נא וודא שהכתובות הוזנו נכון.");
        }
    } catch (e) {
        Utils.log("ERROR", "Geocoding failure in calculation", e.toString());
        return Utils.error("שגיאה בתהליך איתור המיקום.");
    }
    
    let routingMethod = "None";
    if (start && end) {
      let graphhopperSucceeded = false;
      
       // [NEW Priority] GraphHopper API
       try {
         const isGhPlaceholder = !ghKey || ghKey === '[HIDDEN]' || ghKey === '[SECURELY_STORED_IN_PROPS]';
         if (!isGhPlaceholder && ghKey.trim() !== '') {
            const url = `https://graphhopper.com/api/1/route?point=${start.lat},${start.lng}&point=${end.lat},${end.lng}&profile=car&locale=he&calc_points=false&key=${encodeURIComponent(ghKey)}`;
            const resp = Utils.fetchWithRetry(url, { muteHttpExceptions: true }, 2);
            
            const statusCode = resp.getResponseCode();
            if (statusCode === 200) {
                const json = JSON.parse(resp.getContentText());
                if (json.paths && json.paths[0]) {
                  distanceKm = json.paths[0].distance / 1000;
                  durationStr = `${Math.round(json.paths[0].time / 60000)} דקות`;
                  graphhopperSucceeded = true;
                  routingMethod = "GraphHopper";
                }
            } else {
                Utils.log("WARN", "GraphHopper API returned non-200", { code: statusCode, body: resp.getContentText() });
            }
        } else {
            Utils.log("INFO", "GraphHopper Key Missing - Skipping GH Routing");
        }
      } catch (e) {
        Utils.log("WARN", "GraphHopper API Failed", e.toString());
      }

      // [NEW Fallback 1] Google Maps Directions (Native GAS Service)
      if (!graphhopperSucceeded) {
          try {
              const directions = Maps.newDirectionFinder()
                  .setOrigin(start.lat, start.lng)
                  .setDestination(end.lat, end.lng)
                  .setMode(Maps.DirectionFinder.Mode.DRIVING)
                  .setLanguage('iw')
                  .getDirections();

              if (directions && directions.routes && directions.routes.length > 0) {
                  const leg = directions.routes[0].legs[0];
                  distanceKm = leg.distance.value / 1000;
                  durationStr = leg.duration.text;
                  graphhopperSucceeded = true;
                  routingMethod = "GoogleMaps";
              } else {
                  Utils.log("WARN", "Google Directions returned no routes", directions ? directions.status : "null");
              }
          } catch (e) {
              Utils.log("WARN", "Google Maps Directions Failed", e.toString());
          }
      }

      // [NEW Fallback 2] OSRM (Free & Robust)
      if (!graphhopperSucceeded) {
          try {
              const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`;
              const osrmResp = Utils.fetchWithRetry(osrmUrl, { muteHttpExceptions: true }, 2);
              if (osrmResp.getResponseCode() === 200) {
                  const osrmJson = JSON.parse(osrmResp.getContentText());
                  if (osrmJson.routes && osrmJson.routes[0]) {
                      distanceKm = osrmJson.routes[0].distance / 1000;
                      durationStr = `~${Math.round(osrmJson.routes[0].duration / 60)} דקות`;
                      graphhopperSucceeded = true;
                      routingMethod = "OSRM";
                  }
              }
          } catch (e) {
              Utils.log("WARN", "OSRM API Failed", e.toString());
          }
      }

      // Final Resort: Haversine
      if (!graphhopperSucceeded || durationStr === "לא ידוע") {
        const straightLine = Utils.calculateDistance(start.lat, start.lng, end.lat, end.lng);
        if (straightLine !== Infinity && straightLine !== 0) {
            distanceKm = straightLine * 1.3;
            const avgSpeed = 40; 
            durationStr = `~${Math.round((distanceKm / avgSpeed) * 60)} דקות (אווירי)`;
            routingMethod = "Haversine";
        }
      }
    }


    const basePrice = (settings['BASE_PRICE'] !== undefined) ? parseFloat(settings['BASE_PRICE']) : 15;
    const perKm = (settings['PRICE_PER_KM'] !== undefined) ? parseFloat(settings['PRICE_PER_KM']) : 4;
    
    // [SANITY CHECK] Detect astronomical settings (e.g. 40 instead of 4)
    if (perKm > 20) {
        Utils.log("ERROR", "SUSPECTED TYPO IN PRICE_PER_KM", { value: perKm, msg: "Distance calculation will be extremely high!" });
    }
    if (basePrice > 200) {
        Utils.log("ERROR", "SUSPECTED TYPO IN BASE_PRICE", { value: basePrice });
    }

    let price = basePrice + (distanceKm * perKm);

    // PEAK HOUR CALCULATION
    // Use pickup datetime if available, otherwise now
    let calcTime = new Date();
    if (payload.pickupDate && payload.pickupTime) {
       const pickupDateArr = (payload.pickupDate || "").split(/[/-]/);
       const pickupTimeArr = (payload.pickupTime || "").split(':');
       if (pickupDateArr.length === 3 && pickupTimeArr.length >= 2) {
          const [p1, p2, p3] = pickupDateArr.map(Number);
          const [h, m] = pickupTimeArr.map(Number);
          // Assuming YYYY-MM-DD or DD-MM-YYYY detection based on >1900
          if (p1 > 1900) calcTime = new Date(p1, p2 - 1, p3, h, m);
          else calcTime = new Date(p3, p2 - 1, p1, h, m);
       }
    }
    
    // DEBUG LOG
    Utils.log("DEBUG", "PriceCalc Details", { 
        dist: distanceKm, 
        base: basePrice, 
        perKm, 
        rawPrice: price, // Final calculated price before peak
        isGh: !!(settings['GH_API_KEY']),
        geocodeMethod,
        routingMethod,
        startCoords: start ? "FOUND" : "MISSING",
        endCoords: end ? "FOUND" : "MISSING",
        durationStr,
        inputPickup: fullPickup,
        inputDest: fullDest
    });
    
    const timeStr = Utilities.formatDate(calcTime, settings['TIMEZONE'] || "Asia/Jerusalem", "HH:mm");
    
    const isPeak = (s, e) => {
        if (!s || !e) return false;
        return (s <= e) ? (timeStr >= s && timeStr <= e) : (timeStr >= s || timeStr <= e);
    };

    let multiplier = 1.0;
    if (isPeak(settings['PEAK_MORNING_START'], settings['PEAK_MORNING_END'])) multiplier = (settings['PEAK_MORNING_MULTIPLIER'] !== undefined) ? parseFloat(settings['PEAK_MORNING_MULTIPLIER']) : 1.0;
    else if (isPeak(settings['PEAK_EVENING_START'], settings['PEAK_EVENING_END'])) multiplier = (settings['PEAK_EVENING_MULTIPLIER'] !== undefined) ? parseFloat(settings['PEAK_EVENING_MULTIPLIER']) : 1.0;
    else if (isPeak(settings['PEAK_NIGHT_START'], settings['PEAK_NIGHT_END'])) multiplier = (settings['PEAK_NIGHT_MULTIPLIER'] !== undefined) ? parseFloat(settings['PEAK_NIGHT_MULTIPLIER']) : 1.0;

    return Utils.json({
      ok: true,
      data: {
        price: Math.round(price * multiplier),
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        duration: durationStr,
        multiplier
      }
    });
  }
};
