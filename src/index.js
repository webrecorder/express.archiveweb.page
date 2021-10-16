import { LitElement, html, css } from 'lit-element';

//const ARCHIVE_PREFIX = __ARCHIVE_PREFIX__;

//const PROXY_PREFIX = __CORS_PREFIX__;


export default class LiveWebProxy extends LitElement
{
  constructor() {
    super();
    this.inited = false;
    this.archivePrefix = "https://web.archive.org/web/";
    this.proxyPrefix = "https://oldweb.today/proxy/";
  }

  static get properties() {
    return {
      url: { type: String },
      ts: { type: String },
      opts: { type: Object },
      inited: { type: Boolean },
      iframeUrl: { type: String },

      archivePrefix: { type: String },
      proxyPrefix: { type: String }
    }
  }

  firstUpdated() {
    this.initSW();

    const update = () => {
      const m = window.location.hash.slice(1).match(/\/?(?:([\d]+)\/)?(.*)/);
      if (m) {
        this.ts = m[1] || "";
        this.url = m[2] || "http://example.com/";
      }
    }

    window.addEventListener("hashchange", () => update());
    update();
  }

  updated(changedProps) {
    if (changedProps.has("url") || changedProps.has("ts")) {
      if (this.url && (this.url !== this.actualUrl || changedProps.has("ts"))) {
        this.dispatchEvent(new CustomEvent("load-started"));
        this.iframeUrl = `/w/live/${this.ts}mp_/${this.url}`;
      }
    }
  }

  async initSW() {
    const scope = "./";

    await navigator.serviceWorker.register("./sw.js", {scope});

    navigator.serviceWorker.addEventListener("message", (event) => {
      this.inited = true;
    });

    const baseUrl = new URL(window.location);
    baseUrl.hash = "";

    const msg = {
      msg_type: "addColl",
      name: "live",
      type: "live",
      file: {"sourceUrl": `proxy:${this.proxyPrefix}`},
      skipExisting: false,
      extraConfig: {
        "prefix": this.proxyPrefix, 
        "isLive": true,
        "archivePrefix": this.archivePrefix,
        "baseUrl": baseUrl.href,
        "baseUrlHashReplay": true,
      },
    };

    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", (event) => {
        navigator.serviceWorker.controller.postMessage(msg);
      });
    } else {
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }

  createRenderRoot() {
    return this;
  }

  render() {
    if (!this.inited || !this.iframeUrl) {
      return html``;
    }

    return html`
      <iframe sandbox="allow-downloads allow-modals allow-orientation-lock allow-pointer-lock\
         allow-popups allow-presentation allow-scripts allow-same-origin"
      class="native-frame" src="${this.iframeUrl}"
      @load="${this.onFrameLoad}" allow="autoplay 'self'; fullscreen" allowfullscreen
      ></iframe> 
    `;
  }

  onFrameLoad(event) {
    const detail = {};

    try {
      //const iframe = this.renderRoot.querySelector("iframe");
      detail.url = event.currentTarget.contentWindow.WB_wombat_location.href;
      this.actualUrl = detail.url;
    } catch(e) {
      console.log(e);
    }

    this.dispatchEvent(new CustomEvent("load-finished", {detail}));
  }
}

customElements.define("live-web-proxy", LiveWebProxy);
