// Palabras clave integradas para las categorías por defecto (por `categories.key`).
// Están en texto plegado (minúsculas, sin tildes). Pueden ser de varias palabras.
// Incluyen los gastos reales que Jacobo registraba en Notion (Yango, "Diddi", mecato…).

export const DEFAULT_KEYWORDS: Record<string, string[]> = {
  comida: [
    "almuerzo", "desayuno", "desayun", "cena", "comida", "onces", "corrientazo",
    "restaurante", "empanada", "empanadas", "arepa", "cafe", "tinto", "pizza",
    "hamburguesa", "perro caliente", "salchipapa", "pollo", "sushi", "helado", "postre",
    "panaderia", "pan", "donas", "dona", "mecato", "snack", "paquete", "galletas",
    "chocolatina", "bombonbum", "dulce", "dulces", "gaseosa", "coca cola", "cocacola",
    "jugo", "agua", "h2o", "rappi", "ifood", "domicilio", "mcdonalds", "frisby", "kfc",
    "crepes", "juan valdez", "starbucks", "oma", "el corral", "subway",
  ],
  transporte: [
    "uber", "didi", "diddi", "yango", "cabify", "indrive", "picap", "taxi", "bus",
    "buseta", "transmilenio", "sitp", "metro", "mio", "pasaje", "pasajes", "gasolina",
    "tanqueada", "parqueadero", "peaje", "soat", "tecnomecanica", "moto", "scooter",
    "vuelo", "avianca", "latam", "wingo", "terminal",
  ],
  tienda: [
    "tienda", "cosas tienda", "mercado", "supermercado", "exito", "carulla", "d1", "ara",
    "olimpica", "jumbo", "makro", "isimo", "leche", "huevos", "pan tajado", "verduras",
    "fruta", "frutas", "carne", "fruver", "aseo",
  ],
  universidad: [
    "universidad", "u", "semestre", "matricula", "fotocopias", "copias", "impresiones",
    "papeleria", "cuaderno", "libro", "libros", "curso", "clases", "platzi", "udemy",
    "coursera", "ingles", "parcial", "trabajo u",
  ],
  salud: [
    "drogueria", "farmacia", "medicina", "medicamento", "medicamentos", "pastillas",
    "acetaminofen", "pasedol", "dolex", "medico", "cita medica", "eps", "odontologo",
    "dentista", "examenes", "laboratorio", "optica", "gafas", "psicologo", "terapia",
    "gimnasio", "gym", "smartfit", "bodytech", "vitaminas",
  ],
  entretenimiento: [
    "cine", "cinecolombia", "cinemark", "fiesta", "rumba", "cerveza", "cervezas",
    "trago", "bar", "discoteca", "concierto", "boletas", "teatro", "partido",
    "videojuego", "juego", "steam", "playstation", "xbox", "nintendo", "paseo",
    "fin de semana", "salida", "viaje", "hotel", "airbnb",
  ],
  suscripciones: [
    "netflix", "spotify", "disney", "hbo", "prime video", "amazon prime",
    "youtube premium", "apple music", "icloud", "google one", "chatgpt", "claude",
    "suscripcion", "membresia", "crunchyroll", "paramount", "deezer",
  ],
  compras: [
    "ropa", "zapatos", "tenis", "camisa", "pantalon", "amazon", "mercadolibre",
    "mercado libre", "falabella", "alkosto", "ktronix", "homecenter", "temu", "shein",
    "regalo para", "audifonos", "computador", "portatil", "tecla", "teclado", "mouse",
    "cargador", "celular nuevo", "zara",
  ],
  servicios: [
    "luz", "gas", "internet", "energia", "acueducto", "epm", "enel", "codensa", "vanti",
    "claro", "movistar", "tigo", "wom", "etb", "plan celular", "recarga", "datos",
  ],
  vivienda: [
    "arriendo", "administracion", "hipoteca", "muebles", "reparacion", "plomero",
    "ferreteria",
  ],
  cuota_semanal: ["cuota semanal", "semanal", "mesada", "cuota"],
  regalos: ["regalo", "me regalaron", "regalo mama", "regalo papa", "regalo abuela"],
  salario: ["salario", "sueldo", "nomina", "quincena", "prima", "cesantias", "pago trabajo"],
};
