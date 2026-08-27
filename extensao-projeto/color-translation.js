(function initializeKicksColorTranslator(globalScope) {
  'use strict';

  const COLOR_TERMS = new Map([
    ['黑金', 'Preto e Dourado'],
    ['黑银', 'Preto e Prateado'],
    ['黑白', 'Preto e Branco'],
    ['黑红', 'Preto e Vermelho'],
    ['黑蓝', 'Preto e Azul'],
    ['黑绿', 'Preto e Verde'],
    ['白黑', 'Branco e Preto'],
    ['白红', 'Branco e Vermelho'],
    ['白蓝', 'Branco e Azul'],
    ['白绿', 'Branco e Verde'],
    ['红白', 'Vermelho e Branco'],
    ['红黑', 'Vermelho e Preto'],
    ['红蓝', 'Vermelho e Azul'],
    ['蓝白', 'Azul e Branco'],
    ['蓝黑', 'Azul e Preto'],
    ['蓝红', 'Azul e Vermelho'],
    ['绿白', 'Verde e Branco'],
    ['粉白', 'Rosa e Branco'],
    ['粉黑', 'Rosa e Preto'],
    ['紫白', 'Roxo e Branco'],
    ['米白色', 'Off-white'],
    ['象牙白', 'Marfim'],
    ['珍珠白', 'Branco perolado'],
    ['奶油白', 'Branco creme'],
    ['奶白色', 'Branco creme'],
    ['乳白色', 'Branco creme'],
    ['荧光绿色', 'Verde neon'],
    ['荧光绿', 'Verde neon'],
    ['荧光黄色', 'Amarelo neon'],
    ['荧光黄', 'Amarelo neon'],
    ['荧光粉色', 'Rosa neon'],
    ['荧光粉', 'Rosa neon'],
    ['藏青色', 'Azul-marinho'],
    ['海军蓝', 'Azul-marinho'],
    ['宝蓝色', 'Azul royal'],
    ['天空蓝', 'Azul-céu'],
    ['天蓝色', 'Azul-céu'],
    ['湖蓝色', 'Azul lago'],
    ['浅蓝色', 'Azul claro'],
    ['深蓝色', 'Azul escuro'],
    ['牛仔蓝', 'Azul jeans'],
    ['雾霾蓝', 'Azul acinzentado'],
    ['墨绿色', 'Verde escuro'],
    ['军绿色', 'Verde militar'],
    ['橄榄绿', 'Verde oliva'],
    ['浅绿色', 'Verde claro'],
    ['深绿色', 'Verde escuro'],
    ['草绿色', 'Verde grama'],
    ['果绿色', 'Verde maçã'],
    ['酒红色', 'Bordô'],
    ['玫红色', 'Rosa pink'],
    ['西瓜红', 'Vermelho melancia'],
    ['砖红色', 'Vermelho tijolo'],
    ['枣红色', 'Vermelho vinho'],
    ['浅灰色', 'Cinza claro'],
    ['深灰色', 'Cinza escuro'],
    ['银灰色', 'Cinza-prateado'],
    ['烟灰色', 'Cinza chumbo'],
    ['卡其色', 'Cáqui'],
    ['咖啡色', 'Marrom café'],
    ['巧克力色', 'Chocolate'],
    ['焦糖色', 'Caramelo'],
    ['驼色', 'Camel'],
    ['杏色', 'Damasco'],
    ['香槟色', 'Champanhe'],
    ['玫瑰金', 'Dourado rosé'],
    ['彩虹色', 'Arco-íris'],
    ['渐变色', 'Degradê'],
    ['多彩色', 'Multicolorido'],
    ['拼接色', 'Multicolorido'],
    ['透明色', 'Transparente'],
    ['白色', 'Branco'],
    ['黑色', 'Preto'],
    ['红色', 'Vermelho'],
    ['蓝色', 'Azul'],
    ['绿色', 'Verde'],
    ['黄色', 'Amarelo'],
    ['灰色', 'Cinza'],
    ['粉色', 'Rosa'],
    ['粉红', 'Rosa'],
    ['紫色', 'Roxo'],
    ['橙色', 'Laranja'],
    ['橘色', 'Laranja'],
    ['棕色', 'Marrom'],
    ['米色', 'Bege'],
    ['金色', 'Dourado'],
    ['银色', 'Prateado'],
    ['青色', 'Ciano'],
    ['褐色', 'Marrom'],
    ['白', 'Branco'],
    ['黑', 'Preto'],
    ['红', 'Vermelho'],
    ['蓝', 'Azul'],
    ['绿', 'Verde'],
    ['黄', 'Amarelo'],
    ['灰', 'Cinza'],
    ['粉', 'Rosa'],
    ['紫', 'Roxo'],
    ['橙', 'Laranja'],
    ['棕', 'Marrom'],
    ['金', 'Dourado'],
    ['银', 'Prateado'],
  ]);

  const ENGLISH_TERMS = new Map([
    ['off white', 'Off-white'],
    ['off-white', 'Off-white'],
    ['navy blue', 'Azul-marinho'],
    ['light blue', 'Azul claro'],
    ['dark blue', 'Azul escuro'],
    ['royal blue', 'Azul royal'],
    ['sky blue', 'Azul-céu'],
    ['light green', 'Verde claro'],
    ['dark green', 'Verde escuro'],
    ['olive green', 'Verde oliva'],
    ['neon green', 'Verde neon'],
    ['light grey', 'Cinza claro'],
    ['light gray', 'Cinza claro'],
    ['dark grey', 'Cinza escuro'],
    ['dark gray', 'Cinza escuro'],
    ['rose gold', 'Dourado rosé'],
    ['multicolor', 'Multicolorido'],
    ['multi color', 'Multicolorido'],
    ['rainbow', 'Arco-íris'],
    ['transparent', 'Transparente'],
    ['white', 'Branco'],
    ['black', 'Preto'],
    ['red', 'Vermelho'],
    ['blue', 'Azul'],
    ['green', 'Verde'],
    ['yellow', 'Amarelo'],
    ['grey', 'Cinza'],
    ['gray', 'Cinza'],
    ['pink', 'Rosa'],
    ['purple', 'Roxo'],
    ['violet', 'Violeta'],
    ['orange', 'Laranja'],
    ['brown', 'Marrom'],
    ['beige', 'Bege'],
    ['khaki', 'Cáqui'],
    ['gold', 'Dourado'],
    ['silver', 'Prateado'],
    ['cream', 'Creme'],
    ['ivory', 'Marfim'],
    ['coral', 'Coral'],
    ['camel', 'Camel'],
  ]);

  const IGNORED_CHINESE_PHRASES = [
    '颜色分类', '颜色', '色号', '配色', '官方标配', '现货', '预售', '升级款', '经典款',
    '新款', '男女同款', '男款', '女款', '儿童款', '成人款', '默认', '其它', '其他',
  ].sort((left, right) => right.length - left.length);

  const COLOR_KEYS = [...COLOR_TERMS.keys()].sort((left, right) => right.length - left.length);
  const ENGLISH_KEYS = [...ENGLISH_TERMS.keys()].sort((left, right) => right.length - left.length);
  const HAN_PATTERN = /[\u3400-\u9fff]/;

  function cleanSourceName(value) {
    return String(value || '')
      .trim()
      .replace(/&nbsp;/gi, ' ')
      .replace(/^(?:颜色分类|颜色|色号|配色|color|colour|cor)\s*[:：-]\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/^[,，、;；|/\s]+|[,，、;；|/\s]+$/g, '')
      .trim();
  }

  function translateEnglishColorName(value) {
    const normalized = value.toLocaleLowerCase('en-US').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (ENGLISH_TERMS.has(normalized)) return ENGLISH_TERMS.get(normalized);

    const translated = [];
    let cursor = 0;
    while (cursor < normalized.length) {
      const key = ENGLISH_KEYS.find((candidate) => {
        if (!normalized.startsWith(candidate, cursor)) return false;
        const before = cursor === 0 ? '' : normalized[cursor - 1];
        const after = normalized[cursor + candidate.length] || '';
        return (!before || !/[a-z]/.test(before)) && (!after || !/[a-z]/.test(after));
      });
      if (key) {
        translated.push(ENGLISH_TERMS.get(key));
        cursor += key.length;
        continue;
      }
      cursor += 1;
    }
    return joinUnique(translated);
  }

  function translateChineseColorName(value) {
    let remaining = value;
    for (const phrase of IGNORED_CHINESE_PHRASES) remaining = remaining.split(phrase).join(' ');
    remaining = remaining.replace(/[【】\[\]（）()]/g, ' ');

    const translated = [];
    let cursor = 0;
    while (cursor < remaining.length) {
      const match = COLOR_KEYS.find((key) => remaining.startsWith(key, cursor));
      if (match) {
        translated.push(COLOR_TERMS.get(match));
        cursor += match.length;
        continue;
      }
      cursor += 1;
    }
    return joinUnique(translated);
  }

  function getAsciiVariantCode(value) {
    const ascii = value
      .replace(/[\u3400-\u9fff]/g, ' ')
      .replace(/(?:color|colour|cor)\s*[:：-]?/gi, ' ')
      .replace(/[【】\[\]（）()]/g, ' ')
      .replace(/[^a-z0-9.+#/-]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!ascii || translateEnglishColorName(ascii)) return '';
    if (/^(?:sku|item|option|variant)?\s*\d+$/i.test(ascii)) return ascii.toUpperCase();
    if (/^[a-z]{1,3}\d{0,4}$/i.test(ascii)) return ascii.toUpperCase();
    return '';
  }

  function translateColorName(value, fallbackIndex = 0) {
    const sourceName = cleanSourceName(value);
    if (!sourceName) return `Cor ${Number(fallbackIndex) + 1}`;

    const english = translateEnglishColorName(sourceName);
    const chinese = HAN_PATTERN.test(sourceName) ? translateChineseColorName(sourceName) : '';
    const translated = joinUnique([chinese, english]);
    const code = getAsciiVariantCode(sourceName);
    if (translated && code) return `${translated} — ${code}`;
    if (translated) return translated;

    if (!HAN_PATTERN.test(sourceName)) {
      return sourceName
        .toLocaleLowerCase('pt-BR')
        .replace(/(^|[\s/+.-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'));
    }
    return `Cor ${Number(fallbackIndex) + 1}`;
  }

  function joinUnique(values) {
    const unique = [];
    for (const value of values.flatMap((item) => String(item || '').split(/\s+(?:e|\/)\s+/i))) {
      const clean = String(value || '').trim();
      if (!clean || unique.some((item) => item.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'))) continue;
      unique.push(clean);
    }
    return unique.join(' e ');
  }

  const api = Object.freeze({
    cleanSourceName,
    translateColorName,
    translateEnglishColorName,
  });

  globalScope.KicksColorTranslator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
