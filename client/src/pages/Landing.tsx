import { ArrowDown, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Check, Image, LockKeyhole, NotebookPen, Timer, Users, Waves, Wind } from "lucide-react";
import { getLoginUrl } from "@/const";
import "./landing.css";

function GoogleSignIn() {
  return (
    <a className="landing-signin" href={getLoginUrl()}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
        <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A6 6 0 0 1 12 5.96Z" />
      </svg>
      使用 Google 登入
      <ArrowUpRight aria-hidden="true" size={18} />
    </a>
  );
}

const previews = [
  {
    name: "衝浪紀錄",
    image: "home",
    alt: "WaveShare 首頁：總衝浪次數、浪點數量、平均評分與最近紀錄",
    icon: NotebookPen,
    title: "留下每次下水的故事",
    description: "記下浪點、浪況、板型與心得，讓每一趟衝浪都有跡可循。",
  },
  {
    name: "衝浪日曆",
    image: "calendar",
    alt: "WaveShare 日曆：用月曆查看有衝浪紀錄的日期",
    icon: CalendarDays,
    title: "找回那天的好浪",
    description: "用日曆回顧下水的日子，輕鬆找到想重溫的那一筆紀錄。",
  },
  {
    name: "個人統計",
    image: "stats",
    alt: "WaveShare 統計：衝浪次數、浪板使用統計與最常去的浪點",
    icon: ChartNoAxesCombined,
    title: "看見自己的衝浪足跡",
    description: "從衝浪次數到最常去的浪點，把一次次的熱愛累積成自己的故事。",
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <a className="landing-skip" href="#main">跳至主要內容</a>
      <header className="landing-header landing-container">
        <a href="/" className="landing-brand" aria-label="WaveShare 浪旅誌首頁">
          <span className="landing-brand-icon"><Waves aria-hidden="true" size={25} /></span>
          <span>WaveShare <span className="landing-brand-zh">浪旅誌</span></span>
        </a>
        <a className="landing-header-link" href={getLoginUrl()}>登入 <ArrowUpRight aria-hidden="true" size={16} /></a>
      </header>

      <main id="main">
        <section className="landing-hero landing-container" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span /> 給每一個喜歡海的你</p>
            <h1 id="landing-title">每一道浪，<br />都值得<span className="landing-title-accent">留下。</span></h1>
            <p className="landing-intro">下水回來，打開記一下。<br />浪況幫你填好，心得留給自己寫。<br />把下水的日子，收藏成自己的浪旅誌。</p>
            <GoogleSignIn />
            <p className="landing-signin-note">用 Google 帳號就能開始，不用另外設定密碼。</p>
            <figure className="landing-conditions" aria-label="浪況自動帶入示意">
              <figcaption>浪高、風、潮汐，記錄時自動幫你填好</figcaption>
              <div className="landing-conditions-top"><span>烏石港 · 2026/11/22</span><span><Check aria-hidden="true" size={12} /> 自動帶入</span></div>
              <dl className="landing-conditions-grid">
                <div><dt><Waves aria-hidden="true" size={14} />浪高</dt><dd>0.8–1.2 <span>m</span></dd></div>
                <div><dt><Timer aria-hidden="true" size={14} />週期</dt><dd>8 <span>s</span></dd></div>
                <div><dt><Wind aria-hidden="true" size={14} />東北風</dt><dd>3 <span>m/s</span></dd></div>
                <div><dt><ArrowUpRight aria-hidden="true" size={14} />滿潮</dt><dd>11:20</dd></div>
              </dl>
              <p>示範資料，非即時預報。依浪點與日期帶入可取得的資料。</p>
            </figure>
            <a href="#features" className="landing-explore">先看看 WaveShare <ArrowDown aria-hidden="true" size={16} /></a>
          </div>

          <div className="landing-hero-visual">
            <svg className="landing-ocean" viewBox="0 0 600 600" aria-hidden="true">
              <circle cx="300" cy="300" r="270" fill="#dcece5" />
              <circle cx="460" cy="120" r="47" fill="#f2cc84" />
              <path d="M5 370C130 240 230 440 365 320S560 270 620 245" fill="none" stroke="#b5d4c8" strokeWidth="54" />
              <path d="M-10 440C150 300 240 500 390 385S540 350 630 310" fill="none" stroke="#f8faf3" strokeWidth="2" />
            </svg>
            <div className="landing-hero-phone">
              <img src="/landing/app-home.webp" width="390" height="844" alt="WaveShare 衝浪紀錄首頁預覽，使用示範資料" fetchPriority="high" />
            </div>
            <div className="landing-note landing-note-top"><Waves aria-hidden="true" size={22} /><span>離開海之後，<br /><strong>好浪還在這裡。</strong></span></div>
            <div className="landing-note landing-note-bottom"><span className="landing-note-dot" /><span>每一次下水，都是故事</span></div>
            <span className="landing-visual-caption">APP 預覽 · 示範資料</span>
          </div>
        </section>

        <section className="landing-highlights landing-container" aria-label="紀錄與分享，由你決定">
          <article className="landing-privacy" aria-labelledby="privacy-title">
            <span className="landing-highlight-icon"><LockKeyhole aria-hidden="true" size={22} /></span>
            <p className="landing-eyebrow">YOUR JOURNAL, YOUR CHOICE</p>
            <h2 id="privacy-title">你決定誰看得到</h2>
            <p>在 WaveShare，紀錄和附上的影片、照片預設只有自己登入後看得到。想分享時，再選定幾位浪友；轉傳紀錄連結不會開放存取。</p>
            <div className="landing-audience" aria-label="分享方式說明，非互動設定">
              <div><LockKeyhole aria-hidden="true" size={17} /><span>留給自己</span><span className="landing-audience-default">預設</span></div>
              <div><Users aria-hidden="true" size={17} /><span>或分享給選定的好友</span></div>
            </div>
            <p className="landing-privacy-note">之後也能取消站內分享。已發出的短效檔案連結，在到期前仍可開啟。</p>
          </article>
          <article className="landing-share" aria-labelledby="share-title">
            <div className="landing-share-copy">
              <span className="landing-highlight-icon"><Image aria-hidden="true" size={22} /></span>
              <p className="landing-eyebrow">A MOMENT TO KEEP</p>
              <h2 id="share-title">把那天的海，<br />做成一張分享卡。</h2>
              <p>用自己的照片當背景，配上浪點、日期與當日浪況，存成圖片，分享到 IG 限動或 LINE。</p>
              <p className="landing-share-note">分享的是一張可轉傳的圖片，不會開放原本的紀錄。</p>
            </div>
            <figure className="landing-share-figure">
              <img src="/landing/share-card-photo.webp" width="540" height="960" alt="照片背景的 WaveShare 衝浪分享卡：烏石港、日期、浪高、風向與潮汐，使用示範資料" loading="lazy" decoding="async" />
              <figcaption>分享卡預覽 · 示範照片與資料</figcaption>
            </figure>
          </article>
        </section>

        <section id="features" className="landing-features" aria-labelledby="features-title">
          <div className="landing-container">
            <div className="landing-section-heading">
              <div><p className="landing-eyebrow">YOUR PERSONAL SURF JOURNAL</p><h2 id="features-title">下水，記錄，回味。</h2></div>
              <p>留住的不只是數字，<br />還有每次與海相遇的心情。</p>
            </div>
            <div className="landing-preview-grid">
              {previews.map(({ name, image, alt, icon: Icon, title, description }, index) => (
                <article className="landing-preview" key={image}>
                  <div className="landing-preview-heading"><span><Icon aria-hidden="true" size={17} />{name}</span><span>0{index + 1}</span></div>
                  <div className={`landing-preview-image landing-preview-${image}`}>
                    <img src={`/landing/app-${image}.webp`} alt={alt} width="390" height="844" loading="lazy" decoding="async" />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
            <p className="landing-demo-note">以上為實際介面預覽，內容皆為示範資料。</p>
          </div>
        </section>

        <section className="landing-start landing-container" aria-labelledby="start-title">
          <Waves aria-hidden="true" size={34} />
          <h2 id="start-title">下一次的好浪，從這裡記起。</h2>
          <p>為自己留一本，會想一再翻開的衝浪日記。</p>
          <GoogleSignIn />
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <span>WaveShare 浪旅誌 <span className="landing-footer-tagline">／ 把熱愛，留在浪裡。</span></span>
        <nav aria-label="法律資訊"><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a></nav>
      </footer>
    </div>
  );
}
