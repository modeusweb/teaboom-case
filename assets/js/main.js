// Логика карточки товара: фасовки, галерея, лайтбокс, «В корзину».
// Все данные — в data-атрибутах разметки, без скрипта она тоже работает.

const LABEL_DEFAULT = "В корзину";
const LABEL_ADDED = "Добавлено";
const ADDED_STATE_DURATION = 2000;
const RUBLE = "\u00A0\u20BD";
const MINUS = "\u2212";

const priceFormatters = {
  integer: new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }),
  fractional: new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

// копейки показываем только если есть: «326,40 ₽» и «1 432 ₽»
const formatPrice = (value) => {
  const formatter = Number.isInteger(value) ? priceFormatters.integer : priceFormatters.fractional;

  return `${formatter.format(value)}${RUBLE}`;
};

const getDiscount = (price, oldPrice) => {
  if (!oldPrice || oldPrice <= price) {
    return 0;
  }

  return Math.round((1 - price / oldPrice) * 100);
};

// подпись фасовки из разметки, например "500 г"
const getWeight = (input) => {
  const box = input.closest(".packaging__option");

  return box?.querySelector(".packaging__weight")?.textContent.trim() ?? "";
};

const initProductCard = () => {
  const card = document.querySelector("[data-product-card]");

  if (!card) {
    return;
  }

  const form = card.querySelector("[data-cart-form]");
  const packaging = card.querySelector("[data-packaging]");
  const priceCurrent = card.querySelector("[data-price-current]");
  const priceOld = card.querySelector("[data-price-old]");
  const discountBadge = card.querySelector("[data-price-discount]");
  const skuOutput = card.querySelector("[data-sku]");
  const stockOutput = card.querySelector("[data-stock]");
  const button = card.querySelector("[data-add-to-cart]");
  const buttonLabel = card.querySelector("[data-add-to-cart-label]");
  const status = card.querySelector("[data-status]");
  const productName = card.dataset.productName ?? "";

  let addedTimer = null;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const renderVariant = (input, announce = false) => {
    const price = Number.parseFloat(input.dataset.price);
    const oldPrice = Number.parseFloat(input.dataset.oldPrice);
    const weight = getWeight(input);
    const discount = getDiscount(price, oldPrice);

    priceCurrent.textContent = formatPrice(price);

    if (discount > 0) {
      priceOld.textContent = formatPrice(oldPrice);
      priceOld.hidden = false;
      discountBadge.textContent = `${MINUS}${discount}%`;
      discountBadge.hidden = false;
    } else {
      priceOld.hidden = true;
      discountBadge.hidden = true;
    }

    skuOutput.textContent = input.dataset.sku;
    stockOutput.textContent = input.dataset.stock;
    button.setAttribute("aria-label", `Добавить в корзину: ${productName}, ${weight}`);

    if (announce) {
      setStatus(`Фасовка ${weight}: ${formatPrice(price)}, артикул ${input.dataset.sku}`);
    }
  };

  const resetButtonState = () => {
    button.classList.remove("is-added");
    buttonLabel.textContent = LABEL_DEFAULT;
    addedTimer = null;
  };

  // корзины нет — просто показываем отклик кнопки
  const handleSubmit = (event) => {
    event.preventDefault();

    const input = packaging.querySelector('input[name="packaging"]:checked');

    if (!input) {
      return;
    }

    clearTimeout(addedTimer);
    button.classList.add("is-added");
    buttonLabel.textContent = LABEL_ADDED;
    addedTimer = setTimeout(resetButtonState, ADDED_STATE_DURATION);

    setStatus(`${productName}, ${getWeight(input)}: товар добавлен в корзину`);
  };

  const initialInput = packaging.querySelector('input[name="packaging"]:checked');

  if (initialInput) {
    renderVariant(initialInput);
  }

  packaging.addEventListener("change", (event) => {
    if (event.target.matches('input[name="packaging"]')) {
      renderVariant(event.target, true);
    }
  });

  form.addEventListener("submit", handleSubmit);
};

// Миниатюры галереи: клик переключает главное фото, активная плитка
// получает is-active и aria-current
const initGallery = () => {
  const gallery = document.querySelector("[data-gallery]");
  const mainImage = gallery?.querySelector("[data-gallery-image]");
  const thumbs = gallery ? [...gallery.querySelectorAll("[data-gallery-thumb]")] : [];

  if (!gallery || !mainImage || thumbs.length === 0) {
    return;
  }

  const setActive = (thumb) => {
    thumbs.forEach((item) => {
      const isActive = item === thumb;

      item.classList.toggle("is-active", isActive);

      if (isActive) {
        item.setAttribute("aria-current", "true");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  };

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const source = thumb.querySelector("img");
      const nextSrc = source?.currentSrc || source?.src;

      // Клик по уже открытой миниатюре ничего не меняет
      if (!nextSrc || nextSrc === mainImage.src) {
        return;
      }

      setActive(thumb);
      mainImage.classList.add("is-swapping");

      // грузим кадр заранее, чтобы не мигало
      const preload = new Image();

      preload.onload = () => {
        mainImage.src = nextSrc;
        mainImage.alt = thumb.dataset.galleryAlt ?? "";

        // двойной rAF, чтобы проявление через opacity успело анимироваться
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mainImage.classList.remove("is-swapping");
          });
        });
      };
      preload.src = nextSrc;
    });
  });
};

// Лайтбокс на <dialog>: фокус-ловушка и возврат фокуса — нативные
const initLightbox = () => {
  const lightbox = document.querySelector("[data-lightbox]");
  const trigger = document.querySelector("[data-lightbox-trigger]");
  const closeButton = lightbox?.querySelector("[data-lightbox-close]");
  const galleryImage = document.querySelector("[data-gallery-image]");
  const lightboxImage = lightbox?.querySelector("[data-lightbox-image]");

  if (!lightbox || !trigger) {
    return;
  }

  // старые браузеры без <dialog> — просто открываем в новой вкладке
  if (typeof lightbox.showModal !== "function") {
    trigger.addEventListener("click", () => {
      const src = galleryImage?.src ?? trigger.querySelector("img")?.src;

      if (src) {
        window.open(src, "_blank", "noopener");
      }
    });

    return;
  }

  trigger.addEventListener("click", () => {
    // Лайтбокс всегда показывает текущий кадр галереи
    if (galleryImage && lightboxImage) {
      lightboxImage.src = galleryImage.src;
      lightboxImage.alt = galleryImage.alt;
    }

    lightbox.showModal();
  });

  closeButton?.addEventListener("click", () => {
    lightbox.close();
  });

  // Клик по подложке вокруг фото тоже закрывает лайтбокс
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      lightbox.close();
    }
  });
};

initProductCard();
initGallery();
initLightbox();
