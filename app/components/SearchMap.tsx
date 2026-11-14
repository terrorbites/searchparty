'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapReport, Member, Search } from '../types';
import './map.css';

type Point = { lat: number; lng: number };
type Coordinates = [number, number];
type MapEvent = { latlng: Point };
type LeafletLayer = {
  addTo: (target: LeafletMap | LeafletLayer) => LeafletLayer;
  bindPopup: (content: HTMLElement, options?: Record<string, unknown>) => LeafletLayer;
  bindTooltip: (content: HTMLElement, options?: Record<string, unknown>) => LeafletLayer;
  on: (name: string, handler: () => void) => LeafletLayer;
  clearLayers: () => void;
};
type LeafletMap = {
  setView: (point: Coordinates, zoom?: number, options?: Record<string, unknown>) => LeafletMap;
  getZoom: () => number;
  on: (name: string, handler: (event: MapEvent) => void) => LeafletMap;
  invalidateSize: (options?: Record<string, unknown>) => void;
  remove: () => void;
};
type Leaflet = {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  layerGroup: () => LeafletLayer;
  marker: (point: Coordinates, options?: Record<string, unknown>) => LeafletLayer;
  circle: (point: Coordinates, options?: Record<string, unknown>) => LeafletLayer;
  divIcon: (options: Record<string, unknown>) => unknown;
};

declare global { interface Window { L?: Leaflet } }

let loadingLeaflet: Promise<Leaflet> | null = null;

function loadLeaflet(): Promise<Leaflet> {
  if (window.L) return Promise.resolve(window.L);
  if (loadingLeaflet) return loadingLeaflet;
  loadingLeaflet = new Promise<Leaflet>((resolve, reject) => {
    if (!document.getElementById('searchparty-leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'searchparty-leaflet-css';
      css.rel = 'stylesheet';
      css.href = '/vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
    }
    const oldScript = document.getElementById('searchparty-leaflet-js');
    oldScript?.remove();
    const script = document.createElement('script');
    script.id = 'searchparty-leaflet-js';
    script.src = '/vendor/leaflet/leaflet.js';
    script.async = true;
    const timeout = window.setTimeout(() => reject(new Error('Map loading timed out.')), 12000);
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.L) resolve(window.L);
      else reject(new Error('Map library unavailable.'));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Map library unavailable.'));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loadingLeaflet = null;
    throw error;
  });
  return loadingLeaflet;
}

function node(tag: string, text: string, className?: string) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function popup(title: string, details: string[]) {
  const box = document.createElement('div');
  box.className = 'sp-map-popup';
  box.appendChild(node('strong', title));
  for (const detail of details) if (detail) box.appendChild(node('p', detail));
  return box;
}

function dateTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(value);
}

function freshness(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  return minutes === 0 ? 'Updated just now' : `Last updated ${minutes} min ago`;
}

function validPoint(point: Point) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

export interface SearchMapProps {
  search?: Search;
  lat?: number;
  lng?: number;
  petName?: string;
  members?: Member[];
  reports?: MapReport[];
  selected?: Point | null;
  onSelect?: (point: Point) => void;
  interactive?: boolean;
  className?: string;
  height?: number | string;
  showLastSeen?: boolean;
}

