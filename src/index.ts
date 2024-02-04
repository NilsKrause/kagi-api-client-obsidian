import {FastGPTOptions, SearchOptions, Settings, SummarizerOptions}                             from './settings';
import {KagiData, KagiError, KagiFastGPTData, KagiResponse, KagiSearchData, KagiSummarizerData} from './response';
import {
  KAGI_API_VERSIONS,
  KAGI_BASE_API_URL,
  KAGI_ENRICHMENT_ENDPOINT,
  KAGI_ENRICHMENT_NEWS,
  KAGI_ENRICHMENT_WEB,
  KAGI_FASTGPT_ENDPOINT,
  KAGI_SEARCH_ENDPOINT,
  KAGI_SUMMARIZER_ENDPOINT,
  KagiApiVersion,
  KagiEnrichmentParameter,
  KagiEnrichmentType,
  KagiFastGPTParameter,
  KagiSearchParameter,
  SummarizeAllowedMethods
}                                                                                               from './request';
import {request as request_obsidian} from 'obsidian';

export interface IKagi {
  summarize(input: string, options?: SummarizerOptions, method?: SummarizeAllowedMethods): Promise<KagiResponse<KagiSummarizerData>>
  search(query: string, options?: SearchOptions): Promise<KagiResponse<KagiSearchData>>
  fastgpt(query: string, options?: FastGPTOptions): Promise<KagiResponse<KagiFastGPTData>>
  enrich(query: string, type: KagiEnrichmentType): Promise<KagiResponse<KagiSearchData>>
  enrichWeb(query: string): Promise<KagiResponse<KagiSearchData>>
  enrichNews(query: string): Promise<KagiResponse<KagiSearchData>>
}

export class Kagi implements IKagi {
  private settings: IntSettings
  constructor(settings: Settings) {
    this.settings = {...{version: KAGI_API_VERSIONS.v0}, ...settings};
  }

  summarize(input: string, options?: SummarizerOptions, method?: SummarizeAllowedMethods): Promise<KagiResponse<KagiSummarizerData>> {
    let data = {...this.settings.summarizerDefaults, ...options}
    try {
      // just create for side effect
      new URL(input)

      /* is url */
      data = {...data, ...{url: input}}
    } catch (err) {
      /* is basic text */
      data = {...data, ...{text: input}}
    }

    let url = toUrlStr(KAGI_BASE_API_URL, this.settings.version, KAGI_SUMMARIZER_ENDPOINT)
    if (method === 'GET') {
      const queryParams = new URLSearchParams([
        ...Object.entries(data)
          .filter(([_, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ]);

      url = url + '?' + queryParams

      let reqInit: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: `Bot ${this.settings.token}`,
          Accept: 'application/json'
        }
      }

      return request(url, reqInit)
    }

    let reqInit: RequestInit = {
      method: 'POST',
      headers: {
      Authorization: `Bot ${this.settings.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }

    return request(url, reqInit)
  }

  search(query: string, options?: SearchOptions): Promise<KagiResponse<KagiSearchData>> {
    let url = toUrlStr(KAGI_BASE_API_URL, this.settings.version, KAGI_SEARCH_ENDPOINT)
    let params: KagiSearchParameter = {...{q: query}, ...{...this.settings.searchDefaults, ...options}}

    const queryParams = new URLSearchParams([
      ...Object.entries(params)
        .filter(([_, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    ]);

    url = url + '?' + queryParams

    let reqInit: RequestInit = {
      method: 'GET',
      headers: {
        Authorization: `Bot ${this.settings.token}`
      }
    }

    return request(url, reqInit)
  }

  fastgpt(query: string, options?: FastGPTOptions): Promise<KagiResponse<KagiFastGPTData>> {
    let data: KagiFastGPTParameter = {...{query}, ...{...this.settings.fastGPTDefaults, ...options}}
    let url = toUrlStr(KAGI_BASE_API_URL, this.settings.version, KAGI_FASTGPT_ENDPOINT)
    let reqInit: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bot ${this.settings.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }

    return request(url, reqInit)
  }

  enrich(query: string, type: KagiEnrichmentType): Promise<KagiResponse<KagiSearchData>> {
    return type === 'web' ? this.enrichWeb(query) : this.enrichNews(query)
  }

  enrichWeb(query: string): Promise<KagiResponse<KagiSearchData>> {
    return this.baseEnrich(toUrlStr(KAGI_BASE_API_URL, this.settings.version, KAGI_ENRICHMENT_ENDPOINT, KAGI_ENRICHMENT_WEB), query)
  }

  enrichNews(query: string): Promise<KagiResponse<KagiSearchData>> {
   return this.baseEnrich(toUrlStr(KAGI_BASE_API_URL, this.settings.version, KAGI_ENRICHMENT_ENDPOINT, KAGI_ENRICHMENT_NEWS), query)
  }

  private baseEnrich(u: string, q: string): Promise<KagiResponse<KagiSearchData>> {
    let params: KagiEnrichmentParameter = {q}

    const queryParams = new URLSearchParams([
      ...Object.entries(params)
        .filter(([_, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    ]);

    let reqInit: RequestInit = {
      method: 'GET',
      headers: {
        Authorization: `Bot ${this.settings.token}`,
        Accept: 'application/json'
      }
    }

    let url = u + '?' + queryParams

    return request(url, reqInit)
  }
}

function request<KagiDataT extends KagiData>(url: string, req: RequestInit): Promise<KagiResponse<KagiDataT>> {
  return request_obsidian({
    url: url,
    headers: req.headers as Record<string, string>,
    body: req.body?.toString(),
    method: req.method
  })
    .then<KagiResponse<KagiDataT>>((r) => JSON.parse(r))
    .then<KagiResponse<KagiDataT>>((res) => {
      if (res.error !== undefined) {
        throw new KagiError(url, req, res.error)
      }
      return res
    })
}

interface IntSettings extends Omit<Settings, 'version'> {
  version: KagiApiVersion
}

function toUrlStr(...elems: string[]): string {
  return elems.join("/")
}

