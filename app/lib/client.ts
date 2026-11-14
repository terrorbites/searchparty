import type { Room } from '../types';

export async function api<T = { ok: boolean }>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', cache: 'no-store', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
  let data: any;
  try { data = await response.json(); } catch { throw new Error('The service could not respond. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
export const clockTime = (time: number) => new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fullTime = (time: number) => new Date(time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function ago(time: number | null) { if (!time) return 'Not sharing'; const mins = Math.max(0, Math.floor((Date.now() - time) / 60000)); return mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`; }
export function localDateTime(time = Date.now()) { const date = new Date(time); return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function isStaff(room: Room) { return room.me?.status === 'approved' && room.me.role !== 'helper'; }

export async function photoData(file: File, avatar = false): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Please choose a photo smaller than 12 MB.');
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('That image could not be opened.')); image.src = url; });
    const canvas = document.createElement('canvas');
    const max = avatar ? 240 : 900;
    const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare your photo.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/jpeg', 0.8);
    for (let quality = 0.65; result.length > (avatar ? 40000 : 160000) && quality >= 0.2; quality -= 0.15) result = canvas.toDataURL('image/jpeg', quality);
    if (result.length > (avatar ? 40000 : 160000)) throw new Error('Please choose a simpler or smaller photo.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}
