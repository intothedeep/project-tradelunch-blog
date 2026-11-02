"""Build the day-by-day traffic page from saved Cloudflare outputs.

Input: deploy/traffic/review/history/{daily.json,adaptive.jsonl,ratelimit.json,commits.tsv}.
Output: deploy/traffic/review/history/traffic-history.html (one file, date tabs).
Every number on the page is read from those files, never typed by hand.
"""

import html
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
HIST = ROOT / "deploy/traffic/review/history"
THEME = ROOT / ".claude/skills/html-theme/theme.css"

SERIES = {"node": "#2a78d6", "meta": "#eb6834", "other": "#1baf7a"}
TERMS = {
    "cache": ("캐시(cache)", "Cloudflare가 응답을 저장해 원본 서버 호출 없이 바로 주는 기능"),
    "ssr": (
        "서버 렌더링(server-side rendering, SSR)",
        "서버가 HTML을 만들어 주는 방식. 여기서는 Next 서버가 Express를 호출한다",
    ),
    "crawler": ("크롤러(crawler)", "웹 페이지를 자동으로 읽어 가는 프로그램"),
    "meta": (
        "메타 크롤러(meta-webindexer)",
        "User-Agent에 meta-webindexer가 들어 있는 크롤러. User-Agent는 위조할 수 있다",
    ),
    "ua": ("User-Agent(UA)", "요청을 보낸 프로그램이 스스로 밝히는 이름"),
    "rl": ("요청 수 제한(rate limit)", "짧은 시간에 요청이 너무 많으면 막는 규칙"),
    "s429": ("429 응답(Too Many Requests)", "요청이 너무 많아 거절했다는 응답"),
    "s499": ("499 응답(client closed request)", "서버가 답하기 전에 요청자가 연결을 끊었다는 기록"),
    "robots": ("robots.txt", "크롤러에게 읽지 말아야 할 주소를 알리는 파일. 강제력은 없다"),
    "nofollow": ("nofollow", "링크를 따라가지 말라고 크롤러에게 알리는 표시"),
    "uniq": ("순방문자(unique visitor)", "Cloudflare가 세는 서로 다른 방문자 수"),
}


def t(key: str) -> str:
    """Return a term linked to its appendix entry."""
    return f'<a href="#term-{key}">{TERMS[key][0]}</a>'


def e(value: Any) -> str:
    return html.escape(str(value))


def n(value: float) -> str:
    return f"{value:,.0f}"


def pct(part: float, whole: float) -> str:
    return f"{part / whole * 100:.2f}%" if whole else "0.00%"


def gb(value: float) -> str:
    return f"{value / 1e9:.3f} GB"


def load() -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, list[dict[str, Any]]], dict[str, list[list[str]]]]:
    daily = json.loads((HIST / "daily.json").read_text())["data"]["viewer"]["zones"][0]["httpRequests1dGroups"]
    adaptive = {}
    for line in (HIST / "adaptive.jsonl").read_text().splitlines():
        row = json.loads(line)
        adaptive[row["date"]] = row["g"]
    events: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for ev in json.loads((HIST / "ratelimit.json").read_text())["events"]:
        events[ev["datetime"][:10]].append(ev)
    commits: dict[str, list[list[str]]] = defaultdict(list)
    for line in (HIST / "commits.tsv").read_text().splitlines():
        date, sha, subject = line.split("\t", 2)
        if not subject.startswith("docs"):
            commits[date].append([sha, subject])
    return daily, adaptive, events, commits


def dim(row: dict[str, Any]) -> Any:
    return next(iter(row["dimensions"].values()))


def status(g: dict[str, Any], code: int) -> int:
    return sum(r["count"] for r in g["status"] if dim(r) == code)


