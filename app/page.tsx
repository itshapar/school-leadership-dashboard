import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";
import {
  CheckBadge,
  HeroLoop,
  IconAvatar,
  IconGroups,
  IconPin,
  IconPrivacy,
  IconPrize,
  IconSemester,
  LogoStar,
  PlayGlyph,
  StudentPhone,
  TeacherJournal,
} from "@/components/Landing/LandingArt";

/**
 * Лендінг StarBoard.
 *
 * Раніше "/" просто редіректив на /admin. Тепер це публічна сторінка
 * продукту, а вхід у кабінет живе за кнопкою «Включити бета-версію»:
 * вчитель, який уже має акаунт, з /admin потрапляє одразу в кабінет,
 * бо middleware перевіряє сесію саме там.
 *
 * Серверний компонент без клієнтського JS: усі анімації, CSS на
 * інлайнових SVG (див. components/Landing/LandingArt.tsx).
 */

/* ------------------------------------------------------------------ */
/* Три посилання, які змінюються найчастіше. Тримаємо разом і зверху.   */
/* ------------------------------------------------------------------ */

/** Кабінет вчителя. Без сесії middleware сам поверне на /admin/login. */
const BETA_URL = "/admin";

/** Реєстрація нового вчителя. */
const REGISTER_URL = "/register";

/**
 * Банка для донатів. Поки порожньо, кнопка лишається на місці, але не
 * веде нікуди (див. .lp-btn-pending). Щоб увімкнути: вставити сюди
 * посилання на банку, більше нічого міняти не треба.
 */
const DONATE_URL = "";

/**
 * Відео-туторіал. Сюди йде саме src ембеда, а не код усього <iframe>:
 *   YouTube   https://www.youtube.com/embed/ВІДЕО_ID
 *   Vimeo     https://player.vimeo.com/video/ВІДЕО_ID
 * Поки порожньо, у рамці стоїть заглушка з поясненням.
 */
const VIDEO_EMBED_URL = "";

export const metadata: Metadata = {
  title: "StarBoard · Дошка зірок для класу",
  description:
    "Безкоштовна дошка зірок для класу: вчитель відмічає зірки в журналі, " +
    "кожен учень бачить свій прогрес і нагороди на власній сторінці.",
};

/* ------------------------------------------------------------------ */
/* Кнопка донату                                                       */
/* ------------------------------------------------------------------ */

