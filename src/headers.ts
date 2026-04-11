import { DEFAULT_HEADERS } from "./constants.js";

/** 
 * Domain-based header steering logic.
 * Consolidated from Vercel and Bun templates.
 */

interface DomainGroup {
    patterns: RegExp[];
    origin: string;
    referer: string;
    customHeaders?: Record<string, string>;
}

export const DOMAIN_GROUPS: DomainGroup[] = [
    {
    patterns: [/\.padorupado\.ru$/i, /\.kwikie\.ru$/i, /kwik\.cx$/i, /kwik\.si$/i, /kwik\.li$/i],
    origin: "https://kwik.cx",
    referer: "https://kwik.cx/",
    customHeaders: { "cache-control": "no-cache", pragma: "no-cache" },
},
{
    patterns: [/animepahe\.(?:com|org|ru|si)$/i, /i\.animepahe\.(?:com|org|ru|si)$/i],
    origin: "https://animepahe.si",
    referer: "https://animepahe.si/",
},
    {
        patterns: [/\.streamtape\.to$/i],
        origin: "https://streamtape.to",
        referer: "https://streamtape.to/",
    },
    {
        patterns: [/vidcache\.net$/i],
        origin: "https://www.animegg.org",
        referer: "https://www.animegg.org/",
    },
    {
        patterns: [
            /krussdomi\.com$/i,
            /kami\.to$/i,
            /mizu\.to$/i,
            /zen\.to$/i,
            /revolutionizingtheweb\.xyz$/i,
            /nextgentechnologytrends\.xyz$/i,
            /smartinvestmentstrategies\.xyz$/i,
            /creativedesignstudioxyz\.xyz$/i,
            /breakingdigitalboundaries\.xyz$/i,
            /ultimatetechinnovation\.xyz$/i,
        ],
        origin: "https://krussdomi.com",
        referer: "https://krussdomi.com/",
    },
    {
        patterns: [/(?:^|\.)owocdn\.top$/i],
        origin: "https://kwik.cx",
        referer: "https://kwik.cx/",
    },
    {
        patterns: [/\.akamaized\.net$/i],
        origin: "https://players.akamai.com",
        referer: "https://players.akamai.com/",
    },
    {
        patterns: [
            /(?:^|\.)shadowlandschronicles\./i,
            /digitalshinecollective\.xyz$/i,
            /thrivequesthub\.xyz$/i,
            /novaedgelabs\.xyz$/i,
        ],
        origin: "https://cloudnestra.com",
        referer: "https://cloudnestra.com/",
    },
    {
        patterns: [/(?:^|\.)viddsn\./i, /\.anilike\.cyou$/i, /vidwish\.(?:live|to|com)$/i],
        origin: "https://vidwish.live",
        referer: "https://vidwish.live/",
    },
    {
        patterns: [/(?:^|\.)watching\.onl$/i],
        origin: "https://megaplay.buzz",
        referer: "https://megaplay.buzz/",
    },
    {
        patterns: [/(?:^|\.)dotstream\./i, /(?:^|\.)playcloud1\./i],
        origin: "https://megaplay.buzz/",
        referer: "https://megaplay.buzz/",
    },
    {
        patterns: [/\.cloudfront\.net$/i],
        origin: "https://d2zihajmogu5jn.cloudfront.net",
        referer: "https://d2zihajmogu5jn.cloudfront.net/",
    },
    {
        patterns: [/\.ttvnw\.net$/i],
        origin: "https://www.twitch.tv",
        referer: "https://www.twitch.tv/",
    },
    {
        patterns: [/\.xx\.fbcdn\.net$/i],
        origin: "https://www.facebook.com",
        referer: "https://www.facebook.com/",
    },
    {
        patterns: [/\.anih1\.top$/i, /\.xyk3\.top$/i],
        origin: "https://ee.anih1.top",
        referer: "https://ee.anih1.top/",
    },
    {
        patterns: [/\.premilkyway\.com$/i],
        origin: "https://uqloads.xyz",
        referer: "https://uqloads.xyz/",
    },
    {
        patterns: [/\.streamcdn\.com$/i],
        origin: "https://anime.uniquestream.net",
        referer: "https://anime.uniquestream.net/",
    },
    {
        patterns: [
            /\.raffaellocdn\.net$/i,
            /\.feetcdn\.com$/i,
            /clearskydrift45\.site$/i,
        ],
        origin: "https://kerolaunochan.online",
        referer: "https://kerolaunochan.online/",
    },
    {
        patterns: [
            /dewbreeze84\.online$/i,
            /cloudydrift38\.site$/i,
            /sunshinerays93\.live$/i,
            /clearbluesky72\.wiki$/i,
            /breezygale56\.online$/i,
            /frostbite27\.pro$/i,
            /frostywinds57\.live$/i,
            /icyhailstorm64\.wiki$/i,
            /icyhailstorm29\.online$/i,
            /windflash93\.xyz$/i,
            /stormdrift27\.site$/i,
            /tempestcloud61\.wiki$/i,
            /sunburst66\.pro$/i,
            /douvid\.xyz$/i,
        ],
        origin: "https://megacloud.blog",
        referer: "https://megacloud.blog/",
        customHeaders: { "cache-control": "no-cache", pragma: "no-cache" },
    },
    {
        patterns: [/\.echovideo\.to$/i],
        origin: "https://aniwave.se",
        referer: "https://aniwave.se/",
    },
    {
        patterns: [/\.vid-cdn\.xyz$/i],
        origin: "https://anizone.to/",
        referer: "https://anizone.to/",
    },
    {
        patterns: [/\.1stkmgv1\.com$/i],
        origin: "https://animeyy.com",
        referer: "https://animeyy.com/",
    },
    {
        patterns: [/ninstream\.com$/i],
        origin: "https://senshi.live",
        referer: "https://senshi.live/",
    },
    {
        patterns: [/video1\.cdnlibs\.org$/i, /cdnlibs\.org$/i],
        origin: "https://v3.animelib.org",
        referer: "https://v3.animelib.org/",
    },
    {
        patterns: [/kodik\.info$/i, /kodik\.cc$/i],
        origin: "https://kodik.info",
        referer: "https://kodik.info/",
    },
    {
        patterns: [/video\.sibnet\.ru$/i],
        origin: "https://video.sibnet.ru",
        referer: "https://video.sibnet.ru/",
    },
    {
        patterns: [/filemoon\.sx$/i, /filemoon\.to$/i, /filemoon\.in$/i],
        origin: "https://filemoon.sx",
        referer: "https://filemoon.sx/",
    },
    {
        patterns: [/doodstream\.com$/i, /dood\.wf$/i, /dood\.re$/i, /d0000d\.com$/i],
        origin: "https://doodstream.com",
        referer: "https://doodstream.com/",
    },
    {
        patterns: [/streamwish\.to$/i, /streamwish\.com$/i, /swdyu\.com$/i],
        origin: "https://streamwish.to",
        referer: "https://streamwish.to/",
    },
    {
        patterns: [/kisskh\.co$/i],
        origin: "https://kisskh.co",
        referer: "https://kisskh.co/",
    },
    {
        patterns: [/watchanimeworld\.in$/i],
        origin: "https://watchanimeworld.in",
        referer: "https://watchanimeworld.in/",
    },
    {
        patterns: [/animeworld\.ac$/i, /animeworld\.so$/i],
        origin: "https://animeworld.ac",
        referer: "https://animeworld.ac/",
    },
    {
        patterns: [/anicrush\.to$/i],
        origin: "https://anicrush.to",
        referer: "https://anicrush.to/",
        customHeaders: { "x-requested-with": "XMLHttpRequest" },
    },
    {
        patterns: [/anikai\.to$/i, /animekai\.to$/i],
        origin: "https://anikai.to",
        referer: "https://anikai.to/",
    },
    {
        patterns: [/1movies\.bz$/i],
        origin: "https://1movies.bz",
        referer: "https://1movies.bz/",
    },
    {
        patterns: [/monoschinos2\.net$/i, /monoschinos\.net$/i],
        origin: "https://wvv.monoschinos2.net",
        referer: "https://wvv.monoschinos2.net/",
        customHeaders: { "x-requested-with": "XMLHttpRequest" },
    },
    {
        patterns: [/veranimes\.net$/i],
        origin: "https://wwv.veranimes.net",
        referer: "https://wwv.veranimes.net/",
    },
    {
        patterns: [/animetoast\.cc$/i],
        origin: "https://www.animetoast.cc",
        referer: "https://www.animetoast.cc/",
    },
    {
        patterns: [/animeler\.pw$/i, /play\.animeler\.pw$/i],
        origin: "https://play.animeler.pw",
        referer: "https://play.animeler.pw/",
    },
    {
        patterns: [/vidlink\.pro$/i],
        origin: "https://vidlink.pro",
        referer: "https://vidlink.pro/",
    },
    {
        patterns: [/poseidonhd2\.co$/i],
        origin: "https://poseidonhd2.co",
        referer: "https://poseidonhd2.co/",
    },
    {
        patterns: [/kaa\.lt$/i, /kickass-anime\.ro$/i],
        origin: "https://kickass-anime.ro",
        referer: "https://kickass-anime.ro/",
    },
    {
        patterns: [/mangacloud\.org$/i],
        origin: "https://mangacloud.org",
        referer: "https://mangacloud.org/",
    },
    {
        patterns: [/mangapub\.com$/i],
        origin: "https://mangapub.com",
        referer: "https://mangapub.com/",
    },
    {
        patterns: [/fireani\.me$/i],
        origin: "https://fireani.me",
        referer: "https://fireani.me/",
    },
    {
        patterns: [/aniwatchtv\.to$/i],
        origin: "https://aniwatchtv.to",
        referer: "https://aniwatchtv.to/",
    },
    {
        patterns: [
            /lightningspark77\.pro$/i,
            /thunderwave48\.xyz$/i,
            /stormwatch95\.site$/i,
            /windyrays29\.online$/i,
            /thunderstrike77\.online$/i,
            /lightningflash39\.live$/i,
            /cloudburst82\.xyz$/i,
            /drizzleshower19\.site$/i,
            /rainstorm92\.xyz$/i,
        ],
        origin: "https://megacloud.club",
        referer: "https://megacloud.club/",
    },
    {
        patterns: [
            /cloudburst99\.xyz$/i,
            /frostywinds73\.pro$/i,
            /stormwatch39\.live$/i,
            /sunnybreeze16\.live$/i,
            /mistydawn62\.pro$/i,
            /lightningbolt21\.live$/i,
            /gentlebreeze85\.xyz$/i,
        ],
        origin: "https://videostr.net",
        referer: "https://videostr.net/",
    },
    {
        patterns: [/vmeas\.cloud$/i],
        origin: "https://vidmoly.to",
        referer: "https://vidmoly.to/",
    },
    {
        patterns: [/nextwaveinitiative\.xyz$/i],
        origin: "https://edgedeliverynetwork.org",
        referer: "https://edgedeliverynetwork.org/",
    },
    {
        patterns: [
            /lightningbolts\.ru$/i,
            /lightningbolt\.site$/i,
            /vyebzzqlojvrl\.top$/i,
        ],
        origin: "https://vidsrc.cc",
        referer: "https://vidsrc.cc/",
    },
    {
        patterns: [/vidlvod\.store$/i],
        origin: "https://vidlink.pro",
        referer: "https://vidlink.pro/",
    },
    {
        patterns: [
            /heatwave90\.pro$/i,
            /humidmist27\.wiki$/i,
            /frozenbreeze65\.live$/i,
            /drizzlerain73\.online$/i,
            /sunrays81\.xyz$/i,
        ],
        origin: "https://kerolaunochan.live",
        referer: "https://kerolaunochan.live/",
    },
    {
        patterns: [/\.vkcdn5\.com$/i],
        origin: "https://vkspeed.com",
        referer: "https://vkspeed.com/",
    },
    {
        patterns: [/embed\.su$/i, /usbigcdn\.cc$/i, /\.congacdn\.cc$/i],
        origin: "https://embed.su",
        referer: "https://embed.su/",
    },
    {
        patterns: [/hls\.kr$/i, /hls\.kr\.direct$/i],
        origin: "https://hls.kr",
        referer: "https://hls.kr/",
    },
    {
        patterns: [/(?:^|\.)vidhosters\.com$/i],
        origin: "https://vidhosters.com",
        referer: "https://vidhosters.com/",
    },
    {
        patterns: [/(?:^|\.)pahe\.la$/i, /(?:^|\.)pahe\.li$/i],
        origin: "https://pahe.la",
        referer: "https://pahe.la/",
    },
    {
        patterns: [/[a-z]+\d+\.(pro|live|xyz|site|online|wiki)$/i],
        origin: "https://rapid-cloud.co",
        referer: "https://rapid-cloud.co/",
        customHeaders: { "cache-control": "no-cache", pragma: "no-cache" },
    },
];

