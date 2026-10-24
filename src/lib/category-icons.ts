/**
 * Íconos de categoría (Phosphor, peso regular). Cada uno lleva su emoji
 * equivalente, que siguen usando Telegram y el correo, y un nombre para lectores de pantalla.
 * Los componentes viven en src/components/category-icon.tsx con las mismas claves.
 */
export const CATEGORY_ICONS = {
  "fork-knife": { emoji: "🍔", label: "Cubiertos" },
  taxi: { emoji: "🚕", label: "Taxi" },
  "shopping-cart": { emoji: "🛒", label: "Carrito" },
  "graduation-cap": { emoji: "🎓", label: "Birrete" },
  pill: { emoji: "💊", label: "Pastilla" },
  confetti: { emoji: "🎉", label: "Fiesta" },
  television: { emoji: "📺", label: "Televisor" },
  "shopping-bag": { emoji: "🛍️", label: "Bolsa de compras" },
  lightbulb: { emoji: "💡", label: "Bombillo" },
  house: { emoji: "🏠", label: "Casa" },
  package: { emoji: "📦", label: "Caja" },
  "calendar-check": { emoji: "🗓️", label: "Calendario" },
  gift: { emoji: "🎁", label: "Regalo" },
  briefcase: { emoji: "💼", label: "Maletín" },
  coins: { emoji: "💰", label: "Monedas" },
  coffee: { emoji: "☕", label: "Café" },
  pizza: { emoji: "🍕", label: "Pizza" },
  cookie: { emoji: "🍪", label: "Galleta" },
  "beer-stein": { emoji: "🍺", label: "Cerveza" },
  wine: { emoji: "🍷", label: "Vino" },
  bus: { emoji: "🚌", label: "Bus" },
  motorcycle: { emoji: "🏍️", label: "Moto" },
  bicycle: { emoji: "🚲", label: "Bicicleta" },
  "gas-pump": { emoji: "⛽", label: "Gasolina" },
  "airplane-tilt": { emoji: "✈️", label: "Avión" },
  "device-mobile": { emoji: "📱", label: "Celular" },
  laptop: { emoji: "💻", label: "Portátil" },
  barbell: { emoji: "🏋️", label: "Gimnasio" },
  "first-aid": { emoji: "🩹", label: "Botiquín" },
  "book-open": { emoji: "📚", label: "Libro" },
  "game-controller": { emoji: "🎮", label: "Videojuegos" },
  "film-slate": { emoji: "🎬", label: "Cine" },
  popcorn: { emoji: "🍿", label: "Crispetas" },
  "music-notes": { emoji: "🎵", label: "Música" },
  "t-shirt": { emoji: "👕", label: "Ropa" },
  scissors: { emoji: "✂️", label: "Tijeras" },
  basket: { emoji: "🧺", label: "Canasta" },
  "paw-print": { emoji: "🐶", label: "Mascota" },
  baby: { emoji: "👶", label: "Bebé" },
  heart: { emoji: "❤️", label: "Corazón" },
  wrench: { emoji: "🔧", label: "Arreglos" },
  receipt: { emoji: "🧾", label: "Factura" },
  bank: { emoji: "🏦", label: "Banco" },
  "hand-coins": { emoji: "💸", label: "Pago" },
} as const;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as [CategoryIconKey, ...CategoryIconKey[]];

export function isCategoryIcon(value: unknown): value is CategoryIconKey {
  return typeof value === "string" && Object.hasOwn(CATEGORY_ICONS, value);
}

/** Emoji para Telegram y el correo a partir del ícono. */
export function emojiForIcon(icon: CategoryIconKey): string {
  return CATEGORY_ICONS[icon].emoji;
}
