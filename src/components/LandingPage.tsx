import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ChefHat, Check, ChevronRight, ClipboardList, CreditCard, FileArchive, FileSpreadsheet, HardDrive, Languages, MonitorSmartphone, PlayCircle, Settings2, ShieldCheck, Smartphone, Store, Volume2 } from 'lucide-react';
import { APP_ICON_SRC } from '../brand';
import { IS_PUBLIC_DEMO } from '../demo-mode';
import { useStore } from '../store';
import { tr } from '../i18n';
import type { Language } from '../types';
import PublicDemoReset from './PublicDemoReset';
import './LandingPage.css';

interface Props { onStart: () => void; onAdmin: () => void; onKitchen: () => void; }
const asset = (name: string) => import.meta.env.BASE_URL + 'assets/' + name;
const media = (name: string) => import.meta.env.BASE_URL + 'media/' + name;
const APK_URL = import.meta.env.BASE_URL + 'downloads/CJ_POS_0.1.4_Test.apk';
type VideoState = { language: Language; status: 'loading' | 'ready' | 'error'; duration: number | null };

// A food-business landing page, using the existing React/CSS and Lucide stack.
// Light cream is a deliberate brand choice. Real screenshots remain unaltered.
export default function LandingPage({ onStart, onAdmin, onKitchen }: Props) {
  const { language, changeLanguage } = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [activeStep, setActiveStep] = useState(0);
  const [videoState, setVideoState] = useState<VideoState>({ language, status: 'loading', duration: null });
  const [playbackNotice, setPlaybackNotice] = useState<Language | null>(null);
  const [failedScreenshot, setFailedScreenshot] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const selectedLanguageRef = useRef(language);
  selectedLanguageRef.current = language;
  const hasNarration = language !== 'ms';
  const currentVideoState = videoState.language === language ? videoState : { language, status: 'loading' as const, duration: null };
  const narrationLabel = language === 'en' ? 'English narration' : language === 'zh' ? '华语配音' : 'Panduan bersari kata Bahasa Melayu · suara belum tersedia';
  const playButtonLabel = { en: 'Play from start with sound', zh: '从头有声播放', ms: 'Main dari awal' }[language];
  const videoDuration = currentVideoState.duration && Number.isFinite(currentVideoState.duration)
    ? ` · ${Math.floor(currentVideoState.duration / 60)}:${String(Math.floor(currentVideoState.duration % 60)).padStart(2, '0')}` : '';
  const mediaStatusLabel = currentVideoState.status === 'error'
    ? t('English guide unavailable', '华语影片暂不可用', 'Panduan Bahasa Melayu tidak tersedia')
    : currentVideoState.status === 'loading'
      ? t('Loading English guide…', '正在加载华语影片…', 'Memuatkan panduan Bahasa Melayu…')
      : narrationLabel + videoDuration;
  useEffect(() => {
    setVideoState({ language, status: 'loading', duration: null });
    setPlaybackNotice(null);
    const video = videoRef.current;
    return () => { video?.pause(); };
  }, [language]);
  const setVideoResult = (videoLanguage: Language, status: VideoState['status'], duration: number | null = null) => {
    if (selectedLanguageRef.current !== videoLanguage) return;
    setVideoState({ language: videoLanguage, status, duration });
  };
  const selectLanguage = (nextLanguage: Language) => {
    videoRef.current?.pause();
    setVideoState({ language: nextLanguage, status: 'loading', duration: null });
    setPlaybackNotice(null);
    void changeLanguage(nextLanguage);
  };
  const playGuide = async () => {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackNotice(null);
    video.muted = !hasNarration;
    video.volume = hasNarration ? 1 : 0;
    try { video.currentTime = 0; } catch { /* Metadata may not be loaded yet. */ }
    try {
      await video.play();
    } catch {
      if (videoRef.current === video && !video.error) setPlaybackNotice(language);
    }
  };
  const steps = [
    {
      title: t('Register', '收银点单', 'Daftar pesanan'),
      short: t('Build an order', '选商品、开订单', 'Bina pesanan'),
      icon: Store, image: 'cj-pos-register-desktop',
      heading: t('Take the order while you serve.', '边招呼客人，边把订单记好。', 'Ambil pesanan sambil melayan.'),
      body: t('Choose items, adjust quantities and options, then choose dine-in or takeaway. Collect payment now or send the order to the kitchen and collect later.', '点选商品，调整数量和选项，再选择堂食或外带。可以现在收款，也可以先送厨房、稍后收款。', 'Pilih item, kuantiti dan pilihan, kemudian makan di sini atau bungkus. Terima bayaran sekarang atau hantar ke dapur dan kutip kemudian.'),
      detail: t('Tax and takeaway fees are included in the amount shown before confirming.', '确认前显示的总额，已包含你设定的税费与打包费。', 'Jumlah sebelum pengesahan termasuk cukai dan caj bungkus yang ditetapkan.'),
    },
    {
      title: t('Edit', '编辑菜单', 'Sunting menu'),
      short: t('Make it your shop', '换成你自己的店', 'Jadikan kedai anda'),
      icon: Settings2, image: 'cj-pos-edit',
      heading: t('Your shop name. Your own menu.', '店名、菜品，换成你自己的。', 'Nama kedai dan menu anda sendiri.'),
      body: t('Edit the shop name, prices, photos, serving sizes and add-ons. The same menu works for kuih, drinks, noodles and other food.', '修改店名、价格和照片，设置大小份、口味或加料。卖糕点、饮料、面食，都可以换成自己的菜单。', 'Ubah nama kedai, harga, foto, saiz hidangan dan tambahan. Gunakan menu yang sama untuk kuih, minuman, mi atau makanan lain.'),
      detail: t('Use English, Chinese or Malay names. Missing translations fall back to a name you entered.', '名称支持英文、华语和马来文；没填的语言，会显示你已填写的名称。', 'Nama menyokong Inggeris, Cina dan Melayu. Terjemahan kosong menggunakan nama yang sudah diisi.'),
    },
    {
      title: t('Customer View', '顾客模式', 'Paparan pelanggan'),
      short: t('Hand over the phone', '交给顾客选餐', 'Serahkan telefon'),
      icon: Smartphone, image: 'cj-pos-customer',
      heading: t('Let them choose. Then take over.', '让顾客自己选，再交回给你。', 'Pelanggan pilih, anda sambung.'),
      body: t('Hand this device to the customer. They choose items, review their order and submit it. The order summary asks them to return the phone to staff.', '把这台设备交给顾客。他可以选商品、检查订单，再提交。完成后，订单摘要会提示他把电话交还给店员。', 'Serahkan peranti ini kepada pelanggan. Mereka pilih item, semak dan hantar pesanan. Ringkasan meminta telefon dipulangkan kepada kakitangan.'),
      detail: t('One shared device. This version does not sync a second customer phone.', '目前使用同一台设备，不会同步另一位顾客的电话。', 'Satu peranti dikongsi. Versi ini tidak menyegerakkan telefon pelanggan kedua.'),
    },
    {
      title: t('Kitchen', '厨房备餐', 'Dapur'),
      short: t('Prepare and complete', '备餐、标记出餐', 'Sedia dan siapkan'),
      icon: ChefHat, image: 'cj-pos-kitchen',
      heading: t('Keep preparation moving.', '看清每一单，按顺序准备。', 'Susun penyediaan setiap pesanan.'),
      body: t('Both paid and unpaid orders appear in the kitchen. Read the order number and choices, prepare the food, and mark it ready.', '先付、后付的订单都会进入厨房。按订单号查看商品和选项，准备好后标记已出餐。', 'Pesanan berbayar dan belum berbayar muncul di dapur. Semak nombor dan pilihan, sediakan makanan, kemudian tandakan siap.'),
      detail: t('Ready does not mean paid. Unpaid orders remain available in Payments.', '已出餐不代表已付款。未付款订单仍留在收款页。', 'Siap tidak bermaksud dibayar. Pesanan belum dibayar kekal dalam Bayaran.'),
    },
    {
      title: t('Payments', '确认收款', 'Bayaran'),
      short: t('Confirm money received', '确认实际到账', 'Sahkan wang diterima'),
      icon: CreditCard, image: 'cj-pos-payments',
      heading: t('A clear place for unpaid orders.', '还有哪些没收钱，一眼看清。', 'Lihat pesanan yang belum dibayar.'),
      body: t('Open an unpaid order, choose Cash or QR, and confirm only after receiving the money. Orders already served stay visible until they are paid.', '打开未付款订单，选择现金或 QR，实际收到款后才确认。已经出餐但还没付钱的订单，也会继续显示。', 'Buka pesanan belum dibayar, pilih Tunai atau QR dan sahkan selepas wang diterima. Pesanan yang sudah siap kekal sehingga dibayar.'),
      detail: t('QR displays your payment image. It does not check your bank balance or confirm transfers automatically.', 'QR 只是显示你的收款码，不会读取银行余额或自动确认转账。', 'QR memaparkan kod bayaran anda. Ia tidak membaca baki bank atau mengesahkan pindahan secara automatik.'),
    },
    {
      title: t('History', '记录与报表', 'Sejarah'),
      short: t('Review and export', '看记录、导出报表', 'Semak dan eksport'),
      icon: ClipboardList, image: 'cj-pos-history',
      heading: t('Finish the day with a clear record.', '收工前，把今天的记录留好。', 'Simpan rekod yang jelas setiap hari.'),
      body: t('Review day, week, month or year. Export an Excel file with a summary, daily totals, orders and item details. Only confirmed, non-cancelled payments count as receipts.', '按日、周、月或年查看记录。导出 Excel，内含汇总、每日金额、订单和商品明细。营收只计算已确认收款且未取消的订单。', 'Semak hari, minggu, bulan atau tahun. Eksport Excel dengan ringkasan, jumlah harian, pesanan dan butiran item. Hanya bayaran disahkan yang tidak dibatalkan dikira.'),
      detail: t('Reports follow the date payment was received, using Malaysia time.', '报表按实际收款日期统计，使用马来西亚时间。', 'Laporan mengikut tarikh bayaran diterima, menggunakan waktu Malaysia.'),
    },
  ];
  const currentStep = steps[activeStep];
  const screenshotName = `${currentStep.image}-${language}.jpg`;
  const openSelectedStep = () => {
    if (activeStep === 1) onAdmin();
    else if (activeStep === 2) onStart();
    else if (activeStep === 3) onKitchen();
    else window.location.hash = activeStep === 4 ? '#/cashier/active' : activeStep === 5 ? '#/cashier/history' : '#/cashier';
  };
  const faqs = [
    [t('Is the app free?', '现在可以免费用吗？', 'Adakah aplikasi ini percuma?'), t('This 0.1.4 test version is free to try. The Android APK is a direct download and is not a Google Play release.', '0.1.4 测试版可以免费试用。Android APK 从这里直接下载，目前还未上架 Google Play。', 'Versi ujian 0.1.4 ini percuma untuk dicuba. APK Android dimuat turun terus dan belum diterbitkan di Google Play.')],
    [t('Can customers order on their own phones?', '顾客可以用自己的电话点单吗？', 'Bolehkah pelanggan memesan pada telefon sendiri?'), t('Yes, using a menu shared by the seller. Customers send their order back through WhatsApp, then the seller imports and confirms it on the main device. Records do not sync automatically between phones.', '可以使用商家分享的菜单。顾客经 WhatsApp 把订单传回，商家再用主设备导入并确认。两台电话之间不会自动同步资料。', 'Boleh, dengan menu yang dikongsi penjual. Pelanggan menghantar pesanan melalui WhatsApp, kemudian penjual mengimport dan mengesahkannya pada peranti utama. Rekod tidak disegerakkan secara automatik antara telefon.')],
    [t('Can I combine the whole year?', '可以一次导出整年的记录吗？', 'Bolehkah saya eksport setahun sekali gus?'), t('Yes. Select Year in History to create one report from records still on that device. You do not need to merge daily Excel files by hand.', '可以。在记录页选「年」，就能把这台设备里仍保存的记录汇成一份报表，不必手动合并每天的 Excel。', 'Boleh. Pilih Tahun dalam Sejarah untuk satu laporan daripada rekod yang masih ada pada peranti. Tidak perlu menggabungkan fail harian secara manual.')],
    [t('Will daily reports save automatically?', '每天的报表会自动保存吗？', 'Adakah laporan harian disimpan automatik?'), t('On Android, choose a report folder and enable automatic reports. Saving runs while the app is open in the foreground. A closed app cannot guarantee a midnight export. Web reports are downloaded manually.', 'Android 版选择报表文件夹并启用后，会在 App 开着、位于前台时自动保存。关掉 App 后，不保证半夜自动导出；网页版使用手动下载。', 'Pada Android, pilih folder dan aktifkan laporan automatik. Simpanan berjalan apabila aplikasi terbuka di latar depan. Aplikasi tertutup tidak menjamin eksport tengah malam. Laporan web dimuat turun secara manual.')],
    [t('What happens if I change or lose my phone?', '换电话或电话坏了，资料怎么办？', 'Bagaimana jika saya tukar atau kehilangan telefon?'), t('Keep a full .cjpos backup outside the app. It can restore the shop on another device. Clearing browser or app data, or uninstalling the app, can remove local records.', '请定期把完整的 .cjpos 备份另外存好，之后可以在另一台设备还原。清除浏览器或 App 资料、卸载 App，都可能删除本机记录。', 'Simpan sandaran penuh .cjpos di luar aplikasi secara berkala. Ia boleh memulihkan kedai pada peranti lain. Memadam data pelayar atau aplikasi, atau menyahpasang aplikasi, boleh menghapuskan rekod tempatan.')],
  ];

  return <div className="cj-landing" lang={language === 'zh' ? 'zh-Hans' : language}>
    <header className="cj-header cj-shell">
      <a className="cj-brand" href="#" aria-label={t('CJ POS home', 'CJ POS 首页', 'Laman utama CJ POS')}>
        <img src={APP_ICON_SRC} alt="" width="44" height="44" />
        <span>CJ POS</span>
      </a>
      <nav className="cj-header-links" aria-label={t('Page navigation', '页面导航', 'Navigasi halaman')}>
        <a href="#features">{t('How it works', '如何使用', 'Cara guna')}</a>
        <a href="#guide">{t('Guide', '教学', 'Panduan')}</a>
        <a href="#your-data">{t('Your data', '资料保存', 'Data anda')}</a>
      </nav>
      <label className="cj-language">
        <Languages size={18} aria-hidden="true" />
        <span className="cj-sr-only">{t('Language', '语言', 'Bahasa')}</span>
        <select value={language} onChange={event => { selectLanguage(event.target.value as Language); }}>
          <option value="en">English</option><option value="zh">中文</option><option value="ms">Bahasa Melayu</option>
        </select>
      </label>
    </header>

    <main>
      <section className="cj-hero cj-shell" aria-labelledby="cj-hero-title">
        <div className="cj-hero-copy">
          <p className="cj-eyebrow">{t('For the way small food businesses work', '为小店的日常生意而做', 'Untuk perniagaan makanan kecil')}</p>
          <h1 id="cj-hero-title">{t('Good food.', '认真做美食，', 'Makanan sedap.')}<br /><span>{t('Simple orders.', '轻松管订单。', 'Pesanan teratur.')}</span></h1>
          <p className="cj-hero-intro">{t('A free app for orders, payments and daily records. Made for food stalls, cafés and kuih sellers.', '点单、收款、备餐和报表，一个免费 App。小摊、糕点店、小餐馆，都能换上自己的菜单。', 'Aplikasi percuma untuk pesanan, bayaran dan rekod harian. Untuk gerai, kafe dan penjual kuih.')}</p>
          <div className="cj-actions">
            <a className="cj-button cj-button-primary" href="#/cashier">{t('Try web demo', '试玩网页版', 'Cuba demo web')}<ArrowRight size={19} aria-hidden="true" /></a>
            <a className="cj-button cj-button-secondary" href={APK_URL} download="CJ_POS_0.1.4_Test.apk"><ArrowDownToLine size={19} aria-hidden="true" />{t('Download Android', '下载 Android', 'Muat turun Android')}</a>
          </div>
        </div>
        <figure id="guide" className="cj-hero-visual cj-hero-video" aria-labelledby="cj-guide-title">
          <h2 id="cj-guide-title" className="cj-video-heading"><PlayCircle size={24} aria-hidden="true" />{t('A quick guide, with sound.', '先听介绍，再自己试。', 'Panduan ringkas bersari kata.')}</h2>
          <div className="cj-video-wrap">
            <video key={language} ref={videoRef} controls playsInline preload="metadata" poster={media(`cj-pos-guide-poster-${language}.jpg`)} onLoadedMetadata={event => setVideoResult(language, 'ready', event.currentTarget.duration)} onError={() => setVideoResult(language, 'error')} aria-label={t('CJ POS guide with English narration', 'CJ POS 华语有声教学', 'Panduan CJ POS bersari kata Bahasa Melayu, suara belum tersedia')}>
              <source src={media(`cj-pos-guide-${language}.mp4`)} type="video/mp4" onError={() => setVideoResult(language, 'error')} />
              <track kind="captions" src={media(`cj-pos-guide-${language}.vtt`)} srcLang={language} label={{ en: 'English', zh: '中文', ms: 'Bahasa Melayu' }[language]} />
              {t('Your browser cannot play this video.', '这个浏览器无法播放影片。', 'Pelayar anda tidak dapat memainkan video ini.')}
            </video>
            {currentVideoState.status === 'error' && <div className="cj-media-message" role="status">
              <p>{t('The English guide could not load. You can follow the six steps below and try the app.', '华语影片暂时无法播放，你可以先参考下方六个步骤，直接试玩。', 'Video panduan Bahasa Melayu tidak dapat dimuatkan. Ikuti enam langkah di bawah dan cuba aplikasi.')}</p>
              <button type="button" onClick={() => { setVideoResult(language, 'loading'); videoRef.current?.load(); }}>{t('Retry video', '重新加载影片', 'Cuba video semula')}</button>
            </div>}
          </div>
          <div className="cj-video-actions">
            <button type="button" className="cj-button cj-button-primary" onClick={() => { void playGuide(); }}>{hasNarration ? <Volume2 size={19} aria-hidden="true" /> : <PlayCircle size={19} aria-hidden="true" />}{playButtonLabel}</button>
            <span>{mediaStatusLabel}</span>
          </div>
          {playbackNotice === language && <p className="cj-media-message" role="status">{t('Press the player’s Play control to start the guide.', '请按播放器的播放按钮开始导览。', 'Tekan butang Main pada pemain untuk memulakan panduan.')}</p>}
          <figcaption>{t('A guide to the core tasks. See below for shared menus and WhatsApp orders in 0.1.4.', '基础操作导览；0.1.4 的菜单分享与 WhatsApp 接单，请看下方介绍。', 'Panduan tugas asas. Lihat di bawah untuk perkongsian menu dan pesanan WhatsApp dalam 0.1.4.')}</figcaption>
        </figure>
      </section>

      <div className="cj-quick-facts cj-shell" aria-label={t('What to expect', '使用方式', 'Cara penggunaan')}>
        <span><Smartphone aria-hidden="true" size={19} />{t('One device, one shop', '一台设备，一间小店', 'Satu peranti, satu kedai')}</span>
        <span><Languages aria-hidden="true" size={19} />{t('English, Chinese & Malay', '英文、华语、马来文', 'Inggeris, Cina dan Melayu')}</span>
        <span><HardDrive aria-hidden="true" size={19} />{t('Records stay on your device', '资料保存在你的设备', 'Rekod pada peranti anda')}</span>
      </div>

      <section className="cj-scenarios cj-section cj-shell" aria-labelledby="cj-scenarios-title">
        <div className="cj-section-heading">
          <h2 id="cj-scenarios-title">{t('At the stall. Or from home.', '现场摆摊，住家接单，都用得上。', 'Di gerai atau dari rumah.')}</h2>
          <p>{t('Keep the main shop records on your device. Choose how customers place an order.', '门店的正式记录，留在你的主设备。顾客在现场或远端，都有适合的点单方式。', 'Simpan rekod utama kedai pada peranti anda. Pilih cara pelanggan membuat pesanan.')}</p>
        </div>
        <div className="cj-scenario-grid">
          <article>
            <figure>
              <img src={asset('cj-pos-hawker-order-v014.webp')} width="1536" height="1024" loading="lazy" alt={t('Illustrative scene: a hawker takes an order on a phone at a Malaysian food stall', '情境示意：小贩在马来西亚摊位用电话为现场顾客点单', 'Gambaran: penjaja mengambil pesanan pada telefon di gerai Malaysia')} />
              <figcaption>{t('AI-generated illustrative scene. Not a real customer testimonial.', 'AI 生成情境示意，非真实商家使用见证。', 'Gambaran dijana AI, bukan testimoni pelanggan sebenar.')}</figcaption>
            </figure>
            <h3>{t('Serve walk-in customers.', '小贩中心、路边摊，现场点单。', 'Layan pelanggan di gerai.')}</h3>
            <p>{t('Take the order yourself, or hand over the same phone for Customer View. Check the items together, prepare the food and confirm payment.', '老板或服务员直接点单，也可以把同一台电话交给顾客自己选。一起核对商品，再备餐和确认收款。', 'Ambil pesanan sendiri atau serahkan telefon yang sama untuk Paparan pelanggan. Semak item bersama, sediakan makanan dan sahkan bayaran.')}</p>
            <a className="cj-text-link" href="#/cashier">{t('Try web demo', '试玩网页版', 'Cuba demo web')}<ArrowRight size={17} aria-hidden="true" /></a>
          </article>
          <article>
            <figure>
              <img src={asset('cj-pos-home-kuih-v014.webp')} width="1536" height="1024" loading="lazy" alt={t('Illustrative scene: a home kuih seller checks a phone beside packed orders', '情境示意：住家糕点卖家在打包糕点旁查看电话订单', 'Gambaran: penjual kuih dari rumah menyemak telefon di sisi kuih yang dibungkus')} />
              <figcaption>{t('AI-generated illustrative scene. Not a real customer testimonial.', 'AI 生成情境示意，非真实商家使用见证。', 'Gambaran dijana AI, bukan testimoni pelanggan sebenar.')}</figcaption>
            </figure>
            <h3>{t('Take kuih orders through WhatsApp.', '住家卖糕点，用 WhatsApp 接单。', 'Terima pesanan kuih melalui WhatsApp.')}</h3>
            <p>{t('Share a menu for customers to open on their own phones. They return an order through WhatsApp. Review it on your main device before accepting it.', '分享菜单，让顾客在自己的电话选购，再经 WhatsApp 传回订单。你在主设备检查内容后，才正式接单。', 'Kongsi menu untuk pelanggan buka pada telefon sendiri. Mereka menghantar pesanan melalui WhatsApp. Semak pada peranti utama sebelum menerimanya.')}</p>
            <a className="cj-text-link" href="#/menu?demo=1">{t('Try customer demo', '试玩顾客点单', 'Cuba demo pelanggan')}<ArrowRight size={17} aria-hidden="true" /></a>
          </article>
        </div>
      </section>

      <section id="shared-menu" className="cj-shared-flow cj-section" aria-labelledby="cj-shared-flow-title">
        <div className="cj-shell">
          <div className="cj-section-heading">
            <h2 id="cj-shared-flow-title">{t('A menu out. An order back.', '菜单传出去，订单带回来。', 'Kongsi menu, terima pesanan.')}</h2>
            <p>{t('Five steps connect the customer’s phone to your shop records. You decide which orders to accept.', '五个步骤，把顾客电话上的选择带回你的门店记录。每张订单都由你确认接收。', 'Lima langkah membawa pilihan pelanggan ke rekod kedai anda. Anda menentukan pesanan yang diterima.')}</p>
          </div>
          <ol className="cj-return-steps">
            <li><h3>{t('Share your menu', '分享你的菜单', 'Kongsi menu')}</h3><p>{t('Prepare the menu on your main device and share it with your customer.', '在主设备整理菜单，再分享给顾客。', 'Sediakan menu pada peranti utama dan kongsi dengan pelanggan.')}</p></li>
            <li><h3>{t('Customer chooses', '顾客打开并选购', 'Pelanggan memilih')}</h3><p>{t('The customer opens your shared menu, selects items and checks the total.', '顾客打开收到的菜单，选择商品并核对总额。', 'Pelanggan membuka menu, memilih item dan menyemak jumlah.')}</p></li>
            <li><h3>{t('Return the order', 'WhatsApp 传回订单', 'Hantar pesanan')}</h3><p>{t('The customer sends the order back to you through WhatsApp.', '顾客经 WhatsApp 把订单传回给你。', 'Pelanggan menghantar pesanan kembali melalui WhatsApp.')}</p></li>
            <li><h3>{t('Review and accept', '导入、检查并接单', 'Semak dan terima')}</h3><p>{t('Import it on your main device. Check the items and price before confirming.', '在主设备导入，核对商品和价格后再确认。', 'Import pada peranti utama. Semak item dan harga sebelum mengesahkan.')}</p></li>
            <li><h3>{t('Prepare and collect', '备餐与确认收款', 'Sedia dan kutip bayaran')}</h3><p>{t('Prepare the accepted order. Mark it paid only after money is received.', '根据已接收的订单备餐，实际收到款后才标记付款。', 'Sediakan pesanan yang diterima. Tandakan dibayar selepas wang diterima.')}</p></li>
          </ol>
          <p className="cj-transfer-note"><ShieldCheck size={20} aria-hidden="true" />{t('WhatsApp carries the menu and order. It does not automatically sync your devices or confirm payment.', 'WhatsApp 用来传递菜单和订单，不会自动同步两台设备，也不会自动确认收款。', 'WhatsApp membawa menu dan pesanan. Ia tidak menyegerakkan peranti atau mengesahkan bayaran secara automatik.')}</p>
          <div className="cj-actions">
            <a className="cj-button cj-button-primary" href="#/menu?demo=1">{t('Try customer demo', '试玩顾客点单', 'Cuba demo pelanggan')}<ArrowRight size={18} aria-hidden="true" /></a>
            <a className="cj-button cj-button-secondary" href="#/menu">{t('Open a shared menu', '打开收到的菜单', 'Buka menu dikongsi')}<ArrowRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      <section id="features" className="cj-features cj-section cj-shell" aria-labelledby="cj-features-title">
        <div className="cj-section-heading">
          <h2 id="cj-features-title">{t('From the first order to closing time.', '从第一单，到每天收工。', 'Dari pesanan pertama hingga tutup kedai.')}</h2>
          <p>{t('Six familiar jobs, in one place. Select a step to see the actual app.', '六件每天会做的事，放在同一个地方。点选步骤，看看实际界面。', 'Enam tugas harian di satu tempat. Pilih langkah untuk melihat aplikasi sebenar.')}</p>
        </div>
        <div className="cj-feature-layout">
          <div className="cj-step-controls" role="group" aria-label={t('Explore the six steps', '浏览六个操作步骤', 'Lihat enam langkah')}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              return <button type="button" key={step.title} aria-pressed={activeStep === index} aria-controls="cj-step-panel" className={activeStep === index ? 'is-selected' : ''} onClick={() => setActiveStep(index)}>
                <span className="cj-step-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="cj-step-label"><strong><Icon size={19} aria-hidden="true" />{step.title}</strong><small>{step.short}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>;
            })}
          </div>
          <div id="cj-step-panel" className="cj-step-panel">
            <figure className="cj-app-preview">
              {failedScreenshot === screenshotName
                ? <div className="cj-screenshot-unavailable" role="status">{t('The English screenshot is unavailable. Open the app to view this screen.', '华语截图暂时无法加载，可直接打开 App 查看此界面。', 'Tangkapan skrin Bahasa Melayu tidak tersedia. Buka aplikasi untuk melihat skrin ini.')}</div>
                : <img key={screenshotName} src={asset(screenshotName)} alt={t('Actual app screenshot: ', '实际 App 截图：', 'Tangkapan skrin aplikasi sebenar: ') + currentStep.title} width="1440" height="900" loading="lazy" onError={() => setFailedScreenshot(screenshotName)} />}
              <figcaption>{failedScreenshot === screenshotName ? t('Screenshot unavailable in this language.', '此语种截图暂不可用。', 'Tangkapan skrin bahasa ini tidak tersedia.') : t('Actual test version. Orders and amounts shown are demonstration data.', '实际测试版界面，图中的订单和金额均为示范资料。', 'Versi ujian sebenar. Pesanan dan jumlah yang dipaparkan ialah data demonstrasi.')}</figcaption>
            </figure>
            <div className="cj-step-description" aria-live="polite">
              <h3>{currentStep.heading}</h3>
              <p>{currentStep.body}</p>
              <p className="cj-step-note"><Check size={18} aria-hidden="true" />{currentStep.detail}</p>
              <button type="button" className="cj-text-link" onClick={openSelectedStep}>{t('Open this screen', '打开这个功能', 'Buka skrin ini')}<ArrowRight size={17} aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </section>

      <section id="your-data" className="cj-data cj-section cj-shell" aria-labelledby="cj-data-title">
        <div className="cj-section-heading">
          <h2 id="cj-data-title">{t('Save the report. Keep the whole shop.', '报表留一份，整间店也备份。', 'Simpan laporan dan sandaran kedai.')}</h2>
          <p>{t('Excel and a full backup do different jobs. Keep both for your daily business.', 'Excel 和完整备份，用途不同。每天看数字，也记得把原始资料留好。', 'Excel dan sandaran penuh mempunyai kegunaan berbeza. Simpan kedua-duanya untuk perniagaan harian.')}</p>
        </div>
        <div className="cj-file-comparison">
          <article className="cj-file-type">
            <FileSpreadsheet size={32} aria-hidden="true" /><span className="cj-file-extension">.xlsx</span>
            <h3>{t('For your sales records', '用来看收入与明细', 'Untuk rekod jualan')}</h3>
            <p>{t('A readable Excel report for a day, week, month or year. Four sheets keep the summary, daily totals, orders and items together.', '按日、周、月或年导出 Excel。四个工作表，分别放汇总、每日金额、订单和商品明细。', 'Laporan Excel untuk hari, minggu, bulan atau tahun. Empat helaian mengandungi ringkasan, jumlah harian, pesanan dan item.')}</p>
            <ul>
              <li><Check size={17} aria-hidden="true" />{t('Only confirmed receipts count toward revenue', '营收只计算实际已确认的收款', 'Hasil hanya mengira bayaran yang disahkan')}</li>
              <li><Check size={17} aria-hidden="true" />{t('Export a full year directly from History', '在记录页直接导出全年，不必手动合并', 'Eksport setahun terus daripada Sejarah')}</li>
              <li><Check size={17} aria-hidden="true" />{t('A report cannot restore the app', '报表不能用来还原 App', 'Laporan tidak dapat memulihkan aplikasi')}</li>
            </ul>
          </article>
          <article className="cj-file-type cj-full-backup">
            <FileArchive size={32} aria-hidden="true" /><span className="cj-file-extension">.cjpos</span>
            <h3>{t('For restoring your shop', '用来还原整间店', 'Untuk memulihkan kedai')}</h3>
            <p>{t('A full backup includes settings, menu, images, orders and cart. Keep a copy somewhere outside the app.', '完整备份包含门店设置、菜单、图片、订单和购物车。请另外存好一份，不要只留在 App 里。', 'Sandaran penuh merangkumi tetapan, menu, imej, pesanan dan troli. Simpan salinan di luar aplikasi.')}</p>
            <ul>
              <li><Check size={17} aria-hidden="true" />{t('Restore after changing devices', '换设备后，可以导入还原', 'Pulihkan selepas bertukar peranti')}</li>
              <li><Check size={17} aria-hidden="true" />{t('Preview the backup before restoring', '还原前先预览备份内容', 'Pratonton sandaran sebelum pemulihan')}</li>
              <li><Check size={17} aria-hidden="true" />{t('Restore replaces existing device data', '还原会取代这台设备现有资料', 'Pemulihan menggantikan data sedia ada')}</li>
            </ul>
          </article>
        </div>
        <aside className="cj-local-note">
          <ShieldCheck size={30} aria-hidden="true" />
          <div><h3>{t('Local storage means this device.', '本机保存，就是保存在这台设备。', 'Simpanan tempatan bermaksud peranti ini.')}</h3>
            <p>{t('The website and Android app keep separate data. There is no automatic cloud or two-phone sync. Clearing data or uninstalling can remove your records, so save a full backup regularly.', '网站和 Android App 的资料各自保存，没有云端或两台电话自动同步。清除资料或卸载 App 可能丢失记录，请定期另存完整备份。', 'Laman web dan aplikasi Android menyimpan data berasingan. Tiada penyegerakan awan atau antara dua telefon. Memadam data atau menyahpasang boleh menghapuskan rekod, jadi simpan sandaran penuh secara berkala.')}</p>
          </div>
        </aside>
      </section>

      <section className="cj-faq cj-section cj-shell" aria-labelledby="cj-faq-title">
        <div><h2 id="cj-faq-title">{t('Before your first day.', '开始使用前，先知道这些。', 'Sebelum hari pertama anda.')}</h2><p>{t('A few practical answers for your counter.', '几个和每天营业有关的实际问题。', 'Jawapan praktikal untuk kaunter anda.')}</p></div>
        <div className="cj-faq-items">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="cj-get-started cj-shell" aria-labelledby="cj-start-title">
        <MonitorSmartphone size={38} aria-hidden="true" />
        <div><h2 id="cj-start-title">{t('Try one order with your own menu.', '换上自己的菜单，试着开一单。', 'Cuba satu pesanan dengan menu anda.')}</h2><p>{t('Start in your browser, or download the free Android test app.', '先在浏览器试用，或下载免费的 Android 测试版。', 'Mula dalam pelayar atau muat turun aplikasi ujian Android percuma.')}</p></div>
        <div className="cj-actions"><a className="cj-button cj-button-primary" href="#/cashier">{t('Try web demo', '试玩网页版', 'Cuba demo web')}<ArrowRight size={18} aria-hidden="true" /></a><a className="cj-button cj-button-secondary" href={APK_URL} download="CJ_POS_0.1.4_Test.apk"><ArrowDownToLine size={18} aria-hidden="true" />{t('Download Android', '下载 Android', 'Muat turun Android')}</a></div>
      </section>
    </main>

    <footer className="cj-footer cj-shell">
      <div className="cj-footer-brand"><img src={APP_ICON_SRC} alt="" width="36" height="36" /><strong>CJ POS</strong></div>
      <p>{t('Free test version 0.1.4. Shop records stay on your main device. Not yet on Google Play.', '免费测试版 0.1.4，门店记录保存在主设备，目前未上架 Google Play。', 'Versi ujian percuma 0.1.4. Rekod kedai pada peranti utama. Belum di Google Play.')}</p>
      {IS_PUBLIC_DEMO && <details className="cj-demo-tools"><summary>{t('Demo data tools', '示范资料管理', 'Alat data demo')}</summary><PublicDemoReset buttonClassName="cj-reset-button" /></details>}
    </footer>
  </div>;
}
