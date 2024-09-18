import fetch from "node-fetch";
import * as cheerio from "cheerio";

const url =
    "https://www.adidas.com.ar/calzado-zapatillas-hombre?price_max=47998&price_min=1000&sort=price-low-to-high&v_size_es_ar=40_uk_8";

const TELEGRAM_TOKEN = "7805454239:AAF0GEgM9JYf9bEkP1mLiPIkyNgsX3UWMlA";
const CHAT_ID = "6448309014";

async function sendMessage(message) {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
        method: "POST",
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown",
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function checkProductAvailability(link) {
    const response = await fetch(link, {
        method: "GET",
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const isOutOfStock =
        $("h2.sold-out-callout_title___1u2ms").text().trim() ===
        "Próximamente disponible";
    const hasAlternativeButton =
        $("span.gl-cta__content").filter(
            (i, el) => $(el).text().trim() === "BUSCAR ALTERNATIVAS",
        ).length > 0;

    return !(isOutOfStock || hasAlternativeButton); // Devuelve true si el producto está disponible
}

async function fetchProductLinks() {
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                await sendMessage("No se encuentra la página.");
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const products = [];

        $('article[data-testid="plp-product-card"]').each((index, product) => {
            // Verifica si el producto está agotado
            const isOutOfStock =
                $(product).find("div.gl-price-item").text().trim() ===
                "Agotado";

            // Solo se agrega el producto si está disponible
            if (!isOutOfStock) {
                const productLink = $(product)
                    .find('a[data-testid="product-card-description-link"]')
                    .attr("href");
                const priceText = $(product)
                    .find('div[data-testid="primary-price"]')
                    .text()
                    .trim();

                if (productLink) {
                    products.push({
                        link: `https://www.adidas.com.ar${productLink}`,
                        price: priceText,
                    });
                }
            }
        });

        // Filtrar los productos no disponibles
        const availableProducts = [];
        for (const product of products) {
            const isAvailable = await checkProductAvailability(product.link);
            if (isAvailable) {
                availableProducts.push(product);
            }
        }

        if (availableProducts.length > 0) {
            let message = "Productos disponibles:\n";
            availableProducts.forEach((product) => {
                message += `Enlace: ${product.link}, Precio: ${product.price}\n`;
            });
            await sendMessage(message);
        } else {
            await sendMessage("No hay productos disponibles.");
        }
    } catch (error) {
        console.error("Error al realizar la solicitud:", error);
    }
}

// Ejecutar la función inmediatamente y luego cada 10 minutos
fetchProductLinks();
setInterval(fetchProductLinks, 100000); // 600000 ms = 10 minutos
