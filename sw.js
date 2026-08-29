// sw.js — يخزّن نسخة من تطبيق عيادات ريفانا ومكتباته الخارجية محليًا
// عشان صفحة العيادة تفتح حتى لو صار Refresh والنت مقطوع

const CACHE_NAME = 'rivana-clinic-cache-v3'; // ارفع الرقم (v2, v3...) بكل مرة تنشر تحديث مهم على الملفات المخزنة أدناه

const PRECACHE_URLS = [
  './',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;600;700;800&family=Tajawal:wght@400;500;700;900&display=swap'
];

// عند أول تثبيت: نخزن الصفحة والمكتبات
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('تعذر تخزين:', url, err))
        )
      )
    )
  );
});

// نحذف أي نسخ تخزين قديمة عند التفعيل
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isSupabaseRequest(url) {
  return url.hostname.includes('supabase.co');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // مهم جدًا: لا نتدخل إطلاقًا بطلبات Supabase (بيانات المرضى/المواعيد/التحاليل/تسجيل الدخول)
  // هذي لازم تروح دايمًا مباشرة للسيرفر ومباشرة تفشل بوضوح لو النت مقطوع،
  // حتى لا يُعرض على الموظف بيانات قديمة مخزّنة مؤقتًا وكأنها محدّثة الآن (خطر بمعلومات طبية حساسة)
  if (isSupabaseRequest(url) || req.method !== 'GET') {
    return;
  }

  // فتح الصفحة نفسها (Navigation / Refresh)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./')))
    );
    return;
  }

  // بقية الملفات الثابتة (خطوط، مكتبات JS): نعرض من التخزين المؤقت فورًا إن وجدت، ونحدّثها بالخلفية
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
