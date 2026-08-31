import type { Metadata } from "next";
import Link from "next/link";
import "../landing.css";
import {
  CalendarBlank,
  CheckCircle,
  Eye,
  Gift,
  IdentificationCard,
  Key,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { LogoStar, PlayGlyph, RewardFlow } from "@/components/Landing/LandingArt";
import {
  AnalyticsMock,
  EntryMock,
  JournalMock,
  StudentMock,
} from "@/components/Landing/AppMock";

/**
 * Лендінг StarBoard, ТИМЧАСОВО ВІДКЛЮЧЕНИЙ (живий фідбек перед релізом).
 *
 * Тека з підкресленням на початку, це private folder Next: файли в ній не
 * стають маршрутами. Тобто сторінка нікуди не веде і ззовні недоступна,
 * але код цілий і повертається на "/" однією командою git mv, коли
 * лендінгом займатимуться всерйоз.
 *
 * Порядок екранів заданий живим фідбеком: спершу відео, далі петля з
 * літаючою зіркою, далі перемикач між справжніми екранами продукту, далі
 * налаштування, далі «безкоштовно».
 *
 * Довгих списків вигод тут навмисно немає: замість переліку переваг
 * сторінка показує самі екрани (components/Landing/AppMock.tsx), а текст
 * лишається підписом до них.
 *
 * "/" більше не редіректить на /admin. Кабінет живе за кнопкою «Спробувати
 * бета-версію»: вчитель із сесією потрапляє в /admin одразу, без сесії
 * middleware сам поверне на /admin/login.
 *
 * Клієнтського JS немає: перемикач екранів зроблено на радіо-кнопках і
 * :checked, іконки беруться з SSR-входу Phosphor.
 */

/* ------------------------------------------------------------------ */
/* Посилання, які змінюються найчастіше. Тримаємо разом і зверху.       */
/* ------------------------------------------------------------------ */

/** Кабінет вчителя. Без сесії middleware сам поверне на /admin/login. */
const BETA_URL = "/admin";

/** Реєстрація нового вчителя. */
const REGISTER_URL = "/register";

/**
 * Банка для донатів. Поки порожньо, кнопка лишається на місці, але
 * вимкнена. Щоб увімкнути, досить вставити сюди посилання.
 */
const DONATE_URL = "";

/**
 * Відео-туторіал на першому екрані. Сюди йде саме src ембеда, а не код
 * усього <iframe>:
 *   YouTube   https://www.youtube.com/embed/ВІДЕО_ID
 *   Vimeo     https://player.vimeo.com/video/ВІДЕО_ID
 * Поки порожньо, у рамці стоїть заглушка.
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
/* Дані секцій                                                         */
/* ------------------------------------------------------------------ */

const SCREENS = [
  {
    id: "journal",
    tab: "Журнал",
    caption:
      "Рядок, це учень, стовпчик, це урок. Сьогоднішній урок підсвічений, " +
      "підсумок зірок рахується сам.",
  },
  {
    id: "entry",
    tab: "Нарахування",
    caption: "Бонус або штраф поза уроком: одному учню чи всьому класу, з нотаткою, за що.",
  },
  {
    id: "stats",
    tab: "Аналітика",
    caption: "Рейтинг класу, темп і ефективність. По одному класу або по всіх одразу.",
  },
  {
    id: "student",
    tab: "Сторінка учня",
    caption:
      "Те, що бачить дитина після входу за PIN. Чужий профіль не відкриється " +
      "ні з посилання, ні в обхід.",
  },
] as const;

const SETTINGS = [
  { Icon: Gift, title: "Нагороди", text: "Свої назви, емодзі й поріг у зірках. Особисті та класові." },
  { Icon: Eye, title: "Видимість зірок", text: "Чи бачать учні зірки однокласників і рейтинг класу." },
  { Icon: Key, title: "PIN-и і доступи", text: "Показати, надрукувати картками, перегенерувати." },
  { Icon: IdentificationCard, title: "Аватари й нікнейми", text: "Публічне ім'я учня замість прізвища." },
  { Icon: UsersThree, title: "Групи класу", text: "Поділ класу так, як зручно саме вам." },
  { Icon: CalendarBlank, title: "Клас і семестри", text: "Назва, паралель, перехід у новий семестр, архів." },
];

const FREE_CHIPS = [
  "Без тарифів і без реклами",
  "Учні не заводять акаунтів",
  "Українською, з нашим календарем",
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
        {/* На вузькому екрані в шапці лишається одна дія: три кнопки в
            стовпчик з'їдали пів першого екрана, а точно ті самі три стоять
            одразу під відео. */}
        <nav className="lp-nav-actions">
          <Link className="lp-btn lp-btn-sm lp-btn-secondary lp-nav-hide-sm" href={REGISTER_URL}>
            Зареєструватися
          </Link>
          <Link className="lp-btn lp-btn-sm lp-btn-primary" href={BETA_URL}>
            Спробувати бета-версію
          </Link>
          <DonateButton size="lp-btn-sm lp-nav-hide-sm" />
        </nav>
      </header>

      {/* ------------------------------- Екран 1: відео-туторіал -- */}
      <section className="lp-hero">
        <div className="lp-center" style={{ maxWidth: "62ch" }}>
          <span className="lp-eyebrow">Безкоштовно · Українською · Бета</span>
          <h1 className="lp-h1" style={{ marginTop: 18 }}>
            Дошка зірок, <span className="lp-mark">яку веде вчитель</span>
          </h1>
          <p className="lp-lead">
            Подивіться, як це працює, за кілька хвилин.
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
                Місце для відео. Щоб увімкнути, вставте посилання ембеда в
                константу <code>VIDEO_EMBED_URL</code> у файлі{" "}
                <code>app/page.tsx</code>.
              </p>
            </div>
          )}
        </div>

        <div className="lp-center">
          <div className="lp-btn-row">
            <Link className="lp-btn lp-btn-primary" href={BETA_URL}>
              Спробувати бета-версію
            </Link>
            <Link className="lp-btn lp-btn-secondary" href={REGISTER_URL}>
              Зареєструватися
            </Link>
            <DonateButton />
          </div>
        </div>
      </section>

      {/* ------------------------------- Екран 2: літаюча зірка -- */}
      <section className="lp-section" id="yak-pratsiuie">
        <div className="lp-section-head lp-center">
          <h2 className="lp-h2">
            Одна зірка, <span className="lp-mark">весь шлях</span>
          </h2>
          <p className="lp-lead">
            Вчитель ставить зірку в журналі, учень бачить її в себе, зірки
            складаються в нагороду.
          </p>
        </div>

        <div className="lp-flow">
          <RewardFlow />
        </div>
      </section>

      {/* ---------------------- Екран 3: справжні екрани продукту -- */}
      <section className="lp-section" id="ekrany">
        <div className="lp-section-head">
          <h2 className="lp-h2">
            Так це виглядає <span className="lp-mark">насправді</span>
          </h2>
          <p className="lp-lead">
            Чотири екрани, з яких складається робота: три у вчителя, один в учня.
          </p>
        </div>

        <div className="lp-tabs">
          {SCREENS.map((s, i) => (
            <input
              key={s.id}
              type="radio"
              name="lp-screen"
              id={`lp-tab-${s.id}`}
              className="lp-tab-input"
              defaultChecked={i === 0}
            />
          ))}

          <div className="lp-tab-bar" role="tablist">
            {SCREENS.map((s) => (
              <label key={s.id} className="lp-tab" htmlFor={`lp-tab-${s.id}`}>
                {s.tab}
              </label>
            ))}
          </div>

          <div className="lp-tab-panels">
            <div className="lp-tab-panel lp-panel-journal">
              <JournalMock />
              <p className="lp-tab-caption">{SCREENS[0].caption}</p>
            </div>
            <div className="lp-tab-panel lp-panel-entry">
              <EntryMock />
              <p className="lp-tab-caption">{SCREENS[1].caption}</p>
            </div>
            <div className="lp-tab-panel lp-panel-stats">
              <AnalyticsMock />
              <p className="lp-tab-caption">{SCREENS[2].caption}</p>
            </div>
            <div className="lp-tab-panel lp-panel-student">
              <StudentMock />
              <p className="lp-tab-caption">{SCREENS[3].caption}</p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------- Екран 4: налаштування -- */}
      <section className="lp-section" id="nalashtuvannia">
        <div className="lp-section-head">
          <h2 className="lp-h2">
            Що можна <span className="lp-mark">налаштувати</span>
          </h2>
          <p className="lp-lead">
            Програма нагород у кожного вчителя своя, тож усе своє ви міняєте самі.
          </p>
        </div>

        <div className="lp-grid">
          {SETTINGS.map(({ Icon, title, text }) => (
            <article className="lp-card" key={title}>
              <span className="lp-card-icon" aria-hidden="true">
                <Icon weight="bold" />
              </span>
              <h3 className="lp-h3">{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------------- Екран 5: безкоштовно -- */}
      <section className="lp-section" id="bezkoshtovno">
        <div className="lp-free">
          <h2 className="lp-h2">
            Це <span className="lp-mark lp-mark-green">безкоштовно</span>
          </h2>
          <p className="lp-lead">
            StarBoard роблять для українських вчителів, а не для продажу. Донат
            допомагає тримати сервіс живим, але користуватись можна й без нього.
          </p>

          <div className="lp-free-chips">
            {FREE_CHIPS.map((chip) => (
              <span className="lp-chip" key={chip}>
                <CheckCircle weight="fill" size={18} />
                {chip}
              </span>
            ))}
          </div>

          <div className="lp-btn-row">
            <Link className="lp-btn lp-btn-primary" href={REGISTER_URL}>
              Зареєструватися
            </Link>
            <DonateButton />
          </div>
        </div>
      </section>

      {/* --------------------------------- Фінальний заклик -- */}
      <section className="lp-cta">
        <h2 className="lp-h2">Спробуйте на своєму класі</h2>
        <p className="lp-lead">
          Бета вже працює. Заводьте клас, роздрукуйте PIN-и і проведіть перший
          урок із зірками вже завтра.
        </p>
        <div className="lp-btn-row">
          <Link className="lp-btn lp-btn-primary" href={BETA_URL}>
            Спробувати бета-версію
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
