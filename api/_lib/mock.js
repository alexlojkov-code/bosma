// Фальшивый стрим для разработки без ключа (SPEC §5.4). Протокол тот же, что у Gemini.
import { AppError } from './errors.js';
import { PLATFORMS } from '../../public/js/core/platforms.js';

const T = {
  ru: {
    benefit: [
      (i) => ({ title: `${i.Idea}: что вы получаете`, lead: `Коротко о главном: ${i.idea}. Без лишних шагов и ожидания — приходите, остальное сделаем мы.` }),
      (i) => ({ title: `${i.Idea} — и это выгодно`, lead: `Считаем честно: ${i.idea}. Вы экономите время, а результат видно сразу.` }),
    ],
    story: [
      (i) => ({ title: 'Как это было у нашей клиентки', lead: `Утро, спешка, и опять не хватает времени на себя. Так нам написала клиентка на прошлой неделе.\n\nМы предложили простое решение: ${i.idea}. Через неделю она вернулась — уже с подругой.` }),
      (i) => ({ title: 'Одна история из нашей недели', lead: `В пятницу к нам зашёл человек «просто спросить». Ушёл довольным и записал всю семью.\n\nПричина простая: ${i.idea}.` }),
    ],
    engagement: [
      (i) => ({ title: `Что скажете: ${i.idea}?`, lead: 'Нам важно ваше мнение, поэтому спрашиваем прямо.' }),
      (i) => ({ title: `А вы бы попробовали — ${i.idea}?`, lead: 'Спорим, у каждого найдётся своё мнение? Делитесь — читаем всё.' }),
    ],
    tail: 'Детали и условия: [цена], [адрес].',
    ask: 'Ответьте одним словом: да или нет.',
    more: 'Подробности расскажем при встрече — приходите, покажем всё на месте.',
    cta: {
      telegram: ['Напишите нам в личные сообщения — ответим за 10 минут.', 'Подпишитесь на канал, чтобы не пропустить следующие новости.'],
      instagram: ['Пишите в Direct или жмите ссылку в профиле.', 'Сохраните пост и отправьте подруге, которой это нужно.'],
      youtube: ['Подпишитесь на канал и напишите вопрос в комментариях.', 'Поставьте лайк, если было полезно, и расскажите о своём опыте в комментариях.'],
    },
    engageCta: 'Напишите ответ в комментариях',
  },
  uz: {
    benefit: [
      (i) => ({ title: `${i.Idea}: siz uchun foyda`, lead: `Asosiysi: ${i.idea}. Ortiqcha kutishsiz — keling, qolganini o‘zimiz qilamiz.` }),
      (i) => ({ title: `${i.Idea} — bu foydali`, lead: `Halol hisoblaymiz: ${i.idea}. Vaqtingizni tejaysiz, natija darhol ko‘rinadi.` }),
    ],
    story: [
      (i) => ({ title: 'Mijozimiz bilan bo‘lgan voqea', lead: `Ertalab shoshilinch, o‘zingizga vaqt yo‘q. O‘tgan hafta mijozimiz bizga aynan shunday yozdi.\n\nBiz oddiy yechim taklif qildik: ${i.idea}. Bir haftadan so‘ng u dugonasi bilan qaytdi.` }),
      (i) => ({ title: 'Haftamizdan bir voqea', lead: `Juma kuni bir mehmon «shunchaki so‘rash» uchun kirdi. Mamnun bo‘lib chiqdi va butun oilasini yozdirdi.\n\nSababi oddiy: ${i.idea}.` }),
    ],
    engagement: [
      (i) => ({ title: `Nima deysiz: ${i.idea}?`, lead: 'Fikringiz biz uchun muhim, shuning uchun to‘g‘ridan-to‘g‘ri so‘raymiz.' }),
      (i) => ({ title: `Siz sinab ko‘rarmidingiz — ${i.idea}?`, lead: 'Har kimning o‘z fikri bor, to‘g‘rimi? Yozing — hammasini o‘qiymiz.' }),
    ],
    tail: 'Tafsilotlar: [narx], [manzil].',
    ask: 'Bir so‘z bilan javob bering: ha yoki yo‘q.',
    more: 'Batafsil uchrashuvda aytamiz — keling, hammasini joyida ko‘rsatamiz.',
    cta: {
      telegram: ['Bizga shaxsiy xabar yozing — 10 daqiqada javob beramiz.', 'Yangiliklarni o‘tkazib yubormaslik uchun kanalga obuna bo‘ling.'],
      instagram: ['Direct’ga yozing yoki profildagi havolani bosing.', 'Postni saqlang va kerakli dugonangizga yuboring.'],
      youtube: ['Kanalga obuna bo‘ling va savolingizni izohda yozing.', 'Foydali bo‘lsa, layk bosing va tajribangizni izohda yozing.'],
    },
    engageCta: 'Javobingizni izohlarda yozing',
  },
  en: {
    benefit: [
      (i) => ({ title: `${i.Idea}: what you get`, lead: `The short version: ${i.idea}. No extra steps, no waiting — come in and we handle the rest.` }),
      (i) => ({ title: `${i.Idea} — and it pays off`, lead: `Let’s be honest about it: ${i.idea}. You save time and see the result right away.` }),
    ],
    story: [
      (i) => ({ title: 'What happened with one of our clients', lead: `Busy morning, no time for yourself — that’s how a client described her week to us.\n\nWe offered something simple: ${i.idea}. A week later she came back with a friend.` }),
      (i) => ({ title: 'One story from our week', lead: `On Friday someone dropped by “just to ask”. They left happy and booked the whole family.\n\nThe reason is simple: ${i.idea}.` }),
    ],
    engagement: [
      (i) => ({ title: `What do you think: ${i.idea}?`, lead: 'Your opinion matters to us, so we’re asking directly.' }),
      (i) => ({ title: `Would you try it — ${i.idea}?`, lead: 'Everyone has a take on this. Share yours — we read every reply.' }),
    ],
    tail: 'Details and terms: [price], [address].',
    ask: 'Answer in one word: yes or no.',
    more: 'We’ll tell you the rest in person — drop by and we’ll show you everything.',
    cta: {
      telegram: ['Message us directly — we reply within 10 minutes.', 'Subscribe to the channel so you don’t miss the next update.'],
      instagram: ['DM us or tap the link in our bio.', 'Save this post and send it to a friend who needs it.'],
      youtube: ['Subscribe and leave your question in the comments.', 'Like the video if it helped and tell us your experience in the comments.'],
    },
    engageCta: 'Reply in the comments',
  },
};