// LRU-style cache for hostname -> domain group lookups (avoids regex scan per request)
const domainGroupCache = new Map<string, DomainGroup | null>();
const CACHE_MAX = 1024;

function findDomainGroup(hostname: string): DomainGroup | null {
    const cached = domainGroupCache.get(hostname);
    if (cached !== undefined) return cached;

    const group = DOMAIN_GROUPS.find((g) =>
        g.patterns.some((re) => re.test(hostname))
    ) ?? null;

    if (domainGroupCache.size >= CACHE_MAX) {
        // Evict oldest entry
        const first = domainGroupCache.keys().next().value;
        if (first !== undefined) domainGroupCache.delete(first);
    }
    domainGroupCache.set(hostname, group);
    return group;
}

export function generateHeadersOriginal(
    url: URL,
): Record<string, string> {
    const headers = Object.assign(Object.create(null), DEFAULT_HEADERS) as Record<string, string>;

    const group = findDomainGroup(url.hostname);

    if (group) {
        headers["origin"] = group.origin;
        headers["referer"] = group.referer;
        if (group.customHeaders) {
            Object.assign(headers, group.customHeaders);
        }
    } else {
        const origin = url.origin;
        headers["origin"] = origin;
        headers["referer"] = `${origin}/`;
    }

    return headers;
}
