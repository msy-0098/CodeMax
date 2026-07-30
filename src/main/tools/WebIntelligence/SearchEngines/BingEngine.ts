// cheerio 改为动态导入，避免启动时加载

interface SearchResult {
  title: string
  url: string
  snippet: string
  engine: string
  score?: number
}

/**
 * Bing 搜索引擎适配器
 * 反爬门槛低，搜索结果 HTML 结构稳定
 */
export class BingEngine {
  readonly name = 'bing'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
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

    // Bing 搜索结果在 <li class="b_algo"> 中
    $('li.b_algo').each((_i, el) => {
      if (results.length >= maxResults) return false
      const $el = $(el)
      const linkEl = $el.find('h2 a').first()
      const url = linkEl.attr('href') || ''
      const title = linkEl.text().trim()
      const snippet = $el.find('.b_caption p').first().text().trim()
        || $el.find('.b_lineclamp2').first().text().trim()

      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet, engine: 'bing' })
      }
    })

    return results
  }
}

export type { SearchResult }
