import { DEFAULT_HEADERS } from "./constants";

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
    patterns: [/\.padorupado\.ru$/i, /\.kwikie\.ru$/i, /\.owocdn\.top$/i, /kwik\.cx$/i, /kwik\.si$/i, /kwik\.li$/i],
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
        patterns: [/sunnybreeze16\.live$/i],
        origin: "https://megacloud.store",
        referer: "https://megacloud.store/",
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

export function generateHeadersOriginal(
    url: URL,
    customOrigin?: string
): Record<string, string> {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };

    if (customOrigin) {
        headers["origin"] = customOrigin;
        headers["referer"] = customOrigin.endsWith("/")
            ? customOrigin
            : `${customOrigin}/`;
        return headers;
    }

    const hostname = url.hostname;
    const group = DOMAIN_GROUPS.find((g) =>
        g.patterns.some((re) => re.test(hostname))
    );

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