def summarize(day: dict[str, Any], g: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
    s = day["sum"]
    node = g["node"][0]["count"] if g["node"] else 0
    meta = sum(r["count"] for r in g["metaAll"])
    return {
        "date": day["dimensions"]["date"],
        "req": s["requests"],
        "cached": s["cachedRequests"],
        "bytes": s["bytes"],
        "cachedBytes": s["cachedBytes"],
        "uniq": day["uniq"]["uniques"],
        "node": node,
        "meta": meta,
        "other": max(s["requests"] - node - meta, 0),
        "s429": sum(r["requests"] for r in s["responseStatusMap"] if r["edgeResponseStatus"] == 429),
        "s499": sum(r["requests"] for r in s["responseStatusMap"] if r["edgeResponseStatus"] == 499),
        "s5xx": sum(r["requests"] for r in s["responseStatusMap"] if r["edgeResponseStatus"] >= 500),
        "metaBlocked": sum(r["count"] for r in g["metaAll"] if dim(r) == 429),
        "rl": len(events),
    }


def table(head: list[str], rows: list[list[str]], first_wrap: bool = True) -> str:
    cls = ' class="wrap1"' if first_wrap else ""
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="scroll-x"><table{cls}><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


def group_table(title: str, head: str, rows: list[dict[str, Any]], total: int, limit: int = 8) -> str:
    body = [[e(str(dim(r))[:90] or "(없음)"), n(r["count"]), pct(r["count"], total)] for r in rows[:limit]]
    if not body:
        body = [["없음", "0", "0.00%"]]
    return f'<div class="panel"><p class="label">{title}</p>{table([head, "건수", "비율"], body)}</div>'


def stacked_chart(days: list[dict[str, Any]]) -> str:
    w, h, top, bottom, left = 1000, 300, 26, 34, 62
    peak = max(d["req"] for d in days)
    scale = (h - top - bottom) / peak
    step = (w - left - 8) / len(days)
    bar = step - 8
    parts = []
    for tick in range(0, int(peak) + 1, 100000):
        y = h - bottom - tick * scale
        parts.append(f'<line x1="{left}" x2="{w}" y1="{y:.1f}" y2="{y:.1f}" stroke="var(--rule)"/>')
        parts.append(f'<text x="{left - 8}" y="{y + 4:.1f}" text-anchor="end">{n(tick)}</text>')
    for i, d in enumerate(days):
        x = left + i * step + 4
        y = h - bottom
        tip = f'{d["date"]}: 전체 {n(d["req"])}, 서버 호출 {n(d["node"])}, 메타 {n(d["meta"])}, 기타 {n(d["other"])}'
        parts.append(f'<g class="bar" data-go="{d["date"]}" role="button" tabindex="0"><title>{tip}</title>')
        for key in ("other", "node", "meta"):
            hh = d[key] * scale
            y -= hh
            if hh > 0:
                parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar:.1f}" height="{max(hh - 1, 0.5):.1f}" fill="{SERIES[key]}"/>')
        parts.append(f'<rect x="{x - 4:.1f}" y="{top}" width="{step:.1f}" height="{h - top - bottom}" fill="transparent"/></g>')
        parts.append(f'<text x="{x + bar / 2:.1f}" y="{h - 12}" text-anchor="middle">{d["date"][5:]}</text>')
        if d["req"] >= peak * 0.4:
            parts.append(f'<text x="{x + bar / 2:.1f}" y="{h - bottom - d["req"] * scale - 6:.1f}" text-anchor="middle">{n(d["req"])}</text>')
    return f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="날짜별 요청 수 누적 막대">{"".join(parts)}</svg>'


def hour_chart(g: dict[str, Any]) -> str:
    counts = {str(dim(r))[11:13]: r["count"] for r in g["hour"]}
    peak = max(counts.values(), default=1)
    w, h, bottom = 1000, 120, 22
    step = w / 24
    parts = []
    for i in range(24):
        key = f"{i:02d}"
        v = counts.get(key, 0)
        hh = v / peak * (h - bottom - 18)
        parts.append(f'<g><title>{key}시 UTC: {n(v)}건</title><rect x="{i * step + 3:.1f}" y="{h - bottom - hh:.1f}" width="{step - 6:.1f}" height="{hh:.1f}" fill="{SERIES["node"]}"/></g>')
        if i % 3 == 0:
            parts.append(f'<text x="{i * step + step / 2:.1f}" y="{h - 6}" text-anchor="middle">{key}시</text>')
    parts.append(f'<text x="4" y="12">최대 {n(peak)}건/시간</text>')
    return f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="시간별 요청 수">{"".join(parts)}</svg>'


def verdict(d: dict[str, Any]) -> str:
    share = d["meta"] / d["req"] if d["req"] else 0
    if share >= 0.1:
        return f'{t("meta")}가 직접 보낸 요청이 {pct(d["meta"], d["req"])}입니다. 그 페이지를 만드는 서버 호출은 {n(d["node"])}건입니다.'
    if d["req"] and d["node"] / d["req"] >= 0.5:
        return f'메타 크롤러 급증은 없습니다. {t("ssr")} 호출이 {pct(d["node"], d["req"])}입니다.'
    return f'메타 크롤러 급증은 없습니다. 메타 요청은 {n(d["meta"])}건입니다.'


