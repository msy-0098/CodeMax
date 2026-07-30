// cheerio 改为动态导入，避免启动时加载

interface SearchResult {
  title: string
  url: string
  snippet: string
  engine: string
  score?: number
}

/**
 * DuckDuckGo 搜索引擎适配器
 */
export class DuckDuckGoEngine {
  readonly name = 'duckduckgo'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'DNT': '1',
        'Connection': 'keep-alive'
      },
      signal
    })

    if (!response.ok) return []

    const html = await response.text()
    return this.parseResults(html, maxResults)
  }

  private async parseResults(html: string, maxResults: number): Promise<SearchResult[]> {
    const cheerio = await import('cheerio')
    const results: SearchResult[] = []
    const $ = cheerio.load(html)

    // DuckDuckGo Lite 的 HTML 结构：搜索结果在 <a> 标签的 <span class="label"> 中
    // 每个结果是一个 <a> 包裹的 block，包含标题（.label）和可能的内联摘要
    $('a[href]').each((_i, el) => {
      if (results.length >= maxResults) return false
      const $el = $(el)
      const rawUrl = $el.attr('href') || ''
      const title = $el.find('.label').first().text().trim()
      // 摘要可能在 .snippet 中，或无摘要
      const snippet = $el.find('.snippet').text().trim() || $el.text().replace(title, '').trim()
      const url = this.cleanUrl(rawUrl)
      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet, engine: 'duckduckgo' })
      }
    })

    return results
  }

  private cleanUrl(raw: string): string {
    const uddgMatch = raw.match(/uddg=([^&]+)/)
    if (uddgMatch) return decodeURIComponent(uddgMatch[1])
    if (raw.startsWith('//')) return 'https:' + raw
    return raw
  }
}

export type { SearchResult }