export default function SearchMap({ search, lat, lng, petName, members = [], reports = [], selected, onSelect, interactive = true, className = '', height, showLastSeen = true }: SearchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayer | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const selectRef = useRef(onSelect);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [tileError, setTileError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const centreLat = search?.lat ?? lat ?? 54.2;
  const centreLng = search?.lng ?? lng ?? -2.5;
  const hasCentre = !!search || (lat !== undefined && lng !== undefined);
  selectRef.current = onSelect;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let delayedResize: ReturnType<typeof setTimeout> | undefined;
    setStatus('loading');
    loadLeaflet().then((L) => {
      if (disposed || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: interactive,
        attributionControl: true,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        scrollWheelZoom: false,
        boxZoom: interactive,
        keyboard: interactive,
        tap: interactive,
      }).setView([centreLat, centreLng], hasCentre ? 15 : 6);
      mapRef.current = map;
      let failedTiles = 0;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 3,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        detectRetina: false,
        keepBuffer: 1,
      }).on('tileerror', () => {
        if (!disposed && ++failedTiles >= 3) setTileError(true);
      }).on('tileload', () => {
        if (!disposed) {
          failedTiles = 0;
          setTileError(false);
        }
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on('click', (event) => {
        if (interactive && selectRef.current) selectRef.current({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) });
      });
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(containerRef.current);
      delayedResize = setTimeout(() => map.invalidateSize({ pan: false }), 150);
      setStatus('ready');
    }).catch(() => { if (!disposed) setStatus('failed'); });
    return () => {
      disposed = true;
      observer?.disconnect();
      clearTimeout(delayedResize);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // Coordinate updates move the existing map in the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, interactive]);

  useEffect(() => {
    if (status === 'ready' && validPoint({ lat: centreLat, lng: centreLng })) {
      mapRef.current?.setView([centreLat, centreLng], hasCentre ? 15 : 6, { animate: false });
    }
  }, [centreLat, centreLng, hasCentre, status]);

  useEffect(() => {
    if (!selected || !validPoint(selected) || !mapRef.current || hasCentre) return;
    mapRef.current.setView([selected.lat, selected.lng], Math.max(14, mapRef.current.getZoom()), { animate: true });
  }, [selected?.lat, selected?.lng, hasCentre, status]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!L || !layer || status !== 'ready') return;
    layer.clearLayers();

    if (showLastSeen && hasCentre && validPoint({ lat: centreLat, lng: centreLng })) {
      const pin = node('div', '', 'sp-map-pet-pin');
      pin.innerHTML = '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="currentColor"><ellipse cx="6.5" cy="7.5" rx="2.2" ry="3" transform="rotate(-25 6.5 7.5)"/><ellipse cx="17.5" cy="7.5" rx="2.2" ry="3" transform="rotate(25 17.5 7.5)"/><ellipse cx="10.2" cy="4.8" rx="2" ry="2.8"/><ellipse cx="14.3" cy="4.8" rx="2" ry="2.8"/><path d="M5.5 17.7c0-2.1 2-3.2 3.1-5.2 1.5-2.8 5.4-2.8 6.9 0 1 2 3 3.1 3 5.2 0 2.1-1.7 3.4-3.6 2.8-2-.7-3.7-.7-5.7 0-2 .6-3.7-.7-3.7-2.8Z"/></svg>';
      const title = `${search?.petName ?? petName ?? 'Pet'} · last seen`;
      L.marker([centreLat, centreLng], {
        icon: L.divIcon({ html: pin, className: 'sp-marker', iconSize: [44, 50], iconAnchor: [22, 46], popupAnchor: [0, -40] }),
        title,
        zIndexOffset: 500,
      }).bindPopup(popup(title, [search?.locationLabel ?? '', search ? dateTime(search.lastSeenAt) : 'Last-seen location'])).addTo(layer);
    }

    reports.filter(validPoint).forEach((report) => {
      const isSighting = report.kind === 'sighting';
      const isSearched = report.kind === 'searched';
      const colour = isSighting ? '#c56d27' : isSearched ? '#42695a' : '#62849b';
      const title = isSighting ? report.confirmed ? 'Confirmed sighting' : 'Reported sighting' : isSearched ? 'Area searched' : 'Checking this area';
      const info = popup(title, [report.note, `Reported by ${report.authorName}`, dateTime(report.occurredAt), isSearched ? 'This area may need checking again.' : isSighting && !report.confirmed ? 'Not yet confirmed by the organiser.' : '']);
      if (!isSighting) {
        L.circle([report.lat, report.lng], { radius: Number.isFinite(report.radius) && report.radius > 0 ? report.radius : 100, color: colour, fillColor: colour, fillOpacity: 0.12, weight: 2, dashArray: isSearched ? '5 5' : '3 7' }).bindPopup(info).addTo(layer);
      }
      const icon = node('span', isSighting ? '!' : isSearched ? '✓' : '…', `sp-map-report-pin ${isSighting ? 'sighting' : isSearched ? 'searched' : 'searching'}`);
      L.marker([report.lat, report.lng], { icon: L.divIcon({ html: icon, className: 'sp-marker', iconSize: [28, 28], iconAnchor: [14, 14] }), title }).bindPopup(info).addTo(layer);
    });

    members.filter((member) => member.status === 'approved' && member.lat !== null && member.lng !== null && member.locationAt && now - member.locationAt < 30 * 60000).forEach((member) => {
      const point = { lat: member.lat!, lng: member.lng! };
      if (!validPoint(point)) return;
      const stale = now - member.locationAt! > 2 * 60000;
      const pin = node('div', '', `sp-map-person-pin${stale ? ' stale' : ''}`);
      if (member.avatar?.startsWith('data:image/jpeg;base64,')) {
        const img = document.createElement('img');
        img.src = member.avatar;
        img.alt = '';
        pin.appendChild(img);
      } else {
        pin.appendChild(node('span', member.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()));
      }
      pin.appendChild(node('i', '', 'sp-map-person-dot'));
      const label = `${member.name} · ${freshness(member.locationAt!, now)}`;
      if (member.accuracy !== null && member.accuracy > 0) {
        L.circle([point.lat, point.lng], { radius: Math.min(member.accuracy, 5000), color: '#557962', opacity: 0.2, weight: 1, fillOpacity: 0.035, interactive: false }).addTo(layer);
      }
      L.marker([point.lat, point.lng], { icon: L.divIcon({ html: pin, className: 'sp-marker', iconSize: [36, 36], iconAnchor: [18, 18] }), title: label, zIndexOffset: 300 })
        .bindPopup(popup(member.name, [member.role.charAt(0).toUpperCase() + member.role.slice(1), freshness(member.locationAt!, now), member.accuracy !== null ? `Approximate accuracy: ${Math.round(member.accuracy)} metres` : '', stale ? 'Location may have changed since this update.' : 'Last position shared from this phone.']))
        .bindTooltip(node('span', member.name), { direction: 'top', offset: [0, -16] }).addTo(layer);
    });

    if (selected && validPoint(selected)) {
      const selection = node('span', '+', 'sp-map-selected-pin');
      L.marker([selected.lat, selected.lng], { icon: L.divIcon({ html: selection, className: 'sp-marker', iconSize: [32, 32], iconAnchor: [16, 16] }), title: 'Selected location', zIndexOffset: 1000 }).addTo(layer);
    }
  }, [members, reports, selected, centreLat, centreLng, hasCentre, petName, search, showLastSeen, now, status]);

  return (
    <div className={`sp-map ${onSelect ? 'selectable' : ''} ${className}`} style={height ? { height, minHeight: height } : undefined}>
      <div ref={containerRef} className="sp-map-canvas" role="region" aria-label={onSelect ? 'Choose a location on the map. You can also enter coordinates below.' : 'Search map showing last seen location, search reports and shared helper locations.'} />
      {status === 'loading' && <div className="sp-map-state" role="status"><span className="sp-map-spinner" />Loading the search map…</div>}
      {status === 'failed' && <div className="sp-map-state" role="status"><strong>The map couldn’t load</strong><span>You can still read updates and enter coordinates manually.</span><button type="button" onClick={() => setAttempt((value) => value + 1)}>Try the map again</button></div>}
      {status === 'ready' && <>
        {onSelect && <div className="sp-map-hint">{selected ? 'Location selected · tap to change' : 'Tap the map to choose a location'}</div>}
        {tileError && <div className="sp-map-tile-error" role="status">Map tiles are unavailable. Check your connection; pins may still be visible.</div>}
        {hasCentre && interactive && <button type="button" className="sp-map-recentre" title="Return to last-seen location" aria-label="Return to last-seen location" onClick={() => mapRef.current?.setView([centreLat, centreLng], 15, { animate: true })}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></button>}
        {!onSelect && <div className="sp-map-legend"><span><i className="last-seen"/>Last seen</span><span><i className="sighting"/>Sighting</span><span><i className="searched"/>Searched</span><span><i className="helper"/>Helper</span></div>}
        {selected && <output className="sp-map-coordinates">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</output>}
      </>}
    </div>
  );
}
