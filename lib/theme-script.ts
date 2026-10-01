export const THEME_STORAGE_KEY = 'farmTheme';

/**
 * Runs in <head> before the first paint, so a dark-mode user never sees a
 * white flash. Uses the saved choice, else the operating system's setting.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');if(m!=='light'&&m!=='dark'){m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var r=document.documentElement;if(m==='dark'){r.classList.add('dark')}r.style.colorScheme=m}catch(e){}})();`;