const EMOJI_RE = /[\p{Extended_Pictographic}️‍]/gu;

function shorten(s, n) {
  const clean = s.replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/, '');
  if ([...clean].length <= n) return clean;
  return [...clean].slice(0, n).join('').replace(/\s+\S*$/, '') + '…';
}

function firstClause(s) {
  return shorten(String(s).split(/[.!?\n]/)[0] || s, 90);
}

function lowerFirst(s) {
  return s ? s.charAt(0).toLocaleLowerCase() + s.slice(1) : s;
}

function upperFirst(s) {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s;
}

function tagsFrom(business, idea, max) {
  const words = `${business} ${idea}`
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => [...w].length >= 5);
  const uniq = [...new Set(words)].sort((a, b) => b.length - a.length);
  return uniq.slice(0, Math.max(max, 0)).map((w) => `#${w}`);
}

export function mockPost(input) {
  const lang = T[input.language] || T.ru;
  const ideaShort = shorten(input.idea, 70);
  const i = { idea: lowerFirst(ideaShort), Idea: upperFirst(ideaShort) };
  const alt = input.previous ? 1 : 0;
  const tpl = lang[input.angle][alt](i);
  const biz = `${upperFirst(firstClause(input.business))}.`;
  const tagMax = PLATFORMS[input.platform].hashtags.max;

  let post = {
    title: tpl.title,
    body: [tpl.lead, biz, input.angle === 'engagement' ? lang.ask : lang.tail].join('\n\n'),
    cta: input.angle === 'engagement' ? lang.engageCta : lang.cta[input.platform][alt],
    hashtags: tagsFrom(input.business, input.idea, input.platform === 'telegram' ? 2 : tagMax),
  };

  if (input.tweak && input.previous) {
    const prev = { ...input.previous };
    switch (input.tweak) {
      case 'shorter':
        post = { ...prev, body: prev.body.split('\n\n')[0] };
        break;
      case 'longer':
        post = { ...prev, body: `${prev.body}\n\n${lang.more}` };
        break;
      case 'more_emoji':
        post = { ...prev, title: `🔥 ${prev.title.replace(EMOJI_RE, '').trim()}`, body: prev.body.split('\n\n').map((p) => `✅ ${p}`).join('\n\n') };
        break;
      case 'no_emoji':
        post = { ...prev, title: prev.title.replace(EMOJI_RE, '').trim(), body: prev.body.replace(EMOJI_RE, '').replace(/^ +/gm, ''), cta: prev.cta.replace(EMOJI_RE, '').trim() };
        break;
      case 'new_cta':
        post = { ...prev, cta: prev.cta === lang.cta[input.platform][0] ? lang.cta[input.platform][1] : lang.cta[input.platform][0] };
        break;
    }
  }

  if (input.idea.includes('__long__')) {
    const filler = post.body;
    while ([...post.body].length < PLATFORMS[input.platform].limits.total.hard + 200) post.body += `\n\n${filler}`;
  }
  return post;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AppError('aborted'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AppError('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** → { finishReason, usage } — та же форма, что у streamGemini. */
export async function streamMock({ input, signal, onText, speed = 1 }) {
  const idea = input.idea;
  if (idea.includes('__blocked__')) {
    await sleep(300 * speed, signal);
    throw new AppError('blocked_content', { message: 'mock blocked' });
  }
  const json = JSON.stringify(mockPost(input));
  const slow = idea.includes('__slow__');
  await sleep(250 * speed, signal); // «время до первого токена»
  let pos = 0;
  while (pos < json.length) {
    const size = 3 + Math.floor(Math.random() * 10);
    onText(json.slice(pos, pos + size));
    pos += size;
    if (idea.includes('__error__') && pos > 200) {
      throw new AppError('upstream_error', { message: 'mock error' });
    }
    await sleep((slow ? 500 : 20 + Math.random() * 20) * speed, signal);
  }
  return { finishReason: 'STOP', usage: { in: 0, out: 0, thoughts: 0 } };
}