def day_panel(d: dict[str, Any], g: dict[str, Any], events: list[dict[str, Any]], commits: list[list[str]]) -> str:
    kpi = [
        ("전체 요청", n(d["req"])),
        ("캐시 응답", pct(d["cached"], d["req"])),
        ("전송량", gb(d["bytes"])),
        ("순방문자", n(d["uniq"])),
        ("메타 크롤러", n(d["meta"])),
        ("서버 호출", n(d["node"])),
        ("429", n(d["s429"])),
        ("499", n(d["s499"])),
        ("5xx", n(d["s5xx"])),
    ]
    tiles = "".join(f'<div class="tile"><p class="label">{k}</p><p class="val">{v}</p></div>' for k, v in kpi)
    by_client: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for ev in events:
        by_client[ev["client"]].append(ev)
    rows = []
    for client, evs in sorted(by_client.items(), key=lambda kv: -len(kv[1]))[:8]:
        path, cnt = Counter(x["clientRequestPath"] for x in evs).most_common(1)[0]
        rows.append([client, n(len(evs)), e(evs[0]["clientCountryName"]), f"{e(path[:60])} ({cnt}회)"])
    rl = table(["클라이언트", "차단", "국가", "가장 많은 경로"], rows) if rows else '<p class="muted">차단 기록이 없습니다.</p>'
    commit_rows = "".join(f"<li><code>{e(sha)}</code> {e(s[:90])}</li>" for sha, s in commits[:6])
    more = f'<li class="muted">외 {len(commits) - 6}건</li>' if len(commits) > 6 else ""
    commit_html = f"<ul>{commit_rows}{more}</ul>" if commits else '<p class="muted">문서 외 커밋이 없습니다.</p>'
    return f"""
<section class="tabpanel" id="p-{d['date']}" role="tabpanel" hidden>
  <h2>{d['date']} (UTC)</h2>
  <p class="headline">{verdict(d)}</p>
  <div class="tiles">{tiles}</div>
  <div class="panel"><p class="label">시간별 요청 수</p>{hour_chart(g)}</div>
  <div class="grid">
    {group_table('호스트', '호스트', g['host'], d['req'])}
    {group_table('경로', '경로', g['path'], d['req'], 10)}
    {group_table('응답 상태', '상태', g['status'], d['req'])}
    {group_table('캐시 상태', '상태', g['cache'], d['req'])}
    {group_table('429 호스트', '호스트', g['h429'], d['s429'])}
    {group_table('429 경로', '경로', g['p429'], d['s429'])}
  </div>
  {group_table('User-Agent', 'User-Agent', g['ua'], d['req'], 6)}
  <div class="panel"><p class="label">요청 수 제한 차단 (이름은 IP를 지운 라벨, 날마다 같은 라벨은 같은 IP)</p>{rl}</div>
  <div class="panel"><p class="label">그날의 문서 외 커밋</p>{commit_html}</div>
</section>"""


