import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type TripVehicleType = 'van' | 'bus' | 'coach' | 'team-bus' | 'jet';

export interface Trip {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
  vehicleType: TripVehicleType;
  status: 'departing' | 'traveling' | 'arrived' | 'returning';
  progress: number; // 0-100
  startTime: number;
  estimatedDuration: number; // ms
  arrivalTime: number; // ms
  returnTrip: boolean; // true if this is the return trip
  matchId?: string; // associated match if any
}

interface TravelContextValue {
  trips: Trip[];
  scheduleTrip: (fromBuildingId: string, toBuildingId: string, vehicleType: Trip['vehicleType'], durationMs?: number, matchId?: string) => string;
  completeTrip: (tripId: string) => void;
  startReturnTrip: (tripId: string) => void;
  cancelTrip: (tripId: string) => void;
  getActiveTrips: () => Trip[];
  getTripsBetween: (fromId: string, toId: string) => Trip[];
}

const TravelContext = createContext<TravelContextValue | null>(null);

export function useTravel() {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error('useTravel must be inside TravelProvider');
  return ctx;
}

// Default travel durations by vehicle type (in milliseconds)
const TRAVEL_SPEEDS: Record<string, number> = {
  van: 8000,       // 8 seconds per road segment
  bus: 6500,       // yellow school bus — starter bus tier
  coach: 5500,     // road coach before air travel
  'team-bus': 4500, // custom team-logo bus before planes
  jet: 2000,       // air travel
};

export function TravelProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);

  const scheduleTrip = useCallback((
    fromBuildingId: string,
    toBuildingId: string,
    vehicleType: Trip['vehicleType'],
    durationMs?: number,
    matchId?: string
  ): string => {
    const id = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = durationMs ?? TRAVEL_SPEEDS[vehicleType] ?? 6000;
    const now = Date.now();

    const newTrip: Trip = {
      id,
      fromBuildingId,
      toBuildingId,
      vehicleType,
      status: 'departing',
      progress: 0,
      startTime: now,
      estimatedDuration: duration,
      arrivalTime: now + duration,
      returnTrip: false,
      matchId,
    };

    setTrips((prev) => [...prev, newTrip]);

    // Transition to traveling after a short departure delay
    setTimeout(() => {
      setTrips((prev) => prev.map((t) => t.id === id ? { ...t, status: 'traveling' } : t));
    }, 500);

    // Mark as arrived at estimated time
    setTimeout(() => {
      setTrips((prev) => prev.map((t) => t.id === id ? { ...t, status: 'arrived', progress: 100 } : t));
    }, duration + 500);

    return id;
  }, []);

  const completeTrip = useCallback((tripId: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  }, []);

  const startReturnTrip = useCallback((tripId: string) => {
    setTrips((prev) => {
      const trip = prev.find((t) => t.id === tripId);
      if (!trip) return prev;
      
      // Create a new return trip
      const returnId = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const duration = trip.estimatedDuration;
      
      const returnTrip: Trip = {
        id: returnId,
        fromBuildingId: trip.toBuildingId,
        toBuildingId: trip.fromBuildingId,
        vehicleType: trip.vehicleType,
        status: 'departing',
        progress: 0,
        startTime: now,
        estimatedDuration: duration,
        arrivalTime: now + duration,
        returnTrip: true,
      };

      // Remove original, add return
      const filtered = prev.filter((t) => t.id !== tripId);
      
      // Schedule transitions
      setTimeout(() => {
        setTrips((p) => p.map((t) => t.id === returnId ? { ...t, status: 'traveling' } : t));
      }, 500);
      
      setTimeout(() => {
        setTrips((p) => p.map((t) => t.id === returnId ? { ...t, status: 'arrived', progress: 100 } : t));
      }, duration + 500);
      
      setTimeout(() => {
        setTrips((p) => p.filter((t) => t.id !== returnId));
      }, duration + 1500);
      
      return [...filtered, returnTrip];
    });
  }, []);

  const cancelTrip = useCallback((tripId: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  }, []);

  const getActiveTrips = useCallback(() => {
    return trips.filter((t) => t.status === 'traveling' || t.status === 'departing');
  }, [trips]);

  const getTripsBetween = useCallback((fromId: string, toId: string) => {
    return trips.filter(
      (t) => 
        (t.fromBuildingId === fromId && t.toBuildingId === toId) ||
        (t.fromBuildingId === toId && t.toBuildingId === fromId)
    );
  }, [trips]);

  return (
    <TravelContext.Provider value={{
      trips,
      scheduleTrip,
      completeTrip,
      startReturnTrip,
      cancelTrip,
      getActiveTrips,
      getTripsBetween,
    }}>
      {children}
    </TravelContext.Provider>
  );
}
