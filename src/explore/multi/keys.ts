/* ===== Nhiều người: khóa chữ và số chỗ theo loại phiên (không DOM, không three) =====
   Sảnh (lobby.ts) và giao diện xem (watch.ts) dùng chung một bộ chữ cho ba loại: dù lượn (exMp*), đi dạo (st*), lái xe (dr*).
   `full` (chữ "đã đủ người") chỉ có ở đi dạo và lái xe: dù lượn đầy chỗ thì sảnh chuyển ngay sang chế độ xem. */
import { multiParams } from './params';
import type { Kind } from './protocol';

export interface ExMpKeys { sky: string; go: string; solo: string; offline: string; seats: string; full: string | null; invite: string; inviteGo: string; watching: string; late: string; released: string; lost: string }

const KEYS: Record<Kind, ExMpKeys> = {
  fly: { sky: 'exMpSky', go: 'exMpFly', solo: 'exMpSolo', offline: 'exMpOffline', seats: 'exMpSeats', full: null, invite: 'exMpInvite', inviteGo: 'exMpInviteFly', watching: 'exMpWatching', late: 'exMpLate', released: 'exMpReleased', lost: 'exMpLost' },
  walk: { sky: 'stSky', go: 'stGo', solo: 'stSolo', offline: 'stOffline', seats: 'stSeats', full: 'stFull', invite: 'stInvite', inviteGo: 'stInviteGo', watching: 'stWatch', late: 'stLate', released: 'stReleased', lost: 'stLost' },
  drive: { sky: 'stSky', go: 'drGo', solo: 'drSolo', offline: 'drOffline', seats: 'drSeats', full: 'drFull', invite: 'drInvite', inviteGo: 'drInviteGo', watching: 'drWatch', late: 'drLate', released: 'drReleased', lost: 'drLost' }
};

export const exMpKeys = (kind: Kind): ExMpKeys => KEYS[kind];

/* Số chỗ của nhóm theo loại */
export const exMpSlots = (kind: Kind): number => kind === 'walk' ? multiParams.stroll.slots : kind === 'drive' ? multiParams.drive.slots : multiParams.slots;