def overview(days: list[dict[str, Any]], adaptive: dict[str, Any]) -> str:
    burst = [d for d in days if "2026-10-22" <= d["date"] <= "2026-10-30"]
    all_req = sum(d["req"] for d in days)
    b_req = sum(d["req"] for d in burst)
    b_meta = sum(d["meta"] for d in burst)
    b_node = sum(d["node"] for d in burst)
    b_499 = sum(d["s499"] for d in burst)
    meta_blocked = sum(d["metaBlocked"] for d in burst)
    peak = next(d for d in days if d["date"] == "2026-10-30")
    g30 = adaptive["2026-10-30"]
    path30 = {dim(r): r["count"] for r in g30["path"]}
    posts, errlog = path30["/@taeklim/posts"], path30["/v1/api/error-logs"]
    meta_bytes = sum(r["sum"]["edgeResponseBytes"] for r in g30["metaAll"])
    node_bytes = g30["node"][0]["sum"]["edgeResponseBytes"]
    quiet = [d for d in days if d["date"] in ("2026-10-31", "2026-11-01")]
    s429 = sum(d["s429"] for d in days)
    rl = sum(d["rl"] for d in days)
    hosts: Counter[str] = Counter()
    for g in adaptive.values():
        for r in g["h429"]:
            hosts[str(dim(r))] += r["count"]
    rows = [
        [f'<a href="#{d["date"]}" data-go="{d["date"]}">{d["date"][5:]}</a>', n(d["req"]), n(d["meta"]), n(d["node"]), pct(d["cached"], d["req"]), gb(d["bytes"]), n(d["s429"]), n(d["rl"]), n(d["s499"])]
        for d in days
    ]
    legend = "".join(
        f'<span class="key"><i style="background:{SERIES[k]}"></i>{v}</span>'
        for k, v in (("meta", "메타 크롤러"), ("node", "서버 호출 (UA node)"), ("other", "기타"))
    )
    flow = """<svg viewBox="0 0 1000 96" role="img" aria-label="크롤러 요청이 서버 호출로 늘어나는 흐름">
<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="var(--muted-foreground)"/></marker></defs>
""" + "".join(
        f'<rect x="{x}" y="14" width="210" height="66" fill="var(--card)" stroke="var(--border)"/><text x="{x + 105}" y="42" text-anchor="middle" style="fill:var(--foreground);font-size:12px">{a}</text><text x="{x + 105}" y="62" text-anchor="middle">{b}</text>'
        for x, a, b in (
            (0, "메타 크롤러", "?tags= 조합 주소"),
            (263, "Cloudflare 캐시", "주소마다 달라서 miss"),
            (526, "Next 서버 렌더링", "페이지마다 API 여러 번"),
            (789, "Express", "느려지면 timeout, 오류 기록"),
        )
    ) + "".join(f'<line x1="{x}" x2="{x + 49}" y1="47" y2="47" stroke="var(--muted-foreground)" marker-end="url(#ar)"/>' for x in (212, 475, 738)) + "</svg>"
    return f"""
<section class="tabpanel" id="p-all" role="tabpanel">
  <p class="headline">10-22 ~ 10-30 급증의 주원인은 {t('meta')}입니다. 10-30에는 이 크롤러 요청이 {n(peak['meta'])}건, 서버 호출이 {n(peak['node'])}건이었습니다.</p>
  <div class="panel"><p class="label">왜 했나</p><p>10-30 요청이 하루 {n(peak['req'])}건으로 튀었습니다. 낮은 {t('cache')} 비율과 비용에 영향을 주는지 확인했습니다.</p></div>
  <div class="panel"><p class="label">쓴 데이터</p><ul>
    <li>Cloudflare 일별 분석: {len(days)}일, {n(all_req)}건 (<code>daily.json</code>)</li>
    <li>Cloudflare 일별 분해: 호스트, 경로, {t('ua')}, 상태 (<code>adaptive.jsonl</code>)</li>
    <li>{t('rl')} 차단 기록: {n(rl)}건, IP는 라벨로 바꿈 (<code>ratelimit.json</code>)</li>
    <li>보조 근거: 10-30 09시대 blog-web 로그 400줄, 저장하지 않음</li>
  </ul></div>
  <div class="panel"><p class="label">날짜별 요청 수 (막대를 누르면 그날 탭으로 이동)</p><div class="legend">{legend}</div>{stacked_chart(days)}</div>
  <div class="panel"><p class="label">요청이 늘어나는 흐름</p>{flow}</div>
  <div class="panel"><p class="label">근거와 읽는 법</p><ul>
    <li>10-22 ~ 10-30의 전체 요청은 {n(b_req)}건입니다. 메타 크롤러 {n(b_meta)}건, 서버 호출 {n(b_node)}건입니다.</li>
    <li>10-30에는 <code>/@taeklim/posts</code> {n(posts)}건과 <code>/v1/api/error-logs</code> {n(errlog)}건이 거의 같습니다. 인과는 로그 표본으로만 확인했습니다.</li>
    <li>기간 내 {t('s499')}는 {n(b_499)}건입니다. 표본 로그의 주소에는 태그 조합 <code>?tags=a,b,c</code>가 있습니다.</li>
    <li>{t('robots')} 차단은 2026-09-23부터 있고, 태그 링크에는 {t('nofollow')}도 있습니다. 그런데도 크롤링이 이어졌습니다.</li>
    <li>{t('rl')}이 이 크롤러를 막은 기록은 {n(meta_blocked)}건입니다.</li>
    <li>일별 분석과 일별 분해는 데이터셋이 달라 같은 항목의 값이 조금 다를 수 있습니다.</li>
    <li>10-30 전송량 {gb(peak['bytes'])} 중 메타 응답 {gb(meta_bytes)}, 서버 호출 {gb(node_bytes)}입니다.</li>
  </ul></div>
  <div class="panel"><p class="label">아직 모르는 것</p><ul>
    <li>크롤링이 10-31에 줄어든 이유는 모릅니다. 다시 시작될 수 있습니다.</li>
    <li>캐시 비율은 조용한 날에도 {' / '.join(pct(d['cached'], d['req']) for d in quiet)}입니다. 크롤러를 막아도 크게 오른다고 단정할 수 없습니다.</li>
    <li>{t('s429')}는 {n(s429)}건인데 차단 기록은 {n(rl)}건입니다. 차이의 이유는 확인하지 못했습니다.</li>
    <li>429 호스트 합계: {', '.join(f'{e(k)} {n(v)}' for k, v in hosts.most_common(3))} (날마다 상위 6개 기준)</li>
  </ul></div>
  <div class="panel"><p class="label">날짜별 표</p>{table(['날짜', '요청', '메타', '서버 호출', '캐시', '전송량', '429', '차단', '499'], rows, False)}</div>
</section>"""