function DonateButton({ size = "" }: { size?: string }) {
  const className = `lp-btn lp-btn-donate ${size}`.trim();

  // Поки банки немає, це справжня вимкнена кнопка, а не текст, схожий на
  // кнопку: скрінрідер оголосить її недоступною, а не змусить шукати, куди
  // вона веде.
  if (!DONATE_URL) {
    return (
      <button
        type="button"
        disabled
        className={`${className} lp-btn-pending`}
        title="Посилання на банку буде додано найближчим часом"
      >
        Задонатити
      </button>
    );
  }

  return (
    <a className={className} href={DONATE_URL} target="_blank" rel="noopener noreferrer">
      Задонатити
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Контент секцій                                                      */
/* ------------------------------------------------------------------ */

const TEACHER_POINTS = [
  {
    icon: "📋",
    title: "Журнал уроку",
    text:
      "Рядок, це учень, стовпчик, це урок. Відмічаєте галочки, зірки " +
      "нараховуються самі, підсумок оновлюється тут же.",
  },
  {
    icon: "🎁",
    title: "Бонус і штраф поза уроком",
    text:
      "Три типи нарахувань однакові в кожному класі: Урок, Бонус, Штраф. " +
      "Нарахувати можна одному учню або всьому класу, з нотаткою, за що саме.",
  },
  {
    icon: "🚀",
    title: "Клас за кілька хвилин",
    text:
      "Майстер створення проведе кроками: назва, паралель, список учнів " +
      "рядками або імпорт з Excel чи CSV з обов'язковим прев'ю порядку слів.",
  },
  {
    icon: "🔑",
    title: "PIN-и і QR під рукою",
    text:
      "PIN кожного учня видно завжди, картки з іменем і PIN друкуються " +
      "на розріз, а вхід для класу, це QR-код або одне посилання.",
  },
  {
    icon: "📊",
    title: "Аналітика без зайвого",
    text:
      "Рейтинг класу, темп нарахувань, прогрес до класових нагород і " +
      "зведений підсумок по всіх ваших класах на одному екрані.",
  },
  {
    icon: "🗓️",
    title: "Семестр закінчується чесно",
    text:
      "Клас переїжджає в новий семестр: діти, групи й нагороди переносяться, " +
      "бали стартують з нуля, а старий семестр лишається в архіві тільки для читання.",
  },
];

const STUDENT_POINTS = [
  {
    icon: "🔓",
    title: "Вхід без акаунта",
    text:
      "Ні пошти, ні пароля, ні реєстрації. Посилання або QR від вчителя " +
      "плюс власний PIN, і учень уже на своїй сторінці.",
  },
  {
    icon: "⭐",
    title: "Своя сторінка",
    text:
      "Аватар, кількість зірок, місце в класі, прогрес до кожної нагороди " +
      "й уся історія нарахувань: за що і коли.",
  },
  {
    icon: "🔒",
    title: "Приватність за замовчуванням",
    text:
      "Сторінку учня бачить лише він сам і його вчитель. Відкрити чужий " +
      "профіль не вийде, навіть знаючи посилання: це перевіряє сама база даних.",
  },
  {
    icon: "👀",
    title: "Список класу, якщо ви дозволили",
    text:
      "Зірки однокласників вмикаються одним перемикачем. Вимкнено, кожен " +
      "бачить тільки себе.",
  },
];

const SETTINGS_CARDS = [
  {
    Icon: IconPrize,
    title: "Нагороди",
    text:
      "Свої назви, емодзі й поріг у зірках. Окремо особисті нагороди учня " +
      "й класові, які клас відкриває разом.",
  },
  {
    Icon: IconGroups,
    title: "Групи класу",
    text:
      "Ділите клас на групи так, як зручно саме вам. Видалення групи " +
      "нікого не прибирає з класу.",
  },
  {
    Icon: IconPrivacy,
    title: "Видимість зірок",
    text:
      "Один перемикач вирішує, чи бачать учні зірки однокласників і " +
      "спільний рейтинг класу.",
  },
  {
    Icon: IconPin,
    title: "PIN-и і доступ",
    text:
      "Показати, надрукувати картками або перегенерувати PIN. Старі сесії " +
      "при цьому обриваються самі.",
  },
  {
    Icon: IconAvatar,
    title: "Аватари й нікнейми",
    text:
      "Кожен учень отримує аватар і публічне ім'я. Прізвище в клас " +
      "стороннім не показується.",
  },
  {
    Icon: IconSemester,
    title: "Клас і семестр",
    text:
      "Назва, паралель, семестр, перехід у наступний і архів. Календар " +
      "семестрів вбудований, налаштовувати його не треба.",
  },
];

const FREE_POINTS = [
  "Безкоштовно для вчителя і для учнів, без платних тарифів",
  "Без реклами й без продажу даних",
  "Учні не заводять акаунтів: ні пошт, ні паролів у системі немає",
  "Українською, з нашим календарем навчального року",
];

/* ------------------------------------------------------------------ */
/* Сторінка                                                            */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="lp-root">
      {/* -------------------------------------------------- Шапка -- */}
      <header className="lp-nav">
        <span className="lp-logo">
          <LogoStar />
          StarBoard
        </span>
        <nav className="lp-nav-actions">
          <Link className="lp-btn lp-btn-sm lp-btn-secondary" href={REGISTER_URL}>
            Зареєструватися
          </Link>
          <DonateButton size="lp-btn-sm" />
        </nav>
      </header>

      {/* --------------------------------------------------- Герой -- */}
      <section className="lp-section lp-split" style={{ paddingTop: 40 }}>
        <div>
          <span className="lp-eyebrow">Безкоштовно · Українською · Бета</span>
          <h1 className="lp-h1" style={{ marginTop: 20 }}>
            Зірки, які <span className="lp-mark">видно всьому класу</span>
          </h1>
          <p className="lp-lead">
            StarBoard, це дошка зірок для класу. Вчитель відмічає зірки прямо в
            журналі уроку, а кожен учень зі свого телефона бачить власний
            прогрес і те, скільки лишилось до наступної нагороди.
          </p>

          <div className="lp-btn-row">
            <Link className="lp-btn lp-btn-primary" href={BETA_URL}>
              Включити бета-версію
            </Link>
            <Link className="lp-btn lp-btn-secondary" href={REGISTER_URL}>
              Зареєструватися
            </Link>
            <DonateButton />
          </div>
        </div>

        <div className="lp-split-visual">
          <HeroLoop />
        </div>
      </section>

      {/* ------------------------------------------------- Вчитель -- */}
      <section className="lp-section" id="vchytel">
        <div className="lp-split">
          <div className="lp-split-visual">
            <TeacherJournal />
          </div>
          <div>
            <h2 className="lp-h2">
              Як це бачить <span className="lp-mark">вчитель</span>
            </h2>
            <p className="lp-lead">
              Один екран на весь урок. Ви відкриваєте журнал класу, відмічаєте
              тих, хто заробив зірку, і закриваєте ноутбук. Усе інше рахується
              саме.
            </p>
            <ul className="lp-list">
              {TEACHER_POINTS.map((p) => (
                <li key={p.title}>
                  <span className="lp-list-icon" aria-hidden="true">
                    {p.icon}
                  </span>
                  <span>
                    <b>{p.title}</b>
                    <span>{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Учень -- */}
      <section className="lp-section" id="uchen">
        <div className="lp-split">
          <div>
            <h2 className="lp-h2">
              Як це бачить <span className="lp-mark lp-mark-green">учень</span>
            </h2>
            <p className="lp-lead">
              Дитина відкриває посилання, вводить свій PIN і одразу опиняється
              на власній сторінці. Ніяких паролів, ніякої реєстрації, нічого
              чужого.
            </p>
            <ul className="lp-list">
              {STUDENT_POINTS.map((p) => (
                <li key={p.title}>
                  <span className="lp-list-icon" aria-hidden="true">
                    {p.icon}
                  </span>
                  <span>
                    <b>{p.title}</b>
                    <span>{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-split-visual">
            <StudentPhone />
          </div>
        </div>
      </section>

      {/* -------------------------------------------- Налаштування -- */}
      <section className="lp-section" id="nalashtuvannia">
        <div className="lp-section-head">
          <h2 className="lp-h2">
            Що можна <span className="lp-mark">налаштувати</span>
          </h2>
          <p className="lp-lead">
            Програма нагород у кожного вчителя своя, тож усе, що стосується
            саме вашого класу, ви змінюєте самі й будь-коли.
          </p>
        </div>

        <div className="lp-grid">
          {SETTINGS_CARDS.map(({ Icon, title, text }) => (
            <article className="lp-card" key={title}>
              <Icon />
              <h3 className="lp-h3">{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------- Безкоштовно -- */}
      <section className="lp-section" id="bezkoshtovno">
        <div className="lp-free">
          <div>
            <h2 className="lp-h2">
              Це <span className="lp-mark lp-mark-green">безкоштовно</span>
            </h2>
            <p className="lp-lead" style={{ marginTop: 14 }}>
              StarBoard роблять для українських вчителів, а не для продажу.
              Донат допомагає тримати сервіс живим, але користуватись можна й
              без нього.
            </p>
            <ul className="lp-checklist">
              {FREE_POINTS.map((point) => (
                <li key={point}>
                  <CheckBadge />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="lp-btn-row">
              <Link className="lp-btn lp-btn-primary" href={REGISTER_URL}>
                Зареєструватися
              </Link>
              <DonateButton />
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div className="lp-price">
              <span className="lp-price-num">0</span>
              <span className="lp-price-cur">грн</span>
            </div>
            <p style={{ fontWeight: 800, marginTop: 8, fontSize: "0.95rem" }}>
              за вчителя, за клас і за учня
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- Відео-тур -- */}
      <section className="lp-section" id="video">
        <div className="lp-section-head">
          <h2 className="lp-h2">
            Відео-<span className="lp-mark">туторіал</span>
          </h2>
          <p className="lp-lead">
            Повний прохід від створення класу до першої нагороди, за кілька
            хвилин.
          </p>
        </div>

        <div className="lp-video-frame">
          {VIDEO_EMBED_URL ? (
            <iframe
              src={VIDEO_EMBED_URL}
              title="Відео-туторіал StarBoard"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div className="lp-video-empty">
              <PlayGlyph />
              <p>
                Місце для відео-туторіала. Щоб увімкнути, вставте посилання
                ембеда в константу <code>VIDEO_EMBED_URL</code> у файлі{" "}
                <code>app/page.tsx</code>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* --------------------------------------- Фінальний заклик -- */}
      <section className="lp-cta">
        <h2 className="lp-h2">Спробуйте на своєму класі</h2>
        <p className="lp-lead">
          Бета вже працює. Заводьте клас, роздрукуйте PIN-и і проведіть перший
          урок із зірками вже завтра.
        </p>
        <div className="lp-btn-row">
          <Link className="lp-btn lp-btn-primary" href={BETA_URL}>
            Включити бета-версію
          </Link>
          <Link className="lp-btn lp-btn-secondary" href={REGISTER_URL}>
            Зареєструватися
          </Link>
          <DonateButton />
        </div>
        <p className="lp-note">
          Бета означає, що щось може змінитись. Дані ваших класів при цьому
          нікуди не діваються.
        </p>
      </section>
    </div>
  );
}
