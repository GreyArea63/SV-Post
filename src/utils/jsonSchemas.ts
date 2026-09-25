// ============================================================
// JSON Schema для автодополнения полей запросов
// ============================================================

/**
 * Схема для запроса "Создать продукт" (M30 / GOA products)
 * На основе вашего примера из скриншота.
 */
export const M30_PRODUCT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    objectId: {
      type: 'string',
      description: 'ID объекта (пусто для нового)',
    },
    itemID: {
      type: 'string',
      description: 'ID товара (штрихкод/SKU)',
      examples: ['19000546703'],
    },
    labelName: {
      type: 'string',
      description: 'Наименование товара',
      examples: ['Парфюмерная вода Aqua zenzero 30мл'],
    },
    brand: {
      type: 'string',
      description: 'Бренд',
    },
    shelfLifeDays: {
      type: 'number',
      description: 'Срок годности в днях',
      examples: [1825],
    },
    shelfLifeShipment: {
      type: 'number',
      description: 'Срок годности отгрузки в днях',
      examples: [120],
    },
    stickerSign: {
      type: ['string', 'null'],
      description: 'Признак стикера',
    },
    markcode: {
      type: 'number',
      description: 'Код маркировки',
      examples: [1, 2],
    },
    ecomCategoryLevel1: {
      type: 'string',
      description: 'E-commerce категория, уровень 1',
    },
    ecomCategoryLevel2: {
      type: 'string',
      description: 'E-commerce категория, уровень 2',
    },
    ecomCategoryLevel3: {
      type: 'string',
      description: 'E-commerce категория, уровень 3',
    },
    priceCategoryLevel1: {
      type: 'string',
      description: 'Ценовая категория, уровень 1',
    },
    priceCategoryLevel2: {
      type: 'string',
      description: 'Ценовая категория, уровень 2',
    },
    priceCategoryLevel3: {
      type: 'string',
      description: 'Ценовая категория, уровень 3',
    },
    supplierArticle: {
      type: ['string', 'null'],
      description: 'Артикул поставщика',
    },
    productGroupId: {
      type: 'string',
      description: 'ID товарной группы',
      examples: ['chemistry', 'perfum'],
    },
    lastDateMarking: {
      type: 'string',
      description: 'Последняя дата маркировки (YYYY-MM-DD)',
      examples: ['2025-10-01'],
    },
    snMask: {
      type: 'string',
      description: 'Маска серийного номера',
    },
    barcodes: {
      type: ['array', 'null'],
      description: 'Штрихкоды',
      items: { type: 'string' },
    },
  },
  additionalProperties: true,  // разрешаем любые доп. поля
};

/**
 * Схема для PATCH-запроса "Меняем статус заказа" (preparation-waves).
 */
export const PREPARATION_WAVE_STATUS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Тип ресурса',
          examples: ['preparation-waves'],
        },
        id: {
          type: 'string',
          description: 'ID ресурса (UUID)',
        },
        attributes: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Новый статус',
              examples: ['new', 'in_progress', 'done', 'cancelled'],
              enum: ['new', 'in_progress', 'done', 'cancelled'],
            },
          },
        },
      },
    },
  },
  additionalProperties: true,
};

/**
 * Универсальная схема — без строгих ограничений.
 * Используется по умолчанию, если нет специфичной схемы.
 */
export const GENERIC_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: true,
};