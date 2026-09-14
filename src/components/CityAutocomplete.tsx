
import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { ISRAEL_CITIES, type City } from '../locations';
import { searchAddress } from '../api/passengerApi';

interface CityAutocompleteProps {
  label?: string; // Made optional
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  searchType?: 'city' | 'address';
  cityContext?: string;
  className?: string;
  onSelect?: (result: any) => void;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  label,
  value,
  onChange,
  required,
  placeholder,
  searchType = 'city',
  cityContext,
  className,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [backendResults, setBackendResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number, lon: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleGeoLocate = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lon: longitude });
        setGeoLoading(false);
        if (inputRef.current?.value) {
          searchBackendProxy(inputRef.current.value, latitude, longitude);
        }
      },
      () => {
        setGeoLoading(false);
      }
    );
  };

  const searchBackendProxy = async (q: string, lat?: number, lon?: number) => {
    if (!q || q.length < 2) {
      setBackendResults([]);
      return;
    }
    try {
      setLoading(true);
      const fullQuery = cityContext ? `${q}, ${cityContext}` : q;
      const res = await searchAddress(fullQuery, lat, lon);

      if (res.ok && res.data) {
        setBackendResults(res.data);
      } else {
        setBackendResults([]);
      }
    } catch (e) {
      setBackendResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onChange(query);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchType === 'city') {
      if (!query) {
        setFilteredCities([]);
        setIsOpen(false);
        return;
      }
      const lowerCaseQuery = query.toLowerCase();
      const results = ISRAEL_CITIES.filter(city =>
        city.hebrew.includes(query) || city.english.toLowerCase().includes(lowerCaseQuery)
      ).slice(0, 5);
      setFilteredCities(results);
      setBackendResults([]);
    } else { // address search
      // Address search: NO local city filtering (redundant and confusing for street fields)
      setFilteredCities([]);

      debounceRef.current = window.setTimeout(() => {
        searchBackendProxy(query, userCoords?.lat, userCoords?.lon);
      }, 300);
    }
  };

  const handleSelect = (result: any) => {
    const selectedValue = typeof result === 'string' ? result : (result.full_address || result.name || result.hebrew);
    onChange(selectedValue);
    if (onSelect) {
      // If it's a predefined city from locations.ts, it has .lat/.lng
      // If it's a backend result, it has .lat/.lng (or .point.lat etc mapped in api)
      onSelect(result);
    }
    setIsOpen(false);
    setFilteredCities([]);
    setBackendResults([]);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10 pointer-events-none">
          {searchType === 'city' ? <MapPin size={20} /> : <MapPin size={20} />}
        </div>

        <input
          ref={inputRef}
          type="text"
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
          className="w-full pr-10 pl-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none bg-white text-black transition shadow-sm"
        />

        {searchType === 'address' && (
          <button
            type="button"
            onClick={handleGeoLocate}
            title="אתר אותי"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-all"
          >
            {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
          </button>
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
          {(filteredCities.length > 0 || backendResults.length > 0) ? (
            <>
              {filteredCities.map(city => (
                <li key={city.english} onClick={() => handleSelect({ name: city.hebrew, isCity: true })} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-right">
                  {city.hebrew}
                </li>
              ))}
              {backendResults.map((result, index) => (
                <li key={index} onClick={() => handleSelect({ ...result, name: result.full_address || result.name })} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-right">
                  {result.full_address || result.name}
                </li>
              ))}
            </>
          ) : (
            (loading || geoLoading) ? <li className="px-4 py-2 text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> טוען...</li> :
              (value.length > 1 && <li className="px-4 py-2 text-gray-500">אין תוצאות</li>)
          )}
        </ul>
      )}
    </div>
  );
};
