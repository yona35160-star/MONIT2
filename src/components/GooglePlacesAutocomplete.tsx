import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';

interface GooglePlacesAutocompleteProps {
    apiKey: string;
    value: string;
    onChange: (value: string) => void;
    onSelect: (place: { address: string, lat: number, lng: number, city?: string }) => void;
    placeholder?: string;
    className?: string;
    label?: string;
    required?: boolean;
    cityContext?: string;
}

declare global {
    interface Window {
        google: any;
        initGooglePlaces?: () => void;
    }
}

export const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
    apiKey,
    value,
    onChange,
    onSelect,
    placeholder,
    className,
    label,
    required,
    cityContext
}) => {
    const [inputValue, setInputValue] = useState(value);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);

    const autocompleteService = useRef<any>(null);
    const placesService = useRef<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync external value changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const loadScript = () => {
            if (window.google?.maps?.places) {
                setScriptLoaded(true);
                initServices();
                return;
            }

            if (document.getElementById('google-maps-script')) {
                // Already loading, just wait
                const interval = setInterval(() => {
                    if (window.google?.maps?.places) {
                        clearInterval(interval);
                        setScriptLoaded(true);
                        initServices();
                    }
                }, 500);
                return;
            }

            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=he`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                setScriptLoaded(true);
                initServices();
            };
            document.body.appendChild(script);
        };

        if (apiKey) loadScript();
    }, [apiKey]);

    const initServices = () => {
        if (!window.google?.maps?.places) return;
        if (!autocompleteService.current) {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();
        }
        if (!placesService.current) {
            // Need a dummy element for PlacesService, or use Geocoder
            placesService.current = new window.google.maps.Geocoder();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        onChange(val);

        if (!val || val.length < 3 || !autocompleteService.current) {
            setPredictions([]);
            setIsOpen(false);
            return;
        }

        const request = {
            input: cityContext ? `${val}, ${cityContext}` : val,
            componentRestrictions: { country: 'il' },
            language: 'he'
        };

        autocompleteService.current.getPlacePredictions(request, (results: any[], status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                setPredictions(results);
                setIsOpen(true);
            } else {
                setPredictions([]);
                setIsOpen(false);
            }
        });
    };

    const handleSelect = (prediction: any) => {
        setInputValue(prediction.description);
        onChange(prediction.description);
        setIsOpen(false);
        setPredictions([]);

        // Get details (Lat/Lng)
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ placeId: prediction.place_id }, (results: any[], status: any) => {
            if (status === 'OK' && results[0]) {
                const result = results[0];
                const location = result.geometry.location;

                // Extract city/locality
                let city = '';
                const cityComp = result.address_components.find((c: any) =>
                    c.types.includes('locality') || c.types.includes('administrative_area_level_1')
                );
                if (cityComp) city = cityComp.long_name;

                onSelect({
                    address: prediction.description,
                    lat: location.lat(),
                    lng: location.lng(),
                    city
                });
            }
        });
    };

    const handleGeoLocate = () => {
        if (!navigator.geolocation) return;
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                if (window.google?.maps?.Geocoder) {
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any[], status: any) => {
                        setGeoLoading(false);
                        if (status === 'OK' && results[0]) {
                            const result = results[0];
                            const addr = result.formatted_address;

                            // Extract city
                            let city = '';
                            const cityComp = result.address_components.find((c: any) =>
                                c.types.includes('locality') || c.types.includes('administrative_area_level_1')
                            );
                            if (cityComp) city = cityComp.long_name;

                            setInputValue(addr);
                            onChange(addr);
                            onSelect({
                                address: addr,
                                lat: latitude,
                                lng: longitude,
                                city
                            });
                        }
                    });
                } else {
                    setGeoLoading(false);
                }
            },
            () => setGeoLoading(false)
        );
    };

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>}
            <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <MapPin size={20} />
                </div>
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInput}
                    placeholder={placeholder || "הזן כתובת..."}
                    required={required}
                    className="w-full pr-10 pl-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none bg-white text-black transition shadow-sm"
                    autoComplete="off"
                />
                {scriptLoaded && (
                    <button
                        type="button"
                        onClick={handleGeoLocate}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-all"
                        title="המיקום שלי"
                    >
                        {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                    </button>
                )}
            </div>

            {isOpen && predictions.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {predictions.map((p) => (
                        <li
                            key={p.place_id}
                            onClick={() => handleSelect(p)}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-right border-b last:border-0 border-gray-100 flex items-center gap-2"
                        >
                            <MapPin size={14} className="text-gray-400 shrink-0" />
                            <span className="text-sm truncate">{p.description}</span>
                        </li>
                    ))}
                    <li className="p-2 text-xs text-center text-gray-300 bg-gray-50">Powered by Google</li>
                </ul>
            )}
        </div>
    );
};
