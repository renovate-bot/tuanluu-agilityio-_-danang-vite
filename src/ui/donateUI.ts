import { CONFIG } from '../config';

export interface DonateApi { set(url: string): boolean }

/* ===== Buy me a coffee (MoMo) ===== */
export function setupDonateUI(): DonateApi {
  const link = document.getElementById('donateLink') as HTMLAnchorElement;
  const set = (url: string) => {
    try {
      if (new URL(url).protocol === 'https:') {
        link.href = url; link.hidden = false; return true;
      }
    } catch { /* URL rỗng hoặc sai định dạng thì ẩn liên kết */ }
    link.removeAttribute('href'); link.hidden = true; return false;
  };
  set(CONFIG.ui.donate.url);
  return { set };
}
