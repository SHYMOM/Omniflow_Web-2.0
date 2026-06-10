import axios, { AxiosAdapter, AxiosInstance } from 'axios';

import { ProxyConfig } from './types';

export class Proxy {
  /**
   *
   * @param proxyConfig The proxy config (optional)
   * @param adapter The axios adapter (optional)
   */
  constructor(protected proxyConfig?: ProxyConfig, protected adapter?: AxiosAdapter) {
    this.client = axios.create();

    // Inject stealth headers to bypass Cloudflare and prevent 403 blocks on scraper requests
    this.client.interceptors.request.use(config => {
      if (!config.headers) {
        config.headers = {} as any;
      }
      
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
      ];
      
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      
      const hasHeader = (name: string) => {
        const lower = name.toLowerCase();
        return Object.keys(config.headers).some(k => k.toLowerCase() === lower);
      };

      if (!hasHeader('User-Agent')) {
        config.headers['User-Agent'] = randomUA;
      }
      if (!hasHeader('Accept')) {
        config.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
      }
      if (!hasHeader('Accept-Language')) {
        config.headers['Accept-Language'] = 'en-US,en;q=0.5';
      }
      if (!hasHeader('Accept-Encoding')) {
        config.headers['Accept-Encoding'] = 'gzip, deflate, br';
      }
      
      return config;
    });

    if (proxyConfig) this.setProxy(proxyConfig);
    if (adapter) this.setAxiosAdapter(adapter);
  }
  private validUrl = /^https?:\/\/.+/;
  /**
   * Set or Change the proxy config
   */
  setProxy(proxyConfig: ProxyConfig) {
    if (!proxyConfig?.url) return;

    if (typeof proxyConfig?.url === 'string')
      if (!this.validUrl.test(proxyConfig.url)) throw new Error('Proxy URL is invalid!');

    if (Array.isArray(proxyConfig?.url)) {
      for (const [i, url] of this.toMap<string>(proxyConfig.url))
        if (!this.validUrl.test(url)) throw new Error(`Proxy URL at index ${i} is invalid!`);

      this.rotateProxy({ ...proxyConfig, urls: proxyConfig.url });
    }

    this.client.interceptors.request.use(config => {
      if (proxyConfig?.url && config.headers) {
        config.headers['x-api-key'] = proxyConfig?.key ?? '';
        config.url = `${proxyConfig.url}${config?.url ? config?.url : ''}`;
      }

      if (config?.url?.includes('anify') && config.headers) {
        config.headers['User-Agent'] = 'consumet';
      }

      return config;
    });
  }

  /**
   * Set or Change the axios adapter
   */
  setAxiosAdapter(adapter: AxiosAdapter) {
    this.client.defaults.adapter = adapter;
  }
  private rotateProxy = (proxy: Omit<ProxyConfig, 'url'> & { urls: string[] }) => {
    setInterval(() => {
      const url = proxy.urls.shift();
      if (url) proxy.urls.push(url);

      this.setProxy({ url: proxy.urls[0], key: proxy.key });
    }, proxy?.rotateInterval ?? 5000);
  };

  private toMap = <T>(arr: T[]): [number, T][] => arr.map((v, i) => [i, v]);

  protected client: AxiosInstance;
}

export default Proxy;
