/**
 * Відеотуторіал StarBoard.
 *
 * Один ідентифікатор Loom на дві адреси: вбудований плеєр у кабінеті і
 * звичайне посилання для сторінки входу. Тримається в одному місці, щоб
 * замінити відео можна було правкою одного рядка, а не пошуком по проєкту.
 */

const LOOM_ID = "c4a2b5c4ed2346299fdb51f887286e96";

/** Для <iframe> у картці кабінету. */
export const TUTORIAL_EMBED_URL = `https://www.loom.com/embed/${LOOM_ID}`;

/** Для посилання, яке відкривається окремою вкладкою. */
export const TUTORIAL_SHARE_URL = `https://www.loom.com/share/${LOOM_ID}`;