def appendix() -> str:
    items = "".join(f'<li id="term-{k}"><b>{name}</b>: {e(desc)}</li>' for k, (name, desc) in TERMS.items())
    return f'<section class="panel"><h2>용어 부록</h2><ul>{items}</ul></section>'


CSS = """
.tabs{display:flex;flex-wrap:wrap;gap:4px;position:sticky;top:0;background:var(--background);padding:8px 0;z-index:2;border-bottom:1px solid var(--rule)}
.tabs button.hot{box-shadow:inset 0 -3px 0 #eb6834}
.tabpanel{display:flex;flex-direction:column;gap:16px}.tabpanel[hidden]{display:none}
.headline{font-weight:700;font-size:16px}
.tiles{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}.tile{border:1px solid var(--rule);padding:8px}.val{font-size:14px;font-weight:500;white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid .panel{min-width:0}
table.wrap1 td:first-child{white-space:normal;word-break:break-all;max-width:640px}
.panel ul{margin:4px 0 0;padding-left:20px}.panel>.label{margin-bottom:8px}
svg{width:100%;height:auto;display:block}.bar{cursor:pointer}
.legend{display:flex;gap:16px;margin-bottom:8px}.key{display:inline-flex;align-items:center;gap:6px}.key i{width:12px;height:12px;display:inline-block}
a{color:inherit}
"""

JS = """
const tabs=[...document.querySelectorAll('.tabs button')],panels=[...document.querySelectorAll('.tabpanel')];
function go(id,push){const p=document.getElementById('p-'+id);if(!p)return;
panels.forEach(x=>x.hidden=x!==p);tabs.forEach(b=>{const on=b.dataset.tab===id;b.setAttribute('aria-pressed',on);b.setAttribute('aria-selected',on)});
if(push)history.replaceState(null,'','#'+id);}
tabs.forEach(b=>b.addEventListener('click',()=>go(b.dataset.tab,true)));
document.querySelectorAll('[data-go]').forEach(el=>{const f=ev=>{ev.preventDefault();go(el.dataset.go,true);scrollTo(0,0)};el.addEventListener('click',f);
el.addEventListener('keydown',ev=>{if(ev.key==='Enter')f(ev)})});
const h=location.hash.slice(1);go(document.getElementById('p-'+h)?h:'all',false);
"""


def main() -> None:
    daily, adaptive, events, commits = load()
    days = [summarize(d, adaptive[d["dimensions"]["date"]], events[d["dimensions"]["date"]]) for d in daily]
    theme = THEME.read_text()
    theme = re.sub(r"@media \(prefers-color-scheme: dark\).*?(?=\* \{ box-sizing)", "", theme, flags=re.S)
    tabs = ['<button data-tab="all" role="tab">전체</button>'] + [
        f'<button data-tab="{d["date"]}" role="tab"{" class=hot" if d["meta"] / d["req"] >= 0.1 else ""}>{d["date"][5:]}</button>'
        for d in days
    ]
    panels = overview(days, adaptive) + "".join(
        day_panel(d, adaptive[d["date"]], events[d["date"]], commits[d["date"]]) for d in days
    )
    page = f"""<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>트래픽 일별 기록</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans+KR:wght@400;500&display=swap">
<style>{theme}{CSS}</style></head><body><main class="wrap">
<header><p class="label">prettylog · Cloudflare · {days[0]['date']} ~ {days[-1]['date']}</p><h1>트래픽 일별 기록</h1>
<p class="muted">날짜 탭을 누르면 그날의 수치를 봅니다. 주황 밑줄은 메타 크롤러 비중이 10% 이상인 날입니다.</p></header>
<nav class="tabs" role="tablist" aria-label="날짜">{''.join(tabs)}</nav>
{panels}{appendix()}</main><script>{JS}</script></body></html>"""
    out = HIST / "traffic-history.html"
    out.write_text(page)
    print(out, len(page))


if __name__ == "__main__":
    main()
