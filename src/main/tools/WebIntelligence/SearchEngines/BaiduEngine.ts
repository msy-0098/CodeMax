// cheerio 改为动态导入，避免启动时加载

interface SearchResult {
  title: string
  url: string
  snippet: string
  engine: string
  score?: number
}

/**
 * 百度搜索引擎适配器
 * 中文搜索效果好，结果链接为跳转链接需还原真实 URL
 */
export class BaiduEngine {
  readonly name = 'baidu'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=${maxResults}`
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

    // 百度搜索结果容器：.c-container 或 #content_left 下的 .result
    const containers = $('#content_left .c-container, #content_left .result')
    containers.each((_i, el) => {
      if (results.length >= maxResults) return false
      const $el = $(el)
      const linkEl = $el.find('h3 a').first()
      const rawUrl = linkEl.attr('href') || ''
      const title = linkEl.text().trim()
      const snippet = $el.find('.c-abstract').first().text().trim()
        || $el.find('.c-span-last').first().text().trim()
        || $el.find('.content-right_8Zs40').first().text().trim()

      if (!title) return

      const url = this.extractRealUrl(rawUrl)
      if (url) {
        results.push({ title, url, snippet, engine: 'baidu' })
      }
    })

    return results
  }

  /**
   * 百度搜索结果 URL 为跳转链接 (https://www.baidu.com/link?url=REAL_URL&...)
   * 提取 url 参数并解码，还原为目标页面的真实 URL
   */
  private extractRealUrl(raw: string): string | null {
    if (!raw) return null
    // 如果已经是普通 http(s) URL，直接返回
    if (raw.startsWith('http') && !raw.includes('baidu.com/link')) return raw

    // 处理百度跳转链接
    const match = raw.match(/[?&]url=([^&]+)/i)
    if (match) {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1] // 解码失败则返回原始提取值
      }
    }

    // 兜底：如果 raw 以 http 开头但不是百度跳转，仍然返回
    if (raw.startsWith('http')) return raw
    return null
  }
}

export type { SearchResult }
